/*
 * Olympia Controller - Tăng tốc graphics (O24/Accelerate/Question/*).
 *
 * .ttDiv > .ttGroupDiv   question bar + contents frame (picture or video) with the timer strip.
 * The group zooms in from its top-left with a glare flash; exit is instant.
 */

var TANG_TOC_ASSETS = 'O24/Accelerate/Question/';
var TANG_TOC_TIMER_WIDTH = 1008;   /* px - keep in step with .ttTimerDiv in olympia.css */

function renderTangTocFrame() {
	var root = document.querySelector('.ttDiv');
	if (!root || window.GameVariables.IsTangTocFrameBuilt) { return; }
	root.textContent = '';
	newGlare('ttGlareImg', root);
	var group = newElement('div', 'ttGroupDiv', root);
	var q = newElement('div', 'ttQuestionDiv', group);
	newImage(TANG_TOC_ASSETS + 'question_bar.png', 'ttQuestionImg', q);
	newElement('p', 'ttQuestionTextP', q);

	var c = newElement('div', 'ttContentDiv', group);
	newImage(TANG_TOC_ASSETS + 'question_contents_bar.png', 'ttContentImg', c);
	var media = newElement('div', 'ttMediaDiv', c);
	newElement('img', 'ttMediaImg', media).alt = '';
	var video = newElement('video', 'ttMediaVideo', media);
	video.preload = 'auto';
	video.playsInline = true;
	video.muted = true;

	var timer = newElement('div', 'ttTimerDiv', c);
	newElement('div', 'vcnvTimerFill', timer);
	newElement('div', 'vcnvTimerDot', timer);
	window.GameVariables.IsTangTocFrameBuilt = true;
}

function isTangTocFrameShowing() {
	var root = document.querySelector('.ttDiv');
	return !!(root && !root.classList.contains('offstage'));
}

/* q: { text, media:{type,src} } - loads the media but does not play a video */
function setTangTocQuestion(q) {
	renderTangTocFrame();
	if (!window.GameVariables.IsTangTocFrameBuilt) { return; }
	var image = document.querySelector('.ttDiv .ttMediaImg');
	var video = document.querySelector('.ttDiv .ttMediaVideo');
	document.querySelector('.ttDiv .ttQuestionTextP').textContent = (q && q.text) || '';
	var type = (q && q.media && q.media.type) || 'image';
	var src = (q && q.media && q.media.src) || '';
	stopTangTocVideo();
	if (type === 'video' && src) {
		image.classList.remove('on');
		image.removeAttribute('src');
		video.src = src;
		video.load();
		video.classList.add('on');
	}
	else {
		video.classList.remove('on');
		video.removeAttribute('src');
		if (src) { image.src = src; image.classList.add('on'); }
		else { image.classList.remove('on'); image.removeAttribute('src'); }
	}
	hideTangTocTimer();
}

/* zoom entrance: display first, then next frame add .in so the transition runs */
function showTangTocFrame() {
	renderTangTocFrame();
	if (!window.GameVariables.IsTangTocFrameBuilt) { return; }
	var root = document.querySelector('.ttDiv');
	var group = root.querySelector('.ttGroupDiv');
	var glare = root.querySelector('.ttGlareImg');
	group.classList.remove('in');
	glare.classList.remove('on');
	root.classList.remove('offstage');
	requestAnimationFrame(function () {
		requestAnimationFrame(function () {
			group.classList.add('in');
			glare.classList.add('on');   /* the flash restarts each time */
		});
	});
}

function hideTangTocFrame() {
	stopTangTocVideo();
	var root = document.querySelector('.ttDiv');
	if (root) { root.classList.add('offstage'); }
	if (window.GameVariables.IsTangTocFrameBuilt) {
		root.querySelector('.ttGroupDiv').classList.remove('in', 'noAnim');
		root.querySelector('.ttGlareImg').classList.remove('on');
	}
}

/* B: the frame back on screen at once - no zoom, no glare, no timer. media: { type, src };
 * an image replaces the picture; a video (the question's own) is kept as it is, paused. */
function showTangTocQuestionStill(media) {
	renderTangTocFrame();
	if (!window.GameVariables.IsTangTocFrameBuilt) { return; }
	var root = document.querySelector('.ttDiv');
	var image = root.querySelector('.ttMediaImg');
	var video = root.querySelector('.ttMediaVideo');
	var type = (media && media.type) || 'image', src = (media && media.src) || '';
	if (type === 'image' && src) {
		video.classList.remove('on');
		image.src = src;
		image.classList.add('on');
	}
	else if (type === 'video') {
		image.classList.remove('on');
		if (video.getAttribute('src') !== src) { video.src = src; video.load(); }
		video.classList.add('on');
	}
	hideTangTocTimer();
	root.querySelector('.ttGlareImg').classList.remove('on');
	root.querySelector('.ttGroupDiv').classList.add('noAnim', 'in');
	root.classList.remove('offstage');
}

function hideTangTocQuestionStill() {
	if (!window.GameVariables.IsTangTocFrameBuilt) { return; }
	var root = document.querySelector('.ttDiv');
	root.classList.add('offstage');
	root.querySelector('.ttGroupDiv').classList.remove('in', 'noAnim');
}

function playTangTocVideo() {
	var video = document.querySelector('.ttDiv .ttMediaVideo');
	if (!video || !video.classList.contains('on')) { return; }
	try {
		var p = video.play();
		if (p && p.catch) { p.catch(function (e) { console.warn('[TT] video play blocked', e && e.message); }); }
	} catch (e) { /* ignore */ }
}

function stopTangTocVideo() {
	var video = document.querySelector('.ttDiv .ttMediaVideo');
	if (!video) { return; }
	try { video.pause(); } catch (e) { /* ignore */ }
}

/* ---------- timer bar on the dark strip of the contents frame ---------- */

function startTangTocTimer() {
	setTangTocTimer(0);
	var timer = document.querySelector('.ttDiv .ttTimerDiv');
	if (timer) { timer.classList.add('visible'); }
}

function setTangTocTimer(fraction) {
	var fill = document.querySelector('.ttDiv .vcnvTimerFill');
	var dot = document.querySelector('.ttDiv .vcnvTimerDot');
	if (!fill || !dot) { return; }
	var w = Math.round(Math.max(0, Math.min(1, fraction)) * TANG_TOC_TIMER_WIDTH);
	fill.style.width = w + 'px';
	dot.style.left = (w - TIMER_DOT / 2) + 'px';
}

function hideTangTocTimer() {
	var timer = document.querySelector('.ttDiv .ttTimerDiv');
	if (timer) { timer.classList.remove('visible'); }
}
