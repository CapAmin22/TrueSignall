# SIGNAL AI — Master Build Documentation Suite

**Product:** Signal AI (truesignall) — signal-based GTM intelligence for founder-led B2B SaaS sales
**Version:** 1.0 · July 2026
**Owner:** Founder/CPO — Amin
**Purpose:** The complete, self-contained document set required to build, launch, and operate Signal AI v1 — designed to be fed directly into Claude Code (or any AI coding agent) milestone by milestone.
**Hard constraint honored throughout:** $0/month infrastructure until 100 users, with **full MVP features live**. The only unavoidable spend is an optional custom domain (~$10/year); everything else runs on genuinely free tiers with documented headroom math.

---

## 1. Document Map

| # | File | What it contains | Feed to Claude Code when… |
|---|------|------------------|---------------------------|
| 00 | `00-INDEX.md` | This file. Map, glossary, build order, doc-attachment matrix | Always attach (small, orients the agent) |
| 01 | `01-SOLUTION-PRD.md` | Solution PRD: vision, scope, MVP definition, feature specs, pricing, metrics, non-goals | Attach for every milestone (source of truth for "what") |
| 02 | `02-PRODUCT-DESIGN-SPEC.md` | IA, routes, every screen spec, component inventory, design tokens, states, copy rules | Building any UI |
| 03 | `03-TECHNICAL-ARCHITECTURE.md` | System design, $0 stack decisions + math, data flows, free-tier budgets, scaling path | Attach for every milestone (source of truth for "how") |
| 04 | `04-DATABASE-SCHEMA.md` | Complete executable Postgres/Supabase SQL: tables, indexes, RLS, triggers, pg_cron | M1 onward; any DB work |
| 05 | `05-SIGNAL-ENGINE-SPEC.md` | The core IP: 15+ free signal sources, ingestion specs, normalization, dedup, urgency scoring formula, stacking | M3–M4 (ingestion + feed) |
| 06 | `06-AI-SYSTEM-SPEC.md` | LLM provider abstraction (free tiers), every production prompt verbatim, voice calibration, quality scoring, quota math | M2, M5, M7 (any AI feature) |
| 07 | `07-API-SPEC.md` | Route handlers, server actions, webhook contracts, error format, auth model | M3 onward |
| 08 | `08-INTEGRATIONS-SPEC.md` | Gmail/Outlook OAuth (scopes, metadata-only graph), sending, reply detection, RB2B, HubSpot/Notion, Calendly, Stripe | M5–M8 |
| 09 | `09-SECURITY-PRIVACY-COMPLIANCE.md` | GDPR/CCPA posture, data minimization, RLS strategy, token handling, scraping compliance, deletion | Attach at M0 and M8; reference always |
| 10 | `10-VIBE-CODING-BUILD-PLAN.md` | Milestone-by-milestone Claude Code prompts (copy-paste), CLAUDE.md for the repo, Definition of Done, QA matrix | The execution playbook — read first |
| 11 | `11-DEVOPS-RUNBOOK.md` | Env vars, Supabase/Vercel/GitHub Actions setup, cron budget, monitoring, backup, free-tier alarms, upgrade triggers | M0 and every deploy |

Upstream inputs (already written, referenced by ID, not duplicated here):
- **Problem PRD** (TS_PRD) — problem space, personas, JTBD, why-now
- **Market Research** (TS_Research) — competitive landscape, signal taxonomy, market sizing
- **User Stories & AC** (TS_Problem_user_flow) — 86 stories / 403 pts across 13 epics (IDs: OB, AD, PS, CS, IS, SA, OC, ET, PC, PM, CI, TC, BL)

Every requirement in this suite is traceable to a story ID from that document. Where a $0 constraint forces a revised SLO vs. the original acceptance criteria, the deviation is stated explicitly with the paid upgrade path that restores the original AC (see §01-SOLUTION-PRD §9 and §05 source registry).

---

## 2. The Product in One Paragraph (context anchor for the coding agent)

Signal AI watches a founder's target accounts across 15+ free public signal sources (funding, hiring, exec changes, tech-stack shifts, news, product launches, website visits, champion job moves), normalizes everything into one prioritized real-time feed with an explainable 0–100 urgency score, stacks converging signals within 72h, and turns any signal into a voice-calibrated, signal-referencing outreach draft the founder sends from their own Gmail in one click — then tracks opens/replies, schedules follow-ups, and manages a lightweight signal-aware pipeline. Target user: B2B SaaS founder, Seed–Series B, $0–15M ARR, budget $100–500/mo. Core promises: **setup < 30 min, signal→outreach < 5 min, flat pricing (no credits), ≥15% reply rate on signal-triggered sends vs 3.4% cold baseline.**

---

## 3. Canonical Decisions (locked — the agent must not re-litigate these)

| Decision | Choice | Why (short) |
|---|---|---|
| App framework | Next.js 15, App Router, TypeScript strict, Tailwind v4, shadcn/ui | Best-in-class for AI-assisted coding; RSC-first |
| Backend/data | Supabase (Postgres 15 + Auth + Realtime + Edge Functions + pg_cron + Storage + Vault) | One free platform covers DB, auth, jobs, realtime |
| Hosting | Vercel Hobby for private beta → Cloudflare Pages (OpenNext) at public/commercial launch, or Vercel Pro $20 at first revenue | Vercel Hobby ToS is non-commercial; CF Pages free tier allows commercial. Documented in §03-§4 |
| Primary LLM | Google Gemini 2.5 Flash / Flash-Lite free tier | 1,000+ req/day free; JSON mode; long context |
| Fallback LLM | Groq (Llama 3.3 70B) free tier | Different quota pool; provider abstraction in §06 |
| Heavy scheduled crawls | GitHub Actions (private repo, 2,000 min/mo free) | Puppeteer/HTTP crawls too heavy for Edge Functions |
| Light polling | Supabase pg_cron → Edge Functions | 500K invocations/mo free |
| Outreach email | Sent via the **user's own Gmail** (OAuth, `gmail.send`) — never a relay | Deliverability + ET-01 AC + zero cost |
| Product/notification email | Resend free (3,000/mo) | Digests, invites, brief emails |
| Website visitor ID | First-party pixel (ours) + optional RB2B free-plan webhook | IS-01/03/05 at $0 |
| Payments | Stripe (no fixed fee) | BL-01..04; flat plans, no credits |
| Analytics / errors | PostHog free (1M events) / Sentry free (5K errors) | Observability at $0 |
| Multitenancy | Workspace-scoped rows + Postgres RLS; **global** `companies` and `signals` tables fanned out to per-workspace `signal_deliveries` | Ingest each company ONCE regardless of subscriber count — the key free-tier survival trick (§03 §5.2) |
| LinkedIn data | **No scraping.** Compliant $0 substitutes: Signal Clipper (user-initiated capture), news/press monitoring, email-graph inference. Paid people-data API is the Phase-2 upgrade that restores 4h job-change SLO | §05 §6, §09 §5 |

---

## 4. Build Order (summary — full prompts in §10)

```
M0  Scaffold & Foundations      repo, Next+Supabase, auth (Google/LinkedIn OAuth), layout shell, CI
M1  Onboarding & ICP            5-step wizard, ICP inference, CSV/HubSpot/Notion import, workspace/team
M2  Companies & Discovery       global companies table, seed corpus, fit scoring, NL search, suggestions
M3  Signal Ingestion Core       source registry, RSS/API pollers, normalizer, dedup, deliveries fan-out, cron
M4  Feed & Prioritization       feed UI, urgency score, stacking, claim/done/snooze, realtime, filters, Top-5 digest
M5  Outreach                    voice calibration, draft generation (sections/angles/CTA), Gmail send, pixel, reply detection, follow-ups
M6  Pipeline                    kanban, in-pipeline signals, re-engage-now, weekly summary
M7  Intelligence Layer          pre-call briefs, competitors, visitor pixel + RB2B, personal signals v1, Signal Clipper
M8  Monetization & Hardening    Stripe plans/trial/limits, settings, empty/error states, QA matrix pass, launch checklist
```
Beta-ready after M5. Public-ready after M8. Estimated: 8 weeks solo with Claude Code at ~2–3 focused hrs/day.

---

## 5. How to Feed This to Claude Code

1. Create the repo, copy this entire `docs/` folder into `repo/docs/`.
2. Copy the `CLAUDE.md` from §10 §2 to the repo root — it tells the agent to treat these docs as the spec of record.
3. For each milestone, open Claude Code and paste the milestone prompt from §10 verbatim. Each prompt names the exact doc sections to read first.
4. After each milestone, run the Definition-of-Done checklist + QA rows for that milestone (§10 §5–6) before starting the next.
5. Never let the agent invent scope: if something isn't in 01/02/05, it's out (see Non-Goals, §01 §10).

Attachment matrix per milestone:

| Milestone | Must attach | Reference if needed |
|---|---|---|
| M0 | 00, 03, 10, 11 | 09 |
| M1 | 00, 01, 02, 04, 06, 10 | 07 |
| M2 | 01, 02, 04, 05(§7 fit), 06, 10 | — |
| M3 | 03, 04, 05, 07, 10, 11 | 09 |
| M4 | 01, 02, 04, 05(§8–9), 07, 10 | 06 |
| M5 | 01, 02, 06, 07, 08(Gmail), 10 | 04, 09 |
| M6 | 01, 02, 04, 10 | 07 |
| M7 | 01, 02, 05(§5.6, §6), 06, 08, 10 | 09 |
| M8 | 01, 02, 08(Stripe), 09, 10, 11 | — |

---

## 6. Glossary (canonical terms — use exactly these names in code)

| Term | Definition |
|---|---|
| **Workspace** | Tenant. One founder's company. Owns ICP, accounts, team, billing |
| **Company** | Global, deduped-by-domain firmographic record. Shared across workspaces |
| **Account** | A workspace's subscription to a Company (fit score, stage, owner, urgency) |
| **Contact** | Workspace-scoped person at a Company (privacy: never global) |
| **Signal** | Global immutable event about a Company/person (type, payload, source_url, occurred_at) |
| **Delivery** | Per-workspace instance of a Signal on an Account (status, urgency, claim, stack) — what the feed renders |
| **Stack** | Group of ≥2 deliveries on one account whose signals occurred within a 72h window |
| **Urgency score** | 0–100 per delivery/account; formula in §05 §8. ≥70 = "Hot" |
| **Fit score** | 0–100 ICP match per account; rubric in §05 §7. ≥70 Strong / 40–69 Moderate / <40 Weak |
| **Voice profile** | Derived style features + ≤5 user-approved exemplars. Full mailbox content is NEVER stored (§06 §5, §09 §3) |
| **DAR** | Draft Acceptance Rate = sends without full rewrite ÷ drafts generated. Target ≥60% |
| **SAR** | Signal Action Rate = deliveries acted on ÷ deliveries surfaced. Target ≥45% weekly |
| **Signal Clipper** | Bookmarklet/extension letting the user capture a public post they are viewing into the feed as a `linkedin_clip` signal (compliant, user-initiated) |
| **Source registry** | Config table of ingestion sources with cadence, parser, health (§05 §4) |

---

## 7. Global Success Metrics (from Problem PRD — restated as v1 targets)

| Metric | Baseline | v1 Target | Measured via |
|---|---|---|---|
| Manual research time | 10–15 h/wk | < 1 h/wk (self-report + session analytics) | onboarding + 30-day survey, PostHog |
| Signal→outreach latency | > 4 h | < 30 min median | `delivery.created_at → message.sent_at` |
| Reply rate (signal-triggered) | 3.4% cold | ≥ 15% | `outreach_messages.replied_at` |
| Signal coverage of accounts | < 20% | ≥ 90% within 48h of account add | deliveries per account |
| Trial→paid | — | ≥ 35% in 14 days | Stripe + auth events |
| Weekly Active (signal action) | — | ≥ 70% of paid | SAR events |
| DAR | — | ≥ 60% | draft vs sent diff ratio |
| NRR / MRR@12mo | — | ≥110% / $50K | Stripe |

---

*End of index. Start with `10-VIBE-CODING-BUILD-PLAN.md`, keep `01` and `03` open beside it, and build M0 today.*
