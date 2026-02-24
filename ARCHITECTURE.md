# Architecture Deep-Dive — Project Signal

> **Audience**: Lead engineers and senior contributors  
> **Purpose**: Comprehensive technical reference for the Project Signal architecture

---

## System Overview

Project Signal is an **event-driven, serverless** B2B relationship nurturing platform. The architecture is designed entirely around the zero-cost infrastructure constraint: no single service costs money at the scale of an early-stage MVP.

```
[User's Browser] ←→ [Vercel: Next.js] ←→ [Supabase: PostgreSQL + WebSockets]
                                                        ↕  (state machine)
                                          [Oracle VM: Python Workers + Cron]
                                                        ↕  (vector push)
                                               [Qdrant Cloud: RLHF Store]
                                                        ↕  (inference)
                                            [Google Gemini 1.5 Flash API]
```

---

## Layer-by-Layer Reference

### Layer 1: Edge API & UI — Vercel (Next.js Hobby)

**Responsibilities:**
- Serve the Nurturing Dashboard (Transparency Card feed)
- Receive HITL user actions (Approve / Ignore / Draft)
- Fire webhook POSTs to Oracle VM to trigger drafting
- Subscribe to Supabase WebSocket for real-time signal updates

**Do NOT run here:**
- Playwright scraping (no browser runtime)
- SMTP verification (port 25 blocked)
- Heavy Gemini loops (serverless timeout: 10s)

---

### Layer 2: Heavy Compute — Oracle Cloud ARM VM (Always Free)

**Specs:** 4 OCPU · 24 GB RAM · 200 GB Block Storage · Elastic IP  
**Runtime:** Python 3.11 on Ubuntu 22.04

**Worker processes:**

| Worker | Schedule | Purpose |
|---|---|---|
| `signal_worker.py` | Every hour (cron) | Detect OSINT signals + enrich with Gemini rationales |
| `rlhf_sync_worker.py` | Weekly (Sunday 2AM) | Embed human-approved emails → push to Qdrant |
| `healthcheck_worker.py` | Mon + Thu midnight | Ping Supabase to prevent free-tier pause |

**Port 25 requirement:** SMTP verification (`email_verifier.py`) requires an elastic IP on port 25. This is achievable on OCI but **not on AWS/GCP free tiers**.

---

### Layer 3: Relational State — Supabase (PostgreSQL + Realtime)

**The database is the workflow engine.** Rather than a message queue, we use Supabase's row-level Realtime to trigger UI events.

#### State Machine: `companies.system_status`

```
INGESTING → PENDING_REVIEW → ACTIVE → DORMANT
                                ↓
                            BLOCKED  (direct competitor, locked)
```

#### State Machine: `signals.status`

```
UNREAD → DRAFTING → AWAITING_APPROVAL → APPROVED_FOR_SEND → SENT
  ↓                                                          ↓
IGNORED                                               (→ RLHF sync)
```

**The HITL pause mechanism:**
1. Oracle VM writes a signal → `status=UNREAD`
2. Supabase fires a WebSocket INSERT event to Vercel
3. Vercel renders the Transparency Card (source URL + AI rationale)
4. User clicks "Draft Action" → Vercel API flips `status=DRAFTING`
5. Vercel fires POST to Oracle VM webhook
6. Oracle VM generates draft → flips `status=AWAITING_APPROVAL`
7. User approves → Vercel flips `status=APPROVED_FOR_SEND`
8. Message is sent externally (v1.1: via Gmail/HubSpot integration)

---

### Layer 4: Vector State — Qdrant Cloud

**Purpose:** Store human-approved nurture email embeddings for RAG-based few-shot learning.

**Collection:** `nurture_drafts`  
**Model:** `sentence-transformers/all-MiniLM-L6-v2` (local on Oracle VM, 384 dimensions)  
**Distance metric:** Cosine similarity

**Payload schema per vector:**
```json
{
  "signal_id": "uuid",
  "signal_type": "MACRO | MICRO",
  "signal_summary": "string",
  "text": "the human-written email",
  "sent_at": "ISO timestamp"
}
```

---

### Layer 5: Intelligence — Gemini 1.5 Flash API

**Free tier limit:** 15 Requests Per Minute (RPM)

**Rate limiting strategy:** `RateLimiter` class in `src/utils/rate_limiter.py` enforces a minimum interval of `60/15 + 0.1 = 4.1 seconds` between API calls. This is a hard requirement — 100 signals without rate limiting causes HTTP 429 crashes.

**All Gemini calls in the codebase:**

| Module | Call Purpose | Prompt Type |
|---|---|---|
| `usp_extractor.py` | Extract USPs from scraped HTML | Structured JSON extraction |
| `icp_generator.py` | Generate Target Account List | Structured JSON generation |
| `matrix_builder.py` | Categorize competitors into tiers | Structured JSON classification |
| `battlecard_generator.py` | Extract competitor weaknesses | Plain text summarization |
| `signal_card.py` | Generate signal rationale | Plain text, 3 sentences max |
| `copy_drafter.py` | Write nurture message | Plain text, 5 sentences max, no pitch |

---

## Critical Failure Points & Mitigations

| Failure | Cause | Mitigation |
|---|---|---|
| **HTTP 429 from Gemini** | >15 API calls/minute | `RateLimiter` enforces 4.1s sleep between calls |
| **Oracle VM IP blocked by Spamhaus** | Too many SMTP pings to one domain | Max 10 verifications/domain/hour in `email_verifier.py` |
| **Supabase auto-pause** | No DB activity for 7 days | `healthcheck_worker.py` pings twice/week |
| **DuckDuckGo rate limiting** | Too many searches too fast | 0.8-1.5s polite delays between DDG calls in all modules |
| **Missing source_url on signal** | OSINT search returns malformed result | `signal_card.py` raises `ValueError` and skips — never surfaces dark data |

---

## GDPR / CCPA Erasure Flow

When a prospect requests data deletion:

```python
# Step 1: Delete from Supabase (cascades to signals + competitors)
SELECT hard_delete_prospect('prospect-domain.com');

# Step 2: Delete from Qdrant vector store
from src.rlhf.qdrant_sync import delete_vectors_for_signal
for signal_id in affected_signal_ids:
    delete_vectors_for_signal(signal_id)
```

Both steps are required for complete GDPR-compliant erasure.
