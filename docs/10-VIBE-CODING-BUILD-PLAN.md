# 10 · SIGNAL AI — Vibe-Coding Build Plan (Claude Code Playbook)

**This is the doc you execute from.** It turns docs 00–09 into an 8-week build: repo setup, a `CLAUDE.md` that keeps the agent on-spec, one copy-paste prompt per milestone, a Definition of Done per milestone, and the QA matrix that gates launch.

## 1. Operating rules (read once, they prevent 80% of agent drift)
1. **One milestone per session.** Start fresh context each milestone; the docs are the memory.
2. **Docs are law.** If the agent proposes anything not in 01/02/05, answer: *"Out of spec — check docs/ and Non-Goals (01 §10)."*
3. **Plan → approve → code.** Every milestone prompt forces a written plan first. Read it. Cut anything gold-plated.
4. **Commit per feature, deploy per milestone.** `feat(m3): rss ingestion pipeline` style; deploy preview after every milestone and run its DoD before continuing.
5. **When something breaks,** paste the error + name the doc section that governs it. Don't let the agent "fix" by changing the spec (e.g., weakening RLS).
6. **You own taste.** Agent ships function; you do a 10-minute polish pass per milestone against 02 (spacing, copy, empty states).

## 2. `CLAUDE.md` — copy verbatim to repo root
```markdown
# Signal AI — Agent Instructions
You are building Signal AI, a signal-based GTM tool for B2B founders. The spec of record is /docs (00–11).
Read docs/00-INDEX.md first in every session, then the sections the current task names.

RULES
- Never invent features, fields, copy, or scope. If it's not in docs/01, 02, or 05, ask or skip. Non-Goals (01 §10) are hard walls.
- Stack is locked (00 §3): Next.js 15 App Router + TS strict + Tailwind v4 + shadcn/ui + Supabase. No other services, no Redis, no queues.
- Database changes only via new files in supabase/migrations/, matching docs/04. Every table gets RLS per 04 §5 — default deny. NEVER use the service-role key in client code or Server Actions running as the user.
- All AI calls go through lib/ai/router.ts (docs/06 §1). Prompts live in lib/ai/prompts/ as versioned files copied from docs/06 §4 — do not paraphrase them.
- Server Actions for mutations, Route Handlers only for webhooks/cron/pixels (docs/07). Validate every input with zod. Errors use the 07 §4 contract.
- Signals are immutable; dedup via dedup_hash; every public signal must have source_url (docs/05 §2). 
- UI: use the canonical component names and tokens from docs/02 §2–4. Every async surface ships loading/empty/error states (02 §6). No new colors, no emojis in product copy.
- Privacy invariants I-1..I-5 (docs/09 §3) are non-negotiable: no email bodies persisted, no personal data in global tables, hashed IPs.
- Free-tier budgets (03 §1) are constraints: cache why-lines per signal, batch background LLM calls, keyset pagination, prune per 09 §6.
- Write tests where docs/10 §6 lists a QA id for the feature (Vitest unit + Playwright happy-path). pnpm typecheck && pnpm lint && pnpm test must pass before you declare done.
- Ask before: adding a dependency >50KB, changing a migration that's already applied, anything touching auth/billing.
WORKFLOW: restate the task → list doc sections you'll follow → write a plan (files to touch) → wait for "go" → implement → run checks → summarize what shipped vs the DoD.
```

## 3. Repo layout (agent scaffolds this in M0)
```
app/(marketing) (auth) (onboarding) (app)/{feed,discover,accounts,pipeline,outreach,competitors,settings}
app/api/{px,clip,t/o/[token],webhooks/{stripe,rb2b},ingest/batch,cron/health}
components/{ui,signal,layout,...}   lib/{ai/{router,prompts},supabase,plans,copy,scoring,gmail,stripe}
supabase/{migrations,functions/{ingest-rss,ingest-careers,ingest-news,flush-visits,gmail-sync,followup-scan,digest-send,suggest-accounts,why-lines}}
.github/workflows/{ci.yml,crawler.yml,keepalive.yml}   scripts/{seed-corpus,stripe-setup,eval-drafts}   docs/ (this suite)
```

## 4. Milestones — copy-paste prompts + DoD

**M0 · Scaffold & Foundations** *(attach 00, 03, 10, 11; do 11 §2 console setup first)*
> Read docs/00, 03 §2–4, 11 §1–3. Scaffold the repo per docs/10 §3: Next 15 + TS strict + Tailwind v4 + shadcn/ui; Supabase client/server helpers; Google + LinkedIn OAuth via Supabase Auth with /login and /auth/callback; migrations 0001–0002 from docs/04 §1–2 (extensions, helpers, profiles/workspaces/members/invites/usage_counters + their RLS); app shell per docs/02 §3 (sidebar/topbar, dark mode toggle, route stubs with EmptyStates); Sentry + PostHog init; CI (typecheck/lint/test/gitleaks/audit); deploy to Vercel. Plan first.
**DoD:** OAuth login round-trips on the deployed URL → workspace auto-created (creator=owner) → shell renders all routes → RLS pgTAP spec passes (cross-tenant denied) → CI green.

**M1 · Onboarding & ICP** *(attach 01 §4-F1, 02 §5-S1, 04 §2, 06 §4 P-1, 07 §2 onboarding/)*
> Build the 5-step onboarding wizard per docs/02 S1 and docs/01 F1: OAuth done → step 2 URL+one-liner → inferICP server action using prompt P-1 via the ai router (build lib/ai/router.ts per docs/06 §1 with Gemini+Groq) → editable ICP chips → step 3 Gmail connect tile (build the OAuth screen + Vault token storage per docs/08 §1, graph indexing as a stub job) → step 4 CSV import with mapping preview + dup detection (importAccounts) → step 5 placeholder feed. Invite flow (OB-06) in settings/team. Plan first.
**DoD:** new user → ICP inferred ≤5s → 30-row CSV imports ≤2min with dupes flagged → skip works on every step → invited member joins seeing shared ICP read-only → PostHog funnel events firing.

**M2 · Companies, Discovery & Fit** *(attach 01 F2, 02 S3, 04 §3 companies, 05 §6–7, 06 P-2)*
> Migrations for companies/signals/sources/ingestion_runs (docs/04 §3). Implement fit scoring lib/scoring/fit.ts exactly per docs/05 §7 with fit_breakdown. Build scripts/seed-corpus.ts per 05 §7 (YC directory + Product Hunt + GitHub orgs + graceful skips) targeting ≥8K companies with embeddings (06 §7). Build /discover per docs/02 S3: NL search via P-2 → facet SQL + pgvector ranking → results with FitPill + Monitor button (addAccount: fit compute + activating→live status). Plan first.
**DoD:** seed script reports ≥8K rows → "B2B SaaS, seed, US, 11-50" returns ≥50 ranked rows ≤5s → FitPill hover shows 5-dimension breakdown → adding an account flips Activating→Live ≤60s.

**M3 · Signal Ingestion Core** *(attach 03 §5.1, 04 §3–4 signals/deliveries, 05 (whole), 07 §3+§5, 11 §4)*
> Implement the 7-stage pipeline (docs/05 §2) as shared lib + Edge Functions ingest-rss/ingest-careers/ingest-news and Route Handler /api/ingest/batch: RSS pool with ETag + regex classifiers + P-3 fallback (05 §5.1), ATS boards (Greenhouse/Lever/Ashby/Workable) with slug probing, EDGAR, Google News wheel with 600/day cap, dedup hash + fuzzy guard, fanout→signal_deliveries with urgency per 05 §7-formula stub (full in M4) + why-line queue (P-4 with deterministic fallback). Sources seed migration. pg_cron schedules per 04 §6. GH Actions crawler.yml per 11 §4 (careers diff + tech detect, 45-min guard). Plan first — this is the biggest milestone; propose sub-order.
**DoD:** with 20 real accounts monitored, ≥5 genuine signals land in signal_deliveries within 24h, each with source_url + correct payload contract → duplicate TechCrunch/GoogleNews story stored once → kill one feed URL: source auto-disables at 5 failures with Sentry event → ingestion_runs ledger populated.

**M4 · Feed, Scoring & Stacking** *(attach 01 F6, 02 S2+§4, 05 §8–9, 07 feed/)*
> Implement urgency exactly per docs/05 §8 (weights table, decay, F, B) with urgency_explain, SQL refresh fn + hourly cron; stacking per 05 §9. Build /feed per docs/02 S2 with SignalCard/StackedSignalCard/UrgencyRing/FeedFilters as specced (02 §4), Supabase Realtime inserts, claim/done/snooze actions with optimistic UI, Unclaimed view, keyboard shortcuts (02 §6). Plan first.
**DoD:** feed ≤3s @100 items → new signal appears without reload with flash → two signals ≤72h on one account render stacked with combined score → ring tooltip shows per-signal contributions matching hand-calc → claim expires after 7d (cron test with shortened interval) → done archives ≤1s.

**M5 · Outreach (the money milestone)** *(attach 01 F7–F8, 02 M-1, 06 §4–6, 07 outreach/, 08 §1)*
> Voice calibration flow per docs/06 §5 + 08 §1 (transient fetch, P-6, exemplar approval, paste-fallback). DraftComposer sheet per docs/02 §4: generateDraft with P-5 + validation pipeline (06 §5) + quality chip (06 §6), per-section regen (P-5b, ≤5), CTA swap, banned-phrase scan. sendViaGmail per docs/08 §1 (MIME + pixel + X-SignalAI header + Sent-link) with duplicate-touch 409 flow (ET-05 modal M-5). Open pixel route, gmail-sync reply detection, followups engine (ET-02) + followup-scan fn. Analytics page S8 gated at 20 sends. Run scripts/eval-drafts.ts per 06 §8. Plan first.
**DoD:** signal→sent email ≤5 min hands-on → email arrives from the founder's own Gmail, lands in their Sent folder → opening it flips opened_at → replying flips replied_at ≤10 min and cancels the follow-up → draft eval: 25 fixtures, 100% valid JSON, ≥92% signal-ref pass, 0 banned phrases → DAR instrumentation writing edit_distance_ratio.

**M6 · Pipeline** *(attach 01 F10, 02 S7, 07 accounts/)*
> Kanban per docs/02 S7 (@dnd-kit), auto-advance on send/reply events, in-pipeline signal badges + feed escalation (PM-02), Re-Engage-Now detector (quiet ≥21d + new signal) with pre-populated low-pressure draft (PM-03). Account detail S5 tabs completed (Overview/Signals/Contacts/Outreach/Notes with call logging). Plan first.
**DoD:** send auto-moves Identified→Contacted; reply→Responded → drag persists → account quiet 21d (fixture) + injected signal shows Re-Engage flag in pipeline AND feed with calibrated draft.

**M7 · Intelligence Layer** *(attach 01 F4–F5, F9, F11; 02 S6/S9; 05 §5.6–5.7; 07 §3 px/clip/rb2b; 08 §5)*
> Pre-call briefs (P-7, 6h cache, S6 page incl. print css). Competitors (CI-01/02): setup UI, nightly enrichment, tech-stack competitive alerts with positioning angle merged into drafts. Visitor pixel end-to-end per docs/03 §5.2 + 07 §3 (snippet in settings + verify button, session flush cron, pricing_visit/site_visit rules, EU company-only rule) + RB2B webhook. Personal signals v1: champion tagging→champion_news source + email-domain-change trigger; Signal Clipper bookmarklet + /api/clip. Plan first.
**DoD:** brief ≤30s, sections <100 words, cold-outreach notice when no signals → pricing-page visit on a test site becomes a Hot delivery ≤15 min → clipper on a public post creates a linkedin_clip with relevance ≤10s → competitor tech detected → red alert + angle appears in next draft.

**M8 · Monetization & Hardening** *(attach 01 F13+§6, 02 §5-S10+§7, 08 §6, 09 §7, 11 §7)*
> Stripe per docs/08 §6 (setup script, checkout, portal, webhooks, trial banners 7/3/1d, expired read-only mode, meters + LimitBanner at 80%, graceful pause at 100%). Settings screens completed per 02 S10. Marketing landing per 02 §7. Full QA matrix pass (docs/10 §6) + a11y sweep + Sentry noise triage + 09 §7 checklist re-audit + backups verified (11 §6). Switch prod target per 11 §3 decision. Plan first.
**DoD:** trial→checkout→plan active via webhook ≤30s → 100% draft quota blocks with upgrade modal, monitoring keeps running → all QA rows pass → Lighthouse ≥85 perf/a11y on feed + landing → launch checklist (11 §8) signed.

## 5. Post-M8 → v1.1 backlog (already specced, pull in order): OC-05 angles · ET-06 Calendly insert · ET-07 3-touch sequences · SA-07 digest cron · AD-06/07/08 · PC-03/04/05/06 · PM-04 HubSpot sync · CI-03/04 · TC-02 · BL-04 seats · Outlook · paid people-data provider (restores PS-01).

## 6. QA / Acceptance Matrix (gate: all P0 pass before public)
| ID | P | Scenario (fixture) | Pass condition | Story |
|---|---|---|---|---|
| QA-A1 | P0 | Fresh signup → wizard | first signal in feed before wizard exit; ≤30 min total | OB-05 |
| QA-A2 | P0 | ICP inference | valid JSON ≤5s; chips editable; regenerate works | OB-02 |
| QA-A3 | P0 | CSV 500 rows w/ 20 dupes | import ≤2 min; dupes flagged; invalid downloadable | AD-05/OB-04 |
| QA-B1 | P0 | Trial expiry (clock-shift fixture) | warnings 7/3/1d; read-only at 0; data intact 30d | BL-01 |
| QA-B2 | P0 | Draft quota 100% | PLAN_LIMIT modal; **no charge created**; monitoring unaffected | BL-02 |
| QA-C1 | P0 | Funding RSS fixture | signal ≤30 min w/ round+amount+source_url; single row despite 2 sources | CS-01 |
| QA-C2 | P0 | Greenhouse fixture "Head of Sales Ops" | hiring signal, category crm_revops, confidence high | CS-02/IS-06 |
| QA-C3 | P0 | Urgency hand-calc sheet | app score = spreadsheet ±1 across 6 cases; ≥70 shows Hot | CS-07 |
| QA-C4 | P0 | 3 signals in 72h | one stacked card, combined score, expand shows 3 | SA-02 |
| QA-D1 | P0 | Draft from funding card | opening names the round; 0 banned phrases; ≤120 words; ≤10s | OC-01/03 |
| QA-D2 | P0 | Voice calibration | profile stored; **DB contains zero email bodies** (SQL assert) | OC-02/I-2 |
| QA-D3 | P0 | Send→open→reply loop (2 real inboxes) | Sent-folder link works; opened_at; replied_at ≤10 min; follow-up cancelled | ET-01/02/03 |
| QA-D4 | P0 | Teammate contacted same person 10d ago | 409 modal shows subject+date; override sends | ET-05 |
| QA-E1 | P0 | Pricing-page visit (test site) | Hot delivery ≤15 min w/ path list | IS-01 |
| QA-E2 | P0 | EU IP visit, person-ID off | company-level only; no person fields stored | IS-05/09 §2 |
| QA-F1 | P0 | Cross-tenant probe (pgTAP suite) | every table: read+write denied | 04 §5/09 §7 |
| QA-F2 | P0 | Claim expiry / snooze wake | reverts at 7d; resurfaces at snooze date w/ Revisit label | SA-05/PS-08 |
| QA-G1 | P1 | Brief generation | ≤30s; sections <100w; cold-notice case | PC-01/02 |
| QA-G2 | P1 | Re-engage detector | quiet-21d + signal ⇒ flag + calibrated draft | PM-03 |
| QA-G3 | P1 | Source failure ×5 | auto-disable + Sentry + settings dot; others unaffected | 03 §6 |
| QA-G4 | P1 | Clipper on public post | linkedin_clip + relevance + draft button | PS-03 v1 |
| QA-G5 | P1 | Champion news fixture | champion_move ≤24h path; new co. auto-suggested | PS-02 |
Seed fixtures live in `supabase/seed.sql` + `tests/fixtures/` (RSS XML samples, Greenhouse JSON, Stripe/RB2B webhook payloads, clock-shift helpers) — the agent creates them in the milestone that first needs each.
