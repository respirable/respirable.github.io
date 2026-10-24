-- =====================================================================================
-- Olympia Controller - one game engine per room, per TAB (not per account).
-- The control panel can now run the game itself when no stage page is open (a hidden engine in
-- the same browser, signed in as the same manager). claim_stage used to key the claim on the
-- account only, so that engine and a stage tab in the same browser could BOTH hold the room.
-- The claim now also carries the claiming tab's id (kept in sessionStorage, so a reload of the
-- same tab keeps its claim). Run AFTER 0001-0004. Safe to re-run.
-- =====================================================================================

alter table public.rooms add column if not exists stage_instance text;

drop function if exists public.claim_stage(text);
drop function if exists public.claim_stage(text, text);
create or replace function public.claim_stage(p_code text, p_instance text) returns text
language plpgsql security definer set search_path = '' as $$
declare
	v_code text := upper(trim(coalesce(p_code, '')));
	v_inst text := left(coalesce(p_instance, ''), 64);
begin
	if auth.uid() is null or v_inst = '' then return 'taken'; end if;
	update public.rooms set stage_uid = auth.uid(), stage_instance = v_inst, stage_seen_at = now()
		where code = v_code
			and (stage_uid is null
				or (stage_uid = auth.uid() and stage_instance is not distinct from v_inst)
				or stage_seen_at < now() - interval '30 seconds');
	if found then return 'ok'; end if;
	if exists (select 1 from public.rooms where code = v_code) then return 'taken'; end if;
	return 'no_room';
end $$;
revoke execute on function public.claim_stage(text, text) from public, anon;
grant  execute on function public.claim_stage(text, text) to authenticated;

create or replace function public.release_stage(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
begin
	update public.rooms set stage_uid = null, stage_instance = null, stage_seen_at = null
		where code = upper(trim(p_code)) and owner_id = auth.uid();
end $$;
