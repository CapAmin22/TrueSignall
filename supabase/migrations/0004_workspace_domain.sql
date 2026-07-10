-- 0004 · Workspace domain tables — docs/04 §4
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
  urgency_explain jsonb,                                  -- ring tooltip payload (05 §7)
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
  angle text default 'signal', cta_variant text,
  sections jsonb not null,                                -- {subject,opening,value_prop,cta,signoff}
  signal_refs uuid[] not null default '{}',
  quality jsonb,                                          -- {score,subscores,flags[]} (06 §6)
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

create trigger t_touch_accounts before update on accounts
  for each row execute function private.touch_updated_at();
create trigger t_touch_contacts before update on contacts
  for each row execute function private.touch_updated_at();
create trigger t_touch_drafts before update on outreach_drafts
  for each row execute function private.touch_updated_at();
