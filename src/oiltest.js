// 유압 호스 검증: 모범 배선 + 모범 호스 → 검사 오류 0 → 기본 2회 / 응용 조건 통과, 틀린 호스는 검사 · 동작에서 잡힘
const E = require('./engine.js');
const { PROBLEMS } = require('./data.js');
const Wm = require('./wire.js');
let all = true;
const bad = m => { all = false; console.log('   <<<', m); };
for (const P of PROBLEMS.filter(p => p.kind === 'hyd')) for (const target of ['fix', 'app']) {
  const PV = target === 'app' ? Object.assign({}, P, { acts: P.app.acts || P.acts, isApp: true }) : P;
  const def = target === 'app' ? (P.app.ladder ? E.normalizeDef(P.app.ladder) : E.applyPatches(P.ladder, P.fix).def) : E.applyPatches(P.ladder, P.fix).def;
  const panel = Wm.makePanel(PV, def);
  const aw = Wm.autoWire(panel, def); Object.assign(panel.presets, aw.presets);
  const W = Wm.buildWireNet(panel, aw.wires), mh = Wm.autoPipe(panel);
  const run = (tubes, opt) => { const d = { __net: W.net, __air: Wm.airModel(panel, tubes, opt || {}) }; return target === 'app' ? E.runAppCheck(PV, d, { cpre: panel.refPre.C1, tpre: panel.refPre.T1 }) : E.runCheck(PV, d, { cycles: 2 }); };
  const an = Wm.analyzeAir(panel, mh.tubes, PV), errs = an.items.filter(i => i.sev === 'err' || i.sev === 'warn');
  const r = run(mh.tubes);
  console.log(`${P.key} ${target}: hoses=${mh.tubes.length} comps=${panel.air.comps.length} errs=${errs.length} run=${r.ok ? 'OK' : 'FAIL'}`);
  if (errs.length) bad(errs.map(e => e.text).join(' / '));
  if (!r.ok) bad(r.steps ? r.steps.filter(s => !s.ok).map(s => s.text).join(' / ') : `state ${r.state} p ${r.p} ${JSON.stringify(r.groups)}`);
  // 커플러 · 단자 자리: 보드 안 · 서로 20 이상 떨어짐 · 기기끼리 겹치지 않음
  {
    const ports = Object.values(panel.air.ports), jacks = Object.values(panel.jacks), B = panel.air.board;
    for (const p of ports) if (p.x < B.x || p.y < B.y || p.x > B.x + B.w || p.y > B.y + B.h) bad('port outside board ' + p.id);
    for (let i = 0; i < ports.length; i++) for (let k = i + 1; k < ports.length; k++) if (Math.hypot(ports[i].x - ports[k].x, ports[i].y - ports[k].y) < 20) bad('ports too close ' + ports[i].id + ' ' + ports[k].id);
    for (const p of ports) for (const j of jacks) if (Math.hypot(p.x - j.x, p.y - j.y) < 20) bad('port near jack ' + p.id + ' ' + j.id);
    const ms = panel.field || [];
    for (let i = 0; i < ms.length; i++) for (let k = i + 1; k < ms.length; k++) { const a = ms[i], b = ms[k]; if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) bad('modules overlap ' + a.id + ' ' + b.id); }
    for (const m of ms) if (m.x + m.w > B.x + B.w + 1 || m.y + m.h > B.y + B.h + 1) bad('module outside board ' + m.id);
  }
  const A = panel.air, v0 = A.valves.find(v => !v.two) || A.valves[0];
  const muts = [];
  if (v0.T) muts.push(['T 라인 빠짐', mh.tubes.filter(t => t.a !== v0.T && t.b !== v0.T), /T 포트가 비어/]);
  muts.push(['공급 P 빠짐', mh.tubes.filter(t => !(t.a === A.src || t.b === A.src)), /파워 유닛 P/]);
  if (v0.B) {
    const ends = id => mh.tubes.filter(t => t.a === id || t.b === id);
    const ta = ends(v0.A)[0], tb = ends(v0.B)[0];
    const oa = ta.a === v0.A ? ta.b : ta.a, ob = tb.a === v0.B ? tb.b : tb.a;
    muts.push(['A·B 바꿈', mh.tubes.filter(t => t !== ta && t !== tb).concat([{ a: v0.A, b: ob }, { a: v0.B, b: oa }]), /A·B 호스가 서로 바뀌었어요/]);
  }
  if (v0.T) {
    const ends = id => mh.tubes.filter(t => t.a === id || t.b === id)[0];
    const tp = ends(v0.P), tt = ends(v0.T), op = tp.a === v0.P ? tp.b : tp.a, ot = tt.a === v0.T ? tt.b : tt.a;
    muts.push(['P·T 바꿈', mh.tubes.filter(t => t !== tp && t !== tt).concat([{ a: v0.P, b: ot }, { a: v0.T, b: op }]), /P·T 호스가 서로 바뀌었어요|단락/]);
  }
  muts.push(['P–T 단락', mh.tubes.concat([{ a: A.distOut[5], b: A.tOut[5] }]), /단락/]);
  const fc = A.comps.find(c => c.kind === 'hfc');
  if (fc) {
    const t1 = mh.tubes.find(t => t.a === fc.ports['1'] || t.b === fc.ports['1']), t2 = mh.tubes.find(t => t.a === fc.ports['2'] || t.b === fc.ports['2']);
    const o1 = t1.a === fc.ports['1'] ? t1.b : t1.a, o2 = t2.a === fc.ports['2'] ? t2.b : t2.a;
    muts.push(['미터아웃 빠짐', mh.tubes.filter(t => t !== t1 && t !== t2).concat([{ a: o1, b: o2 }]), /미터아웃 유량제어밸브가 있어요/]);
    muts.push(['미터아웃 거꾸로', mh.tubes.filter(t => t !== t1 && t !== t2).concat([{ a: o1, b: fc.ports['2'] }, { a: fc.ports['1'], b: o2 }]), /방향이 반대/]);
  }
  const ck = A.comps.find(c => c.kind === 'hck' && c.pump);
  if (ck) muts.push(['펌프 체크 거꾸로', mh.tubes.map(t => ({ a: t.a === ck.ports['1'] ? ck.ports['2'] : t.a === ck.ports['2'] ? ck.ports['1'] : t.a, b: t.b === ck.ports['1'] ? ck.ports['2'] : t.b === ck.ports['2'] ? ck.ports['1'] : t.b })), /방향이 반대/]);
  for (const [nm, tb, re] of muts) {
    const a2 = Wm.analyzeAir(panel, tb, PV), e2 = a2.items.filter(i => i.sev === 'err');
    const hit = e2.some(i => re.test(i.text)), r2 = run(tb);
    const ok = hit && !r2.ok;
    console.log(`   mut ${nm}: errs=${e2.length} hit=${hit} run=${r2.ok ? 'OK' : 'FAIL'}${ok ? '' : '  <<<'}`);
    if (!ok) { all = false; e2.slice(0, 3).forEach(i => console.log('      -', i.text)); }
    if (P.key === 'hy1' || (P.key === 'hy3' && target === 'app')) e2.slice(0, 1).forEach(i => console.log('      ·', i.text));
  }
  const off = run(mh.tubes, { on: false }); if (off.ok) bad('pump off still runs');
  const tv = run(mh.tubes, { bvT: false }); if (tv.ok) bad('T valve closed still runs');
}
console.log('ALL OIL OK:', all);
