// v10.20 (1-3) : mesure et captures PC d'Équipement et d'Améliorations (#panel-body.scrollHeight / clientHeight, vignette du combat).
//   node tools/capture-1020-pc.mjs [--label apres] [--out docs/screenshots/v10.20/pc-pages] [--sizes 1366x768,1920x1080,1170x1350] [--tabs inventory,upgrades] [--no-shots]
import { mkdir } from 'node:fs/promises';
import { makeOpt, parseSizes, parseList, startApp, openGame, openTab } from './lib-1013.mjs';

const opt = makeOpt(process.argv.slice(2));
const label = opt('label', 'apres');
const out = opt('out', 'docs/screenshots/v10.20/pc-pages');
const shots = !process.argv.includes('--no-shots');
const sizes = parseSizes(opt('sizes', '1366x768,1920x1080,1170x1350'));
const tabs = parseList(opt('tabs', 'inventory,upgrades'));
if (shots) await mkdir(out, { recursive: true });
const app = await startApp();
const rows = [];
try {
  for (const [w, h] of sizes) {
    const g = await openGame(app, 'endgame', w, h);
    for (const t of tabs) {
      await openTab(g.page, t);
      const m = await g.page.evaluate(() => {
        const b = document.querySelector('#panel-body');
        const mini = document.querySelector('#page-mini');
        const r = mini?.getBoundingClientRect();
        const p = document.querySelector('#panel').getBoundingClientRect();
        return { sh: b.scrollHeight, ch: b.clientHeight, panelW: Math.round(p.width), mini: r && r.width ? `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}` : '-' };
      });
      rows.push({ size: `${w}x${h}`, tab: t, ...m, ok: m.sh <= m.ch + 2 });
      if (shots) await g.page.screenshot({ path: `${out}/${label}-${w}x${h}-${t}.jpg`, type: 'jpeg', quality: 80 });
    }
    if (g.jsErrors.length) console.log('Erreurs JS', g.jsErrors);
    await g.ctx.close();
  }
} finally { await app.close(); }
console.table(rows);
