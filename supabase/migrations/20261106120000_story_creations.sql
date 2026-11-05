-- Story creator: the keeper's answers → an outline → scenes written a few at a time by the
-- create-story Edge Function. Like story_imports, only the function (service role) writes here;
-- the keeper reads their own rows (to resume a creation, and for the monthly count).
create table public.story_creations (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  -- outlined: waiting for the keeper's review · writing: scenes in progress · succeeded · failed
  status        text not null default 'outlined' check (status in ('outlined', 'writing', 'succeeded', 'failed')),
  -- StoryBrief (supabase/functions/_shared/story-create.ts)
  brief         jsonb not null,
  -- StoryOutline, as reviewed by the keeper
  outline       jsonb,
  -- outlines written for this creation (first one + regenerations), capped by the function
  outline_count integer not null default 0 check (outline_count >= 0),
  -- accumulated ImportDraft between scene batches
  draft         jsonb,
  story_id      uuid references public.stories (id) on delete set null,
  error         text,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create index story_creations_owner_idx on public.story_creations (owner_id, created_at desc);

alter table public.story_creations enable row level security;

create policy "story_creations: read own"
  on public.story_creations for select to authenticated
  using (owner_id = (select auth.uid()));

-- "Inspire me" in the creator is a small AI call, counted like the profile suggestions.
alter table public.ai_usage drop constraint ai_usage_kind_check;
alter table public.ai_usage add constraint ai_usage_kind_check check (kind in ('profile', 'narrator', 'story-ideas'));
