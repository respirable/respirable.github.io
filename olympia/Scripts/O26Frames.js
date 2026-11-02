/*
 * Olympia Controller - the Olympia 26 frames (rules 'o26', Rules.js): SVG drawn in code, after the
 * "Khung đồ hoạ Olympia - bản vector" sheet (frames measured off the broadcast). 1000 units wide.
 *
 *   summary  01  the score summary (M): name on the bright band, score in the body
 *   kd       02  Khởi động: four header cells "n.Name  score", the red tag = on stage / buzzed;
 *                the question is the page's own .questionTextP laid over the body
 *   vd       03  Về đích: header "Name (score)" (blue = on stage, red = stealing), the score box,
 *                three cells under it = the package (20 / 30, the current one red), the timer
 *                strip in the metal groove
 *   choose   04  the package board, two rows (20 / 30) x three questions - as tall as 03 and 72 %
 *                of its length, so it can close into the middle and 03 open from there (09)
 *   row      05 / 06  one answer row: name | answer | time (Tăng tốc) or name | answer (VCNV)
 *
 * Every frame opens the same way: two clusters of arrows rush in from the sides, cross in the
 * middle and the frame opens out between them (O26.open); O26.close runs it backwards.
 * Text uses the O26 face (Styles/o26.css). Used by QuestionControl, ScoreSummaryControl,
 * VeDichControl and VcnvTreeControl when gv.isO26().
 */
(function(){
const FONT = "'O26', 'ITC Avant Garde Gothic', 'Century Gothic', Arial, sans-serif";
let W = 1000;
const SL = 0.335;
const f = n => +n.toFixed(2);
const P = a => a.map(([x, y]) => f(x) + ',' + f(y)).join(' ');
let uid = 0;

const SPEC = {
  A: {H:268, oT:80, oP:38, iT:126, iP:80, c1:31, c2:237, tip:2},
  B: {H:172, oT:50, oP:23, iT:78,  iP:49, c1:17, c2:155, tip:0},
  D: {H:270, oT:84, oP:40, iT:128, iP:84, c1:37, c2:233, tip:4}
};


const hex = (t, p, H) => [[t,0],[W-t,0],[W-p,H/2],[W-t,H],[t,H],[p,H/2]];
const inL = (s, y) => { const h = s.H/2; return s.iP + (s.iT - s.iP) * Math.abs(y - h) / h; };

function open(s, label){
  const pad = 4;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${W + 2*pad} ${s.H + 2*pad}" role="img" aria-label="${label}" data-bt="${s.oP + 6}" data-sl="${f((s.oT - s.oP)/(s.H/2))}" data-h="${s.H}" data-w="${W}" data-ot="${s.oT}" data-op="${s.oP}" data-it="${s.iT}" data-ip="${s.iP}">`;
}

function defs(p, s){
  return `<defs>
<linearGradient id="${p}body" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0"><stop offset="0" stop-color="#081c3a"/><stop offset=".1" stop-color="#092247"/><stop offset=".4" stop-color="#092751"/><stop offset=".64" stop-color="#092d67"/><stop offset=".86" stop-color="#093278"/><stop offset="1" stop-color="#0a357f"/></linearGradient>
<linearGradient id="${p}cyan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14a9f8"/><stop offset=".5" stop-color="#0390ee"/><stop offset="1" stop-color="#0b9af2"/></linearGradient>
<linearGradient id="${p}chrome" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0"><stop offset="0" stop-color="#c2cad6"/><stop offset=".18" stop-color="#9aa4b4"/><stop offset=".3" stop-color="#7a8597"/><stop offset=".48" stop-color="#dfe5ee"/><stop offset=".66" stop-color="#7c879a"/><stop offset=".86" stop-color="#e9eff7"/><stop offset="1" stop-color="#f7fafd"/></linearGradient>
<linearGradient id="${p}side" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0"><stop offset="0" stop-color="#a6b1c2"/><stop offset=".5" stop-color="#c3ccda"/><stop offset="1" stop-color="#eef5fd"/></linearGradient>
<linearGradient id="${p}inner" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0"><stop offset="0" stop-color="#97afcf"/><stop offset=".5" stop-color="#b2c9e6"/><stop offset="1" stop-color="#d4eeff"/></linearGradient>
<linearGradient id="${p}shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000f2c" stop-opacity=".95"/><stop offset="1" stop-color="#000f2c" stop-opacity="0"/></linearGradient>
<clipPath id="${p}in" class="cin"><polygon points="${P(hex(s.iT, s.iP, s.H))}"/></clipPath>
<filter id="${p}glow" filterUnits="userSpaceOnUse" x="-20" y="-20" width="${W + 40}" height="${s.H + 40}"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="${p}ts" filterUnits="userSpaceOnUse" x="-20" y="-20" width="${W + 40}" height="${s.H + 40}"><feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-color="#00081a" flood-opacity=".6"/></filter>
</defs>`;
}

function base(p, s){
  const h = s.H/2, sl = (s.oT - s.oP)/h;
  const xo = y => s.tip + sl * Math.abs(h - y);
  const th = s.oP - s.tip + 6;
  const c = [[xo(s.c1), s.c1],[xo(s.c1)+th, s.c1],[s.tip+th, h],[xo(s.c2)+th, s.c2],[xo(s.c2), s.c2],[s.tip, h]];
  const e = y => s.oP - 2.4 + sl * Math.abs(h - y);
  const hi = [[e(s.c1+2), s.c1+2],[e(h), h],[e(s.c2-2), s.c2-2]];
  return `<g class="chL"><g id="${p}chev"><polygon points="${P(c)}" fill="url(#${p}cyan)" stroke="#7fdaf7" stroke-width="1.4" stroke-linejoin="round"/><polyline points="${P(hi)}" fill="none" stroke="#66d0f3" stroke-width="3"/></g>
</g><g class="chR"><use href="#${p}chev" transform="matrix(-1 0 0 1 ${W} 0)"/></g>
<polygon points="${P(hex(s.oT, s.oP, s.H))}" fill="url(#${p}body)"/>`;
}

function edges(p, s){
  const h = s.H/2, H = s.H;
  return `<line x1="${s.oT}" y1="1" x2="${W - s.oT}" y2="1" stroke="#4f7fd0" stroke-width="2.2"/>
<polyline class="capL" points="${P([[s.oT,0],[s.oP,h],[s.oT,H]])}" fill="none" stroke="url(#${p}side)" stroke-width="2.6"/>
<polyline class="capR" points="${P([[W-s.oT,0],[W-s.oP,h],[W-s.oT,H]])}" fill="none" stroke="url(#${p}side)" stroke-width="2.6"/>
<line x1="${s.oT}" y1="${H-1.3}" x2="${W - s.oT}" y2="${H-1.3}" stroke="url(#${p}chrome)" stroke-width="2.8"/>
<g filter="url(#${p}glow)" fill="none" stroke="url(#${p}inner)" stroke-width="2.6"><polyline class="capL" points="${P([[s.iT,0],[s.iP,h],[s.iT,H]])}"/><polyline class="capR" points="${P([[W-s.iT,0],[W-s.iP,h],[W-s.iT,H]])}"/></g>`;
}

const slash = (cx, yc, len) => `<line x1="${f(cx + SL*len/2)}" y1="${f(yc - len/2)}" x2="${f(cx - SL*len/2)}" y2="${f(yc + len/2)}"/>`;
const slashes = (p, list) => `<g clip-path="url(#${p}in)"><g class="sl" filter="url(#${p}glow)" stroke="#eaf8ff" stroke-width="2.6" stroke-linecap="round">${list.join('')}</g></g>`;

function textGroup(p, inner){
  return `<g class="demo" filter="url(#${p}ts)" font-family="${FONT}" fill="#f2f6fb" text-anchor="middle">${inner}</g>`;
}


/* 01 — khung có băng tiêu đề sáng */
function panelA(o){
  o = o || {};
  const s = SPEC.A, p = 'a' + (uid++) + '_';
  let out = open(s, 'Khung câu hỏi có băng tiêu đề') + defs(p, s) +
  `<defs><linearGradient id="${p}band" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0"><stop offset=".13" stop-color="#0a285c"/><stop offset=".31" stop-color="#072a67"/><stop offset=".43" stop-color="#083185"/><stop offset=".55" stop-color="#0a3395"/><stop offset=".67" stop-color="#0838b3"/><stop offset=".79" stop-color="#093bd5"/><stop offset=".88" stop-color="#0a3fec"/><stop offset="1" stop-color="#0b42f4"/></linearGradient>
<linearGradient id="${p}bline" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0"><stop offset="0" stop-color="#21508f"/><stop offset=".5" stop-color="#2c63b3"/><stop offset="1" stop-color="#3d7ad6"/></linearGradient></defs>` +
  base(p, s) +
  `<g clip-path="url(#${p}in)"><rect x="0" y="0" width="${W}" height="57" fill="url(#${p}band)"/><rect x="0" y="54.6" width="${W}" height="2.4" fill="url(#${p}bline)"/><rect x="0" y="57" width="${W}" height="6" fill="url(#${p}shade)"/></g>` +
  edges(p, s);
  out += textGroup(p,
    `<text class="o26an" data-max="700" x="500" y="41" font-size="36" letter-spacing="1">${escT(o.name || '')}</text>
<text class="o26as" data-max="560" x="500" y="196" font-size="104">${escT(o.score == null ? '' : o.score)}</text>`);
  return out.replace('<svg ', '<svg data-intro="1" ') + '</svg>';
}

/* băng tiêu đề 4 ô dùng chung cho 02 và 03 */
const escT = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/* thẻ tên: ô tiêu đề đổi màu (xanh hoặc đỏ), cạnh nghiêng theo vạch chia */
function tagShape(p, kind, pts){
  const blue = kind === 'blue', id = p + 'tg' + kind;
  const stops = blue
    ? '<stop offset="0" stop-color="#072861"/><stop offset=".5" stop-color="#0636a8"/><stop offset="1" stop-color="#0941f9"/>'
    : '<stop offset="0" stop-color="#6a083e"/><stop offset=".5" stop-color="#aa093e"/><stop offset="1" stop-color="#e5083a"/>';
  const [a, b, c] = pts;
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient></defs><polygon points="${P(pts)}" fill="url(#${id})"/>` +
    (blue ? `<polyline points="${P([a, b, c])}" fill="none" stroke="#8fe8f5" stroke-width="1.4" stroke-linejoin="round" opacity=".9"/>`
          : `<line x1="${f(a[0])}" y1="${f(a[1] + .7)}" x2="${f(b[0])}" y2="${f(b[1] + .7)}" stroke="#ff7a99" stroke-width="1.1" opacity=".55"/>`);
}

function header4(p, s, rightAt){
  const yc = 18, l = inL(s, yc), r = rightAt(yc), seg = (r - l) / 4;
  const sl = [], centers = [];
  for (let i = 0; i < 4; i++){ centers.push(l + seg * (i + .5)); if (i) sl.push(slash(l + seg*i, yc, 26)); }
  const bnd = (k, y) => k === 0 ? inL(s, y) : k === 4 ? rightAt(y) : l + seg * k - SL * (y - yc);
  let tg = '';
  /* every cell carries both tags, hidden; O26.setHeader shows one (or none) */
  [0, 1, 2, 3].forEach(i => {
    const L = y => bnd(i, y) + (i === 0 ? 0 : 1.2), R = y => bnd(i + 1, y) - 1.2;
    const pts = [[L(0), 0],[R(0), 0],[R(35.7), 35.7],[L(35.7), 35.7]];
    tg += `<g class="o26tag" data-i="${i}"><g class="tB" opacity="0">${tagShape(p + i, 'blue', pts)}</g><g class="tR" opacity="0">${tagShape(p + i, 'red', pts)}</g></g>`;
  });
  const band = `<g clip-path="url(#${p}in)">${tg}<rect x="0" y="33.4" width="${W}" height="2.3" fill="#2c60ab"/><rect x="0" y="35.7" width="${W}" height="4.5" fill="url(#${p}shade)"/></g>`;
  return {band, marks: slashes(p, sl), centers, lefts: [0,1,2,3].map(i => l + seg * i), rights: [0,1,2,3].map(i => l + seg * (i + 1))};
}

/* split: "n.Name" at the left of the cell, the score at its right (Khởi động);
   center: one centred text, "Name (score)" (Về đích) */
function headerTexts(hd, layout){
  const ff = `font-size="16"`;
  return hd.lefts.map((x0, i) => layout === 'center'
    ? `<text class="o26hc" data-i="${i}" data-max="${f(hd.rights[i] - x0 - 30)}" x="${f((x0 + hd.rights[i]) / 2)}" y="26" text-anchor="middle" ${ff}></text>`
    : `<text class="o26hn" data-i="${i}" data-max="${f(hd.rights[i] - x0 - 70)}" x="${f(x0 + 10)}" y="26" text-anchor="start" ${ff}></text><text class="o26hs" data-i="${i}" x="${f(hd.rights[i] - 18)}" y="26" text-anchor="end" ${ff}></text>`).join('');
}

/* 02 — khung 4 ô tiêu đề */
function panelB(){
  const s = SPEC.B, p = 'b' + (uid++) + '_';
  const hd = header4(p, s, y => W - inL(s, y));
  let out = open(s, 'Khung câu hỏi với bốn ô tiêu đề') + defs(p, s) + base(p, s) + hd.band + edges(p, s) + hd.marks;
  out += textGroup(p, headerTexts(hd, 'split'));
  return out.replace('<svg ', '<svg data-intro="1" ') + '</svg>';
}

/* 03 — khung có ô điểm bên phải */
function panelC(o){
  o = o || {};
  const idx = 0, stC = [0, 0, 0];
  const s = SPEC.B, p = 'c' + (uid++) + '_', H = s.H;
  const bx = y => 833 - SL * y;
  const hd = header4(p, s, bx);
  const yS = 138.6, yMid = 152.5;
  const L = bx(yMid), R = W - inL(s, yMid), seg = (R - L) / 3;
  const d = [L, L + seg, L + 2*seg, R];
  const xk = (k, y) => d[k] + SL * (yMid - y);
  const redStops = [
    ['#3c1a40', '#5c1842', '#751541'],
    ['#3c1a40', '#5c1842', '#751541'],
    ['#3e2359', '#5d2059', '#771b58']
  ];
  let g = '', cells = '', vals = '';
  for (let k = 0; k < 3; k++){
    const y0 = yS + 1.2, y1 = H;
    const lx = y => k === 0 ? bx(y) + 2.4 : xk(k, y) + 3;
    const rx = y => k === 2 ? W : xk(k + 1, y) - 3;
    const poly = [[lx(y0), y0],[rx(y0), y0],[rx(y1), y1],[lx(y1), y1]];
    const st = redStops[k];
    g += `<linearGradient id="${p}r${k}" gradientUnits="userSpaceOnUse" x1="${f(lx(yMid))}" y1="0" x2="${f(Math.min(rx(yMid), R))}" y2="0"><stop offset="0" stop-color="${st[0]}"/><stop offset=".5" stop-color="${st[1]}"/><stop offset="1" stop-color="${st[2]}"/></linearGradient>`;
    cells += `<g class="cell" data-k="${k}"><polygon class="red" points="${P(poly)}" fill="url(#${p}r${k})" opacity="${stC[k] ? 1 : 0}"/></g>`;
    const ym = (y0 + y1) / 2, cx = (lx(ym) + Math.min(rx(ym), R - 4)) / 2;
    vals += `<text class="o26cv" data-k="${k}" x="${f(cx)}" y="${f(ym + 8)}" font-size="22"></text>`;
  }
  const bar = (() => {
    const xl = y => inL(s, y) + 1.8, xr = y => bx(y) - 1.8, y0 = 155.6, y1 = 169;
    const pl = [[xl(y0), y0],[xr(y0), y0],[xr(y1), y1],[xl(y1), y1]];
    const px0 = Math.max(xl(160.2), xl(165.6)) + 6, px1 = Math.min(xr(160.2), xr(165.6)) - 6;
    return `<polygon points="${P(pl)}" fill="url(#${p}chrome)"/><line x1="${f(xl(y0))}" y1="${y0 + .5}" x2="${f(xr(y0))}" y2="${y0 + .5}" stroke="#4d5e79" stroke-width="1" opacity=".8"/><rect x="${f(px0)}" y="160.2" width="${f(px1 - px0)}" height="5.4" rx="2.7" ry="2.7" fill="#25272d"/><rect x="${f(px0 + 3)}" y="160.2" width="${f(px1 - px0 - 6)}" height="1.2" fill="#000" opacity=".35"/>` +
      `<g class="o26timer" opacity="0" data-x0="${f(px0)}" data-w="${f(px1 - px0)}"><rect class="o26tfill" x="${f(px0)}" y="160.2" width="0" height="5.4" rx="2.7" ry="2.7" fill="url(#${p}tf)"/><circle class="o26tdot" cx="${f(px0)}" cy="162.9" r="5.3" fill="#b5043e" filter="url(#${p}tglow)"/></g>`;
  })();
  let out = open(s, 'Khung câu hỏi có ô điểm') + defs(p, s) +
  `<defs><linearGradient id="${p}blk" gradientUnits="userSpaceOnUse" x1="800" y1="0" x2="935" y2="0"><stop offset="0" stop-color="#063899"/><stop offset=".45" stop-color="#0739ae"/><stop offset=".75" stop-color="#073cd3"/><stop offset="1" stop-color="#0740ec"/></linearGradient><linearGradient id="${p}tf" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#272523"/><stop offset="1" stop-color="#b5043e"/></linearGradient><filter id="${p}tglow" filterUnits="userSpaceOnUse" x="0" y="140" width="${W}" height="45"><feMorphology in="SourceAlpha" operator="dilate" radius="1.2" result="d"/><feGaussianBlur in="d" stdDeviation="2" result="b"/><feFlood flood-color="#b5043e" flood-opacity=".75"/><feComposite in2="b" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<linearGradient id="${p}blkv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".06"/><stop offset=".25" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity=".08"/></linearGradient><linearGradient id="${p}strip" gradientUnits="userSpaceOnUse" x1="787" y1="0" x2="935" y2="0"><stop offset="0" stop-color="#082140"/><stop offset=".45" stop-color="#062b5d"/><stop offset="1" stop-color="#0d3274"/></linearGradient>${g}</defs>` +
  base(p, s) + hd.band +
  `<g clip-path="url(#${p}in)"><g class="blk">
<polygon points="${P([[bx(0),0],[W,0],[W,136],[bx(136),136]])}" fill="url(#${p}blk)"/>
<polygon points="${P([[bx(0),0],[W,0],[W,136],[bx(136),136]])}" fill="url(#${p}blkv)"/>
<polygon points="${P([[bx(136),136],[W,136],[W,yS],[bx(yS),yS]])}" fill="#001f45"/>
<polygon points="${P([[bx(yS),yS],[W,yS],[W,H],[bx(H),H]])}" fill="url(#${p}strip)"/>
${cells}</g>${bar}<g class="bov" opacity="0"><polygon points="${P([[0,0],[W,0],[W,35.7],[0,35.7]])}" fill="url(#${p}body)"/><polygon points="${P([[0,33.4],[W,33.4],[W,35.7],[0,35.7]])}" fill="#2c60ab"/></g></g>` +
  edges(p, s) +
  `<g clip-path="url(#${p}in)"><g class="blk" filter="url(#${p}glow)"><line x1="${f(bx(0))}" y1="0" x2="${f(bx(H))}" y2="${H}" stroke="#b8d0ec" stroke-width="3.2"/></g></g>` +
  hd.marks + `<g style="pointer-events:none">${slashes(p, [slash(d[1], yMid, 25), slash(d[2], yMid, 25)])}</g>`;
  const sc = (bx(68) + (W - inL(s, 68))) / 2;
  out += textGroup(p, headerTexts(hd, 'center') + vals +
    `<text class="o26score" data-max="${f(W - inL(s, 68) - bx(68) - 24)}" x="${f(sc)}" y="103" font-size="52"></text>`);
  return out.replace('<svg ', '<svg data-intro="1" ') + '</svg>';
}

/* 04 — bảng chọn gói câu hỏi 20/30 */
function panelD(o){
  o = o || {};
  const save = W; W = o.width || 1000;
  try { return panelDInner(o); } finally { W = save; }
}
function panelDInner(o){
  const stD = [[0,0,0],[0,0,0]];
  const s = o.spec || SPEC.D, kk = s.H / SPEC.D.H, p = 'd' + (uid++) + '_', H = s.H;
  const dv = (x0, y) => x0 - y / 3;
  const third = (W - 2 * s.iP) / 3, D0 = W === 1000 && !o.spec ? [406, 686] : [s.iP + third + s.H / 6, s.iP + 2 * third + s.H / 6];
  const rows = [[11, 125], [148, 263]].map(r => r.map(v => v * kk)), vals = ['20', '30'];
  const clipIn = hex(s.iT + 2.5, s.iP + 2.5, H);
  let g = '', cells = '', nums = '';
  rows.forEach(([a, b], r) => {
    const m = (a + b) / 2;
    for (let k = 0; k < 3; k++){
      const lx = y => k === 0 ? -20 : dv(D0[k-1], y) + 4;
      const rx = y => k === 2 ? W + 20 : dv(D0[k], y) - 4;
      const poly = [[lx(a), a],[rx(a), a],[rx(b), b],[lx(b), b]];
      const gl = k === 0 ? inL(s, m) : dv(D0[k-1], m);
      const gr = k === 2 ? W - inL(s, m) : dv(D0[k], m);
      g += `<linearGradient id="${p}g${r}${k}" gradientUnits="userSpaceOnUse" x1="${f(gl)}" y1="0" x2="${f(gr)}" y2="0"><stop offset="0" stop-color="#5e0a35"/><stop offset=".32" stop-color="#94093f"/><stop offset=".77" stop-color="#c8093e"/><stop offset="1" stop-color="#cf1244"/></linearGradient>`;
      cells += `<g class="cell" data-r="${r}" data-k="${k}"><polygon class="red" points="${P(poly)}" fill="url(#${p}g${r}${k})" opacity="${stD[r][k] ? 1 : 0}"/></g>`;
      nums += `<text x="${f((gl + gr) / 2)}" y="${f(m + 21 * kk)}">${vals[r]}</text>`;
    }
  });
  let out = open(s, 'Bảng chọn gói câu hỏi 20 và 30 điểm') + defs(p, s) +
  `<defs>${g}<clipPath id="${p}in2" class="cin2"><polygon points="${P(clipIn)}"/></clipPath></defs>` +
  base(p, s) +
  `<g clip-path="url(#${p}in2)">${cells}</g>
<g clip-path="url(#${p}in)" style="pointer-events:none">
<rect x="0" y="${f(132.6 * kk)}" width="${W}" height="${f(5.8 * kk)}" fill="url(#${p}chrome)"/>
<rect x="0" y="${f(132.2 * kk)}" width="${W}" height="1" fill="#0a1a33" opacity=".6"/>
<g stroke-linecap="butt">
<line x1="${f(D0[0])}" y1="-2" x2="${f(dv(D0[0], H + 2))}" y2="${H + 2}" stroke="#aeb9c7" stroke-width="4.8"/>
<line x1="${f(D0[1])}" y1="-2" x2="${f(dv(D0[1], H + 2))}" y2="${H + 2}" stroke="#aeb9c7" stroke-width="4.8"/>
<line x1="${f(D0[0])}" y1="-2" x2="${f(dv(D0[0], H + 2))}" y2="${H + 2}" stroke="#e6ecf3" stroke-width="1.4"/>
<line x1="${f(D0[1])}" y1="-2" x2="${f(dv(D0[1], H + 2))}" y2="${H + 2}" stroke="#e6ecf3" stroke-width="1.4"/>
</g></g>` +
  edges(p, s) +
  `<g class="fx" filter="url(#${p}ts)" font-family="${FONT}" font-size="${f(58 * kk)}" fill="#eef2f7" text-anchor="middle" style="pointer-events:none">${nums}</g>`;
  return out.replace('<svg ', '<svg data-intro="1" ' + '') + '</svg>';
}


/* 05 — bảng điểm: mỗi hàng là một khung riêng, có cùng animation mở khung như 01, 02, 04 */
const RK = 1000 / 744;
/* type sized as on the broadcast (Chung kết Olympia 26, VCNV answers) */
const ROWFS = {full: {name: 29, verdict: 33, score: 30.5}, nav: {name: 31, verdict: 37}};
const GL = [[0,'#082447'],[.13,'#082447'],[.173,'#07274f'],[.258,'#082a5b'],[.343,'#082e6a'],[.427,'#083177'],[.512,'#07327f'],[.618,'#063190'],[.66,'#0836a9'],[.703,'#0336bf'],[.745,'#073cde'],[.788,'#0c41fd'],[.873,'#0746fb'],[.958,'#0a4dff'],[1,'#094fff']];
const GR = [[0,'#072447'],[.18,'#082447'],[.35,'#082853'],[.52,'#072c5f'],[.7,'#062f6f'],[.87,'#07337c'],[1,'#08357f']];
const GNL = [[25,'#072247'],[109,'#072550'],[169,'#082857'],[265,'#082d69'],[311,'#083178'],[340,'#07337b'],[382,'#06337e']].map(([x, c]) => [(x - 12) / 370, c]);
const GNR = [[357,'#0639b1'],[410,'#0639b1'],[415,'#0638ba'],[423,'#0639c6'],[431,'#073bd3'],[440,'#073ee3'],[448,'#073ff1'],[456,'#083ffd'],[465,'#0741fe'],[588,'#0a52ff'],[700,'#0a52ff'],[720,'#0850f5']].map(([x, c]) => [(x - 357) / 363, c]);

function rowSvg(r, mode){
  const p = 'e' + (uid++) + '_', K = RK, RH = 80, hh = 40, sl = .325, full = mode !== 'nav';
  const sc = pts => pts.map(([x, y]) => [x * K, y * K]);
  const body = [[25,0],[718,0],[731,hh],[718,RH],[25,RH],[12,hh]];
  const xo = y => 1 + sl * Math.abs(hh - y);
  const chev = [[xo(9),9],[xo(9)+20,9],[21,hh],[xo(71)+20,71],[xo(71),71],[1,hh]];
  const d1 = full ? [[314.8,0],[288.8,RH]] : [[382.3,0],[356.3,RH]];
  const d2 = [[592,0],[566,RH]];
  const left = [[25,0],[d2[0][0],0],[d2[1][0],RH],[25,RH],[12,hh]];
  const right = [[d2[0][0],0],[718,0],[731,hh],[718,RH],[d2[1][0],RH]];
  const H = RH * K, stops = a => a.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
  const fs = full ? ROWFS.full : ROWFS.nav;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 1008 ${f(H + 8)}" role="img" aria-label="Hàng bảng điểm" data-intro="1" data-w="1000" data-h="${f(H)}" data-ot="${f(25*K)}" data-op="${f(12*K)}" data-it="${f(25*K+17)}" data-ip="${f(12*K+17)}" data-bt="${f(12*K+6)}" data-sl="${sl}">`;
  out += '<defs>' + (full
    ? `<linearGradient id="${p}gl" gradientUnits="userSpaceOnUse" x1="13" y1="0" x2="579" y2="0">${stops(GL)}</linearGradient><linearGradient id="${p}gr" gradientUnits="userSpaceOnUse" x1="581" y1="0" x2="718" y2="0">${stops(GR)}</linearGradient>`
    : `<linearGradient id="${p}gnl" gradientUnits="userSpaceOnUse" x1="12" y1="0" x2="382" y2="0">${stops(GNL)}</linearGradient><linearGradient id="${p}gnr" gradientUnits="userSpaceOnUse" x1="357" y1="0" x2="720" y2="0">${stops(GNR)}</linearGradient>`) +
    `<linearGradient id="${p}cy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a9cf8"/><stop offset="1" stop-color="#0a88ee"/></linearGradient></defs>`;
  out += `<g class="chL"><g id="${p}chev"><polygon points="${P(sc(chev))}" fill="url(#${p}cy)" stroke="#3ec8ff" stroke-width="1.3" stroke-linejoin="round"/></g></g><g class="chR"><use href="#${p}chev" transform="matrix(-1 0 0 1 ${W} 0)"/></g>`;
  out += `<g transform="scale(${K.toFixed(5)})">` + (full
    ? `<polygon points="${P(left)}" fill="url(#${p}gl)"/><polygon points="${P(right)}" fill="url(#${p}gr)"/>`
    : `<polygon points="${P([[25,0],[d1[0][0],0],[d1[1][0],RH],[25,RH],[12,hh]])}" fill="url(#${p}gnl)"/><polygon points="${P([[d1[0][0],0],[718,0],[731,hh],[718,RH],[d1[1][0],RH]])}" fill="url(#${p}gnr)"/>`) +
    `<polygon points="${P(body)}" fill="none" stroke="#2b82e6" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<line x1="${d1[0][0]}" y1="0" x2="${d1[1][0]}" y2="${RH}" stroke="#63c4ff" stroke-width="1.5"/>` +
    (full ? `<line x1="${d2[0][0]}" y1="0" x2="${d2[1][0]}" y2="${RH}" stroke="#63c4ff" stroke-width="1.5"/>` : '') +
    `<g class="fx" font-family="${FONT}" fill="#ffffff" text-anchor="middle">` +
    (full
      ? `<text data-max="250" x="161" y="46" font-size="${fs.name}">${escT(r[0])}</text><text data-max="240" x="447" y="47" font-size="${fs.verdict}">${escT(r[1])}</text><text data-max="110" x="655.5" y="49" font-size="${fs.score}" style="font-variant-numeric:tabular-nums">${escT(r[2])}</text>`
      : `<text data-max="300" x="189" y="49" font-size="${fs.name}">${escT(r[0])}</text><text data-max="320" x="551" y="50" font-size="${fs.verdict}">${escT(r[1])}</text>`) +
    '</g></g></svg>';
  return out;
}
/* ---------- Animation mở khung, dựng theo hai frame tham chiếu ----------
   Đo từ frame: mỗi bên có nắp khung (cánh navy + vạch trắng + mũi tên cyan) và hai "bóng" mũi tên
   chạy trước, mỗi bóng gồm một mũi tên đen viền xám và một mũi tên xanh teal phía sau.
   Các bóng đi cùng một đường ease-out với thời gian khác nhau nên khoảng cách giữa chúng co lại dần.
   Vạch chéo và mọi thành phần bên trong khung đứng yên đúng vị trí cuối, chỉ được lộ ra khi khung giãn.
   Mép mở khung chính là đường viền ngoài của hai nắp, nên khung giãn ra giữa hai nắp. */
const NS = 'http://www.w3.org/2000/svg';
const REDUCE = false;   /* a stage graphic: always animated */
const clamp01 = t => Math.max(0, Math.min(1, t));
const oc = t => 1 - Math.pow(1 - clamp01(t), 3);
const ioe = t => { t = clamp01(t); return t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; };
const ie = t => { t = clamp01(t); return 2.05 * t * t - 1.05 * t * t * t; }; /* vận tốc cuối đoạn mở đầu khớp vận tốc đầu giai đoạn mở khung: không có điểm dừng */
const anim = new WeakMap();
let rvId = 0;

const ECHO = [
  {T: .70, dark: '#040c22', darkEdge: '#7f8a9a', teal: '#0a4f7d', tealEdge: '#4096bd'},
  {T: .45, dark: '#050f33', darkEdge: '#9aa5b6', teal: '#0a5584', tealEdge: '#4096bd'}
];
const SLASH_DELAY = [.30, .18, .04];

const mkEl = (n, at) => { const e = document.createElementNS(NS, n); for (const k in at) e.setAttribute(k, at[k]); return e; };

function wrap(svg){
  if (svg.querySelector('.rev')) return;
  const chL = svg.querySelector('.chL'), chR = svg.querySelector('.chR');
  if (!chL || !chR) return;
  const d = svg.dataset, ot = +d.ot, op = +d.op, it = +d.it, ip = +d.ip, H = +d.h, h = H / 2, t = ip - op;
  const bb = chL.getBBox(), Ws = +svg.dataset.w || W;

  /* hai bóng mũi tên mỗi bên */
  const echoes = ECHO.map(cfg => {
    const mk = mirror => {
      const outer = mkEl('g', {class: mirror ? 'eR' : 'eL'});
      const inner = mkEl('g', mirror ? {transform: 'matrix(-1 0 0 1 ' + Ws + ' 0)'} : {});
      const teal = chL.firstElementChild.cloneNode(true);
      teal.removeAttribute('id');
      const tp = teal.querySelector('polygon');
      tp.setAttribute('fill', cfg.teal); tp.setAttribute('stroke', cfg.tealEdge); tp.setAttribute('stroke-width', '1.2');
      const hl = teal.querySelector('polyline'); if (hl) hl.remove();
      const wing = mkEl('polygon', {points: P([[ot,0],[ot+t,0],[op+t,h],[ot+t,H],[ot,H],[op,h]]), fill: cfg.dark, stroke: cfg.darkEdge, 'stroke-width': '1.3', 'stroke-linejoin': 'round'});
      inner.appendChild(teal); inner.appendChild(wing); outer.appendChild(inner);
      outer.style.opacity = 0;
      return outer;
    };
    return {T: cfg.T, L: mk(false), R: mk(true)};
  });
  [1, 0].forEach(k => { svg.insertBefore(echoes[k].L, chL); svg.insertBefore(echoes[k].R, chL); });

  /* đoạn mở đầu: hai cụm mũi tên (cánh navy + mũi tên cyan) từ ngoài lao vào, chéo nhau ở giữa */
  const intro = svg.hasAttribute('data-intro');
  let wL = null, wR = null;
  if (intro){
    const mkW = mirror => {
      const o = mkEl('g', {class: mirror ? 'iwR' : 'iwL'});
      const i = mkEl('g', mirror ? {transform: 'matrix(-1 0 0 1 ' + Ws + ' 0)'} : {});
      i.appendChild(mkEl('polygon', {points: P([[ot,0],[ot+t,0],[op+t,h],[ot+t,H],[ot,H],[op,h]]), fill: '#0b2c72', stroke: '#8aa7d6', 'stroke-width': '1.3', 'stroke-linejoin': 'round'}));
      o.appendChild(i); o.style.opacity = 0;
      return o;
    };
    wL = mkW(false); wR = mkW(true);
    svg.insertBefore(wL, chL); svg.insertBefore(wR, chL);
  }

  /* nhóm lộ khung */
  const rev = mkEl('g', {class: 'rev'});
  const id = 'rv' + (++rvId);
  const cp = mkEl('clipPath', {id});
  const poly = mkEl('polygon', {});
  cp.appendChild(poly);
  rev.setAttribute('clip-path', 'url(#' + id + ')');
  const skip = new Set([chL, chR]);
  echoes.forEach(e => { skip.add(e.L); skip.add(e.R); });
  if (wL){ skip.add(wL); skip.add(wR); }
  Array.from(svg.childNodes).forEach(n => { if (skip.has(n) || n.nodeName === 'defs') return; rev.appendChild(n); });
  svg.appendChild(cp);
  svg.appendChild(rev);

  const cin = Array.from(svg.querySelectorAll('clipPath.cin polygon, clipPath.cin2 polygon')).map(pl => {
    pl.setAttribute('data-orig', pl.getAttribute('points'));
    return {pl, mg: pl.parentNode.classList.contains('cin2') ? 2.5 : 0};
  });
  const slashes = Array.from(rev.querySelectorAll('.sl line'))
    .filter(l => (+l.getAttribute('y1') + +l.getAttribute('y2')) / 2 < 60)
    .map(l => ({el: l, xf: (+l.getAttribute('x1') + +l.getAttribute('x2')) / 2}))
    .sort((p, q) => p.xf - q.xf);

  svg._a = {chL, chR, poly, echoes, cin, slashes, ot, op, it, ip, H,
    blk: Array.from(rev.querySelectorAll('.blk')).concat(Array.from(rev.querySelectorAll('.sl')).filter(g => { const l = g.querySelector('line'); return l && (+l.getAttribute('y1') + +l.getAttribute('y2')) / 2 >= 60; })),
    capL: Array.from(rev.querySelectorAll('.capL')), capR: Array.from(rev.querySelectorAll('.capR')),
    Ws, D: Ws / 2 - (bb.x + bb.width / 2), intro, wL, wR, S: 650 * Math.min(1, (Ws / 2 - (bb.x + bb.width / 2)) / 474)};
}

function unwrapNode(root){
  const rev = root.querySelector('.rev');
  if (rev){ while (rev.firstChild) root.insertBefore(rev.firstChild, rev); rev.remove(); }
  root.querySelectorAll('clipPath[id^="rv"]').forEach(n => n.remove());
  root.querySelectorAll('.eL,.eR,.iwL,.iwR').forEach(n => n.remove());
  root.querySelectorAll('.chL,.chR,.capL,.capR,.blk,.sl').forEach(n => { n.removeAttribute('transform'); n.style.removeProperty('opacity'); });
  root.querySelectorAll('.sl line').forEach(n => n.removeAttribute('transform'));
  root.querySelectorAll('polygon[data-orig]').forEach(n => { n.setAttribute('points', n.getAttribute('data-orig')); n.removeAttribute('data-orig'); });
  root.querySelectorAll('.demo,.fx,.bov').forEach(n => n.style.removeProperty('opacity'));
}

function settle(svg){ anim.set(svg, {}); unwrapNode(svg); svg._a = null; }

/* tau: thời gian chuẩn hoá 0..1 */
function frame(svg, tau, sig){
  const a = svg._a; if (!a) return;
  if (sig === undefined) sig = 1;
  const tr = v => 'translate(' + f(v) + ' 0)';
  const off = a.D * (1 - oc(tau));
  const ix = a.intro && sig < 1 ? a.S * (1 - ie(sig)) : 0;
  const fadeIn = a.intro ? clamp01(sig * 8) : Math.min(1, tau * 14);
  const rv = svg.querySelector('.rev'); if (rv) rv.style.opacity = a.intro ? clamp01(tau * 25) : 1;

  a.chL.setAttribute('transform', tr(off + ix)); a.chR.setAttribute('transform', tr(-(off + ix)));
  a.chL.style.opacity = fadeIn; a.chR.style.opacity = fadeIn;
  if (a.intro){
    const wo = fadeIn * (1 - clamp01(tau / .08));
    a.wL.setAttribute('transform', tr(off + ix)); a.wR.setAttribute('transform', tr(-(off + ix)));
    a.wL.style.opacity = wo; a.wR.style.opacity = wo;
  }
  a.capL.forEach(n => n.setAttribute('transform', tr(off)));
  a.capR.forEach(n => n.setAttribute('transform', tr(-off)));

  const h = a.H / 2, H = a.H, sl = (a.ot - a.op) / h;
  const xe = a.op + off - 2;
  const xl = y => Math.min(a.Ws / 2, xe + sl * Math.abs(h - y));
  a.poly.setAttribute('points', P([[xl(-20), -20],[xl(h), h],[xl(H + 20), H + 20],[a.Ws - xl(H + 20), H + 20],[a.Ws - xl(h), h],[a.Ws - xl(-20), -20]]));

  a.cin.forEach(c => {
    const L = x => Math.min(a.Ws / 2, x + c.mg + off), R = x => Math.max(a.Ws / 2, a.Ws - x - c.mg - off);
    c.pl.setAttribute('points', P([[L(a.it), 0],[R(a.it), 0],[R(a.ip), h],[R(a.it), H],[L(a.it), H],[L(a.ip), h]]));
  });

  a.echoes.forEach(en => {
    const o = a.D * (1 - oc(tau / en.T));
    const op = (a.intro ? clamp01(tau * 25) : fadeIn) * (1 - clamp01((tau - en.T) / .22));
    en.L.setAttribute('transform', tr(o)); en.R.setAttribute('transform', tr(-o));
    en.L.style.opacity = op; en.R.style.opacity = op;
  });

  const bov = svg.querySelector('.bov'); if (bov) bov.style.opacity = 1 - clamp01((tau - .36) / .1);
  /* ô điểm, gạch chéo lớn và dải ô bên dưới đứng yên đúng vị trí cuối, chỉ được lộ ra khi khung giãn */
  const tx = clamp01((tau - .5) / .35);
  svg.querySelectorAll('.demo,.fx').forEach(n => { n.style.opacity = tx; });
}

function tlOf(svg, ms){
  const a = svg._a, iMs = a && a.intro ? Math.round(0.95 * a.S * ms / (3 * a.D)) : 0;
  return {iMs, tot: iMs + ms};
}
/* u: tiến độ 0..1 của cả đoạn mở đầu và giai đoạn mở khung */
function setAt(svg, u, ms){
  if (!svg._a) wrap(svg);
  if (!svg._a) return;
  const {iMs, tot} = tlOf(svg, ms), T = u * tot;
  if (T < iMs) frame(svg, 0, T / iMs); else frame(svg, (T - iMs) / ms, 1);
}

function play(svg, dir, ms){
  return new Promise(res => {
    if (REDUCE || !svg.isConnected){ res(); return; }
    wrap(svg);
    if (!svg._a){ res(); return; }
    const tok = {}; anim.set(svg, tok);
    const tot = tlOf(svg, ms).tot;
    const t0 = performance.now();
    setAt(svg, dir > 0 ? 0 : 1, ms);
    const step = now => {
      if (!svg.isConnected || anim.get(svg) !== tok){ res(); return; }
      const t = Math.min(1, (now - t0) / tot);
      setAt(svg, dir > 0 ? t : 1 - t, ms);
      if (t < 1) requestAnimationFrame(step);
      else { if (dir > 0) settle(svg); res(); }
    };
    requestAnimationFrame(step);
  });
}


/* ================= the API the graphics modules call ================= */

const NSX = 'http://www.w3.org/2000/svg';
const OPEN_MS = 2200, CLOSE_MS = 1100;

function toSvg(html){
  const box = document.createElement('div');
  box.innerHTML = html;
  const svg = box.firstElementChild;
  svg.classList.add('o26Svg');
  return svg;
}

/* squeeze a text wider than its data-max (frame units) onto its line */
function fitText(t){
  const max = +t.getAttribute('data-max');
  t.removeAttribute('textLength'); t.removeAttribute('lengthAdjust');
  if (!max || !t.textContent) return;
  let w = 0;
  try { w = t.getComputedTextLength(); } catch (e) { return; }
  if (w > max){ t.setAttribute('textLength', f(max)); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
}
function fitAll(svg){ if (svg) svg.querySelectorAll('text[data-max]').forEach(fitText); }
function setText(svg, sel, text){
  svg.querySelectorAll(sel).forEach(t => { if (t.textContent !== text){ t.textContent = text; fitText(t); } });
}

const BUILDERS = {
  summary: o => panelA(o),
  kd: () => panelB(),
  vd: () => panelC(),
  choose: () => panelD({spec: SPEC.B, width: 720}),   /* the sheet's 400, 40 % longer on each side */
  row: o => rowSvg(o.cols, o.mode)
};

/* the frame of `kind` in `holder` (built once, kept) */
function mount(holder, kind, opts){
  let svg = holder.querySelector(':scope > svg.o26Svg');
  if (svg && svg.getAttribute('data-kind') === kind && !opts) return svg;
  if (svg) svg.remove();
  svg = toSvg(BUILDERS[kind](opts || {}));
  svg.setAttribute('data-kind', kind);
  holder.appendChild(svg);
  fitAll(svg);
  return svg;
}

/* cells: [{text, score, tag: 'red' | 'blue' | null}] x 4 */
function setHeader(svg, cells){
  if (!svg) return;
  (cells || []).forEach((c, i) => {
    const g = svg.querySelector('.o26tag[data-i="' + i + '"]');
    if (g){
      g.querySelector('.tB').setAttribute('opacity', c.tag === 'blue' ? 1 : 0);
      g.querySelector('.tR').setAttribute('opacity', c.tag === 'red' ? 1 : 0);
    }
    setText(svg, '.o26hn[data-i="' + i + '"]', c.name || '');
    setText(svg, '.o26hs[data-i="' + i + '"]', c.score == null ? '' : String(c.score));
    setText(svg, '.o26hc[data-i="' + i + '"]', c.text || '');
  });
}

/* 03: values ['20','30',''] of the package, current: 0..2 (or -1) */
function setCells(svg, values, current){
  if (!svg) return;
  for (let k = 0; k < 3; k++){
    const red = svg.querySelector('.cell[data-k="' + k + '"] .red');
    if (red) red.setAttribute('opacity', k === current ? 1 : 0);
    const t = svg.querySelector('.o26cv[data-k="' + k + '"]');
    if (t){
      t.textContent = values[k] == null ? '' : String(values[k]);
      t.setAttribute('fill', k === current ? '#e7a9c9' : '#ffffff');
    }
  }
}

/* 04: picked[r][k] (r 0 = 20, 1 = 30) */
function setPicks(svg, picked){
  if (!svg) return;
  svg.querySelectorAll('.cell[data-r]').forEach(c => {
    const r = +c.getAttribute('data-r'), k = +c.getAttribute('data-k');
    c.querySelector('.red').setAttribute('opacity', picked && picked[r] && picked[r][k] ? 1 : 0);
  });
}

function setScore(svg, text){ if (svg) setText(svg, '.o26score', text == null ? '' : String(text)); }
function setSummary(svg, name, score){ if (!svg) return; setText(svg, '.o26an', name || ''); setText(svg, '.o26as', score == null ? '' : String(score)); }

/* 03: the strip in the groove - fraction 0..1, or null to hide it */
function setTimer(svg, fraction){
  const g = svg && svg.querySelector('.o26timer');
  if (!g) return;
  if (fraction === null || fraction === undefined){ g.setAttribute('opacity', 0); return; }
  const x0 = +g.getAttribute('data-x0'), w = +g.getAttribute('data-w') * clamp01(fraction);
  g.setAttribute('opacity', 1);
  g.querySelector('.o26tfill').setAttribute('width', f(w));
  g.querySelector('.o26tdot').setAttribute('cx', f(x0 + w));
}

/* the opening (arrows rush in, the frame opens from the middle) / closing (the reverse) */
function openFrame(svg, ms){ if (!svg) return Promise.resolve(); fitAll(svg); return play(svg, 1, ms || OPEN_MS); }
function closeFrame(svg, ms){ if (!svg) return Promise.resolve(); return play(svg, -1, ms || CLOSE_MS); }
/* jump to the drawn frame (stops a running animation) */
function finish(svg){ if (svg && svg._a) settle(svg); }
function isAnimating(svg){ return !!(svg && svg._a); }
/* how long the opening takes, all told (the arrows' run-in + the opening) */
function openTime(svg, ms){ if (!svg) return 0; wrap(svg); const t = tlOf(svg, ms || OPEN_MS).tot; return t; }

window.O26 = {
  OPEN_MS, CLOSE_MS,
  mount, setHeader, setCells, setPicks, setScore, setSummary, setTimer,
  open: openFrame, close: closeFrame, finish, isAnimating, openTime, fitAll,
  active: () => !!(window.GameVariables && window.GameVariables.isO26 && window.GameVariables.isO26())
};
})();
