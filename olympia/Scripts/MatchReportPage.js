/*
 * Olympia Controller - the hover layer of the match report (MatchReport.js writes the page and
 * window.REPORT = { names, points: [{ t, r, s: [scores], x: what changed }] }; initReportChart() after each draw): a crosshair on the step
 * under the pointer and a tooltip with the four scores at that moment. Keyboard: the chart takes
 * focus, ← / → step through the changes.
 */
window.initReportChart = function () {
	var svg = document.querySelector('svg.chart'), tip = document.getElementById('tip'), cross = document.getElementById('cross');
	if (!svg || !tip || !window.REPORT) { return; }
	var hits = Array.prototype.slice.call(svg.querySelectorAll('.hit')), cur = -1;
	function text(tag, cls, t) { var e = document.createElement(tag); if (cls) { e.className = cls; } e.textContent = t; return e; }
	function show(i) {
		var p = REPORT.points[i], hit = hits[i];
		if (!p || !hit) { return; }
		cur = i;
		var x = Number(hit.getAttribute('data-x'));
		cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.classList.add('on');
		tip.textContent = '';
		tip.appendChild(text('div', 'tt', p.t + ' · ' + p.r));
		tip.appendChild(text('div', 'tx', p.x));
		var order = p.s.map(function (v, k) { return { v: v, k: k }; }).sort(function (a, b) { return b.v - a.v; });
		order.forEach(function (o) {
			var row = document.createElement('div'); row.className = 'tr';
			row.appendChild(text('i', 'key s' + (o.k + 1), ''));
			row.appendChild(text('span', '', REPORT.names[o.k] || ''));
			row.appendChild(text('b', '', String(o.v)));
			tip.appendChild(row);
		});
		tip.hidden = false;
		var box = svg.getBoundingClientRect(), wrap = svg.parentNode.getBoundingClientRect();
		var px = box.left - wrap.left + x * box.width / svg.viewBox.baseVal.width;
		var left = px + 14;
		if (left + tip.offsetWidth > wrap.width) { left = px - 14 - tip.offsetWidth; }
		tip.style.left = Math.max(0, left) + 'px';
		tip.style.top = '8px';
	}
	function hide() { tip.hidden = true; cross.classList.remove('on'); }
	hits.forEach(function (h, i) { h.addEventListener('pointerenter', function () { show(i); }); });
	svg.addEventListener('pointerleave', hide);
	svg.setAttribute('tabindex', '0');
	svg.addEventListener('keydown', function (e) {
		if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
			e.preventDefault();
			show(Math.max(0, Math.min(hits.length - 1, (cur < 0 ? 0 : cur + (e.key === 'ArrowRight' ? 1 : -1)))));
		}
		else if (e.key === 'Escape') { hide(); }
	});
	svg.addEventListener('blur', hide);
};
