/*
 * Olympia Controller - the intro video before Khởi động (every rules). The set's khoidong.xml
 * names it: <intro>intro.mp4</intro> (uploaded with the set; the question manager sets it).
 *
 *   ← at Khởi động's first step   plays it full screen, over everything; when it ends, that same
 *                                  first step runs by itself (title card + kd_start, or the turn)
 *   ← while it plays              skips the rest (the first step runs at once)
 *
 * It plays once per game (again after the whole Khởi động is reset). It runs on the 'kd_intro'
 * clock; the stage / audience screens follow that clock (AudienceMirror.js), the stage screen with
 * its sound. In a room the engine's own copy is muted (the hall hears the stage).
 */

function renderKdIntro() {
	var stage = document.querySelector('.stageContainerDiv');
	if (!stage || document.querySelector('.kdIntroDiv')) { return document.querySelector('.kdIntroDiv'); }
	var root = newElement('div', 'kdIntroDiv', stage);
	var video = newElement('video', 'kdIntroVideo', root);
	video.preload = 'auto';
	video.playsInline = true;
	video.muted = true;
	return root;
}

function kdIntroVideo() { return document.querySelector('.kdIntroDiv .kdIntroVideo'); }
function isKdIntroShowing() { return !!document.querySelector('.kdIntroDiv.on'); }

/* src ('' = none): loads it, does not show it */
function setKdIntro(src) {
	renderKdIntro();
	var video = kdIntroVideo();
	if (!video) { return; }
	if (!src) { try { video.pause(); } catch (e) { /* ignore */ } video.removeAttribute('src'); return; }
	if (video.getAttribute('src') !== src) { video.src = src; video.load(); }
}

function showKdIntro() { var r = renderKdIntro(); if (r) { r.classList.add('on'); } }

function hideKdIntro() {
	var r = document.querySelector('.kdIntroDiv');
	if (!r) { return; }
	r.classList.remove('on');
	var video = kdIntroVideo();
	if (video) { try { video.pause(); } catch (e) { /* ignore */ } }
}

/* ---------- the engine's side ---------- */

function khoiDongIntroPending() {
	var g = window.GameVariables;
	return !!(g.KdIntro && !g.KdIntroPlayed && !g.IsKdIntroPlaying);
}

/* then(): Khởi động's first step, run once the intro is over (or skipped / unplayable) */
function khoiDongPlayIntro(then) {
	var g = window.GameVariables, video = kdIntroVideo();
	if (!video || !g.KdIntro) { g.KdIntroPlayed = true; then(); return; }
	setKdIntro(g.KdIntro);
	g.IsKdIntroPlaying = true;
	g.KdIntroThen = then;
	showKdIntro();
	g.changed();
	function go() {
		if (!g.IsKdIntroPlaying) { return; }
		var dur = video.duration;
		if (!(dur > 0) || !isFinite(dur)) { console.warn('[KĐ] the intro cannot be played'); khoiDongEndIntro(); return; }
		try { video.currentTime = 0; } catch (e) { /* ignore */ }
		video.muted = g.SoundAt === 'stage';   /* in a room the stage screens play it with sound */
		var p = video.play(); if (p && p.catch) { p.catch(function () {}); }
		startClock({ mode: 'down', duration: dur, label: 'kd_intro', onDone: khoiDongEndIntro });
	}
	if (video.readyState >= 1) { go(); return; }
	var waited = clockTimeout(function () { video.removeEventListener('loadedmetadata', onMeta); go(); }, 5000);   /* gives up inside go() */
	function onMeta() { clearClockTimeout(waited); go(); }
	video.addEventListener('loadedmetadata', onMeta, { once: true });
}

/* the end (or ← to skip): the intro goes and Khởi động's first step runs */
function khoiDongEndIntro() {
	var g = window.GameVariables;
	if (!g.IsKdIntroPlaying) { return; }
	if (g.TimerState && g.TimerState.label === 'kd_intro' && isClockRunning()) { stopClock(); }
	g.IsKdIntroPlaying = false;
	g.KdIntroPlayed = true;
	hideKdIntro();
	var then = g.KdIntroThen;
	g.KdIntroThen = null;
	if (then) { then(); }
	g.changed();
}

/* leaving Khởi động mid-intro: it stops and counts as not played */
function khoiDongStopIntro() {
	var g = window.GameVariables;
	if (!g.IsKdIntroPlaying) { return; }
	if (g.TimerState && g.TimerState.label === 'kd_intro' && isClockRunning()) { stopClock(); }
	g.IsKdIntroPlaying = false;
	g.KdIntroThen = null;
	hideKdIntro();
}
