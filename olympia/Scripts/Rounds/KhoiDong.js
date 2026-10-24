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
 * KhoiDongSequenceCounter (table in Variables.js):
 *   0 idle   1 title   2 ready   3 set   4 question   5 done (next contestant waiting)   6 finished
 */

function khoiDongQuestionList() {
	var kd = window.GameVariables.KhoiDongQuestions || {};
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
	window.GameVariables.KhoiDongCurrentQuestion = q ? q.text : ('(thiếu câu ' + index + (window.GameVariables.KhoiDongMode == 'common' ? ' lượt chung' : ' cho ghế ' + window.GameVariables.KhoiDongSeat) + ')');
	window.GameVariables.KhoiDongCurrentAnswer = q ? (q.answer || '') : '';
	window.GameVariables.KhoiDongLastResult = null;
	window.GameVariables.KhoiDongBuzzSeat = null;
	window.GameVariables.IsKhoiDongQuestionResolved = false;
	hideThinkClock();
	clearBuzzers();
	setQuestionText(window.GameVariables.KhoiDongCurrentQuestion);

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

/* Both turns: graphics off now, completion sting a moment later. */
function khoiDongHideGraphicsThenComplete() {
	hideThinkClock();
	clearQuestionBar();
	stopLongPassiveSound();
	hideQuestionBar();
	hideContestantBars();
	showRoundGraphics();   /* hidden with ',' (green screen): back to normal once the graphics are gone */
	clearBuzzers();
	setTimeout(function () { startGeneralSound('kd_complete.ogg'); }, 1000);
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
	showRoundGraphics();
	showQuestionBar();
	revealContestantBars();
	startGeneralSound('kd_open_question.mp3');
	window.GameVariables.KhoiDongSequenceCounter = 3;
}

function khoiDongCommonComplete() {
	khoiDongHideGraphicsThenComplete();
	khoiDongResetQuestionState();
	window.GameVariables.KhoiDongSequenceCounter = 6;
	console.log('[KD] common turn finished - Khởi động over');
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

/* Restart from the individual turn (seat given: only un-mark that seat). */
function khoiDongReset(seat) {
	window.GameVariables.Players.forEach(function (p) { if (seat === null || p.seat === seat) { p.kdDone = false; } });
	khoiDongHideGraphicsNow();
	setQuestionBarVariant('timer');
	window.GameVariables.KhoiDongMode = 'individual';
	window.GameVariables.KhoiDongSeat = null;
	window.GameVariables.KhoiDongQuestionCount = window.GameVariables.Timings.KD_QUESTIONS_PER_PLAYER;
	khoiDongResetQuestionState();
	window.GameVariables.KhoiDongSequenceCounter = 0;
}

/* Restart only the common turn (question 1 again on the next Left/Right). */
function khoiDongResetCommon() {
	khoiDongHideGraphicsNow();
	setQuestionBarVariant('plain');
	window.GameVariables.KhoiDongMode = 'common';
	window.GameVariables.KhoiDongSeat = null;
	window.GameVariables.KhoiDongQuestionCount = window.GameVariables.Timings.KD_COMMON_QUESTIONS;
	khoiDongResetQuestionState();
	window.GameVariables.KhoiDongSequenceCounter = 0;
}
