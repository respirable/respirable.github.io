-- =====================================================================================
-- Olympia Controller - Phase 6: question sets in Storage + the game's automatic save.
-- Run AFTER 0001-0005. Safe to re-run.
--
-- Question sets
--   A manager uploads a folder (khoidong.xml, vcnv.xml, tangtoc.xml, vedich.xml, cauhoiphu.xml,
--   players.xml + pictures / videos) from the lobby into the PRIVATE bucket "sets", under
--   <owner id>/<set id>/<file>. A room may point at one of the owner's sets. Only the owner and
--   the room's current stage (the page holding the room, see claim_stage) can read the files:
--   the stage downloads the XML and makes short-lived signed links for the media, which reach
--   players / the audience only once the stage shows them. Answers never leave the stage.
--
-- Automatic save
--   The stage keeps the game's progress (scores, steps, rows, who has played...) in
--   rooms.game_state while a game is under way. A stage page reopened after a crash reads it and
--   the control panel can resume from it. Readable by the owner and the room's stage only (it
--   holds answers typed by the players).
-- =====================================================================================

-- ---------- 1. question sets ------------------------------------------------------------

create table if not exists public.question_sets (
	id         uuid primary key default gen_random_uuid(),
	owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
	name       text not null default '' check (char_length(name) <= 80),
	files      jsonb not null default '[]'::jsonb,     -- [{ name, key, size, type }]
	created_at timestamptz not null default now()
);
alter table public.question_sets enable row level security;
drop policy if exists "owner manages sets" on public.question_sets;
create policy "owner manages sets" on public.question_sets for all to authenticated
	using (owner_id = (select auth.uid()) and public.is_manager())
	with check (owner_id = (select auth.uid()) and public.is_manager());
grant select, insert, update, delete on public.question_sets to authenticated;

alter table public.rooms add column if not exists question_set_id uuid references public.question_sets (id) on delete set null;
grant select (question_set_id) on public.rooms to authenticated;

-- the owner points a room at one of their sets (null = the set on the stage machine / the sample)
create or replace function public.set_room_question_set(p_code text, p_set uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
	if p_set is not null and not exists (select 1 from public.question_sets q where q.id = p_set and q.owner_id = auth.uid()) then
		return false;
	end if;
	update public.rooms set question_set_id = p_set
		where code = upper(trim(coalesce(p_code, ''))) and owner_id = auth.uid();
	return found;
end $$;
revoke execute on function public.set_room_question_set(text, uuid) from public, anon;
grant  execute on function public.set_room_question_set(text, uuid) to authenticated;

-- is the caller the room's owner, or the stage holding it right now?
create or replace function public.is_room_owner_or_stage(p_room public.rooms) returns boolean
language sql stable security definer set search_path = '' as $$
	select auth.uid() is not null and (p_room.owner_id = auth.uid()
		or (p_room.stage_uid = auth.uid() and p_room.stage_seen_at > now() - interval '30 seconds'))
$$;
revoke execute on function public.is_room_owner_or_stage(public.rooms) from public, anon;
grant  execute on function public.is_room_owner_or_stage(public.rooms) to authenticated;

-- the set a room uses: { id, owner, name, files } - for the owner and the room's stage only
create or replace function public.room_question_set(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
	select jsonb_build_object('id', q.id, 'owner', q.owner_id, 'name', q.name, 'files', q.files)
		from public.rooms r join public.question_sets q on q.id = r.question_set_id
		where r.code = upper(trim(coalesce(p_code, ''))) and public.is_room_owner_or_stage(r)
$$;
revoke execute on function public.room_question_set(text) from public, anon;
grant  execute on function public.room_question_set(text) to authenticated;

-- storage object "<owner>/<set>/<file>" readable by the stage of a room using that set
create or replace function public.stage_may_read_set_object(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
	select exists (
		select 1 from public.rooms r join public.question_sets q on q.id = r.question_set_id
		where q.owner_id::text = split_part(p_name, '/', 1)
			and q.id::text = split_part(p_name, '/', 2)
			and r.stage_uid = auth.uid()
			and r.stage_seen_at > now() - interval '30 seconds')
$$;
revoke execute on function public.stage_may_read_set_object(text) from public, anon;
grant  execute on function public.stage_may_read_set_object(text) to authenticated;

-- the bucket: private, 50 MB per file, the file kinds a set uses
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
	values ('sets', 'sets', false, 52428800, array['text/xml', 'application/xml', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg'])
	on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "sets: owner manages own folder" on storage.objects;
create policy "sets: owner manages own folder" on storage.objects for all to authenticated
	using (bucket_id = 'sets' and split_part(name, '/', 1) = (select auth.uid())::text and public.is_manager())
	with check (bucket_id = 'sets' and split_part(name, '/', 1) = (select auth.uid())::text and public.is_manager());

drop policy if exists "sets: room stage reads its set" on storage.objects;
create policy "sets: room stage reads its set" on storage.objects for select to authenticated
	using (bucket_id = 'sets' and public.stage_may_read_set_object(name));

-- ---------- 2. automatic save of the game -------------------------------------------------

alter table public.rooms add column if not exists game_state    jsonb;
alter table public.rooms add column if not exists game_state_at timestamptz;

-- stage page -> database (throttled on the page; never written by a fresh, unplayed page)
create or replace function public.save_game_state(p_code text, p_state jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
	if p_state is null or octet_length(p_state::text) > 200000 then return false; end if;
	update public.rooms set game_state = p_state, game_state_at = now()
		where code = upper(trim(coalesce(p_code, ''))) and stage_uid = auth.uid();
	return found;
end $$;
revoke execute on function public.save_game_state(text, jsonb) from public, anon;
grant  execute on function public.save_game_state(text, jsonb) to authenticated;

-- { state, at } for the owner and the room's stage (null: nothing saved)
create or replace function public.load_game_state(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
	select jsonb_build_object('state', r.game_state, 'at', r.game_state_at)
		from public.rooms r
		where r.code = upper(trim(coalesce(p_code, ''))) and r.game_state is not null
			and public.is_room_owner_or_stage(r)
$$;
revoke execute on function public.load_game_state(text) from public, anon;
grant  execute on function public.load_game_state(text) to authenticated;

-- the owner forgets the save (a new show in the same room)
create or replace function public.clear_game_state(p_code text) returns void
language sql security definer set search_path = '' as $$
	update public.rooms set game_state = null, game_state_at = null
		where code = upper(trim(coalesce(p_code, ''))) and owner_id = auth.uid()
$$;
revoke execute on function public.clear_game_state(text) from public, anon;
grant  execute on function public.clear_game_state(text) to authenticated;
