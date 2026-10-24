-- =====================================================================================
-- Olympia Controller - Phase 2: manager accounts, rooms, player seats, realtime access.
-- Paste the whole file into Supabase Dashboard -> SQL Editor and run it once.
-- Safe to re-run: every object is created with "if not exists" / "or replace" / drop first.
--
-- Who is who:
--   manager  a permanent account (email/username + password, or Google on the same email).
--            Nobody can sign up on their own: the email must be in manager_allowlist first
--            (enforced by the before_user_created auth hook below).
--   anyone   stage / audience / podium / player pages sign in ANONYMOUSLY. A room code is
--            enough to watch; a player also needs the room's player password (4-20 chars).
--
-- Realtime topics (private channels), CODE = room code:
--   ctl:CODE  key / cmd from the control panel      -> stage    send: owner        join: owner, stage
--   ops:CODE  full state (has the answers)          -> panel    send: stage        join: owner, stage
--   pub:CODE  public state (no answers) + presence  -> everyone send: stage        join: anyone
--   hi:CODE   "hello, send me the state"            -> stage    send: anyone       join: anyone
-- =====================================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- helpers -------------------------------------------------------------------

-- a permanent (non-anonymous) signed-in user = a manager (only allowlisted people can exist)
create or replace function public.is_manager() returns boolean
language sql stable set search_path = '' as $$
	select auth.uid() is not null
		and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) = false
$$;

-- ---------- 1. manager allowlist + sign-up gate ---------------------------------------

create table if not exists public.manager_allowlist (
	email    text primary key check (email = lower(email)),
	note     text,
	added_at timestamptz not null default now()
);
alter table public.manager_allowlist enable row level security;   -- no policies: SQL Editor only

-- Auth hook "Before User Created": anonymous users always pass; anyone else (email sign-up,
-- Google, dashboard "Add user") must be on the allowlist.
create or replace function public.before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
	u jsonb := event -> 'user';
begin
	if coalesce((u ->> 'is_anonymous')::boolean, false) then
		return '{}'::jsonb;
	end if;
	if exists (select 1 from public.manager_allowlist a where a.email = lower(coalesce(u ->> 'email', ''))) then
		return '{}'::jsonb;
	end if;
	return jsonb_build_object('error', jsonb_build_object(
		'http_code', 403,
		'message', 'Tài khoản quản lý chỉ do BTC cấp - email này chưa được cho phép.'));
end $$;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.before_user_created(jsonb) from public, anon, authenticated;

-- ---------- 2. usernames (log in with a username instead of the email) -------------------

create table if not exists public.profiles (
	user_id    uuid primary key references auth.users (id) on delete cascade,
	username   text not null unique check (username ~ '^[a-z0-9_.-]{3,32}$'),
	created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.profiles from anon, authenticated;

create table if not exists public.login_failures (
	login text        not null,
	at    timestamptz not null default now()
);
create index if not exists login_failures_login_at on public.login_failures (login, at);
alter table public.login_failures enable row level security;

-- username + password -> the account's email, ONLY when the password is right (so emails cannot
-- be harvested). The page then signs in normally with that email. 10 wrong tries / 15 min.
create or replace function public.login_email(p_username text, p_password text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
	v_login text := lower(trim(coalesce(p_username, '')));
	v_email text;
	v_hash  text;
begin
	if (select count(*) from public.login_failures f where f.login = v_login and f.at > now() - interval '15 minutes') >= 10 then
		return jsonb_build_object('error', 'throttled');
	end if;
	select u.email, u.encrypted_password into v_email, v_hash
		from public.profiles p join auth.users u on u.id = p.user_id
		where p.username = v_login;
	if v_hash is null or v_hash = '' or v_hash <> extensions.crypt(coalesce(p_password, ''), v_hash) then
		insert into public.login_failures (login) values (v_login);
		return jsonb_build_object('error', 'invalid');
	end if;
	return jsonb_build_object('email', v_email);
end $$;
revoke execute on function public.login_email(text, text) from public;
grant execute on function public.login_email(text, text) to anon, authenticated;

-- ---------- 3. rooms --------------------------------------------------------------------

create table if not exists public.rooms (
	id                   uuid primary key default gen_random_uuid(),
	code                 text not null unique check (code ~ '^[A-Z0-9]{4,12}$'),
	name                 text not null default '' check (char_length(name) <= 80),
	owner_id             uuid not null references auth.users (id) on delete cascade,
	player_password_hash text not null,
	stage_uid            uuid,          -- the one stage page allowed to run this room's game
	stage_seen_at        timestamptz,   -- its last heartbeat; a stage silent for 30 s can be replaced
	created_at           timestamptz not null default now()
);
alter table public.rooms enable row level security;
drop policy if exists "owner reads rooms" on public.rooms;
drop policy if exists "owner deletes rooms" on public.rooms;
create policy "owner reads rooms"   on public.rooms for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner deletes rooms" on public.rooms for delete to authenticated using (owner_id = (select auth.uid()));
-- the password hash is never readable; rows are created / changed only through the functions below
revoke select, insert, update on public.rooms from anon, authenticated;
grant select (id, code, name, owner_id, stage_uid, stage_seen_at, created_at) on public.rooms to authenticated;

-- room code alphabet without look-alikes (no 0/O, 1/I)
create or replace function public.create_room(p_name text, p_password text) returns text
language plpgsql security definer set search_path = '' as $$
declare
	alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	v_code text;
	i      int;
begin
	if not public.is_manager() then raise exception 'not_manager' using errcode = '42501'; end if;
	if char_length(coalesce(p_password, '')) not between 4 and 20 then raise exception 'bad_password_length'; end if;
	loop
		v_code := '';
		for i in 1..6 loop
			v_code := v_code || substr(alphabet, 1 + get_byte(extensions.gen_random_bytes(1), 0) % 32, 1);
		end loop;
		begin
			insert into public.rooms (code, name, owner_id, player_password_hash)
				values (v_code, left(trim(coalesce(p_name, '')), 80), auth.uid(),
					extensions.crypt(p_password, extensions.gen_salt('bf')));
			return v_code;
		exception when unique_violation then
			-- code already used: draw another
		end;
	end loop;
end $$;

create or replace function public.set_room_password(p_code text, p_password text) returns void
language plpgsql security definer set search_path = '' as $$
begin
	if char_length(coalesce(p_password, '')) not between 4 and 20 then raise exception 'bad_password_length'; end if;
	update public.rooms set player_password_hash = extensions.crypt(p_password, extensions.gen_salt('bf'))
		where code = upper(trim(p_code)) and owner_id = auth.uid();
	if not found then raise exception 'no_room' using errcode = '42501'; end if;
end $$;

-- ---------- 4. the stage: one page per room runs the game --------------------------------

-- Called by the stage page before it connects, then every 10 s as a heartbeat:
--   ok = this page is (still) the room's stage | taken = another stage page has it | no_room
-- Another page can take over only after 30 s of silence, or after the owner releases it.
drop function if exists public.claim_stage(text);
create or replace function public.claim_stage(p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare
	v_code text := upper(trim(coalesce(p_code, '')));
begin
	if auth.uid() is null then return 'taken'; end if;
	update public.rooms set stage_uid = auth.uid(), stage_seen_at = now()
		where code = v_code
			and (stage_uid is null or stage_uid = auth.uid() or stage_seen_at < now() - interval '30 seconds');
	if found then return 'ok'; end if;
	if exists (select 1 from public.rooms where code = v_code) then return 'taken'; end if;
	return 'no_room';
end $$;

create or replace function public.release_stage(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
begin
	update public.rooms set stage_uid = null, stage_seen_at = null
		where code = upper(trim(p_code)) and owner_id = auth.uid();
end $$;

-- ---------- 5. player seats ----------------------------------------------------------------

create table if not exists public.room_players (
	room_id   uuid not null references public.rooms (id) on delete cascade,
	seat      smallint not null check (seat between 1 and 4),
	user_id   uuid not null references auth.users (id) on delete cascade,
	joined_at timestamptz not null default now(),
	primary key (room_id, seat),
	unique (room_id, user_id)
);
alter table public.room_players enable row level security;
drop policy if exists "owner or self reads seats" on public.room_players;
drop policy if exists "owner or self frees seats" on public.room_players;
create policy "owner or self reads seats" on public.room_players for select to authenticated using (
	user_id = (select auth.uid())
	or exists (select 1 from public.rooms r where r.id = room_id and r.owner_id = (select auth.uid())));
create policy "owner or self frees seats" on public.room_players for delete to authenticated using (
	user_id = (select auth.uid())
	or exists (select 1 from public.rooms r where r.id = room_id and r.owner_id = (select auth.uid())));
revoke insert, update on public.room_players from anon, authenticated;

create table if not exists public.join_failures (
	user_id uuid        not null,
	at      timestamptz not null default now()
);
create index if not exists join_failures_user_at on public.join_failures (user_id, at);
alter table public.join_failures enable row level security;

-- Player page: room code + player password + seat. Returns a status word (not an exception, so
-- the failure count survives): ok | no_auth | bad_seat | no_room | throttled | bad_password | seat_taken
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

-- the seat this browser holds in a room (null = none), for the player page after a reload
create or replace function public.my_seat(p_code text) returns int
language sql stable security definer set search_path = '' as $$
	select p.seat::int from public.room_players p join public.rooms r on r.id = p.room_id
		where r.code = upper(trim(coalesce(p_code, ''))) and p.user_id = auth.uid()
$$;

create or replace function public.leave_seat(p_code text) returns void
language sql security definer set search_path = '' as $$
	delete from public.room_players p using public.rooms r
		where r.id = p.room_id and r.code = upper(trim(coalesce(p_code, ''))) and p.user_id = auth.uid()
$$;

-- ---------- 6. who may join / send on which realtime topic ----------------------------------

create or replace function public.rt_room_exists(p_topic text) returns boolean
language sql stable security definer set search_path = '' as $$
	select exists (select 1 from public.rooms r where r.code = split_part(p_topic, ':', 2))
$$;
create or replace function public.rt_is_owner(p_topic text) returns boolean
language sql stable security definer set search_path = '' as $$
	select exists (select 1 from public.rooms r where r.code = split_part(p_topic, ':', 2) and r.owner_id = auth.uid())
$$;
create or replace function public.rt_is_stage(p_topic text) returns boolean
language sql stable security definer set search_path = '' as $$
	select exists (select 1 from public.rooms r where r.code = split_part(p_topic, ':', 2) and r.stage_uid = auth.uid())
$$;

drop policy if exists "olympia join" on realtime.messages;
drop policy if exists "olympia send" on realtime.messages;

create policy "olympia join" on realtime.messages for select to authenticated using (
	case split_part((select realtime.topic()), ':', 1)
		when 'pub' then public.rt_room_exists((select realtime.topic()))
		when 'hi'  then public.rt_room_exists((select realtime.topic()))
		when 'ctl' then public.rt_is_owner((select realtime.topic())) or public.rt_is_stage((select realtime.topic()))
		when 'ops' then public.rt_is_owner((select realtime.topic())) or public.rt_is_stage((select realtime.topic()))
		else false
	end
);

create policy "olympia send" on realtime.messages for insert to authenticated with check (
	case split_part((select realtime.topic()), ':', 1)
		when 'pub' then
			(extension = 'presence' and public.rt_room_exists((select realtime.topic())))
			or (extension = 'broadcast' and public.rt_is_stage((select realtime.topic())))
		when 'hi'  then extension = 'broadcast' and public.rt_room_exists((select realtime.topic()))
		when 'ctl' then extension = 'broadcast' and public.rt_is_owner((select realtime.topic()))
		when 'ops' then extension = 'broadcast' and public.rt_is_stage((select realtime.topic()))
		else false
	end
);

-- ---------- 7. function permissions --------------------------------------------------------

revoke execute on function public.create_room(text, text)        from public, anon;
revoke execute on function public.set_room_password(text, text)  from public, anon;
revoke execute on function public.release_stage(text)            from public, anon;
revoke execute on function public.claim_stage(text)              from public, anon;
revoke execute on function public.join_as_player(text, text, int) from public, anon;
revoke execute on function public.my_seat(text)                  from public, anon;
grant  execute on function public.my_seat(text)                  to authenticated;
revoke execute on function public.leave_seat(text)               from public, anon;
grant  execute on function public.leave_seat(text)               to authenticated;
grant  execute on function public.create_room(text, text)        to authenticated;
grant  execute on function public.set_room_password(text, text)  to authenticated;
grant  execute on function public.release_stage(text)            to authenticated;
grant  execute on function public.claim_stage(text)              to authenticated;
grant  execute on function public.join_as_player(text, text, int) to authenticated;
