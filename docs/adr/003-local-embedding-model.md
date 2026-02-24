# ADR-003 — Local Embedding Model (all-MiniLM-L6-v2) Over Paid APIs

**Status:** Accepted  
**Date:** February 2026

---

## Context

The RLHF loop requires embedding human-approved nurture emails into vectors for Qdrant. Options considered:

| Option | Cost | Latency | Privacy |
|---|---|---|---|
| OpenAI `text-embedding-3-small` | ~$0.02/1M tokens | Low | Sends data to OpenAI |
| Gemini Embedding API | Free (15 RPM) | Low | Sends data to Google |
| `sentence-transformers/all-MiniLM-L6-v2` | **$0** | ~10ms local | **Data stays on-prem** |

## Decision

Use `sentence-transformers/all-MiniLM-L6-v2` running **locally on the Oracle VM**.

## Consequences

**Positive:**
- Zero cost (model cached after first ~80MB download)
- Human-written email content never leaves the VM during embedding
- 384-dim vectors are fast and compact — ~65,000 vectors fit in Qdrant's 1GB free tier

**Negative:**
- Lower embedding quality than `text-embedding-3-large` for complex semantic tasks
- Oracle VM must have 200MB+ free disk and ~2GB RAM available (well within 24GB limit)
