/*
 * "Bạn có tạch đỉnh Olympia?" (/olympia-luck/) - the base: a match of Olympia 26 played alone
 * against three robots, where every answer is a roll. This file: settings, the seeded random
 * numbers, the seats, waiting (pauses the player can skip, taps on the stage) and the small
 * on-screen texts. LuckDirector.js runs the match, LuckScreens.js the menu and the result.
 *
 * It runs on the Olympia engine (default.html's scripts, rules o26, no room): the director only
 * calls the engine's own steps, as the host's keys would.
 *
 *   ?seed=N   the same match again (tests, replays)   ?auto=1   the player taps by itself (tests)
 */
(function () {
	var gv = window.GameVariables;
	var params = new URLSearchParams(location.search);
	var L = window.LUCK = {};

	/* this page has its own storage keys / channel: it never talks to a real Olympia tab */
	gv.SyncChannelName = 'olympia-luck';
	gv.SyncStateKey = 'olympia-luck.state';
	gv.SyncAuthorityKey = 'olympia-luck.authority';
	gv.NamesKey = 'olympia-luck.names';
	/* the satirical question set (same format as Demo/) */
	var Q = '/olympia-luck/questions/';
	gv.DataFiles = { players: Q + 'players.xml', khoidong: Q + 'khoidong.xml', vcnv: Q + 'vcnv.xml', tangtoc: Q + 'tangtoc.xml', vedich: Q + 'vedich.xml', tiebreak: Q + 'cauhoiphu.xml' };
	if (gv.applyRules) { gv.applyRules('o26'); }

	/* ---------- random numbers: mulberry32, seeded ---------- */
	var seed = parseInt(params.get('seed'), 10);
	if (!(seed >= 0)) { seed = Math.floor(Math.random() * 1e9); }
	L.seed = seed;
	var a = seed >>> 0;
	L.rand = function () {
		a = (a + 0x6D2B79F5) >>> 0;
		var t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	L.between = function (lo, hi) { return lo + (hi - lo) * L.rand(); };
	L.int = function (lo, hi) { return lo + Math.floor(L.rand() * (hi - lo + 1)); };
	L.chance = function (p) { return L.rand() < p; };
	L.pick = function (list) { return list[Math.floor(L.rand() * list.length)]; };
	L.roll100 = function () { return L.int(1, 100); };

	L.auto = params.get('auto') === '1';
	L.SILENCE = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

	/* ---------- seats ---------- */
	L.BOT_NAMES = ['Rô-bốt Hên', 'Rô-bốt Xui', 'Rô-bốt Lụi'];
	L.me = 1;
	L.bots = [2, 3, 4];
	L.isMe = function (seat) { return seat === L.me; };
	L.name = function (seat) { var p = gv.getPlayer(seat); return p ? gv.displayName(p) : 'Ghế ' + seat; };
	/* seat: 1-4 as the player chose, anything else = a random seat */
	L.setSeats = function (myName, seat) {
		L.me = seat >= 1 && seat <= 4 ? seat : L.int(1, 4);
		L.bots = [1, 2, 3, 4].filter(function (s) { return s !== L.me; });
		var names = L.BOT_NAMES.slice();
		gv.Players.forEach(function (p) {
			p.fullName = p.seat === L.me ? (myName || 'Bạn') : names.shift();
			p.school = p.seat === L.me ? 'Người thật' : 'Máy quay số';
		});
		if (typeof refreshContestantBars === 'function') { refreshContestantBars(); }
	};

	/* ---------- a different match every time: the questions in a new order ----------
	 * Khởi động: the 24 individual questions dealt anew (6 each), the common turn shuffled;
	 * VCNV: the 4 rows change places on the board (the centre stays); Về đích: the 20- and the
	 * 30-point questions dealt anew to the four packages. Seeded: ?seed= replays the same order. */
	L.shuffle = function (list) {
		for (var i = list.length - 1; i > 0; i--) { var j = Math.floor(L.rand() * (i + 1)), t = list[i]; list[i] = list[j]; list[j] = t; }
		return list;
	};
	function deal(pool, per) { var out = {}; [1, 2, 3, 4].forEach(function (s, i) { out[s] = pool.slice(i * per, i * per + per); }); return out; }
	L.shuffleQuestions = function () {
		var kd = gv.KhoiDongQuestions;
		if (kd && kd.individual) {
			var per = (kd.individual[1] || []).length || 6, all = [];
			[1, 2, 3, 4].forEach(function (s) { all = all.concat(kd.individual[s] || []); });
			kd.individual = deal(L.shuffle(all), per);
			kd.common = L.shuffle((kd.common || []).slice());
		}
		var v = gv.VcnvData;
		if (v && v.rows && v.rows.length) {
			v.rows = L.shuffle(v.rows.slice());
			if (typeof renderObstacleBoard === 'function') { renderObstacleBoard(); }   /* the strips follow their answers */
		}
		var vd = gv.VeDichQuestions;
		if (vd && vd[1]) {
			[20, 30].forEach(function (value) {
				var pool = [];
				[1, 2, 3, 4].forEach(function (s) { pool = pool.concat((vd[s] && vd[s][value]) || []); });
				var dealt = deal(L.shuffle(pool), pool.length / 4);
				[1, 2, 3, 4].forEach(function (s) { if (vd[s]) { vd[s][value] = dealt[s]; } });
			});
		}
	};

	/* the player's luck, for the result card */
	L.stats = { rolls: 0, hits: 0, vd: [] };
	L.record = function (hit) { L.stats.rolls += 1; if (hit) { L.stats.hits += 1; } return hit; };

	/* ---------- the match's own time: it stops while the game is paused (F6) ----------
	 * L.now() runs only while the game runs. Every wait of the host and the robots goes through
	 * L.after / L.sleep / L.until / L.pause, so a pause freezes them all where they are. */
	var pausedAt = null, pausedTotal = 0, jobs = [];
	L.now = function () { return (pausedAt !== null ? pausedAt : Date.now()) - pausedTotal; };
	L.isPaused = function () { return pausedAt !== null; };
	/* fn after ms of match time; returns { cancel } */
	L.after = function (ms, fn) {
		var job = { due: L.now() + ms, fn: fn, done: false };
		jobs.push(job);
		return { cancel: function () { job.done = true; } };
	};
	setInterval(function () {
		if (pausedAt !== null) { return; }
		var now = L.now();
		jobs.slice().forEach(function (j) {
			if (!j.done && now >= j.due) { j.done = true; try { j.fn(); } catch (e) { console.error('[Luck]', e); } }
		});
		jobs = jobs.filter(function (j) { return !j.done; });
	}, 40);
	L.sleep = function (ms) { return new Promise(function (res) { L.after(ms, res); }); };
	L.until = function (cond, timeoutMs) {
		var t0 = L.now();
		return new Promise(function (res) {
			(function check() {
				if (pausedAt === null) {
					if (cond()) { res(true); return; }
					if (timeoutMs && L.now() - t0 >= timeoutMs) { res(false); return; }
				}
				setTimeout(check, 50);
			})();
		});
	};

	/* a pause the player may cut short with "Tiếp ›" (lo..hi seconds of match time) */
	var skipFn = null;
	L.pause = function (lo, hi) {
		var ms = Math.round(L.between(lo, hi) * 1000);
		var bar = document.getElementById('luckNext'), fill = bar && bar.querySelector('i');
		return new Promise(function (res) {
			var done = false, t0 = L.now(), job, draw;
			function finish() {
				if (done) { return; }
				done = true; skipFn = null; job.cancel(); clearInterval(draw);
				if (bar) { bar.classList.remove('on'); }
				res();
			}
			skipFn = finish;
			if (bar) { bar.classList.add('on'); }
			draw = setInterval(function () { if (fill) { fill.style.transform = 'scaleX(' + Math.max(0, 1 - (L.now() - t0) / ms) + ')'; } }, 100);
			job = L.after(L.auto ? Math.min(ms, 300) : ms, finish);
		});
	};
	L.skip = function () { if (skipFn && pausedAt === null) { skipFn(); } };

	/* ---------- F6: the results board, the whole game frozen meanwhile ---------- */
	var heldClock = false, heldSounds = [];
	function playing() {
		var list = (typeof AUDIO_POOL !== 'undefined' ? AUDIO_POOL : []).concat(gv.AudioChannels.map(function (c) { return gv[c]; }));
		return list.filter(function (el, i) { return el && list.indexOf(el) === i && !el.paused && !el.ended; });
	}
	L.togglePause = function () {
		if (pausedAt === null) {
			pausedAt = Date.now();
			heldClock = !!(gv.CurrentClock && !gv.CurrentClock.paused);
			if (heldClock) { pauseClock(); }
			heldSounds = playing();
			heldSounds.forEach(function (el) { try { el.pause(); } catch (e) { /* ignore */ } });
			if (!isBoardScreenShowing()) { showBoardScreen(); }
			document.body.classList.add('luckPaused');
		}
		else {
			if (isBoardScreenShowing()) { hideBoardScreen(); }
			heldSounds.forEach(function (el) { try { var p = el.play(); if (p && p.catch) { p.catch(function () {}); } } catch (e) { /* ignore */ } });
			heldSounds = [];
			if (heldClock) { resumeClock(); }
			heldClock = false;
			pausedTotal += Date.now() - pausedAt;
			pausedAt = null;
			document.body.classList.remove('luckPaused');
		}
		L.changed();
	};

	/* ---------- taps on the stage ----------
	 * L.expect(selector, handler, hint) - while active, a tap inside `selector` calls handler(target)
	 * (the element glows). Returns a function that stops it. In ?auto=1 the "player" taps by
	 * itself now and then. */
	var active = [];
	L.expect = function (selector, handler, hint, autoRate) {
		var e = { sel: selector, fn: handler, hint: hint || '', rate: autoRate === undefined ? 0.12 : autoRate };
		active.push(e);
		glow();
		return function () { var i = active.indexOf(e); if (i !== -1) { active.splice(i, 1); } glow(); };
	};
	function glow() {
		document.querySelectorAll('.luckGlow').forEach(function (el) { el.classList.remove('luckGlow'); });
		active.forEach(function (e) { document.querySelectorAll(e.sel).forEach(function (el) { el.classList.add('luckGlow'); }); });
		L.hint(active.length ? active[active.length - 1].hint : '');
	}
	L.refreshGlow = glow;
	function onTap(ev) {
		if (pausedAt !== null) { return; }
		var hit = null;
		for (var i = active.length - 1; i >= 0 && !hit; i--) {
			var t = ev.target.closest && ev.target.closest(active[i].sel);
			if (t) { hit = { e: active[i], el: t }; }
		}
		if (!hit) { return; }
		ev.preventDefault();
		hit.e.fn(hit.el);
	}
	L.bindStage = function (stage) {
		stage.addEventListener('pointerdown', onTap);
		/* no context menu on the stage: "open / save image" would show the VCNV photo uncovered */
		stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });
	};
	if (L.auto) {
		setInterval(function () {
			if (pausedAt !== null) { return; }
			active.slice().forEach(function (e) {
				if (active.indexOf(e) === -1 || !L.chance(e.rate)) { return; }
				var els = document.querySelectorAll(e.sel);
				if (els.length) { e.fn(els[Math.floor(L.rand() * els.length)]); }
			});
		}, 250);
	}

	/* ---------- texts over the stage ---------- */
	L.hint = function (text) {
		var h = document.getElementById('luckHint');
		if (!h) { return; }
		h.textContent = text || '';
		h.classList.toggle('on', !!text);
	};
	L.toast = function (text, kind) {
		var box = document.getElementById('luckToasts');
		if (!box) { return; }
		var t = document.createElement('div');
		t.className = 'luckToast ' + (kind || '');
		t.textContent = text;
		box.appendChild(t);
		setTimeout(function () { t.classList.add('out'); }, 3200);
		setTimeout(function () { t.remove(); }, 3800);
	};

	/* the engine's own keys are not the player's: the keyboard does nothing on this page except F6
	 * (results board + pause) */
	window.addEventListener('keydown', function (e) {
		if (e.target && /^(input|textarea|button)$/i.test(e.target.tagName)) { return; }
		e.stopImmediatePropagation();
		if (e.key === 'F6') { e.preventDefault(); if (L.started && !e.repeat) { L.togglePause(); } }
	}, true);

	/* engine steps */
	L.key = function (k) { return gv.Keyboard.dispatch(k); };
	L.changed = function () { gv.changed(); };
})();
