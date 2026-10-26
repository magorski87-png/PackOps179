-- Read-only database liveness endpoint; exposes only database time.
-- No SECURITY DEFINER, table grants, user records, or writes are needed.
create or replace function public.packops_heartbeat()
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
 select jsonb_build_object('ok', true, 'checked_at', statement_timestamp());
$$;
revoke all on function public.packops_heartbeat() from public;
grant execute on function public.packops_heartbeat() to anon, authenticated;
comment on function public.packops_heartbeat() is
 'Read-only liveness probe. Returns database time only; no access to Pack records.';
