-- 0009 · Seed — docs/04 §7: sources registry (docs/05 §4, 17 launch rows) +
-- demo fixtures so every screen renders with data on first db reset.

insert into sources (key, kind, config, cadence_minutes) values
  ('techcrunch_rss',      'rss',     '{"urls":["https://techcrunch.com/feed/","https://techcrunch.com/category/venture/feed/"]}', 15),
  ('finsmes_rss',         'rss',     '{"urls":["https://www.finsmes.com/feed"]}', 15),
  ('eu_startups_rss',     'rss',     '{"urls":["https://www.eu-startups.com/feed/"]}', 15),
  ('prnewswire_rss',      'rss',     '{"topic":"financing,personnel"}', 15),
  ('businesswire_rss',    'rss',     '{"topic":"financing,personnel"}', 15),
  ('edgar_form_d',        'api',     '{"endpoint":"https://efts.sec.gov/LATEST/search-index?q=","ua_required":true}', 120),
  ('google_news_account', 'rss',     '{"template":"https://news.google.com/rss/search?q=\"{name}\" (funding OR raised OR appoints OR launches OR expands) when:7d","daily_cap":600}', 60),
  ('greenhouse_boards',   'api',     '{"endpoint":"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs"}', 30),
  ('lever_postings',      'api',     '{"endpoint":"https://api.lever.co/v0/postings/{slug}"}', 30),
  ('ashby_boards',        'api',     '{"endpoint":"https://api.ashbyhq.com/posting-api/job-board/{slug}"}', 30),
  ('workable_widget',     'api',     '{"endpoint":"https://apply.workable.com/api/v1/widget/accounts/{slug}"}', 30),
  ('careers_diff',        'crawl',   '{"runner":"github_actions"}', 1440),
  ('tech_detect',         'crawl',   '{"runner":"github_actions","ruleset":"webappanalyzer"}', 1440),
  ('producthunt_gql',     'api',     '{"endpoint":"https://api.producthunt.com/v2/api/graphql"}', 360),
  ('github_events',       'api',     '{"endpoint":"https://api.github.com"}', 360),
  ('champion_news',       'rss',     '{"template":"https://news.google.com/rss/search?q=\"{full_name}\" (joins OR appointed OR \"has joined\")"}', 360),
  ('pixel',               'webhook', '{"route":"/api/px"}', 0),
  ('rb2b',                'webhook', '{"route":"/api/webhooks/rb2b"}', 0),
  ('clipper',             'user',    '{"route":"/api/clip"}', 0)
on conflict (key) do nothing;

-- Local-dev demo fixtures (3 accounts, 6 signals across types, 1 stacked group).
-- Guarded: only inserts when a demo workspace does not already exist.
do $$
declare
  ws uuid; owner_id uuid;
  c_acme uuid; c_lumenly uuid; c_basalt uuid;
  a_acme uuid; a_lumenly uuid; a_basalt uuid;
  s1 uuid; s2 uuid; s3 uuid; s4 uuid; s5 uuid; s6 uuid;
  stack uuid := gen_random_uuid();
begin
  if exists (select 1 from workspaces where name = 'Demo Workspace') then return; end if;
  select id into owner_id from auth.users limit 1;
  if owner_id is null then return; end if;   -- fixtures need at least one auth user

  insert into profiles (id, full_name) values (owner_id, 'Demo Founder')
    on conflict (id) do nothing;
  insert into workspaces (name, domain, product_one_liner, icp)
    values ('Demo Workspace', 'truesignall.com',
            'Signal AI watches your target accounts 24/7 and turns buying signals into voice-matched outreach.',
            '{"industries":["b2b saas","sales tech"],"company_sizes":["11-50","51-200"],"stages":["seed","series_a"],"geos":["US","EU"],"pain_points":["missed buying signals on target accounts"]}')
    returning id into ws;
  insert into workspace_members (workspace_id, user_id, role) values (ws, owner_id, 'owner');

  insert into companies (domain, name, description, industry, employee_range, stage, hq_country, tech_stack, source)
    values ('acme.io', 'Acme Corp', 'Revenue operations platform', 'sales tech', '51-200', 'series_a', 'US', '{salesforce,segment}', 'user_import')
    returning id into c_acme;
  insert into companies (domain, name, description, industry, employee_range, stage, hq_country, tech_stack, source)
    values ('lumenly.com', 'Lumenly', 'Customer analytics for PLG SaaS', 'b2b saas', '11-50', 'seed', 'US', '{hubspot,gcp}', 'user_import')
    returning id into c_lumenly;
  insert into companies (domain, name, description, industry, employee_range, stage, hq_country, tech_stack, source)
    values ('basaltlabs.com', 'Basalt Labs', 'API infrastructure for fintech', 'fintech', '11-50', 'seed', 'UK', '{stripe,aws}', 'user_import')
    returning id into c_basalt;

  insert into accounts (workspace_id, company_id, fit_score, stage) values (ws, c_acme, 86, 'identified') returning id into a_acme;
  insert into accounts (workspace_id, company_id, fit_score, stage) values (ws, c_lumenly, 82, 'contacted') returning id into a_lumenly;
  insert into accounts (workspace_id, company_id, fit_score, stage) values (ws, c_basalt, 74, 'identified') returning id into a_basalt;

  insert into signals (company_id, type, title, payload, source, source_url, occurred_at, dedup_hash)
    values (c_acme, 'funding', 'Raised $12M Series A led by Foundry',
            '{"round":"Series A","amount_usd":12000000,"lead":"Foundry"}',
            'techcrunch_rss', 'https://techcrunch.com/acme-series-a', now() - interval '4 hours', 'seed-hash-1')
    returning id into s1;
  insert into signals (company_id, type, title, payload, source, source_url, occurred_at, dedup_hash)
    values (c_acme, 'hiring', 'Hiring Head of Sales Ops',
            '{"job_title":"Head of Sales Operations","board":"greenhouse","job_url":"https://boards.greenhouse.io/acme/jobs/100","inferred_category":"crm_revops","confidence":"high"}',
            'greenhouse_boards', 'https://boards.greenhouse.io/acme/jobs/100', now() - interval '26 hours', 'seed-hash-2')
    returning id into s2;
  insert into signals (company_id, type, title, payload, source, source_url, occurred_at, dedup_hash)
    values (c_acme, 'pricing_visit', 'Visited your pricing page twice this week',
            '{"paths":["/pricing"],"visits_7d":2,"repeat_evaluator":false}',
            'pixel', null, now() - interval '18 hours', 'seed-hash-3')
    returning id into s3;
  insert into signals (company_id, type, title, payload, source, source_url, occurred_at, dedup_hash)
    values (c_lumenly, 'exec_change', 'Sarah Kim joined as CTO',
            '{"person_name":"Sarah Kim","new_title":"CTO","evidence":"press release"}',
            'prnewswire_rss', 'https://prnewswire.com/lumenly-cto', now() - interval '9 hours', 'seed-hash-4')
    returning id into s4;
  insert into signals (company_id, type, title, payload, source, source_url, occurred_at, dedup_hash)
    values (c_basalt, 'hiring', 'Hiring 3 SDRs in London',
            '{"job_title":"Sales Development Representative","board":"lever","job_url":"https://jobs.lever.co/basalt/sdr","inferred_category":"sales_engagement","confidence":"high"}',
            'lever_postings', 'https://jobs.lever.co/basalt/sdr', now() - interval '30 hours', 'seed-hash-5')
    returning id into s5;
  insert into signals (company_id, type, title, payload, source, source_url, occurred_at, dedup_hash)
    values (c_basalt, 'news', 'Named in fintech infrastructure roundup',
            '{"headline":"Fintech infra roundup","publisher":"Finsmes"}',
            'finsmes_rss', 'https://finsmes.com/roundup', now() - interval '4 days', 'seed-hash-6')
    returning id into s6;

  -- stacked group on Acme (3 signals inside 72h)
  insert into signal_deliveries (workspace_id, account_id, signal_id, urgency, stack_group_id) values
    (ws, a_acme, s1, 84, stack),
    (ws, a_acme, s2, 71, stack),
    (ws, a_acme, s3, 76, stack),
    (ws, a_lumenly, s4, 62, null),
    (ws, a_basalt, s5, 48, null),
    (ws, a_basalt, s6, 21, null);
end $$;
