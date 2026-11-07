/*
 * "Bạn có tạch đỉnh Olympia?" - the menu (picture, name, start), the stage fitted to the window,
 * and the result card (standing, the player's luck, share / play again).
 */
(function () {
	var gv = window.GameVariables, L = window.LUCK;
	function $(id) { return document.getElementById(id); }

	/* the 1920 x 1080 stage, as large as the window allows, centred */
	function fit() {
		var stage = document.querySelector('.stageContainerDiv'), frame = $('luckFrame');
		if (!stage || !frame) { return; }
		var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
		stage.style.transform = 'scale(' + s + ')';
		frame.style.width = Math.round(1920 * s) + 'px';
		frame.style.height = Math.round(1080 * s) + 'px';
	}

	function start() {
		var name = ($('luckName').value || '').trim().replace(/\s+/g, ' ').slice(0, 40) || 'Bạn';
		try { localStorage.setItem('olympia-luck.name', name); } catch (e) { /* blocked */ }
		/* this tap lets every later sound play (an iPad plays only elements a tap started) */
		if (typeof unlockAudioPool === 'function') { unlockAudioPool(16, L.SILENCE); }
		try { if (navigator.audioSession) { navigator.audioSession.type = 'playback'; } } catch (e) { /* not supported */ }
		$('luckMenu').classList.add('gone');
		document.body.classList.add('playing');
		L.setSeats(name);
		L.play().then(showResult, function (e) { console.error('[Luck] the match stopped', e); });
	}

	function headline(me) {
		if (me.place === 1) { return 'Bạn đã lên đỉnh Olympia - nhờ may thôi'; }
		if (me.place === 2) { return 'Bạn đã tạch đỉnh Olympia - suýt nữa thì không tạch'; }
		return 'Bạn đã tạch đỉnh Olympia';
	}

	function showResult(res) {
		var me = res.me, st = res.stats;
		var pct = st.rolls ? Math.round(100 * st.hits / st.rolls) : 0;
		$('luckResTitle').textContent = headline(me);
		$('luckResPlace').textContent = 'Hạng ' + me.place + ' · ' + me.score + ' điểm';
		var ol = $('luckResList');
		ol.textContent = '';
		res.list.forEach(function (r) {
			var li = document.createElement('li');
			if (r.seat === L.me) { li.className = 'me'; }
			var a = document.createElement('span'); a.textContent = r.place + '. ' + r.name;
			var b = document.createElement('b'); b.textContent = r.score;
			li.appendChild(a); li.appendChild(b);
			ol.appendChild(li);
		});
		var vdRight = st.vd.filter(function (q) { return q.ok; }).length;
		$('luckResLuck').textContent = 'Bạn đã quay ' + st.rolls + ' lần, trúng ' + st.hits + ' lần (' + pct + '%).' +
			(st.vd.length ? ' Về đích: đúng ' + vdRight + '/' + st.vd.length + ' câu.' : '') +
			(pct >= 55 ? ' Hôm nay bạn hên.' : pct <= 40 ? ' Hôm nay không phải ngày của bạn.' : ' Hên xui đúng như tên gọi.');
		$('luckResult').classList.add('on');
		L.lastShare = (me.place === 1 ? 'Tôi đã lên đỉnh Olympia nhờ may mắn với ' : 'Tôi đã tạch đỉnh Olympia với ') + me.score + ' điểm (hạng ' + me.place + '/4). Thử nhân phẩm của bạn:';
	}

	function share() {
		var url = location.origin + '/olympia-luck/';
		var text = L.lastShare || 'Bạn có tạch đỉnh Olympia?';
		if (navigator.share) { navigator.share({ title: 'Bạn có tạch đỉnh Olympia?', text: text, url: url }).catch(function () {}); return; }
		var all = text + ' ' + url;
		(navigator.clipboard ? navigator.clipboard.writeText(all) : Promise.reject()).then(function () {
			$('luckShare').textContent = 'Đã chép đường dẫn';
		}, function () { prompt('Chép đường dẫn này:', all); });
	}

	document.addEventListener('DOMContentLoaded', function () {
		fit();
		window.addEventListener('resize', fit);
		L.bindStage(document.querySelector('.stageContainerDiv'));
		try { $('luckName').value = localStorage.getItem('olympia-luck.name') || ''; } catch (e) { /* blocked */ }
		$('luckStart').disabled = true;
		$('luckStart').textContent = 'Đang chuẩn bị phòng thi…';
		/* the engine is ready once its question files are in (Init.js) */
		L.until(function () { return gv.VcnvData && gv.VeDichQuestions && gv.Players && gv.Players.length === 4; }, 20000).then(function () {
			$('luckStart').disabled = false;
			$('luckStart').textContent = 'Vào thi';
			if (L.auto) { start(); }
		});
		$('luckForm').addEventListener('submit', function (e) { e.preventDefault(); if (!$('luckStart').disabled) { start(); } });
		$('luckNext').addEventListener('click', L.skip);
		$('luckShare').addEventListener('click', share);
		$('luckAgain').addEventListener('click', function () { location.href = location.pathname; });
	});
})();
