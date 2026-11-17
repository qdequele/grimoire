-- Player companion: the sheet a phone sends was rebuilt key by key, except `creation` (the wizard's
-- state, kept so the keeper can reopen it), which was stored as any JSON object. The keeper's wizard
-- rebuilds the whole sheet from it on the next edit (name, link, skill keys "id:specialty"), so a
-- phone could get < > & " into a skill key after all, or store a value of the wrong type that the
-- wizard could not open.
-- `creation` is now rebuilt field by field too (CreationDraft in src/engine/creation.ts), with the
-- sheet's own rules and limits. The app reads it defensively as well (src/characters/wizard/draft.ts):
-- rows stored before this migration are not re-checked here.
-- Re-runnable, and safe while the previous site is still serving: it sends the same wizard state.

-- A skill id as the app writes it: "spot-hidden", "science-2". Internal.
create or replace function public.companion_skill_id(p jsonb) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v text := public.companion_text(p, 80);
begin
  if v !~ '^[a-z][a-z0-9-]*$' then
    raise exception 'bad_value';
  end if;
  return v;
end;
$$;
revoke execute on function public.companion_skill_id(jsonb) from public, anon, authenticated;

-- The wizard's state inside a phone's sheet, checked and rebuilt. Every field is optional (the app
-- fills what is missing); a field of the wrong type or over its limit is refused; keys the wizard
-- doesn't have are left out, and so are specialties of skills that aren't picked (the wizard never
-- reads them). Numbers the sheet itself bounds (age, luck) only have to be numbers here: the phone
-- clamps the sheet's copy, not this one. Internal.
create or replace function public.companion_clean_creation(p jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v_out jsonb := '{}'::jsonb;
  v_key text;
  v_val jsonb;
  v_sub jsonb;
  v_ids text[] := '{}';
  v_text text;
  k text;
  v jsonb;
begin
  if p is null or jsonb_typeof(p) is distinct from 'object' then
    raise exception 'bad_value';
  end if;

  -- The picked skills first: the specialties are read against them.
  foreach v_key in array array['occupationSkills', 'personalInterests'] loop
    if p ? v_key then
      v_val := p -> v_key;
      if jsonb_typeof(v_val) is distinct from 'array' or jsonb_array_length(v_val) > 100 then
        raise exception 'bad_value';
      end if;
      v_sub := '[]'::jsonb;
      for v in select e.value from jsonb_array_elements(v_val) with ordinality e(value, n) order by e.n loop
        v_text := public.companion_skill_id(v);
        v_ids := v_ids || v_text;
        v_sub := v_sub || to_jsonb(v_text);
      end loop;
      v_out := v_out || jsonb_build_object(v_key, v_sub);
    end if;
  end loop;

  for v_key, v_val in select e.key, e.value from jsonb_each(p) e loop
    case v_key
      when 'occupationSkills', 'personalInterests' then
        null;
      when 'name' then
        -- As typed (the sheet's name is the trimmed one); same rule as the sheet's, but may be empty.
        v_text := public.companion_text(v_val, 200);
        if char_length(btrim(v_text)) > 80 or public.companion_has_markup(v_text) then
          raise exception 'bad_value';
        end if;
        v_out := v_out || jsonb_build_object(v_key, v_text);
      when 'occupation', 'link' then
        v_out := v_out || jsonb_build_object(v_key, public.companion_text(v_val, 200));
      when 'playerId' then
        v_text := public.companion_text(v_val, 80);
        if public.companion_has_markup(v_text) then
          raise exception 'bad_value';
        end if;
        v_out := v_out || jsonb_build_object(v_key, v_text);
      when 'age', 'luck' then
        if jsonb_typeof(v_val) is distinct from 'number' then
          raise exception 'bad_value';
        end if;
        v_out := v_out || jsonb_build_object(v_key, v_val);
      when 'rolled' then
        if jsonb_typeof(v_val) is distinct from 'boolean' then
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
      when 'occupationValues' then
        if jsonb_typeof(v_val) is distinct from 'object' or (select count(*) from jsonb_object_keys(v_val)) > 100 then
          raise exception 'bad_value';
        end if;
        v_sub := '{}'::jsonb;
        for k, v in select e.key, e.value from jsonb_each(v_val) e loop
          if jsonb_typeof(v) is distinct from 'number' then
            raise exception 'bad_value';
          end if;
          v_sub := v_sub || jsonb_build_object(public.companion_skill_id(to_jsonb(k)), v);
        end loop;
        v_out := v_out || jsonb_build_object(v_key, v_sub);
      when 'specialties' then
        if jsonb_typeof(v_val) is distinct from 'object' then
          raise exception 'bad_value';
        end if;
        v_sub := '{}'::jsonb;
        for k, v in select e.key, e.value from jsonb_each(v_val) e loop
          -- The specialty ends up in a skill key ("art-craft:Photographie"): 40 characters, no markup.
          if k = any (v_ids) then
            v_text := public.companion_text(v, 40);
            if public.companion_has_markup(v_text) then
              raise exception 'bad_value';
            end if;
            v_sub := v_sub || jsonb_build_object(k, v_text);
          end if;
        end loop;
        v_out := v_out || jsonb_build_object(v_key, v_sub);
      when 'profile' then
        if jsonb_typeof(v_val) is distinct from 'object' then
          raise exception 'bad_value';
        end if;
        v_sub := '{}'::jsonb;
        for k, v in select e.key, e.value from jsonb_each(v_val) e loop
          -- The wizard's field ids: "description", "significantPeople".
          if k !~ '^[a-zA-Z]{1,40}$' then
            raise exception 'bad_value';
          end if;
          v_sub := v_sub || jsonb_build_object(k, public.companion_text(v, 2000));
        end loop;
        v_out := v_out || jsonb_build_object(v_key, v_sub);
      else
        null;
    end case;
  end loop;
  return v_out;
end;
$$;
revoke execute on function public.companion_clean_creation(jsonb) from public, anon, authenticated;

-- The sheet a phone sends, checked and rebuilt key by key (CharacterData in src/characters/character.ts).
-- Unknown keys are refused; `progress` belongs to the keeper's games and is dropped. Internal.
-- Same as 20261106090600_companion_hardening_2.sql, except `creation`, which is rebuilt too.
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
        -- The wizard's own state, so the keeper can reopen it: rebuilt with the same rules.
        v_out := v_out || jsonb_build_object(v_key, public.companion_clean_creation(v_val));
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
