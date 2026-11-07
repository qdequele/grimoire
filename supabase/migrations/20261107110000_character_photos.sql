-- Investigator photos: a player puts their photo on their investigator from the companion (or the
-- keeper from the Investigateurs page). It replaces the initials in the small round head that stands
-- for the investigator everywhere (game screen, phones, keeper's lists).
--
-- Stored inline as a small data URL (the browser crops and shrinks it to ~192 px JPEG first): phones
-- have no account, so they can't write to Storage, and every reader (companion_open, the game screen
-- under RLS) already reads the character row. Only base64 image data of a known format is accepted,
-- so the value can be put in a CSS url() or an <img src> as it is.

-- Null, or a JPEG / PNG / WebP data URL of at most 60,000 characters (about 44 KB of image).
create function public.character_photo_ok(p text) returns boolean
language sql immutable set search_path = '' as $$
  select p is null or (
    char_length(p) <= 60000
    and p ~ '^data:image/(jpeg;base64,/9j/|png;base64,iVBORw0KGgo|webp;base64,UklGR)[A-Za-z0-9+/]*={0,2}$'
  );
$$;

alter table public.characters add column photo text;
alter table public.characters add constraint characters_photo_check check (public.character_photo_ok(photo));

-- A phone sets (or, with null, removes) the photo of an investigator of its game. Same rule as
-- points: a personal link only its own investigator, a table link any investigator of the party.
create function public.companion_set_photo(p_token text, p_character uuid, p_photo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_link public.table_links := public.companion_link(p_token);
  v_photo text := nullif(p_photo, '');
begin
  if p_character is null
     or (v_link.character_id is not null and v_link.character_id <> p_character)
     or not exists (select 1 from public.companion_party(v_link.game_id) as id where id = p_character) then
    raise exception 'not_in_game';
  end if;
  if not public.character_photo_ok(v_photo) then
    raise exception 'bad_value';
  end if;
  update public.characters set photo = v_photo
  where id = p_character and owner_id = v_link.owner_id;
end;
$$;

-- `photo` hint ({ characterId }) on the topic of every running game the investigator is in, whoever
-- changed it (phone or keeper): the game screen and the phones re-read it.
create function public.character_photo_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_game record;
begin
  for v_game in
    select g.channel from public.games g
    where g.finished_at is null
      and g.owner_id = new.owner_id
      and jsonb_typeof(g.state -> 'party') = 'array'
      and g.state -> 'party' @> jsonb_build_array(jsonb_build_object('characterId', new.id))
  loop
    perform public.companion_broadcast(v_game.channel, 'photo', jsonb_build_object('characterId', new.id));
  end loop;
  return null;
end;
$$;

create trigger characters_photo_broadcast after update of photo on public.characters
  for each row when (old.photo is distinct from new.photo)
  execute function public.character_photo_changed();

-- companion_open (20261106090100), with each party member's photo.
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
    ), '[]'::jsonb)
  ) into v_result
  from public.games g
  join public.stories s on s.id = g.story_id
  where g.id = v_link.game_id;
  return v_result;
end;
$$;

revoke execute on function public.character_photo_changed() from public, anon, authenticated;
revoke execute on function public.companion_set_photo(text, uuid, text) from public;
grant execute on function public.companion_set_photo(text, uuid, text) to anon, authenticated;
