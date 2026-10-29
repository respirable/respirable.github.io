/*
 * Olympia Controller - "Thông báo & cập nhật" in the lobby (index.html), migrations/0013.
 *
 * Everyone who opens the lobby, signed in or not, can read the site owner's notices / updates /
 * bug fixes (table announcements). A red dot on the button means news newer than the last time
 * this browser opened the list (kept in localStorage - only a convenience).
 * An account in site_admins (is_site_admin) also gets an editor here: post, edit, delete. The site
 * owner can write the same rows in Supabase -> Table Editor -> announcements.
 * Every text goes in with textContent: an announcement is plain text, never HTML.
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
			if (n.body) { item.appendChild(el('p', 'newsBody', n.body)); }
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
		$('#newsSave').textContent = 'Lưu thay đổi';
		$('#newsCancel').classList.remove('hidden');
		$('#newsMsg').textContent = '';
		$('#newsTitle').focus();
	}
	function stopEdit() {
		editing = null;
		$('#newsEditor').reset();
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
		$('#newsCancel').addEventListener('click', stopEdit);
		load();
		checkAdmin();
		db().auth.onAuthStateChange(function () { setTimeout(checkAdmin, 0); });
		setInterval(load, 5 * 60 * 1000);   /* news posted while the lobby stays open */
	});
})();
