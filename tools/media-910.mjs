// Photos et vidéos des nouveautés 9.10 : node tools/media-910.mjs <sortie>
import { createRequire } from 'node:module';
import { readFile, mkdir, rename, rm } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] ?? 'docs/media-9.10';
await mkdir(`${out}/photos`, { recursive: true }); await mkdir(`${out}/videos`, { recursive: true });
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const fx = JSON.parse(await readFile('tests/fixtures/endgame.json', 'utf8'));
fx.maxStage = Math.max(fx.maxStage ?? 1, 200);
const raw = JSON.stringify(fx);
const S = { width: 1116, height: 993 };
async function session(name, { fixture = true, q = '', video = false, size = S } = {}) {
  const ctx = await browser.newContext({ viewport: size, ...(video ? { recordVideo: { dir: `${out}/videos/tmp-${name}`, size } } : {}) });
  const page = await ctx.newPage();
  if (fixture) await page.addInitScript((r) => { if (!sessionStorage.getItem('m')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('m', '1'); } }, raw);
  await page.goto(url + q);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(fixture ? 8500 : 2500);
  await page.evaluate(() => document.querySelectorAll('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) [data-action="offline-claim"]').forEach((b) => b.click()));
  return { page, ctx };
}
const shot = (page, n) => page.screenshot({ path: `${out}/photos/${n}.png` });
const ev = (page, f, a) => page.evaluate(f, a);
const wait = (page, ms) => page.waitForTimeout(ms);
const click = (page, sel) => page.click(sel, { timeout: 4000 }).catch(() => {});
async function finish(ctx, page, name) {
  const v = page.video(); await ctx.close();
  if (v) { await rename(await v.path(), `${out}/videos/${name}.webm`); await rm(`${out}/videos/tmp-${name}`, { recursive: true, force: true }); }
}
const tab = (page, t, v) => ev(page, ([t, v]) => __idle.ui.openTab(t, v ?? null), [t, v]);

{
  const { page, ctx } = await session('p');
  await tab(page, 'inventory'); await wait(page, 900); await shot(page, '01-pc-volet-lateral-equipement');
  await tab(page, 'hero'); await wait(page, 900); await shot(page, '02-fiche-tu-encaisses');
  await tab(page, 'upgrades'); await wait(page, 900); await shot(page, '03-ameliorations-volet-lateral');
  await tab(page, 'forge'); await wait(page, 900); await shot(page, '04-forge-dans-heros');
  await tab(page, 'inventory'); await wait(page, 600);
  await ev(page, () => { const w = __idle.state.equipment.weapon; __idle.ui.view.selectedItemId = w?.id; __idle.ui.view.sheetOpen = 'item'; __idle.ui.invalidate(); }); await wait(page, 1200); await shot(page, '05-objet-pourcentage-de-puissance');
  await ev(page, () => { __idle.ui.view.sheetOpen = null; __idle.ui.closeModal?.(); });
  await tab(page, 'companions'); await wait(page, 1000); await shot(page, '06-equiper-toute-l-equipe-pastilles');
  await click(page, '[data-action="companion-sel"][data-value="squire"]'); await wait(page, 900);
  await click(page, '[data-action="unit-show"]'); await wait(page, 2200); await shot(page, '07-voir-en-action-en-grand');
  await ev(page, () => __idle.ui.closeModal()); await wait(page, 300);
  await tab(page, 'tower', { defiTab: 'arena', arenaMode: 'survival' }); await wait(page, 1000); await shot(page, '08-arene-choix-equipe');
  await tab(page, 'tower', { defiTab: 'arena', arenaMode: 'global' }); await wait(page, 1000); await shot(page, '09-boss-commun-explique');
  await tab(page, 'tower', { defiTab: 'arena', arenaMode: 'survival' }); await wait(page, 600);
  await click(page, '[data-action="arena-survival"]'); await wait(page, 3500); await shot(page, '10-arene-combat-en-grand');
  await click(page, '.as-skip'); await page.waitForSelector('.arena-overlay .wb-end', { timeout: 8000 }).catch(() => {}); await wait(page, 600); await shot(page, '11-arene-ecran-de-fin');
  await ev(page, () => document.querySelectorAll('.arena-overlay').forEach((e) => e.remove())); await wait(page, 400);
  await tab(page, 'camp'); await wait(page, 900); await shot(page, '12-camp-illustre');
  await tab(page, 'shop'); await wait(page, 900); await shot(page, '13-boutique-offres-d-abord');
  await tab(page, 'expeditions'); await wait(page, 900); await shot(page, '14-expeditions-gains-attendus');
  await tab(page, 'looks'); await wait(page, 900); await shot(page, '15-onglets-apparences-classement');
  await ev(page, () => __idle.ui.openTab('options', { optTab: 'interface' })); await wait(page, 900);
  await ev(page, () => { const b = document.querySelector('[data-value="opt-notify"]'); if (b && b.dataset.expanded !== 'true') b.click(); }); await wait(page, 900);
  await ev(page, () => document.querySelector('[data-action="vigil-auto"]')?.scrollIntoView({ block: 'center' })); await wait(page, 500); await shot(page, '16-reglage-veillee');
  await ctx.close();
}
{
  const { page, ctx } = await session('n', { fixture: false, q: '?quests' });
  for (let i = 0; i < 40 && !(await page.$('.best-card.first-item')); i++) { await wait(page, 1000); await ev(page, () => { const l = document.getElementById('tuto-layer'); if (l?.target) l.target.click(); }); }
  await wait(page, 600); await shot(page, '17-debutant-bulle-nouvel-objet');
  await ctx.close();
}
for (const [w, h, n] of [[1920, 1080, '18-pc-1920x1080'], [460, 640, '19-petite-fenetre-460x640']]) {
  const { page, ctx } = await session('s', { size: { width: w, height: h } });
  await tab(page, 'upgrades'); await wait(page, 900); await shot(page, n);
  await ctx.close();
}

{ // 1. PC : volet latéral, tour des onglets
  const { page, ctx } = await session('v1', { video: true });
  for (const t of ['inventory', 'upgrades', 'skills', 'tree', 'forge', 'companions', 'campaign', 'summon', 'shop', 'camp']) { await tab(page, t); await wait(page, 1600); }
  await ev(page, () => __idle.ui.closePanel()); await wait(page, 1500);
  await finish(ctx, page, '01-pc-volet-lateral');
}
{ // 2. Débutant : la mini-quête Équipement en suivant le doigt
  const { page, ctx } = await session('v2', { fixture: false, q: '?quests', video: true });
  for (let i = 0; i < 45; i++) {
    await wait(page, 1000);
    const done = await ev(page, () => {
      const l = document.getElementById('tuto-layer'); if (l?.target && l.querySelector('.tuto-finger:not([hidden])')) l.target.click();
      const seal = document.querySelector('#next-action:not(.hidden)'); if (seal && !seal.querySelector('.na-finger').classList.contains('hidden') && Math.random() < 0.4) seal.click();
      return (__idle.state.unlocks?.done ?? []).includes('equipment');
    });
    if (done && i > 5) { await wait(page, 4000); break; }
  }
  await finish(ctx, page, '02-debutant-mini-quete-equipement');
}
{ // 3. Arène : équipe, combat en grand, écran de fin
  const { page, ctx } = await session('v3', { video: true });
  await tab(page, 'tower', { defiTab: 'arena', arenaMode: 'survival' }); await wait(page, 2500);
  await click(page, '[data-action="arena-survival"]'); await wait(page, 16000); await wait(page, 4000);
  await click(page, '.as-close'); await ev(page, () => document.querySelectorAll('.arena-overlay').forEach((e) => e.remove())); await wait(page, 1000);
  await tab(page, 'tower', { defiTab: 'arena', arenaMode: 'floors' }); await wait(page, 2000);
  await click(page, '[data-action="arena-floor"]'); await wait(page, 14000); await wait(page, 3000);
  await finish(ctx, page, '03-arene-en-grand');
}
{ // 4. Compagnons : équiper toute l'équipe, puis la vitrine
  const { page, ctx } = await session('v4', { video: true });
  await tab(page, 'companions'); await wait(page, 2500);
  await click(page, '[data-action="gear-team"]'); await wait(page, 2500);
  await click(page, '[data-action="companion-sel"][data-value="squire"]'); await wait(page, 1500);
  await click(page, '[data-action="unit-show"]'); await wait(page, 16000);
  await finish(ctx, page, '04-compagnons-equipement-et-vitrine');
}
await browser.close(); server.close();
console.log('fini');
