-- Remote table: a group playing online (voice chat in another window) opens the table link on a
-- computer and gets the whole table: the scene's living décor behind their sheet, the place's name,
-- everyone's dice rolls, and the documents the keeper showed, kept to read again.
--
-- 1. game_documents: what the keeper showed to the table, kept for the players.
-- 2. game_rolls: the keeper's rolls for investigators join the players' (source), and a roll can
--    carry what it cost (effect: SAN lost, damage taken).
-- 3. companion_roll_san: a player's SAN roll, which takes the loss off by itself.
-- 4. companion_table: what a table link reads besides companion_open (screen, documents, rolls).
-- 5. Hints on the companion topic: `screen` and `documents`.

-- ------------------------------------------------------------------ 1. documents

-- One row per document shown to the table (same `key` as the ambiance screen's handout: showing it
-- again updates the row). `image` is { bucket, path, url, until }: the keeper's game screen signs
-- the picture (a long-lived signed URL, renewed when the game is opened): players never read Storage.
create table public.game_documents (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null,
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  key         text not null,
  title       text not null default '',
  body        text,
  image       jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint game_documents_game_fkey foreign key (game_id, owner_id)
    references public.games (id, owner_id) on delete cascade,
  constraint game_documents_key_len check (char_length(key) between 1 and 300),
  constraint game_documents_title_len check (char_length(title) <= 200),
  constraint game_documents_body_len check (body is null or char_length(body) <= 20000),
  constraint game_documents_image_shape check (
    image is null or (jsonb_typeof(image) = 'object' and pg_column_size(image) <= 4096)
  ),
  constraint game_documents_not_empty check (body is not null or image is not null),
  unique (game_id, key)
);

create index game_documents_owner_idx on public.game_documents (owner_id);

alter table public.game_documents enable row level security;

create policy "game_documents: own rows"
  on public.game_documents for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

grant select, insert, update, delete on public.game_documents to authenticated;

-- At most 100 documents a game (showing one again updates its row: it doesn't count twice).
create function public.game_documents_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.game_documents d where d.game_id = new.game_id and d.key <> new.key) >= 100 then
    raise exception 'too_many_documents';
  end if;
  return new;
end;
$$;

create trigger game_documents_limit before insert on public.game_documents
  for each row execute function public.game_documents_limit();

-- Tells the table its documents changed (a hint: players read companion_table again).
create function public.game_documents_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_game uuid := case when tg_op = 'DELETE' then old.game_id else new.game_id end;
  v_channel uuid;
begin
  select g.channel into v_channel from public.games g where g.id = v_game;
  if v_channel is not null then
    perform public.companion_broadcast(v_channel, 'documents', '{}'::jsonb);
  end if;
  return null;
end;
$$;

create trigger game_documents_broadcast after insert or update or delete on public.game_documents
  for each row execute function public.game_documents_changed();

revoke execute on function public.game_documents_limit() from public, anon, authenticated;
revoke execute on function public.game_documents_changed() from public, anon, authenticated;

-- ------------------------------------------------------------------ 2. rolls

-- Who rolled: a player from their link, or the keeper's game screen for an investigator.
alter table public.game_rolls add column source text not null default 'phone';
alter table public.game_rolls add constraint game_rolls_source_check check (source in ('phone', 'keeper'));

-- What the roll cost the investigator: { "field": "san" | "pv", "delta": -4, "from": 54, "to": 50,
-- "formula": "1D6" }. Null when it cost nothing.
alter table public.game_rolls add column effect jsonb;
alter table public.game_rolls add constraint game_rolls_effect_shape check (
  effect is null or (
    jsonb_typeof(effect) = 'object' and pg_column_size(effect) <= 1024
    and effect ->> 'field' in ('san', 'pv')
    and jsonb_typeof(effect -> 'delta') = 'number'
    and jsonb_typeof(effect -> 'from') = 'number'
    and jsonb_typeof(effect -> 'to') = 'number'
  )
);

-- A third kind: damage the keeper rolled on an investigator (dice: { "formula", "total" }).
alter table public.game_rolls drop constraint game_rolls_kind_check;
alter table public.game_rolls add constraint game_rolls_kind_check check (kind in ('check', 'dice', 'damage'));
alter table public.game_rolls drop constraint game_rolls_check_shape;
alter table public.game_rolls add constraint game_rolls_check_shape check (
  (kind = 'check' and subject is not null and target is not null and level is not null)
  or (kind = 'dice' and subject is null and target is null and level is null and net = 0)
  or (kind = 'damage' and subject is not null and target is null and level is null and net = 0)
);
-- The keeper's rows come straight from the game screen: bounded like the RPCs' own.
alter table public.game_rolls add constraint game_rolls_bounds check (
  (subject is null or char_length(subject) <= 90)
  and (target is null or target between 0 and 200)
  and result between -1000 and 100000
  and pg_column_size(dice) <= 2048
);

-- The keeper's game screen writes the rolls it makes for investigators (never as a player's).
create policy game_rolls_insert_keeper on public.game_rolls for insert to authenticated
  with check (owner_id = (select auth.uid()) and source = 'keeper');
grant insert on public.game_rolls to authenticated;

-- Every new roll: keep the game's 100 newest, then tell the table (a hint: readers read the rows).
create or replace function public.companion_rolls_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_channel uuid;
begin
  if new.source = 'keeper' then
    perform public.companion_roll_prune(new.game_id);
  end if;
  select g.channel into v_channel from public.games g where g.id = new.game_id;
  if v_channel is not null then
    perform public.companion_broadcast(v_channel, 'roll', jsonb_build_object('characterId', new.character_id));
  end if;
  return null;
end;
$$;

-- A roll as the table reads it (camelCase, like the roll RPCs' answers).
create function public.companion_roll_json(r public.game_rolls) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'characterId', r.character_id, 'kind', r.kind, 'subject', r.subject,
    'target', r.target, 'net', r.net, 'dice', r.dice, 'result', r.result, 'level', r.level,
    'source', r.source, 'effect', r.effect, 'createdAt', r.created_at
  )
$$;

-- ------------------------------------------------------------------ 3. SAN roll with its loss

-- A loss as the keeper announces it ("0", "1", "1D6", "2D6", "1D4+1"), rolled: null when it isn't one.
create function public.companion_roll_loss(p_formula text) returns int
language plpgsql volatile set search_path = '' as $$
declare
  m text[];
  v_count int;
  v_sides int;
  v_total int := 0;
  i int;
begin
  if p_formula is null then
    return null;
  end if;
  if p_formula ~ '^[0-9]{1,2}$' then
    return p_formula::int;
  end if;
  m := regexp_match(upper(p_formula), '^([1-9])?D(2|3|4|6|8|10|20|100)(\+[0-9]{1,2})?$');
  if m is null then
    return null;
  end if;
  v_count := coalesce(m[1], '1')::int;
  v_sides := m[2]::int;
  for i in 1 .. v_count loop
    v_total := v_total + floor(random() * v_sides)::int + 1;
  end loop;
  return v_total + coalesce(substr(m[3], 2), '0')::int;
end;
$$;

-- A player's SAN roll: a d100 against the investigator's current SAN as the server holds it, then
-- the loss the keeper announced (p_loss_ok on a success, p_loss_fail on a failure) is rolled and
-- taken off, in the same call: every screen gets the new SAN (game_points broadcast) and the roll
-- says what it cost. The keeper can still correct the value with − / +.
-- Errors: link_invalid, not_in_game, bad_value.
create function public.companion_roll_san(p_token text, p_character uuid, p_loss_ok text, p_loss_fail text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_link public.table_links := public.companion_link(p_token);
  v_data jsonb;
  v_san int;
  v_units int;
  v_tens int;
  v_result int;
  v_level text;
  v_formula text;
  v_loss int;
  v_to int;
  v_row public.game_rolls;
begin
  perform public.companion_roll_character(v_link.game_id, v_link.character_id, p_character);
  if public.companion_roll_loss(p_loss_ok) is null or public.companion_roll_loss(p_loss_fail) is null then
    raise exception 'bad_value';
  end if;

  -- The live row, made from the sheet when the game has none yet (same defaults as companion_set_point).
  select c.data into v_data from public.characters c where c.id = p_character and c.owner_id = v_link.owner_id;
  insert into public.game_points (game_id, character_id, owner_id, pv, san, chance, pm, source, updated_at)
  values (
    v_link.game_id, p_character, v_link.owner_id,
    public.companion_sheet_int(v_data -> 'hp', 10),
    public.companion_sheet_int(v_data #> '{progress,san}', public.companion_sheet_int(v_data -> 'san', 50)),
    public.companion_sheet_int(v_data -> 'luck', 50),
    public.companion_sheet_int(v_data -> 'mp', 10),
    'phone', now()
  )
  on conflict (game_id, character_id) do nothing;
  select coalesce(gp.san, 0) into v_san from public.game_points gp
  where gp.game_id = v_link.game_id and gp.character_id = p_character
  for update;

  v_units := public.companion_d10();
  v_tens := public.companion_d10();
  v_result := case when v_tens = 0 and v_units = 0 then 100 else v_tens * 10 + v_units end;
  v_level := case
    when v_result <= v_san / 5 then 'extreme'
    when v_result <= v_san / 2 then 'hard'
    when v_result <= v_san then 'regular'
    else 'failure'
  end;
  v_formula := upper(case when v_level = 'failure' then p_loss_fail else p_loss_ok end);
  v_loss := public.companion_roll_loss(v_formula);
  v_to := greatest(0, v_san - v_loss);

  if v_to <> v_san then
    update public.game_points set san = v_to, source = 'phone', updated_at = now()
    where game_id = v_link.game_id and character_id = p_character;
    -- Current SAN lives in the investigator's progression once it exists.
    update public.characters
    set data = jsonb_set(data, '{progress,san}', to_jsonb(v_to))
    where id = p_character and owner_id = v_link.owner_id
      and jsonb_typeof(data -> 'progress') = 'object';
  end if;

  insert into public.game_rolls (game_id, owner_id, character_id, kind, subject, target, net, dice, result, level, effect)
  values (v_link.game_id, v_link.owner_id, p_character, 'check', 'san', v_san, 0,
          jsonb_build_object('tens', jsonb_build_array(v_tens), 'units', v_units), v_result, v_level,
          jsonb_build_object('field', 'san', 'delta', v_to - v_san, 'from', v_san, 'to', v_to, 'formula', v_formula))
  returning * into v_row;
  perform public.companion_roll_prune(v_link.game_id);

  return public.companion_roll_json(v_row);
end;
$$;

-- ------------------------------------------------------------------ 4. what the table reads

-- The table around the sheet: what the ambiance screen shows (the scene's décor, the place's name,
-- the document being shown), the documents kept for the players, and the game's last rolls, the
-- other investigators' and the keeper's included. Error: link_invalid.
create function public.companion_table(p_token text) returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare
  v_link public.table_links := public.companion_link(p_token);
  v_result jsonb;
begin
  select jsonb_build_object(
    'screen', g.screen,
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'key', d.key, 'title', d.title, 'text', d.body, 'image', d.image,
        'createdAt', d.created_at, 'updatedAt', d.updated_at
      ) order by d.created_at desc)
      from public.game_documents d
      where d.game_id = g.id and d.owner_id = g.owner_id
    ), '[]'::jsonb),
    'rolls', coalesce((
      select jsonb_agg(public.companion_roll_json(r) order by r.created_at desc)
      from (
        select x.* from public.game_rolls x
        where x.game_id = g.id and x.owner_id = g.owner_id
        order by x.created_at desc limit 30
      ) r
    ), '[]'::jsonb)
  ) into v_result
  from public.games g
  where g.id = v_link.game_id and g.owner_id = v_link.owner_id;
  return v_result;
end;
$$;

-- ------------------------------------------------------------------ 5. hints

-- games.screen changed: the ambiance screen's own topic as before, and a hint on the table's topic
-- (players read companion_table again; nothing of the screen travels on that public topic).
create or replace function public.games_screen_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform realtime.send(coalesce(new.screen, '{}'::jsonb), 'screen', 'screen:' || new.screen_channel::text, false);
  exception when others then
    raise warning 'screen broadcast failed: %', sqlerrm;
  end;
  perform public.companion_broadcast(new.channel, 'screen', '{}'::jsonb);
  return null;
end;
$$;

revoke execute on function public.companion_roll_json(public.game_rolls) from public, anon, authenticated;
revoke execute on function public.companion_roll_loss(text) from public, anon, authenticated;
revoke execute on function public.companion_roll_san(text, uuid, text, text) from public;
revoke execute on function public.companion_table(text) from public;
grant execute on function public.companion_roll_san(text, uuid, text, text) to anon, authenticated;
grant execute on function public.companion_table(text) to anon, authenticated;
