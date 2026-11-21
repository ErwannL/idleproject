// Photos et vidéos des nouveautés 10.3.1 (Arène sur deux rangs, Boss commun, coffre de butin dans la scène, feuille de
// donjon) : node tools/media-1031.mjs <sortie>
import { createRequire } from 'node:module';
import { readFile, mkdir, rename, rm } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] ?? 'dist/media-10.3.1';
await mkdir(`${out}/photos`, { recursive: true }); await mkdir(`${out}/videos`, { recursive: true });
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const fx = JSON.parse(await readFile('tests/fixtures/endgame.json', 'utf8'));
fx.maxStage = Math.max(fx.maxStage ?? 1, 200);
const raw = JSON.stringify(fx);
const PC = { width: 1280, height: 720 }, TALL = { width: 1116, height: 993 }, PHONE = { width: 390, height: 844 };
async function session(name, { video = false, size = PC } = {}) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: video ? 1 : 2, ...(video ? { recordVideo: { dir: `${out}/videos/tmp-${name}`, size } } : {}) });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`✘ erreur JS (${name}) : ${e.message}`));
  await page.addInitScript((r) => { if (!sessionStorage.getItem('m')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('m', '1'); } }, raw);
  await page.goto(url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(8500);
  await page.evaluate(() => { document.querySelectorAll('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) [data-action="offline-claim"]').forEach((b) => b.click()); __idle.ui.closeModal(); });
  return { page, ctx };
}
const shot = (page, n) => page.screenshot({ path: `${out}/photos/${n}.png` }).then(() => console.log(`photo ${n}`));
const ev = (page, f, a) => page.evaluate(f, a);
const wait = (page, ms) => page.waitForTimeout(ms);
const click = async (page, sel, ms = 600) => { try { const l = page.locator(sel).first(); await l.click({ timeout: 3000 }); } catch { console.log(`(absent : ${sel})`); } await wait(page, ms); };
async function finish(ctx, page, name) {
  const v = page.video(); await ctx.close();
  if (v) { await rename(await v.path(), `${out}/videos/${name}.webm`); await rm(`${out}/videos/tmp-${name}`, { recursive: true, force: true }); console.log(`vidéo ${name}`); }
}
// Coffre : des objets rares, puis un Épique qui vole jusqu'au coffre.
const chest = (page, n = 4) => ev(page, (n) => {
  const s = __idle.state; const pool = [...s.inventory, ...(s.stash ?? []), ...Object.values(s.equipment).filter(Boolean)];
  s.lootBag = Array.from({ length: n }, (_, k) => ({ ...structuredClone(pool[k % pool.length]), id: `m${k}-${Date.now()}`, rarity: 'rare', locked: false }));
  __idle.ui.lootBag.lastKey = ''; __idle.ui.lootBag.update(s);
}, n);
const epic = (page) => ev(page, () => {
  const s = __idle.state; const it = { ...structuredClone(s.lootBag[0]), id: `e-${Date.now()}`, rarity: 'epic' };
  s.lootBag.push(it); __idle.ui.lootBag.lastKey = ''; __idle.ui.lootBag.update(s); __idle.ui.lootBag.bump(it, 300);
});
const arena = async (page, floor) => {
  await ev(page, () => __idle.ui.openTab('arena')); await wait(page, 900);
  await ev(page, (f) => { __idle.state.arena.cards.best = f - 1; __idle.ui.closePanel(); __idle.ui.arenaFight(f); // étage pas encore franchi : la fin montre ses récompenses }, floor);
  await page.waitForSelector('.arena-map .am-canvas', { timeout: 8000 }).catch(() => console.log('(Arène non ouverte)'));
};
const closeArena = (page) => ev(page, () => document.querySelector('.arena-map')?.close?.());
const bossCommun = async (page) => {
  await ev(page, async () => {
    const ui = __idle.ui; ui.globalBoss = { offline: true };
    const { globalBossState } = await import('./src/core/arena.js'); globalBossState(__idle.state).used = 0;
    ui.openTab('arena'); ui.view.arenaMode = 'global'; ui.invalidate();
  });
  await wait(page, 900); await click(page, '[data-action="global-boss"]', 400);
};
const dungeons = (page) => ev(page, () => {
  const s = __idle.state; s.keys = Math.max(s.keys ?? 0, 5);
  s.dungeonBest = { crypt: 1, sanctuary: 1, furnace: 1, glacier: 1, citadel: 1 };
  s.dungeonsCleared = { crypt: 3, sanctuary: 3, furnace: 3, glacier: 3, citadel: 3 };
  __idle.ui.openTab('dungeons'); __idle.ui.invalidate();
});

for (const [size, tag] of [[PC, ''], [PHONE, '-telephone']]) {
  const { page, ctx } = await session(`p${tag}`, { size });
  await chest(page); await wait(page, 1800); await shot(page, `01-coffre-dans-la-scene${tag}`);
  await epic(page); await wait(page, 450); await shot(page, `02-objet-epique-qui-vole${tag}`);
  await wait(page, 1200); await shot(page, `03-coffre-ouvert-rayon-et-bulle${tag}`);
  await click(page, '#loot-bag', 800); await shot(page, `04-tri-du-coffre${tag}`);
  await click(page, '#loot-sheet [data-lb="close"]', 400);
  await arena(page, 10); await wait(page, 9000); await shot(page, `05-arene-deux-rangs${tag}`);
  await click(page, '.am-skip', 4500); await shot(page, `06-arene-fin-en-deux-lignes${tag}`);
  await closeArena(page); await wait(page, 500);
  await arena(page, 25); await wait(page, 7000); await shot(page, `07-arene-gardien-et-sa-mecanique${tag}`);
  await closeArena(page); await wait(page, 500);
  await bossCommun(page); await wait(page, 9000); await shot(page, `08-boss-commun-dans-l-arene${tag}`);
  await click(page, '.am-skip', 3500); await shot(page, `09-boss-commun-bilan${tag}`);
  await closeArena(page); await wait(page, 500);
  await dungeons(page); await wait(page, 900); await click(page, '.dg-card .btn[data-action="dungeon-sel"][data-value="crypt"]', 900);
  await shot(page, `10-feuille-de-donjon-mecanique-en-image${tag}`);
  await finish(ctx, page, `p${tag}`);
}
{
  const { page, ctx } = await session('tall', { size: TALL });
  await arena(page, 20); await wait(page, 9000); await shot(page, '11-arene-boss-1116x993');
  await closeArena(page);
  await finish(ctx, page, 'tall');
}
// ---------- Vidéos ----------
{
  const { page, ctx } = await session('v1', { video: true });
  await arena(page, 10); await wait(page, 30000);
  await click(page, '.am-skip', 6000);
  await finish(ctx, page, '04-arene-sur-deux-rangs');
}
{
  const { page, ctx } = await session('v2', { video: true });
  await chest(page, 2); await wait(page, 2500);
  for (let i = 0; i < 3; i++) { await epic(page); await wait(page, 2600); }
  await click(page, '#loot-bag', 3000); await click(page, '#loot-sheet [data-lb="keep-best"], #loot-sheet .btn-gold', 3000);
  await finish(ctx, page, '05-coffre-de-butin-dans-la-scene');
}
{
  const { page, ctx } = await session('v3', { video: true });
  await bossCommun(page); await wait(page, 24000);
  await click(page, '.am-skip', 5000);
  await finish(ctx, page, '06-boss-commun');
}
await browser.close(); server.close();
console.log(`Médias écrits dans ${out}`);
