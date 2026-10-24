/*
 * Olympia Controller - player page, step 1: join a seat with the room code + the room's player password.
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
		seat_taken: 'Ghế này đã có người vào. Nếu đó là bạn trên máy khác, nhờ người quản lý phòng "Mời ra" rồi vào lại.'
	};

	var SEAT_KEY = 'olympia.seat.';   /* + room code: the seat this device last joined */
	function remember(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* private window */ } }
	function recall(key) { try { return localStorage.getItem(key) || ''; } catch (e) { return ''; } }
	function validCode(code) { return /^[A-Z0-9]{4,12}$/.test(code); }

	function codeFromUrl() {
		return (new URLSearchParams(location.search).get('room') || '').trim().toUpperCase();
	}

	/* the code from the link (lobby "Tham gia trận đấu", a shared link, a QR) is not asked again */
	function lockCode(on) {
		$('#codeText').textContent = $('#code').value;
		show($('#codeFixed'), on);
		show($('#codeBox'), !on);
	}

	/* the last seat in this room is picked again; the cursor goes to the first thing still missing */
	function prefill() {
		var code = $('#code').value.trim().toUpperCase();
		var seat = validCode(code) ? recall(SEAT_KEY + code) : '';
		var pick = seat && document.querySelector('input[name="seat"][value="' + seat + '"]');
		if (pick && !document.querySelector('input[name="seat"]:checked')) { pick.checked = true; }
		var next = !validCode(code) ? $('#code')
			: document.querySelector('input[name="seat"]:checked') ? $('#password')
			: document.querySelector('input[name="seat"]');
		next.focus();
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
		prefill();
	}

	async function onJoin(ev) {
		ev.preventDefault();
		$('#joinError').textContent = '';
		var code = $('#code').value.trim().toUpperCase();
		var seatInput = document.querySelector('input[name="seat"]:checked');
		var pw = $('#password').value;
		if (!validCode(code)) { $('#joinError').textContent = 'Mã phòng không hợp lệ.'; lockCode(false); $('#code').focus(); return; }
		if (!seatInput) { $('#joinError').textContent = RESULT_TEXT.bad_seat; return; }
		if (pw.length < 4 || pw.length > 20) { $('#joinError').textContent = 'Mật khẩu có từ 4 đến 20 ký tự.'; return; }
		$('#joinBtn').disabled = true;
		try {
			await auth.ensureAnonymous();
			var r = await db.rpc('join_as_player', { p_code: code, p_password: pw, p_seat: parseInt(seatInput.value, 10) });
			if (r.error) { throw new Error(r.error.message); }
			if (r.data !== 'ok') { $('#joinError').textContent = RESULT_TEXT[r.data] || r.data; return; }
			$('#password').value = '';
			remember(SEAT_KEY + code, seatInput.value);
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
		lockCode(validCode(code));
		$('#codeChange').addEventListener('click', function () { lockCode(false); $('#code').select(); $('#code').focus(); });
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
