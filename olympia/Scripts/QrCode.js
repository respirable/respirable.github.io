/*
 * Olympia Controller - QR codes for the room's links (lobby share dialog, control panel).
 * Needs qrcode-generator (cdn.jsdelivr.net/npm/qrcode-generator) loaded first; draws on a canvas,
 * dark modules on white with a quiet zone, so phones read it from a projector too.
 *
 *   OlympiaQr.canvas(text, sizePx)  -> <canvas>, or a <p> saying why not
 */
(function () {
	window.OlympiaQr = {
		canvas: function (text, size) {
			if (typeof window.qrcode !== 'function') {
				var p = document.createElement('p'); p.className = 'meta'; p.textContent = 'Không tải được thư viện mã QR (cần mạng).';
				return p;
			}
			var qr = window.qrcode(0, 'M');
			qr.addData(String(text || ''));
			qr.make();
			var n = qr.getModuleCount(), quiet = 4, cells = n + quiet * 2;
			var px = Math.max(1, Math.floor((size || 256) / cells));
			var c = document.createElement('canvas');
			c.width = c.height = cells * px;
			c.className = 'qr';
			var g = c.getContext('2d');
			g.fillStyle = '#fff';
			g.fillRect(0, 0, c.width, c.height);
			g.fillStyle = '#000';
			for (var r = 0; r < n; r++) {
				for (var k = 0; k < n; k++) { if (qr.isDark(r, k)) { g.fillRect((k + quiet) * px, (r + quiet) * px, px, px); } }
			}
			c.setAttribute('role', 'img');
			c.setAttribute('aria-label', 'Mã QR: ' + text);
			return c;
		}
	};
})();
