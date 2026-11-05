// 노드 검증: 정정 도면이 변위단계선도대로 2회 연속 동작하는지, 문제 도면은 어디서 멈추는지
const E = require('./engine.js');
const { PROBLEMS } = require('./data.js');

const fmtG = g => '{' + Object.entries(g).map(([k, v]) => k + (v === 'ext' ? '+' : v === 'ret' ? '-' : ':' + v)).join(' ') + '}';
let allOk = true;
for (const P of PROBLEMS) {
  console.log('\n=== ' + P.title + '  (' + P.seqText + ')');
  const exp = E.expectedGroups(P);
  console.log('  expected:', exp.map(fmtG).join(' '));
  // 정정
  const fixed = E.applyPatches(P.ladder, P.fix).def;
  const r = E.runCheck(P, fixed, { cycles: 2 });
  console.log('  정정:', r.ok ? 'OK' : 'FAIL', 'cycles=' + r.cycles, 'state=' + r.state, r.osc.length ? 'osc=' + r.osc : '', r.conflicts.length ? 'conf=' + r.conflicts : '');
  if (!r.ok) { allOk = false; console.log('   got:', r.groups.map(fmtG).join(' ')); console.log('   dev:', JSON.stringify(r.dev)); }
  // 문제 + 부분 정정 단계별
  const errs = [...new Set(P.fix.map(p => p.err))].sort();
  for (let k = 0; k <= errs.length; k++) {
    const patches = P.fix.filter(p => errs.indexOf(p.err) < k);
    const def = E.applyPatches(P.ladder, patches).def;
    const rr = E.runCheck(P, def, { cycles: 2 });
    const tag = k === 0 ? '문제 도면' : '오류 1~' + k + ' 정정';
    let line = `  [${tag}] ${rr.ok ? 'OK' : 'FAIL'} cycles=${rr.cycles} state=${rr.state} p=${rr.p}`;
    if (rr.osc.length) line += ' osc=' + rr.osc.join(',');
    if (rr.conflicts.length) line += ' conflict=' + rr.conflicts.join(',');
    if (rr.dev) line += ' dev=' + JSON.stringify(rr.dev);
    console.log(line);
    console.log('     groups:', rr.groups.map(fmtG).join(' ') || '(움직임 없음)');
    if (!rr.ok && (rr.state === 'stall' || rr.state === 'armed' || rr.state === 'run')) {
      const d = rr.sim.diagnose();
      const show = (items, ind) => items.forEach(it => { console.log(ind + '- ' + it.name + ': ' + it.reason); if (it.sub) show(it.sub, ind + '   '); });
      for (const x of d) { console.log(`     진단: ${x.act} ${x.want}`); for (const b of x.bad) { console.log(`       ${b.sol} 필요=${b.need ? 'ON' : 'OFF'}`); show(b.chain, '         '); } }
    }
  }
}
console.log('\nALL FIXED OK:', allOk);
