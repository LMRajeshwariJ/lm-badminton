drop function if exists public.register_access_session(uuid, text, timestamptz);
drop function if exists public.touch_access_session(uuid, text);
drop function if exists public.revoke_access_session(uuid);
drop table if exists public.access_sessions;
