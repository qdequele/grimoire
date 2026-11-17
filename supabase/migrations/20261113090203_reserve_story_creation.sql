-- Story creator: a new creation is now RESERVED before its first outline is asked of Claude.
-- create-story used to count the month's creations, call Claude, then insert the row: parallel
-- requests all read the same count and all passed STORY_CREATE_MONTHLY_LIMIT.
--
-- reserve_story_creation takes a lock per owner, counts the owner's creations made in the app
-- (source 'web': the MCP connector's have their own limit) since p_since, and inserts the row
-- (brief, outline_count 1, no outline yet) only when the count is under p_limit. It returns the
-- new row's id, or null when the limit is reached. p_limit null = no limit (admins).
--
-- Service role only (Edge Functions). Additive and re-runnable.
create or replace function public.reserve_story_creation(p_owner uuid, p_brief jsonb, p_since timestamptz, p_limit integer default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- One reservation at a time per keeper, until this transaction ends.
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text || ':story-creation', 0));
  if p_limit is not null and (
    select count(*) from public.story_creations where owner_id = p_owner and source = 'web' and created_at >= p_since
  ) >= p_limit then
    return null;
  end if;
  insert into public.story_creations (owner_id, brief, source, outline_count)
  values (p_owner, p_brief, 'web', 1)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.reserve_story_creation(uuid, jsonb, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.reserve_story_creation(uuid, jsonb, timestamptz, integer) to service_role;
