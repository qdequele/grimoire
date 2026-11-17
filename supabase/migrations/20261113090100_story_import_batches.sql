-- AI import: the monthly page quota is counted per call, not per import.
--
-- Until now the quota summed story_imports.page_count over the imports CREATED this month. Pages
-- added later to an older import landed on a row the sum no longer read (unlimited imports), and a
-- call whose answer was refused, too long or unreadable was never counted although Claude was paid.
--
-- import-story now writes one row here per call, before asking Claude, dated at the call. Like
-- story_imports and ai_usage, only the Edge Function (service role) writes; keepers read their own.
create table if not exists public.story_import_batches (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  -- kept when the import row goes, so the pages stay counted
  import_id  uuid references public.story_imports (id) on delete set null,
  pages      integer not null check (pages > 0),
  -- true once the batch is merged into the import (its pages are then also in story_imports.page_count)
  saved      boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists story_import_batches_owner_idx on public.story_import_batches (owner_id, created_at desc);
create index if not exists story_import_batches_import_idx on public.story_import_batches (import_id);

alter table public.story_import_batches enable row level security;

drop policy if exists "story_import_batches: read own" on public.story_import_batches;
create policy "story_import_batches: read own"
  on public.story_import_batches for select to authenticated
  using (owner_id = (select auth.uid()));

-- Pages a keeper has used this month (UTC), for the function's quota and the Importer page.
--   · every batch sent this month, saved or not;
--   · plus, for imports created this month, the pages counted before batches were recorded
--     (page_count minus the saved batches of that import), so nobody's month restarts at zero when
--     this ships. That part is empty from the month after.
-- Security invoker: a keeper only ever sums their own rows (RLS), whatever p_owner says.
create or replace function public.import_pages_used(p_owner uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select (
    coalesce((
      select sum(b.pages)
      from public.story_import_batches b
      where b.owner_id = p_owner and b.created_at >= m.month_start
    ), 0)
    + coalesce((
      select sum(greatest(i.page_count - coalesce((
        select sum(b.pages) from public.story_import_batches b where b.import_id = i.id and b.saved
      ), 0), 0))
      from public.story_imports i
      where i.owner_id = p_owner and i.created_at >= m.month_start
    ), 0)
  )::integer
  from (select date_trunc('month', now() at time zone 'utc') at time zone 'utc' as month_start) m
$$;

revoke execute on function public.import_pages_used(uuid) from public, anon;
grant execute on function public.import_pages_used(uuid) to authenticated, service_role;
