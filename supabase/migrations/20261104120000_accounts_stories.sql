-- Accounts, characters, stories (private + curated marketplace), games, AI imports.
-- Security model:
--   * Every table has RLS on. Users only ever see their own rows, plus marketplace stories.
--   * Only admins (profiles.is_admin) can create, edit or remove marketplace stories.
--   * Admins get no special read access to anyone's private stories, characters or games.
--   * is_admin can't be changed through the API: only from SQL (Studio / service role).

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Users may rename themselves but never grant themselves admin.
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_admin from public.profiles where id = (select auth.uid())), false);
$$;

-- ---------------------------------------------------------------- updated_at helper
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- stories
create type public.story_visibility as enum ('private', 'marketplace');

create table public.stories (
  id            uuid primary key default gen_random_uuid(),
  -- null for marketplace stories (they belong to the catalogue, not to an account)
  owner_id      uuid references public.profiles (id) on delete cascade,
  visibility    public.story_visibility not null default 'private',
  -- story.json (spec/story.schema.json). Validated by the app and the import function.
  content       jsonb not null,
  title         text generated always as (content #>> '{meta,title}') stored,
  lang          text generated always as (content #>> '{meta,lang}') stored,
  summary       text generated always as (content #>> '{meta,summary}') stored,
  -- set when a user copies a marketplace story to customise it
  copied_from   uuid references public.stories (id) on delete set null,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint stories_format check (content ->> 'format' = 'grimoire-story/1'),
  constraint stories_has_title check (coalesce(content #>> '{meta,title}', '') <> ''),
  constraint stories_owner_matches_visibility check (
    (visibility = 'private' and owner_id is not null) or
    (visibility = 'marketplace' and owner_id is null)
  ),
  -- Material imported from a book is marked private and must never reach the marketplace.
  constraint stories_marketplace_not_private_license check (
    visibility = 'private' or coalesce(content #>> '{meta,license}', '') <> 'private'
  )
);

create index stories_owner_idx on public.stories (owner_id);
create index stories_marketplace_idx on public.stories (lang, published_at desc) where visibility = 'marketplace';

create trigger stories_touch before update on public.stories
  for each row execute function public.touch_updated_at();

alter table public.stories enable row level security;

create policy "stories: read marketplace and own"
  on public.stories for select to authenticated
  using (visibility = 'marketplace' or owner_id = (select auth.uid()));

create policy "stories: insert own private"
  on public.stories for insert to authenticated
  with check (visibility = 'private' and owner_id = (select auth.uid()));

create policy "stories: update own private"
  on public.stories for update to authenticated
  using (visibility = 'private' and owner_id = (select auth.uid()))
  with check (visibility = 'private' and owner_id = (select auth.uid()));

create policy "stories: delete own private"
  on public.stories for delete to authenticated
  using (visibility = 'private' and owner_id = (select auth.uid()));

create policy "stories: admins manage marketplace"
  on public.stories for all to authenticated
  using (visibility = 'marketplace' and (select public.is_admin()))
  with check (visibility = 'marketplace' and owner_id is null and (select public.is_admin()));

-- ---------------------------------------------------------------- characters (investigators)
create table public.characters (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- name, occupation, characteristics, skills, hp/mp/san/luck, background, progression…
  data        jsonb not null,
  name        text generated always as (data ->> 'name') stored,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint characters_has_name check (coalesce(data ->> 'name', '') <> '')
);

create index characters_owner_idx on public.characters (owner_id);
create trigger characters_touch before update on public.characters
  for each row execute function public.touch_updated_at();

alter table public.characters enable row level security;

create policy "characters: own rows"
  on public.characters for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------- games (sessions in progress)
create table public.games (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  story_id    uuid not null references public.stories (id) on delete cascade,
  -- party, current scene, scenes done, groups, combat, log… Never story text (see STORY_FORMAT §9).
  state       jsonb not null default '{}'::jsonb,
  finished_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index games_owner_idx on public.games (owner_id, updated_at desc);
create trigger games_touch before update on public.games
  for each row execute function public.touch_updated_at();

alter table public.games enable row level security;

create policy "games: own rows"
  on public.games for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    -- can only play stories you can read
    and exists (select 1 from public.stories s where s.id = story_id)
  );

-- ---------------------------------------------------------------- AI imports
create type public.import_status as enum ('running', 'succeeded', 'failed');

-- One row per import. Used for the monthly quota, so users can read but never insert or delete:
-- only the import-story Edge Function (service role) writes here.
create table public.story_imports (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  status        public.import_status not null default 'running',
  -- pages processed so far (an import runs in several small batches)
  page_count    integer not null default 0 check (page_count >= 0),
  story_id      uuid references public.stories (id) on delete set null,
  -- accumulated ImportDraft (supabase/functions/_shared/import-draft.ts) between batches
  draft         jsonb,
  error         text,
  input_tokens  integer,
  output_tokens integer,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create index story_imports_owner_idx on public.story_imports (owner_id, created_at desc);

alter table public.story_imports enable row level security;

create policy "story_imports: read own"
  on public.story_imports for select to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------- storage: uploaded pages
-- Pages are uploaded to import-pages/<user id>/<import>/<n>.<ext>, read once by the function,
-- then deleted. Book pages are never kept on the server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('import-pages', 'import-pages', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

create policy "import-pages: upload own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'import-pages' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "import-pages: read own folder"
  on storage.objects for select to authenticated
  using (bucket_id = 'import-pages' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "import-pages: delete own folder"
  on storage.objects for delete to authenticated
  using (bucket_id = 'import-pages' and (storage.foldername(name))[1] = (select auth.uid())::text);
