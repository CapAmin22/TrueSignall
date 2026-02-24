# ADR-002 — HITL Enforced at Database State, Not Just the UI

**Status:** Accepted  
**Date:** February 2026  
**Author:** Project Signal Engineering Team

---

## Context

AI-generated content must never be automatically sent to another person without human oversight. A UI-only guard is insufficient — a bug, a direct API call, or a rogue worker could bypass it.

## Decision

HITL is enforced at the **database state machine level**, not just the UI.

The `signals.status` column transitions are:

```
AWAITING_APPROVAL → APPROVED_FOR_SEND
```

This transition can **only be triggered by an authenticated user action via the Vercel API**. No worker script, background job, or automated process has permission to write this status.

**Technical implementation:**
- Supabase Row Level Security (RLS) restricts which service role can write `APPROVED_FOR_SEND`
- Worker scripts (`signal_worker.py`, `rlhf_sync_worker.py`) are structurally prevented from writing this status — they never import the transition function
- The `copy_drafter.py` always writes `AWAITING_APPROVAL` — never beyond

## Consequences

**Positive:**
- Absolute guarantee that no AI draft is sent without explicit human approval
- Brand safety and trust maintained even if a worker has a bug

**Negative:**
- Adds UI round-trips (Vercel → Supabase → Oracle VM webhook for each draft)
- Slightly more complex state machine to reason about
