/*
 * Olympia Controller - the two things under the sign-in form (index.html), for people with no
 * manager account:
 *
 *   "Yêu cầu một tài khoản"  a form sent to the Edge Function request-account
 *       (supabase/functions/request-account: checks the Cloudflare Turnstile captcha, stores the
 *       request - one per email per 7 days, migrations/0009 - and mails it to the BTC with the
 *       steps to add the account). The captcha's site key is OlympiaConfig.turnstileSiteKey.
 *   "Tham gia trận đấu"      room code + role: contestant (player.html), audience
 *       (audience.html, with or without answering along: &play=0) or one seat's score screen
 *       (podium.html). Nothing to sign in to.
 */
(function () {
	var $ = function (s) { return document.querySelector(s); };
	var cfg = window.OlympiaConfig || {};
	var MAX_WORDS = 1000;
	var NEED_CAPTCHA = 'Hãy hoàn thành captcha.';
	/* Cloudflare's always-pass test key, only where the page is tried out locally */
	var TEST_SITE_KEY = '1x00000000000000000000AA';
	var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

	function msg(sel, text) { $(sel).textContent = text || ''; }
	function show(el, on) { el.classList.toggle('hidden', !on); }

	/* ---------- request an account ---------- */

	function siteKey() { return cfg.turnstileSiteKey || (LOCAL ? TEST_SITE_KEY : ''); }
	var captchaToken = '', widget = null, scriptState = '';

	function loadTurnstile(done) {
		if (window.turnstile) { done(); return; }
		if (scriptState === 'loading') { return; }
		scriptState = 'loading';
		window.__olympiaTurnstileReady = function () { scriptState = 'ready'; done(); };
		var s = document.createElement('script');
		s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__olympiaTurnstileReady';
		s.async = true;
		s.onerror = function () { scriptState = ''; msg('#reqMsg', 'Không tải được captcha - kiểm tra mạng rồi mở lại.'); };
		document.head.appendChild(s);
	}

	function renderCaptcha() {
		if (!siteKey()) { msg('#reqMsg', 'Trang này chưa cấu hình captcha (turnstileSiteKey trong Scripts/Config.js) nên chưa gửi được yêu cầu.'); return; }
		loadTurnstile(function () {
			if (widget !== null) { window.turnstile.reset(widget); captchaToken = ''; return; }
			widget = window.turnstile.render('#reqCaptcha', {
				sitekey: siteKey(),
				language: 'vi',
				theme: 'dark',
				callback: function (t) { captchaToken = t; if ($('#reqMsg').textContent === NEED_CAPTCHA) { msg('#reqMsg', ''); } },
				'expired-callback': function () { captchaToken = ''; },
				'error-callback': function () { captchaToken = ''; msg('#reqMsg', 'Captcha lỗi - thử tải lại trang.'); }
			});
		});
	}

	function words(text) { var t = text.trim(); return t ? t.split(/\s+/).length : 0; }
	function countWords() {
		var n = words($('#reqAbout').value), hint = $('#reqWords');
		hint.textContent = n + ' / ' + MAX_WORDS + ' từ';
		hint.classList.toggle('over', n > MAX_WORDS);
		return n;
	}

	var ERRORS = {
		captcha: 'Captcha chưa đúng hoặc đã hết hạn - làm lại captcha rồi gửi.',
		name: 'Hãy nhập tên (tối đa 100 ký tự).',
		birth: 'Ngày sinh không hợp lệ.',
		email: 'Email không hợp lệ.',
		contact: 'Thông tin liên hệ khác dài quá (tối đa 300 ký tự).',
		about: 'Phần giới thiệu và lý do không được để trống và tối đa ' + MAX_WORDS + ' từ.',
		busy: 'Đang có quá nhiều yêu cầu - thử lại sau ít phút.',
		gate: 'Máy chủ chưa được cấu hình đầy đủ để nhận yêu cầu. Hãy báo BTC.',
		server: 'Máy chủ gặp lỗi - thử lại sau.'
	};
	function errorText(d) {
		if (d && d.error === 'recent') {
			var until = d.until ? new Date(d.until).toLocaleString('vi-VN') : '';
			return 'Email này đã gửi yêu cầu trong 7 ngày qua' + (until ? ' - gửi lại được sau ' + until : '') + '.';
		}
		return (d && ERRORS[d.error]) || 'Không gửi được yêu cầu - thử lại sau.';
	}

	function check() {
		var name = $('#reqName').value.trim(), email = $('#reqEmail').value.trim(), about = $('#reqAbout').value.trim();
		var birth = $('#reqBirth').value;
		if (!name) { return ERRORS.name; }
		if (birth && (birth < '1900-01-01' || new Date(birth) > new Date())) { return ERRORS.birth; }
		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { return ERRORS.email; }
		if (!about || countWords() > MAX_WORDS) { return ERRORS.about; }
		if (!captchaToken) { return NEED_CAPTCHA; }
		return '';
	}

	async function send(ev) {
		ev.preventDefault();
		var bad = check();
		if (bad) { msg('#reqMsg', bad); return; }
		var client = window.OlympiaAuth && window.OlympiaAuth.client;
		if (!client) { msg('#reqMsg', 'Không tải được thư viện Supabase (cần mạng).'); return; }
		$('#reqSend').disabled = true;
		msg('#reqMsg', 'Đang gửi...');
		var body = {
			name: $('#reqName').value.trim(), birth: $('#reqBirth').value || '', email: $('#reqEmail').value.trim(),
			contact: $('#reqContact').value.trim(), about: $('#reqAbout').value.trim(), captcha: captchaToken
		};
		var data = null;
		try {
			var r = await client.functions.invoke('request-account', { body: body });
			if (r.error) {
				/* a 4xx / 5xx answer still carries { error } */
				try { data = await r.error.context.json(); } catch (e) { data = { error: r.error.name === 'FunctionsFetchError' ? 'server' : '' }; }
			}
			else { data = r.data; }
		}
		catch (e) { data = { error: 'server' }; }
		$('#reqSend').disabled = false;
		if (data && data.ok) {
			show($('#reqForm'), false);
			show($('#reqDone'), true);
			var to = body.contact ? ('qua ' + body.contact + ' (hoặc email ' + body.email + ')') : ('qua email ' + body.email);
			$('#reqDoneText').textContent = 'BTC sẽ xem yêu cầu và báo kết quả ' + to + '. Khi được duyệt, bạn đăng nhập bằng email này.';
			return;
		}
		msg('#reqMsg', errorText(data));
		renderCaptcha();   /* a token is good for one try */
	}

	function openRequest() {
		show($('#reqForm'), true);
		show($('#reqDone'), false);
		msg('#reqMsg', '');
		countWords();
		$('#reqDialog').showModal();
		renderCaptcha();
	}

	/* ---------- join a match ---------- */

	var CODE_KEY = 'olympia.lastJoinCode';

	function refreshJoin() {
		var as = (document.querySelector('input[name=joinAs]:checked') || {}).value;
		$('#joinPlayBox').classList.toggle('off', as !== 'audience');
		$('#joinSeatBox').classList.toggle('off', as !== 'podium');
	}

	function join(ev) {
		ev.preventDefault();
		var code = $('#joinCode').value.trim().toUpperCase();
		if (!/^[A-Z0-9]{4,12}$/.test(code)) { msg('#joinMsg', 'Mã phòng gồm 4-12 chữ cái hoặc chữ số, BTC sẽ đưa cho bạn.'); return; }
		try { localStorage.setItem(CODE_KEY, code); } catch (e) { /* private window */ }
		var as = (document.querySelector('input[name=joinAs]:checked') || {}).value;
		var q = new URLSearchParams({ room: code });
		var page = 'player.html';
		if (as === 'audience') { page = 'audience.html'; if (!$('#joinPlay').checked) { q.set('play', '0'); } }
		else if (as === 'podium') { page = 'podium.html'; q.set('seat', $('#joinSeat').value); }
		location.href = page + '?' + q.toString();
	}

	function openJoin() {
		msg('#joinMsg', '');
		if (!$('#joinCode').value) { try { $('#joinCode').value = localStorage.getItem(CODE_KEY) || ''; } catch (e) { /* private window */ } }
		refreshJoin();
		$('#joinDialog').showModal();
		$('#joinCode').focus();
	}

	document.addEventListener('DOMContentLoaded', function () {
		$('#reqOpen').addEventListener('click', openRequest);
		$('#reqForm').addEventListener('submit', send);
		$('#reqAbout').addEventListener('input', countWords);
		$('#joinOpen').addEventListener('click', openJoin);
		$('#joinForm').addEventListener('submit', join);
		$('#joinCode').addEventListener('input', function () { var c = $('#joinCode'); c.value = c.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
		document.querySelectorAll('input[name=joinAs]').forEach(function (r) { r.addEventListener('change', refreshJoin); });
		['#reqDialog', '#joinDialog'].forEach(function (id) {
			$(id).querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { $(id).close(); }); });
		});
	});
})();
