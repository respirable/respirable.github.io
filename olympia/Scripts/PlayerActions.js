/*
 * Olympia Controller - what the players' own devices do to the game (stage page, room mode only).
 *
 * Players call player_action() (supabase/migrations/0002); the row - with the seat looked up by
 * the database and a database timestamp - arrives here through postgres_changes. Rows are held
 * for BUFFER_MS so presses that cross on the network are applied in the order they were made,
 * then each one goes to the SAME round functions the keyboard uses, after checking the round
 * is at a step where that action is allowed:
 *
 *   buzz    KĐ lượt chung -> khoiDongBuzz(seat)      VĐ 5 s giành quyền -> veDichStealBuzz(seat)
 *           Câu hỏi phụ -> tieBreakBuzz(seat, { early, inTime }) by the press time
 *   cnv     VCNV -> vcnvSignal(seat)                 (never "confirm right": only the host does that)
 *   answer  VCNV hàng ngang -> vcnvSetAnswers         Tăng tốc -> tangTocSetAnswers (+ time)
 *
 * Written answers count only if they were sent before the 15 / 20 / 30 s clock ran out, measured
 * on the database clock (server_now_ms keeps this page's clock lined up with it).
 */
(function () {
	var gv = window.GameVariables;
	/* long enough for the earlier press to arrive even when its device's upload is slower
	 * (measured spread between two players: up to ~300 ms) */
	var BUFFER_MS = 400;
	var MAX_ANSWER = 100;

	var client = null, code = null, channel = null;
	var buffer = [], flushTimer = null;
	var serverOffset = 0;        /* database ms - this page's ms */
	var bestRtt = Infinity;      /* round trip of the sample serverOffset came from */
	var clockTimer = null;
	var startedAt = 0;

	/* NTP-style: offset = server time - midpoint of the request. Its error is at most half the
	 * round trip, and the first requests on a fresh connection are slow, so take several samples
	 * and trust the fastest one (a later, faster sample replaces it). */
	async function sampleClock() {
		var t0 = Date.now();
		var r = await client.rpc('server_now_ms');
		var t1 = Date.now();
		if (r.error || !r.data) { return; }
		var rtt = t1 - t0;
		if (rtt <= bestRtt) { bestRtt = rtt; serverOffset = Number(r.data) - (t0 + t1) / 2; }
	}

	async function syncClock(samples) {
		if (!client) { return; }
		bestRtt = bestRtt * 1.5;   /* let a drifted clock be re-measured, still preferring fast samples */
		for (var i = 0; i < (samples || 3); i++) { await sampleClock(); }
	}

	/* when the row was made, on this page's clock (the clock TimerState.wallStart uses) */
	function madeAt(row) { return Date.parse(row.created_at) - serverOffset; }

	/* The database stamps a row when the request ARRIVES, so its time includes the player's
	 * upload delay (measured 0.4-1.4 s). The player's page therefore measures the elapsed time
	 * itself, against the database clock (payload.elapsed), and that value is used when it is
	 * believable: not later than the arrival, and not more than NETWORK_SLACK_S before it. */
	var NETWORK_SLACK_S = 2;

	/* seconds from the start of the clock labelled `label` to this row, or null (other clock) */
	function elapsedOf(row, label) {
		var t = gv.TimerState;
		if (!t || t.label !== label || !t.wallStart) { return null; }
		var arrived = (madeAt(row) - t.wallStart) / 1000;
		var claimed = Number(row.payload && row.payload.elapsed);
		var ok = isFinite(claimed) && claimed >= 0 && claimed <= arrived + 0.3 && claimed >= arrived - NETWORK_SLACK_S;
		return { elapsed: ok ? claimed : arrived, arrived: arrived, duration: t.duration };
	}

	/* sent while the clock labelled `label` was still running? */
	function beforeTimeUp(row, label) {
		var e = elapsedOf(row, label);
		return !!e && e.arrived >= -1 && e.elapsed <= e.duration && e.arrived <= e.duration + NETWORK_SLACK_S;
	}

	function answerText(p) { return String((p && p.text) || '').replace(/\s+/g, ' ').trim().slice(0, MAX_ANSWER); }

	function apply(row) {
		var seat = row.seat, p = row.payload || {}, round = gv.CurrentRound, one = {};
		if (!gv.getPlayer(seat)) { return; }

		if (row.kind === 'buzz') {
			if (round === 'kd' && gv.KhoiDongMode === 'common') { khoiDongBuzz(seat); }           /* checks the step itself */
			else if (round === 'vd' && gv.VeDichSequenceCounter == 7) { veDichStealBuzz(seat); }
			else if (round === 'tb') { tieBreakBuzz(seat, tieBreakPressTiming(row)); }
		}
		else if (row.kind === 'cnv') {
			if (round === 'vcnv' && !gv.IsVcnvSolved && (vcnvIsRowStep() || gv.VcnvSequenceCounter == 9)) { vcnvSignal(seat); }
		}
		else if (row.kind === 'answer') {
			var accepted = false;
			if (round === 'vcnv') {
				var c = gv.VcnvSequenceCounter;
				if (Number(p.row) === gv.VcnvCurrentRow && !vcnvIsEliminated(seat) &&
					(c == 4 || ((c == 5 || c == 6) && beforeTimeUp(row, 'vcnv_row')))) {
					one[seat] = answerText(p);
					vcnvSetAnswers(gv.VcnvCurrentRow, one);
					accepted = true;
				}
			}
			else if (round === 'tt') {
				var t = gv.TangTocSequenceCounter, label = 'tt_q' + gv.TangTocIndex;
				if (Number(p.index) === gv.TangTocIndex && (t == 3 || t == 4) && beforeTimeUp(row, label)) {
					var times = {};
					one[seat] = answerText(p);
					times[seat] = Math.max(0, Math.min(elapsedOf(row, label).elapsed, gv.TimerState.duration));
					tangTocSetAnswers(one, times);
					accepted = true;
				}
			}
			receipt(seat, p.nonce, accepted);
		}
	}

	/* The player's page tags each answer with a random nonce; the public state says, per seat,
	 * whether the answer with that nonce was taken - so "Bàn điều khiển đã nhận" means THIS answer arrived
	 * in time (an earlier answer of the same seat no longer counts as proof). No answer text. */
	function receipt(seat, nonce, accepted) {
		if (typeof nonce !== 'string' || !nonce) { return; }
		gv.AnswerReceipts = gv.AnswerReceipts || {};
		gv.AnswerReceipts[seat] = { nonce: nonce.slice(0, 32), ok: !!accepted };
	}

	/* when the player pressed, in database ms: the time the device measured (payload.at) when it
	 * is believable - same rule as answer times - otherwise the arrival */
	function pressedAt(row) {
		var arrived = Date.parse(row.created_at);
		var claimed = Number(row.payload && row.payload.at);
		var ok = isFinite(claimed) && claimed <= arrived + 300 && claimed >= arrived - NETWORK_SLACK_S * 1000;
		return ok ? claimed : arrived;
	}

	/* Câu hỏi phụ: a press before the 15 s clock started is "early" (it can only be ruled wrong) -
	 * judged by when it was PRESSED, so a press that crossed the host's Right on the network is
	 * still early; and one pressed before 0 counts even if it arrives just after. */
	function tieBreakPressTiming(row) {
		var t = gv.TimerState, label = 'tb_q' + gv.TieBreakQuestionIndex;
		if (!t || t.label !== label || !t.wallStart) { return { early: true, inTime: false }; }
		var start = t.wallStart + serverOffset;                 /* database ms */
		var at = pressedAt(row);
		return { early: at < start, inTime: at >= start && at <= start + t.duration * 1000 };
	}

	function flush() {
		flushTimer = null;
		var rows = buffer.sort(function (a, b) { return pressedAt(a) - pressedAt(b) || a.id - b.id; });
		buffer = [];
		rows.forEach(function (row) {
			try { apply(row); } catch (e) { console.error('[PlayerActions] failed on', row, e); }
		});
		gv.changed();
	}

	function receive(row) {
		if (!row || madeAt(row) < startedAt - 5000) { return; }   /* only what happens while this page runs the room */
		buffer.push(row);
		if (!flushTimer) { flushTimer = setTimeout(flush, BUFFER_MS); }
	}

	window.OlympiaPlayerActions = {
		start: function (supabaseClient, roomCode) {
			this.stop();
			client = supabaseClient; code = roomCode; startedAt = Date.now(); bestRtt = Infinity;
			syncClock(6);
			clockTimer = setInterval(function () { syncClock(3); }, 60000);
			channel = client.channel('act:' + code, { config: { private: true } })
				.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'player_actions', filter: 'room_code=eq.' + code },
					function (ev) { receive(ev.new); })
				.subscribe(function (status, err) {
					if (status === 'SUBSCRIBED') { console.log('[PlayerActions] listening for players in ' + code); }
					else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { console.warn('[PlayerActions] ' + status, err || ''); }
				});
		},
		stop: function () {
			if (channel && client) { client.removeChannel(channel); }
			if (clockTimer) { clearInterval(clockTimer); }
			if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
			channel = null; clockTimer = null; buffer = [];
		},
		/* for tests / the console */
		serverOffset: function () { return serverOffset; },
		/* a moment on this page's clock, as database ms (sent to players for their timers) */
		toServerMs: function (localMs) { return localMs + serverOffset; },
		clockRtt: function () { return bestRtt; }
	};
})();
