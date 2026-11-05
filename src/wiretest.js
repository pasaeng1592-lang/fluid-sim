// 배선 연습 검증: 모범 배선 → 검사 오류 0 → 시뮬레이션 2회 동작 (기본/응용)
const E = require('./engine.js');
const { PROBLEMS } = require('./data.js');
const Wm = require('./wire.js');
let all = true;
for (const P of PROBLEMS) {
  for (const target of ['fix', 'app']) {
    if (target === 'app' && !P.app) continue;
    const PV = target === 'app' ? Object.assign({}, P, { acts: P.app.acts || P.acts, isApp: true }) : P;
    const def = target === 'app' ? (P.app.ladder ? E.normalizeDef(P.app.ladder) : E.applyPatches(P.ladder, P.fix).def) : E.applyPatches(P.ladder, P.fix).def;
    const panel = Wm.makePanel(PV, def);
    const aw = Wm.autoWire(panel, def);
    Object.assign(panel.presets, aw.presets);
    const an = Wm.analyze(panel, aw.wires, def, PV);
    const errs = an.items.filter(i => i.sev === 'err');
    const W = Wm.buildWireNet(panel, aw.wires);
    let run;
    if (target === 'app' && P.app) run = E.runAppCheck(PV, { __net: W.net }, { cpre: panel.refPre.C1, tpre: panel.refPre.T1 });
    else run = E.runCheck(PV, { __net: W.net }, { cycles: 2 });
    const ok = !errs.length && run.ok && !Object.keys(aw.overflow).length;
    if (!ok) all = false;
    console.log(`${P.key} ${target}: wires=${aw.wires.length} merges=${aw.merges.length} overflow=${JSON.stringify(aw.overflow)} errs=${errs.length} run=${run.ok ? 'OK' : 'FAIL'} ${ok ? '' : '  <<<'}`);
    if (errs.length) errs.slice(0, 4).forEach(e => console.log('   -', e.text));
    if (!run.ok) { if (run.steps) run.steps.filter(s => !s.ok).forEach(s => console.log('   x', s.text)); else console.log('   state', run.state, 'p', run.p, 'cycles', run.cycles, JSON.stringify(run.groups)); }
  }
}
console.log('ALL WIRE OK:', all);
