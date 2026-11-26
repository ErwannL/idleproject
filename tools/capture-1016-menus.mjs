// v10.16 (B) : captures avant/après des écrans « Menus et ergonomie » (PC 1366×768 et téléphone 412×915, partie de fin).
//   node tools/capture-1016-menus.mjs docs/screenshots/v10.16/menus/apres
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { startApp, openGame, openTab, closeAll } from './lib-1013.mjs';

const out = process.argv[2] ?? 'docs/screenshots/v10.16/menus/apres';
const TABS = ['daybook', 'contracts', 'boss', 'ranking', 'guild', 'summon', 'forge', 'upgrades', 'stats', 'options'];
await mkdir(out, { recursive: true });
const app = await startApp();
try {
  for (const [w, h] of [[1366, 768], [412, 915]]) {
    const g = await openGame(app, 'endgame', w, h);
    await g.page.waitForTimeout(1500);
    await g.page.screenshot({ path: join(out, `${w}x${h}-combat.jpg`), quality: 70 });
    for (const t of TABS) {
      const ok = await openTab(g.page, t);
      if (t === 'ranking' || t === 'guild') await g.page.waitForTimeout(5500);
      if (ok) await g.page.screenshot({ path: join(out, `${w}x${h}-${t}.jpg`), quality: 70 });
      await g.page.evaluate(() => __idle.ui.closePanel?.());
    }
    await closeAll(g.page);
    await g.page.evaluate(() => document.querySelector('[data-action="drawer"]')?.click());
    await g.page.waitForTimeout(600);
    await g.page.screenshot({ path: join(out, `${w}x${h}-tiroir.jpg`), quality: 70 });
    if (g.jsErrors.length) console.log('erreurs JS', w, g.jsErrors.slice(0, 3));
    await g.ctx.close();
  }
} finally { await app.close(); }
console.log('captures dans', out);
