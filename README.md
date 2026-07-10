# Signal AI (TrueSignall)

**Signal-based GTM intelligence for founder-led B2B SaaS sales.**

Signal AI watches your target accounts across 15+ free public signal sources (funding, hiring, exec changes, tech-stack shifts, news, product launches, website visits, champion job moves), normalizes everything into one prioritized real-time feed with an explainable 0–100 urgency score, stacks converging signals within 72h, and turns any signal into a voice-calibrated, signal-referencing outreach draft — sent from the founder's own Gmail in one click.

> Reach out at the exact right moment. Every time.

Built to the spec suite in [`docs/`](docs/00-INDEX.md) — the complete PRD, design spec, architecture, database schema, signal engine, AI system, API contract, integrations, security posture, build plan, and DevOps runbook.

## Quick start (prototype demo mode)

```bash
npm install
npm run dev          # → http://localhost:3000
```

With **no environment variables**, the app runs fully populated in demo mode: fixture accounts, signals across every type (including a stacked Hot account), a working feed, discovery, draft composer, pipeline kanban, pre-call briefs, competitors, analytics, and settings. AI flows use a deterministic offline provider so drafting/ICP inference/briefs all work without keys.

Routes to explore:

| Route | Screen |
|---|---|
| `/` | Marketing landing (hero, live demo cards, flat pricing, FAQ) |
| `/onboarding` | 5-step wizard: OAuth → URL + one-liner → ICP inference → Gmail → CSV import → first signals |
| `/feed` | The signal feed — urgency-sorted, stacked cards, claim/done/snooze, keyboard shortcuts (j/k/d/e/c/s) |
| `/discover` | Natural-language company search + weekly suggestions |
| `/accounts` · `/accounts/[id]` | Account table + detail tabs (Overview/Signals/Contacts/Outreach/Notes) |
| `/accounts/[id]/brief` | Pre-call brief (print-friendly) |
| `/pipeline` | Kanban with drag-drop, auto-advance, Re-Engage-Now |
| `/outreach` | Reply-rate analytics (signal vs cold vs 3.4% baseline) |
| `/competitors` | Competitor cards + competitive alerts |
| `/settings/*` | Profile, ICP, team, notifications, integrations, billing |

## Going live

1. Create a Supabase project, apply `supabase/migrations/0001…0010` in order, deploy `supabase/functions/*` (`supabase secrets set CRON_SECRET=… GEMINI_API_KEY=… RESEND_API_KEY=…`), and set the `app.edge_url` / `app.cron_secret` database settings (docs/11 §1–2).
2. In the Supabase dashboard enable the Google (and optionally LinkedIn) auth provider with your GCP OAuth client, site URL, and `…/auth/callback` redirect.
3. Copy `.env.example` → `.env.local` (locally) / project env vars (Vercel) and fill in keys. What each key activates:
   - `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — real OAuth login, session middleware, onboarding persistence, live workspace data on every screen, write-through mutations (claim/done/snooze/stage/send).
   - `SUPABASE_SERVICE_ROLE_KEY` — ingest persistence (`/api/ingest/batch` → signals + fan-out), visitor sessions (`/api/px`), clipper persistence, live source health.
   - `GEMINI_API_KEY` / `GROQ_API_KEY` — real LLM drafting/ICP/briefs; the router (Gemini → Groq) replaces the demo provider automatically, falling back to it only if all providers fail.
   - `CRON_SECRET` — authorizes pg_cron→edge functions, GH Actions crawler, and `/api/cron/*`.
   - `STRIPE_WEBHOOK_SECRET` — webhook signature verification goes live (plan mutations land at M8).
4. Set up GitHub Actions secrets for `crawler.yml` (nightly careers-diff + tech-detect) and `keepalive.yml` (Supabase keep-alive + encrypted backups).
5. Seed the discovery corpus: `npx tsx scripts/seed-corpus.ts` (YC directory + Product Hunt + GitHub, ≥8K target) — powers Discover search in live mode.
6. At M8: `npx tsx scripts/stripe-setup.ts` for the flat-plan catalog ($99/$249/$499 — no credits, ever).

With **zero env vars** the app runs in full demo mode (fixtures + deterministic AI) — every screen and flow works offline.

## Architecture (docs/03)

```
Next.js 15 App Router (RSC + Server Actions)  ←→  Supabase (Postgres 15 + RLS + Realtime + pg_cron + Edge Functions + Vault)
Route Handlers: /api/px · /api/clip · /api/t/o/[token] · /api/webhooks/{stripe,rb2b} · /api/ingest/batch · /api/cron/health
GitHub Actions: nightly crawler (careers diff + tech detect) · CI · keepalive/backup
LLMs: Gemini 2.5 Flash (primary) → Groq Llama 3.3 70B (fallback) → deterministic demo provider (no keys)
```

The load-bearing pattern: **global ingest, per-workspace fan-out** — `companies` and `signals` are global and deduped; every monitoring cost scales with unique companies, not customers (docs/03 §3).

Core IP lives in `lib/`:

- `lib/scoring/urgency.ts` — the exact urgency formula (weights, half-life decay, fit multiplier, 72h stacking bonus) per docs/05 §7
- `lib/scoring/fit.ts` — deterministic 5-dimension ICP fit rubric per docs/05 §6
- `lib/signals/` — taxonomy + payload contracts, dedup hashing + trigram fuzzy guard, regex classifiers, hiring→intent map
- `lib/ai/` — provider router with minute-bucket governor, the seven production prompts (verbatim), draft validation + quality scoring

## Checks

```bash
npm run typecheck   # TS strict
npm run lint
npm test            # scoring/dedup/classifier/validation invariants (QA-C1..C3, D1 groundwork)
npx tsx scripts/eval-drafts.ts   # 25-fixture draft eval harness (docs/06 §8)
```

## Privacy invariants (docs/09 §3 — non-negotiable)

- **I-1** No personal data in global tables
- **I-2** Email bodies are never persisted (voice calibration is transient; graph is hashed metadata)
- **I-3** IPs hashed with a daily salt; sessions pruned at 30d
- **I-4** LLM providers receive task-minimal context
- **I-5** No tokens/bodies/raw emails in logs
- **No LinkedIn automation, ever.** The Signal Clipper (`public/clipper.js`) is user-initiated capture only.

## Repo map

```
app/            routes: (marketing) landing · (auth) login · (onboarding) wizard · (app) product · api/*
components/     ui primitives · signal/{SignalCard,StackedSignalCard,UrgencyRing,FitPill,FeedFilters} · outreach/DraftComposer · layout
lib/            ai/ · scoring/ · signals/ · demo/ · plans · copy · errors · supabase clients
supabase/       migrations/0001–0009 (full schema + RLS + cron) · functions/ (Deno workers)
scripts/        seed-corpus · crawl · eval-drafts · stripe-setup · assert-freshness
docs/           the complete spec suite (00–11) — the source of truth
tests/          vitest unit suites for the scoring/dedup/validation invariants
```

## Status

This is the **v1 prototype build**: every surface, formula, contract, and prompt from the spec suite is implemented, with demo-mode fixtures standing in for live ingestion until Supabase + API keys are configured. The prior Python exploration of this idea is preserved in git history.
