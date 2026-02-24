# ADR-005 — Supabase Realtime as UI Event Bus

**Status:** Accepted  
**Date:** February 2026

---

## Context

The Nurturing Dashboard needs to update in real time when a new signal is detected on the Oracle VM. Options considered:

| Option | Cost | Complexity |
|---|---|---|
| AWS SNS + SQS | Pay-per-message | High (need Lambda consumer) |
| Google Pub/Sub | Pay-per-message | High |
| Redis Pub/Sub | Self-hosted or paid | Medium |
| **Supabase Realtime (WebSocket)** | **Included in free tier** | **Low** |

## Decision

Use **Supabase Realtime** as the event bus between Oracle VM workers and the Vercel frontend.

**Flow:**
1. Oracle VM worker writes a new row to `signals` table → `status=UNREAD`
2. Supabase Realtime fires a WebSocket INSERT event to all subscribed Vercel clients
3. Vercel dashboard receives the event and renders the new Transparency Card

**Frontend subscription (Next.js):**
```typescript
supabase
  .channel('signals')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'signals' }, (payload) => {
    // Append new Transparency Card to feed
    addSignalCard(payload.new)
  })
  .subscribe()
```

## Consequences

**Positive:**
- Zero additional cost — Realtime is included in Supabase free tier
- No additional infrastructure (no message broker to deploy or manage)
- Vercel edge functions can also use it — no cold-start issues

**Negative:**
- Supabase Realtime has a 200 concurrent connections limit on the free tier
- If the Supabase instance auto-pauses, WebSocket connections drop — mitigated by `healthcheck_worker.py`
