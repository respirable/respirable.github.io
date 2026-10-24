/*
 * Olympia Controller - who is connected to the room (control panel, room mode only).
 *
 * The podium, player and audience pages announce themselves on pub:CODE with Realtime presence
 * (PublicRoom.js, presence: { role, seat }); this panel listens on the same channel - it never
 * announces itself - and shows a dot per podium and per player seat, and how many audience
 * screens are open. It also shows the audience / player links as QR codes (QrCode.js) to put
 * on the projector or hand round.
 */
(function (gv) {
	var $ = function (s) { return document.querySelector(s); };
	var channel = null, started = false, state = {};

	function link(page, seat) {
		var u = new URL(page, location.href);
		u.search = '';
		u.searchParams.set('room', gv.Sync.room);
		if (seat) { u.searchParams.set('seat', String(seat)); }
		return u.href;
	}

	function tally() {
		var t = { podium: {}, player: {}, audience: 0, screen: 0, screenSound: 0 };
		Object.keys(state).forEach(function (key) {
			(state[key] || []).forEach(function (m) {
				if (m.role === 'podium' && m.seat) { t.podium[m.seat] = (t.podium[m.seat] || 0) + 1; }
				else if (m.role === 'player' && m.seat) { t.player[m.seat] = (t.player[m.seat] || 0) + 1; }
				else if (m.role === 'audience') { t.audience += 1; }
				else if (m.role === 'screen') { t.screen += 1; if (m.sound) { t.screenSound += 1; } }
			});
		});
		return t;
	}

	function render() {
		var t = tally();
		[1, 2, 3, 4].forEach(function (s) {
			var pd = $('#presPodium' + s), pl = $('#presPlayer' + s);
			pd.classList.toggle('on', !!t.podium[s]);
			pd.title = t.podium[s] ? ('Bảng điểm ghế ' + s + ' đang mở' + (t.podium[s] > 1 ? ' (' + t.podium[s] + ' màn)' : '')) : ('Bảng điểm ghế ' + s + ' chưa mở / mất kết nối');
			pl.classList.toggle('on', !!t.player[s]);
			pl.title = t.player[s] ? ('Thí sinh ghế ' + s + ' đang kết nối' + (t.player[s] > 1 ? ' (' + t.player[s] + ' máy)' : '')) : ('Thí sinh ghế ' + s + ' chưa vào / mất kết nối');
		});
		$('#presAudience').textContent = t.audience + ' màn' + (t.screen ? ' · ' + t.screen + ' màn chiếu' : '');
	}

	function start() {
		var client = window.OlympiaAuth && window.OlympiaAuth.client;
		if (started || !client || !gv.Sync.room) { return; }
		started = true;
		$('#presenceSec').classList.remove('hidden');
		channel = client.channel('pub:' + gv.Sync.room, { config: { private: true, broadcast: { self: false } } });
		channel.on('presence', { event: 'sync' }, function () { state = channel.presenceState(); render(); });
		channel.subscribe(function (st) {
			if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { $('#presAudience').textContent = 'không đọc được (' + st + ')'; }
		});
		render();
	}

	/* EmbeddedStage.js: how many stage screens are open, and how many have their sound on */
	window.OlympiaRoomPresence = {
		screens: function () { if (!started) { return null; } var t = tally(); return { total: t.screen, sound: t.screenSound }; }
	};

	function showQr(which) {
		var url = which === 'player' ? link('player.html') : link('audience.html');
		var box = $('#qrBox');
		box.textContent = '';
		box.appendChild(window.OlympiaQr.canvas(url, 420));
		$('#qrTitle').textContent = which === 'player' ? 'Thí sinh vào thi (cần mật khẩu phòng)' : 'Khán giả xem trận và chung vui';
		$('#qrLink').textContent = url;
		document.querySelectorAll('#qrDialog [data-qr]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-qr') === which); });
		if (!$('#qrDialog').open) { $('#qrDialog').showModal(); }
	}

	document.addEventListener('DOMContentLoaded', function () {
		$('#qrOpen').addEventListener('click', function () { showQr('audience'); });
		document.querySelectorAll('#qrDialog [data-qr]').forEach(function (b) { b.addEventListener('click', function () { showQr(b.getAttribute('data-qr')); }); });
		$('#qrClose').addEventListener('click', function () { $('#qrDialog').close(); });
		gv.Sync.on('status', function (st) { if (st === 'online') { start(); } });
		if (gv.Sync.status === 'online') { start(); }
	});
})(window.GameVariables);
