/* 공유압 회로 시뮬레이션 엔진 — 래더(사다리) 도면 → 넷리스트 → 릴레이/솔레노이드/실린더 시뮬레이션
   브라우저와 Node 테스트에서 같이 씀 */
(function (root) {
'use strict';

const H = 10;                 // +24V 선(y=0) ~ 0V 선(y=10)
const ELH = { pb: 0.9, no: 0.9, nc: 0.9, lsno: 0.9, lsnc: 0.9, sen: 1.5, coil: 0.7, sol: 0.7, tmr: 0.7, cnt: 0.7, crst: 0.7 };
const SEN_DX = 0.66;          // 센서 출력 단자 x 위치(센서 중심에서)
const EPS = 1e-6;
const RELAY_DELAY = 0.008;    // 릴레이 동작/복귀 지연 (s)
const VALVE_DELAY = 0.025;    // 솔레노이드 밸브 전환 시간 (s) — 이보다 짧은 신호에는 밸브가 움직이지 않음
const SUB = 0.001;            // 시뮬레이션 기본 시간 간격 (s)

const isContact = t => t === 'pb' || t === 'pbnc' || t === 'no' || t === 'nc' || t === 'lsno' || t === 'lsnc';
const isLoad = t => t === 'coil' || t === 'sol' || t === 'tmr' || t === 'cnt' || t === 'crst';
const START_PB = ['PB1', 'PB2'];      // 누르면 사이클이 시작되는 버튼
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------------- 도면 정의 정리 ---------------- */
function elId(colId, idx, t) { return (t[3] && t[3].id) || (colId + '.' + idx); }

function normalizeDef(def) {
  const d = clone(def);
  d.cols.forEach((c, ci) => {
    c.id = c.id || ('c' + ci);
    if (c.y0 == null) c.y0 = 0;
    if (c.y1 == null) c.y1 = H;
    c.els = (c.els || []).map((t, i) => {
      const o = Object.assign({}, t[3] || {});
      o.id = elId(c.id, i, t);
      return [t[0], t[1], t[2], o];
    });
  });
  d.links = (d.links || []).map(l => Array.isArray(l) ? { y: l[0], x1: l[1], x2: l[2] } : Object.assign({}, l));
  return d;
}

/* 정정 패치: set / del / add / replace
   marks: 요소 id → {err, kind}  (정정 도면에서 바뀐 곳 표시용)
   fixTargets: 문제 도면에서 오류로 표시할 요소 id → err */
function applyPatches(def0, patches) {
  const d = normalizeDef(def0);
  const marks = {}, ghosts = [];
  const find = id => { for (const c of d.cols) for (const e of c.els) if (e[3].id === id) return { c, e }; return null; };
  for (const p of patches || []) {
    if (p.op === 'set') {
      const f = find(p.id); if (!f) throw new Error('patch set: 없는 요소 ' + p.id);
      const before = { t: f.e[0], n: f.e[1] };
      if (p.t) f.e[0] = p.t;
      if (p.n) f.e[1] = p.n;
      if ('arrow' in p) f.e[3].arrow = p.arrow;
      marks[p.id] = { err: p.err, kind: 'chg', before };
    } else if (p.op === 'del') {
      const f = find(p.id); if (!f) throw new Error('patch del: 없는 요소 ' + p.id);
      f.e[3].ghost = true;
      marks[p.id] = { err: p.err, kind: 'del' };
    } else if (p.op === 'add') {
      const c = d.cols.find(c => c.id === p.col); if (!c) throw new Error('patch add: 없는 줄 ' + p.col);
      const e = clone(p.el); e[3] = Object.assign({}, e[3] || {}, { id: p.id });
      c.els.push(e);
      marks[p.id] = { err: p.err, kind: 'add' };
    } else if (p.op === 'replace') {
      const rm = new Set(p.removeCols || []);
      d.cols = d.cols.filter(c => !rm.has(c.id));
      const rl = (p.removeLinks || []).map(l => JSON.stringify(l));
      d.links = d.links.filter(l => !rl.includes(JSON.stringify(l.sen ? [l.y, l.sen, l.x2] : [l.y, l.x1, l.x2])));
      for (const c of p.addCols || []) {
        const cc = clone(c);
        cc.y0 = cc.y0 == null ? 0 : cc.y0; cc.y1 = cc.y1 == null ? H : cc.y1;
        cc.els = cc.els.map((t, i) => { const o = Object.assign({}, t[3] || {}); o.id = elId(cc.id, i, t); return [t[0], t[1], t[2], o]; });
        cc.els.forEach(e => { marks[e[3].id] = { err: p.err, kind: 'add' }; });
        cc.added = p.err;
        d.cols.push(cc);
      }
      for (const l of p.addLinks || []) d.links.push(Array.isArray(l) ? (typeof l[1] === 'string' ? { y: l[0], sen: l[1], x2: l[2], added: p.err } : { y: l[0], x1: l[1], x2: l[2], added: p.err }) : Object.assign({ added: p.err }, l));
    }
  }
  d.cols.sort((a, b) => a.x - b.x);
  return { def: d, marks };
}

/* 문제 도면 위에 표시할 오류 위치 */
function errorTargets(def0, patches) {
  const d = normalizeDef(def0);
  const t = {}; const adds = [];
  for (const p of patches || []) {
    if (p.op === 'set' || p.op === 'del') t[p.id] = p.err;
    else if (p.op === 'add') adds.push({ col: p.col, el: p.el, err: p.err, id: p.id });
    else if (p.op === 'replace') for (const cid of p.removeCols || []) { const c = d.cols.find(c => c.id === cid); if (c) c.els.forEach(e => { t[e[3].id] = p.err; }); }
  }
  return { targets: t, adds };
}

/* ---------------- 넷리스트 ---------------- */
function buildNet(def0) {
  const d = def0.cols[0] && def0.cols[0].els[0] && def0.cols[0].els[0][3] && def0.cols[0].els[0][3].id ? def0 : normalizeDef(def0);
  const parent = [];
  const make = () => { parent.push(parent.length); return parent.length - 1; };
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
  const TOP = make(), BOT = make();
  const els = [], segs = [], cols = [];
  for (const c of d.cols) {
    const live = c.els.filter(e => !e[3].ghost).slice().sort((a, b) => a[2] - b[2]);
    const col = { id: c.id, x: c.x, y0: c.y0, y1: c.y1, segs: [], els: [], added: c.added };
    let node = make(), ys = c.y0;
    for (const t of live) {
      const h = ELH[t[0]]; if (h == null) throw new Error('알 수 없는 요소 ' + t[0]);
      const el = { id: t[3].id, type: t[0], name: t[1], y: t[2], x: c.x, col: c.id, arrow: !!t[3].arrow, top: t[2] - h / 2, bot: t[2] + h / 2, o: t[3] };
      if (el.top < ys - EPS) throw new Error(`요소 겹침: ${c.id} ${el.name} y=${el.y}`);
      const sg = { col: c.id, x: c.x, ya: ys, yb: el.top, node };
      col.segs.push(sg); segs.push(sg);
      el.a = node; node = make(); el.b = node; ys = el.bot;
      if (el.type === 'sen') el.out = make();
      col.els.push(el); els.push(el);
    }
    const last = { col: c.id, x: c.x, ya: ys, yb: c.y1, node };
    if (last.yb < last.ya - EPS) throw new Error(`줄 끝보다 요소가 아래: ${c.id}`);
    col.segs.push(last); segs.push(last);
    if (Math.abs(c.y0) < EPS) union(col.segs[0].node, TOP);
    if (Math.abs(c.y1 - H) < EPS) union(last.node, BOT);
    cols.push(col);
  }
  const ghosts = [];
  for (const c of d.cols) for (const t of c.els) if (t[3].ghost) ghosts.push({ id: t[3].id, type: t[0], name: t[1], y: t[2], x: c.x, col: c.id, arrow: !!t[3].arrow, o: t[3] });

  const nodeAt = (x, y) => {
    for (const col of cols) {
      if (Math.abs(col.x - x) > EPS) continue;
      for (const sg of col.segs) if (y >= sg.ya - EPS && y <= sg.yb + EPS) return { node: sg.node, col, sg };
    }
    return null;
  };
  const links = [];
  for (const l of d.links) {
    let a, xa;
    if (l.sen) {
      const s = els.find(e => e.type === 'sen' && e.name === l.sen);
      if (!s) throw new Error('센서 없음 ' + l.sen);
      a = s.out; xa = s.x + SEN_DX;
      if (Math.abs(s.y - l.y) > EPS) throw new Error('센서 출력 높이 불일치 ' + l.sen);
    } else {
      const r = nodeAt(l.x1, l.y); if (!r) throw new Error(`연결선 시작점 없음 y=${l.y} x=${l.x1}`);
      a = r.node; xa = l.x1;
    }
    const rb = nodeAt(l.x2, l.y); if (!rb) throw new Error(`연결선 끝점 없음 y=${l.y} x=${l.x2}`);
    union(a, rb.node);
    const lo = Math.min(xa, l.x2), hi = Math.max(xa, l.x2);
    for (const col of cols) {   // 버스(가로선) 위에서 시작/끝나는 줄
      if (col.x < lo - EPS || col.x > hi + EPS) continue;
      if (Math.abs(col.y0 - l.y) < EPS) union(col.segs[0].node, a);
      if (Math.abs(col.y1 - l.y) < EPS) union(col.segs[col.segs.length - 1].node, a);
    }
    links.push({ y: l.y, x1: xa, x2: l.x2, node: a, sen: l.sen || null, added: l.added });
  }
  // 노드 정규화
  const N = parent.length;
  const root = new Array(N); for (let i = 0; i < N; i++) root[i] = find(i);
  for (const e of els) { e.a = root[e.a]; e.b = root[e.b]; if (e.out != null) e.out = root[e.out]; }
  for (const s of segs) s.node = root[s.node];
  for (const l of links) l.node = root[l.node];
  const top = root[TOP], bot = root[BOT];
  // 인접 리스트
  const adj = {};
  const push = (n, i) => { (adj[n] = adj[n] || []).push(i); };
  els.forEach((e, i) => { if (isContact(e.type)) { push(e.a, i); push(e.b, i); } else if (e.type === 'sen') push(e.a, i); });
  // 위쪽 요소 찾기 (진단용): 아래 단자가 n인 요소
  const above = {};
  els.forEach((e, i) => { if (isContact(e.type)) (above[e.b] = above[e.b] || []).push(i); if (e.type === 'sen') (above[e.out] = above[e.out] || []).push(i); });
  return { els, segs, cols, links, ghosts, top, bot, adj, above, nodeCount: N, def: d };
}

/* ---------------- 시뮬레이터 ---------------- */
function sensorMap(problem) {
  const m = {};
  for (const a of problem.acts) if (a.type === 'cyl') { m[a.sens[0]] = { act: a.id, end: 0 }; m[a.sens[1]] = { act: a.id, end: 1 }; }
  return m;
}

class Sim {
  constructor(problem, def, opt = {}) {
    this.P = problem;
    this.net = def && def.__net ? def.__net : buildNet(def);
    this.airM = def && def.__air ? def.__air : null;   // 배선 연습 공압 보드: 관 연결대로 실린더를 움직임
    this.smap = sensorMap(problem);
    this.opt = opt;
    this.reset();
  }
  reset() {
    const P = this.P;
    this.t = 0;
    this.pb = {};
    this.relays = {}; this.sols = {}; this.timers = {}; this.counters = {};
    for (const e of this.net.els) {
      if (e.type === 'coil') this.relays[e.name] = this.relays[e.name] || { on: false, want: false, timer: 0, toggles: [] };
      if (e.type === 'sol') this.sols[e.name] = false;
      if (e.type === 'pb' || e.type === 'pbnc') this.pb[e.name] = false;
      if (e.type === 'tmr') this.timers[e.name] = this.timers[e.name] || { want: false, run: false, acc: 0, offT: 0, done: false, pre: e.o.pre != null ? e.o.pre : (P.tsec || 3), off: !!e.o.off };
      if (e.type === 'cnt' || e.type === 'crst') this.counters[e.name] = this.counters[e.name] || { count: 0, pre: e.o.pre != null ? e.o.pre : (P.cpre || 3), done: false, inWant: false, in: false, inT: 0, rstWant: false, rst: false, rstT: 0 };
    }
    for (const e of this.net.els) if ((e.type === 'cnt' || e.type === 'crst') && e.o.pre != null) this.counters[e.name].pre = e.o.pre;
    // 접점만 있고 코일이 없는 릴레이도 상태 유지
    for (const e of this.net.els) if ((e.type === 'no' || e.type === 'nc') && !this.relays[e.name] && !this.timers[e.name] && !this.counters[e.name]) this.relays[e.name] = { on: false, want: false, timer: 0, toggles: [], noCoil: true };
    this.acts = {};
    for (const a of P.acts) {
      const init = a.type === 'cyl' ? P.seq.rows.find(r => r.id === a.id).pos[0] : 0;
      this.acts[a.id] = { pos: init, dir: 'stop', mem: a.valve.init || (init ? 'ext' : 'ret'), angle: 0, motion: 'stop', box: 0, endT: null };
      if (a.valve.kind === '52d' || a.valve.kind === '42d') this.acts[a.id].mem = a.valve.init || (init ? 'ext' : 'ret');
    }
    this.live = new Uint8Array(this.net.nodeCount);
    this.gnd = this.net.dual ? new Uint8Array(this.net.nodeCount) : null;
    this.short = false;
    this.events = [];
    this.motionEvents = [];
    this.lastChange = 0; this.lastMove = 0;
    this.osc = new Set();
    this.conflicts = new Set();
    this.prog = { p: 1, cycles: 0, state: 'idle', frac: 0, armedAt: null, armedBy: null, dev: null, startT: null };
    this.trace = [];
    this.timerDone = [];
    this.strokeDur = {};
    this.sensors = {};
    this.sense();
    // 전원 투입 직후 상태로 정리 (기록 없이)
    for (let it = 0; it < 40; it++) {
      this.clearWants();
      this.solve();
      let ch = false;
      for (const k in this.relays) { const r = this.relays[k]; if (!r.noCoil && r.on !== r.want) { r.on = r.want; ch = true; } }
      if (!ch) break;
    }
    for (const e of this.net.els) if (e.type === 'sol') this.sols[e.name] = this.sols[e.name] || this.pw(e);
    this.solEff = Object.assign({}, this.sols); this.solTimer = {};
    this.updateValves(true);
    this.conflicts.clear();
    this.events = [];
  }
  log(kind, name, val, text) { this.events.push({ t: this.t, kind, name, val, text }); if (this.events.length > 600) this.events.splice(0, 200); }

  sensorOn(name) {
    const s = this.smap[name]; if (!s) return false;
    const a = this.acts[s.act];
    return s.end === 0 ? a.pos <= 0.005 : a.pos >= 0.995;
  }
  sense() {
    if (!this.sensors) this.sensors = {};
    for (const n in this.smap) {
      const v = this.sensorOn(n);
      if (this.sensors[n] !== undefined && this.sensors[n] !== v) {
        const s = this.smap[n];
        this.log('sen', n, v, `${n} ${v ? 'ON' : 'OFF'} (${actName(this.P, s.act)} ${s.end ? '전진 끝' : '후진 끝'}${v ? ' 감지' : '에서 벗어남'})`);
        this.lastChange = this.t;
      }
      this.sensors[n] = v;
    }
  }
  /* 접점 이름 → 릴레이·타이머·카운터 상태 */
  dev(name) {
    const r = this.relays[name]; if (r) return !!r.on;
    const t = this.timers[name]; if (t) return !!t.done;
    const c = this.counters[name]; if (c) return !!c.done;
    return false;
  }
  devKind(name) { return this.timers[name] ? 'tmr' : this.counters[name] ? 'cnt' : 'relay'; }
  clearWants() {
    for (const k in this.relays) this.relays[k].want = false;
    for (const k in this.timers) this.timers[k].want = false;
    for (const k in this.counters) { this.counters[k].inWant = false; this.counters[k].rstWant = false; }
  }
  timing() { for (const k in this.timers) { const t = this.timers[k]; if (t.off ? t.run : (t.want && !t.done)) return true; } return false; }
  /* 부하에 전원이 걸렸는지: +쪽 통전 (배선 연습에서는 −쪽이 0V로 이어졌는지도 봄) */
  pw(e) { return !!this.live[e.a] && (!this.gnd || !!this.gnd[e.b]); }
  closed(e) {
    switch (e.type) {
      case 'pb': return !!this.pb[e.name];
      case 'pbnc': return !this.pb[e.name];
      case 'no': return this.dev(e.name);
      case 'nc': return !this.dev(e.name);
      case 'lsno': return !!this.sensors[e.name];
      case 'lsnc': return !this.sensors[e.name];
    }
    return false;
  }
  solve() {
    const net = this.net, live = this.live, gnd = this.gnd;
    live.fill(0);
    if (gnd) {
      // 배선 연습: 0V 쪽에서 닫힌 접점을 따라 이어진 노드
      gnd.fill(0);
      const qg = [net.bot]; gnd[net.bot] = 1;
      while (qg.length) {
        const n = qg.pop();
        for (const i of net.adj[n] || []) {
          const e = net.els[i];
          if (!isContact(e.type) || !this.closed(e)) continue;
          const o = e.a === n ? e.b : e.a;
          if (!gnd[o]) { gnd[o] = 1; qg.push(o); }
        }
      }
    }
    const q = [net.top]; live[net.top] = 1;
    let short = false;
    while (q.length) {
      const n = q.pop();
      const list = net.adj[n]; if (!list) continue;
      for (const i of list) {
        const e = net.els[i];
        if (e.type === 'sen') {
          if (n === e.a && this.sensors[e.name] && (!gnd || gnd[e.b]) && !live[e.out]) { live[e.out] = 1; q.push(e.out); }
          continue;
        }
        if (!this.closed(e)) continue;
        const o = e.a === n ? e.b : e.a;
        if (!live[o]) { live[o] = 1; q.push(o); }
      }
    }
    if (live[net.bot]) short = true;
    this.short = short;
    if (short) live.fill(0);
    for (const e of net.els) {
      if (e.type === 'coil') { const r = this.relays[e.name]; r.want = r.want || this.pw(e); }
      else if (e.type === 'tmr') { const t = this.timers[e.name]; t.want = t.want || this.pw(e); }
      else if (e.type === 'cnt') { const c = this.counters[e.name]; c.inWant = c.inWant || this.pw(e); }
      else if (e.type === 'crst') { const c = this.counters[e.name]; c.rstWant = c.rstWant || this.pw(e); }
    }
    return live;
  }
  /* 한 번의 기본 간격 진행 */
  tick(dt) {
    this.t += dt;
    this.sense();
    // 1) 회로 풀기
    this.clearWants();
    this.solve();
    // 2) 솔레노이드
    const solNow = {};
    for (const e of this.net.els) if (e.type === 'sol') solNow[e.name] = solNow[e.name] || this.pw(e);
    for (const k in solNow) if (solNow[k] !== this.sols[k]) {
      this.sols[k] = solNow[k]; this.lastChange = this.t;
      this.log('sol', k, solNow[k], `${k} ${solNow[k] ? 'ON' : 'OFF'}`);
    }
    // 2-1) 밸브가 실제로 받는 솔레노이드 상태 (전환 시간)
    for (const k in this.sols) {
      if (this.sols[k] !== this.solEff[k]) { this.solTimer[k] = (this.solTimer[k] || 0) + dt; if (this.solTimer[k] >= VALVE_DELAY - 1e-9) { this.solEff[k] = this.sols[k]; this.solTimer[k] = 0; } }
      else this.solTimer[k] = 0;
    }
    // 3) 릴레이 (지연)
    for (const k in this.relays) {
      const r = this.relays[k];
      if (r.noCoil) continue;
      if (r.want !== r.on) {
        r.timer += dt;
        if (r.timer >= RELAY_DELAY - 1e-9) {
          r.on = r.want; r.timer = 0; this.lastChange = this.t;
          r.toggles.push(this.t);
          while (r.toggles.length && r.toggles[0] < this.t - 0.4) r.toggles.shift();
          if (r.toggles.length > 14) { if (!this.osc.has(k)) { this.osc.add(k); this.log('warn', k, true, `${k} 발진 — 붙었다 떨어졌다를 반복해요`); } }
          if (!this.osc.has(k)) this.log('relay', k, r.on, `${k} ${r.on ? '여자' : '소자'}`);
        }
      } else r.timer = 0;
    }
    // 3-1) 타이머 (온 딜레이)
    for (const k in this.timers) {
      const t = this.timers[k];
      if (t.off) {   // 오프 딜레이: 켜지면 바로 접점 동작, 꺼진 뒤 설정 시간이 지나면 복귀
        if (t.want) { t.run = false; t.acc = 0; if (!t.done) { t.done = true; this.lastChange = this.t; this.log('tmr', k, true, `${k} 코일 ON → 접점 바로 동작 (OFF 딜레이)`); } }
        else if (t.done) {
          if (!t.run) { t.run = true; t.acc = 0; this.log('tmr', k, true, `${k} 코일 OFF → ${t.pre}초 뒤 복귀`); }
          t.acc += dt;
          if (t.acc >= t.pre - 1e-9) { t.done = false; t.run = false; t.acc = 0; this.lastChange = this.t; this.log('tmr', k, false, `${k} ${t.pre}초 경과 → 접점 복귀`); }
        }
        continue;
      }
      if (t.want) {
        t.offT = 0;
        if (!t.run) { t.run = true; t.acc = 0; this.lastChange = this.t; this.log('tmr', k, true, `${k} 타이머 시작 (${t.pre}초)`); }
        t.acc += dt;
        if (!t.done && t.acc >= t.pre - 1e-9) { t.done = true; this.lastChange = this.t; this.timerDone.push(this.t); if (this.timerDone.length > 200) this.timerDone.shift(); this.log('tmr', k, true, `${k} ${t.pre}초 경과 → 접점 동작`); }
      } else if (t.run) {
        t.offT += dt;
        if (t.offT >= RELAY_DELAY - 1e-9) { t.run = false; t.offT = 0; t.acc = 0; if (t.done) { t.done = false; this.lastChange = this.t; } this.log('tmr', k, false, `${k} 타이머 복귀`); }
      }
    }
    // 3-2) 카운터 (입력 코일이 켜질 때마다 1씩, 리셋 코일이 켜지면 0)
    for (const k in this.counters) {
      const c = this.counters[k];
      if (c.rstWant !== c.rst) { c.rstT += dt; if (c.rstT >= RELAY_DELAY - 1e-9) { c.rst = c.rstWant; c.rstT = 0; if (c.rst) { c.count = 0; c.done = false; this.lastChange = this.t; this.log('cnt', k, false, `${k} 카운터 리셋 → 0/${c.pre}`); } } } else c.rstT = 0;
      if (c.inWant !== c.in) {
        c.inT += dt;
        if (c.inT >= RELAY_DELAY - 1e-9) {
          c.in = c.inWant; c.inT = 0;
          if (c.in && !c.rst) {
            c.count++; this.lastChange = this.t;
            this.log('cnt', k, true, `${k} 카운트 ${c.count}/${c.pre}`);
            if (!c.done && c.count >= c.pre) { c.done = true; this.log('cnt', k, true, `${k} ${c.pre}회 도달 → 접점 동작`); }
          }
        }
      } else c.inT = 0;
    }
    if (this.timing()) this.lastChange = this.t;
    // 4) 밸브·액추에이터
    this.updateValves(false);
    this.moveActs(dt);
    this.track(dt);
  }
  updateValves(init) {
    for (const a of this.P.acts) {
      const st = this.acts[a.id], v = a.valve, S = this.solEff || this.sols;
      let dir = 'stop', box = v.home || 0, conflict = false;
      const on = n => !!S[n];
      if (v.kind === '52s' || v.kind === '42s') {
        const o = on(v.sol); dir = o ? v.onDir : v.offDir; box = o ? v.onBox : v.home;
      } else if (v.kind === '52d' || v.kind === '42d') {
        const l = on(v.l), r = on(v.r);
        if (l && !r) st.mem = v.lDir; else if (r && !l) st.mem = v.rDir; else if (l && r) conflict = true;
        dir = st.mem; box = st.mem === v.lDir ? v.lBox : v.rBox;
      } else if (v.kind === '43') {
        const l = on(v.l), r = on(v.r);
        if (l && !r) { dir = v.lDir; box = v.lBox; } else if (r && !l) { dir = v.rDir; box = v.rBox; } else { dir = 'stop'; box = v.home; if (l && r) conflict = true; }
      } else if (v.kind === '22') {
        const o = on(v.sol); dir = o ? v.onDir : 'stop'; box = o ? v.onBox : v.home;
      }
      st.box = box;
      st.supplyOpen = true;
      if (a.supply) { st.supplyOpen = on(a.supply.sol); st.supplyBox = st.supplyOpen ? a.supply.onBox : a.supply.home; if (!st.supplyOpen) dir = 'stop'; }
      st.cmd = dir;
      // 릴레이 지연(수 ms) 동안 잠깐 겹치는 것은 무시, 0.05 s 넘게 계속되면 경고
      st.conflictT = conflict ? (st.conflictT || 0) + (init ? 0 : SUB) : 0;
      st.conflict = st.conflictT > 0.05;
      const key = a.id;
      if (st.conflict) { if (!this.conflicts.has(key)) { this.conflicts.add(key); this.log('warn', key, true, `${actName(this.P, a.id)} 밸브 양쪽 솔레노이드가 동시에 ON`); } }
      else this.conflicts.delete(key);
    }
    if (this.airM) this.airM.apply(this);
  }
  moveActs(dt) {
    for (const a of this.P.acts) {
      const st = this.acts[a.id];
      let motion = 'stop';
      if (a.type === 'cyl') {
        const base = a.stroke || this.P.stroke || 1.2;
        // 배선 연습 유압 보드: 속도는 꽂은 유량제어 기기대로 (st.tOv), 아니면 문제 정의대로
        const tE = st.tOv ? (st.tOv.ext || base) : (a.tExt || base), tR = st.tOv ? (st.tOv.ret || base) : (a.tRet || base);
        if (st.cmd === 'ext' && st.pos < 1) { st.pos = Math.min(1, st.pos + dt / tE); motion = 'ext'; }
        else if (st.cmd === 'ret' && st.pos > 0) { st.pos = Math.max(0, st.pos - dt / tR); motion = 'ret'; }
        else if (st.pos > 0 && st.pos < 0.01) st.pos = 0;          // 끝 바로 앞에서 멈추면 끝으로 정리
        else if (st.pos < 1 && st.pos > 0.99) st.pos = 1;
      } else {
        const w = 540 * (st.tOv ? (st.tOv.sp || 1) : (a.speed || 1));
        if (st.cmd === 'cw') { st.angle += dt * w; motion = 'cw'; }
        else if (st.cmd === 'ccw') { st.angle -= dt * w; motion = 'ccw'; }
      }
      if (motion !== 'stop') this.lastMove = this.t;
      if (motion !== st.motion) {
        const prev = st.motion; st.motion = motion; this.lastChange = this.t;
        const nm = actName(this.P, a.id);
        if (a.type === 'cyl') {
          if (motion === 'stop') {
            if (st.pos > 0.99) st.pos = 1; if (st.pos < 0.01) st.pos = 0;
            if (st.mStart != null && st.mFrom != null && Math.abs(st.pos - st.mFrom) > 0.99) this.strokeDur[a.id + prev] = this.t - st.mStart;
            const end = st.pos >= 1 ? '전진 완료' : st.pos <= 0 ? '후진 완료' : '중간에서 정지';
            this.log('act', a.id, motion, `${nm} ${end}`);
            if (end === '중간에서 정지') this.motionEvents.push({ t: this.t, id: a.id, m: 'stop' });
          } else {
            st.mStart = this.t; st.mFrom = st.pos;
            this.log('act', a.id, motion, `${nm} ${motion === 'ext' ? '전진' : '후진'} 시작`);
            this.motionEvents.push({ t: this.t, id: a.id, m: motion });
          }
        } else {
          this.log('act', a.id, motion, `${nm} ${motion === 'cw' ? '정회전(CW)' : motion === 'ccw' ? '역회전(CCW)' : '정지'}`);
          this.motionEvents.push({ t: this.t, id: a.id, m: motion });
        }
      }
    }
  }
  press(name, v) {
    if (this.pb[name] === v) return;
    this.pb[name] = v; this.lastChange = this.t;
    this.log('pb', name, v, `${name} ${v ? 'ON (누름)' : 'OFF (뗌)'}`);
    if (v && START_PB.includes(name) && this.prog.state !== 'run') {
      if (this.prog.state !== 'dev') { this.prog.state = 'armed'; this.prog.armedAt = this.t; this.prog.armedBy = name; }
    }
  }
  /* 변위단계선도 진행 추적 */
  expect(p) { return expectInterval(this.P, p); }
  track() {
    const pr = this.prog, P = this.P, n = P.seq.n;
    const anyMoving = P.acts.some(a => this.acts[a.id].motion !== 'stop');
    const ex0 = this.expect(pr.p);
    const cylMoving = P.acts.some(a => a.type === 'cyl' && this.acts[a.id].motion !== 'stop' && !this.settling(a.id, ex0));
    if (pr.state === 'dev') { this.pushTrace(); return; }
    if (((pr.state === 'idle' || pr.state === 'done' || pr.state === 'stall') && cylMoving) || (pr.state === 'armed' && anyMoving)) {
      if (pr.state !== 'stall') pr.startT = this.t;
      pr.state = 'run';
    }
    if (pr.state === 'run') {
      const ex = this.expect(pr.p);
      // 이탈 검사
      for (const a of P.acts) {
        const st = this.acts[a.id], want = ex.move[a.id] || 'stop';
        if (a.type === 'cyl') {
          // 유지해야 할 실린더가 끝까지 마저 가는 움직임(앞 구간의 마무리)은 허용
          if (st.motion !== 'stop' && st.motion !== want && !this.settling(a.id, ex)) {
            // 다음 구간 동작이 미리 시작된 경우 허용하지 않음
            pr.state = 'dev';
            pr.dev = { p: pr.p, act: a.id, got: st.motion, want };
            this.log('warn', a.id, true, `선도와 다름: ${pr.p}→${pr.p + 1}단계에서 ${actName(P, a.id)}가 ${st.motion === 'ext' ? '전진' : '후진'}`);
            this.pushTrace(); return;
          }
        } else {
          const w = ex.run[a.id] || 'stop';
          if (st.motion !== w) { st.badT = (st.badT || 0) + SUB; if (st.badT > 0.2) { pr.state = 'dev'; pr.dev = { p: pr.p, act: a.id, got: st.motion, want: w }; this.log('warn', a.id, true, `선도와 다름: ${pr.p}→${pr.p + 1}단계에서 ${actName(P, a.id)} ${motorWord(st.motion)} (선도: ${motorWord(w)})`); this.pushTrace(); return; } }
          else st.badT = 0;
        }
      }
      // 완료 검사
      let done = true, sum = 0, cnt = 0;
      for (const id in ex.target) {
        const a = this.acts[id], from = ex.from[id], to = ex.target[id];
        const f = Math.max(0, Math.min(1, (a.pos - from) / (to - from)));
        sum += f; cnt++;
        if (Math.abs(a.pos - to) > 0.006) done = false;
      }
      pr.frac = cnt ? sum / cnt : 0;
      if (done) {
        pr.p++; pr.frac = 0;
        if (pr.p >= n) { pr.cycles++; pr.p = 1; pr.state = 'done'; this.log('ok', 'cycle', pr.cycles, `변위단계선도대로 1사이클 완료 (${pr.cycles}회째)`); }
      } else if (!cylMoving && !this.timing() && this.t - Math.max(this.lastChange, this.lastMove || 0) > 1.0) {
        pr.state = 'stall'; this.log('warn', 'stall', true, `${pr.p}단계에서 멈춤 — 다음 동작이 일어나지 않아요`);
      }
    } else if (pr.state === 'armed') {
      const by = pr.armedBy || 'PB1';
      if (this.t - Math.max(this.lastChange, this.lastMove || 0) > 1.2 && !anyMoving && !this.timing() && !this.pb[by]) { pr.state = 'stall'; this.log('warn', 'stall', true, `${by}을 눌렀지만 1단계 동작이 시작되지 않아요`); }
    }
    this.pushTrace();
  }
  /* 앞 구간에서 끝까지 마저 가는 중인지 (경계 값 근처에서 그쪽으로 움직임) */
  settling(id, ex) {
    const st = this.acts[id], prev = id in ex.from ? ex.from[id] : ex.hold[id];
    if (prev === undefined || st.motion === 'stop') return false;
    if (Math.abs(st.pos - prev) > 0.012) return false;
    return (prev === 1 && st.motion === 'ext') || (prev === 0 && st.motion === 'ret');
  }
  pushTrace() {
    const pr = this.prog;
    if (pr.state === 'idle' || pr.state === 'armed') return;
    const x = pr.p + (pr.state === 'run' ? pr.frac : 0);
    const last = this.trace[this.trace.length - 1];
    const pt = { x, t: this.t, pos: {}, dev: pr.state === 'dev' };
    for (const a of this.P.acts) pt.pos[a.id] = a.type === 'cyl' ? this.acts[a.id].pos : (this.acts[a.id].motion === 'cw' ? 1 : this.acts[a.id].motion === 'ccw' ? -1 : 0);
    if (last && Math.abs(last.x - x) < 0.004 && this.P.acts.every(a => Math.abs(last.pos[a.id] - pt.pos[a.id]) < 0.004)) return;
    this.trace.push(pt);
    if (this.trace.length > 4000) this.trace.splice(0, 1000);
  }
  advance(sec, stopOnEvent) {
    let n = Math.round(sec / SUB);
    const e0 = this.events.length;
    for (let i = 0; i < n; i++) {
      this.tick(SUB);
      if (stopOnEvent && this.events.length > e0) {
        // 같은 순간에 이어지는 변화까지 마저 반영 (릴레이 지연 이내)
        for (let k = 0; k < Math.round(RELAY_DELAY / SUB) + 1; k++) this.tick(SUB);
        return true;
      }
    }
    return false;
  }
  /* 진단: 지금 단계에서 움직여야 할 액추에이터와, 필요한 솔레노이드 상태 */
  diagnose() {
    const P = this.P, pr = this.prog;
    const ex = this.expect(pr.p);
    const out = [];
    // PB1을 누른 상태를 가정하고 살펴봄 (시작이 안 되는 경우를 찾기 위해)
    const pb0 = Object.assign({}, this.pb);
    const atStart = pr.p === 1 && (pr.state === 'stall' || pr.state === 'armed' || pr.state === 'idle');
    if (atStart) this.pb[pr.armedBy || 'PB1'] = true;
    this.clearWants();
    this.solve();
    for (const a of P.acts) {
      const want = a.type === 'cyl' ? ex.move[a.id] : ex.run[a.id];
      if (!want || want === 'stop') continue;
      const st = this.acts[a.id];
      if (a.type === 'cyl' && Math.abs(st.pos - ex.target[a.id]) <= 0.006) continue;
      if (a.type !== 'cyl' && st.motion === want) continue;
      const needs = solNeeds(a, want);
      const bad = needs.filter(n => !!this.sols[n.sol] !== n.on);
      out.push({ act: a.id, want, bad: bad.map(b => ({ sol: b.sol, need: b.on, chain: b.on ? this.whyOff(b.sol, 'sol', 0, new Set()) : this.whyOn(b.sol) })) });
    }
    this.pb = pb0;
    this.clearWants();
    this.solve();
    return out;
  }
  loadEl(name, type) { return this.net.els.find(e => e.type === type && e.name === name); }
  /* 부하(코일/솔레노이드)가 꺼져 있는 이유: 위쪽으로 올라가며 열린 접점(위쪽은 통전) 찾기 */
  whyOff(name, type, depth, seen) {
    const el = this.loadEl(name, type); if (!el) return [];
    if (seen.has(type + name)) return []; seen.add(type + name);
    let front = this.frontier(el.a);
    // 코일 자신의 자기유지 접점은 다른 원인이 있으면 생략
    if (type === 'coil') {
      const others = front.filter(e => !(e.type === 'no' && e.name === name));
      if (others.length) front = others;
    }
    const items = [];
    for (const e of front) {
      const it = { el: e.id, name: e.name, type: e.type, reason: '' };
      if (e.type === 'pb') it.reason = `${e.name} 누르지 않음`;
      else if (e.type === 'lsno') it.reason = `a접점 열림 — ${sensorWhere(this.P, this.smap, e.name)}에 있을 때만 닫혀요`;
      else if (e.type === 'lsnc') it.reason = `b접점 열림 — ${sensorWhere(this.P, this.smap, e.name)}에서 눌려 있어요`;
      else if (e.type === 'no' && this.timers[e.name]) {
        const tm = this.timers[e.name];
        if (tm.want) it.reason = `타이머 ${e.name} 시간 재는 중 (${tm.acc.toFixed(1)}/${tm.pre}초) — 다 되면 a접점이 닫혀요`;
        else { it.reason = `타이머 ${e.name} 코일 꺼짐 → a접점 열림`; if (depth < 3) { const sub = this.whyOff(e.name, 'tmr', depth + 1, seen); if (sub.length) it.sub = sub; } }
      }
      else if (e.type === 'no' && this.counters[e.name]) it.reason = `카운터 ${e.name} 아직 ${this.counters[e.name].count}/${this.counters[e.name].pre}회 → a접점 열림`;
      else if (e.type === 'nc' && this.counters[e.name]) it.reason = `카운터 ${e.name} ${this.counters[e.name].pre}회 다 셈 → b접점 열림 (PB3로 리셋)`;
      else if (e.type === 'nc' && this.timers[e.name]) it.reason = `타이머 ${e.name} 시간 다 됨 → b접점 열림`;
      else if (e.type === 'no') {
        if (type === 'coil' && e.name === name) it.reason = `${name} 코일이 자기 자신의 a접점 아래에 있어서 처음부터 켜질 수 없어요`;
        else { it.reason = `코일 꺼짐 → a접점 열림`; if (depth < 3) { const sub = this.whyOff(e.name, 'coil', depth + 1, seen); if (sub.length) it.sub = sub; } }
      }
      else if (e.type === 'nc') it.reason = `코일 켜짐 → b접점 열림`;
      else if (e.type === 'sen') it.reason = `센서 출력 없음 — ${sensorWhere(this.P, this.smap, e.name)}를 감지할 때만 나와요`;
      items.push(it);
    }
    return items;
  }
  whyOn(name) {
    const el = this.loadEl(name, 'sol'); if (!el) return [];
    return [{ el: el.id, name, type: 'sol', reason: `${name} 회로가 계속 연결되어 있어서 꺼지지 않음`, closedPath: this.upstream(el.a).filter(e => isContact(e.type) && this.closed(e)).map(e => e.id) }];
  }
  upstream(node) {
    const net = this.net, seen = new Set(), res = [];
    const st = [node];
    while (st.length) {
      const n = st.pop(); if (seen.has(n) || n === net.top) continue; seen.add(n);
      for (const i of net.above[n] || []) { const e = net.els[i]; res.push(e); st.push(e.a); }
    }
    return res;
  }
  frontier(node) {
    // 위쪽 경로에서 '윗단은 통전, 아랫단은 비통전'인 열린 요소
    const ups = this.upstream(node);
    return ups.filter(e => {
      if (e.type === 'sen') return this.live[e.a] && !this.live[e.out];
      return isContact(e.type) && !this.closed(e) && this.live[e.a] && !this.live[e.b];
    });
  }
}

function motorWord(m) { return m === 'cw' ? '정회전' : m === 'ccw' ? '역회전' : '정지'; }
function actName(P, id) { const a = P.acts.find(a => a.id === id); return (a.type === 'cyl' ? '실린더 ' : '모터 ') + id; }
function sensorWhere(P, smap, n) { const s = smap[n]; if (!s) return '?'; return `실린더 ${s.act} ${s.end ? '전진 끝' : '후진 끝'}`; }

/* 구간 p→p+1 의 기대 동작 */
function expectInterval(P, p) {
  const rows = P.seq.rows, move = {}, run = {}, target = {}, from = {}, hold = {};
  for (const r of rows) {
    if (r.type === 'cyl') {
      const a = r.pos[p - 1], b = r.pos[p];
      if (b === undefined) continue;
      if (a !== b) { move[r.id] = b > a ? 'ext' : 'ret'; target[r.id] = b; from[r.id] = a; }
      else { move[r.id] = 'stop'; hold[r.id] = a; }
    } else {
      const v = r.run[p - 1];
      run[r.id] = v === 1 ? 'cw' : v === -1 ? 'ccw' : 'stop';
    }
  }
  return { move, run, target, from, hold };
}
/* 기대 동작 그룹(검증용): 각 경계에서 바뀌는 동작 */
function expectedGroups(P) {
  const n = P.seq.n, groups = [];
  const prevRun = {};
  for (const r of P.seq.rows) if (r.type !== 'cyl') prevRun[r.id] = 'stop';
  for (let p = 1; p < n; p++) {
    const ex = expectInterval(P, p), g = {};
    for (const id in ex.move) if (ex.move[id] !== 'stop') g[id] = ex.move[id];
    for (const id in ex.run) if (ex.run[id] !== prevRun[id]) { g[id] = ex.run[id]; prevRun[id] = ex.run[id]; }
    groups.push(g);
  }
  const fin = {};
  for (const id in prevRun) if (prevRun[id] !== 'stop') fin[id] = 'stop';
  if (Object.keys(fin).length) groups.push(fin);
  return groups;
}

/* 밸브 → 원하는 방향에 필요한 솔레노이드 상태 */
function solNeeds(a, want) {
  const v = a.valve, out = [];
  if (a.supply && want !== 'stop') out.push({ sol: a.supply.sol, on: true });
  if (v.kind === '52s' || v.kind === '42s') out.push({ sol: v.sol, on: want === v.onDir });
  else if (v.kind === '52d' || v.kind === '42d' || v.kind === '43') {
    if (want === v.lDir) { out.push({ sol: v.l, on: true }); out.push({ sol: v.r, on: false }); }
    else if (want === v.rDir) { out.push({ sol: v.r, on: true }); out.push({ sol: v.l, on: false }); }
  } else if (v.kind === '22') out.push({ sol: v.sol, on: want !== 'stop' });
  return out;
}

/* 머리 없는(헤드리스) 동작 확인: PB1 → 사이클 완료를 n회 */
function runCheck(P, def, opt = {}) {
  const cycles = opt.cycles || 2, timeout = opt.timeout || 30;
  const sim = new Sim(P, def);
  const groupsExp = expectedGroups(P);
  const res = { ok: false, cycles: 0, msg: '', sim };
  for (let c = 0; c < cycles; c++) {
    sim.press('PB1', true); sim.advance(0.15); sim.press('PB1', false);
    const t0 = sim.t;
    while (sim.t - t0 < timeout) {
      sim.advance(0.05);
      const st = sim.prog.state;
      if (st === 'dev' || st === 'stall') break;
      if (sim.prog.cycles > c && st === 'done') { sim.advance(0.6); break; }
    }
    if (sim.prog.cycles <= c) break;
  }
  res.cycles = sim.prog.cycles;
  // 동작 순서 비교
  const ev = sim.motionEvents.slice();
  const groups = [];
  for (const e of ev) {
    const g = groups[groups.length - 1];
    if (g && e.t - g.t < 0.06 && !(e.id in g.m)) { g.m[e.id] = e.m; }
    else groups.push({ t: e.t, m: { [e.id]: e.m } });
  }
  const exp = []; for (let c = 0; c < cycles; c++) exp.push(...groupsExp);
  const same = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every(k => a[k] === b[k]); };
  let seqOk = groups.length === exp.length && groups.every((g, i) => same(g.m, exp[i]));
  res.groups = groups.map(g => g.m); res.expected = exp;
  res.osc = [...sim.osc]; res.conflicts = [...sim.conflicts]; res.short = sim.short;
  const back = P.acts.every(a => a.type !== 'cyl' || Math.abs(sim.acts[a.id].pos - P.seq.rows.find(r => r.id === a.id).pos[0]) < 0.001);
  res.ok = seqOk && sim.prog.cycles >= cycles && back && !res.osc.length && !sim.short;
  res.state = sim.prog.state; res.p = sim.prog.p; res.dev = sim.prog.dev;
  return res;
}

/* 응용: 타이머로 늦춰지는 동작은 같은 단계의 다른 동작과 따로 묶음 */
function appGroups(P) {
  const g = expectedGroups(P).map(x => Object.assign({}, x));
  const d = P.app && P.app.delay;
  if (!d) return g;
  const out = [];
  for (const grp of g) {
    if (grp[d.act] === d.dir && Object.keys(grp).length > 1) {
      const rest = Object.assign({}, grp); delete rest[d.act];
      out.push(rest); out.push({ [d.act]: d.dir });
    } else out.push(grp);
  }
  return out;
}
function groupMotions(ev) {
  const groups = [];
  for (const e of ev) {
    const g = groups[groups.length - 1];
    if (g && e.t - g.t < 0.06 && !(e.id in g.m)) g.m[e.id] = e.m;
    else groups.push({ t: e.t, m: { [e.id]: e.m } });
  }
  return groups;
}
/* 응용 동작 자동 확인: PB1 1회(카운트 안 됨) → PB2 3회 연속 → 리셋 전 PB2 무반응 → PB3 리셋 → PB2 다시 3회 */
function runAppCheck(P, def, opt = {}) {
  const sim = new Sim(P, def);
  const res = { ok: true, steps: [], sim };
  const add = (ok, text) => { res.steps.push({ ok: !!ok, text }); if (!ok) res.ok = false; };
  // opt.cpre === null: 문제(응용)에 카운터가 없음 — 배선판의 카운터 유닛은 전원만 들어가 있어도 무시
  const ck = Object.keys(sim.counters)[0], c = ck && opt.cpre !== null ? sim.counters[ck] : null;
  const pressPB = name => { sim.press(name, true); sim.advance(0.15); sim.press(name, false); };
  const runUntilIdle = (maxSec, quiet) => {
    const t0 = sim.t; let busy = sim.t;
    while (sim.t - t0 < maxSec) {
      sim.advance(0.05);
      if (P.acts.some(a => sim.acts[a.id].motion !== 'stop') || sim.timing()) busy = sim.t;
      if (sim.t - busy > quiet || sim.prog.state === 'dev') break;
    }
  };
  let cyc = sim.prog.cycles, total = 0;
  // 배선 연습: 문제의 카운터·타이머 설정값 (실물 설정값이 틀렸는지도 봄)
  const needC = opt.cpre != null ? opt.cpre : (c ? c.pre : null);
  if (opt.cpre != null && !c) { add(false, '카운터가 동작하지 않아요 — 카운터 유닛 버스 전원과 Count Input 배선을 확인하세요'); return res; }
  pressPB('PB1'); runUntilIdle(60, 1.6);
  total += sim.prog.cycles - cyc;
  add(sim.prog.cycles - cyc === 1 && (!c || c.count === 0), `PB1 → 기본동작 ${sim.prog.cycles - cyc}회` + (c ? ` · 카운터 ${c.count}/${c.pre} (세지 않음)` : ''));
  if (!c) {
    cyc = sim.prog.cycles; pressPB('PB1'); runUntilIdle(60, 1.6); total += sim.prog.cycles - cyc;
    add(sim.prog.cycles - cyc === 1, `PB1 → 한 번 더 동작 (2회째)`);
  } else {
    cyc = sim.prog.cycles; pressPB('PB2'); runUntilIdle(160, 2.6);
    const n1 = sim.prog.cycles - cyc; total += n1;
    add(n1 === needC && c.done, `PB2 → ${n1}회 연속 동작 후 정지 · 카운터 ${c.count}/${c.pre}` + (needC !== c.pre ? ` (문제: ${needC}회)` : ''));
    const ev0 = sim.motionEvents.length;
    pressPB('PB2'); sim.advance(3);
    add(sim.motionEvents.length === ev0, `리셋 전 PB2 → ${sim.motionEvents.length === ev0 ? '움직이지 않음' : '움직임'}`);
    pressPB('PB3'); sim.advance(0.3);
    add(c.count === 0 && !c.done, `PB3 → 카운터 리셋 ${c.count}/${c.pre}`);
    cyc = sim.prog.cycles; pressPB('PB2'); runUntilIdle(160, 2.6);
    const n2 = sim.prog.cycles - cyc; total += n2;
    add(n2 === needC, `리셋 후 PB2 → 다시 ${n2}회 연속 동작`);
  }
  // 동작 순서 (선도와 같은지)
  const groups = groupMotions(sim.motionEvents);
  const unit = appGroups(P), exp = [];
  for (let i = 0; i < total; i++) exp.push(...unit);
  const same = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every(k => a[k] === b[k]); };
  const seqOk = groups.length === exp.length && groups.every((g, i) => same(g.m, exp[i]));
  add(seqOk && sim.prog.state !== 'dev', seqOk ? `동작 순서: 변위단계선도와 같음 (${total}사이클)` : `동작 순서가 선도와 다름`);
  // 타이머: 늦춰진 동작은 타이머 시간이 다 된 직후에만 시작
  const d = P.app && P.app.delay;
  if (d) {
    const starts = sim.motionEvents.filter(e => e.id === d.act && e.m === d.dir).map(e => e.t);
    const dones = sim.timerDone;
    const okT = starts.length > 0 && starts.every(t => dones.some(x => x <= t + 1e-9 && t - x < 0.1));
    const tk = sim.timers.T1 ? 'T1' : Object.keys(sim.timers)[0], tp = tk ? sim.timers[tk].pre : null;
    const okP = opt.tpre == null || (tp != null && Math.abs(tp - opt.tpre) < 1e-6);
    if (tp == null) add(false, `${actName(P, d.act)} ${d.dir === 'ext' ? '전진' : '후진'}: 타이머가 동작하지 않아요 — 타이머 유닛 버스 전원과 A1·A2 배선을 확인하세요`);
    else add(okT && okP, `${actName(P, d.act)} ${d.dir === 'ext' ? '전진' : '후진'}: 타이머 ${+tp.toFixed(1)}초 뒤 시작` + (okP ? '' : ` (문제: ${opt.tpre}초)`));
  }
  // 속도 확인 (유압 응용)
  for (const a of P.acts) for (const [dir, key] of [['ext', 'tExt'], ['ret', 'tRet']]) {
    if (!a[key]) continue;
    const dur = sim.strokeDur[a.id + dir];
    const ex = a[key + 'Ex'];
    add(dur && Math.abs(dur - a[key]) < 0.1, `${actName(P, a.id)} ${dir === 'ext' ? '전진' : '후진'} ${dur ? dur.toFixed(1) : '?'}초 ` + (ex ? `(예시: 기본 ${(a.stroke || P.stroke || 1.2).toFixed(1)}초보다 느리게)` : `(목표 ${a[key]}초)`));
  }
  for (const a of P.acts) if (a.type !== 'cyl' && a.speed) add(true, `${actName(P, a.id)} 회전속도 ${Math.round(a.speed * 100)}% (유량 조정)`);
  const back = P.acts.every(a => a.type !== 'cyl' || Math.abs(sim.acts[a.id].pos - P.seq.rows.find(r => r.id === a.id).pos[0]) < 0.001);
  add(back && !sim.osc.size && !sim.short && !sim.conflicts.size, back && !sim.osc.size && !sim.short && !sim.conflicts.size ? '초기 위치로 복귀 · 발진·단락·솔레노이드 겹침 없음' : '복귀/발진/단락/겹침 문제');
  res.groups = groups.map(g => g.m); res.expected = exp;
  return res;
}

const API = { H, ELH, SEN_DX, SUB, START_PB, isContact, isLoad, normalizeDef, applyPatches, errorTargets, buildNet, Sim, runCheck, runAppCheck, appGroups, expectedGroups, expectInterval, solNeeds, actName, motorWord };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
root.HSIM = Object.assign(root.HSIM || {}, API);
})(typeof window !== 'undefined' ? window : globalThis);
