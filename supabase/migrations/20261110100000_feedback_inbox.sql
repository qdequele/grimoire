-- Admins' feedback inbox: the feedback rows with who sent them (display name and account e-mail,
-- which only auth.users holds, so the browser can't join it itself). Admins only.
create function public.feedback_inbox(p_status text default null, p_kind text default null, p_limit integer default 200)
returns table (
  id           uuid,
  created_at   timestamptz,
  kind         text,
  message      text,
  page         text,
  lang         text,
  user_agent   text,
  contact_ok   boolean,
  status       text,
  owner_id     uuid,
  display_name text,
  email        text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select f.id, f.created_at, f.kind, f.message, f.page, f.lang, f.user_agent, f.contact_ok, f.status,
           f.owner_id, p.display_name, u.email::text
    from public.feedback f
    left join public.profiles p on p.id = f.owner_id
    left join auth.users u on u.id = f.owner_id
    where (p_status is null or f.status = p_status)
      and (p_kind is null or f.kind = p_kind)
    order by f.created_at desc
    limit least(greatest(coalesce(p_limit, 200), 1), 500);
end;
$$;

revoke execute on function public.feedback_inbox(text, text, integer) from public, anon;
grant execute on function public.feedback_inbox(text, text, integer) to authenticated;
