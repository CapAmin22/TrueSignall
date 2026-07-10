# 11 · SIGNAL AI — DevOps Runbook

Operational truth for the $0 stack: exact console setup, environment variables, the three GitHub Actions workflows, free-tier alarm thresholds, backups, and the ordered list of what to pay for first when a ceiling approaches. Zero servers to administer — everything below is configuration.

## 1. Environment variables (single source: `.env.example`, values in Vercel/Supabase/GH secrets)
| Var | Where used | Notes |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY | client+server | RLS-scoped |
| SUPABASE_SERVICE_ROLE_KEY | server only (routes/edge/scripts) | CI grep guards client leak |
| GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET | auth + Gmail OAuth | one GCP project (§2.2) |
| GEMINI_API_KEY / GROQ_API_KEY | lib/ai/router | free-tier keys |
| RESEND_API_KEY | digests/invites/alerts | domain-verified sender |
| CRON_SECRET | pg_cron→edge fns, /api/cron/*, /api/ingest/batch, GH Actions | 32-byte random |
| RB2B_WEBHOOK_SECRET | /api/webhooks/rb2b HMAC | shown once in Settings |
| STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | billing (M8) | price IDs live in lib/plans.ts after setup script |
| NEXT_PUBLIC_POSTHOG_KEY / SENTRY_DSN (+SENTRY_AUTH_TOKEN for sourcemaps) | telemetry | PII scrubbing on |
| NEXT_PUBLIC_APP_URL | pixels, OAuth redirects, email links | per-environment |
Supabase-side settings (SQL `alter database … set`): `app.edge_url`, `app.cron_secret` (read by pg_cron jobs, 04 §6). Environments: `local` (supabase CLI) · `preview` (Vercel PR + supabase branch db) · `prod`.

## 2. One-time console setup (do before M0; ~90 minutes)
**2.1 Supabase:** new project (region nearest users) → enable extensions used in 04 §1 (Database→Extensions) → Auth: enable Google + LinkedIn providers, set site URL + redirect `…/auth/callback` → create Vault (Settings→Vault) → copy keys.
**2.2 Google Cloud:** one project → OAuth consent screen (External, app name/logo/privacy URL; add yourself as test user) → credentials: Web client with Supabase callback + `{APP_URL}/api/auth/gmail/callback` → enable Gmail API → **start restricted-scope verification at M1** (gmail.send, gmail.metadata; prepare scope-justification video — 08 §1 clock).
**2.3 LinkedIn Developers:** app → Sign In with LinkedIn (openid, profile, email) → callback = Supabase.
**2.4 Vercel:** import repo, framework Next.js, add env vars, enable Vercel Cron OFF (we use pg_cron) — Hobby tier for private beta only (03 §T1).
**2.5 GitHub:** private repo → Actions secrets (SUPABASE_URL, SERVICE_ROLE, CRON_SECRET, APP_URL) → enable Actions.
**2.6 Resend:** domain, DNS (SPF/DKIM), sender `signals@mail.{domain}`. **2.7 PostHog + Sentry:** projects, keys. **2.8 Stripe (M8):** account → run `scripts/stripe-setup.ts` → webhook endpoint `{APP_URL}/api/webhooks/stripe`. **2.9 Domain (optional $10/yr):** Cloudflare-registered; else `*.vercel.app` for beta.

## 3. Deploy targets & the ToS switch (03 §T1)
Beta: Vercel Hobby (`vercel --prod` via Git push). From **M3**, CI builds both targets so the switch is a non-event:
- `build:vercel` = `next build`
- `build:cf` = OpenNext Cloudflare adapter → `wrangler pages deploy`
At public launch choose: Cloudflare Pages ($0, commercial OK — default) or Vercel Pro ($20). Runtime portability rules enforced by CI: no Node-only APIs in request paths (fs, net), sharp excluded, edge-safe crypto only.

## 4. GitHub Actions workflows
**`ci.yml`** (push/PR): pnpm install → typecheck → lint → vitest → playwright (chromium, against preview) → `pnpm audit --prod --audit-level=high` → gitleaks → dual build check.
**`crawler.yml`** (nightly 02:30 UTC + manual):
```yaml
concurrency: crawler
jobs:
  crawl:
    runs-on: ubuntu-latest
    timeout-minutes: 50            # hard budget guard (03 §6)
    strategy: { matrix: { shard: [0,1,2,3] }, fail-fast: false }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm i --frozen-lockfile
      - run: pnpm tsx scripts/crawl.ts --shard=${{ matrix.shard }} --budget-min=42
        env: { SUPABASE_URL: …, SUPABASE_SERVICE_ROLE_KEY: …, CRON_SECRET: …, APP_URL: … }
      # crawl.ts: pull domain shard (Hot accounts first) → careers diff + tech detect (05 §5.5)
      # → POST batches to /api/ingest/batch → self-abort at budget
  health:
    needs: crawl
    steps:
      - run: curl -fsS -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/health | pnpm tsx scripts/assert-freshness.ts
```
**`keepalive.yml`** (daily): trivial select via REST → prevents Supabase free-tier 7-day pause; plus `pg_dump` backup step (§6).
Minutes budget: 4 shards × ~10 min + health ≈ 45/night ≈ 1,350/mo of the 2,000 free (03 §1 headroom holds).

## 5. Monitoring & alerting (all free)
Sentry: server+client, release tagging, alert rule → email on new issue ≥5 events/hr. PostHog dashboards (01 §7) + weekly email. **`/admin` (owner-only route):** source health table (05 §10), LLM calls/day by task vs budget, free-tier meters (§7), signals/day-per-company guardrail chart. Uptime: GH Actions health job + free UptimeRobot ping on `/api/health` (5-min).

## 6. Backups & restore
Nightly (in keepalive.yml): `pg_dump --format=custom` → `age`-encrypt (key in GH secret) → upload-artifact retention 14d. Restore drill (do once at M3, again at M8): download → decrypt → `pg_restore` into a scratch Supabase branch → run pgTAP suite. Vault secrets excluded by design (users re-auth after catastrophic restore — documented in status page template). Supabase Pro PITR replaces this at upgrade.

## 7. Free-tier alarm thresholds (checked daily by `/admin` job; Resend email at breach)
| Meter | Alarm @ | Ceiling | Escape hatch (cost, order) |
|---|---|---|---|
| Gemini req/day | 800 | ~1,000–1,500/model | ① Gemini paid Flash-Lite (~$2–5/mo at our volume) |
| Supabase DB size | 400MB | 500MB | ② prune audit (09 §6) → Supabase Pro $25 |
| Edge invocations/mo | 400K | 500K | shard cadence tune → Pro |
| GH Actions min/mo | 1,600 | 2,000 | shard count −1 / public repo split |
| Resend emails/mo | 2,400 | 3,000 | digest batching → Resend $20 |
| Vercel (beta) bandwidth | 80GB | 100GB | ③ CF Pages switch ($0) / Pro $20 |
| Realtime concurrent | 160 | 200 | Pro |
Rule: **no ceiling may be discovered by users.** Alarm → decide → the table's escape hatch is pre-approved spend.

## 8. Launch checklist (M8 gate — print and tick)
☐ QA matrix P0 all green (10 §6) ☐ pgTAP RLS suite green ☐ Gmail OAuth verification approved (or beta <100 users documented) ☐ Stripe live-mode webhook verified with $1 self-purchase→refund ☐ Privacy policy + ToS + DPA + subprocessors live; /privacy#prospects up (09 §4) ☐ prospect-objection alias tested ☐ backups restore drill passed this week ☐ Sentry silent for 48h on beta traffic ☐ alarms table (§7) wired ☐ hosting = commercial-compliant target ☐ status page template ready ☐ PostHog activation funnel rendering ☐ seed-corpus ≥8K & Discover smoke query ☐ landing page Lighthouse ≥85 ☐ Product Hunt assets exported.

## 9. Day-2 operations rhythm (15 min/day, founder-friendly)
Morning: `/admin` glance (source health, alarms, yesterday's signals/company guardrail) → Sentry inbox → PostHog activation funnel. Weekly: dependency PRs (renovate), prune review, DAR/reply-rate vs targets (01 §2) → adjust urgency weights per 05 §7 calibration note if a type over/under-performs. Everything else is event-driven via alerts.
