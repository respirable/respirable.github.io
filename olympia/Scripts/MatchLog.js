/*
 * Olympia Controller - match log and score undo (stage page).
 *
 * Every key press and every control-panel command is one "action". The score changes it makes
 * (addScore / setScore) are kept together, so the control panel can undo the LAST action's
 * points ("Hoàn tác điểm", Ctrl+Z on the panel): every seat goes back to its score before it.
 * Only the points are undone - the graphics stay where they are - except in Khởi động, where the
 * question that was judged opens for a new verdict (↑ / ↓ again) if it is still on screen.
 *
 * The match log records the score changes (with the action that made them), buzzes, VCNV
 * signals and verdicts, Câu hỏi phụ verdicts and round changes. The panel shows the last ones;
 * "Tải nhật ký" asks for the whole log once (snapshot.fullLog) and saves it as CSV. The log is
 * kept in the automatic save (GameSave.js) so a stage reopened after a crash keeps it.
 *
 * The question log (gv.QuestionLog, for "Biên bản trận" - MatchReport.js): one record per question
 * put to the contestants - round, which question, its text and answer - and, as it is judged,
 * each seat's result: right / wrong / no answer (+ the answer they gave, the Tăng tốc time, the
 * points it moved, a steal or the star in Về đích). The host may correct a record from the report
 * (command editQuestion): the first version is kept in record.edit.orig and the record shows as
 * edited everywhere. Correcting the log never changes a score.
 */
(function (gv) {
	var MAX_LOG = 600, MAX_UNDO = 40;
	var ROUND = { kd: 'KĐ', vcnv: 'VCNV', tt: 'TT', vd: 'VĐ', tb: 'Câu phụ' };
	var KEY = {
		ArrowUp: 'đúng', ArrowDown: 'sai', ArrowRight: 'chấm', ArrowLeft: '←', ' ': 'đồng hồ 3 s', Backspace: 'xoá chuông',
		'1': 'phím 1', '2': 'phím 2', '3': 'phím 3', '4': 'phím 4', '0': 'phím 0', z: '+10 tay', x: '−5 tay', Z: '+10 tay', X: '−5 tay'
	};
	var CMD = { setScore: 'sửa điểm', vcnvSetAnswers: 'đáp án VCNV', ttSetAnswers: 'đáp án Tăng tốc', restoreProgress: 'phục hồi tiến trình', restoreSaved: 'khôi phục bản lưu' };

	gv.MatchLog = [];
	gv.ScoreUndo = [];
	gv.QuestionLog = [];
	var MAX_QUESTIONS = 400, qSerial = 0;
	var txn = null, sendFull = false;

	function seatName(s) { var p = gv.getPlayer(s); return s + '. ' + (p ? gv.displayName(p) : ''); }
	function scores() { return gv.Players.map(function (p) { return p.score; }); }

	function log(kind, text, extra) {
		var e = Object.assign({ t: Date.now(), round: gv.CurrentRound, kind: kind, text: text, scores: scores() }, extra || {});
		gv.MatchLog.push(e);
		if (gv.MatchLog.length > MAX_LOG) { gv.MatchLog.splice(0, gv.MatchLog.length - MAX_LOG); }
	}

	/* ---------- actions ---------- */

	function begin(label) {
		if (txn) { return false; }   /* nested (a command that presses a key): the outer one owns it */
		txn = { label: label, round: gv.CurrentRound, at: Date.now(), changes: [],
			kd: { index: gv.KhoiDongQuestionIndex, counter: gv.KhoiDongSequenceCounter, resolved: gv.IsKhoiDongQuestionResolved, result: gv.KhoiDongLastResult } };
		return true;
	}
	function end(own) {
		if (!own || !txn) { return; }
		var t = txn; txn = null;
		var changed = t.changes.filter(function (c) { return c.before !== c.after; });
		if (!changed.length) { return; }
		t.changes = changed;
		gv.ScoreUndo.push(t);
		if (gv.ScoreUndo.length > MAX_UNDO) { gv.ScoreUndo.shift(); }
		changed.forEach(function (c) {
			var d = c.after - c.before;
			log('score', seatName(c.seat) + ' ' + (d > 0 ? '+' : '') + d + ' (' + t.label + ')', { seat: c.seat, delta: d });
		});
	}
	function record(seat, before, after) {
		var own = begin('tự động');
		var hit = txn.changes.filter(function (c) { return c.seat === seat; })[0];
		if (hit) { hit.after = after; } else { txn.changes.push({ seat: seat, before: before, after: after }); }
		end(own);
	}

	/* score changes go through these two (ScoreboardControl.js) */
	var rawAdd = window.addScore, rawSet = window.setScore;
	window.addScore = function (seat, delta) {
		var p = gv.getPlayer(seat), before = p ? p.score : 0;
		rawAdd(seat, delta);
		if (p) { record(seat, before, p.score); }
	};
	window.setScore = function (seat, value) {
		var p = gv.getPlayer(seat), before = p ? p.score : 0;
		rawSet(seat, value);
		if (p) { record(seat, before, p.score); }
	};

	function wrapKeys() {
		var kb = gv.Keyboard, d = kb.dispatch, dt = kb.dispatchTo;
		kb.dispatch = function (key) {
			var own = begin((ROUND[gv.CurrentRound] || gv.CurrentRound) + ': ' + (KEY[key] || key));
			try { return d.apply(kb, arguments); } finally { end(own); }
		};
		kb.dispatchTo = function (roundId, key) {
			var own = begin((ROUND[roundId] || roundId) + ': ' + (KEY[key] || key));
			try { return dt.apply(kb, arguments); } finally { end(own); }
		};
	}

	function wrapCommands() {
		Object.keys(gv.Commands).forEach(function (name) {
			if (name === 'undoScore' || name === 'requestLog') { return; }
			var fn = gv.Commands[name];
			gv.Commands[name] = function (args) {
				var own = begin(CMD[name] || ('lệnh ' + name));
				try { return fn.apply(this, arguments); } finally { end(own); }
			};
		});
	}

	/* the events worth a line of their own */
	function wrapEvents() {
		function after(name, make) {
			var fn = window[name];
			if (typeof fn !== 'function') { return; }
			window[name] = function () {
				var r = fn.apply(this, arguments);
				try { var line = make.apply(null, arguments); if (line) { log(line[0], line[1], line[2]); } } catch (e) { /* never break the game for a log line */ }
				return r;
			};
		}
		after('setContestantBuzzed', function (seat, on) { return on ? ['buzz', seatName(seat) + ' bấm chuông', { seat: seat }] : null; });
		after('vcnvSignal', function (seat) { return ['cnv', seatName(seat) + ' xin trả lời chướng ngại vật', { seat: seat }]; });
		after('vcnvGuessAllWrong', function () { return ['cnv', 'Chướng ngại vật: tất cả người xin đều sai']; });
		after('tieBreakJudgeCorrect', function () { return gv.TieBreakWinner ? ['tb', seatName(gv.TieBreakWinner) + ' trả lời đúng câu hỏi phụ', { seat: gv.TieBreakWinner }] : null; });
		after('tieBreakJudgeWrong', function () { var out = gv.TieBreakEliminated[gv.TieBreakEliminated.length - 1]; return out ? ['tb', seatName(out) + ' sai câu hỏi phụ - bị loại khỏi câu', { seat: out }] : null; });
		after('switchRound', function (r) { return ['round', 'Chuyển sang ' + (gv.RoundNames[r] || r)]; });
	}

	/* ---------- the question log ---------- */

	function openQuestion(round, label, text, answer, extra) {
		var q = Object.assign({ id: Date.now().toString(36) + '-' + (++qSerial), t: Date.now(), round: round, label: label, text: text || '', answer: answer || '', results: [] }, extra || {});
		gv.QuestionLog.push(q);
		if (gv.QuestionLog.length > MAX_QUESTIONS) { gv.QuestionLog.splice(0, gv.QuestionLog.length - MAX_QUESTIONS); }
		return q;
	}
	/* the latest record of `round` that `ok` accepts */
	function findQuestion(round, ok) {
		for (var i = gv.QuestionLog.length - 1; i >= 0; i--) {
			var q = gv.QuestionLog[i];
			if (q.round === round && (!ok || ok(q))) { return q; }
		}
		return null;
	}
	function setResult(q, seat, verdict, extra) {
		if (!q || !seat) { return; }
		var r = q.results.filter(function (x) { return x.seat === seat; })[0];
		if (!r) { r = { seat: seat }; q.results.push(r); q.results.sort(function (a, b) { return a.seat - b.seat; }); }
		Object.assign(r, { verdict: verdict }, extra || {});
	}
	/* run `name` and look at the game before / after it; `this` holds s0 / s1 (every seat's score) */
	function watch(name, before, after) {
		var fn = window[name];
		if (typeof fn !== 'function') { return; }
		window[name] = function () {
			var ctx = { s0: scores() };
			try { if (before) { before.apply(ctx, arguments); } } catch (e) { /* never break the game for the log */ }
			var r = fn.apply(this, arguments);
			try { ctx.s1 = scores(); after.apply(ctx, arguments); } catch (e) { console.warn('[QuestionLog]', name, e); }
			return r;
		};
	}
	function moved(ctx, seat) { return (ctx.s1[seat - 1] || 0) - (ctx.s0[seat - 1] || 0); }

	function wrapQuestions() {
		/* Khởi động */
		watch('khoiDongShowQuestion', null, function () {
			var common = gv.KhoiDongMode === 'common';
			var label = (common ? 'Lượt chung' + (gv.KhoiDongTurn ? ' ' + gv.KhoiDongTurn : '') : 'Lượt riêng · ' + seatName(gv.KhoiDongSeat)) + ' · Câu ' + gv.KhoiDongQuestionIndex;
			openQuestion('kd', label, gv.KhoiDongCurrentQuestion, gv.KhoiDongCurrentAnswer, common ? null : { seat: gv.KhoiDongSeat });
		});
		function kdOwn(right) {
			return function () {
				if (!gv.KhoiDongSeat) { return; }
				setResult(findQuestion('kd'), gv.KhoiDongSeat, right ? 'right' : 'wrong', { delta: moved(this, gv.KhoiDongSeat) });
			};
		}
		watch('khoiDongJudgeIndividualCorrect', null, kdOwn(true));
		watch('khoiDongJudgeIndividualWrong', null, kdOwn(false));
		watch('khoiDongJudgeCommonCorrect', function () { this.seat = gv.KhoiDongBuzzSeat; this.done = gv.IsKhoiDongQuestionResolved; }, function () {
			if (!this.done && this.seat !== null && gv.IsKhoiDongQuestionResolved) { setResult(findQuestion('kd'), this.seat, 'right', { delta: moved(this, this.seat) }); }
		});
		watch('khoiDongJudgeCommonWrong', function () { this.seat = gv.KhoiDongBuzzSeat; this.done = gv.IsKhoiDongQuestionResolved; }, function () {
			if (this.done) { return; }
			var q = findQuestion('kd');
			if (this.seat !== null && this.seat !== undefined) { setResult(q, this.seat, 'wrong', { delta: moved(this, this.seat) }); }
			else if (q) { q.nobody = true; }   /* nobody buzzed */
		});

		/* Vượt chướng ngại vật */
		watch('vcnvRevealQuestion', null, function () {
			var n = gv.VcnvCurrentRow, src = typeof vcnvQuestionFor === 'function' ? vcnvQuestionFor(n) : {};
			openQuestion('vcnv', n == VCNV_CENTER ? 'Ô trung tâm' : 'Hàng ngang ' + n, gv.VcnvCurrentQuestion, (src && src.answer) || '', { row: n });
		});
		watch('vcnvGradeRow', function () { this.row = gv.VcnvCurrentRow; this.out = gv.VcnvEliminated.slice(); }, function () {
			var n = this.row, r = vcnvRow(n), q = findQuestion('vcnv', function (x) { return x.row === n; });
			if (!r || !q) { return; }
			var ctx = this;
			gv.Players.forEach(function (p) {
				var ans = (r.answers && r.answers[p.seat]) || '';
				if (ctx.out.indexOf(p.seat) !== -1) { setResult(q, p.seat, 'out', { answer: ans }); return; }
				var right = r.correctSeats.indexOf(p.seat) !== -1;
				setResult(q, p.seat, right ? 'right' : (ans ? 'wrong' : 'none'), { answer: ans, delta: moved(ctx, p.seat) });
			});
		});
		watch('vcnvGuessCorrect', function (seat) { this.ok = vcnvInQueue(seat); }, function (seat) {
			if (!this.ok || gv.VcnvSolvedBy !== seat) { return; }
			setResult(openQuestion('vcnv', 'Chướng ngại vật', 'Trả lời chướng ngại vật', gv.VcnvKeyword, { cnv: true }), seat, 'right', { delta: moved(this, seat) });
		});
		watch('vcnvGuessAllWrong', function () { this.queue = gv.VcnvQueue.filter(function (s) { return gv.VcnvEliminated.indexOf(s) === -1; }); }, function () {
			if (!this.queue.length) { return; }
			var q = openQuestion('vcnv', 'Chướng ngại vật', 'Trả lời chướng ngại vật', gv.VcnvKeyword, { cnv: true }), ctx = this;
			this.queue.forEach(function (s) { setResult(q, s, 'wrong', { delta: moved(ctx, s) }); });
		});

		/* Tăng tốc */
		watch('tangTocShowQuestion', null, function (index) {
			openQuestion('tt', 'Câu ' + index, gv.TangTocQuestion, gv.TangTocAnswer, { index: index });
		});
		watch('tangTocGradeQuestion', null, function () {
			var index = gv.TangTocIndex, q = findQuestion('tt', function (x) { return x.index === index; }), ctx = this;
			if (!q) { return; }
			gv.Players.forEach(function (p) {
				var ans = gv.TangTocAnswers[p.seat] || '', time = gv.TangTocTimes[p.seat];
				var right = gv.TangTocCorrectSeats.indexOf(p.seat) !== -1;
				setResult(q, p.seat, right ? 'right' : (ans ? 'wrong' : 'none'), { answer: ans, time: typeof time === 'number' ? time : null, delta: moved(ctx, p.seat) });
			});
		});

		/* Về đích */
		watch('veDichLoadQuestion', null, function (index) {
			openQuestion('vd', seatName(gv.VeDichSeat) + ' · Câu ' + index + ' · ' + gv.VeDichValue + ' điểm', gv.VeDichQuestion, gv.VeDichAnswer, { seat: gv.VeDichSeat, index: index, value: gv.VeDichValue });
		});
		function vdOwn(right) {
			return function () {
				var seat = gv.VeDichSeat;
				setResult(findQuestion('vd'), seat, right ? 'right' : 'wrong', { delta: moved(this, seat), star: typeof veDichStarred === 'function' && veDichStarred() });
			};
		}
		watch('veDichAnswerCorrect', null, vdOwn(true));
		watch('veDichAnswerWrong', null, vdOwn(false));
		function vdSteal(right) {
			return function () {
				var q = findQuestion('vd'), thief = gv.VeDichStealSeat, owner = gv.VeDichSeat;
				if (!q || !thief) { return; }
				setResult(q, thief, right ? 'right' : 'wrong', { steal: true, delta: moved(this, thief) });
				var own = q.results.filter(function (x) { return x.seat === owner; })[0];
				if (own && moved(this, owner)) { own.delta = (own.delta || 0) + moved(this, owner); }   /* a right steal also costs the contestant on stage */
			};
		}
		watch('veDichStealCorrect', null, vdSteal(true));
		watch('veDichStealWrong', null, vdSteal(false));

		/* Câu hỏi phụ */
		watch('tieBreakNextQuestion', function () { this.index = gv.TieBreakQuestionIndex; }, function () {
			if (gv.TieBreakQuestionIndex !== this.index) { openQuestion('tb', 'Câu ' + gv.TieBreakQuestionIndex, gv.TieBreakCurrentQuestion, gv.TieBreakCurrentAnswer); }
		});
		watch('tieBreakJudgeCorrect', function () { this.seat = gv.TieBreakBuzzSeat; }, function () {
			if (this.seat !== null && gv.TieBreakWinner === this.seat) { setResult(findQuestion('tb'), this.seat, 'right'); }
		});
		watch('tieBreakJudgeWrong', function () { this.seat = gv.TieBreakBuzzSeat; }, function () {
			if (this.seat !== null && this.seat !== undefined) { setResult(findQuestion('tb'), this.seat, gv.TieBreakLastResult === 'early' ? 'early' : 'wrong'); }
		});
	}

	/* the host corrects a record from the report: { id, results: [{ seat, verdict, answer }], note }.
	 * The first version is kept (edit.orig); a score never changes here. */
	gv.Commands.editQuestion = function (args) {
		var q = (gv.QuestionLog || []).filter(function (x) { return x.id === (args && args.id); })[0];
		if (!q) { return; }
		if (!q.edit) { q.edit = { orig: { results: JSON.parse(JSON.stringify(q.results)), note: q.note || '', nobody: !!q.nobody }, count: 0 }; }
		var VERDICTS = ['right', 'wrong', 'none', 'out', 'early'];
		(args.results || []).forEach(function (r) {
			var seat = Number(r.seat);
			if (!gv.getPlayer(seat) || VERDICTS.indexOf(r.verdict) === -1) { return; }
			var cur = q.results.filter(function (x) { return x.seat === seat; })[0];
			setResult(q, seat, r.verdict, { answer: String(r.answer === undefined ? (cur && cur.answer) || '' : r.answer).slice(0, 200) });
		});
		if (typeof args.note === 'string') { q.note = args.note.slice(0, 500); }
		q.nobody = false;
		q.edit.count += 1;
		q.edit.at = Date.now();
		log('edit', 'Sửa biên bản: ' + (ROUND[q.round] || q.round) + ' · ' + q.label);
	};

	/* ---------- undo / the whole log (control panel commands) ---------- */

	gv.Commands.undoScore = function () {
		var t = gv.ScoreUndo.pop();
		if (!t) { return; }
		t.changes.slice().reverse().forEach(function (c) { rawSet(c.seat, c.before); });
		/* Khởi động: the same question still on screen -> it may be judged again */
		if (t.round === 'kd' && gv.CurrentRound === 'kd' && gv.KhoiDongSequenceCounter == 4 && gv.KhoiDongQuestionIndex === t.kd.index) {
			gv.IsKhoiDongQuestionResolved = t.kd.resolved;
			gv.KhoiDongLastResult = t.kd.result;
		}
		log('undo', 'Hoàn tác điểm: ' + t.label + ' (' + t.changes.map(function (c) { var d = c.after - c.before; return seatName(c.seat) + ' ' + (d > 0 ? '−' : '+') + Math.abs(d); }).join(', ') + ')');
	};
	gv.Commands.requestLog = function () { sendFull = true; };

	/* what the panel is told (StateSync.js buildSnapshot) */
	gv.matchLogForPanel = function () {
		var last = gv.ScoreUndo[gv.ScoreUndo.length - 1];
		var out = {
			undo: last ? { label: last.label, changes: last.changes.map(function (c) { return { seat: c.seat, delta: c.after - c.before }; }) } : null,
			count: gv.MatchLog.length,
			tail: gv.MatchLog.slice(-20)
		};
		if (sendFull) { out.full = gv.MatchLog.slice(); out.questions = gv.QuestionLog.slice(); sendFull = false; }
		return out;
	};

	/* GameSave.js keeps / gives back the log */
	gv.matchLogSave = function () { return gv.MatchLog.slice(-400); };
	gv.matchLogRestore = function (list) { if (Array.isArray(list)) { gv.MatchLog = list.slice(-MAX_LOG); } };
	gv.questionLogSave = function () { return gv.QuestionLog.slice(-MAX_QUESTIONS); };
	gv.questionLogRestore = function (list) { if (Array.isArray(list)) { gv.QuestionLog = list.slice(-MAX_QUESTIONS); } };

	document.addEventListener('DOMContentLoaded', function () {
		wrapKeys();
		wrapEvents();
		wrapQuestions();
		/* commands are all registered by now (PanelCommands, Recovery, GameSave...) */
		setTimeout(wrapCommands, 0);
	});
})(window.GameVariables);
