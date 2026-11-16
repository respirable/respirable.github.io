/*
 * Olympia Controller - the graphics of Khởi động's BOARD turn (Luật rừng 2, Rounds/KdBoard.js).
 * Used by the stage and by the audience screen (AudienceMirror.js), so no game logic here.
 *
 * The board is a screen of its own: picking a tile closes it and the tile's question comes on the
 * Khởi động question bar; after the question, the board comes back.
 *
 * .kdBoardDiv   six tiles in 3 columns x 2 rows. Keys 1-6 run top to bottom, then left to right:
 *                   1  3  5        (10)  (15)  (20)
 *                   2  4  6        (10)  (15)  (20)
 *               A tile already asked is grey (who got it is not shown).
 * The board opens with its animation only the first time in the turn (instant = true afterwards);
 * while it is the board screen (body.kdBoardScreen) the contestant bars lie side by side below it.
 *   Olympia 26 face (body.rulesO26 - Luật rừng 2 plays in it): the 04 package-board frame
 *               (O26Frames.js 'kdboard') in .kdBoardO26, opening and closing as the frames do; the
 *               tile being picked turns red as the board closes.
 *   O24 face:   each tile is the Về đích value bar picture with its points on it.
 * The O24 tiles are always kept up to date - the scene for the audience screen is read from them.
 */

var KD_BOARD_TILE_IMAGE = 'O24/Finish Line/choosing_question_value_bar.png';

function kdBoardO26() { return typeof o26On === 'function' && o26On() && !!window.O26; }

function kdBoardRoot() {
	var root = document.querySelector('.kdBoardDiv');
	if (root) { return root; }
	var stage = document.querySelector('.stageContainerDiv');
	if (!stage) { return null; }
	root = document.createElement('div');
	root.className = 'kdBoardDiv offstage';
	stage.insertBefore(root, document.querySelector('.scoreboardDiv'));   /* under the contestant bars */
	for (var i = 0; i < 6; i++) {
		var tile = newElement('div', 'kdTile n' + (i + 1), root);
		tile.style.setProperty('--i', String(i));
		var inner = newElement('div', 'kdTileInner', tile);
		newImage(KD_BOARD_TILE_IMAGE, 'kdTileImg', inner);
		newElement('p', 'kdTileValueP', inner);
		newElement('p', 'kdTileNoteP', inner);
	}
	newElement('div', 'kdBoardO26', root);
	return root;
}

function kdBoardO26Svg(root) {
	var holder = root && root.querySelector('.kdBoardO26');
	return holder ? window.O26.mount(holder, 'kdboard') : null;
}

/* tiles: [{ value, status: 'open' | 'right' | 'none', name }] (6), picked: 1-6 or 0 */
function setKdBoard(tiles, picked) {
	var root = kdBoardRoot();
	if (!root) { return; }
	var cells = [[], []];
	(tiles || []).slice(0, 6).forEach(function (t, i) {
		var tile = root.querySelector('.kdTile.n' + (i + 1));
		if (!tile || !t) { return; }
		var done = t.status === 'right' || t.status === 'none';
		tile.classList.toggle('picked', picked === i + 1 && !done);
		tile.classList.toggle('done', done);
		tile.classList.toggle('right', t.status === 'right');
		tile.querySelector('.kdTileValueP').textContent = t.value + ' ĐIỂM';
		tile.querySelector('.kdTileNoteP').textContent = '';
		/* O26: row = (n-1) % 2, column = floor((n-1) / 2) */
		cells[i % 2][Math.floor(i / 2)] = {
			text: String(t.value),
			sub: '',
			state: picked === i + 1 && !done ? 'picked' : (t.status === 'right' ? 'right' : (t.status === 'none' ? 'none' : 'open'))
		};
	});
	if (kdBoardO26()) { window.O26.setBoard(kdBoardO26Svg(root), cells); }
}

/* instant: drawn at once, without the opening (every time after the first) */
function showKdBoard(tiles, picked, instant) {
	var root = kdBoardRoot();
	if (!root) { return; }
	setKdBoard(tiles, picked);
	document.body.classList.add('kdBoardScreen');
	var closing = root.classList.contains('o26Closing');
	if (!root.classList.contains('offstage') && !closing) { return; }
	root.classList.remove('offstage', 'in', 'o26Closing', 'kdCut');
	root.classList.toggle('kdAnim', !instant);
	root.classList.toggle('instant', !!instant);
	root._kdClose = null;
	if (kdBoardO26()) {
		var svg = kdBoardO26Svg(root);
		window.O26.finish(svg);
		if (instant) { window.O26.drawn(svg); } else { window.O26.open(svg); }
		return;
	}
	void root.offsetWidth;   /* restart the O24 entrance */
	root.classList.add('in');
}

/* the board goes (O26: it closes into the middle first). cut: gone at once (the end of the turn) */
function hideKdBoard(cut) {
	var root = document.querySelector('.kdBoardDiv');
	if (cut) { document.body.classList.remove('kdBoardScreen'); }
	if (!root) { return; }
	if (cut) {
		root._kdClose = null;
		root.classList.remove('o26Closing');
		root.classList.add('kdCut');
		if (kdBoardO26()) { window.O26.finish(kdBoardO26Svg(root)); }
	}
	if (root.classList.contains('offstage')) { return; }
	root.classList.add('offstage');
	root.classList.remove('in');
	if (cut || !kdBoardO26()) { if (!cut) { document.body.classList.remove('kdBoardScreen'); } return; }
	var svg = kdBoardO26Svg(root), token = {};
	root._kdClose = token;
	root.classList.add('o26Closing');   /* o26.css keeps it drawn while it closes */
	window.O26.finish(svg);
	/* the bars go back to their corner once the board has closed (hidden by then under the question frame) */
	window.O26.close(svg).then(function () { if (root._kdClose === token) { root.classList.remove('o26Closing'); document.body.classList.remove('kdBoardScreen'); } });
}

function isKdBoardShowing() {
	var root = document.querySelector('.kdBoardDiv');
	return !!root && !root.classList.contains('offstage');
}

/* how long the board takes to go before the question bar may come (O26: the closing) */
function kdBoardCloseMs() { return kdBoardO26() ? window.O26.CLOSE_MS : 0; }

/* what the stage shows, for the audience screen (PanelStateControl.js buildSceneForPublic) */
function kdBoardScene() {
	var root = document.querySelector('.kdBoardDiv');
	if (!root || root.classList.contains('offstage')) { return { on: false, cut: !!root && root.classList.contains('kdCut') }; }
	var tiles = Array.prototype.map.call(root.querySelectorAll('.kdTile'), function (tile) {
		return {
			value: parseInt(tile.querySelector('.kdTileValueP').textContent, 10) || 0,
			status: tile.classList.contains('right') ? 'right' : (tile.classList.contains('done') ? 'none' : 'open'),
			name: ''
		};
	});
	var picked = root.querySelector('.kdTile.picked');
	return { on: true, anim: root.classList.contains('kdAnim'), tiles: tiles, picked: picked ? Number(/n(\d)/.exec(picked.className)[1]) : 0 };
}
