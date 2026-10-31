/*
 * Olympia Controller - in a room the control panel runs the game itself.
 *
 * The game engine is default.html (rounds, graphics, sound, the room claim). It runs here, in a
 * small preview frame, as "default.html?room=CODE&embedded=1": it claims the room (one claim per
 * tab - migrations/0005), the panel drives it with the same keys / commands, and players, the
 * audience, podiums and stage screens follow it. A stage page opened on its own in a room never
 * runs the game (Init.js sends it to audience.html?view=stage), so the match does not depend on
 * the stage machine: closing or reloading it changes nothing.
 *   - opening the panel starts the engine as soon as no other engine is heard (another manager's
 *     panel may already run it - then this panel follows that one)
 *   - that other panel gone for good: this panel takes over (its engine starts fresh; the last
 *     automatic save - GameSave.js - brings the match back, see the "continue" line)
 *   - the sound plays only on the stage and audience screens, never here (AudioControl.js SoundAt)
 * "Dừng chạy trên máy này" ends the engine and frees the room.
 */
(function (gv) {
	var $ = function (s) { return document.querySelector(s); };
	var AUTO_START_MS = 4000;        /* longer than the 3 s an engine republishes */
	var TAKE_OVER_MS = 12000;        /* the engine followed silent this long: run it here */
	var openedAt = Date.now(), frame = null, autoDone = false, userStopped = false, silentSince = 0, note = '';

	function show(el, on) { el.classList.toggle('hidden', !on); }

	function engineUrl() {
		var q = new URLSearchParams();
		if (gv.Sync.room) { q.set('room', gv.Sync.room); }
		else if (new URLSearchParams(location.search).get('rules')) { q.set('rules', new URLSearchParams(location.search).get('rules')); }   /* trying O23 without a room */
		q.set('embedded', '1');
		return 'default.html?' + q.toString();
	}

	function engineSync() {
		try { return frame && frame.contentWindow && frame.contentWindow.GameVariables && frame.contentWindow.GameVariables.Sync; } catch (e) { return null; }
	}

	function fitPreview() {
		var box = $('#enginePreview');
		if (box && box.clientWidth) { box.style.setProperty('--engine-scale', String(box.clientWidth / 1920)); }
	}

	function start() {
		if (frame) { return; }
		note = '';
		frame = document.createElement('iframe');
		frame.src = engineUrl();
		frame.title = 'Trận chạy trên máy này';
		frame.setAttribute('allow', 'autoplay; fullscreen');
		frame.tabIndex = -1;   /* keys stay on the panel, which relays them like to any stage */
		$('#enginePreview').appendChild(frame);
		show($('#enginePreview'), true);
		fitPreview();
		render();
	}

	function stop(release) {
		if (!frame) { return; }
		console.log('[Engine] stopped here' + (note ? ': ' + note : (release ? ' by the operator' : '')));
		frame.remove();
		frame = null;
		show($('#enginePreview'), false);
		if (release && gv.Sync.room && window.OlympiaAuth && window.OlympiaAuth.client) {
			window.OlympiaAuth.client.rpc('release_stage', { p_code: gv.Sync.room });
		}
		render();
	}

	function render() {
		var st = $('#engineState');
		var engine = engineSync();
		var alive = gv.Sync.isAuthorityAlive();
		show($('#engineStart'), !frame);
		show($('#engineStop'), !!frame);
		$('#engineStart').disabled = alive && !frame;   /* another panel already runs the game */
		renderSound();
		renderSaved();
		st.className = 'engineState';
		var ignored = gv.Sync.ignoredEngines ? gv.Sync.ignoredEngines().filter(function (e) { return !e.embedded; }) : [];
		if (frame) {
			var s = engine ? engine.status : 'connecting';
			if (ignored.length && (s === 'online' || s === 'local')) { st.textContent = 'Trận đang chạy trên máy này; một màn sân khấu kiểu cũ cũng đang chạy trận và bị bỏ qua - hãy tải lại màn đó.'; st.classList.add('warn'); }
			else if (s === 'online' || s === 'local') { st.textContent = gv.Sync.room ? 'Trận đang chạy trên máy này. Màn sân khấu phát hình và âm thanh: đóng hay tải lại nó không ảnh hưởng trận.' : 'Trận đang chạy trên máy này (máy này không phát âm thanh).'; st.classList.add('on'); }
			else if (s === 'taken') { st.textContent = 'Đang chờ phòng: một máy khác vừa giữ phòng (tối đa 30 giây)...'; st.classList.add('warn'); }
			else if (s === 'error' || s === 'denied') { st.textContent = 'Không chạy được trên máy này: ' + (engine.statusDetail || s); st.classList.add('warn'); }
			else { st.textContent = 'Đang khởi động trận trên máy này...'; }
		}
		else if (alive && ignored.length) { st.textContent = 'Có ' + (ignored.length + 1) + ' nơi cùng chạy trận - bàn điều khiển chỉ theo một nơi. Hãy đóng bớt.'; st.classList.add('warn'); }
		else if (alive) { st.textContent = gv.Sync.room ? 'Trận đang chạy trên bàn điều khiển của một người quản lý khác; máy này điều khiển trận đó. Nếu máy kia tắt, máy này tự chạy tiếp.' : 'Trận đang chạy trên màn đồ hoạ (default.html) của trình duyệt này.'; st.classList.add('on'); }
		else if (note) { st.textContent = note; st.classList.add('warn'); }
		else if (!autoDone) { st.textContent = 'Đang khởi động trận...'; }
		else { st.textContent = 'Trận chưa chạy. Bấm "Chạy trận trên máy này".'; st.classList.add('warn'); }
	}

	function tick() {
		var alive = gv.Sync.isAuthorityAlive();
		var ready = gv.Sync.status === 'online' || gv.Sync.status === 'local';
		if (!autoDone && ready && Date.now() - openedAt > AUTO_START_MS) {
			autoDone = true;
			if (!alive) { start(); }
		}
		/* room mode: the engine this panel followed (another manager's panel) went quiet - take over */
		if (gv.Sync.room && autoDone && !frame && !userStopped && ready) {
			if (alive) { silentSince = 0; }
			else if (!silentSince) { silentSince = Date.now(); }
			else if (Date.now() - silentSince > TAKE_OVER_MS) {
				silentSince = 0;
				note = '';
				console.log('[Engine] no engine heard for ' + TAKE_OVER_MS / 1000 + ' s - running the match here');
				start();
			}
		}
		/* The panel follows one engine (StateSync.js). If that is a stage page, not this one - the
		 * stage was opened while this engine had nothing played yet - this engine steps aside, so
		 * keys and commands no longer drive two games. */
		var engine = engineSync();
		var lead = gv.Sync.followedEngine && gv.Sync.followedEngine();
		/* only a stage PAGE wins: another panel's engine is sorted out by the room claim
		 * (claim_stage) - stepping aside for it made two panels each stop for the other's engine,
		 * and then nobody ran the game */
		var leadIsStagePage = !!(gv.Sync.lastSnapshot && gv.Sync.lastSnapshot.embedded === false);
		if (frame && engine && lead && engine.instanceId && lead !== engine.instanceId && leadIsStagePage) {
			note = 'Màn sân khấu đã mở và đang chạy trận, nên máy này đã dừng chạy trận.';
			stop(false);
			render();
			return;
		}
		/* someone else's stage holds the room for good: this engine steps aside */
		if (frame && engine && engine.status === 'taken' && Date.now() - (frame.__takenSince || (frame.__takenSince = Date.now())) > 40000) {
			note = 'Một màn sân khấu khác đang chạy trận, nên máy này đã dừng.';
			stop(false);
		}
		else if (frame && engine && engine.status !== 'taken') { frame.__takenSince = 0; }
		render();
	}

	/* where the sound plays (room mode only: in one browser the graphics page plays it) */
	function renderSound() {
		var row = $('#soundRow'), snap = gv.Sync.lastSnapshot;
		show(row, !!gv.Sync.room && !!snap && gv.Sync.isAuthorityAlive());
		var screens = window.OlympiaRoomPresence ? window.OlympiaRoomPresence.screens() : null;
		var hint = '';
		if (snap && snap.soundAt && snap.soundAt !== 'here' && screens) {
			hint = !screens.total ? 'Chưa có màn sân khấu nào mở.'
				: screens.sound ? (screens.sound + '/' + screens.total + ' màn sân khấu đã bật âm thanh.' + (screens.sound > 1 ? ' Nhiều màn cùng phát sẽ bị vọng tiếng.' : ''))
				: 'Màn sân khấu chưa bật âm thanh: bấm nút "Bấm để bật âm thanh" trên màn đó.';
		}
		$('#soundHint').textContent = hint;
	}

	/* a fresh engine with an automatic save (panel reloaded, or taken over): offer to go on */
	function renderSaved() {
		var snap = gv.Sync.lastSnapshot, saved = snap && snap.savedGame;
		var on = !!(saved && snap.recoveryAllowed && !snap.progressRestored && gv.Sync.isAuthorityAlive());
		show($('#savedRow'), on);
		if (on) { $('#savedText').textContent = 'Có bản lưu trận lúc ' + new Date(saved.at).toLocaleTimeString('vi-VN') + ': ' + saved.text; }
	}

	/* RecoveryPanel.js: a recovery aimed at a freshly opened stage page first ends this engine */
	window.OlympiaEmbeddedStage = {
		running: function () { return !!frame; },
		/* ControlPanel.js: why the game is not running here, for the red strip ('' = nothing known) */
		problem: function () {
			var engine = engineSync();
			if (frame && engine && (engine.status === 'error' || engine.status === 'denied')) { return 'Không chạy được trận trên máy này: ' + (engine.statusDetail || engine.status); }
			if (frame && engine && engine.status === 'taken') { return 'Đang chờ phòng: một máy khác vừa giữ phòng (tối đa 30 giây)...'; }
			if (!frame && note) { return note; }
			return '';
		},
		stop: function (why) { if (frame) { note = why || ''; stop(false); } }
	};

	document.addEventListener('DOMContentLoaded', function () {
		$('#engineStart').addEventListener('click', function () { autoDone = true; userStopped = false; start(); });
		$('#engineStop').addEventListener('click', function () {
			if (confirm('Dừng chạy trận trên máy này? Trận dừng hẳn cho tới khi bấm "Chạy trận trên máy này" (ở đây hoặc ở bàn điều khiển khác). Bản lưu tự động vẫn còn để chạy tiếp.')) { userStopped = true; stop(true); }
		});
		$('#savedContinue').addEventListener('click', function () { var b = $('#rcOpen'); if (b) { b.click(); } });
		/* "Kết thúc trận đấu": a dialog of the page (not the browser's confirm). The engine stops
		 * every sound and wipes the save (GameSave.js endMatch) - whichever panel runs it. In a room
		 * the room goes too (its owner only - the database allows nobody else), and this panel goes
		 * back to the lobby; without a room the engine just starts a fresh match. */
		function endText(alive) {
			if (!alive) { return 'Trận chưa chạy nên không có gì để kết thúc.'; }
			return gv.Sync.room
				? 'Trận đang chơi dừng ngay, âm thanh tắt trên mọi màn và phòng ' + gv.Sync.room + ' bị xoá: thí sinh, khán giả và màn sân khấu đều bị ngắt, bàn điều khiển trở về sảnh. Không thể hoàn tác.'
				: 'Trận đang chơi dừng ngay: âm thanh tắt, bản lưu tự động bị xoá và trận trở về từ đầu. Không thể hoàn tác.';
		}
		async function deleteRoom() {
			var c = window.OlympiaAuth && window.OlympiaAuth.client;
			if (!c) { return 'Không kết nối được máy chủ.'; }
			var r = await c.from('rooms').delete().eq('code', gv.Sync.room).select('code');
			if (r.error) { return r.error.message; }
			return (r.data && r.data.length) ? '' : 'chỉ chủ phòng mới xoá được phòng';
		}
		$('#endMatchOpen').addEventListener('click', function () {
			var alive = gv.Sync.isAuthorityAlive();
			$('#endText').textContent = endText(alive);
			$('#endConfirm').disabled = !alive;
			$('#endConfirm').textContent = 'Kết thúc trận';
			$('#endCancel').disabled = false;
			$('#endCancel').textContent = 'Huỷ';
			$('#endDialog').showModal();
		});
		$('#endCancel').addEventListener('click', function () { $('#endDialog').close(); });
		$('#endConfirm').addEventListener('click', async function () {
			$('#endConfirm').disabled = true;
			$('#endCancel').disabled = true;
			$('#endConfirm').textContent = 'Đang kết thúc...';
			gv.Sync.sendCommand('endMatch');   /* sounds off on every screen at once, save wiped */
			if (!gv.Sync.room) {
				$('#endText').textContent = 'Đang kết thúc trận - trận mới sẽ sẵn sàng sau vài giây.';
				setTimeout(function () { $('#endDialog').close(); }, 4000);
				return;
			}
			await new Promise(function (ok) { setTimeout(ok, 800); });   /* let the sound stop reach the screens first */
			var why = await deleteRoom();
			if (!why) {
				userStopped = true;
				stop(false);
				$('#endText').textContent = 'Đã kết thúc trận và xoá phòng ' + gv.Sync.room + '. Đang về sảnh...';
				setTimeout(function () { location.href = window.OlympiaAuth.lobbyUrl(); }, 1200);
				return;
			}
			$('#endText').textContent = 'Đã kết thúc trận (trận mới sẵn sàng sau vài giây) nhưng chưa xoá được phòng: ' + why + '.';
			$('#endCancel').disabled = false;
			$('#endCancel').textContent = 'Đóng';
		});
		window.addEventListener('resize', fitPreview);
		setInterval(tick, 1000);
		render();
	});
})(window.GameVariables);
