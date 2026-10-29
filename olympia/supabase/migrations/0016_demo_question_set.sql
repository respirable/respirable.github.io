-- =====================================================================================
-- Olympia Controller - "Dùng bộ đề thử nghiệm" (questions.html). Run AFTER 0006. Safe to re-run.
--
-- Until now a room without a question set fell back to the sample set in Demo/ by itself. Now a
-- room plays only what its owner chose:
--   - a set of their own (set_room_question_set, 0006), or
--   - the test set that ships with the site, Demo/ (set_room_demo_set below, rooms.demo_set).
-- Neither chosen (or the set is broken): every question shows "Bạn / BTC chưa thiết lập bộ câu
-- hỏi..." (Scripts/QuestionSet.js, Init.js).
-- =====================================================================================

alter table public.rooms add column if not exists demo_set boolean not null default false;
grant select (demo_set) on public.rooms to authenticated;

-- choosing a set of one's own drops the test set
create or replace function public.set_room_question_set(p_code text, p_set uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
	if p_set is not null and not exists (select 1 from public.question_sets q where q.id = p_set and q.owner_id = auth.uid()) then
		return false;
	end if;
	update public.rooms set question_set_id = p_set, demo_set = false
		where code = upper(trim(coalesce(p_code, ''))) and owner_id = auth.uid();
	return found;
end $$;
revoke execute on function public.set_room_question_set(text, uuid) from public, anon;
grant  execute on function public.set_room_question_set(text, uuid) to authenticated;

-- the room plays the test set (Demo/); the room's owner only, like set_room_question_set
create or replace function public.set_room_demo_set(p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
	update public.rooms set question_set_id = null, demo_set = true
		where code = upper(trim(coalesce(p_code, ''))) and owner_id = auth.uid();
	return found;
end $$;
revoke execute on function public.set_room_demo_set(text) from public, anon;
grant  execute on function public.set_room_demo_set(text) to authenticated;

-- what the room plays: { id, owner, name, files } (a set), { demo: true } (the test set), or null
-- (nothing chosen) - for the owner and the room's stage only
create or replace function public.room_question_set(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
	select case
		when q.id is not null then jsonb_build_object('id', q.id, 'owner', q.owner_id, 'name', q.name, 'files', q.files)
		when r.demo_set then jsonb_build_object('demo', true)
	end
		from public.rooms r left join public.question_sets q on q.id = r.question_set_id
		where r.code = upper(trim(coalesce(p_code, ''))) and public.is_room_owner_or_stage(r)
$$;
revoke execute on function public.room_question_set(text) from public, anon;
grant  execute on function public.room_question_set(text) to authenticated;
