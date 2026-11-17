-- The game screen saves an investigator's progression from play (characters.data.progress). It used
-- to send the whole sheet it read when the game started, so a correction made since (the wizard in
-- another tab, or the MCP connector's save_investigator) was reverted by the next save. This writes
-- the progress key only, on the server, and leaves the rest of the sheet as it is now.
--
-- Security invoker: the keeper's own RLS on characters applies (owner rows only), so it can do
-- nothing the keeper's session can't already do with a plain update.
create or replace function public.save_character_progress(p_character uuid, p_progress jsonb)
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if p_progress is null or jsonb_typeof(p_progress) <> 'object' then
    raise exception 'bad_value' using errcode = '22023';
  end if;
  update public.characters
    set data = coalesce(data, '{}'::jsonb) || jsonb_build_object('progress', p_progress)
    where id = p_character;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.save_character_progress(uuid, jsonb) from public, anon;
grant execute on function public.save_character_progress(uuid, jsonb) to authenticated;
