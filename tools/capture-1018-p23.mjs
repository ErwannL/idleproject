// v10.18 (parties 2 et 3) : captures téléphone — combat, Objectifs avec le Carnet de l'Apprenti, Arène, menu Plus, Expéditions.
//   node tools/capture-1018-p23.mjs --out docs/screenshots/v10.18/parties2-3 --tag apres [--sizes 405x896,360x800]
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { startApp, openGame, openTab, closeAll, makeOpt, parseSizes } from './lib-1013.mjs';

const opt = makeOpt(process.argv.slice(2));
const out = opt('out', 'docs/screenshots/v10.18/parties2-3');
const tag = opt('tag', 'apres');
const sizes = parseSizes(opt('sizes', '405x896,360x800'));
await mkdir(out, { recursive: true });
const app = await startApp();
const shot = (page, w, h, name) => page.screenshot({ path: join(out, `${w}x${h}-${name}-${tag}.jpg`), type: 'jpeg', quality: 80 });
for (const [w, h] of sizes) {
  const { page, ctx } = await openGame(app, 'endgame', w, h);
  await page.evaluate(async () => { // partie de 2 jours (Carnet de l'Apprenti ouvert) avec 3 touches d'attaque
    const { UNLOCK_IDS } = await import('./src/core/unlock-quests.js');
    const s = __idle.state; s.skills = { ...s.skills, whirl: 1, cry: 1 }; s.createdAt = Date.now() - 1.5 * 864e5;
    s.unlocks = { done: [...UNLOCK_IDS], base: { ...s.records } }; s.firstWeek = { claimed: [1], prize: null }; __idle.ui.invalidate?.();
  });
  await page.waitForTimeout(800);
  // combat : les 3 touches « en attente » (appui gardé)
  await page.evaluate(() => { try { __idle.ui.closePanel(); } catch { /* rien */ } });
  await page.waitForTimeout(1200); await closeAll(page);
  await page.evaluate(() => { // appuis gardés pendant la recharge
    const w = __idle.world, ids = [...document.querySelectorAll('#skill-bar .skill-btn')].map((b) => b.dataset.skill);
    w.skillTimers ??= {}; for (const id of ids) w.skillTimers[id] = 60;
    w.manualPending = new Set(ids);
  });
  await page.waitForTimeout(400);
  await shot(page, w, h, 'combat');
  // Objectifs avec le Carnet de l'Apprenti (partie de 2 jours)
  if (await openTab(page, 'daybook')) {
    await shot(page, w, h, 'plus');
    await page.evaluate(() => document.querySelector('#panel-body .mp-fw')?.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(300);
    await shot(page, w, h, 'objectifs-carnet');
  }
  // --arena-page 1 : l'Arène « en page » comme les autres onglets (partie 1 de la 10.18, faite à part) pour juger sa mise en page.
  if (opt('arena-page', '0') === '1') await page.evaluate(async () => { const m = await import('./src/ui/page.js'); m.SCENE_TABS.delete('arena'); });
  if (await openTab(page, 'arena')) await shot(page, w, h, 'arene');
  if (await openTab(page, 'expeditions')) await shot(page, w, h, 'expeditions');
  await ctx.close();
}
await app.close();
console.log(`Captures : ${out}`);
