-- 0003 · Global corpus (service-role writes; firmographic/public data ONLY) — docs/04 §3
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
  payload jsonb not null default '{}'::jsonb,             -- type-specific fields, contracts in 05 §1
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

create trigger t_touch_companies before update on companies
  for each row execute function private.touch_updated_at();
