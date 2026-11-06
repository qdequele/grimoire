-- Player companion: the only way visitors without an account touch data.
-- Every function is security definer and starts from a link token. Errors are raised as codes
-- (`link_invalid`, `not_in_game`, `bad_value`) that the app maps to messages.
-- Postgres grants EXECUTE to PUBLIC by default: each function revokes it, then grants explicitly.

-- Active link (not revoked, game still exists), else link_invalid. Internal.
create function public.companion_link(p_token text) returns public.table_links
language plpgsql security definer stable set search_path = '' as $$
declare
  v_link public.table_links;
begin
  select l.* into v_link
  from public.table_links l
  join public.games g on g.id = l.game_id and g.owner_id = l.owner_id
  where l.token = p_token and l.revoked_at is null;
  if not found then
    raise exception 'link_invalid';
  end if;
  return v_link;
end;
$$;

-- Characters of the game's party (state.party[*].characterId) that still exist and belong to the game's owner,
-- in party order. Internal.
create function public.companion_party(p_game uuid) returns setof uuid
language sql security definer stable set search_path = '' as $$
  select c.id
  from public.games g
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(g.state -> 'party') = 'array' then g.state -> 'party' else '[]'::jsonb end
  ) with ordinality as m(member, pos)
  join public.characters c
    on c.owner_id = g.owner_id
   and c.id::text = m.member ->> 'characterId'
  where g.id = p_game
  group by c.id
  order by min(m.pos);
$$;

-- Game owner for an active link. Service role only (Edge Functions).
create function public.companion_owner(p_token text) returns uuid
language plpgsql security definer stable set search_path = '' as $$
begin
  return (public.companion_link(p_token)).owner_id;
end;
$$;

create function public.companion_open(p_token text) returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare
  v_link public.table_links := public.companion_link(p_token);
  v_result jsonb;
begin
  select jsonb_build_object(
    'game', jsonb_build_object(
      'id', g.id,
      'channel', g.channel,
      'title', s.content -> 'meta' ->> 'title'
    ),
    'focus', v_link.character_id,
    'canCreate', v_link.character_id is null,
    'party', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'data', c.data - 'creation',
        'player', p.name
      ) order by m.pos)
      from (select id, row_number() over () as pos from public.companion_party(g.id) as id) m
      join public.characters c on c.id = m.id
      left join public.players p on p.id = c.player_id and p.owner_id = c.owner_id
    ), '[]'::jsonb),
    'points', coalesce((
      select jsonb_agg(jsonb_build_object(
        'characterId', gp.character_id,
        'pv', gp.pv,
        'san', gp.san,
        'chance', gp.chance,
        'pm', gp.pm,
        'checks', to_jsonb(gp.checks),
        'source', gp.source,
        'updatedAt', gp.updated_at
      ))
      from public.game_points gp
      where gp.game_id = g.id and gp.owner_id = g.owner_id
        and gp.character_id in (select public.companion_party(g.id))
    ), '[]'::jsonb),
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id,
        'characterId', n.character_id,
        'body', n.body,
        'createdAt', n.created_at
      ) order by n.created_at desc)
      from public.character_notes n
      where n.owner_id = g.owner_id
        and n.character_id in (select public.companion_party(g.id))
    ), '[]'::jsonb)
  ) into v_result
  from public.games g
  join public.stories s on s.id = g.story_id
  where g.id = v_link.game_id;
  return v_result;
end;
$$;

-- The character must be in the party and, for a personal link, be the link's investigator.
create function public.companion_set_points(
  p_token text, p_character uuid, p_pv int, p_san int, p_chance int, p_pm int
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_link public.table_links := public.companion_link(p_token);
  v_max_hp int;
begin
  if p_character is null
     or (v_link.character_id is not null and v_link.character_id <> p_character)
     or not exists (select 1 from public.companion_party(v_link.game_id) as id where id = p_character) then
    raise exception 'not_in_game';
  end if;

  select coalesce((c.data ->> 'hp')::int, 10) into v_max_hp
  from public.characters c where c.id = p_character and c.owner_id = v_link.owner_id;

  if p_pv is null or p_san is null or p_chance is null or p_pm is null
     or p_pv not between 0 and v_max_hp
     or p_san not between 0 and 99
     or p_chance not between 0 and 99
     or p_pm not between 0 and 99 then
    raise exception 'bad_value';
  end if;

  insert into public.game_points (game_id, character_id, owner_id, pv, san, chance, pm, source, updated_at)
  values (v_link.game_id, p_character, v_link.owner_id, p_pv, p_san, p_chance, p_pm, 'phone', now())
  on conflict (game_id, character_id) do update
    set pv = excluded.pv, san = excluded.san, chance = excluded.chance, pm = excluded.pm,
        source = 'phone', updated_at = now();

  -- Current SAN lives in the investigator's progression once it exists.
  update public.characters
  set data = jsonb_set(data, '{progress,san}', to_jsonb(p_san))
  where id = p_character and owner_id = v_link.owner_id
    and jsonb_typeof(data -> 'progress') = 'object';
end;
$$;

create function public.companion_add_note(p_token text, p_character uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_link public.table_links := public.companion_link(p_token);
  v_id uuid;
begin
  if p_character is null
     or (v_link.character_id is not null and v_link.character_id <> p_character)
     or not exists (select 1 from public.companion_party(v_link.game_id) as id where id = p_character) then
    raise exception 'not_in_game';
  end if;
  if p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then
    raise exception 'bad_value';
  end if;
  insert into public.character_notes (owner_id, character_id, body)
  values (v_link.owner_id, p_character, p_body)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.companion_link(text) from public, anon, authenticated;
revoke execute on function public.companion_party(uuid) from public, anon, authenticated;
revoke execute on function public.companion_owner(text) from public, anon, authenticated;
revoke execute on function public.companion_open(text) from public;
revoke execute on function public.companion_set_points(text, uuid, int, int, int, int) from public;
revoke execute on function public.companion_add_note(text, uuid, text) from public;
grant execute on function public.companion_open(text) to anon, authenticated;
grant execute on function public.companion_set_points(text, uuid, int, int, int, int) to anon, authenticated;
grant execute on function public.companion_add_note(text, uuid, text) to anon, authenticated;
grant execute on function public.companion_owner(text) to service_role;
