/*
 * Olympia Controller - the audience screen: audience.html?room=CODE.
 *
 * Draws the STAGE's graphics with the stage's own modules (VcnvControl, VcnvTreeControl,
 * TangTocControl, VeDichControl, QuestionControl, ScoreboardControl, ScoreBoardScreenControl),
 * from the public state - no game logic, no keys. Sound plays here (stage and audience screens,
 * never the panel / players / podiums) once someone clicks the sound button: the engine relays its sound calls and this
 * page replays them with AudioControl.js (see "sound" below). The stage describes what it is
 * showing (buildSceneForPublic in PanelStateControl.js, read from its own DOM); this file turns
 * every change of that description into the same show / hide / set calls the rounds make, so the
 * entrances (zoom, glare, answer tree) play here as they do on the stage.
 *
 * Nothing secret ever reaches this page: the obstacle strips are built with blank letters
 * except the rows the stage has opened, the tree only arrives while it is on screen.
 *
 * window.OlympiaAudience (for AudiencePlay.js): onState(cb), snap(), serverNow(), timerElapsed()
 */
(function () {
	var gv = window.GameVariables;
	gv.changed = function () { /* graphics modules call it; nothing to publish from here */ };

	var $ = function (s) { return document.querySelector(s); };
	var params = new URLSearchParams(location.search);
	var code = (params.get('room') || '').trim().toUpperCase();
	var room = null, snap = null, prev = null, listeners = [], everHeard = false;
	var boardSig = '', treeSig = '', ttSig = '', playersSig = '';

	/* ---------- this device's clock vs the database clock (timers + video) ---------- */
	var serverOffset = null, bestRtt = Infinity;
	async function sampleClock() {
		var c = window.OlympiaAuth.client, t0 = Date.now();
		var r = await c.rpc('server_now_ms');
		var t1 = Date.now();
		if (!r.error && r.data && t1 - t0 <= bestRtt) { bestRtt = t1 - t0; serverOffset = Number(r.data) - (t0 + t1) / 2; }
	}
	async function syncClock(n) { bestRtt *= 1.5; for (var i = 0; i < n; i++) { await sampleClock(); } }
	function serverNow() { return serverOffset === null ? null : Date.now() + serverOffset; }
	function timerElapsed() {
		var t = snap && snap.timer;
		if (!t) { return null; }
		if (t.paused && typeof t.pausedElapsed === 'number') { return t.pausedElapsed; }
		var now = serverNow();
		if (t.serverStart && now !== null) { return (now - t.serverStart) / 1000; }
		return room ? (room.stageNow() - t.wallStart) / 1000 : null;
	}

	/* ---------- where the "Chung vui" strip goes ----------
	 * Inside the picture (the graphics move up by audience.css --a-shift) when
	 * the stage would be drawn at least MIN_IN_STAGE_SCALE of its size - below that its fields
	 * would be too small to use, so it goes under the picture instead. */
	var MIN_IN_STAGE_SCALE = 0.45;
	var playVisible = false;
	function placePlay() {
		var play = $('#aPlay'), stage = $('.stageContainerDiv');
		var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
		var inStage = s >= MIN_IN_STAGE_SCALE;
		var home = inStage ? stage : document.body;
		if (play.parentNode !== home) {
			var focused = document.activeElement && play.contains(document.activeElement) ? document.activeElement : null;
			home.appendChild(play);
			if (focused) { focused.focus(); }
		}
		play.classList.toggle('hidden', !playVisible);
		stage.classList.toggle('aPlayOn', playVisible && inStage);
	}

	/* ---------- fit the 1920x1080 stage into the window ---------- */
	function fit() {
		placePlay();
		var vp = $('#aViewport');
		var s = Math.min(vp.clientWidth / 1920, vp.clientHeight / 1080);
		if (!(s > 0)) { return; }
		var box = $('#aStageFit');
		box.style.width = Math.floor(1920 * s) + 'px';
		box.style.height = Math.floor(1080 * s) + 'px';
		box.style.setProperty('--stage-scale', String(s));
	}

	function status(text) { $('#aStatus').textContent = text || ''; }

	/* ---------- players ---------- */

	function applyPlayers(s) {
		var scene = s.scene || {};
		gv.IsScoreboardShowing = !!(scene.bars && scene.bars.stripOn);
		gv.MirrorBarLook = (scene.bars && scene.bars.look) || null;   /* the stage's bar looks, exactly */
		gv.Players = (s.players || []).map(function (p) {
			var o = gv.createPlayer(p.seat, p.fullName || p.displayName, p.school || '');
			o.score = p.score || 0;
			o.isBuzzed = !!p.isBuzzed;
			o.isOnStage = !!p.isOnStage;
			/* grey bar: exactly the stage's (VCNV elimination, or out of the Câu hỏi phụ) */
			o.isEliminatedFromVCNV = (scene.bars && scene.bars.grey) ? scene.bars.grey.indexOf(p.seat) !== -1 : !!p.isEliminatedFromVCNV;
			return o;
		});
		var sig = gv.Players.map(function (p) { return p.seat + ':' + p.fullName; }).join('|');
		if (sig !== playersSig) {
			playersSig = sig;
			var shown = Array.prototype.map.call(document.querySelectorAll('.scoreboardDiv .contestantBar.shown'), function (b) { return b.id; });
			renderContestantBars();
			shown.forEach(function (id) { var b = document.getElementById(id); if (b) { b.classList.add('shown'); } });
			var board = $('.boardScreenDiv'); if (board) { board.textContent = ''; }
			renderBoardScreen();
		}
		$('.scoreboardDiv').classList.toggle('hidden', !gv.IsScoreboardShowing);
		$('.scoreboardDiv').classList.remove('offstage');
		refreshContestantBars();
		gv.Players.forEach(function (p) { setContestantBarScore(p.seat, p.score); });
	}

	function applyBars(scene, was) {
		var shown = (scene.bars && scene.bars.shown) || [];
		var before = (was && was.bars && was.bars.shown) || [];
		if (shown.length && !before.length && shown.length === gv.Players.length) { revealContestantBars(); return; }   /* the one-by-one entrance */
		if (!shown.length) { hideContestantBars(); return; }
		gv.Players.forEach(function (p) {
			var bar = getContestantBar(p.seat);
			if (bar) { bar.classList.toggle('shown', shown.indexOf(p.seat) !== -1); }
		});
	}

	/* ---------- Khởi động question bar ---------- */

	function applyQuestionBar(qb, was) {
		setQuestionBarVariant(qb.variant);
		setQuestionText(qb.text);
		var clock = $('.questionBarDiv .questionClockP');
		clock.textContent = qb.clock || '';
		clock.classList.toggle('visible', !!qb.clock);
		if (qb.timer) { if (!isQuestionTimerShowing()) { startQuestionTimer(); } }   /* Câu hỏi phụ: frame() moves it */
		else if (isQuestionTimerShowing()) { hideQuestionTimer(); }
		var wasOn = !!(was && was.questionBar && was.questionBar.on);
		if (qb.on && !wasOn) { showQuestionBar(); }
		else if (!qb.on && wasOn) { hideQuestionBar(); }
	}

	/* ---------- Vượt chướng ngại vật ---------- */

	/* a row's letters only once the stage has opened it; otherwise placeholders of the same count
	 * (a cell's letter is drawn only when the cell is .revealed, so they are never seen) */
	function stripText(r) { return r.letters ? r.letters.join('') : new Array((r.length || 0) + 1).join('·'); }

	function applyVcnv(scene, rsv) {
		var v = scene.vcnv || {};
		var rows = (rsv.rows || []).slice(0, 4);
		var picture = (rsv.imageKey && assets[rsv.imageKey]) || '';   /* the covered picture (VcnvPublicImage.js) */
		var sig = [picture ? rsv.imageKey : ''].concat(rows.map(stripText)).join('|');
		if (sig !== boardSig) {
			boardSig = sig;
			gv.VcnvData = { keyword: '', image: picture, rows: rows.map(function (r) { return { text: '', answer: stripText(r) }; }), center: { text: '', answer: '' } };
			gv.IsObstacleBoardBuilt = false;
			renderObstacleBoard();
		}
		setObstacleTitle(v.title || rsv.title || '');
		(v.cells || []).forEach(function (cls, i) { setObstacleCells(i + 1, cls || null); });
		resetObstacleCovers();
		(rsv.coversOpen || []).forEach(function (c) { openObstacleCover(c === 'middle' ? 'middle' : Number(c)); });
		setObstacleQuestion(v.question || '');
		setObstacleSignals(rsv.queue || []);
		if (v.timer) { var t = $('.vcnvDiv .vcnvTimerDiv'); if (t && !t.classList.contains('visible')) { startObstacleTimer(); } }
		else { hideObstacleTimer(); }
		if (v.on) { showObstacleBoard(); } else { hideObstacleBoard(); }
	}

	/* ---------- the answer tree (VCNV rows and Tăng tốc) ---------- */

	function applyTree(tree) {
		if (!tree) {
			if (isAnswerTreeShowing()) { hideAnswerTree(); }
			treeSig = '';
			return;
		}
		var sig = tree.layout + '|' + tree.entries.map(function (e) { return e.seat + '=' + e.answer + '@' + e.time; }).join(',');
		if (!isAnswerTreeShowing() || sig !== treeSig) {
			var first = !isAnswerTreeShowing();
			showAnswerTree(tree.entries, null, { layout: tree.layout || undefined, showTime: !!tree.showTime });
			if (!first) { completeAnswerTreeNow(); }   /* an answer changed under an open tree: no second entrance */
			treeSig = sig;
		}
		if ((tree.wrong || []).length) {
			gradeAnswerTree(tree.entries.map(function (e) { return e.seat; }).filter(function (s) { return tree.wrong.indexOf(s) === -1; }));
		}
	}

	/* ---------- Tăng tốc ---------- */

	function applyTangToc(t, was) {
		var sig = (t.text || '') + '|' + t.media.type + '|' + t.media.src;
		if (sig !== ttSig && !t.still) {
			ttSig = sig;
			setTangTocQuestion({ text: t.text, media: t.media });
		}
		var wasOn = !!(was && was.tt && was.tt.on), wasStill = !!(was && was.tt && was.tt.still);
		if (t.on && t.still && (!wasOn || !wasStill)) { showTangTocQuestionStill(t.media); }
		else if (t.on && !t.still && (!wasOn || wasStill)) { showTangTocFrame(); }
		else if (!t.on && wasOn) { hideTangTocFrame(); }
		if (t.timer) { var tm = $('.ttDiv .ttTimerDiv'); if (tm && !tm.classList.contains('visible')) { startTangTocTimer(); } }
		else { hideTangTocTimer(); }
	}

	/* the clip follows the stage clock (muted: the hall has the stage's sound) */
	function syncVideo() {
		var video = $('.ttDiv .ttMediaVideo');
		var scene = snap && snap.scene;
		if (!video || !scene || !scene.tt.on || !video.classList.contains('on')) { if (video && !video.paused) { video.pause(); } return; }
		var t = snap.timer, idx = snap.roundState && snap.roundState.tt && snap.roundState.tt.index;
		if (scene.tt.still || !t || t.label !== 'tt_q' + idx) { if (!video.paused) { video.pause(); } return; }
		var target = timerElapsed();
		if (target === null || target < 0) { return; }
		if (isFinite(video.duration) && target >= video.duration) { if (!video.paused) { video.pause(); } return; }
		if (Math.abs(video.currentTime - target) > 0.4) { try { video.currentTime = target; } catch (e) { /* not seekable yet */ } }
		if (video.paused) { var p = video.play(); if (p && p.catch) { p.catch(function () {}); } }
	}

	/* ---------- Về đích ---------- */

	function applyVeDich(d, was) {
		var w = (was && was.vd) || {};
		var value = parseInt(String(d.header || '').replace(/\D+/g, ''), 10) || '';
		if (!d.on) { if (w.on) { hideVeDich(); } return; }
		$('.vdDiv').classList.remove('offstage');
		if (d.choose && !w.choose) { showChooseScreen(d.values); }
		else if (d.choose) { setChooseScreen(d.values); }
		else if (!d.choose && w.choose) { hideChooseScreen(); }
		if (d.group && !w.group) { showVeDichQuestionGroup({ seat: d.onStage, value: value }); }
		else if (!d.group && w.group) { hideVeDichQuestionGroup(); }
		if (d.group) {
			setVeDichTabs(d.onStage);
			setVeDichQuestion(d.text, value);   /* also hides the timer strip - set it again below */
			veDichElement('.vdScoreP').textContent = d.score || '';
			setVeDichStealSeat(d.steal);
			setVeDichStar(!!d.star);
			if (d.timer) { startVeDichTimer(d.reverse); }
		}
	}

	/* ---------- the rest ---------- */

	function applyBoard(on, was) {
		refreshBoardScreen();
		if (on && !was) { showBoardScreen(); }
		else if (!on && was) { hideBoardScreen(); }
	}

	/* a stage screen is what the hall (and the vision mixer) sees: green screen and ',' as on the engine */
	function applyStage(st) {
		var stage = $('.stageContainerDiv'), bg = $('.stageBackgroundDiv');
		if (!stage || !st) { return; }
		stage.style.backgroundColor = st.green || '';
		stage.classList.toggle('greenScreen', !!st.green);
		if (bg) { bg.classList.toggle('visible', !!st.background); }
		stage.classList.toggle('roundGraphicsHidden', st.hidden !== null && st.hidden !== undefined);
		if (st.hidden !== null && st.hidden !== undefined) { stage.setAttribute('data-hidden-round', st.hidden); } else { stage.removeAttribute('data-hidden-round'); }
	}

	function applySummary(sm) {
		var root = $('.summaryDiv');
		$('.summaryDiv .summaryNameP').textContent = sm.name || '';
		$('.summaryDiv .summaryScoreP').textContent = sm.score || '';
		root.classList.toggle('offstage', !sm.on);
	}

	function apply(s) {
		var scene = s.scene;
		if (!scene) { return; }
		var was = prev;
		var rs = s.roundState || {};
		applyPlayers(s);
		if (scene.titleCard) { showTitleCard(scene.titleCard); } else { hideTitleCard(); }
		applyQuestionBar(scene.questionBar, was);
		applyBars(scene, was);
		applyVcnv(scene, rs.vcnv || {});
		applyTree(scene.tree);
		applyTangToc(scene.tt, was);
		applyVeDich(scene.vd, was);
		applyBoard(!!scene.board, !!(was && was.board));
		applySummary(scene.summary || {});
		if (stageView) { applyStage(scene.stage); }
		prev = scene;
	}

	/* every frame: the timer strips + the clip, on the stage clock */
	function frame() {
		requestAnimationFrame(frame);
		var scene = snap && snap.scene, t = snap && snap.timer;
		if (!scene || !t || !t.duration) { return; }
		var e = timerElapsed();
		var f = (t.running || t.paused) ? (e === null ? 0 : e / t.duration) : (t.finished ? 1 : null);
		if (f === null) { return; }
		f = Math.max(0, Math.min(1, f));
		if (scene.vcnv.timer) { setObstacleTimer(f); }
		if (scene.tt.timer) { setTangTocTimer(f); }
		if (scene.vd.timer) { setVeDichTimer(f); }
		if (scene.questionBar && scene.questionBar.timer) { setQuestionTimer(f); }
	}

	var assets = {};   /* key -> data URL of the VCNV picture as the public may see it */
	function onAsset(a) {
		if (!a || !a.key || !a.data) { return; }
		assets = {}; assets[a.key] = a.data;   /* only the latest one is needed */
		if (snap) { try { apply(snap); } catch (e) { console.error(e); } }
	}

	/* ---------- sound (stage and audience screens) ----------
	 * Sound is on by default. A browser that blocks sound until the page is touched gets it on the
	 * first click / tap / key anywhere; the button only shows while it is still blocked. The panel
	 * sees which screens have sound on. */
	var stageView = params.get('view') === 'stage';
	var soundOn = false;
	var SOUND_OPS = ['startSound', 'stopSound', 'fadeOutSound', 'seekShortPassiveSound', 'stopAllSounds',
		'startLongPassiveSound', 'releaseLongPassiveSound', 'stopLongPassiveSound', 'fadeOutLongPassiveSound'];
	function fileOf(a) { try { return decodeURIComponent(new URL(a.src).pathname.split('/').pop()); } catch (e) { return ''; } }
	function wantsSound() { return !!snap && (snap.soundAt === 'stage' || snap.soundAt === 'both'); }
	function refreshSoundButton() {
		var b = $('#aSound');
		if (b) { b.classList.toggle('hidden', !(wantsSound() && !soundOn)); }
	}
	function soundReady() {
		if (soundOn) { return; }
		soundOn = true;
		refreshSoundButton();
		if (room && room.track) { room.track({ sound: true }); }
		if (room) { room.hello(); }   /* the engine answers with what is playing now */
	}
	/* a silent play: it unlocks audio for the page, and fails while the browser still blocks it */
	function enableSound() {
		if (soundOn) { return; }
		try {
			var p = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=').play();
			if (p && p.then) { p.then(soundReady, function () { refreshSoundButton(); }); } else { soundReady(); }
		} catch (e) { refreshSoundButton(); }
	}
	function onSound(m) {
		if (!soundOn || SOUND_OPS.indexOf(m.op) === -1 || typeof window[m.op] !== 'function') { return; }
		var args = Array.isArray(m.args) ? m.args : [];
		/* "what is playing now" (seek set): skip it when this channel already plays that file */
		if (typeof m.seek === 'number' && m.ch) {
			var cur = gv[m.ch], file = m.op === 'startLongPassiveSound' ? args[0] : args[1];
			if (cur && !cur.paused && !cur.ended && fileOf(cur) === file) { return; }
		}
		try { window[m.op].apply(null, args); } catch (e) { console.warn('[Audience] sound failed', m.op, e); return; }
		if (typeof m.seek === 'number' && m.seek > 0 && m.ch && gv[m.ch]) {
			var a = gv[m.ch], sec = m.seek;
			var go = function () { try { a.currentTime = sec; } catch (e) { /* not seekable */ } };
			if (a.readyState >= 1) { go(); } else { a.addEventListener('loadedmetadata', go, { once: true }); }
		}
	}
	/* the engine gone (panel closed): no bed looping on forever */
	setInterval(function () {
		if (soundOn && room && !room.isStageAlive() && typeof stopAllSounds === 'function') { stopAllSounds(); }
		if (soundOn && snap && snap.soundAt === 'here' && typeof stopAllSounds === 'function') { stopAllSounds(); }
	}, 2000);

	function onState(s, info) {
		snap = s;
		refreshSoundButton();
		if (!info || !info.saved) { everHeard = true; }
		try { apply(s); } catch (e) { console.error('[Audience] could not draw the state', e); }
		listeners.forEach(function (cb) { try { cb(s, info || {}); } catch (e) { console.error(e); } });
	}

	window.OlympiaAudience = {
		code: code,
		onState: function (cb) { listeners.push(cb); if (snap) { cb(snap, {}); } },
		snap: function () { return snap; },
		serverNow: serverNow,
		timerElapsed: timerElapsed,
		isStageAlive: function () { return !!(room && room.isStageAlive()); },
		fit: fit,
		/* AudiencePlay.js: show / hide the strip (placement and the graphics' move are done here) */
		setPlayVisible: function (on) { if (playVisible !== !!on) { playVisible = !!on; fit(); } }
	};

	function start() {
		fit();
		window.addEventListener('resize', fit);
		if (window.ResizeObserver) { new ResizeObserver(fit).observe($('#aViewport')); }
		if (!/^[A-Z0-9]{4,12}$/.test(code)) { status('Link chưa đúng: cần dạng audience.html?room=MÃPHÒNG'); return; }
		if (stageView) { document.body.classList.add('stageView'); document.title = 'Olympia — Sân khấu (chỉ chiếu)'; }
		$('#aSound').addEventListener('click', enableSound);
		['pointerdown', 'touchend', 'keydown'].forEach(function (t) { document.addEventListener(t, enableSound, true); });
		renderQuestionBar();
		renderTangTocFrame();
		renderVeDich();
		room = window.OlympiaPublicRoom.connect(code, {
			presence: { role: params.get('view') === 'stage' ? 'screen' : 'audience' },
			onAsset: onAsset,
			onSound: onSound,
			onState: onState,
			onStatus: function (st, detail) {
				if (st === 'error') { status(detail); }
				else if (st === 'offline') { status(everHeard ? 'Mất kết nối - đang thử lại...' : 'Không kết nối được phòng ' + code + '.'); }
				else { status(''); }
			}
		});
		enableSound();   /* on by default - works at once where the browser allows it */
		window.OlympiaAuth.ensureAnonymous().then(function () { return syncClock(5); }).catch(function () {});
		setInterval(function () { syncClock(3); }, 60000);
		setInterval(syncVideo, 200);
		requestAnimationFrame(frame);
	}

	start();
})();
