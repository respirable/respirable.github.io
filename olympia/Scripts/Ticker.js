/*
 * Olympia Controller - timers that keep their pace in a background tab.
 *
 * The engine runs inside the control panel. When that tab is not the visible one (the host looks
 * at the stage window, another app...), the browser slows the page's own setTimeout / setInterval
 * to once a second, and after 5 minutes to once a minute. The engine's state heartbeat then
 * arrived late at the screens (which took the engine for gone and cut the sound), and a buzz
 * waited for a slowed timer. A worker's timers are not slowed: this file runs the timers in a
 * small worker and calls back on the page. Where a worker cannot start, the page's own timers.
 *
 *   OlympiaTicker.setTimeout(fn, ms) / setInterval(fn, ms) -> handle;  OlympiaTicker.clear(handle)
 */
(function () {
	var worker = null, next = 1, calls = {};
	try {
		var src = 'var t={};onmessage=function(e){var d=e.data;' +
			'if(d.op==="set"){t[d.id]=(d.every?setInterval:setTimeout)(function(){postMessage(d.id);},d.ms);}' +
			'else{clearTimeout(t[d.id]);clearInterval(t[d.id]);delete t[d.id];}};';
		worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
		worker.onmessage = function (e) {
			var c = calls[e.data];
			if (!c) { return; }
			if (!c.every) { delete calls[e.data]; }
			c.fn();
		};
	}
	catch (e) { worker = null; }

	function set(fn, ms, every) {
		if (!worker) { return { page: every ? setInterval(fn, ms) : setTimeout(fn, ms) }; }
		var id = next++;
		calls[id] = { fn: fn, every: every };
		worker.postMessage({ op: 'set', id: id, ms: Math.max(0, ms || 0), every: every });
		return { id: id };
	}

	window.OlympiaTicker = {
		setTimeout: function (fn, ms) { return set(fn, ms, false); },
		setInterval: function (fn, ms) { return set(fn, ms, true); },
		clear: function (h) {
			if (!h) { return; }
			if (h.page !== undefined) { clearTimeout(h.page); clearInterval(h.page); return; }
			delete calls[h.id];
			if (worker) { worker.postMessage({ op: 'clear', id: h.id }); }
		}
	};
})();
