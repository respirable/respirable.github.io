-- =====================================================================================
-- Olympia Controller - "Yêu cầu một tài khoản" (index.html, Scripts/LobbyPublic.js).
--
-- A request goes: page -> Edge Function request-account (supabase/functions, checks the
-- Turnstile captcha, then mails the request to the BTC) -> submit_account_request() below.
-- The function only works with the gate secret the Edge Function holds, so nobody can skip the
-- captcha by calling it straight from the browser. One request per email per 7 days.
--
-- After running this file, set the gate secret ONCE (any long random text - the same value goes
-- into the Edge Function's REQUEST_GATE secret):
--   insert into public.account_request_gate (id, secret) values (1, '<chuỗi ngẫu nhiên dài>')
--   on conflict (id) do update set secret = excluded.secret;
--
-- Read the requests: select * from public.account_requests order by created_at desc;
-- Safe to run again.
-- =====================================================================================

create table if not exists public.account_requests (
	id         uuid primary key default gen_random_uuid(),
	name       text not null check (char_length(name) between 1 and 100),
	birth_date date,
	email      text not null check (email = lower(email) and char_length(email) <= 254),
	contact    text check (contact is null or char_length(contact) <= 300),
	about      text not null check (char_length(about) between 1 and 12000),
	status     text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
	created_at timestamptz not null default now()
);
create index if not exists account_requests_email_at on public.account_requests (email, created_at);
alter table public.account_requests enable row level security;   -- no policies: SQL Editor only

create table if not exists public.account_request_gate (
	id     int primary key default 1 check (id = 1),
	secret text not null check (char_length(secret) >= 24)
);
alter table public.account_request_gate enable row level security;   -- no policies: unreadable

-- returns { ok, id } or { error: gate | name | birth | email | contact | about | recent (+ until) | busy }
create or replace function public.submit_account_request(
	p_gate text, p_name text, p_birth date, p_email text, p_contact text, p_about text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
	v_email   text := lower(trim(coalesce(p_email, '')));
	v_name    text := trim(coalesce(p_name, ''));
	v_contact text := nullif(trim(coalesce(p_contact, '')), '');
	v_about   text := trim(coalesce(p_about, ''));
	v_last    timestamptz;
	v_id      uuid;
begin
	if not exists (select 1 from public.account_request_gate g where g.secret = coalesce(p_gate, '')) then
		return jsonb_build_object('error', 'gate');
	end if;
	if v_name = '' or char_length(v_name) > 100 then return jsonb_build_object('error', 'name'); end if;
	if p_birth is not null and (p_birth < date '1900-01-01' or p_birth > current_date) then return jsonb_build_object('error', 'birth'); end if;
	if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then return jsonb_build_object('error', 'email'); end if;
	if v_contact is not null and char_length(v_contact) > 300 then return jsonb_build_object('error', 'contact'); end if;
	if v_about = '' or char_length(v_about) > 12000
		or coalesce(array_length(regexp_split_to_array(v_about, '\s+'), 1), 0) > 1000 then
		return jsonb_build_object('error', 'about');
	end if;

	-- one request per email per 7 days (the lock keeps two requests at once from both passing)
	perform pg_advisory_xact_lock(hashtext('account_request:' || v_email));
	select max(r.created_at) into v_last from public.account_requests r
		where r.email = v_email and r.created_at > now() - interval '7 days';
	if v_last is not null then
		return jsonb_build_object('error', 'recent', 'until', v_last + interval '7 days');
	end if;
	-- a flood (even through the captcha) stops at 30 requests an hour
	if (select count(*) from public.account_requests r where r.created_at > now() - interval '1 hour') >= 30 then
		return jsonb_build_object('error', 'busy');
	end if;

	insert into public.account_requests (name, birth_date, email, contact, about)
	values (v_name, p_birth, v_email, v_contact, v_about)
	returning id into v_id;
	return jsonb_build_object('ok', true, 'id', v_id, 'allowed', exists (select 1 from public.manager_allowlist a where a.email = v_email));
end $$;
revoke execute on function public.submit_account_request(text, text, date, text, text, text) from public;
grant execute on function public.submit_account_request(text, text, date, text, text, text) to anon, authenticated;
