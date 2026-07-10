# 09 · SIGNAL AI — Security, Privacy & Compliance

**Posture:** a two-sided data product (we process the founder's data AND third-party prospects' data) built by a pre-revenue team. Strategy: **data minimization as architecture** — collect the least, derive instead of store, scope personal data to the workspace that sourced it. This doc is binding on implementation; the QA matrix (10 §6) tests its invariants.

## 1. Data classification & residency
| Class | Examples | Where | Rules |
|---|---|---|---|
| Public firmographic | companies, global signals | global tables | fine to share across tenants; **no personal data ever** (invariant I-1) |
| Prospect personal data | contacts, RB2B person payloads, champion names | workspace-scoped tables | RLS-locked; deleted with workspace; GDPR Art.14 handling (§4) |
| Founder content | ICP, notes, drafts, sent subjects/snippets | workspace-scoped | never used across tenants; never used to train anything |
| Derived comms metadata | email_graph_edges (hashed counterpart, domain, counts) | workspace+user-scoped | hash-only; raw addresses of non-contacts never stored |
| Secrets | OAuth refresh tokens, webhook secrets | Supabase Vault | never in app tables, logs, or client |
| Telemetry | PostHog events, Sentry | third party | no PII in event props (allowlist reviewed in code review); Sentry PII-scrubbing on |

## 2. Lawful bases (GDPR/CCPA position — pragmatic seed-stage stance, reviewed by counsel pre-EU marketing)
- **Founder/user data:** contract (ToS) + consent for each OAuth scope (granular, just-in-time — 08 §1).
- **Prospect B2B firmographic + business-contact data:** legitimate interest (B2B context, business-capacity data, sourced from public/professional sources or the customer's own import). LIA documented in `/legal/lia.md`; balancing factors: business-role data only, easy objection path, no sensitive categories, no automated decisions with legal effect.
- **Website visitors of customers' sites:** the **customer** is controller, Signal AI is processor. Company-level identification (IP→org) = legitimate interest with short-lived hashed IPs. **Person-level ID (RB2B) for EU visitors requires consent** — enforcement: geo-EU sessions are company-level only unless the workspace sets `eu_person_id_enabled` after confirming their site's consent banner covers it (IS-05 AC). Default off.
- CCPA: we don't sell data; "Do Not Sell" N/A but honor deletion/access (§6). DPA template + subprocessor list published at launch (§7).

## 3. Data-minimization invariants (each has a test)
- **I-1** No personal data in global tables (`companies`, `signals` payloads for champion_move carry name only because sourced from public press — with `evidence_url`; RB2B/person visit data goes to workspace tables only).
- **I-2** Email bodies: **never persisted.** Graph = hashed metadata; voice calibration = transient processing → derived features + user-approved exemplar snippets ≤5 (user saw and approved each). Inbound replies: `replied_at` + ≤140-char snippet only.
- **I-3** IPs: hashed with daily salt, sessions pruned 30d.
- **I-4** LLM providers receive task-minimal context; Gemini/Groq API data-use: API inputs not used for training per their API terms (re-verify at launch; if changed, switch provider) — and we send prospect data only as needed for the user's own drafting (processor role).
- **I-5** Logs: no tokens, no bodies, no raw emails (log scrubber middleware).

## 4. Prospect rights & transparency (Art. 14 pragmatic compliance)
Public `/privacy#prospects` page explains categories/sources/purpose; `privacy@` alias; **objection/erasure flow:** request → suppression list (`suppressed_identities`: email-hash / name+domain) checked at contact-create and draft-send across all workspaces → existing contact rows anonymized. First outreach emails always include the founder's real identity + reply-to (their own Gmail — inherently satisfied); we prohibit (ToS + Anti-ICP design: 50/day cap, no blast) purchased-list spraying.

## 5. Scraping & source compliance (existential — competitors died here)
Allowed: RSS/APIs offered for consumption (TechCrunch RSS, EDGAR, Greenhouse/Lever/Ashby/Workable public boards, PH GraphQL, GitHub API — each with UA string `SignalAI-bot/1.0 (+https://…/bot)` and per-host rate ≤1 req/2s, robots.txt respected, ETag caching). **Prohibited hard-coded:** any authenticated-area scraping; any LinkedIn automation/fetching (Clipper is user-initiated capture in the user's own browser of content they can see — we never issue requests to LinkedIn); bypassing paywalls/anti-bot. Google News RSS used within informal norms (≤600 q/day, cached) — accepted risk, degrades gracefully if blocked (multi-source rule).

## 6. User rights, retention, deletion
Self-serve: **export** (Settings → JSON+CSV bundle of workspace data, generated async, link 24h) · **delete workspace** (typed confirm → immediate soft-lock → hard purge job 7d: rows, Vault secrets, Storage; global corpus untouched — contains nothing theirs) · **disconnect Gmail** (revoke + optional derived-data purge). Retention defaults: deliveries done>90d pruned · visitor_sessions 30d · activity_log 12mo · expired-trial workspaces purged at 30d (BL-01 promise) · backups roll 14d.

## 7. AppSec baseline (M0 checklist + M8 re-audit)
Supabase Auth (OAuth-only, no passwords v1) · RLS default-deny (04 §5) + **pgTAP RLS test suite: cross-tenant read/write attempts must fail for every table** · service-role key server-only (CI grep) · zod on every action/route · CSP (self + posthog/sentry/supabase; no unsafe-eval), HSTS, X-Frame-Options DENY except `/api/t/*` · webhook sig verification (08) · CRON_SECRET on machine routes · rate limits (07 §2–3) · dependency audit in CI (`pnpm audit --prod` fail-on-high) · secrets scanning (gitleaks action) · Sentry alerting. Session: Supabase defaults (1h access/rotating refresh). Backups: nightly `pg_dump` → encrypted GH artifact (11 §6). Incident basics: Sentry pager to founder email; `status.md` page; disclosure ≤72h if personal data affected.
**Subprocessors (launch list):** Supabase (data), Vercel→Cloudflare (hosting), Google (auth/Gmail APIs/Gemini), Groq, Resend, Stripe, PostHog, Sentry, RB2B (optional, customer-enabled), GitHub (ops).
**Deferred consciously (Series-A ledger):** SOC 2, pen test, SSO/SCIM, EU data residency, DPO. Documented so sales conversations have an honest answer.
