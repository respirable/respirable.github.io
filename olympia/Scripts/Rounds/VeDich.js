/*
 * Olympia Controller - Về đích (round 4): the STEP functions.
 * Which key calls which step is in KeyboardController.js (search for "round == 'vd'").
 *
 *   F4 / Left after TT   title card + vd_start
 *   Left     (title)     playing order = current scores, highest first (ties: lower seat); the
 *                        first contestant is called to the stage: vd_ready (sound only)
 *   Left     (stageCall) choose screen + vd_choose
 *   2 / 3    (choose)    pick 20 / 30 (three picks) + vd_pick;  U drops the last pick
 *   Left     (choose, 3 picks)  vd_open_question at once; 2 s later the question group (name tabs +
 *                        EMPTY question bar) and the score box zoom in
 *   S        (ready)     Ngôi sao hy vọng on the first question (once per contestant)
 *   Right    (ready)     question text on the bar
 *   Right    (question)  answer clock (15 s for 20 pts, 20 s for 30 pts) + vd_15s / vd_20s
 *   Up       (timer)     right: + value (x2 with the star), vd_correct
 *   Down     (timer)     wrong (star: - value); no sting - the 5 s steal music + reversed bar
 *   1-4      (steal)     another seat buzzes to steal (first press locks), kd_buzz; the 5 s
 *                        music keeps running
 *   Up / Down (stealAnswer)  stealer right: + value to them, - value to the contestant on stage
 *                        (not with the star) / stealer wrong: - half the value
 *   S        (answered / steal with nobody)  the star on the NEXT question
 *   Right    (answered / steal with nobody)  next question at once ... after the THIRD question:
 *                        question bar + score box off, vd_turn_complete -> blank
 *   Left     (blank)     next contestant called to the stage; after the fourth turn -> finished
 *   Left     (finished)  graphics off -> done
 *
 * The order is recomputed from the live scores at the start of every turn (unless the host fixed
 * it on the control panel).
 *
 * VeDichSequenceCounter (table in Variables.js):
 *   0 idle  1 title  2 stageCall  3 choose  4 ready  5 question  6 timer  7 steal  8 stealAnswer
 *   9 answered  10 blank  11 finished  12 done
 */

var VE_DICH_PICKS = 3;

function veDichPackage(seat) { return (window.GameVariables.VeDichQuestions || {})[seat] || { 20: [], 30: [] }; }
function veDichStarred() { return window.GameVariables.VeDichStar !== null && window.GameVariables.VeDichStar === window.GameVariables.VeDichQuestionIndex; }

function veDichResetTurnState() {
	window.GameVariables.VeDichValues = [];
	window.GameVariables.VeDichQuestionIndex = 0;
	window.GameVariables.VeDichValue = 0;
	window.GameVariables.VeDichQuestion = '';
	window.GameVariables.VeDichAnswer = '';
	window.GameVariables.VeDichSeconds = 0;
	window.GameVariables.VeDichStar = null;
	window.GameVariables.IsVeDichStarUsed = false;
	window.GameVariables.VeDichResult = null;
	window.GameVariables.VeDichStealSeat = null;
	window.GameVariables.VeDichStealResult = null;
}

function veDichResetState() {
	veDichStopTimer();
	window.GameVariables.VeDichOrder = [];
	window.GameVariables.IsVeDichOrderManual = false;
	window.GameVariables.VeDichTurn = 0;
	window.GameVariables.VeDichSeat = null;
	window.GameVariables.VeDichDone = [];
	veDichResetTurnState();
}

/* ---------- order ---------- */

/* those done, then the rest best score first (unless the host fixed the order) */
function veDichComputeOrder() {
	if (window.GameVariables.IsVeDichOrderManual && window.GameVariables.VeDichOrder.length) { return window.GameVariables.VeDichOrder.slice(); }
	var rest = window.GameVariables.Players.filter(function (p) { return window.GameVariables.VeDichDone.indexOf(p.seat) === -1; });
	return window.GameVariables.VeDichDone.concat(window.GameVariables.vdOrder(rest));
}

function veDichNextSeat() {
	window.GameVariables.VeDichOrder = veDichComputeOrder();
	for (var i = 0; i < window.GameVariables.VeDichOrder.length; i++) {
		if (window.GameVariables.VeDichDone.indexOf(window.GameVariables.VeDichOrder[i]) === -1) { return window.GameVariables.VeDichOrder[i]; }
	}
	return null;
}

function veDichRefreshScores() {
	var p = window.GameVariables.getPlayer(window.GameVariables.VeDichSeat);
	setVeDichScore(p ? p.score : 0);
	setVeDichTabs(window.GameVariables.VeDichSeat);
}

/* ---------- steps ---------- */

function veDichShowTitle() {
	showTitleCard('vd');
	startGeneralSound('vd_start.mp3');
	window.GameVariables.VeDichSequenceCounter = 1;
}

/* the contestant is called to the stage (sound only) - Left then brings the choose screen */
function veDichCallToStage(seat) {
	veDichStopTimer();
	veDichResetTurnState();
	window.GameVariables.VeDichSeat = seat;
	window.GameVariables.VeDichOrder = veDichComputeOrder();
	window.GameVariables.VeDichTurn = window.GameVariables.VeDichDone.length + 1;
	window.GameVariables.ActiveSeat = seat;
	setContestantOnStage(seat);
	startGeneralSound('vd_ready.mp3');
	window.GameVariables.VeDichSequenceCounter = 2;
}

function veDichFirstTurn() {
	hideTitleCard();
	window.GameVariables.VeDichDone = [];
	var seat = veDichNextSeat();
	if (seat === null) { return; }
	veDichCallToStage(seat);
}

function veDichOpenChooseScreen() {
	showChooseScreen([]);
	startGeneralSound('vd_choose.ogg');
	window.GameVariables.VeDichSequenceCounter = 3;
}

function veDichPick(v) {
	if (window.GameVariables.VeDichValues.length >= VE_DICH_PICKS) { return; }
	window.GameVariables.VeDichValues.push(v);
	setChooseScreen(window.GameVariables.VeDichValues);
	startGeneralSound('vd_pick.ogg');
}

function veDichUnpick() {
	if (!window.GameVariables.VeDichValues.length) { return; }
	window.GameVariables.VeDichValues.pop();
	setChooseScreen(window.GameVariables.VeDichValues);
}

/* question k of this value in the package = the k-th time that value was picked */
function veDichQuestionAt(index) {
	var v = window.GameVariables.VeDichValues[index - 1];
	var k = 0;
	for (var i = 0; i < index; i++) { if (window.GameVariables.VeDichValues[i] === v) { k += 1; } }
	var q = veDichPackage(window.GameVariables.VeDichSeat)[v][k - 1];
	return { value: v, text: q ? q.text : ('(thiếu câu ' + v + ' điểm #' + k + ' của ghế ' + window.GameVariables.VeDichSeat + ')'), answer: q ? q.answer : '' };
}

/* loads question `index` (host sees it on the panel) */
function veDichLoadQuestion(index) {
	var q = veDichQuestionAt(index);
	window.GameVariables.VeDichQuestionIndex = index;
	window.GameVariables.VeDichValue = q.value;
	window.GameVariables.VeDichQuestion = q.text;
	window.GameVariables.VeDichAnswer = q.answer;
	window.GameVariables.VeDichSeconds = window.GameVariables.Timings.VE_DICH_ANSWER[q.value] || 15;
	window.GameVariables.VeDichResult = null;
	window.GameVariables.VeDichStealSeat = null;
	window.GameVariables.VeDichStealResult = null;
}

/* first question of the package: the group comes up with an EMPTY bar; the star may be placed
 * before Right reveals the text */
function veDichPrepareFirstQuestion() {
	veDichStopTimer();
	veDichLoadQuestion(1);
	window.GameVariables.IsVeDichQuestionRevealed = false;
	startGeneralSound('vd_open_question.mp3');   /* once per package, at once ... */
	showVeDichQuestionGroup({ seat: window.GameVariables.VeDichSeat, value: window.GameVariables.VeDichValue });   /* ... the zoom follows 2 s later */
	window.GameVariables.VeDichSequenceCounter = 4;
}

function veDichRevealQuestion() {
	setVeDichQuestion(window.GameVariables.VeDichQuestion, window.GameVariables.VeDichValue);
	window.GameVariables.IsVeDichQuestionRevealed = true;
	window.GameVariables.VeDichSequenceCounter = 5;
}

/* questions 2 and 3: text + header swap at once (the star for it was placed - or not - while the
 * previous question was being closed) */
function veDichShowNextQuestion(index) {
	veDichStopTimer();
	veDichLoadQuestion(index);
	setVeDichQuestion(window.GameVariables.VeDichQuestion, window.GameVariables.VeDichValue);
	setVeDichStar(window.GameVariables.VeDichStar === index);
	setVeDichStealSeat(null);
	veDichRefreshScores();
	window.GameVariables.IsVeDichQuestionRevealed = true;
	window.GameVariables.VeDichSequenceCounter = 5;
}

/* the star goes on the question NOT on screen yet: the first one while the bar is empty (ready),
 * the next one while the previous is being closed (answered / steal with nobody) */
function veDichStarTarget() {
	var c = window.GameVariables.VeDichSequenceCounter;
	if (c == 4) { return window.GameVariables.VeDichQuestionIndex; }
	if ((c == 9 || (c == 7 && window.GameVariables.VeDichStealSeat === null)) && window.GameVariables.VeDichQuestionIndex < VE_DICH_PICKS) { return window.GameVariables.VeDichQuestionIndex + 1; }
	return null;
}

function veDichPlaceStar() {
	var target = veDichStarTarget();
	if (window.GameVariables.IsVeDichStarUsed || target === null) { return; }
	window.GameVariables.VeDichStar = target;
	window.GameVariables.IsVeDichStarUsed = true;
	setVeDichStar(true);                              /* the clip loops until the question closes */
	startLifelineActiveSound('vd_star.mp3');          /* the sting plays once */
}

function veDichRunClock(kind, dur, music, from) {
	window.GameVariables.VeDichTimerKind = kind;
	window.GameVariables.IsVeDichTimerRunning = true;
	window.GameVariables.IsVeDichTimerDone = false;
	startVeDichTimer(kind === 'steal');   /* the steal window runs right -> left */
	if (music) { startShortPassiveSound(music); seekShortPassiveSound(from); }
	startClock({
		mode: 'down', duration: dur, label: 'vd_' + kind, startAt: from,
		onTick: function (remaining) { setVeDichTimer(1 - remaining / dur); },
		onDone: function () {
			setVeDichTimer(1);
			window.GameVariables.IsVeDichTimerRunning = false;
			window.GameVariables.IsVeDichTimerDone = true;
			window.GameVariables.changed();
		}
	});
}

/* from: seconds already gone (a clock resumed after a crash) */
function veDichStartTimer(from) {
	veDichRunClock('answer', window.GameVariables.VeDichSeconds || 15, window.GameVariables.VeDichValue >= 30 ? 'vd_20s.mp3' : 'vd_15s.mp3', from);
	window.GameVariables.VeDichSequenceCounter = 6;
}

/* a correct answer: the clock and its music stop, the bar stays where it stopped until the
 * question closes (veDichCloseQuestion -> veDichStopTimer) */
function veDichFreezeTimer() {
	if (window.GameVariables.IsVeDichTimerRunning) {
		pauseClock();
		stopShortPassiveSound();
		window.GameVariables.IsVeDichTimerFrozen = true;
	}
	window.GameVariables.IsVeDichTimerRunning = false;
}

function veDichStopTimer() {
	if (window.GameVariables.IsVeDichTimerRunning || window.GameVariables.IsVeDichTimerFrozen) {
		stopClock();
		stopShortPassiveSound();
	}
	window.GameVariables.IsVeDichTimerFrozen = false;
	window.GameVariables.IsVeDichTimerRunning = false;
	window.GameVariables.IsVeDichTimerDone = false;
	window.GameVariables.VeDichTimerKind = null;
	hideVeDichTimer();
}

function veDichAnswerCorrect() {
	veDichFreezeTimer();
	addScore(window.GameVariables.VeDichSeat, window.GameVariables.VeDichValue * (veDichStarred() ? 2 : 1));
	veDichRefreshScores();
	startLongActiveSound('vd_correct.ogg', true);
	window.GameVariables.VeDichResult = 'correct';
	window.GameVariables.VeDichSequenceCounter = 9;
}

function veDichAnswerWrong() {
	veDichStopTimer();
	if (veDichStarred()) {
		addScore(window.GameVariables.VeDichSeat, -window.GameVariables.VeDichValue);
		veDichRefreshScores();
	}
	window.GameVariables.VeDichResult = 'wrong';
	/* no "wrong" sting here - the 5 s music carries the cue; the bar runs backwards */
	veDichRunClock('steal', window.GameVariables.Timings.VE_DICH_STEAL, 'vd_5s.mp3');
	window.GameVariables.VeDichSequenceCounter = 7;
}

/* the 5 s bar and its music keep running after the buzz (they run out on their own) */
function veDichStealBuzz(seat) {
	if (seat === window.GameVariables.VeDichSeat || window.GameVariables.VeDichStealSeat !== null || !window.GameVariables.getPlayer(seat)) { return; }
	window.GameVariables.VeDichStealSeat = seat;
	setVeDichStealSeat(seat);
	playBuzzerSound();   /* the Khởi động buzzer, reused */
	window.GameVariables.VeDichSequenceCounter = 8;
}

function veDichStealCorrect() {
	addScore(window.GameVariables.VeDichStealSeat, window.GameVariables.VeDichValue);
	if (!veDichStarred()) { addScore(window.GameVariables.VeDichSeat, -window.GameVariables.VeDichValue); }
	veDichRefreshScores();
	startLongActiveSound('vd_correct.ogg', true);
	window.GameVariables.VeDichStealResult = 'correct';
	window.GameVariables.VeDichSequenceCounter = 9;
}

function veDichStealWrong() {
	addScore(window.GameVariables.VeDichStealSeat, -Math.round(window.GameVariables.VeDichValue * window.GameVariables.Points.VE_DICH_STEAL_WRONG_RATIO));
	veDichRefreshScores();
	startLongActiveSound('vd_wrong.ogg', true);
	window.GameVariables.VeDichStealResult = 'wrong';
	window.GameVariables.VeDichSequenceCounter = 9;
}

function veDichCloseQuestion() {
	veDichStopTimer();
	setVeDichStealSeat(null);
	if (window.GameVariables.VeDichQuestionIndex < VE_DICH_PICKS) {
		veDichShowNextQuestion(window.GameVariables.VeDichQuestionIndex + 1);
		return;
	}
	/* third question closed: question bar + score box off, bare background */
	if (window.GameVariables.VeDichDone.indexOf(window.GameVariables.VeDichSeat) === -1) { window.GameVariables.VeDichDone.push(window.GameVariables.VeDichSeat); }
	hideVeDichQuestionGroup();
	setContestantOnStage(null);
	startGeneralSound('vd_turn_complete.mp3');
	window.GameVariables.IsVeDichQuestionRevealed = false;
	window.GameVariables.VeDichSequenceCounter = 10;
}

/* Left on the bare background: the next contestant - or the end of the round */
function veDichNextTurn() {
	var seat = veDichNextSeat();
	if (seat !== null) { veDichCallToStage(seat); return; }
	hideVeDich();
	window.GameVariables.ActiveSeat = null;
	window.GameVariables.VeDichSequenceCounter = 11;
}

function veDichFinishRound() {
	veDichStopTimer();
	hideVeDich();
	window.GameVariables.VeDichSequenceCounter = 12;
}

/* ---------- control panel ---------- */

/* Restart the round from the title (scores untouched). */
function veDichReset() {
	veDichStopTimer();
	hideTitleCard();
	hideVeDich();
	setContestantOnStage(null);
	veDichResetState();
	window.GameVariables.VeDichSequenceCounter = 0;
}

/* Re-run seat N's turn from the stage call (its "done" mark is cleared). */
function veDichGoto(seat) {
	if (!window.GameVariables.getPlayer(seat)) { return; }
	hideTitleCard();
	var i = window.GameVariables.VeDichDone.indexOf(seat);
	if (i !== -1) { window.GameVariables.VeDichDone.splice(i, 1); }
	hideVeDichQuestionGroup();
	veDichCallToStage(seat);
}

/* Fix the playing order by hand: [seat, seat, seat, seat] - anything else goes back to "highest
 * score first". Seats already played stay where they are. */
function veDichSetOrder(list) {
	var seats = [];
	(list || []).forEach(function (s) { s = parseInt(s, 10); if (window.GameVariables.getPlayer(s) && seats.indexOf(s) === -1) { seats.push(s); } });
	if (seats.length !== window.GameVariables.Players.length) {
		window.GameVariables.IsVeDichOrderManual = false;
		window.GameVariables.VeDichOrder = veDichComputeOrder();
		return;
	}
	window.GameVariables.IsVeDichOrderManual = true;
	window.GameVariables.VeDichOrder = window.GameVariables.VeDichDone.concat(seats.filter(function (s) { return window.GameVariables.VeDichDone.indexOf(s) === -1; }));
}
