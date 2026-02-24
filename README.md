<div align="center">

<img src="docs/assets/signal_banner.svg" alt="Project Signal" width="100%">

# 🎯 Project Signal
### Autonomous B2B Relationship Nurturing & Signal Intelligence Platform

![CONFIDENTIAL](https://img.shields.io/badge/⚠%20CLASSIFICATION-CONFIDENTIAL-CC0000?style=for-the-badge&labelColor=1a1a1a)
![STATUS](https://img.shields.io/badge/STATUS-MVP%20IN%20DEVELOPMENT-FF6B00?style=for-the-badge&labelColor=1a1a1a)

---

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Gemini](https://img.shields.io/badge/AI-Gemini%201.5%20Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![Supabase](https://img.shields.io/badge/DB-Supabase%20PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Qdrant](https://img.shields.io/badge/Vectors-Qdrant%20Cloud-DC143C)](https://qdrant.tech/)
[![Vercel](https://img.shields.io/badge/Frontend-Vercel%20Next.js-000000?logo=vercel&logoColor=white)](https://vercel.com/)
[![OCI](https://img.shields.io/badge/Compute-Oracle%20Cloud%20ARM-F80000?logo=oracle&logoColor=white)](https://www.oracle.com/cloud/)
[![License](https://img.shields.io/badge/License-PROPRIETARY%20%26%20CONFIDENTIAL-CC0000)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/CapAmin22/Signal.AI/ci.yml?branch=main&label=CI&logo=github)](https://github.com/CapAmin22/Signal.AI/actions)

> **⚠ CONFIDENTIAL — Internal Use Only.** This repository and all its contents are proprietary and classified. Access restricted to authorized team members under NDA. See [LICENSE](LICENSE).

</div>

---

## 📌 Executive Summary

Project Signal is a **zero-cost, serverless, event-driven** autonomous B2B sales nurturing engine. It replaces the broken "spray and pray" cold outreach model with a **relationship-first intelligence layer** that:

- 🔍 Transforms a single company URL into an exhaustive prospect + decision-maker map
- 🛡 Builds a live competitive Defensive Matrix (auto-blocklist + battlecards)
- 📡 Monitors decision-makers 24/7 for life events, promotions, and company signals
- 🃏 Surfaces each signal as a **Transparency Card** — with a clickable source and AI rationale
- ✍️ Drafts relationship-first messages using **Gemini + RAG** — but **never sends without human approval**

**Human-in-the-Loop (HITL) is protected at the architecture level, not just the UI.**

---

## 🏗 System Architecture

### High-Level Infrastructure

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PROJECT SIGNAL STACK                         │
├─────────────────┬───────────────────────────────────────────────────┤
│  LAYER          │  TECHNOLOGY                      │  COST          │
├─────────────────┼──────────────────────────────────┼────────────────┤
│  Edge / UI      │  Vercel (Next.js Hobby)           │  $0/mo         │
│  Heavy Compute  │  Oracle Cloud ARM VM (4 OCPU)    │  $0/mo (Always Free) │
│  Relational DB  │  Supabase PostgreSQL + Realtime  │  $0/mo (500MB) │
│  Vector Store   │  Qdrant Cloud (RLHF)             │  $0/mo (1 GB)  │
│  AI Engine      │  Gemini 1.5 Flash API            │  $0/mo (15 RPM)│
├─────────────────┴──────────────────────────────────┴────────────────┤
│                    TOTAL MONTHLY INFRASTRUCTURE COST: $0            │
└─────────────────────────────────────────────────────────────────────┘
```

### Full Pipeline Data Flow

```mermaid
flowchart TD
    classDef hitl fill:#FBBC04,stroke:#E67E00,color:#000,font-weight:bold
    classDef ai fill:#4285F4,stroke:#2965CC,color:#fff
    classDef db fill:#3ECF8E,stroke:#2AA876,color:#fff
    classDef worker fill:#F80000,stroke:#CC0000,color:#fff,rx:8
    classDef output fill:#34A853,stroke:#1E7E34,color:#fff

    U["👤 User: Enter Company URL"]
    S1["🌐 Ingestion Engine\n(Playwright Scraper)"]
    S2["🤖 Gemini: USP Extractor\n(market_data JSONB)"]
    H1{{"⚡ HITL #1\nApprove Prospect List"}}:::hitl
    S3["🎯 ICP Generator\n(DuckDuckGo + Gemini)"]
    S4["👤 Decision-Maker Mapper\n(LinkedIn OSINT Dorks)"]
    S5["🛡 Competitor Matrix\n(Tri-Tier Categorization)"]
    S6["⚔️ Battlecard Generator\n(G2 / Capterra Scraper)"]
    H2{{"⚡ HITL #2\nLock Competitor Matrix"}}:::hitl
    DB[("🗄 Supabase\nPostgreSQL")]:::db
    WS["⚡ Realtime WebSocket\nBroadcast"]
    DASH["🖥 Vercel Dashboard\nTransparency Card Feed"]
    H3{{"⚡ HITL #3\nDraft Action?"}}:::hitl
    S7["📡 Signal Detector\n(RSS + DDG OSINT)"]:::worker
    S8["🃏 Signal Card Builder\nSource URL + AI Rationale"]:::ai
    S9["✍️ Copy Drafter\n(Gemini + RAG Few-Shot)"]:::ai
    H4{{"⚡ HITL #4\nApprove & Send?"}}:::hitl
    SENT["✅ Message Sent"]:::output
    RLHF["🔁 RLHF Loop\nEmbed → Qdrant"]
    Q[("🧠 Qdrant Cloud\nVector Store")]:::db

    U --> S1 --> S2 --> S3 --> S4 --> H1
    H1 --> S5 --> S6 --> H2
    H2 --> DB
    DB --> WS --> DASH --> H3
    S7 --> S8 --> DB
    H3 --> S9 --> H4
    H4 --> SENT --> RLHF --> Q
    Q -.->|"Few-Shot RAG"| S9
```

---

## 📋 Module Breakdown

### Module 1 — Deep Market & Lead Generation Engine

```mermaid
sequenceDiagram
    actor User
    participant CLI as main.py (CLI)
    participant Scraper as src/ingestion/scraper.py
    participant USP as src/ingestion/usp_extractor.py
    participant ICP as src/intelligence/icp_generator.py
    participant DM as src/intelligence/decision_maker_mapper.py
    participant DB as Supabase

    User->>CLI: python main.py --url https://company.com
    CLI->>Scraper: scrape_brand_info(url)
    Scraper-->>CLI: raw_content (HTML → text)
    CLI->>USP: extract_usps_and_positioning(raw_content)
    Note over USP: Gemini 1.5 Flash call<br/>→ {usps, services, audience}
    USP-->>CLI: market_data (JSONB)
    CLI->>ICP: generate_target_account_list(market_data)
    Note over ICP: DuckDuckGo OSINT search<br/>+ Gemini → 20+ accounts
    ICP-->>CLI: target_accounts[]
    CLI->>DM: map_decision_makers(accounts)
    Note over DM: LinkedIn dorks per account<br/>VP Sales / CMO / CRO
    DM-->>CLI: enriched_accounts[]
    CLI->>DB: upsert companies (status=PENDING_REVIEW)
    DB-->>User: 🖥 Dashboard: HITL Checkpoint #1
```

---

### Module 2 — Defensive Matrix (Competitor Intelligence)

```mermaid
flowchart LR
    A["Market Search\n(DuckDuckGo)"] --> B["Gemini Classifier"]
    B --> C{"Threat Level?"}
    C -->|"DIRECT"| D["🚫 Auto-Blocklist\nsystem_status=BLOCKED"]
    C -->|"ADJACENT"| E["🤝 Partner Flag\nCo-marketing opportunity"]
    C -->|"INDIRECT"| F["🔍 Intel Monitor\nG2 + Capterra scrape"]
    F --> G["⚔️ Battlecard\nWeakness summary → DB"]
    D --> H[("Supabase\ncompetitors table")]
    E --> H
    G --> H

    style D fill:#CC0000,color:#fff
    style E fill:#2196F3,color:#fff
    style F fill:#FF9800,color:#fff
```

---

### Module 3 — Nurturing Dashboard & Signal Flow

```mermaid
flowchart TD
    W["⏰ Hourly Cron\nOracle VM"]
    SD["📡 signal_detector.py\nOSINT: RSS + DDG dorks"]
    SC["🃏 signal_card.py\nGemini Rationale Generator"]
    DB[("Supabase\nsignals table\nstatus=UNREAD")]
    RT["⚡ Supabase Realtime\nWebSocket INSERT event"]
    D["🖥 Vercel Dashboard\nTransparency Card"]

    W --> SD
    SD -->|"MACRO signal\n(Funding, Hiring)"| SC
    SD -->|"MICRO signal\n(Promotion, Life Event)"| SC
    SC --> DB
    DB --> RT --> D

    subgraph "Transparency Card (PRD Tenet #2 — Non-Negotiable)"
        TC1["👤 Decision-Maker Name + Title"]
        TC2["📰 Signal Summary"]
        TC3["🔗 Source URL (clickable — REQUIRED)"]
        TC4["🤖 AI Rationale (plain text — REQUIRED)"]
    end

    D --> TC1
    D --> TC2
    D --> TC3
    D --> TC4
```

---

### Module 4 — Supervised Drafting (HITL State Machine)

```mermaid
stateDiagram-v2
    [*] --> UNREAD : Signal detected by worker
    UNREAD --> DRAFTING : User clicks "Draft Action"\n(Vercel API call)
    UNREAD --> IGNORED : User dismisses signal
    DRAFTING --> AWAITING_APPROVAL : Gemini draft generated\n(copy_drafter.py)
    AWAITING_APPROVAL --> APPROVED_FOR_SEND : ✅ User clicks "Approve & Send"\n(HITL — UI only)
    AWAITING_APPROVAL --> DRAFTING : User requests re-draft
    APPROVED_FOR_SEND --> SENT : Message dispatched\n(v1.1: Gmail / HubSpot)
    SENT --> [*] : RLHF sync → Qdrant

    note right of AWAITING_APPROVAL
        🔒 CANNOT be flipped to
        APPROVED_FOR_SEND by
        any worker or script.
        Human action required.
    end note
```

---

### RLHF Progressive Autonomy Loop

```mermaid
flowchart LR
    A["✅ User approves\n& sends message"] --> B["signals.human_edited_text\nstored in Supabase"]
    B --> C["Weekly cron:\nrlhf_sync_worker.py"]
    C --> D["sentence-transformers\nall-MiniLM-L6-v2\n(local on Oracle VM)"]
    D --> E[("Qdrant Cloud\nnurture_drafts collection")]
    E -->|"Top-3 similar\nfew-shot examples"| F["RAG Retriever\nrag_retriever.py"]
    F -->|"Injected into prompt"| G["Gemini 1.5 Flash\n(next draft)"]

    style D fill:#4285F4,color:#fff
    style E fill:#DC143C,color:#fff
    style G fill:#4285F4,color:#fff
```

---

## 🗺️ Roadmap

| Phase | Version | Status | Key Deliverables |
|---|---|---|---|
| **MVP** | `v1.0` | 🔨 **IN DEVELOPMENT** | URL ingestion · ICP + DM mapping · Competitor matrix · Signal detection · Transparency Cards · AI drafting (copy/paste) |
| **Workflow** | `v1.1` | 📋 Planned | Brand Nurture Calendar · HubSpot/Salesforce API · Gmail/Outlook direct send · Deeper OSINT signals |
| **Autonomy** | `v2.0` | 🔮 Future | Progressive Autonomy · Auto-send when AI confidence ≥ threshold · Full RLHF tone matching |

---

## ⚡ Quick Start (Authorized Engineers Only)

> Before you begin: ensure you have signed the NDA and received credentials from the project lead.

### 1. Clone

```bash
git clone https://github.com/CapAmin22/Signal.AI.git
cd Signal.AI
```

### 2. Environment

```bash
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate    # macOS/Linux

pip install -r requirements.txt
playwright install chromium
```

### 3. Configure secrets

```bash
cp .env.example .env
# Fill in all values — see .env.example for documentation on each key
```

### 4. Initialize database

```sql
-- Run in Supabase Dashboard > SQL Editor
-- File: database/schema.sql
```

### 5. Run the pipeline

```bash
python main.py --url https://yourcompany.com
```

### 6. Deploy workers on Oracle VM

```bash
# See DEVELOPMENT.md for full Oracle VM setup guide
python workers/signal_worker.py       # Test run (normally cron'd hourly)
python workers/healthcheck_worker.py  # Test Supabase connection
```

**→ See [DEVELOPMENT.md](DEVELOPMENT.md) for the complete engineer onboarding guide.**

---

## 🗂 Repository Structure

```
Signal.AI/
│
├── 📄 README.md                    ← You are here
├── 📄 ARCHITECTURE.md              ← Deep-dive 5-layer technical reference
├── 📄 DEVELOPMENT.md               ← Engineer onboarding & local dev guide
├── 📄 CONTRIBUTING.md              ← Code standards & HITL rules for contributors
├── 📄 SECURITY.md                  ← GDPR/CCPA policy & responsible disclosure
├── 📄 LICENSE                      ← PROPRIETARY & CONFIDENTIAL
│
├── ⚙️  main.py                      ← CLI entry point (4-stage pipeline)
├── 📦 requirements.txt             ← All Python dependencies
├── 🔑 .env.example                 ← Environment variable template
│
├── 📁 config/
│   └── settings.py                 ← Pydantic BaseSettings (typed env loading)
│
├── 📁 database/
│   ├── schema.sql                  ← Supabase PostgreSQL DDL (full schema)
│   └── migrations/001_initial.sql  ← Idempotent first migration
│
├── 📁 docs/
│   └── flows/                      ← Draw.io source files for all flow diagrams
│
├── 📁 src/
│   ├── ingestion/                  ← Module 1-A: URL ingestion
│   │   ├── scraper.py              ← Playwright async scraper
│   │   └── usp_extractor.py        ← Gemini USP/positioning extraction
│   │
│   ├── intelligence/               ← Module 1-B: ICP & decision-maker mapping
│   │   ├── icp_generator.py        ← TAL generation (DDG + Gemini)
│   │   └── decision_maker_mapper.py← LinkedIn OSINT dorks
│   │
│   ├── signals/                    ← Module 3-A: Signal detection & rationale
│   │   ├── signal_detector.py      ← RSS feeds + DuckDuckGo OSINT
│   │   └── signal_card.py          ← Transparency Card builder (source + rationale)
│   │
│   ├── competitors/                ← Module 2: Defensive Matrix
│   │   ├── matrix_builder.py       ← Tri-tier categorization
│   │   └── battlecard_generator.py ← G2/Capterra weakness extraction
│   │
│   ├── enrichment/                 ← Contact enrichment (zero-cost)
│   │   └── email_verifier.py       ← SMTP handshake (no Apollo/Hunter needed)
│   │
│   ├── drafting/                   ← Module 4: Supervised execution
│   │   ├── prompt_builder.py       ← Anti-pitch prompt architecture
│   │   └── copy_drafter.py         ← HITL-gated Gemini copy generation
│   │
│   ├── rlhf/                       ← Progressive Autonomy (v2.0)
│   │   ├── embedder.py             ← all-MiniLM-L6-v2 local embedding
│   │   ├── qdrant_sync.py          ← Qdrant Cloud vector push + GDPR delete
│   │   └── rag_retriever.py        ← Few-shot RAG for Gemini prompts
│   │
│   ├── models/
│   │   └── schemas.py              ← Pydantic v2 models (Company, Signal, etc.)
│   │
│   └── utils/
│       ├── database.py             ← Supabase client + state machine helpers
│       ├── rate_limiter.py         ← Gemini 15 RPM enforcer
│       └── logger.py               ← Structured JSON logger (stdlib only)
│
├── 📁 workers/                     ← Oracle VM cron scripts
│   ├── signal_worker.py            ← Hourly: OSINT detection + Gemini enrichment
│   ├── rlhf_sync_worker.py         ← Weekly: embed → push to Qdrant
│   └── healthcheck_worker.py       ← 2x/week: Supabase keep-alive
│
└── 📁 .github/
    ├── workflows/ci.yml            ← Ruff lint + mypy + schema validation
    └── ISSUE_TEMPLATE/             ← Bug report + Feature request templates
```

---

## 📊 KPI Targets

| Metric | Description | Target |
|---|---|---|
| **Signal Action Rate** | % of signals where user clicks "Draft Action" | **> 35%** |
| **HITL Acceptance Rate** | % of AI drafts approved without major edits | **> 80%** |
| **Pipeline Velocity** | Time from "Identified" → "First Positive Reply" | **Minimize** |

---

## 🔐 Security & Compliance

- **Public data only** — signals sourced exclusively from content decision-makers posted publicly
- **GDPR/CCPA** — hard-delete cascades across Supabase AND Qdrant vector store simultaneously
- **HITL architecture** — no external message can leave the system without explicit user approval
- **Gemini RPM guard** — rate limiter prevents runaway API costs and 429 crashes
- **SMTP rate limit** — max 10 pings/domain/hour to protect Oracle VM IP reputation

→ Full policy in [SECURITY.md](SECURITY.md)

---

## ⚠ Confidentiality Notice

This repository is **PROPRIETARY AND CONFIDENTIAL**. All code, architecture, documentation, and data contained herein are trade secrets of the copyright holder.

Unauthorized access, copying, distribution, or use is strictly prohibited and may result in civil and criminal penalties. By accessing this repository you confirm you are an authorized team member operating under a valid NDA.

**© 2026 Amin — Project Signal. All rights reserved.**
