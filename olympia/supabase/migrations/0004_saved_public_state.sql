-- =====================================================================================
-- Olympia Controller - Phase 5 prerequisite: the last PUBLIC state of a room is kept in the
-- database, so the podiums / audience show names and scores even when no stage page is open
-- (and a screen opened later starts from the latest picture instead of a blank one).
-- Only the room's stage may write it; anyone with the room code may read it - it is the same
-- public state already broadcast on pub:CODE (never an answer before the stage shows it).
-- Run AFTER 0001-0003. Safe to re-run.
-- =====================================================================================

alter table public.rooms add column if not exists public_state    jsonb;
alter table public.rooms add column if not exists public_state_at timestamptz;

-- stage page -> database (throttled on the page). false = this page is not the room's stage.
create or replace function public.save_public_state(p_code text, p_state jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
	if p_state is null or octet_length(p_state::text) > 200000 then return false; end if;
	update public.rooms set public_state = p_state, public_state_at = now()
		where code = upper(trim(coalesce(p_code, ''))) and stage_uid = auth.uid();
	return found;
end $$;
revoke execute on function public.save_public_state(text, jsonb) from public, anon;
grant  execute on function public.save_public_state(text, jsonb) to authenticated;

-- any screen with the room code -> { state, at } (null when the room has none yet / no room)
create or replace function public.load_public_state(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
	select jsonb_build_object('state', r.public_state, 'at', r.public_state_at)
		from public.rooms r
		where r.code = upper(trim(coalesce(p_code, ''))) and r.public_state is not null
$$;
revoke execute on function public.load_public_state(text) from public;
grant  execute on function public.load_public_state(text) to anon, authenticated;
