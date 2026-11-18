// Photos et vidéos des nouveautés 9.11 : node tools/media-911.mjs <sortie>
import { createRequire } from 'node:module';
import { readFile, mkdir, rename, rm } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] ?? 'docs/media-9.11';
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


const cast = (page, list) => ev(page, (l) => { const r = __idle.renderer, w = __idle.world; for (const s of l) { const [k, id, idx] = s.split(':');
  if (k === 'h') r.handleEvent({ type: 'skill', skillId: id, x: r.wx(w.enemies[0]?.x ?? 160), time: w.time }, w);
  else r.handleEvent({ type: 'companionSkill', companionId: id, skill: Number(idx), skillType: 'burst', time: w.time }, w); } }, list);
const titan = async (page) => { await ev(page, () => __idle.ui.showRift(false)); await wait(page, 900); await click(page, '[data-action="titan-start-modal"]'); };
{
  const { page, ctx } = await session('p');
  await cast(page, ['h:cry']); await wait(page, 450); await shot(page, '01-cri-de-guerre-onde');
  await wait(page, 1500); await cast(page, ['h:meteor']); await wait(page, 750); await shot(page, '02-meteore-cratere');
  await wait(page, 1500); await cast(page, ['h:holy']); await wait(page, 450); await shot(page, '03-frappe-sacree');
  await wait(page, 1500); await cast(page, ['c:shadow:2']); await wait(page, 500); await shot(page, '04-danse-des-lames-ombre');
  await wait(page, 1500); await cast(page, ['c:squire:2']); await wait(page, 450); await shot(page, '05-provocation-ecuyer');
  await tab(page, 'inventory'); await wait(page, 900); await shot(page, '06-emplacements-64px');
  await ev(page, () => { __idle.ui.view.selectedItemId = __idle.state.equipment.weapon.id; __idle.ui.view.sheetOpen = 'item'; __idle.ui.invalidate(); }); await wait(page, 1000); await shot(page, '07-objet-porte-renforcer');
  await ev(page, () => { __idle.ui.view.sheetOpen = null; __idle.ui.invalidate(); __idle.ui.elementsHelp(); }); await wait(page, 800); await shot(page, '08-schema-des-elements');
  await ev(page, () => { __idle.ui.closeModal(); __idle.ui.closePanel(); __idle.ui.openDrawer(); }); await wait(page, 700); await shot(page, '09-menu-avec-croix');
  await ev(page, () => __idle.ui.closeModal());
  await tab(page, 'contracts', { missionTab: 'chronicles' }); await wait(page, 1000); await shot(page, '10-chroniques-et-taches-du-heraut');
  await tab(page, 'contracts', { missionTab: 'today' }); await wait(page, 1000); await shot(page, '11-missions-objectifs-de-session');
  await ev(page, () => __idle.ui.closePanel()); await wait(page, 700); await shot(page, '12-carte-de-quete-scene');
  await ev(page, () => __idle.ui.showWheel()); await wait(page, 800); await shot(page, '13-roue-du-jour');
  await click(page, '[data-action="wheel-spin"]'); await wait(page, 4000); await shot(page, '14-roue-gagnee');
  await ev(page, () => __idle.ui.closeModal());
  await tab(page, 'shop', { shopCat: 'heroTickets' }); await wait(page, 900); await shot(page, '15-tickets-de-compagnon');
  await tab(page, 'shop', { shopCat: 'petTickets' }); await wait(page, 900); await shot(page, '16-tickets-de-familier');
  await tab(page, 'tree'); await wait(page, 900); await shot(page, '17-talents-3-cartes');
  await tab(page, 'upgrades'); await wait(page, 900); await shot(page, '18-ameliorations');
  await ev(page, () => __idle.ui.closePanel());
  await titan(page); await wait(page, 7000); await shot(page, '19-titan-des-marees');
  await ctx.close();
}
{ // 1. Titan : repos fluide, équipe vivante, effets limités
  const { page, ctx } = await session('v1', { video: true });
  await titan(page); await wait(page, 22000);
  await finish(ctx, page, '01-titan-colosse-vivant');
}
{ // 2. Compétences redessinées
  const { page, ctx } = await session('v2', { video: true });
  for (const s of ['h:cry', 'h:meteor', 'h:holy', 'h:whirl', 'c:shadow:2', 'c:rose_blade:2', 'c:ninja:2', 'c:squire:2', 'c:azure_paladin:2', 'c:priestess:1', 'c:archangel:1']) { await cast(page, [s]); await wait(page, 2200); }
  await finish(ctx, page, '02-competences-redessinees');
}
{ // 3. Roue, Chroniques, objet porté
  const { page, ctx } = await session('v3', { video: true });
  await ev(page, () => __idle.ui.showWheel()); await wait(page, 1500); await click(page, '[data-action="wheel-spin"]'); await wait(page, 6000);
  await ev(page, () => __idle.ui.closeModal());
  await tab(page, 'contracts', { missionTab: 'chronicles' }); await wait(page, 2500); await click(page, '[data-action="chronicle-claim"]'); await wait(page, 3000);
  await ev(page, () => __idle.ui.closeModal()); await click(page, '[data-action="chronicle-claim"]'); await wait(page, 3000); await ev(page, () => __idle.ui.closeModal());
  await ev(page, () => __idle.ui.openTab('inventory', { selectedItemId: __idle.state.equipment.weapon.id, sheetOpen: 'item' })); await wait(page, 2500);
  await click(page, '.item-pop [data-action="upgrade-item"]'); await wait(page, 2500);
  await finish(ctx, page, '03-roue-chroniques-objet');
}
await browser.close(); server.close();
console.log('fini');
