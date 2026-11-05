-- Player companion: players open a link (or QR code) from the keeper's game to see their investigator.
-- This migration holds the keeper-side data: links, per-investigator notebooks and live points.

create extension if not exists pgcrypto with schema extensions;

-- Lets notes point to (investigator, owner): a note can only belong to its keeper's investigators.
alter table public.characters add constraint characters_id_owner_key unique (id, owner_id);

-- Realtime topic of a game is `companion:<channel>`. Revoking a link rotates it, which locks revoked devices out.
alter table public.games add column channel uuid not null default gen_random_uuid();

-- Links: one for the whole table (character_id null) or one per investigator.
create table public.table_links (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  game_id       uuid not null references public.games (id) on delete cascade,
  character_id  uuid references public.characters (id) on delete cascade,
  -- 24 random bytes, base64url without padding: 32 URL-safe characters.
  token         text not null unique default translate(rtrim(encode(extensions.gen_random_bytes(24), 'base64'), '='), '+/', '-_'),
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);

create unique index table_links_one_table_link_key on public.table_links (game_id)
  where character_id is null and revoked_at is null;
create unique index table_links_one_personal_link_key on public.table_links (game_id, character_id)
  where character_id is not null and revoked_at is null;
create index table_links_owner_idx on public.table_links (owner_id);

-- The investigator's notebook: free notes the keeper or player keeps between sessions.
create table public.character_notes (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  character_id  uuid not null,
  body          text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint character_notes_body_length check (char_length(btrim(body)) between 1 and 2000),
  constraint character_notes_character_fkey foreign key (character_id, owner_id)
    references public.characters (id, owner_id) on delete cascade
);

create index character_notes_character_idx on public.character_notes (character_id, created_at);
create trigger character_notes_touch before update on public.character_notes
  for each row execute function public.touch_updated_at();

-- Live points of an investigator in a game (hit points, sanity, luck, magic points).
create table public.game_points (
  game_id       uuid not null references public.games (id) on delete cascade,
  character_id  uuid not null references public.characters (id) on delete cascade,
  owner_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  pv            int,
  san           int,
  chance        int,
  pm            int,
  checks        text[] not null default '{}',
  source        text not null,
  updated_at    timestamptz not null default now(),
  primary key (game_id, character_id),
  constraint game_points_source_check check (source in ('keeper', 'phone'))
);

create index game_points_owner_idx on public.game_points (owner_id);

-- Security: the keeper sees and changes their own rows, like `players`.
alter table public.table_links enable row level security;
alter table public.character_notes enable row level security;
alter table public.game_points enable row level security;

create policy "table_links: own rows"
  on public.table_links for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "character_notes: own rows"
  on public.character_notes for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "game_points: own rows"
  on public.game_points for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Revokes a link and moves the game to a new realtime channel so devices holding the old one stop receiving.
-- Security invoker: RLS applies, so only the link's owner can do it.
create function public.revoke_table_link(p_link uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_game uuid;
begin
  update public.table_links set revoked_at = now()
  where id = p_link and revoked_at is null
  returning game_id into v_game;
  if v_game is null then
    return;
  end if;
  update public.games set channel = gen_random_uuid() where id = v_game;
end;
$$;
