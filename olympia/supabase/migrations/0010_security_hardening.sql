-- =====================================================================================
-- Olympia Controller - security hardening. Run AFTER 0001-0009. Safe to re-run.
--
-- 1. Only the room's owner or a co-manager can hold its stage (claim_stage).
--    The game engine always runs inside a control panel, signed in as a manager. claim_stage
--    still let ANY signed-in user - an anonymous visitor with nothing but the room code (which
--    the audience is given) - take the stage of a room nobody was running yet, or one whose
--    engine had been quiet for 30 s. The stage joins ops:CODE (the full state, answers
--    included), receives the panel's commands, reads the room's question set files and the
--    automatic save, reads the players' buzzes / answers, and broadcasts what every screen
--    shows. The page that sent other visitors to the picture-only screen did so in the browser
--    only, which an attacker simply skips by calling the function.
--    Any claim held right now by someone who is neither owner nor co-manager is dropped; a
--    real engine takes the room back on its next heartbeat (10 s).
--
-- 2. Guessing the player password: the limit was 10 wrong tries per account per 10 minutes,
--    but an anonymous account costs nothing, so a script could take a fresh one every 10 tries.
--    Wrong tries now also count per room: 60 per 10 minutes across everyone.
-- =====================================================================================

-- ---------- 1. the stage: owner / co-manager only -------------------------------------------

-- the old one-argument version (0001) must not be callable either
drop function if exists public.claim_stage(text);

create or replace function public.claim_stage(p_code text, p_instance text) returns text
language plpgsql security definer set search_path = '' as $$
declare
	v_code text := upper(trim(coalesce(p_code, '')));
	v_inst text := left(coalesce(p_instance, ''), 64);
	v_room public.rooms;
begin
	if auth.uid() is null or v_inst = '' then return 'taken'; end if;
	select * into v_room from public.rooms where code = v_code;
	if not found then return 'no_room'; end if;
	if v_room.expires_at <= now() then return 'expired'; end if;
	-- not a manager of this room: the same answer as a room held by someone else
	if not (v_room.owner_id = auth.uid() or public.is_room_comanager_id(v_room.id)) then return 'taken'; end if;
	update public.rooms set stage_uid = auth.uid(), stage_instance = v_inst, stage_seen_at = now()
		where id = v_room.id
			and (stage_uid is null
				or (stage_uid = auth.uid() and stage_instance is not distinct from v_inst)
				or stage_seen_at < now() - interval '30 seconds');
	if found then return 'ok'; end if;
	return 'taken';
end $$;
revoke execute on function public.claim_stage(text, text) from public, anon;
grant  execute on function public.claim_stage(text, text) to authenticated;

-- claims held now by anyone who is not the room's owner or one of its co-managers
update public.rooms r set stage_uid = null, stage_instance = null, stage_seen_at = null
	where r.stage_uid is not null
		and r.stage_uid <> r.owner_id
		and not exists (
			select 1 from public.room_managers m join auth.users u on lower(u.email) = m.email
			where m.room_id = r.id and u.id = r.stage_uid and not coalesce(u.is_anonymous, false));

-- ---------- 2. player password: wrong tries also counted per room ---------------------------

alter table public.join_failures add column if not exists room_id uuid;
create index if not exists join_failures_room_at on public.join_failures (room_id, at);

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
	if (select count(*) from public.join_failures f where f.user_id = v_uid and f.at > now() - interval '10 minutes') >= 10
		or (select count(*) from public.join_failures f where f.room_id = v_room.id and f.at > now() - interval '10 minutes') >= 60 then
		return 'throttled';
	end if;
	if v_room.player_password_hash <> extensions.crypt(coalesce(p_password, ''), v_room.player_password_hash) then
		insert into public.join_failures (user_id, room_id) values (v_uid, v_room.id);
		return 'bad_password';
	end if;
	delete from public.room_players where room_id = v_room.id and user_id = v_uid and seat <> p_seat;
	insert into public.room_players (room_id, seat, user_id) values (v_room.id, p_seat, v_uid)
		on conflict (room_id, seat) do nothing;
	select user_id into v_held from public.room_players where room_id = v_room.id and seat = p_seat;
	if v_held is distinct from v_uid then return 'seat_taken'; end if;
	return 'ok';
end $$;
