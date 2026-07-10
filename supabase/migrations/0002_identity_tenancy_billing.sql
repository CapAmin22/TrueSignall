-- 0002 · Identity, tenancy, billing — docs/04 §2
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

create trigger t_touch_profiles before update on profiles
  for each row execute function private.touch_updated_at();
create trigger t_touch_workspaces before update on workspaces
  for each row execute function private.touch_updated_at();
