-- Feedback: the daily limit counted rows by created_at, a column the keeper could send. A backdated
-- row was never counted (no limit at all), and a future date pinned a message at the top of the
-- admins' inbox, which is ordered by created_at.
-- The trigger now stamps a keeper's row with the server's time before it counts. Admins (unlimited,
-- as before) and the service role (no signed-in user: maintenance, restores) keep the date they give.
-- Re-runnable; the trigger itself (20261110090000_feedback.sql) is unchanged.
create or replace function public.feedback_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if (select auth.uid()) is not null then
    new.created_at := now();
  end if;
  if (select count(*) from public.feedback
      where owner_id = new.owner_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'feedback_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
