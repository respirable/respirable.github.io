
(function (gv) {

	/* Two transports, same messages ({type:'key'|'cmd'|'hello'|'state', ...}):
	 *   ?room=CODE in the URL -> Supabase Realtime private channels (pages on different machines)
	 *   no room               -> BroadcastChannel + localStorage (both pages in one browser, as before)
	 *
	 * Room topics (who may join / send is enforced by the database, supabase/migrations/0001):
	 *   ctl:CODE  panel -> stage   key, cmd          ops:CODE  stage -> panel   full state (answers)
	 *   hi:CODE   anyone -> stage  hello             pub:CODE  stage -> anyone  public state (no answers)
	 * The stage page must first "claim" the room (claim_stage); only the claimant may send state. */

	var channel = null;          /* BroadcastChannel (local mode) */
	var listeners = {};
	var publishQueued = false;
	var heartbeatTimer = null;
	var instanceId = Math.random().toString(36).slice(2);

	var STAGE_HEARTBEAT_MS = 10000;   /* claim_stage refresh; the database frees a claim after 30 s */
	var STATE_HEARTBEAT_MS = 3000;    /* the stage republishes this often, so panels know it is alive */
	var STAGE_TIMEOUT_MS = 7000;      /* a panel calls the stage gone after this much silence */

	var room = null;             /* { code, client, mode, channels: {kind: ch}, ready: {kind: bool}, queue: {kind: []} } */
	var lastOpsAt = 0;
	var lastAssetKey = '';       /* the VCNV public picture last sent on pub:CODE */
	var embeddedEngine = new URLSearchParams(location.search).get('embedded') === '1';   /* the engine a control panel runs (EmbeddedStage.js) */

	/* ---------- panels: follow ONE engine ----------
	 * Two engines can be heard at once: a stage page opened while the control panel runs the game
	 * itself, two stage tabs in local mode, or (before migration 0005) two of one account's tabs
	 * in a room. Drawing both made the panel flick between their states. A panel follows one
	 * engine and ignores the rest: an engine whose game has started beats a fresh one (fresh =
	 * nothing played, recovery still possible), then a stage page beats the panel's own engine,
	 * then the one already followed stays. */
	var engines = {};            /* source id -> { at, fresh, embedded } */
	var followed = null;
	function engineAlive(id) { var e = engines[id]; return !!(e && Date.now() - e.at < STAGE_TIMEOUT_MS); }
	function engineRank(e) { return (e.fresh ? 0 : 2) + (e.embedded ? 0 : 1); }
	function takeState(snap) {
		var id = (snap && snap.source) || 'unknown';
		engines[id] = { at: Date.now(), fresh: !!snap.recoveryAllowed, embedded: !!snap.embedded };
		if (id !== followed && followed && engineAlive(followed) && engineRank(engines[followed]) >= engineRank(engines[id])) { return false; }
		if (id !== followed) { console.log('[Sync] following engine ' + id + (snap.embedded ? ' (run by a control panel)' : ' (stage page)')); }
		followed = id;
		return true;
	}

	function emit(type, payload) {
		var list = listeners[type] || [];
		for (var i = 0; i < list.length; i++) {
			try { list[i](payload); } catch (e) { console.error('[Sync] listener error', e); }
		}
	}

	function readJson(key) {
		try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
		catch (e) { return null; }
	}

	function writeJson(key, value) {
		try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.warn('[Sync] localStorage write failed', e); }
	}

	function roomFromUrl() {
		var raw = new URLSearchParams(location.search).get('room');
		if (!raw) { return null; }
		var code = raw.trim().toUpperCase();
		if (!/^[A-Z0-9]{4,12}$/.test(code)) { console.warn('[Sync] ignoring invalid room code', raw); return null; }
		return code;
	}

	function playersForSnapshot() {
		return gv.Players.map(function (p) {
			return {
				seat: p.seat, fullName: p.fullName, displayName: gv.displayName(p), school: p.school,
				score: p.score, isBuzzed: p.isBuzzed, isOnStage: p.isOnStage,
				isEliminatedFromVCNV: p.isEliminatedFromVCNV, kdDone: p.kdDone
			};
		});
	}

	/* Everything the control panel needs to draw itself. Kept plain so JSON survives it. */
	function buildSnapshot() {
		return {
			at: Date.now(),
			players: playersForSnapshot(),
			currentRound: gv.CurrentRound,
			activeSeat: gv.ActiveSeat,
			buzzOrder: gv.BuzzOrder.slice(),
			roundState: (typeof buildRoundStateForPanel === 'function') ? buildRoundStateForPanel() : {},   /* PanelStateControl.js */
			isBackgroundShowing: gv.IsBackgroundShowing,
			isScoreboardShowing: gv.IsScoreboardShowing,
			summary: gv.SummaryState || null,
			boardScreen: !!gv.BoardScreenShowing,
			greenScreen: !!gv.IsGreenScreenOn,
			greenScreenColor: gv.GreenScreenColor || '',
			roundGraphicsHidden: !!gv.IsRoundGraphicsHidden,
			timer: gv.TimerState || null,   /* set by TimerControl */
			bed: gv.BedState || null,       /* set by AudioControl */
			recoveryAllowed: (typeof recoveryAllowed === 'function') ? recoveryAllowed() : false,   /* Recovery.js */
			progressRestored: !!gv.IsProgressRestored,
			savedGame: gv.savedGameInfo ? gv.savedGameInfo() : null,   /* GameSave.js: { at, text } */
			matchLog: gv.matchLogForPanel ? gv.matchLogForPanel() : null,   /* MatchLog.js: undo + the last log lines */
			questionSet: gv.QuestionSetName || '',                      /* QuestionSet.js: '' = this machine's set */
			soundAt: gv.SoundAt || 'here',                              /* AudioControl.js: here | stage | both */
			source: instanceId,          /* which engine sent it (a panel follows only one) */
			embedded: embeddedEngine
		};
	}

	/* What players, the audience and the podiums may see: never an answer or the obstacle. */
	function buildPublicSnapshot() {
		return {
			at: Date.now(),
			players: playersForSnapshot(),
			currentRound: gv.CurrentRound,
			activeSeat: gv.ActiveSeat,
			roundState: (typeof buildRoundStateForPublic === 'function') ? buildRoundStateForPublic() : {},   /* PanelStateControl.js */
			scene: (typeof buildSceneForPublic === 'function') ? buildSceneForPublic() : null,              /* the audience screen */
			isScoreboardShowing: gv.IsScoreboardShowing,
			answerReceipts: gv.AnswerReceipts || {},   /* PlayerActions.js: { seat: { nonce, ok } } */
			soundAt: gv.SoundAt || 'here',             /* stage screens show their "sound on" button when not 'here' */
			matchId: matchId(),                        /* AudiencePlay.js: a new match forgets the last one's answers */
			timer: publicTimer()
		};
	}

	/* The last public state is also kept in the database (save_public_state), so podiums and the
	 * audience show names and scores with no stage open. At most one write per SAVE_EVERY_MS;
	 * the latest state is always the one that ends up saved. Ignored by the 3 s heartbeat when
	 * nothing changed. */
	var SAVE_EVERY_MS = 2000;
	var saveTimer = null, savePending = null, lastSaved = '', lastSaveAt = 0, saveMissing = false;
	function savePublicState(pub) {
		if (!room || !room.ready.pub || saveMissing) { return; }
		savePending = pub;
		if (saveTimer) { return; }
		saveTimer = setTimeout(function () {
			saveTimer = null;
			var s = savePending; savePending = null;
			var key = JSON.stringify(Object.assign({}, s, { at: 0, timer: s.timer && Object.assign({}, s.timer) }));
			if (key === lastSaved) { return; }
			lastSaved = key; lastSaveAt = Date.now();
			room.client.rpc('save_public_state', { p_code: room.code, p_state: s }).then(function (r) {
				if (!r.error) { return; }
				/* the function is not in the database: retrying every 2 s only floods the console */
				if (r.error.code === 'PGRST202') { saveMissing = true; console.warn('[Sync] save_public_state is missing - run supabase/migrations/0004_saved_public_state.sql in the SQL Editor (saving the public state is off until the page reloads)'); return; }
				console.warn('[Sync] save_public_state failed', r.error.message); lastSaved = '';
			});
		}, Math.max(0, SAVE_EVERY_MS - (Date.now() - lastSaveAt)));
	}

	/* Which match this is: null while nothing has been played (a fresh engine may still be turned
	 * back into the saved match), then one id for the whole match - a resumed save keeps its own
	 * (GameSave.js stores gv.MatchId). */
	function matchId() {
		if (typeof recoveryAllowed === 'function' && recoveryAllowed()) { return null; }
		if (!gv.MatchId) { gv.MatchId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
		return gv.MatchId;
	}

	/* players time their own answers against the database clock: give them the start in it */
	function publicTimer() {
		var t = gv.TimerState;
		if (!t) { return null; }
		var pa = window.OlympiaPlayerActions;
		return Object.assign({}, t, { serverStart: (pa && t.wallStart) ? pa.toServerMs(t.wallStart) : null });
	}

	function handleMessage(msg) {
		if (!msg || !msg.type) { return; }

		if (gv.SyncMode === 'authority') {
			if (msg.type === 'key') {
				if (gv.Keyboard && gv.Keyboard.dispatch) { gv.Keyboard.dispatch(msg.key, msg.code, { remote: true }); }
			}
			else if (msg.type === 'cmd') {
				var fn = gv.Commands && gv.Commands[msg.name];
				if (typeof fn === 'function') {
					try { fn(msg.args || {}); } catch (e) { console.error('[Sync] command failed', msg.name, e); }
					gv.changed();   /* not Sync.publish(): GeneralControl.js wraps changed() to refresh the stage background first */
				}
				else { console.warn('[Sync] unknown command', msg.name); }
			}
			else if (msg.type === 'hello') {
				lastAssetKey = '';   /* a screen just came: send it the picture again */
				gv.Sync.publish();
				if (gv.sendCurrentSounds) { gv.sendCurrentSounds(); }   /* ...and what is playing, if it plays the sound (AudioControl.js) */
			}
		}
		else {
			if (msg.type === 'state') {
				if (!msg.snapshot || !takeState(msg.snapshot)) { return; }   /* another engine than the one followed */
				/* the stage's wall clock may differ from ours: timers are drawn from its timestamps */
				if (msg.snapshot && msg.snapshot.at) { gv.Sync.clockOffset = Date.now() - msg.snapshot.at; }
				gv.Sync.lastSnapshot = msg.snapshot;
				emit('state', msg.snapshot);
			}
		}
	}

	function startHeartbeat() {
		function beat() { writeJson(gv.SyncAuthorityKey, { id: instanceId, ts: Date.now() }); }
		beat();
		heartbeatTimer = setInterval(beat, 1000);
	}

	/* ---------- room mode (Supabase Realtime) ---------- */

	/* status: connecting | online | offline | denied (not your room / no such room) | taken (another stage) | error */
	function setStatus(status, detail) {
		gv.Sync.status = status;
		gv.Sync.statusDetail = detail || '';
		emit('status', status);
	}

	function sendOn(kind, msg) {
		if (!room || !room.channels[kind]) { return; }
		if (!room.ready[kind]) { room.queue[kind].push(msg); return; }
		room.channels[kind].send({ type: 'broadcast', event: 'msg', payload: msg });
	}

	function everyChannelReady() {
		return Object.keys(room.channels).every(function (k) { return room.ready[k]; });
	}

	/* kinds: { kind: listenForMessages } - every channel is private (checked by the database) */
	function openChannels(kinds, onAllReady) {
		Object.keys(kinds).forEach(function (kind) {
			var ch = room.client.channel(kind + ':' + room.code, { config: { private: true, broadcast: { self: false } } });
			if (kinds[kind]) { ch.on('broadcast', { event: 'msg' }, function (ev) { handleMessage(ev.payload); }); }
			room.channels[kind] = ch;
			room.ready[kind] = false;
			room.queue[kind] = [];
			ch.subscribe(function (status, err) {
				if (status === 'SUBSCRIBED') {
					room.ready[kind] = true;
					var queued = room.queue[kind]; room.queue[kind] = [];
					queued.forEach(function (m) { sendOn(kind, m); });
					if (everyChannelReady()) { setStatus('online'); onAllReady(); }
				}
				else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
					room.ready[kind] = false;
					setStatus('offline', err ? String(err.message || err) : status);
					console.warn('[Sync] ' + kind + ':' + room.code + ' ' + status + ' - supabase-js keeps retrying', err || '');
				}
			});
		});
	}

	function closeChannels() {
		Object.keys(room.channels).forEach(function (kind) { room.client.removeChannel(room.channels[kind]); });
		room.channels = {}; room.ready = {}; room.queue = {};
	}

	/* this tab's id for claim_stage: a reload of the same tab keeps it (and so its claim); another
	 * tab - or the engine the control panel runs - has its own, so two engines of ONE account in
	 * one browser can never both hold the room (supabase/migrations/0005) */
	function stageInstance() {
		var key = 'olympia.stageInstance';
		try {
			var id = sessionStorage.getItem(key);
			if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem(key, id); }
			return id;
		} catch (e) { return instanceId; }
	}

	/* The stage: claim the room, connect, keep the claim alive; lose it -> disconnect + warn. */
	async function runStage() {
		var connected = false;
		var inst = stageInstance();
		async function claim() {
			var r = await room.client.rpc('claim_stage', { p_code: room.code, p_instance: inst });
			/* database still without 0005: the old one-claim-per-account call */
			if (r.error && r.error.code === 'PGRST202') { r = await room.client.rpc('claim_stage', { p_code: room.code }); }
			if (r.error) {
				/* connected: a blip, keep going. Not yet: say why (often the SQL setup is missing) */
				console.warn('[Sync] claim_stage failed, retrying', r.error);
				if (!connected) { setStatus('error', 'Không nhận được phòng ' + room.code + ' từ máy chủ (' + (r.error.message || r.error.code) + '). Đang thử lại...'); }
			}
			else if (r.data === 'ok') {
				if (gv.AuthorityConflict) { gv.AuthorityConflict = false; emit('conflict', false); }
				if (!connected) {
					connected = true;
					openChannels({ ctl: true, hi: true, ops: false, pub: false }, function () { gv.Sync.publish(); });
					if (window.OlympiaPlayerActions) { window.OlympiaPlayerActions.start(room.client, room.code); }
				}
			}
			else {
				if (connected) {
					connected = false;
					closeChannels();
					if (window.OlympiaPlayerActions) { window.OlympiaPlayerActions.stop(); }
				}
				if (r.data === 'no_room') { setStatus('denied', 'Không có phòng ' + room.code + '.'); }
				else if (r.data === 'expired') { setStatus('denied', 'Phòng ' + room.code + ' đã hết hạn (mỗi phòng dùng được 4 tiếng) - tạo phòng mới ở sảnh.'); }
				else {
					setStatus('taken');
					if (!gv.AuthorityConflict) { gv.AuthorityConflict = true; emit('conflict', true); }
				}
			}
			setTimeout(claim, STAGE_HEARTBEAT_MS);
		}
		setInterval(function () { if (connected && everyChannelReady()) { gv.Sync.publish(); } }, STATE_HEARTBEAT_MS);
		await claim();
	}

	/* The control panel: only the room's owner or a co-manager gets in (migrations/0008). */
	async function runPanel() {
		var r = await room.client.from('rooms').select('code, expires_at').eq('code', room.code).maybeSingle();
		if (r.error) { r = await room.client.from('rooms').select('code').eq('code', room.code).maybeSingle(); }   /* before 0008 */
		if (r.error) { setStatus('error', r.error.message); return; }
		if (!r.data) { setStatus('denied', 'Phòng ' + room.code + ' không tồn tại, đã hết hạn, hoặc tài khoản này không được quản lý phòng.'); return; }
		if (r.data.expires_at && Date.parse(r.data.expires_at) <= Date.now()) { setStatus('denied', 'Phòng ' + room.code + ' đã hết hạn (mỗi phòng dùng được 4 tiếng).'); return; }
		gv.Sync.expiresAt = r.data.expires_at ? Date.parse(r.data.expires_at) : null;
		openChannels({ ops: true, ctl: false, hi: false }, function () { sendOn('hi', { type: 'hello' }); });
	}

	async function initRoom(mode, code) {
		var auth = window.OlympiaAuth;
		room = { code: code, client: auth && auth.client, mode: mode, channels: {}, ready: {}, queue: {} };
		gv.Sync.room = code;
		setStatus('connecting');
		if (!room.client) { setStatus('error', 'Không tải được thư viện Supabase (cần mạng).'); return; }
		try {
			var session = (mode === 'authority') ? await auth.ensureAnonymous() : await auth.requireManager();
			room.client.realtime.setAuth(session.access_token);
			if (mode === 'authority') { await runStage(); } else { await runPanel(); }
		}
		catch (e) {
			console.error('[Sync] room start failed', e);
			setStatus('error', e.message || String(e));
		}
	}

	gv.Sync = {
		instanceId: instanceId,
		lastSnapshot: null,
		clockOffset: 0,
		room: null,
		status: 'local',
		statusDetail: '',

		init: function (mode) {
			gv.SyncMode = mode;

			var code = roomFromUrl();
			if (code) { initRoom(mode, code); return; }

			if ('BroadcastChannel' in window) {
				channel = new BroadcastChannel(gv.SyncChannelName);
				channel.onmessage = function (ev) { handleMessage(ev.data); };
			}
			else {
				console.warn('[Sync] BroadcastChannel unavailable - falling back to storage events only');
			}

			/* storage event: fires in OTHER tabs when the snapshot changes. Fallback path for remotes. */
			window.addEventListener('storage', function (ev) {
				if (gv.SyncMode === 'remote' && ev.key === gv.SyncStateKey && ev.newValue) {
					try { handleMessage({ type: 'state', snapshot: JSON.parse(ev.newValue) }); } catch (e) { /* ignore */ }
				}
			});

			if (mode === 'authority') {
				/* Another live authority? Warn - two graphics pages means doubled audio. */
				var existing = readJson(gv.SyncAuthorityKey);
				gv.AuthorityConflict = !!(existing && existing.id !== instanceId && (Date.now() - existing.ts) < 3000);
				if (gv.AuthorityConflict) { emit('conflict', true); }
				startHeartbeat();
				/* panels tell a live engine from a closed one by its states, as in a room */
				setInterval(function () { gv.Sync.publish(); }, STATE_HEARTBEAT_MS);
				window.addEventListener('beforeunload', function () {
					clearInterval(heartbeatTimer);
					try { var cur = readJson(gv.SyncAuthorityKey); if (cur && cur.id === instanceId) { localStorage.removeItem(gv.SyncAuthorityKey); } } catch (e) { /* ignore */ }
				});
			}
			else {
				this.lastSnapshot = readJson(gv.SyncStateKey);
				if (this.lastSnapshot) { emit('state', this.lastSnapshot); }
				this.send({ type: 'hello' });
			}
		},

		on: function (type, cb) {
			(listeners[type] = listeners[type] || []).push(cb);
		},

		send: function (msg) {
			if (room) {
				if (msg.type === 'state') { sendOn('ops', msg); }
				else if (msg.type === 'hello') { sendOn('hi', msg); }
				else { sendOn('ctl', msg); }
			}
			else if (channel) { channel.postMessage(msg); }
		},

		/* Authority only. Coalesces bursts of mutations into one snapshot per frame. */
		publish: function () {
			if (gv.SyncMode !== 'authority' || publishQueued) { return; }
			publishQueued = true;
			var flush = function () {
				publishQueued = false;
				var snap = buildSnapshot();
				if (room) {
					var pub = buildPublicSnapshot();
					/* the VCNV picture with its closed covers painted out, sent only when it changes */
					var asset = gv.vcnvPublicImage ? gv.vcnvPublicImage() : null;
					if (pub.roundState && pub.roundState.vcnv) { pub.roundState.vcnv.imageKey = asset ? asset.key : ''; }
					if (asset && asset.key !== lastAssetKey) { sendOn('pub', { type: 'asset', key: asset.key, data: asset.data }); }
					lastAssetKey = asset ? asset.key : '';
					sendOn('pub', { type: 'state', snapshot: pub });
					savePublicState(asset ? Object.assign({}, pub, { asset: { key: asset.key, data: asset.data } }) : pub);
				}
				else { writeJson(gv.SyncStateKey, snap); }
				gv.Sync.send({ type: 'state', snapshot: snap });
				emit('state', snap);
			};
			setTimeout(flush, 0);
		},

		snapshot: buildSnapshot,
		matchId: matchId,

		/* Authority only, room mode: a message to every screen (AudioControl.js relays sound this way) */
		sendPublic: function (msg) { if (room && gv.SyncMode === 'authority') { sendOn('pub', msg); } },
		publicSnapshot: buildPublicSnapshot,

		/* Remote helper: is the authority page alive? (room: state heard lately; local: heartbeat younger than 3 s) */
		isAuthorityAlive: function () {
			if (room) { return Date.now() - lastOpsAt < STAGE_TIMEOUT_MS; }
			var hb = readJson(gv.SyncAuthorityKey);
			return !!(hb && (Date.now() - hb.ts) < 3000);
		},

		/* Remote helper: the engine this panel follows, and the others it hears but ignores */
		followedEngine: function () { return engineAlive(followed) ? followed : null; },
		ignoredEngines: function () {
			return Object.keys(engines).filter(function (id) { return id !== followed && engineAlive(id); })
				.map(function (id) { return { id: id, embedded: engines[id].embedded, fresh: engines[id].fresh }; });
		},

		/* the tab id claim_stage uses (QuestionSet.js takes the room before the questions load) */
		stageInstanceId: function () { return stageInstance(); },

		/* Remote helper: forward a key press */
		sendKey: function (key, code) {
			this.send({ type: 'key', key: key, code: code });
		},

		/* Remote helper: structured command */
		sendCommand: function (name, args) {
			this.send({ type: 'cmd', name: name, args: args || {} });
		}
	};

	/* panels: any state from the stage proves it is alive */
	gv.Sync.on('state', function () { if (room && gv.SyncMode !== 'authority') { lastOpsAt = Date.now(); } });

	/* Command registry - authority side. Rounds and controls add entries. */
	gv.Commands = gv.Commands || {};

	/* On the graphics page GeneralControl.js wraps this to refresh the stage background first. */
	gv.changed = function () { gv.Sync.publish(); };

})(window.GameVariables = window.GameVariables || {});
