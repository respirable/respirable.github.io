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
 * The report, in the order people read it: the final standing, the points per round, then every
 * question (QuestionLog, MatchLog.js) with each contestant's answer and result - filterable by
 * round / wrong answers / corrected ones, and correctable by the host ("Sửa biên bản"): a
 * corrected question says so, with what it said before, on screen and in print. Last, the event
 * log (folded) and the step chart of the four scores (few people need it).
 * Printable (A4, light), dark on screen when the viewer's system is. Seat colours: the validated
 * four-slot categorical palette (dataviz reference); right / wrong wear status colours with an
 * icon and a word, never colour alone.
 */
(function () {
	var ROUNDS = ['kd', 'vcnv', 'tt', 'vd', 'tb'];
	var ROUND_NAMES = { kd: 'Khởi động', vcnv: 'Vượt chướng ngại vật', tt: 'Tăng tốc', vd: 'Về đích', tb: 'Câu hỏi phụ', fix: 'Sửa biên bản' };
	var ROUND_SHORT = { kd: 'KĐ', vcnv: 'VCNV', tt: 'TT', vd: 'VĐ', tb: 'Phụ', fix: 'Sửa' };
	/* where a log line is drawn: points from a correction (MatchLog.js editQuestion, e.fix) count in
	   their question's round, but sit after the match in the chart and the event log */
	function shownRound(e) { return e.fix ? 'fix' : e.round; }
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
			var lastPt = points[points.length - 1];
			if (changed) { points.push({ t: e.t, round: shownRound(e), scores: e.scores.slice(), text: e.text, parts: [e.text] }); }
			else if (e.kind === 'score' && lastPt.parts && together(lastPt, e)) { lastPt.parts.push(e.text); lastPt.text = joinScoreTexts(lastPt.parts); }   /* the same verdict moved several scores */
			prev = e.scores.slice();
		});
		var played = ROUNDS.filter(function (r) { return log.some(function (e) { return e.round === r; }); });
		return { base: base, perRound: perRound, gains: gains, losses: losses, manual: manual, points: points, played: played,
			truncated: !!(first && first.scores && first.scores.some(function (s) { return s !== 0; }) && first.kind !== 'round') };
	}

	/* score changes made by one action (a Tăng tốc / VCNV verdict, a Về đích steal) share their time:
	   one line for them all - "1. An +40, 2. Bình +30 (TT: chấm)" */
	function together(a, b) { return shownRound(a) === shownRound(b) && Math.abs(a.t - b.t) <= 20 && String(a.scores) === String(b.scores); }   /* one action logs every change with the scores after all of them */
	function joinScoreTexts(texts) {
		var m = /\s(\([^()]*\))$/.exec(texts[0]), tail = m ? m[1] : null;
		if (tail && texts.every(function (t) { return t.slice(-tail.length) === tail; })) {
			return texts.map(function (t) { return t.slice(0, -tail.length).trim(); }).join(', ') + ' ' + tail;
		}
		return texts.join('; ');
	}
	function mergeSimultaneous(log) {
		var out = [];
		log.forEach(function (e) {
			var last = out[out.length - 1];
			if (e.kind === 'score' && last && last.kind === 'score' && together(last, e)) {
				last.parts.push(e.text); last.text = joinScoreTexts(last.parts); last.scores = e.scores; return;
			}
			out.push(e.kind === 'score' ? { t: e.t, round: e.round, fix: e.fix, kind: e.kind, text: e.text, scores: e.scores, parts: [e.text] } : e);
		});
		return out;
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

	var VERDICT = {
		right: { word: 'Đúng', icon: 'check' }, wrong: { word: 'Sai', icon: 'cross' }, none: { word: 'Không trả lời', icon: 'dash' },
		out: { word: 'Đã bị loại', icon: 'dash' }, early: { word: 'Bấm sớm', icon: 'cross' }
	};
	var ICONS = {
		check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>',
		cross: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>',
		dash: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 8h7"/></svg>',
		pencil: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 3.5l2 2-7 7H3.5v-2z"/></svg>',
		print: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 6V2.5h7V6M4.5 11.5h-2v-5h11v5h-2M4.5 9.5h7v4h-7z"/></svg>'
	};
	var state = { log: [], snap: {}, questions: [], meta: {}, players: [], editing: false, filter: { round: 'all', wrong: false, edited: false } };

	function seatShort(seat) { var p = state.players.filter(function (x) { return x.seat === seat; })[0]; return p ? p.seat + '. ' + p.displayName : 'Ghế ' + seat; }
	function verdictWord(r) { return (r.steal ? (r.verdict === 'right' ? 'Cướp đúng' : 'Cướp sai') : (VERDICT[r.verdict] || VERDICT.none).word) + (r.star ? ' · ngôi sao' : ''); }

	function standing(a, final) {
		var tally = {};
		state.players.forEach(function (p) { tally[p.seat] = { right: 0, wrong: 0 }; });
		state.questions.forEach(function (q) { q.results.forEach(function (r) { if (!tally[r.seat]) { return; } if (r.verdict === 'right') { tally[r.seat].right += 1; } else if (r.verdict === 'wrong' || r.verdict === 'early') { tally[r.seat].wrong += 1; } }); });
		/* level on points at the top: the Câu hỏi phụ decides (its winner is the last seat right in it) */
		var tbWin = null;
		state.questions.forEach(function (q) { if (q.round === 'tb') { q.results.forEach(function (r) { if (r.verdict === 'right') { tbWin = r.seat; } }); } });
		var rank = state.players.map(function (p, k) { return { p: p, k: k, s: final[k] || 0 }; }).sort(function (x, y) { return y.s - x.s || (x.p.seat === tbWin ? -1 : y.p.seat === tbWin ? 1 : 0) || x.p.seat - y.p.seat; });
		var topScore = rank.length ? rank[0].s : 0, byTb = tbWin !== null && rank.length > 1 && rank[0].p.seat === tbWin && rank[1].s === topScore;
		var place = 0, last = null;
		rank.forEach(function (r, i) { if (r.s !== last || (byTb && i === 1)) { place = i + 1; last = r.s; } r.place = place; });
		var top = rank[0], h = [];
		if (!top) { return '<p class="empty">Chưa có thí sinh.</p>'; }
		function tallyText(seat) { var t = tally[seat]; return t && (t.right || t.wrong) ? t.right + ' câu đúng · ' + t.wrong + ' câu sai' : ''; }
		h.push('<div class="standing">');
		h.push('<div class="winner s' + (top.k + 1) + '"><span class="tag">' + (rank.filter(function (r) { return r.place === 1; }).length > 1 ? 'Đồng hạng nhất' : (byTb ? 'Hạng nhất · thắng câu hỏi phụ' : 'Hạng nhất')) + '</span>');
		h.push('<b class="name">' + esc(top.p.fullName || top.p.displayName) + '</b><span class="sub">Ghế ' + top.p.seat + (top.p.school ? ' · ' + esc(top.p.school) : '') + '</span>');
		h.push('<span class="big">' + top.s + '</span><span class="sub">' + esc(tallyText(top.p.seat)) + '</span></div>');
		h.push('<ol class="others">');
		rank.slice(1).forEach(function (r) {
			h.push('<li class="s' + (r.k + 1) + '"><span class="place">' + r.place + '</span><span class="who"><b>' + esc(r.p.fullName || r.p.displayName) + '</b><small>Ghế ' + r.p.seat + (r.p.school ? ' · ' + esc(r.p.school) : '') + (tallyText(r.p.seat) ? ' · ' + esc(tallyText(r.p.seat)) : '') + '</small></span><span class="pts">' + r.s + (byTb && r.s === top.s ? '<small>thua câu phụ</small>' : '') + '</span></li>');
		});
		h.push('</ol></div>');
		return h.join('');
	}

	function roundTable(a, final, rounds) {
		var h = ['<div class="tableWrap"><table class="byRound"><thead><tr><th>Thí sinh</th>'];
		rounds.forEach(function (r) { h.push('<th>' + esc(ROUND_NAMES[r]) + '</th>'); });
		h.push('<th>Tổng</th></tr></thead><tbody>');
		state.players.forEach(function (p, k) {
			h.push('<tr><th><i class="key s' + (k + 1) + '"></i>' + esc(p.seat + '. ' + p.displayName) + '</th>');
			rounds.forEach(function (r) {
				var m = a.manual[r][k];
				h.push('<td><b>' + signed(a.perRound[r][k]) + '</b>' + (m ? '<small>(chỉnh tay ' + signed(m) + ')</small>' : '') + '</td>');
			});
			h.push('<td class="total"><b>' + (final[k] || 0) + '</b></td></tr>');
		});
		h.push('</tbody></table></div>');
		return h.join('');
	}

	/* where a question sits: its group row (a Khởi động turn, a Về đích contestant) and its number */
	function place(q) {
		var m;
		if (q.round === 'vd' && (m = /^(.*) · Câu (\d+) · (\d+) điểm$/.exec(q.label))) { return { group: m[1], no: m[2], tag: m[3] }; }
		if (q.round === 'kd' && (m = /^(.*) · Câu (\d+)$/.exec(q.label))) { return { group: m[1], no: m[2] }; }
		if (q.round === 'vcnv') { return { group: null, no: q.cnv ? 'CNV' : (q.row == 5 || /trung tâm/.test(q.label) ? 'TT' : String(q.row || '')), wide: q.cnv || q.row == 5 }; }
		if ((m = /Câu (\d+)/.exec(q.label))) { return { group: null, no: m[1] }; }
		return { group: null, no: '', label: q.label };
	}

	/* one seat's cell: verdict (icon + word), the answer given, time, points; a corrected one says what it was */
	function resultCell(r, orig) {
		if (!r) { return '<td class="rc blank"><span class="sr">Không tham gia</span></td>'; }
		var v = VERDICT[r.verdict] || VERDICT.none;
		var changed = orig && orig.verdict !== r.verdict;
		return '<td class="rc ' + esc(r.verdict) + (changed ? ' changed' : '') + '"><span class="verdict">' + ICONS[v.icon] + esc(verdictWord(r)) + '</span>' +
			(r.delta ? '<b class="delta">' + signed(r.delta) + '</b>' : '') +
			(r.answer ? '<span class="ans">' + esc(r.answer) + '</span>' : '') +
			(typeof r.time === 'number' ? '<span class="time">' + r.time.toFixed(2) + ' s</span>' : '') +
			(changed ? '<span class="was">trước: ' + esc(verdictWord(orig)) + '</span>' : '') + '</td>';
	}

	function questionRow(q) {
		var orig = {}, by = {}, pl = place(q);
		if (q.edit && q.edit.orig) { q.edit.orig.results.forEach(function (r) { orig[r.seat] = r; }); }
		q.results.forEach(function (r) { by[r.seat] = r; });
		var h = ['<tr class="qr' + (q.edit ? ' edited' : '') + '" data-id="' + esc(q.id) + '">'];
		h.push('<th class="no" scope="row"><span class="num' + (pl.wide ? ' wide' : '') + '" title="' + esc(clock(q.t)) + '">' + esc(pl.no || '·') + '</span>' + (pl.tag ? '<span class="val">' + esc(pl.tag) + '</span>' : '') +
			(q.edit ? '<span class="mark" title="Đã sửa' + (q.edit.at ? ' lúc ' + esc(clock(q.edit.at)) : '') + '">' + ICONS.pencil + '<span class="sr">Đã sửa</span></span>' : '') +
			'<button type="button" class="editBtn" data-edit="' + esc(q.id) + '" aria-label="Sửa câu này">' + ICONS.pencil + '</button></th>');
		h.push('<td class="qc"><p class="qText">' + (pl.label ? '<b>' + esc(pl.label) + '.</b> ' : '') + esc(q.text || '(không có nội dung)') + '</p>');
		if (q.answer) { h.push('<p class="qAns"><span>Đáp án</span>' + esc(q.answer) + '</p>'); }
		if (!q.results.length) { h.push('<p class="qNone">' + (q.nobody ? 'Không ai bấm chuông.' : 'Chưa chấm.') + '</p>'); }
		if (q.edit) {
			h.push('<p class="qEdited">' + ICONS.pencil + '<span>Đã sửa' + (q.edit.at ? ' lúc ' + esc(clock(q.edit.at)) : '') + (q.note ? ': ' + esc(q.note) : '') + '</span></p>');
			var pts = Object.keys(q.edit.points || {}).filter(function (s) { return q.edit.points[s]; });
			if (pts.length) {
				h.push('<p class="qPts">Điểm đã điều chỉnh: ' + pts.map(function (s) { return '<b>' + signed(q.edit.points[s]) + '</b> ' + esc(seatShort(Number(s))); }).join(', ') + '.' +
					(q.edit.rankSame ? ' Sự thay đổi điểm số này không ảnh hưởng tới thứ hạng của các thí sinh trong trận đấu.' : (q.edit.rankSame === false ? ' Thứ hạng các thí sinh đã thay đổi theo kết quả mới.' : '')) + '</p>');
			}
		}
		else if (q.note) { h.push('<p class="qEdited">' + esc(q.note) + '</p>'); }
		h.push('</td>');
		state.players.forEach(function (p) { h.push(resultCell(by[p.seat], q.edit ? (orig[p.seat] || { verdict: 'none' }) : null)); });
		h.push('</tr>');
		return h.join('');
	}

	function roundTableOf(round, list, k) {
		var cols = 2 + state.players.length, h = ['<section class="qBlock" style="--i:' + k + '"><h3 class="roundHead">' + esc(ROUND_NAMES[round] || round) + '<small>' + list.length + ' câu</small></h3><div class="tableWrap"><table class="qt"><colgroup><col class="cNo"><col class="cQ">'];
		state.players.forEach(function () { h.push('<col class="cS">'); });
		h.push('</colgroup><thead><tr><th scope="col">#</th><th scope="col">Câu hỏi · đáp án</th>');
		state.players.forEach(function (p, i) { h.push('<th scope="col" class="seatH s' + (i + 1) + '">' + esc(p.seat + '. ' + p.displayName) + '</th>'); });
		h.push('</tr></thead><tbody>');
		var grp;
		list.forEach(function (q) {
			var g = place(q).group || null;
			if (g && g !== grp) { h.push('<tr class="grp"><th colspan="' + cols + '">' + esc(g) + '</th></tr>'); }
			grp = g;
			h.push(questionRow(q));
		});
		h.push('</tbody></table></div></section>');
		return h.join('');
	}

	function questionList() {
		var f = state.filter, h = [];
		var shown = state.questions.filter(function (q) {
			if (f.round !== 'all' && q.round !== f.round) { return false; }
			if (f.wrong && !q.results.some(function (r) { return r.verdict === 'wrong' || r.verdict === 'early'; })) { return false; }
			if (f.edited && !q.edit) { return false; }
			return true;
		});
		if (!state.questions.length) {
			return '<div class="empty"><b>Chưa có câu hỏi nào được ghi lại.</b><span>Nhật ký câu hỏi bắt đầu từ khi câu đầu tiên của trận được đưa ra. Trận chơi trước khi có tính năng này chỉ có nhật ký sự kiện bên dưới.</span></div>';
		}
		if (!shown.length) { return '<div class="empty"><b>Không có câu nào khớp bộ lọc.</b><span>Bỏ bớt điều kiện lọc phía trên để xem lại.</span></div>'; }
		var k = 0;
		ROUNDS.forEach(function (r) {
			var list = shown.filter(function (q) { return q.round === r; });
			if (list.length) { h.push(roundTableOf(r, list, k++)); }
		});
		return h.join('');
	}

	function filterBar() {
		var counts = {}; state.questions.forEach(function (q) { counts[q.round] = (counts[q.round] || 0) + 1; });
		var edited = state.questions.filter(function (q) { return q.edit; }).length;
		var h = ['<div class="filters" role="toolbar" aria-label="Lọc câu hỏi"><div class="seg" role="radiogroup">'];
		h.push('<button type="button" data-round="all" aria-pressed="' + (state.filter.round === 'all') + '">Tất cả <small>' + state.questions.length + '</small></button>');
		ROUNDS.forEach(function (r) { if (counts[r]) { h.push('<button type="button" data-round="' + r + '" aria-pressed="' + (state.filter.round === r) + '">' + ROUND_SHORT[r] + ' <small>' + counts[r] + '</small></button>'); } });
		h.push('</div><button type="button" class="chip" data-flag="wrong" aria-pressed="' + state.filter.wrong + '">Có người sai</button>');
		h.push('<button type="button" class="chip" data-flag="edited" aria-pressed="' + state.filter.edited + '"' + (edited ? '' : ' disabled') + '>Đã sửa <small>' + edited + '</small></button></div>');
		return h.join('');
	}

	function page() {
		var log = state.log, meta = state.meta;
		var a = analyse(log, state.players);
		var final = (state.snap.players || []).length ? state.players.map(function (p) { return p.score; }) : a.points[a.points.length - 1].scores;
		var when = log.length ? new Date(log[0].t) : new Date();
		var rounds = a.played.length ? a.played : ROUNDS.slice(0, 4);
		var edited = state.questions.filter(function (q) { return q.edit; }).length;
		var h = [];
		h.push('<header class="head"><div><p class="eyebrow">Olympia Controller · Biên bản trận</p><h1>' + esc(meta.title || 'Trận đấu') + '</h1>');
		h.push('<p class="meta">' + esc([meta.room ? 'Phòng ' + meta.room : '', meta.rules, meta.set ? 'Bộ đề: ' + meta.set : '', when.toLocaleDateString('vi-VN') + ' · ' + clock(log.length ? log[0].t : Date.now()) + (log.length ? '–' + clock(log[log.length - 1].t) : '')].filter(Boolean).join(' · ')) + '</p></div>');
		h.push('<div class="actions"><button type="button" class="btn" id="editToggle" aria-pressed="' + state.editing + '">' + ICONS.pencil + (state.editing ? 'Xong' : 'Sửa biên bản') + '</button><button type="button" class="btn primary" id="printBtn">' + ICONS.print + 'In / lưu PDF</button></div></header>');
		if (edited) { h.push('<p class="note edited">' + ICONS.pencil + '<span>Biên bản có <b>' + edited + ' câu</b> đã được chủ trận sửa sau khi chấm. Các câu này mang dấu "Đã sửa", ghi kết quả trước khi sửa và số điểm đã cộng / trừ theo kết quả mới.</span></p>'); }
		if (a.truncated) { h.push('<p class="note">Nhật ký chỉ giữ những dòng gần nhất; điểm trước dòng đầu tiên được tính là điểm xuất phát.</p>'); }
		h.push('<section class="sec"><h2>Kết quả</h2>' + standing(a, final) + '</section>');
		h.push('<section class="sec"><h2>Điểm theo vòng</h2>' + roundTable(a, final, rounds) + '</section>');
		h.push('<section class="sec questions"><div class="secHead"><h2>Câu hỏi</h2><p class="meta">Mỗi câu đã đưa ra, đáp án và kết quả của từng thí sinh.</p></div>' + filterBar() + '<div id="qList">' + questionList() + '</div></section>');
		h.push('<section class="sec"><details class="events"><summary><h2>Nhật ký sự kiện</h2><span class="meta">' + log.length + ' dòng · bấm để mở</span></summary>');
		var cur = null, lines = mergeSimultaneous(log);
		lines.forEach(function (e) {
			if (shownRound(e) !== cur) { if (cur !== null) { h.push('</ol>'); } cur = shownRound(e); h.push('<h3 class="roundHead">' + esc(ROUND_NAMES[cur] || cur || '—') + '</h3><ol class="log">'); }
			h.push('<li class="' + esc(e.kind) + '"><time>' + clock(e.t) + '</time><span>' + esc(e.text) + '</span>' + (e.kind === 'score' ? '<span class="sc">' + esc((e.scores || []).join(' · ')) + '</span>' : '') + '</li>');
		});
		if (cur !== null) { h.push('</ol>'); }
		h.push('</details></section>');
		h.push('<section class="sec chartSec"><h2>Diễn biến điểm</h2><ul class="legend">');
		state.players.forEach(function (p, k) { h.push('<li><i class="key s' + (k + 1) + '"></i>' + esc(p.seat + '. ' + p.displayName) + '</li>'); });
		h.push('</ul><div class="chartWrap">' + chartSvg(a, state.players) + '<div class="tip" id="tip" hidden></div></div><p class="meta">Mỗi bậc là một lần điểm thay đổi. Bảng "Điểm theo vòng" phía trên chứa cùng số liệu.</p></section>');
		h.push('<footer class="meta">Tạo lúc ' + esc(new Date().toLocaleString('vi-VN', { hour12: false })) + ' từ nhật ký trận của Olympia Controller.</footer>');
		window.REPORT = { names: state.players.map(function (p) { return p.seat + '. ' + p.displayName; }), points: a.points.map(function (p) { return { t: clock(p.t), r: ROUND_NAMES[p.round] || p.round, s: p.scores, x: p.text }; }) };
		return h.join('\n');
	}

	/* ---------- correcting a question ---------- */

	function editor(q) {
		var seats = state.players.map(function (p) { return p.seat; });
		var h = ['<form class="qEdit" data-id="' + esc(q.id) + '"><p class="editHint">Sửa kết quả của câu này. Điểm của thí sinh được cộng / trừ lại theo kết quả mới, theo luật của vòng thi (Tăng tốc: xếp lại theo thời gian; Về đích: tính cả ngôi sao và cướp điểm).</p><div class="editRows">'];
		seats.forEach(function (seat) {
			var r = q.results.filter(function (x) { return x.seat === seat; })[0] || { verdict: '', answer: '' };
			h.push('<fieldset class="editRow"><legend>' + esc(seatShort(seat)) + '</legend><div class="seg small">');
			[['right', 'Đúng'], ['wrong', 'Sai'], ['none', 'Không trả lời']].forEach(function (o) {
				h.push('<label><input type="radio" name="v' + seat + '" value="' + o[0] + '"' + (r.verdict === o[0] || (o[0] === 'none' && (!r.verdict || r.verdict === 'out')) ? ' checked' : '') + '>' + o[1] + '</label>');
			});
			h.push('</div><label class="fld">Câu trả lời<input type="text" name="a' + seat + '" maxlength="200" value="' + esc(r.answer || '') + '" placeholder="(không ghi)"></label></fieldset>');
		});
		h.push('</div><label class="fld">Ghi chú (vì sao sửa)<textarea name="note" rows="2" maxlength="500" placeholder="Ví dụ: chấp nhận đáp án sau khi hội đồng xem lại">' + esc(q.note || '') + '</textarea></label>');
		h.push('<p class="formErr" role="alert"></p><div class="editActions"><button type="button" class="btn" data-cancel>Huỷ</button><button type="submit" class="btn primary">Lưu chỉnh sửa</button></div></form>');
		return h.join('');
	}

	function saveEdit(form) {
		var q = state.questions.filter(function (x) { return x.id === form.getAttribute('data-id'); })[0];
		if (!q) { return; }
		var results = state.players.map(function (p) {
			var v = form.querySelector('input[name="v' + p.seat + '"]:checked');
			return { seat: p.seat, verdict: v ? v.value : 'none', answer: form.querySelector('input[name="a' + p.seat + '"]').value.trim() };
		});
		var note = form.querySelector('textarea[name="note"]').value.trim();
		var before = JSON.stringify(q.results.map(function (r) { return [r.seat, r.verdict, r.answer || '']; })) + '|' + (q.note || '');
		var keep = results.filter(function (r) { var cur = q.results.filter(function (x) { return x.seat === r.seat; })[0]; return cur || r.verdict !== 'none' || r.answer; });
		var after = JSON.stringify(keep.map(function (r) { return [r.seat, r.verdict, r.answer || '']; })) + '|' + note;
		if (before === after) { form.querySelector('.formErr').textContent = 'Chưa có gì thay đổi.'; return; }
		var sent = false;
		try { sent = !!(window.opener && !window.opener.closed && window.opener.olympiaReportEdit && window.opener.olympiaReportEdit(q.id, { results: keep, note: note }, window)); } catch (e) { sent = false; }
		if (!sent) { form.querySelector('.formErr').textContent = 'Không lưu được: bảng điều khiển của trận đã đóng. Mở lại biên bản từ bảng điều khiển (Nhật ký trận → Biên bản trận) rồi sửa lại.'; return; }
		state.pending = q.id;
		var btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Đang lưu…';
		clearTimeout(state.pendingTimer);
		state.pendingTimer = setTimeout(function () { if (state.pending) { state.pending = null; btn.disabled = false; btn.textContent = 'Lưu chỉnh sửa'; form.querySelector('.formErr').textContent = 'Chưa nhận được trả lời từ máy chạy trò chơi. Thử lại sau giây lát.'; } }, 8000);
	}

	function toast(text, warn) {
		var t = document.getElementById('toast');
		if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
		t.className = 'toast' + (warn ? ' warn' : '');
		t.textContent = text;
		requestAnimationFrame(function () { t.classList.add('on'); });
		clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('on'); }, warn ? 7000 : 3200);
	}

	function redrawQuestions() {
		var main = document.getElementById('report');
		var y = window.scrollY;
		main.innerHTML = page();
		main.classList.toggle('editing', state.editing);
		if (typeof window.initReportChart === 'function') { window.initReportChart(); }
		window.scrollTo(0, y);
	}

	function wire() {
		var main = document.getElementById('report');
		if (main._wired) { return; }
		main._wired = true;
		main.addEventListener('click', function (e) {
			var b = e.target.closest('button');
			if (!b) { return; }
			if (b.id === 'printBtn') { window.print(); return; }
			if (b.id === 'editToggle') { state.editing = !state.editing; redrawQuestions(); return; }
			if (b.hasAttribute('data-round') && b.closest('.filters')) { state.filter.round = b.getAttribute('data-round'); redrawList(); return; }
			if (b.hasAttribute('data-flag')) { var k = b.getAttribute('data-flag'); state.filter[k] = !state.filter[k]; redrawList(); return; }
			if (b.hasAttribute('data-edit')) {
				var q = state.questions.filter(function (x) { return x.id === b.getAttribute('data-edit'); })[0];
				var tr = b.closest('tr.qr');
				if (!q || !tr || tr.classList.contains('open')) { return; }
				tr.insertAdjacentHTML('afterend', '<tr class="editTr"><td colspan="' + tr.children.length + '">' + editor(q) + '</td></tr>');
				tr.classList.add('open');
				var first = tr.nextElementSibling.querySelector('input:checked') || tr.nextElementSibling.querySelector('input');
				if (first) { first.focus(); }
				return;
			}
			if (b.hasAttribute('data-cancel')) { var row = b.closest('tr.editTr'); if (row) { row.previousElementSibling.classList.remove('open'); row.remove(); } }
		});
		main.addEventListener('submit', function (e) { e.preventDefault(); saveEdit(e.target); });
	}
	function redrawList() {
		var list = document.getElementById('qList'), bar = document.querySelector('.filters');
		if (bar) { bar.outerHTML = filterBar(); }
		if (list) { list.innerHTML = questionList(); }
	}

	window.renderMatchReport = function (log, snap, questions, meta) {
		state.log = log || []; state.snap = snap || {}; state.questions = (questions || []).slice(); state.meta = meta || {};
		state.players = (state.snap.players || []).slice().sort(function (p, q) { return p.seat - q.seat; });
		document.title = 'Biên bản trận' + (state.meta.room ? ' ' + state.meta.room : '');
		wire();
		redrawQuestions();
		if (state.pending) {
			var q = state.questions.filter(function (x) { return x.id === state.pending; })[0];
			state.pending = null; clearTimeout(state.pendingTimer);
			if (q && q.edit) {
				var d = q.edit.lastPoints || [];
				toast('Đã lưu chỉnh sửa' + (d.length ? ': ' + d.map(function (c) { return seatShort(c.seat) + ' ' + signed(c.delta); }).join(', ') + '.' + (q.edit.rankSame ? ' Sự thay đổi điểm số này không ảnh hưởng tới thứ hạng của các thí sinh trong trận đấu.' : ' Thứ hạng các thí sinh đã thay đổi.') : ' (điểm không đổi).'));
			}
		}
	};
})();
