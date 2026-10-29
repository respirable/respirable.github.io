/*
 * Olympia Controller - Câu hỏi phụ (F5): the tie-break for FIRST place. The STEP functions.
 * Which key calls which step is in KeyboardController.js (search for "round == 'tb'").
 *
 * Same graphics as the Khởi động individual turn (question bar with the timer skin + the four
 * contestant bars); the clock is 15 s with its own music (tb_15s.ogg), and its strip runs
 * in the groove of the question bar. Only the seats tied for first take part; the others' bars
 * are grey. No points change hands. At most TIEBREAK_MAX_QUESTIONS (3) questions are put; no
 * screen says who takes which prize.
 *
 *     Left    (0) the seats tied for first are chosen + kd_ready
 *     Left    (1) bars + empty question bar (timer skin) + tt_open_question
 *     Right   (2) question 1 - buzzers open at once
 *     1-4         buzz (players' devices too): the first press locks the question, bar turns red,
 *                 and the 15 s clock + its music PAUSE until the verdict (wrong: they go on)
 *                 - pressed BEFORE the clock started ("early"): the host can only rule it wrong
 *     Right   (3) 15 s clock + tb_15s (not while a buzz waits for its verdict)
 *     Up          the buzzed seat is right -> it wins, clock + music stop, vcnv_row_correct (not for an early buzz)
 *     Down        the buzzed seat is wrong -> out of THIS question, buzzers open again for the rest
 *     Backspace   clear a mistaken buzz without ruling (nobody is put out)
 *     Right   (5) nobody won the question (time up / everyone out): the next question (up to 3)
 *     Left    (5) somebody won, or every question was put without a winner: graphics off (no sting) -> finished
 *
 * TieBreakSequenceCounter (table in Variables.js):
 *   0 idle   1 ready   2 set   3 question   4 timer   5 closed   6 finished
 */

var TIEBREAK_LATE_PRESS_MS = 1500;

/* the seats with the highest score right now */
function tieBreakTopSeats() { return window.GameVariables.topScoreSeats(window.GameVariables.Players); }

/* how many questions can be put: the set's, never more than TIEBREAK_MAX_QUESTIONS */
function tieBreakQuestionLimit() {
	var g = window.GameVariables;
	return Math.min(g.Timings.TIEBREAK_MAX_QUESTIONS, (g.TieBreakQuestions || []).length || g.Timings.TIEBREAK_MAX_QUESTIONS);
}

function tieBreakIsPlaying(seat) { return window.GameVariables.TieBreakSeats.indexOf(seat) !== -1; }
function tieBreakIsOut(seat) { return window.GameVariables.TieBreakEliminated.indexOf(seat) !== -1; }

/* seats that may still buzz on the current question */
function tieBreakSeatsLeft() {
	return window.GameVariables.TieBreakSeats.filter(function (s) { return !tieBreakIsOut(s); });
}

/* the bars while this round is played (ScoreboardControl.js contestantBarLook): name only, no
 * number and no score; seats not in the tie-break hidden; out of the current question grey */
function tieBreakBarLook(seat) {
	var c = window.GameVariables.TieBreakSequenceCounter;
	if (c < 1 || c > 5) { return null; }
	return { plain: true, absent: !tieBreakIsPlaying(seat), grey: tieBreakIsOut(seat) };
}

function tieBreakRefreshBars() { refreshContestantBars(); }

function tieBreakStopTimer() {
	if (window.GameVariables.IsTieBreakTimerRunning) { stopClock(); }
	stopShortPassiveSound();
	window.GameVariables.IsTieBreakTimerRunning = false;
	window.GameVariables.IsTieBreakTimerPaused = false;
}

/* a buzz while the clock runs: clock and music hold still until the verdict */
function tieBreakPauseTimer() {
	var g = window.GameVariables;
	if (!g.IsTieBreakTimerRunning || g.IsTieBreakTimerPaused) { return; }
	pauseClock();
	pauseShortPassiveSound();   /* AudioControl.js: the screens' music stops too */
	g.IsTieBreakTimerPaused = true;
}

/* wrong / a mistaken buzz cleared: on from where they stopped */
function tieBreakResumeTimer() {
	var g = window.GameVariables;
	if (!g.IsTieBreakTimerPaused) { return; }
	g.IsTieBreakTimerPaused = false;
	resumeClock();
	resumeShortPassiveSound(g.TimerSound ? g.TimerSound.currentTime : undefined);   /* the screens go on from the same point */
}

/* ---------- steps ---------- */

/* Left (idle): who plays. The host may have set the seats from the panel already (tbSetSeats). */
function tieBreakReady() {
	var g = window.GameVariables;
	if (!g.TieBreakSeats.length) { g.TieBreakSeats = tieBreakTopSeats(); }
	if (g.TieBreakSeats.length < 2) {
		console.warn('[TB] nobody is tied for first - set the seats from the control panel to run a tie-break anyway');
		g.TieBreakSeats = [];
		return;
	}
	hideTitleCard();
	clearBuzzers();
	setContestantOnStage(null);
	g.TieBreakEliminated = [];
	g.TieBreakWinner = null;
	startGeneralSound('kd_ready.ogg');
	g.TieBreakSequenceCounter = 1;
	tieBreakRefreshBars();
	console.log('[TB] tie-break between seats ' + g.TieBreakSeats.join(', '));
}

/* Left (ready): question bar (timer skin) zooms in, the bars pop in one by one */
function tieBreakOpenQuestionBar() {
	setQuestionBarVariant('timer');
	clearQuestionBar();
	hideQuestionTimer();
	showRoundGraphics();
	showQuestionBar();
	revealContestantBars();
	startGeneralSound('tt_open_question.mp3');   /* the Tăng tốc 'open question' sound */
	window.GameVariables.TieBreakSequenceCounter = 2;
	tieBreakRefreshBars();
}

/* Right (set / closed without a winner): the next question */
function tieBreakNextQuestion() {
	var g = window.GameVariables;
	var index = g.TieBreakQuestionIndex + 1;
	if (index > tieBreakQuestionLimit()) { console.warn('[TB] no question left (at most ' + tieBreakQuestionLimit() + ')'); return; }
	var q = (g.TieBreakQuestions || [])[index - 1];
	tieBreakStopTimer();
	hideQuestionTimer();
	clearBuzzers();
	g.TieBreakQuestionIndex = index;
	g.TieBreakCurrentQuestion = q && q.text ? q.text : g.MissingQuestionText;
	g.TieBreakCurrentAnswer = q ? (q.answer || '') : '';
	g.TieBreakBuzzSeat = null;
	g.IsTieBreakBuzzEarly = false;
	g.TieBreakEliminated = [];
	g.TieBreakLastResult = null;
	g.IsTieBreakTimerDone = false;
	setQuestionText(g.TieBreakCurrentQuestion);
	g.TieBreakSequenceCounter = 3;
	tieBreakRefreshBars();
}

/* Right (question): the 15 s clock */
/* from: seconds already gone (a clock resumed after a crash) */
function tieBreakStartTimer(from) {
	var g = window.GameVariables;
	if (g.TieBreakBuzzSeat !== null) { return; }   /* rule on the early buzz first */
	var dur = g.Timings.TIEBREAK_ANSWER;
	g.IsTieBreakTimerRunning = true;
	g.IsTieBreakTimerDone = false;
	startQuestionTimer();
	startShortPassiveSound('tb_15s.ogg');
	seekShortPassiveSound(from);
	startClock({
		startAt: from,
		mode: 'down', duration: dur, label: 'tb_q' + g.TieBreakQuestionIndex,
		onTick: function (remaining) { setQuestionTimer(1 - remaining / dur); },
		onDone: function () {
			setQuestionTimer(1);
			g.IsTieBreakTimerRunning = false;
			g.IsTieBreakTimerDone = true;
			/* in a room, a press made just before 0 may still be on its way (PlayerActions.js
			 * buffers 400 ms): give it a moment before the question closes */
			setTimeout(function () { tieBreakCloseIfOver(); g.changed(); }, (g.Sync && g.Sync.room) ? TIEBREAK_LATE_PRESS_MS : 0);
			g.changed();
		}
	});
	g.TieBreakSequenceCounter = 4;
}

/* time up / everyone out, and no buzz waiting for a verdict: the question is over */
function tieBreakCloseIfOver() {
	var g = window.GameVariables;
	if (g.TieBreakSequenceCounter != 3 && g.TieBreakSequenceCounter != 4) { return; }
	if (g.TieBreakBuzzSeat !== null) { return; }
	if (!tieBreakSeatsLeft().length || g.IsTieBreakTimerDone) {
		tieBreakStopTimer();
		if (!g.TieBreakLastResult || g.TieBreakLastResult === 'wrong' || g.TieBreakLastResult === 'early') { g.TieBreakLastResult = 'none'; }
		g.TieBreakSequenceCounter = 5;
		console.log('[TB] question ' + g.TieBreakQuestionIndex + ' over, nobody right - Right for the next one');
	}
}

/* 1-4 / a player's buzz. Players' devices (PlayerActions.js) judge by the press time:
 * opts.early = pressed before the clock started, opts.inTime = pressed before it ran out (it may
 * arrive a moment after). The keyboard goes by the step. */
function tieBreakBuzz(seat, opts) {
	var g = window.GameVariables, c = g.TieBreakSequenceCounter;
	if ((c != 3 && c != 4) || g.TieBreakBuzzSeat !== null) { return; }
	if (!tieBreakIsPlaying(seat) || tieBreakIsOut(seat)) { return; }
	var early = (opts && typeof opts.early === 'boolean') ? opts.early : (c == 3);
	if (c == 4 && !early && !g.IsTieBreakTimerRunning && !(opts && opts.inTime)) { return; }   /* after time up */
	g.TieBreakBuzzSeat = seat;
	g.IsTieBreakBuzzEarly = early;
	if (c == 4) { tieBreakPauseTimer(); }
	setContestantBuzzed(seat, true);
	playBuzzerSound();
}

/* Backspace: a mis-press - the buzz goes, nobody is put out */
function tieBreakClearBuzz() {
	var g = window.GameVariables;
	g.TieBreakBuzzSeat = null;
	g.IsTieBreakBuzzEarly = false;
	clearBuzzers();
	tieBreakRefreshBars();
	tieBreakResumeTimer();
	tieBreakCloseIfOver();
}

/* Up: right - only for a buzz made while the clock ran */
function tieBreakJudgeCorrect() {
	var g = window.GameVariables, seat = g.TieBreakBuzzSeat;
	if (seat === null || g.IsTieBreakBuzzEarly || g.TieBreakSequenceCounter != 4) { return; }
	tieBreakStopTimer();
	startLongActiveSound('vcnv_row_correct.mp3');
	g.TieBreakWinner = seat;
	g.TieBreakLastResult = 'correct';
	g.TieBreakSequenceCounter = 5;
	console.log('[TB] seat ' + seat + ' wins the tie-break');
}

/* Down: wrong (or an early buzz) - out of this question, the others may buzz again */
function tieBreakJudgeWrong() {
	var g = window.GameVariables, seat = g.TieBreakBuzzSeat;
	if (seat === null) { return; }
	startLongActiveSound('kd_wrong.ogg');
	g.TieBreakLastResult = g.IsTieBreakBuzzEarly ? 'early' : 'wrong';
	g.TieBreakEliminated.push(seat);
	g.TieBreakBuzzSeat = null;
	g.IsTieBreakBuzzEarly = false;
	clearBuzzers();
	tieBreakRefreshBars();
	if (tieBreakSeatsLeft().length) { tieBreakResumeTimer(); }   /* nobody left: the question closes below */
	tieBreakCloseIfOver();
}

/* Left (closed with a winner, or with no question left): graphics off - no completion sting */
function tieBreakFinish() {
	var g = window.GameVariables;
	if (g.TieBreakWinner === null && g.TieBreakQuestionIndex < tieBreakQuestionLimit()) { return; }   /* nobody yet: → the next question first */
	tieBreakStopTimer();
	hideQuestionTimer();
	clearQuestionBar();
	hideQuestionBar();
	hideContestantBars();
	showRoundGraphics();
	clearBuzzers();
	g.TieBreakSequenceCounter = 6;
	tieBreakRefreshBars();
}

/* F5 away: graphics down, the clock stops (that question is then over without a winner) */
function tieBreakLeave() {
	var g = window.GameVariables;
	tieBreakStopTimer();
	if (g.TieBreakSequenceCounter == 4) { g.IsTieBreakTimerDone = true; }
	g.TieBreakBuzzSeat = null;
	g.IsTieBreakBuzzEarly = false;
	tieBreakCloseIfOver();
	hideQuestionTimer();
	clearQuestionBar();
	hideQuestionBar();
	hideContestantBars();
	showRoundGraphics();
}

/* F5 back while the tie-break is under way: the bar and the bars come back as they were */
function tieBreakEnter() {
	var g = window.GameVariables, c = g.TieBreakSequenceCounter;
	if (c >= 2 && c <= 5) {
		setQuestionBarVariant('timer');
		setQuestionText(c >= 3 ? g.TieBreakCurrentQuestion : '');
		showQuestionBar();
		revealContestantBars();
	}
	tieBreakRefreshBars();
}

/* ---------- control panel ---------- */

/* back to idle, the winner forgotten (scores are never touched by the tie-break) */
function tieBreakReset() {
	var g = window.GameVariables;
	tieBreakStopTimer();
	hideQuestionTimer();
	clearQuestionBar();
	hideQuestionBar();
	hideContestantBars();
	showRoundGraphics();
	clearBuzzers();
	g.TieBreakSequenceCounter = 0;
	g.TieBreakSeats = [];
	g.TieBreakEliminated = [];
	g.TieBreakQuestionIndex = 0;
	g.TieBreakCurrentQuestion = '';
	g.TieBreakCurrentAnswer = '';
	g.TieBreakBuzzSeat = null;
	g.IsTieBreakBuzzEarly = false;
	g.TieBreakWinner = null;
	g.TieBreakLastResult = null;
	g.IsTieBreakTimerDone = false;
	tieBreakRefreshBars();
}

/* the host picks who plays (only before the tie-break starts) */
function tieBreakSetSeats(seats) {
	var g = window.GameVariables;
	if (g.TieBreakSequenceCounter != 0) { return; }
	var list = [];
	(seats || []).forEach(function (s) { s = parseInt(s, 10); if (g.getPlayer(s) && list.indexOf(s) === -1) { list.push(s); } });
	g.TieBreakSeats = list.sort();
}
