-- Player companion hardening (final review of the branch).
-- 1. companion_create_character checks every field of the sheet a phone sends: the keeper's game
--    screen shows these values, so nothing but the expected shapes may reach the account.
-- 2. companion_set_point reads the sheet's numbers without casts that can fail.
-- 3. revoke_table_link tells the devices on the old topic that the channel moved.
-- 4. companion_set_points (whole-row write, replaced by companion_set_point) is dropped.

-- A whole number within p_lo..p_hi (5.0 counts as 5), else bad_value. The type is checked before
-- any cast. Internal.
create function public.companion_int(p jsonb, p_lo int, p_hi int) returns int
language plpgsql immutable set search_path = '' as $$
declare
  v numeric;
begin
  if p is null or jsonb_typeof(p) is distinct from 'number' then
    raise exception 'bad_value';
  end if;
  v := (p #>> '{}')::numeric;
  if v <> trunc(v) or v < p_lo or v > p_hi then
    raise exception 'bad_value';
  end if;
  return v::int;
end;
$$;

-- A string of at most p_max characters, else bad_value. Internal.
create function public.companion_text(p jsonb, p_max int) returns text
language plpgsql immutable set search_path = '' as $$
begin
  if p is null or jsonb_typeof(p) is distinct from 'string' or char_length(p #>> '{}') > p_max then
    raise exception 'bad_value';
  end if;
  return p #>> '{}';
end;
$$;

-- The sheet a phone sends, checked and rebuilt key by key (CharacterData in src/characters/character.ts).
-- Unknown keys are refused; `progress` belongs to the keeper's games and is dropped. Internal.
create function public.companion_clean_character(p_data jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v_out jsonb := '{}'::jsonb;
  v_key text;
  v_val jsonb;
  v_sub jsonb;
  k text;
  v jsonb;
  v_name text;
begin
  if p_data is null or jsonb_typeof(p_data) is distinct from 'object' or pg_column_size(p_data) >= 65536 then
    raise exception 'bad_value';
  end if;

  for v_key, v_val in select e.key, e.value from jsonb_each(p_data) e loop
    case v_key
      when 'progress' then
        null;
      when 'name' then
        v_name := btrim(public.companion_text(v_val, 200));
        if char_length(v_name) not between 1 and 80 then
          raise exception 'bad_value';
        end if;
        v_out := v_out || jsonb_build_object('name', v_name);
      when 'occupation', 'link' then
        v_out := v_out || jsonb_build_object(v_key, public.companion_text(v_val, 200));
      when 'age' then
        v_out := v_out || jsonb_build_object(v_key, public.companion_int(v_val, 0, 150));
      when 'hp', 'mp', 'san', 'luck' then
        v_out := v_out || jsonb_build_object(v_key, public.companion_int(v_val, 0, 99));
      when 'move', 'build' then
        v_out := v_out || jsonb_build_object(v_key, public.companion_int(v_val, -10, 20));
      when 'damageBonus' then
        if public.companion_text(v_val, 12) !~ '^[-+0-9dD ]{0,12}$' then
          raise exception 'bad_value';
        end if;
        v_out := v_out || jsonb_build_object(v_key, v_val);
      when 'characteristics' then
        if jsonb_typeof(v_val) is distinct from 'object' then
          raise exception 'bad_value';
        end if;
        v_sub := '{}'::jsonb;
        for k, v in select e.key, e.value from jsonb_each(v_val) e loop
          if k not in ('STR', 'CON', 'SIZ', 'DEX', 'APP', 'INT', 'POW', 'EDU') then
            raise exception 'bad_value';
          end if;
          v_sub := v_sub || jsonb_build_object(k, public.companion_int(v, 0, 99));
        end loop;
        v_out := v_out || jsonb_build_object(v_key, v_sub);
      when 'skills' then
        if jsonb_typeof(v_val) is distinct from 'object' or (select count(*) from jsonb_object_keys(v_val)) > 100 then
          raise exception 'bad_value';
        end if;
        v_sub := '{}'::jsonb;
        for k, v in select e.key, e.value from jsonb_each(v_val) e loop
          if char_length(k) not between 1 and 80 then
            raise exception 'bad_value';
          end if;
          v_sub := v_sub || jsonb_build_object(k, public.companion_int(v, 0, 99));
        end loop;
        v_out := v_out || jsonb_build_object(v_key, v_sub);
      when 'profile' then
        if jsonb_typeof(v_val) is distinct from 'object' then
          raise exception 'bad_value';
        end if;
        v_sub := '{}'::jsonb;
        for k, v in select e.key, e.value from jsonb_each(v_val) e loop
          if char_length(k) not between 1 and 40 then
            raise exception 'bad_value';
          end if;
          v_sub := v_sub || jsonb_build_object(k, public.companion_text(v, 2000));
        end loop;
        v_out := v_out || jsonb_build_object(v_key, v_sub);
      when 'creation' then
        -- The wizard's own state, so the keeper can reopen it; the app reads it defensively.
        if jsonb_typeof(v_val) is distinct from 'object' then
          raise exception 'bad_value';
        end if;
        v_out := v_out || jsonb_build_object(v_key, v_val);
      else
        raise exception 'bad_value';
    end case;
  end loop;

  if not v_out ? 'name' then
    raise exception 'bad_value';
  end if;
  return v_out;
end;
$$;

-- A number on a stored sheet, rounded down, or the default when absent or not a number. Internal.
create function public.companion_sheet_int(p jsonb, p_default int) returns int
language plpgsql immutable set search_path = '' as $$
begin
  -- plpgsql IF, not a SQL CASE: the planner may fold a CASE branch (and its cast) ahead of the test.
  if jsonb_typeof(p) is distinct from 'number' then
    return p_default;
  end if;
  return least(greatest(floor((p #>> '{}')::numeric), -2147483648), 2147483647)::int;
end;
$$;

-- A table link (not a personal one) lets its holder create an investigator that joins the game.
-- The caller never chooses ids or owner. Errors: link_invalid, not_in_game, bad_value, party_full.
create or replace function public.companion_create_character(p_token text, p_data jsonb, p_player_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_link public.table_links := public.companion_link(p_token);
  v_player_name text := btrim(coalesce(p_player_name, ''));
  v_data jsonb;
  v_player uuid;
  v_id uuid;
  v_channel uuid;
begin
  if v_link.character_id is not null then
    raise exception 'not_in_game';
  end if;
  if char_length(v_player_name) > 80 then
    raise exception 'bad_value';
  end if;
  v_data := public.companion_clean_character(p_data);

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
    where p.owner_id = v_link.owner_id and lower(btrim(p.name)) = lower(v_player_name)
    limit 1;
    if v_player is null then
      insert into public.players (owner_id, name) values (v_link.owner_id, v_player_name)
      returning id into v_player;
    end if;
  end if;

  insert into public.characters (owner_id, data, player_id)
  values (v_link.owner_id, v_data, v_player)
  returning id into v_id;

  update public.games
  set state = jsonb_set(
    state, '{party}',
    (case when jsonb_typeof(state -> 'party') = 'array' then state -> 'party' else '[]'::jsonb end)
      || jsonb_build_array(jsonb_build_object('characterId', v_id)),
    true)
  where id = v_link.game_id and owner_id = v_link.owner_id;

  -- Starting points from the sheet (same keys as toLegacyCharacter), defaults 10 / 50 / 50 / 10.
  -- v_data holds whole numbers only (companion_clean_character).
  insert into public.game_points (game_id, character_id, owner_id, pv, san, chance, pm, source)
  values (
    v_link.game_id, v_id, v_link.owner_id,
    public.companion_sheet_int(v_data -> 'hp', 10),
    public.companion_sheet_int(v_data -> 'san', 50),
    public.companion_sheet_int(v_data -> 'luck', 50),
    public.companion_sheet_int(v_data -> 'mp', 10),
    'phone'
  );

  perform public.companion_broadcast(v_channel, 'member', jsonb_build_object('characterId', v_id));
  return v_id;
end;
$$;

-- Set one point (HP, SAN, Luck or MP) from a phone; see 20261106090400. Same behaviour, with reads of
-- the sheet that can't fail on a sheet the keeper edited by hand (hp "12", 11.5…).
create or replace function public.companion_set_point(p_token text, p_character uuid, p_field text, p_value int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_link public.table_links := public.companion_link(p_token);
  v_data jsonb;
  v_hp int;
  v_max int;
begin
  if p_character is null
     or (v_link.character_id is not null and v_link.character_id <> p_character)
     or not exists (select 1 from public.companion_party(v_link.game_id) as id where id = p_character) then
    raise exception 'not_in_game';
  end if;

  select c.data into v_data from public.characters c where c.id = p_character and c.owner_id = v_link.owner_id;
  v_hp := public.companion_sheet_int(v_data -> 'hp', 10);
  v_max := case when p_field = 'pv' then v_hp else 99 end;
  if p_field is null or p_field not in ('pv', 'san', 'chance', 'pm')
     or p_value is null or p_value not between 0 and v_max then
    raise exception 'bad_value';
  end if;

  -- No row yet: the other values start from the sheet (same defaults as the game screen; current SAN
  -- from the progression when there is one, as the companion shows it).
  insert into public.game_points (game_id, character_id, owner_id, pv, san, chance, pm, source, updated_at)
  values (
    v_link.game_id, p_character, v_link.owner_id,
    case when p_field = 'pv' then p_value else v_hp end,
    case when p_field = 'san' then p_value
         else public.companion_sheet_int(v_data #> '{progress,san}', public.companion_sheet_int(v_data -> 'san', 50)) end,
    case when p_field = 'chance' then p_value else public.companion_sheet_int(v_data -> 'luck', 50) end,
    case when p_field = 'pm' then p_value else public.companion_sheet_int(v_data -> 'mp', 10) end,
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

-- Revokes a link and moves the game to a new realtime channel. Devices on the old topic first get a
-- `rotate` event: a still-valid link refetches companion_open (new channel), a revoked one shows the
-- invalid state. Security definer to reach companion_broadcast; checks the caller owns the link.
create or replace function public.revoke_table_link(p_link uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_game uuid;
  v_channel uuid;
begin
  update public.table_links set revoked_at = now()
  where id = p_link and revoked_at is null and owner_id = (select auth.uid())
  returning game_id into v_game;
  if v_game is null then
    return;
  end if;
  select g.channel into v_channel from public.games g
  where g.id = v_game and g.owner_id = (select auth.uid()) for update;
  if v_channel is null then
    return;
  end if;
  perform public.companion_broadcast(v_channel, 'rotate', '{}'::jsonb);
  update public.games set channel = gen_random_uuid() where id = v_game;
end;
$$;

drop function public.companion_set_points(text, uuid, int, int, int, int);

revoke execute on function public.companion_int(jsonb, int, int) from public, anon, authenticated;
revoke execute on function public.companion_text(jsonb, int) from public, anon, authenticated;
revoke execute on function public.companion_clean_character(jsonb) from public, anon, authenticated;
revoke execute on function public.companion_sheet_int(jsonb, int) from public, anon, authenticated;
revoke execute on function public.revoke_table_link(uuid) from public, anon;
grant execute on function public.revoke_table_link(uuid) to authenticated;
