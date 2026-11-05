-- Players: the people the keeper plays with. They have no account, just a first name, and play
-- investigators that keep their progression (characters.data.progress) from one game to the next.

create table public.players (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  constraint players_name_not_blank check (btrim(name) <> ''),
  -- Lets characters point to (player, owner): a character can only belong to its keeper's players.
  constraint players_id_owner_key unique (id, owner_id)
);

create unique index players_owner_name_key on public.players (owner_id, lower(btrim(name)));

alter table public.players enable row level security;

create policy "players: own rows"
  on public.players for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Who plays this investigator. Deleting the player leaves the investigator "without player".
alter table public.characters add column player_id uuid;
alter table public.characters
  add constraint characters_player_fkey foreign key (player_id, owner_id)
  references public.players (id, owner_id) on delete set null (player_id);
create index characters_player_idx on public.characters (player_id);

-- Existing investigators had the player's name in data.player: turn those names into players.
insert into public.players (owner_id, name)
select distinct on (owner_id, lower(btrim(data ->> 'player'))) owner_id, btrim(data ->> 'player')
from public.characters
where btrim(coalesce(data ->> 'player', '')) <> ''
order by owner_id, lower(btrim(data ->> 'player')), created_at;

update public.characters c
set player_id = p.id, data = c.data - 'player'
from public.players p
where p.owner_id = c.owner_id and lower(p.name) = lower(btrim(c.data ->> 'player'));

update public.characters set data = data - 'player' where data ? 'player';
