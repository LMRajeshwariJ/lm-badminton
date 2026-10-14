create table if not exists public.match_states (
  match_id text primary key,
  state jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.match_leases (
  match_id text primary key,
  umpire_id uuid not null,
  expires_at timestamptz not null
);

create table if not exists public.umpire_attempt_windows (
  ip_hash text primary key,
  window_started_at timestamptz not null,
  attempts integer not null default 0
);

alter table public.match_states enable row level security;
alter table public.match_leases enable row level security;
alter table public.umpire_attempt_windows enable row level security;

drop policy if exists "Match scores are publicly readable" on public.match_states;
create policy "Match scores are publicly readable"
  on public.match_states for select to anon, authenticated using (true);

revoke all on public.match_states from anon, authenticated;
grant select on public.match_states to anon, authenticated;
revoke all on public.match_leases from anon, authenticated;
revoke all on public.umpire_attempt_windows from anon, authenticated;

create or replace function public.register_umpire_attempt(p_ip_hash text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare current_window public.umpire_attempt_windows%rowtype;
begin
  insert into public.umpire_attempt_windows(ip_hash, window_started_at, attempts)
  values (p_ip_hash, now(), 1)
  on conflict (ip_hash) do update set
    window_started_at = case
      when public.umpire_attempt_windows.window_started_at < now() - interval '15 minutes' then now()
      else public.umpire_attempt_windows.window_started_at
    end,
    attempts = case
      when public.umpire_attempt_windows.window_started_at < now() - interval '15 minutes' then 1
      else public.umpire_attempt_windows.attempts + 1
    end
  returning * into current_window;
  return current_window.attempts <= 10;
end;
$$;

create or replace function public.claim_match_lease(p_match_id text, p_umpire_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.match_leases(match_id, umpire_id, expires_at)
  values (p_match_id, p_umpire_id, now() + interval '2 minutes')
  on conflict (match_id) do update set umpire_id = excluded.umpire_id, expires_at = excluded.expires_at
  where public.match_leases.expires_at <= now() or public.match_leases.umpire_id = excluded.umpire_id;
  return found;
end;
$$;

create or replace function public.renew_match_lease(p_match_id text, p_umpire_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  update public.match_leases set expires_at = now() + interval '2 minutes'
  where match_id = p_match_id and umpire_id = p_umpire_id and expires_at > now();
  return found;
end;
$$;

create or replace function public.release_match_lease(p_match_id text, p_umpire_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.match_leases where match_id = p_match_id and umpire_id = p_umpire_id;
  return found;
end;
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
  lease_owner uuid;
  lease_expiry timestamptz;
begin
  select umpire_id, expires_at into lease_owner, lease_expiry
  from public.match_leases where match_id = p_controller_match_id for update;
  if lease_owner is distinct from p_umpire_id or lease_expiry <= now() then
    raise exception 'Match control lease expired or belongs to another umpire' using errcode = '42501';
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

  update public.match_leases set expires_at = now() + interval '2 minutes'
  where match_id = p_controller_match_id and umpire_id = p_umpire_id;

  return query
    select * from public.match_states
    where match_id in (select value->>'matchId' from jsonb_array_elements(p_updates));
end;
$$;

revoke all on function public.register_umpire_attempt(text) from public, anon, authenticated;
revoke all on function public.claim_match_lease(text, uuid) from public, anon, authenticated;
revoke all on function public.renew_match_lease(text, uuid) from public, anon, authenticated;
revoke all on function public.release_match_lease(text, uuid) from public, anon, authenticated;
revoke all on function public.write_match_states(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.register_umpire_attempt(text) to service_role;
grant execute on function public.claim_match_lease(text, uuid) to service_role;
grant execute on function public.renew_match_lease(text, uuid) to service_role;
grant execute on function public.release_match_lease(text, uuid) to service_role;
grant execute on function public.write_match_states(text, uuid, jsonb) to service_role;

do $$ begin
  alter publication supabase_realtime add table public.match_states;
exception when duplicate_object then null;
end $$;
