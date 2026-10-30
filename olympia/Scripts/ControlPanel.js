/*
 * Olympia Controller - control panel (control.html, remote).
 * Draws itself from the authority's snapshots; never touches gv game state directly.
 * Every button is either a key press relayed to the graphics page (data-sendkey / <round>Key
 * commands) or a structured command (scores, names, answers). Keys typed on this page are
 * relayed by KeyboardController in remote mode.
 *
 * Layout: the "deck" on top (title, clock, three chips, the question, the host answer, four
 * stats, the current round's stack of action bars) is filled from the round being played; the
 * tab panels below carry the round details and the answer inputs; the side column holds the
 * score table, the names and the graphics-page controls.
 */
(function (gv) {

	var els = {};
	var snap = null;
	var uiTimer = null;

	function $(sel) { return document.querySelector(sel); }
	function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

	function fmtSeconds(s) { return (Math.round(s * 10) / 10).toFixed(1); }

	function player(seat) { return snap ? snap.players.filter(function (x) { return x.seat === seat; })[0] : null; }
	function nameOf(seat, withScore) {
		var p = player(seat);
		if (!p) { return seat ? String(seat) : '—'; }
		return seat + '. ' + p.displayName + (withScore ? ' (' + p.score + ')' : '');
	}
	function names(seats) { return (seats || []).map(function (s) { return nameOf(s); }).join(', '); }

	/* "now" on the stage machine's clock - wallStart values are stamped there */
	function stageNow() { return Date.now() - (gv.Sync.clockOffset || 0); }

	/* Bed position estimated from the last snapshot (offset + wall time, wrapped in the loop). */
	function bedPosition(b) {
		if (!b || b.paused) { return b ? b.offset : 0; }
		var pos = b.offset + (stageNow() - b.wallStart) / 1000;
		if (b.looping && b.loopEnd > b.loopStart) {
			while (pos >= b.loopEnd) { pos -= (b.loopEnd - b.loopStart); }
		}
		return pos;
	}

	function timerValue(t) {
		if (!t) { return null; }
		if (t.paused && typeof t.pausedElapsed === 'number') { return t.mode === 'down' ? (t.duration - t.pausedElapsed) : t.pausedElapsed; }
		var elapsed = (stageNow() - t.wallStart) / 1000;
		if (!t.running) { return t.finished ? (t.mode === 'down' ? 0 : t.duration) : null; }
		elapsed = Math.min(elapsed, t.duration);
		return t.mode === 'down' ? (t.duration - elapsed) : elapsed;
	}

	/* ---------------- phase texts ---------------- */

	var kdPhaseText = {
		/* Olympia 23 rules (Rules.js): three common turns, 8 / 12 / 16 questions */
		o23: {
			idle: 'Chờ — ← hiện thẻ KHỞI ĐỘNG',
			title: 'Đang hiện thẻ KHỞI ĐỘNG — ← vào lượt 1 (âm chuẩn bị)',
			ready: 'Lượt đã sẵn sàng — ← hiện đồ hoạ',
			set: 'Đồ hoạ đã hiện — → hiện câu 1',
			question: 'Đang thi — → câu kế · 1-4 chuông · Space đồng hồ · ↑ đúng · ↓ sai',
			done: 'Xong lượt — ← vào lượt tiếp theo (âm chuẩn bị)',
			finished: 'Hết 3 lượt Khởi động — ← sang Vượt chướng ngại vật'
		},
		individual: {
			idle: 'Chờ — ← hiện thẻ KHỞI ĐỘNG',
			title: 'Đang hiện thẻ KHỞI ĐỘNG — ← chọn thí sinh',
			ready: 'Thí sinh đã chọn — ← hiện đồ hoạ',
			set: 'Đồ hoạ đã hiện — → hiện câu 1',
			question: 'Đang thi — → câu kế · Space đồng hồ · ↑ đúng · ↓ sai',
			done: 'Xong lượt — ← cho thí sinh tiếp theo',
			finished: 'Hết lượt riêng của cả 4 thí sinh — ← mở lượt chung'
		},
		/* Luật rừng (Rules.js): 4 individual turns of 60 s, then two common turns of 8 / 16 */
		jungleOwn: {
			idle: 'Chờ — ← hiện thẻ KHỞI ĐỘNG',
			title: 'Đang hiện thẻ KHỞI ĐỘNG — ← chọn thí sinh',
			ready: 'Thí sinh đã chọn — ← hiện đồ hoạ',
			set: 'Đồ hoạ đã hiện — → hiện câu 1 (bật 60 giây)',
			question: 'Đang thi 60 giây — ↑ đúng · ↓ sai · → câu kế',
			done: 'Xong lượt — ← cho thí sinh tiếp theo',
			finished: 'Hết lượt riêng của cả 4 thí sinh — ← vào lượt đối kháng 1'
		},
		jungleCommon: {
			idle: 'Lượt đối kháng — ← vào lượt 1 (âm chuẩn bị)',
			ready: 'Lượt đã sẵn sàng — ← hiện đồ hoạ',
			set: 'Đồ hoạ đã hiện — → hiện câu 1',
			question: 'Đang thi — → câu kế · 1-4 chuông · Space đồng hồ · ↑ đúng · ↓ sai',
			done: 'Xong lượt — ← vào lượt đối kháng 2 (âm chuẩn bị)',
			finished: 'Hết phần Khởi động — ← sang Vượt chướng ngại vật'
		},
		common: {
			idle: 'Lượt chung — ← (âm chuẩn bị)',
			ready: 'Đã báo chuẩn bị — ← hiện đồ hoạ',
			set: 'Đồ hoạ đã hiện — → hiện câu 1 / 12',
			question: 'Đang thi — chờ chuông 1-4 · ↑ đúng · ↓ sai · ⌫ xoá chuông',
			finished: 'Hết phần Khởi động — ← sang Vượt chướng ngại vật'
		}
	};
	var kdResultText = { correct: 'ĐÚNG (+10)', wrong: 'SAI (0)', wrongCommon: 'SAI (−5)', noanswer: 'KHÔNG AI TRẢ LỜI (0)' };

	var vcnvPhaseText = {
		idle: 'Chờ — ← hiện thẻ VƯỢT CHƯỚNG NGẠI VẬT',
		title: 'Đang hiện thẻ vòng — ← hiện bảng CNV',
		board: 'Bảng CNV — chọn hàng 1-4 · 5 ô trung tâm (khi 4 hàng xong) · Q/W/E/R xin trả lời CNV',
		rowSelected: 'Đã chọn hàng — → hiện câu hỏi · U huỷ chọn',
		rowQuestion: 'Câu hỏi đã hiện — → bật 15 s · 1-4 đánh dấu ghế đúng (+10 khi chấm hàng)',
		rowTimer: 'Đang đếm 15 s — → cây đáp án · 1-4 đánh dấu đúng',
		rowAnswers: 'Cây đáp án đang hiện — 1-4 đánh dấu đúng · → chấm hàng',
		rowGraded: 'Đã chấm hàng — → cất cây, về bảng',
		rowBack: 'Về bảng — → mở góc ảnh (nếu có người đúng)',
		guessing: 'CÓ NGƯỜI XIN TRẢ LỜI CNV — Q/W/E/R (người đã xin) = đúng · 0 = tất cả sai · ⌫ bỏ người cuối · → về đồ hoạ chính',
		finalWindow: 'Cửa sổ 15 s cuối — chờ xin trả lời; hết giờ → mở hết',
		finished: 'Đã giải xong / đã mở hết — ← ẩn đồ hoạ',
		done: 'Vòng đã kết thúc — ← sang Tăng tốc'
	};
	var vcnvRowText = { closed: 'chưa mở', open: 'ĐANG MỞ', correct: 'đúng', wrong: 'sai' };

	var ttPhaseText = {
		idle: 'Chờ — ← hiện thẻ TĂNG TỐC',
		title: 'Đang hiện thẻ vòng — ← hiện câu 1',
		question: 'Câu hỏi đã hiện — → bật đồng hồ (+ video)',
		timer: 'Đang đếm — gõ đáp án + thời gian · 1-4 đánh dấu đúng · → cây đáp án',
		answers: 'Cây đáp án đang hiện — 1-4 đánh dấu đúng · B xem lại khung · → cộng điểm',
		graded: 'Đã cộng điểm — B xem lại khung · → cất cây',
		blank: 'Chỉ còn nền — → câu kế',
		finished: 'Hết 4 câu — ← ẩn đồ hoạ',
		done: 'Vòng đã kết thúc — ← sang Về đích'
	};
	var ttMarkPhases = ['question', 'timer', 'answers'];

	var vdPhaseText = {
		idle: 'Chờ — ← hiện thẻ VỀ ĐÍCH',
		title: 'Đang hiện thẻ vòng — ← gọi thí sinh lên sân khấu',
		stageCall: 'Đã gọi thí sinh — ← mở màn chọn gói',
		choose: 'Chọn gói — 2 / 3 ba lần (U bỏ) · ← khung câu hỏi khi đủ 3',
		ready: 'Khung đã hiện, câu chưa đọc — S đặt ★ · → hiện câu hỏi',
		question: 'Câu hỏi đã hiện — → bật đồng hồ',
		timer: 'Đang đếm — ↑ đúng · ↓ sai / hết giờ (mở 5 s giành quyền)',
		steal: '5 s GIÀNH QUYỀN — 1-4 người giành · không ai: → đóng câu (S đặt ★ cho câu kế)',
		stealAnswer: 'Có người giành quyền — ↑ đúng / ↓ sai',
		answered: 'Đã chấm — S đặt ★ cho câu kế · → câu kế; sau câu 3: → ẩn khung',
		blank: 'Chỉ còn nền — ← gọi thí sinh kế (hoặc kết thúc)',
		finished: 'Hết 4 lượt — ← ẩn đồ hoạ · M tổng kết · F5 câu hỏi phụ nếu bằng điểm nhất',
		done: 'Vòng đã kết thúc — F5 câu hỏi phụ nếu bằng điểm nhất'
	};

	var tbPhaseText = {
		idle: 'Chờ — ← chọn các thí sinh bằng điểm nhất (âm chuẩn bị)',
		ready: 'Đã chọn thí sinh — ← hiện đồ hoạ',
		set: 'Đồ hoạ đã hiện — → hiện câu hỏi (mở chuông ngay)',
		question: 'Câu hỏi đã hiện, CHƯA tính giờ — bấm chuông lúc này chỉ chấm sai được · → bật 15 giây',
		timer: 'Đang đếm 15 giây — chờ chuông (có chuông: đồng hồ dừng) · ↑ đúng · ↓ sai = loại khỏi câu, đồng hồ chạy tiếp',
		closed: 'Câu đã xong',
		finished: 'Câu hỏi phụ đã kết thúc'
	};
	var tbResultText = { correct: 'ĐÚNG', wrong: 'SAI — bị loại khỏi câu', early: 'BẤM SỚM — bị loại khỏi câu', none: 'KHÔNG AI ĐÚNG' };

	/* ---------------- which action bars are live in which phase ---------------- */

	/* which text set describes the Khởi động step: o23 / jungleOwn / jungleCommon / individual / common */
	function kdKindOf(kd) {
		if (snap.rules === 'o23') { return 'o23'; }
		if (snap.rules === 'jungle') { return kd.mode === 'common' ? 'jungleCommon' : 'jungleOwn'; }
		return kd.mode || 'individual';
	}

	function kdKeys(kd) {
		var common = kd.mode === 'common', ph = kd.phase, k = [];
		if (snap.rules === 'jungle' && !common) {   /* Luật rừng individual: no Space, one verdict per question */
			if (ph === 'idle' || ph === 'title' || ph === 'ready' || ph === 'done' || ph === 'finished') { k.push('ArrowLeft'); }
			if (ph === 'set' || ph === 'question') { k.push('ArrowRight'); }
			if (ph === 'question' && !kd.resolved) { k.push('ArrowUp', 'ArrowDown'); }
			return k;
		}
		if (ph === 'idle' || ph === 'title' || ph === 'ready' || ph === 'done' || ph === 'finished') { k.push('ArrowLeft'); }
		if (ph === 'set' || ph === 'question') { k.push('ArrowRight'); }
		if (ph === 'question') {
			k.push(' ');
			if (common) {
				if (!kd.resolved) { k.push('ArrowDown'); if (kd.buzzSeat) { k.push('ArrowUp'); } }
				if (!kd.buzzSeat && !kd.resolved) { k.push('1', '2', '3', '4'); }
				if (kd.buzzSeat) { k.push('Backspace'); }
			}
			else { k.push('ArrowUp', 'ArrowDown'); }
		}
		return k;
	}

	function vcnvKeys(v) {
		var ph = v.phase, k = [];
		var signal = ['q', 'w', 'e', 'r'];
		if (ph === 'idle' || ph === 'title' || ph === 'finished' || ph === 'done') { k.push('ArrowLeft'); }
		if (ph === 'board') {
			(v.rows || []).slice(0, 4).forEach(function (r, i) { if (r.status === 'closed') { k.push(String(i + 1)); } });
			var fourDone = (v.rows || []).slice(0, 4).every(function (r) { return r.status === 'correct' || r.status === 'wrong'; });
			if (fourDone && v.rows[4] && v.rows[4].status === 'closed' && !v.centerOpened) { k.push('5'); }
			if (fourDone && !v.finalUsed) { k.push('ArrowRight'); }
			k = k.concat(signal);
		}
		if (ph === 'rowSelected') { k.push('ArrowRight', 'u'); k = k.concat(signal); }
		if (ph === 'rowQuestion' || ph === 'rowTimer' || ph === 'rowAnswers') { k.push('ArrowRight', '1', '2', '3', '4'); k = k.concat(signal); }
		if (ph === 'rowGraded' || ph === 'rowBack') { k.push('ArrowRight'); k = k.concat(signal); }
		if (ph === 'guessing') { k = k.concat(signal); k.push('0', 'Backspace', 'ArrowRight'); }
		if (ph === 'finalWindow') { k = k.concat(signal); if (v.finalExpired) { k.push('ArrowRight'); } }
		return k;
	}

	function ttKeys(t) {
		var ph = t.phase, k = [];
		if (ph === 'idle' || ph === 'title' || ph === 'finished' || ph === 'done') { k.push('ArrowLeft'); }
		if (['question', 'timer', 'answers', 'graded', 'blank'].indexOf(ph) !== -1 && !t.reviewing) { k.push('ArrowRight'); }
		if (ttMarkPhases.indexOf(ph) !== -1) { k.push('1', '2', '3', '4'); }
		if (ph === 'answers' || ph === 'graded') { k.push('b'); }
		return k;
	}

	/* who can still buzz on the current tie-break question */
	function tbCanBuzz(tb, seat) {
		return (tb.seats || []).indexOf(seat) !== -1 && (tb.eliminated || []).indexOf(seat) === -1;
	}

	function tbKeys(tb) {
		var ph = tb.phase, k = [];
		var buzz = tb.buzzSeat != null;
		if (ph === 'idle') { if ((tb.seats || []).length >= 2 || (tb.topSeats || []).length >= 2) { k.push('ArrowLeft'); } }
		if (ph === 'ready') { k.push('ArrowLeft'); }
		if (ph === 'set') { k.push('ArrowRight'); }
		if (ph === 'question' || ph === 'timer') {
			if (ph === 'question' && !buzz) { k.push('ArrowRight'); }
			if (buzz) {
				k.push('ArrowDown', 'Backspace');
				if (ph === 'timer' && !tb.buzzEarly) { k.push('ArrowUp'); }
			}
			else if (ph === 'question' || tb.timerRunning) {
				[1, 2, 3, 4].forEach(function (s) { if (tbCanBuzz(tb, s)) { k.push(String(s)); } });
			}
		}
		if (ph === 'closed') {
			if (tb.winner != null || tb.lastQuestion) { k.push('ArrowLeft'); }
			else { k.push('ArrowRight'); }
		}
		return k;
	}

	/* the closed step: who answered right, or what is left */
	function tbClosedText(tb) {
		if (tb.winner != null) { return nameOf(tb.winner) + ' trả lời đúng — ← kết thúc, ẩn đồ hoạ'; }
		if (tb.lastQuestion) { return 'Không ai đúng — đã hết ' + tb.questionCount + ' câu hỏi phụ — ← ẩn đồ hoạ'; }
		return 'Không ai đúng — → câu kế';
	}

	var barLabels = {
		kdLeft: { jungleOwn: { idle: 'Hiện thẻ KHỞI ĐỘNG', title: 'Chọn thí sinh (âm chuẩn bị)', ready: 'Hiện đồ hoạ', done: 'Thí sinh tiếp theo', finished: 'Vào lượt đối kháng 1' }, jungleCommon: { idle: 'Vào lượt 1 (âm chuẩn bị)', ready: 'Hiện đồ hoạ', done: 'Vào lượt 2', finished: 'Sang Vượt chướng ngại vật' }, o23: { idle: 'Hiện thẻ KHỞI ĐỘNG', title: 'Vào lượt 1 (âm chuẩn bị)', ready: 'Hiện đồ hoạ', done: 'Vào lượt tiếp theo', finished: 'Sang Vượt chướng ngại vật' }, individual: { idle: 'Hiện thẻ KHỞI ĐỘNG', title: 'Chọn thí sinh (âm chuẩn bị)', ready: 'Hiện đồ hoạ', done: 'Thí sinh tiếp theo', finished: 'Mở lượt chung' }, common: { idle: 'Âm chuẩn bị', ready: 'Hiện đồ hoạ', finished: 'Sang Vượt chướng ngại vật' } },
		vcnvRight: { board: 'Cửa sổ 15 s cuối', rowSelected: 'Hiện câu hỏi', rowQuestion: 'Bật 15 s', rowTimer: 'Cây đáp án', rowAnswers: 'Chấm hàng', rowGraded: 'Cất cây, về bảng', rowBack: 'Mở góc ảnh', finalWindow: 'Mở hết' },
		ttRight: { question: 'Bật đồng hồ', timer: 'Cây đáp án', answers: 'Cộng điểm', graded: 'Cất cây', blank: 'Câu kế' },
		vdLeft: { idle: 'Hiện thẻ VỀ ĐÍCH', title: 'Gọi lên sân khấu', stageCall: 'Màn chọn gói', choose: 'Khung câu hỏi', blank: 'Gọi thí sinh kế', finished: 'Ẩn đồ hoạ' },
		vdRight: { ready: 'Hiện câu hỏi', question: 'Bật đồng hồ', steal: 'Đóng câu (không ai giành)', answered: 'Câu kế / Ẩn khung' },
		tbLeft: { idle: 'Chọn thí sinh bằng điểm nhất', ready: 'Hiện đồ hoạ', closed: 'Kết thúc — ẩn đồ hoạ' },
		tbRight: { set: 'Hiện câu hỏi', question: 'Bật 15 giây', closed: 'Câu kế' }
	};

	function setBars(round, liveKeys, nextKeys) {
		$$('.bars').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-round') === round); });
		$$('.bars[data-round="' + round + '"] [data-key]').forEach(function (btn) {
			var k = btn.getAttribute('data-key');
			btn.disabled = liveKeys.indexOf(k) === -1;
			btn.classList.toggle('next', nextKeys.indexOf(k) !== -1);
		});
	}

	/* ---------------- the deck ---------------- */

	function setDeck(o) {
		els.chipWho.textContent = o.who || '—';
		els.chipPts.textContent = o.pts || '—';
		els.chipStatus.textContent = o.status || '—';
		els.chipStatus.className = 'chip st ' + (o.statusKind || 'wait');
		els.deckQuestion.textContent = o.question || 'Chưa có câu hỏi.';
		els.deckQuestion.classList.toggle('empty', !o.question);
		els.deckAnswer.textContent = o.answer || '—';
		[1, 2, 3, 4].forEach(function (i) {
			var s = (o.stats || [])[i - 1] || ['', '—'];
			els['stat' + i + 'k'].textContent = s[0];
			els['stat' + i + 'v'].textContent = s[1];
		});
	}

	function statusKind(phase) {
		if (/timer|Timer|^steal$|finalWindow/.test(phase)) { return 'hot'; }
		if (/answers|graded|Answers|Graded|stealAnswer|guessing|answered/.test(phase)) { return 'judge'; }
		if (/finished|done/.test(phase)) { return 'good'; }
		return 'wait';
	}

	function renderDeck() {
		var round = snap.currentRound, rs = snap.roundState || {};
		els.roundName.textContent = 'Phần thi ' + (gv.RoundNames[round] || round);
		var kd = rs.kd, v = rs.vcnv, t = rs.tt, d = rs.vd;

		if (round === 'kd' && kd) {
			var common = kd.mode === 'common';
			var kdKind = kdKindOf(kd), jungle = snap.rules === 'jungle', own = kd.own || {};
			var turns = snap.rules === 'o23' ? 3 : (jungle ? 2 : 0);
			var turnText = turns && common && kd.turn ? 'Lượt ' + kd.turn + '/' + turns : '';
			var live = kdKeys(kd);
			var nextWrong = common && kd.buzzSeat ? ((kd.turnWrong || {})[kd.buzzSeat] || 0) : 0;
			var ptsText = !jungle ? (common ? ' · đúng +10 / sai −5' : ' · đúng +10')
				: (common ? ' · đúng +10 / sai lần n: −5·(n−1)' + (kd.buzzSeat && !kd.resolved ? ' (lần này ' + (nextWrong ? '−' + 5 * nextWrong : '0') + ')' : '')
					: ' · đúng +10 / sai ' + (own.wrong ? '−5' : 'lần đầu 0') + (own.timeUp ? ' · HẾT GIỜ — → kết thúc lượt' : ''));
			setDeck({
				who: common ? (kd.buzzSeat ? ('Chuông: ' + nameOf(kd.buzzSeat) + (kd.resolved ? ' · đã chấm' : '')) : 'Lượt chung — chờ chuông') : (kd.seat ? nameOf(kd.seat) : 'Chưa chọn thí sinh'),
				pts: (kd.questionIndex ? ('Câu ' + kd.questionIndex + ' / ' + kd.questionCount + (jungle && !common && kd.questionIndex > 12 ? ' (bổ sung)' : '')) : 'Chưa vào câu') + ptsText,
				status: (kdPhaseText[kdKind] || {})[kd.phase] || kd.phase,
				statusKind: kd.phase === 'question' ? 'hot' : statusKind(kd.phase),
				question: kd.currentQuestion, answer: kd.currentAnswer,
				stats: [['Số câu trong lượt', (kd.questionIndex || 0) + ' / ' + kd.questionCount], ['Lượt thi', turnText || (common ? 'Chung' : 'Riêng')], ['Kết quả câu cuối', (jungle && kd.lastResult === 'wrong' ? 'SAI' : kdResultText[kd.lastResult === 'wrong' && common ? 'wrongCommon' : kd.lastResult]) || '—'],
					jungle && !common ? ['Chuỗi đúng · câu bổ sung · lần sai', own.streak + '/3 · ' + own.bonus + '/4 · ' + own.wrong] : ['Chuông', common ? (kd.buzzSeat ? nameOf(kd.buzzSeat) : 'chưa ai') : '—']]
			});
			els.kdLeftLabel.textContent = (barLabels.kdLeft[kdKind] || {})[kd.phase] || 'Bắt đầu · Chọn thí sinh · Hiện đồ hoạ';
			$$('.bars[data-round="kd"] .seatName').forEach(function (s) { s.textContent = 'Chuông ' + nameOf(parseInt(s.getAttribute('data-seat'), 10)); });
			setBars('kd', live, live.filter(function (k) { return k === 'ArrowLeft' || k === 'ArrowRight'; }));
		}
		else if (round === 'vcnv' && v) {
			var live2 = vcnvKeys(v);
			var n = Math.max(1, Math.min(4, v.openedCount || 0));
			var prize = v.centerOpened ? gv.Points.VCNV_AFTER_CENTER : gv.Points.VCNV_OBSTACLE[n];
			setDeck({
				who: v.queue && v.queue.length ? ('Xin trả lời CNV: ' + names(v.queue)) : (v.currentRow ? (v.currentRow === 5 ? 'Câu ô trung tâm' : 'Hàng ' + v.currentRow) : 'Bảng chướng ngại vật'),
				pts: (v.openedCount || 0) + ' hàng đã mở · CNV = ' + prize + ' điểm' + (snap.rules === 'jungle' ? ' · không đúng hàng −5' : '') + (v.solved ? ' · ĐÃ GIẢI' : ''),
				status: vcnvPhaseText[v.phase] || v.phase, statusKind: statusKind(v.phase),
				question: v.currentQuestion, answer: v.currentAnswer || (v.keyword ? ('CNV: ' + v.keyword) : ''),
				stats: [['Chướng ngại vật', v.keyword || '—'], ['Các hàng', (v.rows || []).slice(0, 4).map(function (r) { return vcnvRowText[r.status] || r.status; }).join(' · ') || '—'], ['Ô trung tâm', v.centerOpened ? 'đã mở' : ((v.rows || [])[4] ? vcnvRowText[v.rows[4].status] : '—')], ['Bị loại', names(v.eliminated) || 'không']]
			});
			els.vcnvRightLabel.textContent = barLabels.vcnvRight[v.phase] || 'Câu hỏi · 15 s · Cây · Chấm · Về bảng · Mở ảnh';
			[1, 2, 3, 4].forEach(function (i) {
				var r = (v.rows || [])[i - 1];
				var inRow = ['rowQuestion', 'rowTimer', 'rowAnswers'].indexOf(v.phase) !== -1;
				els['vcnvB' + i].textContent = inRow ? (nameOf(i) + ' đúng') : ('Hàng ' + i + (r ? ' · ' + (vcnvRowText[r.status] || '') : ''));
			});
			$$('.bars[data-round="vcnv"] .seatName.cnv').forEach(function (s) {
				var seat = parseInt(s.getAttribute('data-seat'), 10);
				var queued = (v.queue || []).indexOf(seat) !== -1;
				s.textContent = nameOf(seat) + (v.phase === 'guessing' && queued ? ' — ĐÚNG CNV' : ' xin CNV');
			});
			$$('.bars[data-round="vcnv"] [data-key]').forEach(function (btn) {
				var k = btn.getAttribute('data-key');
				var seat = ['q', 'w', 'e', 'r'].indexOf(k) + 1;
				if (seat && (v.eliminated || []).indexOf(seat) !== -1) { live2 = live2.filter(function (x) { return x !== k; }); }
				btn.classList.toggle('on', seat > 0 && (v.queue || []).indexOf(seat) !== -1);
			});
			els.vcnvCnvWrong.disabled = v.phase !== 'guessing';
			setBars('vcnv', live2, live2.filter(function (k) { return k === 'ArrowRight'; }));
		}
		else if (round === 'tt' && t) {
			var live3 = ttKeys(t);
			setDeck({
				who: t.index ? ('Câu ' + t.index + ' / ' + t.count + ' · ' + t.seconds + ' s') : 'Chưa vào câu',
				pts: gv.Points.TANG_TOC_RANK.join(' · ') + ' theo thời gian' + (snap.rules === 'jungle' ? ' · sai / không trả lời ' + gv.RulesJungle.TANG_TOC_MISS : '') + (t.correctSeats && t.correctSeats.length ? ' · đúng: ' + t.correctSeats.join(', ') : ''),
				status: (ttPhaseText[t.phase] || t.phase) + (t.reviewing ? ' — ĐANG XEM LẠI KHUNG (B về cây)' : ''), statusKind: statusKind(t.phase),
				question: t.question, answer: t.answer,
				stats: [['Số câu', (t.index || 0) + ' / ' + t.count], ['Thời gian', t.seconds ? t.seconds + ' s' : '—'], ['Media', t.mediaType || '—'], ['Đã đánh dấu đúng', names(t.correctSeats) || '—']]
			});
			els.ttRightLabel.textContent = barLabels.ttRight[t.phase] || 'Đồng hồ · Cây · Cộng điểm · Cất cây · Câu kế';
			var canMark = ttMarkPhases.indexOf(t.phase) !== -1;
			[1, 2, 3, 4].forEach(function (seat) {
				var on = (t.correctSeats || []).indexOf(seat) !== -1;
				var b = els.ttCorrect[seat];
				b.disabled = !canMark;
				b.classList.toggle('on', on);
				b.textContent = '';
				var kb = document.createElement('kbd'); kb.textContent = String(seat); b.appendChild(kb);
				b.appendChild(document.createTextNode((on ? '✓ ' : '') + nameOf(seat) + (on ? ' đúng — bỏ' : ' đúng')));
			});
			els.ttReview.disabled = !(t.phase === 'answers' || t.phase === 'graded');
			els.ttReview.textContent = '';
			var kbB = document.createElement('kbd'); kbB.textContent = 'B'; els.ttReview.appendChild(kbB);
			els.ttReview.appendChild(document.createTextNode(t.reviewing ? 'Về cây đáp án' : 'Xem lại khung câu hỏi / ảnh đáp án'));
			setBars('tt', live3, live3.filter(function (k) { return k === 'ArrowLeft' || k === 'ArrowRight'; }));
		}
		else if (round === 'vd' && d) {
			var vals = d.values || [];
			setDeck({
				who: d.seat ? (nameOf(d.seat, true) + ' · lượt ' + d.turn + ' / 4') : 'Chưa gọi thí sinh',
				pts: d.qIndex ? ('Câu ' + d.qIndex + ' / 3 · ' + d.value + ' điểm · ' + d.seconds + ' s' + (d.star === d.qIndex ? ' · ★' : '') + (snap.rules === 'jungle' ? ' · sai −' + d.value * (d.star === d.qIndex ? 2 : 1) + ', bị cướp thêm −' + d.value : '')) : (vals.length ? 'Gói: ' + vals.join(' – ') : 'Chưa chọn gói'),
				status: vdPhaseText[d.phase] || d.phase, statusKind: statusKind(d.phase),
				question: d.question, answer: d.answer,
				stats: [['Số câu trong lượt', (d.qIndex || 0) + ' / 3'], ['Gói câu hỏi', vals.length ? vals.join(' – ') : '—'], ['Ngôi sao hy vọng', d.star ? ('★ câu ' + d.star) : (d.starUsed ? 'đã dùng' : 'chưa đặt')], ['Giành quyền', d.stealSeat ? (nameOf(d.stealSeat) + (d.stealResult ? (d.stealResult === 'correct' ? ' — đúng' : ' — sai') : '')) : (d.phase === 'steal' ? 'đang chờ 5 s' : '—')]]
			});
			els.vdLeftLabel.textContent = barLabels.vdLeft[d.phase] || 'Gọi lên sân khấu · Màn chọn gói · Khung câu hỏi';
			els.vdRightLabel.textContent = barLabels.vdRight[d.phase] || 'Hiện câu hỏi · Đồng hồ · Câu kế';
			$$('.bars[data-round="vd"] .seatName.steal').forEach(function (s) { s.textContent = nameOf(parseInt(s.getAttribute('data-seat'), 10)) + ' giành'; });
			$$('.bars').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-round') === 'vd'); });
			/* the VĐ bars keep their own enabling (renderVeDich) */
		}
		else if (round === 'tb' && rs.tb) {
			var tb = rs.tb, live5 = tbKeys(tb);
			setDeck({
				who: tb.buzzSeat != null ? ('Chuông: ' + nameOf(tb.buzzSeat) + (tb.buzzEarly ? ' — BẤM SỚM (chỉ chấm sai)' : ''))
					: (tb.winner != null ? ('Trả lời đúng: ' + nameOf(tb.winner)) : ((tb.seats || []).length ? 'Thi câu hỏi phụ: ' + names(tb.seats) : 'Bằng điểm cao nhất: ' + (names(tb.topSeats) || '—'))),
				pts: (tb.questionIndex ? 'Câu ' + tb.questionIndex + ' / ' + tb.questionCount : 'Chưa vào câu') + ' · 15 giây · không cộng điểm',
				status: tb.phase === 'closed' ? tbClosedText(tb) : (tb.phase === 'idle' && live5.indexOf('ArrowLeft') === -1 ? 'Không có ai bằng điểm cao nhất — không cần câu hỏi phụ (hoặc chọn thí sinh ở tab Câu hỏi phụ)' : (tbPhaseText[tb.phase] || tb.phase)),
				statusKind: tb.phase === 'timer' ? 'hot' : (tb.buzzSeat != null ? 'judge' : statusKind(tb.phase)),
				question: tb.currentQuestion, answer: tb.currentAnswer,
				stats: [['Thí sinh thi', names(tb.seats) || '—'], ['Bị loại câu này', names(tb.eliminated) || 'không'], ['Kết quả câu cuối', tbResultText[tb.lastResult] || '—'], ['Câu hỏi phụ', (tb.questionIndex || 0) + ' / ' + tb.questionCount]]
			});
			els.tbLeftLabel.textContent = barLabels.tbLeft[tb.phase] || 'Chọn thí sinh · Hiện đồ hoạ · Kết thúc';
			els.tbRightLabel.textContent = barLabels.tbRight[tb.phase] || 'Câu hỏi · 15 giây · Câu kế';
			els.tbWrongLabel.textContent = tb.buzzEarly ? 'Bấm sớm — loại khỏi câu này' : 'Sai — loại khỏi câu này';
			$$('.bars[data-round="tb"] .seatName').forEach(function (s) { s.textContent = 'Chuông ' + nameOf(parseInt(s.getAttribute('data-seat'), 10)); });
			setBars('tb', live5, live5.filter(function (k) { return k === 'ArrowLeft' || k === 'ArrowRight'; }));
		}
		else {
			setDeck({ status: 'Vòng ' + (gv.RoundNames[round] || round) });
			$$('.bars').forEach(function (b) { b.classList.remove('active'); });
		}
	}

	/* ---------------- side: score table ---------------- */

	function renderPlayers() {
		var tbody = els.playersBody;
		tbody.textContent = '';
		snap.players.forEach(function (p) {
			var tr = document.createElement('tr');
			tr.className = (p.isOnStage ? 'onstage ' : '') + (p.isEliminatedFromVCNV && snap.currentRound === 'vcnv' ? 'out' : '');
			function td(cls) { var c = document.createElement('td'); if (cls) { c.className = cls; } tr.appendChild(c); return c; }
			td('n').textContent = String(p.seat);
			var name = td();
			name.appendChild(document.createTextNode(p.displayName));
			function badge(text, cls) { var b = document.createElement('span'); b.className = 'badge ' + (cls || ''); b.textContent = text; name.appendChild(b); }
			if (p.isOnStage) { badge('Đang thi', 'blue'); }
			if (p.isBuzzed) { badge('Chuông', 'amber'); }
			/* round flags only matter while that round is being played */
			if (p.kdDone && snap.currentRound === 'kd') { badge('KĐ', 'green'); }
			if (p.isEliminatedFromVCNV && snap.currentRound === 'vcnv') { badge('Loại CNV'); }
			var full = document.createElement('span'); full.className = 'full'; full.textContent = p.fullName; name.appendChild(full);
			td('p').textContent = String(p.score);
			tbody.appendChild(tr);
		});
		var sp = player(parseInt(els.scoreSeat.value, 10));
		if (sp) { els.scoreInput.placeholder = String(sp.score); }
	}

	/* ---------------- inputs (static DOM, dirty tracking) ---------------- */

	/* An input the host has typed into is "dirty" until a snapshot comes back carrying the same
	 * value; a dirty input is never overwritten by a snapshot (only a question/row change resets it). */
	function refill(input, saved, force) {
		if (force) { input.value = saved; input.dirty = false; return; }
		if (input.dirty) { if (input.value === saved) { input.dirty = false; } return; }
		if (document.activeElement !== input) { input.value = saved; }
	}

	var ttIndexShown = null;

	function renderTangToc(tt) {
		els.ttPhase.textContent = (ttPhaseText[tt.phase] || tt.phase) + (tt.reviewing ? ' — đang xem lại khung' : '');
		els.ttIndex.textContent = tt.index ? ('câu ' + tt.index + ' / ' + tt.count + ' · ' + tt.seconds + ' s') : '—';
		els.ttQuestion.textContent = tt.question || '';
		els.ttAnswer.textContent = tt.answer || '';
		els.ttMedia.textContent = tt.mediaSrc ? (tt.mediaType + ': ' + tt.mediaSrc) : '—';
		var indexChanged = tt.index !== ttIndexShown;
		ttIndexShown = tt.index;
		var canMark = ttMarkPhases.indexOf(tt.phase) !== -1;
		var preview = gv.ttRankPoints(tt.times || {}, tt.correctSeats || []);
		[1, 2, 3, 4].forEach(function (seat) {
			var p = player(seat);
			els.ttName[seat].textContent = p ? (seat + ' · ' + p.displayName) : String(seat);
			var ans = els.ttAns[seat], tim = els.ttTime[seat];
			var savedA = (tt.answers && tt.answers[seat]) || '';
			var savedT = (tt.times && typeof tt.times[seat] === 'number') ? tt.times[seat].toFixed(2) : '';
			refill(ans, savedA, indexChanged);
			refill(tim, savedT, indexChanged);
			ans.disabled = tim.disabled = !tt.index || tt.phase === 'graded' || tt.phase === 'finished' || tt.phase === 'done';
			var correct = (tt.correctSeats || []).indexOf(seat) !== -1;
			ans.parentNode.classList.toggle('ok', correct);
			els.ttMark[seat].disabled = !canMark;
			paintCorrectBtn(els.ttMark[seat], seat, correct);
			var awarded = tt.awarded && tt.awarded[seat];
			els.ttPreview[seat].textContent = tt.phase === 'graded' || tt.phase === 'finished'
				? (awarded ? ('+' + awarded) : '')
				: (correct ? ('sẽ +' + (preview[seat] || 0)) : '');
		});
		els.ttAnswersSave.disabled = !tt.index || !canMark && tt.phase !== 'question';
	}

	function saveTtAnswers() {
		var answers = {}, times = {};
		[1, 2, 3, 4].forEach(function (seat) {
			answers[seat] = els.ttAns[seat].value; times[seat] = els.ttTime[seat].value;
			els.ttAns[seat].dirty = false; els.ttTime[seat].dirty = false;
		});
		gv.Sync.sendCommand('ttSetAnswers', { answers: answers, times: times });
	}

	var answersRowShown = null;
	var VCNV_MARK_PHASES = ['rowQuestion', 'rowTimer', 'rowAnswers'];

	function renderVcnvAnswers(vcnv) {
		var n = vcnv.currentRow;
		var r = n ? (vcnv.rows || [])[n - 1] : null;
		var rowChanged = n !== answersRowShown;
		answersRowShown = n;
		els.vcnvAnswersRow.textContent = n ? (n === 5 ? '— ô trung tâm' : '— hàng ' + n) : '— (chưa chọn hàng)';
		var canMark = n && VCNV_MARK_PHASES.indexOf(vcnv.phase) !== -1;
		[1, 2, 3, 4].forEach(function (seat) {
			var p = player(seat);
			var input = els.vcnvAns[seat];
			var eliminated = (vcnv.eliminated || []).indexOf(seat) !== -1;
			els.vcnvAnsName[seat].textContent = p ? (seat + ' · ' + p.displayName) : String(seat);
			var saved = (r && r.answers) ? (r.answers[seat] || '') : '';
			els.vcnvAnsSaved[seat].textContent = saved ? 'đã lưu' : '';
			input.disabled = !n || eliminated;
			input.parentNode.classList.toggle('out', eliminated);
			refill(input, saved, rowChanged);
			var correct = !!(r && r.correctSeats && r.correctSeats.indexOf(seat) !== -1);
			input.parentNode.classList.toggle('ok', correct);
			var btn = els.vcnvAnsCorrect[seat];
			btn.disabled = !canMark || eliminated;
			paintCorrectBtn(btn, seat, correct);
		});
		els.vcnvAnswersSave.disabled = !n;
	}

	function paintCorrectBtn(btn, seat, on) {
		btn.classList.toggle('on', on);
		btn.textContent = on ? ('✓ Ghế ' + seat + ' đúng — bỏ') : ('Ghế ' + seat + ' đúng');
	}

	function saveVcnvAnswers() {
		if (!answersRowShown) { return; }
		var answers = {};
		[1, 2, 3, 4].forEach(function (seat) { answers[seat] = els.vcnvAns[seat].value; els.vcnvAns[seat].dirty = false; });
		gv.Sync.sendCommand('vcnvSetAnswers', { row: answersRowShown, answers: answers });
	}

	/* names may be edited only before Khởi động starts */
	function renderNames() {
		var kd = snap.roundState && snap.roundState.kd;
		var editable = snap.currentRound === 'kd' && kd && (kd.phase === 'idle' || kd.phase === 'title');
		[1, 2, 3, 4].forEach(function (seat) {
			var p = player(seat);
			var input = els.name[seat];
			refill(input, p ? p.fullName : '', false);
			input.disabled = els.nameSet[seat].disabled = !editable;
			els.nameShown[seat].textContent = p ? ('hiện: ' + p.displayName) : '';
		});
		els.namesReset.disabled = !editable;
		if (editable && !els.namesDetails.dataset.touched) { els.namesDetails.open = true; }
	}

	function saveName(seat) {
		var v = els.name[seat].value.trim();
		els.name[seat].dirty = false;
		if (!v) { return; }
		gv.Sync.sendCommand('setName', { seat: seat, name: v });
		els.nameShown[seat].textContent = 'đang gửi…';
	}

	function renderVeDich(vd) {
		els.vdPhase.textContent = vdPhaseText[vd.phase] || vd.phase;
		els.vdOrder.textContent = (vd.order || []).map(function (s) {
			return nameOf(s, true) + ((vd.done || []).indexOf(s) !== -1 ? ' ✓' : '');
		}).join(' --> ') + (vd.orderManual ? '   [đặt tay]' : '') || '— (tính khi vào vòng: điểm cao thi trước)';
		els.vdSeat.textContent = vd.seat ? (nameOf(vd.seat, true) + ' · lượt ' + vd.turn + ' / 4') : '—';
		var vals = (vd.values || []);
		els.vdValues.textContent = vals.length ? (vals.join(' – ') + (vals.length < 3 ? ('  (còn ' + (3 - vals.length) + ')') : '') + (vd.qIndex ? ('  ·  câu ' + vd.qIndex + ' / 3: ' + vd.value + ' điểm, ' + vd.seconds + ' s') : '')) : '—';
		els.vdQuestion.textContent = vd.question || '';
		els.vdAnswer.textContent = vd.answer || '';
		els.vdStar.textContent = vd.star ? ('★ câu ' + vd.star + (vd.star === vd.qIndex ? ' (câu này)' : '')) : (vd.starUsed ? 'đã dùng' : (vd.seat ? 'chưa đặt' : '—'));
		var steal = vd.stealSeat ? (nameOf(vd.stealSeat) + (vd.stealResult ? (vd.stealResult === 'correct' ? ' — ĐÚNG' : ' — SAI') : ' — đang trả lời')) : (vd.phase === 'steal' ? 'đang chờ 5 s…' : '—');
		els.vdSteal.textContent = (vd.result ? ('Thí sinh đang thi: ' + (vd.result === 'correct' ? 'ĐÚNG' : 'SAI') + '  ·  ') : '') + 'Giành: ' + steal;
		var ph = vd.phase;
		els.vdPick20.disabled = els.vdPick30.disabled = !(ph === 'choose' && vals.length < 3);
		els.vdUnpick.disabled = !(ph === 'choose' && vals.length);
		els.vdNext.disabled = !(ph === 'ready' || ph === 'question' || (ph === 'steal' && !vd.stealSeat) || ph === 'answered');
		els.vdShowBar.disabled = !(ph === 'idle' || ph === 'title' || ph === 'stageCall' || (ph === 'choose' && vals.length === 3) || ph === 'blank' || ph === 'finished');
		var starOk = ph === 'ready' || ((ph === 'answered' || (ph === 'steal' && !vd.stealSeat)) && vd.qIndex < 3);
		els.vdStarBtn.disabled = !(starOk && !vd.starUsed);
		els.vdCorrect.disabled = els.vdWrong.disabled = !(ph === 'timer' || ph === 'stealAnswer');
		els.vdNext.classList.toggle('next', !els.vdNext.disabled);
		els.vdShowBar.classList.toggle('next', !els.vdShowBar.disabled);
		[1, 2, 3, 4].forEach(function (seat) {
			els.vdStealSeat[seat].disabled = !(ph === 'steal' && !vd.stealSeat && seat !== vd.seat);
			els.vdStealSeat[seat].classList.toggle('on', vd.stealSeat === seat);
		});
	}

	function renderTieBreak(tb) {
		els.tbPhase.textContent = tb.phase === 'closed' ? tbClosedText(tb) : (tbPhaseText[tb.phase] || tb.phase);
		els.tbCount.textContent = (tb.questionCount || 0) + ' câu trong bộ đề (tối đa 3)';
		els.tbSeats.textContent = (tb.seats || []).length ? names(tb.seats) : ('chưa chọn — ← sẽ lấy: ' + (names(tb.topSeats) || '—'));
		els.tbQuestion.textContent = tb.questionIndex ? (tb.questionIndex + ' / ' + (tb.questionCount || 0)) : '—';
		els.tbBuzz.textContent = tb.buzzSeat != null ? (nameOf(tb.buzzSeat) + (tb.buzzEarly ? ' (bấm sớm)' : '')) : 'chưa ai bấm';
		els.tbBuzz.className = tb.buzzSeat != null ? 'buzzed' : '';
		els.tbOut.textContent = names(tb.eliminated) || 'không';
		els.tbResult.textContent = tbResultText[tb.lastResult] || '—';

		els.tbSetSeats.disabled = tb.phase !== 'idle';
	}

	function renderRound() {
		var kd = snap.roundState && snap.roundState.kd;
		var vcnv = snap.roundState && snap.roundState.vcnv;
		if (vcnv) {
			els.vcnvPhase.textContent = vcnvPhaseText[vcnv.phase] || vcnv.phase;
			els.vcnvRows.textContent = (vcnv.rows || []).map(function (r, i) {
				var t = (i === 4 ? 'Ô trung tâm' : (i + 1)) + ': ' + (vcnvRowText[r.status] || r.status);
				if (r.correctSeats && r.correctSeats.length) { t += ' (' + r.correctSeats.join(',') + ')'; }
				return t;
			}).join('  ·  ') || '—';
			els.vcnvQuestion.textContent = vcnv.currentQuestion || '';
			els.vcnvAnswer.textContent = vcnv.currentAnswer || '';
			els.vcnvKeyword.textContent = (vcnv.keyword || '—') + (vcnv.solved ? '  — ĐÃ GIẢI (ghế ' + vcnv.solvedBy + ')' : '');
			var n = Math.max(1, Math.min(4, vcnv.openedCount || 0));
			els.vcnvPrize.textContent = vcnv.centerOpened
				? 'ô trung tâm đã mở · CNV = ' + gv.Points.VCNV_AFTER_CENTER
				: (vcnv.openedCount || 0) + ' hàng đã mở · CNV = ' + gv.Points.VCNV_OBSTACLE[n];
			els.vcnvQueue.textContent = names(vcnv.queue) || 'chưa ai';
			var guessing = vcnv.phase === 'guessing';
			[1, 2, 3, 4].forEach(function (seat) {
				var b = els.vcnvCnv[seat];
				var queued = (vcnv.queue || []).indexOf(seat) !== -1;
				b.disabled = !(guessing && queued);
				b.classList.toggle('inQueue', queued);
				b.textContent = nameOf(seat) + ' đúng CNV';
			});
			els.vcnvEliminated.textContent = names(vcnv.eliminated) || 'không';
			renderVcnvAnswers(vcnv);
		}
		var tt = snap.roundState && snap.roundState.tt;
		if (tt) { renderTangToc(tt); }
		var vd = snap.roundState && snap.roundState.vd;
		if (vd) { renderVeDich(vd); }
		var tbs = snap.roundState && snap.roundState.tb;
		if (tbs) { renderTieBreak(tbs); }
		if (!kd) { els.kdPhase.textContent = '—'; return; }
		var mode = kd.mode || 'individual';
		var common = mode === 'common';
		var o23 = snap.rules === 'o23', jungleRules = snap.rules === 'jungle';
		els.kdMode.textContent = o23 ? ('luật O23 · ' + (kd.turn ? 'lượt ' + kd.turn + '/3 · ' + kd.questionCount + ' câu' : '3 lượt 8 · 12 · 16 câu'))
			: jungleRules ? ('luật rừng · ' + (common ? (kd.turn ? 'đối kháng ' + kd.turn + '/2 · ' + kd.questionCount + ' câu' : 'đối kháng 8 · 16 câu') : 'lượt riêng 60 giây · 12 câu + bổ sung'))
			: (common ? 'lượt chung · 12 câu' : 'lượt riêng · 6 câu / thí sinh');
		els.kdPhase.textContent = (kdPhaseText[kdKindOf(kd)] || {})[kd.phase] || kd.phase;
		els.kdSeat.textContent = common ? '—' : nameOf(kd.seat);
		els.kdBuzz.textContent = common ? (kd.buzzSeat ? nameOf(kd.buzzSeat) + (kd.resolved ? ' (đã chấm)' : '') : 'chưa ai bấm') : '—';
		els.kdBuzz.className = (common && kd.buzzSeat && !kd.resolved) ? 'buzzed' : '';
		els.kdQuestion.textContent = kd.questionIndex ? (kd.questionIndex + ' / ' + kd.questionCount) : '—';
		els.kdText.textContent = kd.currentQuestion || '';
		els.kdAnswer.textContent = kd.currentAnswer || '';
		var rk = kd.lastResult === 'wrong' && common ? 'wrongCommon' : kd.lastResult;
		els.kdResult.textContent = kdResultText[rk] || '—';
		els.kdResult.className = kd.lastResult || '';
		els.kdClearBuzz.disabled = !common;
		els.kdResetCommon.disabled = !(common || kd.phase === 'finished');
		els.kdResetCommon.textContent = o23 || jungleRules ? 'Chạy lại lượt này từ câu 1' : 'Chạy lại lượt chung từ câu 1';
	}

	/* ---------------- clock / bed / connection (200 ms) ---------------- */

	/* what the red strip says - in a room there is more that can go wrong than "no stage" */
	var localBannerText = null;
	var STARTING_GRACE_MS = 20000;   /* the panel starts its own engine: silence this long is a real problem */
	var notAliveSince = Date.now();
	function bannerText(alive) {
		var st = gv.Sync.status, code = gv.Sync.room;
		if (!code) { return alive ? '' : localBannerText; }
		if (st === 'denied' || st === 'error') { return gv.Sync.statusDetail || ('Không vào được phòng ' + code + '.'); }
		if (st === 'connecting') { return 'Đang kết nối phòng ' + code + '...'; }
		if (st === 'offline') { return 'Mất kết nối tới máy chủ - đang thử lại...'; }
		if (alive) { notAliveSince = 0; return ''; }
		if (!notAliveSince) { notAliveSince = Date.now(); }
		var why = window.OlympiaEmbeddedStage && window.OlympiaEmbeddedStage.problem ? window.OlympiaEmbeddedStage.problem() : '';
		if (why) { return why; }
		/* starting (or taking over): no stage screen is needed, the engine runs in this panel */
		if (Date.now() - notAliveSince < STARTING_GRACE_MS) { return ''; }
		return 'Trận của phòng ' + code + ' chưa chạy được trên máy này - bấm "Chạy trận trên máy này" (mục Trận đấu).';
	}
	/* more than one stage page runs a game: the panel follows one (StateSync.js), say so */
	function duplicateText() {
		var others = gv.Sync.ignoredEngines ? gv.Sync.ignoredEngines().filter(function (e) { return !e.embedded; }) : [];
		var lead = gv.Sync.lastSnapshot;
		if (!others.length || !lead || lead.embedded) { return ''; }
		return 'Có ' + (others.length + 1) + ' màn sân khấu cùng chạy trận - bàn điều khiển chỉ theo một màn. Hãy đóng bớt, chỉ để lại một màn sân khấu.';
	}

	function tick() {
		var alive = gv.Sync.isAuthorityAlive();
		if (localBannerText === null) { localBannerText = els.banner.textContent; }
		var text = bannerText(alive) || duplicateText();
		if (text && els.banner.textContent !== text) { els.banner.textContent = text; }
		els.banner.classList.toggle('visible', !!text);
		els.connDot.classList.toggle('dead', !alive);
		if (!snap) { return; }
		var t = snap.timer, tv = timerValue(t);
		els.clockBox.classList.toggle('running', !!(t && t.running));
		els.clockBox.classList.toggle('idle', tv === null);
		els.timer.textContent = (tv === null) ? '—' : fmtSeconds(tv);
		var frac = (t && t.duration && tv !== null) ? (t.mode === 'down' ? 1 - tv / t.duration : tv / t.duration) : 0;
		els.timerBar.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
		var b = snap.bed;
		els.bed.textContent = (b && b.file) ? (b.file + ' @ ' + fmtSeconds(bedPosition(b)) + ' s' + (b.looping ? ' · loop' : ' · outro')) : '—';
	}

	/* ---------------- tabs ---------------- */

	var tabForRound = { kd: 'kd', vcnv: 'vcnv', tt: 'tt', vd: 'vd', tb: 'tb' };
	var followedRound = null;

	function showTab(name) {
		$$('.tabBar .tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === name); });
		$$('.tabPanel').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-tab') === name); });
	}

	function followRound(round) {
		$$('.tabBar .tab').forEach(function (b) { b.classList.toggle('current', b.getAttribute('data-tab') === tabForRound[round]); });
		if (round !== followedRound) { followedRound = round; showTab(tabForRound[round] || 'kd'); }
	}

	/* ---------------- undo + match log (MatchLog.js on the stage) ---------------- */

	var logWanted = false;
	function fmtClock(t) { try { return new Date(t).toLocaleTimeString('vi-VN', { hour12: false }); } catch (e) { return ''; } }

	function renderLog(s) {
		var m = s.matchLog;
		var btn = els.undoScore;
		btn.disabled = !(m && m.undo);
		btn.textContent = (m && m.undo)
			? '↶ Hoàn tác điểm: ' + m.undo.label + ' (' + m.undo.changes.map(function (c) { return nameOf(c.seat) + ' ' + (c.delta > 0 ? '+' : '') + c.delta; }).join(', ') + ')'
			: '↶ Hoàn tác điểm (chưa có thao tác nào)';
		if (!m) { return; }
		els.logCount.textContent = '· ' + m.count + ' dòng';
		var list = els.logList;
		list.textContent = '';
		m.tail.slice().reverse().forEach(function (e) {
			var li = document.createElement('li'); li.className = e.kind || '';
			var t = document.createElement('time'); t.textContent = fmtClock(e.t); li.appendChild(t);
			li.appendChild(document.createTextNode(e.text));
			list.appendChild(li);
		});
		if (m.full && logWanted) { logWanted = false; downloadLog(m.full); }
	}

	function csvCell(v) {
		var s = String(v === undefined || v === null ? '' : v);
		/* a cell starting with = + - @ (or tab / CR) is run as a formula by Excel/Sheets - names and texts come from players */
		if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) { s = "'" + s; }
		return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

	function downloadLog(list) {
		var names = (snap.players || []).map(function (p) { return p.seat + '. ' + p.displayName; });
		var rows = [['Thời gian', 'Vòng', 'Loại', 'Nội dung', 'Ghế', 'Thay đổi'].concat(names)];
		list.forEach(function (e) {
			rows.push([new Date(e.t).toLocaleString('vi-VN', { hour12: false }), gv.RoundNames[e.round] || e.round, e.kind, e.text, e.seat || '', e.delta || ''].concat(e.scores || []));
		});
		rows.push([]);
		rows.push(['Điểm cuối'].concat((snap.players || []).map(function (p) { return p.seat + '. ' + p.displayName + ': ' + p.score; })));
		var csv = '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
		var a = document.createElement('a');
		a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
		a.download = 'nhat-ky-tran' + (gv.Sync.room ? '-' + gv.Sync.room : '') + '-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '') + '.csv';
		document.body.appendChild(a); a.click(); a.remove();
		setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
	}

	function render(s) {
		snap = s;
		renderLog(s);
		followRound(s.currentRound);
		renderPlayers();
		renderNames();
		renderRound();
		renderDeck();
		els.background.textContent = s.isBackgroundShowing ? 'hiện' : 'ẩn';
		els.questionSet.textContent = s.questionSet || 'trên máy sân khấu / mẫu';
		var sm = s.summary;
		els.summary.textContent = (sm && sm.showing && sm.entry)
			? ((sm.index + 1) + '/' + sm.order.length + ': ' + sm.entry.name + ' — ' + sm.entry.score)
			: 'ẩn';
		els.board.textContent = s.boardScreen ? 'HIỆN' : 'ẩn';
		renderGreenScreen(s);
		els.updated.textContent = new Date(s.at).toLocaleTimeString('vi-VN');
		tick();
	}

	/* green screen: the toggle, the ',' buttons (lit while the round graphics are hidden), F6 dimmed */
	function renderGreenScreen(s) {
		els.greenScreen.textContent = s.greenScreen ? ('BẬT ' + (s.greenScreenColor || '')) : 'tắt';
		els.greenScreenBtn.textContent = 'Green Screen: ' + (s.greenScreen ? 'BẬT' : 'TẮT');
		els.greenScreenBtn.classList.toggle('on', !!s.greenScreen);
		els.boardBtn.disabled = !!s.greenScreen;
		$$('.roundGfxBtn').forEach(function (b) {
			b.disabled = !s.greenScreen;   /* ',' only works in green-screen mode */
			b.classList.toggle('on', !!s.roundGraphicsHidden);
			var label = b.querySelector('.roundGfxLabel');
			if (!label.dataset.hideText) { label.dataset.hideText = label.textContent; }
			label.textContent = s.roundGraphicsHidden ? 'Đang ẩn: bấm để hiện lại đồ hoạ' : label.dataset.hideText;
		});
	}

	/* ---------------- sound board ---------------- */

	var soundLabels = {
		'kd_start.mp3': 'KĐ bắt đầu', 'kd_ready.ogg': 'KĐ chuẩn bị', 'kd_open_question.mp3': 'KĐ mở câu hỏi', 'kd_60s.mp3': 'KĐ 60 s',
		'kd_correct.mp3': 'KĐ đúng', 'kd_wrong.ogg': 'KĐ sai', 'kd_complete.ogg': 'KĐ hoàn thành', 'kd_buzz.mp3': 'Chuông',
		'score_summary.oga': 'Tổng kết điểm', 'blank.ogg': 'Ô trống',
		'vcnv_start.mp3': 'VCNV bắt đầu', 'vcnv_open_board.mp3': 'Mở ô chữ', 'vcnv_select_row.mp3': 'Chọn hàng', 'vcnv_open_question.mp3': 'VCNV mở câu hỏi',
		'vcnv_15s.mp3': 'VCNV 15 s', 'tb_15s.ogg': 'Câu phụ 15 s', 'vcnv_open_answers.ogg': 'VCNV mở đáp án', 'vcnv_row_correct.mp3': 'Hàng đúng', 'vcnv_row_wrong.mp3': 'Hàng sai',
		'vcnv_open_picture.mp3': 'Mở hình ảnh', 'vcnv_signal.mp3': 'Tín hiệu CNV', 'vcnv_solved.mp3': 'Đúng CNV',
		'tt_start.mp3': 'TT bắt đầu', 'tt_open_question.mp3': 'TT mở câu hỏi', 'tt_20s.mp3': 'TT 20 s', 'tt_30s.mp3': 'TT 30 s', 'tt_open_answers.mp3': 'TT mở đáp án',
		'vd_start.mp3': 'VĐ bắt đầu', 'vd_ready.mp3': 'Lên sân khấu', 'vd_choose.ogg': 'Mở gói điểm', 'vd_pick.ogg': 'Chọn câu trong gói', 'vd_open_question.mp3': 'VĐ mở câu hỏi',
		'vd_star.mp3': 'Ngôi sao', 'vd_15s.mp3': 'VĐ 15 s', 'vd_20s.mp3': 'VĐ 20 s', 'vd_correct.ogg': 'VĐ đúng', 'vd_wrong.ogg': 'VĐ sai', 'vd_5s.mp3': '5 s giành quyền',
		'vd_turn_complete.mp3': 'Hết lượt cá nhân'
	};
	var bedFiles = ['kd_60s.mp3', 'vcnv_15s.mp3', 'tb_15s.ogg', 'tt_20s.mp3', 'tt_30s.mp3', 'vd_15s.mp3', 'vd_20s.mp3', 'vd_5s.mp3', 'score_summary.oga'];

	function buildSoundBoard() {
		var host = els.soundBoard;
		Object.keys(gv.SoundMap).forEach(function (file) {
			var b = document.createElement('button');
			b.type = 'button';
			b.className = 'snd' + (bedFiles.indexOf(file) !== -1 ? ' bed' : '');
			b.textContent = soundLabels[file] || file;
			b.title = file;
			b.addEventListener('click', function () { gv.Sync.sendCommand('playSound', { file: file }); });
			host.appendChild(b);
		});
		var stop = document.createElement('button');
		stop.type = 'button'; stop.className = 'snd stop'; stop.textContent = 'Dừng tất cả âm';
		stop.addEventListener('click', function () { gv.Sync.sendCommand('stopSounds', {}); });
		host.appendChild(stop);
	}

	/* ---------------- init ---------------- */

	gv.ControlPanel = {
		init: function () {
			els = {
				playersBody: $('#playersBody'), scoreSeat: $('#scoreSeat'), scoreInput: $('#scoreInput'), scoreSet: $('#scoreSet'),
				name: { 1: $('#name1'), 2: $('#name2'), 3: $('#name3'), 4: $('#name4') },
				nameSet: { 1: $('#nameSet1'), 2: $('#nameSet2'), 3: $('#nameSet3'), 4: $('#nameSet4') },
				nameShown: { 1: $('#nameShown1'), 2: $('#nameShown2'), 3: $('#nameShown3'), 4: $('#nameShown4') },
				namesReset: $('#namesReset'), namesDetails: $('#namesDetails'),
				roundName: $('#roundName'), clockBox: $('#clockBox'), timer: $('#timerValue'), timerBar: $('#timerBar'),
				chipWho: $('#chipWho'), chipPts: $('#chipPts'), chipStatus: $('#chipStatus'),
				deckQuestion: $('#deckQuestion'), deckAnswer: $('#deckAnswer'),
				stat1k: $('#stat1k'), stat1v: $('#stat1v'), stat2k: $('#stat2k'), stat2v: $('#stat2v'), stat3k: $('#stat3k'), stat3v: $('#stat3v'), stat4k: $('#stat4k'), stat4v: $('#stat4v'),
				kdLeftLabel: $('#kdLeftLabel'), vcnvRightLabel: $('#vcnvRightLabel'), ttRightLabel: $('#ttRightLabel'), vdLeftLabel: $('#vdLeftLabel'), vdRightLabel: $('#vdRightLabel'),
				vcnvB1: $('#vcnvB1'), vcnvB2: $('#vcnvB2'), vcnvB3: $('#vcnvB3'), vcnvB4: $('#vcnvB4'),
				kdMode: $('#kdMode'), kdPhase: $('#kdPhase'), kdSeat: $('#kdSeat'), kdBuzz: $('#kdBuzz'),
				kdQuestion: $('#kdQuestion'), kdText: $('#kdText'), kdAnswer: $('#kdAnswer'), kdResult: $('#kdResult'),
				kdClearBuzz: $('#kdClearBuzz'), kdResetCommon: $('#kdResetCommon'),
				vcnvPhase: $('#vcnvPhase'), vcnvRows: $('#vcnvRows'), vcnvQuestion: $('#vcnvQuestion'), vcnvAnswer: $('#vcnvAnswer'),
				vcnvKeyword: $('#vcnvKeyword'), vcnvPrize: $('#vcnvPrize'), vcnvQueue: $('#vcnvQueue'), vcnvEliminated: $('#vcnvEliminated'),
				vcnvAnswersRow: $('#vcnvAnswersRow'), vcnvAnswersSave: $('#vcnvAnswersSave'),
				vcnvCnv: { 1: $('#vcnvCnv1'), 2: $('#vcnvCnv2'), 3: $('#vcnvCnv3'), 4: $('#vcnvCnv4') }, vcnvCnvWrong: $('#vcnvCnvWrong'),
				vcnvAns: { 1: $('#vcnvAns1'), 2: $('#vcnvAns2'), 3: $('#vcnvAns3'), 4: $('#vcnvAns4') },
				vcnvAnsName: { 1: $('#vcnvAnsName1'), 2: $('#vcnvAnsName2'), 3: $('#vcnvAnsName3'), 4: $('#vcnvAnsName4') },
				vcnvAnsSaved: { 1: $('#vcnvAnsSaved1'), 2: $('#vcnvAnsSaved2'), 3: $('#vcnvAnsSaved3'), 4: $('#vcnvAnsSaved4') },
				vcnvAnsCorrect: { 1: $('#vcnvAnsCorrect1'), 2: $('#vcnvAnsCorrect2'), 3: $('#vcnvAnsCorrect3'), 4: $('#vcnvAnsCorrect4') },
				ttPhase: $('#ttPhase'), ttIndex: $('#ttIndex'), ttQuestion: $('#ttQuestion'), ttAnswer: $('#ttAnswer'), ttMedia: $('#ttMedia'),
				ttAnswersSave: $('#ttAnswersSave'), ttReview: $('#ttReview'),
				ttName: { 1: $('#ttName1'), 2: $('#ttName2'), 3: $('#ttName3'), 4: $('#ttName4') },
				ttAns: { 1: $('#ttAns1'), 2: $('#ttAns2'), 3: $('#ttAns3'), 4: $('#ttAns4') },
				ttTime: { 1: $('#ttTime1'), 2: $('#ttTime2'), 3: $('#ttTime3'), 4: $('#ttTime4') },
				ttCorrect: { 1: $('#ttCorrect1'), 2: $('#ttCorrect2'), 3: $('#ttCorrect3'), 4: $('#ttCorrect4') },
				ttMark: { 1: $('#ttMark1'), 2: $('#ttMark2'), 3: $('#ttMark3'), 4: $('#ttMark4') },
				ttPreview: { 1: $('#ttPreview1'), 2: $('#ttPreview2'), 3: $('#ttPreview3'), 4: $('#ttPreview4') },
				vdPhase: $('#vdPhase'), vdOrder: $('#vdOrder'), vdSeat: $('#vdSeat'), vdValues: $('#vdValues'),
				vdQuestion: $('#vdQuestion'), vdAnswer: $('#vdAnswer'), vdStar: $('#vdStar'), vdSteal: $('#vdSteal'),
				vdPick20: $('#vdPick20'), vdPick30: $('#vdPick30'), vdUnpick: $('#vdUnpick'), vdShowBar: $('#vdShowBar'), vdNext: $('#vdNext'), vdStarBtn: $('#vdStarBtn'),
				vdCorrect: $('#vdCorrect'), vdWrong: $('#vdWrong'),
				vdStealSeat: { 1: $('#vdStealSeat1'), 2: $('#vdStealSeat2'), 3: $('#vdStealSeat3'), 4: $('#vdStealSeat4') },
				tbLeftLabel: $('#tbLeftLabel'), tbRightLabel: $('#tbRightLabel'), tbWrongLabel: $('#tbWrongLabel'),
				tbPhase: $('#tbPhase'), tbCount: $('#tbCount'), tbSeats: $('#tbSeats'), tbQuestion: $('#tbQuestion'), tbBuzz: $('#tbBuzz'),
				tbOut: $('#tbOut'), tbResult: $('#tbResult'), tbSetSeats: $('#tbSetSeats'),
				bed: $('#bedValue'), background: $('#backgroundValue'), questionSet: $('#questionSetValue'), summary: $('#summaryValue'), board: $('#boardValue'),
				greenScreen: $('#greenScreenValue'), greenScreenBtn: $('#greenScreenBtn'), boardBtn: $('#boardBtn'),
				updated: $('#updatedAt'), banner: $('#connectionBanner'), connDot: $('#connDot'), soundBoard: $('#soundBoard'),
				undoScore: $('#undoScore'), logCount: $('#logCount'), logList: $('#logList')
			};

			/* generic: key buttons of the action bars and of the graphics-page card */
			$$('[data-cmd][data-key]').forEach(function (b) {
				b.addEventListener('click', function () { gv.Sync.sendCommand(b.getAttribute('data-cmd'), { key: b.getAttribute('data-key') }); });
			});
			$$('[data-sendkey]').forEach(function (b) {
				b.addEventListener('click', function () { var k = b.getAttribute('data-sendkey'); gv.Sync.sendKey(k, k); });
			});

			/* undo the last action's points / download the match log */
			els.undoScore.addEventListener('click', function () { gv.Sync.sendCommand('undoScore', {}); });
			$('#logDownload').addEventListener('click', function () { logWanted = true; gv.Sync.sendCommand('requestLog', {}); });

			/* green screen */
			els.greenScreenBtn.addEventListener('click', function () { gv.Sync.sendCommand('greenScreenToggle', {}); });

			/* score table */
			els.scoreSet.addEventListener('click', function () {
				if (els.scoreInput.value === '') { return; }
				gv.Sync.sendCommand('setScore', { seat: parseInt(els.scoreSeat.value, 10), value: els.scoreInput.value });
				els.scoreInput.value = '';
			});
			els.scoreInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { els.scoreSet.click(); } });
			els.scoreSeat.addEventListener('change', function () { if (snap) { renderPlayers(); } });

			/* names */
			[1, 2, 3, 4].forEach(function (seat) {
				var inp = els.name[seat];
				inp.addEventListener('input', function () { inp.dirty = true; });
				inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { saveName(seat); } });
				els.nameSet[seat].addEventListener('click', function () { saveName(seat); });
			});
			els.namesDetails.addEventListener('toggle', function () { els.namesDetails.dataset.touched = '1'; });
			$('#namesReset').addEventListener('click', function () {
				if (confirm('Bỏ tên đã sửa, dùng lại tên trong players.xml?')) { gv.Sync.sendCommand('resetNames', {}); }
			});

			/* Khởi động */
			$('#kdResetAll').addEventListener('click', function () {
				if (confirm('Đặt lại toàn bộ phần Khởi động (không đổi điểm)?')) { gv.Sync.sendCommand('kdReset', {}); }
			});
			$('#kdResetCommon').addEventListener('click', function () {
				if (confirm('Chạy lại lượt chung từ câu 1 (không đổi điểm)?')) { gv.Sync.sendCommand('kdResetCommon', {}); }
			});
			$('#kdClearBuzz').addEventListener('click', function () { gv.Sync.sendCommand('kdClearBuzz', {}); });

			/* VCNV */
			$('#vcnvReset').addEventListener('click', function () {
				if (confirm('Đặt lại phần Vượt chướng ngại vật (không đổi điểm)?')) { gv.Sync.sendCommand('vcnvReset', {}); }
			});
			$('#vcnvReveal').addEventListener('click', function () {
				if (confirm('Mở hết ảnh + đáp án (không cộng điểm ai)?')) { gv.Sync.sendCommand('vcnvReveal', {}); }
			});
			$('#vcnvAnswersSave').addEventListener('click', saveVcnvAnswers);
			[1, 2, 3, 4].forEach(function (seat) {
				els.vcnvCnv[seat].addEventListener('click', function () { gv.Sync.sendCommand('vcnvKey', { key: ['q', 'w', 'e', 'r'][seat - 1] }); });
				els.vcnvAns[seat].addEventListener('input', function () { els.vcnvAns[seat].dirty = true; });
				els.vcnvAns[seat].addEventListener('change', saveVcnvAnswers);
				els.vcnvAns[seat].addEventListener('keydown', function (e) { if (e.key === 'Enter') { saveVcnvAnswers(); } });
				els.vcnvAnsCorrect[seat].addEventListener('click', function () {
					var btn = els.vcnvAnsCorrect[seat];
					paintCorrectBtn(btn, seat, !btn.classList.contains('on'));
					gv.Sync.sendCommand('vcnvKey', { key: String(seat) });
				});
			});
			$('#vcnvCnvWrong').addEventListener('click', function () {
				gv.Sync.sendCommand('vcnvKey', { key: '0' });
			});
			$('#vcnvUnEliminate').addEventListener('click', function () {
				var seat = prompt('Khôi phục quyền thi VCNV cho ghế số:');
				if (seat) { gv.Sync.sendCommand('vcnvUnEliminate', { seat: seat }); }
			});

			/* Tăng tốc */
			$('#ttAnswersSave').addEventListener('click', saveTtAnswers);
			$('#ttReview').addEventListener('click', function () { gv.Sync.sendCommand('ttKey', { key: 'b' }); });
			[1, 2, 3, 4].forEach(function (seat) {
				[els.ttAns[seat], els.ttTime[seat]].forEach(function (inp) {
					inp.addEventListener('input', function () { inp.dirty = true; });
					inp.addEventListener('change', saveTtAnswers);
					inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { saveTtAnswers(); } });
				});
				els.ttCorrect[seat].addEventListener('click', function () { gv.Sync.sendCommand('ttKey', { key: String(seat) }); });
				els.ttMark[seat].addEventListener('click', function () {
					var btn = els.ttMark[seat];
					paintCorrectBtn(btn, seat, !btn.classList.contains('on'));
					gv.Sync.sendCommand('ttKey', { key: String(seat) });
				});
			});
			$('#ttReset').addEventListener('click', function () {
				if (confirm('Đặt lại phần Tăng tốc (không đổi điểm)?')) { gv.Sync.sendCommand('ttReset', {}); }
			});
			$('#ttGoto').addEventListener('click', function () {
				var n = prompt('Chạy lại câu số (1-4):');
				if (n) { gv.Sync.sendCommand('ttGoto', { index: n }); }
			});

			/* Về đích: every bar is the same key press as on the graphics page */
			var vdKeys = { vdPick20: '2', vdPick30: '3', vdUnpick: 'u', vdShowBar: 'ArrowLeft', vdNext: 'ArrowRight', vdStarBtn: 's', vdCorrect: 'ArrowUp', vdWrong: 'ArrowDown' };
			Object.keys(vdKeys).forEach(function (id) {
				els[id].addEventListener('click', function () { gv.Sync.sendCommand('vdKey', { key: vdKeys[id] }); });
			});
			[1, 2, 3, 4].forEach(function (seat) {
				els.vdStealSeat[seat].addEventListener('click', function () { gv.Sync.sendCommand('vdKey', { key: String(seat) }); });
			});
			$('#vdSetOrder').addEventListener('click', function () {
				var v = prompt('Thứ tự thi (4 số ghế, ví dụ 2 3 4 1) — để trống = theo điểm:');
				if (v === null) { return; }
				gv.Sync.sendCommand('vdSetOrder', { order: v.split(/[^0-9]+/).filter(Boolean) });
			});
			$('#vdGoto').addEventListener('click', function () {
				var seat = prompt('Chạy lại lượt Về đích của ghế số:');
				if (seat) { gv.Sync.sendCommand('vdGoto', { seat: seat }); }
			});
			$('#vdReset').addEventListener('click', function () {
				if (confirm('Đặt lại phần Về đích (không đổi điểm)?')) { gv.Sync.sendCommand('vdReset', {}); }
			});

			/* Câu hỏi phụ */
			els.tbSetSeats.addEventListener('click', function () {
				var v = prompt('Các ghế thi câu hỏi phụ (ví dụ 1 3) — để trống = các thí sinh bằng điểm nhất:');
				if (v === null) { return; }
				gv.Sync.sendCommand('tbSetSeats', { seats: v.split(/[^0-9]+/).filter(Boolean) });
			});
			$('#tbReset').addEventListener('click', function () {
				if (confirm('Đặt lại câu hỏi phụ (bỏ kết quả, về câu 1)?')) { gv.Sync.sendCommand('tbReset', {}); }
			});

			$$('.tabBar .tab').forEach(function (b) { b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); }); });
			showTab('kd');
			$('#requestState').addEventListener('click', function () { gv.Sync.send({ type: 'hello' }); });
			buildSoundBoard();

			gv.Sync.on('state', render);
			gv.Sync.init('remote');
			gv.Keyboard.init();
			uiTimer = setInterval(tick, 200);
			tick();
		}
	};

	document.addEventListener('DOMContentLoaded', function () { gv.ControlPanel.init(); });

})(window.GameVariables = window.GameVariables || {});
