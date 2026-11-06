-- Player companion hardening, part 2 (security review of the branch). Phones are untrusted, and what
-- they send reaches the keeper's game screen, which builds HTML. The engine escapes these values
-- (scripts/extract-engine.mjs); the database refuses them too:
-- 1. Skill keys must have the app's own shape: a skill id (lowercase letters, digits, hyphens), then
--    optionally ":" and a specialty. No < > & " anywhere in the key.
-- 2. No < > & " in the investigator's name or in the player's first name.
-- Limits, unchanged (the phone's wizard enforces the same ones, src/companion/sheet.ts):
-- name 1..80 after trimming, occupation and link 200, profile texts 2000 (keys 40),
-- skill keys 80 (at most 100 skills), first name 80 after trimming.

-- True when the text holds one of the characters that build HTML. Internal.
create function public.companion_has_markup(p text) returns boolean
language sql immutable set search_path = '' as $$
  select p ~ '[<>&"]'
$$;
revoke execute on function public.companion_has_markup(text) from public, anon, authenticated;

-- The sheet a phone sends, checked and rebuilt key by key (CharacterData in src/characters/character.ts).
-- Unknown keys are refused; `progress` belongs to the keeper's games and is dropped. Internal.
create or replace function public.companion_clean_character(p_data jsonb) returns jsonb
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
        if char_length(v_name) not between 1 and 80 or public.companion_has_markup(v_name) then
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
          -- "spot-hidden", "art-craft:Photographie" (src/engine/creation.ts, finalSkills).
          if char_length(k) not between 1 and 80
             or k !~ '^[a-z][a-z0-9-]*(:.+)?$'
             or public.companion_has_markup(k) then
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
  if char_length(v_player_name) > 80 or public.companion_has_markup(v_player_name) then
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
