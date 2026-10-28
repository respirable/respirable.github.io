/*
 * Olympia Controller - lobby (index.html): manager sign-in, rooms, links, seats.
 * Every value from the database goes into the page with textContent only.
 */
(function () {
	var auth = window.OlympiaAuth;
	var db = auth && auth.client;
	var $ = function (s) { return document.querySelector(s); };

	function show(el, on) { el.classList.toggle('hidden', !on); }
	function notice(text) { $('#notice').textContent = text || ''; show($('#notice'), !!text); }

	/* only a page of this site may be the "next" target (no open redirect) */
	function safeNext() {
		var n = new URLSearchParams(location.search).get('next') || '';
		return /^(control|default|player|questions)\.html(\?[A-Za-z0-9=&_-]*)?$/.test(n) ? n : '';
	}

	function pageUrl(page, code) {
		var u = new URL(page, location.href);
		u.search = '';
		u.searchParams.set('room', code);
		return u.href;
	}

	/* Google / email redirects come back with ?error=... or #error=... */
	function errorFromRedirect() {
		var q = new URLSearchParams(location.search), h = new URLSearchParams(location.hash.replace(/^#/, ''));
		var d = q.get('error_description') || h.get('error_description') || q.get('error') || h.get('error');
		return d ? auth.messageFor(d) : '';
	}

	/* ---------- sign in ---------- */

	async function onLogin(ev) {
		ev.preventDefault();
		$('#loginError').textContent = '';
		$('#loginBtn').disabled = true;
		try {
			await auth.signIn($('#login').value, $('#password').value);
			$('#password').value = '';
			await route();
		}
		catch (e) { $('#loginError').textContent = e.message; }
		finally { $('#loginBtn').disabled = false; }
	}

	async function onGoogle() {
		$('#loginError').textContent = '';
		try { await auth.signInWithGoogle(); }
		catch (e) { $('#loginError').textContent = e.message; }
	}

	/* ---------- the account (password, other sessions, deleting it) ---------- */

	var account = { name: '', email: '', hasPassword: false, uid: '' };
	var DELETE_SENTENCE = 'Tôi hiểu rằng việc xoá tài khoản là không thể hoàn tác, đồng thời xác nhận việc xoá tài khoản hoàn toàn là quyết định của tôi, và tôi sẽ không yêu cầu một tài khoản mới với lý do tài khoản cũ của tôi đã bị xoá.';

	function same(a, b) {
		function n(s) { return String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim(); }
		return n(a) === n(b);
	}

	/* the sentence is drawn, not written, so it cannot be selected and copied */
	function drawSentence() {
		var c = $('#delSentence'), dpr = window.devicePixelRatio || 1;
		var w = Math.max(280, c.clientWidth || 560), pad = 12, lh = 22;
		var g = c.getContext('2d');
		g.font = '600 15px Nunito, "Segoe UI", sans-serif';
		var words = DELETE_SENTENCE.split(' '), lines = [], line = '';
		words.forEach(function (wd) {
			var t = line ? line + ' ' + wd : wd;
			if (g.measureText(t).width > w - pad * 2 && line) { lines.push(line); line = wd; } else { line = t; }
		});
		if (line) { lines.push(line); }
		c.width = w * dpr; c.height = (lines.length * lh + pad * 2) * dpr;
		c.style.height = (lines.length * lh + pad * 2) + 'px';
		g = c.getContext('2d');
		g.scale(dpr, dpr);
		g.font = '600 15px Nunito, "Segoe UI", sans-serif';
		g.fillStyle = '#ffb3b3';
		g.textBaseline = 'top';
		lines.forEach(function (l, i) { g.fillText(l, pad, pad + i * lh + 3); });
	}

	function checkDelete() {
		var ok = same($('#delName').value.toLowerCase(), account.name.toLowerCase()) && same($('#delConfirm').value, DELETE_SENTENCE);
		$('#delBtn').disabled = !ok;
	}

	function openAccount() {
		$('#accName').textContent = account.name;
		$('#delNameHint').textContent = account.name;
		show($('#pwCurrentLabel'), account.hasPassword);
		$('#pwCurrent').required = account.hasPassword;
		['#pwCurrent', '#pwNew', '#pwNew2', '#delName', '#delConfirm'].forEach(function (s) { $(s).value = ''; });
		['#pwMsg', '#othersMsg', '#delMsg'].forEach(function (s) { $(s).textContent = ''; $(s).className = 'meta'; });
		$('#delBtn').disabled = true;
		$('#accountDialog').showModal();
		drawSentence();
	}

	function msg(sel, text, bad) { $(sel).textContent = text; $(sel).className = 'meta ' + (bad ? 'bad' : 'ok'); }

	async function onChangePassword(ev) {
		ev.preventDefault();
		var cur = $('#pwCurrent').value, a = $('#pwNew').value, b = $('#pwNew2').value;
		if (a.length < 8) { msg('#pwMsg', 'Mật khẩu mới cần ít nhất 8 ký tự.', true); return; }
		if (a !== b) { msg('#pwMsg', 'Hai lần nhập mật khẩu mới không giống nhau.', true); return; }
		$('#pwBtn').disabled = true;
		try {
			/* the current password first - a panel left open on someone else's machine cannot change it */
			if (account.hasPassword) {
				var v = await db.auth.signInWithPassword({ email: account.email, password: cur });
				if (v.error) { msg('#pwMsg', 'Mật khẩu hiện tại không đúng.', true); return; }
			}
			var r = await db.auth.updateUser({ password: a });
			if (r.error) { msg('#pwMsg', 'Không đổi được: ' + auth.messageFor(r.error), true); return; }
			account.hasPassword = true;
			msg('#pwMsg', 'Đã đổi mật khẩu. Lần sau đăng nhập bằng mật khẩu mới.', false);
			['#pwCurrent', '#pwNew', '#pwNew2'].forEach(function (s) { $(s).value = ''; });
			show($('#pwCurrentLabel'), true); $('#pwCurrent').required = true;
		}
		finally { $('#pwBtn').disabled = false; }
	}

	async function onSignOutOthers() {
		if (!confirm('Đăng xuất tài khoản này trên mọi máy khác?')) { return; }
		var r = await db.auth.signOut({ scope: 'others' });
		msg('#othersMsg', r.error ? ('Không đăng xuất được: ' + auth.messageFor(r.error)) : 'Đã đăng xuất khỏi mọi phiên khác.', !!r.error);
	}

	async function onDeleteAccount() {
		checkDelete();
		if ($('#delBtn').disabled) { return; }
		if (!confirm('Lần xác nhận cuối: xoá vĩnh viễn tài khoản "' + account.name + '"?')) { return; }
		$('#delBtn').disabled = true;
		msg('#delMsg', 'Đang xoá ảnh / video và bộ đề...', false);
		var s = await auth.currentSession();
		/* Storage files first - the database cannot delete them itself */
		var sets = await db.from('question_sets').select('id, files');
		if (!sets.error) {
			var paths = [];
			(sets.data || []).forEach(function (set) { (set.files || []).forEach(function (f) { paths.push(s.user.id + '/' + set.id + '/' + f.key); }); });
			for (var i = 0; i < paths.length; i += 100) {
				var rm = await db.storage.from('sets').remove(paths.slice(i, i + 100));
				if (rm.error) { msg('#delMsg', 'Không xoá được file bộ đề: ' + rm.error.message, true); $('#delBtn').disabled = false; return; }
			}
		}
		var r = await db.rpc('delete_my_account', { p_username: $('#delName').value, p_confirm: $('#delConfirm').value });
		if (r.error || r.data !== 'deleted') {
			var why = { wrong_username: 'Tên người dùng không đúng.', wrong_sentence: 'Câu xác nhận chưa đúng.', not_manager: 'Phiên đăng nhập không phải tài khoản quản lý.' };
			msg('#delMsg', 'Không xoá được: ' + (r.error ? (r.error.code === 'PGRST202' ? 'cần chạy supabase/migrations/0007_delete_account.sql trước.' : r.error.message) : (why[r.data] || r.data)), true);
			$('#delBtn').disabled = false;
			return;
		}
		await db.auth.signOut({ scope: 'local' });
		alert('Tài khoản đã được xoá.');
		location.replace('index.html');
	}

	/* ---------- room expiry (4 hours, migrations/0008) ---------- */

	function expiryText(room) {
		if (!room.expires_at) { return { text: '', cls: '' }; }
		var left = Date.parse(room.expires_at) - Date.now();
		if (left <= 0) { return { text: 'Đã hết hạn - phòng sẽ tự xoá', cls: 'over' }; }
		var m = Math.ceil(left / 60000), h = Math.floor(m / 60);
		return { text: 'Còn dùng được ' + (h ? h + ' giờ ' : '') + (m % 60) + ' phút (mỗi phòng 4 tiếng)', cls: m <= 30 ? 'soon' : '' };
	}
	var expiryNodes = [];
	function refreshExpiry() {
		expiryNodes.forEach(function (e) {
			var t = expiryText(e.room);
			e.el.textContent = t.text;
			e.el.className = 'meta expiry ' + t.cls;
			e.card.classList.toggle('expired', t.cls === 'over');
		});
	}
	setInterval(refreshExpiry, 30000);

	/* ---------- co-managers ---------- */

	async function openManagers(room) {
		var d = dialogFor('managersDialog', room);
		$('#mgrAdd').value = '';
		$('#mgrMsg').textContent = '';
		async function list() {
			var box = $('#mgrList');
			box.textContent = '';
			var r = await db.from('room_managers').select('email, added_at').eq('room_id', room.id).order('added_at');
			if (r.error) {
				box.appendChild(Object.assign(document.createElement('p'), { className: 'meta', textContent: 'Chưa dùng được: hãy chạy supabase/migrations/0008_comanagers_and_expiry.sql (' + r.error.message + ').' }));
				$('#mgrSave').disabled = true;
				return;
			}
			$('#mgrSave').disabled = false;
			if (!(r.data || []).length) { box.appendChild(Object.assign(document.createElement('p'), { className: 'meta', textContent: 'Chưa mời ai.' })); }
			(r.data || []).forEach(function (m) {
				var row = document.createElement('div'); row.className = 'mgrItem';
				var c = document.createElement('code'); c.textContent = m.email; row.appendChild(c);
				var del = document.createElement('button'); del.type = 'button'; del.className = 'btn sm danger'; del.textContent = 'Bỏ';
				del.addEventListener('click', async function () {
					var x = await db.from('room_managers').delete().eq('room_id', room.id).eq('email', m.email);
					if (x.error) { $('#mgrMsg').textContent = x.error.message; }
					list();
				});
				row.appendChild(del);
				box.appendChild(row);
			});
		}
		$('#mgrSave').onclick = async function () {
			var emails = $('#mgrAdd').value.split(/[\s,;]+/).map(function (e) { return e.trim().toLowerCase(); }).filter(Boolean);
			var bad = emails.filter(function (e) { return !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); });
			if (bad.length) { $('#mgrMsg').textContent = 'Email chưa đúng: ' + bad.join(', '); return; }
			emails = emails.filter(function (e) { return e !== account.email.toLowerCase(); });
			if (!emails.length) { return; }
			var r = await db.from('room_managers').upsert(emails.map(function (e) { return { room_id: room.id, email: e }; }), { onConflict: 'room_id,email', ignoreDuplicates: true });
			$('#mgrMsg').textContent = r.error ? ('Không mời được: ' + r.error.message) : ('Đã mời ' + emails.length + ' email. Người được mời phải đã có tài khoản quản lý do chủ sở hữu trang web cấp.');
			if (!r.error) { $('#mgrAdd').value = ''; }
			list();
		};
		await list();
		d.showModal();
	}

	/* ---------- the room dialogs (index.html: shareDialog, podiumDialog) ---------- */

	var LINK_NAMES = [
		['control', 'Quản lý trận (bàn điều khiển)'], ['stage', 'Màn sân khấu'], ['player', 'Thí sinh (cần mật khẩu phòng)'], ['audience', 'Khán giả'],
		['podium1', 'Bảng điểm ghế 1'], ['podium2', 'Bảng điểm ghế 2'], ['podium3', 'Bảng điểm ghế 3'], ['podium4', 'Bảng điểm ghế 4']
	];

	async function copyText(btn, text, label) {
		try { await navigator.clipboard.writeText(text); btn.textContent = 'Đã chép'; }
		catch (e) { btn.textContent = 'Không chép được'; }
		setTimeout(function () { btn.textContent = label || 'Chép'; }, 1500);
	}

	function dialogFor(id, room) {
		var d = $('#' + id);
		d.querySelectorAll('[data-d="code"]').forEach(function (s) { s.textContent = room.code; });
		return d;
	}

	function openShareDialog(room, links) {
		var d = dialogFor('shareDialog', room);
		var box = $('#shareLinks');
		box.textContent = '';
		LINK_NAMES.forEach(function (l) {
			var row = document.createElement('div'); row.className = 'link';
			var name = document.createElement('span'); name.textContent = l[1]; row.appendChild(name);
			var code = document.createElement('code'); code.textContent = links[l[0]]; row.appendChild(code);
			var open = document.createElement('a'); open.className = 'btn sm'; open.textContent = 'Mở'; open.href = links[l[0]]; open.target = '_blank'; open.rel = 'noopener'; row.appendChild(open);
			var copy = document.createElement('button'); copy.type = 'button'; copy.className = 'btn sm'; copy.textContent = 'Chép';
			copy.addEventListener('click', function () { copyText(copy, links[l[0]]); });
			row.appendChild(copy);
			box.appendChild(row);
		});
		[['qrAudience', links.audience], ['qrPlayer', links.player]].forEach(function (q) {
			var box = $('#' + q[0]); box.textContent = '';
			if (window.OlympiaQr) { box.appendChild(window.OlympiaQr.canvas(q[1], 200)); }
		});
		var all = 'Olympia - phòng ' + room.code + (room.name ? ' (' + room.name + ')' : '') + '\n' +
			LINK_NAMES.map(function (l) { return l[1] + ': ' + links[l[0]]; }).join('\n');
		$('#shareAll').onclick = function () { copyText($('#shareAll'), all, 'Chép tất cả'); };
		/* the system share sheet (phones): only the links that need no account */
		var canShare = !!navigator.share;
		show($('#shareNative'), canShare);
		$('#shareNative').onclick = function () {
			navigator.share({ title: 'Olympia - phòng ' + room.code, text: 'Khán giả: ' + links.audience + '\nThí sinh: ' + links.player }).catch(function () {});
		};
		d.showModal();
	}

	function openPodiumDialog(room, links) {
		var d = dialogFor('podiumDialog', room);
		var box = $('#podiumLinks');
		box.textContent = '';
		[1, 2, 3, 4].forEach(function (n) {
			var a = document.createElement('a'); a.className = 'tile'; a.href = links['podium' + n]; a.target = '_blank'; a.rel = 'noopener';
			var b = document.createElement('b'); b.textContent = String(n); a.appendChild(b);
			var s = document.createElement('small'); s.textContent = 'Mở bảng điểm ghế ' + n; a.appendChild(s);
			box.appendChild(a);
		});
		d.showModal();
	}

	/* ---------- rooms ---------- */

	function fmtTime(iso) {
		try { return new Date(iso).toLocaleString('vi-VN'); } catch (e) { return iso; }
	}

	function stageText(room) {
		var alive = room.stage_uid && room.stage_seen_at && (Date.now() - new Date(room.stage_seen_at).getTime() < 30000);
		return { on: !!alive, text: alive ? 'Trận: đang chạy' : 'Trận: chưa chạy' }   /* the claim is held by the engine a control panel runs */;
	}

	function renderSeats(box, room, seats) {
		box.textContent = '';
		[1, 2, 3, 4].forEach(function (n) {
			var s = seats.filter(function (x) { return x.seat === n; })[0];
			var div = document.createElement('div');
			div.className = 'seat' + (s ? ' taken' : '');
			var b = document.createElement('b'); b.textContent = 'Ghế ' + n; div.appendChild(b);
			var m = document.createElement('span'); m.className = 'meta';
			m.textContent = s ? ('Đã vào lúc ' + fmtTime(s.joined_at)) : 'Trống'; div.appendChild(m);
			if (s) {
				var kick = document.createElement('button');
				kick.type = 'button'; kick.className = 'btn sm'; kick.textContent = 'Mời ra';
				kick.addEventListener('click', async function () {
					if (!confirm('Mời thí sinh ghế ' + n + ' ra khỏi phòng ' + room.code + '?')) { return; }
					var r = await db.from('room_players').delete().eq('room_id', room.id).eq('seat', n);
					if (r.error) { alert(r.error.message); }
					loadRooms();
				});
				div.appendChild(kick);
			}
			box.appendChild(div);
		});
	}

	function renderRoom(room, seats) {
		var node = $('#roomTpl').content.firstElementChild.cloneNode(true);
		var f = function (k) { return node.querySelector('[data-f="' + k + '"]'); };
		f('code').textContent = room.code;
		f('name').textContent = room.name || '(chưa đặt tên)';
		f('created').textContent = 'Tạo lúc ' + fmtTime(room.created_at);
		expiryNodes.push({ room: room, el: f('expiry'), card: node });
		/* a room someone shared with this account: open its screens, but not the owner's actions */
		var mine = !room.owner_id || room.owner_id === account.uid;
		show(f('role'), !mine);
		if (!mine) {
			['managers', 'password', 'delete'].forEach(function (a) { var b = node.querySelector('[data-a="' + a + '"]'); if (b) { b.remove(); } });
		}
		else { node.querySelector('[data-a="managers"]').addEventListener('click', function () { openManagers(room); }); }
		var st = stageText(room);
		f('stage').textContent = st.text;
		f('stage').classList.toggle('on', st.on);

		var links = { questions: pageUrl('questions.html', room.code), control: pageUrl('control.html', room.code), stage: pageUrl('audience.html', room.code) + '&view=stage', audience: pageUrl('audience.html', room.code), player: pageUrl('player.html', room.code) };
		[1, 2, 3, 4].forEach(function (n) {
			var u = new URL(pageUrl('podium.html', room.code));
			u.searchParams.set('seat', String(n));
			links['podium' + n] = u.href;
		});
		node.querySelectorAll('[data-o]').forEach(function (a) { a.href = links[a.getAttribute('data-o')]; });
		node.querySelector('[data-a="podiums"]').addEventListener('click', function () { openPodiumDialog(room, links); });
		node.querySelector('[data-a="share"]').addEventListener('click', function () { openShareDialog(room, links); });

		renderSeats(f('seats'), room, seats);
		if (!mine) { node.querySelectorAll('.seat .btn').forEach(function (b) { b.remove(); }); }   /* freeing seats: the owner's */

		node.querySelector('[data-a="password"]').addEventListener('click', async function () {
			var pw = prompt('Mật khẩu mới cho thí sinh phòng ' + room.code + ' (4–20 ký tự):');
			if (pw === null) { return; }
			if (pw.length < 4 || pw.length > 20) { alert('Mật khẩu phải có từ 4 đến 20 ký tự.'); return; }
			var r = await db.rpc('set_room_password', { p_code: room.code, p_password: pw });
			alert(r.error ? ('Không đổi được: ' + r.error.message) : 'Đã đổi mật khẩu thí sinh. Thí sinh đã vào phòng vẫn giữ ghế.');
		});
		node.querySelector('[data-a="release"]').addEventListener('click', async function () {
			if (!confirm('Giải phóng phòng ' + room.code + '? Bàn điều khiển đang chạy trận (nếu có) sẽ bị ngắt; bàn điều khiển mở tiếp theo sẽ chạy trận.')) { return; }
			var r = await db.rpc('release_stage', { p_code: room.code });
			if (r.error) { alert(r.error.message); }
			loadRooms();
		});
		node.querySelector('[data-a="clearSave"]').addEventListener('click', async function () {
			if (!confirm('Xoá bản lưu tự động của phòng ' + room.code + '? Dùng khi bắt đầu một buổi thi mới trong phòng này.')) { return; }
			var r = await db.rpc('clear_game_state', { p_code: room.code });
			alert(r.error ? ('Không xoá được: ' + r.error.message) : 'Đã xoá bản lưu tự động.');
		});
		node.querySelector('[data-a="delete"]').addEventListener('click', async function () {
			if (!confirm('Xoá hẳn phòng ' + room.code + '? Không thể hoàn tác.')) { return; }
			var r = await db.from('rooms').delete().eq('code', room.code);
			if (r.error) { alert(r.error.message); }
			loadRooms();
		});
		return node;
	}

	async function loadRooms() {
		await db.rpc('purge_expired_rooms').then(function () {}, function () {});   /* rooms past their 4 hours go (0008) */
		var r = await db.from('rooms').select('id, code, name, owner_id, stage_uid, stage_seen_at, created_at, expires_at, question_set_id').order('created_at', { ascending: false });
		if (r.error) { r = await db.from('rooms').select('id, code, name, owner_id, stage_uid, stage_seen_at, created_at, question_set_id').order('created_at', { ascending: false }); }   /* before 0008 */
		if (r.error) { r = await db.from('rooms').select('id, code, name, stage_uid, stage_seen_at, created_at').order('created_at', { ascending: false }); }   /* before 0006 */
		expiryNodes = [];
		if (r.error) { notice('Không tải được danh sách phòng: ' + r.error.message); return; }
		var rooms = r.data || [];
		var seats = [];
		if (rooms.length) {
			var s = await db.from('room_players').select('room_id, seat, joined_at').in('room_id', rooms.map(function (x) { return x.id; }));
			if (!s.error) { seats = s.data || []; }
		}
		var box = $('#rooms');
		box.textContent = '';
		rooms.forEach(function (room) {
			box.appendChild(renderRoom(room, seats.filter(function (x) { return x.room_id === room.id; })));
		});
		refreshExpiry();
		show($('#emptyRooms'), !rooms.length);
	}

	async function onCreate(ev) {
		ev.preventDefault();
		$('#createError').textContent = '';
		var pw = $('#roomPassword').value;
		if (pw.length < 4 || pw.length > 20) { $('#createError').textContent = 'Mật khẩu thí sinh phải có từ 4 đến 20 ký tự.'; return; }
		$('#createBtn').disabled = true;
		var r = await db.rpc('create_room', { p_name: $('#roomName').value, p_password: pw });
		$('#createBtn').disabled = false;
		if (r.error) { $('#createError').textContent = 'Không tạo được phòng: ' + r.error.message; return; }
		$('#roomName').value = ''; $('#roomPassword').value = '';
		loadRooms();
	}

	/* ---------- which view ---------- */

	async function route() {
		var s = await auth.currentSession();
		var manager = await auth.confirmManager(s);
		/* a permanent account the site owner never allowed (e.g. one made through an old invitation) */
		if (!manager && auth.isManager(s)) {
			await auth.signOut();
			$('#loginError').textContent = 'Tài khoản ' + (s.user.email || '') + ' chưa được chủ sở hữu trang web cấp quyền quản lý - hãy gửi "Yêu cầu một tài khoản".';
		}
		show($('#betaBar'), !manager);
		show($('#loginCard'), !manager);
		show($('#roomsView'), manager);
		show($('#who'), manager);
		if (!manager) { return; }
		var next = safeNext();
		if (next) { location.replace(next); return; }
		$('#whoName').textContent = s.user.email || '';
		var p = await db.from('profiles').select('username').maybeSingle();
		if (p.data && p.data.username) { $('#whoName').textContent = p.data.username + ' · ' + (s.user.email || ''); }
		account.uid = s.user.id;
		account.email = s.user.email || '';
		account.name = (p.data && p.data.username) || account.email;
		account.hasPassword = ((s.user.app_metadata && s.user.app_metadata.providers) || []).indexOf('email') !== -1 ||
			(s.user.identities || []).some(function (i) { return i.provider === 'email'; });
		loadRooms();
	}

	async function start() {
		if (!db) { notice('Không tải được thư viện Supabase - kiểm tra kết nối mạng.'); return; }
		var err = errorFromRedirect();
		if (err) { $('#loginError').textContent = err; }
		$('#loginForm').addEventListener('submit', onLogin);
		$('#googleBtn').addEventListener('click', onGoogle);
		$('#createForm').addEventListener('submit', onCreate);
		$('#accountOpen').addEventListener('click', openAccount);
		$('#pwForm').addEventListener('submit', onChangePassword);
		$('#signOutOthers').addEventListener('click', onSignOutOthers);
		$('#delBtn').addEventListener('click', onDeleteAccount);
		$('#delName').addEventListener('input', checkDelete);
		/* the sentence must be typed: no paste, no drop */
		['paste', 'drop'].forEach(function (t) { $('#delConfirm').addEventListener(t, function (e) { e.preventDefault(); msg('#delMsg', 'Hãy tự gõ câu xác nhận - không dán được.', true); }); });
		$('#delConfirm').addEventListener('beforeinput', function (e) { if (/^insertFrom(Paste|Drop|Yank)/.test(e.inputType || '')) { e.preventDefault(); } });
		$('#delConfirm').addEventListener('input', checkDelete);
		window.addEventListener('resize', function () { if ($('#accountDialog').open) { drawSentence(); } });
		document.querySelectorAll('.lobbyDialog [data-close]').forEach(function (b) {
			b.addEventListener('click', function () { b.closest('dialog').close(); });
		});
		$('#refresh').addEventListener('click', loadRooms);
		$('#signOut').addEventListener('click', async function () { await auth.signOut(); route(); });
		await route();
	}

	start();
})();
