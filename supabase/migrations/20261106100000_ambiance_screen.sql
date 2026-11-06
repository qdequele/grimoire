-- Ambiance screen: a TV / tablet in the middle of the table shows the current scene's living background
-- and the handouts the keeper pushes. Opened from a link (no account), read-only, like the player companion:
-- a revocable token, a security definer RPC that starts from it, and Realtime broadcast on an unguessable topic.

-- What the screen shows, written by the keeper's game screen (src/screen/state.ts, ScreenState).
-- Image URLs in it are short-lived signed URLs made by the keeper: the screen never reads Storage itself.
alter table public.games add column screen jsonb;

-- Realtime topic of the screen is `screen:<screen_channel>`. Its own topic (not the companion's), so revoking
-- the screen link doesn't disconnect the players' phones, and phones never needed the screen's events.
alter table public.games add column screen_channel uuid not null default gen_random_uuid();

create table public.screen_links (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  game_id     uuid not null,
  -- 24 random bytes, base64url without padding: 32 URL-safe characters (same as table_links).
  token       text not null unique default translate(rtrim(encode(extensions.gen_random_bytes(24), 'base64'), '='), '+/', '-_'),
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  constraint screen_links_game_fkey foreign key (game_id, owner_id)
    references public.games (id, owner_id) on delete cascade
);

create unique index screen_links_one_active_key on public.screen_links (game_id) where revoked_at is null;
create index screen_links_owner_idx on public.screen_links (owner_id);

alter table public.screen_links enable row level security;

create policy "screen_links: own rows"
  on public.screen_links for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Revokes a screen link and moves the screen to a new topic, so a screen holding the old link goes quiet
-- (its next refetch says link_invalid). Security invoker: only the link's owner can do it.
create function public.revoke_screen_link(p_link uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_game uuid;
begin
  update public.screen_links set revoked_at = now()
  where id = p_link and revoked_at is null
  returning game_id into v_game;
  if v_game is null then
    return;
  end if;
  update public.games set screen_channel = gen_random_uuid() where id = v_game;
end;
$$;

-- The screen's only way in: an active link → its game's topic and what to show. Nothing else of the game
-- (no story, no party, no state). Error: link_invalid.
create function public.screen_open(p_token text) returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object('channel', g.screen_channel, 'screen', g.screen)
  into v_result
  from public.screen_links l
  join public.games g on g.id = l.game_id and g.owner_id = l.owner_id
  where l.token = p_token and l.revoked_at is null;
  if v_result is null then
    raise exception 'link_invalid';
  end if;
  return v_result;
end;
$$;

-- Pushes every change of what the screen shows to its topic. Broadcasting must never make a save fail.
create function public.games_screen_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform realtime.send(coalesce(new.screen, '{}'::jsonb), 'screen', 'screen:' || new.screen_channel::text, false);
  exception when others then
    raise warning 'screen broadcast failed: %', sqlerrm;
  end;
  return null;
end;
$$;

create trigger games_screen_broadcast after update of screen on public.games
  for each row when (old.screen is distinct from new.screen)
  execute function public.games_screen_changed();

revoke execute on function public.screen_open(text) from public;
revoke execute on function public.games_screen_changed() from public, anon, authenticated;
revoke execute on function public.revoke_screen_link(uuid) from public, anon;
grant execute on function public.screen_open(text) to anon, authenticated;
grant execute on function public.revoke_screen_link(uuid) to authenticated;

-- Pictures the keeper pushes during a game (uploaded from disk): <owner id>/<game id>/<file>. Private:
-- the keeper's game screen signs them for the ambiance screen.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('screen-images', 'screen-images', false, 15728640,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
on conflict (id) do nothing;

create policy "screen-images: read own"
  on storage.objects for select to authenticated
  using (bucket_id = 'screen-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "screen-images: write own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'screen-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "screen-images: delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'screen-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
