-- `items` hints that say what changed when only a card's uses did (F60).
--
-- Every use spent or regained used to send `{ characterId }`, and every phone answered it by reading
-- the whole companion_open view again (sheets, photos, notes, every card). Now:
--   * an update that changes nothing (a tap against 0 or the card's capacity: only updated_at moves)
--     sends no hint;
--   * an update that changes only `uses` sends `{ characterId, itemId, uses, updatedAt }`, which phones
--     show as is (clamped to the card, display only: the topic is public);
--   * anything else (a card given, removed, edited, its condition) still sends `{ characterId }`.
-- Old clients ignore the extra fields and keep refetching, so this is safe to ship before the site.

create or replace function public.character_items_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_character uuid := case when tg_op = 'DELETE' then old.character_id else new.character_id end;
  v_owner uuid := case when tg_op = 'DELETE' then old.owner_id else new.owner_id end;
  v_payload jsonb := jsonb_build_object('characterId', v_character);
  v_game record;
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(old) - 'updated_at') = (to_jsonb(new) - 'updated_at') then
      return null;
    end if;
    if (to_jsonb(old) - 'updated_at' - 'uses') = (to_jsonb(new) - 'updated_at' - 'uses') then
      v_payload := v_payload || jsonb_build_object('itemId', new.id, 'uses', new.uses, 'updatedAt', new.updated_at);
    end if;
  end if;
  for v_game in
    select g.channel from public.games g
    where g.finished_at is null
      and g.owner_id = v_owner
      and jsonb_typeof(g.state -> 'party') = 'array'
      and g.state -> 'party' @> jsonb_build_array(jsonb_build_object('characterId', v_character))
  loop
    perform public.companion_broadcast(v_game.channel, 'items', v_payload);
  end loop;
  return null;
end;
$$;

revoke execute on function public.character_items_changed() from public, anon, authenticated;
