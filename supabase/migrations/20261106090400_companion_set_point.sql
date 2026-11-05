-- Player companion: set one point (HP, SAN, Luck or MP) from a phone.
-- companion_set_points writes all four values, so a queued phone tap could undo a keeper change made
-- in the meantime (keeper damage overwritten by the HP the phone held at tap time). This one writes
-- only the field the player tapped. Errors: link_invalid, not_in_game, bad_value.

create function public.companion_set_point(p_token text, p_character uuid, p_field text, p_value int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_link public.table_links := public.companion_link(p_token);
  v_data jsonb;
  v_max int;
begin
  if p_character is null
     or (v_link.character_id is not null and v_link.character_id <> p_character)
     or not exists (select 1 from public.companion_party(v_link.game_id) as id where id = p_character) then
    raise exception 'not_in_game';
  end if;

  select c.data into v_data from public.characters c where c.id = p_character and c.owner_id = v_link.owner_id;
  v_max := case when p_field = 'pv' then coalesce((v_data ->> 'hp')::int, 10) else 99 end;
  if p_field is null or p_field not in ('pv', 'san', 'chance', 'pm')
     or p_value is null or p_value not between 0 and v_max then
    raise exception 'bad_value';
  end if;

  -- No row yet: the other values start from the sheet (same defaults as the game screen; current SAN
  -- from the progression when there is one, as the companion shows it).
  insert into public.game_points (game_id, character_id, owner_id, pv, san, chance, pm, source, updated_at)
  values (
    v_link.game_id, p_character, v_link.owner_id,
    case when p_field = 'pv' then p_value else coalesce((v_data ->> 'hp')::int, 10) end,
    case when p_field = 'san' then p_value
         else coalesce((v_data #>> '{progress,san}')::int, (v_data ->> 'san')::int, 50) end,
    case when p_field = 'chance' then p_value else coalesce((v_data ->> 'luck')::int, 50) end,
    case when p_field = 'pm' then p_value else coalesce((v_data ->> 'mp')::int, 10) end,
    'phone', now()
  )
  on conflict (game_id, character_id) do update
    set pv = case when p_field = 'pv' then p_value else public.game_points.pv end,
        san = case when p_field = 'san' then p_value else public.game_points.san end,
        chance = case when p_field = 'chance' then p_value else public.game_points.chance end,
        pm = case when p_field = 'pm' then p_value else public.game_points.pm end,
        source = 'phone', updated_at = now();

  -- Current SAN lives in the investigator's progression once it exists.
  if p_field = 'san' then
    update public.characters
    set data = jsonb_set(data, '{progress,san}', to_jsonb(p_value))
    where id = p_character and owner_id = v_link.owner_id
      and jsonb_typeof(data -> 'progress') = 'object';
  end if;
end;
$$;

revoke execute on function public.companion_set_point(text, uuid, text, int) from public;
grant execute on function public.companion_set_point(text, uuid, text, int) to anon, authenticated;
