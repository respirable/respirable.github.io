/*
 * Olympia Controller - audience screen, "Chung vui với thí sinh": during Vượt chướng ngại vật and
 * Tăng tốc a viewer answers the rows, the obstacle and the Tăng tốc questions along with the
 * contestants, then compares answer and time with theirs once the stage reveals them. No score
 * is kept. The strip is always there in those two rounds (while their graphics are up) and
 * never in Khởi động / Về đích; AudienceMirror.js places it in the picture.
 *
 * Everything stays on this device (localStorage per room) - nothing is sent anywhere, and the
 * contestants never see it. The answer box opens under the same rules as a contestant's
 * (Scripts/PlayerPanel.js) and locks just before the clock reaches 0. An answer is judged only
 * from what the stage has revealed: a contestant's answer the host marked right, or the row's
 * letters once the stage opens them.
 */
(function () {
	var A = window.OlympiaAudience, gv = window.GameVariables;
	var $ = function (s) { return document.querySelector(s); };
	function show(el, on) { el.classList.toggle('hidden', !on); }
	if (!A || !A.code) { return; }
	/* a stage page that found the game running elsewhere shows the picture only */
	if (new URLSearchParams(location.search).get('view') === 'stage') { A.setPlayVisible(false); return; }
	/* joined as a viewer who only watches (index.html "Tham gia trận đấu": &play=0) */
	if (new URLSearchParams(location.search).get('play') === '0') { A.setPlayVisible(false); return; }

	var KEY = 'olympia.audiencePlay.' + A.code;
	var LOCK_EARLY_S = 0.1;
	var store = load();
	var snap = null, lastKey = '';

	function load() {
		try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.answers) { return { answers: s.answers, keyword: s.keyword || null, matchId: s.matchId || null }; } } catch (e) { /* private mode */ }
		return { answers: {}, keyword: null, matchId: null };
	}
	function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* private mode */ } }

	/* a new match in the same room (the stage says which: snap.matchId) - the same set asks the
	 * same questions, so the last match's answers would show up again */
	function checkMatch(s) {
		var id = s && s.matchId;
		if (!id || id === store.matchId) { return; }
		var had = Object.keys(store.answers).length || store.keyword;
		store = { answers: {}, keyword: null, matchId: id };
		lastKey = '';
		save();
		if (had) { console.log('[AudiencePlay] new match ' + id + ' - the last match\'s answers are forgotten'); }
	}

	/* a short stamp of the question text, so "row 2" of today's game is not last week's row 2 */
	function stamp(text) {
		var h = 0, s = String(text || '');
		for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
		return (h >>> 0).toString(36);
	}

	function rs(name) { return (snap && snap.roundState && snap.roundState[name]) || {}; }
	function scene() { return (snap && snap.scene) || {}; }
	function round() { return snap ? snap.currentRound : ''; }
	function fmt(sec) { return (typeof sec === 'number' && isFinite(sec)) ? sec.toFixed(2) + 's' : ''; }
	function matches(a, b) { return !!(a && b) && (gv.answerMatches ? gv.answerMatches(a, b) : String(a).trim().toUpperCase() === String(b).trim().toUpperCase()); }

	/* the strip shows while the VCNV / Tăng tốc graphics are on screen (not on the title card) */
	function stripWanted() {
		var sc = scene();
		if (round() === 'vcnv') { return !!((sc.vcnv && sc.vcnv.on) || sc.tree); }
		if (round() === 'tt') { return !!((sc.tt && sc.tt.on) || sc.tree); }
		return false;
	}

	function timerLeft() {
		var t = snap && snap.timer, e = A.timerElapsed();
		if (!t || !t.running || e === null) { return null; }
		return Math.max(0, t.duration - e);
	}
	function stillTime() { var l = timerLeft(); return !!(snap && snap.timer && snap.timer.running) && (l === null || l > LOCK_EARLY_S); }

	/* the question a viewer may answer now: { key, label, timed } or null */
	function target() {
		if (round() === 'vcnv') {
			var v = rs('vcnv'), q = scene().vcnv && scene().vcnv.question;
			if (v.currentRow && q && (v.phase === 'rowQuestion' || (v.phase === 'rowTimer' && stillTime()))) {
				return { key: 'vcnv:' + v.currentRow + ':' + stamp(q), label: v.currentRow === 5 ? 'Ô TRUNG TÂM' : 'HÀNG NGANG ' + v.currentRow, timed: v.phase === 'rowTimer' };
			}
		}
		if (round() === 'tt') {
			var t = rs('tt');
			if (t.phase === 'timer' && stillTime()) {
				return { key: 'tt:' + t.index + ':' + stamp(t.question), label: 'CÂU ' + t.index, timed: true };
			}
		}
		return null;
	}

	/* the question on screen (answerable or not), for showing my answer + how it compares */
	function currentKey() {
		if (round() === 'vcnv' && rs('vcnv').currentRow && scene().vcnv && scene().vcnv.question) { return 'vcnv:' + rs('vcnv').currentRow + ':' + stamp(scene().vcnv.question); }
		if (round() === 'tt' && rs('tt').index && rs('tt').question) { return 'tt:' + rs('tt').index + ':' + stamp(rs('tt').question); }
		return '';
	}

	/* ---------- comparing (only with what the stage has revealed) ---------- */

	function judgeVcnvRow(mine, row) {
		var v = rs('vcnv'), r = (v.rows || [])[row - 1] || {};
		if (r.letters && r.letters.length) { return matches(mine.text, r.letters.join('')) ? 'ok' : 'bad'; }
		var tree = scene().tree;
		if (tree && v.treeCorrect && v.currentRow === row) {
			var right = tree.entries.filter(function (e) { return v.treeCorrect.indexOf(e.seat) !== -1; });
			if (right.some(function (e) { return matches(mine.text, e.answer); })) { return 'ok'; }
			return right.length ? 'bad' : 'unknown';   /* nobody right: the row stays closed - nothing to check against yet */
		}
		return 'pending';
	}

	function judgeTangToc(mine) {
		var t = rs('tt');
		if (!t.answers || !t.correctSeats) { return { state: 'pending' }; }
		var right = t.correctSeats.map(function (s) { return { answer: t.answers[s], time: t.times ? t.times[s] : null }; });
		if (!right.some(function (e) { return matches(mine.text, e.answer); })) { return { state: right.length ? 'bad' : 'unknown' }; }
		var faster = right.filter(function (e) { return typeof e.time === 'number' && (mine.elapsed === null || e.time < mine.elapsed); }).length;
		return { state: 'ok', place: faster + 1 };
	}

	function judgeKeyword() {
		var k = store.keyword, kw = rs('vcnv').keyword;
		if (!k || !kw) { return null; }
		return matches(k.text, kw) ? 'ok' : 'bad';
	}

	/* ---------- drawing ---------- */

	function chip(k, v, cls) {
		var c = document.createElement('span');
		c.className = 'aChip' + (cls ? ' ' + cls : '');
		if (k) { var a = document.createElement('span'); a.className = 'k'; a.textContent = k; c.appendChild(a); }
		var b = document.createElement('span'); b.className = 'v'; b.textContent = v; c.appendChild(b);
		return c;
	}

	function renderResult() {
		var box = $('#aResult');
		box.textContent = '';
		var key = currentKey();
		var mine = key && store.answers[key];
		if (mine) {
			box.appendChild(chip('BẠN', mine.text + (mine.elapsed !== null ? '  ·  ' + fmt(mine.elapsed) : '')));
			if (key.indexOf('vcnv:') === 0) {
				var j = judgeVcnvRow(mine, Number(key.split(':')[1]));
				if (j === 'ok') { box.appendChild(chip('', 'TRÙNG ĐÁP ÁN ĐÚNG', 'ok')); }
				else if (j === 'bad') { box.appendChild(chip('', 'KHÁC ĐÁP ÁN ĐÚNG', 'bad')); }
				else if (j === 'unknown') { box.appendChild(chip('', 'chưa có đáp án để đối chiếu')); }
			}
			else {
				var t = rs('tt');
				if (t.answers && t.times && mine.elapsed !== null) {
					var timed = (snap.players || []).filter(function (p) { return typeof t.times[p.seat] === 'number'; });
					var slower = timed.filter(function (p) { return t.times[p.seat] > mine.elapsed; }).length;
					if (timed.length) { box.appendChild(chip('NHANH HƠN', slower + ' / ' + timed.length + ' thí sinh')); }
				}
				var r = judgeTangToc(mine);
				if (r.state === 'ok') { box.appendChild(chip('', 'TRÙNG ĐÁP ÁN ĐÚNG · XẾP THỨ ' + r.place, 'ok')); }
				else if (r.state === 'bad') { box.appendChild(chip('', 'KHÁC ĐÁP ÁN ĐÚNG', 'bad')); }
				else if (r.state === 'unknown') { box.appendChild(chip('', 'không thí sinh nào đúng - chưa đối chiếu được')); }
			}
		}
		if (round() === 'vcnv' && store.keyword) {
			var kj = judgeKeyword();
			var opened = store.keyword.center ? 'sau ô trung tâm' : 'sau ' + store.keyword.rows + ' hàng';
			box.appendChild(chip('CNV CỦA BẠN', store.keyword.text + '  ·  ' + opened, kj === 'ok' ? 'ok' : kj === 'bad' ? 'bad' : ''));
		}
	}

	function render() {
		var wanted = stripWanted();
		A.setPlayVisible(wanted);
		if (!wanted) { return; }

		var t = target(), input = $('#aInput');
		input.disabled = !t;
		$('#aSend').disabled = !t;
		$('#aFieldTab').textContent = t ? t.label : (round() === 'tt' ? 'TĂNG TỐC' : 'HÀNG NGANG');
		input.placeholder = t ? (store.answers[t.key] ? 'Có thể sửa và gửi lại trước khi hết giờ' : 'Nhập đáp án của bạn...') : 'Chờ câu hỏi tiếp theo...';
		if (!t && document.activeElement === input) { input.blur(); }
		if (t && t.key !== lastKey) { input.value = ''; lastKey = t.key; }

		var v = rs('vcnv');
		var keyRound = round() === 'vcnv' && !store.keyword && !v.keyword && !v.solved;
		var canGuess = keyRound && v.phase !== 'finished' && v.phase !== 'done' && (v.openedCount || 0) >= 1;
		show($('#aKeyForm'), keyRound);
		$('#aKeyInput').disabled = !canGuess;
		$('#aKeySend').disabled = !canGuess;
		$('#aKeyInput').placeholder = canGuess ? 'Đoán CNV (một lần)...' : 'Mở khi đã có 1 hàng';
		renderResult();
	}

	/* the countdown on the send button + locking at 0, between two states */
	function tick() {
		if (!stripWanted()) { return; }
		var t = target(), l = timerLeft();
		$('#aSend').textContent = (t && t.timed && l !== null) ? 'GỬI · ' + Math.ceil(l) + 's' : 'GỬI';
		if (!t !== $('#aInput').disabled) { render(); }
	}

	/* ---------- input ---------- */

	function onSend(ev) {
		ev.preventDefault();
		var t = target();
		var text = $('#aInput').value.replace(/\s+/g, ' ').trim();
		if (!t || !text) { return; }
		var e = (t.timed && snap.timer && snap.timer.running) ? A.timerElapsed() : null;
		store.answers[t.key] = { text: text.toUpperCase(), elapsed: e === null ? null : Math.round(e * 100) / 100, at: Date.now() };
		/* keep the store small: the last 40 answers are plenty for one show */
		var keys = Object.keys(store.answers);
		if (keys.length > 40) { keys.sort(function (a, b) { return store.answers[a].at - store.answers[b].at; }).slice(0, keys.length - 40).forEach(function (k) { delete store.answers[k]; }); }
		save();
		render();
	}

	function onGuess(ev) {
		ev.preventDefault();
		var v = rs('vcnv');
		var text = $('#aKeyInput').value.replace(/\s+/g, ' ').trim();
		if (!text || store.keyword || v.solved || v.keyword) { return; }
		if (!confirm('Đoán chướng ngại vật là "' + text.toUpperCase() + '"? Chỉ được đoán một lần.')) { return; }
		store.keyword = { text: text.toUpperCase(), rows: v.openedCount || 0, center: !!v.centerOpened };
		save();
		$('#aKeyInput').value = '';
		render();
	}

	/* a new obstacle (another game in this room): the old guess no longer applies */
	function forgetOldKeyword() {
		var v = rs('vcnv');
		if (store.keyword && round() === 'vcnv' && v.phase === 'board' && (v.openedCount || 0) === 0) { store.keyword = null; save(); }
	}

	A.onState(function (s) {
		snap = s;
		checkMatch(s);
		forgetOldKeyword();
		render();
	});
	$('#aForm').addEventListener('submit', onSend);
	$('#aKeyForm').addEventListener('submit', onGuess);
	setInterval(tick, 100);
	render();
})();
