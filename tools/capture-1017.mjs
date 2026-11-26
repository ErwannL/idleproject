// v10.17 : captures avant / après de la passe « tout le jeu propre et homogène » (C, D, E), PC (1366, 1920) et téléphone,
// thèmes Chevalier et Sakura. Lancé depuis la racine d'une copie du jeu (avant : ancienne version extraite ailleurs).
//   node tools/capture-1017.mjs --out docs/screenshots/v10.17/ui/apres [--sizes 1366x768,1920x1080,412x915]
//                               [--themes knight,sakura] [--views combat,skills,tree,camp,shop,looks,expeditions,contracts,options]
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { makeOpt, parseSizes, parseList, startApp, openGame, openTab, closeAll } from './lib-1013.mjs';

const argv = process.argv.slice(2);
const opt = makeOpt(argv);
const out = opt('out', 'docs/screenshots/v10.17/ui/apres');
const sizes = parseSizes(opt('sizes', '1366x768,1920x1080,412x915'));
const themes = parseList(opt('themes', 'knight,sakura'));
const views = parseList(opt('views', 'combat,skills,tree,camp,shop,looks,expeditions,contracts,options'));
await mkdir(out, { recursive: true });
const app = await startApp();
for (const [w, h] of sizes) {
  for (const theme of themes) {
    const g = await openGame(app, 'endgame', w, h);
    if (theme !== 'knight') await g.page.evaluate(async (id) => { const m = await import('/src/ui/themes.js'); try { __idle.state.ui.theme = id; } catch { /* rien */ } await m.applyTheme(id); }, theme);
    for (const v of views) {
      if (v === 'combat') { await g.page.evaluate(() => { try { __idle.ui.closePanel(); } catch { /* rien */ } }); await g.page.waitForTimeout(1200); await closeAll(g.page); }
      else if (!await openTab(g.page, v)) continue;
      await g.page.waitForTimeout(500);
      await g.page.screenshot({ path: join(out, `${w}x${h}-${theme}-${v}.jpg`), type: 'jpeg', quality: 80 });
    }
    await g.ctx.close();
    console.log(`${w}x${h} ${theme} : fait`);
  }
}
await app.close();
