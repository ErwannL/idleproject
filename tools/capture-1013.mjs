// v10.13 (§ 0.1) : captures de référence « avant » (ou n'importe quelle série) : chaque onglet et chaque mode, plusieurs tailles, partie de fin et partie neuve.
//   node tools/capture-1013.mjs [--out docs/screenshots/v10.13/avant] [--sizes 1116x993,1366x768,1878x1245,1920x1080,412x915,390x844]
//                               [--games endgame,fresh] [--tabs inventory,skills,…] [--quality 70]
// Fichiers JPEG : <taille>-<onglet>[--<mode>].jpg (partie de fin) ou <taille>-neuve-<onglet>[--<mode>].jpg (partie neuve).
// Un onglet pas encore débloqué (partie neuve) est ignoré.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ALL_TABS, ALL_SIZES, makeOpt, parseSizes, parseList, startApp, openGame, openTab, listModes, clickMode, slug } from './lib-1013.mjs';

const argv = process.argv.slice(2);
const opt = makeOpt(argv);
const out = opt('out', 'docs/screenshots/v10.13/avant');
const sizes = parseSizes(opt('sizes', ALL_SIZES));
const games = parseList(opt('games', 'endgame,fresh'));
const tabs = parseList(opt('tabs', ALL_TABS.join(',')));
const quality = Number(opt('quality', '70'));
await mkdir(out, { recursive: true });
const app = await startApp();
let n = 0, skipped = 0;
for (const game of games) {
  for (const [w, h] of sizes) {
    const g = await openGame(app, game, w, h);
    const prefix = `${w}x${h}-${game === 'fresh' ? 'neuve-' : ''}`;
    for (const tab of tabs) {
      if (!await openTab(g.page, tab)) { skipped++; continue; }
      await g.page.screenshot({ path: join(out, `${prefix}${tab}.jpg`), type: 'jpeg', quality }); n++;
      for (const m of await listModes(g.page)) {
        if (!await clickMode(g.page, m)) continue;
        await g.page.screenshot({ path: join(out, `${prefix}${tab}--${slug(m.value || m.label)}.jpg`), type: 'jpeg', quality }); n++;
      }
    }
    if (g.jsErrors.length) console.log(`erreurs JS ${game} ${w}x${h} : ${[...new Set(g.jsErrors)].slice(0, 3).join(' | ')}`);
    await g.ctx.close();
    console.log(`${game} ${w}x${h} : fait`);
  }
}
await app.close();
console.log(`${n} captures dans ${out} (${skipped} onglets ignorés : pas débloqués)`);
