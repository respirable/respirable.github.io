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
	L.setSeats = function (myName) {
		L.me = L.int(1, 4);
		L.bots = [1, 2, 3, 4].filter(function (s) { return s !== L.me; });
		var names = L.BOT_NAMES.slice();
		gv.Players.forEach(function (p) {
			p.fullName = p.seat === L.me ? (myName || 'Bạn') : names.shift();
			p.school = p.seat === L.me ? 'Người thật' : 'Máy quay số';
		});
		if (typeof refreshContestantBars === 'function') { refreshContestantBars(); }
	};

	/* the player's luck, for the result card */
	L.stats = { rolls: 0, hits: 0, vd: [] };
	L.record = function (hit) { L.stats.rolls += 1; if (hit) { L.stats.hits += 1; } return hit; };

	/* ---------- waiting ---------- */
	L.sleep = function (ms) { return new Promise(function (res) { setTimeout(res, ms); }); };
	L.until = function (cond, timeoutMs) {
		var t0 = Date.now();
		return new Promise(function (res) {
			(function check() {
				if (cond()) { res(true); return; }
				if (timeoutMs && Date.now() - t0 >= timeoutMs) { res(false); return; }
				setTimeout(check, 50);
			})();
		});
	};

	/* a pause the player may cut short with "Tiếp ›" (lo..hi seconds) */
	var skipFn = null;
	L.pause = function (lo, hi) {
		var ms = Math.round(L.between(lo, hi) * 1000);
		var bar = document.getElementById('luckNext');
		return new Promise(function (res) {
			var done = false, t0 = Date.now(), timer;
			function finish() {
				if (done) { return; }
				done = true; skipFn = null; clearTimeout(timer);
				if (bar) { bar.classList.remove('on'); }
				res();
			}
			skipFn = finish;
			if (bar) {
				bar.classList.add('on');
				var fill = bar.querySelector('i');
				if (fill) { fill.style.transition = 'none'; fill.style.transform = 'scaleX(1)'; void fill.offsetWidth; fill.style.transition = 'transform ' + ms + 'ms linear'; fill.style.transform = 'scaleX(0)'; }
			}
			timer = setTimeout(finish, ms);
			if (L.auto) { setTimeout(finish, Math.min(ms, 300)); }
			void t0;
		});
	};
	L.skip = function () { if (skipFn) { skipFn(); } };

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
		var hit = null;
		for (var i = active.length - 1; i >= 0 && !hit; i--) {
			var t = ev.target.closest && ev.target.closest(active[i].sel);
			if (t) { hit = { e: active[i], el: t }; }
		}
		if (!hit) { return; }
		ev.preventDefault();
		hit.e.fn(hit.el);
	}
	L.bindStage = function (stage) { stage.addEventListener('pointerdown', onTap); };
	if (L.auto) {
		setInterval(function () {
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
		setTimeout(function () { t.classList.add('out'); }, 2600);
		setTimeout(function () { t.remove(); }, 3200);
	};

	/* the engine's own keys are not the player's: the keyboard does nothing on this page */
	window.addEventListener('keydown', function (e) {
		if (e.target && /^(input|textarea|button)$/i.test(e.target.tagName)) { return; }
		e.stopImmediatePropagation();
	}, true);

	/* engine steps */
	L.key = function (k) { return gv.Keyboard.dispatch(k); };
	L.changed = function () { gv.changed(); };
})();
