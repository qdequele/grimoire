-- Player companion: create an investigator from a table link, and push live changes to every screen.

-- A table link (not a personal one) lets its holder create an investigator that joins the game.
-- The caller never chooses ids or owner. Errors: link_invalid, not_in_game, bad_value, party_full.
create function public.companion_create_character(p_token text, p_data jsonb, p_player_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_link public.table_links := public.companion_link(p_token);
  v_player_name text := btrim(coalesce(p_player_name, ''));
  v_player uuid;
  v_id uuid;
  v_channel uuid;
  v_key text;
begin
  if v_link.character_id is not null then
    raise exception 'not_in_game';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object'
     or jsonb_typeof(p_data -> 'name') is distinct from 'string' or btrim(p_data ->> 'name') = ''
     or char_length(v_player_name) > 80 then
    raise exception 'bad_value';
  end if;

  -- Points on the sheet, when present, are whole numbers in 0..99 (set_points casts them later).
  foreach v_key in array array['hp', 'san', 'luck', 'mp'] loop
    if p_data ? v_key and (
      jsonb_typeof(p_data -> v_key) is distinct from 'number'
      or (p_data ->> v_key)::numeric <> trunc((p_data ->> v_key)::numeric)
      or (p_data ->> v_key)::numeric not between 0 and 99
    ) then
      raise exception 'bad_value';
    end if;
  end loop;

  -- Serialise concurrent creations on the same game.
  select g.channel into v_channel from public.games g
  where g.id = v_link.game_id and g.owner_id = v_link.owner_id for update;
  if not found then
    raise exception 'link_invalid';
  end if;

  if (select count(*) from public.companion_party(v_link.game_id)) >= 12 then
    raise exception 'party_full';
  end if;

  if v_player_name <> '' then
    select p.id into v_player from public.players p
    where p.owner_id = v_link.owner_id and lower(btrim(p.name)) = lower(v_player_name);
    if v_player is null then
      insert into public.players (owner_id, name) values (v_link.owner_id, v_player_name)
      returning id into v_player;
    end if;
  end if;

  insert into public.characters (owner_id, data, player_id)
  values (v_link.owner_id, p_data, v_player)
  returning id into v_id;

  update public.games
  set state = jsonb_set(
    state, '{party}',
    (case when jsonb_typeof(state -> 'party') = 'array' then state -> 'party' else '[]'::jsonb end)
      || jsonb_build_array(jsonb_build_object('characterId', v_id)),
    true)
  where id = v_link.game_id and owner_id = v_link.owner_id;

  -- Starting points from the sheet (same keys as toLegacyCharacter), defaults 10 / 50 / 50 / 10.
  insert into public.game_points (game_id, character_id, owner_id, pv, san, chance, pm, source)
  values (
    v_link.game_id, v_id, v_link.owner_id,
    coalesce((p_data ->> 'hp')::int, 10),
    coalesce((p_data ->> 'san')::int, 50),
    coalesce((p_data ->> 'luck')::int, 50),
    coalesce((p_data ->> 'mp')::int, 10),
    'phone'
  );

  perform public.companion_broadcast(v_channel, 'member', jsonb_build_object('characterId', v_id));
  return v_id;
end;
$$;

-- Sends on the game's public, unguessable topic. Broadcasting must never make a write fail. Internal.
create function public.companion_broadcast(p_channel uuid, p_event text, p_payload jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(p_payload, p_event, 'companion:' || p_channel::text, false);
exception when others then
  raise warning 'companion broadcast failed: %', sqlerrm;
end;
$$;

create function public.companion_points_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_channel uuid;
begin
  select g.channel into v_channel from public.games g where g.id = new.game_id;
  if v_channel is not null then
    perform public.companion_broadcast(v_channel, 'points', jsonb_build_object(
      'characterId', new.character_id,
      'pv', new.pv,
      'san', new.san,
      'chance', new.chance,
      'pm', new.pm,
      'checks', to_jsonb(new.checks),
      'source', new.source,
      'updatedAt', new.updated_at
    ));
  end if;
  return null;
end;
$$;

create function public.companion_notes_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_character uuid := case when tg_op = 'DELETE' then old.character_id else new.character_id end;
  v_game record;
begin
  for v_game in
    select g.channel from public.games g
    where g.finished_at is null
      and g.owner_id = coalesce(new.owner_id, old.owner_id)
      and jsonb_typeof(g.state -> 'party') = 'array'
      and g.state -> 'party' @> jsonb_build_array(jsonb_build_object('characterId', v_character))
  loop
    perform public.companion_broadcast(v_game.channel, 'notes', jsonb_build_object('characterId', v_character));
  end loop;
  return null;
end;
$$;

create trigger game_points_broadcast after insert or update on public.game_points
  for each row execute function public.companion_points_changed();
create trigger character_notes_broadcast after insert or update or delete on public.character_notes
  for each row execute function public.companion_notes_changed();

revoke execute on function public.companion_create_character(text, jsonb, text) from public;
revoke execute on function public.companion_broadcast(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.companion_points_changed() from public, anon, authenticated;
revoke execute on function public.companion_notes_changed() from public, anon, authenticated;
grant execute on function public.companion_create_character(text, jsonb, text) to anon, authenticated;
