# 08 · SIGNAL AI — Integrations Specification

Covers every third-party surface: Gmail (the critical one), Outlook (v1.1), HubSpot/Notion import, Calendly, RB2B, Stripe. Each: scopes → flow → data handling → failure handling. Privacy rules referenced from 09.

---

## 1. Gmail (OB-03, OC-02, ET-01..04) — the load-bearing integration
**Scopes (requested just-in-time, separately explained in UI):**
| Scope | Requested when | Used for |
|---|---|---|
| `gmail.send` | first Send click | ET-01 send-as-user |
| `gmail.metadata` | onboarding step 3 (skippable) | email graph (headers only) + reply detection |
| `userinfo.email/profile` | signup | identity |
No `gmail.readonly` in v1 **except** transiently during voice calibration: calibration runs a one-time incremental consent for `gmail.readonly`, fetches the last 50 *sent* messages into memory, extracts the profile (06 P-6), and the app **never persists bodies** (09 §3). If Google verification of readonly is pending at launch: fallback = paste-3-samples path (already specced) — product works without it.
**App verification reality:** `gmail.send`/`gmail.metadata` are restricted scopes → Google OAuth verification (+ possible CASA scan) takes 2–6 weeks. Start the submission at **M1**, run beta with test users (100-user unverified cap aligns with our 100-user target) — this is the one external clock on the launch plan.
**Token handling:** authorization-code + PKCE, `access_type=offline prompt=consent` → refresh token encrypted in Supabase Vault (`user_integrations` row: provider, vault_secret_id, scopes[], status). Refresh on demand; 401/`invalid_grant` → status `needs_reauth` → banner + email; all dependent features degrade to copy-paste drafts.
**Graph indexing (OB-03):** metadata-only `messages.list(q="in:sent", format=metadata)` walk, newest→18mo, batched 100; store hashed counterpart + domain + counts + last_at (04 `email_graph_edges`). ≤10 min for typical mailbox (AC) — run as background job with progress in Settings.
**Send (ET-01):** MIME build (quoted-printable, plain + minimal HTML alternative w/ open pixel `<img src="{APP_URL}/api/t/o/{token}.gif">` when consented) → `users.messages.send` → store `gmail_message_id`, `gmail_thread_id` → Sent-folder link `https://mail.google.com/mail/u/0/#sent/{threadId}`. Headers: `X-SignalAI: {message_uuid}`. Soft cap 50 sends/user/day (01 §8) — hard product rule, not Gmail's.
**Reply detection (ET-03/04):** per-user `history.list(startHistoryId, historyTypes=messageAdded)` every 7 min (metadata) → new message whose `threadId` ∈ our sent threads and `From` ≠ user ⇒ `replied_at`, snippet (first 140 chars from metadata headers/snippet field), cancel followup, log activity, PostHog `message_replied`. historyId expiry (404) → re-baseline from `messages.list(q="newer_than:7d")`.
**Disconnect:** revoke via `oauth2.revoke`, delete Vault secret, keep already-derived graph edges (hashed, workspace data) unless user also clicks "delete derived data" (09 §6).

## 2. Outlook / Microsoft 365 (v1.1 — interface ships in v1)
`EmailProvider` interface (`send`, `listSentMetadata`, `watchReplies`) with Gmail impl + stub. Graph scopes planned: `Mail.Send`, `Mail.ReadBasic` (metadata-class). UI shows Outlook tile "coming soon" to capture demand clicks (PostHog).

## 3. Imports (OB-04/AD-05)
**CSV/XLSX:** client-side parse (papaparse/SheetJS) → mapping UI (name, domain*, contact fields, stage, notes) → `importAccounts` batches of 200 → results panel (created/dupes/invalid rows downloadable). Domain normalize: lowercase, strip proto/www/path.
**HubSpot (one-click):** OAuth app, scope `crm.objects.companies.read` (+contacts.read optional toggle) → GET companies (domain, name) paginated → same pipeline. Free HubSpot dev app; token in Vault. Pipeline **sync-back** (PM-04) is v1.1: property `signalai_stage` two-way, 5-min delta poll.
**Notion:** OAuth → user picks a database → property mapping (URL/domain prop required) → import. v1.1 export: pipeline → Notion DB upsert.

## 4. Calendly / Cal.com (ET-06)
No API needed in v1: Settings stores `scheduling_links[{label,url}]`; DraftComposer "📅 insert" → P-5 micro-call rewrites the CTA sentence to embed the chosen link naturally (never bare-appended). v1.1: Calendly webhook `invitee.created` → auto-stage `meeting_booked`.

## 5. RB2B (IS person-level enrichment)
Settings shows webhook URL `{APP_URL}/api/webhooks/rb2b` + generated secret → user pastes into RB2B (free plan). Payload mapped per 07 §3; person data stored **only** on that workspace's session/delivery (never global — 09 §3). Missing/invalid HMAC → 401 + counter; 10 failures → integration flagged.

## 6. Stripe (BL-01..03)
**Catalog (created by `scripts/stripe-setup.ts`):** products starter/growth/scale × monthly+annual prices (`$99/990, $249/2490, $499/4990` — annual = 2 months free) + metadata `{accounts,contacts,seats,drafts}` mirrored in `/lib/plans.ts` (single source for meters).
**Trial:** app-managed (no card, BL-01): `workspaces.trial_ends_at`; warnings 7/3/1d (banner + Resend email); expiry → plan `expired` → read-only mode (feed visible, actions gated by upgrade modal); data retained 30d then workspace purge job (09 §6).
**Checkout:** `createCheckoutSession` → hosted Checkout (customer created lazily) → webhook `checkout.session.completed` sets plan + ids → success page → PostHog `plan_upgraded`.
**Portal:** all card/invoice/cancel/downgrade via Stripe Billing Portal (configured: plan switches allowed, cancel at period end). Webhook `customer.subscription.updated` maps price→plan; `deleted` → `expired` at period end. Downgrade guard (BL-03): before portal redirect, if usage exceeds target-plan limits show excess breakdown modal (informational — Stripe still executes; limits enforce naturally).
**Limit enforcement (BL-02 — flat, never bill overage):** meters = accounts(active count), contacts, seats, drafts/mo (`usage_counters`). 80% → `<LimitBanner>` + one email; 100% → the specific capability pauses gracefully (`PLAN_LIMIT` error: add-account blocked, draft button → upgrade modal; **monitoring of existing accounts never pauses**). No surprise charges, ever — this is a marketing promise, treat as invariant test (10 §6 QA-B2).
**Idempotency & audit:** `stripe_events(id pk, type, processed_at)`; replay-safe handlers; every plan change → `activity_log`.
