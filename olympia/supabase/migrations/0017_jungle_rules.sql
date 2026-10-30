-- =====================================================================================
-- Olympia Controller - "Luật rừng (EXPERIMENTAL)" as a room's rules (Scripts/Rules.js). Run AFTER
-- 0013. Safe to re-run. rooms.rules may now be 'o24', 'o23' or 'jungle'; create_room takes it.
-- =====================================================================================

alter table public.rooms drop constraint if exists rooms_rules_check;
alter table public.rooms add constraint rooms_rules_check check (rules in ('o24', 'o23', 'jungle'));

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
	if v_rules not in ('o24', 'o23', 'jungle') then raise exception 'bad_rules'; end if;
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
