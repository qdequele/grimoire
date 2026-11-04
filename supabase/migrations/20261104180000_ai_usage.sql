-- Small AI helpers (profile suggestions, later the narrator): one row per call, for monthly limits.
-- Like story_imports, only Edge Functions (service role) write here; users can read their own rows.
create table public.ai_usage (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  kind          text not null check (kind in ('profile')),
  input_tokens  integer,
  output_tokens integer,
  created_at    timestamptz not null default now()
);

create index ai_usage_owner_kind_idx on public.ai_usage (owner_id, kind, created_at desc);

alter table public.ai_usage enable row level security;

create policy "ai_usage: read own"
  on public.ai_usage for select to authenticated
  using (owner_id = (select auth.uid()));
