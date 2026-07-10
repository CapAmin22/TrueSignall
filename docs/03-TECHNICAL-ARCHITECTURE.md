# 03 · SIGNAL AI — Technical Architecture

**Goal:** run the full MVP feature set for **100 users at $0/month infrastructure**, on a stack Claude Code builds fluently, with a paved upgrade path at every ceiling.
**Non-functional requirements:** availability ~99.5% is acceptable at this stage (free tiers) · eventual consistency fine everywhere except auth/billing · latency targets: feed load <3s, draft <10s, pixel-signal <15min, RSS-signal <6h · durability: Postgres is the single source of truth; nothing user-facing lives only in caches.

---

## 1. Capacity Model @ 100 users (the math that proves $0 works)

Assumptions: 100 workspaces · avg 60 monitored accounts each · **~2,500 unique companies after dedup** (heavy overlap in B2B SaaS targets — measured assumption; global-ingest design below makes even 6,000 fine) · avg 0.35 new signals/company/day.

| Dimension | Estimate | Free-tier ceiling | Headroom |
|---|---|---|---|
| DB size | companies 2.5K×3KB + signals 26K/mo×2KB + deliveries ~80K/mo×0.5KB + rest ≈ **220–320MB @6mo** (with 90-day delivery pruning) | Supabase 500MB | ~1.6–2.3× |
| App requests | 100 users × ~120 req/day ≈ 12K/day | Vercel Hobby 100GB-h / CF Pages 100K req/day | ≥8× |
| Edge Function invocations | pollers 96/day×~40 shards + scoring + webhooks ≈ **6–8K/day = ~220K/mo** | Supabase 500K/mo | ~2.2× |
| Realtime | ≤100 concurrent, ~90K msgs/mo | 200 conc / 2M msgs | ≥20× |
| LLM calls | why-lines ~900/day(global, cached) + drafts ~300/day + ICP/misc ~100 ≈ **≤1,300/day** | Gemini free ~1,000–1,500 RPD/model (2 models) + Groq fallback ~1K RPD | fits with router (§06 §3) — the tightest budget in the system; per-plan draft quotas are the backstop |
| Outreach email | ≤50/user/day via **their** Gmail quota | Gmail consumer ~500/day/user | ≥10× |
| Product email | digests+alerts ≈ 2.4K/mo | Resend 3K/mo | 1.25× (digest batching if needed) |
| Heavy crawls | careers-diff+tech-detect: 2.5K domains ÷ 7d ≈ 360 domains/night ≈ 30–40 min | GH Actions 2,000 min/mo (~66/day) | ~1.7× |
| Gmail metadata polling | reply-check on active threads, batched | Gmail API 1B quota units/day/project | effectively unlimited |
**Verdict:** every line has ≥1.25× headroom at 100 users. Alarms fire at 80% (§11 §7). First dollars spent, in order, if growth outruns this: Gemini paid tier (~$0.10/1M in tokens, Flash-Lite) → Supabase Pro $25 → hosting $0–20.

## 2. High-Level Design
```
                     ┌────────────────────────── Vercel Hobby → CF Pages ──────────────────────────┐
 Browser ── HTTPS ──▶│  Next.js 15 (App Router)                                                   │
  │  ▲               │   RSC pages · Server Actions (mutations) · Route Handlers:                  │
  │  │ Realtime WS   │   /api/webhooks/{rb2b,stripe} · /api/t/o/[token].gif · /api/cron/* (secret) │
  │  └───────────────│   /api/clip (Signal Clipper)                                                │
  ▼                  └───────────────┬──────────────────────────────────────────────┬─────────────┘
 Customer sites                      │ supabase-js (RLS, anon)        service-role  │
 (pixel snippet) ──▶ /api/px ─┐      ▼                                              ▼
                              │   ┌──────────────────────── Supabase (free) ─────────────────────┐
 RB2B ─▶ /api/webhooks/rb2b ──┼──▶│ Postgres 15: app schema + RLS · pgvector · pg_cron · Vault    │
 Stripe ─▶ /api/webhooks/stripe   │ Auth (Google/LinkedIn OAuth) · Realtime (deliveries channel)  │
                                  │ Edge Functions (Deno): ingest-rss · ingest-careers ·          │
                                  │  ingest-news · score-refresh · fanout · gmail-sync ·          │
                                  │  digest-send · followup-scan                                  │
                                  └──────────────┬────────────────────────────────────────────────┘
                                                 │ pg_cron schedules (§04 §6)          ▲ results
        GitHub Actions (nightly, 2,000 min/mo): careers-page diff · tech-detect (wappalyzer rules)
        · conference/PH/YC seeders  ── writes via service-role REST ────────────────────┘
 External free APIs pulled by functions/actions: RSS feeds · SEC EDGAR · Greenhouse/Lever/Ashby/Workable
 · Google News RSS · GitHub API · Product Hunt GQL · ip→ASN db  |  LLMs: Gemini (primary) / Groq (fallback)
 Outbound: user's Gmail API (send + metadata) · Resend (product mail) · Sentry · PostHog
```
Monolith-on-purpose: one Next.js app + one Supabase project. No queues, no Redis, no microservices — pg_cron + Edge Functions + GH Actions cover all async needs at this scale, and Postgres (`FOR UPDATE SKIP LOCKED` on `ingestion_runs`) is the job queue.

## 3. The Load-Bearing Pattern — Global Ingest, Per-Workspace Fan-out
Every monitoring cost scales with **unique companies**, not customers.
1. `companies` and `signals` are global (deduped by domain; signals deduped by `hash(domain|type|canonical_url|day)`).
2. Pollers ingest each source once per cadence for the union of all monitored domains (sharded).
3. On signal insert, a `fanout` step creates one `signal_delivery` per subscribing workspace-account, computes workspace-specific urgency (ICP fit differs per workspace), applies stacking, and publishes to that workspace's Realtime channel.
Consequences: adding customer #100 whose 60 targets are already in-corpus costs ~0 marginal ingestion; the corpus itself becomes the Discover dataset (AD-01), compounding value. RLS: global tables readable by any authed user (firmographic/public data only — no personal data lives there), writable only by service role; all workspace tables locked by membership (§04 §5).

## 4. Stack Decisions & Trade-offs (the three that matter)
**T1 Hosting/ToS.** Vercel Hobby prohibits commercial use. Decision: Hobby for M0–private beta (pre-revenue testing), then either (a) Cloudflare Pages via OpenNext — $0, commercial-allowed, 100K req/day (chosen default at public launch; the app avoids Node-only APIs in request paths to stay portable), or (b) $20 Vercel Pro at first paying customer. Trade-off accepted: OpenNext adds build complexity; mitigated by a CI job that builds both targets from M3.
**T2 Free LLM quotas vs product SLAs.** Gemini free RPD is the system's scarcest resource. Mitigations baked in: one-why-line-per-signal caching (global, not per-workspace), deterministic scoring (no LLM), provider router with Groq fallback + minute-level rate governor + per-plan draft quotas, and graceful degradation (draft button shows "AI busy — retry in 60s" rather than failing silently). Trade-off: worst-case p95 draft latency during spikes; acceptable pre-revenue.
**T3 No LinkedIn automation.** We trade signal completeness for compliance + durability (their enforcement kills competitors regularly). Substitutes in §05 §6; provider-swap interface means the paid upgrade is config, not rearchitecture.
Minor: Server Actions over a REST layer (fewer moving parts; webhooks/cron/pixel stay Route Handlers) · Realtime over polling (free, simpler) · Deno Edge Functions for pollers (keeps Vercel invocations near zero).

## 5. Core Data Flows
**5.1 RSS/API signal (funding example):** pg_cron every 15min → `ingest-rss` (shard i of N) → fetch feed w/ ETag/If-Modified-Since → parse entries → resolve/create company by domain (LLM-assisted extraction only when regex fails, cached) → dedup-hash upsert into `signals` → for new rows call `fanout` → deliveries + urgency (§05 §8) + stack-group assign → Realtime broadcast → feed updates. Target ≤6h publication→feed (poll 15min; feeds publish fast).
**5.2 Visitor pixel:** page load → snippet beacons `/api/px?ws=…` (1×1 gif route) → Route Handler: hash IP, geo+ASN lookup (bundled free db) → resolve org→domain → if domain ∈ workspace's monitored accounts → session-aggregate (30-min window, path list) → pricing-path match ⇒ signal `pricing_visit` (≤15min SLO via 5-min session-flush cron) else `site_visit` on 3+ page sessions. RB2B webhook enriches person-level where its free credits allow. EU IPs: company-level only unless consent flag (§09 §4).
**5.3 Draft→Send→Reply:** Draft button → server action `generateDraft(deliveryId)` → assemble context (signal payload+why-line, contact, relationship stage from history, voice profile, guardrails) → LLM (§06 P-5) → validate (signal-reference present, banned phrases, length) → store `outreach_drafts` → user edits → `sendViaGmail` action: exchange stored refresh token (Vault) → `users.messages.send` w/ embedded pixel URL + our `X-SignalAI-Id` header → store `outreach_messages` → follow-up row scheduled. Replies: `gmail-sync` (5–10min cron, per-user batched `history.list` metadata) matches thread → `replied_at` → pauses follow-up → analytics.
**5.4 Nightly GH Actions:** matrix over domain shards → careers-page fetch+hash-diff (new job URLs ⇒ hiring signals w/ title→category mapping §05 §5.2) → tech-detect ruleset match vs stored fingerprint ⇒ `tech_change` → POST batches to a service-role ingest endpoint. Budget guard: job self-aborts at 45 min.

## 6. Failure Modes & Mitigations
| Failure | Blast radius | Mitigation |
|---|---|---|
| A source breaks (markup/API change) | that signal type staleness | `source_health` (§04): consecutive-failure counter → auto-disable at 5 + Sentry alert + feed banner "X paused"; other 14+ sources unaffected |
| Gemini quota/outage | drafts, why-lines | router→Groq; why-lines queue for retry (non-blocking); UI retry state |
| Gmail token revoked | that user's send/replies | 401 → mark integration `needs_reauth`, in-app + email prompt; drafts still generate (copy-paste path) |
| Edge Function cold/timeout on big shard | delayed signals | shards sized ≤50 domains, ≤30s budget; `ingestion_runs` checkpoint → next tick resumes; idempotent upserts make retries safe |
| GH Actions minutes exhausted | careers/tech freshness | budget guard + priority queue (Hot accounts first); weekly cadence degradation acceptable |
| Pixel abuse/flood | DB writes | per-IP token bucket at handler, 30-min session aggregation, drop non-monitored domains early |
| Supabase pause (7-day inactivity) | everything (dev only) | keep-alive ping in daily GH job |
| Duplicate signals across sources | noisy feed | canonical dedup hash + 24h fuzzy title match per (company,type) |
| Realtime disconnect | stale feed | client falls back to 60s SWR revalidate; reconnect banner |

## 7. Security & Ops Summary (details in 09/11)
Secrets only in Vercel/Supabase/GH env stores; OAuth refresh tokens encrypted in Supabase Vault; cron routes require `CRON_SECRET` bearer; webhooks signature-verified (Stripe sig, RB2B HMAC); RLS default-deny; service-role key never in client bundles; Sentry (server+client) + PostHog from M0; daily `pg_dump` to GH-encrypted artifact (free) until Supabase Pro PITR.

## 8. Scaling Path (so v1 decisions don't box us in)
100→1K users: Supabase Pro $25 (8GB) + Gemini paid + CF stays $0 → same architecture. 1K→10K: read replica, move pollers to CF Queues/Workers or a $6 VPS worker, partition `signals` by month, Redis-equivalent via Upstash for hot feed cache, dedicated deliverability infra for optional relay sending. Nothing in v1 (single Postgres source of truth, global/fan-out split, provider abstractions) needs rewriting for 10K.
