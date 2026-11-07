/*
 * Olympia Controller - the VCNV picture as players / the audience may see it (stage page).
 *
 * The public state used to carry the picture's address, so anyone could open the whole picture
 * before its covers came off. Now the stage draws the picture itself, paints black every part
 * still hidden by a CLOSED cover - using the cover pictures themselves as the mask, since the
 * corner frames are see-through where the centre piece sits - and sends that JPEG instead, as
 * a separate "asset" message (StateSync.js) - only when it changes, not with every state. The public state carries just its
 * key (roundState.vcnv.imageKey). Once the obstacle is solved / revealed, nothing is black.
 *
 * Geometry = the stage's (olympia.css): photo box 744 x 458 at (6, 6) inside the 756 x 470
 * picture, corners 378 x 235, centre piece 380.8 x 238.4 at (187.6, 115.1); the photo fills its box
 * (object-fit: cover). The JPEG is drawn at SCALE of that size to keep messages small.
 */
(function (gv) {
	var W = 744, H = 458, OFF = 6, SCALE = 0.8, QUALITY = 0.72;
	var COVERS = { 1: [0, 0, 378, 235], 2: [378, 0, 378, 235], 3: [378, 235, 378, 235], 4: [0, 235, 378, 235], middle: [187.6, 115.1, 380.8, 238.4] };   /* x, y, w, h (olympia.css) */
	var img = null, imgSrc = '', ready = false, failed = false;
	/* the cover pictures (same site: always readable) */
	var frames = {};
	Object.keys(COVERS).forEach(function (k) {
		var f = new Image();
		f.onload = function () { f.__ok = true; };
		f.src = 'O24/Beat the Obstacle/Obstacle/picture_frame_' + k + '.png';
		frames[k] = f;
	});
	var cache = { key: '', data: '' };

	function closedCovers() {
		var open = Array.prototype.map.call(document.querySelectorAll('.vcnvDiv .vcnvCover.open'), function (el) {
			return el.classList.contains('vcnvCoverMiddle') ? 'middle' : el.className.replace(/.*vcnvCover(\d).*/, '$1');
		});
		var all = gv.IsVcnvSolved || gv.VcnvSequenceCounter >= 11;
		return all ? [] : Object.keys(COVERS).filter(function (k) { return open.indexOf(k) === -1; });
	}

	function load(src) {
		if (src === imgSrc) { return; }
		imgSrc = src; ready = false; failed = false; cache = { key: '', data: '' };
		if (!src) { img = null; return; }
		img = new Image();
		img.crossOrigin = 'anonymous';   /* a set's signed link: the canvas must stay readable */
		img.onload = function () { ready = true; gv.changed(); };
		img.onerror = function () { failed = true; console.warn('[VCNV] could not load the picture for the public view', src); };
		img.src = src;
	}

	function compose(closed) {
		var c = document.createElement('canvas');
		c.width = Math.round(W * SCALE); c.height = Math.round(H * SCALE);
		var g = c.getContext('2d');
		g.scale(SCALE, SCALE);
		/* object-fit: cover */
		var r = Math.max(W / img.naturalWidth, H / img.naturalHeight);
		var dw = img.naturalWidth * r, dh = img.naturalHeight * r;
		g.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
		/* each closed cover: its own shape, solid black (drawn twice so soft edges hide too) */
		closed.forEach(function (k) {
			var x = COVERS[k][0] - OFF, y = COVERS[k][1] - OFF, w = COVERS[k][2], h = COVERS[k][3], f = frames[k];
			if (!f.__ok) { g.fillStyle = '#000'; g.fillRect(x, y, w, h); return; }
			var m = document.createElement('canvas'); m.width = Math.ceil(w); m.height = Math.ceil(h);
			var mg = m.getContext('2d');
			mg.drawImage(f, 0, 0, w, h);
			mg.drawImage(f, 0, 0, w, h);
			mg.globalCompositeOperation = 'source-in';
			mg.fillStyle = '#000';
			mg.fillRect(0, 0, m.width, m.height);
			g.drawImage(m, x, y);
		});
		return c.toDataURL('image/jpeg', QUALITY);
	}

	/* { key, data } of the current public picture, or null (no picture / not ready / unreadable) */
	gv.vcnvPublicImage = function () {
		var data = gv.VcnvData || {};
		if (gv.CurrentRound !== 'vcnv' && gv.VcnvSequenceCounter < 2) { return null; }
		load(data.image || '');
		if (!img || !ready || failed) { return null; }
		if (Object.keys(frames).some(function (k) { return !frames[k].__ok; })) { setTimeout(function () { gv.changed(); }, 300); return null; }
		var closed = closedCovers();
		var key = 'v' + (imgSrc.length + ':' + closed.join(''));
		key = key + ':' + hash(imgSrc);
		if (cache.key !== key) {
			try { cache = { key: key, data: compose(closed) }; }
			catch (e) { failed = true; console.warn('[VCNV] the picture cannot be read back (no CORS) - players see the covers only', e); return null; }
		}
		return cache;
	};

	function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(36); }
})(window.GameVariables);
