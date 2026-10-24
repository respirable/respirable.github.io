// Olympia Controller - "Yêu cầu một tài khoản" (index.html -> Scripts/LobbyPublic.js).
//
// 1. checks the Cloudflare Turnstile captcha
// 2. stores the request with public.submit_account_request (migrations/0009: checks the fields
//    and the one-request-per-email-per-7-days rule; it needs REQUEST_GATE, so the captcha
//    cannot be skipped by calling it straight from a browser)
// 3. mails it to ADMIN_EMAIL through Resend, with the steps to give that person an account
//
// Secrets (Dashboard -> Edge Functions -> Secrets):
//   TURNSTILE_SECRET   the Turnstile widget's secret key
//   REQUEST_GATE       the same text as public.account_request_gate.secret
//   RESEND_API_KEY     a Resend API key
//   ADMIN_EMAIL        where the requests go
//   MAIL_FROM          (optional) sender, e.g. "Olympia <no-reply@your-domain>"; default
//                      "Olympia <onboarding@resend.dev>" (Resend then only delivers to the
//                      address the Resend account was made with)
// SUPABASE_URL and SUPABASE_ANON_KEY are given to every function by Supabase. No service_role
// key is used: the database function is called like any visitor would call it.
// Deploy with "Verify JWT" OFF (the page is used before anyone signs in; the captcha guards it).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function esc(s: string) {
	return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function sqlText(s: string) { return "'" + s.replace(/'/g, "''") + "'"; }

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') { return new Response('ok', { headers: CORS }); }
	if (req.method !== 'POST') { return reply({ error: 'method' }, 405); }

	let b: Record<string, unknown>;
	try { b = await req.json(); } catch { return reply({ error: 'body' }, 400); }
	const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string).trim() : '');

	// 1. captcha
	const form = new FormData();
	form.append('secret', Deno.env.get('TURNSTILE_SECRET') ?? '');
	form.append('response', str('captcha'));
	const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
	if (ip) { form.append('remoteip', ip); }
	const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
		.then((r) => r.json()).catch(() => ({ success: false }));
	if (!check.success) { return reply({ error: 'captcha' }, 400); }

	// 2. store (the database checks every field again)
	const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { auth: { persistSession: false } });
	const birth = /^\d{4}-\d{2}-\d{2}$/.test(str('birth')) ? str('birth') : null;
	const r = await db.rpc('submit_account_request', {
		p_gate: Deno.env.get('REQUEST_GATE') ?? '',
		p_name: str('name'), p_birth: birth, p_email: str('email'), p_contact: str('contact'), p_about: str('about'),
	});
	if (r.error) { console.error('submit_account_request', r.error); return reply({ error: 'server' }, 500); }
	if (r.data?.error) { return reply(r.data, r.data.error === 'gate' ? 500 : 400); }

	// 3. mail
	const email = str('email').toLowerCase(), name = str('name'), contact = str('contact'), about = str('about');
	const lines = [
		['Tên', name], ['Ngày sinh', birth ?? '(không ghi)'], ['Email', email],
		['Liên hệ khác', contact || '(không ghi)'], ['Mã yêu cầu', r.data.id],
	];
	const sql = [
		'-- bước 1: cho phép email',
		`insert into public.manager_allowlist (email, note) values (${sqlText(email)}, ${sqlText('Yêu cầu ' + r.data.id)}) on conflict (email) do nothing;`,
		`update public.account_requests set status = 'approved' where id = ${sqlText(r.data.id)};`,
		'',
		'-- bước 3 (tuỳ chọn): tên đăng nhập, sau khi tài khoản đã có',
		`insert into public.profiles (user_id, username) select id, 'tendangnhap' from auth.users where email = ${sqlText(email)} on conflict (user_id) do update set username = excluded.username;`,
		'',
		'-- từ chối:',
		`-- update public.account_requests set status = 'rejected' where id = ${sqlText(r.data.id)};`,
	].join('\n');
	const replyTo = contact ? `Người này muốn nhận thông báo và quyết định qua: ${contact} (ưu tiên hơn email).` : `Trả lời qua email: ${email}.`;
	const text = [
		'Có một yêu cầu tài khoản quản lý Olympia Controller.', '',
		...lines.map(([k, v]) => `${k}: ${v}`), '',
		'Giới thiệu và lý do:', about, '',
		r.data.allowed ? 'Lưu ý: email này đã có trong danh sách được phép.' : '',
		replyTo, '',
		'Cách cấp tài khoản:',
		'1. Supabase -> SQL Editor, chạy:', sql, '',
		'2. Một trong hai cách:',
		'   a) Authentication -> Users -> Add user -> Create new user: email trên + một mật khẩu, tích "Auto Confirm User", rồi báo mật khẩu cho người đó (họ đổi được trong mục Tài khoản ở sảnh);',
		'   b) hoặc báo người đó bấm "Đăng nhập bằng Google" bằng đúng email này.',
		'3. (tuỳ chọn) đặt tên đăng nhập bằng câu lệnh thứ 3 ở trên.',
	].join('\n');
	const html = `<p>Có một yêu cầu tài khoản quản lý Olympia Controller.</p>
<table cellpadding="4">${lines.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(String(v))}</td></tr>`).join('')}</table>
<p><b>Giới thiệu và lý do</b></p><p style="white-space:pre-wrap">${esc(about)}</p>
${r.data.allowed ? '<p><b>Lưu ý:</b> email này đã có trong danh sách được phép.</p>' : ''}
<p>${esc(replyTo)}</p>
<p><b>Cách cấp tài khoản</b></p>
<ol>
<li>Supabase → SQL Editor, chạy:<pre style="background:#f3f3f3;padding:8px;white-space:pre-wrap">${esc(sql)}</pre></li>
<li>Một trong hai cách: (a) Authentication → Users → Add user → Create new user: email trên + một mật khẩu, tích “Auto Confirm User”, rồi báo mật khẩu cho người đó (họ đổi được trong mục Tài khoản ở sảnh); (b) hoặc báo người đó bấm “Đăng nhập bằng Google” bằng đúng email này.</li>
<li>(Tuỳ chọn) đặt tên đăng nhập bằng câu lệnh thứ 3 ở trên.</li>
</ol>`;

	let mailed = false;
	try {
		const m = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY') ?? ''}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				from: Deno.env.get('MAIL_FROM') || 'Olympia <onboarding@resend.dev>',
				to: [Deno.env.get('ADMIN_EMAIL') ?? ''],
				reply_to: email,
				subject: `[Olympia] Yêu cầu tài khoản: ${name} <${email}>`,
				text, html,
			}),
		});
		mailed = m.ok;
		if (!m.ok) { console.error('resend', m.status, await m.text()); }
	} catch (e) { console.error('resend', e); }

	// the request is stored either way; the BTC can still read it in account_requests
	return reply({ ok: true, mailed });
});
