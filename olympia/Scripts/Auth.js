/*
 * Olympia Controller - sign-in, shared by every online page (needs supabase-js + Config.js).
 *
 *   OlympiaAuth.client                 the one supabase client (session kept in this browser)
 *   OlympiaAuth.ensureAnonymous()      a session for stage / audience / podium / player pages:
 *                                      keeps any session already here, else signs in anonymously
 *   OlympiaAuth.requireManager()       control / lobby: a permanent account or back to the lobby
 *   OlympiaAuth.signIn(login, pw)      login = email or username
 *   OlympiaAuth.signInWithGoogle()     only works for emails already allowed by BTC
 *   OlympiaAuth.isManager(session)
 */
(function () {
	var cfg = window.OlympiaConfig;
	var client = (window.supabase && cfg) ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

	function isManager(session) {
		return !!(session && session.user && !session.user.is_anonymous);
	}

	async function currentSession() {
		if (!client) { return null; }
		var r = await client.auth.getSession();
		return r.data.session;
	}

	/* the lobby, next to this page (works under any sub-path, e.g. a github.io site) */
	function lobbyUrl(next) {
		var u = new URL('index.html', location.href);
		if (next) { u.searchParams.set('next', next); }
		return u.href;
	}

	function messageFor(error) {
		var m = (error && (error.message || error.error_description || error)) || '';
		if (/invalid login credentials|invalid/i.test(m)) { return 'Sai tên đăng nhập / email hoặc mật khẩu.'; }
		if (/throttled|rate limit|too many/i.test(m)) { return 'Thử sai quá nhiều lần - đợi vài phút rồi thử lại.'; }
		if (/email not confirmed/i.test(m)) { return 'Email chưa được xác nhận.'; }
		if (/BTC|not allowed|signups? not allowed|403/i.test(m)) { return 'Tài khoản quản lý chỉ do BTC cấp - email này chưa được cho phép.'; }
		if (/provider is not enabled|unsupported provider/i.test(m)) { return 'Đăng nhập bằng Google chưa được bật.'; }
		if (/anonymous sign-ins are disabled/i.test(m)) { return 'Máy chủ chưa bật đăng nhập ẩn danh (Anonymous sign-ins).'; }
		return m || 'Có lỗi xảy ra.';
	}

	window.OlympiaAuth = {
		client: client,
		isManager: isManager,
		currentSession: currentSession,
		lobbyUrl: lobbyUrl,
		messageFor: messageFor,

		ensureAnonymous: async function () {
			if (!client) { throw new Error('Không tải được thư viện Supabase.'); }
			var s = await currentSession();
			if (s) { return s; }
			var r = await client.auth.signInAnonymously();
			if (r.error) { throw new Error(messageFor(r.error)); }
			return r.data.session;
		},

		requireManager: async function () {
			var s = await currentSession();
			if (isManager(s)) { return s; }
			location.replace(lobbyUrl(location.pathname.split('/').pop() + location.search));
			return new Promise(function () { /* navigating away */ });
		},

		signIn: async function (login, password) {
			var email = String(login || '').trim();
			if (email.indexOf('@') === -1) {
				var lookup = await client.rpc('login_email', { p_username: email, p_password: password });
				if (lookup.error) { throw new Error(messageFor(lookup.error)); }
				if (!lookup.data || lookup.data.error) { throw new Error(messageFor(lookup.data && lookup.data.error)); }
				email = lookup.data.email;
			}
			var r = await client.auth.signInWithPassword({ email: email, password: password });
			if (r.error) { throw new Error(messageFor(r.error)); }
			if (!isManager(r.data.session)) { throw new Error('Tài khoản này không phải tài khoản quản lý.'); }
			return r.data.session;
		},

		signInWithGoogle: async function () {
			var r = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } });
			if (r.error) { throw new Error(messageFor(r.error)); }
		},

		signOut: async function () {
			if (client) { await client.auth.signOut(); }
		}
	};
})();
