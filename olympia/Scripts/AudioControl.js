/*
 * Olympia Controller - audio. The engine (default.html, in a room: the one the control panel runs)
 * plays it; control.html never loads this file (the two pages would echo each other). In a room
 * the stage and audience screens (audience.html) load it too, to play what the engine relays to
 * them - see "where the sound plays" at the end.
 *
 * Seven channels, one HTMLAudioElement each, kept in window.GameVariables (same idea as Olga):
 *
 *   Olympia channel   Olga name              used for
 *   ---------------   --------------------   -----------------------------------------------
 *   StingerSound      GeneralSound           one-shot cues: start, open question, complete...
 *   RoundBedSound     LongPassiveSound       music under a whole turn, with loop points
 *   ResultSound       LongActiveSound        right / wrong
 *   BuzzerSound       ShortActiveSound       the buzzer, the CNV signal
 *   TimerSound        ShortPassiveSound      clock music of one question
 *   StarSound         LifelineActiveSound    Ngôi sao hy vọng sting
 *   AmbientSound      LifelinePassiveSound   score-summary music
 *
 * A channel plays one file at a time (a new file cuts the old one). With overlap = true the file
 * is fire-and-forget instead: it does not cut what is playing and stop…() will not touch it.
 *
 * The round bed is "three-part": [intro][loopStart <-> loopEnd][outro]. The loop is watched with a
 * 40 ms interval ('timeupdate' is too coarse and requestAnimationFrame stalls when the graphics
 * window is not the active one).
 */

/* ---------- the core: one channel ---------- */

function startSound(channel, filename, overlap, onEnded) {
	try {
		if (!overlap) { stopSound(channel); }
		var a = new Audio('Sounds/' + filename);
		if (window.GameVariables.SoundAt === 'stage' && window.GameVariables.Sync && window.GameVariables.Sync.room) { a.muted = true; }   /* the stage screens play it instead */
		if (onEnded) { a.addEventListener('ended', onEnded); }
		if (!overlap) { window.GameVariables[channel] = a; }
		var p = a.play();
		if (p && p.catch) { p.catch(function (err) { console.warn('[Audio] play blocked/failed', filename, err && err.message); }); }
		return a;
	}
	catch (e) { console.error('[Audio] play failed', filename, e); return null; }
}

function stopSound(channel) {
	if (window.GameVariables.FadeIntervals[channel]) {
		clearInterval(window.GameVariables.FadeIntervals[channel]);
		window.GameVariables.FadeIntervals[channel] = null;
	}
	var a = window.GameVariables[channel];
	if (a) {
		try { a.pause(); } catch (e) { /* ignore */ }
		window.GameVariables[channel] = null;
	}
}

function fadeOutSound(channel, ms) {
	var a = window.GameVariables[channel];
	if (!a) { return; }
	ms = ms || 1000;
	var step = a.volume / Math.max(1, Math.round(ms / 50));
	if (window.GameVariables.FadeIntervals[channel]) { clearInterval(window.GameVariables.FadeIntervals[channel]); }
	window.GameVariables.FadeIntervals[channel] = setInterval(function () {
		var v = a.volume - step;
		if (v <= 0.01) { stopSound(channel); }
		else { a.volume = v; }
	}, 50);
}

/* ---------- the channels by their Olga names ---------- */

function startGeneralSound(filename) { startSound('StingerSound', filename, true); }             /* always overlaps */
function stopGeneralSound() { stopSound('StingerSound'); }

function startLongActiveSound(filename, overlap) { startSound('ResultSound', filename, overlap); }
function stopLongActiveSound() { stopSound('ResultSound'); }

function startShortActiveSound(filename, overlap) { startSound('BuzzerSound', filename || 'kd_buzz.mp3', overlap); }
function playBuzzerSound() { startSound('BuzzerSound', 'kd_buzz.mp3', false); }                 /* the buzzer, never cut by a result sting */

function startShortPassiveSound(filename) { startSound('TimerSound', filename, false); }
/* the clock music of a clock resumed `sec` seconds in (GameSave.js) */
function seekShortPassiveSound(sec) {
	var a = window.GameVariables.TimerSound;
	if (!a || !(sec > 0)) { return; }
	function go() { try { a.currentTime = sec; } catch (e) { /* not seekable */ } }
	if (a.readyState >= 1) { go(); } else { a.addEventListener('loadedmetadata', go, { once: true }); }
}
function stopShortPassiveSound() { stopSound('TimerSound'); }

function startLifelineActiveSound(filename) { startSound('StarSound', filename, true); }
function startLifelinePassiveSound(filename) { startSound('AmbientSound', filename, false); }
function stopLifelinePassiveSound() { stopSound('AmbientSound'); }

function stopAllSounds() {
	window.GameVariables.AudioChannels.forEach(function (channel) { stopSound(channel); });
	stopLongPassiveSound();
}

/* ---------- LongPassiveSound: the three-part round bed ---------- */

/* Publishes the bed position so the control panel can show "bed at 37.2 s" without ticks. */
function publishBedState() {
	var a = window.GameVariables.RoundBedSound;
	if (!a) { window.GameVariables.BedState = null; }
	else {
		window.GameVariables.BedState = {
			file: window.GameVariables.BedFile,
			wallStart: Date.now(),
			offset: a.currentTime,
			looping: window.GameVariables.IsBedLooping,
			loopStart: window.GameVariables.BedLoopStart,
			loopEnd: window.GameVariables.BedLoopEnd,
			paused: a.paused
		};
	}
	if (window.GameVariables.changed) { window.GameVariables.changed(); }
}

function watchLongPassiveSound() {
	var a = window.GameVariables.RoundBedSound;
	if (!a || a.paused) { return; }
	if (window.GameVariables.IsBedLooping && window.GameVariables.BedLoopEnd > window.GameVariables.BedLoopStart && a.currentTime >= window.GameVariables.BedLoopEnd) {
		a.currentTime = window.GameVariables.BedLoopStart;
		console.log('[Audio] bed loop -> ' + window.GameVariables.BedLoopStart + 's');
		publishBedState();
	}
}

function stopBedWatch() {
	if (window.GameVariables.BedWatchInterval) {
		clearInterval(window.GameVariables.BedWatchInterval);
		window.GameVariables.BedWatchInterval = null;
	}
}

/* Plays a bed with the loop points from BedLoops (a file without an entry plays straight through). */
function startLongPassiveSound(filename) {
	stopLongPassiveSound();
	var def = window.GameVariables.BedLoops[filename];
	if (!def) { console.warn('[Audio] no loop points for', filename, '- playing straight through'); }
	window.GameVariables.BedFile = filename;
	window.GameVariables.BedLoopStart = def ? def.loopStart : 0;
	window.GameVariables.BedLoopEnd = def ? def.loopEnd : 0;
	window.GameVariables.BedReleaseTo = def && typeof def.releaseTo === 'number' ? def.releaseTo : window.GameVariables.BedLoopEnd;
	window.GameVariables.BedReleaseSlack = def ? (def.releaseSlack || 0) : 0;
	window.GameVariables.IsBedLooping = window.GameVariables.BedLoopEnd > window.GameVariables.BedLoopStart;
	var a = startSound('RoundBedSound', filename, false, function () {
		window.GameVariables.IsBedLooping = false;
		publishBedState();
	});
	if (a) {
		a.addEventListener('playing', function onPlaying() {
			a.removeEventListener('playing', onPlaying);
			publishBedState();
		});
		window.GameVariables.BedWatchInterval = setInterval(watchLongPassiveSound, 40);
	}
	publishBedState();
}

/* Leave the loop so the outro plays. Seeks forward to releaseTo if we are before it - but not
 * when already within releaseSlack seconds of it (a 1-2 s jump sounds worse than running on). */
function releaseLongPassiveSound() {
	var a = window.GameVariables.RoundBedSound;
	if (!a) { return; }
	window.GameVariables.IsBedLooping = false;
	var t = a.currentTime;
	if (t < window.GameVariables.BedReleaseTo - window.GameVariables.BedReleaseSlack) {
		a.currentTime = window.GameVariables.BedReleaseTo;
		console.log('[Audio] bed released ' + t.toFixed(1) + 's -> ' + window.GameVariables.BedReleaseTo + 's');
	}
	else {
		console.log('[Audio] bed released at ' + t.toFixed(1) + 's - close enough, no seek');
	}
	publishBedState();
}

function stopLongPassiveSound() {
	stopBedWatch();
	stopSound('RoundBedSound');
	window.GameVariables.BedFile = null;
	window.GameVariables.IsBedLooping = false;
	publishBedState();
}

function fadeOutLongPassiveSound(ms) {
	stopBedWatch();
	window.GameVariables.IsBedLooping = false;
	fadeOutSound('RoundBedSound', ms);
	setTimeout(function () { window.GameVariables.BedFile = null; publishBedState(); }, (ms || 1000) + 60);
}

/* ---------- where the sound plays (room mode) ----------
 * In a room the engine runs in the control panel, so its sound would come out of the operator's
 * machine - so in a room SoundAt is always 'stage': every sound call below is relayed on
 * pub:CODE and replayed by the stage and audience screens; here the audio still runs (clocks,
 * bed loop) but muted. Without a room ('here') this page is the stage and plays it itself.
 * Only the outermost call is relayed (startLongPassiveSound calls startSound itself...), and
 * callbacks stay here. */
(function (gv) {
	if (!gv.Sync || !gv.Sync.publish) { return; }   /* not the engine (a stage screen only replays - AudienceMirror.js) */
	/* in a room the engine runs inside the control panel: its sound only ever plays on the stage
	 * and audience screens. Without a room this page IS the stage, so it plays here. */
	function inRoom() { return !!(gv.Sync && gv.Sync.room); }
	/* read live: Sync.room is only set once the room is joined, after this file runs */
	Object.defineProperty(gv, 'SoundAt', { configurable: true, get: function () { return inRoom() ? 'stage' : 'here'; }, set: function () { /* fixed */ } });

	var depth = 0;
	function relay(op, args) {
		if (gv.SoundAt === 'here' || !gv.Sync || !gv.Sync.room || !gv.Sync.sendPublic) { return; }
		var plain = Array.prototype.slice.call(args).filter(function (a) { return typeof a !== 'function'; });
		gv.Sync.sendPublic({ type: 'sound', op: op, args: plain, at: Date.now() });
	}
	['startSound', 'stopSound', 'fadeOutSound', 'seekShortPassiveSound', 'stopAllSounds',
		'startLongPassiveSound', 'releaseLongPassiveSound', 'stopLongPassiveSound', 'fadeOutLongPassiveSound'].forEach(function (name) {
		var orig = window[name];
		window[name] = function () {
			if (depth === 0) { relay(name, arguments); }
			depth++;
			try { return orig.apply(this, arguments); }
			finally { depth--; }
		};
	});

	function channelAudios() {
		return gv.AudioChannels.map(function (c) { return { ch: c, a: gv[c] }; }).filter(function (x) { return !!x.a; });
	}
	function fileOf(a) { try { return decodeURIComponent(new URL(a.src).pathname.split('/').pop()); } catch (e) { return ''; } }

	/* what is playing now, for screens that start hearing mid-sound (a new choice, a screen just opened) */
	function sendCurrent() {
		channelAudios().forEach(function (x) {
			if (x.a.paused || x.a.ended) { return; }
			var file = fileOf(x.a);
			if (!file) { return; }
			if (x.ch === 'RoundBedSound') { gv.Sync.sendPublic({ type: 'sound', op: 'startLongPassiveSound', args: [file], at: Date.now(), seek: x.a.currentTime, ch: x.ch }); }
			else { gv.Sync.sendPublic({ type: 'sound', op: 'startSound', args: [x.ch, file, false], at: Date.now(), seek: x.a.currentTime, ch: x.ch }); }
		});
	}
	gv.sendCurrentSounds = function () { if (gv.SoundAt !== 'here' && gv.Sync && gv.Sync.room) { sendCurrent(); } };

	gv.Commands = gv.Commands || {};
	/* kept so an older panel's command does nothing harmful: the choice is fixed now */
	gv.Commands.setSoundAt = function () {
		channelAudios().forEach(function (x) { x.a.muted = inRoom(); });
	};
})(window.GameVariables);
