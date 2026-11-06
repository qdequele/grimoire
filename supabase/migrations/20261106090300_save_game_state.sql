-- Player companion: the keeper's game screen saves without dropping investigators who joined from a phone.

-- Saves a game's state from the keeper's engine. The party is the engine's, plus every investigator
-- already in the row's party that the engine doesn't list yet and the keeper didn't remove
-- (companion_create_character may have added one since the keeper's last load), in their existing order.
-- Security invoker: owner RLS on games applies.
create function public.save_game_state(p_game uuid, p_state jsonb, p_removed uuid[]) returns void
language sql security invoker set search_path = '' as $$
  update public.games g
  set state = jsonb_set(
    coalesce(p_state, '{}'::jsonb), '{party}',
    (case when jsonb_typeof(p_state -> 'party') = 'array' then p_state -> 'party' else '[]'::jsonb end)
    || coalesce((
      select jsonb_agg(m.member order by m.pos)
      from jsonb_array_elements(
        case when jsonb_typeof(g.state -> 'party') = 'array' then g.state -> 'party' else '[]'::jsonb end
      ) with ordinality as m(member, pos)
      where not exists (
          select 1 from jsonb_array_elements(
            case when jsonb_typeof(p_state -> 'party') = 'array' then p_state -> 'party' else '[]'::jsonb end
          ) as e(member)
          where e.member ->> 'characterId' = m.member ->> 'characterId'
        )
        and (m.member ->> 'characterId') <> all (coalesce(p_removed, '{}')::text[])
    ), '[]'::jsonb),
    true)
  where g.id = p_game;
$$;

revoke execute on function public.save_game_state(uuid, jsonb, uuid[]) from public, anon;
grant execute on function public.save_game_state(uuid, jsonb, uuid[]) to authenticated;

-- Live points carry the server's time, whoever writes them (client clocks drift).
create function public.game_points_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger game_points_touch before insert or update on public.game_points
  for each row execute function public.game_points_touch();
