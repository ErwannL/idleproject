// Photos et vidéos des nouveautés 10.0 : node tools/media-10.mjs <sortie>
import { createRequire } from 'node:module';
import { readFile, mkdir, rename, rm } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] ?? 'docs/media-10.0';
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
  await page.waitForFunction(() => (__idle.renderer.allyPoseDx?.get('mercenary') ?? 0) > 20, null, { timeout: 30000, polling: 16 }).catch(() => {});
  await shot(page, '01-compagnon-qui-fonce');
  await page.waitForFunction(() => document.querySelector('#skill-bar .skill-btn'), null, { timeout: 5000 }).catch(() => {});
  await shot(page, '02-colonne-vague-competences-sceau');
  await cast(page, ['h:meteor']); await wait(page, 900); await shot(page, '03-meteore-cratere');
  await wait(page, 1500); await cast(page, ['h:cry']); await wait(page, 2200); await shot(page, '04-cri-de-guerre-icone-duree');
  await tab(page, 'companions'); await wait(page, 900);
  for (const [id, n] of [['shadow_lord', '05'], ['barbarian', '06'], ['demon_queen', '07']]) {
    await click(page, `[data-action="companion-sel"][data-value="${id}"]`); await wait(page, 1000); await shot(page, `${n}-fiche-${id}`);
    await ev(page, () => __idle.ui.closeModal?.());
  }
  await ev(page, () => { __idle.ui.view.selectedItemId = __idle.state.equipment.weapon.id; __idle.ui.view.sheetOpen = 'item'; __idle.ui.openTab('inventory'); }); await wait(page, 1000); await shot(page, '08-objet');
  await ev(page, () => { __idle.ui.view.sheetOpen = null; __idle.ui.openTab('contracts', { missionTab: 'today' }); }); await wait(page, 1000); await shot(page, '09-missions-fait');
  await ev(page, () => __idle.ui.openTab('shop', { shopCat: 'crystals' })); await wait(page, 900); await shot(page, '10-boutique-tickets-gagnes');
  await ev(page, () => { __idle.ui.closePanel(); __idle.ui.showWheel(); }); await wait(page, 900); await shot(page, '11-roue-quantites');
  await ev(page, () => __idle.ui.closeModal());
  await titan(page); await wait(page, 9000); await shot(page, '12-titan-equipe-x3');
  await ctx.close();
}
for (const [w, h, n] of [[1280, 720, '13-pc-1280x720'], [390, 844, '14-telephone']]) {
  const { page, ctx } = await session('s', { size: { width: w, height: h } });
  await wait(page, 1500); await shot(page, n); await ctx.close();
}
{ // 1. Équipe qui se bat vraiment
  const { page, ctx } = await session('v1', { video: true });
  await wait(page, 16000);
  await finish(ctx, page, '01-equipe-qui-fonce');
}
{ // 2. Titan
  const { page, ctx } = await session('v2', { video: true });
  await titan(page); await wait(page, 20000);
  await finish(ctx, page, '02-titan');
}
{ // 3. Sorts et impacts
  const { page, ctx } = await session('v3', { video: true });
  for (const s of ['h:cry', 'h:meteor', 'h:holy', 'c:shadow:2', 'c:priestess:1']) { await cast(page, [s]); await wait(page, 2400); }
  await finish(ctx, page, '03-sorts-et-impacts');
}
{ // 4. Fiches fidèles
  const { page, ctx } = await session('v4', { video: true });
  await tab(page, 'companions'); await wait(page, 1500);
  for (const id of ['shadow_lord', 'demon_queen', 'barbarian', 'mercenary', 'ninja', 'archangel']) { await click(page, `[data-action="companion-sel"][data-value="${id}"]`); await wait(page, 2200); await ev(page, () => __idle.ui.closeModal?.()); }
  await finish(ctx, page, '04-fiches-fideles');
}
await browser.close(); server.close();
console.log('fini');
