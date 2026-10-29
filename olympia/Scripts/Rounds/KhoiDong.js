/*
 * Olympia Controller - Khởi động (round 1): the STEP functions.
 * Which key calls which step is in KeyboardController.js (search for "round == 'kd'").
 *
 * Two turns, one after the other, same graphics and same sounds:
 *
 *   INDIVIDUAL (KhoiDongMode 'individual') - 4 contestants x 6 questions
 *     Left    (1) title card + kd_start
 *     Left    (2) title off, next contestant on stage + kd_ready
 *     Left    (3) bars + empty question bar (timer skin) + kd_open_question
 *     Right   (4) question 1 + kd_60s bed (loops 30<->50 until the last question, then jumps to 49)
 *     Space       3-2-1 think clock      Up  +10 & kd_correct      Down  kd_wrong, no deduction
 *     Right       next question ... after question 6: graphics off, kd_complete 1 s later
 *     Left        repeat from (2) for the next contestant
 *
 *   COMMON (KhoiDongMode 'common') - 12 questions, buzzers
 *     Left    (after the 4th contestant) kd_ready - same "get ready" beat as the individual turn
 *     Left        bars + empty question bar (plain skin) + kd_open_question
 *     Right       question 1 + same bed rule (release on question 12)
 *     1-4         buzz: first press locks the question, bar turns red, kd_buzz
 *     Space       3-2-1 think clock (with or without a buzz)
 *     Up          +10 to the buzzed seat (ignored when nobody buzzed)
 *     Down        buzzed seat -5 / nobody buzzed: sound only, no deduction
 *     Backspace   clear a mistaken buzz, buzzers open again
 *     Right       next question ... after question 12: graphics off, kd_complete 1 s later
 *     Left        (finished) switch to Vượt chướng ngại vật (same as F2)
 *
 *   OLYMPIA 23 RULES (Rules.js, gv.Rules 'o23') - no individual turn: three common turns of 8, 12
 *   and 16 questions, taken in order from <common> (questions 1-8, 9-20, 21-36), no time limit
 *     Left    (0) title card + kd_start
 *     Left    (1) turn 1: kd_ready             Left (5) the next turn: kd_ready (no title)
 *     Left    (2) bars + plain question bar + the "Lượt N" label (Về đích name tag) + kd_open_question
 *     Right / 1-4 / Space / Up / Down / Backspace   exactly as in the common turn
 *     Right       after the turn's last question: graphics off, kd_complete 2 s later -> (5), or (6) after turn 3
 *     Left    (5) the next turn: kd_ready
 *
 * KhoiDongSequenceCounter (table in Variables.js):
 *   0 idle   1 title   2 ready   3 set   4 question   5 done (next contestant / O23: next turn waiting)   6 finished
 */

function khoiDongQuestionList() {
	var kd = window.GameVariables.KhoiDongQuestions || {};
	if (window.GameVariables.Rules === 'o23') {   /* this turn's slice of <common> */
		var off = window.GameVariables.KhoiDongQuestionOffset || 0;
		return (kd.common || []).slice(off, off + window.GameVariables.KhoiDongQuestionCount);
	}
	if (window.GameVariables.KhoiDongMode == 'common') { return kd.common || []; }
	return (kd.individual && kd.individual[window.GameVariables.KhoiDongSeat]) || [];
}

/* first contestant (by seat) who has not played the individual turn yet */
function khoiDongNextSeat() {
	for (var i = 0; i < window.GameVariables.Players.length; i++) {
		if (!window.GameVariables.Players[i].kdDone) { return window.GameVariables.Players[i].seat; }
	}
	return null;
}

function khoiDongResetQuestionState() {
	window.GameVariables.KhoiDongQuestionIndex = 0;
	window.GameVariables.KhoiDongCurrentQuestion = '';
	window.GameVariables.KhoiDongCurrentAnswer = '';
	window.GameVariables.KhoiDongLastResult = null;
	window.GameVariables.KhoiDongBuzzSeat = null;
	window.GameVariables.IsKhoiDongQuestionResolved = false;
}

/* Both turns: put question `index` on the bar and drive the bed. */
function khoiDongShowQuestion(index) {
	var q = khoiDongQuestionList()[index - 1];
	window.GameVariables.KhoiDongQuestionIndex = index;
	window.GameVariables.KhoiDongCurrentQuestion = q ? q.text : (window.GameVariables.Rules === 'o23'
		? '(thiếu câu ' + ((window.GameVariables.KhoiDongQuestionOffset || 0) + index) + ' trong <common> - lượt ' + window.GameVariables.KhoiDongTurn + ' cần câu ' + ((window.GameVariables.KhoiDongQuestionOffset || 0) + 1) + '-' + ((window.GameVariables.KhoiDongQuestionOffset || 0) + window.GameVariables.KhoiDongQuestionCount) + ')'
		: '(thiếu câu ' + index + (window.GameVariables.KhoiDongMode == 'common' ? ' lượt chung' : ' cho ghế ' + window.GameVariables.KhoiDongSeat) + ')');
	window.GameVariables.KhoiDongCurrentAnswer = q ? (q.answer || '') : '';
	window.GameVariables.KhoiDongLastResult = null;
	window.GameVariables.KhoiDongBuzzSeat = null;
	window.GameVariables.IsKhoiDongQuestionResolved = false;
	hideThinkClock();
	clearBuzzers();
	setQuestionText(window.GameVariables.KhoiDongCurrentQuestion);
	khoiDongO23Label();

	if (index == 1) { startLongPassiveSound('kd_60s.mp3'); }
	if (index == window.GameVariables.KhoiDongQuestionCount) { releaseLongPassiveSound(); }   /* last question: let the outro play */
	window.GameVariables.KhoiDongSequenceCounter = 4;
}

/* Right during a question: the next one, or the end of the turn. */
function khoiDongNextQuestion() {
	if (window.GameVariables.KhoiDongQuestionIndex < window.GameVariables.KhoiDongQuestionCount) {
		khoiDongShowQuestion(window.GameVariables.KhoiDongQuestionIndex + 1);
	}
	else if (window.GameVariables.KhoiDongMode == 'common') { khoiDongCommonComplete(); }
	else { khoiDongCompleteTurn(); }
}

/* Both turns: graphics off now, completion sting a moment later (Olympia 23: 2 s after the Right
 * that ended the turn; then Left gets the next turn ready). */
function khoiDongHideGraphicsThenComplete() {
	hideThinkClock();
	clearQuestionBar();
	stopLongPassiveSound();
	hideQuestionBar();
	hideContestantBars();
	showRoundGraphics();   /* hidden with ',' (green screen): back to normal once the graphics are gone */
	clearBuzzers();
	setTimeout(function () { startGeneralSound('kd_complete.ogg'); }, window.GameVariables.Rules === 'o23' ? 2000 : 1000);
}

/* Graphics off at once, no sound (control-panel resets). */
function khoiDongHideGraphicsNow() {
	hideThinkClock();
	clearQuestionBar();
	stopLongPassiveSound();
	hideQuestionBar();
	hideContestantBars();
	showRoundGraphics();
	setContestantOnStage(null);
	clearBuzzers();
}

/* ---------- individual turn ---------- */

function khoiDongShowTitle() {
	showTitleCard('kd');
	startGeneralSound('kd_start.mp3');
	window.GameVariables.KhoiDongSequenceCounter = 1;
}

/* the next contestant is called to the stage */
function khoiDongCallNextContestant() {
	var seat = khoiDongNextSeat();
	if (seat === null) {
		window.GameVariables.KhoiDongSequenceCounter = 6;
		console.log('[KD] all individual turns finished - Left opens the common turn');
		return;
	}
	hideTitleCard();
	clearBuzzers();
	setContestantOnStage(seat);
	window.GameVariables.KhoiDongSeat = seat;
	khoiDongResetQuestionState();
	startGeneralSound('kd_ready.ogg');
	window.GameVariables.KhoiDongSequenceCounter = 2;
}

/* question bar (timer skin) zooms in, the bars pop in one by one */
function khoiDongOpenQuestionBar() {
	setQuestionBarVariant('timer');
	clearQuestionBar();
	showRoundGraphics();
	showQuestionBar();
	revealContestantBars();
	startGeneralSound('kd_open_question.mp3');
	window.GameVariables.KhoiDongSequenceCounter = 3;
}

function khoiDongCompleteTurn() {
	var p = window.GameVariables.getPlayer(window.GameVariables.KhoiDongSeat);
	if (p) { p.kdDone = true; }
	setContestantOnStage(null);
	khoiDongHideGraphicsThenComplete();
	khoiDongResetQuestionState();
	window.GameVariables.KhoiDongSequenceCounter = (khoiDongNextSeat() === null) ? 6 : 5;
}

/* Up during an individual turn: +10, kd_correct */
function khoiDongJudgeIndividualCorrect() {
	hideThinkClock();
	startLongActiveSound('kd_correct.mp3');
	addScore(window.GameVariables.KhoiDongSeat, window.GameVariables.Points.KD_CORRECT);
	window.GameVariables.KhoiDongLastResult = 'correct';
}

/* Down during an individual turn: kd_wrong, no deduction (KD_WRONG_INDIVIDUAL) */
function khoiDongJudgeIndividualWrong() {
	hideThinkClock();
	startLongActiveSound('kd_wrong.ogg');
	if (window.GameVariables.Points.KD_WRONG_INDIVIDUAL) { addScore(window.GameVariables.KhoiDongSeat, window.GameVariables.Points.KD_WRONG_INDIVIDUAL); }
	window.GameVariables.KhoiDongLastResult = 'wrong';
}

/* ---------- common turn ---------- */

function khoiDongEnterCommon() {
	window.GameVariables.KhoiDongMode = 'common';
	window.GameVariables.KhoiDongSeat = null;
	window.GameVariables.KhoiDongQuestionCount = window.GameVariables.Timings.KD_COMMON_QUESTIONS;
	khoiDongResetQuestionState();
	setContestantOnStage(null);
	clearBuzzers();
	khoiDongCommonReady();
}

/* No title card for this turn, but the same "get ready" sting before the graphics come in. */
function khoiDongCommonReady() {
	startGeneralSound('kd_ready.ogg');
	window.GameVariables.KhoiDongSequenceCounter = 2;
}

function khoiDongCommonOpenQuestionBar() {
	setQuestionBarVariant('plain');
	clearQuestionBar();
	khoiDongO23Label();
	showRoundGraphics();
	showQuestionBar();
	revealContestantBars();
	startGeneralSound('kd_open_question.mp3');
	window.GameVariables.KhoiDongSequenceCounter = 3;
}

function khoiDongCommonComplete() {
	khoiDongHideGraphicsThenComplete();
	khoiDongResetQuestionState();
	if (window.GameVariables.Rules === 'o23' && window.GameVariables.KhoiDongTurn < window.GameVariables.RulesO23.KD_TURNS.length) {
		window.GameVariables.KhoiDongSequenceCounter = 5;   /* Left: the next turn */
		console.log('[KD] turn ' + window.GameVariables.KhoiDongTurn + ' finished - Left opens turn ' + (window.GameVariables.KhoiDongTurn + 1));
		return;
	}
	window.GameVariables.KhoiDongSequenceCounter = 6;
	console.log('[KD] common turn finished - Khởi động over');
}

/* ---------- Olympia 23 rules: three common turns (8, 12, 16 questions) ---------- */

/* Left on the title (turn 1) or after a turn (the next one): the turn's questions + kd_ready */
function khoiDongO23Ready(turn) {
	var g = window.GameVariables, sizes = g.RulesO23.KD_TURNS;
	turn = Math.max(1, Math.min(sizes.length, turn || 1));
	hideTitleCard();
	g.KhoiDongTurn = turn;
	g.KhoiDongQuestionOffset = sizes.slice(0, turn - 1).reduce(function (a, b) { return a + b; }, 0);
	g.Players.forEach(function (p) { p.kdDone = true; });   /* no individual turn under these rules */
	g.KhoiDongMode = 'common';
	g.KhoiDongSeat = null;
	g.KhoiDongQuestionCount = sizes[turn - 1];
	khoiDongResetQuestionState();
	setContestantOnStage(null);
	clearBuzzers();
	khoiDongCommonReady();
}

/* "Lượt N: x/y" on the question bar (Olympia 23 only; '' hides it) */
function khoiDongO23Label() {
	var g = window.GameVariables;
	if (g.Rules !== 'o23' || g.KhoiDongMode !== 'common' || !g.KhoiDongTurn) { setKdTurnLabel(''); return; }
	setKdTurnLabel('Lượt ' + g.KhoiDongTurn + (g.KhoiDongQuestionIndex ? ': ' + g.KhoiDongQuestionIndex + '/' + g.KhoiDongQuestionCount : ''));   /* no question yet: just the turn */
}

/* 1-4 in the common turn: the first press locks the question */
function khoiDongBuzz(seat) {
	if (window.GameVariables.KhoiDongSequenceCounter != 4 || window.GameVariables.KhoiDongBuzzSeat !== null || window.GameVariables.IsKhoiDongQuestionResolved) { return; }
	if (!window.GameVariables.getPlayer(seat)) { return; }
	window.GameVariables.KhoiDongBuzzSeat = seat;
	setContestantBuzzed(seat, true);
	playBuzzerSound();
}

function khoiDongClearBuzz() {
	window.GameVariables.KhoiDongBuzzSeat = null;
	clearBuzzers();
}

/* Up during the common turn: +10 to the seat that buzzed (nobody buzzed: nothing); one verdict per question */
function khoiDongJudgeCommonCorrect() {
	if (window.GameVariables.KhoiDongBuzzSeat === null || window.GameVariables.IsKhoiDongQuestionResolved) { return; }
	hideThinkClock();
	startLongActiveSound('kd_correct.mp3');
	addScore(window.GameVariables.KhoiDongBuzzSeat, window.GameVariables.Points.KD_CORRECT);
	window.GameVariables.KhoiDongLastResult = 'correct';
	window.GameVariables.IsKhoiDongQuestionResolved = true;
}

/* Down during the common turn: -5 to the seat that buzzed / nobody buzzed: sound only; one verdict per question */
function khoiDongJudgeCommonWrong() {
	if (window.GameVariables.IsKhoiDongQuestionResolved) { return; }
	hideThinkClock();
	startLongActiveSound('kd_wrong.ogg');
	if (window.GameVariables.KhoiDongBuzzSeat !== null) {
		addScore(window.GameVariables.KhoiDongBuzzSeat, window.GameVariables.Points.KD_WRONG_COMMON);
		window.GameVariables.KhoiDongLastResult = 'wrong';
	}
	else {
		window.GameVariables.KhoiDongLastResult = 'noanswer';
	}
	window.GameVariables.IsKhoiDongQuestionResolved = true;
}

/* ---------- resets (control panel) - scores untouched ---------- */

/* Restart from the individual turn (seat given: only un-mark that seat). Olympia 23: from turn 1. */
function khoiDongReset(seat) {
	if (window.GameVariables.Rules === 'o23') { khoiDongResetO23(1); return; }
	window.GameVariables.Players.forEach(function (p) { if (seat === null || p.seat === seat) { p.kdDone = false; } });
	khoiDongHideGraphicsNow();
	setQuestionBarVariant('timer');
	window.GameVariables.KhoiDongMode = 'individual';
	window.GameVariables.KhoiDongSeat = null;
	window.GameVariables.KhoiDongQuestionCount = window.GameVariables.Timings.KD_QUESTIONS_PER_PLAYER;
	khoiDongResetQuestionState();
	window.GameVariables.KhoiDongSequenceCounter = 0;
}

/* Olympia 23: back to the start of `turn` (1: the title again) */
function khoiDongResetO23(turn) {
	var g = window.GameVariables;
	khoiDongHideGraphicsNow();
	setQuestionBarVariant('plain');
	setKdTurnLabel('');
	g.KhoiDongMode = 'common';
	g.KhoiDongSeat = null;
	g.KhoiDongTurn = Math.max(1, turn || 1);
	g.KhoiDongQuestionOffset = g.RulesO23.KD_TURNS.slice(0, g.KhoiDongTurn - 1).reduce(function (a, b) { return a + b; }, 0);
	g.KhoiDongQuestionCount = g.RulesO23.KD_TURNS[g.KhoiDongTurn - 1];
	khoiDongResetQuestionState();
	g.KhoiDongSequenceCounter = g.KhoiDongTurn === 1 ? 0 : 5;   /* turn 1: title first; later turns: Left = kd_ready */
	if (g.KhoiDongTurn > 1) { g.KhoiDongTurn -= 1; }             /* (5) opens "the next turn" */
}

/* Restart only the common turn (question 1 again on the next Left/Right). Olympia 23: this turn. */
function khoiDongResetCommon() {
	if (window.GameVariables.Rules === 'o23') { khoiDongResetO23(window.GameVariables.KhoiDongTurn || 1); return; }
	khoiDongHideGraphicsNow();
	setQuestionBarVariant('plain');
	window.GameVariables.KhoiDongMode = 'common';
	window.GameVariables.KhoiDongSeat = null;
	window.GameVariables.KhoiDongQuestionCount = window.GameVariables.Timings.KD_COMMON_QUESTIONS;
	khoiDongResetQuestionState();
	window.GameVariables.KhoiDongSequenceCounter = 0;
}
