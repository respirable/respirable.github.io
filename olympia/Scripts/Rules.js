/*
 * Olympia Controller - the rules a game is played by. Loaded right after Variables.js.
 *
 *   'o24'  Olympia 24 + 26 (the default): Khởi động individual + common turn, obstacle
 *          60-50-40-30 (20 after the centre), Tăng tốc clocks 20/20/30/30 (tangtoc.xml may set them)
 *   'o23'  Olympia 23: Khởi động is three common turns of 8, 12 and 16 questions (taken in order
 *          from <common> in khoidong.xml), obstacle 50-40-30-20 (10 after the centre), Tăng tốc
 *          clocks 10/20/30/40 whatever tangtoc.xml says
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
		TANG_TOC: gv.Timings.TANG_TOC.slice()
	};
	var O23 = {
		VCNV_OBSTACLE: { 1: 50, 2: 40, 3: 30, 4: 20 },
		VCNV_AFTER_CENTER: 10,
		TANG_TOC: [10, 20, 30, 40],
		KD_TURNS: [8, 12, 16]
	};

	gv.Rules = 'o24';
	gv.RulesO23 = O23;

	/* name: 'o24' | 'o23' (anything else: 'o24') */
	gv.applyRules = function (name) {
		var r = name === 'o23' ? 'o23' : 'o24';
		var src = r === 'o23' ? O23 : BASE;
		gv.Rules = r;
		gv.Points.VCNV_OBSTACLE = Object.assign({}, src.VCNV_OBSTACLE);
		gv.Points.VCNV_AFTER_CENTER = src.VCNV_AFTER_CENTER;
		gv.Timings.TANG_TOC = src.TANG_TOC.slice();
		if (document.body) { document.body.classList.toggle('rulesO23', r === 'o23'); }
		else { document.addEventListener('DOMContentLoaded', function () { document.body.classList.toggle('rulesO23', gv.Rules === 'o23'); }); }
		return r;
	};
	gv.isO23 = function () { return gv.Rules === 'o23'; };

	/* without a room: ?rules=o23 (trying it out on one machine) */
	var p = new URLSearchParams(location.search);
	if (!p.get('room') && p.get('rules')) { gv.applyRules(p.get('rules')); }
})(window.GameVariables);
