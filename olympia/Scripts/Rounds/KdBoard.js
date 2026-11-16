/*
 * Olympia Controller - Khởi động, the BOARD turn (Luật rừng 2 only: Rules.js gv.kdBoardValues()).
 * Played after the common turn, still in round 'kd' (KhoiDongMode 'board'). Which key calls which
 * step: KeyboardController.js (kdBoardKey). Graphics: KdBoardControl.js.
 *
 * Six questions on a board, worth 10 10 15 15 20 20. Keys 1-6 pick a tile, top to bottom then
 * left to right (1, 2 = 10; 3, 4 = 15; 5, 6 = 20). The board and the question are two screens:
 * the board goes (Olympia 26: it closes, the picked tile red), the question comes on the Khởi
 * động question bar and the buzzers open; the first press answers. Right: + the tile's value. Wrong: nothing lost, that seat is out
 * of the tile and the others may buzz; a second wrong answer closes the tile. Nobody buzzing:
 * Down closes it.
 *
 *     Left    (common turn finished)  kd_ready
 *     Left    (0 ready)    board + contestant bars + vcnv_open_board
 *     1-6     (1 board)    pick a tile still open: question on the bar, buzzers open
 *     1-4     (2 question) buzz - the first press locks the tile, kd_buzz
 *     Space   (2)          the 3-2-1 think clock
 *     Up      (2, buzzed)  right: + value, kd_correct, the tile closes
 *     Down    (2)          wrong: the seat is out of the tile (no deduction); after the second
 *                          wrong answer, or with nobody buzzed, the tile closes
 *     Backspace (2)        clear a mistaken buzz
 *     Right   (3 closed)   the question goes - back to the board (all six asked: 4 done)
 *     Left    (4 done)     graphics off, kd_complete -> 5
 *     Left    (5 finished) on to Vượt chướng ngại vật
 *
 * KdBoardSequenceCounter: 0 ready  1 board  2 question  3 closed  4 done  5 finished
 */

var KD_BOARD_MAX_ANSWERS = 2;   /* the first buzz and one more after a wrong answer */

function kdBoardOn() { return window.GameVariables.KhoiDongMode === 'board'; }

/* the six tiles from <board> in khoidong.xml: the k-th tile of a value takes the k-th question of
 * that value (questions without a value fill the gaps in order) */
function kdBoardBuildTiles() {
	var g = window.GameVariables, values = g.kdBoardValues() || [];
	var list = ((g.KhoiDongQuestions || {}).board || []).slice(), used = [];
	function take(v) {
		for (var i = 0; i < list.length; i++) { if (used.indexOf(i) === -1 && list[i].value === v) { used.push(i); return list[i]; } }
		for (var j = 0; j < list.length; j++) { if (used.indexOf(j) === -1 && !list[j].value) { used.push(j); return list[j]; } }
		return null;
	}
	return values.map(function (v) {
		var q = take(v);
		return { value: v, text: q && q.text ? q.text : g.MissingQuestionText, answer: q ? (q.answer || '') : '', status: 'open', seat: null };
	});
}

function kdBoardTileNow() { return window.GameVariables.KdBoardTiles[window.GameVariables.KdBoardTile - 1] || null; }

function kdBoardTilesForScreen() {
	var g = window.GameVariables;
	return g.KdBoardTiles.map(function (t) {
		var p = t.seat ? g.getPlayer(t.seat) : null;
		return { value: t.value, status: t.status, name: p ? g.displayName(p) : '' };
	});
}

function kdBoardRefresh() {
	if (isKdBoardShowing()) { setKdBoard(kdBoardTilesForScreen(), 0); }
	refreshContestantBars();
}

/* contestant bars while a tile is asked: seats ruled wrong on it are grey (ScoreboardControl.js) */
function kdBoardBarLook(seat) {
	var g = window.GameVariables;
	if (!kdBoardOn() || g.KdBoardSequenceCounter != 2) { return null; }
	return { grey: g.KdBoardOut.indexOf(seat) !== -1 };
}

function kdBoardClearTileState() {
	var g = window.GameVariables;
	g.KdBoardBuzzSeat = null;
	g.KdBoardOut = [];
	g.KdBoardAnswers = 0;
	g.KdBoardLastResult = null;
}

/* ---------- steps ---------- */

/* Left after the common turn: the board turn starts (its own "get ready" sting) */
function kdBoardReady() {
	var g = window.GameVariables;
	g.KhoiDongMode = 'board';
	g.KhoiDongSeat = null;
	g.KdBoardTiles = kdBoardBuildTiles();
	g.KdBoardTile = 0;
	kdBoardClearTileState();
	setContestantOnStage(null);
	clearBuzzers();
	setKdTurnLabel('');
	startGeneralSound('kd_ready.ogg');
	g.KdBoardSequenceCounter = 0;
}

/* Left (ready): the board and the bars come in */
function kdBoardShow() {
	var g = window.GameVariables;
	setQuestionBarVariant('plain');
	clearQuestionBar();
	hideQuestionBar();
	showRoundGraphics();
	showKdBoard(kdBoardTilesForScreen(), 0);
	revealContestantBars();
	startGeneralSound('vcnv_open_board.mp3');
	g.KdBoardSequenceCounter = kdBoardOpenCount() ? 1 : 4;
	kdBoardRefresh();
}

function kdBoardOpenCount() { return window.GameVariables.KdBoardTiles.filter(function (t) { return t.status === 'open'; }).length; }

/* 1-6 (board): the tile's question on the bar, buzzers open */
function kdBoardPick(n) {
	var g = window.GameVariables, t = g.KdBoardTiles[n - 1];
	if (g.KdBoardSequenceCounter != 1 || !t || t.status !== 'open') { return; }
	g.KdBoardTile = n;
	kdBoardClearTileState();
	clearBuzzers();
	hideThinkClock();
	setKdBoard(kdBoardTilesForScreen(), n);   /* the picked tile lit as the board goes */
	hideKdBoard();
	setQuestionBarVariant('plain');
	setQuestionText(t.text);
	setKdTurnLabel('Ô ' + n + ' · ' + t.value + ' điểm');
	startGeneralSound('vcnv_select_row.mp3');
	g.KdBoardSequenceCounter = 2;
	g.IsKdBoardQuestionUp = false;
	/* the question screen once the board has gone (O26: its closing); the buzzers open with it */
	var token = g.KdBoardPickToken = (g.KdBoardPickToken || 0) + 1;
	setTimeout(function () {
		if (g.KdBoardPickToken !== token || !kdBoardOn() || (g.KdBoardSequenceCounter != 2 && g.KdBoardSequenceCounter != 3)) { return; }
		showQuestionBar();
		g.IsKdBoardQuestionUp = true;
		g.changed();
	}, kdBoardCloseMs());
	kdBoardRefresh();
}

/* 1-4 (question): the first press locks the tile */
function kdBoardBuzz(seat) {
	var g = window.GameVariables;
	if (!kdBoardOn() || g.KdBoardSequenceCounter != 2 || g.KdBoardBuzzSeat !== null || g.IsKdBoardQuestionUp === false) { return; }   /* not before the question is on screen */
	if (!g.getPlayer(seat) || g.KdBoardOut.indexOf(seat) !== -1) { return; }
	g.KdBoardBuzzSeat = seat;
	setContestantBuzzed(seat, true);
	playBuzzerSound();
}

function kdBoardClearBuzz() {
	var g = window.GameVariables;
	if (g.KdBoardSequenceCounter != 2) { return; }
	g.KdBoardBuzzSeat = null;
	clearBuzzers();
	kdBoardRefresh();
}

function kdBoardCloseTile(status, seat) {
	var g = window.GameVariables, t = kdBoardTileNow();
	if (t) { t.status = status; t.seat = seat || null; }
	g.KdBoardSequenceCounter = 3;
	kdBoardRefresh();
}

/* Up: right - the tile's value */
function kdBoardJudgeCorrect() {
	var g = window.GameVariables, seat = g.KdBoardBuzzSeat, t = kdBoardTileNow();
	if (g.KdBoardSequenceCounter != 2 || seat === null || !t) { return; }
	hideThinkClock();
	startLongActiveSound('kd_correct.mp3');
	addScore(seat, t.value);
	g.KdBoardAnswers += 1;
	g.KdBoardLastResult = 'correct';
	kdBoardCloseTile('right', seat);
}

/* Down: the buzzed seat is wrong (nothing lost) - or nobody buzzed: the tile closes */
function kdBoardJudgeWrong() {
	var g = window.GameVariables, seat = g.KdBoardBuzzSeat;
	if (g.KdBoardSequenceCounter != 2) { return; }
	hideThinkClock();
	startLongActiveSound('kd_wrong.ogg');
	if (seat === null) {   /* nobody wants it */
		g.KdBoardLastResult = 'none';
		kdBoardCloseTile('none', null);
		return;
	}
	g.KdBoardOut.push(seat);
	g.KdBoardAnswers += 1;
	g.KdBoardBuzzSeat = null;
	g.KdBoardLastResult = 'wrong';
	clearBuzzers();
	var left = g.Players.filter(function (p) { return g.KdBoardOut.indexOf(p.seat) === -1; }).length;
	if (g.KdBoardAnswers >= KD_BOARD_MAX_ANSWERS || !left) { g.KdBoardLastResult = 'none'; kdBoardCloseTile('none', null); return; }   /* nobody right: the tile closes */
	kdBoardRefresh();   /* the others may buzz once more */
}

/* Right (closed): back to the board */
function kdBoardBackToBoard() {
	var g = window.GameVariables;
	if (g.KdBoardSequenceCounter != 3) { return; }
	hideThinkClock();
	clearBuzzers();
	clearQuestionBar();
	hideQuestionBar();
	setKdTurnLabel('');
	kdBoardClearTileState();
	g.KdBoardPickToken = (g.KdBoardPickToken || 0) + 1;   /* a question bar still to come stays away */
	g.KdBoardSequenceCounter = kdBoardOpenCount() ? 1 : 4;
	showKdBoard(kdBoardTilesForScreen(), 0);
	startGeneralSound('vcnv_open_board.mp3');
	kdBoardRefresh();
}

/* Left (done): graphics off, the Khởi động completion sting */
function kdBoardFinish() {
	var g = window.GameVariables;
	hideKdBoard();
	setKdTurnLabel('');
	khoiDongHideGraphicsThenComplete();
	g.KdBoardSequenceCounter = 5;
	g.KhoiDongSequenceCounter = 6;
}

/* F1 away / back (GeneralControl.js) */
function kdBoardLeave() { window.GameVariables.KdBoardPickToken = (window.GameVariables.KdBoardPickToken || 0) + 1; hideThinkClock(); hideKdBoard(); setKdTurnLabel(''); }
function kdBoardEnter() {
	var g = window.GameVariables, c = g.KdBoardSequenceCounter;
	if (!kdBoardOn() || c < 1 || c > 4) { return; }
	setQuestionBarVariant('plain');
	if (c == 2 || c == 3) {   /* the question screen */
		var t = kdBoardTileNow();
		setQuestionText(t ? t.text : '');
		setKdTurnLabel(t ? 'Ô ' + g.KdBoardTile + ' · ' + t.value + ' điểm' : '');
		showQuestionBar();
		g.IsKdBoardQuestionUp = true;
	}
	else { showKdBoard(kdBoardTilesForScreen(), 0); }
	revealContestantBars();
	kdBoardRefresh();
}

/* ---------- control panel ---------- */

/* the board turn from the start (scores untouched; the tiles open again) */
function kdBoardReset() {
	var g = window.GameVariables;
	hideKdBoard();
	khoiDongHideGraphicsNow();
	setKdTurnLabel('');
	g.KhoiDongMode = 'board';
	g.KdBoardTiles = kdBoardBuildTiles();
	g.KdBoardTile = 0;
	kdBoardClearTileState();
	g.KdBoardSequenceCounter = 0;
	g.KhoiDongSequenceCounter = 6;
}

/* every board turn state back to nothing (the whole Khởi động restarted) */
function kdBoardClear() {
	var g = window.GameVariables;
	hideKdBoard();
	g.KdBoardTiles = [];
	g.KdBoardTile = 0;
	kdBoardClearTileState();
	g.KdBoardSequenceCounter = 0;
}

/* for the control panel / players (PanelStateControl.js) */
function kdBoardState(withAnswer) {
	var g = window.GameVariables, t = kdBoardTileNow(), c = g.KdBoardSequenceCounter;
	var o = {
		phase: g.KdBoardPhaseNames[c],
		tiles: g.KdBoardTiles.map(function (x) { return { value: x.value, status: x.status, seat: x.seat }; }),
		tile: g.KdBoardTile,
		value: t ? t.value : 0,
		buzzSeat: g.KdBoardBuzzSeat,
		out: g.KdBoardOut.slice(),
		answers: g.KdBoardAnswers,
		lastResult: g.KdBoardLastResult,
		up: (c == 2 || c == 3) && g.IsKdBoardQuestionUp !== false,   /* the question is on screen (the board has gone) */
		question: (c == 2 || c == 3) && t && (withAnswer || g.IsKdBoardQuestionUp !== false) ? t.text : ''
	};
	if (withAnswer) { o.answer = (c == 2 || c == 3) && t ? t.answer : ''; }
	return o;
}
