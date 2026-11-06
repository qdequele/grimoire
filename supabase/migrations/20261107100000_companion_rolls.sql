-- Player companion: dice rolls from the players' phones. The server rolls (a phone can't choose its
-- result), keeps the roll and tells the keeper's game screen on the game's topic (`roll` hint,
-- `{ characterId }`): the game screen reads the new rows under its own RLS and shows them.
-- Two kinds:
--   check: d100 against a value, with bonus (net > 0) or penalty (net < 0) dice. `subject` says what
--          is rolled, in a shape the app translates: `skill:<skill key>`, `char:<STR…EDU>`, `san`, `luck`.
--          The value comes from the phone (the sheet it shows); the keeper sees it next to the result.
--   dice:  free dice, e.g. damage: count × D sides + modifier.
-- Only the 100 newest rolls of a game are kept.

create table public.game_rolls (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null,
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  character_id  uuid not null,
  kind          text not null check (kind in ('check', 'dice')),
  subject       text,
  target        int,
  net           int not null default 0 check (net between -2 and 2),
  -- check: { "tens": [0..9, …], "units": 0..9 }; dice: { "count", "sides", "modifier", "results": [...] }.
  dice          jsonb not null,
  result        int not null,
  level         text check (level in ('extreme', 'hard', 'regular', 'failure')),
  created_at    timestamptz not null default clock_timestamp(),
  constraint game_rolls_check_shape check (
    (kind = 'check' and subject is not null and target is not null and level is not null)
    or (kind = 'dice' and subject is null and target is null and level is null and net = 0)
  ),
  constraint game_rolls_game_fkey foreign key (game_id, owner_id)
    references public.games (id, owner_id) on delete cascade,
  constraint game_rolls_character_fkey foreign key (character_id, owner_id)
    references public.characters (id, owner_id) on delete cascade
);

create index game_rolls_game_idx on public.game_rolls (game_id, created_at desc);
create index game_rolls_owner_idx on public.game_rolls (owner_id);
create index game_rolls_character_idx on public.game_rolls (character_id, owner_id);

-- The keeper reads their games' rolls. Nobody writes them directly: phones go through the RPCs below.
alter table public.game_rolls enable row level security;
create policy game_rolls_select_own on public.game_rolls for select to authenticated
  using (owner_id = (select auth.uid()));
create policy game_rolls_delete_own on public.game_rolls for delete to authenticated
  using (owner_id = (select auth.uid()));
grant select, delete on public.game_rolls to authenticated;

-- The link's investigator (p_link_character: a personal link's own one, else null), checked: in the game's party, and the personal link's own one. Internal.
create function public.companion_roll_character(p_game uuid, p_link_character uuid, p_character uuid) returns void
language plpgsql security definer stable set search_path = '' as $$
begin
  if p_character is null
     or (p_link_character is not null and p_link_character <> p_character)
     or not exists (select 1 from public.companion_party(p_game) as id where id = p_character) then
    raise exception 'not_in_game';
  end if;
end;
$$;

-- Keeps the 100 newest rolls of a game. Internal.
create function public.companion_roll_prune(p_game uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.game_rolls r
  where r.game_id = p_game
    and r.id not in (select x.id from public.game_rolls x where x.game_id = p_game order by x.created_at desc limit 100);
$$;

-- A 0..9 die.
create function public.companion_d10() returns int
language sql volatile set search_path = '' as $$
  select floor(random() * 10)::int
$$;

-- d100 check. Same rules as the app's engine (src/engine/dice.ts): one units die, 1 + |net| tens dice,
-- 00 + 0 reads 100; bonus keeps the lowest, penalty the highest. Success: ≤ value, hard ≤ value/2,
-- extreme ≤ value/5. Errors: link_invalid, not_in_game, bad_value.
create function public.companion_roll_check(p_token text, p_character uuid, p_subject text, p_target int, p_net int)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_link public.table_links := public.companion_link(p_token);
  v_net int := coalesce(p_net, 0);
  v_units int;
  v_tens int[] := '{}';
  v_values int[] := '{}';
  v_result int;
  v_level text;
  v_row public.game_rolls;
  i int;
begin
  perform public.companion_roll_character(v_link.game_id, v_link.character_id, p_character);
  if p_subject is null or char_length(p_subject) > 90
     or p_subject !~ '^(skill:[a-z][a-z0-9-]*(:.+)?|char:(STR|CON|SIZ|DEX|APP|INT|POW|EDU)|san|luck)$'
     or public.companion_has_markup(p_subject)
     or p_target is null or p_target not between 0 and 200
     or v_net not between -2 and 2 then
    raise exception 'bad_value';
  end if;

  v_units := public.companion_d10();
  for i in 1 .. 1 + abs(v_net) loop
    v_tens := v_tens || public.companion_d10();
    v_values := v_values || (case when v_tens[i] = 0 and v_units = 0 then 100 else v_tens[i] * 10 + v_units end);
  end loop;
  v_result := case
    when v_net > 0 then (select min(x) from unnest(v_values) x)
    when v_net < 0 then (select max(x) from unnest(v_values) x)
    else v_values[1]
  end;
  v_level := case
    when v_result <= p_target / 5 then 'extreme'
    when v_result <= p_target / 2 then 'hard'
    when v_result <= p_target then 'regular'
    else 'failure'
  end;

  insert into public.game_rolls (game_id, owner_id, character_id, kind, subject, target, net, dice, result, level)
  values (v_link.game_id, v_link.owner_id, p_character, 'check', p_subject, p_target, v_net,
          jsonb_build_object('tens', to_jsonb(v_tens), 'units', v_units), v_result, v_level)
  returning * into v_row;
  perform public.companion_roll_prune(v_link.game_id);

  return jsonb_build_object(
    'id', v_row.id, 'characterId', v_row.character_id, 'kind', 'check', 'subject', v_row.subject,
    'target', v_row.target, 'net', v_row.net, 'dice', v_row.dice, 'result', v_row.result,
    'level', v_row.level, 'createdAt', v_row.created_at
  );
end;
$$;

-- Free dice: 1..10 dice of 3, 4, 6, 8, 10, 12, 20 or 100 sides, plus a modifier within -20..20.
-- A D3 is a D6 halved, rounded up (as at the table and in the engine). Errors as above.
create function public.companion_roll_dice(p_token text, p_character uuid, p_count int, p_sides int, p_modifier int)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_link public.table_links := public.companion_link(p_token);
  v_mod int := coalesce(p_modifier, 0);
  v_results int[] := '{}';
  v_row public.game_rolls;
  i int;
begin
  perform public.companion_roll_character(v_link.game_id, v_link.character_id, p_character);
  if p_count is null or p_count not between 1 and 10
     or p_sides is null or p_sides not in (3, 4, 6, 8, 10, 12, 20, 100)
     or v_mod not between -20 and 20 then
    raise exception 'bad_value';
  end if;

  for i in 1 .. p_count loop
    v_results := v_results || (case
      when p_sides = 3 then ceil((floor(random() * 6)::int + 1) / 2.0)::int
      else floor(random() * p_sides)::int + 1
    end);
  end loop;

  insert into public.game_rolls (game_id, owner_id, character_id, kind, dice, result)
  values (v_link.game_id, v_link.owner_id, p_character, 'dice',
          jsonb_build_object('count', p_count, 'sides', p_sides, 'modifier', v_mod, 'results', to_jsonb(v_results)),
          (select sum(x) from unnest(v_results) x) + v_mod)
  returning * into v_row;
  perform public.companion_roll_prune(v_link.game_id);

  return jsonb_build_object(
    'id', v_row.id, 'characterId', v_row.character_id, 'kind', 'dice', 'subject', null, 'target', null,
    'net', 0, 'dice', v_row.dice, 'result', v_row.result, 'level', null, 'createdAt', v_row.created_at
  );
end;
$$;

-- Tells the game screen a roll was made (a hint: it reads the row itself).
create function public.companion_rolls_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_channel uuid;
begin
  select g.channel into v_channel from public.games g where g.id = new.game_id;
  if v_channel is not null then
    perform public.companion_broadcast(v_channel, 'roll', jsonb_build_object('characterId', new.character_id));
  end if;
  return null;
end;
$$;

create trigger game_rolls_broadcast after insert on public.game_rolls
  for each row execute function public.companion_rolls_changed();

revoke execute on function public.companion_roll_character(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.companion_roll_prune(uuid) from public, anon, authenticated;
revoke execute on function public.companion_d10() from public, anon, authenticated;
revoke execute on function public.companion_rolls_changed() from public, anon, authenticated;
revoke execute on function public.companion_roll_check(text, uuid, text, int, int) from public;
revoke execute on function public.companion_roll_dice(text, uuid, int, int, int) from public;
grant execute on function public.companion_roll_check(text, uuid, text, int, int) to anon, authenticated;
grant execute on function public.companion_roll_dice(text, uuid, int, int, int) to anon, authenticated;
