/*
 * Olympia Controller - stage background, the round title card (O24/<round>/text.png), and the
 * small DOM helpers every graphics file uses to build its elements.
 *
 * The title cards live in default.html as one <img data-round="..."> each; showing a round just
 * moves .current onto its card, so the switch is instant.
 */

/* ---------- DOM helpers (used by all the *Control.js files) ---------- */

var TIMER_DOT = 18;   /* px - the dot riding the head of every timer bar (.vcnvTimerDot in olympia.css) */

function newElement(tag, className, parent) {
	var e = document.createElement(tag);
	if (className) { e.className = className; }
	if (parent) { parent.appendChild(e); }
	return e;
}

function newImage(src, className, parent) {
	var i = newElement('img', className, parent);
	i.src = src;
	i.alt = '';
	return i;
}

/* A glare flash: adding .on runs the keyframes once, then the class is dropped - otherwise the
 * flash would replay every time the element is re-displayed (e.g. after the F6 board). */
function newGlare(className, parent) {
	var g = newImage('O24/glare.png', className, parent);
	g.addEventListener('animationend', function () { g.classList.remove('on'); });
	return g;
}

/* ---------- background ---------- */

function showBackground() {
	var bg = document.querySelector('.stageBackgroundDiv');
	if (bg) { bg.classList.add('visible'); }
	window.GameVariables.IsBackgroundShowing = true;
	window.GameVariables.changed();
}

function hideBackground() {
	var bg = document.querySelector('.stageBackgroundDiv');
	if (bg) { bg.classList.remove('visible'); }
	window.GameVariables.IsBackgroundShowing = false;
	window.GameVariables.changed();
}

function toggleBackground() {
	if (window.GameVariables.IsBackgroundShowing) { hideBackground(); } else { showBackground(); }
}

/* ---------- green screen (chroma key) ---------- */
/* Rule while green screen is on: background.png shows only when the round graphics are not hidden
 * with ',' AND (the VCNV graphics are up OR a Tăng tốc question is up OR an answer tree is up). The VCNV graphics are up from
 * the board (step 2, the Left after the title) until they are taken down (step 12) - so F2 alone
 * does not bring the background in. Otherwise the flat GreenScreenColor shows through. With green
 * screen off the background is always there.
 * Called after every state change (GeneralControl.js wraps GameVariables.changed), so it never
 * calls changed() itself. */
function isVcnvOnScreen() {
	var g = window.GameVariables;
	return g.CurrentRound == 'vcnv' && g.VcnvSequenceCounter >= 2 && g.VcnvSequenceCounter <= 11;
}

/* Tăng tốc: one question, from its frame coming up (step 2) through the timer, the answer tree,
 * B review and grading (step 5). The tree going away (step 6, before the next question) and the
 * end of the round are flat green again. */
function isTangTocQuestionOnScreen() {
	var g = window.GameVariables;
	return g.CurrentRound == 'tt' && g.TangTocSequenceCounter >= 2 && g.TangTocSequenceCounter <= 5;
}

function refreshStageBackground() {
	var g = window.GameVariables;
	var show = !g.IsGreenScreenOn ||
		(!g.IsRoundGraphicsHidden && (isVcnvOnScreen() || isTangTocQuestionOnScreen() || g.IsAnswerTreeShowing));
	var bg = document.querySelector('.stageBackgroundDiv');
	if (bg) { bg.classList.toggle('visible', show); }
	g.IsBackgroundShowing = show;
}

/* the colour behind the stage: green while green screen is on, black otherwise. Only the 1920x1080
 * stage is painted - the page around it stays black however large the window is. The .greenScreen
 * class on the stage also hides the round title cards (olympia.css) - their sting still plays. */
function applyGreenScreenColor() {
	var on = window.GameVariables.IsGreenScreenOn;
	var colour = on ? window.GameVariables.GreenScreenColor : '';
	var stage = document.querySelector('.stageContainerDiv');
	if (stage) {
		stage.style.backgroundColor = colour;
		stage.classList.toggle('greenScreen', !!on);
	}
}

function setGreenScreen(on) {
	window.GameVariables.IsGreenScreenOn = !!on;
	if (on && isBoardScreenShowing()) { hideBoardScreen(); }   /* no F6 board in green-screen mode */
	if (!on) { showRoundGraphics(); }                           /* ',' only exists in green-screen mode */
	applyGreenScreenColor();
	refreshStageBackground();
	window.GameVariables.changed();
}

function toggleGreenScreen() { setGreenScreen(!window.GameVariables.IsGreenScreenOn); }

/* ---------- key ',' (green screen only): hide / show the round's graphics ---------- */
/* Khởi động: question bar + contestant bars. VCNV: everything. Tăng tốc: frame + answer tree.
 * CSS only (.roundGraphicsHidden + data-hidden-round on the stage, see olympia.css): the round
 * keeps running - questions, rows and answers can still be graded - it just cannot be seen. The
 * next step that brings new graphics up (KĐ question bar opening, VCNV back to the board / answer
 * tree, the next Tăng tốc question / answer tree) calls showRoundGraphics(). */
function hideRoundGraphics() {
	var stage = document.querySelector('.stageContainerDiv');
	if (stage) {
		stage.classList.add('roundGraphicsHidden');
		stage.setAttribute('data-hidden-round', window.GameVariables.CurrentRound || '');
	}
	window.GameVariables.IsRoundGraphicsHidden = true;
}

function showRoundGraphics() {
	var stage = document.querySelector('.stageContainerDiv');
	if (stage) {
		stage.classList.remove('roundGraphicsHidden');
		stage.removeAttribute('data-hidden-round');
	}
	window.GameVariables.IsRoundGraphicsHidden = false;
}

function toggleRoundGraphics() {
	if (window.GameVariables.IsRoundGraphicsHidden) { showRoundGraphics(); } else { hideRoundGraphics(); }
}

/* ---------- round title card ('kd', 'vcnv', 'tt', 'vd') - instant, at screen centre ---------- */

function showTitleCard(roundId) {
	var card = document.querySelector('.titleCardDiv');
	if (!card) { return; }
	card.querySelectorAll('img').forEach(function (img) {
		img.classList.toggle('current', img.getAttribute('data-round') === roundId);
	});
	card.classList.add('visible');
}

function hideTitleCard() {
	var card = document.querySelector('.titleCardDiv');
	if (card) { card.classList.remove('visible'); }
}

function isTitleCardShowing() {
	var card = document.querySelector('.titleCardDiv');
	return !!(card && card.classList.contains('visible'));
}
