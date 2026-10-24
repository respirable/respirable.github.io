/*
 * Olympia Controller - Vượt chướng ngại vật (round 2): the STEP functions.
 * Which key calls which step is in KeyboardController.js (search for "round == 'vcnv'").
 *
 *   F2 / Left after KĐ   title card + vcnv_start
 *   Left      (title)    title off, board + picture + question bar shown + vcnv_open_board
 *
 *   ROWS - the host opens rows in any order; there is no "whose turn" in software.
 *   1-4       (board)        select row N (if still closed): circles cyan, VcnvOpenedCount++,
 *                            vcnv_select_row
 *   5         (board)        the CENTRE question - only once all 4 rows are done and the CNV is
 *                            unsolved; right -> +10 each, middle cover off, CNV prize = 20
 *   U         (rowSelected)  undo the selection (only before the question is revealed)
 *   Right     (rowSelected)  question on the bar, vcnv_open_question
 *   Right     (rowQuestion)  15 s bar under the question + vcnv_15s
 *   1-4       (rowQuestion / rowTimer / rowAnswers)  toggle "seat N answered this row right"
 *                            (the +10 is paid when the row is graded)
 *   Right     (rowTimer)     (stops the bar) VCNV graphics away, ANSWER TREE in
 *   Right     (rowAnswers)   grade: wrong branches monochrome; letters + vcnv_row_correct, or grey
 *                            circles + vcnv_row_wrong
 *   Right     (rowGraded)    tree off, VCNV graphics back
 *   Right     (rowBack)      picture quarter if the row was right (vcnv_open_picture) -> board
 *
 *   OBSTACLE - the first signal LOCKS the row flow at once; everyone who signals answers aloud
 *   together, then the host declares the outcome.
 *   Q W E R   (any row step, >=1 row opened) seat 1-4 signals: joins the queue, name tab under the
 *             question bar, vcnv_signal -> guessing (a running 15 s bar keeps running)
 *   Q W E R / 1-4 (guessing, seat in the queue)  THAT seat was right: prize by rows opened
 *             (1:60 2:50 3:40 4:30, 20 after the centre), everything revealed, vcnv_solved
 *   Backspace (guessing)  remove the last signal; queue empty -> back to the paused row step
 *   0         (guessing)  everyone in the queue was wrong: all eliminated, vcnv_row_wrong
 *   Left      (finished)  graphics off -> done;  Left (done) -> Tăng tốc
 *
 *   ENDINGS without a solver
 *   Right     (board, all 5 questions done, unsolved)  FINAL WINDOW: 15 s on the empty bar for
 *             last signals; when it runs out, Right once more reveals everything (no prize).
 *   Right     (any row step, all four eliminated)  everything revealed at once.
 *
 * VcnvSequenceCounter (table in Variables.js):
 *   0 idle  1 title  2 board  3 rowSelected  4 rowQuestion  5 rowTimer  6 rowAnswers  7 rowGraded
 *   8 rowBack  9 guessing  10 finalWindow  11 finished  12 done
 */

var VCNV_CENTER = 5;   /* VcnvRows[4] */

function vcnvData() { return window.GameVariables.VcnvData || { keyword: '', rows: [], center: null }; }
function vcnvRow(n) { return window.GameVariables.VcnvRows[n - 1]; }
function vcnvIsEliminated(seat) { return window.GameVariables.VcnvEliminated.indexOf(seat) !== -1; }
function vcnvInQueue(seat) { return window.GameVariables.VcnvQueue.indexOf(seat) !== -1; }

/* board, a row step, or the final window (the steps where a CNV signal is accepted) */
function vcnvIsRowStep() {
	var c = window.GameVariables.VcnvSequenceCounter;
	return (c >= 2 && c <= 8) || c == 10;
}

/* question/answer data for row 1..4 or the centre (5) */
function vcnvQuestionFor(n) {
	var d = vcnvData();
	if (n == VCNV_CENTER) { return d.center || { text: '', answer: '' }; }
	return (d.rows || [])[n - 1] || { text: '', answer: '' };
}

/* the centre may be opened once every row has been asked and the obstacle is still unsolved */
function vcnvCenterAvailable() {
	return !window.GameVariables.IsVcnvSolved &&
		window.GameVariables.VcnvRows.slice(0, 4).every(function (r) { return r.status === 'correct' || r.status === 'wrong'; }) &&
		vcnvRow(VCNV_CENTER).status === 'closed';
}

function vcnvAllEliminated() {
	return window.GameVariables.Players.length > 0 && window.GameVariables.Players.every(function (p) { return vcnvIsEliminated(p.seat); });
}

/* every hint (4 rows + centre) has been asked and nobody has the obstacle yet */
function vcnvFinalWindowAvailable() {
	return !window.GameVariables.IsVcnvSolved && !window.GameVariables.IsVcnvFinalWindowUsed &&
		window.GameVariables.VcnvRows.every(function (r) { return r.status === 'correct' || r.status === 'wrong'; });
}

function vcnvResetState() {
	window.GameVariables.VcnvCurrentRow = null;
	window.GameVariables.VcnvOpenedCount = 0;
	window.GameVariables.IsVcnvFinalWindowUsed = false;
	window.GameVariables.IsVcnvFinalWindowExpired = false;
	window.GameVariables.VcnvQueue = [];
	window.GameVariables.VcnvEliminated = [];
	window.GameVariables.VcnvCurrentQuestion = '';
	window.GameVariables.VcnvCurrentAnswer = '';
	window.GameVariables.VcnvKeyword = vcnvData().keyword || '';
	window.GameVariables.IsVcnvSolved = false;
	window.GameVariables.VcnvSolvedBy = null;
	vcnvStopTimer();
	window.GameVariables.VcnvRows = [1, 2, 3, 4, 5].map(function () {
		return { status: 'closed', correctSeats: [], answers: { 1: '', 2: '', 3: '', 4: '' } };
	});
	window.GameVariables.IsVcnvCenterOpened = false;
	window.GameVariables.Players.forEach(function (p) { p.isEliminatedFromVCNV = false; });
}

function vcnvSyncEliminated() {
	window.GameVariables.Players.forEach(function (p) { p.isEliminatedFromVCNV = vcnvIsEliminated(p.seat); });
	refreshContestantBars();
}

/* ---------- entrance ---------- */

function vcnvShowTitle() {
	showTitleCard('vcnv');
	startGeneralSound('vcnv_start.mp3');
	window.GameVariables.VcnvSequenceCounter = 1;
}

function vcnvShowBoard() {
	hideTitleCard();
	vcnvResetState();
	renderObstacleBoard();
	showRoundGraphics();
	showObstacleBoard();
	startGeneralSound('vcnv_open_board.mp3');
	window.GameVariables.VcnvSequenceCounter = 2;
}

/* ---------- rows ---------- */

/* (1) pick the row: circles go cyan, nothing on the question bar yet */
function vcnvSelectRow(n) {
	var r = vcnvRow(n);
	if (!r || r.status !== 'closed') { return; }
	if (n == VCNV_CENTER && !vcnvCenterAvailable()) { return; }
	r.status = 'open';
	r.correctSeats = [];
	window.GameVariables.VcnvCurrentRow = n;
	if (n != VCNV_CENTER) { window.GameVariables.VcnvOpenedCount += 1; }   /* the centre is not one of the 4 hint rows */
	window.GameVariables.VcnvCurrentQuestion = '';
	window.GameVariables.VcnvCurrentAnswer = vcnvQuestionFor(n).answer || '';   /* host sees the answer as soon as the row is picked */
	setObstacleRowState(n, 'open');
	startGeneralSound('vcnv_select_row.mp3');
	window.GameVariables.VcnvSequenceCounter = 3;
}

/* U: the pick was a mistake - only possible before the question is revealed */
function vcnvUnselectRow() {
	var n = window.GameVariables.VcnvCurrentRow, r = vcnvRow(n);
	if (!r) { return; }
	r.status = 'closed';
	if (n != VCNV_CENTER) { window.GameVariables.VcnvOpenedCount = Math.max(0, window.GameVariables.VcnvOpenedCount - 1); }
	window.GameVariables.VcnvCurrentRow = null;
	window.GameVariables.VcnvCurrentAnswer = '';
	setObstacleRowState(n, 'closed');
	window.GameVariables.VcnvSequenceCounter = 2;
}

/* (2) Right: the question itself, instant */
function vcnvRevealQuestion() {
	var n = window.GameVariables.VcnvCurrentRow;
	window.GameVariables.VcnvCurrentQuestion = vcnvQuestionFor(n).text || (n == VCNV_CENTER ? '(thiếu câu ô trung tâm)' : '(thiếu câu hàng ' + n + ')');
	setObstacleQuestion(window.GameVariables.VcnvCurrentQuestion);
	startGeneralSound('vcnv_open_question.mp3');
	window.GameVariables.VcnvSequenceCounter = 4;
}

/* (3) Right: 15 s bar - one clock drives the bar, the control panel and the end */
/* from: seconds already gone (a clock resumed after a crash) */
function vcnvStartTimer(from) {
	var dur = window.GameVariables.Timings.VCNV_DECIDE;
	window.GameVariables.IsVcnvTimerRunning = true;
	window.GameVariables.IsVcnvTimerDone = false;
	startObstacleTimer();
	startShortPassiveSound('vcnv_15s.mp3');
	seekShortPassiveSound(from);
	startClock({
		mode: 'down', duration: dur, label: 'vcnv_row', startAt: from,
		onTick: function (remaining) { setObstacleTimer(1 - remaining / dur); },
		onDone: function () {
			setObstacleTimer(1);
			window.GameVariables.IsVcnvTimerRunning = false;
			window.GameVariables.IsVcnvTimerDone = true;
			window.GameVariables.changed();
		}
	});
	window.GameVariables.VcnvSequenceCounter = 5;
}

function vcnvStopTimer() {
	if (window.GameVariables.IsVcnvTimerRunning) {
		stopClock();
		stopShortPassiveSound();
	}
	window.GameVariables.IsVcnvTimerRunning = false;
	window.GameVariables.IsVcnvTimerDone = false;
	hideObstacleTimer();
}

/* (4) Right: the answer tree replaces the VCNV graphics */
function vcnvTreeEntries() {
	var r = vcnvRow(window.GameVariables.VcnvCurrentRow) || { answers: {} };
	return window.GameVariables.Players.map(function (p) {
		return { seat: p.seat, name: window.GameVariables.displayName(p), answer: (r.answers && r.answers[p.seat]) || '' };
	});
}

function vcnvRevealAnswers() {
	if (window.GameVariables.IsVcnvTimerRunning) {
		stopClock();
		stopShortPassiveSound();
		window.GameVariables.IsVcnvTimerRunning = false;
	}
	hideObstacleBoard();
	showRoundGraphics();   /* the answers always come up, even after ',' - with the background */
	showAnswerTree(vcnvTreeEntries());
	startGeneralSound('vcnv_open_answers.ogg');
	window.GameVariables.VcnvSequenceCounter = 6;
}

/* tree off, board back - used by every path that leaves the answers/graded steps */
function vcnvDropTree() {
	if (isAnswerTreeShowing()) {
		hideAnswerTree();
		showObstacleBoard();
	}
}

/* toggle "seat answered the open row correctly" - a mark only; the points come with vcnvGradeRow() */
function vcnvMarkRowCorrect(seat) {
	var r = vcnvRow(window.GameVariables.VcnvCurrentRow);
	if (!r || vcnvIsEliminated(seat) || !window.GameVariables.getPlayer(seat)) { return; }
	var i = r.correctSeats.indexOf(seat);
	if (i === -1) { r.correctSeats.push(seat); } else { r.correctSeats.splice(i, 1); }
}

/* (5) Right: grade - letters or grey; the question bar empties; the picture waits for the next Right */
function vcnvGradeRow() {
	var n = window.GameVariables.VcnvCurrentRow, r = vcnvRow(n);
	if (!r) { return; }
	var pts = n == VCNV_CENTER ? window.GameVariables.Points.VCNV_CENTER : window.GameVariables.Points.VCNV_ROW;
	r.correctSeats.forEach(function (seat) { addScore(seat, pts); });
	if (r.correctSeats.length) {
		r.status = 'correct';
		setObstacleRowState(n, 'correct');
		startLongActiveSound('vcnv_row_correct.mp3');
	}
	else {
		r.status = 'wrong';
		setObstacleRowState(n, 'wrong');
		startLongActiveSound('vcnv_row_wrong.mp3');
	}
	window.GameVariables.VcnvCurrentQuestion = '';
	setObstacleQuestion('');
	vcnvStopTimer();
	gradeAnswerTree(r.correctSeats);
	window.GameVariables.VcnvSequenceCounter = 7;
}

/* (6) Right: tree away, VCNV graphics back */
function vcnvBackToBoard() {
	vcnvDropTree();
	showRoundGraphics();   /* hidden with ',' while grading: the board + picture come back here */
	window.GameVariables.VcnvSequenceCounter = 8;
}

/* (7) Right: the picture quarter (only when the row was answered); row selection unlocked */
function vcnvFinishRow() {
	var n = window.GameVariables.VcnvCurrentRow, r = vcnvRow(n);
	if (r && r.status === 'correct') {
		openObstacleCover(n == VCNV_CENTER ? 'middle' : n);
		if (n == VCNV_CENTER) { window.GameVariables.IsVcnvCenterOpened = true; }
		startGeneralSound('vcnv_open_picture.mp3');
	}
	window.GameVariables.VcnvCurrentRow = null;
	window.GameVariables.VcnvCurrentAnswer = '';
	window.GameVariables.VcnvSequenceCounter = 2;
}

/* ---------- obstacle ---------- */

/* a signal freezes the row flow immediately: remember where we were, switch to guessing */
function vcnvSignal(seat) {
	if (window.GameVariables.VcnvOpenedCount < 1 || vcnvIsEliminated(seat) || vcnvInQueue(seat) || !window.GameVariables.getPlayer(seat)) { return; }
	window.GameVariables.VcnvQueue.push(seat);
	setContestantBuzzed(seat, true);
	setObstacleSignals(window.GameVariables.VcnvQueue);
	startShortActiveSound('vcnv_signal.mp3', true);
	if (window.GameVariables.VcnvSequenceCounter != 9) {
		window.GameVariables.VcnvPhaseBeforeGuess = window.GameVariables.VcnvSequenceCounter;
		window.GameVariables.VcnvSequenceCounter = 9;
	}
}

function vcnvResumeAfterGuess() {
	var back = window.GameVariables.VcnvPhaseBeforeGuess;
	window.GameVariables.VcnvPhaseBeforeGuess = null;
	if (back == 10) {
		window.GameVariables.VcnvSequenceCounter = 10;   /* expired or not, the host decides with the next Right */
		return;
	}
	/* back to the paused row step (the timer, if running, keeps running) - or the board */
	window.GameVariables.VcnvSequenceCounter = (back >= 3 && back <= 8 && window.GameVariables.VcnvCurrentRow) ? back : 2;
	if (vcnvAllEliminated()) { console.log('[VCNV] everyone is out - Right reveals the obstacle'); }
}

function vcnvUnsignal() {
	var seat = window.GameVariables.VcnvQueue.pop();
	if (seat !== undefined) { setContestantBuzzed(seat, false); }
	setObstacleSignals(window.GameVariables.VcnvQueue);
	if (!window.GameVariables.VcnvQueue.length && window.GameVariables.VcnvSequenceCounter == 9) { vcnvResumeAfterGuess(); }
}

function vcnvObstaclePrize() {
	if (window.GameVariables.IsVcnvCenterOpened) { return window.GameVariables.Points.VCNV_AFTER_CENTER; }
	return window.GameVariables.Points.VCNV_OBSTACLE[Math.max(1, Math.min(4, window.GameVariables.VcnvOpenedCount))];
}

function vcnvGuessCorrect(seat) {
	if (!vcnvInQueue(seat)) { return; }   /* a seat that did not signal cannot be picked */
	var prize = vcnvObstaclePrize();
	addScore(seat, prize);
	window.GameVariables.IsVcnvSolved = true;
	window.GameVariables.VcnvSolvedBy = seat;
	vcnvStopTimer();
	vcnvDropTree();
	/* a row still open is neither right nor wrong - it is revealed with everything else */
	window.GameVariables.VcnvCurrentRow = null;
	window.GameVariables.VcnvCurrentQuestion = '';
	window.GameVariables.VcnvCurrentAnswer = '';
	setObstacleQuestion('');
	revealWholeObstacle(window.GameVariables.VcnvKeyword);
	window.GameVariables.VcnvQueue = [];
	clearBuzzers();
	setObstacleSignals([]);
	startLongActiveSound('vcnv_solved.mp3');
	window.GameVariables.VcnvSequenceCounter = 11;
	console.log('[VCNV] solved by seat ' + seat + ' for ' + prize);
}

function vcnvGuessAllWrong() {
	/* they are out from here on - and a "right" mark on the row still in progress (not graded,
	 * so not paid yet) is withdrawn: an eliminated contestant earns nothing more */
	var r = vcnvRow(window.GameVariables.VcnvCurrentRow);
	window.GameVariables.VcnvQueue.forEach(function (seat) {
		if (vcnvIsEliminated(seat)) { return; }
		window.GameVariables.VcnvEliminated.push(seat);
		if (r && r.status === 'open' && r.correctSeats.indexOf(seat) !== -1) {
			r.correctSeats.splice(r.correctSeats.indexOf(seat), 1);
		}
	});
	window.GameVariables.VcnvQueue = [];
	clearBuzzers();
	vcnvSyncEliminated();
	setObstacleSignals([]);
	startLongActiveSound('vcnv_row_wrong.mp3');   /* same "sai" sting as a row nobody got */
	vcnvResumeAfterGuess();
}

/* Everything on show, nothing awarded: time ran out / everyone eliminated / host's choice. */
function vcnvRevealEverything() {
	vcnvStopTimer();
	vcnvDropTree();
	window.GameVariables.VcnvQueue = [];
	clearBuzzers();
	setObstacleSignals([]);
	setObstacleQuestion('');
	window.GameVariables.VcnvCurrentRow = null;
	window.GameVariables.VcnvCurrentQuestion = '';
	window.GameVariables.VcnvCurrentAnswer = '';
	revealWholeObstacle(window.GameVariables.VcnvKeyword);
	window.GameVariables.VcnvSequenceCounter = 11;
}

/* Last chance: 15 s on the empty question bar for signals. */
function vcnvStartFinalWindow() {
	var dur = window.GameVariables.Timings.VCNV_DECIDE;
	window.GameVariables.IsVcnvFinalWindowUsed = true;
	window.GameVariables.IsVcnvFinalWindowExpired = false;
	window.GameVariables.IsVcnvTimerRunning = true;
	window.GameVariables.IsVcnvTimerDone = false;
	setObstacleQuestion('');
	startObstacleTimer();
	startShortPassiveSound('vcnv_15s.mp3');
	startClock({
		mode: 'down', duration: dur, label: 'vcnv_final',
		onTick: function (remaining) { setObstacleTimer(1 - remaining / dur); },
		onDone: function () {
			setObstacleTimer(1);
			window.GameVariables.IsVcnvTimerRunning = false;
			window.GameVariables.IsVcnvTimerDone = true;
			window.GameVariables.IsVcnvFinalWindowExpired = true;   /* nobody: the host reveals with the next Right */
			window.GameVariables.changed();
		}
	});
	window.GameVariables.VcnvSequenceCounter = 10;
}

/* graphics off after the obstacle is solved / revealed (also used by the score summary) */
function vcnvFinishRound() {
	vcnvStopTimer();
	hideAnswerTree();
	hideObstacleBoard();
	clearBuzzers();
	window.GameVariables.VcnvSequenceCounter = 12;
}

/* ---------- control panel ---------- */

function vcnvReset() {
	hideTitleCard();
	hideAnswerTree();
	hideObstacleBoard();
	resetObstacleBoard();
	showRoundGraphics();
	clearBuzzers();
	vcnvResetState();
	vcnvSyncEliminated();
	window.GameVariables.VcnvSequenceCounter = 0;
}

/* The contestants' written answers for one row (row: 1..5, defaults to the current row).
 * A matching answer is auto-marked right (the host may still un-mark it); an auto mark is
 * withdrawn if the answer is edited into something else. Hand marks are never touched. */
function vcnvSetAnswers(rowNumber, answers) {
	var n = rowNumber || window.GameVariables.VcnvCurrentRow;
	var r = vcnvRow(n);
	if (!r || !answers) { return; }
	var expected = vcnvQuestionFor(n).answer;
	var canMark = n == window.GameVariables.VcnvCurrentRow && r.status === 'open';
	r.autoMarked = r.autoMarked || [];
	[1, 2, 3, 4].forEach(function (seat) {
		if (!Object.prototype.hasOwnProperty.call(answers, seat)) { return; }
		r.answers[seat] = String(answers[seat] || '').trim();
		if (!canMark || vcnvIsEliminated(seat)) { return; }
		var hit = window.GameVariables.answerMatches(r.answers[seat], expected);
		var marked = r.correctSeats.indexOf(seat) !== -1;
		var auto = r.autoMarked.indexOf(seat) !== -1;
		if (hit && !marked) { r.correctSeats.push(seat); r.autoMarked.push(seat); }
		else if (!hit && marked && auto) { r.correctSeats.splice(r.correctSeats.indexOf(seat), 1); r.autoMarked.splice(r.autoMarked.indexOf(seat), 1); }
	});
}
