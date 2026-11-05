/* 배선 연습 — 실습장 공압 트레이너(ED-7850) 단자 모델
   · 단자(잭) 배치와 내부 연결(버스)
   · 꽂은 선 → 넷리스트 → 시뮬레이터(Sim)로 그대로 돌리기
   · 도면(래더)과 비교해 틀린 곳을 단자 번호로 알려주기
   · 모범 배선 자동 생성
   브라우저와 Node 테스트에서 같이 씀 */
(function (root) {
'use strict';
const E = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined') ? require('./engine.js') : root.HSIM;

const CIRC = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];
const num = s => parseInt(String(s).replace(/\D+/g, ''), 10) || 0;
const byNum = (a, b) => num(a) - num(b) || (a < b ? -1 : a > b ? 1 : 0);
const CONTACT = new Set(['no', 'nc', 'pb', 'pbnc', 'lsno', 'lsnc']);
const LOAD = new Set(['coil', 'sol', 'tmr', 'cnt', 'crst']);
const isA = t => t === 'no' || t === 'pb' || t === 'lsno';

/* ---------------- 치수 ---------------- */
const MH = 320, BUS_T = 24, BUS_B = MH - 22, GAP = 12, MAXW = 1130, PAD = 12;
const W_PS = 150, W_SW = 196, W_RU = 222, W_CNT = 172, W_TMR = 210, W_LMP = 182;
const ROW0 = 62, ROWH = 78;                 // 스위치·릴레이 유닛의 첫 줄 위치와 줄 간격
const PB_SLOT = { PB1: ['SW1', 1], PB2: ['SW1', 2], PB3: ['SW2', 1] };
const VALVE_KIND = { '52s': '5/2 단동 솔레노이드', '52d': '5/2 복동 솔레노이드', '42s': '4/2 단동 솔레노이드', '42d': '4/2 복동 솔레노이드', '43': '4/3 솔레노이드', '22': '2/2 솔레노이드' };
/* 공압 보드 치수 (보드 왼쪽 위 기준): 실린더 하나당 한 칸(CW), 칸 안에서 위 실린더 → 리밋스위치 → 속도 제어 → 밸브, 맨 아래 공급 */
const AIR = { CW: 360, X0: 16, CY: 36, DOG0: 192, STROKE: 118, LS: 82, SC: 102, V: 180, BS: 304 };
/* 유압 보드 치수: 칸(CW)마다 위 실린더/모터 → 라인 중간 기기(IN) → 가지 기기(BR) → 밸브(V) → P 라인 기기(PL), 오른쪽(RX)에 분배기 · 파워 유닛 */
const OIL = { CW: 440, X0: 16, CY: 36, MO: 4, LS: 82, IN: 114, BR: 186, V: 244, PL: 388, PL2: 524, RX: 896, PU: 22, PC: 290, DA: 300, DB: 472, DH: 154 };
const OIL_VNAME = (kind, v) => kind === '43' ? `4/3 솔레노이드 밸브 (${v.boxes[1] === 'abt' ? 'A-B-T 접속' : v.boxes[1] === 'closed' ? '클로즈드 센터' : v.boxes[1]})` : kind === '42s' ? '4/2 단동 솔레노이드 밸브' : kind === '42d' ? '4/2 복동 솔레노이드 밸브' : kind === '22' ? '2/2 솔레노이드 밸브' : '솔레노이드 밸브';

/* ---------------- 패널 만들기 ---------------- */
function makePanel(P, def, opt) {
  const ref = E.buildNet(def);
  const els = ref.els;
  const relOf = es => es.filter(e => (e.type === 'coil' || e.type === 'no' || e.type === 'nc') && /^K\d+$/.test(e.name)).map(e => e.name);
  const pbOf = es => es.filter(e => e.type === 'pb').map(e => e.name);
  const relayNames = [...new Set(relOf(els))].sort(byNum);
  const pbNames = [...new Set(pbOf(els))].sort(byNum);
  // 기본 → 응용을 한 보드에서 이어 하므로 다른 단계 회로의 릴레이 · 스위치 자리도 같이 잡음 (랙 배치가 단계마다 같음)
  const otherEls = ((opt && opt.union) || []).flatMap(d => E.buildNet(d).els);
  const slotRelays = [...new Set(relayNames.concat(relOf(otherEls)))].sort(byNum);
  const slotPBs = [...new Set(pbNames.concat(pbOf(otherEls)))].sort(byNum);
  const tEl = els.find(e => e.type === 'tmr'), cEl = els.find(e => e.type === 'cnt' || e.type === 'crst');
  const hasT = !!tEl || els.some(e => (e.type === 'no' || e.type === 'nc') && /^T\d/.test(e.name));
  const hasC = !!cEl || els.some(e => (e.type === 'no' || e.type === 'nc') && /^C\d/.test(e.name));
  const tPre = (tEl && tEl.o.pre) || P.tsec || 3;
  const cPre = (els.find(e => e.type === 'cnt' && e.o.pre) || { o: {} }).o.pre || P.cpre || 3;
  const lsNames = [], sNames = [], sensWhere = {};
  for (const a of P.acts) if (a.type === 'cyl') a.sens.forEach((s, i) => { (/^LS/.test(s) ? lsNames : sNames).push(s); sensWhere[s] = `${a.id} ${i ? '전진 끝' : '후진 끝'}`; });
  lsNames.sort(byNum); sNames.sort(byNum);

  const panel = {
    modules: [], rack: [], field: [], jacks: {}, internal: [], elements: [], dev: {}, names: {},
    presets: { T1: 0, TOFF: 0, C1: 10 }, refPre: { T1: hasT ? tPre : null, C1: hasC ? cPre : null },
    relayNames, pbNames, slotRelays, slotPBs, lsNames, sNames, hasT, hasC, W: 0, H: 0, fieldY: 0,
  };
  const mod = (id, kind, title, w, h, where) => { const m = { id, kind, title, w, h, x: 0, y: 0, jacks: [], parts: {} }; panel.modules.push(m); panel[where].push(m); return m; };
  const jack = (m, key, x, y, color, pol, label, lp) => {
    const id = m.id + '.' + key;
    const j = { id, m: m.id, key, lx: x, ly: y, color, pol, label: label == null ? key : label, lp: lp || 'n', x: 0, y: 0 };
    m.jacks.push(j); panel.jacks[id] = j; return id;
  };
  const inner = (a, b) => panel.internal.push([a, b]);
  const elem = (type, name, ja, jb, info) => { const e = Object.assign({ id: ja + '~' + jb + '~' + type, type, name, ja, jb }, info || {}); panel.elements.push(e); return e; };
  const bus = m => {
    for (let i = 1; i <= 6; i++) {
      const x = Math.round(18 + (m.w - 36) * (i - 1) / 5);
      jack(m, 'bp' + i, x, BUS_T, 'r', 'p', ''); jack(m, 'bn' + i, x, BUS_B, 'b', 'n', '');
      if (i > 1) { inner(m.id + '.bp' + (i - 1), m.id + '.bp' + i); inner(m.id + '.bn' + (i - 1), m.id + '.bn' + i); }
    }
    m.bus = true;
  };

  /* DC 전원 */
  const ps = mod('PS', 'ps', 'DC Power Supply', W_PS, MH, 'rack');
  for (let i = 1; i <= 3; i++) {
    jack(ps, 'p' + i, 44 + (i - 1) * 34, 252, 'r', 'p', ''); jack(ps, 'n' + i, 44 + (i - 1) * 34, 286, 'b', 'n', '');
    if (i > 1) { inner('PS.p' + (i - 1), 'PS.p' + i); inner('PS.n' + (i - 1), 'PS.n' + i); }
  }

  /* 스위치 유닛 (②는 랙 둘째 줄 끝 — 응용의 PB3 리셋용) */
  const swCount = slotPBs.some(n => PB_SLOT[n] && PB_SLOT[n][0] === 'SW2') ? 2 : 1;
  const pbAt = {}; for (const n of slotPBs) if (PB_SLOT[n] && pbNames.includes(n)) pbAt[PB_SLOT[n].join('.')] = n;
  const mkSW = u => {
    const m = mod('SW' + u, 'sw', 'Signal Input Switch Unit ' + CIRC[u - 1], W_SW, MH, 'rack'); bus(m);
    m.parts.btns = [];
    for (let j = 1; j <= 3; j++) {
      const ry = ROW0 + (j - 1) * ROWH;
      const label = CIRC[u - 1] + 'PBS-' + j;
      const name = pbAt['SW' + u + '.' + j] || label;
      const lp = jack(m, j + '.L+', 68, ry, 'r', 'p', '+', 'w'), ln = jack(m, j + '.L-', 68, ry + 44, 'b', 'n', '−', 'w');
      const P_ = [[98, '12'], [122, '14'], [150, '22'], [174, '24']];
      for (const [x, k] of P_) jack(m, j + '.' + k, x, ry, 'k', 's', k, 'n');
      jack(m, j + '.11', 110, ry + 44, 'k', 's', '11', 'e'); jack(m, j + '.21', 162, ry + 44, 'k', 's', '21', 'e');
      const poles = [1, 2].map(k => ({ com: m.id + '.' + j + '.' + k + '1', nc: m.id + '.' + j + '.' + k + '2', no: m.id + '.' + j + '.' + k + '4', k }));
      const d = panel.dev[name] = { kind: 'pbs', name, label, mod: m.id, j, lock: j === 3, mapped: name !== label, poles, lamp: [lp, ln] };
      panel.names[name] = d;
      for (const p of poles) {
        elem('pb', name, p.com, p.no, { dev: name, desc: `${label} ${p.k}1-${p.k}4`, pole: p });
        elem('pbnc', name, p.com, p.nc, { dev: name, desc: `${label} ${p.k}1-${p.k}2`, pole: p });
      }
      elem('lamp', name, lp, ln, { dev: name, desc: label + ' 램프' });
      m.parts.btns.push({ name, j, x: 32, y: ry + 22, color: ['g', 'u', 'r'][j - 1], lock: j === 3, label: 'PBS-' + j, tag: d.mapped ? name : null });
    }
  };
  mkSW(1);

  /* 릴레이 유닛 */
  const ruCount = Math.max(1, Math.ceil(slotRelays.length / 3));
  for (let u = 1; u <= ruCount; u++) {
    const m = mod('RU' + u, 'ru', 'Relay Unit ' + CIRC[u - 1], W_RU, MH, 'rack'); bus(m);
    m.parts.relays = [];
    for (let j = 1; j <= 3; j++) {
      const ry = ROW0 + (j - 1) * ROWH, i = (u - 1) * 3 + j - 1;
      const label = CIRC[u - 1] + 'RY' + j, sn = slotRelays[i], name = sn && relayNames.includes(sn) ? sn : label;
      const A1 = jack(m, j + '.A1', 24, ry, 'r', 'p', 'A1', 'e'), A2 = jack(m, j + '.A2', 24, ry + 44, 'b', 'n', 'A2', 'e');
      const poles = [];
      for (let k = 1; k <= 4; k++) {
        const xn = 54 + (k - 1) * 44, xo = xn + 24, xc = xn + 12;
        const nc = jack(m, `${j}.${k}2`, xn, ry, 'k', 's', k + '2', 'n'), no = jack(m, `${j}.${k}4`, xo, ry, 'k', 's', k + '4', 'n');
        const com = jack(m, `${j}.${k}1`, xc, ry + 44, 'k', 's', k + '1', 'e');
        poles.push({ com, nc, no, k, xc, xn, xo });
      }
      const d = panel.dev[name] = { kind: 'relay', name, label, mod: m.id, j, A1, A2, poles, mapped: name !== label };
      panel.names[name] = d;
      elem('coil', name, A1, A2, { dev: name, desc: label + ' 코일 A1·A2' });
      for (const p of poles) {
        elem('no', name, p.com, p.no, { dev: name, desc: `${label} ${p.k}1-${p.k}4`, pole: p });
        elem('nc', name, p.com, p.nc, { dev: name, desc: `${label} ${p.k}1-${p.k}2`, pole: p });
      }
      m.parts.relays.push({ name, label, j, ry, poles, tag: d.mapped ? name : null });
    }
  }

  /* 타이머 유닛 (실습장 랙 순서: 타이머 → 카운터 → 부저·램프) — 도면에 없어도 늘 있음 */
  {
    const m = mod('TMR', 'tmr', 'Digital Time Relay Unit', W_TMR, MH, 'rack'); bus(m); m.rowBreak = true;
    for (const [sec, nm, y0, off] of [['on', 'T1', 80, false], ['off', 'TOFF', 186, true]]) {
      const A1 = jack(m, sec + '.A1', 76, y0, 'r', 'p', 'A1', 'w'), A2 = jack(m, sec + '.A2', 76, y0 + 40, 'b', 'n', 'A2', 'w');
      const noPairs = [], ncPairs = [];
      [['17', '18', 104], ['27', '28', 130], ['35', '36', 156], ['45', '46', 182]].forEach(([t, b, x]) => {
        const jt = jack(m, `${sec}.${t}`, x, y0, 'k', 's', t, 'n'), jb = jack(m, `${sec}.${b}`, x, y0 + 40, 'k', 's', b, 's');
        (t[1] === '7' ? noPairs : ncPairs).push([jt, jb, t + '-' + b]);
      });
      const label = off ? 'OFF 타이머' : 'ON 타이머';
      const d = panel.dev[nm] = { kind: 'tmr', name: nm, label, mod: 'TMR', sec, A1, A2, noPairs, ncPairs, off, mapped: !off && hasT };
      panel.names[nm] = d;
      elem('tmr', nm, A1, A2, { dev: nm, desc: label + ' 코일 A1·A2', needPower: 'TMR', o: off ? { off: true } : {}, preKey: nm });
      for (const p of noPairs) elem('no', nm, p[0], p[1], { dev: nm, desc: `${label} ${p[2]}` });
      for (const p of ncPairs) elem('nc', nm, p[0], p[1], { dev: nm, desc: `${label} ${p[2]}` });
    }
  }

  /* 카운터 유닛 */
  {
    const m = mod('CNT', 'cnt', 'Digital Counter Unit', W_CNT, MH, 'rack'); bus(m);
    const cip = jack(m, 'ci+', 146, 160, 'r', 'p', '+', 'w'), cin = jack(m, 'ci-', 26, 160, 'b', 'n', '−', 'e');
    const rsp = jack(m, 'rs+', 146, 198, 'r', 'p', '+', 'w'), rsn = jack(m, 'rs-', 26, 198, 'b', 'n', '−', 'e');
    const o1 = jack(m, '1', 40, 258, 'k', 's', '1', 's'), o4 = jack(m, '4', 130, 242, 'k', 's', '4', 'e'), o2 = jack(m, '2', 130, 274, 'k', 's', '2', 'e');
    const d = panel.dev.C1 = { kind: 'cnt', name: 'C1', label: '카운터', mod: 'CNT', ci: [cip, cin], rs: [rsp, rsn], poles: [{ com: o1, no: o4, nc: o2, k: 1 }], mapped: hasC };
    panel.names.C1 = d;
    elem('cnt', 'C1', cip, cin, { dev: 'C1', desc: '카운터 Count Input(+·−)', needPower: 'CNT', preKey: 'C1' });
    elem('crst', 'C1', rsp, rsn, { dev: 'C1', desc: '카운터 Reset(+·−)', needPower: 'CNT' });
    elem('no', 'C1', o1, o4, { dev: 'C1', desc: '카운터 출력 1-4', pole: d.poles[0] });
    elem('nc', 'C1', o1, o2, { dev: 'C1', desc: '카운터 출력 1-2', pole: d.poles[0] });
  }

  /* 부저 · 램프 유닛 */
  {
    const m = mod('LMP', 'lmp', 'Buzzer & Lamp Unit', W_LMP, MH, 'rack'); bus(m);
    for (const [n, y, color] of [['BZ', 62, ''], ['L1', 110, 'r'], ['L2', 154, 'g'], ['L3', 198, 'y'], ['L4', 242, 'w']]) {
      const jp = jack(m, n + '+', 98, y, 'r', 'p', '+', 's'), jn = jack(m, n + '-', 160, y, 'b', 'n', '−', 's');
      const label = n === 'BZ' ? '부저' : n + ' 램프';
      panel.dev[n] = { kind: n === 'BZ' ? 'buzzer' : 'lamp', name: n, label, mod: 'LMP', p: jp, n: jn, color, mapped: false };
      panel.names[n] = panel.dev[n];
      elem('lamp', n, jp, jn, { dev: n, desc: label + ' +·−' });
    }
  }
  if (swCount > 1) mkSW(2);

  /* 공압 문제: 실습장 공압 보드 (실린더 · 리밋스위치/근접센서 · 솔레노이드 밸브 · 속도 제어 밸브 · 서비스 유닛 · 분배기)
     관(공기)과 전기 단자를 함께 꽂음. 배치는 공압 회로도처럼: 위 실린더, 아래 밸브, 맨 아래 공급 */
  const airBoard = P.kind === 'pneu' && P.acts.every(a => a.type === 'cyl' && /^52[sd]$/.test(a.valve.kind));
  const oilBoard = P.kind === 'hyd';
  const airMods = [];
  const amod = (id, kind, title, w, h, ax, ay) => { const m = mod(id, kind, title, w, h, 'field'); m.air = true; m.ax = ax; m.ay = ay; m.ports = []; airMods.push(m); return m; };
  const port = (m, key, x, y, face, label, role, open, lp) => {
    const id = m.id + '.' + key, B = panel.air;
    const p = { id, m: m.id, key, lx: x, ly: y, x: 0, y: 0, face, label, role, open: !!open, lp: lp || null };
    m.ports.push(p); B.ports[id] = p; B.portIds.push(id); return id;
  };
  // 리밋스위치 · 근접센서 유닛 (보드에서 도그가 지나는 자리 아래)
  const lsUnit = (n, ax, ay) => {
    if (/^LS/.test(n)) {
      const m = amod(n, 'ls', n, 88, 70, ax, ay);
      const nc = jack(m, 'NC', 18, 56, 'k', 's', 'NC', 'n'), com = jack(m, 'COM', 44, 56, 'b', 's', 'COM', 'n'), no = jack(m, 'NO', 70, 56, 'k', 's', 'NO', 'n');
      m.sub = sensWhere[n] || '';
      const d = panel.dev[n] = { kind: 'ls', name: n, label: n, mod: n, poles: [{ com, nc, no, k: 1 }], mapped: true };
      panel.names[n] = d;
      elem('lsno', n, com, no, { dev: n, desc: n + ' COM-NO' });
      elem('lsnc', n, com, nc, { dev: n, desc: n + ' COM-NC' });
    } else {
      const m = amod(n, 'sen', n, 88, 70, ax, ay);
      const p = jack(m, '24V', 18, 56, 'r', 'p', '24V', 'n'), o = jack(m, 'OUT', 44, 56, 'k', 's', 'OUT', 'n'), z = jack(m, '0V', 70, 56, 'b', 'n', '0V', 'n');
      m.sub = sensWhere[n] || '';
      panel.dev[n] = { kind: 'sen', name: n, label: n + ' 근접센서', mod: n, p, out: o, n: z, mapped: true };
      panel.names[n] = panel.dev[n];
      elem('sen', n, p, z, { jo: o, dev: n, desc: n + ' 센서' });
    }
  };
  if (airBoard) {
    const air = panel.air = { medium: 'air', ports: {}, portIds: [], pass: [], src: 'FRL.OUT', din: 'DST.IN', valves: [], cyls: [], scs: [], distOut: [], fc: {}, cols: [], comps: [], sups: [], motors: [], mcs: [], board: null };
    const CW = AIR.CW, X0 = AIR.X0;
    P.acts.forEach((a, i) => {
      const cx = X0 + i * CW;
      air.cols.push({ act: a.id, x: cx });
      // 실린더 (복동) — 위쪽. 포트는 양쪽 끝 덮개 아래
      const cy = amod('CY' + a.id, 'cyl', '실린더 ' + a.id, 338, 40, cx + 14, AIR.CY);
      cy.act = a.id; cy.stroke = AIR.STROKE;
      const CAP = port(cy, 'CAP', 16, 40, 's', '헤드', 'CAP', true), ROD = port(cy, 'ROD', 128, 40, 's', '로드', 'ROD', true);
      air.cyls.push({ act: a.id, mod: cy.id, CAP, ROD });
      // 리밋스위치 · 근접센서 — 도그가 지나는 자리 아래 (후진 끝 / 전진 끝)
      a.sens.forEach((n, k) => lsUnit(n, cx + 14 + AIR.DOG0 + (k ? AIR.STROKE : 0) - 44, AIR.LS));
      // 속도 제어 밸브 (도면에 있는 쪽 관 자리에 세워 둠)
      if (a.fc) {
        const n = air.scs.length + 1, sx = cx + 14 + (a.fc === 'cap' ? 16 : 128) - 15;
        const sc = amod('SC' + n, 'sc', '속도 제어 밸브', 30, 56, sx, AIR.SC);
        const p2 = port(sc, '2', 15, -3, 'n', '', 'SC', true), p1 = port(sc, '1', 15, 59, 's', '', 'SC', true);
        air.pass.push([p1, p2]);
        air.scs.push({ mod: sc.id, act: a.id, side: a.fc, p1, p2, n });
        air.fc[a.id] = a.fc;
      }
      // 5/2 솔레노이드 밸브 — 실린더 아래
      const v = a.valve, dbl = v.kind === '52d';
      const coils = dbl ? [v.l, v.r] : [v.sol];
      const vm = amod('V' + a.id, 'valve', (dbl ? '5/2 복동' : '5/2 단동') + ' 솔레노이드 밸브', dbl ? 204 : 168, 112, cx + 8, AIR.V);
      vm.sub = dbl ? '5/2-WAY SOLENOID VALVE (DOUBLE)' : '5/2-WAY SOLENOID VALVE (SINGLE)';
      vm.parts.coils = []; vm.dbl = dbl; vm.act = a.id;
      coils.forEach((y, k) => {
        const x0 = k ? 146 : 10;
        const jp = jack(vm, y + '+', x0 + 12, 66, 'r', 'p', '+', 's'), jn = jack(vm, y + '-', x0 + 36, 66, 'b', 'n', '−', 's');
        panel.dev[y] = { kind: 'sol', name: y, label: y + ' 코일', mod: vm.id, p: jp, n: jn, mapped: true };
        panel.names[y] = panel.dev[y];
        elem('sol', y, jp, jn, { dev: y, desc: y + ' 코일(+·−)' });
        vm.parts.coils.push({ name: y, x0 });
      });
      const pP = port(vm, 'P', 102, 88, 's', 'P', 'P', true), pA = port(vm, 'A', 80, 22, 'n', 'A', 'A', true), pB = port(vm, 'B', 124, 22, 'n', 'B', 'B', true);
      air.valves.push({ act: a.id, mod: vm.id, P: pP, A: pA, B: pB, coils, dbl });
    });
    // 서비스 유닛(FRL) · 분배기 — 맨 아래
    const frl = amod('FRL', 'frl', '서비스 유닛', 116, 150, X0, AIR.BS);
    port(frl, 'OUT', 118, 74, 'e', 'OUT', 'src', false);
    const dst = amod('DST', 'dist', '분배기', 156, 80, X0 + CW + 20, AIR.BS + 34);
    const din = port(dst, 'IN', -3, 40, 'w', 'IN', 'din', false);
    const outs = [];
    [[42, 24], [70, 24], [98, 24], [42, 54], [70, 54], [98, 54]].forEach(([x, y], k) => outs.push(port(dst, String(k + 1), x, y, 'n', String(k + 1), 'dout', false)));
    air.distOut = outs; air.pass.push([din, ...outs]);
    air.board = { x: 0, y: 0, w: X0 + P.acts.length * CW + 10, h: AIR.BS + 160 };
  }

  /* 유압 문제: 실습장 유압 보드 — 파워 유닛 P·T 공급 라인 → P 분배기 · T 분배기 → 밸브 P·T, 밸브 A·B → 실린더 · 모터 (퀵 커플러 호스)
     응용 단계에서는 도면의 응용 기기(카운터밸런스 · 미터아웃 · 파일럿 체크 · 블리드오프 · 감압 · 서지압 · 펌프 체크 · 미터인)를 보드에 붙임 */
  if (oilBoard) {
    const B = panel.air = { medium: 'oil', ports: {}, portIds: [], pass: [], src: 'PU.P', sink: 'PU.T', din: 'DA.IN', tin: 'DB.IN', valves: [], sups: [], cyls: [], motors: [], comps: [], scs: [], distOut: [], tOut: [], mcs: [], fc: {}, cols: [], board: null, spec: {} };
    const fx = (P.isApp && P.app && P.app.fluid) || [];
    const comp = (kind, id, act, title, w, h, ax, ay, ports, extra) => {
      const m = amod(id, kind, title, w, h, ax, ay); m.act = act; Object.assign(m, extra || {});
      const ps = {}; for (const [key, x, y, face, label, lp] of ports) ps[key] = port(m, key, x, y, face, label, 'C', false, lp);
      const c = Object.assign({ kind, mod: m.id, act, ports: ps, title }, extra || {}); B.comps.push(c); return c;
    };
    const CW = OIL.CW, X0 = OIL.X0;
    P.acts.forEach((a, i) => {
      const cx = X0 + i * CW;
      B.cols.push({ act: a.id, x: cx });
      B.spec[a.id] = { tExt: a.tExt || null, tRet: a.tRet || null, speed: a.speed || null };
      let line;
      if (a.type === 'cyl') {
        const cy = amod('CY' + a.id, 'cyl', '실린더 ' + a.id, 338, 40, cx + 14, OIL.CY);
        cy.act = a.id; cy.stroke = AIR.STROKE; cy.oil = true;
        const CAP = port(cy, 'CAP', 16, 40, 's', '헤드', 'CAP', false), ROD = port(cy, 'ROD', 128, 40, 's', '로드', 'ROD', false);
        B.cyls.push({ act: a.id, mod: cy.id, CAP, ROD });
        a.sens.forEach((n, k) => lsUnit(n, cx + 14 + AIR.DOG0 + (k ? AIR.STROKE : 0) - 44, OIL.LS));
        line = { cap: cx + 30, rod: cx + 142 };
      } else {
        const mo = amod('MO' + a.id, 'motor', '모터 ' + a.id, 200, 78, cx + 20, OIL.MO);
        mo.act = a.id; mo.bi = !!a.bi;
        const L = port(mo, 'L', 40, 81, 's', a.bi ? 'A' : 'IN', 'ML', false), R = port(mo, 'R', 120, 81, 's', a.bi ? 'B' : 'OUT', 'MR', false);
        B.motors.push({ act: a.id, mod: mo.id, L, R, bi: !!a.bi });
        line = { cap: cx + 60, rod: cx + 140 };
      }
      // 작업 라인 중간 기기 (세로로 라인 자리에): 1 = 자유 흐름이 들어가는 쪽, 2 = 나가는 쪽
      const inline = (kind, id, side, title, opt) => {
        opt = opt || {};
        const down = !!opt.down, top = down ? '1' : '2', bot = down ? '2' : '1';
        const ps = [[top, 15, -3, 'n', top, 'w'], [bot, 15, 59, 's', bot, 'w']];
        if (opt.pilot) ps.push(['X', -6, 30, 'w', 'X', 'n']);
        return comp(kind, id, a.id, title, 30, 56, line[side] - 15, OIL.IN, ps, { side, down });
      };
      if (a.outCheck) inline('hck', 'CV' + a.id, 'rod', '체크밸브 (모터 출구)', { down: true });
      for (const f of fx.filter(f => f.act === a.id)) {
        if (f.kind === 'cb') inline('hcb', 'CB' + a.id, f.side, '카운터밸런스 밸브');
        else if (f.kind === 'mout') inline('hfc', 'FC' + a.id, f.side, '미터아웃 유량제어밸브');
        else if (f.kind === 'poc') inline('hpoc', 'PC' + a.id, 'rod', '파일럿 체크밸브', { pilot: true });
      }
      // 가지 기기: 멀티 커넥터(헤드 · 입구 쪽 라인) → 블리드오프 · 파일럿 · 서지압 릴리프 · 보충 체크
      const br = fx.filter(f => f.act === a.id && (f.kind === 'bleed' || f.kind === 'surge' || f.kind === 'poc'));
      if (br.length) {
        // 헤드(입구) 쪽 라인 바로 아래 · 밸브 A 바로 위에 두어 호스가 짧게 (헤드 쪽 중간 기기가 있으면 오른쪽으로)
        const capInl = fx.some(f => f.act === a.id && f.side === 'cap' && (f.kind === 'cb' || f.kind === 'mout'));
        const mw = capInl ? 150 : 120, mx = capInl ? cx + 180 : cx + 8, d = capInl ? [25, 75, 125] : [20, 60, 100];
        const mc = amod('MC' + a.id, 'hmc', '멀티 커넥터', mw, 44, mx, OIL.BR); mc.act = a.id;
        const mp = [];
        [[d[0], -3, 'n'], [d[1], -3, 'n'], [d[2], -3, 'n'], [d[0], 47, 's'], [d[1], 47, 's'], [d[2], 47, 's']].forEach(([x, y, f], k) => mp.push(port(mc, 'A' + (k + 1), x, y, f, 'A' + (k + 1), 'mc', false, 'e')));
        B.pass.push(mp); B.mcs.push({ mod: mc.id, act: a.id, ports: mp });
        let bx = capInl ? cx + 342 : cx + 170;
        for (const f of br) {
          if (f.kind === 'bleed') { comp('hbl', 'BL' + a.id, a.id, '블리드오프 유량제어밸브', 76, 44, bx, OIL.BR, [['IN', -3, 22, 'w', 'IN', 'n'], ['OUT', 79, 22, 'e', 'T', 'n']]); bx += 88; }
          if (f.kind === 'surge') {
            comp('hrv', 'RV' + a.id, a.id, '릴리프밸브 (서지압)', 46, 44, bx, OIL.BR, [['P', -3, 22, 'w', 'P', 'n'], ['T', 36, -3, 'n', 'T', 'e']]); bx += 56;
            comp('hmu', 'MU' + a.id, a.id, '체크밸브 (보충)', 40, 44, bx, OIL.BR, [['2', -3, 22, 'w', '2', 's'], ['1', 43, 22, 'e', '1', 's']]); bx += 46;
          }
        }
      }
      // 방향 제어 밸브 (서브 플레이트: 위 A · B, 아래 P · T)
      const v = a.valve, kind = v.kind, two = kind === '22';
      const coils = kind === '43' || kind === '42d' ? [v.l, v.r] : [v.sol];
      const vm = amod('V' + a.id, 'valve', OIL_VNAME(kind, v), coils.length > 1 ? 204 : 168, 120, cx + 8, OIL.V);
      vm.oil = true; vm.vkind = kind; vm.dbl = coils.length > 1; vm.act = a.id; vm.boxes = v.boxes.slice();
      vm.sub = { '43': '4/3-WAY DOUBLE SOLENOID VALVE', '42s': '4/2-WAY SINGLE SOLENOID VALVE', '42d': '4/2-WAY DOUBLE SOLENOID VALVE', '22': '2/2-WAY SOLENOID VALVE' }[kind] || '';
      vm.parts.coils = [];
      coils.forEach((y, k) => {
        const x0 = k ? 146 : 10;
        const jp = jack(vm, y + '+', x0 + 12, 66, 'r', 'p', '+', 's'), jn = jack(vm, y + '-', x0 + 36, 66, 'b', 'n', '−', 's');
        panel.dev[y] = { kind: 'sol', name: y, label: y + ' 코일', mod: vm.id, p: jp, n: jn, mapped: true };
        panel.names[y] = panel.dev[y];
        elem('sol', y, jp, jn, { dev: y, desc: y + ' 코일(+·−)' });
        vm.parts.coils.push({ name: y, x0 });
      });
      let pP, pA, pB = null, pT = null;
      if (two) { pA = port(vm, 'A', 102, 22, 'n', 'A', 'A', false, 'e'); pP = port(vm, 'P', 102, 114, 's', 'P', 'P', false, 'e'); }
      else { pA = port(vm, 'A', 80, 22, 'n', 'A', 'A', false); pB = port(vm, 'B', 124, 22, 'n', 'B', 'B', false); pP = port(vm, 'P', 80, 114, 's', 'P', 'P', false, 'w'); pT = port(vm, 'T', 124, 114, 's', 'T', 'T', false, 'e'); }
      B.valves.push({ act: a.id, mod: vm.id, P: pP, A: pA, B: pB, T: pT, coils, kind, two, dbl: coils.length > 1 });
      // P 라인 기기: 공급 2/2 솔레노이드 (기본) · 감압밸브 · 미터인 유량제어 (응용)
      if (a.supply) {
        const sm = amod('S' + a.id, 'valve', '2/2 솔레노이드 밸브 (공급)', 168, 100, cx + 168, OIL.PL);
        sm.oil = true; sm.vkind = '22'; sm.sup = true; sm.act = a.id; sm.boxes = a.supply.boxes.slice(); sm.parts.coils = [];
        const y = a.supply.sol;
        const jp = jack(sm, y + '+', 22, 58, 'r', 'p', '+', 's'), jn = jack(sm, y + '-', 46, 58, 'b', 'n', '−', 's');
        panel.dev[y] = { kind: 'sol', name: y, label: y + ' 코일', mod: sm.id, p: jp, n: jn, mapped: true };
        panel.names[y] = panel.dev[y];
        elem('sol', y, jp, jn, { dev: y, desc: y + ' 코일(+·−)' });
        sm.parts.coils.push({ name: y, x0: 10, short: true });
        const OUT = port(sm, 'OUT', 102, -3, 'n', 'OUT', 'A', false, 'e'), IN = port(sm, 'IN', 102, 103, 's', 'IN', 'P', false, 'e');
        B.sups.push({ act: a.id, mod: sm.id, IN, OUT, coil: y });
      }
      for (const f of fx.filter(f => f.act === a.id)) {
        // 공급 밸브가 있으면 그 IN 바로 아래(한 줄 아래)에 — 2차 쪽이 공급 밸브 IN과 마주 보게
        if (f.kind === 'prv') {
          if (a.supply) comp('hprv', 'PR' + a.id, a.id, '감압밸브', 112, 100, cx + 230, OIL.PL2, [['P2', 40, -3, 'n', 'P2', 'e'], ['P1', 115, 80, 'e', 'P1', 'n'], ['T', 115, 36, 'e', 'T', 'n']], { label: f.label });
          else comp('hprv', 'PR' + a.id, a.id, '감압밸브', 112, 100, cx + 8, OIL.PL, [['P2', 40, -3, 'n', 'P2', 'e'], ['P1', 40, 103, 's', 'P1', 'e'], ['T', 115, 50, 'e', 'T', 'n']], { label: f.label });
        }
        if (f.kind === 'thr') {
          if (a.supply) comp('hthr', 'TH' + a.id, a.id, '유량제어밸브 (미터인)', 30, 56, cx + 255, OIL.PL2, [['2', 15, -3, 'n', '2', 'w'], ['1', 15, 59, 's', '1', 'w']]);
          else comp('hthr', 'TH' + a.id, a.id, '유량제어밸브 (미터인)', 30, 56, cx + 60, OIL.PL + 22, [['2', 15, -3, 'n', '2', 'w'], ['1', 15, 59, 's', '1', 'w']]);
        }
      }
    });
    // 오른쪽: 파워 유닛(위, P·T 커플러는 아래) → (펌프 체크) → P 분배기 · T 분배기 (세로 블록, 구멍은 밸브 쪽인 왼쪽)
    const RX = OIL.RX;
    const pu = amod('PU', 'hpu', '파워 유닛', 200, 236, RX, OIL.PU);
    port(pu, 'P', 104, 239, 's', 'P', 'src', false, 'w'); port(pu, 'T', 144, 239, 's', 'T', 'sink', false, 'e');
    if (fx.some(f => f.kind === 'pumpchk')) comp('hck', 'CK', null, '체크밸브 (펌프 토출)', 30, 56, RX + 89, OIL.PC, [['1', 15, -3, 'n', '1', 'w'], ['2', 15, 59, 's', '2', 'w']], { pump: true, down: true });
    const dist = (id, title, y) => {
      const m = amod(id, 'hdist', title, 44, OIL.DH, RX + 4, y);
      const outs = []; for (let k = 0; k < 6; k++) outs.push(port(m, String(k + 1), -3, 30 + 22 * k, 'w', String(k + 1), 'dout', false, 'e'));
      const inp = port(m, 'IN', 47, 85, 'e', 'IN', 'din', false, 'n');
      B.pass.push([inp, ...outs]);
      return outs;
    };
    B.distOut = dist('DA', 'P 분배기 (1×6)', OIL.DA);
    B.tOut = dist('DB', 'T 분배기 (1×6)', OIL.DB);
    B.board = { x: 0, y: 0, w: RX + 210, h: OIL.DB + OIL.DH + 16 };
  }

  /* 보드 기기: 리밋스위치 · 근접센서 · 솔레노이드 밸브 (보드가 없는 경우) */
  if (!airBoard && !oilBoard) for (const n of lsNames) {
    const m = mod(n, 'ls', n, 118, 92, 'field');
    const nc = jack(m, 'NC', 26, 62, 'k', 's', 'NC', 's'), com = jack(m, 'COM', 59, 62, 'b', 's', 'COM', 's'), no = jack(m, 'NO', 92, 62, 'k', 's', 'NO', 's');
    m.sub = sensWhere[n] || '';
    const d = panel.dev[n] = { kind: 'ls', name: n, label: n, mod: n, poles: [{ com, nc, no, k: 1 }], mapped: true };
    panel.names[n] = d;
    elem('lsno', n, com, no, { dev: n, desc: n + ' COM-NO' });
    elem('lsnc', n, com, nc, { dev: n, desc: n + ' COM-NC' });
  }
  if (!airBoard && !oilBoard) for (const n of sNames) {
    const m = mod(n, 'sen', n, 128, 100, 'field');
    const p = jack(m, '24V', 26, 40, 'r', 'p', '24V', 'e'), o = jack(m, 'OUT', 26, 64, 'k', 's', 'OUTPUT', 'e'), z = jack(m, '0V', 26, 88, 'b', 'n', '0V', 'e');
    m.sub = sensWhere[n] || '';
    panel.dev[n] = { kind: 'sen', name: n, label: n + ' 근접센서', mod: n, p, out: o, n: z, mapped: true };
    panel.names[n] = panel.dev[n];
    elem('sen', n, p, z, { jo: o, dev: n, desc: n + ' 센서' });
  }
  if (!airBoard && !oilBoard) for (const a of P.acts) {
    const v = a.valve, coils = [];
    if (v.kind === '52s' || v.kind === '42s' || v.kind === '22') coils.push(v.sol);
    else coils.push(v.l, v.r);
    const list = [[a.id, VALVE_KIND[v.kind] || '솔레노이드 밸브', coils]];
    if (a.supply) list.push([a.id + '공급', '2/2 솔레노이드 (공급)', [a.supply.sol]]);
    for (const [vid, kind, cs] of list) {
      const m = mod('V' + vid, 'valve', (a.type === 'cyl' ? '실린더 ' : '모터 ') + a.id + (vid.endsWith('공급') ? ' 공급' : '') + ' 밸브', 24 + 92 * cs.length, 92, 'field');
      m.sub = kind; m.parts.coils = [];
      cs.forEach((y, i) => {
        const x0 = 12 + 92 * i;
        const jp = jack(m, y + '+', x0 + 22, 66, 'r', 'p', '+', 'w'), jn = jack(m, y + '-', x0 + 58, 66, 'b', 'n', '−', 'e');
        panel.dev[y] = { kind: 'sol', name: y, label: y + ' 코일', mod: m.id, p: jp, n: jn, mapped: true };
        panel.names[y] = panel.dev[y];
        elem('sol', y, jp, jn, { dev: y, desc: y + ' 코일(+·−)' });
        m.parts.coils.push({ name: y, x0 });
      });
    }
  }

  /* 배치 */
  const flow = (mods, x0, y0) => {
    let x = x0, y = y0, rowH = 0, W = 0;
    for (const m of mods) {
      if (x > x0 && (m.rowBreak || x + m.w > x0 + MAXW)) { x = x0; y += rowH + GAP; rowH = 0; }
      m.x = x; m.y = y; x += m.w + GAP; rowH = Math.max(rowH, m.h); W = Math.max(W, x - GAP);
    }
    return { bottom: y + rowH, W };
  };
  const r1 = flow(panel.rack, PAD, PAD);
  panel.fieldY = r1.bottom + 30;
  if (airBoard || oilBoard) {
    const B = panel.air.board; B.x = PAD; B.y = panel.fieldY + 12;
    for (const m of airMods) { m.x = B.x + m.ax; m.y = B.y + m.ay; }
    panel.W = Math.max(r1.W, B.x + B.w) + PAD; panel.H = B.y + B.h + PAD;
  } else {
    const r2 = flow(panel.field, PAD, panel.fieldY + 12);
    panel.W = Math.max(r1.W, r2.W) + PAD; panel.H = r2.bottom + PAD;
  }
  for (const m of panel.modules) {
    for (const j of m.jacks) { j.x = m.x + j.lx; j.y = m.y + j.ly; }
    for (const p of m.ports || []) { p.x = m.x + p.lx; p.y = m.y + p.ly; }
  }
  if (panel.air) { const A = panel.air; A.portIdx = {}; A.portIds.forEach((id, i) => { A.portIdx[id] = i; }); }
  panel.jackIds = Object.keys(panel.jacks);
  panel.jackIdx = {}; panel.jackIds.forEach((id, i) => { panel.jackIdx[id] = i; });
  panel.mods = {}; for (const m of panel.modules) panel.mods[m.id] = m;
  return panel;
}

/* ---------------- 선 → 넷리스트 ---------------- */
function uf(n) {
  const p = new Int32Array(n); for (let i = 0; i < n; i++) p[i] = i;
  const find = x => { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; };
  return { find, union: (a, b) => { a = find(a); b = find(b); if (a !== b) p[b] = a; } };
}
function validWires(panel, wires) { return (wires || []).filter(w => w && panel.jacks[w.a] && panel.jacks[w.b] && w.a !== w.b); }

function buildWireNet(panel, wires) {
  const N = panel.jackIds.length, idx = panel.jackIdx, U = uf(N);
  for (const [a, b] of panel.internal) U.union(idx[a], idx[b]);
  for (const w of validWires(panel, wires)) U.union(idx[w.a], idx[w.b]);
  const r = id => U.find(idx[id]);
  const top = r('PS.p1'), bot = r('PS.n1');
  const powered = {};
  for (const m of panel.modules) if (m.bus) powered[m.id] = r(m.id + '.bp1') === top && r(m.id + '.bn1') === bot;
  const els = [];
  for (const el of panel.elements) {
    if (el.type === 'lamp') { els.push({ id: el.id, type: 'lamp', name: el.name, a: r(el.ja), b: r(el.jb), o: {}, src: el }); continue; }
    if (el.needPower && !powered[el.needPower]) continue;   // 전원이 없는 카운터·타이머는 코일이 동작하지 않음 (접점은 그대로)
    const o = Object.assign({}, el.o || {});
    if (el.preKey && panel.presets[el.preKey] != null) o.pre = panel.presets[el.preKey];
    const e = { id: el.id, type: el.type, name: el.name, a: r(el.ja), b: r(el.jb), o, src: el };
    if (el.jo) e.out = r(el.jo);
    els.push(e);
  }
  const adj = {}, above = {};
  els.forEach((e, i) => {
    if (CONTACT.has(e.type)) { (adj[e.a] = adj[e.a] || []).push(i); (adj[e.b] = adj[e.b] || []).push(i); (above[e.b] = above[e.b] || []).push(i); }
    else if (e.type === 'sen') { (adj[e.a] = adj[e.a] || []).push(i); (above[e.out] = above[e.out] || []).push(i); }
  });
  const net = { els, top, bot, adj, above, nodeCount: N, segs: [], cols: [], links: [], ghosts: [], dual: true };
  return { net, r, powered, wireShort: top === bot, top, bot };
}

/* ---------------- 경로 · 논리식 ---------------- */
const lit = e => e.name + (e.type === 'sen' || isA(e.type) ? '+' : '-');
const opp = l => l.slice(0, -1) + (l.endsWith('+') ? '-' : '+');
const varOf = l => l.slice(0, -1);
function normTerm(lits) {
  const s = new Set(lits);
  for (const l of s) if (s.has(opp(l))) return null;
  return [...s].sort();
}
/* from → to 단순 경로들의 조건. 센서는 +24V 쪽(e.a)에서 출력(e.out)으로만 지나감 */
function paths(net, from, to, opt) {
  opt = opt || {};
  const out = [], LIMIT = opt.limit || 2500;
  let over = false;
  const on = new Uint8Array(net.nodeCount);
  const lits = [], via = [];
  const gndOf = opt.gnd || (() => [[]]);
  function dfs(n) {
    if (over) return;
    if (n === to) { out.push({ lits: lits.slice(), via: via.slice() }); if (out.length >= LIMIT) over = true; return; }
    on[n] = 1;
    for (const i of net.adj[n] || []) {
      const e = net.els[i];
      if (e.type === 'sen') {
        if (!opt.sensors || n !== e.a || on[e.out]) continue;
        const g = gndOf(e.b);
        for (const gt of g) {
          lits.push(e.name + '+', ...gt.lits); via.push(e, ...gt.via.map(x => Object.assign(Object.create(x), { _gnd: true })));
          dfs(e.out);
          lits.length -= 1 + gt.lits.length; via.length -= 1 + gt.via.length;
        }
        continue;
      }
      if (!CONTACT.has(e.type)) continue;
      const nx = e.a === n ? e.b : e.a;
      if (on[nx]) continue;
      lits.push(lit(e)); via.push(e);
      dfs(nx);
      lits.pop(); via.pop();
    }
    on[n] = 0;
  }
  dfs(from);
  return { terms: out, over };
}
function sopOf(raw) {
  // 정규화 · 중복 제거 · 흡수(더 큰 항 제거)
  const seen = new Map();
  for (const t of raw) {
    const n = normTerm(t.lits); if (!n) continue;
    const k = n.join('&');
    if (!seen.has(k)) seen.set(k, { lits: n, via: t.via });
  }
  const arr = [...seen.values()].sort((a, b) => a.lits.length - b.lits.length);
  const res = [];
  for (const t of arr) if (!res.some(r => r.lits.every(l => t.lits.includes(l)))) res.push(t);
  return res;
}
function andSop(A, B) {
  const out = [];
  for (const a of A) for (const b of B) out.push({ lits: a.lits.concat(b.lits), via: a.via.concat(b.via) });
  return sopOf(out);
}
const evalTerm = (t, asg) => t.lits.every(l => asg[varOf(l)] === l.endsWith('+'));
const evalSop = (S, asg) => S.some(t => evalTerm(t, asg));
/* 두 논리식 비교: 다르면 반례 */
function compareSop(A, B, fixed) {
  const vars = [...new Set([...A, ...B].flatMap(t => t.lits.map(varOf)))].filter(v => !fixed || !(v in fixed)).sort();
  const asg = Object.assign({}, fixed || {});
  let aOnly = null, bOnly = null;
  const test = () => {
    const a = evalSop(A, asg), b = evalSop(B, asg);
    if (a && !b && !aOnly) aOnly = Object.assign({}, asg);
    if (b && !a && !bOnly) bOnly = Object.assign({}, asg);
  };
  if (vars.length <= 16) {
    const n = 1 << vars.length;
    for (let m = 0; m < n && !(aOnly && bOnly); m++) { vars.forEach((v, i) => { asg[v] = !!(m & (1 << i)); }); test(); }
  } else {
    let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let k = 0; k < 30000 && !(aOnly && bOnly); k++) { for (const v of vars) asg[v] = rnd() < 0.5; test(); }
    for (const t of [...A, ...B]) { for (const v of vars) asg[v] = rnd() < 0.5; for (const l of t.lits) asg[varOf(l)] = l.endsWith('+'); test(); }
  }
  return { equal: !aOnly && !bOnly, aOnly, bOnly };
}
/* term ⇒ S ? (term이 참이면 S도 늘 참인지) */
function covered(term, S) {
  const fixed = {};
  for (const l of term.lits) fixed[varOf(l)] = l.endsWith('+');
  const S2 = S.filter(t => t.lits.every(l => !(varOf(l) in fixed) || fixed[varOf(l)] === l.endsWith('+')));
  if (!S2.length) return false;
  if (S2.some(t => t.lits.every(l => varOf(l) in fixed))) return true;
  const vars = [...new Set(S2.flatMap(t => t.lits.map(varOf)))].filter(v => !(v in fixed));
  const asg = Object.assign({}, fixed);
  if (vars.length <= 16) {
    const n = 1 << vars.length;
    for (let m = 0; m < n; m++) { vars.forEach((v, i) => { asg[v] = !!(m & (1 << i)); }); if (!evalSop(S2, asg)) return false; }
    return true;
  }
  let seed = 777; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let k = 0; k < 40000; k++) { for (const v of vars) asg[v] = rnd() < 0.5; if (!evalSop(S2, asg)) return false; }
  return true;
}

/* 넷의 부하별 논리식 (+24V → 부하 + 단자) ∧ (부하 − 단자 → 0V) */
function loadFuncs(net, filter) {
  const gm = {};
  const gnd = node => gm[node] || (gm[node] = sopOf(paths(net, node, net.bot).terms));
  const out = {};
  for (const e of net.els) if (LOAD.has(e.type) && (!filter || filter(e))) {
    const key = e.type + ':' + e.name;
    const top = sopOf(paths(net, net.top, e.a, { sensors: true, gnd }).terms);
    const f = andSop(top, gnd(e.b));
    if (out[key]) out[key].f = sopOf(out[key].f.concat(f));
    else out[key] = { e, key, f, x: e.x || 0 };
  }
  return { F: out, gnd, top: node => sopOf(paths(net, net.top, node, { sensors: true, gnd }).terms) };
}
function refFunctions(def) {
  const R = E.buildNet(def);
  const LF = loadFuncs(R);
  const loads = Object.values(LF.F).sort((a, b) => a.x - b.x);
  return { R, loads, F: LF.F };
}
/* 노드를 합친(접점 공유) 넷 */
function mergedNet(R, pairs) {
  const U = uf(R.nodeCount);
  for (const [x, y] of pairs) U.union(x, y);
  const els = R.els.map(e => Object.assign({}, e, { a: U.find(e.a), b: U.find(e.b), out: e.out != null ? U.find(e.out) : e.out }));
  const adj = {};
  els.forEach((e, i) => { if (CONTACT.has(e.type)) { (adj[e.a] = adj[e.a] || []).push(i); (adj[e.b] = adj[e.b] || []).push(i); } else if (e.type === 'sen') (adj[e.a] = adj[e.a] || []).push(i); });
  return { els, adj, top: U.find(R.top), bot: U.find(R.bot), nodeCount: R.nodeCount };
}
/* 접점 공유로 생긴 길인지: 릴레이 K의 자기유지 점에서 받은 경우
   - K가 켜져 있으면 어차피 켜질 길이고 (w ∧ K ⇒ 도면)
   - w가 참이면 K의 시작 조건도 참 (K가 바로 켜짐) */
function sharedVia(w, fR, refF) {
  for (const key in refF) {
    if (!key.startsWith('coil:')) continue;
    const K = key.slice(5);
    if (w.lits.includes(K + '+') || w.lits.includes(K + '-')) continue;
    if (!covered({ lits: w.lits.concat([K + '+']) }, fR)) continue;
    const sets = refF[key].f.filter(t => !t.lits.includes(K + '+'));
    if (sets.some(t => t.lits.filter(l => !/^K\d+-$/.test(l)).every(l => w.lits.includes(l)))) return K;
  }
  return null;
}
/* 도면 함수 fR 과 실제 fW 비교 → 빠진 길 · 나쁜 길 · 공유로 생긴 길 */
function diffFunc(fR, fW, refF) {
  const missing = fR.filter(r => !covered(r, fW));
  const extra = fW.filter(w => !covered(w, fR));
  const shared = [], bad = [];
  for (const w of extra) { const K = sharedVia(w, fR, refF); if (K) shared.push({ w, K }); else bad.push(w); }
  return { missing, bad, shared };
}
function mergeOk(R, refF, pairs) {
  const M = mergedNet(R, pairs);
  const F2 = loadFuncs(M).F;
  for (const key in refF) {
    const f2 = F2[key] ? F2[key].f : [];
    const d = diffFunc(refF[key].f, f2, refF);
    if (d.missing.length || d.bad.length) return false;
  }
  return true;
}

/* ---------------- 표시 문구 ---------------- */
function litText(l) {
  const n = varOf(l), s = l.endsWith('+');
  if (/^S\d/.test(n)) return n + ' 센서 출력';
  if (/^T/.test(n)) return `타이머 ${n === 'TOFF' ? '(OFF)' : n} ${s ? 'a' : 'b'}접점`;
  if (/^C\d/.test(n)) return `카운터 ${n} ${s ? 'a' : 'b'}접점`;
  return n + ' ' + (s ? 'a' : 'b') + '접점';
}
function loadText(e) {
  if (e.type === 'coil') return e.name + ' 코일';
  if (e.type === 'sol') return e.name + ' 솔레노이드';
  if (e.type === 'tmr') return '타이머 ' + e.name + ' 코일';
  if (e.type === 'cnt') return '카운터 입력(Count)';
  if (e.type === 'crst') return '카운터 리셋(Reset)';
  return e.name;
}
function termText(t) { return t.lits.length ? t.lits.map(litText).join(' · ') : '접점 없이 바로'; }
const DIGIT_BAT = { 0: 1, 1: 1, 2: 0, 3: 1, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1, 9: 0 };   // 영 일 이 삼 사 오 육 칠 팔 구
const josa = (w, a, b) => {
  const base = w.replace(/\([^)]*\)\s*$/, '').trim() || w;
  const ch = base[base.length - 1], c = base.charCodeAt(base.length - 1);
  const bat = c >= 0xAC00 && c <= 0xD7A3 ? (c - 0xAC00) % 28 !== 0 : /\d/.test(ch) ? !!DIGIT_BAT[ch] : false;
  return w + (bat ? a : b);
};
/* 이 리터럴을 쓰려면 꽂아야 할 단자 */
function wantTerm(panel, l, viaEl) {
  const n = varOf(l), s = l.endsWith('+'), d = panel.dev[n];
  if (!d) return '';
  if (d.kind === 'relay' || d.kind === 'pbs') {
    const k = viaEl && viaEl.src && viaEl.src.pole ? viaEl.src.pole.k : 1;
    return `${d.label} ${k}1-${k}${s ? 4 : 2}`;
  }
  if (d.kind === 'ls') return `${n} COM-${s ? 'NO' : 'NC'}`;
  if (d.kind === 'cnt') return `카운터 출력 1-${s ? 4 : 2}`;
  if (d.kind === 'tmr') return `${d.label} ${s ? '17-18' : '35-36'}`;
  return '';
}

/* ---------------- 배선 검사 ---------------- */
function analyze(panel, wires, def, P) {
  wires = validWires(panel, wires);
  const W0 = buildWireNet(panel, wires);
  let W = W0;
  const items = [];
  const add = (sev, text, jacks, extra) => items.push(Object.assign({ sev, text, jacks: jacks || [] }, extra || {}));
  const used = new Set(), deg = {}; for (const w of wires) { used.add(w.a); used.add(w.b); deg[w.a] = (deg[w.a] || 0) + 1; deg[w.b] = (deg[w.b] || 0) + 1; }
  const usedAny = ids => ids.some(id => used.has(id));
  const elJacks = e => e && e.src ? [e.src.ja, e.src.jb].concat(e.src.jo ? [e.src.jo] : []) : [];

  /* 1) 전원 */
  const psP = ['PS.p1', 'PS.p2', 'PS.p3'], psN = ['PS.n1', 'PS.n2', 'PS.n3'];
  if (!wires.length) { add('info', '아직 꽂은 선이 없어요. 단자를 누르고 이을 단자를 누르면 선이 생겨요.', []); return { items, errors: 0, ok: false, W: W0 }; }
  if (W0.wireShort) {
    const path = jackPath(panel, wires, 'PS.p1', 'PS.n1');
    add('err', '+24V와 0V가 선으로 바로 이어져 있어요 (단락). 전원을 넣으면 바로 차단돼요. 빨간색으로 깜빡이는 선을 확인하세요.', path.jacks, { wires: path.wires });
  }
  if (!usedAny(psP)) add('err', 'DC 전원의 +24V(빨간 단자)에서 나가는 선이 없어요.', psP);
  if (!usedAny(psN)) add('err', 'DC 전원의 0V(파란 단자)에서 나가는 선이 없어요.', psN);
  for (const m of panel.rack) if (m.bus) {
    const bp = m.jacks.filter(j => /^bp/.test(j.key)).map(j => j.id), bn = m.jacks.filter(j => /^bn/.test(j.key)).map(j => j.id);
    const need = (m.kind === 'cnt' && panel.hasC) || (m.kind === 'tmr' && panel.hasT);
    if ((usedAny(bp) || need) && W0.r(m.id + '.bp1') !== W0.top && !W0.wireShort) add('err', `${shortTitle(m)}의 + 버스(위쪽 빨간 단자 줄)에 +24V가 안 들어와요. 전원이나 옆 유닛의 + 버스와 이어 주세요.` + (need ? ' (이 유닛은 버스 전원이 있어야 동작해요)' : ''), bp.slice(0, 1));
    if ((usedAny(bn) || need) && W0.r(m.id + '.bn1') !== W0.bot && !W0.wireShort) add('err', `${shortTitle(m)}의 − 버스(아래쪽 파란 단자 줄)가 0V에 안 이어졌어요.` + (need ? ' (이 유닛은 버스 전원이 있어야 동작해요)' : ''), bn.slice(0, 1));
  }

  // 버스 전원이 빠진 유닛은 이어졌다고 치고 나머지를 검사 (전원 문제 때문에 생기는 엉뚱한 지적을 막음)
  const virt = [];
  if (!W0.wireShort) for (const m of panel.rack) if (m.bus) {
    const need = (m.kind === 'cnt' && panel.hasC) || (m.kind === 'tmr' && panel.hasT);
    const bpU = m.jacks.some(j => /^bp/.test(j.key) && used.has(j.id)), bnU = m.jacks.some(j => /^bn/.test(j.key) && used.has(j.id));
    const rp = W0.r(m.id + '.bp1'), rn = W0.r(m.id + '.bn1');
    if ((bpU || need) && rp !== W0.top && rp !== W0.bot) virt.push({ a: 'PS.p1', b: m.id + '.bp1' });
    if ((bnU || need) && rn !== W0.bot && rn !== W0.top) virt.push({ a: 'PS.n1', b: m.id + '.bn1' });
  }
  if (virt.length) W = buildWireNet(panel, wires.concat(virt));
  const net = W.net;

  /* 2) 접점을 거쳐 생기는 단락 */
  if (!W0.wireShort) {
    const sh = sopOf(paths(net, net.top, net.bot).terms);
    if (sh.length) {
      const t = sh[0];
      add('err', `${termText(t)}이 닫히면 +24V가 코일을 거치지 않고 0V로 바로 흘러요 (단락). 접점 다음에는 코일 +로 가야 해요.`, t.via.flatMap(elJacks));
    }
  }

  /* 3) 부하별 비교 */
  const WF = loadFuncs(net);
  const gndW = WF.gnd, topW = WF.top;
  const ref = refFunctions(def);
  const unwired = [];
  for (const L of ref.loads) {
    const fR = L.f;
    const le = net.els.find(e => e.type === L.e.type && e.name === L.e.name);
    const nm = loadText(L.e);
    if (!le) {
      if ((L.e.type === 'tmr' || L.e.type === 'cnt' || L.e.type === 'crst')) {
        const pe = panel.elements.find(x => x.type === L.e.type && x.name === L.e.name);
        if (pe && (used.has(pe.ja) || used.has(pe.jb))) add('err', `${nm}: 유닛 버스 전원이 없어서 동작하지 않아요.`, [pe.ja, pe.jb]);
        else if (pe) unwired.push({ nm, full: nm, j: pe.ja, d: pe.desc });
      }
      continue;
    }
    const lj = elJacks(le);
    if (!usedAny(lj)) { unwired.push({ nm: nm.replace(/ (코일|솔레노이드)$/, ''), full: nm, j: le.src.ja, d: le.src.desc }); continue; }
    const gT = gndW(le.b);
    const fW = WF.F[L.key] ? WF.F[L.key].f : [];
    if (!gT.length) {
      const rev = gndW(le.a).length && topW(le.b).length;
      if (rev) add('err', `${nm}: +와 −가 반대로 꽂혔어요. ${L.e.type === 'coil' ? 'A1(+)에 접점 쪽, A2(−)에 0V' : '+ 단자에 접점 쪽, − 단자에 0V'}를 이어야 해요.`, lj);
      else add('err', `${nm}: ${L.e.type === 'coil' || L.e.type === 'tmr' ? 'A2' : '−'} 단자가 0V에 이어지지 않았어요.`, [le.src.jb]);
      continue;
    }
    const d = diffFunc(fR, fW, ref.F);
    if (!d.missing.length && !d.bad.length) {
      for (const sv of d.shared) add('info', `${nm}: ${sv.K} 자기유지 점에서 전원을 받았어요(접점 공유). "${termText(sv.w)}" 동안에도 켜지지만 ${josa(sv.K, '이', '가')} 바로 켜져서 동작은 같아요.`, sv.w.via.flatMap(elJacks));
      continue;
    }
    if (!fW.length) {
      const tr = traceRef(panel, net, L, le, fR[0], nm, deg);
      add('err', `${nm}: +24V가 들어올 길이 없어요. ` + tr.t.replace(/^[^:]+: /, ''), tr.j);
      continue;
    }
    const msgs = [];
    for (const r of d.missing) {
      const self = L.e.type === 'coil' && r.lits.includes(L.e.name + '+');
      if (self && !fW.some(w => w.lits.includes(L.e.name + '+'))) {
        msgs.push({ t: `${nm} 회로: 자기유지 접점(${L.e.name} a접점)이 빠졌어요. ${josa(L.e.name, '이', '가')} 켜진 뒤에도 계속 켜져 있으려면 시작 접점과 병렬로 ${L.e.name} a접점(${wantTerm(panel, L.e.name + '+')} 등)을 넣어야 해요.`, j: lj });
        continue;
      }
      const best = bestMatch(r, fW);
      const simple = best ? simpleDiff(panel, L, r, best, nm) : null;
      msgs.push(...(simple || [traceRef(panel, net, L, le, r, nm, deg)]));
    }
    for (const w of d.bad) {
      if (!w.lits.length) { msgs.push({ t: `${nm}에 +24V가 접점 없이 바로 들어가요. 늘 켜져 있게 돼요.`, j: lj }); continue; }
      const best = bestMatch(w, fR);
      const simple = best ? simpleDiff(panel, L, best, w, nm) : null;
      if (simple && simple.length) msgs.push(...simple);
      else msgs.push({ t: `${nm}: 도면에 없는 길로도 켜져요 — ${w.via.filter(e => e.src).map(e => `${litText(lit(e))}(${e.src.desc})`).join(' → ')}.`, j: w.via.flatMap(elJacks) });
    }
    if (!msgs.length) msgs.push({ t: `${nm}: 켜지는 조건이 도면과 달라요. 도면은 "${fR.map(termText).join('" 또는 "')}", 지금 배선은 "${fW.map(termText).join('" 또는 "')}"예요.`, j: lj });
    const uniq = new Set();
    for (const m of msgs) { if (uniq.has(m.t)) continue; uniq.add(m.t); add('err', m.t, m.j, { load: L.key }); }
  }

  if (unwired.length) {
    const one = unwired.length === 1 ? unwired[0] : null;
    add('err', one ? `${josa(one.full, '이', '가')} 아직 연결되지 않았어요${one.d ? ` (${one.d})` : ''}.` : `아직 안 꽂은 코일·솔레노이드 ${unwired.length}개: ${unwired.map(u => u.nm).join(' · ')}. 그 줄을 꽂으면 같이 검사해요.`, unwired.map(u => u.j));
  }

  /* 4) 센서 전원 */
  for (const n of panel.sNames) {
    const se = net.els.find(e => e.type === 'sen' && e.name === n); if (!se) continue;
    const js = elJacks(se);
    if (!usedAny(js)) continue;
    if (!gndW(se.b).length) add('err', `${n} 센서: 0V(파란 단자)가 0V에 이어지지 않았어요. 센서는 24V·0V를 다 받아야 출력이 나와요.`, [se.src.jb]);
    if (!topW(se.a).length) add('err', `${n} 센서: 24V(빨간 단자)에 +24V가 안 와요.`, [se.src.ja]);
  }

  /* 5) 도면에 없는 기기 · 설정 */
  const refNames = new Set(ref.R.els.map(e => e.name));
  const warned = new Set();
  for (const el of panel.elements) {
    if (el.type === 'lamp') continue;
    const d = panel.dev[el.name]; if (!d || refNames.has(el.name) || warned.has(el.name)) continue;
    const js = [el.ja, el.jb].concat(el.jo ? [el.jo] : []);
    if (usedAny(js)) {
      warned.add(el.name);
      const why = d.kind === 'relay' ? `도면의 릴레이는 ${panel.relayNames.join('·')}뿐이에요. 유닛에 붙은 이름표(K번호)를 확인하세요.` : d.kind === 'pbs' ? (d.lock ? 'PBS-3는 유지형(LOCK)이라 누름버튼(PB)으로 쓰면 안 돼요.' : '도면에 없는 스위치예요.') : d.kind === 'tmr' ? (panel.hasT ? '문제의 타이머는 ON 딜레이(위쪽)예요.' : '이 도면에는 타이머가 없어요.') : d.kind === 'cnt' ? '이 도면에는 카운터가 없어요.' : '도면에 없는 기기예요.';
      add('warn', `${d.label}에 선이 꽂혀 있어요. ${why}`, js);
    }
  }
  for (const k of ['T1', 'C1']) {
    if (panel.refPre[k] == null) continue;
    if (Math.abs((panel.presets[k] || 0) - panel.refPre[k]) > 1e-6) add('warn', k === 'T1' ? `타이머 설정이 ${(panel.presets.T1 || 0).toFixed(1)}초예요. 문제 조건은 ${panel.refPre.T1.toFixed(1)}초예요. 타이머 유닛 ON Time Delay의 ▲▼로 맞추세요.` : `카운터 Preset이 ${josa(String(panel.presets.C1), '이에요', '예요')}. 문제 조건은 ${panel.refPre.C1}회예요. 카운터 유닛의 ▲▼로 맞추세요.`, k === 'T1' ? [panel.dev.T1.A1] : [panel.dev.C1.ci[0]]);
  }
  const errors = items.filter(i => i.sev === 'err').length;
  if (!errors) add('ok', '도면과 같은 회로로 꽂혀 있어요. "동작 검사"로 2회 동작까지 확인해 보세요.', []);
  return { items, errors, ok: !errors, W: W0, virtual: virt.length > 0 };
}

/* 가장 비슷한 항 */
function bestMatch(r, S) {
  let best = null, bs = -1e9;
  for (const w of S) {
    const inter = r.lits.filter(l => w.lits.includes(l)).length;
    const sc = inter * 3 - (w.lits.length - inter) - (r.lits.length - inter);
    if (sc > bs) { bs = sc; best = w; }
  }
  return best;
}
/* 도면 항 r 과 배선 항 w 의 차이가 단순할 때(a/b 바뀜 · 번호 바뀜 · 접점 하나 더/덜)만 문장으로 */
function simpleDiff(panel, L, r, w, nm) {
  const miss = r.lits.filter(l => !w.lits.includes(l)), ext = w.lits.filter(l => !r.lits.includes(l));
  const viaOf = l => w.via.find(e => lit(e) === l);
  const jacksOf = e => e && e.src ? [e.src.ja, e.src.jb] : [];
  const out = [];
  if (!(miss.length === ext.length || (miss.length + ext.length === 1))) return null;
  for (const l of miss.slice()) {
    const o = opp(l);
    if (!ext.includes(o)) continue;
    const e = viaOf(o);
    out.push({ t: `${nm} 회로: 도면은 ${litText(l)}인데 ${l.endsWith('+') ? 'b' : 'a'}접점${e ? `(${e.src.desc})` : ''}으로 꽂았어요.` + (wantTerm(panel, l, e) ? ` → ${wantTerm(panel, l, e)} 단자를 쓰세요.` : ''), j: jacksOf(e) });
    miss.splice(miss.indexOf(l), 1); ext.splice(ext.indexOf(o), 1);
  }
  const kind = l => /^K/.test(l) ? 'K' : /^LS/.test(l) ? 'LS' : /^PB/.test(l) ? 'PB' : /^S\d/.test(l) ? 'S' : /^T/.test(l) ? 'T' : /^C/.test(l) ? 'C' : '?';
  for (const l of miss.slice()) {
    const cand = ext.find(x => kind(x) === kind(l) && x.slice(-1) === l.slice(-1));
    if (!cand) continue;
    const e = viaOf(cand);
    out.push({ t: `${nm} 회로: 도면은 ${litText(l)}인데 ${litText(cand)}${e ? `(${e.src.desc})` : ''}에 꽂았어요.`, j: jacksOf(e) });
    miss.splice(miss.indexOf(l), 1); ext.splice(ext.indexOf(cand), 1);
  }
  if (miss.length === 1 && !ext.length && L.e.type === 'coil' && miss[0] === L.e.name + '+') {
    out.push({ t: `${nm} 회로: 자기유지 접점(${L.e.name} a접점)이 빠졌어요. ${josa(L.e.name, '이', '가')} 켜진 뒤에도 계속 켜져 있으려면 시작 조건과 병렬로 넣어야 해요.` + (wantTerm(panel, miss[0]) ? ` (예: ${wantTerm(panel, miss[0])})` : ''), j: [] });
    miss.length = 0;
  }
  if (miss.length === 1 && !ext.length) { out.push({ t: `${nm} 회로: 도면의 ${josa(litText(miss[0]), '이', '가')} 빠졌어요.` + (wantTerm(panel, miss[0]) ? ` (예: ${wantTerm(panel, miss[0])})` : ''), j: [] }); miss.length = 0; }
  if (!miss.length && ext.length === 1) {
    const e = viaOf(ext[0]), lt = litText(ext[0]);
    out.push({ t: `${nm} 회로: 도면에 없는 ${lt}${e ? `(${e.src.desc})` : ''}${josa(lt, '이', '가').slice(lt.length)} 들어 있어요.`, j: jacksOf(e) });
    ext.length = 0;
  }
  if (miss.length || ext.length) return null;
  return out.length ? out : null;
}
/* 단자 이름 (사람이 읽는 말) */
const shortTitle = m => m.kind === 'ru' ? '릴레이 유닛' + CIRC[num(m.id) - 1] : m.kind === 'sw' ? '스위치 유닛' + CIRC[num(m.id) - 1] : m.kind === 'cnt' ? '카운터 유닛' : m.kind === 'tmr' ? '타이머 유닛' : m.kind === 'lmp' ? '부저·램프 유닛' : m.kind === 'ps' ? 'DC 전원' : m.title;
function jackName(panel, id) {
  const j = panel.jacks[id]; if (!j) return id;
  const m = panel.mods[j.m], k = j.key;
  if (/^bp\d$/.test(k)) return shortTitle(m) + ' + 버스';
  if (/^bn\d$/.test(k)) return shortTitle(m) + ' − 버스';
  if (m.kind === 'ps') return k[0] === 'p' ? 'DC 전원 +24V' : 'DC 전원 0V';
  if (m.kind === 'ru' || m.kind === 'sw') {
    const [jj, t] = k.split('.');
    const lbl = CIRC[num(m.id) - 1] + (m.kind === 'ru' ? 'RY' : 'PBS-') + jj;
    return `${lbl} ${t === 'L+' ? '램프 +' : t === 'L-' ? '램프 −' : t}`;
  }
  if (m.kind === 'cnt') return { 'ci+': '카운터 Count +', 'ci-': '카운터 Count −', 'rs+': '카운터 Reset +', 'rs-': '카운터 Reset −' }[k] || `카운터 출력 ${k}`;
  if (m.kind === 'tmr') { const [sec, t] = k.split('.'); return `${sec === 'on' ? 'ON' : 'OFF'} 타이머 ${t}`; }
  if (m.kind === 'valve') return k.replace(/\+$/, ' +').replace(/-$/, ' −');
  if (m.kind === 'lmp') return (k.startsWith('BZ') ? '부저' : k.slice(0, 2) + ' 램프') + (k.endsWith('+') ? ' +' : ' −');
  return `${m.id} ${j.label}`;
}
/* 도면의 길을 배선에서 앞(+24V)·뒤(부하)에서 따라가 끊긴 곳 찾기 */
function traceRef(panel, net, L, le, r, nm, deg) {
  deg = deg || {};
  const steps = r.via.filter(e => !e._gnd);
  const n = steps.length;
  const candsOf = e => net.els.filter(c => c.name === e.name && (e.type === 'sen' ? c.type === 'sen' : CONTACT.has(c.type) && lit(c) === lit(e)));
  const termNm = le.type === 'coil' || le.type === 'tmr' ? 'A1' : '+';
  let F = { i: 0, path: [] }, full = false;
  const fwd = (i, node, path) => {
    if (i > F.i) F = { i, path: path.slice() };
    if (i === n) { if (node === le.a) full = true; return full; }
    const opts = [];
    for (const c of candsOf(steps[i])) {
      let nx = null, far = null;
      if (c.type === 'sen') { if (c.a === node) { nx = c.out; far = c.src.jo; } }
      else if (c.a === node) { nx = c.b; far = c.src.jb; } else if (c.b === node) { nx = c.a; far = c.src.ja; }
      if (nx != null) opts.push({ c, nx, far });
    }
    opts.sort((x, y) => (deg[x.far] ? 1 : 0) - (deg[y.far] ? 1 : 0));
    for (const { c, nx, far } of opts) {
      path.push({ c, far });
      if (fwd(i + 1, nx, path)) return true;
      path.pop();
    }
    return false;
  };
  fwd(0, net.top, []);
  if (full) return { t: `${nm}: 도면의 길 "${termText(r)}"이 배선에서 이어지지 않아요.`, j: [le.src.ja] };
  let B = { i: n, c: null, near: le.src.ja };
  const bwd = (i, node) => {
    if (i === 0) return node === net.top;
    for (const c of candsOf(steps[i - 1])) {
      let pv = null, near = null;
      if (c.type === 'sen') { if (c.out === node) { pv = c.a; near = c.src.ja; } }
      else if (c.b === node) { pv = c.a; near = c.src.ja; } else if (c.a === node) { pv = c.b; near = c.src.jb; }
      if (pv == null) continue;
      if (i - 1 < B.i) B = { i: i - 1, c, near };
      if (bwd(i - 1, pv)) return true;
    }
    return false;
  };
  bwd(n, le.a);
  const k = Math.min(F.i, B.i);
  const fEnd = k === 0 ? null : F.path[k - 1];
  const descC = c => `${litText(lit(c))}(${c.src.desc})`;
  const fDesc = fEnd ? descC(fEnd.c) : '+24V';
  const bDesc = B.c ? descC(B.c) : `${nm} ${termNm} 단자`;
  let fJack = fEnd ? fEnd.far : null;
  if (!fJack) { const bm = panel.mods[panel.jacks[B.near].m]; fJack = bm && bm.bus ? bm.id + '.bp2' : 'PS.p1'; }
  const jl = [fJack, B.near];
  if (F.i < B.i) {
    const miss = steps.slice(F.i, B.i).map(e => litText(lit(e)));
    const mt = miss.join(' · ');
    return { t: `${nm} 회로: ${fDesc} 다음에 ${mt}${josa(miss[miss.length - 1], '이', '가').slice(miss[miss.length - 1].length)} 와야 하는데 이어지지 않았어요 (${jackName(panel, fJack)} ~ ${jackName(panel, B.near)} 사이).`, j: jl };
  }
  return { t: `${nm} 회로: ${josa(fDesc, '과', '와')} ${bDesc} 사이에 선이 없어요 → ${jackName(panel, fJack)} ↔ ${jackName(panel, B.near)}에 꽂으세요.`, j: jl };
}

/* 단자 그래프에서 두 단자 사이 경로 (단락 위치 표시용) */
function jackPath(panel, wires, a, b) {
  const g = {};
  const addE = (x, y, w) => { (g[x] = g[x] || []).push({ y, w }); (g[y] = g[y] || []).push({ y: x, w }); };
  for (const [x, y] of panel.internal) addE(x, y, null);
  wires.forEach((w, i) => addE(w.a, w.b, i));
  const prev = { [a]: null }, q = [a];
  while (q.length) { const x = q.shift(); if (x === b) break; for (const { y, w } of g[x] || []) if (!(y in prev)) { prev[y] = { x, w }; q.push(y); } }
  const jacks = [], ws = [];
  if (!(b in prev)) return { jacks, wires: ws };
  for (let x = b; x != null && prev[x]; x = prev[x].x) { jacks.push(x); if (prev[x].w != null) ws.push(prev[x].w); }
  jacks.push(a);
  return { jacks, wires: ws };
}

/* ---------------- 모범 배선 ---------------- */
function autoWire(panel, def) {
  const R = E.buildNet(def);
  const tryOnce = merges => {
    const U = uf(R.nodeCount);
    for (const [x, y] of merges) U.union(x, y);
    const want = [];
    const put = (n, j, why) => want.push({ n, j, why });
    const assign = {};   // 도면 요소 id → 쓰는 단자 (모범 배선)
    const asg = (e, jacks, tag) => { assign[e.id] = { jacks, tag }; };
    const fail = [];
    for (const e of R.els) {
      const d = panel.dev[e.name];
      if (LOAD.has(e.type) || e.type === 'sen') { if (!d) { fail.push(e.name); continue; } }
      if (e.type === 'coil' || e.type === 'tmr') { put(e.a, d.A1); put(e.b, d.A2); asg(e, [d.A1, d.A2], 'A1-A2'); }
      else if (e.type === 'sol') { put(e.a, d.p); put(e.b, d.n); asg(e, [d.p, d.n], '+ −'); }
      else if (e.type === 'cnt') { put(e.a, d.ci[0]); put(e.b, d.ci[1]); asg(e, d.ci.slice(), 'Count + −'); }
      else if (e.type === 'crst') { put(e.a, d.rs[0]); put(e.b, d.rs[1]); asg(e, d.rs.slice(), 'Reset + −'); }
      else if (e.type === 'sen') { put(e.a, d.p); put(e.b, d.n); put(e.out, d.out); asg(e, [d.p, d.out, d.n], '24V·OUT·0V'); }
    }
    const groups = {};
    for (const e of R.els) if (CONTACT.has(e.type)) (groups[e.name] = groups[e.name] || []).push(e);
    const overflow = {};
    for (const name in groups) {
      const d = panel.dev[name]; if (!d) { fail.push(name); continue; }
      const cs = groups[name].slice();
      if (d.kind === 'tmr') {
        let ni = 0, ci = 0;
        for (const c of cs) { const pr = isA(c.type) ? d.noPairs[ni++] : d.ncPairs[ci++]; if (!pr) { overflow[name] = (overflow[name] || 0) + 1; continue; } put(c.a, pr[0]); put(c.b, pr[1]); asg(c, [pr[0], pr[1]], pr[2]); }
        continue;
      }
      // 같은 노드를 쓰는 접점끼리 합치기(merge)에 따라 묶음 정리
      const key = c => [U.find(c.a), U.find(c.b)].sort((x, y) => x - y).join('-') + (isA(c.type) ? 'a' : 'b');
      const uniq = []; const seenK = new Set();
      const twin = {};
      for (const c of cs) { const k = key(c); if (seenK.has(k)) { (twin[k] = twin[k] || []).push(c); continue; } seenK.add(k); uniq.push(c); }
      const poles = d.poles.slice();
      const rest = uniq.slice();
      // a·b 접점이 한 노드를 같이 쓰면 한 극(공통 단자)으로
      for (let i = 0; i < rest.length; i++) for (let k = i + 1; k < rest.length; k++) {
        const c1 = rest[i], c2 = rest[k];
        if (!c1 || !c2 || isA(c1.type) === isA(c2.type)) continue;
        const n1 = [U.find(c1.a), U.find(c1.b)], n2 = [U.find(c2.a), U.find(c2.b)];
        const sh = n1.find(x => n2.includes(x));
        if (sh == null || !poles.length) continue;
        const p = poles.shift();
        const ca = isA(c1.type) ? c1 : c2, cb = isA(c1.type) ? c2 : c1;
        const oth = c => (U.find(c.a) === sh ? c.b : c.a);
        put(sh, p.com); put(oth(ca), p.no); put(oth(cb), p.nc);
        asg(ca, [p.com, p.no], poleTag(d, p, true)); asg(cb, [p.com, p.nc], poleTag(d, p, false));
        rest[i] = rest[k] = null;
      }
      for (const c of rest) {
        if (!c) continue;
        const p = poles.shift();
        if (!p) { overflow[name] = (overflow[name] || 0) + 1; continue; }
        put(c.a, p.com); put(c.b, isA(c.type) ? p.no : p.nc); asg(c, [p.com, isA(c.type) ? p.no : p.nc], poleTag(d, p, isA(c.type)));
      }
    }
    // 같은 노드·같은 종류라 하나로 합친 접점은 같은 단자
    for (const name in groups) for (const c of groups[name]) if (!assign[c.id]) {
      const tw = groups[name].find(x => assign[x.id] && [U.find(x.a), U.find(x.b)].sort().join() === [U.find(c.a), U.find(c.b)].sort().join() && isA(x.type) === isA(c.type));
      const sib = tw || groups[name].find(x => assign[x.id] && isA(x.type) === isA(c.type) && (U.find(x.a) === U.find(c.a) || U.find(x.b) === U.find(c.b) || U.find(x.a) === U.find(c.b) || U.find(x.b) === U.find(c.a)));
      if (sib) assign[c.id] = Object.assign({ shared: true }, assign[sib.id]);
    }
    return { U, want, fail, overflow, assign };
  };
  // 접점이 모자라면 한 노드를 같이 쓰는 같은 종류 접점을 하나로 합쳐 봄 (도면과 동작이 같은 경우만)
  const refF = loadFuncs(R).F;
  let merges = [], res = tryOnce(merges);
  const cand = name => {
    const cs = R.els.filter(e => CONTACT.has(e.type) && e.name === name), out = [];
    for (let i = 0; i < cs.length; i++) for (let k = i + 1; k < cs.length; k++) {
      const a = cs[i], b = cs[k]; if (isA(a.type) !== isA(b.type)) continue;
      for (const [na, oa] of [[a.a, a.b], [a.b, a.a]]) for (const [nb, ob] of [[b.a, b.b], [b.b, b.a]]) if (na === nb && oa !== ob) out.push([oa, ob, na === R.top ? 0 : 1]);
    }
    return out.sort((x, y) => x[2] - y[2]).map(x => [x[0], x[1]]);
  };
  let guard = 0;
  while (Object.keys(res.overflow).length && guard++ < 8) {
    const name = Object.keys(res.overflow)[0];
    let ok = false;
    for (const m of cand(name)) {
      const trial = merges.concat([m]);
      const r2 = tryOnce(trial);
      if ((r2.overflow[name] || 0) >= (res.overflow[name] || 0)) continue;
      if (!mergeOk(R, refF, trial)) continue;
      merges = trial; res = r2; ok = true; break;
    }
    if (!ok) break;
  }
  const wires = layoutWires(panel, R, res);
  const presets = {};
  for (const k of ['T1', 'C1']) if (panel.refPre[k] != null) presets[k] = panel.refPre[k];
  return { wires, overflow: res.overflow, fail: res.fail, merges, presets, assign: res.assign };
}

function poleTag(d, p, a) {
  if (d.kind === 'ls') return 'COM-' + (a ? 'NO' : 'NC');
  if (d.kind === 'cnt') return '1-' + (a ? '4' : '2');
  return `${p.k}1-${p.k}${a ? 4 : 2}`;
}
/* 줄별 배선표: 도면의 줄(번호) 단위로 모범 배선의 선을 묶음 */
function wireGuide(panel, def, auto) {
  const R = E.buildNet(def);
  const mains = R.cols.filter(c => Math.abs(c.y1 - 10) < 1e-6).sort((a, b) => a.x - b.x);
  const rungOf = {};
  mains.forEach((c, i) => { rungOf[c.id] = i + 1; });
  for (const c of R.cols) if (!(c.id in rungOf)) {
    const left = mains.filter(m => m.x <= c.x + 1e-6).pop(), right = mains.find(m => m.x > c.x);
    rungOf[c.id] = rungOf[(left || right).id];
  }
  const jackRung = {};
  for (const e of R.els) {
    const a = auto.assign && auto.assign[e.id]; if (!a) continue;
    const rn = rungOf[e.col];
    for (const j of a.jacks) if (!(j in jackRung) || jackRung[j] > rn) jackRung[j] = rn;
  }
  const groups = mains.map((c, i) => {
    const ld = c.els.filter(e => LOAD.has(e.type) || e.type === 'sen');
    return { no: i + 1, title: ld.length ? ld.map(e => e.type === 'sen' ? e.name + ' 센서' : loadText(e)).join(' · ') : (c.els[0] ? c.els[0].name : ''), wires: [], cols: [] };
  });
  for (const c of R.cols) groups[rungOf[c.id] - 1].cols.push(c.id);
  const power = { no: 0, title: '전원 · 버스 점퍼', wires: [], cols: [] };
  auto.wires.forEach((w, i) => {
    const ra = jackRung[w.a], rb = jackRung[w.b];
    const r = ra != null && rb != null ? Math.min(ra, rb) : ra != null ? ra : rb;
    (r == null ? power : groups[r - 1]).wires.push(i);
  });
  return { groups: [power, ...groups].filter(g => g.wires.length), rungOf };
}

function layoutWires(panel, R, res) {
  const { U, want } = res;
  const top = U.find(R.top), bot = U.find(R.bot);
  const nodeJ = {};
  for (const w of want) { const n = U.find(w.n); (nodeJ[n] = nodeJ[n] || []); if (!nodeJ[n].includes(w.j)) nodeJ[n].push(w.j); }
  const J = id => panel.jacks[id];
  const dist = (a, b) => { const A = J(a), B = J(b); return Math.hypot(A.x - B.x, A.y - B.y); };
  const wires = [];
  const link = (a, b) => { if (a && b && a !== b) wires.push({ a, b }); };
  const modOf = id => panel.mods[J(id).m];
  // 버스 전원: 실습장 시작 상태와 같게 (줄마다 전원 → 첫 유닛 → 옆 유닛 점퍼)
  for (const w of startWires(panel)) link(w.a, w.b);
  const needP = new Set(panel.rack.filter(m => m.bus).map(m => m.id)), needN = needP;
  // +24V · 0V 단자: 유닛 안이면 그 유닛 버스로, 보드 기기면 가까운 곳부터 줄줄이
  const rail = (n, pre, psKey) => {
    const ids = (nodeJ[n] || []).slice();
    const rot = {};
    const fieldIds = [];
    for (const id of ids) {
      const m = modOf(id);
      if (m.bus) { rot[m.id] = (rot[m.id] || 0) % 4 + 1; link(m.id + '.' + pre + (rot[m.id] + 1), id); }
      else if (m.id !== 'PS') fieldIds.push(id);
    }
    if (fieldIds.length) {
      // 가장 가까운 버스 단자(또는 전원)에서 시작해 가까운 단자 순으로
      const srcs = [psKey + '2'].concat(panel.rack.filter(m => m.bus && (pre === 'bp' ? needP : needN).has(m.id)).map(m => m.id + '.' + pre + '3'));
      let cur = srcs.reduce((b, s) => (!b || dist(s, fieldIds[0]) < dist(b, fieldIds[0]) ? s : b), null);
      const left = fieldIds.slice();
      // 가장 위쪽-왼쪽부터
      left.sort((a, b) => J(a).y - J(b).y || J(a).x - J(b).x);
      cur = srcs.reduce((b, s) => (!b || dist(s, left[0]) < dist(b, left[0]) ? s : b), null);
      while (left.length) {
        let bi = 0; for (let i = 1; i < left.length; i++) if (dist(cur, left[i]) < dist(cur, left[bi])) bi = i;
        const nx = left.splice(bi, 1)[0]; link(cur, nx); cur = nx;
      }
    }
  };
  rail(top, 'bp', 'PS.p'); rail(bot, 'bn', 'PS.n');
  // 나머지 노드: 가까운 단자끼리 줄줄이
  for (const n in nodeJ) {
    const k = +n; if (k === top || k === bot) continue;
    const ids = nodeJ[n].slice(); if (ids.length < 2) continue;
    ids.sort((a, b) => J(a).y - J(b).y || J(a).x - J(b).x);
    let cur = ids.shift();
    while (ids.length) { let bi = 0; for (let i = 1; i < ids.length; i++) if (dist(cur, ids[i]) < dist(cur, ids[bi])) bi = i; const nx = ids.splice(bi, 1)[0]; link(cur, nx); cur = nx; }
  }
  return wires;
}

/* 시작 상태: DC 전원(+ 빨강 · − 파랑) → 랙 줄마다 첫 유닛 버스, 옆 유닛끼리 버스 점퍼 */
function startWires(panel) {
  const rows = {};
  for (const m of panel.rack) if (m.bus) (rows[m.y] = rows[m.y] || []).push(m);
  const wires = [];
  for (const y of Object.keys(rows).map(Number).sort((a, b) => a - b)) {
    const ms = rows[y].sort((a, b) => a.x - b.x);
    wires.push({ a: 'PS.p3', b: ms[0].id + '.bp1' }, { a: 'PS.n1', b: ms[0].id + '.bn1' });
    for (let i = 1; i < ms.length; i++) wires.push({ a: ms[i - 1].id + '.bp6', b: ms[i].id + '.bp1' }, { a: ms[i - 1].id + '.bn6', b: ms[i].id + '.bn1' });
  }
  return wires;
}
/* 대응표: 도면 이름 → 실제 기기 */
function mapTable(panel) {
  const rows = [];
  for (const n of panel.relayNames) rows.push([n, panel.dev[n].label]);
  for (const n of panel.pbNames) if (panel.dev[n]) rows.push([n, panel.dev[n].label + ' (자동복귀)']);
  for (const n of panel.lsNames) rows.push([n, '리밋스위치 ' + n]);
  for (const n of panel.sNames) rows.push([n, '근접센서(PNP) ' + n]);
  if (panel.hasT) rows.push(['T1', '타이머 유닛 ON Time Delay']);
  if (panel.hasC) rows.push(['C1', '카운터 유닛']);
  return rows;
}

/* ======================================================================
   공압 배관 (관) — 포트 이름 · 공기 흐름 · 배관 검사 · 모범 배관
   ====================================================================== */
const valveName = (panel, mid) => { const v = panel.air.valves.find(x => x.mod === mid); return v ? v.coils.join('·') + ' 밸브' : mid; };
function portName(panel, id) {
  const A = panel.air, p = A && A.ports[id]; if (!p) return id;
  if (A.medium === 'oil') return oilPortName(panel, id);
  const m = panel.mods[p.m];
  if (m.kind === 'frl') return '서비스 유닛 출구(OUT)';
  if (m.kind === 'dist') return p.key === 'IN' ? '분배기 입구(IN)' : `분배기 출구 ${p.key}`;
  if (m.kind === 'cyl') return `실린더 ${m.act} ${p.key === 'CAP' ? '헤드 쪽' : '로드 쪽'} 포트`;
  if (m.kind === 'sc') { const s = A.scs.find(x => x.mod === m.id); return `속도 제어 밸브${CIRC[s.n - 1]} ${p.key === '1' ? '아래' : '위'} 구멍`; }
  if (m.kind === 'valve') return `${valveName(panel, m.id)} ${p.key} 포트`;
  return id;
}
function oilPortName(panel, id) {
  const A = panel.air, p = A.ports[id]; if (!p) return id;
  const m = panel.mods[p.m], k = p.key;
  if (m.kind === 'hpu') return k === 'P' ? '파워 유닛 P(압력)' : '파워 유닛 T(탱크)';
  if (m.kind === 'hdist') return `${m.id === 'DA' ? 'P' : 'T'} 분배기 ${k === 'IN' ? '입구(IN)' : '출구 ' + k}`;
  if (m.kind === 'hmc') return `멀티 커넥터 ${k}`;
  if (m.kind === 'cyl') return `실린더 ${m.act} ${k === 'CAP' ? '헤드 쪽' : '로드 쪽'} 포트`;
  if (m.kind === 'motor') return `모터 ${m.act} ${k === 'L' ? (m.bi ? 'A(왼쪽)' : '입구(왼쪽)') : (m.bi ? 'B(오른쪽)' : '출구(오른쪽)')} 포트`;
  if (m.kind === 'valve') {
    if (m.sup) { const sp = A.sups.find(x => x.mod === m.id); return `${sp.coil} 공급 밸브 ${k}`; }
    return `${valveName(panel, m.id)} ${k} 포트`;
  }
  const c = A.comps.find(x => x.mod === m.id);
  const pk = { '1': '1(들어가는 쪽)', '2': '2(나가는 쪽)', X: 'X(파일럿)', IN: 'IN', OUT: 'OUT(탱크)', P: 'P', T: 'T(탱크)', P1: 'P1(1차)', P2: 'P2(2차)' }[k] || k;
  return `${c ? c.title.replace(/ \(.*\)$/, '') : m.title} ${pk}`;
}
/* 저장된 관 정리: 없는 포트 · 같은 관 두 번은 버림 */
function validTubes(panel, tubes) {
  const A = panel.air; if (!A) return [];
  const seen = new Set();
  return (tubes || []).filter(t => {
    if (!t || !A.ports[t.a] || !A.ports[t.b] || t.a === t.b) return false;
    const k = [t.a, t.b].sort().join('|'); if (seen.has(k)) return false; seen.add(k); return true;
  });
}
/* 공기 흐름 모델 — 시뮬레이터(Sim)에 def.__air 로 넘기면 실린더 움직임을 관 연결대로 정함
   · 분배기 구멍끼리, 속도 제어 밸브 두 구멍은 안에서 이어짐 (속도 제어는 통과로 봄)
   · 밸브 칸 0 = P→A, B→배기 / 칸 1 = P→B, A→배기 (스풀은 양방향)
   · 관이 안 꽂힌 밸브·실린더·속도 제어 구멍은 대기로 열림 (압력이 오면 샘). 서비스 유닛 출구·분배기 구멍은 막힘(셀프 실)
   · 실린더: 헤드 쪽에 압력 + 로드 쪽 배기 → 전진, 반대 → 후진, 그 밖에는 멈춤 */
function airModel(panel, tubes, opt) {
  const A = panel.air; if (!A) return null;
  if (A.medium === 'oil') return oilModel(panel, tubes, opt);
  tubes = validTubes(panel, tubes);
  const ids = A.portIds, ix = A.portIdx, N = ids.length;
  const U = uf(N);
  for (const g of A.pass) for (let i = 1; i < g.length; i++) U.union(ix[g[0]], ix[g[i]]);
  const deg = {};
  for (const t of tubes) { U.union(ix[t.a], ix[t.b]); deg[t.a] = (deg[t.a] || 0) + 1; deg[t.b] = (deg[t.b] || 0) + 1; }
  const nd = new Int32Array(N); for (let i = 0; i < N; i++) nd[i] = U.find(i);
  const node = id => nd[ix[id]];
  const open0 = new Uint8Array(N), openPorts = [];
  for (const id of ids) if (A.ports[id].open && !deg[id]) { open0[node(id)] = 1; openPorts.push(id); }
  const V = A.valves.map(v => ({ act: v.act, mod: v.mod, P: node(v.P), A: node(v.A), B: node(v.B) }));
  const C = A.cyls.map(c => ({ act: c.act, cap: node(c.CAP), rod: node(c.ROD), CAP: c.CAP, ROD: c.ROD }));
  const srcN = node(A.src);
  const cache = {};
  const solveFor = (boxes, on) => {
    const D = uf(N), vent = open0.slice(), exh = [];
    V.forEach((v, i) => {
      if (boxes[i] === 0) { D.union(v.P, v.A); vent[v.B] = 1; exh.push({ mod: v.mod, side: 'B', n: v.B }); }
      else { D.union(v.P, v.B); vent[v.A] = 1; exh.push({ mod: v.mod, side: 'A', n: v.A }); }
    });
    const fl = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (nd[i] === i && vent[i]) fl[D.find(i)] |= 2;
    if (on) fl[D.find(srcN)] |= 1;
    const reg = new Int32Array(N); for (let i = 0; i < N; i++) reg[i] = D.find(nd[i]);
    const stN = n => { const f = fl[D.find(n)]; return f & 1 ? (f & 2 ? 'leak' : 'p') : (f & 2 ? 'x' : 'h'); };
    const cmd = {};
    for (const c of C) {
      const a = stN(c.cap), b = stN(c.rod), ap = a === 'p' || a === 'leak', bp = b === 'p' || b === 'leak';
      cmd[c.act] = ap && b === 'x' ? 'ext' : bp && a === 'x' ? 'ret' : 'stop';
    }
    const portSt = {}; ids.forEach((id, i) => { portSt[id] = stN(nd[i]); });
    const leaks = openPorts.filter(id => portSt[id] === 'p' || portSt[id] === 'leak');
    const ex = exh.map(e => ({ mod: e.mod, side: e.side, reg: D.find(e.n), blow: !!(fl[D.find(e.n)] & 1) }));
    return { cmd, portSt, leaks, exh: ex, reg, on };
  };
  return {
    on: !(opt && opt.on === false), tubes, node, deg, openPorts, cyls: C,
    state(sim) {
      const boxes = V.map(v => { const st = sim && sim.acts[v.act]; return st ? st.box : 1; });
      const key = boxes.join('') + (this.on ? '1' : '0');
      return cache[key] || (cache[key] = solveFor(boxes, this.on));
    },
    apply(sim) {
      const s = this.state(sim);
      for (const c of C) { const st = sim.acts[c.act]; if (st) st.cmd = s.cmd[c.act]; }
      sim.air = s;
    },
  };
}
/* 배관 검사: 도면(공압 회로도)과 같은 길로 관이 꽂혔는지 — 틀린 곳을 포트 이름으로 */
function analyzeAir(panel, tubes, P) {
  const A = panel.air; if (!A) return null;
  if (A.medium === 'oil') return analyzeOil(panel, tubes, P);
  tubes = validTubes(panel, tubes);
  const items = [];
  const add = (sev, text, ports, extra) => items.push(Object.assign({ sev, text, ports: ports || [], tubes: [] }, extra || {}));
  const pn = id => portName(panel, id);
  if (!tubes.length) {
    add('info', '아직 꽂은 관이 없어요. 공압 보드의 포트(흰 구멍)를 누르고 이을 포트를 누르면 관이 생겨요. 서비스 유닛 → 분배기 → 각 밸브 P, 밸브 A·B → 실린더 순서로 꽂아요.', [A.src, A.din]);
    return { items, errors: 0, ok: false };
  }
  const at = {};
  tubes.forEach((t, i) => { (at[t.a] = at[t.a] || []).push(i); (at[t.b] = at[t.b] || []).push(i); });
  for (const id in at) if (at[id].length > 1) add('err', `${pn(id)}에 관이 ${at[id].length}개 꽂혀 있어요. 한 구멍에는 관 하나만 꽂혀요 — 나눠 보내려면 분배기의 남은 출구를 써요.`, [id], { tubes: at[id] });
  const other = (i, id) => tubes[i].a === id ? tubes[i].b : tubes[i].a;
  const partner = id => at[id] ? { p: other(at[id][0], id), i: at[id][0] } : null;
  const scOf = id => A.scs.find(s => s.p1 === id || s.p2 === id);
  const used = new Set();
  // 관 따라가기 (속도 제어 밸브는 통과)
  const follow = start => {
    const via = [], ts = []; let cur = start;
    for (let g = 0; g < 8; g++) {
      const q = partner(cur);
      if (!q) return { end: null, via, ts, open: g ? cur : null };
      ts.push(q.i);
      const s = scOf(q.p);
      if (s && !via.includes(s)) { via.push(s); cur = q.p === s.p1 ? s.p2 : s.p1; continue; }
      return { end: q.p, via, ts };
    }
    return { end: null, via, ts, open: null };
  };
  const M = airModel(panel, tubes);
  const srcN = M.node(A.src);
  const inSup = id => M.node(id) === srcN;
  const freeOut = () => A.distOut.filter(id => !at[id]).slice(0, 1);
  // 1) 공급
  const fq = partner(A.src);
  const supplyOk = !!fq && M.node(A.din) === srcN;
  if (!fq) add('err', '공기 공급: 서비스 유닛 출구(OUT) → 분배기 입구(IN) 관이 없어요. 여기부터 꽂아야 밸브로 공기가 가요.', [A.src, A.din]);
  else {
    used.add(fq.i);
    const pp = A.ports[fq.p];
    if (pp.role !== 'din' && pp.role !== 'dout') add('warn', `서비스 유닛 출구가 ${pn(fq.p)}에 바로 꽂혀 있어요. 실습장에서는 서비스 유닛 → 분배기 입구 → 각 밸브 P로 나눠 보내요.`, [A.src, fq.p, A.din], { tubes: [fq.i] });
    else if (pp.role === 'dout') add('info', `서비스 유닛 출구가 분배기 출구 ${pp.key}에 꽂혀 있어요. 분배기는 안에서 다 이어져 있어 공기는 가지만, 입구(IN)에 꽂는 게 기본이에요.`, [A.src, fq.p, A.din], { tubes: [fq.i] });
  }
  // 2) 밸브마다: P ← 공급, A → 헤드 쪽, B → 로드 쪽 (도면의 속도 제어 밸브 포함)
  const cylDone = new Set();
  for (const v of A.valves) {
    const X = v.act, cyl = A.cyls.find(c => c.act === X), vn = valveName(panel, v.mod), fc = A.fc[X] || null;
    const sc = A.scs.find(s => s.act === X);
    const pq = partner(v.P);
    if (!pq) add('err', `${vn} P 포트(공급)가 비어 있어요 → 분배기 출구 하나와 이어 주세요.`, [v.P, ...freeOut()], { act: X });
    else {
      used.add(pq.i);
      const pp = A.ports[pq.p];
      if (pp.role !== 'dout' && pp.role !== 'din' && pp.role !== 'src') add('err', `${vn} P 포트가 ${pn(pq.p)}에 꽂혀 있어요. P(1번)는 공급이라 분배기 출구에서 받아야 해요.`, [v.P, pq.p, ...freeOut()], { tubes: [pq.i], act: X });
      else if (!inSup(v.P) && fq) add('err', `${vn} P 포트는 분배기에 꽂혔는데 분배기까지 공기가 안 와요.`, [v.P, A.src], { act: X });
    }
    const fa = follow(v.A), fb = follow(v.B);
    if (fa.end === cyl.ROD && fb.end === cyl.CAP) {
      fa.ts.concat(fb.ts).forEach(i => used.add(i)); cylDone.add(cyl.CAP); cylDone.add(cyl.ROD);
      const now = v.dbl ? `${josa(v.coils[0], '이', '가')} 켜지면 후진, ${josa(v.coils[1], '이', '가')} 켜지면 전진해요` : `${josa(v.coils[0], '이', '가')} 꺼져 있으면 전진, 켜지면 후진해요`;
      add('err', `실린더 ${X}: ${vn}의 A·B 관이 서로 바뀌었어요. A(4번) → 헤드 쪽, B(2번) → 로드 쪽으로 바꿔 꽂으세요. 지금은 거꾸로 — ${now}.`, [v.A, v.B, cyl.CAP, cyl.ROD], { tubes: fa.ts.concat(fb.ts), act: X });
      continue;
    }
    for (const [side, f] of [['A', fa], ['B', fb]]) {
      const tgt = side === 'A' ? cyl.CAP : cyl.ROD, tside = side === 'A' ? '헤드 쪽' : '로드 쪽', vp = side === 'A' ? v.A : v.B;
      const needSC = (fc === 'cap' && side === 'A') || (fc === 'rod' && side === 'B');
      f.ts.forEach(i => used.add(i));
      if (!f.ts.length) {
        add('err', `${vn} ${side} 포트가 비어 있어요 → 실린더 ${X} ${tside} 포트와 이어 주세요${needSC ? ' (속도 제어 밸브를 거쳐서)' : ''}. 비어 있으면 그 구멍으로 공기가 새요.`, needSC && sc ? [vp, sc.p1, sc.p2, tgt] : [vp, tgt], { act: X });
        continue;
      }
      if (f.end == null) {
        add('err', `${vn} ${side} 포트에서 속도 제어 밸브까지는 이었는데 그다음이 비어 있어요 → ${pn(f.open)} → 실린더 ${X} ${tside} 포트.`, [f.open, tgt], { tubes: f.ts, act: X });
        continue;
      }
      if (f.end !== tgt) {
        const ep = A.ports[f.end], em = panel.mods[ep.m];
        let msg;
        if (em.kind === 'cyl' && em.act === X) msg = `${vn} ${side} 포트가 실린더 ${X} ${ep.key === 'CAP' ? '헤드 쪽' : '로드 쪽'}에 꽂혀 있어요. ${side}${side === 'A' ? '(4번)는' : '(2번)는'} ${tside}이에요.`;
        else if (em.kind === 'cyl') msg = `${vn} ${side} 포트가 실린더 ${em.act}에 꽂혀 있어요. 도면에서 ${vn}는 실린더 ${X}를 움직여요 → 실린더 ${X} ${tside} 포트로.`;
        else if (ep.role === 'dout' || ep.role === 'din' || ep.role === 'src') msg = `${vn} ${side} 포트가 공급(${pn(f.end)})에 꽂혀 있어요. 공급은 P 포트로 받고, ${side}는 실린더 ${X} ${tside}로 보내요.`;
        else if (em.kind === 'valve') msg = `${vn} ${side} 포트가 ${pn(f.end)}에 꽂혀 있어요. 밸브 출구끼리는 잇지 않아요 → 실린더 ${X} ${tside} 포트로.`;
        else msg = `${vn} ${side} 포트가 ${pn(f.end)}에 꽂혀 있어요 → 실린더 ${X} ${tside} 포트로.`;
        if (ep.role === 'CAP' || ep.role === 'ROD') cylDone.add(f.end);
        add('err', msg, [vp, f.end, tgt], { tubes: f.ts, act: X });
        continue;
      }
      cylDone.add(tgt);
      if (needSC && !f.via.length) add('err', `도면에는 실린더 ${X} ${tside} 관에 속도 제어 밸브가 있어요 → ${vn} ${side} → 속도 제어 밸브 → 실린더 ${X} ${tside} 순서로 꽂으세요.`, sc ? [vp, sc.p1, sc.p2, tgt] : [vp, tgt], { tubes: f.ts, act: X });
      else if (!needSC && f.via.length) add('warn', `실린더 ${X} ${tside} 관에 도면에 없는 속도 제어 밸브가 들어가 있어요.` + (fc ? ` 도면에서 속도 제어는 ${fc === 'cap' ? '헤드 쪽' : '로드 쪽'} 관이에요.` : ''), [vp, tgt, ...f.via.flatMap(s => [s.p1, s.p2])], { tubes: f.ts, act: X });
    }
  }
  // 3) 실린더 포트가 밸브를 거치지 않고 공급에 바로 / 비어 있음
  for (const c of A.cyls) for (const key of ['CAP', 'ROD']) {
    const id = c[key]; if (cylDone.has(id)) continue;
    const q = partner(id), side = key === 'CAP' ? '헤드 쪽' : '로드 쪽', v = A.valves.find(x => x.act === c.act);
    if (q && inSup(id)) { used.add(q.i); add('err', `실린더 ${c.act} ${side} 포트가 공급(${pn(q.p)})에 바로 꽂혀 있어요 → 늘 공기가 들어가서 멈추지 않아요. ${valveName(panel, v.mod)} ${key === 'CAP' ? 'A' : 'B'} 포트를 거쳐야 해요.`, [id, q.p], { tubes: [q.i], act: c.act }); }
  }
  // 4) 남은 관
  tubes.forEach((t, i) => {
    if (used.has(i)) return;
    const ra = A.ports[t.a].role, rb = A.ports[t.b].role;
    const dd = r => r === 'dout' || r === 'din';
    if (dd(ra) && dd(rb)) add('warn', `분배기 구멍끼리 이은 관은 필요 없어요 (${pn(t.a)} ↔ ${pn(t.b)}).`, [t.a, t.b], { tubes: [i] });
    else add('warn', `도면에 없는 관이에요: ${pn(t.a)} ↔ ${pn(t.b)}.`, [t.a, t.b], { tubes: [i] });
  });
  const errors = items.filter(i => i.sev === 'err').length;
  if (!errors) add('ok', '공압 회로도와 같은 길로 관이 꽂혀 있어요.', []);
  return { items, errors, ok: !errors, supplyOk };
}
/* 모범 배관: 서비스 유닛 → 분배기 → 각 밸브 P, A → (속도 제어) → 헤드 쪽, B → (속도 제어) → 로드 쪽 */
function autoPipe(panel) {
  const A = panel.air; if (!A) return { tubes: [], groups: [] };
  if (A.medium === 'oil') return autoHose(panel);
  const tubes = [], groups = [];
  const g0 = { title: '공기 공급 — 서비스 유닛 → 분배기 → 밸브 P', tubes: [], act: null };
  const put = (g, a, b) => { g.tubes.push(tubes.length); tubes.push({ a, b }); };
  put(g0, A.src, A.din);
  const vs = A.valves.slice().sort((x, y) => A.ports[x.P].x - A.ports[y.P].x);
  vs.forEach((v, k) => put(g0, A.distOut[k], v.P));
  groups.push(g0);
  for (const v of A.valves) {
    const c = A.cyls.find(x => x.act === v.act), s = A.scs.find(x => x.act === v.act);
    const g = { title: `실린더 ${v.act} — ${valveName(panel, v.mod)}`, tubes: [], act: v.act };
    for (const [vp, cp, side] of [[v.A, c.CAP, 'cap'], [v.B, c.ROD, 'rod']]) {
      if (s && s.side === side) { put(g, vp, s.p1); put(g, s.p2, cp); } else put(g, vp, cp);
    }
    groups.push(g);
  }
  return { tubes, groups };
}

/* ---------------- 유압 (호스 · 퀵 커플러) ---------------- */
/* 정적 네트: 호스 + 분배기 · 멀티 커넥터 안쪽 연결 */
function portNets(panel, tubes) {
  const A = panel.air, ix = A.portIdx, N = A.portIds.length, U = uf(N);
  for (const g of A.pass) for (let i = 1; i < g.length; i++) U.union(ix[g[0]], ix[g[i]]);
  for (const t of tubes) U.union(ix[t.a], ix[t.b]);
  const nd = new Int32Array(N); for (let i = 0; i < N; i++) nd[i] = U.find(i);
  return { nd, node: id => nd[ix[id]] };
}
/* 유압 흐름 모델 (Sim def.__air)
   · 퀵 커플러는 안 꽂으면 막힘(새지 않음) → T(복귀)를 안 꽂으면 실린더가 못 움직임
   · 밸브 칸: par = P→A·B→T, cross = P→B·A→T, closed = 막힘, abt = A·B·T 연결, open = P→A(2/2), shut
   · 체크밸브는 1 → 2로만, 파일럿 체크는 X에 압력이 있으면 거꾸로도, 카운터밸런스 · 유량제어 · 감압은 양쪽 통과,
     블리드오프 · 릴리프(서지압)는 흐름 방향에는 영향 없음(속도만)
   · 펌프 ON + P 볼밸브 열림 → P가 압력원, T 볼밸브 열림 → T가 탱크. P와 T가 바로 이어지면(단락) 압력이 안 생겨 아무것도 안 움직임
   · 실린더: 헤드 쪽 압력 + 로드 쪽이 탱크로 빠짐 → 전진 (반대 → 후진), 모터: A 압력 + B 복귀 → 정회전
   · 응용 속도: 미터아웃 · 블리드오프 · 미터인이 도면 자리에 있어야 문제의 속도가 됨 */
function oilModel(panel, tubes, opt) {
  const A = panel.air;
  tubes = validTubes(panel, tubes);
  const ids = A.portIds, N = ids.length;
  const { nd, node } = portNets(panel, tubes);
  const V = A.valves.map(v => ({ act: v.act, mod: v.mod, two: v.two, P: node(v.P), A: node(v.A), B: v.B ? node(v.B) : -1, T: v.T ? node(v.T) : -1 }));
  const S = A.sups.map(s => ({ act: s.act, IN: node(s.IN), OUT: node(s.OUT) }));
  const fixed = [], pilots = [];
  for (const c of A.comps) {
    const p = k => node(c.ports[k]);
    if (c.kind === 'hck' || c.kind === 'hmu') fixed.push([p('1'), p('2'), 1]);
    else if (c.kind === 'hcb' || c.kind === 'hfc' || c.kind === 'hthr') fixed.push([p('1'), p('2'), 0]);
    else if (c.kind === 'hprv') fixed.push([p('P1'), p('P2'), 0]);
    else if (c.kind === 'hpoc') pilots.push({ a: p('1'), b: p('2'), x: p('X') });
  }
  const C = A.cyls.map(c => ({ act: c.act, cap: node(c.CAP), rod: node(c.ROD), CAP: c.CAP, ROD: c.ROD }));
  const Mo = A.motors.map(m => ({ act: m.act, a: node(m.L), b: node(m.R), CAP: m.L, ROD: m.R }));
  const srcN = node(A.src), sinkN = node(A.sink);
  // 응용 속도 (꽂은 자리로 정함): 미터아웃은 기름이 빠져나가는 쪽 움직임을, 거꾸로 꽂으면(미터인) 들어가는 쪽 움직임을 느리게
  const tOv = {};
  for (const c of A.cyls) tOv[c.act] = { ext: null, ret: null, sp: null };
  for (const m of A.motors) tOv[m.act] = { ext: null, ret: null, sp: null };
  const sp = act => A.spec[act] || {};
  const T0 = { cap: 'ret', rod: 'ext' }, T1 = { cap: 'ext', rod: 'ret' };
  const tankSide = n => { const S2 = new Set([sinkN]); return S2.has(n) || n === node(A.tin); };
  for (const c of A.comps) {
    if (c.kind === 'hfc') {
      for (const cy of A.cyls) for (const [side, pid] of [['cap', cy.CAP], ['rod', cy.ROD]]) {
        const s2 = sp(cy.act);
        if (node(c.ports['2']) === node(pid)) { const d = T0[side]; tOv[cy.act][d] = (d === 'ext' ? s2.tExt : s2.tRet) || 5; }
        else if (node(c.ports['1']) === node(pid)) { const d = T1[side]; tOv[cy.act][d] = (d === 'ext' ? s2.tExt : s2.tRet) || 5; }
      }
    } else if (c.kind === 'hbl') {
      for (const cy of A.cyls) if (node(c.ports.IN) === node(cy.CAP) && tankSide(node(c.ports.OUT))) tOv[cy.act].ext = sp(cy.act).tExt || 2.4;
    } else if (c.kind === 'hthr') {
      for (const m of A.motors) {
        const v = A.valves.find(x => x.act === m.act), s = A.sups.find(x => x.act === m.act);
        const near = [v && v.P, s && s.IN, s && s.OUT].filter(Boolean).map(node);
        if (near.includes(node(c.ports['1'])) || near.includes(node(c.ports['2']))) tOv[m.act].sp = sp(m.act).speed || 0.5;
      }
    }
  }
  const glyphEdges = (g, v) => g === 'par' ? [[v.P, v.A], [v.B, v.T]] : g === 'cross' ? [[v.P, v.B], [v.A, v.T]] : g === 'abt' ? [[v.A, v.T], [v.B, v.T]] : g === 'open' ? [[v.P, v.A]] : [];
  const cache = {};
  const solveFor = (st, on, bvP, bvT) => {
    const both = [], one = fixed.filter(e => e[2] === 1).map(e => [e[0], e[1]]);
    for (const e of fixed) if (e[2] === 0) both.push([e[0], e[1]]);
    V.forEach((v, i) => { for (const e of glyphEdges(st.g[i], v)) if (e[0] >= 0 && e[1] >= 0) both.push(e); });
    S.forEach((s, i) => { if (st.s[i] === 'open') both.push([s.IN, s.OUT]); });
    const adjF = {}, adjR = {};
    const addE = (a, b) => { (adjF[a] = adjF[a] || []).push(b); (adjR[b] = adjR[b] || []).push(a); };
    for (const [a, b] of both) { addE(a, b); addE(b, a); }
    for (const [a, b] of one) addE(a, b);
    const bfs = (start, adj, extra) => { const seen = new Set(); if (start == null) return seen; const q = [start]; seen.add(start); while (q.length) { const n = q.pop(); for (const m of (adj[n] || []).concat(extra[n] || [])) if (!seen.has(m)) { seen.add(m); q.push(m); } } return seen; };
    // 파일럿 체크: 1 → 2 늘 통과, X에 압력이 오면 2 → 1도
    const fwdX = {}, revX = {};
    for (const pc of pilots) (fwdX[pc.a] = fwdX[pc.a] || []).push(pc.b), (revX[pc.b] = revX[pc.b] || []).push(pc.a);
    const src = on && bvP ? srcN : null, sink = bvT ? sinkN : null;
    let Pset = bfs(src, adjF, fwdX), open = new Set();
    for (let it = 0; it < 4; it++) {
      let ch = false;
      for (const pc of pilots) if (!open.has(pc) && Pset.has(pc.x)) { open.add(pc); (fwdX[pc.b] = fwdX[pc.b] || []).push(pc.a); (revX[pc.a] = revX[pc.a] || []).push(pc.b); ch = true; }
      if (!ch) break;
      Pset = bfs(src, adjF, fwdX);
    }
    const D = bfs(sink, adjR, revX);
    const short = src != null && D.has(src);
    if (short) Pset = new Set();
    const cmd = {};
    for (const c of C) cmd[c.act] = Pset.has(c.cap) && D.has(c.rod) ? 'ext' : Pset.has(c.rod) && D.has(c.cap) ? 'ret' : 'stop';
    for (const m of Mo) cmd[m.act] = Pset.has(m.a) && D.has(m.b) ? 'cw' : Pset.has(m.b) && D.has(m.a) ? 'ccw' : 'stop';
    // 색칠 · 흐름 표시용 영역 (양방향 연결만)
    const RU = uf(N); for (const [a, b] of both) RU.union(a, b); for (const [a, b] of one) RU.union(a, b);
    for (const pc of pilots) if (open.has(pc)) RU.union(pc.a, pc.b); else RU.union(pc.a, pc.b);
    const reg = new Int32Array(N); for (let i = 0; i < N; i++) reg[i] = RU.find(nd[i]);
    const portSt = {}; ids.forEach((id, i) => { const n = nd[i]; portSt[id] = Pset.has(n) ? 'p' : D.has(n) ? 'x' : 'h'; });
    return { cmd, portSt, leaks: [], exh: [], reg, on, short, press: !!src && !short };
  };
  return {
    oil: true, on: !(opt && opt.on === false), bvP: !(opt && opt.bvP === false), bvT: !(opt && opt.bvT === false), tubes, node, cyls: C.concat(Mo), tOv,
    state(sim) {
      const st = { g: [], s: [] };
      V.forEach(v => { const a = sim && sim.P.acts.find(x => x.id === v.act), x = sim && sim.acts[v.act]; st.g.push(a && x ? a.valve.boxes[x.box] : 'closed'); });
      S.forEach(s => { const a = sim && sim.P.acts.find(x => x.id === s.act), x = sim && sim.acts[s.act]; st.s.push(a && a.supply && x ? a.supply.boxes[x.supplyBox != null ? x.supplyBox : a.supply.home] : 'shut'); });
      const key = st.g.join(',') + '|' + st.s.join(',') + '|' + (this.on ? 1 : 0) + (this.bvP ? 1 : 0) + (this.bvT ? 1 : 0);
      return cache[key] || (cache[key] = solveFor(st, this.on, this.bvP, this.bvT));
    },
    apply(sim) {
      const s = this.state(sim);
      for (const c of C.concat(Mo)) { const st = sim.acts[c.act]; if (st) { st.cmd = s.cmd[c.act]; st.tOv = tOv[c.act]; } }
      sim.air = s;
    },
  };
}
/* 모범 호스: 파워 유닛 → (펌프 체크) → P 분배기, T 분배기 → 파워 유닛 T,
   칸마다 P 분배기 → (미터인 · 감압 · 공급 2/2) → 밸브 P, 밸브 T → T 분배기, 밸브 A → (멀티 커넥터 · 중간 기기) → 헤드(입구), 밸브 B → (중간 기기) → 로드 */
function autoHose(panel) {
  const A = panel.air, tubes = [], groups = [];
  const grp = (title, act) => { const g = { title, tubes: [], act }; groups.push(g); return g; };
  const put = (g, a, b, ln) => { g.tubes.push(tubes.length); tubes.push({ a, b, ln: ln || g.title }); };
  const pO = A.distOut.slice(), tO = A.tOut.slice();
  const g0 = grp('공급 · 복귀 — 파워 유닛 P → P 분배기, T 분배기 → 파워 유닛 T', null);
  const pc = A.comps.find(c => c.kind === 'hck' && c.pump);
  if (pc) { put(g0, A.src, pc.ports['1'], 'P 라인 (펌프 토출)'); put(g0, pc.ports['2'], A.din, 'P 라인'); } else put(g0, A.src, A.din, 'P 라인');
  put(g0, A.tin, A.sink, 'T 라인 (탱크)');
  for (const col of A.cols) {
    const X = col.act, v = A.valves.find(x => x.act === X), s = A.sups.find(x => x.act === X);
    const cy = A.cyls.find(c => c.act === X), mo = A.motors.find(m => m.act === X);
    const what = cy ? '실린더 ' + X : '모터 ' + X;
    const g = grp(`${what} — ${valveName(panel, v.mod)}`, X);
    const cmp = kind => A.comps.find(c => c.act === X && c.kind === kind);
    const pl = `${what} P 라인`;
    let cur = pO.shift();
    const th = cmp('hthr'), pr = cmp('hprv');
    if (th) { put(g, cur, th.ports['1'], pl); cur = th.ports['2']; }
    if (pr) { put(g, cur, pr.ports.P1, pl); cur = pr.ports.P2; put(g, pr.ports.T, tO.shift(), '감압밸브 드레인 → T'); }
    if (s) { put(g, cur, s.IN, pl); cur = s.OUT; }
    put(g, cur, v.P, pl);
    if (v.T) put(g, v.T, tO.shift(), `${what} T 라인 (복귀)`);
    const mc = A.mcs.find(m => m.act === X), mfree = mc ? mc.ports.slice() : [];
    const near = id => {   // 멀티 커넥터 빈 구멍 중 id에 가장 가까운 것
      const q = A.ports[id]; let bi = 0, bd = Infinity;
      mfree.forEach((m, i) => { const p = A.ports[m], dd = Math.hypot(p.x - q.x, p.y - q.y); if (dd < bd - 0.5) { bd = dd; bi = i; } });
      return mfree.splice(bi, 1)[0];
    };
    const work = (vp, ap, side) => {
      const ln = cy ? `${what} ${side === 'cap' ? '헤드 쪽' : '로드 쪽'} 라인` : `${what} ${side === 'cap' ? (mo.bi ? 'A' : '입구') : (mo.bi ? 'B' : '출구')} 라인`;
      const inl = A.comps.find(c => c.act === X && c.side === side && (c.kind === 'hfc' || c.kind === 'hcb' || c.kind === 'hpoc'));
      let from = vp;
      if (mc && side === 'cap') { put(g, vp, near(vp), ln); from = near(inl ? inl.ports['1'] : ap); }
      if (inl) { put(g, from, inl.ports['1'], ln); put(g, inl.ports['2'], ap, ln); } else put(g, from, ap, ln);
    };
    if (v.two) {
      work(v.A, mo.L, 'cap');
      const cv = cmp('hck');
      if (cv) { put(g, mo.R, cv.ports['1'], `${what} 출구 라인`); put(g, cv.ports['2'], tO.shift(), `${what} 출구 → T`); } else put(g, mo.R, tO.shift(), `${what} 출구 → T`);
    } else { work(v.A, cy ? cy.CAP : mo.L, 'cap'); work(v.B, cy ? cy.ROD : mo.R, 'rod'); }
    if (mc) {
      const bl = cmp('hbl'); if (bl) { put(g, near(bl.ports.IN), bl.ports.IN, `${what} 헤드 쪽 라인 (블리드오프 가지)`); put(g, bl.ports.OUT, tO.shift(), '블리드오프 → T'); }
      const po = cmp('hpoc'); if (po) put(g, near(po.ports.X), po.ports.X, '파일럿 라인 (헤드 쪽에서)');
      const rv = cmp('hrv'); if (rv) { put(g, near(rv.ports.P), rv.ports.P, `${what} 입구 라인 (서지압 릴리프)`); put(g, rv.ports.T, tO.shift(), '릴리프 → T'); }
      const mu = cmp('hmu'); if (mu) { put(g, near(mu.ports['2']), mu.ports['2'], `${what} 입구 라인 (보충 체크)`); put(g, mu.ports['1'], tO.shift(), 'T → 보충 체크'); }
    }
  }
  return { tubes, groups };
}
/* 유압 배관 검사: 모범 호스와 같은 곳끼리 이어졌는지(분배기 · 멀티 커넥터 구멍은 아무거나) + 엉뚱하게 합쳐진 라인(단락 · 엇갈림) */
function analyzeOil(panel, tubes, P) {
  const A = panel.air;
  tubes = validTubes(panel, tubes);
  const items = [];
  const add = (sev, text, ports, extra) => items.push(Object.assign({ sev, text, ports: ports || [], tubes: [] }, extra || {}));
  const pn = id => portName(panel, id);
  if (!tubes.length) {
    add('info', '아직 꽂은 호스가 없어요. 커플러(포트)를 누르고 이을 커플러를 누르면 호스가 생겨요. 파워 유닛 P → P 분배기, T 분배기 → 파워 유닛 T(공급 라인)부터 꽂아요.', [A.src, A.din, A.sink, A.tin]);
    return { items, errors: 0, ok: false };
  }
  const at = {};
  tubes.forEach((t, i) => { (at[t.a] = at[t.a] || []).push(i); (at[t.b] = at[t.b] || []).push(i); });
  for (const id in at) if (at[id].length > 1) add('err', `${pn(id)}에 호스가 ${at[id].length}개 꽂혀 있어요. 커플러 하나에는 호스 하나만 — 나눠 보내려면 분배기나 멀티 커넥터를 써요.`, [id], { tubes: at[id] });
  const M = autoHose(panel), R = portNets(panel, tubes), X = portNets(panel, M.tubes);
  const passSet = new Set(A.pass.flat());
  const groupOf = id => A.ports[id].m;
  const nm = id => passSet.has(id) ? (groupOf(id) === 'DA' ? 'P 분배기' : groupOf(id) === 'DB' ? 'T 분배기' : '멀티 커넥터') : pn(id);
  const lnOf = id => { const t = M.tubes.find(t => t.a === id || t.b === id); return t ? t.ln : ''; };
  const tIdx = (a, b) => tubes.findIndex(t => (R.node(t.a) === R.node(a) && R.node(t.b) === R.node(b)) || (R.node(t.a) === R.node(b) && R.node(t.b) === R.node(a)));
  const done = new Set();
  const terms = [...new Set(M.tubes.flatMap(t => [t.a, t.b]))];
  const isPn = id => X.node(id) === X.node(A.din), isTn = id => X.node(id) === X.node(A.tin);
  const partners = id => M.tubes.filter(t => X.node(t.a) === X.node(id)).flatMap(t => [t.a, t.b]).filter(q => q !== id);
  const linked = (id, list) => list.some(q => R.node(q) === R.node(id));
  let ptShort = false;
  // 1) 단락: P 라인 ↔ T 라인
  if (R.node(A.din) === R.node(A.tin) || R.node(A.src) === R.node(A.sink) || R.node(A.src) === R.node(A.tin) || R.node(A.din) === R.node(A.sink)) {
    add('err', 'P 라인(압력)과 T 라인(탱크)이 바로 이어졌어요 (단락) — 펌프 기름이 그대로 탱크로 돌아가서 압력이 안 생겨요. P 분배기와 T 분배기 호스를 확인하세요.', [A.src, A.din, A.sink, A.tin]);
    done.add(A.src); done.add(A.din); done.add(A.sink); done.add(A.tin); ptShort = true;
  }
  // 2) 밸브: P·T 바뀜, A·B 바뀜
  for (const v of A.valves) {
    if (v.T && !ptShort && linked(v.P, partners(v.T)) && linked(v.T, partners(v.P)) && !linked(v.P, partners(v.P)) && !linked(v.T, partners(v.T))) {
      add('err', `${valveName(panel, v.mod)}의 P·T 호스가 서로 바뀌었어요. P(압력)는 P 분배기 쪽, T는 T 분배기로 꽂으세요.`, [v.P, v.T], { act: v.act });
      done.add(v.P); done.add(v.T);
    }
    if (v.B) {
      const ea = M.tubes.filter(t => X.node(t.a) === X.node(v.A) || X.node(t.b) === X.node(v.A)).flatMap(t => [t.a, t.b]).filter(id => id !== v.A && !passSet.has(id));
      const eb = M.tubes.filter(t => X.node(t.a) === X.node(v.B) || X.node(t.b) === X.node(v.B)).flatMap(t => [t.a, t.b]).filter(id => id !== v.B && !passSet.has(id));
      if (ea.length && eb.length && ea.some(id => R.node(id) === R.node(v.B)) && eb.some(id => R.node(id) === R.node(v.A))) {
        const cy = A.cyls.find(c => c.act === v.act);
        add('err', `${cy ? '실린더' : '모터'} ${v.act}: ${valveName(panel, v.mod)}의 A·B 호스가 서로 바뀌었어요. A → ${cy ? '헤드 쪽' : 'A 포트(정회전 입구)'}, B → ${cy ? '로드 쪽으로' : 'B 포트로'} 바꿔 꽂으세요. 지금은 거꾸로 움직여요.`, [v.A, v.B], { act: v.act });
        done.add(v.A); done.add(v.B); ea.forEach(id => done.add(id)); eb.forEach(id => done.add(id));
      }
    }
  }
  // 3) 중간 기기: 빠짐 · 방향 반대
  for (const c of A.comps) {
    const k1 = c.ports['1'], k2 = c.ports['2']; if (!k1 || !k2) continue;
    const s1 = M.tubes.filter(t => t.a === k1 || t.b === k1).map(t => t.a === k1 ? t.b : t.a)[0], s2 = M.tubes.filter(t => t.a === k2 || t.b === k2).map(t => t.a === k2 ? t.b : t.a)[0];
    if (!s1 || !s2) continue;
    const ttl = c.title.replace(/ \(.*\)$/, '');
    if (!at[k1] && !at[k2] && R.node(s1) === R.node(s2)) {
      add('err', `도면에는 ${lnOf(k1) || '이 라인'}에 ${josa(ttl, '이', '가')} 있어요 → ${nm(s1)} → ${ttl} 1 → 2 → ${nm(s2)} 순서로 꽂으세요.`, [s1, k1, k2, s2], { act: c.act });
      done.add(s1); done.add(s2); done.add(k1); done.add(k2);
    } else if (at[k1] && at[k2] && R.node(k1) === R.node(s2) && R.node(k2) === R.node(s1)) {
      add('err', `${ttl} 방향이 반대예요 — 1(들어가는 쪽)이 ${nm(s1)} 쪽, 2가 ${nm(s2)} 쪽이 되게 바꿔 꽂으세요.` + (c.kind === 'hfc' ? ' 거꾸로 꽂으면 미터인이 돼서 다른 쪽 움직임이 느려져요.' : c.kind === 'hck' ? ' 거꾸로면 기름이 막혀요.' : ''), [k1, k2], { act: c.act });
      done.add(k1); done.add(k2); done.add(s1); done.add(s2);
    }
  }
  // 4) 모범 호스마다
  for (const t of M.tubes) {
    if (R.node(t.a) === R.node(t.b)) continue;
    if ((done.has(t.a) && !passSet.has(t.a)) || (done.has(t.b) && !passSet.has(t.b))) continue;
    const ends = [t.a, t.b], free = ends.filter(id => !passSet.has(id) && !at[id]);
    const real = ends.filter(id => !passSet.has(id));
    if (free.length) {
      const f = free[0], o = f === t.a ? t.b : t.a;
      add('err', `${josa(nm(f), '이', '가')} 비어 있어요 → ${josa(passSet.has(o) ? nm(o) + ' 남은 구멍' : nm(o), '과', '와')} 이어 주세요 (${t.ln}).`, [f, o], { act: (A.ports[f] && panel.mods[A.ports[f].m].act) || null });
      done.add(f);
    } else {
      const f = real[0] || t.a, o = f === t.a ? t.b : t.a;
      const wrong = (at[f] || []).map(i => tubes[i].a === f ? tubes[i].b : tubes[i].a)[0];
      add('err', `${josa(nm(f), '이', '가')} ${wrong ? nm(wrong) + '에' : '다른 곳에'} 이어져 있어요. 도면에서는 ${josa(nm(o), '과', '와')} 이어져요 (${t.ln}).`, [f, o].concat(wrong ? [wrong] : []), { tubes: at[f] || [], act: (A.ports[f] && panel.mods[A.ports[f].m].act) || null });
      done.add(f);
    }
  }
  // 5) 엉뚱하게 합쳐진 라인
  const seenPair = new Set();
  for (let i = 0; i < terms.length; i++) for (let k = i + 1; k < terms.length; k++) {
    const p = terms[i], q = terms[k];
    if (X.node(p) === X.node(q) || R.node(p) !== R.node(q)) continue;
    if (done.has(p) || done.has(q)) continue;
    if (ptShort && ((isPn(p) && isTn(q)) || (isTn(p) && isPn(q)))) continue;
    const key = [X.node(p), X.node(q)].sort().join('|'); if (seenPair.has(key)) continue; seenPair.add(key);
    add('err', `${josa(nm(p), '과', '와')} ${josa(nm(q), '이', '가')} 이어져 있어요. 도면에서 ${josa(nm(p), '은', '는')} ${lnOf(p)}, ${josa(nm(q), '은', '는')} ${lnOf(q)}이에요.`, [p, q], { act: (panel.mods[A.ports[p].m] || {}).act || null });
    done.add(p); done.add(q);
  }
  // 6) 필요 없는 호스
  const termSet = new Set(terms);
  tubes.forEach((t, i) => {
    const inModel = id => termSet.has(id) || (passSet.has(id) && terms.some(x => passSet.has(x) && groupOf(x) === groupOf(id)));
    if (passSet.has(t.a) && passSet.has(t.b) && groupOf(t.a) === groupOf(t.b)) add('warn', `같은 ${nm(t.a)} 구멍끼리 이은 호스는 필요 없어요.`, [t.a, t.b], { tubes: [i] });
    else if (!inModel(t.a) || !inModel(t.b)) add('warn', `도면에 없는 호스예요: ${pn(t.a)} ↔ ${pn(t.b)}.`, [t.a, t.b], { tubes: [i] });
  });
  const errors = items.filter(i => i.sev === 'err').length;
  if (!errors) add('ok', '유압 회로도와 같은 길로 호스가 꽂혀 있어요.', []);
  return { items, errors, ok: !errors };
}

const API = { makePanel, buildWireNet, analyze, autoWire, wireGuide, mapTable, validWires, refFunctions, paths, sopOf, compareSop, jackName, shortTitle, CIRC,
  portName, valveName, validTubes, airModel, analyzeAir, autoPipe, startWires, AIR };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
root.HSIM = Object.assign(root.HSIM || {}, { WIRE: API });
})(typeof window !== 'undefined' ? window : globalThis);
