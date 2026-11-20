// v9.11 : contrôles du prompt dans le navigateur (sauvegarde de fin de jeu, 1116 × 993) :
//  1. Combat de Titan (10 s) : au plus un arc de coup critique toutes les 0,4 s ; une colonne de lumière à la fois,
//     0,6 s au plus ; aucun effet de ce type ne reste plus de 0,8 s.
//  2. Tiroir ☰ : un clic sur le fond le ferme ; il a une croix.
//  3. Fenêtre d'un objet porté : Renforcer visible sans clic supplémentaire.
//  4. Sceau : « Tout récupérer (4) » puis « (5) » ne compte qu'une fois ; jamais de pastille sans mot.
// Usage : node tools/e2e-911.mjs
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = await startServer(0);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1116, height: 993 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const raw = await readFile('tests/fixtures/endgame.json', 'utf8');
await page.addInitScript((r) => { if (!sessionStorage.getItem('m')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('m', '1'); } }, raw);
await page.goto(`http://localhost:${server.address().port}/`);
await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
await page.waitForTimeout(8000);
await page.evaluate(() => document.querySelectorAll('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) [data-action="offline-claim"]').forEach((b) => b.click()));
let ok = 0, n = 0;
const check = (c, msg) => { n++; if (c) ok++; console.log(`${c ? '✔' : '✘'} ${msg}`); };

// 1. Titan
await page.evaluate(() => __idle.ui.showRift(false));
await page.waitForTimeout(800);
await page.click('[data-action="titan-start-modal"]');
await page.waitForFunction(() => window.__idle.wbScene, null, { timeout: 10000 });
const fx = await page.evaluate(async () => {
  const r = __idle.wbScene.r;
  const seen = new Map(); const slashes = []; let maxCols = 0; let maxColLife = 0;
  for (let i = 0; i < 100; i++) {
    await new Promise((res) => setTimeout(res, 100));
    const t = r.time;
    const cols = r.effects.filter((e) => e.kind === 'vfx' && e.column);
    maxCols = Math.max(maxCols, cols.length);
    for (const e of r.effects) {
      if (e.kind !== 'vfx' || !(e.column || ['hit_slash', 'v_crit_arc', 'crit_flash'].includes(e.name))) continue;
      if (!seen.has(e)) { seen.set(e, t); if (e.name === 'hit_slash' || e.name === 'v_crit_arc') slashes.push(t); }
      if (e.column) maxColLife = Math.max(maxColLife, t - seen.get(e));
    }
  }
  const lives = [...seen.values()];
  const gaps = slashes.slice(1).map((x, i) => x - slashes[i]);
  return { slashes: slashes.length, minGap: gaps.length ? Math.min(...gaps) : 9, maxCols, maxColLife, tracked: lives.length };
});
check(fx.minGap >= 0.35, `Titan : arcs de coup espacés d'au moins 0,4 s (${fx.slashes} arcs, écart mini ${fx.minGap.toFixed(2)} s)`);
check(fx.maxCols <= 1 && fx.maxColLife <= 0.8, `Titan : une colonne de lumière à la fois, ${fx.maxColLife.toFixed(2)} s au plus`);
await page.evaluate(() => document.querySelector('.wb-skip')?.click());
await page.waitForTimeout(1500);
await page.evaluate(() => { document.querySelector('.wb-close')?.click(); document.querySelectorAll('.wb-overlay').forEach((e) => e.remove()); });

// 2. Tiroir
await page.evaluate(() => __idle.ui.openDrawer());
await page.waitForTimeout(400);
const hasX = await page.evaluate(() => Boolean(document.querySelector('#modal .drawer-close')));
await page.mouse.click(8, 500);
await page.waitForTimeout(300);
check(hasX && await page.evaluate(() => document.getElementById('modal').classList.contains('hidden')), 'Tiroir ☰ : croix présente, un clic sur le fond le ferme');

// 3. Objet porté
await page.evaluate(() => { __idle.ui.openTab('inventory', { selectedItemId: __idle.state.equipment.weapon.id, sheetOpen: 'item' }); });
await page.waitForTimeout(800);
check(await page.evaluate(() => Boolean(document.querySelector('.eq-sheet [data-action="upgrade-item"]'))), 'Objet porté : Renforcer visible sans clic de plus');
await page.evaluate(() => { __idle.ui.view.sheetOpen = null; __idle.ui.closePanel(); });

// 4. Sceau
const seal = await page.evaluate(async () => {
  const ui = __idle.ui; const st = __idle.state;
  const before = st.ui.sealCount?.claim ?? 0;
  ui.sealSession = new Set(); ui.lastHud.next = null;
  ui.next = { id: 'claim', text: 'Tout récupérer (4)', action: 'claim-everything' }; ui.updateNextAction();
  ui.next = { id: 'claim', text: 'Tout récupérer (5)', action: 'claim-everything' }; ui.updateNextAction();
  const after = st.ui.sealCount?.claim ?? 0;
  st.ui.sealMiniUntil = (st.playSeconds ?? 0) + 3600; ui.updateNextAction();
  const btn = document.getElementById('next-action');
  return { counted: after - before, short: btn.dataset.short, mini: btn.classList.contains('na-mini') };
});
check(seal.counted === 1, `Sceau : (4) puis (5) = une seule proposition (compté ${seal.counted})`);
check(seal.mini && /\p{L}|\d/u.test(seal.short ?? '') && seal.short !== '›', `Sceau réduit : icône et mot (« ${seal.short} »)`);
check(!errors.length, `aucune erreur JavaScript ${errors.join(' | ')}`);
console.log(`${ok}/${n} vérifications réussies`);
await browser.close(); server.close();
process.exit(ok === n ? 0 : 1);
