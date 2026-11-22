// 부품 설치 검증: 모범 자리 = 원래 보드, 빈 보드, 리밋스위치 바꿔 달기, 놓기 검사
const E = require('./engine.js');
const { PROBLEMS } = require('./data.js');
const Wm = require('./wire.js');
let all = true;
const bad = m => { all = false; console.log('   <<<', m); };
const defsOf = P => { const fix = E.applyPatches(P.ladder, P.fix).def; return { fix, app: P.app ? (P.app.ladder ? E.normalizeDef(P.app.ladder) : fix) : null }; };
for (const P of PROBLEMS) for (const st of ['fix', 'app']) {
  if (st === 'app' && !P.app) continue;
  const D = defsOf(P), def = D[st], other = st === 'app' ? D.fix : D.app;
  const PV = st === 'app' ? Object.assign({}, P, { acts: P.app.acts || P.acts, isApp: true }) : P;
  const opt = { union: other ? [other] : [] };
  const full = Wm.makePanel(PV, def, opt);
  if (!full.air) continue;
  const home = Wm.homePlace(full), pids = Object.keys(home);
  const inst = Wm.makePanel(PV, def, Object.assign({ place: home }, opt));
  // 1) 모범 자리에 다 달면 원래 보드와 같음
  const sig = pn => JSON.stringify([pn.modules.map(m => m.id + '@' + m.x + ',' + m.y), pn.jackIds, pn.air.portIds, pn.elements.length, pn.air.valves.length, pn.air.comps.length, pn.air.scs.length]);
  if (sig(full) !== sig(inst)) bad(`${P.key} ${st}: 모범 자리 보드가 원래와 다름`);
  const want = {}; for (const a of PV.acts) if (a.type === 'cyl') a.sens.forEach((n, k) => { want[n] = { act: a.id, end: k }; });
  if (Object.keys(want).some(n => !inst.smap[n] || inst.smap[n].act !== want[n].act || inst.smap[n].end !== want[n].end) || Object.keys(inst.smap).length !== Object.keys(want).length) bad(`${P.key} ${st}: 센서 자리 다름 ${JSON.stringify(inst.smap)}`);
  for (const pid of pids) { const r = Wm.placeCheck(full, home, pid, home[pid][0], home[pid][1]); if (!r.ok || r.x !== home[pid][0] || r.y !== home[pid][1]) bad(`${P.key} ${st}: 모범 자리 ${pid} 거부 — ${r.reason} (${r.x},${r.y})`); }
  const rep0 = Wm.installReport(full, home, PV);
  if (!rep0.ok) bad(`${P.key} ${st}: 모범 자리 설치 검사 실패 ${rep0.items.map(i => i.text).join(' / ')}`);
  // 2) 모범 배선 · 배관으로 돌리면 통과 (설치 보드 + __smap)
  const aw = Wm.autoWire(full, def), ap = Wm.autoPipe(full);
  const W = Wm.buildWireNet(inst, aw.wires);
  const run = (pn, place, tubes) => {
    Object.assign(pn.presets, aw.presets);
    const d = { __net: Wm.buildWireNet(pn, aw.wires).net, __air: Wm.airModel(pn, tubes, { on: true, bvP: true, bvT: true }), __smap: pn.smap };
    const PVx = Object.assign({}, PV);
    return st === 'app' ? E.runAppCheck(PVx, d, { cpre: full.refPre.C1, tpre: full.refPre.T1 }) : E.runCheck(PVx, d, { cycles: 2 });
  };
  const r1 = run(inst, home, Wm.validTubes(inst, ap.tubes));
  if (!r1.ok) bad(`${P.key} ${st}: 모범 자리 동작 실패`);
  // 3) 빈 보드: 부품함에 다 있음
  const empty = Wm.makePanel(PV, def, Object.assign({ place: {} }, opt));
  const nInst = full.field.filter(m => m.inst).length;
  if (empty.tray.length !== nInst || empty.field.some(m => m.inst)) bad(`${P.key} ${st}: 빈 보드 부품함 ${empty.tray.length}/${nInst}`);
  const rep1 = Wm.installReport(full, {}, PV);
  if (rep1.missing !== nInst || rep1.ok) bad(`${P.key} ${st}: 빈 보드 설치 검사 ${rep1.missing}`);
  // 4) 첫 실린더의 두 리밋스위치(센서) 자리 바꾸기 → 설치 검사 2개 오류 + 동작 실패
  const a0 = PV.acts.find(a => a.type === 'cyl');
  let swapNote = '-';
  if (a0) {
    const sw = Object.assign({}, home), [n0, n1] = a0.sens;
    sw[n0] = home[n1]; sw[n1] = home[n0];
    const inst2 = Wm.makePanel(PV, def, Object.assign({ place: sw }, opt));
    const rep2 = Wm.installReport(full, sw, PV);
    const r2 = run(inst2, sw, Wm.validTubes(inst2, ap.tubes));
    swapNote = `${n0}↔${n1} wrong=${rep2.wrong} run=${r2.ok ? 'OK' : 'FAIL'}`;
    if (rep2.wrong !== 2 || r2.ok) bad(`${P.key} ${st}: 리밋스위치 바꿔 달기가 안 잡힘 (${swapNote})`);
  }
  // 5) 놓기 검사: 실린더 위에 밸브, 도그 밖 리밋스위치, 보드 밖
  const vpid = pids.find(p => p.startsWith('V')), lpid = a0 ? a0.sens[0] : null, cy = full.field.find(m => m.kind === 'cyl');
  const c1 = Wm.placeCheck(full, home, vpid, cy.ax + 20, cy.ay);
  const c2 = lpid ? Wm.placeCheck(full, home, lpid, home[lpid][0], home[lpid][1] + 260) : { ok: false };
  const c3 = Wm.placeCheck(full, home, vpid, full.air.board.w - 20, 10);
  if (c1.ok || c2.ok || c3.ok) bad(`${P.key} ${st}: 놓기 검사 ${c1.ok} ${c2.ok} ${c3.ok}`);
  // 6) 리밋스위치를 빈 자리로 옮기기 (다른 실린더 슬롯이 비어 있으면) — 슬롯에 딱 붙음
  const rmv = Object.assign({}, home); delete rmv[lpid];
  const near = lpid ? Wm.placeCheck(full, rmv, lpid, home[lpid][0] + 30, home[lpid][1] + 25) : { ok: true, x: 0, y: 0 };
  if (lpid && (!near.ok || near.x !== home[lpid][0] || near.y !== home[lpid][1])) bad(`${P.key} ${st}: 슬롯에 안 붙음 ${JSON.stringify(near)}`);
  console.log(`${P.key} ${st}: 부품 ${nInst}개 · 모범 자리 OK · 동작 ${r1.ok ? 'OK' : 'FAIL'} · ${swapNote} · 놓기 검사 OK`);
  if (P.key === 'pn1' && st === 'fix') { console.log('   예:', c1.reason, '|', c2.reason, '|', c3.reason); console.log('   ', rep1.items.slice(0, 3).map(i => i.text).join(' / ')); }
}
console.log('ALL INSTALL OK:', all);
