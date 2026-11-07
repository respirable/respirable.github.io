/*
 * "Bạn có tạch đỉnh Olympia?" - the host. Runs a whole Olympia 26 match on the engine's own steps
 * (the host's keys: LUCK.key('ArrowLeft') ..., or the round functions the keys call), with the
 * robots and the player's taps as the contestants. Every answer is a roll:
 *
 *   Khởi động   individual turn: tap the bar within 5 s, 50 % (+10 / 0); common turn: a buzzer race
 *               with the robots (each buzzes with 70 %, after 0.8-4 s), the first is right 50 % (+10 / -5)
 *   VCNV        the chooser picks a row (the player taps a row of the board); during the 15 s the
 *               player taps the bar to answer (50 %), the robots answer (50 %); a tap on the picture
 *               signals for the obstacle (right 10 %); a robot now and then wants to signal and
 *               does so with 30 %
 *   Tăng tốc    6 / 6 / 8 / 8 taps ("lệnh hỏi") per question, 50 % each, robots the same; ranked by
 *               the number right: 40 / 30 / 20 / 10, equal counts share, none right -> 0
 *   Về đích     the player picks the package and the star; up to 2 taps on a 20-point question
 *               (a roll of 71+ is right) / 3 on a 30-point one (91+) - each tap is only "recorded",
 *               right or wrong shows when the clock runs out; every question has a hidden robot
 *               level (right 10 % / 40 % / always); steals: the player taps the bar to buzz, then
 *               once more to answer (one roll, same mark), a robot wants to steal with 30 %
 *   Câu hỏi phụ only when the top score is shared: the first to buzz once the 15 s music starts wins;
 *               a buzz before it is "early" and out of that question
 *
 * After Khởi động, VCNV, Tăng tốc and at the end: the score summary (M), every contestant.
 * Between the steps of VCNV, Tăng tốc and Về đích the host waits 5-15 s (LUCK.pause - the
 * player can skip with "Tiếp ›"); Khởi động and the tie-break keep the show's quick pace.
 */
(function () {
	var gv = window.GameVariables, L = window.LUCK;
	var BAR_KD = '.questionBarDiv', BAR_VCNV = '.vcnvQuestionDiv', BAR_TT = '.ttDiv', BAR_VD = '.vdQuestionGroup';
	var PICTURE = '.vcnvPictureDiv', ROWS = '.vcnvBoardDiv [class*="vcnvStrip"]';
	var WRONG = ['TÔI KHÔNG BIẾT', 'HÊN XUI', 'ĐOÁN BỪA', 'CHỊU', '???', 'NHÂN PHẨM', 'MAY RỦI', 'BỎ QUA'];
	var STEP = [5, 15];        /* the pause between two steps of VCNV / TT / VĐ (s) */
	var QUICK = [1.5, 3];      /* Khởi động / tie-break */

	function step() { return L.pause(STEP[0], STEP[1]); }
	function quick() { return L.pause(QUICK[0], QUICK[1]); }
	function bots(except) { return L.bots.filter(function (s) { return s !== except; }); }
	function rightWord(ok) { return ok ? 'ĐÚNG' : 'SAI'; }

	/* ======================================================================== Khởi động */

	async function khoiDong() {
		switchRound('kd');
		L.key('ArrowLeft');                         /* title + kd_start */
		await L.sleep(3500);
		for (var turn = 0; turn < 4; turn++) {
			L.key('ArrowLeft');                     /* the next contestant is called */
			await L.sleep(1800);
			L.key('ArrowLeft');                     /* the bar zooms in, the bars pop in */
			await L.sleep(2600);
			var seat = gv.KhoiDongSeat;
			for (var q = 0; q < gv.KhoiDongQuestionCount; q++) {
				L.key('ArrowRight');                /* question q */
				var ok;
				if (L.isMe(seat)) {
					var tapped = await tapOnce(BAR_KD, 'Nhấn vào thanh câu hỏi để trả lời (5 giây)', 5000);
					ok = tapped && L.record(L.chance(0.5));
					if (!tapped) { L.toast('Hết giờ - tính là sai', 'bad'); }
				}
				else {
					await L.sleep(L.between(1000, 3000));
					ok = L.chance(0.5);
				}
				L.key(ok ? 'ArrowUp' : 'ArrowDown');
				L.toast(L.name(seat) + ': ' + rightWord(ok), ok ? 'good' : 'bad');
				await L.sleep(L.between(1400, 2200));
			}
			L.key('ArrowRight');                    /* end of the turn: kd_complete 1 s later */
			await L.sleep(11000);                   /* 10 s from kd_complete to the next kd_ready */
		}
		L.key('ArrowLeft');                         /* the common turn */
		await L.sleep(1800);
		L.key('ArrowLeft');
		await L.sleep(2600);
		for (var c = 0; c < gv.KhoiDongQuestionCount; c++) {
			L.key('ArrowRight');
			await kdBuzzRace();
			await L.sleep(L.between(1400, 2400));
		}
		L.key('ArrowRight');                        /* Khởi động over: kd_complete 1 s later */
		await L.sleep(11000);                       /* 10 s from kd_complete to the score summary */
	}

	/* the first to buzz answers: the player taps the bar, each robot buzzes with 70 % */
	async function kdBuzzRace() {
		var winner = null, timers = [];
		function buzz(seat) {
			if (winner !== null || gv.KhoiDongBuzzSeat !== null) { return; }
			winner = seat;
			khoiDongBuzz(seat);
			L.changed();
		}
		L.bots.forEach(function (s) { if (L.chance(0.7)) { timers.push(L.after(L.between(800, 4000), function () { buzz(s); })); } });
		var stop = L.expect(BAR_KD, function () { buzz(L.me); }, 'Nhấn vào thanh câu hỏi để bấm chuông!', 0.08);
		await L.until(function () { return winner !== null; }, 5000);
		stop();
		timers.forEach(function (t) { t.cancel(); });
		if (winner === null) { L.key('ArrowDown'); L.toast('Không ai bấm chuông', ''); return; }
		await L.sleep(1100);
		var ok = L.chance(0.5);
		if (L.isMe(winner)) { L.record(ok); }
		L.key(ok ? 'ArrowUp' : 'ArrowDown');
		L.toast(L.name(winner) + ': ' + rightWord(ok) + (ok ? ' +10' : ' -5'), ok ? 'good' : 'bad');
	}

	/* one tap within ms: true if tapped */
	function tapOnce(sel, hint, ms) {
		return new Promise(function (res) {
			var done = false;
			var stop = L.expect(sel, function () { if (!done) { done = true; stop(); res(true); } }, hint, 0.2);
			L.after(ms, function () { if (!done) { done = true; stop(); res(false); } });
		});
	}

	/* ======================================================================== VCNV */

	var guessTimer = null;
	function vcnvOver() { return gv.IsVcnvSolved || gv.VcnvSequenceCounter == 11 || vcnvAllEliminated(); }
	/* a signal freezes the row flow: wait until it has been ruled */
	function guardGuess() { return L.until(function () { return gv.VcnvSequenceCounter != 9; }); }

	function signal(seat) {
		if (!vcnvIsRowStep() && gv.VcnvSequenceCounter != 9) { return false; }
		if (vcnvIsEliminated(seat) || vcnvInQueue(seat) || gv.IsVcnvSolved) { return false; }
		vcnvSignal(seat);
		if (!vcnvInQueue(seat)) { return false; }
		L.changed();
		L.toast(L.name(seat) + ' xin trả lời chướng ngại vật!', 'warn');
		if (guessTimer) { guessTimer.cancel(); }
		guessTimer = L.after(2600, ruleGuess);   /* others may join in the meantime */
		return true;
	}
	/* everyone in the queue answers; the first right one solves it */
	function ruleGuess() {
		var queue = gv.VcnvQueue.slice(), solver = null;
		queue.forEach(function (s) {
			var ok = L.chance(0.1);
			if (L.isMe(s)) { L.record(ok); }
			if (ok && solver === null) { solver = s; }
		});
		if (solver !== null) {
			vcnvGuessCorrect(solver);
			L.toast(L.name(solver) + ' giải được chướng ngại vật!', 'good');
		}
		else {
			vcnvGuessAllWrong();
			L.toast(queue.map(L.name).join(', ') + ': SAI - bị loại khỏi VCNV', 'bad');
		}
		L.changed();
	}

	/* the picture: the player may signal at any row step */
	var stopPicture = null;
	function offerPicture() {
		if (stopPicture || vcnvIsEliminated(L.me)) { return; }
		stopPicture = L.expect(PICTURE, function () {
			if (signal(L.me)) { stopPicture(); stopPicture = null; }
		}, 'Nhấn vào ảnh gợi ý để xin trả lời chướng ngại vật (đúng 10%)', 0.004);
	}
	function closePicture() { if (stopPicture) { stopPicture(); stopPicture = null; } }

	/* a robot now and then "wants" to signal; it really does with 30 % */
	var robotWant = null;
	function startRobotWants() {
		robotWant = setInterval(function () {
			if (L.isPaused() || vcnvOver() || !vcnvIsRowStep()) { return; }
			L.bots.forEach(function (s) {
				if (!vcnvIsEliminated(s) && !vcnvInQueue(s) && L.chance(0.005) && L.chance(0.3)) { signal(s); }   /* wants now and then; really signals with 30 % */
			});
		}, 1000);
	}

	async function vcnv() {
		await L.sleep(3500);                        /* the title card (switchRound showed it) */
		L.key('ArrowLeft');                         /* board + picture + question bar */
		await step();
		startRobotWants();
		offerPicture();
		var order = [1, 2, 3, 4], turn = 0, rowsPlayed = 0;
		while (rowsPlayed < 4 && !vcnvOver()) {
			await guardGuess();                     /* a signal being ruled may put the next chooser out */
			if (vcnvOver()) { break; }
			var chooser = null;
			for (var k = 0; k < 4 && chooser === null; k++) { var s = order[(turn + k) % 4]; if (!vcnvIsEliminated(s)) { chooser = s; turn = (turn + k + 1) % 4; } }
			if (chooser === null) { break; }
			var row = await chooseRow(chooser);
			await guardGuess();
			if (vcnvOver()) { break; }
			if (vcnvIsEliminated(chooser) || row === null) { continue; }   /* out meanwhile: the next one chooses */
			vcnvSelectRow(row);
			L.changed();
			L.toast(L.name(chooser) + ' chọn hàng ngang số ' + row, '');
			rowsPlayed += 1;
			await playRow(row);
		}
		if (!vcnvOver() && vcnvCenterAvailable()) {
			await step();
			await guardGuess();
			if (!vcnvOver()) {
				vcnvSelectRow(VCNV_CENTER);
				L.changed();
				L.toast('Ô trung tâm', '');
				await playRow(VCNV_CENTER);
			}
		}
		if (!vcnvOver() && vcnvFinalWindowAvailable()) {
			await step();
			await guardGuess();
			L.key('ArrowRight');                    /* the last 15 s, for signals only */
			L.toast('15 giây cuối để xin trả lời chướng ngại vật', 'warn');
			await L.until(function () { return vcnvOver() || gv.IsVcnvFinalWindowExpired; });
			await guardGuess();
		}
		closePicture();
		clearInterval(robotWant);
		await guardGuess();
		if (gv.VcnvSequenceCounter != 11) { vcnvRevealEverything(); L.changed(); }
		await step();
		L.key('ArrowLeft');                         /* graphics off */
		await L.sleep(1500);
	}

	async function chooseRow(seat) {
		var closed = [1, 2, 3, 4].filter(function (n) { return vcnvRow(n).status === 'closed'; });
		if (!L.isMe(seat)) { await L.sleep(L.between(1500, 3000)); return L.pick(closed); }
		if (vcnvIsEliminated(seat)) { return null; }
		var picked = null;
		var stop = L.expect(closed.map(function (n) { return '.vcnvBoardDiv .vcnvStrip' + n; }).join(','), function (el) {
			var m = /vcnvStrip(\d)/.exec(el.className);
			if (m) { picked = parseInt(m[1], 10); }
		}, 'Lượt của bạn: nhấn vào một hàng ngang để chọn', 0.3);
		await L.until(function () { return picked !== null || vcnvIsEliminated(seat) || gv.VcnvSequenceCounter == 9; }, 12000);
		stop();
		if (vcnvIsEliminated(seat)) { return null; }
		return picked !== null ? picked : L.pick(closed);
	}

	async function playRow(row) {
		await step();
		await guardGuess(); if (vcnvOver()) { return; }
		L.key('ArrowRight');                        /* the question */
		await step();
		await guardGuess(); if (vcnvOver()) { return; }
		L.key('ArrowRight');                        /* 15 s */
		var answers = { 1: '', 2: '', 3: '', 4: '' }, right = [];
		var expected = vcnvQuestionFor(row).answer || '';
		function answer(seat) {
			if (vcnvIsEliminated(seat) || answers[seat]) { return; }
			var ok = L.chance(0.5);
			if (L.isMe(seat)) { L.record(ok); L.toast('Đã gửi đáp án', ''); }
			answers[seat] = ok ? expected : L.pick(WRONG);
			if (ok) { right.push(seat); }
		}
		var timers = L.bots.map(function (s) { return L.chance(0.9) ? L.after(L.between(2000, 13000), function () { answer(s); }) : null; });
		var stop = vcnvIsEliminated(L.me) ? function () {} : L.expect(BAR_VCNV, function () { answer(L.me); stop(); }, 'Nhấn vào thanh câu hỏi để trả lời hàng ngang (đúng 50%)', 0.05);
		await L.until(function () { return gv.IsVcnvTimerDone || vcnvOver(); });
		stop();
		timers.forEach(function (t) { if (t) { t.cancel(); } });
		await guardGuess(); if (vcnvOver()) { return; }
		vcnvSetAnswers(row, answers);
		var r = vcnvRow(row);
		r.correctSeats = right.filter(function (s) { return !vcnvIsEliminated(s); });
		await step();
		await guardGuess(); if (vcnvOver()) { return; }
		L.key('ArrowRight');                        /* answer tree */
		await step();
		await guardGuess(); if (vcnvOver()) { return; }
		L.key('ArrowRight');                        /* graded: vcnv_row_correct / vcnv_row_wrong */
		await L.sleep(7000);
		await guardGuess(); if (vcnvOver()) { return; }
		L.key('ArrowRight');                        /* tree off */
		await L.sleep(3000);                        /* the picture quarter: 10 s after the row's sound */
		await guardGuess(); if (vcnvOver()) { return; }
		L.key('ArrowRight');                        /* the picture quarter; back to the board */
	}

	/* ======================================================================== Tăng tốc */

	var TT_TAPS = [6, 6, 8, 8];
	var ttCount = {};
	/* the tree: "k/N đúng", most right first; no times */
	window.tangTocTreeEntries = function () {
		return gv.Players.map(function (p) {
			var c = ttCount[p.seat] || { right: 0, used: 0 };
			return { seat: p.seat, name: gv.displayName(p), answer: c.right + '/' + c.max + ' ĐÚNG', time: null, n: c.right };
		}).sort(function (a, b) { return (b.n - a.n) || (a.seat - b.seat); });
	};
	/* grading: ranked by the number right (ttRankPoints on "times" = minus the count) */
	window.tangTocGradeQuestion = function () {
		var times = {}, right = [];
		gv.Players.forEach(function (p) { var c = ttCount[p.seat]; if (c && c.right > 0) { times[p.seat] = -c.right; right.push(p.seat); } });
		var pts = gv.ttRankPoints(times, right);
		gv.TangTocCorrectSeats = right;
		gv.TangTocAwarded = pts;
		Object.keys(pts).forEach(function (seat) { addScore(parseInt(seat, 10), pts[seat]); });
		gradeAnswerTree(right);
		startLongActiveSound(right.length ? 'vcnv_row_correct.mp3' : 'vcnv_row_wrong.mp3');
		gv.TangTocSequenceCounter = 5;
		return pts;
	};

	async function tangToc() {
		await L.sleep(3500);                        /* the title card (switchRound showed it) */
		L.key('ArrowLeft');                         /* question 1 */
		for (var i = 0; i < 4; i++) {
			var max = TT_TAPS[i];
			ttCount = {};
			gv.Players.forEach(function (p) { ttCount[p.seat] = { right: 0, used: 0, max: max }; });
			await step();
			L.key('ArrowRight');                    /* the clock */
			var dur = (gv.TangTocSeconds || 20) * 1000;
			var timers = [];
			L.bots.forEach(function (s) {
				for (var k = 0; k < max; k++) { timers.push(L.after(L.between(500, dur - 500), function () { command(s); })); }
			});
			var counter = document.getElementById('luckCounter');
			function command(seat) {
				var c = ttCount[seat];
				if (!gv.IsTangTocTimerRunning || c.used >= c.max) { return false; }
				c.used += 1;
				var ok = L.chance(0.5);
				if (ok) { c.right += 1; }
				if (L.isMe(seat)) {
					L.record(ok);
					L.toast('Đã ghi nhận lệnh hỏi ' + c.used + '/' + c.max, '');   /* right or wrong: only on the answer tree */
					if (counter) { counter.textContent = 'Lệnh hỏi: ' + c.used + '/' + c.max; }
				}
				return true;
			}
			if (counter) { counter.textContent = 'Lệnh hỏi: 0/' + max; counter.classList.add('on'); }
			var stop = L.expect(BAR_TT, function () { command(L.me); if (ttCount[L.me].used >= max) { stop(); } }, 'Nhấn vào khung câu hỏi: mỗi lần nhấn là một lệnh hỏi (đúng 50%, kết quả có ở cây đáp án)', 0.25);
			await L.until(function () { return gv.IsTangTocTimerDone; });
			stop();
			timers.forEach(function (t) { t.cancel(); });
			if (counter) { counter.classList.remove('on'); }
			await step();
			L.key('ArrowRight');                    /* answers */
			await step();
			L.key('ArrowRight');                    /* graded */
			await step();
			L.key('ArrowRight');                    /* tree off */
			if (i < 3) { await L.sleep(1500); L.key('ArrowRight'); }   /* next question */
		}
		await L.sleep(1500);
		L.key('ArrowLeft');                         /* graphics off */
		await L.sleep(1500);
	}

	/* ======================================================================== Về đích */

	var vdLevel = {};   /* hidden robot level per question: seat-index -> 0.1 | 0.4 | 1 */
	function robotRight(seat, index) {
		var key = seat + '-' + index;
		if (!(key in vdLevel)) { vdLevel[key] = L.pick([0.1, 0.4, 1]); }
		return L.chance(vdLevel[key]);
	}
	function threshold() { return gv.VeDichValue >= 30 ? 91 : 71; }
	/* ms left on the running VĐ clock */
	function timeLeft() {
		var c = gv.CurrentClock;
		if (!c || c.paused) { return 0; }
		return Math.max(0, c.duration * 1000 - (performance.now() - c.t0));
	}

	async function veDich() {
		await L.sleep(3500);                        /* the title card (switchRound showed it) */
		for (var turn = 0; turn < 4; turn++) {
			L.key('ArrowLeft');                     /* the next contestant is called (order: the scores) */
			var seat = gv.VeDichSeat;
			L.toast(L.name(seat) + ' bước lên bục Về đích', '');
			await step();
			L.key('ArrowLeft');                     /* choose screen */
			await choosePackage(seat);
			/* a robot puts the star on each question with 25 % (until it has used it) */
			var starAt = 0;
			if (!L.isMe(seat)) { for (var k = 1; k <= 3 && !starAt; k++) { if (L.chance(0.25)) { starAt = k; } } }
			await step();
			L.key('ArrowLeft');                     /* question group, empty bar */
			await L.sleep(2200);
			await starWindow(seat, starAt, 1);
			L.key('ArrowRight');                    /* question 1 text */
			for (var q = 1; q <= 3; q++) {
				await step();
				L.key('ArrowRight');                /* the answer clock */
				await answerVd(seat, q);
				await stealVd(seat, q);
				if (q < 3) { await starWindow(seat, starAt, q + 1); }
				else { await step(); }
				L.key('ArrowRight');                /* next question (or the end of the turn) */
			}
			await step();
		}
		L.key('ArrowLeft');                         /* round over */
		await L.sleep(1200);
		L.key('ArrowLeft');                         /* graphics off */
		await L.sleep(1500);
	}

	/* three picks: the player with the 20 / 30 buttons, a robot at random */
	async function choosePackage(seat) {
		if (!L.isMe(seat)) {
			for (var i = 0; i < 3; i++) { await L.sleep(L.between(900, 2000)); veDichPick(L.pick([20, 30])); L.changed(); }
			return;
		}
		var box = document.getElementById('luckPick');
		L.hint('Chọn gói câu hỏi: 3 lần chọn 20 hoặc 30 điểm');
		box.classList.add('on');
		await new Promise(function (res) {
			function pick(v) {
				veDichPick(v); L.changed();
				box.querySelector('small').textContent = gv.VeDichValues.join(' - ');
				if (gv.VeDichValues.length >= 3) { box.onclick = null; res(); }
			}
			box.querySelector('small').textContent = '';
			box.onclick = function (e) { var b = e.target.closest('button[data-v]'); if (b) { pick(parseInt(b.getAttribute('data-v'), 10)); } };
			if (L.auto) { (function autoPick() { L.after(300, function () { if (gv.VeDichValues.length < 3) { pick(L.pick([20, 30])); autoPick(); } }); })(); }
		});
		box.classList.remove('on');
		L.hint('');
	}

	/* the moment the star may go on question `index`: a step pause, with the player's button */
	async function starWindow(seat, starAt, index) {
		var btn = document.getElementById('luckStar');
		if (L.isMe(seat) && !gv.IsVeDichStarUsed) {
			btn.classList.add('on');
			btn.onclick = function () {
				veDichPlaceStar(); L.changed();
				if (gv.IsVeDichStarUsed) { btn.classList.remove('on'); L.toast('Ngôi sao hy vọng đặt vào câu ' + index, 'warn'); }
			};
			if (L.auto && L.chance(0.25)) { L.after(200, function () { if (btn.onclick) { btn.onclick(); } }); }
		}
		else if (starAt === index) {
			L.after(L.between(600, 2000), function () { veDichPlaceStar(); L.changed(); L.toast(L.name(seat) + ' đặt ngôi sao hy vọng!', 'warn'); });
		}
		await step();
		btn.classList.remove('on');
		btn.onclick = null;
	}

	/* the contestant on stage answers during the clock. The player taps up to 2 / 3 times; each tap
	 * is only "recorded" - right or wrong shows once the clock has run out */
	async function answerVd(seat, index) {
		var ok = null;
		if (L.isMe(seat)) {
			var max = gv.VeDichValue >= 30 ? 3 : 2, used = 0, need = threshold(), rolls = [];
			var stop = L.expect(BAR_VD, function () {
				if (used >= max || !gv.IsVeDichTimerRunning) { return; }
				used += 1;
				rolls.push(L.roll100());
				L.toast('Đã ghi nhận câu trả lời (' + used + '/' + max + ')', '');
				if (used >= max) { stop(); }
			}, 'Nhấn vào thanh câu hỏi để trả lời (tối đa ' + max + ' lần) - kết quả có khi hết giờ', 0.08);
			await L.until(function () { return gv.IsVeDichTimerDone; });
			stop();
			ok = rolls.some(function (r) { return r >= need; });
			L.record(ok);
			L.stats.vd.push({ value: gv.VeDichValue, ok: ok, star: veDichStarred() });
			L.toast(rolls.length ? 'Kết quả quay: ' + rolls.join(', ') + ' (cần ' + need + '+)' : 'Bạn không trả lời', ok ? 'good' : 'bad');
		}
		else {
			var t = Math.min(L.between(3000, 10000), (gv.VeDichSeconds || 15) * 1000 - 800);
			await L.sleep(t);
			L.toast(L.name(seat) + ' đã trả lời', '');
			ok = robotRight(seat, index);
			await L.until(function () { return gv.IsVeDichTimerDone; });   /* the verdict once the clock has run out */
		}
		await L.sleep(600);
		L.key(ok ? 'ArrowUp' : 'ArrowDown');
		L.toast(L.name(seat) + ': ' + rightWord(ok) + (veDichStarred() ? ' (ngôi sao)' : ''), ok ? 'good' : 'bad');
	}

	/* wrong: 5 s for a steal - the player by tapping the bar, a robot with 30 %. The player who
	 * buzzed then taps once more to answer: one roll, it must reach the question's mark */
	async function stealVd(owner, index) {
		if (gv.VeDichSequenceCounter != 7) { return; }
		var thief = null, timers = [];
		function buzz(seat) {
			if (thief !== null || gv.VeDichSequenceCounter != 7 || gv.IsVeDichTimerDone) { return; }
			thief = seat;
			veDichStealBuzz(seat);
			L.changed();
			L.toast(L.name(seat) + ' bấm chuông cướp điểm!', 'warn');
		}
		bots(owner).forEach(function (s) { if (L.chance(0.3)) { timers.push(L.after(L.between(500, 4500), function () { buzz(s); })); } });
		var stop = L.isMe(owner) ? function () {} : L.expect(BAR_VD, function () { buzz(L.me); }, 'Nhấn vào thanh câu hỏi để bấm chuông cướp điểm (5 giây)', 0.04);
		await L.until(function () { return thief !== null || gv.IsVeDichTimerDone; });
		stop();
		timers.forEach(function (t) { t.cancel(); });
		if (thief === null) { L.toast('Không ai cướp điểm', ''); return; }
		/* the one who buzzed answers within the 5 s; the verdict once the 5 s have run out */
		var ok;
		if (L.isMe(thief)) {
			var need = threshold();
			var tapped = await tapOnce(BAR_VD, 'Nhấn vào thanh câu hỏi để trả lời câu cướp (1 lần, cần quay ' + need + '+)', Math.max(1500, timeLeft()));
			if (tapped) { L.toast('Đã ghi nhận câu trả lời', ''); }
			var r = tapped ? L.roll100() : 0;
			ok = L.record(tapped && r >= need);
			await L.until(function () { return gv.IsVeDichTimerDone; });
			L.toast(tapped ? 'Kết quả quay: ' + r + ' (cần ' + need + '+)' : 'Bạn không trả lời', ok ? 'good' : 'bad');
		}
		else {
			await L.sleep(Math.min(1200, Math.max(200, timeLeft() - 300)));
			L.toast(L.name(thief) + ' đã trả lời', '');
			ok = robotRight(thief, owner + '/' + index);
			await L.until(function () { return gv.IsVeDichTimerDone; });
		}
		await L.sleep(500);
		L.key(ok ? 'ArrowUp' : 'ArrowDown');
		L.toast(L.name(thief) + ' cướp ' + rightWord(ok).toLowerCase(), ok ? 'good' : 'bad');
	}

	/* ======================================================================== Câu hỏi phụ */

	async function tieBreak() {
		var tied = gv.topScoreSeats(gv.Players);
		if (tied.length < 2) { return; }
		L.toast('Đồng điểm! Câu hỏi phụ: ' + tied.map(L.name).join(', '), 'warn');
		switchRound('tb');
		gv.TieBreakSeats = tied.slice();
		L.key('ArrowLeft');                         /* who plays */
		await L.sleep(2200);
		L.key('ArrowLeft');                         /* the bar */
		await L.sleep(2600);
		var meIn = tied.indexOf(L.me) !== -1;
		for (var q = 0; q < 6 && gv.TieBreakWinner === null; q++) {
			if (q >= tieBreakQuestionLimit()) { gv.TieBreakQuestions = (gv.TieBreakQuestions || []).concat(gv.TieBreakQuestions || []); }
			L.key('ArrowRight');                    /* the question: buzzers open, but the music is the signal */
			var musicOn = false, timers = [];
			function buzz(seat) {
				if (gv.TieBreakWinner !== null || gv.TieBreakBuzzSeat !== null) { return; }
				if (!tieBreakIsPlaying(seat) || tieBreakIsOut(seat)) { return; }
				tieBreakBuzz(seat);
				L.changed();
				if (gv.TieBreakBuzzSeat !== seat) { return; }
				if (gv.IsTieBreakBuzzEarly) {
					L.toast(L.name(seat) + ' bấm sớm - bị loại khỏi câu này', 'bad');
					L.after(700, function () { L.key('ArrowDown'); });
				}
				else {
					L.key('ArrowUp');
					L.toast(L.name(seat) + ' bấm chuông đầu tiên và thắng!', 'good');
				}
			}
			var stop = meIn ? L.expect(BAR_KD, function () { buzz(L.me); }, 'Chỉ bấm khi nghe thấy nhạc! Bấm sớm là bị loại khỏi câu này', 0.03) : function () {};
			await L.sleep(L.between(2000, 8000));
			if (gv.TieBreakWinner === null && gv.TieBreakSequenceCounter == 3 && gv.TieBreakBuzzSeat === null && tieBreakSeatsLeft().length) {
				L.key('ArrowRight');                /* the 15 s music: now */
				musicOn = true;
				tied.filter(function (s) { return !L.isMe(s); }).forEach(function (s) { timers.push(L.after(L.between(250, 700), function () { buzz(s); })); });
			}
			await L.until(function () { return gv.TieBreakWinner !== null || gv.TieBreakSequenceCounter == 5 || (!musicOn && !tieBreakSeatsLeft().length); }, 20000);
			stop();
			timers.forEach(function (t) { t.cancel(); });
			await L.sleep(1800);
		}
		L.key('ArrowLeft');                         /* graphics off */
		await L.sleep(1500);
	}

	/* ======================================================================== the score summary */

	/* M: every contestant, best first - after Khởi động, VCNV, Tăng tốc and at the end. It opens
	 * only once the round's graphics are off the screen. */
	async function summary() {
		for (var tries = 0; tries < 10 && !isScoreSummaryShowing(); tries++) {
			if (tries) { await L.sleep(800); }
			stepScoreSummary(); L.changed();
		}
		if (!isScoreSummaryShowing()) { return; }
		while (isScoreSummaryShowing()) {
			await L.pause(3, 5);
			stepScoreSummary(); L.changed();   /* the next contestant; after the last one it closes */
		}
		/* the summary music plays on: the next round 5 s after it ends */
		await L.until(function () { var a = gv.AmbientSound; return !a || a.paused || a.ended; }, 40000);
		await L.sleep(5000);
	}

	/* ======================================================================== the match */

	L.play = async function () {
		/* ?from=vcnv|tt|vd (tests): start at that round, scores at 0 */
		var from = ['kd', 'vcnv', 'tt', 'vd'].indexOf(new URLSearchParams(location.search).get('from') || 'kd');
		if (from < 0) { from = 0; }
		if (from <= 0) { await khoiDong(); await summary(); L.key('ArrowLeft'); }   /* -> Vượt chướng ngại vật */
		else if (from === 1) { switchRound('vcnv'); }
		if (from <= 1) { await vcnv(); await summary(); L.key('ArrowLeft'); }       /* -> Tăng tốc */
		else if (from === 2) { switchRound('tt'); }
		if (from <= 2) { await tangToc(); await summary(); L.key('ArrowLeft'); }    /* -> Về đích */
		else { switchRound('vd'); }
		await veDich();
		await tieBreak();
		await summary();                            /* the final standing */
		return L.result();
	};

	/* the standing: score, then the tie-break winner */
	L.result = function () {
		var w = gv.TieBreakWinner;
		var list = gv.Players.map(function (p) { return { seat: p.seat, name: gv.displayName(p), score: p.score }; })
			.sort(function (x, y) { return (y.score - x.score) || ((x.seat === w) ? -1 : (y.seat === w) ? 1 : 0) || (x.seat - y.seat); });
		var place = 0;
		list.forEach(function (r, i) { if (i === 0 || r.score !== list[i - 1].score || (i === 1 && list[0].seat === w)) { place = i + 1; } r.place = place; });
		var me = list.filter(function (r) { return r.seat === L.me; })[0];
		return { list: list, me: me, stats: L.stats, seed: L.seed };
	};
})();
