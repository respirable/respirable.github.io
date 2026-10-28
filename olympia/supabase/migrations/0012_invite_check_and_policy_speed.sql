-- =====================================================================================
-- Olympia Controller - "who among the invited has no manager account yet", and cheaper
-- policies. Run AFTER 0001-0011. Safe to re-run.
--
-- 1. invited_emails_without_account(room, emails): the lobby's co-manager dialog says which
--    invited e-mails have no manager account yet (the invitation is kept: once the site owner
--    gives that e-mail an account, it runs the room). Asked by the room's OWNER only, and only
--    about e-mails already invited to that room (at most 50 at a time), so it cannot be used to
--    find out whether any e-mail at all is a manager.
--    Lookups go through indexes only - manager_allowlist's primary key and auth.users'
--    users_email_partial_key (unique on email WHERE is_sso_user = false: the condition is
--    written out so Postgres can use it). auth.users grows with every anonymous screen and
--    player, so a lookup by lower(email) would read the whole table each time.
--
-- 2. The question-set policies called is_manager() for EVERY row they looked at (and since 0011
--    it reads two tables). Wrapped in (select ...), Postgres runs it once per query.
-- =====================================================================================

-- ---------- 1. invited e-mails with no manager account -----------------------------------

create or replace function public.invited_emails_without_account(p_room uuid, p_emails text[]) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare
	v_out text[];
begin
	if not public.is_manager() or not public.is_room_owner_id(p_room) then
		raise exception 'not_owner' using errcode = '42501';
	end if;
	if coalesce(array_length(p_emails, 1), 0) > 50 then
		raise exception 'too_many' using errcode = '22023';
	end if;
	select coalesce(array_agg(m.email order by m.email), '{}') into v_out
		from public.room_managers m
		where m.room_id = p_room
			and m.email = any (select lower(trim(e)) from unnest(p_emails) e)
			and not exists (
				select 1 from public.manager_allowlist a
				join auth.users u on u.email = a.email and u.is_sso_user = false   -- users_email_partial_key
				where a.email = m.email and not coalesce(u.is_anonymous, false));
	return v_out;
end $$;
revoke execute on function public.invited_emails_without_account(uuid, text[]) from public, anon;
grant  execute on function public.invited_emails_without_account(uuid, text[]) to authenticated;

-- ---------- 2. is_manager() once per query in the question-set policies ------------------

drop policy if exists "owner manages sets" on public.question_sets;
create policy "owner manages sets" on public.question_sets for all to authenticated
	using (owner_id = (select auth.uid()) and (select public.is_manager()))
	with check (owner_id = (select auth.uid()) and (select public.is_manager()));

drop policy if exists "sets: owner manages own folder" on storage.objects;
create policy "sets: owner manages own folder" on storage.objects for all to authenticated
	using (bucket_id = 'sets' and split_part(name, '/', 1) = (select auth.uid())::text and (select public.is_manager()))
	with check (bucket_id = 'sets' and split_part(name, '/', 1) = (select auth.uid())::text and (select public.is_manager()));
