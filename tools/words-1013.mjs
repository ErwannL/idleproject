// v10.13 (lot 6) : aucun nom de carte (Compagnons PC) ne doit être coupé en plein mot ni déborder. node tools/words-1013.mjs
import { startApp, openGame, openTab } from './lib-1013.mjs';
const app = await startApp();
let bad = 0;
for (const [w, h] of [[1116, 993], [1366, 768], [1878, 1245], [1920, 1080]]) {
  const g = await openGame(app, 'endgame', w, h);
  await openTab(g.page, 'companions');
  for (const tab of ['ally', 'pet']) {
    await g.page.evaluate((t) => { __idle.ui.view.compTab = t; __idle.ui.invalidate(); }, tab);
    await g.page.waitForTimeout(600);
    const r = await g.page.evaluate(() => [...document.querySelectorAll('.dc-name')].filter((n) => {
      const cs = getComputedStyle(n);
      const sp = document.createElement('span');
      sp.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${cs.font};letter-spacing:${cs.letterSpacing}`;
      document.body.appendChild(sp);
      let wide = false;
      for (const wd of n.textContent.trim().split(/\s+/)) { sp.textContent = wd; if (sp.getBoundingClientRect().width > n.getBoundingClientRect().width + 0.5) wide = true; }
      sp.remove();
      return wide;
    }).map((n) => n.textContent));
    console.log(w, h, tab, r.length ? r : 'ok');
    bad += r.length;
  }
  await g.ctx.close();
}
await app.close();
console.log('mots coupés :', bad);
process.exit(bad ? 1 : 0);
