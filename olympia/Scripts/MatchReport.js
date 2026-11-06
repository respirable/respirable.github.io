/*
 * Olympia Controller - the match report ("Biên bản trận", control panel). Built from the match log
 * (MatchLog.js on the stage: every score change with the action that made it, buzzes, VCNV
 * signals, Câu hỏi phụ verdicts, round changes - each line carries every seat's score after it).
 *
 *   renderMatchReport(log, snap, meta)   draws the report into report.html's <main id="report">;
 *                                        the control panel opens report.html at the click (so no
 *                                        popup blocker stops it) and hands it the log once the
 *                                        stage has sent it (ControlPanel.js showReport)
 *
 * The report: the final standing, the points each seat made in each round (a table - also the
 * chart's table view), what was added / taken off, a step chart of the four scores across the
 * match (one step per change, rounds as bands, crosshair + tooltip, names at the line ends), and
 * the whole log by round. Printable (A4, light), dark on screen when the viewer's system is.
 * Colours: the validated four-slot categorical palette (dataviz reference), fixed by seat.
 */
(function () {
	var ROUNDS = ['kd', 'vcnv', 'tt', 'vd', 'tb'];
	var ROUND_NAMES = { kd: 'Khởi động', vcnv: 'Vượt chướng ngại vật', tt: 'Tăng tốc', vd: 'Về đích', tb: 'Câu hỏi phụ' };
	var ROUND_SHORT = { kd: 'KĐ', vcnv: 'VCNV', tt: 'TT', vd: 'VĐ', tb: 'Phụ' };
	var MANUAL = /sửa điểm|tay\)|phục hồi|khôi phục/;   /* score lines made by hand, not by a verdict */

	function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
	function clock(t) { try { return new Date(t).toLocaleTimeString('vi-VN', { hour12: false }); } catch (e) { return ''; } }
	function signed(n) { return n > 0 ? '+' + n : (n < 0 ? '−' + Math.abs(n) : '0'); }

	/* ---------- the numbers ---------- */

	function analyse(log, players) {
		var n = players.length;
		var first = log[0];
		var base = first && first.scores ? first.scores.slice() : players.map(function () { return 0; });
		if (first && first.kind === 'score' && first.seat) { base[first.seat - 1] -= first.delta || 0; }
		var perRound = {}, gains = {}, losses = {}, manual = {};
		ROUNDS.forEach(function (r) { perRound[r] = zeros(n); gains[r] = zeros(n); losses[r] = zeros(n); manual[r] = zeros(n); });
		function zeros(k) { var a = []; for (var i = 0; i < k; i++) { a.push(0); } return a; }
		var prev = base.slice(), points = [{ t: first ? first.t : Date.now(), round: first ? first.round : 'kd', scores: base.slice(), text: 'Bắt đầu nhật ký' }];
		log.forEach(function (e) {
			if (!e.scores) { return; }
			var r = perRound[e.round] ? e.round : null, changed = false;
			for (var i = 0; i < n; i++) {
				var d = (e.scores[i] || 0) - (prev[i] || 0);
				if (d) { changed = true; if (r) { perRound[r][i] += d; } }
			}
			if (e.kind === 'score' && e.seat && r) {
				var k = e.seat - 1;
				if (MANUAL.test(e.text)) { manual[r][k] += e.delta; }
				else if (e.delta > 0) { gains[r][k] += 1; }
				else if (e.delta < 0) { losses[r][k] += 1; }
			}
			if (changed) { points.push({ t: e.t, round: e.round, scores: e.scores.slice(), text: e.text }); }
			prev = e.scores.slice();
		});
		var played = ROUNDS.filter(function (r) { return log.some(function (e) { return e.round === r; }); });
		return { base: base, perRound: perRound, gains: gains, losses: losses, manual: manual, points: points, played: played,
			truncated: !!(first && first.scores && first.scores.some(function (s) { return s !== 0; }) && first.kind !== 'round') };
	}

	/* ---------- the chart: one step per score change ---------- */

	function chartSvg(a, players) {
		var W = 920, H = 340, L = 44, R = 150, T = 30, B = 34;
		var pts = a.points, n = pts.length;
		var all = []; pts.forEach(function (p) { all = all.concat(p.scores); });
		var lo = Math.min(0, Math.min.apply(null, all)), hi = Math.max(10, Math.max.apply(null, all));
		var step = niceStep((hi - lo) / 5); lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
		var x = function (i) { return L + (n > 1 ? i * (W - L - R) / (n - 1) : 0); };
		var y = function (v) { return T + (hi - v) * (H - T - B) / (hi - lo || 1); };
		var out = [];
		/* round bands */
		var start = 0, bands = 0;
		for (var i = 1; i <= n; i++) {
			if (i === n || pts[i].round !== pts[start].round) {
				var a0 = start ? (x(start - 1) + x(start)) / 2 : L, a1 = i < n ? (x(i - 1) + x(i)) / 2 : W - R;
				out.push('<rect class="band' + (bands++ % 2 ? ' alt' : '') + '" x="' + a0.toFixed(1) + '" y="' + T + '" width="' + Math.max(0, a1 - a0).toFixed(1) + '" height="' + (H - T - B) + '"/>');
				out.push('<text class="bandLabel" x="' + ((a0 + a1) / 2).toFixed(1) + '" y="' + (T - 10) + '" text-anchor="middle">' + esc(ROUND_SHORT[pts[start].round] || pts[start].round) + '</text>');
				start = i;
			}
		}
		/* grid + axis */
		for (var v = lo; v <= hi + 1e-9; v += step) {
			out.push('<line class="grid' + (v === 0 ? ' zero' : '') + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>');
			out.push('<text class="tick" x="' + (L - 8) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + v + '</text>');
		}
		out.push('<text class="tick" x="' + L + '" y="' + (H - 10) + '">Thay đổi điểm theo thứ tự trong trận →</text>');
		/* the lines (stepped: a score holds until its next change) */
		players.forEach(function (p, k) {
			var d = 'M' + x(0).toFixed(1) + ' ' + y(pts[0].scores[k] || 0).toFixed(1);
			for (var i = 1; i < n; i++) { d += 'H' + x(i).toFixed(1) + 'V' + y(pts[i].scores[k] || 0).toFixed(1); }
			out.push('<path class="line s' + (k + 1) + '" d="' + d + '"/>');
		});
		/* names at the line ends: kept 16 px apart, a leader line when moved */
		var ends = players.map(function (p, k) { return { k: k, y: y(pts[n - 1].scores[k] || 0), v: pts[n - 1].scores[k] || 0, name: p.displayName }; })
			.sort(function (p, q) { return p.y - q.y; });
		for (var j = 1; j < ends.length; j++) { ends[j].ly = Math.max(ends[j].y, (ends[j - 1].ly || ends[j - 1].y) + 16); }
		ends[0].ly = ends[0].y;
		ends.forEach(function (e) {
			var xe = x(n - 1);
			out.push('<circle class="end s' + (e.k + 1) + '" cx="' + xe.toFixed(1) + '" cy="' + e.y.toFixed(1) + '" r="4"/>');
			if (Math.abs(e.ly - e.y) > 1) { out.push('<path class="leader" d="M' + (xe + 6).toFixed(1) + ' ' + e.y.toFixed(1) + 'L' + (xe + 14).toFixed(1) + ' ' + e.ly.toFixed(1) + '"/>'); }
			out.push('<text class="endLabel" x="' + (xe + 18).toFixed(1) + '" y="' + (e.ly + 4).toFixed(1) + '"><tspan class="v">' + e.v + '</tspan> ' + esc(e.name) + '</text>');
		});
		/* hover: a crosshair and one column per step */
		out.push('<line class="cross" id="cross" x1="0" x2="0" y1="' + T + '" y2="' + (H - B) + '"/>');
		for (var h = 0; h < n; h++) {
			var c0 = h ? (x(h - 1) + x(h)) / 2 : L, c1 = h < n - 1 ? (x(h) + x(h + 1)) / 2 : W - R;
			out.push('<rect class="hit" data-i="' + h + '" data-x="' + x(h).toFixed(1) + '" x="' + c0.toFixed(1) + '" y="' + T + '" width="' + Math.max(1, c1 - c0).toFixed(1) + '" height="' + (H - T - B) + '"/>');
		}
		return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Điểm của bốn thí sinh qua từng lần thay đổi điểm">' + out.join('') + '</svg>';
	}
	function niceStep(raw) {
		var p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
		var m = raw / p;
		return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
	}

	/* ---------- the page ---------- */

	function page(log, snap, meta) {
		var players = (snap.players || []).slice().sort(function (p, q) { return p.seat - q.seat; });
		var a = analyse(log, players);
		var final = a.points[a.points.length - 1].scores;
		var rank = players.map(function (p, k) { return { p: p, k: k, s: final[k] || 0 }; }).sort(function (p, q) { return q.s - p.s || p.p.seat - q.p.seat; });
		var place = 0, last = null;
		rank.forEach(function (r, i) { if (r.s !== last) { place = i + 1; last = r.s; } r.place = place; });
		var when = log.length ? new Date(log[0].t) : new Date();
		var rounds = a.played.length ? a.played : ROUNDS.slice(0, 4);

		var h = [];
		h.push('<header class="head"><div><p class="eyebrow">Olympia Controller · Biên bản trận</p><h1>' + esc(meta.title || 'Trận đấu') + '</h1>');
		h.push('<p class="meta">' + esc([meta.room ? 'Phòng ' + meta.room : '', meta.rules, meta.set ? 'Bộ đề: ' + meta.set : '', when.toLocaleDateString('vi-VN') + ' · ' + clock(log.length ? log[0].t : Date.now()) + (log.length ? '–' + clock(log[log.length - 1].t) : '')].filter(Boolean).join(' · ')) + '</p></div>');
		h.push('<button type="button" class="print" onclick="window.print()">In / lưu PDF</button></header>');
		if (a.truncated) { h.push('<p class="note">Nhật ký chỉ giữ những dòng gần nhất; điểm trước dòng đầu tiên được tính là điểm xuất phát.</p>'); }

		/* standing */
		h.push('<section><h2>Kết quả</h2><ol class="podium">');
		rank.forEach(function (r) {
			h.push('<li class="s' + (r.k + 1) + (r.place === 1 ? ' first' : '') + '"><span class="place">' + r.place + '</span><span class="who"><b>' + esc(r.p.fullName || r.p.displayName) + '</b><small>Ghế ' + r.p.seat + (r.p.school ? ' · ' + esc(r.p.school) : '') + '</small></span><span class="score">' + r.s + '</span></li>');
		});
		h.push('</ol></section>');

		/* points by round (the chart's table view) */
		h.push('<section><h2>Điểm theo vòng</h2><div class="tableWrap"><table class="byRound"><thead><tr><th>Thí sinh</th>');
		rounds.forEach(function (r) { h.push('<th>' + esc(ROUND_NAMES[r]) + '</th>'); });
		h.push('<th>Tổng</th></tr></thead><tbody>');
		players.forEach(function (p, k) {
			h.push('<tr><th><i class="key s' + (k + 1) + '"></i>' + esc(p.seat + '. ' + p.displayName) + '</th>');
			rounds.forEach(function (r) {
				var g = a.gains[r][k], l = a.losses[r][k], m = a.manual[r][k];
				var detail = [g ? g + ' lần cộng' : '', l ? l + ' lần trừ' : '', m ? 'chỉnh tay ' + signed(m) : ''].filter(Boolean).join(' · ');
				h.push('<td><b>' + signed(a.perRound[r][k]) + '</b>' + (detail ? '<small>' + esc(detail) + '</small>' : '') + '</td>');
			});
			h.push('<td class="total"><b>' + (final[k] || 0) + '</b></td></tr>');
		});
		h.push('</tbody></table></div><p class="meta">"Lần cộng / lần trừ" đếm các lần chấm điểm; điểm hoàn tác và sửa tay đã tính vào số điểm của vòng.</p></section>');

		/* the chart */
		h.push('<section><h2>Diễn biến điểm</h2><ul class="legend">');
		players.forEach(function (p, k) { h.push('<li><i class="key s' + (k + 1) + '"></i>' + esc(p.seat + '. ' + p.displayName) + '</li>'); });
		h.push('</ul><div class="chartWrap">' + chartSvg(a, players) + '<div class="tip" id="tip" hidden></div></div></section>');

		/* the log, by round */
		h.push('<section class="logSec"><h2>Nhật ký</h2>');
		var cur = null;
		log.forEach(function (e) {
			if (e.round !== cur) { if (cur !== null) { h.push('</ol>'); } cur = e.round; h.push('<h3>' + esc(ROUND_NAMES[cur] || cur || '—') + '</h3><ol class="log">'); }
			h.push('<li class="' + esc(e.kind) + '"><time>' + clock(e.t) + '</time><span>' + esc(e.text) + '</span>' + (e.kind === 'score' ? '<span class="sc">' + esc((e.scores || []).join(' · ')) + '</span>' : '') + '</li>');
		});
		if (cur !== null) { h.push('</ol>'); }
		if (!log.length) { h.push('<p class="meta">Nhật ký trống - chưa có thao tác nào trong trận.</p>'); }
		h.push('</section>');
		h.push('<footer class="meta">Tạo lúc ' + esc(new Date().toLocaleString('vi-VN', { hour12: false })) + ' từ nhật ký trận của Olympia Controller.</footer>');
		/* for the hover layer (MatchReportPage.js) */
		var data = { names: players.map(function (p) { return p.seat + '. ' + p.displayName; }), points: a.points.map(function (p) { return { t: clock(p.t), r: ROUND_NAMES[p.round] || p.round, s: p.scores, x: p.text }; }) };
		return { html: h.join('\n'), data: data };
	}

	window.renderMatchReport = function (log, snap, meta) {
		var out = page(log || [], snap || {}, meta || {});
		var main = document.getElementById('report');
		main.innerHTML = out.html;   /* every text in it went through esc() */
		document.title = 'Biên bản trận' + (meta && meta.room ? ' ' + meta.room : '');
		window.REPORT = out.data;
		if (typeof window.initReportChart === 'function') { window.initReportChart(); }
	};
})();
