/*
 * Olympia Controller - "Thông báo & cập nhật" in the lobby (index.html), migrations/0013.
 *
 * Everyone who opens the lobby, signed in or not, can read the site owner's notices / updates /
 * bug fixes (table announcements). A red dot on the button means news newer than the last time
 * this browser opened the list (kept in localStorage - only a convenience).
 * An account in site_admins (is_site_admin) also gets an editor here: post, edit, delete. The site
 * owner can write the same rows in Supabase -> Table Editor -> announcements.
 * An announcement is stored as text with a small markup (the editor's toolbar writes it):
 *   **bold**  *italic*  __underline__  ~~strike~~  [text](https://…)
 *   a line "# …" heading, "- …" list item, "![alt](https://…)" picture, "!video(https://…)" video
 * renderNews() builds the page from it node by node with textContent - never innerHTML - and only
 * takes https addresses; a YouTube link becomes a youtube-nocookie player of a checked video id.
 * Pictures / videos can also be uploaded to the public "news" bucket (migrations/0014).
 */
(function () {
	var $ = function (s) { return document.querySelector(s); };
	var SEEN_KEY = 'olympia.newsSeen';
	var KIND_NAMES = { notice: 'Thông báo', update: 'Cập nhật', fix: 'Sửa lỗi' };
	var items = [], admin = false, editing = null;

	function db() { return window.OlympiaAuth && window.OlympiaAuth.client; }
	function seenAt() { try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch (e) { return 0; } }
	function markSeen() {
		var newest = items.length ? Date.parse(items[0].published_at) : 0;
		try { if (newest) { localStorage.setItem(SEEN_KEY, String(newest)); } } catch (e) { /* private window */ }
	}
	function el(tag, cls, text) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (text !== undefined) { e.textContent = text; } return e; }
	function fmt(t) { try { return new Date(t).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return String(t); } }

	/* ---------- the markup -> DOM (safe: textContent, https only) ---------- */

	function httpsUrl(u) {
		try { var x = new URL(String(u || '').trim()); return x.protocol === 'https:' ? x.href : null; } catch (e) { return null; }
	}
	function youTubeId(u) {
		var m = /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#]|$)/.exec(u || '');
		return m ? m[1] : null;
	}
	/* bold / italic / underline / strike / link, nested; anything else is text */
	var INLINE = [
		{ re: /\*\*([\s\S]+?)\*\*/, tag: 'b' },
		{ re: /__([\s\S]+?)__/, tag: 'u' },
		{ re: /~~([\s\S]+?)~~/, tag: 's' },
		{ re: /\*([^*\n]+?)\*/, tag: 'i' },
		{ re: /\[([^\]\n]+)\]\(([^)\s]+)\)/, tag: 'a' }
	];
	function inline(text, parent) {
		while (text) {
			var best = null;
			INLINE.forEach(function (r) { var m = r.re.exec(text); if (m && (!best || m.index < best.m.index)) { best = { m: m, r: r }; } });
			if (!best) { parent.appendChild(document.createTextNode(text)); return; }
			if (best.m.index) { parent.appendChild(document.createTextNode(text.slice(0, best.m.index))); }
			if (best.r.tag === 'a') {
				var href = httpsUrl(best.m[2]);
				if (href) { var a = el('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; inline(best.m[1], a); parent.appendChild(a); }
				else { parent.appendChild(document.createTextNode(best.m[0])); }
			}
			else { var e = el(best.r.tag); inline(best.m[1], e); parent.appendChild(e); }
			text = text.slice(best.m.index + best.m[0].length);
		}
	}
	function mediaNode(kind, url, alt) {
		var src = httpsUrl(url);
		if (!src) { return null; }
		if (kind === 'image') { var img = el('img'); img.src = src; img.alt = alt || ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; return img; }
		var yt = youTubeId(src);
		if (yt) {
			var f = el('iframe'); f.src = 'https://www.youtube-nocookie.com/embed/' + yt; f.title = 'Video';
			f.setAttribute('allow', 'encrypted-media; picture-in-picture; fullscreen'); f.setAttribute('allowfullscreen', '');
			f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups'); f.referrerPolicy = 'strict-origin-when-cross-origin'; f.loading = 'lazy';
			return f;
		}
		var v = el('video'); v.src = src; v.controls = true; v.preload = 'metadata'; v.playsInline = true; return v;
	}
	function renderNews(text) {
		var root = el('div', 'newsBody'), list = null, para = null;
		String(text || '').replace(/\r\n?/g, '\n').split('\n').forEach(function (line) {
			var m;
			if ((m = /^\s*!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(line)) || (m = /^\s*!video\(([^)\s]+)\)\s*$/.exec(line))) {
				var node = m.length === 3 ? mediaNode('image', m[2], m[1]) : mediaNode('video', m[1]);
				list = para = null;
				if (node) { root.appendChild(node); } else { para = el('p'); inline(line, para); root.appendChild(para); para = null; }
				return;
			}
			if ((m = /^\s*#{1,3}\s+(.+)$/.exec(line))) { list = para = null; var h = el('h3'); inline(m[1], h); root.appendChild(h); return; }
			if ((m = /^\s*[-•]\s+(.+)$/.exec(line))) {
				para = null;
				if (!list) { list = el('ul'); root.appendChild(list); }
				var li = el('li'); inline(m[1], li); list.appendChild(li); return;
			}
			list = null;
			if (!line.trim()) { para = null; return; }
			if (para) { para.appendChild(document.createTextNode('\n')); } else { para = el('p'); root.appendChild(para); }
			inline(line, para);
		});
		return root;
	}
	window.OlympiaNewsRender = renderNews;   /* for tests */

	/* ---------- the editor's toolbar ---------- */

	function wrapSelection(before, after, placeholder) {
		var t = $('#newsBody'), a = t.selectionStart, b = t.selectionEnd, v = t.value;
		var inner = v.slice(a, b) || placeholder;
		t.value = v.slice(0, a) + before + inner + after + v.slice(b);
		t.focus(); t.setSelectionRange(a + before.length, a + before.length + inner.length);
		preview();
	}
	function prefixLines(prefix) {
		var t = $('#newsBody'), v = t.value;
		var a = v.lastIndexOf('\n', t.selectionStart - 1) + 1, b = v.indexOf('\n', t.selectionEnd); if (b === -1) { b = v.length; }
		var block = v.slice(a, b).split('\n').map(function (l) { return l.indexOf(prefix) === 0 ? l : prefix + l; }).join('\n');
		t.value = v.slice(0, a) + block + v.slice(b);
		t.focus(); t.setSelectionRange(a, a + block.length);
		preview();
	}
	function insertBlock(line) {
		var t = $('#newsBody'), v = t.value, at = t.selectionEnd;
		var pre = (at > 0 && v[at - 1] !== '\n') ? '\n' : '', post = (v[at] && v[at] !== '\n') ? '\n' : '';
		t.value = v.slice(0, at) + pre + line + '\n' + post + v.slice(at);
		var pos = at + pre.length + line.length + 1;
		t.focus(); t.setSelectionRange(pos, pos);
		preview();
	}
	function format(kind) {
		if (kind === 'bold') { wrapSelection('**', '**', 'chữ đậm'); }
		else if (kind === 'italic') { wrapSelection('*', '*', 'chữ nghiêng'); }
		else if (kind === 'underline') { wrapSelection('__', '__', 'chữ gạch chân'); }
		else if (kind === 'strike') { wrapSelection('~~', '~~', 'chữ gạch ngang'); }
		else if (kind === 'heading') { prefixLines('# '); }
		else if (kind === 'list') { prefixLines('- '); }
		else if (kind === 'link') { wrapSelection('[', '](https://)', 'chữ hiển thị'); }
	}
	function preview() {
		var box = $('#newsPreview');
		box.replaceWith(Object.assign(renderNews($('#newsBody').value), { id: 'newsPreview' }));
	}

	/* picture / video: an https address or an upload to the "news" bucket */
	var mediaKind = 'image';
	function openMedia(kind) {
		mediaKind = kind;
		$('#newsMediaTitle').textContent = kind === 'image' ? 'Chèn ảnh' : 'Chèn video';
		$('#newsMediaHint').textContent = kind === 'image' ? '' : ' - YouTube, hoặc file .mp4 / .webm';
		$('#newsMediaFile').accept = kind === 'image' ? 'image/png,image/jpeg,image/gif,image/webp' : 'video/mp4,video/webm';
		$('#newsMediaAltBox').classList.toggle('hidden', kind !== 'image');
		$('#newsMediaUrl').value = ''; $('#newsMediaFile').value = ''; $('#newsMediaAlt').value = ''; $('#newsMediaMsg').textContent = '';
		$('#newsMedia').classList.remove('hidden');
		$('#newsMediaUrl').focus();
	}
	function fileKey(name) {
		return String(name || 'file').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/[^A-Za-z0-9._-]+/g, '_').toLowerCase().slice(-80);
	}
	async function insertMedia() {
		var url = $('#newsMediaUrl').value.trim(), file = $('#newsMediaFile').files[0];
		if (file) {
			if (file.size > 50 * 1024 * 1024) { $('#newsMediaMsg').textContent = 'File lớn hơn 50 MB.'; return; }
			$('#newsMediaMsg').textContent = 'Đang tải lên...';
			$('#newsMediaInsert').disabled = true;
			var s = await db().auth.getSession(), uid = (s.data && s.data.session && s.data.session.user.id) || 'admin';
			var path = uid + '/' + Date.now().toString(36) + '-' + fileKey(file.name);
			var up = await db().storage.from('news').upload(path, file, { contentType: file.type, upsert: false });
			$('#newsMediaInsert').disabled = false;
			if (up.error) { $('#newsMediaMsg').textContent = 'Không tải lên được: ' + (/bucket/i.test(up.error.message) ? 'cần chạy supabase/migrations/0014_news_media.sql. ' : '') + up.error.message; return; }
			url = db().storage.from('news').getPublicUrl(path).data.publicUrl;
		}
		if (!httpsUrl(url)) { $('#newsMediaMsg').textContent = 'Cần một địa chỉ https:// hoặc một file.'; return; }
		var alt = $('#newsMediaAlt').value.replace(/[\[\]\n]/g, ' ').trim();
		insertBlock(mediaKind === 'image' ? '![' + alt + '](' + httpsUrl(url) + ')' : '!video(' + httpsUrl(url) + ')');
		$('#newsMedia').classList.add('hidden');
	}

	async function load() {
		var c = db();
		if (!c) { return; }
		var r = await c.from('announcements').select('id, kind, title, body, published_at').order('published_at', { ascending: false }).limit(50);
		if (r.error) { items = []; $('#newsOpen').classList.toggle('hidden', r.error.code === '42P01'); return; }   /* 42P01: 0013 not run yet */
		items = r.data || [];
		var seen = seenAt(), now = Date.now();
		$('#newsDot').classList.toggle('hidden', !items.some(function (n) { var t = Date.parse(n.published_at); return t > seen && t <= now; }));
		if ($('#newsDialog').open) { render(); }
	}

	function render() {
		var list = $('#newsList'), seen = seenAt(), now = Date.now();
		list.textContent = '';
		$('#newsEmpty').classList.toggle('hidden', items.length > 0);
		items.forEach(function (n) {
			var t = Date.parse(n.published_at);
			var item = el('article', 'newsItem' + (t > seen ? ' unread' : '') + (t > now ? ' scheduled' : ''));
			var head = el('div', 'newsItemHead');
			head.appendChild(el('span', 'newsKind ' + n.kind, KIND_NAMES[n.kind] || n.kind));
			head.appendChild(el('b', '', n.title));
			head.appendChild(el('span', 'meta', (t > now ? 'Hẹn đăng ' : '') + fmt(n.published_at)));
			item.appendChild(head);
			if (n.body) { item.appendChild(renderNews(n.body)); }
			if (admin) {
				var act = el('div', 'newsActions');
				var edit = el('button', 'btn sm', 'Sửa'); edit.type = 'button';
				edit.addEventListener('click', function () { startEdit(n); });
				var del = el('button', 'btn sm danger', 'Xoá'); del.type = 'button';
				del.addEventListener('click', async function () {
					if (!del.classList.contains('armed')) { del.classList.add('armed'); del.textContent = 'Bấm lần nữa để xoá'; return; }
					var r = await db().from('announcements').delete().eq('id', n.id);
					$('#newsMsg').textContent = r.error ? ('Không xoá được: ' + r.error.message) : 'Đã xoá.';
					if (editing && editing.id === n.id) { stopEdit(); }
					load();
				});
				act.appendChild(edit); act.appendChild(del);
				item.appendChild(act);
			}
			list.appendChild(item);
		});
	}

	function startEdit(n) {
		editing = n;
		$('#newsKind').value = n.kind; $('#newsTitle').value = n.title; $('#newsBody').value = n.body || '';
		preview();
		$('#newsSave').textContent = 'Lưu thay đổi';
		$('#newsCancel').classList.remove('hidden');
		$('#newsMsg').textContent = '';
		$('#newsTitle').focus();
	}
	function stopEdit() {
		editing = null;
		$('#newsEditor').reset();
		$('#newsMedia').classList.add('hidden');
		preview();
		$('#newsSave').textContent = 'Đăng tin';
		$('#newsCancel').classList.add('hidden');
	}

	async function save(ev) {
		ev.preventDefault();
		var row = { kind: $('#newsKind').value, title: $('#newsTitle').value.trim(), body: $('#newsBody').value.trim() };
		if (!row.title) { $('#newsMsg').textContent = 'Cần có tiêu đề.'; return; }
		$('#newsSave').disabled = true;
		var r = editing ? await db().from('announcements').update(row).eq('id', editing.id) : await db().from('announcements').insert(row);
		$('#newsSave').disabled = false;
		if (r.error) { $('#newsMsg').textContent = 'Không lưu được: ' + r.error.message; return; }
		$('#newsMsg').textContent = editing ? 'Đã lưu.' : 'Đã đăng.';
		stopEdit();
		await load();
		markSeen();
	}

	/* the editor only for an account in site_admins (the database checks every write anyway) */
	async function checkAdmin() {
		var c = db(), was = admin;
		admin = false;
		if (c) {
			var s = await c.auth.getSession();
			var session = s.data && s.data.session;
			if (session && !(session.user && session.user.is_anonymous)) {
				var r = await c.rpc('is_site_admin');
				admin = !r.error && r.data === true;
			}
		}
		$('#newsEditor').classList.toggle('hidden', !admin);
		if (admin !== was && $('#newsDialog').open) { render(); }
	}

	document.addEventListener('DOMContentLoaded', function () {
		if (!db()) { $('#newsOpen').classList.add('hidden'); return; }
		$('#newsOpen').addEventListener('click', function () {
			render();
			$('#newsDialog').showModal();
			markSeen();
			$('#newsDot').classList.add('hidden');
		});
		$('#newsDialog').addEventListener('close', function () { render(); });
		$('#newsEditor').addEventListener('submit', save);
		document.querySelectorAll('#newsTools [data-fmt]').forEach(function (b) { b.addEventListener('click', function () { format(b.getAttribute('data-fmt')); }); });
		document.querySelectorAll('#newsTools [data-media]').forEach(function (b) { b.addEventListener('click', function () { openMedia(b.getAttribute('data-media')); }); });
		$('#newsMediaInsert').addEventListener('click', insertMedia);
		$('#newsMediaCancel').addEventListener('click', function () { $('#newsMedia').classList.add('hidden'); });
		$('#newsBody').addEventListener('input', preview);
		$('#newsBody').addEventListener('keydown', function (e) {
			if (!(e.ctrlKey || e.metaKey)) { return; }
			var k = { b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()];
			if (k) { e.preventDefault(); format(k); }
		});
		$('#newsCancel').addEventListener('click', stopEdit);
		load();
		checkAdmin();
		db().auth.onAuthStateChange(function () { setTimeout(checkAdmin, 0); });
		setInterval(load, 5 * 60 * 1000);   /* news posted while the lobby stays open */
	});
})();
