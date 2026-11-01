/*
 * Olympia Controller - puts the Olympia 26 frames (O26Frames.js) on the stage when the rules are
 * 'o26' (Rules.js, body.rulesO26). The O24 elements stay where they are and keep their jobs - the
 * rounds, the screens' mirror (AudienceMirror.js) and the scene (PanelStateControl.js) still read
 * and write them; under O26 their pictures are hidden (Styles/o26.css) and a frame is drawn in the
 * same box instead:
 *
 *   .questionBarDiv (plain skin = Khởi động)   02  header from the contestant bars (red = on stage /
 *                                                  buzzed), .questionTextP laid over the body
 *   .summaryDiv                                01  .summaryNameP / .summaryScoreP over band and body
 *   .vdChooseDiv                               04  the ticks of the choose screen = the red cells
 *   .vdQuestionGroup                           03  header from the name tabs (blue = on stage, red
 *                                                  = stealing), score from .vdScoreP, the package
 *                                                  from VeDichValues / VeDichQuestionIndex
 *   .vcnvTreeDiv                               05 / 06  VcnvTreeControl.js builds the rows itself
 *
 * A frame opens (O26.open) when its box comes on screen - watched here with a MutationObserver on
 * the box's class, so the engine and the screens (which only flip the same classes) both animate.
 * The 04 board closes into the middle when the choose screen goes, and 03 opens from there (09).
 * Leaving is instant otherwise, as in O24. o26Refresh() redraws the changing parts (names,
 * scores, tags, cells); the modules call it where they change the O24 elements.
 */

var O26_TEXT_DELAY = 0.55;   /* the box's own text shows once the frame is this far open */
var O26_VD_GAP_MS = 0;       /* between the 04 board closing and the 03 frame opening */

function o26On() { return !!(window.O26 && window.O26.active()); }
function o26Q(sel) { return document.querySelector(sel); }
function o26Svg(holder) { return holder ? holder.querySelector(':scope > svg.o26Svg') : null; }

/* the Khởi động bar is an O26 frame only in its plain skin (Câu hỏi phụ keeps the O24 timer bar) */
function o26KdHolder() {
	var root = o26Q('.questionBarDiv');
	return root && root.classList.contains('plainSkin') ? root : null;
}

/* shrink an HTML text box's type until it fits (max / min px) */
function o26FitHtml(p, max, min) {
	if (!p) { return; }
	p.style.fontSize = '';
	if (!o26On() || !p.textContent) { return; }
	var size = max;
	p.style.fontSize = size + 'px';
	while (size > min && (p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1)) {
		size -= 2;
		p.style.fontSize = size + 'px';
	}
}

/* ---------- the changing parts ---------- */

function o26KdHeader() {
	var gv = window.GameVariables;
	return [1, 2, 3, 4].map(function (seat) {
		var p = gv.getPlayer(seat), bar = typeof getContestantBar === 'function' ? getContestantBar(seat) : null;
		if (!p) { return { name: '', score: '', tag: null }; }
		var score = bar ? bar.querySelector('.contestantScoreP').textContent : String(p.score);
		var hot = bar ? (bar.classList.contains('onStage') || bar.classList.contains('buzzed')) : (p.isOnStage || p.isBuzzed);
		return { name: seat + '.' + gv.displayName(p), score: score, tag: hot ? 'red' : null };
	});
}

function o26VdHeader() {
	return [1, 2, 3, 4].map(function (seat) {
		var tab = o26Q('.vdDiv .vdTab.seat' + seat);
		if (!tab) { return { text: '', tag: null }; }
		return {
			text: tab.querySelector('.vdTabTextP').textContent,
			tag: tab.classList.contains('onStage') ? 'blue' : (tab.classList.contains('stealing') ? 'red' : null)
		};
	});
}

/* the choose screen's ticks: picked[0 = 20 | 1 = 30][question k] */
function o26ChoosePicks() {
	return [20, 30].map(function (v) {
		return Array.prototype.map.call(document.querySelectorAll('.vdDiv .vdChooseBox.value' + v + ' .vdTickP'), function (t) { return !!t.textContent; });
	});
}

function o26Refresh() {
	if (!o26On()) { return; }
	var gv = window.GameVariables;
	var kd = o26Svg(o26KdHolder());
	if (kd) { O26.setHeader(kd, o26KdHeader()); }
	var vd = o26Svg(o26Q('.vdDiv .vdQuestionGroup'));
	if (vd) {
		O26.setHeader(vd, o26VdHeader());
		var s = o26Q('.vdDiv .vdScoreP');
		O26.setScore(vd, s ? s.textContent : '');
		var values = (gv.VeDichValues || []).slice(0, 3);
		O26.setCells(vd, [0, 1, 2].map(function (k) { return values[k] || ''; }), (gv.VeDichQuestionIndex || 0) - 1);
	}
	var ch = o26Svg(o26Q('.vdDiv .vdChooseDiv'));
	if (ch) { O26.setPicks(ch, o26ChoosePicks()); }
	var sm = o26Svg(o26Q('.summaryDiv'));
	if (sm) {
		var n = o26Q('.summaryDiv .summaryNameP'), sc = o26Q('.summaryDiv .summaryScoreP');
		O26.setSummary(sm, n ? n.textContent : '', sc ? sc.textContent : '');
	}
}

/* Về đích timer strip: fraction 0..1 as drawn (already reversed for the steal), null = hidden */
function o26VdTimer(fraction) {
	if (!o26On()) { return; }
	O26.setTimer(o26Svg(o26Q('.vdDiv .vdQuestionGroup')), fraction);
}

/* ---------- entrances ---------- */

/* open the frame of `kind` in `holder`; the holder's own text waits (.o26Wait) until it is half open */
function o26OpenIn(holder, kind) {
	var svg = O26.mount(holder, kind);
	o26Refresh();
	holder.classList.add('o26Wait');
	clearTimeout(holder._o26Text);
	holder._o26Text = setTimeout(function () { holder.classList.remove('o26Wait'); }, O26.openTime(svg) * O26_TEXT_DELAY);
	return O26.open(svg).then(function () { O26.fitAll(svg); });
}

function o26Shown(holder) {
	clearTimeout(holder._o26Text);
	holder.classList.remove('o26Wait');
	O26.finish(o26Svg(holder));
}

/* watch a box: show() when `isUp` turns true, hide() when it turns false */
function o26Watch(el, isUp, show, hide) {
	if (!el || el._o26Watch) { return; }
	var up = false;
	el._o26Watch = new MutationObserver(function () {
		var now = o26On() && isUp(el);
		if (now === up) { return; }
		up = now;
		if (now) { show(el); } else if (hide) { hide(el); }
	});
	el._o26Watch.observe(el, { attributes: true, attributeFilter: ['class'] });
}

function o26Setup() {
	o26Watch(o26Q('.questionBarDiv'),
		function (el) { return !el.classList.contains('offstage') && el.classList.contains('plainSkin'); },
		function (el) { o26OpenIn(el, 'kd'); o26HeaderUp(true); },
		function (el) { o26Shown(el); o26HeaderUp(false); });
	o26Watch(o26Q('.summaryDiv'),
		function (el) { return !el.classList.contains('offstage'); },
		function (el) { o26OpenIn(el, 'summary'); },
		o26Shown);
	o26SetupVeDich();
}

/* .vdChooseDiv / .vdQuestionGroup exist once renderVeDich() has run */
function o26SetupVeDich() {
	var choose = o26Q('.vdDiv .vdChooseDiv'), group = o26Q('.vdDiv .vdQuestionGroup');
	if (!choose || !group) { return; }
	o26Watch(choose,
		function (el) { return el.classList.contains('on'); },
		function (el) { el.classList.remove('o26Closing'); o26OpenIn(el, 'choose'); },
		function (el) {
			/* 09: the board closes into the middle, the question frame opens from there */
			var svg = o26Svg(el);
			if (!svg || !isVeDichShowing()) { return; }
			O26.finish(svg);
			el.classList.add('o26Closing');
			el._o26Closing = O26.close(svg).then(function () { el.classList.remove('o26Closing'); });
		});
	o26Watch(group,
		function (el) { return el.classList.contains('on'); },
		function (el) { o26OpenIn(el, 'vd'); o26HeaderUp(true); },
		function (el) { o26Shown(el); o26HeaderUp(false); });
}

/* the contestant bars at the bottom right make way while a frame with the four-name header is up */
function o26HeaderUp(on) {
	var up = !!(o26Q('.questionBarDiv.plainSkin:not(.offstage)') || o26Q('.vdDiv:not(.offstage) .vdQuestionGroup.on'));
	document.body.classList.toggle('o26HeaderUp', on ? true : up);
}

/* Về đích: how long the engine waits between the choose screen going and the question frame
 * coming (O24: VD_GROUP_DELAY_MS) - under O26, as long as the board takes to close */
function o26VdGroupDelay(fallback) { return o26On() ? O26.CLOSE_MS + O26_VD_GAP_MS : fallback; }

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', o26Setup); } else { o26Setup(); }
