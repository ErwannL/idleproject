// v10.17.1 : captures des onglets retouchés (avant/après), PC 1366 et 1920, téléphone 412, thèmes Chevalier et Sakura.
//   node tools/shots-10171.mjs --out docs/screenshots/v10.17.1/apres [--sizes 1366x768,1920x1080,412x915] [--tabs inventory,forge,…]
//                              [--themes knight,sakura] [--games endgame,fresh]
// JPEG qualité 80 : <taille>-<partie>-<thème>-<onglet>.jpg ; « combat » = fenêtre Équipement ouverte, vue de la colonne de combat.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { makeOpt, parseSizes, parseList, startApp, openGame, openTab, closeAll } from './lib-1013.mjs';

const opt = makeOpt(process.argv.slice(2));
const out = opt('out', 'docs/screenshots/v10.17.1/apres');
const sizes = parseSizes(opt('sizes', '1366x768,1920x1080,412x915'));
const tabs = parseList(opt('tabs', 'inventory,forge,companions,arena,looks,camp,shop,summon'));
const themes = parseList(opt('themes', 'knight,sakura'));
const games = parseList(opt('games', 'endgame'));
await mkdir(out, { recursive: true });
const app = await startApp();
try {
  for (const [w, h] of sizes) for (const game of games) for (const theme of themes) {
    const { page, ctx } = await openGame(app, game, w, h);
    if (theme !== 'knight') {
      await page.evaluate(async (t) => { const m = await import('/src/ui/themes.js'); __idle.state.ui.theme = t; await m.applyTheme(t); }, theme).catch(() => {});
      await page.waitForTimeout(800);
    }
    for (const tab of tabs) {
      if (!(await openTab(page, tab))) continue;
      await closeAll(page);
      await page.screenshot({ path: join(out, `${w}x${h}-${game === 'fresh' ? 'neuve' : 'fin'}-${theme}-${tab}.jpg`), type: 'jpeg', quality: 80 });
    }
    await ctx.close();
  }
} finally { await app.close(); }
