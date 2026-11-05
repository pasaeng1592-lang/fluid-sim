// 응용제어동작 검증 (Node)
const E = require('./engine.js');
const { PROBLEMS } = require('./data.js');
const fmt = g => '{' + Object.entries(g).map(([k, v]) => k + (v === 'ext' ? '+' : v === 'ret' ? '-' : ':' + v)).join(' ') + '}';
let all = true;
const keys = process.argv.slice(2);
for (const P0 of PROBLEMS) {
  if (!P0.app || (keys.length && !keys.includes(P0.key))) continue;
  const P = Object.assign({}, P0, { acts: P0.app.acts || P0.acts });
  let r;
  try { r = E.runAppCheck(P, P0.app.ladder || E.applyPatches(P0.ladder, P0.fix).def); } catch (e) { console.log(P0.key, 'ERROR', e.message); all = false; continue; }
  console.log(`\n=== ${P0.title} 응용  ${r.ok ? 'OK' : 'FAIL'}`);
  for (const s of r.steps) console.log(`  ${s.ok ? '✓' : '✗'} ${s.text}`);
  if (!r.ok) {
    all = false;
    console.log('   got:', r.groups.map(fmt).join(' '));
    console.log('   exp:', r.expected.map(fmt).join(' '));
    console.log('   prog:', JSON.stringify(r.sim.prog), 'osc', [...r.sim.osc], 'conf', [...r.sim.conflicts]);
  }
}
console.log('\nALL APP OK:', all);
