/*
 * Olympia Controller - the rules a game is played by. Loaded right after Variables.js.
 *
 *   'o24'  Olympia 24 + 26 (the default): Khởi động individual + common turn, obstacle
 *          60-50-40-30 (20 after the centre), Tăng tốc clocks 20/20/30/30 (tangtoc.xml may set them)
 *   'o23'  Olympia 23: Khởi động is three common turns of 8, 12 and 16 questions (taken in order
 *          from <common> in khoidong.xml), obstacle 50-40-30-20 (10 after the centre), Tăng tốc
 *          clocks 10/20/30/40 whatever tangtoc.xml says
 *   'jungle' "Luật rừng" (BETA) - scores may go below 0:
 *          Khởi động: 4 individual turns of 60 s (up to 12 questions + a bonus one at the end for
 *          every 3 right in a row, at most 4; 1st wrong free, then -5 each), then two common turns
 *          of 8 and 16 questions (the n-th wrong of a seat in a turn costs 5*(n-1));
 *          obstacle 100-75-50-25 (10 after the centre), -5 to every seat still in that misses a row;
 *          Tăng tốc 30 s each, 25/10/-5/-20 by speed, -20 for a wrong / no answer;
 *          Về đích: a wrong answer costs the value (x2 with the star), a right steal always takes
 *          the value from the contestant on stage
 *
 * Where the rules come from: the engine in a room asks the database (QuestionSet.js, room_rules
 * - migrations/0013) before it reads the questions; without a room, ?rules=o23 in the address
 * (for trying it out). The control panel and the screens take them from the state
 * (snapshot.rules -> gv.applyRules).
 */
(function (gv) {
	var BASE = {
		VCNV_OBSTACLE: Object.assign({}, gv.Points.VCNV_OBSTACLE),
		VCNV_AFTER_CENTER: gv.Points.VCNV_AFTER_CENTER,
		TANG_TOC: gv.Timings.TANG_TOC.slice(),
		TANG_TOC_RANK: gv.Points.TANG_TOC_RANK.slice()
	};
	var O23 = {
		VCNV_OBSTACLE: { 1: 50, 2: 40, 3: 30, 4: 20 },
		VCNV_AFTER_CENTER: 10,
		TANG_TOC: [10, 20, 30, 40],
		KD_TURNS: [8, 12, 16]
	};
	var JUNGLE = {
		VCNV_OBSTACLE: { 1: 100, 2: 75, 3: 50, 4: 25 },
		VCNV_AFTER_CENTER: 10,
		VCNV_ROW_MISS: -5,                 /* every seat still in that does not get the row right */
		TANG_TOC: [30, 30, 30, 30],
		TANG_TOC_RANK: [25, 10, -5, -20],
		TANG_TOC_MISS: -20,                /* a wrong / no answer */
		KD_OWN: { questions: 12, bonusMax: 4, streak: 3, seconds: 60, wrong: -5 },   /* the individual turn */
		KD_TURN_WRONG: -5,                 /* common turns: the n-th wrong of a seat costs (n-1) x this */
		KD_TURNS: [8, 16]
	};
	var NAMES = { o24: 'Olympia 24 + 26', o23: 'Olympia 23', jungle: 'Luật rừng (BETA)' };

	gv.Rules = 'o24';
	gv.RulesO23 = O23;
	gv.RulesJungle = JUNGLE;
	gv.RulesNames = NAMES;

	/* name: 'o24' | 'o23' | 'jungle' (anything else: 'o24') */
	gv.applyRules = function (name) {
		var r = NAMES[name] ? name : 'o24';
		var src = r === 'o23' ? O23 : (r === 'jungle' ? JUNGLE : BASE);
		gv.Rules = r;
		gv.Points.VCNV_OBSTACLE = Object.assign({}, src.VCNV_OBSTACLE);
		gv.Points.VCNV_AFTER_CENTER = src.VCNV_AFTER_CENTER;
		gv.Points.TANG_TOC_RANK = (src.TANG_TOC_RANK || BASE.TANG_TOC_RANK).slice();
		gv.Points.NEGATIVE = r === 'jungle';
		gv.Timings.TANG_TOC = src.TANG_TOC.slice();
		function mark() {
			document.body.classList.toggle('rulesO23', gv.Rules === 'o23');
			document.body.classList.toggle('rulesJungle', gv.Rules === 'jungle');
		}
		if (document.body) { mark(); } else { document.addEventListener('DOMContentLoaded', mark); }
		return r;
	};
	gv.isO23 = function () { return gv.Rules === 'o23'; };
	gv.isJungle = function () { return gv.Rules === 'jungle'; };
	/* Khởi động's common turns in the Olympia 23 style (sizes), or null (one 12-question turn, O24) */
	gv.kdCommonTurns = function () { return gv.Rules === 'o23' ? O23.KD_TURNS : (gv.Rules === 'jungle' ? JUNGLE.KD_TURNS : null); };
	/* Tăng tốc clocks fixed by the rules (tangtoc.xml's seconds ignored) */
	gv.fixedTangTocClocks = function () { return gv.Rules === 'o23' || gv.Rules === 'jungle'; };

	/* without a room: ?rules=o23 / ?rules=jungle (trying it out on one machine) */
	var p = new URLSearchParams(location.search);
	if (!p.get('room') && p.get('rules')) { gv.applyRules(p.get('rules')); }
})(window.GameVariables);
