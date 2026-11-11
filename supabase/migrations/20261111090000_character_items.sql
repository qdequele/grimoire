-- Investigators' items (« Objets »): cards the keeper gives an investigator (from the app's catalogue,
-- a story, or made up on the spot), kept from one game to the next. Players see them on their phone
-- and spend their uses (a bullet, a bandage) or reload a weapon from a matching box of ammunition.
--
-- A card is a small JSON description (src/items/item.ts, ItemCard); a row is one card in one
-- investigator's hands, with the uses it has left. Only the keeper adds, edits or removes cards
-- (RLS, owner rows); phones go through security-definer RPCs that only change uses.

-- A card the database accepts: the checks the readers rely on (the app checks the rest, parseCard).
-- At most 24 KB: a card is small, but a document card carries its letter's whole text.
create function public.item_card_ok(c jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    jsonb_typeof(c) = 'object'
    and octet_length(c::text) <= 24000
    and jsonb_typeof(c -> 'name') = 'string'
    and char_length(btrim(c ->> 'name')) between 1 and 60
    and (c ->> 'name') !~ '[<>&"]'
    and (c ->> 'kind') in ('weapon', 'ammo', 'light', 'tool', 'medical', 'document', 'occult', 'gear', 'key')
    and case when c ? 'uses'
      then jsonb_typeof(c -> 'uses') = 'number' and (c ->> 'uses') ~ '^[0-9]{1,2}$' and (c ->> 'uses')::int between 1 and 99
      else true end
    and case when c ? 'ammo'
      then jsonb_typeof(c -> 'ammo') = 'string' and char_length(c ->> 'ammo') between 1 and 16
      else true end
    and case when c ? 'text'
      then jsonb_typeof(c -> 'text') = 'string' and char_length(c ->> 'text') <= 400
      else true end
    -- A document's full text (a letter, a diary): up to 8,000 characters.
    and case when c ? 'document'
      then jsonb_typeof(c -> 'document') = 'string' and char_length(c ->> 'document') <= 8000
      else true end,
    false);
$$;

create table public.character_items (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  character_id  uuid not null,
  card          jsonb not null,
  -- Uses left; null exactly when the card has no uses.
  uses          int,
  -- A weapon's condition, set by the keeper (src/items/item.ts, conditionEffects): clean, dirty
  -- (sale), rusty (rouillée), damaged (abîmée) or broken (hors d'usage). Always clean for other items.
  condition     text not null default 'clean',
  -- Where the card came from: a catalogue entry (its id), a story's item, or neither (the keeper's own).
  catalog_id    text,
  story_id      uuid references public.stories (id) on delete set null,
  story_item    text,
  position      int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint character_items_card_check check (public.item_card_ok(card)),
  constraint character_items_uses_check check (
    case when card ? 'uses' then uses is not null and uses between 0 and (card ->> 'uses')::int else uses is null end
  ),
  constraint character_items_condition_check check (
    condition in ('clean', 'dirty', 'rusty', 'damaged', 'broken') and (condition = 'clean' or card ->> 'kind' = 'weapon')
  ),
  constraint character_items_catalog_check check (catalog_id is null or catalog_id ~ '^[a-z0-9-]{1,60}$'),
  constraint character_items_story_item_check check (story_item is null or char_length(story_item) between 1 and 80),
  constraint character_items_character_fkey foreign key (character_id, owner_id)
    references public.characters (id, owner_id) on delete cascade
);

create index character_items_character_idx on public.character_items (character_id, position);
create index character_items_owner_idx on public.character_items (owner_id);
create trigger character_items_touch before update on public.character_items
  for each row execute function public.touch_updated_at();

-- At most 60 cards per investigator.
create function public.character_items_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.character_items where character_id = new.character_id) >= 60 then
    raise exception 'too_many_items';
  end if;
  return new;
end;
$$;
create trigger character_items_limit before insert on public.character_items
  for each row execute function public.character_items_limit();

alter table public.character_items enable row level security;
create policy "character_items: own rows"
  on public.character_items for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Uses: + or − a number, kept within the card's. Returns the uses left.
create function public.item_add_uses(p_item uuid, p_owner uuid, p_delta int) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_uses int;
begin
  if p_delta is null or p_delta not between -99 and 99 then
    raise exception 'bad_value';
  end if;
  update public.character_items
  set uses = greatest(0, least((card ->> 'uses')::int, uses + p_delta))
  where id = p_item and owner_id = p_owner and uses is not null
  returning uses into v_uses;
  if v_uses is null then
    raise exception 'bad_value';
  end if;
  return v_uses;
end;
$$;

-- Reload: rounds move from the investigator's fullest box of the weapon's ammunition into the weapon,
-- up to its capacity (reloadPlan in src/items/item.ts). Returns how many moved (0: nothing to do).
create function public.item_reload(p_weapon uuid, p_owner uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_weapon public.character_items;
  v_ammo public.character_items;
  v_moved int;
begin
  select * into v_weapon from public.character_items
  where id = p_weapon and owner_id = p_owner
  for update;
  if not found or v_weapon.card ->> 'kind' <> 'weapon' or not (v_weapon.card ? 'ammo') or v_weapon.uses is null then
    raise exception 'bad_value';
  end if;
  select * into v_ammo from public.character_items
  where owner_id = p_owner
    and character_id = v_weapon.character_id
    and card ->> 'kind' = 'ammo'
    and card ->> 'ammo' = v_weapon.card ->> 'ammo'
    and uses > 0
  order by uses desc, created_at
  limit 1
  for update;
  if not found then
    return 0;
  end if;
  v_moved := least((v_weapon.card ->> 'uses')::int - v_weapon.uses, v_ammo.uses);
  if v_moved <= 0 then
    return 0;
  end if;
  update public.character_items set uses = uses - v_moved where id = v_ammo.id;
  update public.character_items set uses = uses + v_moved where id = v_weapon.id;
  return v_moved;
end;
$$;

-- The keeper's versions (their own rows).
create function public.use_item(p_item uuid, p_delta int) returns int
language sql security definer set search_path = '' as $$
  select public.item_add_uses(p_item, (select auth.uid()), p_delta);
$$;
create function public.reload_item(p_weapon uuid) returns int
language sql security definer set search_path = '' as $$
  select public.item_reload(p_weapon, (select auth.uid()));
$$;

-- A phone's item: one of a party member's, and with a personal link only its own investigator's
-- (same rule as points and photos).
create function public.companion_item(p_token text, p_item uuid) returns public.character_items
language plpgsql security definer stable set search_path = '' as $$
declare
  v_link public.table_links := public.companion_link(p_token);
  v_item public.character_items;
begin
  select * into v_item from public.character_items i where i.id = p_item and i.owner_id = v_link.owner_id;
  if not found
     or (v_link.character_id is not null and v_link.character_id <> v_item.character_id)
     or not exists (select 1 from public.companion_party(v_link.game_id) as id where id = v_item.character_id) then
    raise exception 'not_in_game';
  end if;
  return v_item;
end;
$$;

create function public.companion_use_item(p_token text, p_item uuid, p_delta int) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_item public.character_items := public.companion_item(p_token, p_item);
begin
  return public.item_add_uses(v_item.id, v_item.owner_id, p_delta);
end;
$$;

create function public.companion_reload_item(p_token text, p_weapon uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_item public.character_items := public.companion_item(p_token, p_weapon);
begin
  return public.item_reload(v_item.id, v_item.owner_id);
end;
$$;

-- `items` hint ({ characterId }) on the topic of every running game the investigator is in: the game
-- screen re-reads their cards (RLS), phones refetch companion_open.
create function public.character_items_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_character uuid := case when tg_op = 'DELETE' then old.character_id else new.character_id end;
  v_owner uuid := case when tg_op = 'DELETE' then old.owner_id else new.owner_id end;
  v_game record;
begin
  for v_game in
    select g.channel from public.games g
    where g.finished_at is null
      and g.owner_id = v_owner
      and jsonb_typeof(g.state -> 'party') = 'array'
      and g.state -> 'party' @> jsonb_build_array(jsonb_build_object('characterId', v_character))
  loop
    perform public.companion_broadcast(v_game.channel, 'items', jsonb_build_object('characterId', v_character));
  end loop;
  return null;
end;
$$;

create trigger character_items_broadcast after insert or update or delete on public.character_items
  for each row execute function public.character_items_changed();

-- companion_open (20261107110000), with each party member's items.
create or replace function public.companion_open(p_token text) returns jsonb
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
        'player', p.name,
        'photo', c.photo
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
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'characterId', i.character_id,
        'card', i.card,
        'uses', i.uses,
        'condition', i.condition,
        'catalogId', i.catalog_id,
        'storyId', i.story_id,
        'storyItem', i.story_item,
        'position', i.position,
        'updatedAt', i.updated_at
      ) order by i.position, i.created_at)
      from public.character_items i
      where i.owner_id = g.owner_id
        and i.character_id in (select public.companion_party(g.id))
    ), '[]'::jsonb)
  ) into v_result
  from public.games g
  join public.stories s on s.id = g.story_id
  where g.id = v_link.game_id;
  return v_result;
end;
$$;

revoke execute on function public.character_items_limit() from public, anon, authenticated;
revoke execute on function public.character_items_changed() from public, anon, authenticated;
revoke execute on function public.item_add_uses(uuid, uuid, int) from public, anon, authenticated;
revoke execute on function public.item_reload(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.companion_item(text, uuid) from public, anon, authenticated;
revoke execute on function public.use_item(uuid, int) from public, anon;
revoke execute on function public.reload_item(uuid) from public, anon;
revoke execute on function public.companion_use_item(text, uuid, int) from public;
revoke execute on function public.companion_reload_item(text, uuid) from public;
grant execute on function public.use_item(uuid, int) to authenticated;
grant execute on function public.reload_item(uuid) to authenticated;
grant execute on function public.companion_use_item(text, uuid, int) to anon, authenticated;
grant execute on function public.companion_reload_item(text, uuid) to anon, authenticated;
