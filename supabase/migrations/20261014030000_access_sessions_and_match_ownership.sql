create table if not exists public.access_sessions (
  session_id uuid primary key,
  role text not null check (role in ('umpire', 'admin')),
  active_until timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.access_sessions enable row level security;
revoke all on public.access_sessions from anon, authenticated;

create or replace function public.register_access_session(
  p_session_id uuid,
  p_role text,
  p_expires_at timestamptz
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  maximum integer;
  active_count integer;
begin
  if p_role not in ('umpire', 'admin') or p_expires_at <= now() then return false; end if;
  maximum := case when p_role = 'admin' then 2 else 5 end;
  perform pg_advisory_xact_lock(hashtextextended('access-session-' || p_role, 0));
  delete from public.access_sessions where expires_at <= now();
  select count(*) into active_count from public.access_sessions
  where role = p_role and active_until > now() and session_id <> p_session_id;
  if active_count >= maximum then return false; end if;
  insert into public.access_sessions(session_id, role, active_until, expires_at)
  values (p_session_id, p_role, least(now() + interval '10 minutes', p_expires_at), p_expires_at)
  on conflict (session_id) do update set
    role = excluded.role,
    active_until = excluded.active_until,
    expires_at = excluded.expires_at;
  return true;
end;
$$;

create or replace function public.touch_access_session(p_session_id uuid, p_role text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  maximum integer;
  active_count integer;
  session_expiry timestamptz;
begin
  maximum := case when p_role = 'admin' then 2 when p_role = 'umpire' then 5 else 0 end;
  if maximum = 0 then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('access-session-' || p_role, 0));
  select expires_at into session_expiry from public.access_sessions
  where session_id = p_session_id and role = p_role for update;
  if session_expiry is null or session_expiry <= now() then return false; end if;
  select count(*) into active_count from public.access_sessions
  where role = p_role and active_until > now() and session_id <> p_session_id;
  if active_count >= maximum then return false; end if;
  update public.access_sessions
  set active_until = least(now() + interval '10 minutes', session_expiry)
  where session_id = p_session_id;
  return true;
end;
$$;

create or replace function public.revoke_access_session(p_session_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.access_sessions where session_id = p_session_id;
  return found;
end;
$$;

create or replace function public.claim_match_lease(p_match_id text, p_umpire_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.match_leases(match_id, umpire_id, expires_at)
  values (p_match_id, p_umpire_id, now() + interval '12 hours')
  on conflict (match_id) do update set expires_at = excluded.expires_at
  where public.match_leases.umpire_id = excluded.umpire_id;
  return found;
end;
$$;

create or replace function public.renew_match_lease(p_match_id text, p_umpire_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  update public.match_leases set expires_at = now() + interval '12 hours'
  where match_id = p_match_id and umpire_id = p_umpire_id;
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
begin
  select umpire_id into lease_owner
  from public.match_leases where match_id = p_controller_match_id for update;
  if lease_owner is distinct from p_umpire_id then
    raise exception 'This match belongs to the umpire who started it' using errcode = '42501';
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

create or replace function public.admin_write_match_states(p_updates jsonb)
returns setof public.match_states
language plpgsql security definer set search_path = public
as $$
declare
  item jsonb;
  existing_revision bigint;
begin
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

create or replace function public.admin_release_match_lease(p_match_id text)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.match_leases where match_id = p_match_id;
  return found;
end;
$$;

revoke all on function public.register_access_session(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.touch_access_session(uuid, text) from public, anon, authenticated;
revoke all on function public.revoke_access_session(uuid) from public, anon, authenticated;
revoke all on function public.admin_write_match_states(jsonb) from public, anon, authenticated;
revoke all on function public.admin_release_match_lease(text) from public, anon, authenticated;
grant execute on function public.register_access_session(uuid, text, timestamptz) to service_role;
grant execute on function public.touch_access_session(uuid, text) to service_role;
grant execute on function public.revoke_access_session(uuid) to service_role;
grant execute on function public.admin_write_match_states(jsonb) to service_role;
grant execute on function public.admin_release_match_lease(text) to service_role;
