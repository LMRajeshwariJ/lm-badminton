create table if not exists public.tournament_config (
  id text primary key check (id = 'main'),
  state jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.tournament_config enable row level security;
drop policy if exists "Tournament settings are publicly readable" on public.tournament_config;
create policy "Tournament settings are publicly readable"
  on public.tournament_config for select to anon, authenticated using (true);
revoke all on public.tournament_config from anon, authenticated;
grant select on public.tournament_config to anon, authenticated;

create or replace function public.admin_write_tournament_state(p_config jsonb, p_updates jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  item jsonb;
  current_config_revision bigint;
  existing_revision bigint;
  next_config_revision bigint;
  changed_matches jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('tournament-config-main', 0));
  select revision into current_config_revision from public.tournament_config where id = 'main' for update;
  current_config_revision := coalesce(current_config_revision, 0);
  if current_config_revision <> (p_config->>'expectedRevision')::bigint then
    raise exception 'Stale tournament configuration revision' using errcode = '40001';
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb)) order by value->>'matchId' loop
    perform pg_advisory_xact_lock(hashtextextended(item->>'matchId', 0));
    select revision into existing_revision from public.match_states where match_id = item->>'matchId' for update;
    existing_revision := coalesce(existing_revision, 0);
    if existing_revision <> (item->>'expectedRevision')::bigint then
      raise exception 'Stale match revision for %', item->>'matchId' using errcode = '40001';
    end if;
    if item->'state'->>'id' is distinct from item->>'matchId' then
      raise exception 'Match state ID does not match its record key';
    end if;
  end loop;

  next_config_revision := current_config_revision + 1;
  insert into public.tournament_config(id, state, revision, updated_at)
  values ('main', p_config->'state', next_config_revision, now())
  on conflict (id) do update set state = excluded.state, revision = excluded.revision, updated_at = excluded.updated_at;

  for item in select value from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb)) order by value->>'matchId' loop
    insert into public.match_states(match_id, state, revision, updated_at)
    values (item->>'matchId', item->'state', (item->>'expectedRevision')::bigint + 1, now())
    on conflict (match_id) do update set state = excluded.state, revision = excluded.revision, updated_at = excluded.updated_at;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb) into changed_matches
  from (
    select match_id, state, revision, updated_at
    from public.match_states
    where match_id in (select value->>'matchId' from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb)))
  ) row_data;

  return jsonb_build_object('matches', changed_matches, 'configRevision', next_config_revision);
end;
$$;

revoke all on function public.admin_write_tournament_state(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.admin_write_tournament_state(jsonb, jsonb) to service_role;

do $$ begin
  alter publication supabase_realtime add table public.tournament_config;
exception when duplicate_object then null;
end $$;
