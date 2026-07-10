# 07 · SIGNAL AI — API Specification

**Architecture (03 §4):** mutations = **Next.js Server Actions** (typed, RLS-scoped via supabase-js with the user's session) · machine entrypoints = **Route Handlers** (webhooks, cron, pixels, clipper) · reads = RSC queries + Realtime. No public REST API in v1 (Non-Goal). Edge Functions (Deno) are internal workers invoked only by pg_cron/GH Actions — contracts in §5.

## 1. Auth model
| Caller | Mechanism |
|---|---|
| Browser/user | Supabase Auth session cookie → RLS enforces workspace scope on every query |
| pg_cron → Edge Fns / `/api/cron/*` | `Authorization: Bearer ${CRON_SECRET}` (constant-time compare) |
| GH Actions → ingest endpoint | same CRON_SECRET header |
| Stripe webhook | `stripe.webhooks.constructEvent` signature |
| RB2B webhook | `X-Signature: hex(hmac_sha256(RB2B_WEBHOOK_SECRET, rawBody))` |
| Pixel `/api/px`, open-pixel `/api/t/o/*` | unauthenticated by nature; workspace resolved by public `ws` token; rate-limited (§3) |
| Clipper `/api/clip` | user session cookie (bookmarklet runs in the user's logged-in browser) |
Service-role key: server-only (Route Handlers/Edge Fns needing cross-workspace writes). Never in client bundles — CI greps for it.

## 2. Server Actions (canonical list — signature → behavior → errors)
```
onboarding/
  inferICP(domain, oneLiner) → {icp, confidence}                    // P-1; 5s budget; AIBusyError
  saveICP(icp) · completeOnboardingStep(step)
  importAccounts(rows[{name?,domain,contact?...}], source) → {created, duplicates[], invalid[]}   // AD-05 preview done client-side; ≤500 rows/call
accounts/
  searchCompanies(nlQuery, filters?, cursor?) → {rows[], filterEcho}  // P-2 + corpus query (AD-01)
  addAccount(companyId|domain) → {accountId}                          // fit compute + backfill deliveries + status 'activating' (AD-03); PlanLimitError at cap
  archiveAccounts(ids[]) · restoreAccount(id) · setStage(accountId, stage) · assignOwner(accountId, userId)
  tagContact(contactId, tags[]) · upsertContact(accountId, fields) · deleteContact(id)
feed/
  listDeliveries(filters{types[],stage,window,view}, cursor) → {items[], nextCursor}   // ≤100/page (SA-01/04)
  claimDelivery(id) · unclaim(id) · markDone(ids[]) · snooze(id, until)                 // SA-05/06, PS-08
outreach/
  generateDraft(deliveryId|accountId, contactId?, channel='email') → Draft              // P-5 + validation (06 §5); QuotaExceededError
  regenerateSection(draftId, section) → Draft                                           // ≤5/section (06 P-5b)
  swapCTA(draftId, index) · updateDraftSections(draftId, sections)
  sendViaGmail(draftId, {followupDays?:3|5|7|null, trackOpens:bool}) → {messageId, threadUrl}
      // duplicate-touch precheck (ET-05): teammate→same contact ≤14d ⇒ throws DuplicateTouchError{bySubject,byDate,byName}
      // UI shows M-5 confirm → retry with {overrideDuplicate:true}
  logCall(accountId, {date,duration,outcome,note}) · cancelFollowup(id)
intel/
  getBrief(accountId, {force?:bool}) → Brief                                            // 6h cache; 30s budget (P-7)
  addCompetitor({name,domain}) · removeCompetitor(id)                                   // ≤10 (CI-01)
workspace/
  inviteMember(email, role) · revokeInvite(id) · acceptInvite(token) · removeMember(userId)
  updateWorkspace(fields) · setNotificationPref(type, mode) · savePersonalFilters(filters)
billing/
  createCheckoutSession(plan, interval) → {url} · createPortalSession() → {url}
misc/  saveNote(accountId, body, meta?) · verifyPixel() → {seenLastHour:bool} · dismissSuggestion(companyId) 
```
All actions: zod-validate input → auth+membership guard → work → `revalidatePath`/`revalidateTag` → typed result. Rate ceiling: 60 mutations/min/user (in-memory token bucket per instance + PostHog anomaly alert).

## 3. Route Handlers
**`POST /api/px`** (also `GET /api/px.gif`) — visitor pixel beacon. Query/body: `{ws, path, ref?, sid}`. Flow: validate ws token → drop if !monitored-domain candidate → hash IP (sha256+daily salt) → geo/ASN lookup (bundled MaxMind-lite db) → upsert `visitor_sessions` (30-min window). 204 (or 1×1 gif). Rate: 20 req/10s/IP token bucket → 429. EU flag set from geo (09 §4).
**`GET /api/t/o/[token].gif`** — open pixel. Look up `outreach_messages.track_token` → set `opened_at` if null (ignore self-opens: sender IP/UA heuristic) → return cached transparent gif, `Cache-Control: no-store`.
**`POST /api/clip`** — Signal Clipper. Session-auth. Body `{url, title, selection≤1200ch}`. Validate URL is public post pattern → P-3-style relevance vs ICP → create `linkedin_clip` signal (company resolved from author/context, else attach to chosen account) + delivery. → `{deliveryId, relevance}`.
**`POST /api/webhooks/rb2b`** — HMAC verify → map payload `{company_domain, person{name,title,linkedin_url}, page, ts}` → enrich matching open `visitor_session` / recent visit delivery (person-level, IS-05 confidence shown). 200 always after verify (idempotent).
**`POST /api/webhooks/stripe`** — sig verify → handle `checkout.session.completed` (set plan, ids), `customer.subscription.updated|deleted` (plan/expired), `invoice.payment_failed` (flag + email). Idempotency: event.id ledger table.
**`POST /api/ingest/batch`** — GH Actions → CRON_SECRET → body `{source_key, items[]}` → runs pipeline stages EXTRACT→FANOUT (05 §2) → `{created, deduped}`.
**`GET /api/cron/health`** — CRON_SECRET → returns per-source freshness JSON (05 §10) for the GH Actions monitor step.

## 4. Error contract (uniform across actions + routes)
```json
{ "error": { "code": "PLAN_LIMIT" | "QUOTA_EXCEEDED" | "AI_BUSY" | "DUPLICATE_TOUCH" | "NEEDS_REAUTH"
            | "VALIDATION" | "NOT_FOUND" | "FORBIDDEN" | "RATE_LIMITED" | "INTERNAL",
   "message": "human sentence the UI can show verbatim",
   "meta": { } } }
```
HTTP: VALIDATION 400 · FORBIDDEN 403 · NOT_FOUND 404 · DUPLICATE_TOUCH 409 · PLAN_LIMIT/QUOTA 402 · RATE_LIMITED 429 · AI_BUSY 503(+Retry-After) · INTERNAL 500 (Sentry id in meta). Server Actions throw typed classes mapping to the same codes; a shared `<ActionError>` toast/banner component renders them.

## 5. Internal Edge Function contracts (invoked by pg_cron with CRON_SECRET)
`/ingest-rss {shard}` · `/ingest-careers {shard}` · `/ingest-news` (Hot-tier Google News wheel) · `/flush-visits` (sessions→signals, IS rules) · `/gmail-sync` (per-user history.list batch → replied_at, graph edges) · `/followup-scan` (due → surfaced cards + P-5 variation queue) · `/digest-send` (tz 7–9am windows → Resend) · `/suggest-accounts` (AD-04 Monday) · `/why-lines` (fill queue, P-4) · `/refresh-scores` (SQL fallback path). All: idempotent, ≤30s, write `ingestion_runs`, exit 0 even on partial failure (health table carries the signal).

## 6. Pagination, time, ids
Cursor = base64 `{created_at,id}` keyset (never OFFSET on feed). All timestamps UTC ISO-8601; client renders in profile tz. IDs are uuids; never expose sequential ids. List defaults: feed 50/page (100 max), accounts 50, messages 25.
