-- =====================================================================================
-- Olympia Controller - Phase 3: what a seated player can do (buzz, ask to answer the obstacle,
-- send a written answer). Run AFTER 0001_rooms_auth.sql. Safe to re-run.
--
-- A player never says which seat they are: player_action() looks it up from room_players, and
-- the time comes from the database clock, so the stage can order presses fairly and time
-- Tăng tốc answers without trusting anyone's computer clock.
-- The stage page reads new rows live (postgres_changes on topic act:CODE).
-- =====================================================================================

create table if not exists public.player_actions (
	id         bigint generated always as identity primary key,
	room_code  text        not null,
	seat       smallint    not null check (seat between 1 and 4),
	user_id    uuid        not null,
	kind       text        not null check (kind in ('buzz', 'cnv', 'answer')),
	payload    jsonb       not null default '{}'::jsonb,
	created_at timestamptz not null default clock_timestamp()
);
create index if not exists player_actions_user_at on public.player_actions (user_id, created_at);
create index if not exists player_actions_room_at on public.player_actions (room_code, created_at);
alter table public.player_actions enable row level security;

-- only the room's stage page reads them (postgres_changes checks this policy row by row).
-- security definer: rooms' own policy would hide the room from the (anonymous) stage
create or replace function public.is_room_stage(p_code text) returns boolean
language sql stable security definer set search_path = '' as $$
	select exists (select 1 from public.rooms r where r.code = p_code and r.stage_uid = auth.uid())
$$;
drop policy if exists "stage reads actions" on public.player_actions;
create policy "stage reads actions" on public.player_actions for select to authenticated
	using (public.is_room_stage(room_code));
revoke insert, update, delete on public.player_actions from anon, authenticated;

do $$ begin
	alter publication supabase_realtime add table public.player_actions;
exception when duplicate_object then null;
end $$;

-- ok | bad_kind | too_big | not_seated | throttled
create or replace function public.player_action(p_code text, p_kind text, p_payload jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
	v_code text := upper(trim(coalesce(p_code, '')));
	v_seat smallint;
begin
	if p_kind is null or p_kind not in ('buzz', 'cnv', 'answer') then return 'bad_kind'; end if;
	if octet_length(coalesce(p_payload, '{}'::jsonb)::text) > 1000 then return 'too_big'; end if;
	select p.seat into v_seat
		from public.rooms r join public.room_players p on p.room_id = r.id
		where r.code = v_code and p.user_id = auth.uid();
	if not found then return 'not_seated'; end if;
	if (select count(*) from public.player_actions a
		where a.user_id = auth.uid() and a.created_at > clock_timestamp() - interval '10 seconds') >= 20 then
		return 'throttled';
	end if;
	insert into public.player_actions (room_code, seat, user_id, kind, payload)
		values (v_code, v_seat, auth.uid(), p_kind, coalesce(p_payload, '{}'::jsonb));
	-- old rows are of no use once a show is over
	delete from public.player_actions a where a.room_code = v_code and a.created_at < clock_timestamp() - interval '1 day';
	return 'ok';
end $$;
revoke execute on function public.player_action(text, text, jsonb) from public, anon;
grant  execute on function public.player_action(text, text, jsonb) to authenticated;

-- the database clock in ms, so the stage can line its own clock up with created_at
create or replace function public.server_now_ms() returns bigint
language sql volatile set search_path = '' as $$
	select (extract(epoch from clock_timestamp()) * 1000)::bigint
$$;
grant execute on function public.server_now_ms() to anon, authenticated;

-- realtime: the stage may join act:CODE (the topic its postgres_changes subscription uses)
drop policy if exists "olympia join" on realtime.messages;
create policy "olympia join" on realtime.messages for select to authenticated using (
	case split_part((select realtime.topic()), ':', 1)
		when 'pub' then public.rt_room_exists((select realtime.topic()))
		when 'hi'  then public.rt_room_exists((select realtime.topic()))
		when 'ctl' then public.rt_is_owner((select realtime.topic())) or public.rt_is_stage((select realtime.topic()))
		when 'ops' then public.rt_is_owner((select realtime.topic())) or public.rt_is_stage((select realtime.topic()))
		when 'act' then public.rt_is_stage((select realtime.topic()))
		else false
	end
);
