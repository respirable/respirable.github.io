/*
 * Olympia Controller - start-up of default.html (the graphics page).
 *
 * ***DO NOT TAMPER WITH ANYTHING IN THIS FILE UNLESS YOU KNOW WHAT IT DOES OR IS DOING!***
 *
 *   1. getContestantsForGame()   Questions/players.xml -> Players (+ names typed on the panel)
 *   2. getAllQuestionsForGame()  the four question files - a missing file logs an error and the
 *                                round shows "(thiếu câu ...)" instead of crashing
 *   3. every graphic is built once and hidden; the background is on from the first frame
 *   4. the two-screen sync starts (this page is the authority, control.html the remote)
 *   5. the keyboard starts - audio is only ever started by a key press
 */

document.addEventListener('DOMContentLoaded', init);

async function init() {
	/* In a room the game runs in the control panel (EmbeddedStage.js loads this page there with
	 * &embedded=1). Opened on its own, this page is only the stage's picture (and, if the panel
	 * says so, its sound): it never runs the game, so closing or reloading it changes nothing. */
	var startParams = new URLSearchParams(location.search);
	var startRoom = (startParams.get('room') || '').trim().toUpperCase();
	if (startRoom && startParams.get('embedded') !== '1') {
		location.replace('audience.html?room=' + encodeURIComponent(startRoom) + '&view=stage');
		return;
	}

	/* 0. the real set lives in Questions/ (kept out of git); without it - e.g. the published
	 *    site - the sample set in Demo/ is used */
	/* in a room that uses a set from the lobby (QuestionSet.js) that set comes first */
	if (!(await window.GameVariables.useRoomQuestionSet())) { await useDemoQuestionsIfMissing(); }

	/* 1. contestants */
	try { await getContestantsForGame(); }
	catch (e) {
		console.error('[Init] players.xml failed, using placeholders', e);
		window.GameVariables.Players = [1, 2, 3, 4].map(function (s) { return window.GameVariables.createPlayer(s); });
	}

	/* 2. questions */
	await getAllQuestionsForGame();

	/* 3. graphics: build once, start hidden */
	showBackground();              /* always on (green screen: only with the VCNV / Tăng tốc graphics) */
	applyGreenScreenColor();       /* GreenScreenMode in Variables.js = the start state */
	refreshStageBackground();
	renderContestantBars();
	hideContestantBars();          /* the bars come in one by one at Khởi động step 3 */
	renderQuestionBar();
	hideQuestionBar();
	renderObstacleBoard();
	hideObstacleBoard();
	renderTangTocFrame();
	hideTangTocFrame();
	renderVeDich();
	hideVeDich();
	renderBoardScreen();
	hideBoardScreen();

	/* 4. sync */
	/* one warning strip for: a second stage page, and (in a room) anything that keeps this page
	 * from running the room - it can appear and clear later, the room connects asynchronously */
	var warn = document.querySelector('.authorityWarningDiv');
	var localWarning = warn ? warn.textContent : '';
	function showStageWarning(text) {
		if (!warn) { return; }
		warn.textContent = text || localWarning;
		warn.classList.toggle('visible', !!text);
	}
	window.GameVariables.Sync.on('conflict', function (on) {
		if (window.GameVariables.Sync.room) { return; }   /* rooms report through 'status' */
		showStageWarning(on ? localWarning : '');
		if (on) { console.warn('[Init] another graphics page is already open - audio will double up'); }
	});
	/* The room taken by a LIVE engine (another stage, or the one the control panel runs - see
	 * EmbeddedStage.js): after TAKEN_TO_VIEWER_MS - longer than the 30 s a dead claim lasts -
	 * this page becomes a picture-only screen of that game (audience.html?view=stage). Before
	 * that it may simply be a crashed stage's claim running out, which this page then takes. */
	var embedded = new URLSearchParams(location.search).get('embedded') === '1';
	var TAKEN_TO_VIEWER_MS = 35000;
	var takenTimer = null;
	window.GameVariables.Sync.on('status', function (st) {
		var sync = window.GameVariables.Sync, code = sync.room;
		if (st === 'taken') {
			showStageWarning('Phòng ' + code + ' đang được chạy ở nơi khác (màn sân khấu khác hoặc máy điều khiển). Nếu sau 35 giây vẫn vậy, màn này sẽ chỉ chiếu đồ hoạ của trận đó.');
			if (!embedded && !takenTimer) {
				takenTimer = setTimeout(function () {
					if (window.GameVariables.Sync.status === 'taken') { location.replace('audience.html?room=' + encodeURIComponent(code) + '&view=stage'); }
					takenTimer = null;
				}, TAKEN_TO_VIEWER_MS);
			}
		}
		else {
			if (takenTimer) { clearTimeout(takenTimer); takenTimer = null; }
			if (st === 'denied' || st === 'error') { showStageWarning(sync.statusDetail || 'Không vào được phòng ' + code + '.'); }
			else if (st === 'offline') { showStageWarning('Mất kết nối tới máy chủ - đang thử lại...'); }
			else { showStageWarning(''); }
		}
	});
	window.GameVariables.Sync.init('authority');
	if (window.GameVariables.startGameSave) { window.GameVariables.startGameSave(); }   /* GameSave.js */

	/* 5. keyboard */
	window.GameVariables.Keyboard.init();
	window.GameVariables.changed();
	console.log('[Init] ready - Left starts Khởi động');
}

/* ==================================================================================== */
/* Reading the XML files (fetch + DOMParser). Text is read with textContent and later put  */
/* into the page with textContent - never innerHTML.                                       */
/* ==================================================================================== */

async function useDemoQuestionsIfMissing() {
	var files = window.GameVariables.DataFiles;
	var found = false;
	try { found = (await fetch(files.players, { method: 'HEAD', cache: 'no-store' })).ok; } catch (e) { /* offline / blocked */ }
	if (found) { return; }
	Object.keys(files).forEach(function (k) { files[k] = files[k].replace(/^Questions\//, 'Demo/'); });
	console.warn('[Init] Questions/ not found - using the demo set in Demo/');
}

async function loadXml(path) {
	var res = await fetch(path, { cache: 'no-store' });
	if (!res.ok) { throw new Error('HTTP ' + res.status + ' loading ' + path); }
	var doc = new DOMParser().parseFromString(await res.text(), 'application/xml');
	var err = doc.querySelector('parsererror');
	if (err) { throw new Error('XML parse error in ' + path + ': ' + err.textContent); }
	return doc;
}

function xmlText(el, selector) {
	var node = el && selector ? el.querySelector(selector) : el;
	return node ? node.textContent.trim() : '';
}

/* ---------- 1. contestants ---------- */

/* Questions/players.xml -> Players (4 seats). Missing seats get the placeholder name. */
async function getContestantsForGame() {
	var doc = await loadXml(window.GameVariables.DataFiles.players);
	var players = [];
	doc.querySelectorAll('player').forEach(function (el) {
		var seat = parseInt(el.getAttribute('seat'), 10);
		if (seat >= 1 && seat <= 4) { players.push(window.GameVariables.createPlayer(seat, xmlText(el, 'name'), xmlText(el, 'school'))); }
	});
	for (var s = 1; s <= 4; s++) {
		if (!players.some(function (p) { return p.seat === s; })) { players.push(window.GameVariables.createPlayer(s)); }
	}
	players.sort(function (a, b) { return a.seat - b.seat; });
	window.GameVariables.Players = players;
	applyNameOverrides();
}

/* names typed on the control panel are remembered on this machine and beat players.xml */
function readNameOverrides() {
	try { return JSON.parse(localStorage.getItem(window.GameVariables.NamesKey) || '{}') || {}; } catch (e) { return {}; }
}
function applyNameOverrides() {
	var o = readNameOverrides();
	window.GameVariables.Players.forEach(function (p) { if (o[p.seat]) { p.fullName = o[p.seat]; } });
}
function saveNameOverride(seat, name) {
	var o = readNameOverrides();
	o[seat] = name;
	try { localStorage.setItem(window.GameVariables.NamesKey, JSON.stringify(o)); } catch (e) { /* ignore */ }
}
function clearNameOverrides() {
	try { localStorage.removeItem(window.GameVariables.NamesKey); } catch (e) { /* ignore */ }
}

/* ---------- 2. questions ---------- */

async function getAllQuestionsForGame() {
	try { await getKhoiDongQuestions(); } catch (e) { console.error('[Init] khoidong.xml failed (questions will show as missing)', e); }
	try { await getVcnvQuestions(); } catch (e) { console.error('[Init] vcnv.xml failed (the VCNV board will be empty)', e); }
	try { await getTangTocQuestions(); } catch (e) { console.error('[Init] tangtoc.xml failed (Tăng tốc questions will show as missing)', e); }
	try { await getVeDichQuestions(); } catch (e) { console.error('[Init] vedich.xml failed (Về đích questions will show as missing)', e); }
	try { await getTieBreakQuestions(); } catch (e) { console.error('[Init] cauhoiphu.xml failed (tie-break questions will show as missing)', e); }
}

/* Questions/khoidong.xml -> KhoiDongQuestions = { individual: {1:[...],2:[...],...}, common:[...] } */
async function getKhoiDongQuestions() {
	var doc = await loadXml(window.GameVariables.DataFiles.khoidong);
	var out = { individual: {}, common: [] };
	doc.querySelectorAll('individual').forEach(function (block) {
		var seat = parseInt(block.getAttribute('seat'), 10);
		out.individual[seat] = Array.prototype.map.call(block.querySelectorAll('question'), function (q) {
			return { text: xmlText(q, 'text') || xmlText(q), answer: xmlText(q, 'answer') };
		});
	});
	var common = doc.querySelector('common');
	if (common) {
		out.common = Array.prototype.map.call(common.querySelectorAll('question'), function (q) {
			return { text: xmlText(q, 'text') || xmlText(q), answer: xmlText(q, 'answer') };
		});
	}
	window.GameVariables.KhoiDongQuestions = out;
}

/* Questions/vcnv.xml -> VcnvData = { keyword, image, rows:[{text,answer}x4], center:{text,answer} } */
async function getVcnvQuestions() {
	var doc = await loadXml(window.GameVariables.DataFiles.vcnv);
	function q(el) { return el ? { text: xmlText(el, 'text') || '', answer: xmlText(el, 'answer') || '' } : { text: '', answer: '' }; }
	window.GameVariables.VcnvData = {
		keyword: xmlText(doc.querySelector('keyword'), 'text') || xmlText(doc.querySelector('keyword')) || '',
		image: window.GameVariables.resolveMedia(xmlText(doc.querySelector('image')) || ''),   /* a room's set: signed link (QuestionSet.js) */
		rows: Array.prototype.map.call(doc.querySelectorAll('row'), q),
		center: q(doc.querySelector('center'))
	};
}

/* Questions/tangtoc.xml -> TangTocQuestions = [{ text, media:{type,src}, answerMedia, answer, seconds }] x4 */
async function getTangTocQuestions() {
	var doc = await loadXml(window.GameVariables.DataFiles.tangtoc);
	window.GameVariables.TangTocQuestions = Array.prototype.map.call(doc.querySelectorAll('question'), function (q, i) {
		var m = q.querySelector('media');
		var am = q.querySelector('answerMedia');
		var secs = parseFloat(q.getAttribute('seconds'));
		return {
			text: xmlText(q, 'text') || '',
			media: { type: (m && m.getAttribute('type')) || 'image', src: window.GameVariables.resolveMedia(xmlText(m) || '') },
			answerMedia: (am && xmlText(am)) ? { type: am.getAttribute('type') || 'image', src: window.GameVariables.resolveMedia(xmlText(am)) } : null,
			answer: xmlText(q, 'answer') || '',
			seconds: (secs > 0) ? secs : (window.GameVariables.Timings.TANG_TOC[i] || 20)
		};
	});
}

/* Questions/vedich.xml -> VeDichQuestions = { seat: { 20: [{text,answer}x3], 30: [...x3] } } */
async function getVeDichQuestions() {
	var doc = await loadXml(window.GameVariables.DataFiles.vedich);
	var out = {};
	doc.querySelectorAll('package').forEach(function (pk) {
		var seat = parseInt(pk.getAttribute('seat'), 10);
		if (!(seat >= 1 && seat <= 4)) { return; }
		var bag = { 20: [], 30: [] };
		pk.querySelectorAll('question').forEach(function (q) {
			var v = parseInt(q.getAttribute('value'), 10);
			if (!bag[v]) { return; }
			bag[v].push({ text: xmlText(q, 'text') || xmlText(q), answer: xmlText(q, 'answer') || '' });
		});
		out[seat] = bag;
	});
	window.GameVariables.VeDichQuestions = out;
}

/* Questions/cauhoiphu.xml -> TieBreakQuestions = [{ text, answer }] x at most 3. A set made before the
 * tie-break existed has no such file: the sample in Demo/ is used then (its texts say "mẫu"). */
async function getTieBreakQuestions() {
	var path = window.GameVariables.DataFiles.tiebreak, doc;
	try { doc = await loadXml(path); }
	catch (e) {
		if (path === 'Demo/cauhoiphu.xml') { throw e; }
		console.warn('[Init] cauhoiphu.xml missing - using the sample tie-break questions in Demo/');
		doc = await loadXml('Demo/cauhoiphu.xml');
	}
	var all = Array.prototype.map.call(doc.querySelectorAll('question'), function (q) {
		return { text: xmlText(q, 'text') || xmlText(q), answer: xmlText(q, 'answer') || '' };
	});
	var max = window.GameVariables.Timings.TIEBREAK_MAX_QUESTIONS;
	if (all.length > max) { console.warn('[Init] cauhoiphu.xml has ' + all.length + ' questions - only the first ' + max + ' are used'); }
	window.GameVariables.TieBreakQuestions = all.slice(0, max);
}
