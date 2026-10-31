/*
 * Olympia Controller - watching a room without an account (player, podium, audience pages).
 * Signs in anonymously, listens to pub:CODE (the public state, no answers) and asks the stage for
 * the current state on hi:CODE. Needs supabase-js, Config.js, Auth.js.
 *
 *   var room = OlympiaPublicRoom.connect('ABC123', { onState: fn(snapshot, info), onStatus: fn(status), presence: { role, seat } });
 *        info.saved = true for the state the stage last saved (shown before / without a live stage)
 *        onAsset: fn({ key, data }) - the VCNV picture with its closed covers painted out
 *        (VcnvPublicImage.js); the public state only carries its key
 *        onSound: fn({ op, args, at, seek?, ch? }) - a sound call the engine relays (AudioControl.js)
 *        presence: this screen announces itself on pub:CODE (the control panel's RoomPresence.js
 *        shows who is connected) - role 'podium' | 'player' | 'audience' | 'screen'
 *   room.stageNow()    "now" on the stage machine's clock (timers are stamped there)
 *   room.isStageAlive()
 *   room.silentFor()     ms since the engine last sent anything
 *   room.track({ ... })  add fields to this screen's presence (a stage screen: sound: true)
 * status: connecting | online | offline | error
 */
(function () {
	var STAGE_TIMEOUT_MS = 7000;   /* the stage republishes every 3 s */

	window.OlympiaPublicRoom = {
		connect: function (code, handlers) {
			var auth = window.OlympiaAuth, client = auth && auth.client;
			var lastAt = 0, heardAt = 0, clockOffset = 0, hi = null, hiReady = false, pub = null, closed = false;
			var h = handlers || {};
			function status(s, detail) { if (h.onStatus) { h.onStatus(s, detail || ''); } }

			var presenceExtra = {};
			function track() {
				if (pub && h.presence) { pub.track(Object.assign({ role: h.presence.role, seat: h.presence.seat || null, at: Date.now() }, presenceExtra)).catch(function () {}); }
			}

			function hello() { if (hi && hiReady) { hi.send({ type: 'broadcast', event: 'msg', payload: { type: 'hello' } }); } }

			async function start() {
				if (!client) { status('error', 'Không tải được thư viện Supabase - kiểm tra mạng.'); return; }
				status('connecting');
				try {
					var session = await auth.ensureAnonymous();
					client.realtime.setAuth(session.access_token);
				}
				catch (e) { status('error', e.message); return; }
				if (closed) { return; }

				/* the last state the stage saved - shown at once, live updates replace it */
				client.rpc('load_public_state', { p_code: code }).then(function (r) {
					if (closed || lastAt || r.error || !r.data || !r.data.state) { return; }
					var s = r.data.state;
					if (s.timer) { s.timer = Object.assign({}, s.timer, { running: false }); }   /* a clock saved mid-run is long over */
					if (s.asset && h.onAsset) { h.onAsset(s.asset); }
					if (h.onState) { h.onState(s, { saved: true, savedAt: r.data.at }); }
				});

				var cfg = { private: true, broadcast: { self: false } };
				if (h.presence) { cfg.presence = { key: Math.random().toString(36).slice(2) }; }
				pub = client.channel('pub:' + code, { config: cfg });
				pub.on('broadcast', { event: 'msg' }, function (ev) {
					var msg = ev.payload;
					if (msg) { heardAt = Date.now(); }   /* anything from the engine: it is there */
					if (msg && msg.type === 'asset' && msg.key) { if (h.onAsset) { h.onAsset(msg); } return; }
					if (msg && msg.type === 'sound' && msg.op) { if (h.onSound) { h.onSound(msg); } return; }
					if (!msg || msg.type !== 'state' || !msg.snapshot) { return; }
					lastAt = Date.now();
					if (msg.snapshot.at) { clockOffset = Date.now() - msg.snapshot.at; }
					if (h.onState) { h.onState(msg.snapshot); }
				});
				pub.subscribe(function (st, err) {
					if (st === 'SUBSCRIBED') {
						status('online'); hello();
						if (h.presence) { track(); }
					}
					else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') {
						/* a room that does not exist is refused by the database */
						status('offline', err ? String(err.message || err) : st);
					}
				});

				hi = client.channel('hi:' + code, { config: { private: true } });
				hi.subscribe(function (st) { hiReady = (st === 'SUBSCRIBED'); if (hiReady) { hello(); } });
			}

			start();
			return {
				hello: hello,
				track: function (extra) { presenceExtra = Object.assign(presenceExtra, extra || {}); track(); },
				close: function () {
					closed = true;
					[pub, hi].forEach(function (ch) { if (ch) { client.removeChannel(ch); } });
					pub = hi = null; hiReady = false;
				},
				stageNow: function () { return Date.now() - clockOffset; },
				isStageAlive: function () { return Date.now() - lastAt < STAGE_TIMEOUT_MS; },
				/* ms since the engine last sent anything (state, sound, picture); Infinity: never */
				silentFor: function () { return heardAt ? Date.now() - heardAt : Infinity; }
			};
		}
	};
})();
