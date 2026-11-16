/*
 * Olympia Controller - the rules a game is played by. Loaded right after Variables.js.
 *
 *   'o26'  Olympia 26 (the default): Khởi động individual + common turn, obstacle
 *          60-50-40-30 (20 after the centre), Tăng tốc clocks always 20/20/30/30;
 *          the Olympia 26 graphics (O26Frames.js, Styles/o26.css, body.rulesO26)
 *   'o24'  Olympia 24: as 'o26' with the O24 graphics, but Tăng tốc clocks 10/20/30/40
 *          (rooms made before 'o26' existed - "Olympia 24 + 26" - are 'o24')
 *   Every rules sets the Tăng tốc clocks itself: tangtoc.xml's seconds="" is not read any more.
 *   'o23'  Olympia 23: Khởi động is three common turns of 8, 12 and 16 questions (taken in order
 *          from <common> in khoidong.xml), obstacle 50-40-30-20 (10 after the centre), Tăng tốc
 *          clocks 10/20/30/40 whatever tangtoc.xml says
 *   'jungle' "Luật rừng" (BETA) - scores may go below 0:
 *          Khởi động: 4 individual turns of 60 s (up to 12 questions + a bonus one at the end for
 *          every 3 right in a row, at most 4; 1st wrong free, then -5 each), then two common turns
 *          of 8 and 16 questions (the n-th wrong of a seat in a turn costs 5*(n-1));
 *          obstacle 100-75-50-25 (10 after the centre) - a wrong guess costs that much -, -5 to every
 *          seat still in that misses a row;
 *          Tăng tốc 30 s each, 25/10/-5/-20 by speed, -20 for a wrong / no answer;
 *          Về đích: always seat 1 - 2 - 3 - 4; a wrong answer costs the value (x2 with the star), a
 *          right steal always takes the value from the contestant on stage
 *   'jungle2' "Luật rừng 2" (BETA) - scores may go below 0:
 *          Khởi động: individual turn as Olympia 26 but 10 questions each; one common turn of 16
 *          (a wrong buzz costs nothing); then the BOARD turn (Rounds/KdBoard.js): 6 questions worth
 *          10 10 15 15 20 20, picked by the host, buzzers; right = the value, wrong = nothing, the
 *          others may buzz once more;
 *          obstacle right 10-10-5-5 (5 after the centre), wrong -10/-25/-50/-75 (-100 after the
 *          centre) by the rows opened; a row right is worth nothing, every seat still in that
 *          misses it -5;
 *          Tăng tốc 20/20/30/30 s, +5/-10/-25/-40 by speed, -40 for a wrong / no answer;
 *          Về đích: the 20 / 30 questions of the set count as "0 điểm" / "5 điểm" (VE_DICH below)
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
		TANG_TOC_RANK: gv.Points.TANG_TOC_RANK.slice(),
		VCNV_ROW: gv.Points.VCNV_ROW,
		VCNV_CENTER: gv.Points.VCNV_CENTER,
		KD_WRONG_COMMON: gv.Points.KD_WRONG_COMMON,
		KD_QUESTIONS_PER_PLAYER: gv.Timings.KD_QUESTIONS_PER_PLAYER,
		KD_COMMON_QUESTIONS: gv.Timings.KD_COMMON_QUESTIONS
	};
	var O24 = {
		VCNV_OBSTACLE: BASE.VCNV_OBSTACLE,
		VCNV_AFTER_CENTER: BASE.VCNV_AFTER_CENTER,
		TANG_TOC: [10, 20, 30, 40]
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
	var JUNGLE2 = {
		VCNV_OBSTACLE: { 1: 10, 2: 10, 3: 5, 4: 5 },
		VCNV_AFTER_CENTER: 5,
		VCNV_OBSTACLE_WRONG: { 1: 10, 2: 25, 3: 50, 4: 75 },   /* a wrong obstacle guess, by the rows opened */
		VCNV_WRONG_AFTER_CENTER: 100,
		VCNV_ROW: 0,
		VCNV_CENTER: 0,
		VCNV_ROW_MISS: -5,
		VCNV_UNSOLVED: -20,                /* the final 15 s over and nobody solved it: every seat still in */
		TANG_TOC: [20, 20, 30, 30],
		TANG_TOC_RANK: [5, -10, -25, -40],
		TANG_TOC_MISS: -40,
		KD_QUESTIONS_PER_PLAYER: 10,
		KD_COMMON_QUESTIONS: 16,
		KD_WRONG_COMMON: 0,
		KD_BOARD: [10, 10, 15, 15, 20, 20],   /* the board turn's tiles, keys 1-6: top-bottom, then left-right */
		/* Về đích by the set's question value (20 -> "0 điểm", 30 -> "5 điểm"): the value shown,
		 * right (with the star), wrong (with the star), a right steal (to the stealer, and taken from
		 * the contestant on stage, star or not), a wrong steal */
		VE_DICH: {
			20: { label: 0, right: 0, rightStar: 5, wrong: -20, wrongStar: -40, steal: 5, stealTake: 5, stealWrong: -10 },
			30: { label: 5, right: 5, rightStar: 10, wrong: -30, wrongStar: -60, steal: 10, stealTake: 10, stealWrong: -15 }
		}
	};
	var NAMES = { o26: 'Olympia 26', o24: 'Olympia 24', o23: 'Olympia 23', jungle: 'Luật rừng (BETA)', jungle2: 'Luật rừng 2 (BETA)' };

	gv.Rules = 'o26';
	gv.RulesO23 = O23;
	gv.RulesJungle = JUNGLE;
	gv.RulesJungle2 = JUNGLE2;
	gv.RulesNames = NAMES;

	function pick(v, dflt) { return v === undefined ? dflt : v; }

	/* name: 'o26' | 'o24' | 'o23' | 'jungle' | 'jungle2' (anything else: 'o26') */
	gv.applyRules = function (name) {
		var r = NAMES[name] ? name : 'o26';
		var src = r === 'o23' ? O23 : (r === 'jungle' ? JUNGLE : (r === 'jungle2' ? JUNGLE2 : (r === 'o24' ? O24 : BASE)));
		var P = gv.Points, T = gv.Timings;
		gv.Rules = r;
		P.VCNV_OBSTACLE = Object.assign({}, src.VCNV_OBSTACLE);
		P.VCNV_AFTER_CENTER = src.VCNV_AFTER_CENTER;
		/* a wrong obstacle guess: Luật rừng - what a right one would win; Luật rừng 2 - its own table */
		P.VCNV_OBSTACLE_WRONG = src.VCNV_OBSTACLE_WRONG ? Object.assign({}, src.VCNV_OBSTACLE_WRONG) : (r === 'jungle' ? Object.assign({}, src.VCNV_OBSTACLE) : null);
		P.VCNV_WRONG_AFTER_CENTER = pick(src.VCNV_WRONG_AFTER_CENTER, r === 'jungle' ? src.VCNV_AFTER_CENTER : 0);
		P.VCNV_ROW = pick(src.VCNV_ROW, BASE.VCNV_ROW);
		P.VCNV_CENTER = pick(src.VCNV_CENTER, BASE.VCNV_CENTER);
		P.VCNV_ROW_MISS = src.VCNV_ROW_MISS || 0;           /* every seat still in that misses a row */
		P.VCNV_UNSOLVED = src.VCNV_UNSOLVED || 0;           /* every seat still in when the final 15 s end unsolved */
		P.TANG_TOC_RANK = (src.TANG_TOC_RANK || BASE.TANG_TOC_RANK).slice();
		P.TANG_TOC_MISS = src.TANG_TOC_MISS || 0;           /* a wrong / no answer */
		P.KD_WRONG_COMMON = pick(src.KD_WRONG_COMMON, BASE.KD_WRONG_COMMON);
		P.VE_DICH = src.VE_DICH || null;                    /* null: the value itself (and the rules' own steal / star handling) */
		P.NEGATIVE = r === 'jungle' || r === 'jungle2';
		T.TANG_TOC = src.TANG_TOC.slice();
		T.KD_QUESTIONS_PER_PLAYER = pick(src.KD_QUESTIONS_PER_PLAYER, BASE.KD_QUESTIONS_PER_PLAYER);
		T.KD_COMMON_QUESTIONS = pick(src.KD_COMMON_QUESTIONS, BASE.KD_COMMON_QUESTIONS);
		/* Khởi động not started yet: its individual turn has the rules' length */
		if (!gv.KhoiDongSequenceCounter && gv.KhoiDongMode !== 'common') { gv.KhoiDongQuestionCount = T.KD_QUESTIONS_PER_PLAYER; }
		function mark() {
			document.body.classList.toggle('rulesO26', gv.o26Graphics());   /* the Olympia 26 face (o26.css, O26Frames.js) */
			document.body.classList.toggle('rulesO23', gv.Rules === 'o23');
			document.body.classList.toggle('rulesJungle', gv.Rules === 'jungle');
			document.body.classList.toggle('rulesJungle2', gv.Rules === 'jungle2');
		}
		if (document.body) { mark(); } else { document.addEventListener('DOMContentLoaded', mark); }
		return r;
	};
	gv.isO26 = function () { return gv.Rules === 'o26'; };
	/* the Olympia 26 graphics: Olympia 26 and Luật rừng 2 (its rules stay its own: gv.isO26() is false) */
	gv.o26Graphics = function () { return gv.Rules === 'o26' || gv.Rules === 'jungle2'; };
	gv.isO23 = function () { return gv.Rules === 'o23'; };
	gv.isJungle = function () { return gv.Rules === 'jungle'; };
	gv.isJungle2 = function () { return gv.Rules === 'jungle2'; };
	/* the Khởi động board turn after the common turn (Luật rừng 2): its tiles' values, or null */
	gv.kdBoardValues = function () { return gv.Rules === 'jungle2' ? JUNGLE2.KD_BOARD.slice() : null; };
	/* Khởi động's common turns in the Olympia 23 style (sizes), or null (one 12-question turn, O24) */
	gv.kdCommonTurns = function () { return gv.Rules === 'o23' ? O23.KD_TURNS : (gv.Rules === 'jungle' ? JUNGLE.KD_TURNS : null); };
	/* Tăng tốc clocks fixed by the rules (tangtoc.xml's seconds ignored) */
	gv.fixedTangTocClocks = function () { return true; };   /* every rules: its own clocks (Timings.TANG_TOC) */

	/* without a room: ?rules=o24 / ?rules=o23 / ?rules=jungle / ?rules=jungle2 (trying it out on one machine) */
	var p = new URLSearchParams(location.search);
	gv.applyRules(!p.get('room') && p.get('rules') ? p.get('rules') : 'o26');
})(window.GameVariables);
