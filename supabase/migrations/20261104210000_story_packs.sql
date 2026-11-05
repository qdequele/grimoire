-- Every story also exists as a story pack (spec/STORY_FORMAT.md) in Storage:
--   story-packs/<owner id>/<story id>/story.json, images/…, sounds/…   private stories
--   story-packs/marketplace/<story id>/…                              marketplace stories
-- stories.content stays the copy the app reads; the pack is the keeper's files, downloadable and
-- re-importable, with the assets (images, sounds) the database doesn't hold.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'story-packs', 'story-packs', false, 52428800,
  array['application/json', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml',
        'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'application/pdf', 'text/plain', 'text/markdown',
        'application/octet-stream']
);

create policy "story-packs: read own and marketplace"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'story-packs'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (storage.foldername(name))[1] = 'marketplace')
  );

create policy "story-packs: write own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'story-packs' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "story-packs: update own"
  on storage.objects for update to authenticated
  using (bucket_id = 'story-packs' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'story-packs' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "story-packs: delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'story-packs' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "story-packs: admins write marketplace"
  on storage.objects for all to authenticated
  using (bucket_id = 'story-packs' and (storage.foldername(name))[1] = 'marketplace' and (select public.is_admin()))
  with check (bucket_id = 'story-packs' and (storage.foldername(name))[1] = 'marketplace' and (select public.is_admin()));

-- Files of the pack besides story.json (paths inside the pack), so the app can list and download
-- them without walking Storage folders.
alter table public.stories add column pack_files text[] not null default '{}';
