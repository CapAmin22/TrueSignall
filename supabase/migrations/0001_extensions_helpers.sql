-- 0001 · Extensions, schemas, helpers — docs/04 §1
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
