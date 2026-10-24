-- =====================================================================================
-- Olympia Controller - fix for 0002: the stage page could not read player_actions.
-- The policy looked the room up in public.rooms, but rooms' own row-level security only shows
-- a room to its OWNER, so for the (anonymous) stage the lookup was always empty. The check now
-- goes through a security-definer function, like the realtime helpers do. Safe to re-run.
-- =====================================================================================

create or replace function public.is_room_stage(p_code text) returns boolean
language sql stable security definer set search_path = '' as $$
	select exists (select 1 from public.rooms r where r.code = p_code and r.stage_uid = auth.uid())
$$;

drop policy if exists "stage reads actions" on public.player_actions;
create policy "stage reads actions" on public.player_actions for select to authenticated
	using (public.is_room_stage(room_code));
