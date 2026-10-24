/*
 * Olympia Controller - the four contestant bars (O24 "Warm-up" graphics).
 *
 * Each bar (#contestantBar1..4) = two PNGs stacked (contestant_bar.png idle,
 * contestant_answer_signal.png red) switched by opacity so the layout never shifts, plus the name
 * ("1.Minh Đức") and the score. Names and scores go into the DOM with textContent only.
 *
 *   showScoreboard / hideScoreboard / toggleScoreboard   the whole strip on / off (key 0)
 *   revealContestantBars / hideContestantBars            the bars pop in one by one / all gone
 *
 * clearBuzzers() must be called at EVERY question change and round change.
 */

function contestantBarNameText(p) { return p.seat + '.' + window.GameVariables.displayName(p); }

function getContestantBar(seat) { return document.getElementById('contestantBar' + seat); }

/* Rebuild all four bars from Players. */
function renderContestantBars() {
	var root = document.querySelector('.scoreboardDiv');
	if (!root) { return; }
	root.textContent = '';
	window.GameVariables.Players.forEach(function (p) {
		var bar = newElement('div', 'contestantBar seat' + p.seat, root);
		bar.id = 'contestantBar' + p.seat;
		newImage('O24/Warm-up/contestant_bar.png', 'barIdleImg', bar);
		newImage('O24/Warm-up/contestant_answer_signal.png', 'barSignalImg', bar);
		newElement('p', 'contestantNameP', bar).textContent = contestantBarNameText(p);
		newElement('p', 'contestantScoreP', bar).textContent = String(p.score);
	});
	refreshContestantBars();
	root.classList.toggle('hidden', !window.GameVariables.IsScoreboardShowing);
}

/* A round may give a bar a look of its own: { plain, absent, grey } or null.
 *   plain   name only - no seat number, no score        absent  not shown at all (opacity 0)
 *   grey    the eliminated look
 * During the Câu hỏi phụ the round decides (Rounds/TieBreak.js tieBreakBarLook); the audience
 * screen copies the stage's (MirrorBarLook, set by AudienceMirror.js). Otherwise grey = out of VCNV. */
function contestantBarLook(p) {
	var g = window.GameVariables;
	if (g.CurrentRound === 'tb' && typeof tieBreakBarLook === 'function') { return tieBreakBarLook(p.seat); }
	if (g.MirrorBarLook) { return g.MirrorBarLook[p.seat] || null; }
	return null;
}

/* Names and the on-stage / buzzed / eliminated look, from Players. */
function refreshContestantBars() {
	window.GameVariables.Players.forEach(function (p) {
		var bar = getContestantBar(p.seat);
		if (!bar) { return; }
		var look = contestantBarLook(p);
		bar.classList.toggle('onStage', !!p.isOnStage);
		bar.classList.toggle('buzzed', !!p.isBuzzed);
		bar.classList.toggle('eliminated', look ? !!look.grey : !!p.isEliminatedFromVCNV);
		bar.classList.toggle('plain', !!(look && look.plain));
		bar.classList.toggle('absent', !!(look && look.absent));
		bar.querySelector('.contestantNameP').textContent = (look && look.plain) ? window.GameVariables.displayName(p) : contestantBarNameText(p);
	});
	if (typeof refreshBoardScreen === 'function') { refreshBoardScreen(); }   /* the F6 board hides the same seats */
}

function setContestantBarScore(seat, value) {
	var bar = getContestantBar(seat);
	if (bar) { bar.querySelector('.contestantScoreP').textContent = String(Math.round(value)); }
	refreshBoardScreen();   /* the F6 board follows the live scores */
}

/* delta may be negative. The graphics cut straight to the new value - no count-up.
 * Scores never go below 0 (house rule). */
function addScore(seat, delta) {
	var p = window.GameVariables.getPlayer(seat);
	if (!p) { return; }
	p.score = Math.max(0, p.score + delta);
	setContestantBarScore(seat, p.score);
	window.GameVariables.changed();
}

/* Direct set - manual correction from the control panel. */
function setScore(seat, value) {
	var p = window.GameVariables.getPlayer(seat);
	if (!p) { return; }
	p.score = Math.max(0, Math.round(Number(value) || 0));
	setContestantBarScore(seat, p.score);
	window.GameVariables.changed();
}

/* One contestant on stage (red bar); null clears everyone. */
function setContestantOnStage(seat) {
	window.GameVariables.Players.forEach(function (p) { p.isOnStage = (p.seat === seat); });
	window.GameVariables.ActiveSeat = seat || null;
	refreshContestantBars();
	window.GameVariables.changed();
}

function setContestantBuzzed(seat, on) {
	var p = window.GameVariables.getPlayer(seat);
	if (!p) { return; }
	p.isBuzzed = !!on;
	if (on) {
		if (window.GameVariables.BuzzOrder.indexOf(seat) === -1) { window.GameVariables.BuzzOrder.push(seat); }
		if (window.GameVariables.ActiveSeat === null) { window.GameVariables.ActiveSeat = seat; }
	}
	else {
		window.GameVariables.BuzzOrder = window.GameVariables.BuzzOrder.filter(function (s) { return s !== seat; });
		if (window.GameVariables.ActiveSeat === seat) { window.GameVariables.ActiveSeat = window.GameVariables.BuzzOrder.length ? window.GameVariables.BuzzOrder[0] : null; }
	}
	refreshContestantBars();
	window.GameVariables.changed();
}

/* Clears buzz signals + BuzzOrder + ActiveSeat (unless someone is on stage). */
function clearBuzzers() {
	window.GameVariables.Players.forEach(function (p) { p.isBuzzed = false; });
	window.GameVariables.BuzzOrder = [];
	var onStage = window.GameVariables.Players.filter(function (p) { return p.isOnStage; })[0];
	window.GameVariables.ActiveSeat = onStage ? onStage.seat : null;
	refreshContestantBars();
	window.GameVariables.changed();
}

/* ---------- the whole strip (key 0) ---------- */

function showScoreboard() {
	window.GameVariables.IsScoreboardShowing = true;
	var root = document.querySelector('.scoreboardDiv');
	if (root) { root.classList.remove('hidden'); }
	window.GameVariables.changed();
}

function hideScoreboard() {
	window.GameVariables.IsScoreboardShowing = false;
	var root = document.querySelector('.scoreboardDiv');
	if (root) { root.classList.add('hidden'); }
	window.GameVariables.changed();
}

function toggleScoreboard() {
	if (window.GameVariables.IsScoreboardShowing) { hideScoreboard(); } else { showScoreboard(); }
}

/* ---------- the bars one by one ---------- */

function revealContestantBars() {
	cancelContestantBarsReveal();
	window.GameVariables.Players.forEach(function (p) {
		var seat = p.seat;
		window.GameVariables.ContestantBarRevealTimeouts.push(setTimeout(function () {
			var bar = getContestantBar(seat);
			if (bar) { bar.classList.add('shown'); }
		}, 300 + seat * 190));
	});
}

/* Cancels reveals still waiting to fire, without touching bars already shown. */
function cancelContestantBarsReveal() {
	window.GameVariables.ContestantBarRevealTimeouts.forEach(function (id) { clearTimeout(id); });
	window.GameVariables.ContestantBarRevealTimeouts = [];
}

/* Instantly hides every bar (no animation) and cancels any pending reveal. */
function hideContestantBars() {
	cancelContestantBarsReveal();
	window.GameVariables.Players.forEach(function (p) {
		var bar = getContestantBar(p.seat);
		if (bar) { bar.classList.remove('shown'); }
	});
}

/* True while any contestant bar is on screen (used to block the score summary). */
function isAnyContestantBarShown() {
	return window.GameVariables.Players.some(function (p) {
		var bar = getContestantBar(p.seat);
		return !!(bar && bar.classList.contains('shown'));
	});
}
