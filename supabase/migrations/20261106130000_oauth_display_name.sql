-- Google and Apple sign-in: accounts made through a provider have no display_name in their
-- metadata (the sign-up form sets it); take the provider's name before falling back to the
-- e-mail's local part (for Apple's private relay addresses, a random string).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(
      new.raw_user_meta_data ->> 'display_name', -- the sign-up form's, even empty: unchanged
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1),
      ''
    ), 60)
  );
  return new;
end;
$$;
