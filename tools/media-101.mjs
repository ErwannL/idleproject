// Photos et vidéos des nouveautés 10.1 : node tools/media-101.mjs <sortie>
import { createRequire } from 'node:module';
import { readFile, mkdir, rename, rm } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] ?? 'docs/media-10.1';
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



// ---- Photos ----
{
  const { page, ctx } = await session('p');
  await tab(page, 'dungeons'); await wait(page, 900); await shot(page, '01-donjons-grandes-cartes');
  await click(page, '.dg-card [data-action="dungeon-sel"]'); await wait(page, 900); await shot(page, '02-donjon-feuille-entrer');
  await ev(page, () => { __idle.ui.view.dungeonSheet = false; __idle.ui.dgSheet(''); __idle.ui.view.defiTab = 'arena'; __idle.ui.openTab('tower'); }); await wait(page, 900);
  await click(page, '[data-action="card-auto"]'); await wait(page, 900); await shot(page, '03-arene-a-cartes-tour');
  await click(page, '[data-action="card-fight"]'); await wait(page, 2500); await shot(page, '04-arene-plateau-combat');
  await ev(page, () => __idle.ui.closeModal()); await wait(page, 300);
  await ev(page, () => { const c = document.querySelector('.cf-slot .pcard'); c?.classList.add('flipped'); }); await wait(page, 700); await shot(page, '05-carte-verso-sorts');
  await tab(page, 'companions'); await wait(page, 900);
  await click(page, '[data-action="companion-sel"][data-value="archangel"]'); await wait(page, 1200); await shot(page, '06-fiche-compagnon-en-grand');
  await ev(page, () => document.querySelector('[data-action="close-sheet"]')?.click()); await wait(page, 400);
  await ev(page, () => __idle.ui.glossCard('keys')); await wait(page, 600); await shot(page, '07-glossaire-cles');
  await ev(page, () => { __idle.ui.closeModal(); __idle.ui.openTab('stats'); }); await wait(page, 900); await shot(page, '08-statistiques-tuiles');
  await ev(page, () => __idle.ui.openTab('contracts', { missionTab: 'today' })); await wait(page, 900); await shot(page, '09-missions-icones');
  await ev(page, () => __idle.ui.openTab('skills')); await wait(page, 1200); await shot(page, '10-competences-vignette-animee');
  await ev(page, () => __idle.ui.openTab('daybook')); await wait(page, 900); await shot(page, '11-carnet-ressources-qui-dorment');
  await ev(page, () => { __idle.ui.closePanel(); __idle.ui.showWheel(); }); await wait(page, 900); await shot(page, '12-roue-pointe-sous-le-titre');
  await ev(page, () => __idle.ui.closeModal());
  await ctx.close();
}
{
  const { page, ctx } = await session('n', { fixture: false, q: '?quests&learn' });
  await wait(page, 1500); await shot(page, '13-comment-jouer-carte-1');
  await ctx.close();
}
{
  const { page, ctx } = await session('w', { size: { width: 1716, height: 1000 } });
  await tab(page, 'companions'); await wait(page, 900);
  await click(page, '[data-action="companion-sel"]'); await wait(page, 1200); await shot(page, '14-fiche-voile-plein-ecran-1716');
  await ctx.close();
}
// ---- Vidéos ----
{
  const { page, ctx } = await session('v1', { video: true });
  await ev(page, () => { __idle.ui.view.defiTab = 'arena'; __idle.ui.openTab('tower'); }); await wait(page, 1200);
  await click(page, '[data-action="card-auto"]'); await wait(page, 800);
  await click(page, '[data-action="card-fight"]'); await wait(page, 16000);
  await finish(ctx, page, '01-arene-a-cartes');
}
{
  const { page, ctx } = await session('v2', { video: true });
  await tab(page, 'dungeons'); await wait(page, 1500);
  await click(page, '.dg-card [data-action="dungeon-sel"]'); await wait(page, 2000);
  await click(page, '.dg-enter [data-action="enter-dungeon"]'); await wait(page, 30000);
  await finish(ctx, page, '02-donjon-portes-et-benedictions');
}
{
  const { page, ctx } = await session('v3', { video: true, fixture: false, q: '?quests&learn' });
  for (let i = 0; i < 3; i++) { await wait(page, 2500); await click(page, '.howto-card button'); }
  await wait(page, 25000);
  await finish(ctx, page, '03-premieres-minutes');
}
await browser.close(); server.close();
