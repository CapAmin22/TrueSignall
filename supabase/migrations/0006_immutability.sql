-- 0006 · Signals immutability guard — docs/04 §5.
-- Signals are immutable; only why_line may be filled, via a security-definer fn.

create or replace function private.block_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'signals are immutable (docs/05 principle 5)';
end $$;

create trigger t_signals_immutable
  before update or delete on signals
  for each row execute function private.block_mutation();

create or replace function private.set_why_line(sig uuid, line text) returns void
language plpgsql security definer set search_path = public as $$
begin
  alter table signals disable trigger t_signals_immutable;
  update signals set why_line = line where id = sig and why_line is null;
  alter table signals enable trigger t_signals_immutable;
end $$;

revoke all on function private.set_why_line(uuid, text) from public;
