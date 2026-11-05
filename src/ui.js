(function () {
'use strict';
const E = window.HSIM, PROBLEMS = window.HSIM.PROBLEMS;
const NS = 'http://www.w3.org/2000/svg';
const $ = s => document.querySelector(s);
const CIRC = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];
function S(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function T(parent, x, y, txt, cls, anchor) { const t = S('text', { x, y, class: cls || null, 'text-anchor': anchor || null }, parent); t.textContent = txt; return t; }
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
function eyo(w) { const c = w.charCodeAt(w.length - 1); const bat = c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0; return w + (bat ? '이에요' : '예요'); }
function h(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
const store = { get(k, d) { try { const v = localStorage.getItem('hsim.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('hsim.' + k, JSON.stringify(v)); } catch (e) { } } };

/* ======================================================================
   전기 회로도 (래더)
   ====================================================================== */
const U = 44, V = 40, TM = 36;
let LM = 46;
const TERM = { pb: 12, no: 12, nc: 12, lsno: 12, lsnc: 12, coil: 9, sol: 9, sen: 27, tmr: 9, cnt: 9, crst: 9 };
const COILISH = t => t === 'coil' || t === 'tmr' || t === 'cnt' || t === 'crst';
const X = x => LM + mapX(x) * U, Yp = y => TM + y * V;
const ANG = { no: [-24, 0], nc: [22, -12] };   // [열림, 닫힘] 은 아래에서 결정

function drawContact(g, e) {
  const nc = e.type === 'nc' || e.type === 'lsnc', ls = e.type === 'lsno' || e.type === 'lsnc';
  S('rect', { class: 'hl', x: -24, y: -18, width: 48, height: 36, rx: 7 }, g);
  if (nc) S('line', { class: 'sym', x1: 0, y1: -11, x2: 9, y2: -11 }, g);
  else S('line', { class: 'sym', x1: -2.5, y1: -11.5, x2: 2.5, y2: -11.5, 'stroke-width': 1.2 }, g);
  const bg = S('g', { class: 'blade' }, g);
  S('line', { x1: 0, y1: 11, x2: 0, y2: -11.5 }, bg);
  if (ls) S('path', { class: 'sym', d: 'M-1,-8 L-6,-4 L-1,-2', 'stroke-width': 1.3 }, bg);
  if (e.type === 'pb') {
    S('path', { class: 'sym', d: 'M-15,-5 L-18,-5 L-18,5 L-15,5', 'stroke-width': 1.4 }, g);
    S('line', { class: 'sym', x1: -15, y1: 0, x2: -4, y2: 0, 'stroke-dasharray': '2.5 2', 'stroke-width': 1.3 }, g);
  }
  bg.style.transformOrigin = '0px 11px';
  if (e.tmrc) S('path', { class: 'sym tmk', d: 'M3,-1 a3.2,3.2 0 0 1 6.4,0 M6.2,-1 V3', 'stroke-width': 1.2 }, g);   // 한시(온딜레이) 접점 표시
  T(g, e.type === 'pb' ? -23 : -14, 4.5, e.name, 'lab', 'end');
  if (e.arrow) drawArrow(g, e.type === 'pb' ? -36 : -27);
  return { blade: bg, nc };
}
function drawArrow(g, x, dy) {
  const y = v => v + (dy || 0);
  S('path', { class: 'arrow', d: `M${x - 1.6},${y(-15)} V${y(-23)} M${x + 1.6},${y(-15)} V${y(-23)} M${x - 4.2},${y(-21.5)} L${x},${y(-27)} L${x + 4.2},${y(-21.5)} Z` }, g);
}
function drawCoil(g, e, a1a2) {
  S('rect', { class: 'hl', x: -24, y: -15, width: 48, height: 30, rx: 7 }, g);
  S('rect', { class: 'box', x: -17, y: -9, width: 34, height: 18 }, g);
  if (e.type === 'tmr') {
    // 타이머 코일: 시간 막대 + 설정 시간
    const bar = S('rect', { class: 'tfill', x: -15, y: -7, width: 0, height: 14 }, g);
    S('circle', { class: 'sym', cx: -8, cy: 0, r: 4.6, 'stroke-width': 1.1, style: 'fill:#fff' }, g);
    S('path', { class: 'sym', d: 'M-8,-2.8 V0 L-5.8,1.4', 'stroke-width': 1.1 }, g);
    T(g, 6.5, 4.2, (e.o.pre || 3) + 's', 'cnum', 'middle');
    T(g, -21, 4.5, e.name, 'lab', 'end');
    return { bar };
  }
  if (e.type === 'cnt' || e.type === 'crst') {
    const txt = T(g, 0, 4.2, e.type === 'cnt' ? '0/' + (e.o.pre || 3) : '리셋', 'cnum', 'middle');
    T(g, -21, 4.5, e.name, 'lab', 'end');
    return { txt };
  }
  if (e.type === 'sol') {
    S('line', { class: 'sym', x1: -11, y1: 7, x2: 11, y2: -7 }, g);
    S('line', { class: 'sym', x1: 17, y1: 0, x2: 21, y2: 0, 'stroke-dasharray': '2 1.5', 'stroke-width': 1.2 }, g);
    S('path', { class: 'sym', d: 'M22,-7 L29,-7 L22,7 L29,7 Z M25.5,-10 V10', 'stroke-width': 1.2 }, g);
  }
  if (a1a2 && e.type === 'coil') { T(g, 21, -12, 'A1', 'sn'); T(g, 21, 22, 'A2', 'sn'); }
  T(g, -21, 4.5, e.name, 'lab', 'end');
}
// 센서 이름표 후보 자리 (상자 중심 기준, box = 글자가 차지하는 대략의 범위)
const SEN_SPOTS = [
  { tx: -29, ty: 4.5, anchor: 'end', box: [-46, -28, -8, 5] },
  { tx: -28, ty: -15, anchor: 'end', box: [-45, -27, -24, -12] },
  { tx: 5, ty: -30, anchor: 'start', box: [4, 22, -40, -27] },
];
function senLabelSpot(net, e) {
  const cx = X(e.x), cy = Yp(e.y);
  const clear = sp => {
    const [x0, x1, y0, y1] = sp.box.map((v, i) => v + (i < 2 ? cx : cy));
    const hit = (a0, a1, b0, b1) => a1 > x0 && a0 < x1 && b1 > y0 && b0 < y1;
    for (const o of net.els) if (o !== e) {
      const ox = X(o.x), oy = Yp(o.y);
      const bb = o.type === 'sen' ? [ox - 50, ox + 30, oy - 26, oy + 26] : (o.type === 'coil' || o.type === 'sol') ? [ox - 40, ox + 30, oy - 10, oy + 10] : [ox - 36, ox + 12, oy - 12, oy + 12];
      if (hit(...bb)) return false;
    }
    for (const c of net.cols) { const x = X(c.x); if (Math.abs(x - cx) > 0.5 && hit(x - 1, x + 1, Yp(c.y0), Yp(c.y1))) return false; }
    for (const l of net.links) if (hit(X(Math.min(l.x1, l.x2)) - 1.5, X(Math.max(l.x1, l.x2)) + 1.5, Yp(l.y) - 2, Yp(l.y) + 2)) return false;
    return true;
  };
  const i = SEN_SPOTS.findIndex(clear);
  return i < 0 ? 0 : i;
}
function drawSensor(g, e, spot) {
  S('rect', { class: 'hl', x: -30, y: -31, width: 60, height: 62, rx: 7 }, g);
  S('rect', { class: 'box', x: -24, y: -25, width: 48, height: 50 }, g);
  S('path', { class: 'sym', d: 'M0,-21 L5,-15 L0,-9 L-5,-15 Z M0,-21 V-9', 'stroke-width': 1.3 }, g);
  S('line', { class: 'sym', x1: -15, y1: 6, x2: -6, y2: 6 }, g);
  const sw = S('g', { class: 'sw' }, g);
  S('line', { class: 'sym', x1: -6, y1: 6, x2: 6, y2: -1 }, sw);
  sw.style.transformOrigin = '-6px 6px';
  S('line', { class: 'sym', x1: 7, y1: 6, x2: 15, y2: 6 }, g);
  S('path', { class: 'sym', d: 'M-13,15 V21 M-10,15 V21 M-16,18 H-13 M-10,18 H-7', 'stroke-width': 1.1 }, g);
  S('line', { class: 'sym out', x1: 24, y1: 0, x2: E.SEN_DX * U, y2: 0 }, g);
  S('path', { class: 'sym', d: 'M27,-3 h3 v-5 h4 v5 h3', 'stroke-width': 1.1 }, g);
  // 이름표: 왼쪽 가운데가 기본, 옆 줄 기호·선과 겹치면 왼쪽 위 → 오른쪽 위
  const sp = SEN_SPOTS[spot || 0];
  T(g, sp.tx, sp.ty, e.name, 'lab', sp.anchor);
  // ⇑(처음부터 감지): 상자 바로 위에 붙여서 옆 줄 접점 표시로 오해하지 않게
  if (e.arrow) drawArrow(g, -13, -13);
  return { sw };
}

let mapX = x => x;
function renderLadder(svg, net, P, opt) {
  clear(svg);
  LM = opt.rail === 'circle' ? 66 : 46;
  // 솔레노이드 줄 오른쪽에는 밸브 기호 자리가 필요해서 간격을 넓힘 (표시용 좌표만)
  // 코일·솔레노이드가 있는 줄끼리는 이름표가 겹치지 않게 최소 간격을 둠 (솔레노이드 오른쪽에는 밸브 기호 자리)
  const loads = net.cols.map(c => ({ x: c.x, sol: c.els.some(e => e.type === 'sol'), coil: c.els.some(e => COILISH(e.type)) })).filter(c => c.sol || c.coil).sort((a, b) => a.x - b.x);
  const brk = [];
  let shift = 0;
  for (let i = 1; i < loads.length; i++) {
    const a = loads[i - 1], b = loads[i];
    const need = (a.sol ? 1.6 : 1.34) + (opt.a1a2 && a.coil && !a.sol ? 0.16 : 0);
    const gap = b.x - a.x;
    if (gap < need - 1e-6) brk.push({ x: b.x, d: need - gap });
  }
  mapX = x => x + brk.reduce((s, b) => s + (b.x <= x + 1e-6 ? b.d : 0), 0);
  const maxX = Math.max(...net.cols.map(c => c.x));
  const W = Math.ceil(X(maxX) + 60), H = Math.ceil(Yp(E.H) + 38);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.style.width = '100%'; svg.style.maxWidth = Math.round(W * 1.25) + 'px'; svg.style.minWidth = Math.round(Math.min(W, Math.max(760, W * 0.84))) + 'px';
  svg.style.height = 'auto';
  const gW = S('g', null, svg), gD = S('g', null, svg), gE = S('g', null, svg), gM = S('g', null, svg);
  const wires = [];   // {el, node}
  const addW = (x1, y1, x2, y2, node) => { const l = S('line', { class: 'w', x1, y1, x2, y2 }, gW); wires.push({ el: l, node }); return l; };
  // 레일
  const topCols = net.cols.filter(c => Math.abs(c.y0) < 1e-6), botCols = net.cols.filter(c => Math.abs(c.y1 - E.H) < 1e-6);
  const xTop = Math.max(...topCols.map(c => c.x)), xBot = Math.max(...botCols.map(c => c.x));
  const xs = X(-0.55);
  addW(xs, Yp(0), X(xTop), Yp(0), net.top);
  addW(xs, Yp(E.H), X(xBot), Yp(E.H), net.bot);
  if (opt.rail === 'circle') {
    S('circle', { cx: xs - 12, cy: Yp(0) - 14, r: 12, class: 'fsym' }, gW); T(gW, xs - 12, Yp(0) - 10, '24V', 'rail-lbl', 'middle').setAttribute('style', 'font-size:9.5px');
    S('line', { class: 'w', x1: xs - 12, y1: Yp(0) - 2, x2: xs - 12, y2: Yp(0) }, gW); S('line', { class: 'w', x1: xs - 12, y1: Yp(0), x2: xs, y2: Yp(0) }, gW);
    S('circle', { cx: xs - 12, cy: Yp(E.H) - 14, r: 12, class: 'fsym' }, gW); T(gW, xs - 12, Yp(E.H) - 10, '0V', 'rail-lbl', 'middle').setAttribute('style', 'font-size:9.5px');
    S('line', { class: 'w', x1: xs - 12, y1: Yp(E.H) - 2, x2: xs - 12, y2: Yp(E.H) }, gW); S('line', { class: 'w', x1: xs - 12, y1: Yp(E.H), x2: xs, y2: Yp(E.H) }, gW);
  } else {
    S('circle', { cx: xs - 4, cy: Yp(0), r: 4, class: 'fsym' }, gW); T(gW, xs - 8, Yp(0) - 9, '+24V', 'rail-lbl');
    S('circle', { cx: xs - 4, cy: Yp(E.H), r: 4, class: 'fsym' }, gW); T(gW, xs - 8, Yp(E.H) - 9, '0V', 'rail-lbl');
  }
  // 세로선
  const termTop = e => Yp(e.y) - TERM[e.type], termBot = e => Yp(e.y) + TERM[e.type];
  for (const c of net.cols) {
    const els = c.els;
    const newCol = els.length && els.every(e => e.o && e.o.app);
    for (let i = 0; i <= els.length; i++) {
      const ya = i === 0 ? Yp(c.y0) : termBot(els[i - 1]);
      const yb = i === els.length ? Yp(c.y1) : termTop(els[i]);
      if (yb - ya > 0.5) { const l = addW(X(c.x), ya, X(c.x), yb, c.segs[i].node); if (newCol) l.classList.add('addw'); }
    }
  }
  // 가로 연결선
  const dots = [];
  const colAt = (x, y) => net.cols.find(c => Math.abs(c.x - x) < 1e-6 && y >= c.y0 - 1e-6 && y <= c.y1 + 1e-6);
  for (const l of net.links) {
    const lw = addW(X(l.x1), Yp(l.y), X(l.x2), Yp(l.y), l.node);
    if (opt.appMarks && l.added) lw.classList.add('addw');
    const lo = Math.min(l.x1, l.x2), hi = Math.max(l.x1, l.x2);
    for (const [x, isSen] of [[l.x1, !!l.sen], [l.x2, false]]) {
      if (isSen) continue;
      const c = colAt(x, l.y); if (!c) continue;
      const inside = l.y > c.y0 + 1e-6 && l.y < c.y1 - 1e-6;
      const busThrough = x > lo + 1e-6 && x < hi - 1e-6;
      if (inside || busThrough) dots.push({ x: X(x), y: Yp(l.y), node: l.node });
    }
    for (const c of net.cols) {
      if (c.x <= lo + 1e-6 || c.x >= hi - 1e-6) continue;
      if (Math.abs(c.y0 - l.y) < 1e-6 || Math.abs(c.y1 - l.y) < 1e-6) dots.push({ x: X(c.x), y: Yp(l.y), node: l.node });
    }
  }
  for (const c of topCols) if (c.x < xTop - 1e-6) dots.push({ x: X(c.x), y: Yp(0), node: net.top });
  for (const c of botCols) if (c.x < xBot - 1e-6) dots.push({ x: X(c.x), y: Yp(E.H), node: net.bot });
  const dotEls = dots.map(d => ({ el: S('circle', { class: 'dot', cx: d.x, cy: d.y, r: 3.4 }, gD), node: d.node }));
  // 줄 번호
  const numbered = botCols.slice().sort((a, b) => a.x - b.x);
  const colNo = {};
  numbered.forEach((c, i) => { colNo[c.id] = i + 1; T(gW, X(c.x), Yp(E.H) + 18, String(i + 1), 'colno', 'middle'); });
  // 요소
  const items = [];
  const tmrNames = new Set(net.els.filter(e => e.type === 'tmr').map(e => e.name));
  for (const e of net.els) {
    const g = S('g', { class: 'el ' + (COILISH(e.type) ? 'coil' + (e.type !== 'coil' ? ' ' + e.type : '') : e.type === 'sol' ? 'sol' : e.type === 'sen' ? 'sen' : 'ct'), transform: `translate(${X(e.x)},${Yp(e.y)})`, 'data-id': e.id, 'data-name': e.name }, gE);
    let parts = {};
    if (E.isContact(e.type)) { if ((e.type === 'no' || e.type === 'nc') && tmrNames.has(e.name)) e.tmrc = true; parts = drawContact(g, e); }
    else if (COILISH(e.type) || e.type === 'sol') parts = drawCoil(g, e, opt.a1a2) || {};
    else if (e.type === 'sen') parts = drawSensor(g, e, senLabelSpot(net, e));
    if (e.type === 'pb') g.classList.add('pbtn');
    if (e.o && e.o.app) g.classList.add('appel');
    items.push({ e, g, parts, last: null });
  }
  // 정정에서 지운 요소(흐리게)
  for (const gh of (opt.ghosts ? net.ghosts : [])) {
    const g = S('g', { class: 'el ghost', transform: `translate(${X(gh.x)},${Yp(gh.y)})` }, gE);
    S('line', { class: 'sym', x1: 0, y1: -12, x2: 0, y2: 12, style: 'stroke:var(--live)' }, g);
    if (E.isContact(gh.type)) { const p = drawContact(g, gh); p.blade.style.transform = `rotate(${gh.type === 'nc' || gh.type === 'lsnc' ? 22 : -24}deg)`; }
    S('path', { class: 'x', d: 'M-9,-9 L9,9 M9,-9 L-9,9' }, g);
  }
  const byName = {};
  for (const it of items) (byName[it.e.name] = byName[it.e.name] || []).push(it);
  return { svg, items, wires, dotEls, gM, byName, colNo, W, H };
}

function updateLadder(L, sim) {
  const live = sim.live, top = sim.net.top, bot = sim.net.bot;
  for (const w of L.wires) {
    const st = w.node === bot ? 2 : live[w.node] ? 1 : 0;
    if (w.st !== st) { w.st = st; w.el.classList.toggle('on', st === 1); w.el.classList.toggle('zero', st === 2); }
  }
  for (const d of L.dotEls) {
    const st = d.node === bot ? 2 : live[d.node] ? 1 : 0;
    if (d.st !== st) { d.st = st; d.el.classList.toggle('on', st === 1); d.el.classList.toggle('zero', st === 2); }
  }
  for (const it of L.items) {
    const e = it.e;
    let key;
    if (E.isContact(e.type)) {
      const closed = sim.closed(e);
      const on = closed && live[e.a] && live[e.b];
      key = (closed ? 1 : 0) + (on ? 2 : 0);
      if (key !== it.last) {
        const nc = it.parts.nc;
        const ang = nc ? (closed ? 22 : -12) : (closed ? 0 : -24);
        it.parts.blade.style.transform = `rotate(${ang}deg)`;
        it.g.classList.toggle('on', !!on);
      }
    } else if (e.type === 'coil') {
      const on = !!(sim.relays[e.name] && sim.relays[e.name].on);
      const osc = sim.osc.has(e.name);
      key = (on ? 1 : 0) + (osc ? 2 : 0);
      if (key !== it.last) { it.g.classList.toggle('on', on); }
    } else if (e.type === 'sol') {
      const on = !!live[e.a];
      key = on ? 1 : 0;
      if (key !== it.last) it.g.classList.toggle('on', on);
    } else if (e.type === 'tmr') {
      const t = sim.timers[e.name], on = !!live[e.a];
      const f = t ? (t.pre > 0 ? Math.min(1, t.acc / t.pre) : (t.done ? 1 : 0)) : 0;
      key = (on ? 1 : 0) + (t && t.done ? 2 : 0) + Math.round(f * 60) * 4;
      if (key !== it.last) { it.g.classList.toggle('on', on); it.g.classList.toggle('done', !!(t && t.done)); it.parts.bar.setAttribute('width', (30 * f).toFixed(1)); }
    } else if (e.type === 'cnt' || e.type === 'crst') {
      const c = sim.counters[e.name], on = !!live[e.a];
      key = (on ? 1 : 0) + (c && c.done ? 2 : 0) + (c ? c.count : 0) * 4;
      if (key !== it.last) { it.g.classList.toggle('on', on); it.g.classList.toggle('done', !!(c && c.done)); if (e.type === 'cnt' && c) it.parts.txt.textContent = c.count + '/' + c.pre; }
    } else if (e.type === 'sen') {
      const det = !!sim.sensors[e.name], pw = !!live[e.a];
      key = (det ? 1 : 0) + (pw ? 2 : 0);
      if (key !== it.last) {
        it.g.classList.toggle('det', det);
        it.parts.sw.style.transform = det ? 'rotate(32deg)' : 'rotate(0deg)';
      }
    }
    it.last = key;
  }
}

/* 오류/정정 표시 */
function bboxOf(it) {
  const e = it.e;
  if (e.type === 'sen') return { x: X(e.x) - 34, y: Yp(e.y) - 33, w: 68, h: 66 };
  if (COILISH(e.type) || e.type === 'sol') return { x: X(e.x) - 42, y: Yp(e.y) - 15, w: e.type === 'sol' ? 76 : e.type === 'coil' ? 63 : 72, h: 30 };
  return { x: X(e.x) - (e.type === 'pb' ? 46 : 38), y: Yp(e.y) - 19, w: e.type === 'pb' ? 66 : 58, h: 38 };
}
function drawMarks(L, list) {
  clear(L.gM);
  for (const m of list) {
    const g = S('g', { class: 'mark ' + m.cls + (m.pulse ? ' pulse' : '') }, L.gM);
    const b = m.box;
    S('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 7 }, g);
    if (m.n) { S('circle', { cx: b.x + b.w, cy: b.y, r: 8 }, g); T(g, b.x + b.w, b.y + 3.8, String(m.n), null, 'middle'); }
    if (m.tag) T(g, b.x + b.w / 2, b.y + b.h + 12, m.tag, 'tag', 'middle');
  }
}

/* ======================================================================
   공유압 회로도
   ====================================================================== */
const BW = 46, BH = 34;   // 밸브 한 칸
function boxGlyph(g, kind, x, y, pneu) {
  S('rect', { class: 'fsym', x, y, width: BW, height: BH }, g);
  const a = pneu ? 0.25 : 0.3, b = pneu ? 0.75 : 0.7;
  const top = y + 3, bot = y + BH - 3;
  const arrow = (x1, y1, x2, y2) => {
    S('line', { class: 'fsym n', x1, y1, x2, y2 }, g);
    const ang = Math.atan2(y2 - y1, x2 - x1), L = 6, W = 3;
    const p1 = [x2 - L * Math.cos(ang) + W * Math.sin(ang), y2 - L * Math.sin(ang) - W * Math.cos(ang)];
    const p2 = [x2 - L * Math.cos(ang) - W * Math.sin(ang), y2 - L * Math.sin(ang) + W * Math.cos(ang)];
    S('path', { class: 'fsym k', d: `M${x2},${y2} L${p1[0]},${p1[1]} L${p2[0]},${p2[1]} Z` }, g);
  };
  const tee = (px, up) => { const yy = up ? top + 7 : bot - 7; S('path', { class: 'fsym n', d: up ? `M${px},${top - 3} V${yy} M${px - 5},${yy} H${px + 5}` : `M${px},${bot + 3} V${yy} M${px - 5},${yy} H${px + 5}` }, g); };
  const xa = x + BW * a, xb = x + BW * b, xm = x + BW * 0.5;
  switch (kind) {
    case '52a': arrow(xm, bot, xa, top); arrow(xb, top, xb, bot); tee(xa, false); break;
    case '52b': arrow(xm, bot, xb, top); arrow(xa, top, xa, bot); tee(xb, false); break;
    case 'par': arrow(xa, bot, xa, top); arrow(xb, top, xb, bot); break;
    case 'cross': arrow(xa, bot, xb, top); arrow(xa, top, xb, bot); break;
    case 'closed': tee(xa, true); tee(xb, true); tee(xa, false); tee(xb, false); break;
    case 'abt': tee(xa, false); S('path', { class: 'fsym n', d: `M${xa},${top - 3} V${y + BH * 0.55} H${xb} M${xb},${top - 3} V${bot + 3}` }, g); break;
    case 'open': arrow(xm, bot, xm, top); break;
    case 'shut': tee(xm, true); tee(xm, false); break;
  }
}
function solenoid(g, x, y, left, name, cls) {
  // x: 밸브 몸체 바깥쪽 가장자리, left=true면 왼쪽에 붙임
  const w = 30, hh = 20, x0 = left ? x - w : x;
  const r = S('rect', { class: 'fsym solx', x: x0, y: y + BH - hh, width: w, height: hh }, g);
  S('line', { class: 'fsym n', x1: x0 + 6, y1: y + BH - 3, x2: x0 + w - 6, y2: y + BH - hh + 3 }, g);
  S('rect', { class: 'fsym n', x: left ? x0 + 6 : x0 + 4, y: y + BH - hh - 8, width: 20, height: 8 }, g);
  T(g, left ? x0 - 5 : x0 + w + 5, y + BH - 5, name, 'vlab', left ? 'end' : 'start');
  return r;
}
function spring(g, x, y) {
  S('path', { class: 'fsym n', d: `M${x},${y + BH / 2} l4,-6 l4,12 l4,-12 l4,12 l4,-12 l3,6` }, g);
}
/* 밸브 그리기: 몸체(칸들 + 조작부)는 g 안에서 옮겨짐. 포트 위치 반환 */
function initBox(a, P) {
  const v = a.valve;
  if (v.kind === '52d' || v.kind === '42d') { const r = P.seq.rows.find(r => r.id === a.id); const d = v.init || (r && r.pos && r.pos[0] ? 'ext' : 'ret'); return d === v.lDir ? v.lBox : v.rBox; }
  return v.home != null ? v.home : 0;
}
function drawValve(g, v, cx, y, pneu, home) {
  const nb = v.boxes.length;
  if (home == null) home = v.home != null ? v.home : 0;
  const hx = cx - BW / 2;                 // 기준 칸 왼쪽 x (포트가 붙는 자리)
  const body = S('g', { class: 'vbody' }, g);
  const bx0 = hx - home * BW;             // 몸체 왼쪽 x (이동 전)
  v.boxes.forEach((k, i) => boxGlyph(body, k, bx0 + i * BW, y, pneu));
  const sols = {};
  const lsol = v.l || v.sol, rsol = v.r;
  sols[lsol] = solenoid(body, bx0, y, true, lsol);
  if (rsol) sols[rsol] = solenoid(body, bx0 + nb * BW, y, false, rsol);
  else spring(body, bx0 + nb * BW, y);
  if (v.kind === '43') spring(body, bx0 - 27, y - 14);
  if (v.kind === '43' && rsol) spring(body, bx0 + nb * BW, y - 14);
  const a = pneu ? 0.25 : 0.3, b = pneu ? 0.75 : 0.7;
  return { body, sols, home, A: hx + BW * a, B: hx + BW * b, M: hx + BW * 0.5, top: y, bot: y + BH, hx };
}
function flowCtl(g, x, y) {
  // 한방향 유량제어밸브 (가변 교축 + 체크: 실린더 쪽으로만 그냥 흐름 = 미터아웃)
  oneWayFC(g, x, y, 'up');
}
function airSupply(g, x, y) { S('path', { class: 'fsym', d: `M${x},${y} l-6,10 h12 z` }, g); }
function exhaust(g, x, y) { S('path', { class: 'fsym', d: `M${x - 6},${y} h12 l-6,10 z` }, g); }
function tank(g, x, y) { S('path', { class: 'fsym n', d: `M${x - 9},${y} V${y + 7} H${x + 9} V${y}` }, g); }
function gauge(g, x, y) { S('circle', { class: 'fsym', cx: x, cy: y, r: 13 }, g); S('line', { class: 'fsym n', x1: x - 7, y1: y + 7, x2: x + 7, y2: y - 7 }, g); S('path', { class: 'fsym k', d: `M${x + 7},${y - 7} l-5,1 l4,4 z` }, g); }
function relief(g, x, y) {
  // 위쪽 입구 x,y
  S('rect', { class: 'fsym', x: x - 14, y: y + 14, width: 28, height: 28 }, g);
  S('line', { class: 'fsym n', x1: x - 4, y1: y + 18, x2: x - 4, y2: y + 38 }, g);
  S('path', { class: 'fsym k', d: `M${x - 4},${y + 38} l-3,-6 h6 z` }, g);
  S('path', { class: 'fsym n', d: `M${x},${y} V${y + 14}`, }, g);
  S('path', { class: 'fsym n', d: `M${x - 14},${y + 18} H${x - 22} V${y + 8} H${x - 4}`, 'stroke-dasharray': '3 2' }, g);
  S('path', { class: 'fsym n', d: `M${x + 14},${y + 28} l4,-6 l4,12 l4,-12 l4,12` }, g);
  S('line', { class: 'fsym n', x1: x - 4, y1: y + 42, x2: x - 4, y2: y + 50 }, g);
  tank(g, x - 4, y + 50);
}
/* ---- 응용 유압 기호 ---- */
// 체크밸브(세로 라인 위): dir = 자유 흐름 방향 'down'|'up'. 시험지처럼 볼이 V자 시트 안에 있음
function checkV(g, x, y, dir, spring) {
  const gg = S('g', dir === 'up' ? { transform: `rotate(180 ${x} ${y})` } : null, g);
  S('rect', { class: 'fbg', x: x - 9, y: y - 11, width: 18, height: 22 }, gg);
  S('path', { class: 'fsym n', d: `M${x},${y - 12} V${y - 7} M${x - 7},${y + 3} L${x},${y - 7} L${x + 7},${y + 3}` }, gg);
  S('circle', { class: 'fsym', cx: x, cy: y - 1.5, r: 4 }, gg);
  S('path', { class: 'fsym n', d: spring ? `M${x},${y + 2.5} l-4,1.8 l8,2.4 l-8,2.4 l8,2.4 l-4,1.5 V${y + 12}` : `M${x},${y + 2.5} V${y + 12}` }, gg);
}
// 가변 교축(유량제어)
function throttleSym(g, x, y) {
  S('rect', { class: 'fbg', x: x - 8, y: y - 10, width: 16, height: 20 }, g);
  S('path', { class: 'fsym n', d: `M${x - 6},${y - 9} q5,9 0,18 M${x + 6},${y - 9} q-5,9 0,18` }, g);
  S('line', { class: 'fsym n', x1: x - 11, y1: y + 9, x2: x + 11, y2: y - 9 }, g);
  S('path', { class: 'fsym k', d: `M${x + 11},${y - 9} l-6,1.5 l3.5,4 z` }, g);
}
// 한방향 유량제어밸브: 교축 + 체크 바이패스(freeDir 쪽으로만 그냥 흐름)
function oneWayFC(g, x, y, freeDir) {
  S('path', { class: 'fsym n', d: `M${x},${y - 18} H${x - 24} V${y + 18} H${x}` }, g);
  throttleSym(g, x, y);
  checkV(g, x - 24, y, freeDir, true);
}
function dotAt(g, x, y) { S('circle', { class: 'dot', cx: x, cy: y, r: 2.7 }, g); }
// 카운터밸런스 밸브: 내부 파일럿 압력제어밸브(위→아래 흐름을 3 MPa에서 열어 줌) + 체크 바이패스(아래→위 자유)
function cbValve(g, x, y) {
  S('path', { class: 'fsym n', d: `M${x},${y - 26} H${x + 42} V${y + 26} H${x}` }, g);
  dotAt(g, x, y - 26); dotAt(g, x, y + 26);
  S('rect', { class: 'fbg', x: x - 14, y: y - 15, width: 28, height: 30 }, g);
  S('rect', { class: 'fsym', x: x - 13, y: y - 14, width: 26, height: 28 }, g);
  S('line', { class: 'fsym n', x1: x + 5, y1: y - 10, x2: x + 5, y2: y + 6 }, g);
  S('path', { class: 'fsym k', d: `M${x + 5},${y + 10} l-3,-6 h6 z` }, g);
  S('path', { class: 'fsym n', d: `M${x - 13},${y - 18} H${x - 21} V${y - 5} H${x - 13}`, 'stroke-dasharray': '3 2' }, g);
  S('path', { class: 'fsym n', d: `M${x},${y - 18} H${x - 13}`, 'stroke-dasharray': '3 2' }, g);
  S('path', { class: 'fsym n', d: `M${x + 13},${y + 7} l3,-4 l3,8 l3,-8 l3,8 l3,-4` }, g);
  checkV(g, x + 42, y, 'up', false);
}
// 파일럿 조작 체크밸브: 체크(free up) + 반대쪽 라인에서 오는 파일럿(점선)
function pocValve(g, x, y, pilotX) {
  S('path', { class: 'fsym n', d: `M${pilotX},${y} H${x - 13}`, 'stroke-dasharray': '4 2.5' }, g);
  dotAt(g, pilotX, y);
  checkV(g, x, y, 'up', true);
  S('rect', { class: 'fsym n', x: x - 12, y: y - 13, width: 24, height: 26, 'stroke-dasharray': '2 2' }, g);
  S('path', { class: 'fsym k', d: `M${x - 12},${y} l-6,-3 v6 z` }, g);
}
// 블리드오프: 헤드측 라인에서 갈라져 유량제어밸브를 거쳐 탱크로
function bleedOff(g, x, y) {
  const bx = x - 40;
  dotAt(g, x, y);
  S('path', { class: 'fsym n', d: `M${x},${y} H${bx} V${y + 46}` }, g);
  throttleSym(g, bx, y + 22);
  tank(g, bx, y + 46);
  return bx;
}
// 감압밸브(아래→위 흐름, 평상시 열림) + 2차측 압력계
function prvValve(g, x, y) {
  S('rect', { class: 'fbg', x: x - 14, y: y - 15, width: 28, height: 30 }, g);
  S('rect', { class: 'fsym', x: x - 13, y: y - 14, width: 26, height: 28 }, g);
  S('line', { class: 'fsym n', x1: x, y1: y + 12, x2: x, y2: y - 7 }, g);
  S('path', { class: 'fsym k', d: `M${x},${y - 11} l-3,6 h6 z` }, g);
  S('path', { class: 'fsym n', d: `M${x},${y - 22} H${x - 21} V${y + 6} H${x - 13}`, 'stroke-dasharray': '3 2' }, g);
  dotAt(g, x, y - 22);
  S('path', { class: 'fsym n', d: `M${x + 13},${y + 7} l3,-4 l3,8 l3,-8 l3,8 l3,-4` }, g);
  S('path', { class: 'fsym n', d: `M${x + 13},${y - 9} H${x + 38} V${y + 24}`, 'stroke-dasharray': '3 2' }, g);
  tank(g, x + 38, y + 24);
  dotAt(g, x, y - 34);
  S('path', { class: 'fsym n', d: `M${x},${y - 34} H${x + 30}` }, g);
  gauge(g, x + 43, y - 34);
}
// 모터 서지압 방지: 작업라인 → 릴리프밸브(탱크), 탱크 → 체크밸브(보충)
function surgeSet(g, x, y1, y2) {
  dotAt(g, x, y1);
  S('path', { class: 'fsym n', d: `M${x},${y1} H${x - 46}` }, g);
  relief(g, x - 46, y1);
  dotAt(g, x, y2);
  S('path', { class: 'fsym n', d: `M${x},${y2} H${x + 36} V${y2 + 44}` }, g);
  checkV(g, x + 36, y2 + 22, 'up', false);
  tank(g, x + 36, y2 + 44);
}
function cylinder(g, x0, y0, bw, bh, label, sens, pneu) {
  T(g, x0, y0 - 24, label, 'alab');
  S('rect', { class: 'fsym', x: x0, y: y0, width: bw, height: bh }, g);
  const stroke = bw - 30, rodLen = bw + 2;
  const tip0 = x0 + 12 + rodLen;
  // 자(눈금)
  const rx0 = tip0 - 4, rx1 = tip0 + stroke + 4, ry = y0 - 14;
  S('line', { class: 'fsym n', x1: rx0, y1: ry, x2: rx1, y2: ry }, g);
  for (let x = rx0; x <= rx1 + 0.1; x += (rx1 - rx0) / 14) S('line', { class: 'fsym n', x1: x, y1: ry - 5, x2: x, y2: ry, 'stroke-width': 1 }, g);
  const l0 = T(g, tip0, ry - 9, sens[0], 'slab', 'middle'), l1 = T(g, tip0 + stroke, ry - 9, sens[1], 'slab', 'middle');
  const m0 = S('circle', { class: 'slamp', cx: tip0, cy: ry + 6, r: 3.6 }, g), m1 = S('circle', { class: 'slamp', cx: tip0 + stroke, cy: ry + 6, r: 3.6 }, g);
  const mv = S('g', { class: 'cylrod' }, g);
  S('rect', { class: 'fsym k', x: x0 + 9, y: y0 + 2, width: 6, height: bh - 4 }, mv);
  S('line', { class: 'fsym n', x1: x0 + 15, y1: y0 + bh / 2, x2: x0 + 12 + rodLen, y2: y0 + bh / 2, 'stroke-width': 2.4 }, mv);
  S('line', { class: 'fsym n', x1: tip0, y1: y0 + bh / 2 - 9, x2: tip0, y2: y0 + bh / 2 + 4, 'stroke-width': 2 }, mv);
  return { mv, stroke, l0, l1, m0, m1, cap: [x0 + 10, y0 + bh], rod: [x0 + bw - 10, y0 + bh] };
}
function motorSym(g, cx, cy, label, bi) {
  T(g, cx, cy - 32, label, 'alab', 'middle');
  S('circle', { class: 'fsym', cx, cy, r: 24 }, g);
  S('path', { class: 'fsym k', d: `M${cx - 23},${cy} l9,-6 v12 z` }, g);
  if (bi) S('path', { class: 'fsym k', d: `M${cx + 23},${cy} l-9,-6 v12 z` }, g);
  const rot = S('g', null, g);
  S('path', { class: 'fsym n', d: `M${cx},${cy - 11} A11,11 0 1 1 ${cx - 9.5},${cy + 5.5}`, 'stroke-width': 1.6 }, rot);
  S('path', { class: 'fsym k', d: `M${cx - 9.5},${cy + 5.5} l-1,-7 l6,3 z` }, rot);
  const tag = T(g, cx + 36, cy - 32, '', 'dirtag');
  return { rot, tag, cx, cy, L: [cx - 24, cy], R: [cx + 24, cy] };
}

function renderFluid(svg, P) {
  clear(svg);
  const pneu = P.kind === 'pneu';
  const n = P.acts.length;
  const CW = pneu ? 270 : 262;
  const PU = pneu ? 0 : 230;                    // 유압 파워유닛 자리
  const OX = 52;                               // 왼쪽 여백 (솔레노이드 이름 자리)
  const W = OX + n * CW + PU + 10;
  const H = pneu ? 290 : 392;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.style.width = '100%'; svg.style.maxWidth = Math.round(W * 1.15) + 'px'; svg.style.minWidth = Math.min(W, 640) + 'px'; svg.style.height = 'auto';
  const gl = S('g', null, svg), gs = S('g', null, svg);
  const lines = [];      // {el, fn}
  const L = (pts, fn) => { const el = S('polyline', { class: 'fl', points: pts.map(p => p.join(',')).join(' ') }, gl); lines.push({ el, fn }); return el; };
  const acts = {};
  const appH = !!(P.isApp && P.app && P.app.fluid && !pneu);   // 유압 응용: 밸브를 더 넣을 자리를 비움
  const DY = appH ? 56 : 0, DP = appH ? 40 : 0;
  const yMain = 352 + DY + DP;
  let mainX0 = Infinity, mainX1 = -Infinity;
  P.acts.forEach((a, i) => {
    const cx0 = OX + i * CW;
    const H0 = {};
    acts[a.id] = H0;
    const vy = pneu ? 184 : (a.supply ? 168 : 196) + DY;
    H0.vy = vy;
    if (a.type === 'cyl') {
      const bw = pneu ? 118 : 112, bh = 28, x0 = cx0 + 22, y0 = 52;
      H0.cyl = cylinder(gs, x0, y0, bw, bh, '실린더 ' + a.id, a.sens, pneu);
      const vcx = x0 + bw / 2 + 4;
      H0.valve = drawValve(gs, a.valve, vcx, vy, pneu, initBox(a, P));
      const V0 = H0.valve;
      // 실린더 → 밸브 배관
      const capY = vy - 36, rodY = vy - 22;
      const capPts = [H0.cyl.cap, [H0.cyl.cap[0], capY], [V0.A, capY], [V0.A, vy]];
      const rodPts = [H0.cyl.rod, [H0.cyl.rod[0], rodY], [V0.B, rodY], [V0.B, vy]];
      H0.capLine = L(capPts, s => lineState(s, a, 'cap'));
      H0.rodLine = L(rodPts, s => lineState(s, a, 'rod'));
      H0.geo = { capX: H0.cyl.cap[0], rodX: H0.cyl.rod[0], top: H0.cyl.cap[1], capY, rodY };
      if (a.fc) { const p = a.fc === 'cap' ? H0.cyl.cap : H0.cyl.rod; flowCtl(gs, p[0], (p[1] + (a.fc === 'cap' ? capY : rodY)) / 2 + 2); }
    } else {
      const mcx = cx0 + 110, mcy = 82;
      H0.mot = motorSym(gs, mcx, mcy, '모터 ' + a.id, !!a.bi);
      H0.geo = { mx: mcx, my: mcy };
      const vcx = mcx;
      H0.valve = drawValve(gs, a.valve, vcx, vy, pneu, initBox(a, P));
      const V0 = H0.valve;
      if (a.valve.kind === '22') {
        // 단방향 모터: 2/2 밸브 → 모터 왼쪽, 모터 오른쪽 → 체크밸브 → 탱크
        H0.capLine = L([[V0.M, vy], [V0.M, mcy + 40], [mcx - 46, mcy + 40], [mcx - 46, mcy], H0.mot.L], s => motorLine(s, a, 'in'));
        const ox = mcx + 64;
        H0.rodLine = L([H0.mot.R, [ox, mcy], [ox, mcy + 30]], s => motorLine(s, a, 'out'));
        S('path', { class: 'fsym n', d: `M${ox},${mcy + 30} V${mcy + 36} M${ox},${mcy + 56} V${mcy + 70}` }, gs);
        checkV(gs, ox, mcy + 46, 'down', true);
        tank(gs, ox, mcy + 70);
      } else {
        H0.capLine = L([H0.mot.L, [mcx - 46, mcy], [mcx - 46, vy - 30], [V0.A, vy - 30], [V0.A, vy]], s => motorLine(s, a, 'A'));
        H0.rodLine = L([H0.mot.R, [mcx + 46, mcy], [mcx + 46, vy - 18], [V0.B, vy - 18], [V0.B, vy]], s => motorLine(s, a, 'B'));
      }
    }
    const V0 = H0.valve;
    // 공급 / 배기
    if (pneu) {
      L([[V0.M, V0.bot], [V0.M, V0.bot + 22]], () => 'p'); airSupply(gs, V0.M, V0.bot + 22);
      L([[V0.A, V0.bot], [V0.A, V0.bot + 12]], s => exhState(s, a, 'R')); exhaust(gs, V0.A, V0.bot + 12);
      L([[V0.B, V0.bot], [V0.B, V0.bot + 12]], s => exhState(s, a, 'S')); exhaust(gs, V0.B, V0.bot + 12);
    } else {
      const pX = a.valve.kind === '22' ? V0.M : V0.A, tX = V0.B;
      if (a.valve.kind !== '22') { L([[tX, V0.bot], [tX, V0.bot + 14]], () => 'r'); tank(gs, tX, V0.bot + 14); }
      if (a.supply) {
        const sy = V0.bot + 34;
        H0.sup = drawValve(gs, Object.assign({ kind: '22' }, a.supply), pX, sy, false);
        L([[H0.sup.M, H0.sup.top], [H0.sup.M, V0.bot + 26], [pX, V0.bot + 26], [pX, V0.bot]], s => supState(s, a));
        L([[H0.sup.M, H0.sup.bot], [H0.sup.M, yMain]], () => 'p');
        mainX0 = Math.min(mainX0, H0.sup.M); mainX1 = Math.max(mainX1, H0.sup.M);
        H0.pline = { x: H0.sup.M, y0: H0.sup.bot, y1: yMain };
      } else {
        L([[pX, V0.bot], [pX, yMain]], () => 'p');
        mainX0 = Math.min(mainX0, pX); mainX1 = Math.max(mainX1, pX);
        H0.pline = { x: pX, y0: V0.bot, y1: yMain };
      }
    }
  });
  let pu = null;
  if (!pneu) {
    // 주 압력 라인, 압력계·릴리프밸브, 파워유닛
    const px = OX + n * CW + 92;
    const gx = 20;
    const bx = px - 76, by = yMain - 150, bw2 = 196, bh2 = 132, dropX = bx - 24;
    L([[gx + 13, yMain], [dropX, yMain]], () => 'p');
    gauge(gs, gx, yMain); S('circle', { class: 'dot', cx: gx + 30, cy: yMain, r: 3 }, gs);
    L([[gx + 30, yMain], [gx + 30, yMain + 4]], () => 'p'); relief(gs, gx + 30, yMain + 4);
    for (const x of [mainX0, mainX1]) S('circle', { class: 'dot', cx: x, cy: yMain, r: 3 }, gs);
    // 파워유닛 (점선 상자): 펌프 → 위쪽 분기점(릴리프·압력계) → 상자 왼쪽으로 나와 주 라인으로
    S('rect', { class: 'fsym n', x: bx, y: by, width: bw2, height: bh2, 'stroke-dasharray': '10 6' }, gs);
    T(gs, bx + 6, by - 6, '파워유닛', 'sn');
    const pcx = px, pcy = by + 92;
    L([[px, pcy - 20], [px, by + 46], [dropX, by + 46], [dropX, yMain]], () => 'p');
    pu = { dropX, y0: by + 46, y1: yMain };
    S('circle', { class: 'fsym', cx: pcx, cy: pcy, r: 20 }, gs);
    S('path', { class: 'fsym k', d: `M${pcx},${pcy - 19} l-8,13 h16 z` }, gs);
    S('rect', { class: 'fsym', x: pcx + 22, y: pcy - 5, width: 14, height: 10 }, gs);
    S('circle', { class: 'fsym', cx: pcx + 58, cy: pcy, r: 18 }, gs); T(gs, pcx + 58, pcy + 6, 'M', null, 'middle').setAttribute('style', 'font-size:17px');
    tank(gs, pcx, pcy + 21);
    S('circle', { class: 'dot', cx: px - 50, cy: by + 46, r: 3 }, gs);
    relief(gs, px - 50, by + 46);
    gauge(gs, px - 50, by + 24); L([[px - 50, by + 37], [px - 50, by + 46]], () => 'p');
  }
  // 응용: 더한 밸브 (보라색)
  const extras = [];
  if (P.isApp && P.app) {
    const lab = (g, x, y, t, anchor) => T(g, x, y, t, 'xlab', anchor || 'start');
    for (const vn of P.app.valveNotes || []) {
      const H0 = acts[vn.act]; if (!H0) continue;
      const V0 = H0.valve, nb = (P.acts.find(a => a.id === vn.act).valve.boxes || []).length;
      const g = S('g', { class: 'appx' }, svg);
      const x0 = V0.hx - V0.home * BW - 36, w = nb * BW + 72;
      S('rect', { class: 'vnote', x: x0, y: V0.top - 9, width: w, height: BH + 18, rx: 8 }, g);
      lab(g, V0.B + 16, V0.bot + 20, vn.text);
      extras.push({ g, item: vn.item });
    }
    for (const x of P.app.fluid || []) {
      const g = S('g', { class: 'appx' }, svg), H0 = acts[x.act];
      const G = H0 && H0.geo;
      if (x.kind === 'mout' || x.kind === 'min') {
        const cx = x.side === 'cap' ? G.capX : G.rodX, y1 = x.side === 'cap' ? G.capY : G.rodY, y = Math.round((G.top + y1) / 2) + 4;
        oneWayFC(g, cx, y, x.kind === 'mout' ? 'up' : 'down');
        lab(g, cx + 12, y + 4, x.label);
      } else if (x.kind === 'cb') {
        const cx = x.side === 'cap' ? G.capX : G.rodX, y1 = x.side === 'cap' ? G.capY : G.rodY, y = Math.round((G.top + y1) / 2) + 2;
        cbValve(g, cx, y);
        lab(g, cx + 56, y - 6, x.label); lab(g, cx + 56, y + 8, x.sub || '');
      } else if (x.kind === 'poc') {
        const y = Math.round((G.top + G.rodY) / 2) + 6;
        pocValve(g, G.rodX, y, G.capX);
        lab(g, G.rodX + 16, y + 4, x.label);
      } else if (x.kind === 'bleed') {
        const y = Math.round(G.top + (G.capY - G.top) * 0.3);
        const bx = bleedOff(g, G.capX, y);
        lab(g, bx - 4, y + 66, x.label, 'middle');
      } else if (x.kind === 'prv') {
        const pl = H0.pline, y = Math.round((pl.y0 + pl.y1) / 2) + 14;
        prvValve(g, pl.x, y);
        lab(g, pl.x + 60, y - 30, x.label);
      } else if (x.kind === 'thr') {
        const pl = H0.pline, y = Math.round((pl.y0 + pl.y1) / 2);
        throttleSym(g, pl.x, y);
        lab(g, pl.x - 16, y + 4, x.label, 'end');
      } else if (x.kind === 'pumpchk' && pu) {
        const y = Math.round((pu.y0 + pu.y1) / 2);
        checkV(g, pu.dropX, y, 'down', false);
        lab(g, pu.dropX - 12, y + 4, x.label, 'end');
      } else if (x.kind === 'surge') {
        const V0 = H0.valve, mx = V0.M, top = G.my + 40, bot = H0.vy;
        const y1 = Math.round(top + (bot - top) * 0.22), y2 = Math.round(top + (bot - top) * 0.55);
        surgeSet(g, mx, y1, y2);
        lab(g, mx - 64, y1 - 6, x.label, 'end'); lab(g, mx + 50, y2 + 26, x.sub || '');
      }
      extras.push({ g, item: x.item });
    }
  }
  try {
    const bb = svg.getBBox();
    const x0 = Math.floor(bb.x - 14), y0 = Math.floor(bb.y - 10), w = Math.ceil(bb.width + 28 + 24), hh = Math.ceil(bb.height + 20);
    svg.setAttribute('viewBox', `${x0} ${y0} ${w} ${hh}`); svg.setAttribute('width', w); svg.setAttribute('height', hh);
    svg.style.maxWidth = Math.round(w * 1.15) + 'px'; svg.style.minWidth = Math.min(w, 640) + 'px';
  } catch (e) { }
  return { svg, acts, lines, pneu, extras };
}
function dirOf(s, a) { return s.acts[a.id].cmd; }
function lineState(s, a, side) {
  const st = s.acts[a.id];
  if (!st.supplyOpen) return 'h';
  const d = st.cmd;
  if (d === 'ext') return side === 'cap' ? 'p' : 'r';
  if (d === 'ret') return side === 'rod' ? 'p' : 'r';
  return 'h';
}
function motorLine(s, a, side) {
  const st = s.acts[a.id], d = st.cmd;
  if (d === 'stop') return 'h';
  if (side === 'in') return 'p'; if (side === 'out') return 'r';
  if (d === 'cw') return side === 'A' ? 'p' : 'r';
  return side === 'B' ? 'p' : 'r';
}
function exhState(s, a, port) { const d = s.acts[a.id].cmd; if (d === 'ext') return port === 'S' ? 'r' : ''; if (d === 'ret') return port === 'R' ? 'r' : ''; return ''; }
function supState(s, a) { return s.acts[a.id].supplyOpen ? 'p' : 'h'; }

function updateFluid(F, sim) {
  for (const l of F.lines) {
    const c = l.fn(sim) || '';
    if (l.c !== c) { l.c = c; l.el.setAttribute('class', 'fl' + (c ? ' ' + c : '')); }
  }
  const P = sim.P;
  for (const a of P.acts) {
    const H0 = F.acts[a.id], st = sim.acts[a.id];
    if (H0.cyl) {
      const dx = st.pos * H0.cyl.stroke;
      if (H0.lastDx !== dx) { H0.lastDx = dx; H0.cyl.mv.setAttribute('transform', `translate(${dx.toFixed(2)},0)`); }
      const s0 = !!sim.sensors[a.sens[0]], s1 = !!sim.sensors[a.sens[1]];
      H0.cyl.l0.classList.toggle('on', s0); H0.cyl.m0.classList.toggle('on', s0);
      H0.cyl.l1.classList.toggle('on', s1); H0.cyl.m1.classList.toggle('on', s1);
    }
    if (H0.mot) {
      H0.mot.rot.setAttribute('transform', `rotate(${(st.angle % 360).toFixed(1)} ${H0.mot.cx} ${H0.mot.cy})`);
      const tag = st.motion === 'cw' ? '정회전 CW' : st.motion === 'ccw' ? '역회전 CCW' : '';
      if (H0.mot.tag.textContent !== tag) H0.mot.tag.textContent = tag;
    }
    const V0 = H0.valve;
    const off = (V0.home - st.box) * BW;
    if (V0.lastOff !== off) { V0.lastOff = off; V0.body.style.transform = `translateX(${off}px)`; }
    for (const k in V0.sols) V0.sols[k].classList.toggle('on', !!sim.sols[k]);
    if (H0.sup) {
      const off2 = (H0.sup.home - (st.supplyBox != null ? st.supplyBox : H0.sup.home)) * BW;
      if (H0.sup.lastOff !== off2) { H0.sup.lastOff = off2; H0.sup.body.style.transform = `translateX(${off2}px)`; }
      for (const k in H0.sup.sols) H0.sup.sols[k].classList.toggle('on', !!sim.sols[k]);
    }
  }
}

/* ======================================================================
   변위-단계선도
   ====================================================================== */
function renderStep(svg, P) {
  clear(svg);
  const rows = P.seq.rows, n = P.seq.n;
  const W = 340, LMg = 66, RMg = 14, TMg = 20;
  const rh = r => r.type === 'cyl' ? 48 : 58;
  const H = TMg + rows.reduce((s, r) => s + rh(r), 0) + 8;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const xs = k => LMg + (k - 1) * (W - LMg - RMg) / (n - 1);
  const gB = S('g', null, svg), gG = S('g', null, svg), gT = S('g', null, svg), gO = S('g', null, svg);
  const band = S('rect', { class: 'band', x: 0, y: TMg - 4, width: 0, height: H - TMg - 4 }, gB);
  for (let k = 1; k <= n; k++) { S('line', { class: 'sg', x1: xs(k), y1: TMg - 4, x2: xs(k), y2: H - 6 }, gG); T(gG, xs(k), 12, k === n ? `${n}=1` : String(k), 'sn', 'middle'); }
  let y = TMg;
  const map = {};
  for (const r of rows) {
    const hgt = rh(r);
    if (r.type === 'cyl') {
      const y1 = y + 9, y0 = y + hgt - 9;
      S('line', { class: 'sg', x1: LMg - 4, y1, x2: W - RMg, y2: y1 }, gG); S('line', { class: 'sg', x1: LMg - 4, y1: y0, x2: W - RMg, y2: y0 }, gG);
      T(gG, 6, (y1 + y0) / 2 + 4, '실린더 ' + r.id, 'sl'); T(gG, LMg - 8, y1 + 3.5, '1', 'sn', 'end'); T(gG, LMg - 8, y0 + 3.5, '0', 'sn', 'end');
      const pts = r.pos.map((p, i) => [xs(i + 1), p ? y1 : y0]);
      S('polyline', { class: 'st', points: [[LMg - 4, pts[0][1]], ...pts, [W - RMg + 4, pts[pts.length - 1][1]]].map(p => p.join(',')).join(' ') }, gT);
      map[r.id] = { y: v => y0 + (y1 - y0) * v };
    } else {
      const yc = y + 9, ym = y + hgt / 2, ycc = y + hgt - 9;
      for (const yy of [yc, ym, ycc]) S('line', { class: 'sg', x1: LMg - 4, y1: yy, x2: W - RMg, y2: yy }, gG);
      T(gG, 6, ym + 4, '모터 ' + r.id, 'sl'); T(gG, LMg - 8, yc + 3.5, 'CW', 'sn', 'end'); T(gG, LMg - 8, ym + 3.5, '0', 'sn', 'end'); T(gG, LMg - 8, ycc + 3.5, 'CCW', 'sn', 'end');
      const lv = v => v === 1 ? yc : v === -1 ? ycc : ym;
      const pts = [[LMg - 4, ym], [xs(1), ym]];
      r.run.forEach((v, i) => { pts.push([xs(i + 1), lv(v)]); pts.push([xs(i + 2), lv(v)]); });
      pts.push([xs(n), ym]); pts.push([W - RMg + 4, ym]);
      S('polyline', { class: 'st', points: pts.map(p => p.join(',')).join(' ') }, gT);
      map[r.id] = { y: v => lv(v) };
    }
    y += hgt;
  }
  // 응용: 타이머로 늦춘 동작 표시
  const dl = P.isApp && P.app && P.app.delay;
  if (dl) for (let p = 1; p < n; p++) {
    const ex = E.expectInterval(P, p);
    if (ex.move[dl.act] !== dl.dir) continue;
    const yy = map[dl.act].y(ex.from[dl.act]);
    const tx = xs(p) + 4, ty = dl.dir === 'ext' ? yy - 5 : yy + 13;
    T(gT, tx, ty, '⏱ 3초 뒤', 'tdl');
  }
  const cursor = S('line', { class: 'cursor', x1: 0, y1: TMg - 4, x2: 0, y2: H - 6 }, gO);
  const traces = {}, dots = {};
  for (const r of rows) { traces[r.id] = S('polyline', { class: 'tr', points: '' }, gO); dots[r.id] = S('circle', { class: 'trdot', r: 3.6, cx: -10, cy: -10 }, gO); }
  return { svg, xs, map, band, cursor, traces, dots, n, rows, LMg };
}
function updateStep(St, sim) {
  const pr = sim.prog, xs = St.xs;
  const xOf = v => { const k = Math.floor(v), f = v - k; return xs(k) + f * (k < St.n ? xs(k + 1) - xs(k) : 0); };
  const active = pr.state === 'run' || pr.state === 'stall' || pr.state === 'dev' || pr.state === 'armed';
  if (active) { St.band.setAttribute('x', xs(pr.p)); St.band.setAttribute('width', xs(Math.min(pr.p + 1, St.n)) - xs(pr.p)); }
  else St.band.setAttribute('width', 0);
  const cx = xOf(pr.p + (pr.state === 'run' ? pr.frac : 0));
  St.cursor.setAttribute('x1', cx); St.cursor.setAttribute('x2', cx);
  St.cursor.style.opacity = active ? 1 : 0.35;
  // 실제 움직임 궤적
  const tr = sim.trace;
  for (const r of St.rows) {
    const m = St.map[r.id];
    let pts = '', lastDev = false;
    for (const p of tr) { pts += xOf(p.x).toFixed(1) + ',' + m.y(p.pos[r.id]).toFixed(1) + ' '; lastDev = p.dev; }
    St.traces[r.id].setAttribute('points', pts);
    St.traces[r.id].classList.toggle('dev', pr.state === 'dev');
    const cur = r.type === 'cyl' ? sim.acts[r.id].pos : (sim.acts[r.id].motion === 'cw' ? 1 : sim.acts[r.id].motion === 'ccw' ? -1 : 0);
    St.dots[r.id].setAttribute('cx', cx); St.dots[r.id].setAttribute('cy', m.y(cur));
    St.dots[r.id].classList.toggle('dev', pr.state === 'dev');
  }
}

/* ======================================================================
   앱
   ====================================================================== */
const app = {
  P: null, PV: null, view: 'prob', def: null, sim: null, L: null, F: null, St: null, appCheck: null,
  running: true, speed: 1, stepMode: false, waitStep: false, showErr: false, editMode: false,
  edits: {}, prac: null, logN: 0, lastProgKey: '', hoverName: null, focusErr: null,
};

/* 지금 보기에서 쓰는 문제 정의 (응용 보기에서는 밸브 등이 바뀐 액추에이터) */
function viewProblem(P, view) {
  if ((view === 'app' || (view === 'wire' && app.wire && app.wire.target === 'app')) && P.app) return Object.assign({}, P, { acts: P.app.acts || P.acts, isApp: true });
  return P;
}
function viewDef() {
  const P = app.P;
  if (app.view === 'wire') return { def: wireDef(), marks: {} };
  if (app.view === 'app') return { def: P.app.ladder ? E.normalizeDef(P.app.ladder) : E.applyPatches(P.ladder, P.fix).def, marks: {} };
  if (app.view === 'fix') return { def: E.applyPatches(P.ladder, P.fix).def, marks: E.applyPatches(P.ladder, P.fix).marks };
  if (app.view === 'prac') return { def: app.prac.def, marks: {} };
  return { def: app.def0, marks: {} };
}

function buildProblem(key, view) {
  const P = PROBLEMS.find(p => p.key === key) || PROBLEMS[0];
  if (app.P !== P) { app.P = P; app.def0 = E.normalizeDef(P.ladder); app.edits = {}; app.prac = null; app.wire.target = P.app ? store.get('stage.' + P.key, 'fix') : 'fix'; }
  app.view = view || app.view;
  if (app.view === 'app' && !P.app) app.view = 'fix';
  if (app.view === 'prac' && !app.prac) newPractice();
  app.appCheck = null;
  location.hash = P.key;
  store.set('last', { key: P.key, view: app.view });
  rebuild();
}

function rebuild(keepSim) {
  const P = app.P;
  const vd = viewDef();
  app.marks = vd.marks;
  app.def = vd.def;
  let net;
  try { net = E.buildNet(app.def); } catch (err) { console.error(err); return; }
  const PV = app.PV = viewProblem(P, app.view);
  const wv = app.view === 'wire';
  $('#sheetWire').hidden = !wv;
  document.body.classList.toggle('wiremode', wv);
  if (wv) setupWire(PV, app.def);
  $('#fluidBadge').hidden = !wv; $('#tnoWrap').hidden = !wv;
  $('#fluidNote').textContent = wv ? (app.wire.panel.air ? (app.wire.panel.air.medium === 'oil' ? '꽂은 선·호스대로 움직여요 — 호스를 잘못 꽂으면 여기서도 도면과 다르게 움직여요 · 실린더·모터·밸브를 누르면 꽂을 커플러를 보여줘요' : '꽂은 선·관대로 움직여요 — 관을 잘못 꽂으면 여기서도 도면과 다르게 움직여요 · 실린더·밸브를 누르면 꽂을 포트를 보여줘요') : '꽂은 선대로 움직여요 — PB1(①PBS-1)을 누르면 여기서 실린더·모터 동작을 봐요') : FLUID_NOTE;
  applyFloats(wv);
  app.sim = wv ? new E.Sim(PV, wireSimDef()) : new E.Sim(PV, app.def);
  app.L = renderLadder($('#ladderSvg'), wv ? net : app.sim.net, PV, { rail: P.rail, a1a2: P.a1a2, ghosts: app.view === 'fix', appMarks: app.view === 'app' || (wv && app.wire.target === 'app') });
  if (wv) annotateLadder();
  app.F = renderFluid($('#fluidSvg'), PV);
  app.St = renderStep($('#stepSvg'), PV);
  pbExtraUI();
  app.logN = 0; clear($('#log'));
  app.lastProgKey = ''; app.waitStep = false;
  $('#nextBtn').hidden = !app.stepMode;
  bindLadder();
  headerUI();
  errPanel();
  buildLeds();
  drawAllMarks();
  frame(0, true);
}

function headerUI() {
  const P = app.P;
  $('#plate').textContent = P.title;
  $('#subTitle').textContent = '과정평가형 2차평가 공개문제 · ' + (P.kind === 'pneu' ? '1과제 공기압 회로 구성' : '2과제 유압 회로 구성');
  $('#fluidTitle').textContent = P.kind === 'pneu' ? '다. 공압 회로도' : '다. 유압 회로도';
  $('#probSel').value = P.key;
  document.querySelectorAll('.modes button').forEach(b => b.setAttribute('aria-selected', b.dataset.view === app.view ? 'true' : 'false'));
  const badge = $('#viewBadge');
  badge.className = 'badge' + (app.view === 'fix' ? ' ok' : app.view === 'prac' ? ' prac' : app.view === 'app' ? ' ap' : app.view === 'wire' ? ' wv' : '');
  badge.textContent = app.view === 'wire' ? (app.wire.target === 'app' ? '배선 연습 기준 · 응용 회로' : '배선 연습 기준 · 정정 도면') : app.view === 'fix' ? '정정 도면 · 바뀐 곳 초록 표시' : app.view === 'prac' ? '오류 연습 · 무작위 오류 ' + app.prac.changes.length + '개' : app.view === 'app' ? (P.kind === 'pneu' ? '응용 동작 · 바뀐 곳 보라색 표시' : '응용 동작 · 전기 회로는 정정 도면과 같음') : (P.errors.length ? '문제 도면 · 오류 ' + P.errors.length + '곳' : '문제 도면 · 오류 없음');
  $('#errToggleWrap').hidden = app.view !== 'prob';
  $('#editToggleWrap').hidden = app.view === 'fix' || app.view === 'app' || app.view === 'wire';
  const tab = $('#appTab'); tab.disabled = !P.app; tab.title = P.app ? '' : '이 문제는 응용 동작이 없어요';
  $('#errToggle').checked = app.showErr;
  $('#editToggle').checked = canEdit();
  $('#seqTxt').textContent = P.seqText;
  // 단계 칩
  const chips = $('#stepChips'); clear(chips);
  app.chipEls = [];
  for (let p = 1; p < P.seq.n; p++) {
    const ex = E.expectInterval(P, p), parts = [];
    for (const id in ex.move) if (ex.move[id] !== 'stop') parts.push(id + (ex.move[id] === 'ext' ? '+' : '-'));
    for (const id in ex.run) parts.push(id + ':' + (ex.run[id] === 'cw' ? 'CW' : ex.run[id] === 'ccw' ? 'CCW' : '정지'));
    const c = h('span', 'chip', `${p}→${p + 1} ${parts.join(' ')}`);
    chips.appendChild(c); app.chipEls.push(c);
  }
}

/* ---------- 오류 해설 패널 ---------- */
function errNums(err) {
  // 이 오류에 해당하는 요소 → 줄 번호
  const P = app.P, ids = [];
  for (const p of P.fix) if (p.err === err) {
    if (p.op === 'set' || p.op === 'del') ids.push(p.id);
    if (p.op === 'add') ids.push({ col: p.col });
    if (p.op === 'replace') (p.removeCols || []).forEach(c => ids.push({ col: c }));
  }
  const nums = new Set();
  const colOfId = id => { for (const c of app.def0.cols) for (const e of c.els) if (e[3].id === id) return c; return null; };
  for (const x of ids) {
    const c = typeof x === 'string' ? colOfId(x) : app.def0.cols.find(c => c.id === x.col);
    if (!c) continue;
    let cc = c;
    if (Math.abs(cc.y1 - E.H) > 1e-6) { // 가지 줄이면 옆의 본 줄
      const cands = app.def0.cols.filter(k => Math.abs(k.y1 - E.H) < 1e-6 && k.x <= cc.x + 1e-6).sort((a, b) => b.x - a.x);
      if (cands.length) cc = cands[0];
    }
    const L0 = E.buildNet(app.def0); // 번호 계산용 (문제 도면 기준)
    const bot = L0.cols.filter(k => Math.abs(k.y1 - E.H) < 1e-6).sort((a, b) => a.x - b.x);
    const i = bot.findIndex(k => k.id === cc.id); if (i >= 0) nums.add(i + 1);
  }
  return [...nums].sort((a, b) => a - b);
}
// 시험장 기준으로 도면을 어떻게 읽었는지 (근접센서는 a접점만 있음 등)
const SENSOR_NOTE = 'S1·S2 근접센서는 시험장에 a접점(감지하면 출력)만 있어요. 센서 자체를 b접점으로 바꾸는 정정은 없어요.';
function hasProx(P) { return P.acts.some(a => a.type === 'cyl' && a.prox); }
function readBox(P) {
  const items = [];
  if (hasProx(P)) items.push(SENSOR_NOTE);
  if (P.readNote) items.push(P.readNote);
  if (!items.length) return null;
  const box = h('div', 'readnote');
  box.appendChild(h('b', null, '도면 읽기 · 시험장 기준'));
  const ul = h('ul');
  for (const t of items) ul.appendChild(h('li', null, t));
  box.appendChild(ul);
  return box;
}
function errPanel() {
  const P = app.P, body = $('#errBody'); clear(body);
  const title = $('#errTitle');
  if (app.view === 'prac') { title.textContent = '오류 연습'; pracPanel(body); return; }
  if (app.view === 'app') { appPanel(body, title); return; }
  if (app.view === 'wire') { wirePanel(body, title); return; }
  title.textContent = app.view === 'fix' ? '정정한 곳 (' + P.errors.length + ')' : '오류 해설 (' + P.errors.length + ')';
  const rb = readBox(P);
  if (rb) body.appendChild(rb);
  if (!P.errors.length) {
    body.appendChild(h('p', 'okmsg', P.okNote || '오류가 없어요.'));
    const b = h('button', 'btn', '이 문제로 오류 연습하기'); b.style.marginTop = '8px';
    b.onclick = () => buildProblem(P.key, 'prac'); body.appendChild(b);
  } else {
    if (app.view === 'prob') body.appendChild(h('p', 'note', 'PB1을 눌러 동작시켜 보고 어디서 멈추는지 먼저 확인해 보세요. 항목을 누르면 도면에 위치가 표시돼요. 위에서부터 차례로 고치면 다음 증상이 나타나요.'));
    const list = h('div', 'errlist');
    P.errors.forEach((er, i) => {
      const b = h('button', 'err' + (app.view === 'fix' ? ' fixv' : ''));
      b.appendChild(h('span', 'num', String(i + 1)));
      b.appendChild(h('b', null, er.title));
      const nums = errNums(i + 1);
      b.appendChild(h('span', 'at', er.at + (nums.length ? ' · 줄 ' + nums.join('·') : '')));
      b.appendChild(h('span', 'sym', (app.view === 'fix' ? '고치기 전: ' : '증상: ') + er.sym));
      b.appendChild(h('span', 'why', er.why));
      b.onclick = () => { app.focusErr = app.focusErr === i + 1 ? null : i + 1; list.querySelectorAll('.err').forEach((x, j) => x.classList.toggle('on', app.focusErr === j + 1)); drawAllMarks(); };
      list.appendChild(b);
    });
    body.appendChild(list);
    if (app.view === 'prob') {
      const b = h('button', 'btn', '정정 도면으로 돌려보기'); b.style.marginTop = '9px';
      b.onclick = () => buildProblem(P.key, 'fix'); body.appendChild(b);
    } else body.appendChild(h('p', 'note', '정정 도면은 변위단계선도를 만족하도록 고친 한 가지 예예요. 릴레이 개수는 그대로이고, 같은 동작을 하면 다른 방법으로 고쳐도 돼요.'));
  }
  if (P.apply && P.apply.length) {
    const ap = h('div', 'applist');
    ap.appendChild(h('b', null, '응용제어동작 (이 시뮬레이터는 기본제어동작만 다뤄요)'));
    const ul = h('ul');
    const common = P.kind === 'pneu' ? ['PB2 연속 3회 동작 · PB3 카운터 리셋 (PB1 기본동작은 카운트 안 함)'] : [];
    for (const t of common.concat(P.apply)) ul.appendChild(h('li', null, t));
    ap.appendChild(ul); body.appendChild(ap);
  }
}

/* ---------- 응용 해설 ---------- */
function appPanel(body, title) {
  const P = app.P, A = P.app;
  title.textContent = '응용 해설 (' + A.items.length + ')';
  body.appendChild(h('p', 'note', P.kind === 'pneu'
    ? '정정 도면에 응용 조건 ①②③을 넣은 회로예요. PB1 = 기본동작 1회, PB2 = 연속 3회, PB3 = 카운터 리셋. 항목을 누르면 바뀐 곳이 도면에 깜빡여요.'
    : '정정 도면에 응용 조건 ①②③을 넣은 회로예요. 전기 회로는 기본과 같고 유압 회로에 밸브가 더해져요. 항목을 누르면 바뀐 곳이 깜빡여요.'));
  const list = h('div', 'errlist');
  A.items.forEach(it => {
    const b = h('button', 'err apv' + (app.focusErr === it.n ? ' on' : ''));
    b.appendChild(h('span', 'num', String(it.n)));
    b.appendChild(h('b', null, it.title));
    b.appendChild(h('span', 'at', '조건: ' + it.req));
    const how = h('span', 'why');
    it.how.forEach(t => how.appendChild(h('span', 'hl1', t)));
    b.appendChild(how);
    b.onclick = () => { app.focusErr = app.focusErr === it.n ? null : it.n; list.querySelectorAll('.err').forEach((x, j) => x.classList.toggle('on', app.focusErr === A.items[j].n)); drawAllMarks(); };
    list.appendChild(b);
  });
  body.appendChild(list);
  if (A.removed && A.removed.length) body.appendChild(h('p', 'note', '뺀 것 — ' + A.removed.map(r => CIRC[r.item - 1] + ' ' + r.text).join(' · ')));
  const box = h('div', 'appchk');
  const btn = h('button', 'btn primary', app.appCheck ? '다시 확인' : '응용 동작 자동 확인');
  const res = h('div', 'chkres');
  btn.onclick = () => {
    btn.disabled = true; btn.textContent = '확인 중…'; clear(res);
    setTimeout(() => {
      let r; try { r = E.runAppCheck(app.PV, app.def); } catch (err) { console.error(err); r = { ok: false, steps: [{ ok: false, text: '확인 중 오류: ' + err.message }] }; }
      app.appCheck = r; renderCheck(res, r); btn.disabled = false; btn.textContent = '다시 확인';
    }, 40);
  };
  box.appendChild(btn);
  box.appendChild(h('span', 'note', P.kind === 'pneu' ? ' PB1 1회 → PB2 연속 → 리셋 전 PB2 → PB3 → PB2 순서로 시험해요.' : ' PB1로 2회 동작시키며 속도를 재요.'));
  box.appendChild(res);
  if (app.appCheck) renderCheck(res, app.appCheck);
  body.appendChild(box);
  body.appendChild(h('p', 'note', '응용 회로는 조건을 만족하는 한 가지 예예요. 같은 동작을 하면 다른 방법으로 꾸며도 돼요.'));
}
function renderCheck(res, r) {
  clear(res);
  res.appendChild(h('p', r.ok ? 'okmsg' : 'badmsg', r.ok ? (r.okText || '✓ 응용 조건을 모두 만족해요.') : (r.badText || '✗ 만족하지 않는 조건이 있어요.')));
  const ul = h('ul', 'chk');
  for (const st of r.steps) ul.appendChild(h('li', st.note ? 'nt' : st.ok ? 'ok' : 'bad', (st.note ? '※ ' : st.ok ? '✓ ' : '✗ ') + st.text));
  res.appendChild(ul);
}

/* ---------- 오류 연습 ---------- */
function rng() { return Math.random(); }
function newPractice(count) {
  const P = app.P;
  count = count || (app.prac && app.prac.count) || 2;
  const fixed = E.applyPatches(P.ladder, P.fix).def;
  const relayNames = [...new Set(fixed.cols.flatMap(c => c.els.filter(e => e[0] === 'coil').map(e => e[1])))];
  const lsNames = [...new Set(P.acts.filter(a => a.type === 'cyl' && !a.prox).flatMap(a => a.sens))];
  const cands = [];
  fixed.cols.forEach(c => c.els.forEach(e => { if (['no', 'nc', 'lsno', 'lsnc'].includes(e[0]) && !e[3].ghost) cands.push(e[3].id); }));
  // 센서 전원 줄에 있는 리밋스위치는 시험장에서 a접점만 쓰니 a/b를 뒤집지 않음 (번호만 바꿀 수 있음)
  const senLine = new Set();
  fixed.cols.forEach(c => { if (c.els.some(e => e[0] === 'sen')) c.els.forEach(e => senLine.add(e[3].id)); });
  let best = null;
  for (let tries = 0; tries < 80; tries++) {
    const d = JSON.parse(JSON.stringify(fixed));
    const find = id => { for (const c of d.cols) for (const e of c.els) if (e[3].id === id) return e; };
    const pick = cands.slice().sort(() => rng() - 0.5).slice(0, count);
    const changes = [];
    for (const id of pick) {
      const e = find(id), before = { t: e[0], n: e[1] };
      const ls = e[0] === 'lsno' || e[0] === 'lsnc';
      const noFlip = ls && senLine.has(id);
      if (noFlip && lsNames.length < 2) continue;
      if (!noFlip && (rng() < 0.5 || (ls && lsNames.length < 2))) e[0] = { no: 'nc', nc: 'no', lsno: 'lsnc', lsnc: 'lsno' }[e[0]];
      else {
        const pool = (ls ? lsNames : relayNames).filter(n => n !== e[1]);
        e[1] = pool[Math.floor(rng() * pool.length)];
      }
      if (ls) e[3].arrow = initActuated(P, e[1]) ? true : false;
      changes.push({ id, before, after: { t: e[0], n: e[1] } });
    }
    if (changes.length < pick.length) continue;
    let r;
    try { r = E.runCheck(P, d, { cycles: 2, timeout: 14 }); } catch (err) { continue; }
    if (!r.ok) { best = { def: d, changes, count, revealed: false, result: null }; break; }
  }
  app.prac = best || { def: fixed, changes: [], count, revealed: false };
  app.edits = {};
}
function initActuated(P, name) {
  for (const a of P.acts) if (a.type === 'cyl') {
    const r = P.seq.rows.find(r => r.id === a.id);
    if (a.sens[0] === name) return r.pos[0] === 0;
    if (a.sens[1] === name) return r.pos[0] === 1;
  }
  return false;
}
function pracPanel(body) {
  const P = app.P, pr = app.prac;
  const box = h('div', 'pracbox');
  box.appendChild(h('p', 'note', `정정 도면에 무작위로 오류 ${pr.changes.length}개를 넣었어요(접점 a/b가 바뀌거나 번호가 바뀜). PB1로 동작시켜서 어디서 멈추는지 보고, "접점 고치기"를 켠 다음 의심되는 기호를 눌러 고쳐 보세요.`));
  if (hasProx(P)) {
    const lsOnSen = P.ladder.cols.some(c => c.els.some(e => e[0] === 'sen') && c.els.some(e => e[0] === 'lsno' || e[0] === 'lsnc'));
    box.appendChild(h('p', 'note', 'S1·S2 근접센서는 시험장에 a접점만 있어서 무작위 오류에 넣지 않아요.' + (lsOnSen ? ' 센서 전원 줄의 리밋스위치도 a접점 그대로 두고 번호만 바뀔 수 있어요.' : '')));
  }
  const row = h('div', 'row');
  const seg = h('div', 'seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', '오류 개수');
  [1, 2, 3].forEach(k => { const b = h('button', k === pr.count ? 'on' : '', '오류 ' + k + '개'); b.onclick = () => { newPractice(k); rebuild(); }; seg.appendChild(b); });
  row.appendChild(seg);
  const nb = h('button', 'btn', '새 문제'); nb.onclick = () => { newPractice(pr.count); rebuild(); };
  row.appendChild(nb);
  box.appendChild(row);
  const row2 = h('div', 'row');
  const cb = h('button', 'btn primary', '채점: 2회 연속 동작 확인'); cb.onclick = () => gradePractice();
  const rb = h('button', 'btn', pr.revealed ? '정답 숨기기' : '정답 보기'); rb.onclick = () => { pr.revealed = !pr.revealed; errPanel(); drawAllMarks(); };
  row2.appendChild(cb); row2.appendChild(rb);
  box.appendChild(row2);
  const res = h('div'); res.id = 'pracRes'; box.appendChild(res);
  if (pr.result) res.appendChild(pr.result);
  if (pr.revealed) {
    const ul = h('ul'); ul.className = 'note';
    pr.changes.forEach((c, i) => ul.appendChild(h('li', null, `${i + 1}. ${descEl(c.before)} → (넣은 오류) ${descEl(c.after)}`)));
    box.appendChild(h('p', 'note', '넣은 오류 (원래 → 바뀐 것):'));
    box.appendChild(ul);
  }
  body.appendChild(box);
}
function descEl(x) { const k = { no: 'a접점', nc: 'b접점', lsno: 'a접점', lsnc: 'b접점', coil: '코일', sol: '솔레노이드' }[x.t] || ''; return x.n + ' ' + k; }
function gradePractice() {
  const P = app.P, r = E.runCheck(P, app.def, { cycles: 2, timeout: 20 });
  const div = h('div');
  if (r.ok) {
    const fixedAll = app.prac.changes.every(c => { const e = findEl(app.def, c.id); return e && e[0] === c.before.t && e[1] === c.before.n; });
    div.appendChild(h('p', 'okmsg', '✓ 변위단계선도대로 2회 연속 정상 동작해요.' + (fixedAll ? ' 넣은 오류를 모두 원래대로 고쳤어요.' : ' 넣은 오류와 다른 방법으로 고쳤지만 동작은 맞아요.')));
  } else {
    const why = r.state === 'dev' ? `${r.dev.p}→${r.dev.p + 1}단계에서 ${E.actName(P, r.dev.act)}가 선도와 다르게 움직여요.` : r.osc.length ? `${r.osc.join('·')}가 발진해요.` : `${r.p}단계에서 멈춰요.`;
    div.appendChild(h('p', 'badmsg', '✗ 아직이에요. ' + why + ' (완료 ' + r.cycles + '회)'));
  }
  app.prac.result = div;
  const res = $('#pracRes'); clear(res); res.appendChild(div);
}
function findEl(def, id) { for (const c of def.cols) for (const e of c.els) if (e[3].id === id) return e; return null; }

/* ---------- 도면 표시 (오류 / 정정 / 수정) ---------- */
function drawAllMarks() {
  const L = app.L, P = app.P, list = [];
  const itemById = {}; for (const it of L.items) itemById[it.e.id] = it;
  if (app.view === 'prob' && (app.showErr || app.focusErr)) {
    const t = E.errorTargets(P.ladder, P.fix);
    for (const id in t.targets) {
      if (app.focusErr && t.targets[id] !== app.focusErr) continue;
      const it = itemById[id]; if (!it) continue;
      list.push({ cls: 'bad', box: bboxOf(it), n: t.targets[id], pulse: !!app.focusErr });
    }
    for (const a of t.adds) {
      if (app.focusErr && a.err !== app.focusErr) continue;
      const c = app.sim.net.cols.find(c => c.id === a.col); if (!c) continue;
      const fake = { e: { type: a.el[0], name: a.el[1], x: c.x, y: a.el[2] } };
      list.push({ cls: 'bad', box: bboxOf(fake), n: a.err, tag: '+ ' + a.el[1] + (a.el[0] === 'nc' ? ' b접점 추가' : ' a접점 추가'), pulse: !!app.focusErr });
    }
  }
  if (app.view === 'fix') {
    for (const id in app.marks) {
      const m = app.marks[id];
      if (app.focusErr && m.err !== app.focusErr) continue;
      const it = itemById[id];
      if (it) list.push({ cls: 'ok', box: bboxOf(it), n: m.err, pulse: !!app.focusErr });
      else if (m.kind === 'del') {
        const g = app.sim.net.ghosts.find(g => g.id === id);
        if (g) list.push({ cls: 'bad', box: bboxOf({ e: g }), n: m.err, tag: '삭제' });
      }
    }
  }
  if (app.F && app.F.extras) for (const ex of app.F.extras) ex.g.classList.toggle('focus', app.view === 'app' && app.focusErr === ex.item);
  if (app.view === 'app' && app.focusErr) for (const it of L.items) {
    const n = it.e.o && it.e.o.app; if (n !== app.focusErr) continue;
    list.push({ cls: 'ap', box: bboxOf(it), n, pulse: true });
  }
  if (app.view === 'prac' && app.prac.revealed) for (const c of app.prac.changes) { const it = itemById[c.id]; if (it) list.push({ cls: 'bad', box: bboxOf(it), n: null, tag: '원래 ' + descEl(c.before) }); }
  for (const id in app.edits) { const it = itemById[id]; if (it) list.push({ cls: 'ed', box: bboxOf(it), n: null }); }
  if (app.view === 'wire' && app.wire.check && !app.wire.stale) {
    const bad = new Set(app.wire.check.items.filter(i => i.sev === 'err' && i.load).map(i => i.load));
    for (const it of L.items) if (bad.has(it.e.type + ':' + it.e.name)) list.push({ cls: 'bad', box: bboxOf(it), n: null, tag: '배선 확인' });
  }
  if (app.guideIds) for (const id of app.guideIds) { const it = itemById[id]; if (it) list.push({ cls: 'ap', box: bboxOf(it), n: null, pulse: true }); }
  if (app.flashIds) for (const id of app.flashIds) { const it = itemById[id]; if (it) list.push({ cls: 'bad', box: bboxOf(it), n: null, pulse: true }); }
  drawMarks(L, list);
}

/* ---------- 래더 상호작용 ---------- */
function bindLadder() {
  const L = app.L;
  for (const it of L.items) {
    const g = it.g;
    const name = it.e.name;
    g.addEventListener('pointerenter', () => setXref(name));
    g.addEventListener('pointerleave', () => setXref(null));
    if (it.e.type === 'pb') {
      g.addEventListener('pointerdown', ev => { ev.preventDefault(); pbDown(); });
      g.addEventListener('pointerup', pbUp); g.addEventListener('pointercancel', pbUp); g.addEventListener('pointerleave', pbUp);
    } else {
      g.addEventListener('click', ev => {
        if (canEdit() && ['no', 'nc', 'lsno', 'lsnc', 'coil', 'sol'].includes(it.e.type)) openEdit(it, ev);
        else if (canEdit() && it.e.type === 'sen') openSensorInfo(it, ev);
        else if (app.view === 'wire') { setXref(name, true); wireRefClick(it, ev); }
        else setXref(app.hoverName === name ? null : name, true);
      });
    }
    if (canEdit() && ['no', 'nc', 'lsno', 'lsnc', 'coil', 'sol'].includes(it.e.type)) g.classList.add('edit');
  }
}
function setXref(name, sticky) {
  if (sticky) app.stickyName = name;
  const nm = name || app.stickyName;
  if (app.hoverName === nm) return;
  app.hoverName = nm;
  for (const it of app.L.items) it.g.classList.toggle('xref', !!nm && it.e.name === nm);
  if (app.view === 'wire') { app.wire.xname = nm || null; drawOverlay(); }
}
function placePop(it, wide) {
  const pop = $('#editPop'), body = $('#ladderBody');
  clear(pop); pop.hidden = false; pop.className = 'pop' + (wide ? ' wide' : '');
  const rel = it.g.getBoundingClientRect(), bb = body.getBoundingClientRect(), pw = wide ? 308 : 228;
  pop.style.left = Math.max(4, Math.min(body.scrollLeft + body.clientWidth - pw, rel.left - bb.left + body.scrollLeft - 100)) + 'px';
  pop.style.top = Math.max(4, rel.bottom - bb.top + 6) + 'px';
  return pop;
}
function openSensorInfo(it, ev) {
  const pop = placePop(it);
  pop.appendChild(h('h3', null, it.e.name + ' 근접센서'));
  pop.appendChild(h('p', 'popnote', '시험장에는 a접점(감지하면 출력)만 있어서 바꿀 수 없어요. 센서에 전원을 주는 접점이나 출력이 들어가는 줄을 확인해 보세요.'));
  const r = h('div', 'row');
  const close = h('button', 'btn sm', '닫기'); close.onclick = () => { pop.hidden = true; };
  r.appendChild(close); pop.appendChild(r);
  ev.stopPropagation();
}
function openEdit(it, ev) {
  const pop = placePop(it);
  const e = it.e, P = app.P;
  const isC = E.isContact(e.type), ls = e.type === 'lsno' || e.type === 'lsnc';
  pop.appendChild(h('h3', null, (isC ? (ls ? '리밋스위치 접점' : '릴레이 접점') : e.type === 'coil' ? '릴레이 코일' : '솔레노이드') + ' 고치기'));
  const src = findEl(app.def, e.id);
  if (isC) {
    const r = h('div', 'row'), seg = h('div', 'seg');
    for (const [t, lbl] of [[ls ? 'lsno' : 'no', 'a접점'], [ls ? 'lsnc' : 'nc', 'b접점']]) {
      const b = h('button', src[0] === t ? 'on' : '', lbl);
      b.onclick = () => { applyEdit(e.id, t, null); };
      seg.appendChild(b);
    }
    r.appendChild(seg); pop.appendChild(r);
  }
  const r2 = h('div', 'row');
  r2.appendChild(h('span', null, '번호'));
  const sel = h('select'); sel.id = 'editSel';
  const names = isC ? (ls ? P.acts.filter(a => a.type === 'cyl' && !a.prox).flatMap(a => a.sens) : allNames('coil')) : allNames(e.type);
  for (const n of names) { const o = h('option', null, n); o.value = n; if (n === src[1]) o.selected = true; sel.appendChild(o); }
  sel.onchange = () => applyEdit(e.id, null, sel.value);
  r2.appendChild(sel); pop.appendChild(r2);
  const r3 = h('div', 'row');
  const close = h('button', 'btn sm', '닫기'); close.onclick = () => { pop.hidden = true; };
  r3.appendChild(close);
  if (app.edits[e.id]) { const undo = h('button', 'btn sm', '원래대로'); undo.onclick = () => { const o = app.edits[e.id]; applyEdit(e.id, o.t, o.n, true); delete app.edits[e.id]; pop.hidden = true; refreshAfterEdit(); }; r3.appendChild(undo); }
  pop.appendChild(r3);
  ev.stopPropagation();
}
function allNames(type) {
  const set = new Set();
  const d = E.applyPatches(app.P.ladder, app.P.fix).def;
  for (const c of d.cols) for (const e of c.els) if (e[0] === type) set.add(e[1]);
  return [...set].sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
}
function applyEdit(id, t, n, silent) {
  const e = findEl(app.def, id); if (!e) return;
  if (!app.edits[id]) app.edits[id] = { t: e[0], n: e[1] };
  if (t) e[0] = t; if (n) e[1] = n;
  if (e[0] === 'lsno' || e[0] === 'lsnc') e[3].arrow = initActuated(app.P, e[1]);
  const o = app.edits[id]; if (o && o.t === e[0] && o.n === e[1]) delete app.edits[id];
  if (!silent) refreshAfterEdit();
}
function refreshAfterEdit() {
  if (app.view === 'prob') app.def0 = app.def;
  $('#editPop').hidden = true;
  const sv = app.view;
  app.sim = new E.Sim(app.P, app.def);
  app.L = renderLadder($('#ladderSvg'), app.sim.net, app.P, { rail: app.P.rail, a1a2: app.P.a1a2, ghosts: app.view === 'fix' });
  app.logN = 0; clear($('#log')); app.lastProgKey = '';
  bindLadder(); buildLeds(); drawAllMarks(); frame(0, true);
}

/* ---------- 상태 표시 ---------- */
function buildLeds() {
  const box = $('#leds'); clear(box);
  const sim = app.sim; app.ledEls = [];
  const add = (grp, names, cls, get) => {
    if (!names.length) return;
    box.appendChild(h('div', 'ledgroup', grp));
    for (const n of names) { const d = h('div', 'led ' + cls); d.appendChild(h('i')); d.appendChild(h('span', null, n)); d.title = n; box.appendChild(d); app.ledEls.push({ d, n, get }); d.onmouseenter = () => setXref(n); d.onmouseleave = () => setXref(null); }
  };
  const wiredDev = n => app.view === 'wire' && app.wire.panel.elements.some(e => e.name === n && app.wire.wires.some(x => x.a === e.ja || x.b === e.ja || x.a === e.jb || x.b === e.jb));
  const rel = Object.keys(sim.relays).filter(k => !sim.relays[k].noCoil && (app.view !== 'wire' || app.wire.panel.relayNames.includes(k) || wiredDev(k))).sort((a, b) => (parseInt(a.replace(/\D+/g, '')) || 99) - (parseInt(b.replace(/\D+/g, '')) || 99));
  add('릴레이', rel, 'k', n => sim.relays[n].on);
  add('솔레노이드', Object.keys(sim.sols).sort(), 'y', n => sim.sols[n]);
  const sens = []; for (const a of app.P.acts) if (a.type === 'cyl') sens.push(...a.sens);
  add('센서 · 리밋스위치', sens, 's', n => sim.sensors[n]);
  const tms = Object.keys(sim.timers).filter(k => app.view !== 'wire' || (k === 'T1' && app.wire.panel.hasT) || wiredDev(k)), cts = Object.keys(sim.counters).filter(k => app.view !== 'wire' || app.wire.panel.hasC || wiredDev(k));
  if (tms.length || cts.length) {
    box.appendChild(h('div', 'ledgroup', '타이머 · 카운터'));
    const mk = (n, cls, get, label) => { const d = h('div', 'led wide ' + cls); d.appendChild(h('i')); const sp = h('span', null, n); d.appendChild(sp); box.appendChild(d); app.ledEls.push({ d, n, get, sp, label }); d.onmouseenter = () => setXref(n); d.onmouseleave = () => setXref(null); };
    for (const n of tms) mk(n, 'tm', n => sim.timers[n].done, n => { const t = sim.timers[n]; return `${n} ${t.want ? Math.min(t.acc, t.pre).toFixed(1) : '0.0'}/${t.pre}초`; });
    for (const n of cts) mk(n, 'ct', n => sim.counters[n].done, n => { const c = sim.counters[n]; return `${n} ${c.count}/${c.pre}회`; });
  }
}
function updateLeds() {
  const sim = app.sim;
  for (const l of app.ledEls) {
    const v = !!l.get(l.n); if (l.v !== v) { l.v = v; l.d.classList.toggle('on', v); }
    l.d.classList.toggle('osc', sim.osc.has(l.n));
    if (l.label) { const t = l.label(l.n); if (l.lt !== t) { l.lt = t; l.sp.textContent = t; } }
  }
  updatePbExtra();
}
function updateLog() {
  const sim = app.sim, box = $('#log');
  const ev = sim.events;
  if (app.logN > ev.length) app.logN = 0;
  if (!ev.length && !box.firstChild) { box.appendChild(h('div', 'empty', 'PB1을 누르면 릴레이·솔레노이드·센서가 바뀌는 순서가 여기에 쌓여요.')); return; }
  if (app.logN === ev.length) return;
  const empty = box.querySelector('.empty'); if (empty) empty.remove();
  for (let i = app.logN; i < ev.length; i++) {
    const e = ev[i], d = h('div', e.kind);
    d.appendChild(h('span', 't', e.t.toFixed(2) + 's'));
    d.appendChild(document.createTextNode(e.text));
    box.appendChild(d);
  }
  app.logN = ev.length;
  while (box.childNodes.length > 220) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
}
function updateStatus() {
  const sim = app.sim, pr = sim.prog, P = app.P;
  const cnt = app.view !== 'wire' || (app.wire.panel && app.wire.panel.hasC) ? Object.values(sim.counters)[0] : null;
  const key = pr.state + '|' + pr.p + '|' + pr.cycles + '|' + (sim.osc.size) + '|' + sim.conflicts.size + '|' + (sim.timing() ? 'T' : '') + '|' + (cnt ? cnt.count + (cnt.done ? 'd' : '') : '');
  if (key === app.lastProgKey) return;
  app.lastProgKey = key;
  const pill = $('#statePill'), txt = $('#statusTxt'), diag = $('#diag');
  const ex = E.expectInterval(P, pr.p);
  const desc = () => { const parts = []; for (const id in ex.move) if (ex.move[id] !== 'stop') parts.push(`${E.actName(P, id)} ${ex.move[id] === 'ext' ? '전진' : '후진'}`); for (const id in ex.run) parts.push(`${E.actName(P, id)} ${E.motorWord(ex.run[id])}`); return parts.join(', '); };
  let cls = '', label = '', msg = '';
  diag.hidden = true; clear(diag); diag.className = 'diag';
  app.flashIds = null;
  const tmrName = Object.keys(sim.timers)[0];
  if (pr.state === 'idle') { cls = ''; label = '대기'; msg = app.view === 'wire' ? wireIdleMsg() + (cnt ? ' PB2 = 연속 3회 · PB3 = 카운터 리셋' : '') : cnt ? 'PB1 = 기본동작 1회 · PB2 = 연속 3회 · PB3 = 카운터 리셋' : 'PB1을 눌렀다 떼면 1단계부터 시작해요.'; }
  else if (pr.state === 'armed') { cls = 'run'; label = '시작'; msg = (pr.armedBy || 'PB1') + ' 입력 — 1단계 동작을 기다리는 중'; }
  else if (pr.state === 'run') { cls = 'run'; label = pr.p + '→' + (pr.p + 1) + '단계'; msg = desc() + (sim.timing() ? ` — 타이머 ${tmrName} ${sim.timers[tmrName].pre}초 기다리는 중` : ' 중'); }
  else if (pr.state === 'done') {
    cls = 'ok'; label = '완료 ' + pr.cycles + '회';
    if (cnt && cnt.done) msg = `연속 ${cnt.count}회 끝 — 카운터 ${cnt.count}/${cnt.pre}. PB3로 리셋한 뒤 PB2를 누르면 다시 연속 동작해요. (리셋 전에는 PB2를 눌러도 안 움직여요)`;
    else if (cnt && cnt.count > 0) msg = `사이클 끝 · 카운터 ${cnt.count}/${cnt.pre} — 연속 운전 중이면 바로 다음 사이클로 이어져요.`;
    else msg = pr.cycles >= 2 ? '변위단계선도대로 ' + pr.cycles + '회 동작했어요. 시험에서도 이렇게 2회 이상 동작을 확인해요.' : '1사이클 끝. 전원을 유지한 채 PB1을 한 번 더 눌러 2회째도 확인해 보세요.';
  }
  else if (pr.state === 'stall') {
    cls = 'bad'; label = pr.p + '단계 정지'; msg = `${pr.p}→${pr.p + 1}단계(${desc()})가 일어나지 않아요.`;
    if (app.view === 'wire') wireHint(); else showDiagnosis();
  } else if (pr.state === 'dev') {
    cls = 'bad'; label = '선도와 다름';
    const d = pr.dev, a = P.acts.find(a => a.id === d.act);
    const w = x => a.type === 'cyl' ? (x === 'ext' ? '전진' : x === 'ret' ? '후진' : '정지') : E.motorWord(x);
    msg = `${d.p}→${d.p + 1}단계에서 ${E.actName(P, d.act)}가 ${w(d.got)}했어요. 선도에서는 ${eyo(w(d.want))}.`;
    if (app.view === 'wire') wireHint(); else showDevDiagnosis(d);
  }
  if (sim.osc.size) { cls = 'bad'; msg += ` ${[...sim.osc].join('·')} 발진(붙었다 떨어졌다 반복) 중.`; }
  if (sim.conflicts.size) msg += ` ${[...sim.conflicts].map(id => E.actName(P, id)).join('·')} 밸브 양쪽 솔레노이드 동시 ON.`;
  pill.className = 'pill ' + cls; pill.textContent = label; txt.textContent = msg;
  app.chipEls.forEach((c, i) => {
    const p = i + 1;
    c.className = 'chip' + ((pr.state === 'run' || pr.state === 'armed') && p === pr.p ? ' cur' : '') + ((pr.state === 'stall' || pr.state === 'dev') && p === pr.p ? ' bad' : '') + (((pr.state === 'run' || pr.state === 'stall' || pr.state === 'dev') && p < pr.p) || pr.state === 'done' ? ' done' : '');
  });
  drawAllMarks();
}
function wireIdleMsg() {
  const w = app.wire, air = !!(w.panel && w.panel.air);
  if (!air) return w.wires.length ? '꽂은 선대로 돌아가요. PB1(①PBS-1)을 눌렀다 떼 보세요.' : '트레이너 단자에 선을 꽂아 회로를 만들어요. 다 꽂으면 PB1로 돌려 보세요.';
  if (FW().oil) {
    if (!w.wires.length && !w.tubes.length) return '랙에는 전기 선을, 아래 유압 보드에는 호스를 꽂아 회로를 만들어요. 다 꽂으면 PB1로 돌려 보세요.';
    if (!w.airOn) return '파워 유닛 펌프가 꺼져 있어요(OFF) — 파워 유닛의 펌프 버튼을 눌러 켜야 실린더 · 모터가 움직여요.';
    if (!w.bvP || !w.bvT) return `파워 유닛 ${!w.bvP ? 'P' : 'T'} 볼밸브가 닫혀 있어요 — 손잡이를 눌러 열어야 움직여요.`;
    return '꽂은 선·호스대로 돌아가요. PB1(①PBS-1)을 눌렀다 떼 보세요.';
  }
  if (!w.wires.length && !w.tubes.length) return '랙에는 전기 선을, 아래 공압 보드에는 관을 꽂아 회로를 만들어요. 다 꽂으면 PB1로 돌려 보세요.';
  if (!w.airOn) return '서비스 유닛 공기 공급이 꺼져 있어요(OFF) — 파란 손잡이를 눌러 켜야 실린더가 움직여요.';
  return '꽂은 선·관대로 돌아가요. PB1(①PBS-1)을 눌렀다 떼 보세요.';
}
function elChip(id, name) {
  const b = h('button', 'el', name);
  b.onclick = () => { app.flashIds = [id]; drawAllMarks(); scrollToEl(id); setTimeout(() => { app.flashIds = null; drawAllMarks(); }, 3200); };
  return b;
}
function scrollToEl(id) {
  const it = app.L.items.find(x => x.e.id === id); if (!it) return;
  const body = $('#ladderBody'), r = it.g.getBoundingClientRect(), bb = body.getBoundingClientRect();
  if (r.left < bb.left || r.right > bb.right) body.scrollLeft += r.left - bb.left - bb.width / 2;
  const sr = $('#sheetLadder').getBoundingClientRect();
  if (sr.top < 0 || sr.top > window.innerHeight * 0.6) $('#sheetLadder').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function showDiagnosis() {
  const sim = app.sim, diag = $('#diag');
  const d = sim.diagnose();
  diag.hidden = false;
  diag.appendChild(h('b', null, '원인 따라가기'));
  if (!d.length) { diag.appendChild(h('p', null, '움직여야 할 실린더의 솔레노이드는 맞게 켜져 있어요. 밸브 양쪽이 동시에 켜졌는지 확인해 보세요.')); return; }
  const ul = h('ul');
  const flash = [];
  const addChain = (items, parentUl) => {
    for (const it of items) {
      const li = h('li');
      li.appendChild(elChip(it.el, it.name)); flash.push(it.el);
      li.appendChild(document.createTextNode(' ' + it.reason));
      if (it.sub && it.sub.length) { const sub = h('ul'); addChain(it.sub, sub); li.appendChild(sub); }
      parentUl.appendChild(li);
    }
  };
  for (const x of d) {
    for (const b of x.bad) {
      const li = h('li');
      const a = app.P.acts.find(a => a.id === x.act);
      const what = a.type === 'cyl' ? (x.want === 'ext' ? '전진' : '후진') : E.motorWord(x.want);
      const solItem = app.L.items.find(i => i.e.type === 'sol' && i.e.name === b.sol);
      if (solItem) { li.appendChild(elChip(solItem.e.id, b.sol)); flash.push(solItem.e.id); } else li.appendChild(h('b', null, b.sol));
      li.appendChild(document.createTextNode(` ${b.need ? 'OFF' : 'ON'} → ${E.actName(app.P, x.act)}가 ${what}하려면 ${b.need ? 'ON' : 'OFF'}이어야 해요.`));
      if (b.chain && b.chain.length && b.need) { const sub = h('ul'); addChain(b.chain, sub); li.appendChild(sub); }
      else if (!b.need && b.chain && b.chain[0] && b.chain[0].closedPath) { const sub = h('ul'); const l2 = h('li', null, '닫혀 있는 접점: '); b.chain[0].closedPath.forEach(id => { const it = app.L.items.find(i => i.e.id === id); if (it) { l2.appendChild(elChip(id, it.e.name + (it.e.type === 'nc' || it.e.type === 'lsnc' ? ' b' : ' a'))); l2.appendChild(document.createTextNode(' ')); } }); sub.appendChild(l2); li.appendChild(sub); }
      ul.appendChild(li);
    }
  }
  diag.appendChild(ul);
  diag.appendChild(h('p', null, '이름을 누르면 도면에서 위치를 깜빡여 보여줘요.'));
}
function showDevDiagnosis(d) {
  const sim = app.sim, diag = $('#diag'), P = app.P;
  const a = P.acts.find(a => a.id === d.act);
  diag.hidden = false; diag.classList.add('warn');
  diag.appendChild(h('b', null, '왜 움직였나'));
  const needs = E.solNeeds(a, d.got).filter(n => n.on);
  const ul = h('ul');
  for (const n of needs) {
    const li = h('li');
    const solItem = app.L.items.find(i => i.e.type === 'sol' && i.e.name === n.sol);
    if (solItem) li.appendChild(elChip(solItem.e.id, n.sol)); else li.appendChild(h('b', null, n.sol));
    li.appendChild(document.createTextNode(` ${sim.sols[n.sol] ? 'ON' : 'OFF'} — 이 솔레노이드 회로에서 닫힌 접점: `));
    if (solItem) sim.upstream(solItem.e.a).filter(e => E.isContact(e.type) && sim.closed(e)).forEach(e => { li.appendChild(elChip(e.id, e.name + (e.type === 'nc' || e.type === 'lsnc' ? ' b' : ' a'))); li.appendChild(document.createTextNode(' ')); });
    ul.appendChild(li);
  }
  if (!needs.length) ul.appendChild(h('li', null, '솔레노이드가 꺼지면서 밸브가 중립·스프링 쪽으로 돌아갔어요.'));
  diag.appendChild(ul);
}

/* ---------- 시뮬레이션 루프 ---------- */
let lastT = 0;
function frame(ts, once) {
  if (!once) {
    const dt = Math.min(0.05, Math.max(0, (ts - lastT) / 1000)); lastT = ts;
    if (app.running && !app.waitStep && dt > 0) {
      const ran = app.sim.advance(dt * app.speed, app.stepMode);
      if (ran && app.stepMode) { app.waitStep = true; $('#nextBtn').disabled = false; }
    }
  }
  if (app.view === 'wire') { updateLadderNames(app.L, app.sim); updatePanel(); } else updateLadder(app.L, app.sim);
  updateFluid(app.F, app.sim);
  updateStep(app.St, app.sim);
  updateLeds(); updateLog(); updateStatus();
  if (!once) requestAnimationFrame(frame);
}

/* ---------- PB1 ---------- */
let pbHeld = false;
function pbDown() { if (pbHeld) return; pbHeld = true; app.sim.press('PB1', true); $('#pbBtn').classList.add('down'); $('#fab').classList.add('down'); if (app.waitStep) { app.waitStep = false; } }
function pbUp() { if (!pbHeld) return; pbHeld = false; app.sim.press('PB1', false); $('#pbBtn').classList.remove('down'); $('#fab').classList.remove('down'); }
function bindPB(el) {
  el.addEventListener('pointerdown', ev => { ev.preventDefault(); try { el.setPointerCapture(ev.pointerId); } catch (e) { } pbDown(); });
  el.addEventListener('pointerup', pbUp); el.addEventListener('pointercancel', pbUp);
  el.addEventListener('keydown', ev => { if ((ev.key === ' ' || ev.key === 'Enter') && !ev.repeat) { ev.preventDefault(); pbDown(); } });
  el.addEventListener('keyup', ev => { if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); pbUp(); } });
}

/* ---------- PB2 · PB3 (응용) ---------- */
const pbx = {};
function bindPBX(el, name) {
  let held = false;
  const down = () => { if (held) return; held = true; app.sim.press(name, true); el.classList.add('down'); if (app.waitStep) app.waitStep = false; };
  const up = () => { if (!held) return; held = false; if (app.sim.pb[name] !== undefined) app.sim.press(name, false); el.classList.remove('down'); };
  el.addEventListener('pointerdown', ev => { ev.preventDefault(); try { el.setPointerCapture(ev.pointerId); } catch (e) { } down(); });
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('keydown', ev => { if ((ev.key === ' ' || ev.key === 'Enter') && !ev.repeat) { ev.preventDefault(); down(); } });
  el.addEventListener('keyup', ev => { if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); up(); } });
  pbx[name] = { el, up };
}
function pbExtraUI() {
  const sim = app.sim, on = (app.view === 'app' || (app.view === 'wire' && app.wire.target === 'app')) && sim.pb.PB2 !== undefined;
  $('#pbExtra').hidden = !on;
  for (const k in pbx) pbx[k].el.classList.remove('down');
  if (!on) return;
  const c = Object.values(sim.counters)[0], dots = $('#cntDots'); clear(dots);
  $('#cntView').hidden = !c; $('#tmrView').hidden = !Object.keys(sim.timers).length;
  if (c) for (let i = 0; i < c.pre; i++) dots.appendChild(h('i'));
  app.pbxKey = '';
}
function updatePbExtra() {
  if ($('#pbExtra').hidden) return;
  const sim = app.sim, c = Object.values(sim.counters)[0], tn = Object.keys(sim.timers)[0], t = tn ? sim.timers[tn] : null;
  const key = (c ? c.count + (c.done ? 'd' : '') : '') + '|' + (t ? (t.want ? t.acc.toFixed(1) : '-') + (t.done ? 'd' : '') : '');
  if (key === app.pbxKey) return; app.pbxKey = key;
  if (c) {
    $('#cntDots').querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i < c.count));
    $('#cntTxt').textContent = c.count + '/' + c.pre;
    $('#cntView').classList.toggle('done', c.done);
  }
  if (t) {
    $('#tmrBar').style.width = (100 * (t.want ? (t.pre > 0 ? Math.min(1, t.acc / t.pre) : 1) : 0)).toFixed(1) + '%';
    $('#tmrTxt').textContent = (t.want ? Math.min(t.acc, t.pre).toFixed(1) : '0.0') + '/' + t.pre + '초';
    $('#tmrView').classList.toggle('done', t.done);
    $('#tmrView').classList.toggle('run', t.want && !t.done);
  }
}

/* ======================================================================
   배선 연습 — 트레이너 단자에 선 꽂기
   ====================================================================== */
const WIRE = E.WIRE;
const FLUID_NOTE = '밸브는 지금 연결된 칸으로 밀려나요 · 진한 파랑 = 압력, 연한 파랑 = 배기';
app.wire = { target: 'fix', wires: [], tubes: [], undo: [], sel: null, selP: null, selWire: -1, selTube: -1, hover: null, hoverP: null, ghost: false, live: true, panel: null, W: null, AM: null, airOn: true, auto: null, autoAir: null, check: null, checkAir: null, run: null, stale: false, flash: null, confirmAuto: false };
const WP = { svg: null };
/* 기본 → 응용을 한 배선에서 이어 하므로 선 · 관 · 설정값은 단계와 상관없이 문제마다 하나 */
function wireKey() { return 'wireS.' + app.P.key; }
function tubeKey() { return 'tubeS.' + app.P.key; }
function preKey() { return 'preS.' + app.P.key; }
function stagePass() { return store.get('passS.' + app.P.key, {}); }
function stageDefs() {
  const P = app.P, fix = E.applyPatches(P.ladder, P.fix).def;
  return { fix, app: P.app ? (P.app.ladder ? E.normalizeDef(P.app.ladder) : fix) : null };
}
/* 배선 연습 시뮬레이터 정의: 꽂은 선(넷리스트) + 공압 보드면 꽂은 관(공기 흐름) */
function wireSimDef() { const w = app.wire; return { __net: w.W.net, __air: w.AM }; }
function wireDef() {
  const P = app.P;
  if (app.wire.target === 'app' && P.app) return P.app.ladder ? E.normalizeDef(P.app.ladder) : E.applyPatches(P.ladder, P.fix).def;
  return E.applyPatches(P.ladder, P.fix).def;
}
/* 문제 · 기준 회로가 바뀔 때: 패널 만들고 저장된 선 불러오기 */
function setupWire(PV, def) {
  const w = app.wire, P = app.P;
  const D = stageDefs(), other = w.target === 'app' ? D.fix : D.app;
  w.panel = WIRE.makePanel(PV, def, { union: other ? [other] : [] });
  const pre = store.get(preKey(), null);
  if (pre) for (const k in pre) if (k in w.panel.presets) w.panel.presets[k] = pre[k];
  // 처음 여는 문제는 실습장 시작 상태(전원 · 버스 점퍼)로. 밸브가 바뀌어 없어진 코일 단자의 선은 뺌
  const raw = store.get(wireKey(), null);
  w.wires = raw ? WIRE.validWires(w.panel, raw) : WIRE.startWires(w.panel);
  w.dropped = raw ? raw.length - w.wires.length : 0;
  w.droppedOn = raw ? [...new Set(raw.filter(x => x && !(w.panel.jacks[x.a] && w.panel.jacks[x.b])).flatMap(x => [x.a, x.b]).filter(id => !w.panel.jacks[id]).map(id => id.split('.').pop().replace(/[+-]$/, '')))] : [];
  if (!raw || w.dropped) store.set(wireKey(), w.wires);
  const rawT = store.get(tubeKey(), []) || [];
  w.tubes = WIRE.validTubes(w.panel, rawT);
  // ①에는 응용 부품이 보드에 없어서, 거기 꽂은 호스는 따로 두었다가 ②에서 다시 보여줌
  w.tubesAside = w.panel.air ? rawT.filter(t => t && !(w.panel.air.ports[t.a] && w.panel.air.ports[t.b])) : [];
  w.pass = false;
  w.undo = []; w.sel = null; w.selP = null; w.selWire = -1; w.selTube = -1; w.hover = null; w.hoverP = null; w.auto = null; w.autoAir = null; w.check = null; w.checkAir = null; w.run = null; w.stale = false; w.flash = null; w.confirmAuto = false; w.confirmTok = (w.confirmTok || 0) + 1;
  w.airOn = true; w.bvP = true; w.bvT = true;
  w.W = WIRE.buildWireNet(w.panel, w.wires);
  w.AM = w.panel.air ? WIRE.airModel(w.panel, w.tubes, { on: w.airOn, bvP: w.bvP, bvT: w.bvT }) : null;
  indexNodes();
  wireChrome();
  renderPanel();
}
/* 공압 보드가 있으면 도구 이름 · 설명을 배선+배관으로 */
/* 보드 말: 공압(관 · 포트 · 공기) / 유압(호스 · 커플러 · 기름) */
function FW() {
  const A = app.wire.panel && app.wire.panel.air, oil = !!(A && A.medium === 'oil');
  return { air: !!A, oil, board: oil ? '유압 보드' : '공압 보드', kind: oil ? '유압' : '공압', tube: oil ? '호스' : '관', port: oil ? '커플러' : '포트', fluid: oil ? '기름' : '공기' };
}
function wireChrome() {
  const f = FW(), air = f.air;
  document.body.classList.toggle('airboard', air);
  $('#wireTitle').textContent = air ? `트레이너 배선 · ${f.kind} 배관` : '트레이너 배선';
  $('#wDel').textContent = air ? `선·${f.tube} 지우기` : '선 지우기';
  $('#wLiveTxt').textContent = air ? `흐름 표시 (전기·${f.fluid})` : '전기 흐름 표시';
  $('#wGhostTxt').textContent = air ? '모범 배선·배관 겹쳐 보기' : '모범 배선 겹쳐 보기';
  $('#wireLegend').textContent = (air ? (f.oil ? '유압 보드: 커플러(육각)를 누른 뒤 이을 커플러를 누르면 호스(검은 선)가 생겨요 · 커플러 하나에 호스 하나 · 안 꽂은 커플러는 막혀요 · 파워 유닛 = 펌프 ON/OFF · P·T 볼밸브 · ' : '공압 보드: 흰 포트를 누른 뒤 이을 포트를 누르면 관(파란 선)이 생겨요 · 한 구멍에 관 하나 · 서비스 유닛의 파란 손잡이 = 공기 공급 ON/OFF · ') : '')
    + '단자를 누른 뒤 이을 단자를 누르면 선이 생겨요(끌어서 놓아도 돼요) · 선' + (air ? '·' + f.tube : '') + '을 누르면 선택돼요(지우기 · Delete) · 단자에 마우스를 올리면 전기적으로 이어진 단자가 함께 표시돼요 · 버튼(PBS)을 누르면 스위치가 눌려요';
}
let toastT = null;
function wireToast(msg, ms) {
  const t = $('#wToast'); if (!t) return;
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms || 3200);
}
function indexNodes() {
  const w = app.wire, pn = w.panel;
  w.nodeOf = {}; w.group = {};
  for (const id of pn.jackIds) { const n = w.W.r(id); w.nodeOf[id] = n; (w.group[n] = w.group[n] || []).push(id); }
}
function wireChanged(keepResults) {
  const w = app.wire;
  store.set(wireKey(), w.wires);
  if (w.panel.air) {
    const used = new Set(w.tubes.flatMap(t => [t.a, t.b]));
    w.tubesAside = (w.tubesAside || []).filter(t => !used.has(t.a) && !used.has(t.b));
    store.set(tubeKey(), w.tubes.concat(w.tubesAside));
  }
  w.W = WIRE.buildWireNet(w.panel, w.wires);
  w.AM = w.panel.air ? WIRE.airModel(w.panel, w.tubes, { on: w.airOn, bvP: w.bvP, bvT: w.bvT }) : null;
  indexNodes();
  pbUp(); for (const k in pbx) pbx[k].up();
  for (const k in panelHeld) delete panelHeld[k];
  app.sim = new E.Sim(app.PV, wireSimDef());
  if (!keepResults && (w.check || w.run || w.checkAir)) { w.stale = true; w.pass = false; drawAllMarks(); }
  w.auto = w.auto && w.auto.def === app.def ? w.auto : null;
  pbExtraUI(); buildLeds();
  app.logN = 0; clear($('#log')); app.lastProgKey = ''; app.waitStep = false;
  WP.fxKey = null;
  renderWires(); renderTubes(); drawOverlay(); renderWireResults(); wireBadge();
  frame(0, true);
}
function pushUndo() { const w = app.wire; w.undo.push(JSON.stringify({ w: w.wires, t: w.tubes })); if (w.undo.length > 80) w.undo.shift(); $('#wUndo').disabled = false; }
function updDel() { const w = app.wire; $('#wDel').disabled = w.selWire < 0 && w.selTube < 0; }
function addWire(a, b) {
  const w = app.wire; if (!a || !b || a === b) return;
  if (w.wires.some(x => (x.a === a && x.b === b) || (x.a === b && x.b === a))) { flashSimple([a, b]); return; }
  pushUndo(); w.wires.push({ a, b }); w.selWire = -1; w.selTube = -1; updDel(); wireChanged();
}
/* 관 꽂기: 한 구멍에 관 하나 (갈라 보내려면 분배기 출구를 씀) */
function addTube(a, b) {
  const w = app.wire, pn = w.panel; if (!a || !b || a === b || !pn.air) return;
  if (w.tubes.some(t => (t.a === a && t.b === b) || (t.a === b && t.b === a))) { flashPorts([a, b]); return; }
  const busy = [a, b].filter(id => w.tubes.some(t => t.a === id || t.b === id));
  if (busy.length) { const f = FW(); wireToast(f.oil ? `${WIRE.portName(pn, busy[0])}에는 이미 호스가 꽂혀 있어요. 커플러 하나에 호스 하나만 — 나눠 보내려면 분배기나 멀티 커넥터를 써요(호스를 누르고 지우기로 뺄 수 있어요).` : `${WIRE.portName(pn, busy[0])}에는 이미 관이 꽂혀 있어요. 한 구멍에 관 하나만 — 먼저 그 관을 빼거나(관을 누르고 지우기) 다른 구멍을 쓰세요.`); flashPorts(busy); return; }
  pushUndo(); w.tubes.push({ a, b }); w.selWire = -1; w.selTube = -1; updDel(); wireChanged();
}
function selectWire(i) {
  const w = app.wire; w.selWire = i; w.selTube = -1; w.sel = null; w.selP = null;
  updDel();
  renderWires(); renderTubes(); drawOverlay();
}
function selectTube(i) {
  const w = app.wire; w.selTube = i; w.selWire = -1; w.sel = null; w.selP = null;
  updDel();
  renderWires(); renderTubes(); drawOverlay();
}
function deleteSel() {
  const w = app.wire;
  if (w.selWire >= 0) { pushUndo(); w.wires.splice(w.selWire, 1); w.selWire = -1; }
  else if (w.selTube >= 0) { pushUndo(); w.tubes.splice(w.selTube, 1); w.selTube = -1; }
  else return;
  updDel(); wireChanged();
}
function wireBadge() {
  const b = $('#wireBadge'); if (!b) return;
  b.textContent = '선 ' + app.wire.wires.length + '개' + (app.wire.panel && app.wire.panel.air ? ` · ${FW().tube} ` + app.wire.tubes.length + '개' : '');
}
function toggleAir() {
  const w = app.wire; if (!w.panel.air) return;
  const oil = FW().oil;
  w.airOn = !w.airOn; if (w.AM) w.AM.on = w.airOn;
  app.sim.log('air', oil ? 'PU' : 'FRL', w.airOn, oil ? (w.airOn ? '펌프 ON (4 MPa)' : '펌프 OFF — 실린더 · 모터가 움직이지 않아요') : (w.airOn ? '공기 공급 ON (0.5 MPa)' : '공기 공급 OFF — 실린더가 움직이지 않아요'));
  app.sim.updateValves(true);
  app.lastProgKey = ''; WP.fxKey = null; WP.puKey = null;
  frame(0, true);
}
/* 파워 유닛 P · T 볼밸브 (손잡이가 라인과 나란하면 열림) */
function toggleBV(k) {
  const w = app.wire; if (!w.panel.air) return;
  const f = 'bv' + k; w[f] = !w[f]; if (w.AM) w.AM[f] = w[f];
  app.sim.log('air', 'PU', w[f], `${k} 볼밸브 ${w[f] ? '열림' : '닫힘'}` + (w[f] ? '' : k === 'P' ? ' — 압력이 안 나가요' : ' — 기름이 탱크로 못 돌아가서 실린더가 못 움직여요'));
  app.sim.updateValves(true);
  app.lastProgKey = ''; WP.puKey = null;
  frame(0, true);
}
function jackRole(id) {
  const pn = app.wire.panel, el = pn.elements.find(e => e.ja === id || e.jb === id || e.jo === id);
  if (!el) return '';
  const d = pn.dev[el.name];
  if (el.type === 'lamp') return ' · 램프';
  const nm = d && d.mapped ? el.name : '';
  const role = el.type === 'coil' ? '코일' : el.type === 'sol' ? '솔레노이드' : el.type === 'sen' ? '센서' : el.type === 'tmr' ? '타이머 코일' : el.type === 'cnt' ? '카운터 입력' : el.type === 'crst' ? '카운터 리셋' : '접점';
  return nm ? ` · ${nm} ${role}` : '';
}

/* ---------- 그리기 ---------- */
const JC = { r: '#c8372d', b: '#2a56c6', k: '#1c1e21' };
function drawJack(g, j) {
  const gg = S('g', { class: 'jk c-' + j.color, transform: `translate(${j.lx},${j.ly})` }, g);
  S('circle', { class: 'jring', r: 9.6 }, gg);
  S('circle', { class: 'jout', r: 7 }, gg);
  S('circle', { class: 'jin', r: 3.1 }, gg);
  if (j.label) {
    const off = { n: [0, -11, 'middle'], s: [0, 18, 'middle'], e: [10.5, 3.5, 'start'], w: [-10.5, 3.5, 'end'] }[j.lp] || [0, -11, 'middle'];
    T(gg, off[0], off[1], j.label, 'jlbl', off[2]);
  }
  WP.jack[j.id] = gg;
}
function tag(g, x, y, txt) {
  const w = Math.max(20, 7 * txt.length + 8);
  const gg = S('g', { class: 'wtag', transform: `translate(${x},${y})` }, g);
  S('rect', { x: -w / 2, y: -7, width: w, height: 14, rx: 7 }, gg);
  T(gg, 0, 4, txt, null, 'middle');
  return gg;
}
function bladePole(g, xc, ry) {
  // 위: NC(xc-12) · NO(xc+12), 아래: COM(xc)
  S('path', { class: 'wsym', d: `M${xc - 12},${ry + 7} L${xc - 8},${ry + 12} M${xc + 12},${ry + 7} L${xc + 8},${ry + 12} M${xc},${ry + 37} L${xc},${ry + 33}` }, g);
  const b = S('line', { class: 'wblade', x1: xc, y1: ry + 33, x2: xc - 8, y2: ry + 12 }, g);
  return { el: b, px: xc, py: ry + 33, ang: 41.8, last: null };
}
function setBlade(bl, on) { if (!bl || bl.last === on) return; bl.last = on; bl.el.setAttribute('transform', on ? `rotate(${bl.ang} ${bl.px} ${bl.py})` : ''); }
function busLine(g, m) {
  const x1 = 18, x2 = m.w - 18;
  S('line', { class: 'wbus p', x1, y1: 24, x2, y2: 24 }, g); S('line', { class: 'wbus n', x1, y1: m.h - 22, x2, y2: m.h - 22 }, g);
  T(g, 6, 28, '+', 'wbusl p'); T(g, m.w - 6, 28, '+', 'wbusl p', 'end'); T(g, 6, m.h - 18, '−', 'wbusl n'); T(g, m.w - 6, m.h - 18, '−', 'wbusl n', 'end');
}
/* ---------- 공압 보드 기기 (실습장 공압 실험 세트 모양) ---------- */
const PORT_LBL = { A: 'w', B: 'e', P: 'e', CAP: 'w', ROD: 'e', dout: 'e', din: 'n', src: 'n', SC: '' };
function drawFitting(g, p) {
  // 원터치 피팅: 흰 몸통 · 파란 릴리스 링 · 구멍
  const gg = S('g', { class: 'afit', transform: `translate(${p.lx},${p.ly})` }, g);
  S('circle', { class: 'afo', r: 7.4 }, gg); S('circle', { class: 'afc', r: 5.1 }, gg); S('circle', { class: 'afh', r: 2.5 }, gg);
  const lp = PORT_LBL[p.role];
  if (p.label && lp) {
    const off = { n: [0, -11, 'middle'], s: [0, 18, 'middle'], e: [10, 3.5, 'start'], w: [-10, 3.5, 'end'] }[lp];
    T(gg, off[0], off[1], p.label, 'aplbl', off[2]);
  }
}
/* ---------- 유압 보드 기기 (실습장 유압 실험 세트 모양) ---------- */
const OIL_KINDS = new Set(['motor', 'hdist', 'hmc', 'hpu', 'hck', 'hfc', 'hcb', 'hpoc', 'hbl', 'hrv', 'hmu', 'hprv', 'hthr']);
const OIL_LBL = { A: 'w', B: 'e', P: 'w', T: 'e', CAP: 'w', ROD: 'e', ML: 'w', MR: 'e', dout: 'n', din: 'w', mc: 'e', src: 'e', sink: 'w', C: 'w' };
const hexD = r => { let d = ''; for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; d += (i ? 'L' : 'M') + (r * Math.cos(a)).toFixed(1) + ',' + (r * Math.sin(a)).toFixed(1); } return d + 'Z'; };
function drawCoupler(g, p) {
  // 퀵 커플러: 육각 몸통 · 슬리브 · 안쪽 (안 꽂으면 막힘)
  const gg = S('g', { class: 'hfit', transform: `translate(${p.lx},${p.ly})` }, g);
  S('path', { class: 'hfo', d: hexD(8.4) }, gg); S('circle', { class: 'hfc', r: 5.2 }, gg); S('circle', { class: 'hfh', r: 2.3 }, gg);
  const lp = p.lp || OIL_LBL[p.role];
  if (p.label && lp) {
    const off = { n: [0, -11.5, 'middle'], s: [0, 19, 'middle'], e: [10.5, 3.5, 'start'], w: [-10.5, 3.5, 'end'] }[lp];
    T(gg, off[0], off[1], p.label, 'aplbl', off[2]);
  }
}
function symChk(g, x, y, up) {   // 체크밸브 기호 (자유 흐름: up = 위로)
  const k = up ? -1 : 1;
  S('path', { class: 'hsym', d: `M${x - 5},${y - 4 * k} L${x},${y + 3 * k} L${x + 5},${y - 4 * k}` }, g);
  S('circle', { class: 'hsym', cx: x, cy: y - 1.5 * k, r: 2.8 }, g);
}
function symThr(g, x, y) { S('path', { class: 'hsym', d: `M${x - 4},${y - 7} q4,7 0,14 M${x + 4},${y - 7} q-4,7 0,14 M${x - 8},${y + 7} L${x + 8},${y - 7}` }, g); }
function drawOilModule(g, m) {
  const P = WP.parts, w = m.w, h = m.h;
  const stems = () => { for (const p of m.ports) { const vert = p.face === 'n' || p.face === 's'; S('rect', { class: 'hstem', x: vert ? p.lx - 5 : (p.face === 'w' ? p.lx : p.lx - 8), y: vert ? (p.face === 'n' ? p.ly : p.ly - 8) : p.ly - 5, width: vert ? 10 : 8, height: vert ? 8 : 10 }, g); } };
  const name2 = (a, b) => { T(g, w / 2, 21, a, 'hcap3 b', 'middle'); if (b) T(g, w / 2, 30, b, 'hcap3 b', 'middle'); };
  if (m.kind === 'cyl') {
    T(g, 0, -6, m.title + ' (유압)', 'atitle');
    const mv = S('g', null, g);
    S('rect', { class: 'hrod', x: 24, y: 16.5, width: 154, height: 7, rx: 2 }, mv);
    S('rect', { class: 'adog', x: 174, y: 5, width: 36, height: 30, rx: 9 }, mv);
    for (const x of [183, 201]) S('line', { class: 'adogl', x1: x, y1: 7, x2: x, y2: 33 }, mv);
    S('rect', { class: 'hcylb', x: 18, y: 8, width: 108, height: 24, rx: 2 }, g);
    S('rect', { class: 'hcap', x: 0, y: 1, width: 24, height: 38, rx: 2 }, g); S('rect', { class: 'hcap', x: 120, y: 1, width: 24, height: 38, rx: 2 }, g);
    for (const y of [8, 32]) S('line', { class: 'htie', x1: 24, y1: y, x2: 120, y2: y }, g);
    stems();
    P[m.id] = { mv, stroke: m.stroke, last: null };
  } else if (m.kind === 'motor') {
    T(g, 0, 9, m.title + ' (유압 모터)', 'atitle');
    S('rect', { class: 'hplate', x: 14, y: 58, width: 156, height: 18, rx: 3 }, g);
    stems();
    S('rect', { class: 'hmotb', x: 34, y: 14, width: 104, height: 40, rx: 7 }, g);
    for (const x of [58, 82, 106]) S('line', { class: 'hrib', x1: x, y1: 16, x2: x, y2: 52 }, g);
    S('rect', { class: 'hflange', x: 138, y: 10, width: 12, height: 48, rx: 2 }, g);
    S('rect', { class: 'hshaft', x: 150, y: 29, width: 24, height: 10, rx: 2 }, g);
    const cx = 184, cy = 34, rot = S('g', null, g);
    S('circle', { class: 'hrotor', cx, cy, r: 13 }, rot); S('line', { class: 'hrotl', x1: cx, y1: cy, x2: cx, y2: cy - 12 }, rot); S('circle', { class: 'hrotd', cx, cy: cy - 9, r: 2.4 }, rot);
    const dir = T(g, 100, 70, '', 'hcap3 b', 'middle');
    P[m.id] = { rot, cx, cy, dir, last: null };
  } else if (m.kind === 'valve') {
    const two = m.vkind === '22', sup = !!m.sup, n = (m.boxes || []).length || 2;
    S('rect', { class: 'hplate', x: 0, y: 8, width: w, height: h - 16, rx: 3 }, g);
    stems();
    const by = sup ? 24 : 32, bh = sup ? 40 : 42;
    S('rect', { class: 'hvbody', x: 58, y: by, width: 88, height: bh, rx: 3 }, g);
    S('rect', { class: 'aspoolw', x: 70, y: by + bh - 14, width: 64, height: 8, rx: 2 }, g);
    const cw = 64 / n;
    for (let i = 1; i < n; i++) S('line', { class: 'hcell', x1: 70 + cw * i, y1: by + bh - 14, x2: 70 + cw * i, y2: by + bh - 6 }, g);
    const spool = S('rect', { class: 'aspool', x: 71, y: by + bh - 13, width: cw - 2, height: 6, rx: 1.5 }, g);
    T(g, 102, by + 15, two ? '2/2' : n === 3 ? '4/3' : '4/2', 'aplate3', 'middle');
    P[m.id] = { coils: [], spool, step: cw, lastBox: null, sup };
    for (const c of m.parts.coils) {
      S('rect', { class: 'wcoil', x: c.x0, y: by - 6, width: 48, height: bh + 12, rx: 4 }, g);
      T(g, c.x0 + 20, by + 10, c.name, 'wcoilt', 'middle');
      const led = S('circle', { class: 'wled', cx: c.x0 + 40, cy: by + 3, r: 3 }, g);
      P[m.id].coils.push({ name: c.name, led, last: null });
    }
    if (!m.dbl) S('path', { class: 'aspring', d: `M146,${by + bh / 2} l3,-7 l3,14 l3,-14 l3,14 l3,-7` }, g);
    T(g, w / 2, sup ? 86 : 98, m.title, 'hcap2', 'middle');
  } else if (m.kind === 'hdist') {
    S('rect', { class: 'hplate', x: 0, y: 0, width: w, height: h, rx: 4 }, g);
    stems();
    tag(g, 22, 13, m.id === 'DA' ? 'P' : 'T');
    const tt = T(g, 33, h - 8, m.title, 'hcap3 b');
    tt.setAttribute('transform', `rotate(-90 33 ${h - 8})`);
  } else if (m.kind === 'hmc') {
    S('rect', { class: 'hplate', x: 0, y: 6, width: w, height: h - 12, rx: 4 }, g);
    stems();
    T(g, w / 2, 21, '멀티 커넥터', 'hcap2 b', 'middle'); T(g, w / 2, 31, '6-WAY MULTI CONNECTOR', 'aplate2', 'middle');
  } else if (m.kind === 'hpu') {
    S('rect', { class: 'hpured', x: 0, y: 0, width: w, height: h - 6, rx: 6 }, g);
    stems();
    T(g, 12, 18, '파워 유닛 (유압)', 'hcap2 wh b');
    const pump = S('g', { class: 'hpumpbtn', 'data-btn': 'pump', transform: 'translate(164,17)' }, g);
    S('rect', { x: -28, y: -11, width: 56, height: 22, rx: 6 }, pump);
    const ptx = T(pump, 0, 3.5, '펌프 ON', 'hpbt', 'middle');
    S('title', null, pump).textContent = '펌프(전동기) — 누르면 ON/OFF';
    // 전동기 + 펌프 → 탱크에서 빨아 올려 P로
    S('path', { class: 'hpipe', d: 'M46,74 V92' }, g);
    S('rect', { class: 'hpump', x: 28, y: 42, width: 36, height: 32, rx: 3 }, g);
    T(g, 46, 61, '펌프', 'hcap3 wh b', 'middle');
    S('rect', { class: 'hmotb', x: 64, y: 36, width: 86, height: 44, rx: 6 }, g);
    for (const x of [116, 128, 140]) S('line', { class: 'hrib', x1: x, y1: 38, x2: x, y2: 78 }, g);
    T(g, 88, 64, 'M', 'hcap1 wh', 'middle');
    S('rect', { class: 'htank', x: 40, y: 90, width: 150, height: 68, rx: 4 }, g);
    const oil = S('rect', { class: 'hoil', x: 42, y: 118, width: 146, height: 38, rx: 3 }, g);
    S('rect', { class: 'hlvl', x: 170, y: 98, width: 8, height: 54, rx: 2 }, g);
    T(g, 50, 108, '탱크', 'hcap2 wh b');
    // 배관: P = 펌프 → 볼밸브 → P 커플러, T = T 커플러 → 볼밸브 → 탱크
    S('path', { class: 'hpipe', d: 'M28,58 H18 V176 H104 V232' }, g);
    S('path', { class: 'hpipe', d: 'M144,232 V158' }, g);
    const gx = 176, gy = 192;
    S('circle', { class: 'agauge', cx: gx, cy: gy, r: 16 }, g);
    for (let a = -120; a <= 120; a += 24) { const r = a * Math.PI / 180; S('line', { class: 'agt', x1: gx + 11.5 * Math.sin(r), y1: gy - 11.5 * Math.cos(r), x2: gx + 14.5 * Math.sin(r), y2: gy - 14.5 * Math.cos(r) }, g); }
    T(g, gx, gy + 9.5, 'MPa', 'hgu', 'middle');
    const needle = S('line', { class: 'aneedle', x1: gx, y1: gy + 2, x2: gx, y2: gy - 12 }, g);
    S('circle', { class: 'agc', cx: gx, cy: gy, r: 2 }, g);
    const ptxt = T(g, gx, 222, '0 MPa', 'hcap2 wh b', 'middle');
    const pwarn = T(g, 24, 200, '', 'hwarn');
    const bvs = {};
    for (const k of ['P', 'T']) {
      const pp = m.ports.find(q => q.key === k), x = pp.lx;
      const b = S('g', { class: 'hbv', 'data-btn': 'bv:' + k, transform: `translate(${x},206)` }, g);
      S('rect', { class: 'hbvh', x: -12, y: -12, width: 24, height: 24, rx: 4 }, b);
      S('rect', { class: 'hbvb', x: -6, y: -6, width: 12, height: 12, rx: 2 }, b);
      const lev = S('rect', { class: 'hbvl', x: -3, y: -15, width: 6, height: 20, rx: 2 }, b);
      S('title', null, b).textContent = `${k} 볼밸브 — 누르면 열림/닫힘 (손잡이가 라인과 나란하면 열림)`;
      bvs[k] = { g: b, lev };
    }
    P.PU = { needle, ptxt, pwarn, pump, ptx, bvs, gx, gy, oil, last: null };
  } else {
    // 작은 기기: 알루미늄 블록 + 기호
    S('rect', { class: 'hplate', x: 3, y: 4, width: w - 6, height: h - 8, rx: 3 }, g);
    stems();
    const c = (app.wire.panel.air.comps || []).find(x => x.mod === m.id);
    if (m.kind === 'hck') { name2('체크', m.pump ? '(펌프)' : null); symChk(g, w / 2, 42, !m.down); }
    else if (m.kind === 'hmu') { T(g, w / 2, 16, '보충', 'hcap3 b', 'middle'); symChk(g, w / 2 - 2, 30, true); }
    else if (m.kind === 'hfc') { name2('미터', '아웃'); symThr(g, w / 2, 43); }
    else if (m.kind === 'hcb') { name2('카운터', '밸런스'); S('rect', { class: 'hsym', x: w / 2 - 6, y: 36, width: 12, height: 13 }, g); }
    else if (m.kind === 'hpoc') { name2('파일럿', '체크'); symChk(g, w / 2, 43, true); S('path', { class: 'hsym dash', d: `M3,30 H${w / 2 - 5}` }, g); }
    else if (m.kind === 'hthr') { name2('미터인', '유량'); symThr(g, w / 2, 43); }
    else if (m.kind === 'hbl') { T(g, w / 2, 17, '블리드오프', 'hcap3 b', 'middle'); symThr(g, w / 2, 30); }
    else if (m.kind === 'hrv') { T(g, w / 2, 17, '릴리프', 'hcap3 b', 'middle'); S('path', { class: 'hsym', d: `M${w / 2 - 7},34 L${w / 2 + 7},24 M${w / 2 + 3},24 h4 v4` }, g); }
    else if (m.kind === 'hprv') {
      T(g, 8, 18, '감압밸브', 'hcap2 b'); if (c && c.label) T(g, 8, 29, c.label.replace('감압 ', ''), 'hcap3');
      const gx = 80, gy = 46;
      S('circle', { class: 'agauge', cx: gx, cy: gy, r: 15 }, g);
      const needle = S('line', { class: 'aneedle', x1: gx, y1: gy + 2, x2: gx, y2: gy - 11 }, g);
      const tx = T(g, gx, gy + 26, '0 MPa', 'hcap3 b', 'middle');
      P[m.id] = { needle, tx, gx, gy, mpa: c && /2±/.test(c.label || '') ? 2 : 3, last: null };
    }
    if (c) S('title', null, g).textContent = c.title + ' — ' + ({ hck: '1 → 2 쪽으로만 흘러요', hmu: '탱크(1) → 라인(2)으로 보충', hfc: '1(밸브 쪽) → 2(실린더 쪽) 자유 흐름, 나오는 기름만 교축(미터아웃)', hcb: '1 → 2 자유 흐름, 거꾸로는 설정 압력에서 열림', hpoc: '1 → 2 자유 흐름, X(파일럿)에 압력이 오면 거꾸로도 열림', hthr: '들어가는 기름을 조여 속도 조절(미터인)', hbl: '헤드 쪽 라인에서 일부를 탱크로 빼서 속도 조절', hrv: '서지압을 탱크로 빼요', hprv: 'P1(1차) → P2(2차) 압력을 낮춰요, T는 드레인' }[m.kind] || '');
  }
}
function drawAirModule(g0, m) {
  const P = WP.parts;
  const g = S('g', { class: 'amod k-' + m.kind + (m.oil || OIL_KINDS.has(m.kind) ? ' oil' : ''), transform: `translate(${m.x},${m.y})` }, g0);
  if (m.oil || OIL_KINDS.has(m.kind)) { drawOilModule(g, m); for (const p of m.ports || []) drawCoupler(g, p); for (const j of m.jacks) drawJack(g, j); return; }
  if (m.kind === 'cyl') {
    T(g, 0, -6, m.title, 'atitle');
    const mv = S('g', null, g);   // 로드 + 도그 (전진하면 오른쪽으로)
    S('rect', { class: 'arod', x: 24, y: 16.5, width: 154, height: 7, rx: 2 }, mv);
    S('rect', { class: 'adog', x: 174, y: 5, width: 36, height: 30, rx: 6 }, mv);
    for (const x of [183, 201]) S('line', { class: 'adogl', x1: x, y1: 7, x2: x, y2: 33 }, mv);
    S('rect', { class: 'acylb', x: 0, y: 4, width: 144, height: 32, rx: 3 }, g);
    for (const y of [9, 31]) S('line', { class: 'atie', x1: 20, y1: y, x2: 124, y2: y }, g);
    S('rect', { class: 'acap', x: 0, y: 2, width: 20, height: 36, rx: 3 }, g); S('rect', { class: 'acap', x: 124, y: 2, width: 20, height: 36, rx: 3 }, g);
    T(g, 72, 23, 'DOUBLE ACTING CYLINDER', 'aplate', 'middle');
    for (const x of [16, 128]) S('rect', { class: 'astem', x: x - 4, y: 37, width: 8, height: 4 }, g);
    P[m.id] = { mv, stroke: m.stroke, last: null };
  } else if (m.kind === 'ls') {
    S('rect', { class: 'aunit', x: 0, y: 8, width: 88, height: 62, rx: 4 }, g);
    S('rect', { class: 'ahead', x: 26, y: 1, width: 34, height: 11, rx: 2 }, g);
    const lev = S('g', null, g);   // 레버 + 롤러: 도그가 오면 눌림
    S('line', { class: 'alever', x1: 30, y1: 5, x2: 45, y2: -4 }, lev);
    S('circle', { class: 'aroll', cx: 45, cy: -4, r: 4.6 }, lev);
    tag(g, 18, 22, m.title);
    T(g, 36, 25.5, m.sub, 'acap2');
    T(g, 44, 37, 'LIMIT SWITCH', 'aplate2', 'middle');
    const led = S('circle', { class: 'wled', cx: 79, cy: 16, r: 3.2 }, g);
    P[m.id] = { bl: { el: lev, px: 30, py: 5, ang: 15, last: null }, led, last: null };
  } else if (m.kind === 'sen') {
    S('rect', { class: 'aunit', x: 0, y: 8, width: 88, height: 62, rx: 4 }, g);
    S('rect', { class: 'asenb', x: 37, y: -3, width: 14, height: 12, rx: 1 }, g);
    for (let y = -1; y < 9; y += 3) S('line', { class: 'asent', x1: 37, y1: y, x2: 51, y2: y }, g);
    S('rect', { class: 'asenf', x: 38, y: -7, width: 12, height: 5, rx: 2 }, g);
    tag(g, 16, 22, m.title);
    T(g, 32, 25.5, m.sub, 'acap2');
    T(g, 44, 37, 'PROXIMITY · PNP', 'aplate2', 'middle');
    const led = S('circle', { class: 'wled o', cx: 79, cy: 16, r: 3.4 }, g);
    P[m.id] = { led, last: null };
  } else if (m.kind === 'sc') {
    S('rect', { class: 'astem', x: 11, y: 0, width: 8, height: 5 }, g); S('rect', { class: 'astem', x: 11, y: 51, width: 8, height: 5 }, g);
    S('rect', { class: 'aunit', x: 3, y: 4, width: 24, height: 48, rx: 3 }, g);
    S('rect', { class: 'aknob', x: 24, y: 19, width: 9, height: 14, rx: 2 }, g);
    T(g, 15, 23, '속도', 'acap3 b', 'middle'); T(g, 15, 32, '제어', 'acap3 b', 'middle');
    S('path', { class: 'wsym', d: 'M9,38 q6,5 0,10 M21,38 q-6,5 0,10 M7,48 L23,38' }, g);
    S('title', null, g).textContent = '속도 제어 밸브 (한방향 유량 제어) — 관 중간에 넣어요';
  } else if (m.kind === 'valve') {
    const w = m.w;
    S('rect', { class: 'aunit', x: 0, y: 6, width: w, height: 106, rx: 4 }, g);
    for (const x of [80, 124]) S('rect', { class: 'astem', x: x - 4, y: 26, width: 8, height: 5 }, g);
    S('rect', { class: 'astem', x: 98, y: 74, width: 8, height: 8 }, g);
    S('rect', { class: 'avbody', x: 58, y: 30, width: 88, height: 44, rx: 3 }, g);
    S('rect', { class: 'aspoolw', x: 70, y: 60, width: 64, height: 8, rx: 2 }, g);
    const spool = S('rect', { class: 'aspool', x: 71, y: 61, width: 30, height: 6, rx: 1.5 }, g);
    T(g, 102, 52, '5/2', 'aplate3', 'middle');
    for (const [x, lb] of [[70, 'R1'], [134, 'R2']]) { S('rect', { class: 'asil', x: x - 5, y: 74, width: 10, height: 13, rx: 2 }, g); T(g, x, 97, lb, 'acap3', 'middle'); }
    P[m.id] = { coils: [], spool, step: 32, lastBox: null };
    for (const c of m.parts.coils) {
      S('rect', { class: 'wcoil', x: c.x0, y: 24, width: 48, height: 54, rx: 4 }, g);
      T(g, c.x0 + 20, 40, c.name, 'wcoilt', 'middle');
      const led = S('circle', { class: 'wled', cx: c.x0 + 40, cy: 33, r: 3 }, g);
      P[m.id].coils.push({ name: c.name, led, last: null });
    }
    if (!m.dbl) S('path', { class: 'aspring', d: 'M146,52 l3,-7 l3,14 l3,-14 l3,14 l3,-7' }, g);
    T(g, w / 2, 108, m.title, 'acap2', 'middle');
  } else if (m.kind === 'frl') {
    S('rect', { class: 'astem', x: 88, y: 70, width: 24, height: 8 }, g);
    S('rect', { class: 'aknob2', x: 44, y: 18, width: 36, height: 20, rx: 6 }, g);
    S('rect', { class: 'afrlb', x: 34, y: 38, width: 56, height: 40, rx: 5 }, g);
    S('path', { class: 'abowl', d: 'M42,78 h40 v36 q0,15 -20,19 q-20,-4 -20,-19 z' }, g);
    S('line', { class: 'adrain', x1: 62, y1: 133, x2: 62, y2: 140 }, g);
    const cx = 20, cy = 56;
    S('circle', { class: 'agauge', cx, cy, r: 17 }, g);
    for (let a = -120; a <= 120; a += 30) { const r = a * Math.PI / 180; S('line', { class: 'agt', x1: cx + 12 * Math.sin(r), y1: cy - 12 * Math.cos(r), x2: cx + 15 * Math.sin(r), y2: cy - 15 * Math.cos(r) }, g); }
    const needle = S('line', { class: 'aneedle', x1: cx, y1: cy + 2, x2: cx, y2: cy - 12 }, g);
    S('circle', { class: 'agc', cx, cy, r: 2 }, g);
    const ptxt = T(g, cx, cy + 30, '0.5 MPa', 'acap2 b', 'middle');
    const btn = S('g', { class: 'aairbtn', 'data-btn': 'air', transform: 'translate(100,106)' }, g);
    S('rect', { x: -11, y: -13, width: 22, height: 26, rx: 5 }, btn);
    const btxt = T(btn, 0, 3.5, 'ON', 'aairt', 'middle');
    T(g, 100, 128, '공급', 'acap3', 'middle');
    T(g, 58, 148, '서비스 유닛 (FRL)', 'atitle2', 'middle');
    S('title', null, btn).textContent = '공기 공급 밸브 — 누르면 ON/OFF';
    P.FRL = { needle, ptxt, btn, btxt, cx, cy, last: null };
  } else if (m.kind === 'dist') {
    S('rect', { class: 'astem', x: -2, y: 34, width: 12, height: 12, rx: 3 }, g);
    S('rect', { class: 'adist', x: 8, y: 8, width: 136, height: 62, rx: 5 }, g);
    for (const y of [24, 54]) { S('circle', { class: 'aplug', cx: 126, cy: y, r: 6.5 }, g); }
    T(g, 76, 79, '분배기 (AIR DISTRIBUTOR)', 'acap2', 'middle');
  }
  for (const p of m.ports || []) drawFitting(g, p);
  for (const j of m.jacks) drawJack(g, j);
}
function drawModule(g0, m) {
  if (m.air) { drawAirModule(g0, m); return; }
  const pn = app.wire.panel, P = WP.parts;
  const g = S('g', { class: 'wmod k-' + m.kind, transform: `translate(${m.x},${m.y})` }, g0);
  S('rect', { class: 'wplate', x: 0.5, y: 0.5, width: m.w - 1, height: m.h - 1, rx: 5 }, g);
  if (m.bus) busLine(g, m);
  if (m.kind === 'ps') {
    T(g, m.w / 2, 18, 'DC Power Supply', 'wtitle', 'middle');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) T(g, 25 + c * 25, 62 + r * 24, '+', 'wdeco', 'middle');
    S('rect', { class: 'wdark', x: 16, y: 166, width: 70, height: 24, rx: 3 }, g); T(g, 51, 182, 'DC 24V', 'wlcd', 'middle');
    S('rect', { class: 'wsw', x: 102, y: 166, width: 30, height: 24, rx: 3 }, g);
    S('rect', { class: 'wframe', x: 12, y: 214, width: m.w - 24, height: 92, rx: 4 }, g);
    T(g, m.w / 2, 230, 'DC OUTPUT', 'wsub', 'middle');
    T(g, 18, 256, '+', 'wbusl p'); T(g, 18, 290, '−', 'wbusl n');
    T(g, m.w / 2, 312, '+24V (빨강) · 0V (파랑)', 'wcap', 'middle');
  } else if (m.kind === 'sw') {
    T(g, m.w / 2, 14, m.title.replace('Signal Input Switch Unit', '스위치 유닛'), 'wtitle', 'middle');
    P[m.id] = { btns: [], blades: [], lamps: [] };
    m.parts.btns.forEach(b => {
      const ry = b.y - 22;
      const bg = S('g', { class: 'wpb c-' + b.color + (b.lock ? ' lock' : ''), 'data-btn': b.name, transform: `translate(${b.x},${b.y})` }, g);
      S('circle', { class: 'wpbrim', r: 16 }, bg); S('circle', { class: 'wpbcap', r: 12.5 }, bg);
      T(g, b.x, ry + 52, b.label, 'wsmall b', 'middle');
      if (b.lock) T(g, b.x, ry + 63, '(LOCK)', 'wcap', 'middle');
      if (b.tag) tag(g, b.x, ry - 7, b.tag);
      const lampEl = S('circle', { class: 'wlamp', cx: 68, cy: ry + 22, r: 5.2 }, g);
      P[m.id].lamps.push({ name: b.name, el: lampEl, last: null });
      S('path', { class: 'wsym', d: `M${68 - 3.6},${ry + 18.4} l7.2,7.2 M${68 + 3.6},${ry + 18.4} l-7.2,7.2` }, g);
      S('line', { class: 'wlink', x1: 84, y1: ry + 22, x2: 186, y2: ry + 22 }, g);
      const bl = [bladePole(g, 110, ry), bladePole(g, 162, ry)];
      P[m.id].btns.push({ name: b.name, el: bg, lock: b.lock, last: null });
      P[m.id].blades.push({ name: b.name, bl });
    });
  } else if (m.kind === 'ru') {
    T(g, m.w / 2, 14, m.title.replace('Relay Unit', '릴레이 유닛'), 'wtitle', 'middle');
    P[m.id] = { relays: [] };
    m.parts.relays.forEach(r => {
      const ry = r.ry;
      const led = S('circle', { class: 'wled', cx: 9, cy: ry + 22, r: 3.6 }, g);
      T(g, 24, ry + 25.5, 'RY' + r.j, 'wsmall b', 'middle');
      S('line', { class: 'wlink', x1: 44, y1: ry + 22, x2: 214, y2: ry + 22 }, g);
      const bl = r.poles.map(p => bladePole(g, p.xc, ry));
      if (r.tag) tag(g, 24, ry + 61, r.tag);
      P[m.id].relays.push({ name: r.name, led, bl, last: null });
    });
  } else if (m.kind === 'cnt') {
    T(g, m.w / 2, 14, '카운터 유닛', 'wtitle', 'middle'); if (pn.hasC) tag(g, m.w - 24, 44, 'C1');
    T(g, 46, 58, 'Current', 'wcap', 'middle'); T(g, 124, 58, 'Preset', 'wcap', 'middle');
    S('rect', { class: 'wdark', x: 14, y: 62, width: 64, height: 30, rx: 3 }, g); S('rect', { class: 'wdark', x: 92, y: 62, width: 64, height: 30, rx: 3 }, g);
    const cur = T(g, 46, 84, '', 'w7 r', 'middle'), pre = T(g, 124, 84, '', 'w7 r', 'middle');
    for (const [x, d, s] of [[110, '▲', 1], [140, '▼', -1]]) { const b = S('g', { class: 'wadj', 'data-btn': 'pre:C1:' + s, transform: `translate(${x},106)` }, g); S('circle', { r: 8.5 }, b); T(b, 0, 3.6, d, null, 'middle'); }
    S('rect', { class: 'wframe', x: 10, y: 120, width: m.w - 20, height: 92, rx: 4 }, g);
    T(g, 86, 136, 'Count Input (UP)', 'wsub', 'middle'); S('rect', { class: 'wsymbox', x: 70, y: 152, width: 32, height: 14 }, g);
    S('line', { class: 'wsym', x1: 33, y1: 160, x2: 70, y2: 160 }, g); S('line', { class: 'wsym', x1: 102, y1: 160, x2: 139, y2: 160 }, g);
    T(g, 86, 188, 'Reset', 'wsub', 'middle'); S('rect', { class: 'wsymbox', x: 70, y: 191, width: 32, height: 14 }, g);
    S('line', { class: 'wsym', x1: 33, y1: 198, x2: 70, y2: 198 }, g); S('line', { class: 'wsym', x1: 102, y1: 198, x2: 139, y2: 198 }, g);
    S('rect', { class: 'wframe', x: 10, y: 218, width: m.w - 20, height: 74, rx: 4 }, g);
    T(g, 86, 232, 'Control Output', 'wsub', 'middle');
    S('path', { class: 'wsym', d: 'M47,258 L60,258 M123,242 L114,246 M123,274 L114,270' }, g);
    const b = S('line', { class: 'wblade', x1: 60, y1: 258, x2: 114, y2: 270 }, g);
    P.CNT = { cur, pre, bl: { el: b, px: 60, py: 258, ang: -24.9, last: null } };
  } else if (m.kind === 'tmr') {
    T(g, m.w / 2, 14, '타이머 유닛', 'wtitle', 'middle');
    P.TMR = {};
    for (const [sec, y0, hdr, nm] of [['on', 80, 'ON Time Delay', 'T1'], ['off', 186, 'OFF Time Delay', 'TOFF']]) {
      S('line', { class: 'wrule', x1: 10, y1: y0 - 18, x2: m.w - 10, y2: y0 - 18 }, g);
      T(g, m.w / 2, y0 - 22, hdr, 'wsub', 'middle');
      if (nm === 'T1' && pn.hasT) tag(g, m.w - 24, y0 - 26, 'T1');
      S('rect', { class: 'wdark', x: 12, y: y0 - 8, width: 44, height: 30, rx: 3 }, g);
      const disp = T(g, 34, y0 + 14, '', 'w7 r', 'middle');
      for (const [x, d, s] of [[22, '▲', 1], [46, '▼', -1]]) { const b = S('g', { class: 'wadj', 'data-btn': `pre:${nm}:${s}`, transform: `translate(${x},${y0 + 36})` }, g); S('circle', { r: 8 }, b); T(b, 0, 3.4, d, null, 'middle'); }
      const led = S('circle', { class: 'wled', cx: 62, cy: y0 + 20, r: 3.4 }, g);
      S('line', { class: 'wlink', x1: 92, y1: y0 + 20, x2: 192, y2: y0 + 20 }, g);
      const bls = [];
      for (const [x, nc] of [[104, false], [130, false], [156, true], [182, true]]) {
        S('path', { class: 'wsym', d: `M${x},${y0 + 7} L${x},${y0 + 13} M${x},${y0 + 33} L${x},${y0 + 27}` }, g);
        const b = S('line', { class: 'wblade', x1: x, y1: y0 + 27, x2: x, y2: y0 + 13 }, g);
        bls.push({ el: b, px: x, py: y0 + 27, ang: -28, last: null, nc });
      }
      P.TMR[sec] = { disp, led, bls, nm };
    }
    T(g, m.w / 2, 272, '17-18 · 27-28 = a접점   35-36 · 45-46 = b접점', 'wcap', 'middle');
  } else if (m.kind === 'lmp') {
    T(g, m.w / 2, 14, '부저·램프 유닛', 'wtitle', 'middle');
    const grill = S('g', { class: 'wgrill' }, g);
    for (const [dx, dy] of [[0, 0], [-7, -5], [7, -5], [-7, 5], [7, 5], [0, -10], [0, 10]]) S('circle', { cx: 34 + dx, cy: 62 + dy, r: 2.3 }, grill);
    const wave = S('path', { class: 'wbzw', d: 'M50,52 q7,10 0,20 M56,47 q11,15 0,30' }, g);
    S('path', { class: 'wsym', d: 'M106,62 H120 M140,62 H152 M118,66 h24 M122,66 v-6 a8,8 0 0 1 16,0 v6' }, g);
    T(g, 130, 82, 'Buzzer', 'wcap', 'middle');
    P.LMP = { bz: { grill, wave, last: null }, lamps: [] };
    for (const [n, y, c] of [['L1', 110, 'r'], ['L2', 154, 'g'], ['L3', 198, 'y'], ['L4', 242, 'w']]) {
      const lens = S('circle', { class: 'wlens c-' + c, cx: 34, cy: y, r: 15 }, g);
      S('circle', { class: 'wlensr', cx: 34, cy: y, r: 17.5 }, g);
      S('line', { class: 'wlink', x1: 55, y1: y, x2: 88, y2: y }, g);
      S('circle', { class: 'wlamp', cx: 130, cy: y, r: 5.2 }, g);
      S('path', { class: 'wsym', d: `M106,${y} H124.8 M135.2,${y} H152 M${130 - 3.6},${y - 3.6} l7.2,7.2 M${130 + 3.6},${y - 3.6} l-7.2,7.2` }, g);
      T(g, 130, y + 19, n, 'wcap', 'middle');
      P.LMP.lamps.push({ name: n, lens, last: null });
    }
  } else if (m.kind === 'ls') {
    T(g, 10, 19, m.title, 'wtitle l');
    T(g, 46, 19, m.sub, 'wcap');
    S('path', { class: 'wsym', d: 'M26,55 L40,41 M92,55 L78,41 M59,55 L59,50' }, g);
    const b = S('line', { class: 'wblade', x1: 59, y1: 50, x2: 40, y2: 40 }, g);
    const led = S('circle', { class: 'wled', cx: 106, cy: 15, r: 4 }, g);
    P[m.id] = { bl: { el: b, px: 59, py: 50, ang: 124, last: null }, led, last: null };
  } else if (m.kind === 'sen') {
    T(g, 10, 19, m.title + ' 근접센서', 'wtitle l');
    T(g, 10, 31, 'PNP · ' + m.sub, 'wcap');
    const led = S('circle', { class: 'wled o', cx: 108, cy: 42, r: 5 }, g);
    T(g, 108, 60, '감지', 'wcap', 'middle');
    P[m.id] = { led, last: null };
  } else if (m.kind === 'valve') {
    T(g, 10, 19, m.title, 'wtitle l');
    T(g, 10, 31, m.sub, 'wcap');
    P[m.id] = { coils: [] };
    for (const c of m.parts.coils) {
      S('rect', { class: 'wcoil', x: c.x0, y: 38, width: 80, height: 46, rx: 4 }, g);
      T(g, c.x0 + 40, 52, c.name, 'wcoilt', 'middle');
      const led = S('circle', { class: 'wled', cx: c.x0 + 70, cy: 47, r: 3.4 }, g);
      P[m.id].coils.push({ name: c.name, led, last: null });
    }
  }
  for (const j of m.jacks) drawJack(g, j);
}
function renderPanel() {
  const svg = $('#wireSvg'), pn = app.wire.panel; clear(svg);
  svg.setAttribute('viewBox', `0 0 ${pn.W} ${pn.H}`);
  svg.style.width = '100%'; svg.style.minWidth = Math.min(pn.W, 900) + 'px'; svg.style.maxWidth = Math.round(pn.W * 1.12) + 'px'; svg.style.height = 'auto';
  WP.svg = svg; WP.jack = {}; WP.parts = {}; WP.hit = {}; WP.fxKey = null;
  const defs = S('defs', null, svg);
  const grad = (id, stops) => { const gr = S('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs); for (const [o, c] of stops) S('stop', { offset: o, 'stop-color': c }, gr); };
  grad('gSteel', [[0, '#f1f3f4'], [0.42, '#cdd2d6'], [0.58, '#b7bdc3'], [1, '#e6e9eb']]);
  grad('gRod', [[0, '#f7f8f9'], [0.5, '#a9b0b6'], [1, '#e8eaec']]);
  grad('gAlu', [[0, '#eceff1'], [0.5, '#c4c9ce'], [1, '#e1e4e7']]);
  S('rect', { class: 'wboard', x: 0, y: 0, width: pn.W, height: pn.H }, svg);
  if (pn.air) {
    const B = pn.air.board;
    S('rect', { class: 'aboard', x: B.x, y: B.y, width: B.w, height: B.h, rx: 6 }, svg);
    for (let y = B.y + 12; y < B.y + B.h - 8; y += 24) { S('rect', { class: 'aslot', x: B.x + 6, y, width: B.w - 12, height: 5, rx: 2.5 }, svg); S('rect', { class: 'aslot2', x: B.x + 6, y: y + 5, width: B.w - 12, height: 1.2 }, svg); }
    T(svg, 14, pn.fieldY + 2, pn.air.medium === 'oil' ? '유압 보드 — 호스(퀵 커플러)는 커플러끼리 · 전기는 리밋스위치 · 솔레노이드 코일 단자에 (도면 이름으로 표시)' : '공압 보드 — 관(공기)은 흰 포트끼리 · 전기는 리밋스위치 · 센서 · 솔레노이드 코일 단자에 (도면 이름으로 표시)', 'wsec');
  } else T(svg, 14, pn.fieldY + 2, '보드 기기 — 실린더 리밋스위치 · 근접센서 · 솔레노이드 밸브 (도면 이름으로 표시)', 'wsec');
  const gM = S('g', null, svg);
  WP.gT = S('g', { class: 'wtubes' }, svg); WP.gTE = S('g', { class: 'wtends' }, svg); WP.gGT = S('g', { class: 'wghost' }, svg);
  WP.gW = S('g', { class: 'wwires' }, svg); WP.gG = S('g', { class: 'wghost' }, svg); WP.gP = S('g', { class: 'wplugs' }, svg);
  const gH = S('g', { class: 'whits' }, svg); WP.gFX = S('g', { class: 'wfx' }, svg); WP.gO = S('g', { class: 'wover' }, svg);
  for (const m of pn.modules) drawModule(gM, m);
  for (const id of pn.jackIds) {
    const j = pn.jacks[id];
    const c = S('circle', { class: 'jhit', cx: j.x, cy: j.y, r: 11, 'data-jack': id }, gH);
    S('title', null, c).textContent = WIRE.jackName(pn, id) + jackRole(id);
    WP.hit[id] = c;
  }
  if (pn.air) for (const id of pn.air.portIds) {
    const p = pn.air.ports[id];
    const c = S('circle', { class: 'phit', cx: p.x, cy: p.y, r: 11, 'data-port': id }, gH);
    S('title', null, c).textContent = WIRE.portName(pn, id);
  }
  bindPanel(svg);
  renderWires(); renderTubes(); drawOverlay(); wireBadge();
}
/* 관 모양: 포트가 향한 쪽으로 나갔다가 휘어 들어감 */
const FN = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
function tubePath(a, b, pt) {
  const A = app.wire.panel.air.ports, pa = A[a], pb = pt || A[b];
  const d = Math.hypot(pb.x - pa.x, pb.y - pa.y), k = Math.max(16, Math.min(64, d * 0.42));
  const na = FN[pa.face], nb = pb.face ? FN[pb.face] : [0, 0];
  return `M${pa.x},${pa.y} C${(pa.x + na[0] * k).toFixed(1)},${(pa.y + na[1] * k).toFixed(1)} ${(pb.x + nb[0] * k).toFixed(1)},${(pb.y + nb[1] * k).toFixed(1)} ${pb.x},${pb.y}`;
}
function ensureAutoAir() { const w = app.wire; if (!w.autoAir) w.autoAir = WIRE.autoPipe(w.panel); return w.autoAir; }
function renderTubes() {
  const w = app.wire, pn = w.panel; if (!WP.gT) return;
  clear(WP.gT); clear(WP.gTE); clear(WP.gGT); WP.tubes = [];
  if (!pn.air) return;
  w.tubes.forEach((t, i) => {
    const d = tubePath(t.a, t.b);
    const oil = pn.air.medium === 'oil';
    const g = S('g', { class: 'at' + (oil ? ' oil' : '') + (i === w.selTube ? ' sel' : ''), 'data-tube': i }, WP.gT);
    S('path', { class: 'ath', d }, g); S('path', { class: 'ato', d }, g); S('path', { class: 'ati', d }, g); S('path', { class: 'atl', d }, g);
    WP.tubes.push({ g, i, last: null });
    for (const id of [t.a, t.b]) { const p = pn.air.ports[id]; S('circle', { class: 'atend' + (oil ? ' oil' : ''), cx: p.x, cy: p.y, r: oil ? 5.4 : 4.2 }, WP.gTE); }
  });
  if (w.ghost) for (const t of ensureAutoAir().tubes) S('path', { class: 'gt', d: tubePath(t.a, t.b) }, WP.gGT);
}
function flashPorts(ids) { app.wire.flash = { jacks: new Set(), wires: new Set(), ports: new Set(ids), tubes: new Set() }; drawOverlay(); clearTimeout(WP.ft); WP.ft = setTimeout(() => { app.wire.flash = null; drawOverlay(); }, 1600); }
/* 매 프레임: 실린더 로드 · 밸브 스풀 · 압력계 · 관 압력 색 · 새는 곳 */
function updateAir() {
  const w = app.wire, pn = w.panel, sim = app.sim, P = WP.parts, A = pn.air; if (!A) return;
  for (const c of A.cyls) { const p = P[c.mod]; if (!p) continue; const dx = Math.round(sim.acts[c.act].pos * p.stroke * 10) / 10; if (p.last !== dx) { p.last = dx; p.mv.setAttribute('transform', `translate(${dx},0)`); } }
  for (const v of A.valves) { const p = P[v.mod]; if (!p) continue; const b = sim.acts[v.act].box; if (p.lastBox !== b) { p.lastBox = b; p.spool.setAttribute('transform', `translate(${b * p.step},0)`); } }
  const oil = A.medium === 'oil';
  if (oil) {
    for (const sp of A.sups) { const p = P[sp.mod], st = sim.acts[sp.act]; if (!p) continue; const a = sim.P.acts.find(x => x.id === sp.act), b = st.supplyBox != null ? st.supplyBox : (a && a.supply ? a.supply.home : 1); if (p.lastBox !== b) { p.lastBox = b; p.spool.setAttribute('transform', `translate(${b * p.step},0)`); } }
    for (const mo of A.motors) { const p = P[mo.mod]; if (!p) continue; const st = sim.acts[mo.act], ang = Math.round((st.angle || 0) % 360); if (p.last !== ang) { p.last = ang; p.rot.setAttribute('transform', `rotate(${ang} ${p.cx} ${p.cy})`); } const dt = st.motion === 'cw' ? '정회전 ↻' : st.motion === 'ccw' ? '역회전 ↺' : ''; if (p.dir.textContent !== dt) p.dir.textContent = dt; }
    const s0 = sim.air, press = !!(s0 && s0.press), short = !!(s0 && s0.short);
    const key = [w.airOn, w.bvP, w.bvT, press, short].join();
    if (P.PU && WP.puKey !== key) {
      WP.puKey = key; const U = P.PU;
      U.needle.setAttribute('transform', `rotate(${press ? -24 : -120} ${U.gx} ${U.gy})`);
      U.ptxt.textContent = press ? '4.0 MPa' : '0 MPa';
      U.pwarn.textContent = !w.airOn ? '펌프 정지' : w.bvP === false ? 'P 볼밸브 닫힘' : short ? 'P–T 단락!' : w.bvT === false ? 'T 볼밸브 닫힘' : '';
      U.pump.classList.toggle('off', !w.airOn); U.ptx.textContent = w.airOn ? '펌프 ON' : '펌프 OFF';
      for (const k of ['P', 'T']) { const on = w['bv' + k] !== false; U.bvs[k].g.classList.toggle('off', !on); U.bvs[k].lev.setAttribute('transform', on ? '' : 'rotate(90)'); }
    }
    for (const c of A.comps) if (c.kind === 'hprv') { const p = P[c.mod]; if (!p || !s0) continue; const on = s0.portSt[c.ports.P2] === 'p'; if (p.last !== on) { p.last = on; p.needle.setAttribute('transform', `rotate(${on ? -120 + 240 * p.mpa / 10 : -120} ${p.gx} ${p.gy})`); p.tx.textContent = on ? p.mpa.toFixed(1) + ' MPa' : '0 MPa'; } }
  }
  if (P.FRL) { const on = w.airOn; if (P.FRL.last !== on) { P.FRL.last = on; P.FRL.needle.setAttribute('transform', `rotate(${on ? 0 : -120} ${P.FRL.cx} ${P.FRL.cy})`); P.FRL.btn.classList.toggle('off', !on); P.FRL.btxt.textContent = on ? 'ON' : 'OFF'; P.FRL.ptxt.textContent = on ? '0.5 MPa' : '0 MPa'; } }
  const s = sim.air; if (!s) return;
  const flowR = new Set();
  for (const c of A.cyls.concat(A.motors.map(m => ({ act: m.act, CAP: m.L, ROD: m.R })))) if (sim.acts[c.act].motion !== 'stop') { flowR.add(s.reg[A.portIdx[c.CAP]]); flowR.add(s.reg[A.portIdx[c.ROD]]); }
  const show = w.live;
  if (WP.tubes) for (const x of WP.tubes) {
    const t = w.tubes[x.i]; if (!t) continue;
    const st = show ? s.portSt[t.a] : '', fl = show && flowR.has(s.reg[A.portIdx[t.a]]);
    const cls = 'at' + (oil ? ' oil' : '') + (st ? ' ' + st : '') + (fl ? ' flow' : '') + (x.i === w.selTube ? ' sel' : '');
    if (x.last !== cls) { x.last = cls; x.g.setAttribute('class', cls); }
  }
  const fx = [];
  if (show) {
    for (const id of s.leaks) fx.push('L|' + id);
    for (const e of s.exh) { if (e.blow) fx.push('B|' + e.mod + '|' + e.side); else if (flowR.has(e.reg)) fx.push('E|' + e.mod + '|' + e.side); }
  }
  const key = fx.join(',');
  if (key !== WP.fxKey) { WP.fxKey = key; renderFx(fx); }
}
function renderFx(fx) {
  const g = WP.gFX; if (!g) return; clear(g);
  const pn = app.wire.panel, A = pn.air;
  for (const k of fx) {
    const [t, a, b] = k.split('|');
    let x, y, dx = 0, dy = 14;
    if (t === 'L') { const p = A.ports[a], n = FN[p.face]; x = p.x; y = p.y; dx = n[0] * 15; dy = n[1] * 15; }
    else { const m = pn.mods[a]; x = m.x + (b === 'A' ? 70 : 134); y = m.y + 90; }
    const gg = S('g', { class: 'apuff ' + (t === 'L' ? 'lk' : t === 'B' ? 'big' : 'ex'), transform: `translate(${x},${y})` }, g);
    gg.style.setProperty('--dx', dx + 'px'); gg.style.setProperty('--dy', dy + 'px');
    for (let i = 0; i < 3; i++) S('circle', { r: t === 'E' ? 3 : 4.4 }, gg);
    if (t !== 'E') T(gg, dx * 1.3 + (dx < 0 ? -5 : 5), dy * 1.3 + (dy < 0 ? -2 : 8), '쉭', 'apuft', dx < 0 ? 'end' : 'start');
  }
}
function wirePath(a, b) {
  const pn = app.wire.panel, A = pn.jacks[a], B = pn.jacks[b];
  const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
  const s = Math.min(46, 8 + d * 0.13);
  return `M${A.x},${A.y} C${A.x + dx * 0.25},${A.y + dy * 0.25 + s} ${B.x - dx * 0.25},${B.y - dy * 0.25 + s} ${B.x},${B.y}`;
}
const wireColor = w => { const pn = app.wire.panel; return pn.jacks[w.a].pol === 'n' || pn.jacks[w.b].pol === 'n' ? 'b' : 'r'; };
function renderWires() {
  const w = app.wire, pn = w.panel; if (!WP.gW) return;
  clear(WP.gW); clear(WP.gP); clear(WP.gG);
  WP.wires = [];
  w.wires.forEach((x, i) => {
    const d = wirePath(x.a, x.b), col = wireColor(x);
    const g = S('g', { class: 'wr c-' + col + (i === w.selWire ? ' sel' : ''), 'data-wire': i }, WP.gW);
    S('path', { class: 'whit', d }, g);
    S('path', { class: 'wsh', d }, g);
    const p = S('path', { class: 'wln', d }, g);
    WP.wires.push({ g, p, i, last: null });
    for (const id of [x.a, x.b]) { const J = pn.jacks[id]; S('circle', { class: 'plug c-' + col, cx: J.x, cy: J.y, r: 5.6 }, WP.gP); S('circle', { class: 'plugin', cx: J.x, cy: J.y, r: 2 }, WP.gP); }
  });
  if (w.ghost) {
    if (!w.auto) { w.auto = WIRE.autoWire(pn, app.def); w.auto.def = app.def; }
    for (const x of w.auto.wires) S('path', { class: 'gw c-' + wireColor(x), d: wirePath(x.a, x.b) }, WP.gG);
  }
}
function drawOverlay() {
  const w = app.wire, pn = w.panel, g = WP.gO; if (!g) return;
  clear(g);
  const ring = (id, cls) => { const J = pn.jacks[id]; if (J) S('circle', { class: 'oring ' + cls, cx: J.x, cy: J.y, r: 10.5 }, g); };
  if (w.hover && w.group) for (const id of w.group[w.nodeOf[w.hover]] || []) ring(id, id === w.hover ? 'hv0' : 'hv');
  if (w.xname) for (const e of pn.elements) if (e.name === w.xname && e.type !== 'lamp') for (const id of [e.ja, e.jb, e.jo]) if (id) ring(id, 'xr');
  if (w.sel) ring(w.sel, 'sel');
  const A = pn.air;
  const pring = (id, cls) => { const p = A && A.ports[id]; if (p) S('circle', { class: 'oring ' + cls, cx: p.x, cy: p.y, r: 10 }, g); };
  if (A && w.hoverP && w.AM) { const n = w.AM.node(w.hoverP); for (const id of A.portIds) if (w.AM.node(id) === n) pring(id, id === w.hoverP ? 'hv0' : 'hv'); }
  if (w.selP) pring(w.selP, 'sel');
  if (w.flash) {
    for (const x of w.flash.ghost || []) S('path', { class: 'ogw', d: wirePath(x.a, x.b) }, g);
    if (A) for (const x of w.flash.ghostT || []) S('path', { class: 'ogt', d: tubePath(x.a, x.b) }, g);
    for (const id of w.flash.jacks) ring(id, 'fl');
    for (const id of w.flash.ports || []) pring(id, 'fl');
    for (const i of w.flash.wires) { const x = w.wires[i]; if (x) S('path', { class: 'oflw', d: wirePath(x.a, x.b) }, g); }
    if (A) for (const i of w.flash.tubes || []) { const x = w.tubes[i]; if (x) S('path', { class: 'oflt', d: tubePath(x.a, x.b) }, g); }
  }
  if (WP.rubber) S('path', { class: WP.rubberT ? 'orubt' : 'orub', d: WP.rubber }, g);
}
function flashSimple(jacks) { app.wire.flash = { jacks: new Set(jacks), wires: new Set() }; drawOverlay(); clearTimeout(WP.ft); WP.ft = setTimeout(() => { app.wire.flash = null; drawOverlay(); }, 1600); }
function flashItem(it) {
  const w = app.wire;
  w.flash = { jacks: new Set(it.jacks || []), wires: new Set(it.wires || []), ghost: it.ghost || null, ports: new Set(it.ports || []), tubes: new Set(it.tubes || []), ghostT: it.ghostT || null };
  drawOverlay();
  const pn = w.panel, J = pn.jacks[(it.jacks || [])[0]] || (pn.air && pn.air.ports[(it.ports || [])[0]]);
  const body = $('#wireBody');
  if (J && body && it.scroll !== false) {
    const sv = WP.svg.getBoundingClientRect(), sc = sv.width / pn.W;
    const x = J.x * sc, y = J.y * sc;
    if (x < body.scrollLeft || x > body.scrollLeft + body.clientWidth) body.scrollLeft = Math.max(0, x - body.clientWidth / 2);
    const top = sv.top + y;
    if (top < 60 || top > window.innerHeight - 40) window.scrollBy({ top: top - window.innerHeight / 2, behavior: 'smooth' });
  }
  if (it.load) {
    const [type, name] = it.load.split(':');
    const ids = app.L.items.filter(x => x.e.name === name && x.e.type === type).map(x => x.e.id);
    app.flashIds = ids; drawAllMarks();
  }
  clearTimeout(WP.ft); WP.ft = setTimeout(() => { w.flash = null; drawOverlay(); app.flashIds = null; app.guideIds = null; drawAllMarks(); }, it.ghost ? 6500 : 4200);
}
function ensureAuto() { const w = app.wire; if (!w.auto) { w.auto = WIRE.autoWire(w.panel, app.def); w.auto.def = app.def; } return w.auto; }
/* 참고 도면: 접점 옆에 모범 배선 단자 번호 */
function annotateLadder() {
  const a = ensureAuto();
  for (const it of app.L.items) {
    if (!E.isContact(it.e.type)) continue;
    const x = a.assign[it.e.id]; if (!x) continue;
    T(it.g, it.e.type === 'pb' ? -23 : -14, 17, x.tag, 'tno', 'end');
  }
  $('#ladderSvg').classList.toggle('tnoff', !app.wire.tno);
}
function refTitle(e) {
  if (E.isContact(e.type)) return `${e.name} ${e.type === 'no' || e.type === 'pb' || e.type === 'lsno' ? 'a' : 'b'}접점`;
  return { coil: e.name + ' 코일', sol: e.name + ' 솔레노이드', sen: e.name + ' 근접센서', tmr: '타이머 ' + e.name + ' 코일', cnt: '카운터 입력(Count)', crst: '카운터 리셋(Reset)' }[e.type] || e.name;
}
function wireRefClick(it, ev) {
  const w = app.wire, a = ensureAuto(), x = a.assign[it.e.id], pn = w.panel;
  const jn = id => WIRE.jackName(pn, id);
  const pop = placePop(it, true);
  pop.appendChild(h('h3', null, refTitle(it.e)));
  let ws = [];
  if (!x) pop.appendChild(h('p', 'popnote', '이 기호는 꽂을 단자가 없어요.'));
  else {
    pop.appendChild(h('p', 'popnote', '꽂을 단자: ' + x.jacks.map(jn).join(' · ') + (x.shared ? ' (다른 줄과 같은 접점을 같이 써요)' : '')));
    ws = a.wires.filter(q => x.jacks.includes(q.a) || x.jacks.includes(q.b));
    if (ws.length) { const ul = h('ul', 'popw'); ws.slice(0, 8).forEach(q => ul.appendChild(h('li', null, jn(q.a) + ' ↔ ' + jn(q.b)))); pop.appendChild(ul); }
    if (it.e.type === 'no' || it.e.type === 'nc') pop.appendChild(h('p', 'popnote dim', '릴레이 극(1~4번)은 다른 극을 써도 돼요. 끝자리 4(a접점) · 2(b접점)만 맞으면 같은 회로예요.'));
    flashItem({ jacks: x.jacks, ghost: ws, scroll: false });
  }
  const r = h('div', 'row');
  const go = h('button', 'btn sm', '배선판에서 보기'); go.onclick = () => { pop.hidden = true; if (x) flashItem({ jacks: x.jacks, ghost: ws }); };
  const close = h('button', 'btn sm', '닫기'); close.onclick = () => { pop.hidden = true; };
  r.appendChild(go); r.appendChild(close); pop.appendChild(r);
  ev.stopPropagation();
}
function showGuide(grp) {
  const a = ensureAuto();
  const ids = app.L.items.filter(it => grp.cols.includes(it.e.col)).map(it => it.e.id);
  app.guideIds = ids; drawAllMarks();
  const ws = grp.wires.map(i => a.wires[i]);
  flashItem({ jacks: [...new Set(ws.flatMap(q => [q.a, q.b]))], ghost: ws, scroll: false });
}
/* 창으로 띄우기 (배선 연습 화면에서만 · 넓은 화면) */
const FLOAT_IDS = ['sheetLadder', 'sheetFluid'];
const floatLabel = (id, on) => on ? (id === 'sheetLadder' ? '도면 제자리로' : '동작 화면 제자리로') : (id === 'sheetLadder' ? '참고 도면 띄우기' : '동작 화면 띄우기');
function setFloat(id, on, keepPref) {
  const el = document.getElementById(id);
  el.classList.toggle('floating', on);
  if (on) {
    const st = store.get('float.' + id, null), vw = window.innerWidth, vh = window.innerHeight;
    const side = (document.getElementById('side').getBoundingClientRect().width || 372) + 34;
    const avail = Math.max(600, vw - side);
    const w0 = Math.min(vw - 24, (st && st.w) || (id === 'sheetLadder' ? Math.round(avail * 0.56) : Math.round(avail * 0.42)));
    const h0 = Math.min(vh - 24, (st && st.h) || (id === 'sheetLadder' ? 380 : 340));
    const x0 = Math.max(6, Math.min(vw - w0 - 6, st && st.x != null ? st.x : (id === 'sheetLadder' ? 12 : Math.round(avail * 0.58) + 4)));
    const y0 = Math.max(6, Math.min(vh - 80, st && st.y != null ? st.y : vh - h0 - 14));
    Object.assign(el.style, { left: x0 + 'px', top: y0 + 'px', width: w0 + 'px', height: h0 + 'px' });
  } else Object.assign(el.style, { left: '', top: '', width: '', height: '' });
  if (!keepPref) store.set('floatOn.' + id, on);
  document.querySelectorAll(`[data-float="${id}"]`).forEach(b => { b.textContent = floatLabel(id, on); b.classList.toggle('on', on); });
}
function applyFloats(wv) {
  const wide = window.innerWidth > 1000;
  for (const id of FLOAT_IDS) setFloat(id, wv && wide && !!store.get('floatOn.' + id, false), true);
}
function bindFloats() {
  document.querySelectorAll('[data-float]').forEach(b => b.onclick = () => { const id = b.dataset.float; setFloat(id, !document.getElementById(id).classList.contains('floating')); });
  for (const id of FLOAT_IDS) {
    const el = document.getElementById(id), head = el.querySelector('.sheethead');
    let d = null;
    el.addEventListener('pointerdown', () => { if (el.classList.contains('floating')) { FLOAT_IDS.forEach(o => document.getElementById(o).style.zIndex = o === id ? '62' : ''); } }, true);
    head.addEventListener('pointerdown', ev => {
      if (!el.classList.contains('floating') || ev.target.closest('button,input,label,select')) return;
      const r = el.getBoundingClientRect(); d = { dx: ev.clientX - r.left, dy: ev.clientY - r.top, id: ev.pointerId };
      try { head.setPointerCapture(ev.pointerId); } catch (e) { } ev.preventDefault();
    });
    head.addEventListener('pointermove', ev => {
      if (!d || d.id !== ev.pointerId) return;
      const vw = window.innerWidth, vh = window.innerHeight;
      el.style.left = Math.max(0, Math.min(vw - 80, ev.clientX - d.dx)) + 'px'; el.style.top = Math.max(0, Math.min(vh - 40, ev.clientY - d.dy)) + 'px';
    });
    const end = ev => { if (!d || d.id !== ev.pointerId) return; d = null; saveFloat(id); };
    head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end);
    if (window.ResizeObserver) new ResizeObserver(() => { if (el.classList.contains('floating')) saveFloat(id); }).observe(el);
  }
  window.addEventListener('resize', () => { if (window.innerWidth <= 1000) for (const id of FLOAT_IDS) if (document.getElementById(id).classList.contains('floating')) setFloat(id, false, true); });
}
function saveFloat(id) {
  const el = document.getElementById(id), r = el.getBoundingClientRect();
  store.set('float.' + id, { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
}

/* ---------- 조작 ---------- */
const panelHeld = {};
function pressPanel(name, v) {
  const sim = app.sim; if (!(name in sim.pb)) return;
  if (name === 'PB1') { if (v) pbDown(); else pbUp(); return; }
  sim.press(name, v);
  if (v && app.waitStep) app.waitStep = false;
}
function adjPreset(key, dir) {
  const w = app.wire, pn = w.panel, isT = key !== 'C1';
  let v = (pn.presets[key] || 0) + dir * (isT ? 0.1 : 1);
  v = isT ? Math.round(Math.max(0, Math.min(9.9, v)) * 10) / 10 : Math.max(1, Math.min(99, Math.round(v)));
  if (v === pn.presets[key]) return;
  pn.presets[key] = v;
  store.set(preKey(), pn.presets);
  for (const e of w.W.net.els) if (e.src && e.src.preKey === key) e.o.pre = v;   // 초기상태로 · 검사에서도 새 값
  const sim = app.sim;
  if (isT && sim.timers[key]) sim.timers[key].pre = v;
  if (!isT && sim.counters.C1) { const c = sim.counters.C1; c.pre = v; c.done = c.count > 0 && c.count >= v; }
  app.pbxKey = ''; if (!isT) pbExtraUI();
  wirePreNote();
  if (w.check || w.run) { w.stale = true; renderWireResults(); }
}
function wirePreNote() {
  const el = $('#wPreNote'), pn = app.wire.panel; if (!el || !pn) return;
  const parts = [];
  if (pn.refPre.T1 != null) parts.push(`타이머 ON Time Delay ${(pn.presets.T1 || 0).toFixed(1)}초 (문제: ${pn.refPre.T1.toFixed(1)}초)`);
  if (pn.refPre.C1 != null) parts.push(`카운터 Preset ${pn.presets.C1} (문제: ${pn.refPre.C1}회)`);
  el.hidden = !parts.length;
  const ok = (pn.refPre.T1 == null || Math.abs(pn.presets.T1 - pn.refPre.T1) < 1e-6) && (pn.refPre.C1 == null || pn.presets.C1 === pn.refPre.C1);
  el.className = 'note wpre ' + (ok ? 'ok' : 'bad');
  el.textContent = (ok ? '✓ 설정값 맞음 — ' : '설정값을 ▲▼로 맞추세요 — ') + parts.join(' · ');
}
function bindPanel(svg) {
  const w = app.wire;
  let drag = null;
  const pt = ev => { const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
  const jackAt = ev => { const el = document.elementFromPoint(ev.clientX, ev.clientY); const j = el && el.closest ? el.closest('[data-jack]') : null; return j ? j.getAttribute('data-jack') : null; };
  const portAt = ev => { const el = document.elementFromPoint(ev.clientX, ev.clientY); const j = el && el.closest ? el.closest('[data-port]') : null; return j ? j.getAttribute('data-port') : null; };
  svg.onpointerdown = ev => {
    const t = ev.target;
    const jid = t.getAttribute && t.getAttribute('data-jack');
    if (jid) { ev.preventDefault(); drag = { from: jid, x: ev.clientX, y: ev.clientY, moved: false, id: ev.pointerId }; try { svg.setPointerCapture(ev.pointerId); } catch (e) { } return; }
    const pid = t.getAttribute && t.getAttribute('data-port');
    if (pid) { ev.preventDefault(); drag = { port: true, from: pid, x: ev.clientX, y: ev.clientY, moved: false, id: ev.pointerId }; try { svg.setPointerCapture(ev.pointerId); } catch (e) { } return; }
    const wg = t.closest && t.closest('[data-wire]');
    if (wg) { const wi = +wg.getAttribute('data-wire'); selectWire(w.selWire === wi ? -1 : wi); return; }
    const tg = t.closest && t.closest('[data-tube]');
    if (tg) { const ti = +tg.getAttribute('data-tube'); selectTube(w.selTube === ti ? -1 : ti); return; }
    const btn = t.closest && t.closest('[data-btn]');
    if (btn) {
      ev.preventDefault();
      const k = btn.getAttribute('data-btn');
      if (k === 'air' || k === 'pump') { toggleAir(); return; }
      if (k.startsWith('bv:')) { toggleBV(k.slice(3)); return; }
      if (k.startsWith('pre:')) {
        const [, key, d] = k.split(':');
        adjPreset(key, +d);
        clearTimeout(WP.repT); clearInterval(WP.rep); WP.repId = ev.pointerId;
        WP.repT = setTimeout(() => { WP.rep = setInterval(() => adjPreset(key, +d), 70); }, 420);
        try { svg.setPointerCapture(ev.pointerId); } catch (e) { }
        return;
      }
      const dev = w.panel.dev[k];
      if (dev && dev.lock) { pressPanel(k, !app.sim.pb[k]); return; }
      panelHeld[k] = ev.pointerId; pressPanel(k, true);
      try { svg.setPointerCapture(ev.pointerId); } catch (e) { }
      return;
    }
    if (w.sel || w.selP) { w.sel = null; w.selP = null; drawOverlay(); }
    if (w.selWire >= 0) selectWire(-1);
    if (w.selTube >= 0) selectTube(-1);
  };
  svg.onpointermove = ev => {
    if (drag && drag.id === ev.pointerId) {
      if (!drag.moved && Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) > 6) drag.moved = true;
      if (drag.moved) {
        const p = pt(ev);
        if (drag.port) { WP.rubber = tubePath(drag.from, null, { x: p.x, y: p.y }); WP.rubberT = true; }
        else { const J = w.panel.jacks[drag.from]; WP.rubber = `M${J.x},${J.y} Q${(J.x + p.x) / 2},${Math.max(J.y, p.y) + 30} ${p.x},${p.y}`; WP.rubberT = false; }
        drawOverlay();
      }
      return;
    }
    const jid = ev.target.getAttribute && ev.target.getAttribute('data-jack');
    const pid = ev.target.getAttribute && ev.target.getAttribute('data-port');
    if ((jid || null) !== w.hover || (pid || null) !== w.hoverP) { w.hover = jid || null; w.hoverP = pid || null; drawOverlay(); }
  };
  const up = ev => {
    if (WP.repId === ev.pointerId) { clearTimeout(WP.repT); clearInterval(WP.rep); WP.repId = null; }
    for (const k in panelHeld) if (panelHeld[k] === ev.pointerId) { delete panelHeld[k]; pressPanel(k, false); }
    if (!drag || drag.id !== ev.pointerId) return;
    const isPort = !!drag.port, from = drag.from, moved = drag.moved;
    const toJ = jackAt(ev), toP = portAt(ev);
    drag = null; WP.rubber = null;
    if (isPort) {
      if (moved) {
        if (toP && toP !== from) addTube(from, toP);
        else { if (toJ) wireToast(FW().oil ? '호스는 커플러끼리만 이어요. 전기 단자에는 선을 꽂아요.' : '관은 공기 포트(흰 구멍)끼리만 이어요. 전기 단자에는 선을 꽂아요.'); drawOverlay(); }
        return;
      }
      if (w.sel) { w.sel = null; wireToast(`전기 단자와 ${FW().oil ? '유압 커플러' : '공기 포트'}는 이을 수 없어요. 단자는 단자끼리, ${FW().port}는 ${FW().port}끼리.`); drawOverlay(); return; }
      if (w.selP && w.selP !== from) { const a = w.selP; w.selP = null; addTube(a, from); }
      else { w.selP = w.selP === from ? null : from; drawOverlay(); }
      return;
    }
    if (moved) {
      if (toJ && toJ !== from) addWire(from, toJ);
      else { if (toP) wireToast(FW().oil ? '전기 선은 단자끼리만 이어요. 유압 커플러에는 호스를 꽂아요.' : '전기 선은 단자끼리만 이어요. 공기 포트에는 관을 꽂아요.'); drawOverlay(); }
      return;
    }
    if (w.selP) { w.selP = null; wireToast(`${FW().oil ? '유압 커플러' : '공기 포트'}와 전기 단자는 이을 수 없어요. 단자는 단자끼리, ${FW().port}는 ${FW().port}끼리.`); drawOverlay(); return; }
    if (w.sel && w.sel !== from) { const a = w.sel; w.sel = null; addWire(a, from); }
    else { w.sel = w.sel === from ? null : from; drawOverlay(); }
  };
  svg.onpointerup = up; svg.onpointercancel = up;
  svg.onpointerleave = () => { if (w.hover || w.hoverP) { w.hover = null; w.hoverP = null; drawOverlay(); } };
  svg.ondblclick = ev => {
    const wg = ev.target.closest && ev.target.closest('[data-wire]');
    if (wg) { w.selWire = +wg.getAttribute('data-wire'); w.selTube = -1; deleteSel(); return; }
    const tg = ev.target.closest && ev.target.closest('[data-tube]');
    if (tg) { w.selTube = +tg.getAttribute('data-tube'); w.selWire = -1; deleteSel(); }
  };
}

/* ---------- 매 프레임 표시 ---------- */
function updatePanel() {
  const w = app.wire, sim = app.sim, pn = w.panel, P = WP.parts; if (!pn || !WP.svg) return;
  const live = sim.live, gnd = sim.gnd;
  for (const m of pn.rack) {
    const p = P[m.id]; if (!p) continue;
    if (m.kind === 'ru') for (const r of p.relays) {
      const on = !!(sim.relays[r.name] && sim.relays[r.name].on);
      if (r.last !== on) { r.last = on; if (r.led) r.led.classList.toggle('on', on); r.bl.forEach(b => setBlade(b, on)); }
    }
    if (m.kind === 'sw') {
      p.btns.forEach((b, i) => { const on = !!sim.pb[b.name]; if (b.last !== on) { b.last = on; b.el.classList.toggle('down', on); p.blades[i].bl.forEach(x => setBlade(x, on)); } });
    }
  }
  if (P.CNT) {
    const c = sim.counters.C1, pw = w.W.powered.CNT;
    const t1 = pw ? String(c ? c.count : 0).padStart(2, '0') : '', t2 = pw ? String(pn.presets.C1).padStart(2, '0') : '';
    if (P.CNT.cur.textContent !== t1) P.CNT.cur.textContent = t1;
    if (P.CNT.pre.textContent !== t2) P.CNT.pre.textContent = t2;
    setBlade(P.CNT.bl, !!(c && c.done));
  }
  if (P.TMR) for (const sec of ['on', 'off']) {
    const q = P.TMR[sec], t = sim.timers[q.nm], pw = w.W.powered.TMR;
    const txt = !pw ? '' : t && t.run ? Math.min(t.acc, t.pre).toFixed(1) : (pn.presets[q.nm] || 0).toFixed(1);
    if (q.disp.textContent !== txt) q.disp.textContent = txt;
    const done = !!(t && t.done), act = !!(t && (t.want || t.run));
    q.led.classList.toggle('on', act);
    q.bls.forEach(b => setBlade(b, b.nc ? done : !done));
  }
  for (const n of pn.lsNames) { const p = P[n]; if (!p) continue; const on = !!sim.sensors[n]; if (p.last !== on) { p.last = on; p.led.classList.toggle('on', on); setBlade(p.bl, on); } }
  const lampOn = {};
  for (const e of sim.net.els) {
    if (e.type === 'sen') { const p = P[e.name]; if (!p) continue; const on = !!sim.sensors[e.name] && !!live[e.a] && (!gnd || !!gnd[e.b]); if (p.last !== on) { p.last = on; p.led.classList.toggle('on', on); } }
    else if (e.type === 'lamp') lampOn[e.name] = !!live[e.a] && (!gnd || !!gnd[e.b]);
  }
  for (const m of pn.rack) if (m.kind === 'sw') for (const L of P[m.id].lamps) { const on = !!lampOn[L.name]; if (L.last !== on) { L.last = on; L.el.classList.toggle('on', on); } }
  if (P.LMP) {
    for (const L of P.LMP.lamps) { const on = !!lampOn[L.name]; if (L.last !== on) { L.last = on; L.lens.classList.toggle('on', on); } }
    const bz = !!lampOn.BZ; if (P.LMP.bz.last !== bz) { P.LMP.bz.last = bz; P.LMP.bz.wave.classList.toggle('on', bz); P.LMP.bz.grill.classList.toggle('on', bz); }
  }
  for (const m of pn.field) if (m.kind === 'valve' && P[m.id]) for (const c of P[m.id].coils) { const on = !!sim.sols[c.name]; if (c.last !== on) { c.last = on; c.led.classList.toggle('on', on); } }
  if (pn.air) updateAir();
  // 통전 표시: +24V가 걸린 단자·선
  const showLive = w.live;
  for (const id of pn.jackIds) {
    const g = WP.jack[id]; if (!g) continue;
    const on = showLive && !!live[w.nodeOf[id]];
    if (g._on !== on) { g._on = on; g.classList.toggle('on', on); }
  }
  if (WP.wires) for (const x of WP.wires) {
    const ww = w.wires[x.i]; if (!ww) continue;
    const on = showLive && !!live[w.nodeOf[ww.a]];
    if (x.last !== on) { x.last = on; x.g.classList.toggle('on', on); }
  }
}
/* 기준 도면: 배선 연습에서는 실제 기기 상태(이름 기준)로만 표시 */
function updateLadderNames(L, sim) {
  for (const it of L.items) {
    const e = it.e;
    let key;
    if (E.isContact(e.type)) {
      const closed = sim.closed(e);
      key = closed ? 1 : 0;
      if (key !== it.last) { const nc = it.parts.nc; it.parts.blade.style.transform = `rotate(${nc ? (closed ? 22 : -12) : (closed ? 0 : -24)}deg)`; it.g.classList.toggle('on', false); }
    } else if (e.type === 'coil') { const on = !!(sim.relays[e.name] && sim.relays[e.name].on); key = on ? 1 : 0; if (key !== it.last) it.g.classList.toggle('on', on); }
    else if (e.type === 'sol') { const on = !!sim.sols[e.name]; key = on ? 1 : 0; if (key !== it.last) it.g.classList.toggle('on', on); }
    else if (e.type === 'tmr') {
      const t = sim.timers[e.name], on = !!(t && t.want), f = t ? (t.pre > 0 ? Math.min(1, t.acc / t.pre) : (t.done ? 1 : 0)) : 0;
      key = (on ? 1 : 0) + (t && t.done ? 2 : 0) + Math.round(f * 60) * 4;
      if (key !== it.last) { it.g.classList.toggle('on', on); it.g.classList.toggle('done', !!(t && t.done)); it.parts.bar.setAttribute('width', (30 * f).toFixed(1)); }
    } else if (e.type === 'cnt' || e.type === 'crst') {
      const c = sim.counters[e.name], on = !!(c && (e.type === 'cnt' ? c.in : c.rst));
      key = (on ? 1 : 0) + (c && c.done ? 2 : 0) + (c ? c.count : 0) * 4;
      if (key !== it.last) { it.g.classList.toggle('on', on); it.g.classList.toggle('done', !!(c && c.done)); if (e.type === 'cnt' && c) it.parts.txt.textContent = c.count + '/' + c.pre; }
    } else if (e.type === 'sen') {
      const det = !!sim.sensors[e.name]; key = det ? 1 : 0;
      if (key !== it.last) { it.g.classList.toggle('det', det); it.parts.sw.style.transform = det ? 'rotate(32deg)' : 'rotate(0deg)'; }
    }
    it.last = key;
  }
  for (const x of L.wires) if (x.st !== 0) { x.st = 0; x.el.classList.remove('on', 'zero'); }
  for (const d of L.dotEls) if (d.st !== 0) { d.st = 0; d.el.classList.remove('on', 'zero'); }
}

/* ---------- 오른쪽: 배선 연습 패널 ---------- */
const WIRE_TIPS = [
  '릴레이·스위치 접점 번호: 끝자리 1 = 공통(COM), 4 = a접점(NO), 2 = b접점(NC). 그래서 a접점은 11-14·21-24…, b접점은 11-12·21-22…예요.',
  '유닛마다 위쪽 빨간 줄이 + 버스, 아래쪽 파란 줄이 − 버스예요. 전원 → 첫 유닛 → 옆 유닛 순서로 짧은 선(점퍼)을 이어 줘요.',
  '릴레이 코일은 A1(+)에 접점에서 온 선, A2(−)는 0V로. 솔레노이드 코일도 + / − 를 지켜요.',
  '근접센서(PNP)는 24V(빨강)·0V(파랑)를 꼭 넣고, OUTPUT(검정)이 접점처럼 다음 줄로 이어져요.',
  '리밋스위치는 COM에서 NO(눌리면 닫힘) 또는 NC(눌리면 열림)로 꺼내요.',
  '한 릴레이 접점은 4개(1~4번 극)뿐이에요. 모자라면 같은 쪽 단자를 같이 써요(예: 자기유지 점에서 솔레노이드 받기).',
  '카운터·타이머 유닛은 + 버스·− 버스에 전원이 들어가야 동작해요. 처음 값은 실물처럼 타이머 0.0초 · 카운터 10이라, 응용 때는 ▲▼로 타이머 3.0초 · 카운터 3으로 맞춰요(누르고 있으면 계속 바뀌어요).',
  '부저·램프 유닛은 + / − 에 전원이 걸리면 켜져요. 접점이 닫히는지 확인할 때 램프를 잠깐 물려 보면 편해요(시험 회로에는 넣지 않아요).',
  '선 색: 0V 쪽(파랑 단자)에 닿는 선은 파랑, 나머지는 빨강으로 저절로 그려져요. 시험에서도 +24V는 적색, 0V는 청색(흑색)이에요.',
];
const AIR_TIPS = [
  '공급 순서: 서비스 유닛 출구(OUT) → 분배기 입구(IN) → 분배기 출구 → 각 밸브 P(1번). 분배기 출구는 어느 구멍을 써도 돼요.',
  '5/2 밸브: 왼쪽 코일이 켜지면 P → A(4번), 단동은 코일이 꺼지면 · 복동은 오른쪽 코일이 켜지면 P → B(2번)예요. 그래서 A는 실린더 헤드 쪽(전진), B는 로드 쪽(후진)으로 이어요.',
  'R1·R2(3·5번)는 소음기가 달린 배기구라 관을 꽂지 않아요.',
  '한 구멍에는 관 하나만 꽂혀요. 관을 안 꽂은 밸브 출구 · 실린더 포트로는 공기가 새요(쉭 표시).',
  '속도 제어 밸브는 도면에 그려진 쪽(헤드 쪽 또는 로드 쪽) 관 중간에 넣어요. 실린더에서 나가는 공기를 조이는 미터아웃이 기본이라, 실물은 기기에 표시된 방향(체크밸브 기호 · 화살표)을 보고 꽂으세요.',
  '관을 다 꽂으면 서비스 유닛의 파란 공급 손잡이를 ON으로 두고 압력계가 0.5 MPa인지 봐요. OFF면 실린더가 움직이지 않아요.',
  '리밋스위치 · 근접센서는 실린더 도그가 끝에 와서 누를 때 바뀌어요. 관이 바뀌어 실린더가 거꾸로 서 있으면 센서도 거꾸로 켜져 있어요.',
];
const OIL_TIPS = [
  '공급 라인부터: 파워 유닛 P → P 분배기 IN, T 분배기 IN → 파워 유닛 T. 분배기 출구는 어느 구멍을 써도 돼요. 파워 유닛 P · T 볼밸브는 손잡이가 라인과 나란하면 열림이에요.',
  '밸브 P는 P 분배기, T는 T 분배기로 이어요. 둘이 바뀌면 실린더가 거꾸로 가거나 멈추고, P와 T를 바로 이으면(단락) 압력계가 0이 돼요.',
  '4포트 밸브: A → 실린더 헤드 쪽, B → 로드 쪽. 도면의 칸(평행 = P→A · B→T, 교차 = P→B · A→T)을 보고 어느 코일이 전진인지 확인해요. 모터는 A가 정회전 입구예요.',
  '퀵 커플러는 호스를 안 꽂으면 막혀요(기름이 안 샘). 그래서 호스가 빠진 라인은 실린더가 그냥 멈춰 있어요 — 공압처럼 새는 소리가 없으니 호스 수를 세어 보세요.',
  '응용 부품은 번호를 봐요: 체크 · 카운터밸런스 · 파일럿 체크 · 미터아웃은 1(밸브 쪽) → 2(실린더 쪽)가 자유 흐름이에요. 미터아웃은 실린더에서 나오는 기름을 조여서 속도를 늦춰요.',
  '멀티 커넥터는 6구멍이 안에서 모두 이어진 블록이에요. 한 라인을 블리드오프 · 파일럿(X) · 릴리프 · 보충 체크로 나눠 보낼 때 써요.',
  '감압밸브는 P1(1차, 분배기 쪽) → P2(2차, 밸브 쪽)로 꽂고, T(드레인)는 T 분배기로 보내요. 옆 압력계로 2차 압력을 확인해요.',
  '다 꽂으면 펌프를 ON으로 두고 압력계가 올라가는지(4 MPa) 봐요. 0이면 P 볼밸브가 닫혔거나 P–T 단락이에요.',
];
/* 두 번 눌러야 실행되는 버튼 (모범 배선 · 모범 배관) */
function twoStep(btn, label, warn, act) {
  let tok = 0;
  btn.textContent = label;
  btn.onclick = () => {
    if (!btn.classList.contains('warnbtn')) {
      const my = ++tok; btn.textContent = warn; btn.classList.add('warnbtn');
      setTimeout(() => { if (tok !== my) return; btn.textContent = label; btn.classList.remove('warnbtn'); }, 4000);
      return;
    }
    tok++; btn.textContent = label; btn.classList.remove('warnbtn'); act();
  };
}
/* 단계: ① 기본 동작 → ② 응용 동작 (같은 배선에서 이어서) */
function stageBar() {
  const w = app.wire, ps = stagePass();
  const bar = h('div', 'wstage'); bar.id = 'wStage';
  const mk = (k, no, lbl, sub) => {
    const b = h('button', 'wst' + (w.target === k ? ' on' : '') + (ps[k] ? ' done' : ''));
    b.appendChild(h('b', null, no + ' ' + lbl)); b.appendChild(h('small', null, ps[k] ? '✓ 검사 통과' : sub));
    b.onclick = () => setStage(k);
    return b;
  };
  bar.appendChild(mk('fix', '①', '기본 동작', '정정 도면대로'));
  bar.appendChild(h('span', 'wsta', '→'));
  bar.appendChild(mk('app', '②', '응용 동작', '같은 배선에서 이어서'));
  return bar;
}
function refreshStageBar() { const old = $('#wStage'); if (old) old.replaceWith(stageBar()); }
function valveChanges(toApp) {
  const P = app.P, A0 = P.acts, A1 = (P.app && P.app.acts) || P.acts, out = [];
  const ctr = b => b === 'abt' ? 'A-B-T 접속' : b === 'closed' ? '클로즈드 센터' : b;
  const nm = v => ({ '52d': '5/2 복동', '52s': '5/2 단동', '42d': '4/2 복동', '42s': '4/2 단동', '22': '2/2' }[v.kind] || (v.kind === '43' ? '4/3 ' + ctr((v.boxes || [])[1]) : v.kind));
  const coilsOf = v => (v.kind === '52d' || v.kind === '42d' || v.kind === '43') ? [v.l, v.r] : [v.sol];
  for (const a of A0) {
    const b = A1.find(x => x.id === a.id); if (!b || nm(a.valve) === nm(b.valve)) continue;
    const f = toApp ? a.valve : b.valve, t = toApp ? b.valve : a.valve;
    const add = coilsOf(t).filter(c => !coilsOf(f).includes(c)), gone = coilsOf(f).filter(c => !coilsOf(t).includes(c));
    out.push(`${a.type === 'motor' ? '모터' : '실린더'} ${a.id} 밸브 ${nm(f)} → ${nm(t)}` + (add.length ? ` (${add.join('·')} 코일 생김)` : '') + (gone.length ? ` (${gone.join('·')} 코일 없어짐)` : ''));
  }
  return out;
}
/* 유압 응용: 보드에 붙는 부품 이름 (지금 보드 기준) */
function appParts() {
  const A = app.wire.panel && app.wire.panel.air; if (!A || A.medium !== 'oil') return [];
  const aw = X => (A.cyls.some(c => c.act === X) ? '실린더 ' : '모터 ') + X;
  const out = A.comps.filter(c => !(c.kind === 'hck' && c.down && !c.pump)).map(c => (c.act ? aw(c.act) + ' ' : '') + c.title);
  for (const m of A.mcs) out.push(aw(m.act) + ' 멀티 커넥터');
  return out;
}
function setStage(k) {
  const w = app.wire, P = app.P;
  if (!P.app || w.target === k) return;
  const gone = k === 'fix' ? appParts() : [];
  w.target = k; store.set('stage.' + P.key, k);
  rebuild();
  const f = FW(), air = f.air, ch = air ? valveChanges(k === 'app') : [], added = k === 'app' ? appParts() : [];
  wireToast((k === 'app' ? `② 응용 동작으로 넘어왔어요. 꽂은 ${air ? (f.oil ? '선·호스는' : '선·관은') : '선은'} 그대로예요.` : '① 기본 동작으로 돌아왔어요.')
    + (ch.length ? ' 보드 밸브도 바꿨어요: ' + ch.join(' · ') + '.' : '')
    + (added.length ? ` 보드에 응용 부품을 붙였어요: ${added.join(' · ')} — 호스를 빼서 그 사이에 넣어 꽂으세요.` : '')
    + (gone.length ? ` 응용 부품(${gone.join(' · ')})은 보드에서 뺐어요` + (w.tubesAside && w.tubesAside.length ? ` — 거기 꽂았던 호스 ${w.tubesAside.length}개는 ②로 가면 다시 보여요.` : '.') : '')
    + (app.wire.dropped ? ` 없어진 ${app.wire.droppedOn.join('·')} 코일에 꽂혀 있던 선 ${app.wire.dropped}개는 뺐어요 — 그 선으로 이어지던 0V · 접점 연결은 다시 확인하세요.` : ''), added.length || gone.length ? 11000 : 8000);
}
function wirePanel(body, title) {
  const P = app.P, w = app.wire, pn = w.panel, air = !!pn.air, isApp = w.target === 'app' && !!P.app, f = FW();
  title.textContent = air ? '배선 · 배관 연습' : '배선 연습';
  if (P.app) body.appendChild(stageBar());
  body.appendChild(h('p', 'note', isApp
    ? `①에서 꽂은 배선${air ? '·배관' : ''}에서 이어서 응용 조건대로 고쳐요. 바뀐 곳은 전기 회로도에 보라색으로 표시돼요. 다 고치면 "응용 동작 검사"를 누르세요.`
    : (air ? (f.oil ? '위는 실습장 트레이너와 같은 전기 단자, 아래는 유압 보드예요(오른쪽 위가 파워 유닛, 그 아래가 P · T 분배기). 전원과 버스 점퍼는 꽂힌 상태로 시작해요. 정정 도면대로 선을, 유압 회로도대로 호스를 꽂고 "기본 동작 검사"를 누르세요.' : '위는 실습장 트레이너와 같은 전기 단자, 아래는 공압 보드예요. 전원과 버스 점퍼는 꽂힌 상태로 시작해요. 정정 도면대로 선을, 공압 회로도대로 관을 꽂고 "기본 동작 검사"를 누르세요.')
      : '실습장 트레이너와 같은 단자예요. 전원과 버스 점퍼는 꽂힌 상태로 시작해요. 정정 도면대로 꽂고 "기본 동작 검사"를 누르세요.')
      + (P.app ? ' 통과하면 같은 배선에서 ② 응용 동작으로 이어가요.' : '')));
  if (isApp) {
    const box = h('div', 'applist');
    box.appendChild(h('b', null, '응용 조건'));
    const ul = h('ul');
    const common = P.kind === 'pneu' ? ['PB2 연속 3회 동작 · PB3 카운터 리셋 (PB1 기본동작은 카운트 안 함)'] : [];
    for (const t of common.concat(P.apply || [])) ul.appendChild(h('li', null, t));
    box.appendChild(ul);
    const ch = air ? valveChanges(true) : [];
    if (ch.length) box.appendChild(h('p', 'note sm', '보드의 밸브는 바꿔 놓았어요 — ' + ch.join(' · ') + (f.oil ? '. 호스는 그대로 꽂혀 있어요.' : '. 관은 그대로 꽂혀 있어요.')));
    const parts = appParts();
    if (parts.length) box.appendChild(h('p', 'note sm', '보드에 응용 부품을 붙여 놓았어요 — ' + parts.join(' · ') + '. 호스는 ①에서 꽂은 그대로라, 응용 회로도처럼 호스를 빼서 부품을 사이에 넣어 꽂아요.'));
    if (P.kind !== 'pneu') box.appendChild(h('p', 'note sm', '유압 응용은 유압 회로(밸브 추가 · 속도)만 바뀌고 전기 회로는 기본 동작과 같아요.'));
    body.appendChild(box);
  }
  const mt = h('div', 'wmap');
  for (const [a, b] of WIRE.mapTable(pn)) { if (/^(LS|S)\d/.test(a)) continue; const r = h('span'); r.appendChild(h('b', null, a)); r.appendChild(document.createTextNode(' = ' + b)); mt.appendChild(r); }
  if (air) {
    for (const v of pn.air.valves) { const r = h('span'); r.appendChild(h('b', null, v.coils.join('·'))); r.appendChild(document.createTextNode(' 밸브 → ' + E.actName(app.PV, v.act))); mt.appendChild(r); }
    for (const sp of pn.air.sups || []) { const r = h('span'); r.appendChild(h('b', null, sp.coil)); r.appendChild(document.createTextNode(' 공급 밸브 → ' + E.actName(app.PV, sp.act) + ' P 라인')); mt.appendChild(r); }
  }
  mt.appendChild(h('span', 'wmapn', air ? (f.oil ? '리밋스위치 · 솔레노이드 코일은 유압 보드에 도면 이름(LS1, Y1 …)으로 붙어 있어요. 밸브는 유압 회로도처럼 자기 실린더 · 모터 아래에 있어요.' : '리밋스위치 · 센서 · 솔레노이드 코일은 공압 보드에 도면 이름(LS1, S1, Y1 …)으로 붙어 있어요. 밸브는 공압 회로도처럼 자기 실린더 아래에 있어요.') : '리밋스위치 · 센서 · 솔레노이드는 보드에 도면 이름(LS1, S1, Y1 …)으로 붙어 있어요.'));
  body.appendChild(mt);
  const pre = h('p', 'note wpre'); pre.id = 'wPreNote'; body.appendChild(pre);
  const row = h('div', 'wrow');
  const chkLbl = isApp ? '응용 동작 검사' : '기본 동작 검사';
  const bChk = h('button', 'btn primary', chkLbl); bChk.id = 'wCheck';
  bChk.onclick = () => { bChk.disabled = true; bChk.textContent = '확인 중…'; setTimeout(() => { runStageCheck(); bChk.disabled = false; bChk.textContent = chkLbl; }, 30); };
  row.appendChild(bChk);
  row.appendChild(h('span', 'note sm', (isApp ? (P.kind === 'pneu' ? 'PB1 · PB2 연속 · PB3 리셋까지 돌려 보고' : '응용 조건대로 돌려 보고') : 'PB1로 2회 돌려 보고') + `, 배선${air ? '·배관' : ''}을 도면과 비교해요.`));
  body.appendChild(row);
  const res = h('div', 'wres'); res.id = 'wRes'; body.appendChild(res);
  const row2 = h('div', 'wrow');
  const bAuto = h('button', 'btn sm');
  twoStep(bAuto, '모범 배선 그대로 꽂기', '한 번 더 누르면 지금 선을 모범 배선으로 바꿔요', applyAuto);
  row2.appendChild(bAuto);
  if (air) { const bAir = h('button', 'btn sm'); twoStep(bAir, f.oil ? '모범 호스 그대로 꽂기' : '모범 배관 그대로 꽂기', f.oil ? '한 번 더 누르면 지금 호스를 모범 배관으로 바꿔요' : '한 번 더 누르면 지금 관을 모범 배관으로 바꿔요', applyAutoAir); row2.appendChild(bAir); }
  row2.appendChild(h('span', 'note sm', '되돌리기로 원래 ' + (air ? (f.oil ? '선·호스를' : '선·관을') : '선을') + ' 다시 불러올 수 있어요.'));
  body.appendChild(row2);
  const gd = h('details', 'wtips wguide');
  gd.appendChild(h('summary', null, `줄별 배선표 — ${isApp ? '응용 회로를' : '정정 도면을'} 단자 번호로 옮긴 것`));
  gd.appendChild(h('p', 'note sm', '모범 배선 기준이에요. 줄 이름을 누르면 그 줄의 선이 배선판에 점선으로, 도면에는 보라색으로 표시돼요. 전기 회로도의 접점을 눌러도 꽂을 단자를 알려줘요.'));
  gd.addEventListener('toggle', () => {
    if (!gd.open || gd.dataset.done) return; gd.dataset.done = '1';
    const a = ensureAuto(), G = WIRE.wireGuide(pn, app.def, a), jn = id => WIRE.jackName(pn, id);
    for (const grp of G.groups) {
      const box = h('div', 'wg');
      const hd = h('button', 'wgh', (grp.no ? grp.no + '번 줄 · ' : '') + grp.title + ` (선 ${grp.wires.length})`);
      hd.onclick = () => showGuide(grp);
      box.appendChild(hd);
      const ul = h('ul');
      for (const i of grp.wires) { const q = a.wires[i]; const li = h('li', null, jn(q.a) + ' → ' + jn(q.b)); li.onclick = () => flashItem({ jacks: [q.a, q.b], ghost: [q], scroll: false }); ul.appendChild(li); }
      box.appendChild(ul); gd.appendChild(box);
    }
  });
  body.appendChild(gd);
  if (air) {
    const gp = h('details', 'wtips wguide');
    gp.appendChild(h('summary', null, f.oil ? '배관표 — 유압 회로도를 보드 커플러로 옮긴 것' : '배관표 — 공압 회로도를 보드 포트로 옮긴 것'));
    gp.appendChild(h('p', 'note sm', f.oil ? '모범 배관 기준이에요. 묶음 이름을 누르면 그 호스들이 보드에 보라색 점선으로 보여요. P · T 분배기와 멀티 커넥터의 구멍 번호는 아무거나 써도 돼요. 유압 회로도의 실린더 · 모터 · 밸브를 눌러도 꽂을 커플러를 알려줘요.' : '모범 배관 기준이에요. 묶음 이름을 누르면 그 관들이 보드에 보라색 점선으로 보여요. 분배기 출구 번호는 아무거나 써도 돼요. 공압 회로도의 실린더 · 밸브를 눌러도 꽂을 포트를 알려줘요.'));
    gp.addEventListener('toggle', () => {
      if (!gp.open || gp.dataset.done) return; gp.dataset.done = '1';
      const ap = ensureAutoAir(), pnm = id => WIRE.portName(pn, id);
      for (const grp of ap.groups) {
        const ts = grp.tubes.map(i => ap.tubes[i]);
        const box = h('div', 'wg');
        const hd = h('button', 'wgh', grp.title + ` (${f.tube} ${ts.length})`);
        hd.onclick = () => flashItem({ ports: [...new Set(ts.flatMap(t => [t.a, t.b]))], ghostT: ts });
        box.appendChild(hd);
        const ul = h('ul', 'kr');
        for (const t of ts) { const li = h('li', null, pnm(t.a) + ' → ' + pnm(t.b)); li.onclick = () => flashItem({ ports: [t.a, t.b], ghostT: [t] }); ul.appendChild(li); }
        box.appendChild(ul); gp.appendChild(box);
      }
    });
    body.appendChild(gp);
  }
  const tips = h('details', 'wtips'); tips.appendChild(h('summary', null, '배선할 때 자주 틀리는 곳'));
  const ul = h('ul'); for (const t of WIRE_TIPS) ul.appendChild(h('li', null, t)); tips.appendChild(ul);
  body.appendChild(tips);
  if (air) {
    const t2 = h('details', 'wtips'); t2.appendChild(h('summary', null, f.oil ? '호스 꽂을 때 자주 틀리는 곳' : '관 꽂을 때 자주 틀리는 곳'));
    const u2 = h('ul'); for (const t of (f.oil ? OIL_TIPS : AIR_TIPS)) u2.appendChild(h('li', null, t)); t2.appendChild(u2);
    body.appendChild(t2);
  }
  renderWireResults(); wirePreNote();
}
function applyAuto() {
  const w = app.wire;
  if (!w.auto) { w.auto = WIRE.autoWire(w.panel, app.def); w.auto.def = app.def; }
  pushUndo(); w.wires = w.auto.wires.map(x => ({ a: x.a, b: x.b })); w.selWire = -1;
  if (w.auto.presets) { Object.assign(w.panel.presets, w.auto.presets); store.set(preKey(), w.panel.presets); }
  wireChanged(); wirePreNote();
}
function applyAutoAir() {
  const w = app.wire; if (!w.panel.air) return;
  const ap = ensureAutoAir();
  pushUndo(); w.tubes = ap.tubes.map(t => ({ a: t.a, b: t.b })); w.tubesAside = []; w.selTube = -1; updDel();
  wireChanged();
}
/* 단계 검사 (버튼 하나): 동작 검사(기본 PB1 2회 / 응용 조건) + 배선 · 배관을 도면과 비교 */
function runStageCheck() {
  const w = app.wire, P = app.P, air = !!w.panel.air;
  runWireCheck(true);
  runWireRun();
  const ok = !!(w.run && w.run.ok && w.check && w.check.ok && (!air || (w.checkAir && w.checkAir.ok)));
  w.pass = ok;
  if (ok) { const ps = stagePass(); ps[w.target] = true; store.set('passS.' + P.key, ps); }
  renderWireResults(); refreshStageBar();
  if (!ok) {
    const first = w.check.items.find(i => i.sev === 'err' && (i.jacks.length || (i.wires || []).length)) || (w.checkAir && w.checkAir.items.find(i => i.sev === 'err' && ((i.ports || []).length || (i.tubes || []).length)));
    if (first) flashItem(first);
  }
}
function runWireCheck(quiet) {
  const w = app.wire;
  let r; try { r = WIRE.analyze(w.panel, w.wires, app.def, app.PV); } catch (err) { console.error(err); r = { items: [{ sev: 'err', text: '검사 중 오류: ' + err.message, jacks: [] }], errors: 1, ok: false }; }
  w.check = r;
  w.checkAir = null;
  if (w.panel.air) { try { w.checkAir = WIRE.analyzeAir(w.panel, w.tubes, app.PV); } catch (err) { console.error(err); w.checkAir = { items: [{ sev: 'err', text: '배관 검사 중 오류: ' + err.message, ports: [] }], errors: 1, ok: false }; } }
  w.stale = false; drawAllMarks();
  if (quiet) return;
  renderWireResults();
  const first = r.items.find(i => i.sev === 'err' && (i.jacks.length || (i.wires || []).length)) || (w.checkAir && w.checkAir.items.find(i => i.sev === 'err' && ((i.ports || []).length || (i.tubes || []).length)));
  if (first) flashItem(first);
}
function runWireRun() {
  const w = app.wire, air = !!w.panel.air, f = FW();
  let r;
  const def = () => ({ __net: WIRE.buildWireNet(w.panel, w.wires).net, __air: air ? WIRE.airModel(w.panel, w.tubes, { on: true, bvP: true, bvT: true }) : null });
  try {
    if (w.target === 'app' && app.P.app) r = E.runAppCheck(app.PV, def(), { cpre: w.panel.refPre.C1, tpre: w.panel.refPre.T1 });
    else {
      const x = E.runCheck(app.PV, def(), { cycles: 2 });
      const same = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every(k => a[k] === b[k]); };
      const seqOk = x.groups.length === x.expected.length && x.groups.every((g, i) => same(g, x.expected[i]));
      const back = app.PV.acts.every(a => a.type !== 'cyl' || Math.abs(x.sim.acts[a.id].pos - app.PV.seq.rows.find(q => q.id === a.id).pos[0]) < 0.001);
      const steps = [
        { ok: x.cycles >= 1, text: `PB1 → 1회째 ${x.cycles >= 1 ? '완료' : (x.state === 'dev' ? '선도와 다르게 움직임' : x.p + '단계에서 멈춤')}` },
        { ok: x.cycles >= 2, text: `PB1 → 2회째 ${x.cycles >= 2 ? '완료' : x.cycles >= 1 ? (x.state === 'dev' ? '선도와 다르게 움직임' : x.p + '단계에서 멈춤') : '시도 못 함'}` },
        { ok: seqOk, text: seqOk ? '동작 순서: 변위단계선도와 같음' : '동작 순서가 선도와 다름' },
        { ok: back && !x.osc.length && !x.short && !x.conflicts.length, text: x.short ? '단락이 생겨요' : x.osc.length ? x.osc.join('·') + ' 발진' : x.conflicts.length ? '밸브 양쪽 솔레노이드 동시 ON' : back ? '초기 위치로 복귀 · 발진·단락 없음' : '초기 위치로 돌아오지 않음' },
      ];
      r = { ok: x.ok, steps, okText: air ? `✓ 전원 · ${f.oil ? '유압을' : '공기를'} 유지한 채 PB1 2회 모두 선도대로 동작해요.` : '✓ 전원을 유지한 채 PB1 2회 모두 선도대로 동작해요.', badText: '✗ 2회 동작 확인을 통과하지 못했어요.' };
    }
    if (air) {
      if (f.oil) {
        if (!w.tubes.length) r.steps.unshift({ ok: false, text: '유압 보드에 호스가 없어요 — 호스를 꽂아야 실린더 · 모터가 움직여요.' });
        if (!w.airOn || !w.bvP || !w.bvT) r.steps.push({ note: true, text: '검사는 펌프 ON · P/T 볼밸브 열림으로 계산했어요. 보드에서 돌려 보려면 파워 유닛의 펌프를 켜고 볼밸브를 여세요.' });
      } else {
        if (!w.tubes.length) r.steps.unshift({ ok: false, text: '공압 보드에 관이 없어요 — 관을 꽂아야 실린더가 움직여요.' });
        if (!w.airOn) r.steps.push({ note: true, text: '검사는 공기 공급 ON으로 계산했어요. 보드에서 돌려 보려면 서비스 유닛 손잡이를 ON으로 켜세요.' });
      }
    }
  } catch (err) { console.error(err); r = { ok: false, steps: [{ ok: false, text: '검사 중 오류: ' + err.message }] }; }
  w.run = r; w.stale = false; renderWireResults();
}
function wireItems(c, ul) {
  for (const it of c.items) {
    if (it.sev === 'ok') continue;
    const li = h('li', 'wi ' + it.sev);
    li.appendChild(h('span', 'wic', { err: '✗', warn: '!', info: 'i' }[it.sev] || '·'));
    li.appendChild(h('span', 'wtx', it.text));
    if ((it.jacks && it.jacks.length) || (it.wires && it.wires.length) || it.load || (it.ports && it.ports.length) || (it.tubes && it.tubes.length)) { li.classList.add('click'); li.onclick = () => flashItem(it); }
    ul.appendChild(li);
  }
}
function renderWireResults() {
  const res = $('#wRes'); if (!res) return; clear(res);
  const w = app.wire, P = app.P, air = !!(w.panel && w.panel.air), f = FW();
  if (w.stale) res.appendChild(h('p', 'note warnline', air ? (f.oil ? '선이나 호스가 바뀌었어요. 다시 검사해 보세요.' : '선이나 관이 바뀌었어요. 다시 검사해 보세요.') : '선이 바뀌었어요. 다시 검사해 보세요.'));
  if (w.run) { const box = h('div', 'chkres'); renderCheck(box, w.run); res.appendChild(box); }
  if (w.check) {
    const c = w.check, ca = air ? w.checkAir : null;
    const nE = c.items.filter(i => i.sev === 'err').length, nA = ca ? ca.items.filter(i => i.sev === 'err').length : 0;
    const okW = c.ok && (!air || (ca && ca.ok));
    res.appendChild(h('p', 'wsum ' + (okW ? 'okmsg' : 'badmsg'), okW ? (air ? '✓ 배선 · 배관이 도면과 같아요.' : '✓ 배선이 도면과 같아요.') : `✗ 배선${air ? '·배관' : ''}에서 고칠 곳 ${nE + nA}개${air ? ` (전기 ${nE} · ${f.kind} ${nA})` : ''} — 항목을 누르면 단자${air ? '·' + f.port : ''}가 깜빡여요.`));
    const secs = air && ca ? [['전기 배선', c], [f.kind + ' 배관', ca]] : [[null, c]];
    for (const [ttl, cc] of secs) {
      if (ttl) res.appendChild(h('div', 'wsech' + (cc.ok ? ' ok' : ''), ttl + (cc.ok ? ' ✓' : '')));
      const ul = h('ul', 'wlist'); wireItems(cc, ul);
      if (ul.childNodes.length) res.appendChild(ul);
    }
  }
  if (w.pass && !w.stale) {
    const nx = h('div', 'wnext');
    if (w.target === 'fix' && P.app) {
      nx.appendChild(h('p', null, `① 기본 동작 통과! 시험처럼 지금 배선${air ? '·배관' : ''}을 그대로 두고 응용 동작으로 이어가요.`));
      const b = h('button', 'btn primary', '② 응용 동작으로 이어가기 →'); b.onclick = () => setStage('app');
      nx.appendChild(b);
    } else nx.appendChild(h('p', null, P.app ? '② 응용 동작까지 통과했어요. 기본 → 응용을 한 배선으로 모두 끝냈어요.' : '기본 동작을 통과했어요.'));
    res.appendChild(nx);
  }
}
function wireHint() {
  const diag = $('#diag'), w = app.wire, sim = app.sim, air = !!w.panel.air, f = FW();
  diag.hidden = false;
  diag.appendChild(h('b', null, air ? '배선 · 배관 확인' : '배선 확인'));
  if (air) {
    if (f.oil) {
      if (!w.airOn) { diag.appendChild(h('p', null, '파워 유닛 펌프가 OFF예요. 보드 오른쪽 위 파워 유닛의 펌프 버튼을 눌러 켜세요.')); return; }
      if (!w.bvP || !w.bvT) { diag.appendChild(h('p', null, `파워 유닛의 ${!w.bvP ? 'P' : 'T'} 볼밸브가 닫혀 있어요. 손잡이를 눌러 라인과 나란하게(열림) 두세요.`)); return; }
      if (sim.air && sim.air.short) diag.appendChild(h('p', null, 'P와 T가 바로 이어져서(단락) 압력계가 0이에요. 분배기와 밸브 P · T 호스를 확인하세요.'));
    } else if (!w.airOn) { diag.appendChild(h('p', null, '서비스 유닛의 공기 공급이 OFF예요. 보드의 파란 손잡이를 눌러 ON으로 켜세요.')); return; }
    const pr = sim.prog;
    let acts = [];
    if (pr.state === 'dev' && pr.dev) acts = [pr.dev.act];
    else { let d = []; try { d = sim.diagnose(); } catch (e) { } acts = d.filter(x => !x.bad.length).map(x => x.act); }
    let ca = null; try { ca = WIRE.analyzeAir(w.panel, w.tubes, app.PV); } catch (e) { }
    const errsA = ca ? ca.items.filter(i => i.sev === 'err') : [];
    if (errsA.length) {
      const pri = errsA.filter(i => !i.act || acts.includes(i.act));
      const list = (pri.length && acts.length ? pri : errsA).slice(0, 3);
      diag.appendChild(h('p', null, pri.length && acts.length
        ? (pr.state === 'dev' ? `${acts.map(x => E.actName(app.PV, x)).join(' · ')}의 움직임이 선도와 달라요. ${f.kind} 배관을 확인해 보세요 (누르면 ${f.port}가 깜빡여요):` : `${acts.map(x => E.actName(app.PV, x)).join(' · ')}: 솔레노이드는 맞게 바뀌었는데 움직이지 않아요 → ${f.kind} 배관을 확인하세요 (누르면 ${f.port}가 깜빡여요):`)
        : `${f.kind} 배관에 고칠 곳이 ${errsA.length}개 있어요. ${f.oil ? '호스가' : '관이'} 틀리면 ${f.oil ? '실린더 · 모터' : '실린더'}가 도면과 다르게 움직여서 다음 단계도 멈춰요 (누르면 ${f.port}가 깜빡여요):`));
      const ul = h('ul');
      list.forEach(it => { const li = h('li', 'click', it.text); li.onclick = () => flashItem(it); ul.appendChild(li); });
      diag.appendChild(ul);
      return;
    }
  }
  diag.appendChild(h('p', null, '오른쪽 "' + (air ? '배선 · 배관 연습' : '배선 연습') + '"의 "' + (w.target === 'app' ? '응용' : '기본') + ' 동작 검사"를 누르면 어느 단자가 틀렸는지 알려줘요. "' + (air ? '흐름 표시' : '전기 흐름 표시') + '"를 켜 두면 +24V가 걸린 단자가 빛나서 어디서 끊겼는지 보기 쉬워요.'));
}
/* 공압 회로도(동작 화면)의 실린더 · 밸브를 누르면 꽂을 포트 */
function bindFluidRef() {
  const svg = $('#fluidSvg');
  svg.addEventListener('click', ev => {
    if (app.view !== 'wire' || !app.wire.panel || !app.wire.panel.air) return;
    const m = svg.getScreenCTM(); if (!m) return;
    const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    const p = pt.matrixTransform(m.inverse());
    const pneu = app.P.kind === 'pneu', CW = pneu ? 270 : 262;
    const i = Math.floor((p.x - 52) / CW), a = app.PV.acts[i];
    if (!a || p.y < 10 || (pneu && p.y > 290)) return;
    fluidRefPop(a.id, p.y < (pneu ? 126 : 130) ? 'cyl' : 'valve', ev);
  });
}
function fluidRefPop(act, part, ev) {
  const w = app.wire, pn = w.panel, A = pn.air, oil = A.medium === 'oil', ap = ensureAutoAir(), pnm = id => WIRE.portName(pn, id);
  const grp = ap.groups.find(g => g.act === act), v = A.valves.find(x => x.act === act);
  if (!grp || !v) return;
  let idx = grp.tubes.slice();
  if (!oil && part === 'valve') idx = ap.tubes.map((t, i) => i).filter(i => ap.tubes[i].a === v.P || ap.tubes[i].b === v.P).concat(idx);
  if (oil && part === 'cyl') { const wk = idx.filter(i => !/P 라인|T 라인|드레인/.test(ap.tubes[i].ln || '')); if (wk.length) idx = wk; }
  const ts = [...new Set(idx)].map(i => ap.tubes[i]);
  const pop = $('#fluidPop'), body = $('#fluidBody');
  clear(pop); pop.hidden = false; pop.className = 'pop wide';
  const bb = body.getBoundingClientRect();
  pop.style.left = Math.max(4, Math.min(body.scrollLeft + body.clientWidth - 308, ev.clientX - bb.left + body.scrollLeft - 120)) + 'px';
  pop.style.top = Math.max(4, ev.clientY - bb.top + 12) + 'px';
  const vm = pn.modules.find(m => m.id === v.mod);
  pop.appendChild(h('h3', null, oil
    ? (part === 'cyl' ? `${E.actName(app.PV, act)} — 호스 ${ts.length}개` : `${v.coils.join('·')} ${vm ? vm.title : '밸브'} — 호스 ${ts.length}개`)
    : (part === 'cyl' ? `실린더 ${act} — 관 ${ts.length}개` : `${WIRE.valveName(pn, v.mod)} (${v.dbl ? '5/2 복동' : '5/2 단동'}) — 관 ${ts.length}개`)));
  const ul = h('ul', 'popw kr'); ts.forEach(t => ul.appendChild(h('li', null, pnm(t.a) + ' → ' + pnm(t.b)))); pop.appendChild(ul);
  const sc = A.scs.find(s => s.act === act);
  if (sc) pop.appendChild(h('p', 'popnote dim', `속도 제어 밸브는 ${sc.side === 'cap' ? '헤드 쪽' : '로드 쪽'} 관 중간에 넣어요.`));
  if (oil) {
    const cs = A.comps.filter(c => c.act === act).map(c => c.title).concat(A.mcs.filter(m => m.act === act).map(() => '멀티 커넥터'));
    const nt = (cs.length ? '이 묶음의 부품: ' + cs.join(' · ') + '. ' : '') + (part === 'valve' ? 'P · T 분배기 구멍 번호는 아무거나 써도 돼요.' : '');
    if (nt) pop.appendChild(h('p', 'popnote dim', nt));
  }
  const ports = [...new Set(ts.flatMap(t => [t.a, t.b]))];
  flashItem({ ports, ghostT: ts, scroll: false });
  const r = h('div', 'row');
  const go = h('button', 'btn sm', '보드에서 보기'); go.onclick = () => { pop.hidden = true; flashItem({ ports, ghostT: ts }); };
  const close = h('button', 'btn sm', '닫기'); close.onclick = () => { pop.hidden = true; };
  r.appendChild(go); r.appendChild(close); pop.appendChild(r);
  ev.stopPropagation();
}
function bindWireTools() {
  const w = app.wire;
  $('#wUndo').onclick = () => {
    if (!w.undo.length) return;
    const st = JSON.parse(w.undo.pop());
    if (Array.isArray(st)) w.wires = st; else { w.wires = st.w || []; w.tubes = st.t || []; }
    w.selWire = -1; w.selTube = -1; $('#wUndo').disabled = !w.undo.length; updDel(); wireChanged();
  };
  $('#wDel').onclick = deleteSel;
  $('#wStart').onclick = () => {
    pushUndo();
    w.wires = WIRE.startWires(w.panel); w.tubes = []; w.tubesAside = []; w.selWire = -1; w.selTube = -1; updDel();
    w.panel.presets.T1 = 0; w.panel.presets.TOFF = 0; w.panel.presets.C1 = 10; store.set(preKey(), w.panel.presets);
    store.set('passS.' + app.P.key, {});
    wireChanged(); wirePreNote(); refreshStageBar();
    wireToast(`처음 상태로 — 전원 · 버스 점퍼만 꽂혀 있어요${w.panel.air ? ' (관은 모두 뺐어요)' : ''}. 타이머 0.0초 · 카운터 10으로 돌려 놓았어요.`);
  };
  $('#wClear').onclick = () => { if (!w.wires.length && !w.tubes.length) return; pushUndo(); w.wires = []; w.tubes = []; w.selWire = -1; w.selTube = -1; updDel(); wireChanged(); };
  $('#wLive').onchange = ev => { w.live = ev.target.checked; store.set('wireLive', w.live); WP.fxKey = null; };
  $('#wGhost').onchange = ev => { w.ghost = ev.target.checked; renderWires(); renderTubes(); };
  w.live = store.get('wireLive', true); $('#wLive').checked = w.live;
  document.addEventListener('keydown', ev => {
    if (app.view !== 'wire') return;
    const tag = (ev.target && ev.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && (w.selWire >= 0 || w.selTube >= 0)) { ev.preventDefault(); deleteSel(); }
    else if (ev.key === 'Escape') { w.sel = null; w.selP = null; WP.rubber = null; if (w.selWire >= 0) selectWire(-1); else if (w.selTube >= 0) selectTube(-1); else drawOverlay(); }
    else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); $('#wUndo').click(); }
  });
}

/* ---------- 초기화 ---------- */
function init() {
  const sel = $('#probSel');
  const groups = { pneu: h('optgroup'), hyd: h('optgroup') };
  groups.pneu.label = '1과제 공기압 회로 구성'; groups.hyd.label = '2과제 유압 회로 구성';
  for (const P of PROBLEMS) { const o = h('option', null, P.title + ' · ' + P.seqText.replace(/[()]/g, '')); o.value = P.key; groups[P.kind].appendChild(o); }
  sel.appendChild(groups.pneu); sel.appendChild(groups.hyd);
  const nextView = P2 => app.view === 'prac' ? 'prob' : app.view === 'app' && !P2.app ? 'fix' : app.view;
  sel.onchange = () => { app.focusErr = null; const P2 = PROBLEMS.find(p => p.key === sel.value); buildProblem(sel.value, nextView(P2)); };
  const step = d => { const i = PROBLEMS.findIndex(p => p.key === app.P.key); const n = PROBLEMS[(i + d + PROBLEMS.length) % PROBLEMS.length]; app.focusErr = null; buildProblem(n.key, nextView(n)); };
  $('#probPrev').onclick = () => step(-1); $('#probNext').onclick = () => step(1);
  document.querySelectorAll('.modes button').forEach(b => b.onclick = () => { if (b.disabled) return; app.focusErr = null; if (b.dataset.view === 'prac') { newPractice(); app.editMode = true; } buildProblem(app.P.key, b.dataset.view); });
  $('#errToggle').onchange = ev => { app.showErr = ev.target.checked; drawAllMarks(); };
  $('#editToggle').onchange = ev => { app.editMode = ev.target.checked; $('#editPop').hidden = true; bindLadderEditClass(); };
  $('#runBtn').onclick = () => { app.running = !app.running; $('#runBtn').textContent = app.running ? '일시정지' : '계속'; $('#runBtn').setAttribute('aria-pressed', app.running ? 'true' : 'false'); };
  $('#resetBtn').onclick = () => { pbUp(); for (const k in pbx) pbx[k].up(); app.sim.reset(); app.logN = 0; clear($('#log')); app.lastProgKey = ''; app.pbxKey = ''; app.waitStep = false; frame(0, true); };
  document.querySelectorAll('#speedSeg button').forEach(b => b.onclick = () => { app.speed = +b.dataset.v; document.querySelectorAll('#speedSeg button').forEach(x => x.classList.toggle('on', x === b)); });
  $('#stepMode').onchange = ev => { app.stepMode = ev.target.checked; $('#nextBtn').hidden = !app.stepMode; app.waitStep = false; };
  $('#nextBtn').onclick = () => { app.waitStep = false; };
  bindPB($('#pbBtn')); bindPB($('#fab'));
  bindWireTools(); bindFloats(); bindFluidRef();
  app.wire.tno = store.get('wireTno', true); $('#tnoToggle').checked = app.wire.tno;
  $('#tnoToggle').onchange = ev => { app.wire.tno = ev.target.checked; store.set('wireTno', app.wire.tno); $('#ladderSvg').classList.toggle('tnoff', !app.wire.tno); };
  bindPBX($('#pb2Btn'), 'PB2'); bindPBX($('#pb3Btn'), 'PB3');
  document.addEventListener('click', ev => { const pop = $('#editPop'); if (!pop.hidden && !pop.contains(ev.target) && !ev.target.closest('.el')) pop.hidden = true; const fp = $('#fluidPop'); if (fp && !fp.hidden && !fp.contains(ev.target)) fp.hidden = true; });
  window.addEventListener('hashchange', () => { const k = location.hash.slice(1); if (k && app.P && k !== app.P.key && PROBLEMS.some(p => p.key === k)) buildProblem(k, 'prob'); });
  const last = store.get('last', null);
  const hk = location.hash.slice(1);
  const key = PROBLEMS.some(p => p.key === hk) ? hk : (last && last.key) || 'pn1';
  const view = last && last.key === key && last.view !== 'prac' ? last.view : 'prob';
  buildProblem(key, view);
  requestAnimationFrame(t => { lastT = t; requestAnimationFrame(frame); });
}
function canEdit() { return app.editMode && (app.view === 'prob' || app.view === 'prac'); }
function bindLadderEditClass() {
  for (const it of app.L.items) it.g.classList.toggle('edit', canEdit() && ['no', 'nc', 'lsno', 'lsnc', 'coil', 'sol'].includes(it.e.type));
}
init();
})();
