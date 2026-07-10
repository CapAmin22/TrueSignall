# 02 · SIGNAL AI — Product Design Specification

**Purpose:** everything a coding agent needs to build the UI without inventing design decisions. Pairs with 01 (what) and 05/06 (data behind each surface).
**Stack assumed:** Next.js App Router · Tailwind v4 · shadcn/ui · lucide-react · Recharts (analytics only) · Supabase Realtime.

---

## 1. Design Principles (rank-ordered; ties break upward)
1. **Signal first, chrome last.** The feed is the product. Every screen answers "who, why now, what to say" within one glance.
2. **Explainable, never magical.** Every score, alert, and draft shows its evidence (source URL, matched dimensions, triggering event). No unexplained numbers.
3. **One primary action per surface.** Feed→Draft. Draft→Send. Brief→Read. Secondary actions live in an overflow ⋯ menu.
4. **Founder pace.** Optimize for a 12-minute daily session on a laptop between meetings, readable on a phone in a hallway.
5. **Calm urgency.** Color communicates priority without alarm-fatigue: one red state exists (Hot ≥70 / Competitive), everything else stays quiet.

## 2. Design Tokens (put in `app/globals.css` as CSS vars + Tailwind theme)
```
Font: Geist Sans (UI), Geist Mono (data/IDs). Base 14px, scale 12/14/16/20/24/32.
Radius: 10px cards, 8px controls, 999px chips/badges.
Spacing grid: 4px. Card padding 16px. Page gutter 24px (desktop) / 16px (mobile).
Light theme (default)            Dark theme
--background  #FAFAF9 stone-50    #0C0A09
--surface     #FFFFFF             #1C1917
--border      #E7E5E4             #292524
--text        #1C1917             #FAFAF9
--muted       #78716C             #A8A29E
--primary     #4F46E5 indigo-600  #6366F1   (buttons, links, focus)
--signal      #10B981 emerald-500            (positive/new-signal accents)
--warn        #F59E0B amber-500              (urgency 40–69, warnings)
--hot         #EF4444 red-500                (urgency ≥70, competitive)
--info        #3B82F6 blue-500               (intent/visit signals)
Urgency ring: conic gradient muted→warn→hot mapped 0–100.
Signal-type icon+tint: funding=Banknote/emerald · hiring=Briefcase/amber · exec=UserPlus/indigo ·
tech=Cpu/blue · news=Newspaper/stone · launch=Rocket/violet-500 · visit=MousePointerClick/blue ·
champion=HeartHandshake/emerald · clip=Paperclip/sky-500 · competitive=Swords/red.
Shadows: cards shadow-sm; hover shadow-md + border-primary/30. Motion: 150ms ease-out; feed inserts slide+fade 200ms; respect prefers-reduced-motion.
```
Empty-state illustrations: simple line-art (lucide oversized icon + heading + one action). No stock art.

## 3. Information Architecture & Routes
```
(marketing)  /                      landing (public)
(auth)       /login  /auth/callback
(onboarding) /onboarding            5-step wizard (own layout, no sidebar)
(app)  layout: left sidebar 240px (collapsible → icons 64px), topbar (workspace switcher · search ⌘K · notifications bell · avatar)
  /feed                 S2  Signal Feed (default post-onboarding)
  /feed/unclaimed       S2b Unclaimed view (TC-03)
  /discover             S3  NL search + suggestions (AD)
  /accounts             S4  Account list (table)
  /accounts/[id]        S5  Account detail (tabs: Overview · Signals · Contacts · Outreach · Notes)
  /accounts/[id]/brief  S6  Pre-call brief (print/mobile clean)
  /pipeline             S7  Kanban
  /outreach             S8  Sent history + analytics (ET-03)
  /competitors          S9  Competitor tab (CI)
  /settings/{profile|icp|team|notifications|integrations|competitors|billing}  S10
Modals/sheets: DraftComposer (right sheet 560px, M-1) · SignalDetail (M-2) · ImportWizard (M-3) · InviteMember (M-4) · ConfirmDuplicateTouch (M-5, ET-05) · UpgradePrompt (M-6).
Mobile (<768px): sidebar → bottom tab bar (Feed · Discover · Pipeline · Accounts · ⋯); DraftComposer full-screen; feed cards stack full-width.
```

## 4. Core Components (names are canonical for the codebase)
**`<SignalCard>`** — the atom of the product.
```
┌──────────────────────────────────────────────────────────────┐
│ [icon]  Acme Corp ▸            (fit 82)        ◔ 76 Hot ●    │  header: type icon · account chip(click→S5) · fit pill · urgency ring+badge
│ Raised $12M Series A led by Foundry                          │  title: one factual line
│ Why now: funded companies typically finalize vendors within  │  ai line (SA-03), 1–2 sentences, muted
│ 90 days — and they're hiring a Head of Sales Ops.            │
│ TechCrunch ↗ · occurred 2h ago · detected 14m ago            │  provenance row (mandatory)
│ [⚡ Draft outreach]  [Claim] [Done] [Snooze ▾] [⋯]           │  actions: 1 primary + quiet secondaries
└──────────────────────────────────────────────────────────────┘
States: default · claimed (avatar+“In progress · Sara · 2d”) · done(archived) · snoozed · inPipeline(violet left border + tag) · competitive(red left border).
```
**`<StackedSignalCard>`** (SA-02): header row `Acme Corp · 3 signals · combined ◔ 84 Hot`, three mini-rows (icon + 8-word summary + time), expand chevron → inline list of full `<SignalCard>`s; primary action drafts against the stack (all signal_refs passed).
**`<UrgencyRing>`** 20px conic ring + number; tooltip = score breakdown (per-signal contribution + decay + stack bonus) — data from §05 §8 explain payload.
**`<FitPill>`** colored by band; hover popover: 5 dimension rows ✓/✕ + weights (AD-02).
**`<DraftComposer>`** (right sheet): context header (signal summary + “copy why-now”) · editable sections Subject/Opening/Value/CTA/Sign-off each with ↻ regenerate (count 5) · CTA dropdown (4 stage-appropriate alternatives) · angle tabs (v1.1) · footer: quality hint chip · `Send via Gmail` primary (or `Connect Gmail` just-in-time) · `Copy for LinkedIn` secondary · schedule follow-up toggle (3/5/7d, default 5).
**`<FeedFilters>`** chip row: Type(multi) · Stage · Time(Today/7d/30d) · sort. Active chips removable; session-persist only (SA-04).
**`<AccountRow>`** table row: company · fit pill · urgency ring · last signal (type+time) · stage badge · owner avatar · sparkline 30d signal frequency (v1.1, AD-07) · row menu (archive, assign).
**`<PipelineCard>`** company · urgency ring · last-signal line · last-outreach line · signal-count badge · Re-Engage-Now red tag when set.
**`<BriefSection>`** title + ≤100-word body + freshness stamp; sections: Why This Conversation (top, lists triggers w/ source links or the cold-outreach notice) · Company Now · People · Talking Points · History.
**`<EmptyState>`**, **`<LimitBanner>`** (80% plan usage, links Upgrade M-6), **`<SourceHealthDot>`** (settings), **`<TopFiveDigest>`** email template (SA-07 v1.1 — build template in v1, cron in v1.1).

## 5. Screen Specs (acceptance-level)

**S1 · Onboarding wizard** — centered card 640px, stepper 1–5, Skip on every step, progress %.
Step2 layout: URL field → auto-fetch favicon/name (delight moment) → one-liner textarea (200 char counter) → `Infer my ICP` → skeleton 3–5s → ICP result as editable chip groups (Industry, Size, Stage, Seniority, Geo, Pain points) + `Regenerate` + `Looks right →`. Step4 import tabs: CSV (drag-drop, column-mapping preview, dup flags — AD-05) · HubSpot · Notion · Paste domains. Step5: live feed preview populating with backfilled signals + “🎉 3 signals found on your accounts” → `Enter Signal AI`. AC hooks: OB-02 ≤5s inference; OB-04 accounts visible ≤2min; OB-05 exit-with-signal.

**S2 · Feed** — header: `Signals` + count-new-today · FeedFilters · view toggle (All / Unclaimed / Snoozed / Archived). Body: virtualized card list (100 max per page, infinite scroll). Realtime: new deliveries slide in top with 2s `--signal` left-border flash; a floating “3 new signals ↑” pill appears when user has scrolled. Right rail (≥1280px): Today panel — Top-5 list, plan usage, source health summary. Empty: “No signals yet — monitoring is live on N accounts” + Add accounts. Loading: 5 skeleton cards. Error: retry banner. Perf AC: SA-01 ≤3s.

**S3 · Discover** — hero NL search input (`Try: “B2B fintech, Series A, 20–100 people, US”`) → result table (company · fit pill · stage · size · geo · one-line why-matched · `+ Monitor`), filter sidebar (fit band, stage, geo, industry), bulk-add checkbox. Below: “Suggested this week” section (AD-04 rows with reason + Add/Dismiss/Snooze). Niche-empty state per 01 §4-F2.

**S4 · Accounts** — toolbar: search · stage filter · signal-activity filter (AD-07 v1.1) · Import · columns per `<AccountRow>` · bulk archive. Archived tab preserves history (AD-08 v1.1 — build tab shell now).

**S5 · Account detail** — header: name+domain+favicon · fit pill · urgency ring · stage select · owner select · `⚡Draft` · `Brief` · ⋯(archive). Tabs: **Overview** (about, firmographics, tech stack chips w/ competitive-red & complementary-green flags, top contacts) · **Signals** (vertical timeline, filter by type, each row = mini SignalCard w/ source link; CS-06 export v1.1) · **Contacts** (list + tag Champion/Customer toggle → enables PS-02) · **Outreach** (ET-04 chronological thread list: direction arrow, subject, snippet, open/reply status dots, +Log call) · **Notes** (composer w/ @mention v1.1).

**S6 · Brief** — clean reading page, max-width 640, sections per `<BriefSection>`, sticky mobile header w/ meeting time if from calendar (v1.1), `↻ Refresh` regenerates (30s spinner max — PC-01), print stylesheet.

**S7 · Pipeline** — 5 columns w/ count+sum of Hot; drag-drop (@dnd-kit); column auto-scroll; card click → S5. Quiet+new-signal cards float to column top with Re-Engage tag (PM-03). Header: `My accounts | All` toggle (TC ownership v1.1 filter builds on it).

**S8 · Outreach analytics** — KPI row (Signal reply % vs Non-signal reply % vs 3.4% industry line · median time-to-reply · open rate) — locked state “Unlocks after 20 sends (n/20)” per ET-03; below, message table w/ status pipeline (Sent→Opened→Replied), follow-up-due filter.

**S9 · Competitors** — grid of competitor cards (logo, funding, headcount, G2 stars, latest news line) + per-account Competitive Alerts list; add/edit (≤10) inline (CI-01).

**S10 · Settings** — icp: same chip editor as onboarding (owner-only global fields; member sees read-only + personal-filter section — TC-04) · team: member table + Invite (role select) · notifications: per-signal-type Real-time/Daily/Off matrix (PS-07 pattern, defaults on) + digest toggles · integrations: Gmail (status, re-auth, disconnect, “what we store” link), Pixel snippet copy + verify button, RB2B webhook URL+secret, HubSpot/Notion (v1.1 badges), Calendly link field · competitors · billing: current plan card, usage meters (accounts/contacts/drafts w/ 80% amber), plan grid, Stripe portal link, trial countdown banner.

## 6. Cross-cutting States & Rules
- **Every async surface ships loading (skeleton), empty (icon+line+CTA), error (message+retry)** — the QA matrix (§10 §6) checks all three per screen.
- Toasts bottom-right, 4s: success `Sent to Priya at Acme ✓ · View thread`; error persists with retry.
- Confirmations only for destructive/irreversible: archive-bulk, disconnect Gmail, downgrade, duplicate-touch override (M-5 shows founder’s subject+date, requires typed “send anyway”? — no: single confirm button, per ET-05).
- Keyboard: ⌘K palette (accounts/actions), `d` draft on focused card, `e` done, `c` claim, `s` snooze, `/` search, j/k navigate feed.
- Accessibility: all interactive elements focus-visible ring `--primary`; ARIA labels on icon buttons; color never sole meaning (badges carry text); contrast AA on both themes.
- Numbers: relative time <7d (“2h ago”) else date; “occurred X · detected Y” pair on every signal (trust rule).
- Copy voice: plain, specific, zero hype. Buttons are verbs (“Draft outreach”, not “Generate ✨”). Never blame the user in errors.
- i18n not in v1; all strings in `/lib/copy.ts` anyway (single source, easy future extraction).

## 7. Marketing Landing (route `/`) — minimum viable, same tokens
Hero: headline “Reach out at the exact right moment. Every time.” · sub “Signal AI watches your target accounts across 15+ sources and turns buying signals into voice-matched outreach — in one click.” · CTA `Start free — no card` · live-looking demo feed (3 animated sample cards). Sections: problem stats row (3.4% vs 15%+ · 5× first-mover) → 3-step how-it-works → pricing table (flat, “No credits. Ever.” banner) → FAQ (data sources, privacy, Gmail scopes) → footer (Privacy, Terms, DPA). Ship at M8.

## 8. Design → Story Traceability (spot-check map)
S1↔OB-01..06 · S2↔SA-01..06, PS/CS/IS cards · S3↔AD-01..04 · S5↔ET-04, CS-06, PS tagging · M-1↔OC-01..04, ET-01/06 · S6↔PC-01..02 · S7↔PM-01..03 · S8↔ET-02..03 · S9↔CI-01..02 · S10↔TC-04, BL-01..03, PS-07, IS pixel. Any UI element not traceable to a story ID is out of scope — delete it.
