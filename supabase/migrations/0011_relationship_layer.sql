-- 0011 · Relationship intelligence layer — the personal-network USP.
-- Founder's own connections + personal moments (birthdays, new baby, new
-- home, job changes…). Workspace-scoped PERSONAL data: never global, never
-- used for enrichment of other tenants (privacy invariant I-1).

create table connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,   -- whose network this is
  full_name text not null,
  emails text[] not null default '{}',
  phones text[] not null default '{}',
  company_domain text,                                    -- canonical lowercase, matches companies.domain for intro paths
  company_name text,
  title text,
  linkedin_url text,
  source text not null default 'manual' check (source in
    ('gmail_import','phone_import','linkedin_export','csv_import','manual')),
  closeness int not null default 50 check (closeness between 0 and 100),
  last_interaction_at timestamptz,
  interaction_count int not null default 0,
  birthday date,                                          -- year may be 1900 when unknown
  tags text[] not null default '{}',                      -- 'decision_maker','friend','investor','ex_colleague','champion'
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_connections_ws_owner on connections (workspace_id, owner_id);
create index idx_connections_domain on connections (workspace_id, company_domain);
create index idx_connections_birthday on connections (workspace_id) where birthday is not null;

create table personal_signals (                           -- "moments": human reasons to reach out
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  connection_id uuid not null references connections(id) on delete cascade,
  type text not null check (type in (
    'birthday','job_change','promotion','work_anniversary','new_baby','new_home',
    'wedding','award','speaking','published','company_milestone','education')),
  title text not null,
  detail text not null default '',
  source text not null default 'manual',                  -- 'linkedin_clip','news','birthday_calendar','manual'
  source_url text,
  occurred_at timestamptz not null,
  detected_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new','acted','dismissed')),
  created_at timestamptz not null default now()
);
create index idx_personal_ws_status on personal_signals (workspace_id, status, occurred_at desc);
create index idx_personal_connection on personal_signals (workspace_id, connection_id);

alter table connections enable row level security;
alter table personal_signals enable row level security;

create policy p_connections_member on connections for all
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy p_personal_member on personal_signals for all
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));

create trigger t_touch_connections before update on connections
  for each row execute function private.touch_updated_at();
