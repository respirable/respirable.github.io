-- =====================================================================================
-- Olympia Controller - a faster buzzer. Run AFTER 0002 and 0008. Safe to re-run.
--
-- A press went: player's device -> HTTP player_action() -> a row -> Realtime postgres_changes ->
-- the engine. The row stays (a record, and the way in when the fast one fails), but the player's
-- page now also sends the press straight to the engine on the Realtime topic btn:CODE:SEAT
-- (Scripts/PlayerPanel.js -> Scripts/PlayerActions.js), which skips the HTTP call and the
-- database round.
--
-- Only the player seated at SEAT may send on btn:CODE:SEAT, so nobody presses for another seat;
-- the engine reads the seat from the topic, never from the message. The engine of the room may
-- join the four topics; nobody else may.
-- =====================================================================================

-- topic btn:CODE:SEAT - is the caller the player at that seat (room still in use)?
create or replace function public.rt_is_seat(p_topic text) returns boolean
language sql stable security definer set search_path = '' as $$
	select exists (
		select 1 from public.rooms r join public.room_players p on p.room_id = r.id
		where r.code = split_part(p_topic, ':', 2) and r.expires_at > now()
			and p.seat::text = split_part(p_topic, ':', 3) and p.user_id = auth.uid())
$$;
revoke execute on function public.rt_is_seat(text) from public, anon;
grant  execute on function public.rt_is_seat(text) to authenticated;

-- the two policies of 0001 / 0002, with btn added
drop policy if exists "olympia join" on realtime.messages;
create policy "olympia join" on realtime.messages for select to authenticated using (
	case split_part((select realtime.topic()), ':', 1)
		when 'pub' then public.rt_room_exists((select realtime.topic()))
		when 'hi'  then public.rt_room_exists((select realtime.topic()))
		when 'ctl' then public.rt_is_owner((select realtime.topic())) or public.rt_is_stage((select realtime.topic()))
		when 'ops' then public.rt_is_owner((select realtime.topic())) or public.rt_is_stage((select realtime.topic()))
		when 'act' then public.rt_is_stage((select realtime.topic()))
		when 'btn' then public.rt_is_stage((select realtime.topic())) or public.rt_is_seat((select realtime.topic()))
		else false
	end
);

drop policy if exists "olympia send" on realtime.messages;
create policy "olympia send" on realtime.messages for insert to authenticated with check (
	case split_part((select realtime.topic()), ':', 1)
		when 'pub' then
			(extension = 'presence' and public.rt_room_exists((select realtime.topic())))
			or (extension = 'broadcast' and public.rt_is_stage((select realtime.topic())))
		when 'hi'  then extension = 'broadcast' and public.rt_room_exists((select realtime.topic()))
		when 'ctl' then extension = 'broadcast' and public.rt_is_owner((select realtime.topic()))
		when 'ops' then extension = 'broadcast' and public.rt_is_stage((select realtime.topic()))
		when 'btn' then extension = 'broadcast' and public.rt_is_seat((select realtime.topic()))
		else false
	end
);
