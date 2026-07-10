# 01 · SIGNAL AI — Solution PRD

**Status:** Approved for build · **Owner:** Founder/CPO — Amin · **Version:** 1.0 · July 2026
**Companion docs:** Problem PRD (problem space), User Stories doc (86 stories — IDs referenced throughout), 02 Design Spec, 03 Architecture.
**Launch target:** Private beta end of Week 6 (post-M5) · Public launch end of Week 8 (post-M8).

---

## 1. Product Vision & Thesis

**Vision.** Every founder-led company sells with the timing advantage of an enterprise revenue org — without hiring one.

**Thesis.** The winning outreach in 2026 is *warm outbound*: signal-triggered, personally relevant, first-to-arrive. Founders lose this game not because they can't sell, but because they have no monitoring infrastructure (99% of companies miss the 5-minute window; first responder wins 5× more). Signal AI is that infrastructure at founder price: **one product that detects the moment, explains why it matters, drafts the message in the founder's voice, and sends it — in under 5 minutes end-to-end.**

**One-line value prop (external):** *"Signal AI watches your market 24/7 and tells you exactly who to contact, why now, and what to say — then sends it in one click."*

**Positioning (internal):** Common Room's signal breadth × Clay's enrichment intelligence × Warmly's speed-to-action, collapsed into one product, priced at $99–499/mo, operable by a non-technical founder in <30 minutes. The three gaps we alone fill: (G1) personal+company signals unified under $700/mo; (G2) signal→outreach in one workflow; (G3) founder-priced, founder-operable, flat pricing.

---

## 2. Goals & Success Metrics

User-outcome goals (leading):
| # | Goal | Metric | Target | Window |
|---|---|---|---|---|
| G1 | Kill the research tax | Self-reported research hrs/wk | 10–15 → <1 | 30 days post-activation |
| G2 | Win on timing | Median signal→send latency | <30 min | continuous |
| G3 | Make outreach land | Reply rate on signal-triggered sends | ≥15% (stretch 25%) | rolling 30d, min 20 sends |
| G4 | Full coverage fast | % accounts with ≥1 live signal source | ≥90% within 48h of add | continuous |
| G5 | Drafts feel like the founder | DAR (sent without full rewrite) | ≥60% | rolling 30d |

Business goals (lagging): trial→paid ≥35% @14d · weekly signal-action rate ≥70% of paid · SAR ≥45% weekly · NRR ≥110% · $50K MRR @ month 12.

**Activation definition (the number the whole funnel optimizes):** *first signal-triggered email sent within 24h of signup.* Everything in onboarding exists to reach this event.

---

## 3. Scope Model

Three releases, re-sliced from the 86-story backlog for a solo founder + Claude Code. The original Must/Should/Nice priorities are preserved; ordering is optimized for the $0 stack and fastest path to the activation event.

| Release | Timing | Contains (story IDs) |
|---|---|---|
| **v1.0 — MVP (public)** | Weeks 1–8 (M0–M8) | OB-01..06 · AD-01..05 · CS-01..04, CS-07 · IS-01, IS-03, IS-05 · SA-01..06 · OC-01..04 · ET-01..05 · PC-01..02 · PM-01..03 · CI-01..02 · TC-01, TC-03, TC-04 · BL-01..03 · **PS-02 (v1 method)** · **PS-03 (via Signal Clipper — see §9)** |
| **v1.1 — Fast follow** | Weeks 9–12 | OB-07 · AD-06..08 · PS-01 (paid data source), PS-04..08 · CS-05..06 · IS-02, IS-04, IS-06..07 · SA-07..08 · OC-05..07 · ET-06..07 · PC-03..06 · PM-04..06 · CI-03..04 · TC-02 · BL-04 |
| **v2 — Later** | Q4 2026 | OB-08 · CS-08 · OC-08 · API access · Outlook parity · EU person-level visitor ID |

Cut line logic: v1.0 = the smallest set where a founder signs up, gets signals on their real pipeline the same day, sends a signal-referencing email from their own Gmail, and sees the reply — i.e., the full loop that justifies $99/mo.

---

## 4. Feature Specifications (v1.0)

Each spec: intent → behavior decisions → key acceptance criteria (inherited from story IDs; only deltas restated) → design ref (§02) → notes for engineering.

### F1 · Onboarding & ICP (OB-01..06) — *the <30-minute promise*
**Flow (5 steps, §02 S1):** ① Sign in (Google/LinkedIn OAuth) → ② Company URL + one-line product description → AI-inferred ICP (editable chips: industry, seniority, size, stage, geo, pain points) → ③ Connect Gmail (optional, skippable; metadata-only graph indexing starts) → ④ Import targets (CSV / HubSpot / Notion / paste domains) → ⑤ Live feed with first signals.
**Decisions:**
- Onboarding model = **URL-first + one-liner hybrid** (resolves Problem-PRD open question #3): domain gives us tech/context to enrich the founder's own company; the one-liner (≤200 chars) drives ICP inference (OB-02, prompt in §06 P-1).
- First-signal guarantee: on import completion we immediately backfill each account's last-30-day signals from the global `signals` table (companies already in corpus) and run a live news/careers sweep for the rest — so the wizard **exits with a non-empty feed** (OB-05 AC).
- Team invite (OB-06): owner invites by email; member inherits workspace ICP (TC-04) with role `member` (cannot edit global ICP dimensions; can layer personal filters).
**Deltas:** none — all OB ACs met as written.
**Eng notes:** wizard state persisted per step (resume on refresh); every step has Skip; progress %; PostHog event per step for funnel.

### F2 · Discovery & Target List (AD-01..05) — *replace LinkedIn/Crunchbase browsing*
- **NL search (AD-01):** plain-English → structured filter object via LLM (§06 P-2) → query over global companies corpus. Ships with a **seed corpus ≥8,000 companies** (YC directory, Product Hunt makers, GitHub trending orgs, funded-company feed backfill — build script in §05 §7.4) and grows automatically from ingestion. AC delta: "≥50 results for any valid ICP query" holds for mainstream B2B ICPs at launch; niche ICPs may return fewer with an explicit *"corpus growing — import your list for instant coverage"* empty-state (§02 S3). Import (AD-05) is the guaranteed day-1 path.
- **Fit score (AD-02):** deterministic 5-dimension rubric (industry 30 / size 20 / stage 20 / tech 20 / geo 10 → §05 §7), label + hover breakdown showing matched/missed dimensions.
- **One-click monitor (AD-03):** add → delivery backfill + source activation ≤60s → card status Activating→Live → in-app notification on first *new* signal.
- **Weekly suggestions (AD-04):** Monday job proposes 10–25 net-new corpus companies ≥70 fit, each with the primary reason; add/dismiss/snooze per row; email + in-app.

### F3 · Company Signal Monitoring (CS-01..04, CS-07) — *the timing engine, fully $0*
| Signal | Source(s) at $0 (§05 §5) | Latency SLO |
|---|---|---|
| Funding (CS-01) | TechCrunch/Finsmes/EU-Startups RSS · SEC EDGAR Form D · Google News RSS per account | ≤ 6h from publication (AC ≤24h ✅) |
| Hiring/intent-by-role (CS-02) | Greenhouse/Lever/Ashby/Workable public JSON boards + careers-page diff | ≤ 24h (AC ≤48h ✅) — LinkedIn/Indeed boards excluded at $0 (ToS); delta noted §9 |
| Tech-stack change (CS-03) | Own detector: fetch homepage + assets, match open-source Wappalyzer ruleset; weekly diff | change detected ≤7d of crawl cycle (AC has no hard hour SLA ✅); competitive/complementary flags via workspace competitor + integration lists |
| Exec change (CS-04) | Press-release & Google News monitoring, company newsroom RSS, careers "leadership" page diff | ≤ 24h of public announcement ✅ (source = press, not LinkedIn) |
| Urgency score (CS-07) | computed on every new delivery + hourly decay job; ≥70 → Hot badge, pinned | ≤ 1h ✅ |
Behavior decisions: funding ≥ Series A auto-escalates priority; every card carries source URL + published-at (trust requirement, Problem-PRD risk #5); AI "why this matters" line cached per signal (one LLM call per signal, not per workspace — §06 P-4).

### F4 · Intent Signals (IS-01, IS-03, IS-05) — *first-party, privacy-clean*
- **Pixel:** one `<script>` snippet (copy in Settings→Integrations) → our edge endpoint. Company resolution: reverse-DNS + IP→ASN org mapping (free) ⇒ company-level ID; **optional RB2B free-plan webhook** upgrades to person-level for US visitors (name/title/LinkedIn + confidence).
- Pricing-page path configured at setup; visit → high-priority delivery ≤15 min (AC ✅); 7-day visit consolidation into one escalating signal; 3+ visits/14d → auto-tag *Repeat Evaluator*.
- **IS-05 GDPR AC honored:** EU-geo IPs are company-level only unless the visitor consented via the customer's cookie banner (integration flag) — enforcement rules in §09 §4.
- Coverage AC delta: "65% company / 15% person" reflects paid vendors; v1 realistic coverage = ~40–55% company (corporate IP dependent) + RB2B-person on US traffic within free credits. Stated in-product ("identification is best-effort") and in §9. Paid Warmly/Vector-class enrichment is the v1.1+ upgrade that restores the number.

### F5 · Personal Signals v1 (PS-02 champion tracking; PS-03 via Clipper) — *compliant $0 versions*
- **Champion moves (PS-02):** contacts tagged Customer/Champion are watched via (a) Google-News person queries (`"Full Name" (joins OR appointed OR "new role")`), (b) email-graph domain-change detection (champion emails founder from a new domain), (c) press/newsroom RSS. Alert ≤24h of *public* evidence (AC ✅ as written — "within 24 hours of detected move"); new company auto-added to discovery with fit score; message context "Former champion at X".
- **LinkedIn pain-point posts (PS-03) → Signal Clipper:** a bookmarklet (and thin MV3 extension) the founder clicks while viewing any public post; it captures URL + selected excerpt + author → creates a `linkedin_clip` signal with AI relevance score (High/Med/Low vs ICP pain points) and one-click Draft. This is user-initiated capture of content the user is lawfully viewing — no scraping, no automation against LinkedIn (§09 §5). Full automated PS-01/PS-03 monitoring moves to v1.1 behind a paid people-data provider; the provider abstraction ships in v1 so it's a config change, not a rebuild.

### F6 · Feed, Scoring & Stacking (SA-01..06) — *the primary surface*
- Single feed of deliveries, default sort urgency-desc, ≤3s load @100 items, Supabase Realtime inserts (no reload).
- **Stacking (SA-02):** deliveries on one account within a rolling 72h window share a `stack_group_id`; stacked card = account + count + top-3 one-liners + combined score (formula §05 §9); expandable.
- **Why-this-matters (SA-03):** 1–2 sentences, references the concrete event, embeds one data-backed anchor (curated stat library, e.g., the 90-day funded-vendor stat), copy-to-draft-context button.
- Filters (SA-04): type / stage / time, multi-select chips, session-persisted only.
- **Claim (SA-05)** with 7-day auto-expiry; **Done (SA-06)** archives ≤1s, 90-day archive tab, bulk-done for >14d old.

### F7 · Outreach Crafting (OC-01..04) — *voice, not templates*
- Draft ≤10s from any card; first sentence must reference the trigger event (hard validation — regenerate if missing, §06 P-5).
- **Voice calibration (OC-02) — privacy-reconciled design:** we fetch the last 50 *sent* emails read-only, extract a style profile (greeting/sign-off sets, sentence length, formality 1–5, emoji/exclaim frequency, contractions, favorite phrases, banned buzzwords) **transiently**, store only the profile JSON + up to 5 user-approved exemplar snippets. Raw bodies are never persisted (resolves the OB-03 "metadata-only" ↔ OC-02 tension; §06 §5, §09 §3). Manual path: paste 3–5 example emails. Recalibration weekly from newly sent app messages.
- Sectioned drafts (Subject / Opening / Value prop / CTA / Sign-off) with per-section regenerate (≤5/section/session), stage-aware single CTA (cold→15-min intro; warm→specific meeting; re-engage→low-friction check-in) with 4 swap alternatives; banned-phrase list ("pick your brain", "grab a coffee", "I hope this finds you well", "quick question", "circle back", "touch base").

### F8 · Execution & Tracking (ET-01..05) — *close the loop without leaving*
- Send via **user's Gmail** (`gmail.send`); lands in their Sent folder; confirmation ≤5s with link. (Outlook = v1.1; visible "coming soon" toggle.)
- Open tracking: self-hosted 1×1 pixel per message (consent toggle at first send, on by default with disclosure). Reply detection: Gmail metadata polling on active threads every 5–10 min (headers only).
- Follow-up engine (ET-02): no-reply after N days (3/5/7, default 5) → *Follow-Up Due* card carrying original context; AI drafts variation referencing any **new** signal since, else a different angle.
- Analytics (ET-03): signal vs non-signal reply rate, time-to-reply, open rate; gated behind ≥20 sends.
- Per-account history (ET-04) auto-populated from send/reply events + manual call notes; duplicate-touch warning (ET-05) if teammate contacted the person ≤14d — shows subject+date, requires confirm.

### F9 · Pre-Call Intelligence (PC-01..02)
One-click brief ≤30s: 2-sentence company overview · last-30-day signals · key contacts (role, tenure, highlights we hold) · talking points from detected pain signals · **"Why this conversation"** header listing triggering signals with dates + source links (or explicit *"Cold outreach — no signal detected"*). Mobile-first sections <100 words; freshness timestamp. Cached 6h per account.

### F10 · Pipeline (PM-01..03) — *replace the spreadsheet, not HubSpot*
Kanban: Identified → Contacted → Responded → Meeting Booked → Proposal Sent (auto-advance on send/reply events; drag to override). In-pipeline signals badge cards and re-enter the feed tagged *In-Pipeline*; a signal on Proposal-Sent escalates *Hot — Act Now*. Quiet ≥21d + new signal ⇒ **Re-Engage Now** flag with a low-pressure draft referencing the new event.

### F11 · Competitive (CI-01..02)
Up to 10 competitors (name+domain), auto-enriched (funding/headcount/G2 rating snapshot/news); competitor detected in an account's stack ⇒ red *Competitive Alert* with confidence + source and an AI positioning angle merged into the next draft.

### F12 · Team (TC-01, 03, 04)
Per-account activity feed (attributed, 90d default window); **Unclaimed Signals** view sorted by urgency with one-click claim; workspace ICP inheritance with member-level personal filters.

### F13 · Plans & Billing (BL-01..03) — *pricing as differentiator*
14-day full-feature trial, **no card** (BL-01: expiry warnings at 7/3/1d; data preserved 30d post-expiry). **Flat plans, zero credits, no overage charges — ever** (BL-02): at 80% of any limit show an upgrade prompt; at 100% the specific capacity pauses gracefully (e.g., new-account adds blocked; existing monitoring continues) rather than billing. Self-serve up/downgrade (BL-03) with excess-usage warning on downgrade; invoices via Stripe portal.

| Plan | Price | Accounts monitored | Contacts | Seats | AI drafts/mo | Notes |
|---|---|---|---|---|---|---|
| Trial | $0 ×14d | 50 | 250 | 1 | 100 | full Starter features |
| **Starter** | **$99/mo** | 50 | 500 | 1 | 300 | solo founder |
| **Growth** ⭐ | **$249/mo** | 200 | 2,000 | 3 | 1,000 | founder + first hire (anchor plan) |
| **Scale** | **$499/mo** | 500 | 5,000 | 5 | 3,000 | Series A team; priority sources |
Annual = 2 months free. Seat add-on $49/seat (v1.1, BL-04). Pricing answers Problem-PRD open question #5: anchor $249; $499 exists to make it look reasonable and to catch teams.

---

## 5. Primary User Flows (happy paths — full screen specs in §02)

1. **Zero→First-Send (activation):** OAuth → URL+one-liner → ICP accept → skip Gmail? (nudge: "voice-matched drafts need this") → import 30 domains CSV → feed shows 6 backfilled signals → click funding card → draft in 8s referencing the round → tweak CTA → Connect Gmail (just-in-time) → Send → confetti + "reply tracking is on". Target ≤25 min.
2. **Daily loop:** open feed (or Top-5 email) → top stacked card (Hot 84) → expand 3 signals → Draft → send → Claim next two → Done on stale ones → 12 minutes total.
3. **Re-engage:** pipeline card flagged Re-Engage Now (quiet 26d + new CTO hire) → pre-written low-pressure draft citing the hire → send.
4. **Pre-call:** calendar meeting in 40 min → open account → Brief → skim on phone → walk in citing their pricing-page revisit + hiring spree.

---

## 6. Launch Plan
- **Alpha (W4, post-M4):** founder dogfoods on own pipeline; 20 real accounts; verify latency SLOs.
- **Private beta (W6, post-M5):** 15 design-partner founders (network + build-in-public list); success gate = 10 activated, DAR ≥50%, ≥1 organic "the reply came from the signal email" story.
- **Public (W8, post-M8):** Product Hunt + build-in-public thread + founder communities; pricing live; goal 100 signups / 20 trials-activated in 30 days.
Kill/pivot gate at W10: if activation <25% or DAR <40% after 2 iteration cycles, pause growth and fix the draft/voice loop before spending on acquisition.

## 7. Analytics & Instrumentation (build with the feature, not after)
PostHog events (canonical names): `onboarding_step_completed{step}`, `icp_inferred`, `accounts_imported{count,source}`, `signal_delivered{type,urgency}`, `signal_viewed`, `draft_generated{ms,angle}`, `draft_edited{distance_ratio}`, `message_sent{channel,has_signal}`, `message_opened`, `message_replied{hours_to_reply}`, `signal_claimed/done/snoozed`, `brief_generated`, `plan_upgraded`. Dashboards: Activation funnel · Reply-rate (signal vs cold) · DAR · SAR · Latency p50/p95 · Free-tier consumption (§11 §7).

## 8. Risks & Mitigations (delta vs Problem PRD — solution-level)
| Risk | Mitigation shipped in v1 |
|---|---|
| Single-source fragility | 15+ sources, per-source health table + auto-disable + admin alert (§05 §4) |
| LinkedIn dependence | zero LinkedIn automation; Clipper + press/news substitutes; provider abstraction ready for paid swap |
| Draft quality / voice miss | sectioned regenerate, exemplar approval step, DAR instrumented from day 1, banned-phrase validator |
| Stale-signal trust failure | source URL + published-at mandatory on every card; recency decay in score; "detected vs occurred" both shown |
| Free-tier ceiling breach | quota budgets + 80% alarms (§11 §7); every ceiling has a named paid escape hatch < $25/mo |
| Deliverability harm | sends only via user's own Gmail; per-user daily send soft-cap 50 (anti-blast, matches Anti-ICP stance) |

## 9. Honesty Ledger — ACs revised by the $0 constraint (and what restores them)
| Story AC (original) | v1 reality | Restored by |
|---|---|---|
| PS-01 job change ≤4h | Not in v1 (press-based champion moves ≤24h only) | Paid people-data API (v1.1, ~$49–99/mo) |
| PS-03 LinkedIn posts ≤6h automated | User-initiated Clipper (instant, but manual trigger) | Same provider swap |
| CS-02 boards incl. LinkedIn/Indeed | Greenhouse/Lever/Ashby/Workable + careers diff | Paid job-postings API |
| IS-01 65%/15% visitor ID | ~40–55% company-level + RB2B free person credits (US) | RB2B paid / Warmly-class vendor |
| IS-02 G2 intent | v1.1+ (no free G2 feed) | G2 Buyer Intent contract |
| AD-01 ≥50 results any query | Guaranteed for mainstream B2B ICPs; niche ICPs best-effort + import path | Corpus growth + paid firmographic API |
Everything else ships to spec.

## 10. Non-Goals (v1 — enforce ruthlessly)
No sequences beyond 3-touch follow-up reminders · no Outlook send (v1.1) · no LinkedIn automation ever · no bulk/blast tooling (Anti-ICP) · no full CRM (no deal amounts/forecasting) · no public API · no mobile apps (responsive web only) · no enterprise SSO/SOC2 (Series-A item) · no markets beyond B2B SaaS + professional services · no EU person-level visitor ID without consent flag · no credits, no usage billing, no surprise charges.

## 11. Resolved Open Questions (from Problem PRD → decisions of record)
1. **Minimum viable signal set:** funding + hiring + exec change + news/launch + tech change + website intent + champion moves. Rationale: highest timing correlation achievable at $0; personal-post signals additive, not gating.
2. **Personal vs company first:** company-first; personal v1 = champion tracking + Clipper.
3. **Onboarding model:** URL-first + one-liner hybrid (F1).
4. **Execution channel:** Gmail-native send; LinkedIn as copy-ready draft + Clipper context; Outlook v1.1.
5. **Pricing ceiling:** $249 anchor, $499 top; validated against $18K+ alternatives in every pricing surface.
6. **Relationship graph:** native, from consented email **metadata** graph — our compounding moat; third-party enrichment stays optional/BYO.
