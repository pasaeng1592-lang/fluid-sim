// 공압 배관 검증: 모범 배선 + 모범 배관 → 배관 검사 오류 0 → 시뮬레이션 2회(기본) / 응용 동작
// 그리고 일부러 틀린 배관이 검사·동작에서 잡히는지
const E = require('./engine.js');
const { PROBLEMS } = require('./data.js');
const Wm = require('./wire.js');
let all = true;
const fail = (m) => { all = false; console.log('   <<<', m); };
for (const P of PROBLEMS) {
  for (const target of ['fix', 'app']) {
    if (target === 'app' && !P.app) continue;
    const PV = target === 'app' ? Object.assign({}, P, { acts: P.app.acts || P.acts, isApp: true }) : P;
    const def = target === 'app' ? (P.app.ladder ? E.normalizeDef(P.app.ladder) : E.applyPatches(P.ladder, P.fix).def) : E.applyPatches(P.ladder, P.fix).def;
    const panel = Wm.makePanel(PV, def);
    if (!panel.air || panel.air.medium === 'oil') { console.log(`${P.key} ${target}: (공압 보드 아님 — 유압은 oiltest.js)`); continue; }
    const aw = Wm.autoWire(panel, def); Object.assign(panel.presets, aw.presets);
    const W = Wm.buildWireNet(panel, aw.wires);
    const ap = Wm.autoPipe(panel);
    const run = (tubes, on) => {
      const AM = Wm.airModel(panel, tubes, { on: on !== false });
      const d = { __net: W.net, __air: AM };
      return target === 'app' ? E.runAppCheck(PV, d, { cpre: panel.refPre.C1, tpre: panel.refPre.T1 }) : E.runCheck(PV, d, { cycles: 2 });
    };
    const an = Wm.analyzeAir(panel, ap.tubes, PV);
    const errs = an.items.filter(i => i.sev === 'err' || i.sev === 'warn');
    const r = run(ap.tubes);
    console.log(`${P.key} ${target}: tubes=${ap.tubes.length} sc=${panel.air.scs.length} airErr=${errs.length} run=${r.ok ? 'OK' : 'FAIL'}`);
    if (errs.length) fail(errs.map(e => e.text).join(' / '));
    if (!r.ok) fail(r.steps ? r.steps.filter(s => !s.ok).map(s => s.text).join(' / ') : `state ${r.state} p ${r.p} ${JSON.stringify(r.groups)}`);
    // 모든 포트가 화면 안 · 겹치지 않음
    const ports = Object.values(panel.air.ports);
    for (const p of ports) if (p.x < 0 || p.y < 0 || p.x > panel.W || p.y > panel.H) fail('port outside ' + p.id);
    for (let i = 0; i < ports.length; i++) for (let k = i + 1; k < ports.length; k++) if (Math.hypot(ports[i].x - ports[k].x, ports[i].y - ports[k].y) < 20) fail('ports too close ' + ports[i].id + ' ' + ports[k].id);
    const jacks = Object.values(panel.jacks);
    for (const p of ports) for (const j of jacks) if (Math.hypot(p.x - j.x, p.y - j.y) < 20) fail('port near jack ' + p.id + ' ' + j.id);
    // 일부러 틀리기
    const A = panel.air, v0 = A.valves[0], c0 = A.cyls.find(c => c.act === v0.act);
    const muts = [
      ['공급 없음', ap.tubes.filter(t => t.a !== A.src && t.b !== A.src), /서비스 유닛 출구/],
      ['A·B 바꿈', ap.tubes.map(t => {
        const sw = x => x === c0.CAP ? c0.ROD : x === c0.ROD ? c0.CAP : x;
        return { a: sw(t.a), b: sw(t.b) };
      }), /바뀌었어요/],
      ['P 빠짐', ap.tubes.filter(t => t.a !== v0.P && t.b !== v0.P), /P 포트\(공급\)가 비어/],
      ['B 빠짐', ap.tubes.filter(t => !(t.a === v0.B || t.b === v0.B)), /B 포트가 비어|그다음이 비어/],
    ];
    const sc0 = A.scs[0];
    if (sc0) {
      const v = A.valves.find(x => x.act === sc0.act), c = A.cyls.find(x => x.act === sc0.act);
      const vp = sc0.side === 'cap' ? v.A : v.B, cp = sc0.side === 'cap' ? c.CAP : c.ROD;
      muts.push(['속도 제어 빠짐', ap.tubes.filter(t => ![sc0.p1, sc0.p2].includes(t.a) && ![sc0.p1, sc0.p2].includes(t.b)).concat([{ a: vp, b: cp }]), /속도 제어 밸브가 있어요/]);
    }
    const vB = A.valves[1], cA = A.cyls.find(c => c.act === A.valves[0].act), cB = A.cyls.find(c => c.act === vB.act);
    muts.push(['실린더 바꿈', ap.tubes.map(t => {
      const sw = x => x === cA.CAP ? cB.CAP : x === cB.CAP ? cA.CAP : x === cA.ROD ? cB.ROD : x === cB.ROD ? cA.ROD : x;
      return { a: sw(t.a), b: sw(t.b) };
    }).filter(t => !A.scs.some(s => [s.p1, s.p2].includes(t.a) || [s.p1, s.p2].includes(t.b))), /실린더 [ABC]에 꽂혀|움직여요/]);
    for (const [nm, tubes, re] of muts) {
      const a2 = Wm.analyzeAir(panel, tubes, PV);
      const e2 = a2.items.filter(i => i.sev === 'err');
      const hit = e2.some(i => re.test(i.text));
      const r2 = nm === '속도 제어 빠짐' ? null : run(tubes);
      const ok = hit && e2.length >= 1 && (r2 === null || !r2.ok);
      console.log(`   mut ${nm}: errs=${e2.length} hit=${hit} run=${r2 ? (r2.ok ? 'OK' : 'FAIL') : '-'}${ok ? '' : '  <<<'}`);
      if (!ok) { all = false; e2.slice(0, 3).forEach(i => console.log('      -', i.text)); }
      if (P.key === 'pn1' && target === 'fix') e2.slice(0, 2).forEach(i => console.log('      ·', i.text));
    }
    // 공기 OFF면 움직이지 않음
    const roff = run(ap.tubes, false);
    if (roff.ok) fail('air off still runs');
  }
}
console.log('ALL AIR OK:', all);
