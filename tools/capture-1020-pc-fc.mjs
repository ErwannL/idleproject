// v10.20 (parties 4-5) : mesures de #panel-body et captures PC de la Forge et des Compagnons.
//   node tools/capture-1020-pc-fc.mjs <avant|apres> [--sizes 1366x768,1920x1080,1170x1350]
import { mkdir } from 'node:fs/promises';
import { startApp, openGame, openTab, makeOpt, parseSizes } from './lib-1013.mjs';

const label = process.argv[2] || 'apres';
const opt = makeOpt(process.argv);
const sizes = parseSizes(opt('sizes', '1366x768,1920x1080,1170x1350'));
const out = 'docs/screenshots/v10.20/pc-forge-compagnons';
await mkdir(out, { recursive: true });
const app = await startApp();
let bad = 0;
try {
  for (const [w, h] of sizes) {
    const g = await openGame(app, 'endgame', w, h);
    for (const tab of ['forge', 'companions']) {
      await openTab(g.page, tab);
      const m = await g.page.evaluate(() => { const b = document.querySelector('#panel-body'); return { sh: b.scrollHeight, ch: b.clientHeight }; });
      const ok = m.sh <= m.ch + 2; if (!ok) bad++;
      console.log(`${label} ${w}x${h} ${tab}: scrollHeight=${m.sh} clientHeight=${m.ch} ${ok ? 'OK' : 'DÉFILE'}`);
      if (!opt('no-shots', '')) await g.page.screenshot({ path: `${out}/${label}-${w}x${h}-${tab}.jpg`, type: 'jpeg', quality: 80 });
    }
    if (g.jsErrors.length) console.log('erreurs JS', g.jsErrors);
    await g.ctx.close();
  }
} finally { await app.close(); }
process.exitCode = bad ? 1 : 0;
