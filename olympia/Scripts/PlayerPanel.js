/*
 * Olympia Controller - player page, step 2: playing from the player's own device.
 *
 * A player may stand with their back to the projection, so besides the controls this screen
 * repeats what the stage shows: the question, the Tăng tốc picture / video (played in step with
 * the stage clock), the obstacle board, everyone's answers once the stage reveals them, and all
 * four scores. Everything comes from the public state (PublicRoom.js), which never carries an
 * answer before the stage shows it.
 *
 * Actions go through player_action(); the stage decides whether they count
 * (Scripts/PlayerActions.js) - the rules here only decide which buttons are lit.
 */
(function () {
	var auth = window.OlympiaAuth;
	var db = auth && auth.client;
	var $ = function (s) { return document.querySelector(s); };
	function show(el, on) { el.classList.toggle('hidden', !on); }
	function el(tag, cls, text) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (text !== undefined) { e.textContent = text; } return e; }

	var ROUND_NAMES = { kd: 'Khởi động', vcnv: 'Vượt chướng ngại vật', tt: 'Tăng tốc', vd: 'Về đích', tb: 'Câu hỏi phụ' };
	var VCNV_ROW_STEPS = ['board', 'rowSelected', 'rowQuestion', 'rowTimer', 'rowAnswers', 'rowGraded', 'rowBack', 'finalWindow'];
	var SEND_ERRORS = {
		not_seated: 'Bạn không còn giữ ghế này - hãy vào phòng lại.',
		throttled: 'Bấm quá nhanh - chờ vài giây.',
		too_big: 'Đáp án quá dài.'
	};

	var room = null, code = '', seat = 0, snap = null, uiTimer = null;
	var assets = {};   /* the VCNV picture as players may see it (key -> data URL) */
	var sent = { key: '', text: '', elapsed: null, pending: false };   /* my last answer, per question */

	/* ---------- this device's clock vs the database clock ----------
	 * best of several samples, like the stage; the stage sends the timer start in database time,
	 * so the time of an answer / a press is measured here, at the press */
	var serverOffset = null, bestRtt = Infinity, clockTimer = null;
	async function sampleClock() {
		var t0 = Date.now();
		var r = await db.rpc('server_now_ms');
		var t1 = Date.now();
		if (r.error || !r.data) { return; }
		if (t1 - t0 <= bestRtt) { bestRtt = t1 - t0; serverOffset = Number(r.data) - (t0 + t1) / 2; }
	}
	async function syncClock(n) { bestRtt *= 1.5; for (var i = 0; i < n; i++) { await sampleClock(); } }
	function serverNow() { return serverOffset === null ? null : Date.now() + serverOffset; }

	/* seconds since the clock started, or null */
	function timerElapsed() {
		var t = snap && snap.timer;
		if (!t) { return null; }
		if (t.paused && typeof t.pausedElapsed === 'number') { return t.pausedElapsed; }   /* held (Câu hỏi phụ buzz) */
		var now = serverNow();
		if (t.serverStart && now !== null) { return (now - t.serverStart) / 1000; }
		return room ? (room.stageNow() - t.wallStart) / 1000 : null;
	}
	function timerLeft() {
		var t = snap && snap.timer, e = timerElapsed();
		if (!t || e === null) { return null; }
		return t.mode === 'up' ? Math.min(t.duration, e) : Math.max(0, t.duration - e);
	}

	/* ---------- what is allowed now (mirrors the stage's checks) ---------- */

	function rs(name) { return (snap && snap.roundState && snap.roundState[name]) || {}; }
	function timerRunning() { return !!(snap && snap.timer && snap.timer.running); }
	function round() { return snap ? snap.currentRound : ''; }

	function canBuzz() {
		var kd = rs('kd'), vd = rs('vd');
		if (round() === 'kd') { return kd.mode === 'common' && kd.phase === 'question' && kd.buzzSeat == null && !kd.resolved; }
		if (round() === 'vd') { return vd.phase === 'steal' && vd.stealSeat == null && vd.seat !== seat; }
		if (round() === 'tb') {
			var tb = rs('tb');
			if (tb.buzzSeat != null || (tb.seats || []).indexOf(seat) === -1 || (tb.eliminated || []).indexOf(seat) !== -1) { return false; }
			return tb.phase === 'question' || (tb.phase === 'timer' && stillTime());   /* allowed as soon as the question is up */
		}
		return false;
	}

	/* Câu hỏi phụ: am I playing it, and am I still in the current question */
	function tbPlaying() { return (rs('tb').seats || []).indexOf(seat) !== -1; }
	function tbOut() { return (rs('tb').eliminated || []).indexOf(seat) !== -1; }

	function canCnv() {
		if (round() !== 'vcnv') { return false; }
		var v = rs('vcnv');
		if (v.solved || (v.eliminated || []).indexOf(seat) !== -1 || (v.queue || []).indexOf(seat) !== -1) { return false; }
		return (v.openedCount || 0) >= 1 && (VCNV_ROW_STEPS.indexOf(v.phase) !== -1 || v.phase === 'guessing');
	}

	/* the clock is still running ON THIS SCREEN: locks the answer box as it reaches 0, not when
	 * the stage's "time up" arrives a moment later (an answer then would be refused anyway).
	 * LOCK_EARLY_S covers this check's 100 ms period + clock-sync error, so anything that can
	 * still be sent is in time. */
	var LOCK_EARLY_S = 0.1;
	function stillTime() {
		if (!timerRunning()) { return false; }
		var left = timerLeft();
		return left === null || left > LOCK_EARLY_S;
	}

	/* { key, label, payload } of the question an answer would go to, or null */
	function answerTarget() {
		if (round() === 'vcnv') {
			var v = rs('vcnv');
			if (!v.currentRow || (v.eliminated || []).indexOf(seat) !== -1) { return null; }
			if (v.phase === 'rowQuestion' || (v.phase === 'rowTimer' && stillTime())) {
				return { key: 'vcnv:' + v.currentRow, label: v.currentRow === 5 ? 'Đáp án ô trung tâm' : 'Đáp án hàng ngang ' + v.currentRow, payload: { row: v.currentRow } };
			}
		}
		if (round() === 'tt') {
			var t = rs('tt');
			if (t.phase === 'timer' && stillTime()) {
				return { key: 'tt:' + t.index, label: 'Đáp án câu ' + t.index + ' / ' + t.count, payload: { index: t.index } };
			}
		}
		return null;
	}

	/* the question an answer from me is about right now, answerable or not (for "sent" display) */
	function questionKey() {
		if (round() === 'vcnv' && rs('vcnv').currentRow) { return 'vcnv:' + rs('vcnv').currentRow; }
		if (round() === 'tt' && rs('tt').index) { return 'tt:' + rs('tt').index; }
		return '';
	}

	/* ---------- texts ---------- */

	function player(s) { return snap && (snap.players || []).filter(function (x) { return x.seat === s; })[0]; }
	function nameOf(s) { var p = player(s); return p ? p.displayName : ('Ghế ' + s); }
	function fmt(sec) { return sec === null || sec === undefined ? '' : (Math.round(sec * 100) / 100).toFixed(2) + 's'; }

	function stepText() {
		if (!snap) { return 'Đang chờ màn sân khấu...'; }
		var kd = rs('kd'), v = rs('vcnv'), t = rs('tt'), d = rs('vd');
		if (round() === 'kd') {
			if (kd.phase !== 'question') { return 'Chờ câu hỏi'; }
			if (kd.mode === 'common') { return 'Lượt chung - bấm chuông để giành quyền trả lời'; }
			return kd.seat === seat ? 'Lượt riêng của BẠN - trả lời bằng lời' : 'Lượt riêng của ' + nameOf(kd.seat);
		}
		if (round() === 'vcnv') {
			var row = v.currentRow === 5 ? 'ô trung tâm' : 'hàng ngang ' + v.currentRow;
			switch (v.phase) {
				case 'board': return 'Chờ chọn hàng ngang';
				case 'rowSelected': return 'Đã chọn ' + row;
				case 'rowQuestion': return 'Câu hỏi ' + row + ' - có thể ghi đáp án';
				case 'rowTimer': return timerRunning() ? 'Ghi đáp án ' + row : 'Hết giờ ' + row;
				case 'rowAnswers': case 'rowGraded': return 'Đáp án ' + row;
				case 'rowBack': return 'Về bảng chướng ngại vật';
				case 'guessing': return 'Có người xin trả lời chướng ngại vật';
				case 'finalWindow': return 'Cơ hội cuối - xin trả lời chướng ngại vật';
				case 'finished': case 'done': return 'Đã mở chướng ngại vật';
				default: return 'Chờ bắt đầu';
			}
		}
		if (round() === 'tt') {
			switch (t.phase) {
				case 'question': return 'Câu ' + t.index + ' / ' + t.count + ' - chờ tính giờ';
				case 'timer': return timerRunning() ? 'Ghi đáp án càng nhanh càng tốt' : 'Hết giờ';
				case 'answers': case 'graded': return 'Đáp án câu ' + t.index;
				default: return 'Chờ câu hỏi';
			}
		}
		if (round() === 'vd') {
			if (d.phase === 'steal') { return d.seat === seat ? 'Các thí sinh khác đang giành quyền' : 'Giành quyền trả lời - bấm chuông!'; }
			if (d.seat) { return d.seat === seat ? 'Lượt Về đích của BẠN' : 'Lượt Về đích của ' + nameOf(d.seat); }
			return 'Chờ gọi thí sinh';
		}
		if (round() === 'tb') {
			var tb = rs('tb');
			if (tb.phase === 'finished' || tb.winner != null) { return 'Câu hỏi phụ đã kết thúc'; }
			if (tb.phase === 'idle') { return 'Chờ câu hỏi phụ'; }
			if (!tbPlaying()) { return 'Bạn không thi câu hỏi phụ'; }
			if (tb.phase === 'question') { return 'Câu hỏi phụ'; }
			if (tb.phase === 'timer') { return tb.timerPaused ? 'Đồng hồ tạm dừng - đang chờ chấm' : timerRunning() ? 'Bấm chuông để trả lời!' : 'Hết giờ'; }
			if (tb.phase === 'closed') { return tb.lastQuestion ? 'Không ai trả lời đúng' : 'Không ai trả lời đúng - chờ câu kế'; }
			return 'Chuẩn bị câu hỏi phụ';
		}
		return 'Đang chờ...';
	}

	function questionText() {
		if (round() === 'kd') { return rs('kd').phase === 'question' ? (rs('kd').currentQuestion || '') : ''; }
		if (round() === 'vcnv') { return rs('vcnv').currentQuestion || ''; }
		if (round() === 'tt') { return rs('tt').question || ''; }
		if (round() === 'vd') { return rs('vd').question || ''; }
		if (round() === 'tb') { return rs('tb').currentQuestion || ''; }
		return '';
	}

	/* the small chips under the question */
	function facts() {
		var out = [], kd = rs('kd'), v = rs('vcnv'), t = rs('tt'), d = rs('vd');
		if (round() === 'kd' && kd.phase === 'question') {
			out.push(['Câu', kd.questionIndex + ' / ' + kd.questionCount]);
			out.push(['Lượt', kd.mode === 'common' ? 'Chung' : 'Riêng - ' + nameOf(kd.seat)]);
		}
		if (round() === 'vcnv' && v.phase && v.phase !== 'idle' && v.phase !== 'title') {
			out.push(['Đã mở', (v.openedCount || 0) + ' / 4 hàng']);
			if ((v.queue || []).length) { out.push(['Xin trả lời CNV', v.queue.map(nameOf).join(', '), 'hot']); }
		}
		if (round() === 'tt' && t.index) { out.push(['Câu', t.index + ' / ' + t.count]); out.push(['Thời gian', (t.seconds || 0) + ' giây']); }
		if (round() === 'vd' && d.seat) {
			out.push(['Người thi', nameOf(d.seat)]);
			if (d.qIndex) { out.push(['Câu', d.qIndex + ' / 3']); out.push(['Giá trị', d.value + ' điểm']); }
			if (d.star && d.star === d.qIndex) { out.push(['', '★ Ngôi sao hy vọng', 'star']); }
		}
		var tb = rs('tb');
		if (round() === 'tb' && (tb.seats || []).length) {
			out.push(['Thi câu hỏi phụ', tb.seats.map(nameOf).join(', ')]);
			if (tb.questionIndex) { out.push(['Câu', String(tb.questionIndex)]); }
		}
		return out;
	}

	/* the strip under the header: who has the turn, my position in the CNV queue... */
	function banner() {
		var kd = rs('kd'), v = rs('vcnv'), d = rs('vd');
		if (round() === 'kd' && kd.mode === 'common' && kd.buzzSeat != null) {
			return kd.buzzSeat === seat ? ['BẠN đã giành quyền trả lời!', 'mine'] : [nameOf(kd.buzzSeat) + ' đã giành quyền trả lời.', ''];
		}
		if (round() === 'vd' && d.stealSeat != null) {
			return d.stealSeat === seat ? ['BẠN đã giành quyền trả lời!', 'mine'] : [nameOf(d.stealSeat) + ' đã giành quyền trả lời.', ''];
		}
		if (round() === 'tb') {
			var tb = rs('tb');
			if (tb.winner != null) { return tb.winner === seat ? ['BẠN đã trả lời đúng câu hỏi phụ!', 'mine'] : [nameOf(tb.winner) + ' đã trả lời đúng câu hỏi phụ.', '']; }
			if (tb.buzzSeat != null) {
				if (tb.buzzSeat !== seat) { return [nameOf(tb.buzzSeat) + ' đã bấm chuông.', '']; }
				return ['BẠN đã giành quyền trả lời!', 'mine'];   /* an early buzz looks the same - the rule is not told here */
			}
			if (tbPlaying() && tbOut()) { return ['Bạn đã bị loại khỏi câu hỏi này.', 'bad']; }
		}
		if (round() === 'vcnv') {
			if (v.solved) { return v.solvedBy === seat ? ['BẠN đã giải được chướng ngại vật!', 'mine'] : [nameOf(v.solvedBy) + ' đã giải được chướng ngại vật: ' + (v.keyword || ''), '']; }
			if (v.keyword) { return ['Chướng ngại vật: ' + v.keyword, '']; }
			if ((v.eliminated || []).indexOf(seat) !== -1) { return ['Bạn đã bị loại khỏi phần chướng ngại vật.', 'bad']; }
			var pos = (v.queue || []).indexOf(seat);
			if (pos !== -1) { return ['Bạn đã xin trả lời chướng ngại vật (thứ ' + (pos + 1) + ') - hãy nói đáp án.', 'mine']; }
		}
		return ['', ''];
	}

	/* ---------- drawing ---------- */

	/* during the Câu hỏi phụ no score is shown anywhere (the stage's bars show names only) */
	function scoresHidden() { var tb = rs('tb'); return round() === 'tb' && ['ready', 'set', 'question', 'timer', 'closed'].indexOf(tb.phase) !== -1; }

	function renderScores() {
		var body = $('#scoreBody');
		body.textContent = '';
		var kd = rs('kd'), v = rs('vcnv'), d = rs('vd');
		(snap ? snap.players || [] : []).forEach(function (p) {
			var tr = el('tr');
			var note = '';
			if (p.isBuzzed) { note = round() === 'vcnv' ? 'xin trả lời CNV' : 'bấm chuông'; tr.classList.add('buzz'); }
			else if ((round() === 'vd' && d.seat === p.seat) || (round() === 'kd' && kd.mode !== 'common' && kd.phase === 'question' && kd.seat === p.seat)) { note = 'đang thi'; tr.classList.add('onstage'); }
			if (round() === 'vcnv' && (v.eliminated || []).indexOf(p.seat) !== -1) { note = 'đã bị loại CNV'; tr.classList.add('out'); }
			var tb = rs('tb');
			if (round() === 'tb' && (tb.seats || []).length) {
				if ((tb.seats || []).indexOf(p.seat) === -1) { note = 'không thi câu phụ'; tr.classList.add('out'); }
				else if ((tb.eliminated || []).indexOf(p.seat) !== -1) { note = 'bị loại câu này'; tr.classList.add('out'); }
				if (tb.winner === p.seat) { note = 'trả lời đúng câu phụ'; }
			}
			if (p.seat === seat) { tr.classList.add('me'); }
			tr.appendChild(el('td', 'n', String(p.seat)));
			var name = el('td', 'p', p.displayName + (p.seat === seat ? ' (bạn)' : ''));
			if (note) { name.appendChild(el('small', '', note)); }
			tr.appendChild(name);
			tr.appendChild(el('td', 's', scoresHidden() ? '—' : String(Math.round(p.score || 0))));
			body.appendChild(tr);
		});
	}

	function renderVcnv() {
		var v = rs('vcnv');
		var on = round() === 'vcnv' && v.phase && v.phase !== 'idle' && v.phase !== 'title';
		show($('#vcnvView'), on);
		if (!on) { return; }
		var img = $('#vcnvImg');
		var picture = (v.imageKey && assets[v.imageKey]) || '';   /* covered parts are black (VcnvPublicImage.js) */
		if (img.getAttribute('src') !== picture) { if (picture) { img.setAttribute('src', picture); } else { img.removeAttribute('src'); } }
		document.querySelectorAll('#vcnvPic .cover').forEach(function (c) {
			c.classList.toggle('open', (v.coversOpen || []).indexOf(c.getAttribute('data-c')) !== -1);
		});
		$('#vcnvTitle').textContent = v.title || '';
		var box = $('#vcnvRows');
		box.textContent = '';
		(v.rows || []).slice(0, 4).forEach(function (r, i) {
			var state = r.status === 'open' ? 'open' : r.status;
			var row = el('div', 'vRow ' + state + (v.currentRow === i + 1 ? ' current' : ''));
			row.appendChild(el('span', 'num', String(i + 1)));
			var cells = el('span', 'cells');
			for (var k = 0; k < (r.length || 0); k++) { cells.appendChild(el('span', 'vCell', r.letters ? r.letters[k] : '')); }
			row.appendChild(cells);
			box.appendChild(row);
		});
	}

	/* Tăng tốc picture / video; the video follows the stage clock (muted - the stage has the sound) */
	function renderMedia() {
		var t = rs('tt');
		var on = round() === 'tt' && !!t.mediaSrc;
		show($('#mediaView'), on);
		var img = $('#ttImg'), video = $('#ttVideo');
		if (!on) { if (!video.paused) { video.pause(); } return; }
		var isVideo = t.mediaType === 'video';
		show(img, !isVideo); show(video, isVideo);
		if (!isVideo) { if (img.getAttribute('src') !== t.mediaSrc) { img.setAttribute('src', t.mediaSrc); } return; }
		if (video.getAttribute('src') !== t.mediaSrc) { video.setAttribute('src', t.mediaSrc); }
		syncVideo();
	}

	function syncVideo() {
		var video = $('#ttVideo'), t = rs('tt');
		if (round() !== 'tt' || t.mediaType !== 'video' || video.classList.contains('hidden')) { return; }
		var timer = snap.timer, label = 'tt_q' + t.index;
		var playing = t.phase === 'timer' || t.phase === 'answers' || t.phase === 'graded';
		if (!playing || !timer || timer.label !== label) {
			if (!video.paused) { video.pause(); }
			return;
		}
		var target = timerElapsed();
		if (target === null || !isFinite(video.duration || NaN)) { if (video.paused) { video.play().catch(function () {}); } return; }
		if (target >= video.duration) { if (!video.paused) { video.pause(); } return; }
		if (Math.abs(video.currentTime - target) > 0.4) { video.currentTime = target; }
		if (video.paused) { video.play().catch(function () {}); }
	}

	/* everyone's answers - only while the stage's answer tree shows them */
	function renderAnswers() {
		var rows = [], title = '';
		var t = rs('tt'), v = rs('vcnv');
		if (round() === 'tt' && t.answers) {
			title = 'Câu trả lời của các thí sinh - câu ' + t.index;
			(snap.players || []).forEach(function (p) {
				rows.push({ seat: p.seat, answer: t.answers[p.seat] || '', time: t.times ? t.times[p.seat] : null,
					ok: t.correctSeats ? t.correctSeats.indexOf(p.seat) !== -1 : null });
			});
			rows.sort(function (a, b) { return (a.time === null ? 1e9 : a.time) - (b.time === null ? 1e9 : b.time); });
		}
		else if (round() === 'vcnv' && v.treeAnswers) {
			title = 'Câu trả lời của các thí sinh - ' + (v.currentRow === 5 ? 'ô trung tâm' : 'hàng ngang ' + v.currentRow);
			(snap.players || []).forEach(function (p) {
				rows.push({ seat: p.seat, answer: v.treeAnswers[p.seat] || '', time: null,
					ok: v.treeCorrect ? v.treeCorrect.indexOf(p.seat) !== -1 : null });
			});
		}
		show($('#answersView'), rows.length > 0);
		$('#answersTitle').textContent = title;
		$('#answersView table').classList.toggle('noTime', round() !== 'tt');
		var body = $('#answersBody');
		body.textContent = '';
		rows.forEach(function (r, i) {
			var tr = el('tr', (r.ok === true ? 'ok' : r.ok === false ? 'no' : '') + (r.seat === seat ? ' me' : ''));
			tr.appendChild(el('td', '', String(i + 1)));
			tr.appendChild(el('td', '', nameOf(r.seat)));
			tr.appendChild(el('td', '', (r.answer || '—') + (r.ok === true ? '  ✓' : '')));
			tr.appendChild(el('td', 't', fmt(r.time)));
			body.appendChild(tr);
		});
	}

	function renderActions() {
		var r = round();
		var buzzRound = r === 'kd' || r === 'vd' || r === 'tb', cnvRound = r === 'vcnv';
		show($('#buzzBtn'), buzzRound);
		show($('#cnvBtn'), cnvRound);
		show($('.actionsBig'), buzzRound || cnvRound);
		$('.actionsBig').classList.toggle('one', true);
		$('#buzzBtn').disabled = !canBuzz();
		$('#cnvBtn').disabled = !canCnv();
		var me = player(seat), isBuzzed = !!(me && me.isBuzzed);
		$('#buzzBtn').classList.toggle('hit', isBuzzed && buzzRound);
		$('#cnvBtn').classList.toggle('hit', isBuzzed && cnvRound);
		$('#buzzLabel').textContent = (isBuzzed && buzzRound) ? 'BẠN ĐÃ BẤM CHUÔNG' : (r === 'vd' ? 'GIÀNH QUYỀN TRẢ LỜI' : 'BẤM CHUÔNG');
		$('#cnvBtn').firstElementChild.textContent = (isBuzzed && cnvRound) ? 'BẠN ĐÃ XIN TRẢ LỜI CHƯỚNG NGẠI VẬT' : 'XIN TRẢ LỜI CHƯỚNG NGẠI VẬT';

		var answerRound = r === 'vcnv' || r === 'tt';
		show($('#answerForm'), answerRound);
		var target = answerTarget(), input = $('#answerInput');
		input.disabled = !target;
		$('#answerBtn').disabled = !target;
		$('#answerForm').classList.toggle('locked', !target);
		$('#answerLabel').textContent = target ? target.label : (r === 'vcnv' && (rs('vcnv').eliminated || []).indexOf(seat) !== -1 ? 'Bạn đã bị loại - không ghi đáp án được nữa' : 'Đáp án (chỉ mở khi được ghi đáp án)');
		if (!target && document.activeElement === input) { input.blur(); }

		var showSent = sent.text && sent.key === questionKey();
		show($('#sentBox'), !!showSent);
		if (showSent) {
			var recorded = (r === 'tt' && rs('tt').times) ? rs('tt').times[seat] : null;   /* the stage's own figure, once revealed */
			$('#sentTime').textContent = fmt(recorded !== null && recorded !== undefined ? recorded : sent.elapsed);
			$('#sentText').textContent = sent.text;
			var st = sentState();
			$('#sentState').textContent = st.text;
			$('#sentState').className = 'sentState' + (st.cls ? ' ' + st.cls : '');
		}
	}

	/* what the stage did with THIS answer (matched by its nonce - see PlayerActions.js receipt) */
	function sentState() {
		if (sent.pending) { return { text: 'đang gửi...', cls: '' }; }
		var r = snap && snap.answerReceipts && snap.answerReceipts[seat];
		if (r && r.nonce === sent.nonce) {
			return r.ok ? { text: 'BTC đã nhận', cls: 'ok' } : { text: 'BTC KHÔNG nhận - đã hết giờ', cls: 'bad' };
		}
		if (Date.now() - sent.at > 6000) { return { text: 'chưa được xác nhận - báo BTC nếu cần', cls: 'bad' }; }
		return { text: 'đang chờ xác nhận...', cls: '' };
	}

	function render() {
		var me = player(seat);
		$('#playerName').textContent = me ? me.displayName : ('Ghế ' + seat);
		$('#playerScore').textContent = scoresHidden() ? '—' : (me ? String(Math.round(me.score || 0)) : '0');
		$('#roundName').textContent = snap ? (ROUND_NAMES[round()] || '') : '';
		$('#stepText').textContent = stepText();
		var q = questionText();
		$('#questionText').textContent = q || 'Chưa có câu hỏi.';
		$('#questionText').classList.toggle('empty', !q);
		var f = $('#facts');
		f.textContent = '';
		facts().forEach(function (x) {
			var c = el('span', 'fact' + (x[2] ? ' ' + x[2] : ''));
			if (x[0]) { c.appendChild(document.createTextNode(x[0] + ': ')); }
			c.appendChild(el('b', '', x[1]));
			f.appendChild(c);
		});
		var b = banner();
		$('#feedback').textContent = b[0];
		$('#feedback').className = 'banner' + (b[1] ? ' ' + b[1] : '');
		renderVcnv();
		renderMedia();
		renderAnswers();
		renderScores();
		renderActions();
		tick();
	}

	/* 10 times a second: the clocks and the countdowns on the buttons */
	function tick() {
		$('#connDot').classList.toggle('dead', !(room && room.isStageAlive()));
		var t = snap && snap.timer, running = !!(t && (t.running || t.paused)), left = running ? timerLeft() : null;
		$('#clockBox').classList.toggle('idle', !running);
		$('#clockBox').classList.toggle('hot', running && left !== null && left <= 5);
		$('#timerValue').textContent = (running && left !== null) ? String(Math.ceil(left)) : '—';
		$('#timerBar').style.width = (running && left !== null && t.duration) ? Math.round(Math.max(0, Math.min(1, 1 - left / t.duration)) * 100) + '%' : '0%';
		var cd = (running && left !== null) ? left.toFixed(1) + ' s' : '';
		$('#buzzSub').textContent = (round() === 'vd' && rs('vd').phase === 'steal' && cd) ? 'còn ' + cd
			: (round() === 'kd' && rs('kd').phase === 'question' && rs('kd').mode === 'common') ? 'Câu ' + rs('kd').questionIndex + ' / ' + rs('kd').questionCount
			: (round() === 'tb' && rs('tb').phase === 'timer' && cd) ? 'còn ' + cd : '';
		/* the 15 s ran out on this screen: no more buzzing (the stage would refuse it anyway) */
		if (round() === 'tb' && !$('#buzzBtn').disabled && !canBuzz()) { $('#buzzBtn').disabled = true; }
		$('#cnvSub').textContent = (round() === 'vcnv' && rs('vcnv').phase === 'finalWindow' && cd) ? 'cơ hội cuối · còn ' + cd : '';
		var target = answerTarget();
		$('#answerBtn').textContent = (target && cd) ? 'Gửi · ' + Math.ceil(left) + 's' : 'Gửi';
		/* the clock just ran out (or the state moved on) between two states: lock now */
		if (!target !== $('#answerInput').disabled) { renderActions(); }
		else if (sent.text && !sent.pending) { var st = sentState(); if ($('#sentState').textContent !== st.text) { renderActions(); } }
		if (snap && round() === 'tt') { syncVideo(); }
	}

	/* ---------- sending ---------- */

	function playNotice(text) { $('#playNotice').textContent = text || ''; show($('#playNotice'), !!text); }

	async function send(kind, payload) {
		var r = await db.rpc('player_action', { p_code: code, p_kind: kind, p_payload: payload || {} });
		if (r.error) { playNotice('Không gửi được: ' + r.error.message); return false; }
		if (r.data !== 'ok') { playNotice(SEND_ERRORS[r.data] || r.data); return false; }
		playNotice('');
		return true;
	}

	async function press(btn, kind) {
		if (btn.disabled) { return; }
		var at = serverNow();   /* the moment of the press, so the stage can order crossing presses */
		btn.disabled = true;    /* until the next state says otherwise */
		await send(kind, at === null ? {} : { at: Math.round(at) });
	}

	async function onAnswer(ev) {
		ev.preventDefault();
		var target = answerTarget();
		var text = $('#answerInput').value.replace(/\s+/g, ' ').trim();
		if (!target || !text) { return; }
		var elapsed = timerRunning() ? timerElapsed() : null;   /* measured at the press */
		var nonce = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
		var payload = Object.assign({ text: text, nonce: nonce }, target.payload);
		if (elapsed !== null) { payload.elapsed = Math.round(elapsed * 1000) / 1000; }
		sent = { key: target.key, text: text, elapsed: elapsed, pending: true, nonce: nonce, at: Date.now() };
		render();
		var ok = await send('answer', payload);
		sent.pending = false;
		sent.at = Date.now();
		if (!ok) { sent = { key: '', text: '', elapsed: null, pending: false }; }
		render();
	}

	function onKey(ev) {
		if (ev.key !== ' ' || ev.repeat) { return; }
		var tag = (ev.target.tagName || '').toLowerCase();
		if (tag === 'input' || tag === 'textarea') { return; }
		ev.preventDefault();
		if (!$('#buzzBtn').disabled && !$('#buzzBtn').classList.contains('hidden')) { press($('#buzzBtn'), 'buzz'); }
		else if (!$('#cnvBtn').disabled && !$('#cnvBtn').classList.contains('hidden')) { press($('#cnvBtn'), 'cnv'); }
	}

	window.OlympiaPlayerPanel = {
		/* for the console / tests */
		debug: function () { return { elapsed: timerElapsed(), left: timerLeft(), serverOffset: serverOffset, rtt: bestRtt, round: round() }; },
		start: function (roomCode, mySeat) {
			this.stop();
			code = roomCode; seat = Number(mySeat); snap = null; sent = { key: '', text: '', elapsed: null, pending: false };
			$('#answerInput').value = '';
			document.body.classList.add('playing');
			room = window.OlympiaPublicRoom.connect(code, {
				presence: { role: 'player', seat: seat },   /* the control panel shows this seat as connected */
				onAsset: function (a) { if (a && a.key && a.data) { assets = {}; assets[a.key] = a.data; render(); } },
				onState: function (s) {
					var prevKey = (answerTarget() || {}).key;
					snap = s;
					var nowKey = (answerTarget() || {}).key;
					if (nowKey && nowKey !== prevKey && nowKey !== sent.key) { $('#answerInput').value = ''; }   /* a new question */
					render();
				},
				onStatus: function (st, detail) {
					if (st === 'error' || st === 'offline') { playNotice(st === 'offline' ? 'Mất kết nối - đang thử lại... ' + detail : detail); }
					else if (st === 'online') { playNotice(''); }
				}
			});
			uiTimer = setInterval(tick, 100);
			auth.ensureAnonymous().then(function () { return syncClock(5); });
			clockTimer = setInterval(function () { syncClock(3); }, 60000);
			render();
		},
		stop: function () {
			if (uiTimer) { clearInterval(uiTimer); uiTimer = null; }
			if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
			if (room) { room.close(); }
			room = null;
			document.body.classList.remove('playing');
			var v = $('#ttVideo'); if (v && !v.paused) { v.pause(); }
		}
	};

	document.addEventListener('DOMContentLoaded', function () {
		$('#buzzBtn').addEventListener('click', function () { press($('#buzzBtn'), 'buzz'); });
		$('#cnvBtn').addEventListener('click', function () { press($('#cnvBtn'), 'cnv'); });
		$('#answerForm').addEventListener('submit', onAnswer);
		document.addEventListener('keydown', onKey);
	});
})();
