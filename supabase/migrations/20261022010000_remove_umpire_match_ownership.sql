-- All signed umpire sessions use the same shared access code and may score any match.
-- Keep the legacy function signature so existing Edge Function versions remain compatible.
create or replace function public.claim_match_lease(p_match_id text, p_umpire_id uuid)
returns boolean
language sql security definer set search_path = public
as $$
  select p_match_id is not null and p_umpire_id is not null;
$$;

create or replace function public.write_match_states(
  p_controller_match_id text,
  p_umpire_id uuid,
  p_updates jsonb
)
returns setof public.match_states
language plpgsql security definer set search_path = public
as $$
declare
  item jsonb;
  existing_revision bigint;
begin
  if p_controller_match_id is null or p_umpire_id is null then
    raise exception 'A signed umpire session and match ID are required' using errcode = '42501';
  end if;

  for item in select value from jsonb_array_elements(p_updates) order by value->>'matchId' loop
    perform pg_advisory_xact_lock(hashtextextended(item->>'matchId', 0));
    select revision into existing_revision from public.match_states
    where match_id = item->>'matchId' for update;
    existing_revision := coalesce(existing_revision, 0);
    if existing_revision <> (item->>'expectedRevision')::bigint then
      raise exception 'Stale match revision for %', item->>'matchId' using errcode = '40001';
    end if;
    if item->'state'->>'id' is distinct from item->>'matchId' then
      raise exception 'Match state ID does not match its record key';
    end if;
  end loop;

  for item in select value from jsonb_array_elements(p_updates) order by value->>'matchId' loop
    insert into public.match_states(match_id, state, revision, updated_at)
    values (item->>'matchId', item->'state', (item->>'expectedRevision')::bigint + 1, now())
    on conflict (match_id) do update set
      state = excluded.state,
      revision = excluded.revision,
      updated_at = excluded.updated_at;
  end loop;

  return query
    select * from public.match_states
    where match_id in (select value->>'matchId' from jsonb_array_elements(p_updates));
end;
$$;

revoke all on function public.claim_match_lease(text, uuid) from public, anon, authenticated;
revoke all on function public.write_match_states(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.claim_match_lease(text, uuid) to service_role;
grant execute on function public.write_match_states(text, uuid, jsonb) to service_role;
