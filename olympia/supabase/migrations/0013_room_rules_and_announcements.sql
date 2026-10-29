-- =====================================================================================
-- Olympia Controller - the rules a room is played by (Olympia 24/26 or Olympia 23), and the
-- lobby's "Thông báo & cập nhật". Run AFTER 0001-0012. Safe to re-run.
--
-- 1. rooms.rules: 'o24' (Olympia 24 + 26, the default) or 'o23', chosen when the room is made.
--    The engine reads it (room_rules); the screens get it with the state.
--
-- 2. announcements: notices / updates / bug fixes from the site owner, shown in the lobby to
--    everyone (signed in or not). Written either
--      - in Supabase: Table Editor -> announcements -> Insert row (or SQL), or
--      - in the lobby, by an account listed in site_admins. Make yourself one ONCE:
--          insert into public.site_admins (user_id)
--          select id from auth.users where email = lower('chu.trang@example.com')
--          on conflict do nothing;
--    Plain text only: the lobby shows it as text, never as HTML.
-- =====================================================================================

-- ---------- 1. room rules -------------------------------------------------------------------

alter table public.rooms add column if not exists rules text not null default 'o24';
do $$ begin
	alter table public.rooms add constraint rooms_rules_check check (rules in ('o24', 'o23'));
exception when duplicate_object then null;
end $$;
grant select (rules) on public.rooms to authenticated;

-- create_room gains p_rules (default 'o24': a page that does not send it makes an O24 room)
drop function if exists public.create_room(text, text);
create or replace function public.create_room(p_name text, p_password text, p_rules text default 'o24') returns text
language plpgsql security definer set search_path = '' as $$
declare
	alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	v_rules text := coalesce(nullif(p_rules, ''), 'o24');
	v_code text;
	i      int;
begin
	if not public.is_manager() then raise exception 'not_manager' using errcode = '42501'; end if;
	if char_length(coalesce(p_password, '')) not between 4 and 20 then raise exception 'bad_password_length'; end if;
	if v_rules not in ('o24', 'o23') then raise exception 'bad_rules'; end if;
	loop
		v_code := '';
		for i in 1..6 loop
			v_code := v_code || substr(alphabet, 1 + get_byte(extensions.gen_random_bytes(1), 0) % 32, 1);
		end loop;
		begin
			insert into public.rooms (code, name, owner_id, player_password_hash, rules)
				values (v_code, left(trim(coalesce(p_name, '')), 80), auth.uid(),
					extensions.crypt(p_password, extensions.gen_salt('bf')), v_rules);
			return v_code;
		exception when unique_violation then
			-- code already used: draw another
		end;
	end loop;
end $$;
revoke execute on function public.create_room(text, text, text) from public, anon;
grant  execute on function public.create_room(text, text, text) to authenticated;

-- the engine (a manager's control panel holding the room) reads the rules before the game starts
create or replace function public.room_rules(p_code text) returns text
language sql stable security definer set search_path = '' as $$
	select r.rules from public.rooms r
		where r.code = upper(trim(coalesce(p_code, ''))) and public.is_room_owner_or_stage(r)
$$;
revoke execute on function public.room_rules(text) from public, anon;
grant  execute on function public.room_rules(text) to authenticated;

-- ---------- 2. announcements ------------------------------------------------------------------

create table if not exists public.site_admins (
	user_id  uuid primary key references auth.users (id) on delete cascade,
	added_at timestamptz not null default now()
);
alter table public.site_admins enable row level security;   -- no policies: SQL Editor only

create or replace function public.is_site_admin() returns boolean
language sql stable security definer set search_path = '' as $$
	select public.is_manager() and exists (select 1 from public.site_admins s where s.user_id = auth.uid())
$$;
revoke execute on function public.is_site_admin() from public;
grant  execute on function public.is_site_admin() to anon, authenticated;   -- the news policy runs it for visitors too (false for them)

create table if not exists public.announcements (
	id           uuid primary key default gen_random_uuid(),
	kind         text not null default 'notice' check (kind in ('notice', 'update', 'fix')),
	title        text not null check (char_length(title) between 1 and 120),
	body         text not null default '' check (char_length(body) <= 8000),
	published_at timestamptz not null default now(),
	created_by   uuid default auth.uid() references auth.users (id) on delete set null
);
create index if not exists announcements_published_at on public.announcements (published_at desc);
alter table public.announcements enable row level security;

drop policy if exists "everyone reads published news" on public.announcements;
drop policy if exists "site admins write news" on public.announcements;
create policy "everyone reads published news" on public.announcements for select to anon, authenticated
	using (published_at <= now() or (select public.is_site_admin()));
create policy "site admins write news" on public.announcements for all to authenticated
	using ((select public.is_site_admin())) with check ((select public.is_site_admin()));
grant select on public.announcements to anon, authenticated;
grant insert, update, delete on public.announcements to authenticated;
