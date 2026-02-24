# ADR-001 — Zero-Cost Infrastructure Selection

**Status:** Accepted  
**Date:** February 2026  
**Author:** Project Signal Engineering Team

---

## Context

Project Signal requires 24/7 signal monitoring, a relational database with real-time events, a vector store for RLHF, and a frontend dashboard — all before a single dollar of revenue.

## Decision

We selected the following zero-cost stack:

| Need | Solution | Free Tier Constraint |
|---|---|---|
| Compute (heavy) | Oracle Cloud ARM VM | 4 OCPU · 24 GB · Always Free |
| Relational DB | Supabase PostgreSQL | 500 MB · Auto-pauses at 7d inactivity |
| Vector Store | Qdrant Cloud | 1 GB storage · 1 node |
| AI Inference | Gemini 1.5 Flash | 15 RPM · 1M tokens/day |
| Frontend | Vercel Hobby | Unlimited bandwidth · 10s serverless timeout |

## Consequences

**Positive:**
- Zero monthly infrastructure cost at MVP
- Supabase Realtime replaces Kafka (no additional cost)
- Oracle Cloud VM allows port 25 (SMTP verification — blocked on AWS/GCP free tiers)

**Negative / Mitigations:**
- 15 RPM Gemini limit → mitigated by `RateLimiter(rpm=15)` with 4.1s sleep
- Supabase auto-pause → mitigated by `healthcheck_worker.py` running Mon/Thu
- 10s Vercel timeout → heavy compute offloaded to Oracle VM workers exclusively
