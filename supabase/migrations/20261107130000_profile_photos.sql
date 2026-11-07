-- Keeper photo: the round head in the account menu and in Réglages. Same format and rules as an
-- investigator's photo (character_photo_ok, 20261107110000): a small base64 JPEG / PNG / WebP data
-- URL, cropped and shrunk in the browser. Null = no photo of their own: the app then shows the
-- keeper's Gravatar, if they have one, else their initials. Only the keeper reads and writes it.

alter table public.profiles add column photo text;
alter table public.profiles add constraint profiles_photo_check check (public.character_photo_ok(photo));

-- Keepers may change their name and photo, never is_admin.
grant update (photo) on public.profiles to authenticated;
