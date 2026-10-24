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
 */
(function (gv) {
	var MAX_LOG = 600, MAX_UNDO = 40;
	var ROUND = { kd: 'KĐ', vcnv: 'VCNV', tt: 'TT', vd: 'VĐ', tb: 'Câu phụ' };
	var KEY = {
		ArrowUp: 'đúng', ArrowDown: 'sai', ArrowRight: '→', ArrowLeft: '←', ' ': 'đồng hồ 3 s', Backspace: 'xoá chuông',
		'1': 'phím 1', '2': 'phím 2', '3': 'phím 3', '4': 'phím 4', '0': 'phím 0', z: '+10 tay', x: '−5 tay', Z: '+10 tay', X: '−5 tay'
	};
	var CMD = { setScore: 'sửa điểm', vcnvSetAnswers: 'đáp án VCNV', ttSetAnswers: 'đáp án Tăng tốc', restoreProgress: 'phục hồi tiến trình', restoreSaved: 'khôi phục bản lưu' };

	gv.MatchLog = [];
	gv.ScoreUndo = [];
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
		if (sendFull) { out.full = gv.MatchLog.slice(); sendFull = false; }
		return out;
	};

	/* GameSave.js keeps / gives back the log */
	gv.matchLogSave = function () { return gv.MatchLog.slice(-400); };
	gv.matchLogRestore = function (list) { if (Array.isArray(list)) { gv.MatchLog = list.slice(-MAX_LOG); } };

	document.addEventListener('DOMContentLoaded', function () {
		wrapKeys();
		wrapEvents();
		/* commands are all registered by now (PanelCommands, Recovery, GameSave...) */
		setTimeout(wrapCommands, 0);
	});
})(window.GameVariables);
