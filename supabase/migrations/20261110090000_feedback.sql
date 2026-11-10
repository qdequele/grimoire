-- Feedback: keepers tell us what's broken, what they'd like, what they love. Sent from the app
-- (account menu → "Donner mon avis"), read by admins (Studio, SQL or any admin screen later).
create table public.feedback (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- bug · idea (a feature request) · praise · other
  kind        text not null check (kind in ('bug', 'idea', 'praise', 'other')),
  message     text not null,
  -- Where the keeper was when they wrote it (path + query, no origin), and in which language.
  page        text,
  lang        text check (lang in ('fr', 'en')),
  user_agent  text,
  -- The keeper agrees to be answered at their account's e-mail address.
  contact_ok  boolean not null default false,
  -- Admins' triage: new → read → done.
  status      text not null default 'new' check (status in ('new', 'read', 'done')),
  created_at  timestamptz not null default now(),
  constraint feedback_message_length check (char_length(btrim(message)) between 1 and 4000),
  constraint feedback_page_length check (page is null or char_length(page) <= 500),
  constraint feedback_user_agent_length check (user_agent is null or char_length(user_agent) <= 500)
);

create index feedback_created_idx on public.feedback (created_at desc);
create index feedback_owner_idx on public.feedback (owner_id, created_at desc);

alter table public.feedback enable row level security;

-- Keepers send feedback as themselves, always as "new"; they can read what they sent, never edit it.
create policy "feedback: send own"
  on public.feedback for insert to authenticated
  with check (owner_id = (select auth.uid()) and status = 'new');

create policy "feedback: read own"
  on public.feedback for select to authenticated
  using (owner_id = (select auth.uid()));

-- Admins read everything and move it through triage.
create policy "feedback: admins read"
  on public.feedback for select to authenticated
  using ((select public.is_admin()));

create policy "feedback: admins triage"
  on public.feedback for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Admins may only change the status: the keeper's words stay as they were sent.
revoke update on public.feedback from authenticated;
grant update (status) on public.feedback to authenticated;

-- No spam: at most 20 messages per keeper per day (admins unlimited).
create function public.feedback_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if (select count(*) from public.feedback
      where owner_id = new.owner_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'feedback_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger feedback_rate_limit
  before insert on public.feedback
  for each row execute function public.feedback_rate_limit();
