/*
 * Olympia Controller - the Khởi động question bar (O24/Warm-up/question_bar.png, 1284x264).
 *
 * showQuestionBar() plays a PowerPoint-Zoom-style entrance (see olympia.css); hideQuestionBar()
 * is instant. setQuestionText() puts the question in with textContent. The 3-second think clock
 * shows 3 -> 2 -> 1 to the right of the question text, each number rendered with no animation.
 *
 * Two skins for the same bar: the individual turn shows the strip for the 60 s music at the
 * bottom ('timer'); the common turn uses the plain bar ('plain').
 */

var QUESTION_BAR_IMAGES = {
	timer: 'O24/Warm-up/question_bar.png',
	plain: 'O24/Warm-up/question_bar_without_timer.png'
};

var QUESTION_TIMER_WIDTH = 1213;   /* px - the dark groove along the bottom of the timer skin; keep in step with .questionTimerDiv */

/* Warms the browser cache so the first skin swap does not flash an empty box; adds the timer
 * strip (Câu hỏi phụ only) that runs in the groove of the timer skin. */
function renderQuestionBar() {
	Object.keys(QUESTION_BAR_IMAGES).forEach(function (k) { var i = new Image(); i.src = QUESTION_BAR_IMAGES[k]; });
	var root = document.querySelector('.questionBarDiv');
	if (root && !root.querySelector('.questionTimerDiv')) {
		var timer = newElement('div', 'questionTimerDiv', root);
		newElement('div', 'vcnvTimerFill', timer);
		newElement('div', 'vcnvTimerDot', timer);
	}
}

/* ---------- the timer strip in the groove (same house style as every timer bar) ---------- */

function startQuestionTimer() {
	setQuestionTimer(0);
	var timer = document.querySelector('.questionBarDiv .questionTimerDiv');
	if (timer) { timer.classList.add('visible'); }
}

/* fraction 0..1 of the time gone */
function setQuestionTimer(fraction) {
	var f = Math.max(0, Math.min(1, fraction));
	var fill = document.querySelector('.questionBarDiv .questionTimerDiv .vcnvTimerFill');
	var dot = document.querySelector('.questionBarDiv .questionTimerDiv .vcnvTimerDot');
	if (fill) { fill.style.width = Math.round(f * QUESTION_TIMER_WIDTH) + 'px'; }
	if (dot) { dot.style.left = (Math.round(f * QUESTION_TIMER_WIDTH) - TIMER_DOT / 2) + 'px'; }
}

function hideQuestionTimer() {
	var timer = document.querySelector('.questionBarDiv .questionTimerDiv');
	if (timer) { timer.classList.remove('visible'); }
	setQuestionTimer(0);
}

function isQuestionTimerShowing() { return !!document.querySelector('.questionBarDiv .questionTimerDiv.visible'); }

/* Entrance keeps the zoom transition (removing .offstage lets the CSS transition play). */
function showQuestionBar() {
	var root = document.querySelector('.questionBarDiv');
	if (root) { root.classList.remove('offstage'); }
}

/* Exit is always instant: transitions off, hide, reflow, transitions back on for the next show. */
function hideQuestionBar() {
	var root = document.querySelector('.questionBarDiv');
	if (!root) { return; }
	root.classList.add('noTransition');
	root.classList.add('offstage');
	void root.offsetWidth;
	root.classList.remove('noTransition');
}

function isQuestionBarShowing() {
	var root = document.querySelector('.questionBarDiv');
	return !!(root && !root.classList.contains('offstage'));
}

/* 'timer' | 'plain'. Safe to call while hidden or shown. */
function setQuestionBarVariant(name) {
	var img = document.querySelector('.questionBarDiv .questionBarImg');
	if (!img) { return; }
	var src = QUESTION_BAR_IMAGES[name] || QUESTION_BAR_IMAGES.timer;
	if (img.getAttribute('src') !== src) { img.setAttribute('src', src); }
}

function setQuestionText(text) {
	var p = document.querySelector('.questionBarDiv .questionTextP');
	if (p) { p.textContent = text || ''; }
}

function clearQuestionBar() {
	setQuestionText('');
	hideThinkClock();
}

/* 3 -> 2 -> 1, then hides. The bed keeps playing. */
function startThinkClock(seconds, onDone) {
	var clock = document.querySelector('.questionBarDiv .questionClockP');
	if (!clock) { return; }
	var shown = null;
	clock.classList.add('visible');
	startClock({
		mode: 'down', duration: seconds, label: 'kd_think',
		onTick: function (remaining) {
			var n = Math.max(1, Math.ceil(remaining - 0.0001));
			if (n !== shown) {
				shown = n;
				clock.textContent = String(n);
			}
		},
		onDone: function () {
			clock.classList.remove('visible');
			clock.textContent = '';
			if (onDone) { onDone(); }
		}
	});
}

function hideThinkClock() {
	var clock = document.querySelector('.questionBarDiv .questionClockP');
	if (!clock) { return; }
	if (isClockRunning()) { stopClock(); }
	clock.classList.remove('visible');
	clock.textContent = '';
}
