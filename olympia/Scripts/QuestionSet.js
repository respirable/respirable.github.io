/*
 * Olympia Controller - the room's question set from Supabase Storage (stage page, room mode).
 *
 * A room may use a set uploaded from the lobby (supabase/migrations/0006). Before the questions
 * are read (Init.js), the stage takes the room (the same claim_stage StateSync.js makes - it is
 * per tab, so taking it twice is harmless), asks which set the room uses, and points DataFiles
 * at short-lived signed links of its XML files. Pictures / videos named in the XML are looked up
 * by file name in the set (resolveMedia); anything else (e.g. "O24/VCNV Image.png") stays a
 * path of this site. No set, no room, or any failure: the set on this machine / the sample.
 *
 * File names are stored as "keys" without accents or spaces (setFileKey - the lobby uses the
 * same rule), and looked up the same way, so "Hình 1.png" in the XML finds the uploaded file.
 */
(function (gv) {
	var LINK_SECONDS = 12 * 3600;   /* a show is shorter than this; a reload makes new links */
	var XML_FILES = { players: 'players.xml', khoidong: 'khoidong.xml', vcnv: 'vcnv.xml', tangtoc: 'tangtoc.xml', vedich: 'vedich.xml', tiebreak: 'cauhoiphu.xml' };

	function setFileKey(name) {
		return String(name || '').split(/[\\/]/).pop().normalize('NFD').replace(/[̀-ͯ]/g, '')
			.replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9._-]+/g, '_').toLowerCase();
	}

	gv.QuestionSetName = '';            /* shown on the control panel: '' = this machine's set / the sample */
	gv.QuestionSetMedia = null;         /* key -> signed link */

	/* a media path from the XML -> the set's signed link, or the path unchanged */
	gv.resolveMedia = function (src) {
		if (!src || !gv.QuestionSetMedia) { return src; }
		return gv.QuestionSetMedia[setFileKey(src)] || src;
	};
	gv.setFileKey = setFileKey;

	async function takeRoom(db, code) {
		var inst = gv.Sync && gv.Sync.stageInstanceId ? gv.Sync.stageInstanceId() : '';
		var r = await db.rpc('claim_stage', { p_code: code, p_instance: inst });
		if (r.error && r.error.code === 'PGRST202') { r = await db.rpc('claim_stage', { p_code: code }); }
		return !r.error && r.data === 'ok';
	}

	/* true when the room's set is in use (DataFiles now point at it) */
	gv.useRoomQuestionSet = async function () {
		var code = (new URLSearchParams(location.search).get('room') || '').trim().toUpperCase();
		var auth = window.OlympiaAuth, db = auth && auth.client;
		if (!/^[A-Z0-9]{4,12}$/.test(code) || !db) { return false; }
		try {
			await auth.ensureAnonymous();
			if (!(await takeRoom(db, code))) { return false; }   /* another engine runs the room: it has the set */
			/* the room's rules (Rules.js, migrations/0013) - before any question is read */
			var rr = await db.rpc('room_rules', { p_code: code });
			if (!rr.error && rr.data && gv.applyRules) { gv.applyRules(rr.data); console.log('[QuestionSet] rules: ' + rr.data); }
			var r = await db.rpc('room_question_set', { p_code: code });
			if (r.error) {
				if (r.error.code !== 'PGRST202') { console.warn('[QuestionSet] room_question_set failed', r.error.message); }
				return false;   /* PGRST202: migration 0006 not run yet */
			}
			var set = r.data;
			if (!set || !set.id) { return false; }
			var files = (set.files || []).filter(function (f) { return f && f.key; });
			var paths = files.map(function (f) { return set.owner + '/' + set.id + '/' + f.key; });
			if (!paths.length) { console.warn('[QuestionSet] set "' + set.name + '" has no files'); return false; }
			var s = await db.storage.from('sets').createSignedUrls(paths, LINK_SECONDS);
			if (s.error) { console.warn('[QuestionSet] could not sign the files', s.error.message); return false; }
			var media = {};
			(s.data || []).forEach(function (row, i) { if (row && row.signedUrl) { media[files[i].key] = row.signedUrl; } });
			Object.keys(XML_FILES).forEach(function (k) {
				var link = media[XML_FILES[k]];
				gv.DataFiles[k] = link || ('Questions/__missing_' + XML_FILES[k]);   /* missing: the loader reports it */
			});
			gv.QuestionSetMedia = media;
			gv.QuestionSetName = set.name || '(bộ đề không tên)';
			console.log('[QuestionSet] using "' + gv.QuestionSetName + '" (' + files.length + ' files)');
			return true;
		}
		catch (e) {
			console.warn('[QuestionSet] falling back to this machine\'s set', e);
			return false;
		}
	};
})(window.GameVariables);
