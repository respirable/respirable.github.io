/*
 * Olympia Controller - the "current results" board (F6): four CSS score cards over everything.
 * While it is up every other graphic is hidden by CSS (.boardMode on the stage) and left as it
 * was, so hiding the board brings the previous picture back untouched.
 */

/* Builds the four cards once (after the players are loaded). */
function renderBoardScreen() {
	var root = document.querySelector('.boardScreenDiv');
	if (!root) { return; }
	if (!root.children.length) {
		window.GameVariables.Players.forEach(function (p) {
			var card = newElement('div', 'boardCardDiv seat' + p.seat, root);
			newElement('p', 'boardHeaderP', card);
			newElement('p', 'boardScoreP', card);
		});
	}
	refreshBoardScreen();
}

/* Names + scores from the live players; cheap, called on every score change.
 * A seat whose bar a round hides (the Câu hỏi phụ: seats not playing - contestantBarLook) has no
 * card either; the cards left are centred on the same 451 px pitch. */
function refreshBoardScreen() {
	var shown = window.GameVariables.Players.filter(function (p) {
		var look = typeof contestantBarLook === 'function' ? contestantBarLook(p) : null;
		return !(look && look.absent);
	});
	var first = (1920 - (407 + (shown.length - 1) * 451)) / 2;
	window.GameVariables.Players.forEach(function (p) {
		var card = document.querySelector('.boardScreenDiv .boardCardDiv.seat' + p.seat);
		if (!card) { return; }
		var at = shown.indexOf(p);
		card.classList.toggle('absent', at === -1);
		card.style.left = (at === -1 || shown.length === 4) ? '' : (first + at * 451) + 'px';
		card.querySelector('.boardHeaderP').textContent = window.GameVariables.displayName(p).toUpperCase();
		card.querySelector('.boardScoreP').textContent = String(Math.round(p.score));
	});
}

function isBoardScreenShowing() {
	var root = document.querySelector('.boardScreenDiv');
	return !!(root && !root.classList.contains('offstage'));
}

function showBoardScreen() {
	if (window.GameVariables.IsGreenScreenOn) { return; }   /* no results board in green-screen mode */
	renderBoardScreen();
	var root = document.querySelector('.boardScreenDiv');
	if (!root || !root.children.length) { return; }
	root.classList.remove('offstage');
	var stage = document.querySelector('.stageContainerDiv');
	if (stage) { stage.classList.add('boardMode'); }
	window.GameVariables.BoardScreenShowing = true;
}

function hideBoardScreen() {
	var root = document.querySelector('.boardScreenDiv');
	if (root) { root.classList.add('offstage'); }
	var stage = document.querySelector('.stageContainerDiv');
	if (stage) { stage.classList.remove('boardMode'); }
	window.GameVariables.BoardScreenShowing = false;
}

/* The F6 key. */
function toggleBoardScreen() {
	if (isBoardScreenShowing()) { hideBoardScreen(); } else { showBoardScreen(); }
}
