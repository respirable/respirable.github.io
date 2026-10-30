/*
 * Olympia Controller - question manager (questions.html?room=CODE), managers only.
 *
 * The manager's question sets live in the private Storage bucket "sets" (migrations/0006) as the
 * same XML files the stage reads (khoidong.xml, vcnv.xml, tangtoc.xml, vedich.xml, cauhoiphu.xml,
 * players.xml) plus pictures / videos. This page:
 *   - picks / creates (blank, or from an uploaded folder) / renames / deletes a set,
 *     and sets the room's set ("Dùng cho phòng này"),
 *   - reads the set's XML into forms - one tab per round - and writes the XML back on "Lưu bộ đề",
 *   - uploads / removes the set's pictures and videos; Tăng tốc and VCNV pick them by file name.
 * File names are stored as keys without accents or spaces (same rule as QuestionSet.js on the
 * stage). Every text goes into the page with textContent / value only.
 */
(function () {
	var auth = window.OlympiaAuth;
	var db = auth && auth.client;
	var $ = function (s) { return document.querySelector(s); };
	function show(el, on) { el.classList.toggle('hidden', !on); }
	function el(tag, cls, text) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (text !== undefined) { e.textContent = text; } return e; }

	var XML = { players: 'players.xml', kd: 'khoidong.xml', vcnv: 'vcnv.xml', tt: 'tangtoc.xml', vd: 'vedich.xml', tb: 'cauhoiphu.xml' };
	var TYPES = { xml: 'text/xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', ogg: 'audio/ogg' };
	var COUNTS = { kdOwn: 6, kdCommon: 12, tt: 4, vdEach: 3, tb: 3 };
	var TT_SECONDS = [20, 20, 30, 30];
	/* Olympia 23 (Rules.js): Khởi động = three common turns taken in order from <common>, Tăng tốc
	 * clocks fixed. The model always holds both layouts; `rules` only picks the forms shown. */
	var O23 = { kdTurns: [8, 12, 16], ttSeconds: [10, 20, 30, 40] };
	var KD_COMMON_MAX = O23.kdTurns.reduce(function (a, b) { return a + b; }, 0);
	/* Luật rừng (Rules.js): 12 individual questions + 4 bonus ones per seat, two common turns of 8 / 16 */
	var JUNGLE = { own: 12, bonus: 4, kdTurns: [8, 16], ttSeconds: [30, 30, 30, 30] };
	var KD_OWN_MAX = JUNGLE.own + JUNGLE.bonus;
	var RULE_NAMES = { o24: 'Olympia 24 + 26', o23: 'Olympia 23', jungle: 'luật rừng' };
	var VCNV_MAX = 10;
	var DEFAULT_VCNV_IMAGE = 'O24/VCNV Image.png';

	var uid = '', room = null, sets = [], set = null, model = null, saved = '', busy = false, rules = 'o24';

	/* ---------- small helpers ---------- */

	function fileKey(name) {
		return String(name || '').split(/[\\/]/).pop().normalize('NFD').replace(/[̀-ͯ]/g, '')
			.replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9._-]+/g, '_').toLowerCase();
	}
	function ext(name) { var m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; }
	function isMedia(key) { return !!TYPES[ext(key)] && ext(key) !== 'xml'; }
	function mediaKind(key) { var t = TYPES[ext(key)] || ''; return t.split('/')[0]; }
	function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
	function fmtTime(iso) { try { return new Date(iso).toLocaleString('vi-VN'); } catch (e) { return iso; } }
	function path(key) { return uid + '/' + set.id + '/' + key; }
	function letters(s) { return String(s || '').replace(/\s+/g, '').length; }
	function q() { return { text: '', answer: '' }; }
	function filled(x) { return !!(String(x.text || '').trim() || String(x.answer || '').trim()); }
	function fill(list, n) { list = (list || []).slice(0, n); while (list.length < n) { list.push(q()); } return list; }
	function setError(t) { $('#error').textContent = t || ''; }
	function progress(t) { $('#progress').textContent = t || ''; }

	/* ---------- XML -> model ---------- */

	function parse(text) {
		if (!text) { return null; }
		var doc = new DOMParser().parseFromString(text, 'application/xml');
		return doc.querySelector('parsererror') ? null : doc;
	}
	function txt(node, sel) { var n = node && (sel ? node.querySelector(sel) : node); return n ? n.textContent.trim() : ''; }
	function qOf(node) { return node ? { text: txt(node, 'text') || (node.querySelector('text') ? '' : txt(node)), answer: txt(node, 'answer') } : q(); }

	function modelFrom(docs) {
		var m = { players: [], kd: { individual: {}, common: [] }, vcnv: null, tt: [], vd: {}, tb: [] };
		var d = docs.players;
		[1, 2, 3, 4].forEach(function (s) {
			var p = d && d.querySelector('player[seat="' + s + '"]');
			m.players.push({ seat: s, name: txt(p, 'name') || ('Thí sinh ' + s), school: txt(p, 'school') });
		});
		d = docs.kd;
		[1, 2, 3, 4].forEach(function (s) {
			var b = d && d.querySelector('individual[seat="' + s + '"]');
			m.kd.individual[s] = fill(b ? Array.prototype.map.call(b.querySelectorAll('question'), qOf) : [], KD_OWN_MAX);
		});
		var c = d && d.querySelector('common');
		m.kd.common = fill(c ? Array.prototype.map.call(c.querySelectorAll('question'), qOf) : [], KD_COMMON_MAX);
		d = docs.vcnv;
		m.vcnv = {
			keyword: (d && (txt(d.querySelector('keyword'), 'text') || txt(d.querySelector('keyword')))) || '',
			image: (d && txt(d.querySelector('image'))) || DEFAULT_VCNV_IMAGE,
			rows: fill(d ? Array.prototype.map.call(d.querySelectorAll('row'), qOf) : [], 4),
			center: qOf(d && d.querySelector('center'))
		};
		d = docs.tt;
		var tts = d ? Array.prototype.slice.call(d.querySelectorAll('question')) : [];
		for (var i = 0; i < COUNTS.tt; i++) {
			var n = tts[i], me = n && n.querySelector('media'), am = n && n.querySelector('answerMedia');
			var secs = n ? parseFloat(n.getAttribute('seconds')) : NaN;
			m.tt.push({
				text: txt(n, 'text'), answer: txt(n, 'answer'), seconds: secs > 0 ? secs : TT_SECONDS[i],
				media: { type: (me && me.getAttribute('type')) || 'image', src: txt(me) },
				answerMedia: { type: (am && am.getAttribute('type')) || 'image', src: txt(am) }
			});
		}
		d = docs.vd;
		[1, 2, 3, 4].forEach(function (s) {
			var pk = d && d.querySelector('package[seat="' + s + '"]');
			var all = pk ? Array.prototype.slice.call(pk.querySelectorAll('question')) : [];
			m.vd[s] = {
				20: fill(all.filter(function (x) { return x.getAttribute('value') === '20'; }).map(qOf), COUNTS.vdEach),
				30: fill(all.filter(function (x) { return x.getAttribute('value') === '30'; }).map(qOf), COUNTS.vdEach)
			};
		});
		d = docs.tb;
		m.tb = fill(d ? Array.prototype.map.call(d.querySelectorAll('question'), qOf) : [], COUNTS.tb);
		return m;
	}

	/* ---------- model -> XML (same layout as the files in Questions/) ---------- */

	function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
	function head(comment) { return '<?xml version="1.0" encoding="utf-8"?>\n<!--\n  ' + comment.replace(/--/g, '-') + '\n  Sửa bằng trang Quản lý câu hỏi (questions.html).\n-->\n'; }
	function qXml(x, tag, attrs) { return '<' + tag + (attrs || '') + '><text>' + esc(x.text) + '</text><answer>' + esc(x.answer) + '</answer></' + tag + '>'; }

	function toXml(m) {
		var out = {};
		out.players = head('Thí sinh. seat = vị trí đứng 1..4. Tên hiển thị trên đồ hoạ = 2 từ cuối của <name>.') + '<players>\n' +
			m.players.map(function (p) { return '  <player seat="' + p.seat + '">\n    <name>' + esc(p.name) + '</name>\n    <school>' + esc(p.school) + '</school>\n  </player>\n'; }).join('') + '</players>\n';
		/* <common>: at least the 12 of Olympia 24 + 26, up to the last question written (Olympia 23: 36) */
		var last = 0;
		m.kd.common.forEach(function (x, i) { if (filled(x)) { last = i + 1; } });
		var common = m.kd.common.slice(0, Math.max(COUNTS.kdCommon, last));
		/* <individual>: at least the 6 of Olympia 24 + 26, up to the last question written (Luật rừng: 12 + 4 bonus) */
		function own(s) { var n = 0; m.kd.individual[s].forEach(function (x, i) { if (filled(x)) { n = i + 1; } }); return m.kd.individual[s].slice(0, Math.max(COUNTS.kdOwn, n)); }
		out.kd = head('Khởi động. <individual seat="N">: lượt riêng của ghế N - Olympia 24 + 26 dùng 6 câu đầu; luật rừng dùng 12 câu + câu 13-16 là câu bổ sung. <common>: lượt chung - Olympia 24 + 26 dùng 12 câu đầu; Olympia 23 dùng 36 câu: 1-8 lượt 1, 9-20 lượt 2, 21-36 lượt 3; luật rừng dùng 24 câu: 1-8 lượt 1, 9-24 lượt 2.') + '<khoidong>\n' +
			[1, 2, 3, 4].map(function (s) { return '  <individual seat="' + s + '">\n' + own(s).map(function (x) { return '    ' + qXml(x, 'question') + '\n'; }).join('') + '  </individual>\n'; }).join('') +
			'  <common>\n' + common.map(function (x) { return '    ' + qXml(x, 'question') + '\n'; }).join('') + '  </common>\n</khoidong>\n';
		out.vcnv = head('Vượt chướng ngại vật. <keyword>: chướng ngại vật. <image>: ảnh sau 5 miếng che. 4 <row> + <center>.') + '<vcnv>\n' +
			'  <keyword><text>' + esc(m.vcnv.keyword) + '</text></keyword>\n  <image>' + esc(m.vcnv.image) + '</image>\n' +
			m.vcnv.rows.map(function (x) { return '  ' + qXml(x, 'row') + '\n'; }).join('') + '  ' + qXml(m.vcnv.center, 'center') + '\n</vcnv>\n';
		out.tt = head('Tăng tốc. 4 câu; seconds = thời gian (luật Olympia 23 luôn 10/20/30/40 giây, luật rừng luôn 30 giây); <media> ảnh / video của câu; <answerMedia> ảnh đáp án (tuỳ chọn).') + '<tangtoc>\n' +
			m.tt.map(function (x) {
				return '  <question seconds="' + (Number(x.seconds) || 20) + '">\n    <text>' + esc(x.text) + '</text>\n' +
					(x.media.src ? '    <media type="' + (x.media.type === 'video' ? 'video' : 'image') + '">' + esc(x.media.src) + '</media>\n' : '') +
					(x.answerMedia.src ? '    <answerMedia type="image">' + esc(x.answerMedia.src) + '</answerMedia>\n' : '') +
					'    <answer>' + esc(x.answer) + '</answer>\n  </question>\n';
			}).join('') + '</tangtoc>\n';
		out.vd = head('Về đích. Mỗi <package seat="N">: 3 câu value="20" và 3 câu value="30".') + '<vedich>\n' +
			[1, 2, 3, 4].map(function (s) {
				return '  <package seat="' + s + '">\n' + [20, 30].map(function (v) { return m.vd[s][v].map(function (x) { return '    ' + qXml(x, 'question', ' value="' + v + '"') + '\n'; }).join(''); }).join('') + '  </package>\n';
			}).join('') + '</vedich>\n';
		out.tb = head('Câu hỏi phụ. Tối đa 3 câu, hỏi lần lượt.') + '<cauhoiphu>\n' + m.tb.map(function (x) { return '  ' + qXml(x, 'question') + '\n'; }).join('') + '</cauhoiphu>\n';
		return out;
	}

	/* ---------- dirty tracking ---------- */

	function snapshot() { return JSON.stringify(model); }
	function touched() {
		var dirty = !!model && snapshot() !== saved;
		$('#saveState').textContent = dirty ? 'Có thay đổi chưa lưu.' : 'Đã lưu - không có thay đổi.';
		$('#saveBar').classList.toggle('dirty', dirty);
		$('#save').disabled = !dirty || busy;
		$('#revert').disabled = !dirty || busy;
		return dirty;
	}
	window.addEventListener('beforeunload', function (e) { if (model && snapshot() !== saved) { e.preventDefault(); e.returnValue = ''; } });

	/* ---------- form builders ---------- */

	function textField(label, obj, key, opts) {
		opts = opts || {};
		var l = el('label', 'fld' + (opts.cls ? ' ' + opts.cls : ''));
		l.appendChild(document.createTextNode(label));
		var i = el(opts.area ? 'textarea' : 'input');
		if (!opts.area) { i.type = opts.type || 'text'; }
		if (opts.area) { i.rows = opts.rows || 2; }
		if (opts.min !== undefined) { i.min = String(opts.min); }
		i.value = obj[key] === undefined || obj[key] === null ? '' : String(obj[key]);
		var hint = opts.count ? el('small', 'count') : null;
		function update() {
			if (!hint) { return; }
			var n = letters(i.value);
			hint.textContent = n + ' chữ' + (n > VCNV_MAX ? ' - quá ' + VCNV_MAX + ', chỉ hiện ' + VCNV_MAX + ' chữ đầu' : '');
			hint.classList.toggle('warn', n > VCNV_MAX);
		}
		i.addEventListener('input', function () { obj[key] = opts.type === 'number' ? Number(i.value) : i.value; update(); touched(); if (rules !== 'o24') { renderRules(); } if (opts.onInput) { opts.onInput(); } });
		l.appendChild(i);
		if (hint) { l.appendChild(hint); update(); }
		return l;
	}

	function questionRow(num, x, opts) {
		opts = opts || {};
		var row = el('div', 'qRow');
		row.appendChild(el('span', 'qNum', num));
		row.appendChild(textField('Câu hỏi', x, 'text', { area: true, cls: 'grow' }));
		row.appendChild(textField('Đáp án', x, 'answer', { cls: 'ans', count: opts.count, onInput: opts.onAnswer }));
		return row;
	}

	function block(title, note) {
		var b = el('div', 'block');
		b.appendChild(el('h3', '', title));
		if (note) { b.appendChild(el('p', 'meta', note)); }
		return b;
	}

	function playerName(s) { var p = model.players[s - 1]; return 'Ghế ' + s + (p && p.name ? ' · ' + p.name : ''); }

	/* ---------- previews: the set's files through short-lived signed links ---------- */

	var signed = {};   /* key -> { url, at } */
	var SIGN_SECONDS = 3600;

	/* a src from the XML -> something an <img> / <video> can show: the set's file (signed), or a
	 * path of this site ("O24/VCNV Image.png") as it is */
	async function previewUrl(src) {
		if (!src) { return ''; }
		var key = fileKey(src);
		if (!(set.files || []).some(function (f) { return f.key === key; })) { return src; }
		var c = signed[set.id + '/' + key];
		if (c && Date.now() - c.at < (SIGN_SECONDS - 120) * 1000) { return c.url; }
		var r = await db.storage.from('sets').createSignedUrl(path(key), SIGN_SECONDS);
		if (r.error || !r.data) { return ''; }
		signed[set.id + '/' + key] = { url: r.data.signedUrl, at: Date.now() };
		return r.data.signedUrl;
	}

	/* fills `box` with the picture / video of src (muted video with controls) */
	async function showPreview(box, src, empty) {
		var ask = box.__ask = (box.__ask || 0) + 1;
		box.textContent = '';
		if (!src) { box.appendChild(el('span', 'meta', empty || 'Chưa chọn ảnh / video.')); box.classList.add('empty'); return; }
		box.classList.remove('empty');
		var url = await previewUrl(src);
		if (ask !== box.__ask) { return; }   /* another file was picked meanwhile */
		box.textContent = '';
		if (!url) { box.appendChild(el('span', 'meta', 'Không xem trước được file này.')); return; }
		var m;
		if (mediaKind(src) === 'video') { m = el('video'); m.muted = true; m.controls = true; m.preload = 'metadata'; m.playsInline = true; }
		else { m = el('img'); m.alt = ''; }
		m.addEventListener('error', function () { box.textContent = ''; box.appendChild(el('span', 'meta', 'Không mở được ' + src + '.')); });
		m.src = url;
		box.appendChild(m);
	}

	/* a picture / video of the set (or a path of the site), with "upload a new one" and a preview */
	function mediaPicker(label, obj, kinds, opts) {
		opts = opts || {};
		var wrap = el('div', 'fld media');
		var l = el('label');
		l.appendChild(document.createTextNode(label));
		wrap.appendChild(l);
		var line = el('div', 'mediaLine');
		var preview = opts.preview === false ? null : el('div', 'preview');
		function refresh() { if (preview) { showPreview(preview, obj.src, opts.empty); } if (opts.onChange) { opts.onChange(); } }
		var sel = el('select');
		function options() {
			sel.textContent = '';
			var none = el('option', '', '(không có)'); none.value = ''; sel.appendChild(none);
			var keys = mediaFiles().map(function (f) { return f.key; }).filter(function (k) { return kinds.indexOf(mediaKind(k)) !== -1; });
			if (obj.src && keys.indexOf(fileKey(obj.src)) === -1) { var o0 = el('option', '', obj.src + ' (file của trang web)'); o0.value = obj.src; sel.appendChild(o0); }
			keys.forEach(function (k) { var o = el('option', '', k); o.value = k; sel.appendChild(o); });
			sel.value = obj.src ? (keys.indexOf(fileKey(obj.src)) !== -1 ? fileKey(obj.src) : obj.src) : '';
		}
		options();
		sel.addEventListener('change', function () {
			obj.src = sel.value;
			if ('type' in obj) { obj.type = mediaKind(sel.value) === 'video' ? 'video' : 'image'; }
			touched();
			refresh();
		});
		var up = el('input'); up.type = 'file'; up.accept = kinds.indexOf('video') !== -1 ? 'image/*,video/mp4,video/webm' : 'image/*';
		up.className = 'hidden';
		var upBtn = el('button', 'btn sm', 'Tải lên…'); upBtn.type = 'button';
		upBtn.addEventListener('click', function () { up.click(); });
		up.addEventListener('change', async function () {
			if (!up.files.length) { return; }
			var key = await uploadMedia(up.files[0]);
			up.value = '';
			if (!key) { return; }
			obj.src = key;
			if ('type' in obj) { obj.type = mediaKind(key) === 'video' ? 'video' : 'image'; }
			delete signed[set.id + '/' + key];   /* a replaced file: sign it again */
			options();
			touched();
			refresh();
			renderMedia();
		});
		line.appendChild(sel); line.appendChild(upBtn); line.appendChild(up);
		l.appendChild(line);
		if (preview) { wrap.appendChild(preview); }
		refresh();
		return wrap;
	}

	/* ---------- the tabs ---------- */

	function renderPlayers() {
		var p = $('#paneplayers'); p.textContent = '';
		var b = block('Thí sinh', 'Tên hiển thị trên đồ hoạ là 2 từ cuối của họ tên. Tên sửa trên bàn điều khiển (trước Khởi động) vẫn được ưu tiên trên máy đó.');
		var grid = el('div', 'grid4');
		model.players.forEach(function (pl) {
			var c = el('div', 'cell');
			c.appendChild(el('b', '', 'Ghế ' + pl.seat));
			c.appendChild(textField('Họ tên', pl, 'name'));
			c.appendChild(textField('Trường', pl, 'school'));
			grid.appendChild(c);
		});
		b.appendChild(grid);
		p.appendChild(b);
	}

	/* the common turns of O23 / Luật rừng: Lượt 1 — 8 câu ... (questions in order from <common>) */
	function commonTurnBlocks(p, sizes) {
		var from = 0;
		sizes.forEach(function (n, t) {
			var b = block('Lượt ' + (t + 1) + ' — ' + n + ' câu', 'Câu ' + (from + 1) + '–' + (from + n) + ' của lượt chung, bấm chuông giành quyền.');
			model.kd.common.slice(from, from + n).forEach(function (x, i) { b.appendChild(questionRow(String(from + i + 1), x)); });
			p.appendChild(b);
			from += n;
		});
	}

	function renderKd() {
		var p = $('#panekd'); p.textContent = '';
		if (rules === 'jungle') {
			[1, 2, 3, 4].forEach(function (s) {
				var b = block('Lượt riêng — ' + playerName(s), JUNGLE.own + ' câu trong 60 giây, hỏi theo thứ tự; mỗi 3 câu đúng liên tiếp được thêm 1 câu bổ sung (tối đa ' + JUNGLE.bonus + ').');
				model.kd.individual[s].slice(0, JUNGLE.own).forEach(function (x, i) { b.appendChild(questionRow(String(i + 1), x)); });
				b.appendChild(el('p', 'sub', 'Câu bổ sung (chỉ hỏi khi giành được và còn giờ)'));
				model.kd.individual[s].slice(JUNGLE.own, KD_OWN_MAX).forEach(function (x, i) { b.appendChild(questionRow('+' + (i + 1), x)); });
				p.appendChild(b);
			});
			commonTurnBlocks(p, JUNGLE.kdTurns);
			var extra = model.kd.common.slice(24).filter(filled).length;
			if (extra) { p.appendChild(el('p', 'meta', 'Bộ đề còn ' + extra + ' câu lượt chung cho luật Olympia 23 (câu 25–' + KD_COMMON_MAX + ') - luật rừng không dùng.')); }
			return;
		}
		if (rules === 'o23') {
			commonTurnBlocks(p, O23.kdTurns);
			p.appendChild(el('p', 'meta', 'Luật Olympia 23 không có lượt riêng. Câu lượt riêng đã soạn (nếu có) vẫn được giữ trong bộ đề - chuyển sang "Olympia 24 + 26" ở trên để xem.'));
			return;
		}
		[1, 2, 3, 4].forEach(function (s) {
			var b = block('Lượt riêng — ' + playerName(s), COUNTS.kdOwn + ' câu, hỏi theo thứ tự.');
			model.kd.individual[s].slice(0, COUNTS.kdOwn).forEach(function (x, i) { b.appendChild(questionRow(String(i + 1), x)); });
			p.appendChild(b);
		});
		var c = block('Lượt chung', COUNTS.kdCommon + ' câu, bấm chuông giành quyền.');
		model.kd.common.slice(0, COUNTS.kdCommon).forEach(function (x, i) { c.appendChild(questionRow(String(i + 1), x)); });
		p.appendChild(c);
		var more = model.kd.common.slice(COUNTS.kdCommon).filter(filled).length;
		if (more) { p.appendChild(el('p', 'meta', 'Bộ đề còn ' + more + ' câu lượt chung cho luật Olympia 23 / luật rừng (câu 13–' + KD_COMMON_MAX + ') - luật này không dùng, chuyển luật ở trên để xem.')); }
		var ownMore = [1, 2, 3, 4].reduce(function (n, s) { return n + model.kd.individual[s].slice(COUNTS.kdOwn).filter(filled).length; }, 0);
		if (ownMore) { p.appendChild(el('p', 'meta', 'Bộ đề còn ' + ownMore + ' câu lượt riêng cho luật rừng (câu 7–' + KD_OWN_MAX + ' mỗi ghế) - luật này không dùng, chuyển sang "Luật rừng" ở trên để xem.')); }
	}

	function renderVcnv() {
		var p = $('#panevcnv'); p.textContent = '';
		var v = model.vcnv;
		var b = block('Chướng ngại vật', 'Đáp án hàng ngang được đếm theo chữ (không tính khoảng trắng), tối đa ' + VCNV_MAX + ' ô.');

		/* what the board will look like: the picture under its 5 covers + the rows' letters */
		var look = el('div', 'vcnvLook');
		var pic = el('div', 'vcnvPic');
		var picImg = el('div', 'preview bare');
		pic.appendChild(picImg);
		/* the stage's own cover pictures, at the stage's places (olympia.css .vcnvCoverN / Middle) */
		var covers = el('div', 'covers');
		[['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['m', 'middle']].forEach(function (c) {
			var cv = el('span', 'cover c' + c[0]);
			var im = el('img'); im.alt = ''; im.src = 'O24/Beat the Obstacle/Obstacle/picture_frame_' + c[1] + '.png';
			cv.appendChild(im);   /* the frames carry their own numbers */
			covers.appendChild(cv);
		});
		pic.appendChild(covers);
		var coverToggle = el('label', 'coverToggle');
		var cb = el('input'); cb.type = 'checkbox'; cb.checked = false;
		cb.addEventListener('change', function () { pic.classList.toggle('covered', cb.checked); });
		coverToggle.appendChild(cb); coverToggle.appendChild(document.createTextNode(' Hiện 5 miếng che (như trên sân khấu lúc đầu vòng)'));
		var board = el('div', 'vcnvBoard');
		function drawBoard() {
			board.textContent = '';
			var kw = el('div', 'kw');
			kw.appendChild(el('span', 'meta', 'Chướng ngại vật: '));
			kw.appendChild(el('b', '', v.keyword || '—'));
			kw.appendChild(el('span', 'meta', ' · ' + letters(v.keyword) + ' chữ'));
			board.appendChild(kw);
			v.rows.forEach(function (x, i) {
				var row = el('div', 'bRow');
				row.appendChild(el('span', 'bNum', String(i + 1)));
				var chars = String(x.answer || '').replace(/\s+/g, '').split('');
				chars.slice(0, VCNV_MAX).forEach(function (ch) { row.appendChild(el('span', 'bCell', ch.toUpperCase())); });
				if (!chars.length) { row.appendChild(el('span', 'meta', '(chưa có đáp án)')); }
				if (chars.length > VCNV_MAX) { row.appendChild(el('span', 'bMore', '+' + (chars.length - VCNV_MAX))); }
				board.appendChild(row);
			});
			var c = el('div', 'bRow center');
			c.appendChild(el('span', 'bNum', 'TT'));
			c.appendChild(el('span', 'meta', (v.center.answer || '(chưa có đáp án)')));
			board.appendChild(c);
		}
		look.appendChild(el('div', 'lookCol')).appendChild(pic);
		look.firstChild.appendChild(coverToggle);
		look.appendChild(board);

		var top = el('div', 'grid2');
		top.appendChild(textField('Chướng ngại vật (từ khoá)', v, 'keyword', { onInput: drawBoard }));
		/* the picker writes .src: it is the model's image (empty -> the site's default picture) */
		var img = {};
		Object.defineProperty(img, 'src', { get: function () { return v.image; }, set: function (x) { v.image = x || DEFAULT_VCNV_IMAGE; } });
		top.appendChild(mediaPicker('Ảnh sau 5 miếng che', img, ['image'], { preview: false, onChange: function () { showPreview(picImg, v.image); } }));
		b.appendChild(top);
		b.appendChild(look);
		v.rows.forEach(function (x, i) { b.appendChild(questionRow('H' + (i + 1), x, { count: true, onAnswer: drawBoard })); });
		b.appendChild(questionRow('TT', v.center, { onAnswer: drawBoard }));
		p.appendChild(b);
		drawBoard();
	}

	function renderTt() {
		var p = $('#panett'); p.textContent = '';
		if (rules === 'o23') { p.appendChild(el('p', 'meta', 'Luật Olympia 23: thời gian 4 câu luôn là 10 / 20 / 30 / 40 giây. Thời gian ghi trong bộ đề chỉ dùng cho luật Olympia 24 + 26.')); }
		if (rules === 'jungle') { p.appendChild(el('p', 'meta', 'Luật rừng: mỗi câu luôn 30 giây; điểm theo tốc độ 25 / 10 / −5 / −20, sai hoặc không trả lời −20. Thời gian ghi trong bộ đề chỉ dùng cho luật Olympia 24 + 26.')); }
		model.tt.forEach(function (x, i) {
			var b = block('Câu ' + (i + 1));
			var r = el('div', 'grid3');
			if (rules !== 'o24') {
				var fixed = el('label', 'fld');
				fixed.appendChild(document.createTextNode('Thời gian (giây)'));
				var f = el('input'); f.type = 'text'; f.value = (rules === 'o23' ? O23 : JUNGLE).ttSeconds[i] + ' (cố định)'; f.disabled = true;
				fixed.appendChild(f);
				r.appendChild(fixed);
			}
			else { r.appendChild(textField('Thời gian (giây)', x, 'seconds', { type: 'number', min: 5 })); }
			r.appendChild(mediaPicker('Ảnh / video câu hỏi', x.media, ['image', 'video'], { empty: 'Câu này không có ảnh / video - khung nội dung để trống.' }));
			r.appendChild(mediaPicker('Ảnh đáp án (tuỳ chọn)', x.answerMedia, ['image'], { empty: 'Không có ảnh đáp án.' }));
			b.appendChild(r);
			b.appendChild(questionRow(String(i + 1), x));
			p.appendChild(b);
		});
	}

	function renderVd() {
		var p = $('#panevd'); p.textContent = '';
		[1, 2, 3, 4].forEach(function (s) {
			var b = block('Gói câu hỏi — ' + playerName(s), 'Câu 20 điểm thứ k / câu 30 điểm thứ k được lấy theo thứ tự thí sinh chọn.');
			[20, 30].forEach(function (v) {
				b.appendChild(el('p', 'sub', v + ' điểm'));
				model.vd[s][v].forEach(function (x, i) { b.appendChild(questionRow(v + '·' + (i + 1), x)); });
			});
			p.appendChild(b);
		});
	}

	function renderTb() {
		var p = $('#panetb'); p.textContent = '';
		var b = block('Câu hỏi phụ', 'Tối đa ' + COUNTS.tb + ' câu, chỉ dùng khi có từ hai thí sinh bằng điểm cao nhất.');
		model.tb.forEach(function (x, i) { b.appendChild(questionRow(String(i + 1), x)); });
		p.appendChild(b);
	}

	function mediaFiles() { return ((set && set.files) || []).filter(function (f) { return isMedia(f.key); }); }

	function renderMedia() {
		var p = $('#panemedia'); p.textContent = '';
		var b = block('Ảnh / video của bộ đề', 'Tải lên ở đây hoặc ngay tại ô chọn ảnh của Tăng tốc / VCNV. Mỗi file tối đa 50 MB.');
		var up = el('input'); up.type = 'file'; up.multiple = true; up.accept = 'image/*,video/mp4,video/webm,audio/mpeg,audio/ogg';
		var upBtn = el('button', 'btn', 'Tải lên ảnh / video…'); upBtn.type = 'button';
		upBtn.addEventListener('click', function () { up.click(); });
		up.className = 'hidden';
		up.addEventListener('change', async function () {
			for (var i = 0; i < up.files.length; i++) { await uploadMedia(up.files[i]); }
			up.value = '';
			renderAll(false);
		});
		b.appendChild(upBtn); b.appendChild(up);
		var list = el('div', 'mediaList');
		var files = mediaFiles();
		if (!files.length) { list.appendChild(el('p', 'meta', 'Chưa có ảnh / video nào.')); }
		files.forEach(function (f) {
			var row = el('div', 'mediaItem');
			var thumb = el('div', 'preview thumb');
			row.appendChild(thumb);
			if (mediaKind(f.key) === 'image' || mediaKind(f.key) === 'video') { showPreview(thumb, f.key); } else { thumb.appendChild(el('span', 'meta', mediaKind(f.key))); }
			row.appendChild(el('code', '', f.key));
			row.appendChild(el('span', 'meta', mediaKind(f.key) + ' · ' + fmtSize(f.size || 0) + (inUse(f.key) ? ' · đang dùng' : '')));
			var del = el('button', 'btn sm danger', 'Xoá'); del.type = 'button';
			del.addEventListener('click', function () { removeMedia(f.key); });
			row.appendChild(del);
			list.appendChild(row);
		});
		b.appendChild(list);
		p.appendChild(b);
	}

	function inUse(key) {
		var used = [fileKey(model.vcnv.image)];
		model.tt.forEach(function (x) { used.push(fileKey(x.media.src), fileKey(x.answerMedia.src)); });
		return used.indexOf(key) !== -1;
	}

	/* ---------- which rules the forms follow ---------- */

	/* the set: a 7th+ individual question written -> Luật rừng; 13+ common questions and no
	 * individual one -> Olympia 23 */
	function guessRules(m) {
		var own = [1, 2, 3, 4].some(function (s) { return m.kd.individual[s].some(filled); });
		if ([1, 2, 3, 4].some(function (s) { return m.kd.individual[s].slice(COUNTS.kdOwn).some(filled); })) { return 'jungle'; }
		return !own && m.kd.common.slice(COUNTS.kdCommon).some(filled) ? 'o23' : 'o24';
	}

	/* Khởi động questions the rules need and the set lacks: { miss, of } (bonus questions optional) */
	function kdMissing(m, r) {
		function blanks(list) { return list.filter(function (x) { return !filled(x); }).length; }
		if (r === 'o23') { return { miss: blanks(m.kd.common), of: KD_COMMON_MAX }; }
		if (r === 'jungle') {
			var turns = JUNGLE.kdTurns[0] + JUNGLE.kdTurns[1];
			var miss = blanks(m.kd.common.slice(0, turns)) + [1, 2, 3, 4].reduce(function (n, s) { return n + blanks(m.kd.individual[s].slice(0, JUNGLE.own)); }, 0);
			return { miss: miss, of: turns + 4 * JUNGLE.own };
		}
		return { miss: 0, of: 0 };
	}

	function renderRules() {
		document.querySelectorAll('#qeRules input').forEach(function (i) { i.checked = i.value === rules; });
		var note = '';
		if (room && room.rules) { note = 'Phòng ' + room.code + ' chơi ' + (room.rules === 'jungle' ? 'luật rừng (BETA)' : 'luật ' + (RULE_NAMES[room.rules] || RULE_NAMES.o24)) + '.'; }
		if (rules !== 'o24' && model) {
			var k = kdMissing(model, rules);
			if (k.miss) { note += (note ? ' ' : '') + 'Khởi động còn thiếu ' + k.miss + ' / ' + k.of + ' câu' + (rules === 'jungle' ? ' (không tính câu bổ sung)' : '') + '.'; }
		}
		$('#qeRulesNote').textContent = note;
	}

	function setRules(r) {
		rules = RULE_NAMES[r] ? r : 'o24';
		renderRules();
		if (model) { renderKd(); renderTt(); }
	}

	function renderAll(keepTab) {
		renderPlayers(); renderKd(); renderVcnv(); renderTt(); renderVd(); renderTb(); renderMedia(); renderRules();
		if (!keepTab) { touched(); }
	}

	function showTab(t) {
		document.querySelectorAll('#tabs .tab').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-t') === t); });
		document.querySelectorAll('.pane').forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-t') === t); });
		try { sessionStorage.setItem('olympia.qeTab', t); } catch (e) { /* ignore */ }
	}

	/* ---------- storage ---------- */

	async function readSetXml(s) {
		var docs = {};
		var keys = (s.files || []).map(function (f) { return f.key; });
		await Promise.all(Object.keys(XML).map(async function (k) {
			if (keys.indexOf(XML[k]) === -1) { return; }
			var r = await db.storage.from('sets').download(uid + '/' + s.id + '/' + XML[k]);
			if (!r.error && r.data) { docs[k] = parse(await r.data.text()); }
		}));
		return docs;
	}

	/* the set row's file list: replace / add entries */
	async function recordFiles(entries, removedKeys) {
		var list = (set.files || []).filter(function (f) {
			return entries.every(function (e) { return e.key !== f.key; }) && (removedKeys || []).indexOf(f.key) === -1;
		}).concat(entries);
		var r = await db.from('question_sets').update({ files: list }).eq('id', set.id);
		if (r.error) { throw new Error(r.error.message); }
		set.files = list;
	}

	async function uploadMedia(file) {
		var key = fileKey(file.name);
		if (!isMedia(key)) { alert('Không dùng được loại file này: ' + file.name); return null; }
		if (file.size > 50 * 1048576) { alert('File quá 50 MB: ' + file.name); return null; }
		if ((set.files || []).some(function (f) { return f.key === key; }) && !confirm('Bộ đề đã có file "' + key + '". Thay bằng file mới?')) { return null; }
		progress('Đang tải lên ' + file.name + '...');
		var up = await db.storage.from('sets').upload(path(key), file, { upsert: true, contentType: TYPES[ext(key)] });
		if (up.error) { progress(''); setError('Không tải lên được ' + file.name + ': ' + up.error.message); return null; }
		try { await recordFiles([{ name: file.name, key: key, size: file.size, type: TYPES[ext(key)] }]); }
		catch (e) { setError(e.message); return null; }
		progress('Đã tải lên ' + key + '.');
		return key;
	}

	async function removeMedia(key) {
		if (!confirm('Xoá file "' + key + '" khỏi bộ đề?' + (inUse(key) ? ' File đang được dùng trong câu hỏi - nhớ chọn file khác.' : ''))) { return; }
		var r = await db.storage.from('sets').remove([path(key)]);
		if (r.error) { setError(r.error.message); return; }
		try { await recordFiles([], [key]); } catch (e) { setError(e.message); }
		renderAll(true);
		touched();
	}

	async function saveSet() {
		if (busy || !model) { return; }
		busy = true; touched(); setError('');
		try {
			var xml = toXml(model), entries = [];
			var keys = Object.keys(xml);
			for (var i = 0; i < keys.length; i++) {
				var name = XML[keys[i]];
				progress('Đang lưu ' + name + '...');
				var blob = new Blob([xml[keys[i]]], { type: 'text/xml' });
				var up = await db.storage.from('sets').upload(path(name), blob, { upsert: true, contentType: 'text/xml' });
				if (up.error) { throw new Error(name + ': ' + up.error.message); }
				entries.push({ name: name, key: name, size: blob.size, type: 'text/xml' });
			}
			await recordFiles(entries);
			saved = snapshot();
			progress('Đã lưu bộ đề lúc ' + new Date().toLocaleTimeString('vi-VN') + '. Màn sân khấu dùng bộ đề này sẽ nhận câu hỏi mới khi tải lại.');
		}
		catch (e) { setError('Không lưu được: ' + e.message); progress(''); }
		busy = false; touched();
		renderSetInfo();
	}

	/* ---------- the sets ---------- */

	function renderSetList() {
		var sel = $('#setSelect');
		sel.textContent = '';
		if (!sets.length) { var o = el('option', '', '(chưa có bộ đề - tạo mới ở bên phải)'); o.value = ''; sel.appendChild(o); }
		sets.forEach(function (s) {
			var o = el('option', '', (s.name || '(không tên)') + (room && room.question_set_id === s.id ? '  ✓ phòng ' + room.code : ''));
			o.value = s.id; sel.appendChild(o);
		});
		sel.value = set ? set.id : '';
	}

	function renderSetInfo() {
		show($('#setInfo'), !!set);
		show($('#useForRoom'), !!(room && set));
		renderRoomSet();
		if (!set) { return; }
		var using = room && room.question_set_id === set.id;
		$('#setMeta').textContent = (set.files || []).length + ' file · tạo lúc ' + fmtTime(set.created_at) +
			(room ? (using ? ' · đang dùng cho phòng ' + room.code : ' · phòng ' + room.code + ' đang dùng ' + roomSetName()) : '');
		if (!room) { return; }   /* opened without a room: no "use for room" */
		$('#useForRoom').disabled = using;
		$('#useForRoom').textContent = using ? 'Đang dùng cho phòng ' + room.code : 'Dùng cho phòng ' + room.code;
	}

	/* what the room plays: a set of the manager's, the test set (Demo/, migrations/0016), or nothing */
	function roomSetName() {
		if (room.question_set_id) {
			var s = sets.filter(function (x) { return x.id === room.question_set_id; })[0];
			return s ? 'bộ đề "' + (s.name || '(không tên)') + '"' : 'bộ đề khác';
		}
		return room.demo_set ? 'bộ đề thử nghiệm' : 'chưa có bộ đề nào - mọi câu hỏi sẽ báo "chưa thiết lập"';
	}

	function renderRoomSet() {
		show($('#demoBar'), !!room);
		if (!room) { return; }
		$('#roomSetLine').textContent = 'Phòng ' + room.code + ' đang dùng: ' + roomSetName() + '.';
		$('#useDemo').disabled = !!room.demo_set && !room.question_set_id;
		$('#useDemo').textContent = $('#useDemo').disabled ? 'Đang dùng bộ đề thử nghiệm' : 'Dùng bộ đề thử nghiệm';
	}

	async function loadSets(selectId) {
		var r = await db.from('question_sets').select('id, name, files, created_at').order('created_at', { ascending: false });
		if (r.error) {
			$('#notice').textContent = 'Chưa dùng được bộ đề trên máy chủ: hãy chạy supabase/migrations/0006_question_sets_and_saves.sql trong SQL Editor (' + r.error.message + ').';
			show($('#notice'), true);
			document.querySelectorAll('.setBar button').forEach(function (b) { b.disabled = true; });
			return false;
		}
		sets = r.data || [];
		var pickId = selectId || (set && set.id) || (room && room.question_set_id) || (sets[0] && sets[0].id);
		await openSet(sets.filter(function (s) { return s.id === pickId; })[0] || null);
		return true;
	}

	async function openSet(s) {
		set = s;
		renderSetList();
		renderSetInfo();
		show($('#editor'), !!s);
		show($('#saveBar'), !!s);
		if (!s) { model = null; return; }
		progress('Đang đọc bộ đề...');
		model = modelFrom(await readSetXml(s));
		saved = snapshot();
		rules = room && RULE_NAMES[room.rules] ? room.rules : guessRules(model);
		progress('');
		renderAll(false);
	}

	async function createSet(name, docs) {
		var ins = await db.from('question_sets').insert({ name: String(name).slice(0, 80) }).select('id, name, files, created_at').single();
		if (ins.error) { setError('Không tạo được bộ đề: ' + ins.error.message); return; }
		sets.unshift(ins.data);
		set = ins.data;
		model = modelFrom(docs);
		saved = '';
		await saveSet();
		await loadSets(ins.data.id);
	}

	function askName(dflt) {
		var n = prompt('Tên bộ đề:', dflt || '');
		return n === null ? null : (n.trim() || dflt || 'Bộ đề mới');
	}

	function confirmLeave() { return !(model && snapshot() !== saved) || confirm('Bộ đề đang sửa có thay đổi chưa lưu. Bỏ các thay đổi đó?'); }

	async function onUpload(ev) {
		ev.preventDefault();
		setError('');
		var name = $('#upName').value.trim();
		var picked = Array.prototype.slice.call($('#upFiles').files || []);
		var files = [], seen = {}, skipped = [];
		picked.forEach(function (f) {
			var key = fileKey(f.name);
			if (!TYPES[ext(key)]) { skipped.push(f.name); return; }
			if (seen[key]) { skipped.push(f.name + ' (trùng tên)'); return; }
			if (f.size > 50 * 1048576) { skipped.push(f.name + ' (quá 50 MB)'); return; }
			seen[key] = true;
			files.push({ file: f, key: key });
		});
		var missing = ['khoidong.xml', 'vcnv.xml', 'tangtoc.xml', 'vedich.xml'].filter(function (k) { return !seen[k]; });
		if (!name) { setError('Hãy đặt tên bộ đề.'); return; }
		if (missing.length) { setError('Thư mục chưa có: ' + missing.join(', ') + '.'); return; }
		if (!confirmLeave()) { return; }
		$('#upBtn').disabled = true;
		var ins = await db.from('question_sets').insert({ name: name.slice(0, 80) }).select('id').single();
		if (ins.error) { setError('Không tạo được bộ đề: ' + ins.error.message); $('#upBtn').disabled = false; return; }
		var id = ins.data.id, done = [], failed = '';
		for (var i = 0; i < files.length && !failed; i++) {
			var f = files[i];
			progress('Đang tải ' + (i + 1) + ' / ' + files.length + ': ' + f.file.name);
			var up = await db.storage.from('sets').upload(uid + '/' + id + '/' + f.key, f.file, { upsert: true, contentType: TYPES[ext(f.key)] });
			if (up.error) { failed = f.file.name + ': ' + up.error.message; break; }
			done.push({ name: f.file.name, key: f.key, size: f.file.size, type: TYPES[ext(f.key)] });
		}
		if (failed) {
			if (done.length) { await db.storage.from('sets').remove(done.map(function (d) { return uid + '/' + id + '/' + d.key; })); }
			await db.from('question_sets').delete().eq('id', id);
			setError('Tải lên thất bại - ' + failed); progress('');
		}
		else {
			await db.from('question_sets').update({ files: done }).eq('id', id);
			progress('Đã tải lên ' + done.length + ' file' + (skipped.length ? ' · bỏ qua: ' + skipped.join(', ') : '') + '.');
			$('#upName').value = ''; $('#upFiles').value = '';
			show($('#uploadForm'), false);
			model = null;
			await loadSets(id);
		}
		$('#upBtn').disabled = false;
	}

	/* ---------- start ---------- */

	async function start() {
		if (!db) { $('#notice').textContent = 'Không tải được thư viện Supabase - kiểm tra kết nối mạng.'; show($('#notice'), true); return; }
		var s = await auth.requireManager();
		if (!s) { return; }
		uid = s.user.id;
		$('#whoName').textContent = s.user.email || '';
		var code = (new URLSearchParams(location.search).get('room') || '').trim().toUpperCase();
		if (/^[A-Z0-9]{4,12}$/.test(code)) {
			var r = await db.from('rooms').select('code, name, question_set_id, rules, demo_set').eq('code', code).maybeSingle();
			if (r.error) { r = await db.from('rooms').select('code, name, question_set_id, rules').eq('code', code).maybeSingle(); }   /* before 0016 */
			if (r.error) { r = await db.from('rooms').select('code, name, question_set_id').eq('code', code).maybeSingle(); }   /* before 0013 */
			if (r.data) { room = r.data; }
		}
		$('#roomLine').textContent = room ? ('Phòng ' + room.code + (room.name ? ' · ' + room.name : '')) : 'Không gắn với phòng nào - mở từ nút "Quản lý câu hỏi" của một phòng để chọn bộ đề cho phòng đó.';
		document.title = 'Quản lý câu hỏi' + (room ? ' · ' + room.code : '') + ' — Olympia Controller';

		$('#openGuide').addEventListener('click', function () { $('#guideDialog').showModal(); });
		$('#closeGuide').addEventListener('click', function () { $('#guideDialog').close(); });
		document.querySelectorAll('#tabs .tab').forEach(function (b) { b.addEventListener('click', function () { showTab(b.getAttribute('data-t')); }); });
		var tab = 'kd';
		try { tab = sessionStorage.getItem('olympia.qeTab') || 'kd'; } catch (e) { /* ignore */ }
		showTab(tab);

		$('#setSelect').addEventListener('change', function () {
			var id = $('#setSelect').value;
			if (!confirmLeave()) { $('#setSelect').value = set ? set.id : ''; return; }
			openSet(sets.filter(function (x) { return x.id === id; })[0] || null);
		});
		$('#newBlank').addEventListener('click', function () {
			if (!confirmLeave()) { return; }
			var n = askName('Bộ đề mới'); if (n === null) { return; }
			createSet(n, {});
		});
		$('#showUpload').addEventListener('click', function () { show($('#uploadForm'), $('#uploadForm').classList.contains('hidden')); });
		$('#uploadForm').addEventListener('submit', onUpload);
		$('#useForRoom').addEventListener('click', async function () {
			if (!room || !set) { return; }
			var lack = model && room.rules && room.rules !== 'o24' ? kdMissing(model, room.rules) : { miss: 0 };
			if (lack.miss && !confirm('Phòng ' + room.code + ' chơi ' + (room.rules === 'jungle' ? 'luật rừng' : 'luật Olympia 23') + ' nhưng Khởi động của bộ đề này còn thiếu ' + lack.miss + ' / ' + lack.of + ' câu. Vẫn dùng bộ đề này?')) { return; }
			var r = await db.rpc('set_room_question_set', { p_code: room.code, p_set: set.id });
			if (r.error || r.data === false) { setError('Không đổi được bộ đề của phòng: ' + (r.error ? r.error.message : 'không có quyền')); return; }
			room.question_set_id = set.id;
			room.demo_set = false;
			renderSetList(); renderSetInfo();
			progress('Phòng ' + room.code + ' sẽ dùng bộ đề "' + (set.name || '') + '" - tải lại màn sân khấu để áp dụng.');
		});
		$('#useDemo').addEventListener('click', async function () {
			if (!room) { return; }
			setError('');
			var r = await db.rpc('set_room_demo_set', { p_code: room.code });
			if (r.error && r.error.code === 'PGRST202') { setError('Chưa dùng được bộ đề thử nghiệm: hãy chạy supabase/migrations/0016_demo_question_set.sql trong SQL Editor.'); return; }
			if (r.error || r.data === false) { setError('Không đổi được bộ đề của phòng: ' + (r.error ? r.error.message : 'chỉ chủ phòng mới đổi được')); return; }
			room.question_set_id = null;
			room.demo_set = true;
			renderSetList(); renderSetInfo();
			progress('Phòng ' + room.code + ' sẽ dùng bộ đề thử nghiệm - tải lại màn sân khấu để áp dụng.');
		});
		$('#renameSet').addEventListener('click', async function () {
			if (!set) { return; }
			var n = askName(set.name); if (n === null) { return; }
			var r = await db.from('question_sets').update({ name: n.slice(0, 80) }).eq('id', set.id);
			if (r.error) { setError(r.error.message); return; }
			set.name = n.slice(0, 80);
			renderSetList();
		});
		$('#deleteSet').addEventListener('click', async function () {
			if (!set || !confirm('Xoá hẳn bộ đề "' + (set.name || '') + '" và mọi file của nó? Phòng đang dùng bộ đề này sẽ không còn bộ đề nào (mọi câu hỏi báo "chưa thiết lập").')) { return; }
			var paths = (set.files || []).map(function (f) { return path(f.key); });
			if (paths.length) { var rm = await db.storage.from('sets').remove(paths); if (rm.error) { setError(rm.error.message); return; } }
			var r = await db.from('question_sets').delete().eq('id', set.id);
			if (r.error) { setError(r.error.message); return; }
			if (room && room.question_set_id === set.id) { room.question_set_id = null; }
			model = null; saved = ''; set = null;
			await loadSets();
		});
		document.querySelectorAll('#qeRules input').forEach(function (i) { i.addEventListener('change', function () { if (i.checked) { setRules(i.value); } }); });
		$('#save').addEventListener('click', saveSet);
		$('#revert').addEventListener('click', function () {
			if (!confirm('Bỏ mọi thay đổi chưa lưu?')) { return; }
			model = JSON.parse(saved); renderAll(false);
		});
		await loadSets();
	}

	start();
})();
