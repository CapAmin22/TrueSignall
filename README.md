# TrueSignall (Signal AI)

**Relationship-first GTM intelligence for founder-led B2B sales.**

> People buy from people they trust. TrueSignall builds the trust *before* the pitch — then tells you the exact right moment to make it.

---

## The problem

Founders sell everything their company will ever sell — at least until the first sales hire, usually far beyond. And founder-led selling fails in two predictable ways:

1. **The timing problem.** You reach out when *you* need pipeline, not when *the buyer* has a reason to care. The account that just raised, just hired a Head of Sales Ops, just visited your pricing page — that window opens and closes while you're doing manual research. Cold outreach reply rates sit around 3.4% because nearly all of it lands at the wrong moment.

2. **The relationship problem.** Every founder already owns their most valuable sales asset — their network. Years of colleagues, batchmates, investors, conference friends, former customers. But that network sits scattered across Gmail, a phone contact list, and LinkedIn — unmonitored, cooling silently, and never consulted at the moment it matters. So founders pitch strangers cold while a warm path into the same account sits three contacts deep in their own address book.

Every tool on the market attacks the first problem. **TrueSignall is built on the conviction that the second one comes first** — network is built before anything is sold, and everything is sold on trust.

## The USP: the relationship layer

TrueSignall is the only signal tool that monitors **two feeds, not one**:

**🏢 Company signals** (14 types) — funding, hiring, exec changes, tech-stack shifts, news, product launches, geo expansion, pricing-page visits, site visits, champion job moves, LinkedIn activity, conferences, intent surges, G2 activity. Scored 0–100 for urgency with an explainable formula, stacked when they converge within 72 hours.

**❤️ Personal moments** (12 types) — birthdays, new babies, new homes, weddings, job changes, promotions, work anniversaries, awards, speaking slots, published writing, company milestones, completed degrees. Each one is a human reason to reach out with **zero pitch** — because the note that says "congrats on the little one, say hi to the family" is worth ten cold emails when the buying window opens six months later.

The loop that makes it compound:

```
Import your real network            (Gmail · phone contacts · LinkedIn export · CSV)
        │
        ▼
Warmth engine scores every relationship        hot / warm / cooling / cold
and tells you who is DUE A TOUCH               (45-day decay — same clock trust cools on)
        │
        ▼
Moments feed catches personal signals    →  one-click warm note, AI-drafted in your
(birthday, baby, new home, promotion…)      voice, HARD-RULED to never pitch
        │
        ▼
Company signal fires on a target account
        │
        ▼
WARM-INTRO PATHFINDER cross-references the account
against your network: who do you already know there?
Path strength = relationship warmth × decision-maker seniority
        │
        ▼
You enter the deal through trust, not through a cold inbox —
and every new intro expands the network the loop runs on
```

**The goal:** more decision-maker relationships, kept deliberately warm, so that when any account lights up you already have a door in — and when *their* network needs what you sell, your name comes up first.

## What's in the product

### Relationship intelligence (the USP)
- **Network screen** — import contacts (LinkedIn `Connections.csv`, any contacts CSV now; Gmail + phone sync activate with OAuth), every relationship warmth-scored with an explainable decay model, filterable by band, one-click "log touch"
- **Reconnect queue** — who's due a touch on their cadence (hot every 21 days → cold every 90) before the relationship silently dies
- **Moments feed** — birthdays surface automatically from your contacts; babies, homes, promotions, awards, talks, articles from monitoring; each with an AI note generator whose hard rules forbid product mentions, business asks, and LinkedIn-speak
- **Warm-intro pathfinder** — on every account and on the Network screen: who in your network already works at (or can open) your hottest accounts, ranked by warmth × seniority
- **Decision-maker tagging** — auto-detected from titles, so network growth is measured in the connections that can actually sign

### Company signal engine
- **14 signal types across 15+ free sources**, deduped globally, fanned out per workspace
- **Explainable urgency score** — weights × freshness decay × ICP-fit multiplier + stacking bonus; hover the ring to see the math
- **Stacked signal cards** — funding + hiring + pricing visit inside 72h = one Hot account, not three rows
- **5-dimension ICP fit** (industry/size/stage/tech/geo) — deterministic, no black box
- **Signal feed** with claim/done/snooze, team claims, keyboard flow (j/k/d/e/c/s)
- **Discover** — plain-English corpus search ("seed fintech in the US using Stripe") + Monday suggestions
- **Visitor pixel** — pricing-page visits become signals (EU traffic company-level only)

### Founder-voice outreach
- **Voice-matched drafts** in one click — opening sentence must reference the trigger event by name; banned-phrase scan ("pick your brain", "hope this finds you well"…) enforced in code
- **Per-section regenerate**, CTA alternatives at three friction levels, quality score
- **Pre-call briefs** — why this conversation, company now, people, talking points, landmines; print-ready
- **Pipeline kanban** with auto-advance on send and Re-Engage-Now resurfacing
- **Outreach analytics** — signal-triggered vs cold reply rates vs the 3.4% industry baseline (unlocks at 20 sends, when the sample means something)

### The engine room
- Next.js 15 App Router + TypeScript strict + Tailwind v4 · Supabase (Postgres 15, RLS default-deny, Realtime, pg_cron, Edge Functions)
- AI router: Gemini 2.5 Flash → Groq Llama 3.3 70B → deterministic offline provider; 8 versioned production prompts
- $0/month infrastructure at 100 users (documented free-tier headroom + alarm thresholds)
- Flat pricing: **$99 / $249 / $499** — no credits, no per-seat surprises, no overage charges, ever

## Privacy — non-negotiable

Your network is your moat, so it is architecturally impossible for it to leak:

- **Your contacts and personal moments are workspace-scoped rows.** They never enter global tables, never enrich another tenant, never train anything (invariant I-1).
- Email sync reads **metadata only** — bodies are never stored (I-2). Visitor IPs are salted-hash-then-discarded (I-3). The LLM receives the minimum context per task (I-4).
- Personal-moment monitoring only uses what you imported or clipped yourself — the product never crawls private profiles.

## Quick start (demo mode — zero keys)

```bash
npm install
npm run dev          # → http://localhost:3000
```

With **no environment variables** the entire product runs on fixtures and a deterministic offline AI: full feed, moments, network with intro paths, drafting, briefs, pipeline, analytics.

| Route | Screen |
|---|---|
| `/` | Marketing landing |
| `/onboarding` | 5-step wizard: OAuth → ICP inference → Gmail → CSV import → first signals |
| `/feed` | Company signal feed — urgency-sorted, stacked cards, keyboard flow |
| `/moments` | **Personal moments — congratulate first, sell never** |
| `/network` | **Your network: warmth bands, reconnect queue, warm paths into hot accounts** |
| `/discover` | Plain-English corpus search + weekly suggestions |
| `/accounts` · `/accounts/[id]` | Account table + detail (with warm-intro card) |
| `/accounts/[id]/brief` | Print-ready pre-call brief |
| `/pipeline` | Kanban with auto-advance and Re-Engage-Now |
| `/outreach` | Reply-rate analytics vs cold baseline |
| `/competitors` | Competitor cards + in-stack alerts |
| `/settings/*` | Profile, ICP, team, notifications, integrations, billing |

## Going live

1. Create a Supabase project, apply `supabase/migrations/0001…0011` in order, deploy `supabase/functions/*` (`supabase secrets set CRON_SECRET=… GEMINI_API_KEY=… RESEND_API_KEY=…`), and set the `app.edge_url` / `app.cron_secret` database settings (docs/11 §1–2).
2. In the Supabase dashboard enable the Google (and optionally LinkedIn) auth provider with your GCP OAuth client, site URL, and `…/auth/callback` redirect.
3. Copy `.env.example` → `.env.local` (locally) / project env vars (Vercel). What each key activates:
   - `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — real OAuth login, session middleware, onboarding persistence, live workspace data on every screen (including connections + moments), write-through mutations.
   - `SUPABASE_SERVICE_ROLE_KEY` — ingest persistence (signals + fan-out), visitor sessions, clipper, live source health.
   - `GEMINI_API_KEY` / `GROQ_API_KEY` — real LLM drafting/ICP/briefs/personal notes; router falls back automatically.
   - `CRON_SECRET` — pg_cron→edge functions, GH Actions crawler, `/api/cron/*`.
   - `STRIPE_WEBHOOK_SECRET` — webhook signature verification (plan mutations at M8).
4. GitHub Actions secrets for `crawler.yml` (nightly careers-diff + tech-detect) and `keepalive.yml` (keep-alive + encrypted backups).
5. Seed the corpus: `npx tsx scripts/seed-corpus.ts` (≥8K companies for Discover).
6. At M8: `npx tsx scripts/stripe-setup.ts` for the flat-plan catalog.

## Checks

```bash
npm run typecheck   # TS strict
npm run lint        # ESLint
npm run test        # Vitest — urgency, fit, dedup, classifiers, validation, relationships
npm run build       # production build
```

## Repo map

```
app/                 Screens (App Router) + API route handlers + server actions
components/          Signal cards, draft composer, personal-note composer, layout, UI kit
lib/scoring/         Urgency + ICP fit (the explainable math)
lib/relationships/   Warmth engine, intro pathfinder, moment taxonomy  ← the USP
lib/signals/         Taxonomy, dedup, classifiers, hiring→intent map
lib/ai/              Provider router, 8 production prompts, draft validation
lib/demo/            Fixture corpus + workspace store (demo ⇄ live hydration)
lib/live/            Supabase → store bundle loader
supabase/migrations/ 0001–0011 (schema, RLS, cron, seeds, auth bootstrap, relationship layer)
supabase/functions/  9 Deno ingestion/notification workers
scripts/             seed-corpus, crawl, eval-drafts, stripe-setup
docs/                The 12-document spec suite (PRD → runbook)
```

## Status

Feature-complete prototype: all 12 screens + Moments + Network, live-mode wiring for every env key, demo mode with zero keys, 50+ unit tests green. Pre-launch checklist lives in docs/11 §8.
