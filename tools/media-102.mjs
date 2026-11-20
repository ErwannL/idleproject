// Photos et vidéos des nouveautés 10.2 : node tools/media-102.mjs <sortie>
import { createRequire } from 'node:module';
import { readFile, mkdir, rename, rm } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] ?? 'docs/media-10.2';
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


const loot = (page) => ev(page, () => { const s = __idle.state; const pool = [...s.inventory, ...(s.stash ?? []), ...Object.values(s.equipment).filter(Boolean)]; s.lootBag = pool.slice(0, 5).map((i, k) => ({ ...i, id: `${i.id}-m${k}` }));
  const epic = { ...s.lootBag[0], rarity: 'epic', id: 'epic-m' }; s.lootBag.push(epic); __idle.ui.lootBag.lastKey = ''; __idle.ui.lootBag.update(s); __idle.ui.lootBag.bump(epic, 300); });
const arena = async (page, f) => { await ev(page, () => __idle.ui.openTab('arena')); await wait(page, 900); return ev(page, (f) => { __idle.state.arena.cards.best = Math.max(__idle.state.arena.cards.best, f + 1); __idle.ui.closePanel(); __idle.ui.arenaFight(f); }, f); };
{
  const { page, ctx } = await session('p', { size: { width: 1280, height: 720 } });
  await loot(page); await wait(page, 500); await shot(page, '01-coffre-de-butin-dans-la-scene');
  await click(page, '#loot-bag'); await wait(page, 700); await shot(page, '02-tri-du-coffre-de-butin');
  await click(page, '#loot-sheet [data-lb="close"]');
  await ev(page, () => __idle.ui.openTab('arena')); await wait(page, 900); await shot(page, '03-arene-dans-combat');
  await arena(page, 10); await wait(page, 7000); await shot(page, '04-arene-sur-la-carte');
  await wait(page, 4000); await shot(page, '05-arene-sorts-et-cartes');
  await click(page, '.am-skip'); await wait(page, 2500); await shot(page, '06-arene-fin-etoiles');
  await click(page, '.am-close'); await wait(page, 400);
  await ev(page, () => { __idle.ui.view.defiTab = 'arena'; __idle.ui.openTab('dungeons'); }); await wait(page, 900); await shot(page, '07-donjons-silhouettes');
  await click(page, '.dg-card [data-action="dungeon-sel"]'); await wait(page, 900); await shot(page, '08-feuille-portrait-du-boss');
  await ev(page, () => { __idle.ui.view.dungeonSheet = false; __idle.ui.dgSheet(''); __idle.state.keys = 30; __idle.ui.openTab('dungeons'); }); await wait(page, 600);
  await click(page, '[data-action="sweep-all-ask"]'); await wait(page, 900); await shot(page, '09-balayer-tout-total-annonce');
  await ev(page, () => { __idle.ui.closeModal(); __idle.ui.state.keys = 3; __idle.ui.actions.enterDungeon('crypt', 'any', 'gold', 'easy'); __idle.ui.closePanel(); });
  await page.waitForSelector('.door-screen', { timeout: 40000 }).catch(() => {}); await wait(page, 500); await shot(page, '10-portes-dessinees');
  await ev(page, () => { __idle.ui.closeModal(); __idle.ui.openTab('upgrades'); }); await wait(page, 900); await shot(page, '11-portrait-evolutif-du-heros');
  await ev(page, () => __idle.ui.openTab('stats')); await wait(page, 900); await shot(page, '12-statistiques-courbe-et-records');
  await ev(page, () => __idle.ui.openTab('expeditions')); await wait(page, 900); await shot(page, '13-carte-des-expeditions');
  await ev(page, () => { __idle.ui.closePanel(); const r = __idle.renderer; ['Efficace !', 'Résiste', 'Affaibli !'].forEach((t, i) => r.addText(t, 260 + i * 80, 140, '#6dff8a', '#e6ffe8')); }); await wait(page, 300); await shot(page, '14-textes-en-mots-entiers');
  await ctx.close();
}
{
  const { page, ctx } = await session('t', { size: { width: 390, height: 844 } });
  await arena(page, 5); await wait(page, 7000); await shot(page, '15-arene-telephone');
  await ctx.close();
}
{
  const { page, ctx } = await session('v1', { video: true, size: { width: 1280, height: 720 } });
  await arena(page, 12); await wait(page, 45000); await click(page, '.am-skip'); await wait(page, 3000);
  await finish(ctx, page, '01-arene-sur-la-carte');
}
{
  const { page, ctx } = await session('v2', { video: true, size: { width: 1280, height: 720 } });
  for (let i = 0; i < 4; i++) { await loot(page); await wait(page, 2500); }
  await click(page, '#loot-bag'); await wait(page, 2000); await click(page, '#loot-sheet [data-lb="keep-best"]'); await wait(page, 2000);
  await finish(ctx, page, '02-coffre-de-butin');
}
{
  const { page, ctx } = await session('v3', { video: true, size: { width: 1280, height: 720 } });
  await ev(page, () => { __idle.ui.view.arenaTeam = Object.keys(__idle.state.companions.owned).slice(11, 14); __idle.ui.arenaRun('survival'); }); await wait(page, 30000);
  await finish(ctx, page, '03-survie-sur-la-carte');
}
await browser.close(); server.close();
