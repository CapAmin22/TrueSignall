# docs/ — Project Signal Technical Documentation

> ⚠ **CONFIDENTIAL — Authorized Team Only**

This directory contains supplementary technical documentation and reference materials for the Project Signal engineering team.

---

## Contents

| File/Folder | Description |
|---|---|
| `flows/` | Mermaid and Draw.io source files for all architecture diagrams |
| `adr/` | Architecture Decision Records — rationale for key technical choices |

---

## Architecture Diagrams

All primary flow diagrams are embedded in [../README.md](../README.md) using GitHub-native Mermaid rendering.

The diagrams cover:

1. **End-to-End Pipeline** — Full system data flow from URL input to RLHF feedback loop
2. **Module 1 Sequence** — Ingestion, USP extraction, ICP generation, decision-maker mapping
3. **Module 2 Flow** — Competitor matrix tri-tier categorization and auto-blocklisting
4. **Module 3 Signal Flow** — OSINT detection → Transparency Card → Supabase → WebSocket → Dashboard
5. **Module 4 HITL State Machine** — Signal status transitions with HITL guard points
6. **RLHF Progressive Autonomy Loop** — Human approval → embedding → Qdrant → RAG → next draft

---

## Architecture Decision Records (ADR)

ADRs document **why** key technical decisions were made, not just what was decided.

| ADR | Title | Status |
|---|---|---|
| [ADR-001](adr/001-zero-cost-architecture.md) | Zero-cost infrastructure selection | ✅ Accepted |
| [ADR-002](adr/002-hitl-at-architecture-level.md) | HITL enforced at DB state, not just UI | ✅ Accepted |
| [ADR-003](adr/003-local-embedding-model.md) | Local all-MiniLM-L6-v2 over paid embedding APIs | ✅ Accepted |
| [ADR-004](adr/004-duckduckgo-over-paid-search.md) | DuckDuckGo OSINT over Apollo/Hunter | ✅ Accepted |
| [ADR-005](adr/005-supabase-realtime-as-event-bus.md) | Supabase Realtime as UI event bus (no Kafka/Pub-Sub) | ✅ Accepted |
