// v10.19 (partie 1) : captures Bastion › Forge du forgeron (fiche du bâtiment, bloc Ouvrier) au téléphone.
// node tools/shots-1019-ouvriers.mjs avant|apres  → docs/screenshots/v10.19/ouvriers/<tag>-<l>x<h>.jpg
import { mkdir } from 'node:fs/promises';
import { closeAll, openGame, openTab, startApp } from './lib-1013.mjs';

const tag = process.argv[2] ?? 'apres';
const dir = 'docs/screenshots/v10.19/ouvriers';
await mkdir(dir, { recursive: true });
const app = await startApp();
try {
  for (const [w, h] of [[405, 896], [360, 800]]) {
    const g = await openGame(app, 'endgame', w, h);
    await openTab(g.page, 'camp');
    // un ouvrier à la Forge, avec un peu d'expérience (niveau 4 : 120 XP)
    await g.page.evaluate(() => {
      const { state, ui } = window.__idle;
      const b = state.bastion;
      if (b?.buildings?.forge) {
        const id = Object.keys(state.companions.owned).find((k) => !state.companions.equipped?.includes(k) && ['squire', 'mercenary', 'golem'].includes(k)) ?? null;
        if (id && !b.buildings.forge.worker) { for (const s of Object.values(b.buildings)) if (s.worker === id) s.worker = null; b.buildings.forge.worker = id; }
        b.workers = { ...(b.workers ?? {}), [b.buildings.forge.worker]: { workerXp: 120, workerLevel: 4 } };
      }
      ui.view.bastionView = 'map'; ui.view.bastionSel = 'forge'; ui.view.bastionAgeNew = null; ui.view.bastionKick = null; ui.invalidate();
    });
    await g.page.waitForTimeout(1200);
    await closeAll(g.page);
    await g.page.evaluate(() => { const el = document.querySelector('.bs-wblock'); el?.scrollIntoView({ block: 'start' }); let p = el?.parentElement; while (p && p.scrollHeight <= p.clientHeight) p = p.parentElement; p?.scrollBy(0, -60); });
    await g.page.waitForTimeout(500);
    await g.page.screenshot({ path: `${dir}/${tag}-${w}x${h}.jpg`, type: 'jpeg', quality: 80 });
    if (g.jsErrors.length) console.log('erreurs JS', g.jsErrors);
    await g.ctx.close();
  }
} finally { await app.close(); }
