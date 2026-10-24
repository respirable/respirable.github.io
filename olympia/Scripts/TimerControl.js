/*
 * Olympia Controller - the one clock behind every timer bar (and the Khởi động 3 s count).
 * Only one clock runs at a time; starting a new one cancels the old one.
 *
 *   startClock({ mode: 'down'|'up', duration: seconds, onTick(value, elapsed), onDone(), label })
 *   stopClock()        cancels without calling onDone
 *   pauseClock() / resumeClock()   hold the clock still / go on from there (TimerState.paused,
 *                      .pausedElapsed while held; wallStart is moved on resume so every screen
 *                      computing "now - wallStart" stays right)
 *   isClockRunning()
 *
 * TimerState is published for the control panel (it draws its own countdown from it).
 */

function tickClock() {
	var c = window.GameVariables.CurrentClock;
	if (!c) { return; }
	var elapsed = (performance.now() - c.t0) / 1000;
	var done = elapsed >= c.duration;
	if (done) { elapsed = c.duration; }

	var value = (c.mode === 'down') ? (c.duration - elapsed) : elapsed;
	if (c.onTick) { c.onTick(value, elapsed); }

	if (done) {
		var cb = c.onDone;
		window.GameVariables.CurrentClock = null;
		window.GameVariables.TimerState = window.GameVariables.TimerState ? Object.assign({}, window.GameVariables.TimerState, { running: false, finished: true }) : null;
		if (window.GameVariables.changed) { window.GameVariables.changed(); }
		if (cb) { cb(); }
		return;
	}
	c.raf = requestAnimationFrame(tickClock);
}

/* opts.startAt: seconds already gone (a clock resumed after a crash - GameSave.js) */
function startClock(opts) {
	stopClock();
	var gone = Math.max(0, Math.min(opts.duration, Number(opts.startAt) || 0));
	window.GameVariables.CurrentClock = {
		mode: opts.mode || 'down',
		duration: opts.duration,
		t0: performance.now() - gone * 1000,
		onTick: opts.onTick || null,
		onDone: opts.onDone || null,
		label: opts.label || '',
		raf: null
	};
	var c = window.GameVariables.CurrentClock;
	window.GameVariables.TimerState = { running: true, finished: false, mode: c.mode, duration: c.duration, wallStart: Date.now() - gone * 1000, label: c.label };
	if (window.GameVariables.changed) { window.GameVariables.changed(); }
	tickClock();   /* first tick at once so the display shows the start value on the same frame */
}

function pauseClock() {
	var c = window.GameVariables.CurrentClock;
	if (!c || c.paused) { return; }
	if (c.raf) { cancelAnimationFrame(c.raf); c.raf = null; }
	c.paused = true;
	c.pausedElapsed = Math.min(c.duration, (performance.now() - c.t0) / 1000);
	window.GameVariables.TimerState = Object.assign({}, window.GameVariables.TimerState || {}, { running: false, paused: true, pausedElapsed: c.pausedElapsed });
	if (window.GameVariables.changed) { window.GameVariables.changed(); }
}

function resumeClock() {
	var c = window.GameVariables.CurrentClock;
	if (!c || !c.paused) { return; }
	c.paused = false;
	c.t0 = performance.now() - c.pausedElapsed * 1000;
	window.GameVariables.TimerState = Object.assign({}, window.GameVariables.TimerState || {}, { running: true, paused: false, pausedElapsed: null, wallStart: Date.now() - c.pausedElapsed * 1000 });
	if (window.GameVariables.changed) { window.GameVariables.changed(); }
	tickClock();
}

function stopClock() {
	var c = window.GameVariables.CurrentClock;
	if (c) {
		if (c.raf) { cancelAnimationFrame(c.raf); }
		window.GameVariables.CurrentClock = null;
		window.GameVariables.TimerState = window.GameVariables.TimerState ? Object.assign({}, window.GameVariables.TimerState, { running: false, paused: false }) : null;
		if (window.GameVariables.changed) { window.GameVariables.changed(); }
	}
}

function isClockRunning() { return !!window.GameVariables.CurrentClock; }
