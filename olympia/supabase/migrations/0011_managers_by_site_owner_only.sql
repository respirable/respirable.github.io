-- =====================================================================================
-- Olympia Controller - a manager account comes from the site owner, and from nowhere else.
-- Run AFTER 0001-0010. Safe to re-run.
--
-- Until now an e-mail invited as a room's co-manager (0008) could CREATE an account - and any
-- permanent account counted as a manager (is_manager: "not anonymous"). So a manager could
-- invite any e-mail, that person signed in with Google and was a full manager for good (own
-- rooms, question sets, inviting others in turn), without the site owner ever knowing.
--
-- Now:
--   - an account can be created only for an e-mail on manager_allowlist (the site owner adds it,
--     see admin_add_manager.sql / the "Yêu cầu một tài khoản" e-mail); anonymous visitors
--     (screens, players) are unchanged
--   - is_manager() = signed in, not anonymous AND the account's e-mail is on manager_allowlist.
--     Every manager right goes through it (rooms, question sets, co-managing, the realtime
--     topics, deleting one's account), so taking an e-mail off the list takes the rights away
--     at once, and an account made earlier through an invitation is no manager any more
--   - inviting a co-manager only lets an EXISTING manager run that room's control panel; it
--     no longer lets anyone create an account
--
-- Accounts that exist but are not on the list (made through an invitation before this file):
--   select u.id, u.email, u.created_at from auth.users u
--   where not coalesce(u.is_anonymous, false)
--     and not exists (select 1 from public.manager_allowlist a where a.email = lower(u.email));
-- They can no longer do anything a manager does. To keep one, add its e-mail to
-- manager_allowlist; to remove it, Authentication -> Users -> delete.
-- =====================================================================================

-- ---------- 1. a manager = an account whose e-mail the site owner allowed ------------------

-- security definer: it reads auth.users and manager_allowlist, which no client can read.
-- The e-mail is taken from auth.users, not from the token.
create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = '' as $$
	select auth.uid() is not null
		and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) = false
		and exists (
			select 1 from auth.users u join public.manager_allowlist a on a.email = lower(u.email)
			where u.id = auth.uid())
$$;
revoke execute on function public.is_manager() from public, anon;
grant  execute on function public.is_manager() to authenticated;   -- the pages ask it (Auth.js)

-- ---------- 2. accounts are created only for allowed e-mails ----------------------------------

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
		'message', 'Tài khoản quản lý chỉ do chủ sở hữu trang web cấp - email này chưa được cho phép.'));
end $$;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.before_user_created(jsonb) from public, anon, authenticated;
