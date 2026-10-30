/*
 * Olympia Controller - the game's automatic save (stage page) - Phase 6.
 *
 * While a game is under way the stage keeps its progress: scores, names, the step of every round,
 * the VCNV rows (with the players' written answers), who has played Về đích, the package and the
 * star, the Câu hỏi phụ... - in the room (rooms.game_state, migrations/0006: owner and stage only)
 * or, with no room, in this browser (localStorage). At most one write per SAVE_EVERY_MS.
 * A page with nothing played never writes, so a stage reopened after a crash cannot wipe the save.
 *
 * That reopened stage reads the save (SavedGame) and tells the control panel about it
 * (snapshot.savedGame); "Khôi phục từ bản lưu tự động" (RecoveryPanel.js) sends restoreSaved.
 * The save is turned into the emergency recovery's landing points (Recovery.js), so the show
 * resumes at a SAFE step of the round it was in, with every score and row exactly as saved:
 *
 *   kd    the contestant playing, from the question that was on screen (common turn: same)
 *   vcnv  the board; rows already graded stay graded, a row that was being asked is asked again
 *   tt    the question that was being played (once graded: the next one)
 *   vd    the contestant playing, from the question that was on the bar (answered: the next one)
 *   tb    the Câu hỏi phụ from the question that was being asked (decided: finished)
 * A clock that was running is not resumed: the host starts it again with the usual key.
 */
(function (gv) {
	var SAVE_EVERY_MS = 2000;
	var LOCAL_KEY = 'olympia.gameSave';

	function room() { return gv.Sync && gv.Sync.room; }
	function client() { return window.OlympiaAuth && window.OlympiaAuth.client; }

	function buildSave() {
		return {
			v: 1,
			at: Date.now(),
			matchId: gv.Sync.matchId ? gv.Sync.matchId() : (gv.MatchId || null),
			round: gv.CurrentRound,
			players: gv.Players.map(function (p) { return { seat: p.seat, fullName: p.fullName, score: p.score, kdDone: !!p.kdDone }; }),
			kd: {
				counter: gv.KhoiDongSequenceCounter, mode: gv.KhoiDongMode, seat: gv.KhoiDongSeat, index: gv.KhoiDongQuestionIndex, turn: gv.KhoiDongTurn || 0,
				own: { wrong: gv.KdOwnWrong || 0, streak: gv.KdOwnStreak || 0, bonus: gv.KdOwnBonus || 0 },   /* Luật rừng */
				turnWrong: Object.assign({}, gv.KdTurnWrong || {})
			},
			vcnv: {
				counter: gv.VcnvSequenceCounter,
				rows: (gv.VcnvRows || []).map(function (r) { return { status: r.status, correctSeats: (r.correctSeats || []).slice(), answers: Object.assign({}, r.answers || {}) }; }),
				eliminated: (gv.VcnvEliminated || []).slice(),
				solved: !!gv.IsVcnvSolved, solvedBy: gv.VcnvSolvedBy
			},
			tt: { counter: gv.TangTocSequenceCounter, index: gv.TangTocIndex },
			vd: {
				counter: gv.VeDichSequenceCounter, done: (gv.VeDichDone || []).slice(), seat: gv.VeDichSeat,
				qIndex: gv.VeDichQuestionIndex, values: (gv.VeDichValues || []).slice(), star: gv.VeDichStar, starUsed: !!gv.IsVeDichStarUsed,
				order: (gv.VeDichOrder || []).slice(), orderManual: !!gv.IsVeDichOrderManual
			},
			tb: { counter: gv.TieBreakSequenceCounter, seats: (gv.TieBreakSeats || []).slice(), index: gv.TieBreakQuestionIndex, winner: gv.TieBreakWinner },
			log: gv.matchLogSave ? gv.matchLogSave() : [],   /* MatchLog.js */
			/* a clock running at save time (seconds gone), to resume it */
			clock: (function () {
				var t = gv.TimerState;
				if (!t || !(t.running || t.paused) || !t.wallStart) { return null; }
				var gone = t.paused ? t.pausedElapsed : (Date.now() - t.wallStart) / 1000;
				return { label: t.label, gone: Math.round(gone * 10) / 10, duration: t.duration };
			})(),
			vcnvRow: gv.VcnvCurrentRow,
			ttAnswers: Object.assign({}, gv.TangTocAnswers), ttTimes: Object.assign({}, gv.TangTocTimes)
		};
	}

	/* "Vượt chướng ngại vật · 2 hàng đã mở · 1. An 40 · 2. Bình 30 ..." - for the panel */
	var ROUND_NAMES = { kd: 'Khởi động', vcnv: 'Vượt chướng ngại vật', tt: 'Tăng tốc', vd: 'Về đích', tb: 'Câu hỏi phụ' };
	function describe(s) {
		var where = ROUND_NAMES[s.round] || s.round;
		if (s.round === 'kd') { where += s.kd.turn ? ' · lượt ' + s.kd.turn + ', câu ' + (s.kd.index || 1) : (s.kd.mode === 'common' ? ' · lượt chung, câu ' + (s.kd.index || 1) : (s.kd.seat ? ' · lượt riêng ghế ' + s.kd.seat + ', câu ' + (s.kd.index || 1) : ' · lượt riêng')); }
		if (s.round === 'vcnv') { where += ' · ' + s.vcnv.rows.slice(0, 4).filter(function (r) { return r.status === 'correct' || r.status === 'wrong'; }).length + ' hàng đã chấm' + (s.vcnv.solved ? ' · đã giải' : ''); }
		if (s.round === 'tt') { where += ' · câu ' + (s.tt.index || 1); }
		if (s.round === 'vd') { where += ' · ' + s.vd.done.length + ' / 4 đã thi' + (s.vd.seat ? ', đang thi ghế ' + s.vd.seat : ''); }
		if (s.round === 'tb') { where += ' · câu ' + Math.max(1, s.tb.index || 0); }
		return where + ' · ' + s.players.map(function (p) { return p.seat + ': ' + p.score; }).join(', ');
	}

	/* ---------- writing ---------- */

	var timer = null, lastKey = '', lastAt = 0, ending = false;
	function write() {
		timer = null;
		if (ending) { return; }   /* endMatch: the save is being wiped */
		if (typeof recoveryAllowed === 'function' && recoveryAllowed()) { return; }   /* nothing played on this page */
		var s = buildSave();
		var key = JSON.stringify(Object.assign({}, s, { at: 0 }));
		if (key === lastKey) { return; }
		lastKey = key; lastAt = Date.now();
		if (room()) {
			if (gv.Sync.status !== 'online' || !client()) { lastKey = ''; return; }
			client().rpc('save_game_state', { p_code: room(), p_state: s }).then(function (r) {
				if (r.error) { lastKey = ''; if (r.error.code !== 'PGRST202') { console.warn('[GameSave] save failed', r.error.message); } }
			});
		}
		else {
			try { localStorage.setItem(LOCAL_KEY, JSON.stringify(s)); } catch (e) { /* full / blocked */ }
		}
	}
	function schedule() {
		if (timer) { return; }
		timer = setTimeout(write, Math.max(0, SAVE_EVERY_MS - (Date.now() - lastAt)));
	}

	/* ---------- reading (a freshly opened stage) ---------- */

	gv.SavedGame = null;   /* { state, at } */

	async function load() {
		if (room()) {
			if (!client()) { return; }
			var r = await client().rpc('load_game_state', { p_code: room() });
			if (!r.error && r.data && r.data.state && r.data.state.v === 1) { gv.SavedGame = { state: r.data.state, at: Date.parse(r.data.at) || r.data.state.at }; }
		}
		else {
			try {
				var s = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
				if (s && s.v === 1) { gv.SavedGame = { state: s, at: s.at }; }
			} catch (e) { /* ignore */ }
		}
		if (gv.SavedGame) { console.log('[GameSave] a save from ' + new Date(gv.SavedGame.at).toLocaleTimeString('vi-VN') + ': ' + describe(gv.SavedGame.state)); }
		gv.changed();
	}

	/* what the panel is told (StateSync.js buildSnapshot) */
	gv.savedGameInfo = function () {
		var sg = gv.SavedGame;
		if (!sg) { return null; }
		var c = resumableClock(sg.state);
		return { at: sg.at, text: describe(sg.state), clock: c ? { left: Math.round((c.duration - c.gone) * 10) / 10, round: sg.state.round } : null };
	};

	/* a clock in the save that this page knows how to resume, or null */
	function resumableClock(s) {
		var c = s.clock;
		if (!c || !(c.duration - c.gone > 1)) { return null; }
		if (s.round === 'vcnv' && c.label === 'vcnv_row' && s.vcnv.counter == 5 && s.vcnvRow) { return c; }
		if (s.round === 'tt' && c.label === 'tt_q' + s.tt.index && s.tt.counter == 3) { return c; }
		if (s.round === 'vd' && c.label === 'vd_answer' && s.vd.counter == 6) { return c; }
		if (s.round === 'tb' && c.label === 'tb_q' + s.tb.index && s.tb.counter == 4) { return c; }
		return null;
	}

	/* after the landing: the question that was being timed comes back up and its clock goes on */
	function resumeClock(s) {
		var c = resumableClock(s), g = gv;
		if (!c) { return; }
		if (s.round === 'vcnv') {
			var n = s.vcnvRow, saved = s.vcnv.rows[n - 1] || {};
			vcnvSelectRow(n);
			vcnvRevealQuestion();
			var row = g.VcnvRows[n - 1];
			if (row) { row.answers = Object.assign({}, saved.answers || {}); row.correctSeats = (saved.correctSeats || []).slice(); }
			vcnvStartTimer(c.gone);
		}
		else if (s.round === 'tt') {
			if (g.TangTocSequenceCounter != 2 || g.TangTocIndex !== s.tt.index) { return; }
			tangTocSetAnswers(s.ttAnswers || {}, s.ttTimes || {});
			tangTocStartTimer(c.gone);
		}
		else if (s.round === 'vd') {
			if (g.VeDichSequenceCounter != 4) { return; }
			veDichRevealQuestion();
			veDichStartTimer(c.gone);
		}
		else if (s.round === 'tb') {
			if (g.TieBreakSequenceCounter != 1) { return; }
			tieBreakOpenQuestionBar();
			tieBreakNextQuestion();
			tieBreakStartTimer(c.gone);
		}
		console.log('[GameSave] clock resumed at ' + c.gone + ' s of ' + c.duration);
	}

	/* ---------- the save -> the recovery's landing points ---------- */

	function restoreSaved(s) {
		var g = gv;
		if (s.matchId) { g.MatchId = s.matchId; }   /* the same match goes on: viewers keep their answers */
		var round = ROUND_NAMES[s.round] ? s.round : 'kd';
		stopAllSounds();
		hideTitleCard();
		clearBuzzers();
		/* names (a stage on another machine may not know the names typed on the panel) + scores */
		s.players.forEach(function (sp) {
			var p = g.getPlayer(sp.seat);
			if (!p) { return; }
			if (sp.fullName && sp.fullName !== p.fullName) { p.fullName = sp.fullName; }
			setScore(sp.seat, sp.score);
		});
		refreshContestantBars();
		refreshBoardScreen();
		recoveryFinishEarlierRounds(round);
		/* rounds already over keep their exact end state */
		if (round !== 'kd') { s.players.forEach(function (sp) { var p = g.getPlayer(sp.seat); if (p) { p.kdDone = true; } }); }
		if (['tt', 'vd', 'tb'].indexOf(round) !== -1) {
			g.VcnvEliminated = s.vcnv.eliminated.slice();
			g.IsVcnvSolved = s.vcnv.solved; g.VcnvSolvedBy = s.vcnv.solvedBy;
		}

		if (round === 'kd') { restoreKdFromSave(s.kd, s.players, s.clock); }
		else if (round === 'vcnv') { restoreVcnvFromSave(s.vcnv); }
		else if (round === 'tt') { restoreTtFromSave(s.tt); }
		else if (round === 'vd') { restoreVdFromSave(s.vd); }
		else { restoreTbFromSave(s.tb); }
		g.CurrentRound = round;
		refreshContestantBars();
		if (gv.matchLogRestore && s.log) { gv.matchLogRestore(s.log); }
		g.IsProgressRestored = true;
		console.log('[GameSave] resumed from the save: ' + describe(s));
	}

	function restoreKdFromSave(kd, players, clock) {
		var g = gv, sizes = g.kdCommonTurns();
		if (sizes && (g.Rules === 'o23' || kd.mode === 'common')) {   /* O23 / Luật rừng: the common turn it was in (a finished turn: the next one) */
			var turn = kd.turn || 1;
			if (kd.counter == 6) { khoiDongResetO23(sizes.length); g.KhoiDongSequenceCounter = 6; return; }   /* all done: Left -> VCNV */
			if (kd.counter == 5 || kd.counter <= 1) { khoiDongResetO23(kd.counter == 5 ? turn + 1 : 1); return; }
			restoreKhoiDong({ mode: 'common', turn: turn, question: kd.counter == 4 ? kd.index : 1 });
			if (kd.turnWrong) { g.KdTurnWrong = Object.assign({}, kd.turnWrong); }   /* Luật rừng: wrongs so far in this turn */
			return;
		}
		if (kd.mode === 'common') {
			restoreKhoiDong({ mode: 'common', question: kd.counter == 4 ? kd.index : Math.max(1, kd.index + (kd.counter >= 5 ? 1 : 0)) });
			if (kd.counter == 6) { g.KhoiDongStartIndex = null; g.KhoiDongSequenceCounter = 6; }   /* common turn over: Left -> VCNV */
			return;
		}
		var done = players.filter(function (p) { return p.kdDone; }).map(function (p) { return p.seat; });
		var playing = (kd.counter >= 2 && kd.counter <= 4) ? kd.seat : null;
		/* Luật rừng: the playing contestant's wrongs / streak / bonus and the clock (a finished turn: the next one starts clean) */
		var own = playing ? Object.assign({}, kd.own || {}, { gone: clock && clock.label === 'kd_turn' && kd.counter == 4 ? clock.gone : 0 }) : {};
		restoreKhoiDong({ mode: 'individual', done: done, seat: playing, question: kd.counter == 4 ? kd.index : 1, own: own });
	}

	function restoreVcnvFromSave(v) {
		var g = gv;
		var st = function (r) { return r && (r.status === 'correct' || r.status === 'wrong') ? r.status : 'closed'; };   /* a row being asked: asked again */
		restoreVcnv({ rows: v.rows.slice(0, 4).map(st), center: st(v.rows[4]), eliminated: v.eliminated });
		v.rows.forEach(function (r, i) {
			var row = g.VcnvRows[i];
			if (row && st(r) !== 'closed') { row.correctSeats = r.correctSeats.slice(); row.answers = Object.assign({}, r.answers); }
		});
		if (v.solved || v.counter >= 11) {
			g.IsVcnvSolved = v.solved; g.VcnvSolvedBy = v.solvedBy;
			vcnvRevealEverything();                                   /* everything open, nothing awarded again */
			if (v.counter == 12) { vcnvFinishRound(); }               /* graphics off: Left -> Tăng tốc */
		}
	}

	function restoreTtFromSave(t) {
		var g = gv, count = g.TangTocCount || 4;
		var next = (t.counter == 5 || t.counter == 6) ? t.index + 1 : Math.max(1, t.index);   /* graded: points are in the scores */
		if (t.counter <= 1) { tangTocReset(); g.CurrentRound = 'tt'; return; }               /* round not started: Left shows the title */
		if (t.counter >= 7 || next > count) { tangTocReset(); g.TangTocSequenceCounter = 8; return; }   /* over: Left -> Về đích */
		restoreTangToc({ question: next });
	}

	function restoreVdFromSave(d) {
		var g = gv;
		if (d.counter <= 1) { veDichReset(); return; }
		var done = d.done.slice();
		var question = d.counter == 9 ? d.qIndex + 1 : d.qIndex;
		var mid = d.counter >= 4 && d.counter <= 9 && d.values.length === VE_DICH_PICKS;
		if (d.seat && mid && question > VE_DICH_PICKS && done.indexOf(d.seat) === -1) { done.push(d.seat); mid = false; }   /* the last question was decided */
		var args = { done: done, seat: (d.counter >= 2 && d.counter <= 9 && done.indexOf(d.seat) === -1) ? d.seat : null, order: d.orderManual ? d.order : null };
		if (mid && args.seat) {
			args.midTurn = { values: d.values, question: Math.max(1, question), star: d.star ? d.star : (d.starUsed ? 'used' : null) };
		}
		restoreVeDich(args);
		if (d.counter == 12) { veDichFinishRound(); }
	}

	function restoreTbFromSave(t) {
		var g = gv;
		if (t.counter == 0) { tieBreakReset(); return; }
		if (t.winner !== null && t.winner !== undefined) {               /* decided: the round is over */
			tieBreakReset();
			g.TieBreakSeats = t.seats.slice();
			g.TieBreakQuestionIndex = t.index;
			g.TieBreakWinner = t.winner;
			g.TieBreakLastResult = 'correct';
			g.TieBreakSequenceCounter = 6;
			return;
		}
		var question = (t.counter == 5) ? t.index + 1 : Math.max(1, t.index);
		if (question > tieBreakQuestionLimit()) {                       /* every question asked, nobody right */
			restoreTieBreak({ seats: t.seats, question: tieBreakQuestionLimit() });
			g.TieBreakQuestionIndex = tieBreakQuestionLimit();
			g.TieBreakLastResult = 'none';
			g.TieBreakSequenceCounter = 5;
			return;
		}
		restoreTieBreak({ seats: t.seats, question: question });
	}

	/* args.resumeClock: also bring back the question whose clock was running, and run it on */
	gv.Commands.restoreSaved = function (args) {
		if (!gv.SavedGame || !(typeof recoveryAllowed === 'function' && recoveryAllowed())) { console.warn('[GameSave] refused - only on a stage with nothing played yet'); return; }
		try {
			restoreSaved(gv.SavedGame.state);
			if (args && args.resumeClock) { resumeClock(gv.SavedGame.state); }
		}
		catch (e) { console.error('[GameSave] could not resume from the save', e); }
	};

	/* a running clock changes nothing by itself: keep its position in the save fresh */
	setInterval(function () { var t = gv.TimerState; if (t && t.running) { schedule(); } }, SAVE_EVERY_MS);

	/* ---------- start ---------- */

	var wrapped = gv.changed;
	gv.changed = function () { wrapped(); schedule(); };

	/* Init.js, right after Sync.init: read the save once - in a room when it is ours (online) */
	gv.startGameSave = function () {
		var loaded = false;
		function once() { if (!loaded) { loaded = true; load().catch(function (e) { console.warn('[GameSave] could not read the save', e); }); } }
		if (!room()) { once(); return; }
		if (gv.Sync.status === 'online') { once(); }
		gv.Sync.on('status', function (st) { if (st === 'online') { once(); } });
	};

	/* "Kết thúc trận đấu" on the control panel: stop every sound (the screens too), wipe the
	 * automatic save, then reload this engine - it comes back with a fresh match, nothing to
	 * resume. The wait lets a save already on its way land before the wipe. */
	gv.Commands.endMatch = function () {
		if (ending) { return; }
		ending = true;
		if (timer) { clearTimeout(timer); timer = null; }
		if (typeof stopAllSounds === 'function') { stopAllSounds(); }
		console.log('[GameSave] ending the match');
		setTimeout(async function () {
			if (room()) {
				if (client()) { try { await client().rpc('clear_game_state', { p_code: room() }); } catch (e) { /* the reload still ends the match */ } }
			}
			else { try { localStorage.removeItem(LOCAL_KEY); } catch (e) { /* blocked */ } }
			location.reload();
		}, SAVE_EVERY_MS + 500);
	};
})(window.GameVariables);
