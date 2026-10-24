/*
 * Olympia Controller - Về đích graphics (O24/Finish Line/*).
 *
 * .vdChooseDiv     the "choose your package" screen: two bars (20 ĐIỂM / 30 ĐIỂM). Each bar enters
 *                  in two stages - the inner layer zooms from its own top-left while the outer layer
 *                  holds it at 80 % pivoting on its middle-right edge, then the outer layer grows to
 *                  full size. Three tick boxes beside each bar; the k-th pick ticks box k of its value.
 * .vdQuestionGroup ONE element: four name tabs (fixed by seat) + question bar with the timer strip.
 *                  Comes up VD_GROUP_DELAY_MS after the choose screen goes, with an EMPTY bar; the
 *                  text follows with setVeDichQuestion(). Zoom 600 ms from its top-left; exit instant.
 * .vdScoreBox      "CÂU N ĐIỂM" + the on-stage contestant's score; zooms once the group has landed.
 * video.vdStar     the Ngôi sao hy vọng (star.webm, VP9 with alpha) looping above the seat-4 tab.
 */

var VE_DICH_ASSETS = 'O24/Finish Line/';
var VE_DICH_STAR_VIDEO = VE_DICH_ASSETS + 'star.webm';
var VE_DICH_TIMER_WIDTH = 1173;   /* px - keep in step with .vdTimerDiv in olympia.css */
var VD_CHOOSE_ZOOM_MS = 680;      /* stage 1 - keep equal to the .vdChooseInner transition */
var VD_CHOOSE_PAUSE_MS = 210;     /* pause between the inner zoom and the outer grow */
var VD_GROUP_DELAY_MS = 2000;     /* bare background between the choose screen and the question group */
var VD_GROUP_ZOOM_MS = 600;       /* the group's zoom - the score box starts after it */

function veDichElement(selector) { return document.querySelector('.vdDiv ' + selector); }

function renderVeDich() {
	var root = document.querySelector('.vdDiv');
	if (!root || window.GameVariables.IsVeDichBuilt) { return; }
	root.textContent = '';

	/* --- choose screen --- */
	var choose = newElement('div', 'vdChooseDiv', root);
	[20, 30].forEach(function (v) {
		var box = newElement('div', 'vdChooseBox value' + v, choose);
		var inner = newElement('div', 'vdChooseInner', box);
		newImage(VE_DICH_ASSETS + 'choosing_question_value_bar.png', 'vdChooseImg', inner);
		newElement('p', 'vdChooseTextP', inner).textContent = v + ' ĐIỂM';
		newElement('div', 'vdChooseTicksDiv', inner);
		newGlare('ttGlareImg vdChooseGlare', box);   /* flash on the zoom's vanishing point */
	});

	/* glare flashes on the zoom pivots of the group and the score box (stage level, not scaled) */
	newGlare('ttGlareImg vdGroupGlare', root);
	newGlare('ttGlareImg vdScoreGlare', root);

	/* --- question group: tabs + bar --- */
	var g = newElement('div', 'vdQuestionGroup', root);
	[1, 2, 3, 4].forEach(function (seat) {
		var t = newElement('div', 'vdTab seat' + seat, g);
		newImage(VE_DICH_ASSETS + 'contestant_name_and_score_bar_idle.png', 'vdTabImg', t);
		newElement('p', 'vdTabTextP', t);
	});
	var bar = newElement('div', 'vdQuestionBar', g);
	newImage(VE_DICH_ASSETS + 'question_bar.png', 'vdQuestionImg', bar);
	newElement('p', 'vdQuestionTextP', bar);
	var timer = newElement('div', 'vdTimerDiv', bar);
	newElement('div', 'vcnvTimerFill', timer);
	newElement('div', 'vcnvTimerDot', timer);

	/* --- score box --- */
	var s = newElement('div', 'vdScoreBox', root);
	newImage(VE_DICH_ASSETS + 'question_value_and_score_bar.png', 'vdScoreImg', s);
	newElement('p', 'vdScoreHeaderP', s);
	newElement('p', 'vdScoreP', s);

	/* --- Ngôi sao hy vọng clip, in the group above the seat-4 tab --- */
	var star = newElement('video', 'vdStar', g);
	star.muted = true;
	star.loop = true;
	star.playsInline = true;
	star.preload = 'auto';
	/* the clip is optional: only wire it when the file is actually served */
	try {
		fetch(VE_DICH_STAR_VIDEO, { method: 'HEAD' }).then(function (r) {
			window.GameVariables.IsStarClipAvailable = !!(r && r.ok);
			if (window.GameVariables.IsStarClipAvailable) { star.src = VE_DICH_STAR_VIDEO; star.load(); }
		}).catch(function () { window.GameVariables.IsStarClipAvailable = false; });
	} catch (e) { window.GameVariables.IsStarClipAvailable = false; }

	window.GameVariables.IsVeDichBuilt = true;
}

function isVeDichShowing() {
	var root = document.querySelector('.vdDiv');
	return !!(root && !root.classList.contains('offstage'));
}

/* ---------- choose screen ---------- */

function veDichChooseBoxes() { return [veDichElement('.vdChooseBox.value20'), veDichElement('.vdChooseBox.value30')]; }
function veDichChooseGlares() { return Array.prototype.slice.call(document.querySelectorAll('.vdDiv .vdChooseGlare')); }

/* values: [20|30 ...] already picked (normally empty when the screen comes up) */
function showChooseScreen(values) {
	renderVeDich();
	if (!window.GameVariables.IsVeDichBuilt) { return; }
	hideVeDichQuestionGroup();
	setChooseScreen(values || []);
	document.querySelector('.vdDiv').classList.remove('offstage');
	veDichElement('.vdChooseDiv').classList.add('on');
	var boxes = veDichChooseBoxes();
	boxes.forEach(function (b) { b.classList.remove('in', 'grown'); });
	veDichChooseGlares().forEach(function (g) { g.classList.remove('on'); });
	if (window.GameVariables.ChooseScreenTimeout) { clearTimeout(window.GameVariables.ChooseScreenTimeout); }
	requestAnimationFrame(function () { requestAnimationFrame(function () {
		boxes.forEach(function (b) { b.classList.add('in'); });                 /* stage 1: inner zoom at 80 % */
		veDichChooseGlares().forEach(function (g) { g.classList.add('on'); });
		window.GameVariables.ChooseScreenTimeout = setTimeout(function () {
			boxes.forEach(function (b) { b.classList.add('grown'); });          /* stage 2: grow to full size */
			window.GameVariables.ChooseScreenTimeout = null;
		}, VD_CHOOSE_ZOOM_MS + VD_CHOOSE_PAUSE_MS);
	}); });
}

/* the three tick boxes beside each bar = questions 1-3; box k of the value picked k-th is ticked */
function setChooseScreen(values) {
	if (!window.GameVariables.IsVeDichBuilt) { return; }
	values = values || [];
	[20, 30].forEach(function (v) {
		var holder = veDichElement('.vdChooseBox.value' + v + ' .vdChooseTicksDiv');
		holder.textContent = '';
		for (var k = 0; k < 3; k++) {
			var t = newElement('div', 'vdTickDiv', holder);
			newImage(VE_DICH_ASSETS + 'tick_box.png', 'vdTickImg', t);
			newElement('p', 'vdTickP', t).textContent = values[k] === v ? '✓' : '';
		}
	});
}

function hideChooseScreen() {
	if (window.GameVariables.ChooseScreenTimeout) { clearTimeout(window.GameVariables.ChooseScreenTimeout); window.GameVariables.ChooseScreenTimeout = null; }
	if (!window.GameVariables.IsVeDichBuilt) { return; }
	veDichElement('.vdChooseDiv').classList.remove('on');
	veDichChooseBoxes().forEach(function (b) { b.classList.remove('in', 'grown'); });
	veDichChooseGlares().forEach(function (g) { g.classList.remove('on'); });
}

/* ---------- question group (tabs + bar + score box) ---------- */

/* o: { seat, value } - the choose screen goes at once; after VD_GROUP_DELAY_MS the group zooms in
 * with an EMPTY bar and the header of the coming question. */
function showVeDichQuestionGroup(o) {
	renderVeDich();
	if (!window.GameVariables.IsVeDichBuilt) { return; }
	hideChooseScreen();
	setVeDichTabs(o.seat);
	setVeDichStealSeat(null);
	setVeDichQuestion('', o.value);
	var p = window.GameVariables.getPlayer(o.seat);
	setVeDichScore(p ? p.score : 0);
	setVeDichStar(false);
	hideVeDichTimer();
	var group = veDichElement('.vdQuestionGroup');
	var scoreBox = veDichElement('.vdScoreBox');
	var groupGlare = veDichElement('.vdGroupGlare');
	var scoreGlare = veDichElement('.vdScoreGlare');
	document.querySelector('.vdDiv').classList.remove('offstage');
	group.classList.remove('in', 'on');
	scoreBox.classList.remove('in', 'on');
	groupGlare.classList.remove('on');
	scoreGlare.classList.remove('on');
	if (window.GameVariables.QuestionGroupTimeout) { clearTimeout(window.GameVariables.QuestionGroupTimeout); }
	window.GameVariables.QuestionGroupTimeout = setTimeout(function () {
		group.classList.add('on');
		requestAnimationFrame(function () { requestAnimationFrame(function () {
			group.classList.add('in');
			groupGlare.classList.add('on');
		}); });
		/* the score box follows once the tabs + bar have landed */
		window.GameVariables.QuestionGroupTimeout = setTimeout(function () {
			window.GameVariables.QuestionGroupTimeout = null;
			scoreBox.classList.add('on');
			requestAnimationFrame(function () { requestAnimationFrame(function () {
				scoreBox.classList.add('in');
				scoreGlare.classList.add('on');
			}); });
		}, VD_GROUP_ZOOM_MS);
	}, VD_GROUP_DELAY_MS);
}

/* tabs are fixed by seat; the contestant on stage gets the on-stage tab and name only, the
 * others "Name (score)" */
function setVeDichTabs(onStageSeat) {
	if (!window.GameVariables.IsVeDichBuilt) { return; }
	[1, 2, 3, 4].forEach(function (seat) {
		var p = window.GameVariables.getPlayer(seat);
		var on = seat === onStageSeat;
		var tab = veDichElement('.vdTab.seat' + seat);
		tab.classList.toggle('onStage', on);
		tab.querySelector('.vdTabImg').src = VE_DICH_ASSETS + (on ? 'contestant_name_and_score_bar_on_stage.png' : 'contestant_name_and_score_bar_idle.png');
		var name = p ? window.GameVariables.displayName(p) : ('Thí sinh ' + seat);
		tab.querySelector('.vdTabTextP').textContent = on ? name : (name + ' (' + (p ? p.score : 0) + ')');
	});
}

/* text ('' = bare bar) + "CÂU v ĐIỂM" header; no animation */
function setVeDichQuestion(text, value) {
	if (!window.GameVariables.IsVeDichBuilt) { return; }
	veDichElement('.vdQuestionTextP').textContent = text || '';
	veDichElement('.vdScoreHeaderP').textContent = 'CÂU ' + (value || '') + ' ĐIỂM';
	hideVeDichTimer();
}

function setVeDichScore(n) {
	if (window.GameVariables.IsVeDichBuilt) { veDichElement('.vdScoreP').textContent = String(n); }
}

/* the stealer's tab turns red */
function setVeDichStealSeat(seat) {
	if (!window.GameVariables.IsVeDichBuilt) { return; }
	[1, 2, 3, 4].forEach(function (s) { veDichElement('.vdTab.seat' + s).classList.toggle('stealing', s === seat); });
}

/* on: the star clip loops above the seat-4 tab until setVeDichStar(false) / the group goes away */
function setVeDichStar(on) {
	if (!window.GameVariables.IsVeDichBuilt) { return; }
	if (!on) { stopVeDichStar(); return; }
	var star = veDichElement('video.vdStar');
	if (!window.GameVariables.IsStarClipAvailable || star.classList.contains('on')) { return; }
	try {
		star.classList.add('on');
		star.currentTime = 0;
		var p = star.play();
		if (p && p.catch) { p.catch(function (e) { console.warn('[VĐ] star clip blocked', e && e.message); star.classList.remove('on'); }); }
	} catch (e) { star.classList.remove('on'); }
}

function stopVeDichStar() {
	if (!window.GameVariables.IsVeDichBuilt) { return; }
	var star = veDichElement('video.vdStar');
	try { star.pause(); } catch (e) { /* ignore */ }
	star.classList.remove('on');
}

function hideVeDichQuestionGroup() {
	if (window.GameVariables.QuestionGroupTimeout) { clearTimeout(window.GameVariables.QuestionGroupTimeout); window.GameVariables.QuestionGroupTimeout = null; }
	if (!window.GameVariables.IsVeDichBuilt) { return; }
	stopVeDichStar();
	hideVeDichTimer();
	veDichElement('.vdQuestionGroup').classList.remove('in', 'on');
	veDichElement('.vdScoreBox').classList.remove('in', 'on');
	veDichElement('.vdGroupGlare').classList.remove('on');
	veDichElement('.vdScoreGlare').classList.remove('on');
}

/* ---------- timer bar on the question bar ---------- */
/* The answer clock fills left -> right; the 5 s steal window (reverse) is the same bar run
 * backwards - it starts FULL and shrinks back to the left. */

function startVeDichTimer(reverse) {
	if (!window.GameVariables.IsVeDichBuilt) { return; }
	var timer = veDichElement('.vdTimerDiv');
	timer.classList.toggle('reverse', !!reverse);
	setVeDichTimer(0);
	timer.classList.add('visible');
}

function setVeDichTimer(fraction) {
	if (!window.GameVariables.IsVeDichBuilt) { return; }
	var timer = veDichElement('.vdTimerDiv');
	var f = Math.max(0, Math.min(1, fraction));
	if (timer.classList.contains('reverse')) { f = 1 - f; }
	var w = Math.round(f * VE_DICH_TIMER_WIDTH);
	timer.querySelector('.vcnvTimerFill').style.width = w + 'px';
	timer.querySelector('.vcnvTimerDot').style.left = (w - TIMER_DOT / 2) + 'px';
}

function hideVeDichTimer() {
	if (window.GameVariables.IsVeDichBuilt) { veDichElement('.vdTimerDiv').classList.remove('visible'); }
}

function hideVeDich() {
	hideChooseScreen();
	hideVeDichQuestionGroup();
	var root = document.querySelector('.vdDiv');
	if (root) { root.classList.add('offstage'); }
}
