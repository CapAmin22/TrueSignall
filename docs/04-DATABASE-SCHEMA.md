# 04 · SIGNAL AI — Database Schema (Supabase / Postgres 15)

**Usage:** apply as ordered migrations (`supabase/migrations/0001_…` per section). Everything here is executable. Conventions: `uuid` PKs (`gen_random_uuid()`), `timestamptz` everywhere, `text + CHECK` instead of native enums (cheap to extend), soft-delete only where a story requires undo, **RLS default-deny on every table**.
**Tenancy model (from 03 §3):** global `companies` + `signals` (public/firmographic data only, service-role writes) → per-workspace everything else via `workspace_id` + membership RLS.

---

## 1. Extensions, schemas, helpers
```sql
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;        -- fuzzy company search
create extension if not exists vector;         -- pgvector: ICP/company embeddings (Discover)
create extension if not exists pg_cron;
create extension if not exists pg_net;         -- cron -> edge function HTTP calls
create schema if not exists private;

create or replace function private.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from workspace_members m
                 where m.workspace_id = ws and m.user_id = auth.uid());
$$;

create or replace function private.is_owner(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from workspace_members m
                 where m.workspace_id = ws and m.user_id = auth.uid() and m.role = 'owner');
$$;

create or replace function private.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
-- attach to every table that has updated_at:
-- create trigger t_touch before update on <table> for each row execute function private.touch_updated_at();
```

## 2. Identity, tenancy, billing
```sql
create table profiles (                                   -- mirrors auth.users
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, avatar_url text, timezone text default 'UTC',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null, domain text,                        -- founder's own company
  product_one_liner text,
  icp jsonb not null default '{}'::jsonb,                 -- {industries[],sizes[],stages[],seniorities[],geos[],pain_points[],tech[]}
  pricing_paths text[] not null default '{/pricing}',     -- IS-01 config
  settings jsonb not null default '{}'::jsonb,            -- misc feature flags
  plan text not null default 'trial' check (plan in ('trial','starter','growth','scale','expired')),
  trial_ends_at timestamptz not null default now() + interval '14 days',
  stripe_customer_id text, stripe_subscription_id text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  personal_filters jsonb not null default '{}'::jsonb,    -- TC-04 member-level layer
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null, role text not null default 'member',
  token text not null unique default encode(gen_random_bytes(24),'hex'),
  accepted_at timestamptz, created_at timestamptz not null default now()
);

create table usage_counters (                             -- BL-02 limit meters (monthly window)
  workspace_id uuid not null references workspaces(id) on delete cascade,
  period date not null,                                   -- first of month
  drafts_generated int not null default 0,
  messages_sent int not null default 0,
  primary key (workspace_id, period)
);
```

## 3. Global corpus (service-role writes; firmographic/public data ONLY)
```sql
create table companies (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,                            -- canonical lowercase, no www
  name text, description text, logo_url text,
  industry text, employee_range text
    check (employee_range in ('1-10','11-50','51-200','201-500','501-1000','1000+')),
  stage text check (stage in ('bootstrap','pre_seed','seed','series_a','series_b','series_c_plus','public','unknown')),
  hq_country text, hq_region text,
  tech_stack text[] not null default '{}',
  tech_fingerprint text,                                  -- hash for CS-03 diffing
  careers_url text, careers_hash text, newsroom_rss text,
  source text,                                            -- how it entered corpus (seed_yc, rss_funding, user_import…)
  embedding vector(768),                                  -- Discover semantic search (Gemini embeddings)
  enriched_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index idx_companies_name_trgm on companies using gin (name gin_trgm_ops);
create index idx_companies_facets on companies (stage, employee_range, hq_country);
create index idx_companies_embedding on companies using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table signals (                                    -- immutable global events
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  type text not null check (type in (
    'funding','hiring','exec_change','tech_change','news','product_launch','geo_expansion',
    'pricing_visit','site_visit','champion_move','linkedin_clip','conference','intent_surge','g2_activity')),
  title text not null,                                    -- one factual line (card title)
  payload jsonb not null default '{}'::jsonb,             -- type-specific fields, contracts in 05 §5
  source text not null,                                   -- registry key (techcrunch_rss, greenhouse, pixel…)
  source_url text,                                        -- MANDATORY for public signals (trust rule)
  occurred_at timestamptz not null,                       -- when the event happened/published
  detected_at timestamptz not null default now(),
  dedup_hash text not null unique,                        -- sha256(domain|type|canonical_url_or_title|yyyymmdd)
  why_line text,                                          -- cached AI explanation (SA-03), one per signal
  created_at timestamptz not null default now()
);
create index idx_signals_company_time on signals (company_id, occurred_at desc);
create index idx_signals_type_time on signals (type, detected_at desc);

create table sources (                                    -- registry + health (05 §4)
  key text primary key,                                   -- 'techcrunch_rss','edgar_form_d',…
  kind text not null check (kind in ('rss','api','crawl','webhook','user')),
  config jsonb not null default '{}'::jsonb,              -- url, shard rules, parser name
  cadence_minutes int not null default 60,
  enabled boolean not null default true,
  last_run_at timestamptz, last_success_at timestamptz,
  consecutive_failures int not null default 0,            -- auto-disable at 5 (03 §6)
  stats jsonb not null default '{}'::jsonb
);

create table ingestion_runs (                             -- job ledger / queue (FOR UPDATE SKIP LOCKED)
  id bigint generated always as identity primary key,
  source_key text not null references sources(key),
  shard int not null default 0,
  status text not null default 'queued' check (status in ('queued','running','ok','error')),
  started_at timestamptz, finished_at timestamptz,
  items_found int default 0, signals_created int default 0, error text
);
```

## 4. Workspace domain tables
```sql
create table accounts (                                   -- workspace ⇄ company subscription
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id),
  status text not null default 'active' check (status in ('activating','active','archived')),
  archived_at timestamptz,                                -- AD-08 30-day undo window
  fit_score int check (fit_score between 0 and 100),
  fit_breakdown jsonb,                                    -- per-dimension explain (AD-02 hover)
  urgency_score int not null default 0,
  stage text not null default 'identified' check (stage in
    ('identified','contacted','responded','meeting_booked','proposal_sent','closed_won','closed_lost')),
  owner_id uuid references profiles(id),
  source text default 'import',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (workspace_id, company_id)
);
create index idx_accounts_ws_stage on accounts (workspace_id, stage);
create index idx_accounts_ws_urgency on accounts (workspace_id, urgency_score desc) where status='active';

create table contacts (                                   -- personal data: workspace-scoped ONLY (09 §3)
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  full_name text not null, title text, email text, linkedin_url text,
  seniority text check (seniority in ('c_suite','vp','director','manager','ic','unknown')),
  tags text[] not null default '{}',                      -- 'champion','customer' enable PS-02
  enrichment jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index idx_contacts_ws_account on contacts (workspace_id, account_id);
create index idx_contacts_champions on contacts (workspace_id) where tags && array['champion','customer'];

create table signal_deliveries (                          -- what the feed renders
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  signal_id uuid not null references signals(id) on delete cascade,
  urgency int not null default 0,                         -- workspace-specific (fit multiplier)
  urgency_explain jsonb,                                  -- ring tooltip payload (05 §8)
  stack_group_id uuid,                                    -- SA-02: shared per account/72h window
  status text not null default 'new' check (status in ('new','claimed','done','snoozed')),
  claimed_by uuid references profiles(id), claimed_at timestamptz,   -- SA-05 (7d expiry via cron)
  snoozed_until timestamptz,                              -- PS-08
  done_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, signal_id, account_id)
);
create index idx_deliv_feed on signal_deliveries (workspace_id, status, urgency desc, created_at desc);
create index idx_deliv_stack on signal_deliveries (workspace_id, account_id, stack_group_id);
create index idx_deliv_snooze on signal_deliveries (snoozed_until) where status='snoozed';

create table outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  delivery_id uuid references signal_deliveries(id) on delete set null,
  account_id uuid not null references accounts(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  channel text not null default 'email' check (channel in ('email','linkedin')),
  angle text default 'signal' , cta_variant text,
  sections jsonb not null,                                -- {subject,opening,value_prop,cta,signoff}
  signal_refs uuid[] not null default '{}',
  quality jsonb,                                          -- {score,subscores,flags[]} (06 §7)
  regen_counts jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','sent','discarded')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table outreach_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  draft_id uuid references outreach_drafts(id) on delete set null,
  account_id uuid not null references accounts(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  sender_id uuid not null references profiles(id),        -- ET-05 sent-by
  channel text not null default 'email',
  direction text not null default 'outbound' check (direction in ('outbound','inbound','call_note')),
  subject text, snippet text,                             -- first ~140 chars only (privacy: no full bodies of inbound)
  gmail_message_id text, gmail_thread_id text,
  track_token text unique default encode(gen_random_bytes(16),'hex'),  -- pixel
  is_signal_triggered boolean not null default true,      -- ET-03 comparison
  sent_at timestamptz, opened_at timestamptz, replied_at timestamptz,
  edit_distance_ratio numeric(4,3),                       -- DAR input (sent vs generated)
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_msgs_ws_account_time on outreach_messages (workspace_id, account_id, created_at desc);
create index idx_msgs_thread on outreach_messages (gmail_thread_id);
create index idx_msgs_contact_recent on outreach_messages (workspace_id, contact_id, sent_at desc); -- ET-05 14d check

create table followups (                                  -- ET-02
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  message_id uuid not null references outreach_messages(id) on delete cascade,
  due_at timestamptz not null, days int not null default 5 check (days in (3,5,7)),
  status text not null default 'scheduled' check (status in ('scheduled','surfaced','done','cancelled')),
  created_at timestamptz not null default now()
);
create index idx_followups_due on followups (due_at) where status='scheduled';

create table email_graph_edges (                          -- OB-03: METADATA ONLY, hashed counterpart
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  counterpart_hash text not null,                         -- sha256(lower(email))
  counterpart_domain text not null,
  direction text not null check (direction in ('sent','received')),
  msg_count int not null default 1, last_at timestamptz not null,
  primary key (workspace_id, user_id, counterpart_hash, direction)
);
create index idx_graph_domain on email_graph_edges (workspace_id, counterpart_domain);

create table voice_profiles (                             -- OC-02 (06 §5)
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  features jsonb not null default '{}'::jsonb,
  exemplars jsonb not null default '[]'::jsonb,           -- ≤5 user-APPROVED snippets
  calibrated_at timestamptz, primary key (workspace_id, user_id)
);

create table briefs (                                     -- PC-01 6h cache
  account_id uuid primary key references accounts(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  content jsonb not null, generated_at timestamptz not null default now()
);

create table competitors (                                -- CI-01 (≤10 enforced in app)
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null, domain text not null,
  enrichment jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, domain)
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null, meeting_date date, outcome_tag text,
  created_at timestamptz not null default now()
);

create table activity_log (                               -- TC-01
  id bigint generated always as identity primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  account_id uuid references accounts(id) on delete cascade,
  actor_id uuid references profiles(id),
  verb text not null,                                     -- 'signal_done','message_sent','stage_changed',…
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_activity_account on activity_log (workspace_id, account_id, created_at desc);

create table notification_prefs (                         -- PS-07 matrix
  workspace_id uuid not null, user_id uuid not null,
  signal_type text not null, mode text not null default 'realtime'
    check (mode in ('realtime','daily','off')),
  primary key (workspace_id, user_id, signal_type),
  foreign key (workspace_id, user_id) references workspace_members on delete cascade
);

create table visitor_sessions (                           -- pixel aggregation buffer (30-min windows)
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  ip_hash text not null, company_domain text, is_eu boolean not null default false,
  person jsonb,                                           -- RB2B enrichment if any
  paths text[] not null default '{}', page_count int not null default 0,
  started_at timestamptz not null default now(), last_at timestamptz not null default now(),
  flushed boolean not null default false
);
create index idx_visits_flush on visitor_sessions (flushed, last_at);
```

## 5. Row-Level Security
```sql
-- default deny
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('alter table %I enable row level security', t);
  end loop; end $$;

-- profiles: self
create policy p_profiles_self on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

-- workspaces: members read; owner update; insert by creator (becomes owner via trigger in app action)
create policy p_ws_read   on workspaces for select using (private.is_member(id));
create policy p_ws_update on workspaces for update using (private.is_owner(id));
create policy p_ws_insert on workspaces for insert with check (auth.uid() is not null);

create policy p_members_read on workspace_members for select using (private.is_member(workspace_id));
create policy p_members_owner_write on workspace_members for insert with check (private.is_owner(workspace_id));
create policy p_members_owner_del   on workspace_members for delete using  (private.is_owner(workspace_id));

-- generic member policies (repeat for every workspace_id table):
--   accounts, contacts, signal_deliveries, outreach_drafts, outreach_messages, followups,
--   email_graph_edges(user-scoped: add AND user_id=auth.uid() for write), voice_profiles(user-scoped),
--   briefs, competitors, notes, activity_log, notification_prefs, usage_counters, invites(owner), visitor_sessions(read)
create policy p_accounts_member on accounts for all
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
-- …identical pattern for the rest (generate mechanically; user-scoped tables restrict writes to user_id = auth.uid()).

-- global corpus: read for any authed user; NO client writes (service role bypasses RLS)
create policy p_companies_read on companies for select using (auth.uid() is not null);
create policy p_signals_read   on signals   for select using (auth.uid() is not null);
-- sources / ingestion_runs: no policies → service-role only.
```
Immutability guard: `create trigger t_signals_immutable before update or delete on signals for each row execute function private.block_mutation();` (allow only `why_line` update via a security-definer function).

## 6. Realtime, triggers, pg_cron
```sql
alter publication supabase_realtime add table signal_deliveries;   -- feed live inserts (RLS applies)

-- updated_at touch triggers on: profiles, workspaces, companies, accounts, contacts, outreach_drafts.

-- claim expiry (SA-05) — pure SQL, no function needed:
select cron.schedule('claims-expire','*/30 * * * *', $$
  update signal_deliveries set status='new', claimed_by=null, claimed_at=null
  where status='claimed' and claimed_at < now() - interval '7 days'$$);

-- snooze resurface (PS-08):
select cron.schedule('snooze-wake','*/15 * * * *', $$
  update signal_deliveries set status='new', snoozed_until=null
  where status='snoozed' and snoozed_until <= now()$$);

-- urgency decay refresh (CS-07 ≤1h): recompute account scores hourly (SQL implementation of 05 §8 decay)
select cron.schedule('score-decay','5 * * * *',
  $$select private.refresh_urgency()$$);                  -- plpgsql fn ships in migration 0007

-- delivery pruning (storage budget, 03 §1): archive-done >90d
select cron.schedule('deliv-prune','15 3 * * *', $$
  delete from signal_deliveries where status='done' and done_at < now() - interval '90 days'$$);

-- edge-function invokers (URL + service key via Vault-backed settings):
select cron.schedule('ingest-rss','*/15 * * * *', $$select net.http_post(
  url:=current_setting('app.edge_url')||'/ingest-rss',
  headers:=jsonb_build_object('Authorization','Bearer '||current_setting('app.cron_secret')))$$);
select cron.schedule('ingest-careers','*/30 * * * *', …'/ingest-careers'…);
select cron.schedule('news-hot','0 * * * *',          …'/ingest-news'…);      -- Google News for Hot/priority accounts
select cron.schedule('session-flush','*/5 * * * *',   …'/flush-visits'…);     -- IS-01 ≤15min
select cron.schedule('gmail-sync','*/7 * * * *',      …'/gmail-sync'…);
select cron.schedule('followups','*/10 * * * *',      …'/followup-scan'…);
select cron.schedule('digest-hourly','0 * * * *',     …'/digest-send'…);      -- tz-filtered 7–9am (SA-07 template)
select cron.schedule('weekly-suggest','0 6 * * 1',    …'/suggest-accounts'…); -- AD-04
```

## 7. Seed & fixtures
Migration `0009_seed.sql`: insert `sources` registry rows (05 §4 table verbatim) + demo workspace fixtures for local dev (3 accounts, 6 signals across types, 1 stacked group) so every screen renders with data on first `supabase db reset`.
