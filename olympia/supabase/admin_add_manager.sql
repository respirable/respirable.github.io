-- =====================================================================================
-- Olympia Controller - give someone a manager account (run in Supabase SQL Editor).
-- Managers cannot sign up on their own. To add one:
--
--   1. Run STEP 1 below with their email (lower case).
--   2. Either
--        a) Dashboard -> Authentication -> Users -> "Add user" -> "Create new user":
--           same email + a password, tick "Auto Confirm User"
--      or
--        b) let them press "Đăng nhập bằng Google" with that Gmail (Google must be enabled
--           under Authentication -> Sign In / Providers).
--   3. (optional) Run STEP 2 to give them a username for the login form.
--
-- To remove a manager: Authentication -> Users -> delete the user, then STEP 3.
-- =====================================================================================

-- STEP 1 - allow the email
insert into public.manager_allowlist (email, note)
values (lower('nguoi.quan.ly@example.com'), 'chủ sở hữu trang web')
on conflict (email) do nothing;

-- STEP 2 - username (3-32 chars: a-z 0-9 _ . -), after the account exists
insert into public.profiles (user_id, username)
select id, 'tenquanly' from auth.users where email = lower('nguoi.quan.ly@example.com')
on conflict (user_id) do update set username = excluded.username;

-- STEP 3 - take the email off the list (stops future sign-ups / Google sign-ins creating it again)
-- delete from public.manager_allowlist where email = lower('nguoi.quan.ly@example.com');
