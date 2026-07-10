# 05 · SIGNAL AI — Signal Engine Specification

**This is the product's core IP.** It defines every signal type, every $0 source, the exact scoring math, and the stacking logic. Implements epics PS/CS/IS/SA + fit scoring for AD. Data structures in 04; prompts referenced from 06.

Principles: **(1)** never depend on one source per type · **(2)** every public signal carries `source_url` + `occurred_at` · **(3)** ingest globally once, fan out per workspace (03 §3) · **(4)** deterministic scoring, LLM only for language · **(5)** idempotent everything (dedup hash) · **(6)** compliant by design — robots.txt respected, no LinkedIn automation, public data only.

---

## 1. Signal Taxonomy & Payload Contracts (stored in `signals.payload`)
| type | payload contract (jsonb) | tier |
|---|---|---|
| `funding` | `{round, amount_usd?, currency?, investors[], lead?}` | company |
| `hiring` | `{job_title, board, job_url, location?, dept?, inferred_category, confidence}` | company/intent |
| `exec_change` | `{person_name, new_title, prev_company?, evidence}` | company |
| `tech_change` | `{added[], removed[], flag: 'competitive'|'complementary'|'neutral'}` | company |
| `news` | `{headline, publisher, summary?}` | company |
| `product_launch` | `{name, where: 'producthunt'|'press'|'newsroom', tagline?}` | company |
| `geo_expansion` | `{region, evidence}` | company |
| `pricing_visit` | `{paths[], visits_7d, duration_s?, person?{name,title,linkedin,confidence}, repeat_evaluator}` | intent |
| `site_visit` | `{paths[], page_count, person?}` | intent |
| `champion_move` | `{contact_id, contact_name, from_company, to_domain, evidence_url}` | personal |
| `linkedin_clip` | `{post_url, author, excerpt, relevance: 'high'|'med'|'low', matched_pains[]}` | personal |
| `conference` (v1.1) | `{event, talk_title?, date}` | personal |
| `intent_surge` / `g2_activity` (v1.1+) | vendor-defined | intent |
`title` (card headline) is composed at normalization: e.g., `Raised $12M Series A led by Foundry` · `Hiring Head of Sales Ops` · `Sarah Kim joined as CTO`.

## 2. Pipeline (every source flows through the same 7 stages)
```
COLLECT → EXTRACT → RESOLVE company → NORMALIZE(title,payload,occurred_at) → DEDUP(hash upsert)
 → PERSIST signal (+queue why-line) → FANOUT deliveries (score → stack → realtime → notify)
```
- **Resolve:** domain from item (link host, ATS slug map, explicit field) → `companies` upsert; if only a name, trgm match ≥0.55 else create-with-source; enrichment lazy (M2 enricher fills gaps nightly for monitored companies).
- **Dedup:** `sha256(domain|type|canonical(source_url or slug(title))|yyyy-mm-dd)` unique-upsert; plus fuzzy guard — skip if same (company,type) has a signal in 24h with title trigram sim ≥0.7 (cross-source duplicates, e.g., TC + Google News).
- **Fanout:** `select account_id, workspace_id from accounts where company_id=$1 and status='active'` → per row: urgency (§8) → stack assign (§9) → insert delivery → Realtime broadcasts automatically → notification per user prefs (realtime push/email vs daily digest).
- **Why-line:** queued job, one LLM call per *signal* (global cache), non-blocking; card renders with a deterministic fallback line until filled (06 P-4).

## 3. Cadence & Latency Budget (meets 01 §4-F3 SLOs)
| Path | Cadence | Worst-case latency |
|---|---|---|
| RSS pool (funding/news/launch) | 15 min, sharded | publish→feed ≈ ≤30 min typical, ≤6h worst |
| ATS boards (Greenhouse/Lever/Ashby/Workable) | 30 min | ≤1h |
| Google News per-account queries | hourly, Hot+priority accounts only (quota §5.4) | ≤2h |
| Careers-page diff + tech detect | nightly GH Actions, 7-day full cycle prioritized by urgency | ≤7d (tech), ≤48h careers for Hot |
| Pixel sessions | 5-min flush | ≤15 min (IS-01 AC ✅) |
| EDGAR Form D | 2h | ≤4h |
| Champion news queries | 6h | ≤24h (PS-02 AC ✅) |

## 4. Source Registry (seed rows for `sources`; 17 at launch — resilience rule ≥15 met)
| key | kind | what it yields | endpoint/config | cadence |
|---|---|---|---|---|
| `techcrunch_rss` | rss | funding, launch, news | techcrunch.com/feed + /category/venture/feed | 15m |
| `finsmes_rss` | rss | funding (global SMB) | finsmes.com/feed | 15m |
| `eu_startups_rss` | rss | funding EU | eu-startups.com/feed | 15m |
| `prnewswire_rss` / `businesswire_rss` | rss | funding, exec_change, launch | topic feeds (financing, personnel) | 15m |
| `edgar_form_d` | api | US funding (often pre-press) | efts.sec.gov full-text + Form D daily index (UA header required) | 2h |
| `google_news_account` | rss | news, exec_change, geo, funding backstop | news.google.com/rss/search?q="{Company}"+({kw}) — templated per account | 60m |
| `greenhouse_boards` | api | hiring | boards-api.greenhouse.io/v1/boards/{slug}/jobs | 30m |
| `lever_postings` | api | hiring | api.lever.co/v0/postings/{slug} | 30m |
| `ashby_boards` | api | hiring | api.ashbyhq.com/posting-api/job-board/{slug} | 30m |
| `workable_widget` | api | hiring | apply.workable.com/api/v1/widget/accounts/{slug} | 30m |
| `careers_diff` | crawl | hiring (non-ATS) | GH Actions: fetch careers_url, extract job links, hash-diff | nightly |
| `tech_detect` | crawl | tech_change | GH Actions: homepage+assets vs webappanalyzer OSS ruleset, fingerprint diff | nightly/7d |
| `producthunt_gql` | api | product_launch | PH GraphQL free token, posts by topic/company | 6h |
| `github_events` | api | launch/dev-signals (dev-tool ICPs) | api.github.com org events/releases, 5K req/h token | 6h |
| `champion_news` | rss | champion_move | Google News RSS `"<Full Name>" (joins OR appointed OR "has joined")` per tagged contact | 6h |
| `pixel` | webhook | pricing_visit, site_visit | first-party `/api/px` (03 §5.2) | realtime |
| `rb2b` | webhook | person enrichment on visits | RB2B free-plan webhook → `/api/webhooks/rb2b` (HMAC) | realtime |
| `clipper` | user | linkedin_clip | `/api/clip` from bookmarklet/extension | on-demand |
ATS slug discovery: at account-add, probe the four ATS URL patterns with the domain's slug candidates (domain, name-kebab); store hits in `companies.careers_url`/config; else fall back to `careers_diff`.

## 5. Per-Source Implementation Notes (the non-obvious 20%)
**5.1 RSS pool.** Conditional GET (ETag/Last-Modified). Classifier: regex-first — funding `/(raises?|raised|secures?|closes?|lands)\s+\$?[\d.]+\s*(m|million|b|billion)/i` + round extraction `/(pre-?seed|seed|series [a-e]\+?)/i`; exec `/(joins|appointed|named|hires?)\s+.{0,40}(as\s+)?(chief|cto|ceo|cro|cmo|cfo|coo|vp|president)/i`. Regex miss but company-relevant → cheap LLM extract (06 P-3, batched). Company link = first non-publisher outbound link host, else name-resolve.
**5.2 Hiring → intent mapping (CS-02/IS-06).** Deterministic library first (50+ entries; extendable per workspace): `head of sales ops|revops → crm_revops` · `sdr|bdr → sales_engagement` · `demand gen|growth marketing → martech` · `data engineer → data_stack` · `devops|sre|platform eng → infra` · `security engineer → security` · `ml engineer|ai → ai_tooling` · `customer success → cs_tooling` · `controller|finance ops → fintech_back_office` … Confidence: exact-title=high, keyword=med, dept-only=low. Unmapped senior titles → LLM classify (P-3), cache result into library table.
**5.3 EDGAR.** Daily Form D index + full-text search for issuer names among monitored companies; payload amount from offering data; `occurred_at` = filing date; note in card "SEC filing — may precede press."
**5.4 Google News quota.** Per-account queries are the only per-account cost. Cap: Hot(≥70) + top-fit accounts, ≤600 queries/day globally, rotate the tail on a 24h wheel; template `"{name}" (funding OR raised OR appoints OR launches OR expands)` restricted `when:7d`.
**5.5 Tech detect.** Fetch homepage HTML + up to 5 same-origin JS/CSS; run OSS Wappalyzer rules (headers/meta/scripts/cookies); compare sorted tech list hash vs `tech_fingerprint`; emit adds/removes; flag competitive if ∈ workspace competitor domains/category, complementary if ∈ curated integration list (config).
**5.6 Personal signals v1 (compliant $0 — the honest design).**
- *Champion move (PS-02):* triggers = (a) `champion_news` hit, (b) email-graph: tagged contact's `counterpart_domain` changes on inbound mail, (c) newsroom "welcomes/joins" mention. Evidence URL mandatory; email-graph-only detection is marked `evidence:'email_domain_change'` with a confirm prompt before champion outreach.
- *Signal Clipper (PS-03 v1):* bookmarklet posts `{url, selection, title}` from the user's active tab → server verifies user session → LLM relevance vs ICP pain points → `linkedin_clip` signal + immediate delivery. Extension (MV3, "activeTab" only) ships same behavior with nicer capture. Explicitly user-initiated: we never fetch LinkedIn ourselves.
- *v1.1 upgrade path:* `people_data_provider` interface (`lookupPerson`, `watchJobChanges`) with a stub; paid vendor implementation restores PS-01 4h SLO without touching product code.
**5.7 Pixel + RB2B.** See 03 §5.2. Repeat-evaluator rule (IS-03): ≥3 sessions/14d ⇒ payload flag + urgency bonus; pricing-path list from `workspaces.pricing_paths`. RB2B person data stored on the **delivery's workspace only** (privacy: never in global tables).

## 6. Fit Score (AD-02) — deterministic rubric
`fit = round(Σ dim_score × weight)` · weights: industry .30, size .20, stage .20, tech .20, geo .10.
Dim scoring: exact-match 100 · adjacent 60 (adjacency maps: stage ±1 step; size ±1 band; industry via small synonym/parent map; geo region-match) · unknown 50 (never punish missing data as hard as a mismatch) · mismatch 0. `fit_breakdown` stores per-dim `{value, matched, score}` for the hover popover. Bands: ≥70 Strong / 40–69 Moderate / <40 Weak. Recompute on ICP edit (bulk) and on company enrichment.
**Discover (AD-01):** NL query → LLM→filter-object (06 P-2) → SQL over corpus facets + pgvector cosine on ICP-text embedding for ranking within facet matches. **Seed corpus script (M2):** YC public directory (~5K) + Product Hunt B2B topics (90d) + GitHub trending orgs + backfill of every company our RSS pool has ever mentioned → target ≥8K rows day one.

## 7. Urgency Score (CS-07/SA-01) — the exact formula
Per **account**, over its signals from the last 21 days:
```
urgency(account) = clamp( Σ_i [ W(type_i) × D_i × M_i ] × F  +  B ,  0, 100 )
D_i (recency decay)   = 0.5 ^ (hours_since_occurred_i / halflife(type_i))
M_i (seniority mult)  = personal signals only: c_suite 1.3 · vp 1.15 · else 1.0
F  (ICP fit mult)     = 0.6 + 0.8 × (fit_score/100)          → 0.6 … 1.4
B  (stacking bonus)   = 10 × (distinct types in trailing 72h − 1), cap 30
```
| type | W | halflife |
|---|---|---|
| pricing_visit | 34 (person-identified) / 28 | 24h |
| funding | 32 | 168h |
| champion_move | 30 | 336h |
| exec_change | 26 | 240h |
| linkedin_clip | 22 | 96h |
| hiring (high-conf category) | 20 (med 14, low 8) | 240h |
| site_visit (repeat_evaluator) | 18 | 72h |
| product_launch / geo | 14 | 168h |
| tech_change | 14 (competitive-flag 20) | 336h |
| news | 8 | 72h |
Delivery urgency = its signal's term ×F (+B if in a stack). Account score refreshed on fanout + hourly decay job (`private.refresh_urgency()` implements the same math in SQL). `urgency_explain` stores each term `{type, W, decay, contrib}` + F + B → powers the ring tooltip. **≥70 ⇒ Hot** (badge, pinned, Google-News priority tier, PM-02 escalation). Calibration note: weights are v1 priors; revisit after 60 days against reply-rate data (a signal type that outperforms its weight gets promoted).

## 8. Stacking (SA-02)
On each new delivery: find account's most recent delivery ≤72h (by signal `occurred_at`); if exists, adopt its `stack_group_id` (create one and backfill if it was solo); else null. Stacked card renders when a group has ≥2 members; combined score = account urgency (already includes B); collapse rule: acting (Done/Draft) on the stack applies to all members; individual members remain individually claimable when expanded.

## 9. Notifications routing
Delivery created → per member `notification_prefs[type]`: `realtime` → in-app (Realtime) + email if urgency ≥70 · `daily` → included in Top-5/daily digest pool · `off` → feed only. Defaults on signup: funding/champion/pricing_visit=realtime, rest=daily (PS-07 "pre-configured for maximum value").

## 10. Health & Observability
Each run writes `ingestion_runs`; source auto-disables at 5 consecutive failures (+Sentry, +Settings red dot, +feed banner). Dashboard panel (Settings→internal `/admin` for owner-you): per-source last success, items/day, signals/day, dedup ratio, LLM-assist rate, latency p50/p95 (detected−occurred). KPI guardrail: global signals/day per monitored company between 0.1 and 1.0 — outside band = classifier drift, investigate.
