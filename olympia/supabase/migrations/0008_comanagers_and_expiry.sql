-- =====================================================================================
-- Olympia Controller - co-managers of a room, and rooms that last 4 hours.
-- Run AFTER 0001-0007. Safe to re-run.
--
-- Co-managers
--   The owner lists e-mails in the lobby ("Người cùng quản lý"). Those people sign in like any
--   manager (an invited e-mail may sign in even if BTC has not added it to manager_allowlist),
--   see the room in their own lobby and run its control panel. Only the owner deletes the room,
--   frees seats, edits who co-manages, and picks its question set.
--
-- Expiry
--   A room can be used for 4 hours after it is created (expires_at). After that no screen can
--   join its channels, the stage cannot take it and players cannot join; expired rooms are
--   deleted (purge_expired_rooms: called by the lobby, and hourly by pg_cron when available).
-- =====================================================================================

-- ---------- helpers ----------------------------------------------------------------------

create or replace function public.my_email() returns text
language sql stable set search_path = '' as $$
	select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- ---------- 1. expiry ----------------------------------------------------------------------

alter table public.rooms add column if not exists expires_at timestamptz;
update public.rooms set expires_at = greatest(created_at, now()) + interval '4 hours' where expires_at is null;
alter table public.rooms alter column expires_at set default now() + interval '4 hours';
alter table public.rooms alter column expires_at set not null;
grant select (expires_at) on public.rooms to authenticated;

-- ---------- 2. co-managers -----------------------------------------------------------------

create table if not exists public.room_managers (
	room_id  uuid not null references public.rooms (id) on delete cascade,
	email    text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
	added_at timestamptz not null default now(),
	primary key (room_id, email)
);
alter table public.room_managers enable row level security;

-- security definer: rooms <-> room_managers policies would otherwise call each other forever
create or replace function public.is_room_owner_id(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
	select exists (select 1 from public.rooms r where r.id = p_room and r.owner_id = auth.uid())
$$;
create or replace function public.is_room_comanager_id(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
	select public.is_manager() and exists (select 1 from public.room_managers m where m.room_id = p_room and m.email = public.my_email())
$$;
revoke execute on function public.is_room_owner_id(uuid) from public, anon;
revoke execute on function public.is_room_comanager_id(uuid) from public, anon;
grant  execute on function public.is_room_owner_id(uuid) to authenticated;
grant  execute on function public.is_room_comanager_id(uuid) to authenticated;

drop policy if exists "owner manages co-managers" on public.room_managers;
drop policy if exists "invited sees own invitations" on public.room_managers;
create policy "owner manages co-managers" on public.room_managers for all to authenticated
	using (public.is_room_owner_id(room_id)) with check (public.is_room_owner_id(room_id));
create policy "invited sees own invitations" on public.room_managers for select to authenticated
	using (email = public.my_email());
grant select, insert, delete on public.room_managers to authenticated;

-- a co-manager sees the room (and its seats) in the lobby
drop policy if exists "co-manager reads rooms" on public.rooms;
create policy "co-manager reads rooms" on public.rooms for select to authenticated using (public.is_room_comanager_id(id));
drop policy if exists "co-manager reads seats" on public.room_players;
create policy "co-manager reads seats" on public.room_players for select to authenticated using (public.is_room_comanager_id(room_id));

-- an invited e-mail may create its account (the before_user_created hook of 0001, extended)
create or replace function public.before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
	u jsonb := event -> 'user';
	v_email text := lower(coalesce(u ->> 'email', ''));
begin
	if coalesce((u ->> 'is_anonymous')::boolean, false) then
		return '{}'::jsonb;
	end if;
	if exists (select 1 from public.manager_allowlist a where a.email = v_email)
		or exists (select 1 from public.room_managers m join public.rooms r on r.id = m.room_id where m.email = v_email and r.expires_at > now()) then
		return '{}'::jsonb;
	end if;
	return jsonb_build_object('error', jsonb_build_object(
		'http_code', 403,
		'message', 'Tài khoản quản lý chỉ do BTC cấp - email này chưa được cho phép.'));
end $$;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.before_user_created(jsonb) from public, anon, authenticated;

-- ---------- 3. the realtime / room checks, now with co-managers and expiry -----------------

create or replace function public.rt_room_exists(p_topic text) returns boolean
language sql stable security definer set search_path = '' as $$
	select exists (select 1 from public.rooms r where r.code = split_part(p_topic, ':', 2) and r.expires_at > now())
$$;
-- "owner" topics (ctl / ops): the owner or a co-manager of a room still in use
create or replace function public.rt_is_owner(p_topic text) returns boolean
language sql stable security definer set search_path = '' as $$
	select exists (select 1 from public.rooms r where r.code = split_part(p_topic, ':', 2) and r.expires_at > now()
		and (r.owner_id = auth.uid() or public.is_room_comanager_id(r.id)))
$$;

create or replace function public.is_room_owner_or_stage(p_room public.rooms) returns boolean
language sql stable security definer set search_path = '' as $$
	select auth.uid() is not null and (p_room.owner_id = auth.uid() or public.is_room_comanager_id(p_room.id)
		or (p_room.stage_uid = auth.uid() and p_room.stage_seen_at > now() - interval '30 seconds'))
$$;

create or replace function public.claim_stage(p_code text, p_instance text) returns text
language plpgsql security definer set search_path = '' as $$
declare
	v_code text := upper(trim(coalesce(p_code, '')));
	v_inst text := left(coalesce(p_instance, ''), 64);
begin
	if auth.uid() is null or v_inst = '' then return 'taken'; end if;
	if exists (select 1 from public.rooms where code = v_code and expires_at <= now()) then return 'expired'; end if;
	update public.rooms set stage_uid = auth.uid(), stage_instance = v_inst, stage_seen_at = now()
		where code = v_code
			and (stage_uid is null
				or (stage_uid = auth.uid() and stage_instance is not distinct from v_inst)
				or stage_seen_at < now() - interval '30 seconds');
	if found then return 'ok'; end if;
	if exists (select 1 from public.rooms where code = v_code) then return 'taken'; end if;
	return 'no_room';
end $$;

create or replace function public.release_stage(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
begin
	update public.rooms r set stage_uid = null, stage_instance = null, stage_seen_at = null
		where r.code = upper(trim(p_code)) and (r.owner_id = auth.uid() or public.is_room_comanager_id(r.id));
end $$;

create or replace function public.clear_game_state(p_code text) returns void
language sql security definer set search_path = '' as $$
	update public.rooms r set game_state = null, game_state_at = null
		where r.code = upper(trim(coalesce(p_code, ''))) and (r.owner_id = auth.uid() or public.is_room_comanager_id(r.id))
$$;

-- players cannot join an expired room (same function as 0001, with the expiry check)
create or replace function public.join_as_player(p_code text, p_password text, p_seat int) returns text
language plpgsql security definer set search_path = '' as $$
declare
	v_uid  uuid := auth.uid();
	v_room public.rooms;
	v_held uuid;
begin
	if v_uid is null then return 'no_auth'; end if;
	if p_seat is null or p_seat not between 1 and 4 then return 'bad_seat'; end if;
	select * into v_room from public.rooms where code = upper(trim(coalesce(p_code, '')));
	if not found then return 'no_room'; end if;
	if v_room.expires_at <= now() then return 'expired'; end if;
	if (select count(*) from public.join_failures f where f.user_id = v_uid and f.at > now() - interval '10 minutes') >= 10 then
		return 'throttled';
	end if;
	if v_room.player_password_hash <> extensions.crypt(coalesce(p_password, ''), v_room.player_password_hash) then
		insert into public.join_failures (user_id) values (v_uid);
		return 'bad_password';
	end if;
	delete from public.room_players where room_id = v_room.id and user_id = v_uid and seat <> p_seat;
	insert into public.room_players (room_id, seat, user_id) values (v_room.id, p_seat, v_uid)
		on conflict (room_id, seat) do nothing;
	select user_id into v_held from public.room_players where room_id = v_room.id and seat = p_seat;
	if v_held is distinct from v_uid then return 'seat_taken'; end if;
	return 'ok';
end $$;

-- ---------- 4. deleting expired rooms ------------------------------------------------------

create or replace function public.purge_expired_rooms() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
	delete from public.rooms r where r.expires_at <= now();
	get diagnostics n = row_count;
	delete from public.player_actions a where not exists (select 1 from public.rooms r where r.code = a.room_code);
	delete from public.join_failures f where f.at < now() - interval '1 day';
	delete from public.login_failures f where f.at < now() - interval '1 day';
	return n;
end $$;
revoke execute on function public.purge_expired_rooms() from public, anon;
grant  execute on function public.purge_expired_rooms() to authenticated;

-- hourly, when pg_cron is enabled on the project (Database -> Extensions); otherwise the lobby does it
do $$ begin
	perform cron.schedule('olympia-purge-expired-rooms', '5 * * * *', 'select public.purge_expired_rooms()');
exception when others then
	raise notice 'pg_cron not available - expired rooms are deleted when a manager opens the lobby';
end $$;
