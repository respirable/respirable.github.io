/*
 * Olympia Controller - the answer tree (O24/Beat the Obstacle/Answers/*), used by VCNV and Tăng tốc.
 *
 * Full-screen: a vertical axis with four branches - seats 1 and 3 to the right, 2 and 4 to the
 * left - each branch = node on the axis, dotted connector, name tab sitting on an answer bar,
 * the contestant's written answer in capitals on the bar (blank when none was given).
 *
 * Sequence (all delays x TREE_SPEED), matched to the reference video:
 *   1. the top node bursts (bright flash with rays) while the cap scales up from its centre;
 *      then the axis extends smoothly downward from it;
 *   2. down the axis, branch by branch: the node dot and the ARM (connector + tab + bar + text as
 *      ONE element) zoom in together, pivoting on the connector's corner at the axis.
 * Works for 4 or 5 branches.
 *
 *   showAnswerTree(entries, onDone, { layout: 'right', showTime: true })
 *        entries: [{ seat, name, answer, time? }] in display order. Tăng tốc passes layout 'right'
 *        (axis at x 532, every branch to the right) and showTime (seconds right-aligned on the bar).
 *   gradeAnswerTree(correctSeats)   every branch NOT in the list goes monochrome
 *   completeAnswerTreeNow()         jump to the fully drawn tree
 *   hideAnswerTree()                instant
 */

var TREE_ASSETS = 'O24/Beat the Obstacle/Answers/';
var TREE_SPEED = 1;   /* 2 = twice as slow, for review */
var TREE_TIMES = {
	burst: 700,         /* top node flash (CSS keyframes, same length) */
	axisStart: 450,     /* axis begins to extend while the flash is still fading */
	axis: 330,          /* axis growth */
	firstBranch: 620,   /* branch 1 starts zooming just before the flash ends */
	branchGap: 145,     /* branch i+1 starts this long after branch i */
	small: 210,         /* node zoom duration */
	slide: 420          /* arm zoom duration */
};
var TREE_AXIS_HEIGHT = 832;                  /* keep in step with .treeAxis in olympia.css */
var TREE_NODE_Y4 = [267, 445, 630, 811];     /* node centres for 4 branches */
var TREE_NODE_Y5 = [230, 385, 540, 695, 850]; /* ...and for 5 */
var TREE_NODE_Y_RIGHT = [273, 455, 637, 819]; /* Tăng tốc: all four to the right */
var TREE_SIDE = { 1: 'right', 2: 'left', 3: 'right', 4: 'left', 5: 'right' };

function answerTreeLater(fn, ms) { window.GameVariables.AnswerTreeTimeouts.push(setTimeout(fn, ms * TREE_SPEED)); }

function buildAnswerTree(root, entries) {
	root.textContent = '';
	newImage(TREE_ASSETS + 'answer_line.png', 'treeAxis', root);
	newImage(TREE_ASSETS + 'answer_line_holder.png', 'treeCap', root);
	var burst = newElement('div', 'treeBurst', root);
	burst.style.animationDuration = (TREE_TIMES.burst * TREE_SPEED) + 'ms';

	var opts = window.GameVariables.AnswerTreeOptions;
	var rightOnly = opts.layout === 'right';
	var ys = rightOnly ? TREE_NODE_Y_RIGHT : (entries.length >= 5 ? TREE_NODE_Y5 : TREE_NODE_Y4);
	entries.forEach(function (e, i) {
		var side = rightOnly ? 'right' : (TREE_SIDE[e.seat] || (i % 2 === 0 ? 'right' : 'left'));
		var b = newElement('div', 'treeBranch ' + side + ' seat' + e.seat, root);
		b.setAttribute('data-seat', e.seat);
		b.style.top = (ys[i] || ys[ys.length - 1]) + 'px';

		var node = newImage(TREE_ASSETS + (side === 'right' ? 'answer_bar_holder_right.png' : 'answer_bar_holder_left.png'), 'treeNode', b);
		node.style.transitionDuration = (TREE_TIMES.small * TREE_SPEED) + 'ms';
		var arm = newElement('div', 'treeArm', b);
		arm.style.transitionDuration = (TREE_TIMES.slide * TREE_SPEED) + 'ms';
		newImage(TREE_ASSETS + 'answer_bar_connector.png', 'treeConnector', arm);
		var card = newElement('div', 'treeCard', arm);
		var bar = newElement('div', 'treeBar', card);
		newImage(TREE_ASSETS + 'answer_bar.png', '', bar);
		var text = newElement('p', 'treeAnswerP', bar);
		newElement('span', '', text).textContent = String(e.answer || '').toUpperCase();
		if (opts.showTime) {
			text.classList.add('withTime');
			newElement('p', 'treeTimeP', bar).textContent = (typeof e.time === 'number' && !isNaN(e.time)) ? e.time.toFixed(2) : '';
		}
		var tab = newElement('div', 'treeTab', card);
		newImage(TREE_ASSETS + 'contestant_name_bar.png', '', tab);
		newElement('p', 'treeNameP', tab).textContent = e.name || '';
	});
}

/* squeeze an answer wider than the bar onto one line - must run once the arm is displayed */
function fitAnswerTreeText(p) {
	var span = p && p.firstChild;
	if (!span) { return; }
	span.style.transform = '';
	var room = p.clientWidth, need = span.scrollWidth;
	if (need > room && room > 0) { span.style.transform = 'scaleX(' + (room / need) + ')'; }
}

/* display the part, then next frame add .in so the zoom transition actually runs */
function zoomInAnswerTreePart(part) {
	part.classList.add('on');
	requestAnimationFrame(function () { requestAnimationFrame(function () { part.classList.add('in'); }); });
}

/* axis extends downward from the cap - ease-out, height set per frame */
function growAnswerTreeAxis() {
	var axis = document.querySelector('.vcnvTreeDiv .treeAxis');
	if (!axis) { return; }
	axis.style.height = '0px';
	var t0 = performance.now(), dur = TREE_TIMES.axis * TREE_SPEED;
	function frame() {
		var k = Math.min(1, (performance.now() - t0) / dur);
		axis.style.height = Math.round(TREE_AXIS_HEIGHT * (1 - Math.pow(1 - k, 3))) + 'px';
		window.GameVariables.AnswerTreeAnimationFrame = k < 1 ? requestAnimationFrame(frame) : null;
	}
	window.GameVariables.AnswerTreeAnimationFrame = requestAnimationFrame(frame);
}

/* in display order = top to bottom on screen (build() lays the branches out in entry order), so
 * the arms always come in from the top down - in Tăng tốc the entries are sorted by answer time,
 * and animating by seat number would make a lower bar appear before a higher one */
function answerTreeBranches() {
	return Array.prototype.slice.call(document.querySelectorAll('.vcnvTreeDiv .treeBranch'))
		.sort(function (a, b) { return parseFloat(a.style.top) - parseFloat(b.style.top); });
}

function runAnswerTreeSequence(onDone) {
	var burst = document.querySelector('.vcnvTreeDiv .treeBurst');
	var cap = document.querySelector('.vcnvTreeDiv .treeCap');
	/* 1. the top node bursts, the cap grows for exactly as long as the flash, the axis runs down */
	burst.classList.add('on');
	cap.style.transitionDuration = (TREE_TIMES.burst * TREE_SPEED) + 'ms';
	zoomInAnswerTreePart(cap);
	answerTreeLater(function () { burst.classList.remove('on'); }, TREE_TIMES.burst);
	answerTreeLater(growAnswerTreeAxis, TREE_TIMES.axisStart);

	/* 2. branches, top to bottom (by seat) - node and arm together */
	var last = 0;
	answerTreeBranches().forEach(function (b, i) {
		var t = TREE_TIMES.firstBranch + i * TREE_TIMES.branchGap;
		answerTreeLater(function () {
			zoomInAnswerTreePart(b.querySelector('.treeNode'));
			zoomInAnswerTreePart(b.querySelector('.treeArm'));
			fitAnswerTreeText(b.querySelector('.treeAnswerP'));
		}, t);
		last = Math.max(last, t + TREE_TIMES.slide);
	});
	if (onDone) { answerTreeLater(onDone, last + 50); }
}

function isAnswerTreeShowing() { return window.GameVariables.IsAnswerTreeShowing; }

function showAnswerTree(entries, onDone, options) {
	var root = document.querySelector('.vcnvTreeDiv');
	if (!root) { return; }
	cancelAnswerTree();
	window.GameVariables.AnswerTreeOptions = options || {};
	root.classList.toggle('layoutRight', window.GameVariables.AnswerTreeOptions.layout === 'right');
	/* options.instant: the tree comes back complete (no entrance) - Tăng tốc B, and the screens
	 * copying that (AudienceMirror.js reads it from the scene) */
	var instant = !!window.GameVariables.AnswerTreeOptions.instant;
	root.classList.toggle('instant', instant);
	window.GameVariables.IsAnswerTreeInstant = instant;
	buildAnswerTree(root, entries || []);
	root.classList.remove('offstage');
	var sig = document.querySelector('.vcnvTreeSignalsDiv');
	if (sig) { sig.classList.remove('offstage'); }
	window.GameVariables.IsAnswerTreeShowing = true;
	if (instant) { completeAnswerTreeNow(); if (onDone) { onDone(); } return; }
	runAnswerTreeSequence(onDone);
}

/* Jump to the fully drawn tree (the host moved on before the sequence ended). */
function completeAnswerTreeNow() {
	cancelAnswerTree();
	var axis = document.querySelector('.vcnvTreeDiv .treeAxis');
	var burst = document.querySelector('.vcnvTreeDiv .treeBurst');
	var cap = document.querySelector('.vcnvTreeDiv .treeCap');
	if (axis) { axis.style.height = TREE_AXIS_HEIGHT + 'px'; }
	if (burst) { burst.classList.remove('on'); }
	if (cap) { cap.style.transitionDuration = '0ms'; cap.classList.add('on', 'in'); }
	answerTreeBranches().forEach(function (b) {
		[b.querySelector('.treeNode'), b.querySelector('.treeArm')].forEach(function (part) {
			part.style.transitionDuration = '0ms';
			part.classList.add('on', 'in');
		});
		fitAnswerTreeText(b.querySelector('.treeAnswerP'));
	});
}

/* Branches not in correctSeats turn monochrome. */
function gradeAnswerTree(correctSeats) {
	completeAnswerTreeNow();
	answerTreeBranches().forEach(function (b) {
		var ok = (correctSeats || []).indexOf(parseInt(b.getAttribute('data-seat'), 10)) !== -1;
		b.classList.toggle('wrong', !ok);
	});
}

function hideAnswerTree() {
	cancelAnswerTree();
	var root = document.querySelector('.vcnvTreeDiv');
	if (root) { root.classList.add('offstage'); }
	var sig = document.querySelector('.vcnvTreeSignalsDiv');
	if (sig) { sig.classList.add('offstage'); }
	window.GameVariables.IsAnswerTreeShowing = false;
}

/* Stops any pending steps of the sequence. */
function cancelAnswerTree() {
	window.GameVariables.AnswerTreeTimeouts.forEach(clearTimeout);
	window.GameVariables.AnswerTreeTimeouts = [];
	if (window.GameVariables.AnswerTreeAnimationFrame) {
		cancelAnimationFrame(window.GameVariables.AnswerTreeAnimationFrame);
		window.GameVariables.AnswerTreeAnimationFrame = null;
	}
}
