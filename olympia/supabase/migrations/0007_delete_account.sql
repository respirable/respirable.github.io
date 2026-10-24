-- =====================================================================================
-- Olympia Controller - a manager deletes their own account (lobby -> "Tài khoản").
-- Run AFTER 0001-0006. Safe to re-run.
--
-- The page first removes the account's files from Storage (Supabase does not allow deleting
-- storage objects from SQL), then calls delete_my_account with the username and the exact
-- sentence the manager had to type. The function checks both again, takes the email off
-- manager_allowlist (so the same email cannot simply sign in again - the site owner must add it back),
-- and deletes the auth user; rooms, question sets, the profile and seats go with it
-- (on delete cascade).
-- =====================================================================================

create or replace function public.delete_my_account(p_username text, p_confirm text) returns text
language plpgsql security definer set search_path = '' as $$
declare
	v_uid   uuid := auth.uid();
	v_email text;
	v_name  text;
	v_sentence constant text := 'Tôi hiểu rằng việc xoá tài khoản là không thể hoàn tác, đồng thời xác nhận việc xoá tài khoản hoàn toàn là quyết định của tôi, và tôi sẽ không yêu cầu một tài khoản mới với lý do tài khoản cũ của tôi đã bị xoá.';
begin
	if v_uid is null or not public.is_manager() then return 'not_manager'; end if;
	select lower(u.email) into v_email from auth.users u where u.id = v_uid;
	select p.username into v_name from public.profiles p where p.user_id = v_uid;
	-- the account's name: its username, or its email when it has none
	if lower(trim(coalesce(p_username, ''))) <> lower(coalesce(v_name, v_email, '')) then return 'wrong_username'; end if;
	if regexp_replace(normalize(trim(coalesce(p_confirm, '')), NFC), '\s+', ' ', 'g') <> normalize(v_sentence, NFC) then return 'wrong_sentence'; end if;
	if v_email is not null then delete from public.manager_allowlist a where a.email = v_email; end if;
	delete from auth.users u where u.id = v_uid;
	return 'deleted';
end $$;
revoke execute on function public.delete_my_account(text, text) from public, anon;
grant  execute on function public.delete_my_account(text, text) to authenticated;
