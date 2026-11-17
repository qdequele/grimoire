-- AI limits counted in ai_usage: the row is now reserved BEFORE the Claude call, atomically.
-- The functions used to count, call Claude, then insert: parallel requests all read the same count
-- and all passed, and a call that failed or was stopped was never counted.
--
-- reserve_ai_usage takes a lock per (owner, kind), counts the rows since p_since and inserts one
-- only when the count is under p_limit. It returns the new row's id, or null when the limit is
-- reached. p_limit null = no limit (admins): the row is still written. The caller writes the
-- tokens on that row after the call.
--
-- Service role only (Edge Functions). Re-runnable.
create or replace function public.reserve_ai_usage(p_owner uuid, p_kind text, p_since timestamptz, p_limit integer default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- One reservation at a time per keeper and kind, until this transaction ends.
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text || ':' || p_kind, 0));
  if p_limit is not null and (
    select count(*) from public.ai_usage where owner_id = p_owner and kind = p_kind and created_at >= p_since
  ) >= p_limit then
    return null;
  end if;
  insert into public.ai_usage (owner_id, kind) values (p_owner, p_kind) returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.reserve_ai_usage(uuid, text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(uuid, text, timestamptz, integer) to service_role;
