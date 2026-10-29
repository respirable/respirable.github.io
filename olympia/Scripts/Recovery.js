/*
 * Olympia Controller - "Phục hồi tiến trình khẩn cấp" (emergency progress recovery), stage side.
 *
 * After a crash the stage page starts from zero. Before Khởi động has begun, the room's manager
 * can tell it where the show was (control.html, Scripts/RecoveryPanel.js) and it jumps there:
 * scores, and a SAFE point inside one round from which the host carries on with the usual keys.
 *
 *   kd    individual turn: who has finished, whose turn it is, from which question
 *         common turn: from which question                  -> lands on "contestant called"
 *                                                              (Left: graphics, Right: that question)
 *   vcnv  each row / the centre: not opened, right, wrong; who is out of the obstacle
 *                                                           -> lands on the board
 *   tt    from which question                               -> lands on that question
 *   vd    who has ALREADY played their turn (required), who plays now (default: playing order),
 *         and - if the crash was mid-turn - the package, the next question, the star
 *                                                           -> lands on "called to the stage", or
 *                                                              on the question group (empty bar)
 *   tb    Câu hỏi phụ: who plays (default: the seats with the highest score), from which question
 *                                                           -> lands on "seats chosen"
 *                                                              (Left: graphics, Right: that question)
 * Rounds before the chosen one are marked finished, so F1-F5 do not replay them.
 *
 * gv.Commands.restoreProgress(args) - args documented on each restore* function below.
 */

/* only before anything has been played (a freshly opened stage) */
function recoveryAllowed() {
	var g = window.GameVariables;
	return g.CurrentRound === 'kd' && g.KhoiDongSequenceCounter == 0 && g.KhoiDongMode === 'individual' &&
		g.VcnvSequenceCounter == 0 && g.TangTocSequenceCounter == 0 && g.VeDichSequenceCounter == 0 &&
		g.TieBreakSequenceCounter == 0 &&
		!g.Players.some(function (p) { return p.kdDone; });
}

function recoverySeat(v) { var s = parseInt(v, 10); return window.GameVariables.getPlayer(s) ? s : null; }
function recoverySeats(list) {
	var out = [];
	(list || []).forEach(function (v) { var s = recoverySeat(v); if (s !== null && out.indexOf(s) === -1) { out.push(s); } });
	return out;
}
function recoveryInt(v, lo, hi, dflt) { var n = parseInt(v, 10); return (n >= lo && n <= hi) ? n : dflt; }

/* the rounds before `round` count as played */
function recoveryFinishEarlierRounds(round) {
	var g = window.GameVariables;
	var order = ['kd', 'vcnv', 'tt', 'vd', 'tb'];
	var at = order.indexOf(round);
	if (at > 0) {
		g.Players.forEach(function (p) { p.kdDone = true; });
		g.KhoiDongMode = 'common';
		g.KhoiDongSeat = null;
		g.KhoiDongQuestionCount = g.Timings.KD_COMMON_QUESTIONS;
		khoiDongResetQuestionState();
		g.KhoiDongSequenceCounter = 6;
	}
	if (at > 1) { g.VcnvSequenceCounter = 12; }
	if (at > 2) { g.TangTocSequenceCounter = 8; }
	if (at > 3) {
		g.VeDichDone = g.Players.map(function (p) { return p.seat; });
		g.VeDichSequenceCounter = 12;
	}
}

/* tb: { seats: [seats] (empty: the seats with the highest score), question: 1-3 } */
function restoreTieBreak(a) {
	var g = window.GameVariables;
	tieBreakReset();
	g.CurrentRound = 'tb';
	var seats = recoverySeats(a.seats);
	g.TieBreakSeats = (seats.length >= 2 ? seats : tieBreakTopSeats()).sort();
	g.TieBreakQuestionIndex = recoveryInt(a.question, 1, tieBreakQuestionLimit(), 1) - 1;   /* the next Right puts this question */
	g.TieBreakEliminated = [];
	g.TieBreakWinner = null;
	g.TieBreakSequenceCounter = 1;                /* Left: timer bar + bars; Right: question N */
	tieBreakRefreshBars();
}

/* kd: { mode: 'individual'|'common', done: [seats], seat, question } */
function restoreKhoiDong(a) {
	var g = window.GameVariables;
	if (g.Rules === 'o23') {                       /* Olympia 23: turn a.turn (1-3), from question a.question */
		var turn = recoveryInt(a.turn, 1, g.RulesO23.KD_TURNS.length, 1);
		khoiDongResetO23(turn);
		khoiDongO23Ready(turn);                   /* the turn's questions; plays kd_ready */
		g.KhoiDongStartIndex = recoveryInt(a.question, 1, g.KhoiDongQuestionCount, 1);
		g.KhoiDongSequenceCounter = 2;            /* Left: plain bar + label + bars; Right: question N */
		return;
	}
	khoiDongReset(null);
	if (a.mode === 'common') {
		g.Players.forEach(function (p) { p.kdDone = true; });
		g.KhoiDongMode = 'common';
		g.KhoiDongSeat = null;
		g.KhoiDongQuestionCount = g.Timings.KD_COMMON_QUESTIONS;
		g.KhoiDongStartIndex = recoveryInt(a.question, 1, g.KhoiDongQuestionCount, 1);
		khoiDongResetQuestionState();
		g.KhoiDongSequenceCounter = 2;            /* Left: plain bar + bars; Right: question N */
		return;
	}
	var done = recoverySeats(a.done);
	g.Players.forEach(function (p) { p.kdDone = done.indexOf(p.seat) !== -1; });
	var seat = recoverySeat(a.seat);
	if (seat === null || done.indexOf(seat) !== -1) { seat = khoiDongNextSeat(); }
	if (seat === null) {                          /* every individual turn played: the common turn is next */
		g.KhoiDongSequenceCounter = 6;
		return;
	}
	g.KhoiDongMode = 'individual';
	g.KhoiDongSeat = seat;
	g.KhoiDongQuestionCount = g.Timings.KD_QUESTIONS_PER_PLAYER;
	g.KhoiDongStartIndex = recoveryInt(a.question, 1, g.KhoiDongQuestionCount, 1);
	khoiDongResetQuestionState();
	setContestantOnStage(seat);
	g.KhoiDongSequenceCounter = 2;                /* Left: timer bar + bars; Right: question N */
}

/* vcnv: { rows: [status x4], center: status, eliminated: [seats] }  status: closed|correct|wrong */
function restoreVcnv(a) {
	var g = window.GameVariables;
	var ok = function (s) { return s === 'correct' || s === 'wrong' ? s : 'closed'; };
	var rows = (a.rows || []).slice(0, 4);
	vcnvReset();
	g.CurrentRound = 'vcnv';
	renderObstacleBoard();
	[1, 2, 3, 4, 5].forEach(function (n) {
		var st = ok(n === 5 ? a.center : rows[n - 1]);
		var r = vcnvRow(n);
		r.status = st;
		setObstacleRowState(n, st);
		if (st === 'correct') { openObstacleCover(n === 5 ? 'middle' : n); }
		if (n !== 5 && st !== 'closed') { g.VcnvOpenedCount += 1; }
	});
	g.IsVcnvCenterOpened = vcnvRow(5).status === 'correct';
	g.VcnvEliminated = recoverySeats(a.eliminated);
	vcnvSyncEliminated();
	showRoundGraphics();
	showObstacleBoard();
	g.VcnvSequenceCounter = 2;
}

/* tt: { question } */
function restoreTangToc(a) {
	var g = window.GameVariables;
	tangTocReset();
	g.CurrentRound = 'tt';
	tangTocResetState();
	tangTocShowQuestion(recoveryInt(a.question, 1, g.TangTocCount || 4, 1));
}

/* vd: { done: [seats], seat, order: [seats]|null, midTurn: { values: [20|30 x3], question: 1-3, star: 1-3|'used'|null } } */
function restoreVeDich(a) {
	var g = window.GameVariables;
	veDichReset();
	g.CurrentRound = 'vd';
	g.VeDichDone = recoverySeats(a.done);
	if (a.order && a.order.length) { veDichSetOrder(a.order); }
	var seat = recoverySeat(a.seat);
	if (seat === null || g.VeDichDone.indexOf(seat) !== -1) { seat = veDichNextSeat(); }
	if (seat === null) {                          /* all four have played: the round is over */
		g.ActiveSeat = null;
		g.VeDichSequenceCounter = 11;
		return;
	}
	veDichCallToStage(seat);                      /* VeDichSequenceCounter = 2: Left opens the choose screen */
	var m = a.midTurn;
	var values = m && (m.values || []).filter(function (v) { return v === 20 || v === 30; });
	if (!values || values.length !== VE_DICH_PICKS) { return; }
	g.VeDichValues = values.slice();
	var q = recoveryInt(m.question, 1, VE_DICH_PICKS, 1);
	if (m.star === 'used') { g.IsVeDichStarUsed = true; g.VeDichStar = null; }
	else {
		var star = recoveryInt(m.star, 1, VE_DICH_PICKS, null);
		if (star !== null && star >= q) { g.VeDichStar = star; g.IsVeDichStarUsed = true; }
		else if (star !== null) { g.IsVeDichStarUsed = true; }   /* the star was on a question already played */
	}
	veDichLoadQuestion(q);
	g.IsVeDichQuestionRevealed = false;
	showVeDichQuestionGroup({ seat: seat, value: g.VeDichValue });
	if (g.VeDichStar === q) { setTimeout(function () { setVeDichStar(true); g.changed(); }, 2100); }   /* once the group has landed; changed(): the screens see it now, not at the next heartbeat */
	g.VeDichSequenceCounter = 4;                  /* ready: Right shows question q */
}

window.GameVariables.Commands.restoreProgress = function (args) {
	var g = window.GameVariables;
	if (!args || !recoveryAllowed()) { console.warn('[Recovery] refused - only before Khởi động has started'); return; }
	var round = ['kd', 'vcnv', 'tt', 'vd', 'tb'].indexOf(args.round) !== -1 ? args.round : 'kd';
	stopAllSounds();
	hideTitleCard();
	clearBuzzers();
	if (args.scores) { [1, 2, 3, 4].forEach(function (s) { if (args.scores[s] !== undefined && args.scores[s] !== '') { setScore(s, args.scores[s]); } }); }
	recoveryFinishEarlierRounds(round);
	if (round === 'kd') { restoreKhoiDong(args.kd || {}); }
	else if (round === 'vcnv') { restoreVcnv(args.vcnv || {}); }
	else if (round === 'tt') { restoreTangToc(args.tt || {}); }
	else if (round === 'tb') { restoreTieBreak(args.tb || {}); }
	else { restoreVeDich(args.vd || {}); }
	g.CurrentRound = round;
	refreshContestantBars();   /* grey bars follow the round now set */
	g.IsProgressRestored = true;
	console.log('[Recovery] restored to', round, JSON.stringify(args));
};
