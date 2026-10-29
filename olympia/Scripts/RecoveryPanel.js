/*
 * Olympia Controller - "Phục hồi tiến trình khẩn cấp", control panel side.
 * The host describes where the show was; the stage (Scripts/Recovery.js) jumps there. Usable only
 * while the stage reports recoveryAllowed (a freshly opened stage: nothing played yet). The form
 * is built once from the first state and never overwritten by later states, so nothing typed is
 * lost; only names and the enabled state follow the stage. It opens as a dialog (#rcOpen).
 */
(function (gv) {
	var $ = function (s) { return document.querySelector(s); };
	var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
	var SEATS = [1, 2, 3, 4];
	var snap = null, built = false;

	function el(tag, cls, text) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (text !== undefined) { e.textContent = text; } return e; }
	function nameOf(seat) {
		var p = snap && (snap.players || []).filter(function (x) { return x.seat === seat; })[0];
		return seat + '. ' + (p ? p.displayName : 'Thí sinh ' + seat);
	}
	function options(select, list) {
		select.textContent = '';
		list.forEach(function (o) { var op = el('option', '', o[1]); op.value = String(o[0]); select.appendChild(op); });
	}
	function range(n) { var a = []; for (var i = 1; i <= n; i++) { a.push([i, String(i)]); } return a; }
	function radio(name, value, text) {
		var l = el('label'), i = el('input');
		i.type = 'radio'; i.name = name; i.value = value;
		l.appendChild(i); l.appendChild(document.createTextNode(' ' + text));
		return l;
	}
	function check(id, text) {
		var l = el('label', 'rcCheck'), i = el('input');
		i.type = 'checkbox'; i.id = id;
		l.appendChild(i); l.appendChild(document.createTextNode(' ' + text));
		return l;
	}
	function cell(seat, child) {
		var c = el('div', 'rcCell');
		var b = el('b', 'rcName', nameOf(seat)); b.setAttribute('data-seat', seat);
		c.appendChild(b); c.appendChild(child);
		return c;
	}
	function val(sel) { var e = $(sel); return e ? e.value : ''; }
	function checked(id) { var e = document.getElementById(id); return !!(e && e.checked); }
	function picked(name) { var e = document.querySelector('input[name="' + name + '"]:checked'); return e ? e.value : ''; }

	/* ---------- the form ---------- */

	function build() {
		var box;
		box = $('#rcScores');
		SEATS.forEach(function (s) {
			var p = (snap.players || []).filter(function (x) { return x.seat === s; })[0];
			var i = el('input'); i.type = 'number'; i.min = '0'; i.step = '5'; i.id = 'rcScore' + s; i.value = String(p ? p.score : 0);
			box.appendChild(cell(s, i));
		});
		box = $('#rcKdDone');
		SEATS.forEach(function (s) { box.appendChild(cell(s, check('rcKdDone' + s, 'Đã thi xong'))); });
		box = $('#rcVcnvOut');
		SEATS.forEach(function (s) { box.appendChild(cell(s, check('rcOut' + s, 'Bị loại'))); });
		box = $('#rcVdDone');
		SEATS.forEach(function (s) {
			var c = el('div', 'rcChoice');
			c.appendChild(radio('rcVdDone' + s, 'done', 'Đã thi xong'));
			c.appendChild(radio('rcVdDone' + s, 'todo', 'Chưa thi'));
			var holder = cell(s, c); holder.classList.add('vdCell'); holder.setAttribute('data-seat', s);
			box.appendChild(holder);
		});
		box = $('#rcTbSeats');
		SEATS.forEach(function (s) { box.appendChild(cell(s, check('rcTb' + s, 'Thi câu hỏi phụ'))); });
		box = $('#rcVcnvRows');
		['Hàng 1', 'Hàng 2', 'Hàng 3', 'Hàng 4', 'Ô trung tâm'].forEach(function (label, i) {
			var c = el('div', 'rcCell');
			c.appendChild(el('b', '', label));
			var s = el('select', 'rcVcnvRow'); s.setAttribute('data-n', i + 1);
			options(s, [['closed', 'Chưa mở'], ['correct', 'Đã trả lời đúng'], ['wrong', 'Không ai đúng']]);
			c.appendChild(s);
			box.appendChild(c);
		});
		var t = gv.Timings || {};
		options($('#rcKdQ'), range(t.KD_QUESTIONS_PER_PLAYER || 6));
		options($('#rcKdCommonQ'), range(t.KD_COMMON_QUESTIONS || 12));
		/* Olympia 23 (Rules.js): which of the three common turns - shown only under those rules */
		var turnLabel = el('label', 'rcO23Turn hidden', 'Lượt: ');
		var turnSel = el('select'); turnSel.id = 'rcKdTurn';
		options(turnSel, gv.RulesO23.KD_TURNS.map(function (n, i) { return [i + 1, 'Lượt ' + (i + 1) + ' (' + n + ' câu)']; }));
		turnLabel.appendChild(turnSel);
		var commonRow = $('#rcKdCommonQ').closest('.rcRow');
		commonRow.insertBefore(turnLabel, commonRow.firstChild);
		options($('#rcTtQ'), range((snap.roundState && snap.roundState.tt && snap.roundState.tt.count) || 4));
		options($('#rcTbQ'), range((snap.roundState && snap.roundState.tb && snap.roundState.tb.questionCount) || (t.TIEBREAK_MAX_QUESTIONS || 3)));
		seatSelects();
		$('#recoverySec').addEventListener('change', function () { refresh(true); });
		$('#recoverySec').addEventListener('input', function () { refresh(true); });
		$('#rcApply').addEventListener('click', apply);
		$('#rcSavedApply').addEventListener('click', applySaved);
		$('#rcOpen').addEventListener('click', function () { refresh(true); $('#rcDialog').showModal(); });
		$('#rcClose').addEventListener('click', function () { $('#rcDialog').close(); });
		built = true;
	}

	/* "who plays now" lists: KĐ only the seats still to play; VĐ automatic order or a seat */
	function seatSelects() {
		var kd = $('#rcKdSeat'), keepKd = kd.value;
		var todo = SEATS.filter(function (s) { return !checked('rcKdDone' + s); });
		options(kd, todo.length ? todo.map(function (s) { return [s, nameOf(s)]; }) : [['', '(cả 4 đã thi - chọn Lượt chung)']]);
		if (todo.map(String).indexOf(keepKd) !== -1) { kd.value = keepKd; }
		var vd = $('#rcVdSeat'), keepVd = vd.value;
		var vdTodo = SEATS.filter(function (s) { return picked('rcVdDone' + s) !== 'done'; });
		options(vd, [['', 'Tự động (điểm cao hơn thi trước)']].concat(vdTodo.map(function (s) { return [s, nameOf(s)]; })));
		if (vdTodo.map(String).indexOf(keepVd) !== -1) { vd.value = keepVd; }
	}

	function showPanes() {
		var r = picked('rcRound');
		$$('.recovery .rcPane').forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-r') === r); });
		/* Olympia 23: no individual turn - the common sub-pane with the turn picker */
		var o23 = gv.Rules === 'o23';
		var kdModes = $('.recovery .rcPane[data-r="kd"] > .rcChoice');
		if (kdModes) { kdModes.classList.toggle('hidden', o23); }
		$('.rcO23Turn').classList.toggle('hidden', !o23);
		if (o23) {
			var common = document.querySelector('input[name="rcKdMode"][value="common"]');
			if (common && !common.checked) { common.checked = true; }
			var n = gv.RulesO23.KD_TURNS[Number(val('#rcKdTurn')) - 1] || 8, q = $('#rcKdCommonQ'), keep = q.value;
			if (q.options.length !== n) { options(q, range(n)); if (Number(keep) <= n) { q.value = keep; } }
		}
		var m = picked('rcKdMode');
		$$('.recovery .rcPane[data-r="kd"] .rcSub').forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-m') === m); });
		$('#rcVdMidBox').classList.toggle('on', checked('rcVdMid'));
		$$('.recovery .vdCell').forEach(function (c) { c.classList.toggle('unset', !picked('rcVdDone' + c.getAttribute('data-seat'))); });
	}

	/* ---------- reading it: { args } or { error } ---------- */

	function collect() {
		var args = { round: picked('rcRound'), scores: {} };
		for (var i = 0; i < SEATS.length; i++) {
			var s = SEATS[i], v = Number(val('#rcScore' + s));
			if (!isFinite(v) || v < 0 || val('#rcScore' + s) === '') { return { error: 'Điểm của ' + nameOf(s) + ' chưa hợp lệ.' }; }
			args.scores[s] = Math.round(v);
		}
		if (args.round === 'kd') {
			var mode = picked('rcKdMode');
			if (gv.Rules === 'o23') { args.kd = { mode: 'common', turn: Number(val('#rcKdTurn')), question: Number(val('#rcKdCommonQ')) }; }
			else if (mode === 'common') { args.kd = { mode: 'common', question: Number(val('#rcKdCommonQ')) }; }
			else {
				var done = SEATS.filter(function (s) { return checked('rcKdDone' + s); });
				if (done.length === 4) { return { error: 'Cả 4 thí sinh đã thi xong lượt riêng - hãy chọn "Lượt chung".' }; }
				args.kd = { mode: 'individual', done: done, seat: Number(val('#rcKdSeat')), question: Number(val('#rcKdQ')) };
			}
		}
		else if (args.round === 'vcnv') {
			var rows = $$('.rcVcnvRow').map(function (s) { return s.value; });
			if (rows[4] !== 'closed' && rows.slice(0, 4).indexOf('closed') !== -1) { return { error: 'Ô trung tâm chỉ mở được sau khi cả 4 hàng ngang đã được hỏi.' }; }
			var out = SEATS.filter(function (s) { return checked('rcOut' + s); });
			if (out.length === 4) { return { error: 'Cả 4 thí sinh bị loại thì chướng ngại vật đã được mở - hãy chọn Tăng tốc.' }; }
			args.vcnv = { rows: rows.slice(0, 4), center: rows[4], eliminated: out };
		}
		else if (args.round === 'tt') { args.tt = { question: Number(val('#rcTtQ')) }; }
		else if (args.round === 'tb') {
			var tbSeats = SEATS.filter(function (s) { return checked('rcTb' + s); });
			if (!tbSeats.length) { tbSeats = gv.topScoreSeats(SEATS.map(function (s) { return { seat: s, score: args.scores[s] }; })); }
			if (tbSeats.length < 2) { return { error: 'Câu hỏi phụ cần ít nhất 2 thí sinh: chọn người thi, hoặc sửa điểm cho đúng (đang không có ai bằng điểm cao nhất).' }; }
			args.tb = { seats: tbSeats, question: Number(val('#rcTbQ')) };
		}
		else if (args.round === 'vd') {
			var unset = SEATS.filter(function (s) { return !picked('rcVdDone' + s); });
			if (unset.length) { return { error: 'Về đích: chưa xác định ' + unset.map(nameOf).join(', ') + ' đã thi xong hay chưa.' }; }
			var vdDone = SEATS.filter(function (s) { return picked('rcVdDone' + s) === 'done'; });
			args.vd = { done: vdDone, seat: val('#rcVdSeat') ? Number(val('#rcVdSeat')) : null };
			if (checked('rcVdMid') && vdDone.length < 4) {
				args.vd.midTurn = {
					values: $$('.rcVdVal').map(function (s) { return Number(s.value); }),
					question: Number(val('#rcVdQ')),
					star: val('#rcVdStar') || null
				};
				if (args.vd.midTurn.star && args.vd.midTurn.star !== 'used' && Number(args.vd.midTurn.star) < args.vd.midTurn.question) {
					args.vd.midTurn.star = 'used';   /* placed on a question already played */
				}
			}
		}
		return { args: args };
	}

	var ROUND_NAMES = { kd: 'Khởi động', vcnv: 'Vượt chướng ngại vật', tt: 'Tăng tốc', vd: 'Về đích', tb: 'Câu hỏi phụ' };
	var ROW_TEXT = { closed: 'chưa mở', correct: 'đúng', wrong: 'không ai đúng' };

	function summary(a) {
		var lines = ['Điểm: ' + SEATS.map(function (s) { return nameOf(s) + ' ' + a.scores[s]; }).join(' · ')];
		lines.push('Vòng: ' + ROUND_NAMES[a.round]);
		if (a.kd && a.kd.mode === 'common') { lines.push('Lượt chung, bắt đầu từ câu ' + a.kd.question + '. Màn sân khấu: ← hiện đồ hoạ, → ra câu ' + a.kd.question + '.'); }
		else if (a.kd) {
			lines.push('Lượt riêng. Đã thi xong: ' + (a.kd.done.length ? a.kd.done.map(nameOf).join(', ') : 'chưa ai') + '.');
			lines.push('Đang thi: ' + nameOf(a.kd.seat) + ', từ câu ' + a.kd.question + '. Màn sân khấu: ← hiện đồ hoạ, → ra câu ' + a.kd.question + '.');
		}
		if (a.vcnv) {
			lines.push('Hàng ngang: ' + a.vcnv.rows.map(function (r, i) { return (i + 1) + ' ' + ROW_TEXT[r]; }).join(' · ') + ' · ô trung tâm ' + ROW_TEXT[a.vcnv.center]);
			lines.push('Bị loại: ' + (a.vcnv.eliminated.length ? a.vcnv.eliminated.map(nameOf).join(', ') : 'không ai') + '. Màn sân khấu về bảng chướng ngại vật.');
		}
		if (a.tt) { lines.push('Bắt đầu lại từ câu ' + a.tt.question + ' (khung câu hỏi hiện sẵn; → bật đồng hồ).'); }
		if (a.tb) { lines.push('Thi câu hỏi phụ: ' + a.tb.seats.map(nameOf).join(', ') + ', từ câu ' + a.tb.question + '. Màn sân khấu: ← hiện đồ hoạ, → ra câu ' + a.tb.question + '.'); }
		if (a.vd) {
			lines.push('Đã thi xong: ' + (a.vd.done.length ? a.vd.done.map(nameOf).join(', ') : 'chưa ai') + '.');
			if (a.vd.done.length === 4) { lines.push('Cả 4 đã thi - vòng Về đích kết thúc.'); }
			else {
				lines.push('Thi tiếp: ' + (a.vd.seat ? nameOf(a.vd.seat) : 'theo thứ tự điểm (tự động)') + '.');
				if (a.vd.midTurn) {
					var st = a.vd.midTurn.star;
					lines.push('Giữa lượt: gói ' + a.vd.midTurn.values.join(' - ') + ', từ câu ' + a.vd.midTurn.question + ', ngôi sao ' + (st === 'used' ? 'đã dùng' : st ? 'ở câu ' + st : 'chưa dùng') + '. Màn sân khấu: khung câu hỏi trống, → hiện câu.');
				}
				else { lines.push('Đầu lượt: thí sinh được gọi lên; ← mở màn chọn gói.'); }
			}
		}
		return lines.join('\n');
	}

	/* ---------- state from the stage ---------- */

	/* fromForm: the host changed something (rebuild the seat lists); otherwise just a new state from
	 * the stage - rebuilding a <select> then would close it under the host's mouse */
	/* The panel follows one engine (StateSync.js). While it follows its OWN engine (EmbeddedStage.js)
	 * and a stage page has just been opened (nothing played on it), the recovery is meant for that
	 * stage: applying it ends the panel's engine first, so only the stage takes the command. */
	function freshStageWaiting() {
		var emb = window.OlympiaEmbeddedStage;
		if (!emb || !emb.running() || !gv.Sync.ignoredEngines) { return false; }
		return gv.Sync.ignoredEngines().some(function (e) { return !e.embedded && e.fresh; });
	}

	function refresh(fromForm) {
		if (!built) { return; }
		if (fromForm) { seatSelects(); }
		showPanes();
		$$('.recovery .rcName').forEach(function (b) { b.textContent = nameOf(Number(b.getAttribute('data-seat'))); });
		var waiting = freshStageWaiting();
		var allowed = !!(snap && snap.recoveryAllowed) || waiting;
		$('#rcState').textContent = !snap ? '— trận chưa chạy'
			: waiting ? '— dùng được cho màn sân khấu vừa mở (máy này sẽ dừng chạy trận)'
			: snap.progressRestored ? '— đã phục hồi; muốn làm lại thì dừng rồi chạy lại trận'
			: allowed ? '— dùng được (trận chưa bắt đầu thi)'
			: '— đã bắt đầu thi, không dùng được (dừng rồi chạy lại trận nếu cần)';
		var c = collect();
		$('#rcSummary').textContent = c.error ? c.error : summary(c.args);
		$('#rcApply').disabled = !allowed || !!c.error;
		var saved = snap && snap.savedGame;
		$('#rcSavedText').textContent = saved
			? ('Lúc ' + new Date(saved.at).toLocaleString('vi-VN') + ' — ' + saved.text)
			: 'Chưa có bản lưu tự động' + (snap && snap.recoveryAllowed ? '' : ' cho trận này') + '.';
		$('#rcSavedApply').disabled = !allowed || !saved;
		/* a clock was running when it was saved: it can run on from there */
		var clock = saved && saved.clock;
		$('#rcResumeBox').classList.toggle('hidden', !clock);
		if (clock) { $('#rcResumeText').textContent = 'Chạy tiếp đồng hồ đang dở (còn ' + clock.left + ' giây) - câu đó hiện lại và đồng hồ chạy tiếp ngay'; }
	}

	function applySaved() {
		var saved = snap && snap.savedGame;
		var waiting = freshStageWaiting();
		if (!saved || !(snap.recoveryAllowed || waiting)) { return; }
		if (!confirm('Khôi phục trận từ bản lưu tự động?\n\nLúc ' + new Date(saved.at).toLocaleString('vi-VN') + '\n' + saved.text +
			(waiting ? '\n\nTrận đang chạy trên máy này sẽ dừng; màn sân khấu vừa mở nhận tiến trình này.' : ''))) { return; }
		if (waiting) { window.OlympiaEmbeddedStage.stop('Đã chuyển trận sang màn sân khấu vừa mở (khôi phục từ bản lưu).'); }
		gv.Sync.sendCommand('restoreSaved', { resumeClock: !!(saved.clock && $('#rcResume').checked) });
		$('#rcSavedApply').disabled = true;
		$('#rcDialog').close();
	}

	function apply() {
		var c = collect();
		var waiting = freshStageWaiting();
		if (c.error || !(snap && snap.recoveryAllowed || waiting)) { return; }
		if (!confirm('Phục hồi tiến trình như sau?\n\n' + summary(c.args) + (waiting ? '\n\nTrận đang chạy trên máy này sẽ dừng; màn sân khấu vừa mở nhận tiến trình này.' : ''))) { return; }
		if (waiting) { window.OlympiaEmbeddedStage.stop('Đã chuyển trận sang màn sân khấu vừa mở (phục hồi tiến trình).'); }
		gv.Sync.sendCommand('restoreProgress', c.args);
		$('#rcApply').disabled = true;
		$('#rcDialog').close();
	}

	gv.Sync.on('state', function (s) {
		snap = s;
		if (!built && document.readyState !== 'loading') { build(); refresh(true); return; }
		refresh(false);
	});
	document.addEventListener('DOMContentLoaded', function () { if (snap && !built) { build(); refresh(true); } });
})(window.GameVariables);
