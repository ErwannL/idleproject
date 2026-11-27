// v10.18 (1.5) : téléphone — la scène garde le même cadrage, fenêtre ouverte ou fermée (voir tools/frame-1018.mjs).
//   node tools/e2e-1018-frame.mjs [--sizes 405x896,390x844,360x800] [--verbose]
import { makeOpt, parseSizes, startApp, openGame } from './lib-1013.mjs';
import { frameCheck } from './frame-1018.mjs';

const opt = makeOpt(process.argv.slice(2));
const sizes = parseSizes(opt('sizes', '405x896,390x844,360x800'));
const app = await startApp();
let fails = 0;
for (const [w, h] of sizes) {
  const g = await openGame(app, 'endgame', w, h);
  const { issues, rows } = await frameCheck(g.page);
  const xs = rows.filter((r) => r.ok).map((r) => r.x), hs = rows.filter((r) => r.ok).map((r) => r.h);
  console.log(`${w}x${h} : ${rows.length} étapes, héros x ${Math.min(...xs).toFixed(1)}–${Math.max(...xs).toFixed(1)}, hauteur ${Math.min(...hs).toFixed(1)}–${Math.max(...hs).toFixed(1)} px, ${issues.length} défaut(s)`);
  if (process.argv.includes('--verbose')) for (const r of rows) console.log(`   ${r.step.padEnd(22)} ${r.state.padEnd(6)} x=${r.x?.toFixed(1)} h=${r.h?.toFixed(1)}${r.bandH ? ` bande=${r.bandH}` : ''}`);
  for (const i of issues) console.log(`  ÉCHEC ${i.msg}`);
  if (g.jsErrors.length) { console.log(`  erreurs JS : ${g.jsErrors.join(' | ')}`); fails++; }
  fails += issues.length;
  await g.ctx.close();
}
await app.close();
console.log(fails ? `${fails} défaut(s)` : 'OK : même cadrage partout');
process.exit(fails ? 1 : 0);
