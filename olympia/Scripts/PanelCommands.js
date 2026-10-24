/*
 * Olympia Controller - the commands the control panel sends (control.html buttons).
 * StateSync.js receives them on the graphics page and calls GameVariables.Commands[name](args).
 * The names are what ControlPanel.js sends - do not rename them. Each one only calls the
 * functions of the rounds / graphics files.
 */

/* ---------- sound board ---------- */

/* any mapped file, fire-and-forget (a bed keeps its loop points) */
window.GameVariables.Commands.playSound = function (args) {
	var file = args && args.file;
	if (!file || !Object.prototype.hasOwnProperty.call(window.GameVariables.SoundMap, file)) { return; }
	if (window.GameVariables.BedLoops[file]) { startLongPassiveSound(file); }
	else { startGeneralSound(file); }
};

window.GameVariables.Commands.stopSounds = function () { stopAllSounds(); };

/* ---------- green screen ---------- */

window.GameVariables.Commands.greenScreenToggle = function () { toggleGreenScreen(); };

/* ---------- contestants ---------- */

window.GameVariables.Commands.setScore = function (args) { setScore(parseInt(args.seat, 10), args.value); };

/* Rename a contestant (remembered on this machine, beats players.xml). */
window.GameVariables.Commands.setName = function (args) {
	var p = window.GameVariables.getPlayer(parseInt(args && args.seat, 10));
	var name = String((args && args.name) || '').trim().replace(/\s+/g, ' ');
	if (!p || !name) { return; }
	p.fullName = name;
	saveNameOverride(p.seat, name);
	refreshContestantBars();
	refreshBoardScreen();
	console.log('[Names] seat ' + p.seat + ' -> ' + name);
};

/* Back to the names in players.xml (scores and flags untouched). */
window.GameVariables.Commands.resetNames = function () {
	clearNameOverrides();
	loadXml(window.GameVariables.DataFiles.players).then(function (doc) {
		doc.querySelectorAll('player').forEach(function (el) {
			var p = window.GameVariables.getPlayer(parseInt(el.getAttribute('seat'), 10));
			var n = el.querySelector('name');
			if (p) { p.fullName = (n && n.textContent.trim()) || ('Thí sinh ' + p.seat); }
		});
		refreshContestantBars();
		refreshBoardScreen();
		window.GameVariables.changed();
	}).catch(function (e) { console.error('[Names] players.xml reload failed', e); });
};

/* ---------- the round keys, pressed from the panel (always go to THAT round) ---------- */

window.GameVariables.Commands.kdKey = function (args) { if (args && typeof args.key === 'string') { window.GameVariables.Keyboard.dispatchTo('kd', args.key); } };
window.GameVariables.Commands.vcnvKey = function (args) { if (args && typeof args.key === 'string') { window.GameVariables.Keyboard.dispatchTo('vcnv', args.key); } };
window.GameVariables.Commands.ttKey = function (args) { if (args && typeof args.key === 'string') { window.GameVariables.Keyboard.dispatchTo('tt', args.key); } };
window.GameVariables.Commands.vdKey = function (args) { if (args && typeof args.key === 'string') { window.GameVariables.Keyboard.dispatchTo('vd', args.key); } };
window.GameVariables.Commands.tbKey = function (args) { if (args && typeof args.key === 'string') { window.GameVariables.Keyboard.dispatchTo('tb', args.key); } };

/* ---------- Khởi động ---------- */

/* restart from the individual turn - or, with a seat, only un-mark that seat (scores untouched) */
window.GameVariables.Commands.kdReset = function (args) { khoiDongReset(args && args.seat ? parseInt(args.seat, 10) : null); };
window.GameVariables.Commands.kdResetCommon = function () { khoiDongResetCommon(); };
window.GameVariables.Commands.kdClearBuzz = function () { if (window.GameVariables.KhoiDongMode == 'common') { khoiDongClearBuzz(); } };

/* mark / unmark a seat as already played (fixes a mis-press) */
window.GameVariables.Commands.kdSetDone = function (args) {
	var p = window.GameVariables.getPlayer(parseInt(args.seat, 10));
	if (p) { p.kdDone = !!args.done; }
};

/* ---------- Vượt chướng ngại vật ---------- */

window.GameVariables.Commands.vcnvReset = function () { vcnvReset(); };

/* show everything without awarding anything */
window.GameVariables.Commands.vcnvReveal = function () {
	if (window.GameVariables.VcnvSequenceCounter <= 1) { return; }   /* not before the board is up */
	vcnvRevealEverything();
};

/* take the graphics down once the obstacle is solved / revealed */
window.GameVariables.Commands.vcnvFinish = function () { if (window.GameVariables.VcnvSequenceCounter == 11) { vcnvFinishRound(); } };

/* undo a mistaken elimination */
window.GameVariables.Commands.vcnvUnEliminate = function (args) {
	var seat = parseInt(args && args.seat, 10);
	window.GameVariables.VcnvEliminated = window.GameVariables.VcnvEliminated.filter(function (s) { return s !== seat; });
	vcnvSyncEliminated();
};

/* args: { row: 1..5 (defaults to the current row), answers: { seat: text } } */
window.GameVariables.Commands.vcnvSetAnswers = function (args) {
	if (!args) { return; }
	vcnvSetAnswers(parseInt(args.row, 10) || null, args.answers);
};

/* ---------- Tăng tốc ---------- */

/* args: { answers: {seat: text}, times: {seat: seconds|''} } - partial updates allowed */
window.GameVariables.Commands.ttSetAnswers = function (args) { if (args) { tangTocSetAnswers(args.answers, args.times); } };
window.GameVariables.Commands.ttReset = function () { tangTocReset(); };
window.GameVariables.Commands.ttGoto = function (args) { tangTocGoto(parseInt(args && args.index, 10)); };

/* ---------- Về đích ---------- */

window.GameVariables.Commands.vdReset = function () { veDichReset(); };
window.GameVariables.Commands.vdGoto = function (args) { veDichGoto(parseInt(args && args.seat, 10)); };
window.GameVariables.Commands.vdSetOrder = function (args) { veDichSetOrder(args && args.order); };

/* ---------- Câu hỏi phụ ---------- */

window.GameVariables.Commands.tbReset = function () { tieBreakReset(); };
/* args: { seats: [1..4] } - who plays (before the tie-break starts); [] = the seats tied for first */
window.GameVariables.Commands.tbSetSeats = function (args) { tieBreakSetSeats(args && args.seats); };
