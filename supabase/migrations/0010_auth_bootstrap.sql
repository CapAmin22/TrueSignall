-- 0010 · Auth bootstrap — mirror new auth.users into profiles automatically so
-- OAuth sign-ins always have a profile row (FK target for workspace_members).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists t_handle_new_user on auth.users;
create trigger t_handle_new_user
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Backfill any users created before this trigger existed.
insert into public.profiles (id, full_name, avatar_url)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
  u.raw_user_meta_data->>'avatar_url'
from auth.users u
on conflict (id) do nothing;
