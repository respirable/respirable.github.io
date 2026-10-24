/*
 * Olympia Controller - player page, step 1: join a seat with the room code + BTC's player password.
 * No account: the browser signs in anonymously. The playing controls come in Phase 3.
 */
(function () {
	var auth = window.OlympiaAuth;
	var db = auth && auth.client;
	var $ = function (s) { return document.querySelector(s); };
	function show(el, on) { el.classList.toggle('hidden', !on); }

	var RESULT_TEXT = {
		no_auth: 'Không đăng nhập được - tải lại trang.',
		bad_seat: 'Hãy chọn ghế 1-4.',
		no_room: 'Không có phòng này - kiểm tra lại mã phòng.',
		expired: 'Phòng này đã hết hạn (mỗi phòng dùng được 4 tiếng).',
		throttled: 'Nhập sai quá nhiều lần - đợi 10 phút rồi thử lại.',
		bad_password: 'Sai mật khẩu.',
		seat_taken: 'Ghế này đã có người vào. Nếu đó là bạn trên máy khác, nhờ BTC "Mời ra" rồi vào lại.'
	};

	function codeFromUrl() {
		return (new URLSearchParams(location.search).get('room') || '').trim().toUpperCase();
	}

	function showJoined(code, seat) {
		$('#joinedRoom').textContent = 'Phòng ' + code;
		$('#joinedSeat').textContent = 'Ghế ' + seat;
		show($('#joinCard'), false);
		show($('#joinHeader'), false);
		show($('#joinedCard'), true);
		window.OlympiaPlayerPanel.start(code, seat);
	}

	function showJoin() {
		window.OlympiaPlayerPanel.stop();
		show($('#joinedCard'), false);
		show($('#joinHeader'), true);
		show($('#joinCard'), true);
	}

	async function onJoin(ev) {
		ev.preventDefault();
		$('#joinError').textContent = '';
		var code = $('#code').value.trim().toUpperCase();
		var seatInput = document.querySelector('input[name="seat"]:checked');
		var pw = $('#password').value;
		if (!/^[A-Z0-9]{4,12}$/.test(code)) { $('#joinError').textContent = 'Mã phòng không hợp lệ.'; return; }
		if (!seatInput) { $('#joinError').textContent = RESULT_TEXT.bad_seat; return; }
		if (pw.length < 4 || pw.length > 20) { $('#joinError').textContent = 'Mật khẩu có từ 4 đến 20 ký tự.'; return; }
		$('#joinBtn').disabled = true;
		try {
			await auth.ensureAnonymous();
			var r = await db.rpc('join_as_player', { p_code: code, p_password: pw, p_seat: parseInt(seatInput.value, 10) });
			if (r.error) { throw new Error(r.error.message); }
			if (r.data !== 'ok') { $('#joinError').textContent = RESULT_TEXT[r.data] || r.data; return; }
			$('#password').value = '';
			history.replaceState(null, '', '?room=' + encodeURIComponent(code));
			showJoined(code, seatInput.value);
		}
		catch (e) { $('#joinError').textContent = e.message; }
		finally { $('#joinBtn').disabled = false; }
	}

	async function onLeave() {
		var code = codeFromUrl();
		if (!confirm('Rời ghế? Muốn vào lại phải nhập mật khẩu.')) { return; }
		var r = await db.rpc('leave_seat', { p_code: code });
		if (r.error) { $('#joinError').textContent = r.error.message; }
		showJoin();
	}

	async function start() {
		if (!db) { $('#notice').textContent = 'Không tải được thư viện Supabase - kiểm tra kết nối mạng.'; show($('#notice'), true); return; }
		var code = codeFromUrl();
		$('#code').value = code;
		$('#joinForm').addEventListener('submit', onJoin);
		$('#leaveBtn').addEventListener('click', onLeave);
		/* back after a reload: still holding a seat? */
		if (code && await auth.currentSession()) {
			var r = await db.rpc('my_seat', { p_code: code });
			if (!r.error && r.data) { showJoined(code, r.data); return; }
		}
		showJoin();
	}

	start();
})();
