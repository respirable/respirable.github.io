/*
 * Olympia Controller - Vượt chướng ngại vật graphics (O24/Beat the Obstacle/*).
 *
 * .vcnvPictureDiv   ONE picture under 5 covers (quarters 1 TL, 2 TR, 3 BR, 4 BL + centre).
 * .vcnvBoardDiv     "CHƯỚNG NGẠI VẬT CÓ N CHỮ CÁI" + one strip of letter circles per row + badges.
 * .vcnvQuestionDiv  question bar; along its bottom edge the tabs of contestants who signalled
 *                   to answer the CNV (obstacle_answer_signal_bar.png + name), in press order;
 *                   the 15 s bar sits on the dark strip at its bottom.
 *
 * Everything is instant - no transitions in this round. Rounds/VCNV.js drives it.
 */

var VCNV_ASSETS = 'O24/Beat the Obstacle/Obstacle/';
var VCNV_MAX_CELLS = 10;        /* longer answers show only their first 10 letters */
var VCNV_CELL = 75;             /* circle diameter, px - keep in step with .vcnvCell in olympia.css */
var VCNV_DEFAULT_PITCH = 70;    /* centre-to-centre when there is room */
var VCNV_STRIP_WIDTH = 715;     /* space before the row badges */
var VCNV_TIMER_WIDTH = 839;     /* px - keep in step with .vcnvTimerDiv in olympia.css */

function obstacleTitleText() {
	var data = window.GameVariables.VcnvData || { keyword: '' };
	var keyword = data.keyword || '';

	var chars = keyword.replace(/\s+/g, '');

	var hasLetter = /\p{L}/u.test(chars);
	var hasDigit = /\p{N}/u.test(chars);
	var hasSymbol = /[^\p{L}\p{N}]/u.test(chars);

	var kind;
	if (hasLetter && !hasDigit && !hasSymbol) {
		kind = 'CHỮ CÁI';
	} else if (hasDigit && !hasLetter && !hasSymbol) {
		kind = 'CHỮ SỐ';
	} else {
		kind = 'KÍ TỰ'; // chỉ có kí tự, hoặc trộn 2+ loại
	}

	return 'CHƯỚNG NGẠI VẬT CÓ ' + window.GameVariables.vcnvLength(keyword) + ' ' + kind;
}

/* ---------- build ---------- */

/* the picture: image + 5 covers (the frame PNGs already carry their number) */
function buildObstaclePicture(data) {
	var p = document.querySelector('.vcnvDiv .vcnvPictureDiv');
	p.textContent = '';
	newImage(data.image || 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', 'vcnvPhotoImg', p);   /* no picture (yet): a blank pixel, not a broken image */
	[1, 2, 3, 4].forEach(function (n) {
		var cover = newElement('div', 'vcnvCover vcnvCover' + n, p);
		newImage(VCNV_ASSETS + 'picture_frame_' + n + '.png', '', cover);
	});
	var mid = newElement('div', 'vcnvCover vcnvCoverMiddle', p);
	newImage(VCNV_ASSETS + 'picture_frame_middle.png', '', mid);
}

/* one strip of circles; at most VCNV_MAX_CELLS are shown - a longer answer is cut, not squeezed */
function buildObstacleStrip(answer) {
	var strip = newElement('div', 'vcnvStrip');
	var letters = String(answer || '').replace(/\s+/g, '').split('').slice(0, VCNV_MAX_CELLS);
	var n = letters.length;
	var pitch = n > 1 ? Math.min(VCNV_DEFAULT_PITCH, Math.floor((VCNV_STRIP_WIDTH - VCNV_CELL) / (n - 1))) : VCNV_DEFAULT_PITCH;
	strip.style.setProperty('--pitch', pitch + 'px');
	letters.forEach(function (ch, i) {
		var cell = newElement('div', 'vcnvCell', strip);
		cell.style.left = (i * pitch) + 'px';
		newImage(VCNV_ASSETS + 'obstacle_row_keyword_idle.png', 'idle', cell);
		newImage(VCNV_ASSETS + 'obstacle_row_keyword_chosen.png', 'chosen', cell);
		newImage(VCNV_ASSETS + 'obstacle_row_keyword_wrong.png', 'wrong', cell);
		newElement('p', 'vcnvLetterP', cell).textContent = ch;   /* shown only when the cell is .revealed */
	});
	return strip;
}

/* the board: title + 4 strips + 4 badges */
function buildObstacleBoard(data) {
	var b = document.querySelector('.vcnvDiv .vcnvBoardDiv');
	b.textContent = '';
	newImage(VCNV_ASSETS + 'obstacle_hint_board_with_obstacle_keyword_length_bar.png', 'vcnvBoardImg', b);
	newElement('p', 'vcnvBoardTitleP', b).textContent = obstacleTitleText();
	(data.rows || []).slice(0, 4).forEach(function (row, i) {
		var strip = buildObstacleStrip(row.answer);
		strip.classList.add('vcnvStrip' + (i + 1));
		b.appendChild(strip);
		newImage(VCNV_ASSETS + 'row_' + (i + 1) + '.png', 'vcnvBadgeImg vcnvBadge' + (i + 1), b);
	});
}

/* the question bar: text, signal tabs, 15 s bar */
function buildObstacleQuestionBar() {
	var q = document.querySelector('.vcnvDiv .vcnvQuestionDiv');
	q.textContent = '';
	newImage(VCNV_ASSETS + 'question_bar.png', 'vcnvQuestionImg', q);
	newElement('p', 'vcnvQuestionTextP', q);
	newElement('div', 'vcnvSignalsDiv', q);
	var timer = newElement('div', 'vcnvTimerDiv', q);
	newElement('div', 'vcnvTimerFill', timer);
	newElement('div', 'vcnvTimerDot', timer);
}

/* Rebuild everything from VcnvData. Safe to call again after a data reload. */
function renderObstacleBoard() {
	if (!document.querySelector('.vcnvDiv')) { return; }
	var data = window.GameVariables.VcnvData || { keyword: '', image: '', rows: [] };
	buildObstaclePicture(data);
	buildObstacleBoard(data);
	buildObstacleQuestionBar();
	window.GameVariables.IsObstacleBoardBuilt = true;
}

/* ---------- show / hide (instant) ---------- */

function isObstacleBoardShowing() {
	var root = document.querySelector('.vcnvDiv');
	return !!(root && !root.classList.contains('offstage'));
}

function showObstacleBoard() {
	var root = document.querySelector('.vcnvDiv');
	if (!root) { return; }
	if (!window.GameVariables.IsObstacleBoardBuilt) { renderObstacleBoard(); }
	root.classList.remove('offstage');
}

function hideObstacleBoard() {
	var root = document.querySelector('.vcnvDiv');
	if (root) { root.classList.add('offstage'); }
}

/* ---------- question bar ---------- */

function setObstacleQuestion(text) {
	var p = document.querySelector('.vcnvDiv .vcnvQuestionTextP');
	if (p) { p.textContent = text || ''; }
}

/* ---------- rows: 'closed' (blue), 'open' (cyan, no letters), 'correct' (cyan + letters), 'wrong' (grey) ---------- */

function setObstacleCells(row, cls) {
	var strip = document.querySelector('.vcnvDiv .vcnvStrip' + row);
	if (!strip) { return; }
	strip.querySelectorAll('.vcnvCell').forEach(function (cell) {
		cell.classList.remove('selected', 'revealed', 'wrong');
		if (cls) { cell.classList.add(cls); }
	});
}

function setObstacleRowState(row, state) {
	setObstacleCells(row, state === 'open' ? 'selected' : state === 'correct' ? 'revealed' : state === 'wrong' ? 'wrong' : null);
}

/* ---------- picture covers: 1..4 or 'middle' ---------- */

function openObstacleCover(n) {
	var cover = document.querySelector('.vcnvDiv .vcnvCover' + (n === 'middle' ? 'Middle' : n));
	if (cover) { cover.classList.add('open'); }
}

function resetObstacleCovers() {
	document.querySelectorAll('.vcnvDiv .vcnvCover').forEach(function (c) { c.classList.remove('open'); });
}

/* ---------- board title: the letter count normally, the keyword itself once solved ---------- */

function setObstacleTitle(text) {
	var p = document.querySelector('.vcnvDiv .vcnvBoardTitleP');
	if (p) { p.textContent = text; }
}

/* ---------- CNV signal tabs, in press order ---------- */
/* Drawn on the question bar AND on the stage-level twin used while the answer tree is up (the
 * bar is hidden then), so a signal made mid-tree shows at the same spot. */
function setObstacleSignals(seats) {
	var boxes = [document.querySelector('.vcnvQuestionDiv .vcnvSignalsDiv'), document.querySelector('.vcnvTreeSignalsDiv')];
	boxes.forEach(function (box) {
		if (!box) { return; }
		box.textContent = '';
		(seats || []).forEach(function (seat) {
			var p = window.GameVariables.getPlayer(seat);
			if (!p) { return; }
			var tab = newElement('div', 'vcnvSignalTab', box);
			newImage(VCNV_ASSETS + 'obstacle_answer_signal_bar.png', '', tab);
			newElement('p', 'vcnvSignalNameP', tab).textContent = window.GameVariables.displayName(p);
		});
	});
}

/* ---------- 15 s bar: fraction 0..1 -> red fill from the left, dot riding its right edge ---------- */

function startObstacleTimer() {
	setObstacleTimer(0);
	var timer = document.querySelector('.vcnvDiv .vcnvTimerDiv');
	if (timer) { timer.classList.add('visible'); }
}

function setObstacleTimer(fraction) {
	var fill = document.querySelector('.vcnvDiv .vcnvTimerFill');
	var dot = document.querySelector('.vcnvDiv .vcnvTimerDot');
	if (!fill || !dot) { return; }
	var w = Math.round(Math.max(0, Math.min(1, fraction)) * VCNV_TIMER_WIDTH);
	fill.style.width = w + 'px';
	dot.style.left = (w - TIMER_DOT / 2) + 'px';
}

function hideObstacleTimer() {
	var timer = document.querySelector('.vcnvDiv .vcnvTimerDiv');
	if (timer) { timer.classList.remove('visible'); }
}

/* ---------- everything visible: all covers off, every strip's letters, keyword as title ---------- */

function revealWholeObstacle(keyword) {
	document.querySelectorAll('.vcnvDiv .vcnvCover').forEach(function (c) { c.classList.add('open'); });
	[1, 2, 3, 4].forEach(function (r) { setObstacleCells(r, 'revealed'); });
	if (keyword) { setObstacleTitle(keyword); }
}

/* Back to the untouched board (used by reset). */
function resetObstacleBoard() {
	resetObstacleCovers();
	[1, 2, 3, 4].forEach(function (r) { setObstacleCells(r, null); });
	setObstacleQuestion('');
	setObstacleSignals([]);
	hideObstacleTimer();
	setObstacleTitle(obstacleTitleText());
}
