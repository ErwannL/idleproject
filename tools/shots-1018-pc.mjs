// v10.18 (partie 5) : captures PC (combat, Améliorations, Forge, Bastion avec sa notification) et mesures.
//   node tools/shots-1018-pc.mjs --out docs/screenshots/v10.18/partie5 --tag apres [--sizes 1366x768,1920x1080]
import { mkdir } from 'node:fs/promises';
import { makeOpt, parseSizes, startApp, openGame, openTab } from './lib-1013.mjs';

const opt = makeOpt(process.argv.slice(2));
const out = opt('out', 'docs/screenshots/v10.18/partie5');
const tag = opt('tag', 'apres');
const sizes = parseSizes(opt('sizes', '1366x768,1920x1080'));
await mkdir(out, { recursive: true });
const app = await startApp();
const shot = (page, name) => page.screenshot({ path: `${out}/${tag}-${name}.jpg`, type: 'jpeg', quality: 80 });
try {
  for (const [w, h] of sizes) {
    const g = await openGame(app, 'endgame', w, h);
    const { page } = g;
    await page.evaluate(() => { __idle.ui.toast('Nain guerrier, forgeron : +25 % · Prêtresse, savante : +25 % · Pyromancienne, forgeronne : +25 % · Paladin d\'azur, entraîneur : +30 %', '#7fe0a0'); });
    await page.waitForTimeout(700);
    const m = await page.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { w: Math.round(b.width), sw: e.scrollWidth, cw: e.clientWidth, mq: e.classList.contains('mq-on') || !!e.querySelector('.mq-on') }; };
      const inn = document.querySelector('#news .mq-in'); const box = document.querySelector('#news');
      return { zn: r('#zone-name .zn-t'), news: r('#news-text'), newsStart: inn && box ? Math.round(inn.getBoundingClientRect().left - box.getBoundingClientRect().left) : null };
    });
    console.log(w, h, 'combat', JSON.stringify(m));
    await shot(page, `${w}-combat`);
    for (const tab of ['upgrades', 'forge', 'camp']) {
      if (!(await openTab(page, tab))) { console.log(w, tab, 'fermé'); continue; }
      if (tab === 'camp') {
        await page.evaluate(() => { const ui = __idle.ui; const c = Object.keys(__idle.state.companions?.owned ?? {})[0] ?? 'x'; ui.view.bastionView = 'map'; ui.view.bastionKick = { placed: [{ companionId: c, building: 'forge', pct: 25 }, { companionId: c, building: 'library', pct: 25 }], build: null }; ui.invalidate(); });
        await page.waitForTimeout(900);
      }
      const pm = await page.evaluate(() => {
        const p = document.querySelector('#panel').getBoundingClientRect();
        const k = document.querySelector('.bs-kick'); const kb = k?.getBoundingClientRect();
        return { panelW: Math.round(p.width), vw: innerWidth, kick: kb ? { top: Math.round(kb.top), bottom: Math.round(kb.bottom), left: Math.round(kb.left), right: Math.round(kb.right) } : null };
      });
      console.log(w, h, tab, JSON.stringify(pm));
      await shot(page, `${w}-${tab}`);
    }
    await g.ctx.close();
  }
} finally { await app.close(); }
