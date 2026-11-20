// Photos et vidéos des nouveautés 10.3 (Équipement, Forge, Bastion) : node tools/media-103.mjs <sortie>
import { createRequire } from 'node:module';
import { readFile, mkdir, rename, rm } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] ?? 'dist/media-10.3';
await mkdir(`${out}/photos`, { recursive: true }); await mkdir(`${out}/videos`, { recursive: true });
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const fx = JSON.parse(await readFile('tests/fixtures/endgame.json', 'utf8'));
fx.maxStage = Math.max(fx.maxStage ?? 1, 200);
fx.materials.shards = 6000; fx.materials.grimoire = 14; fx.gold = 1e60;
const raw = JSON.stringify(fx);
const PC = { width: 1280, height: 720 }, TALL = { width: 1116, height: 993 }, PHONE = { width: 390, height: 844 };
const HOUR = 3_600_000;
async function boot(page, wait = 8500) {
  await page.goto(url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(wait);
  await page.evaluate(() => { document.querySelectorAll('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) [data-action="offline-claim"]').forEach((b) => b.click()); __idle.ui.closeModal(); });
}
// Partie de démonstration : héros et compagnons équipés (Épiques et Légendaires, quelques renforts), un sac fourni
// (un meilleur casque, 11 armes Épiques à fusionner, des objets inutiles), de quoi payer.
const seed = (page) => page.evaluate(async () => {
  const { generateItem, makeItem } = await import('./src/core/loot.js');
  const { Rng } = await import('./src/core/rng.js');
  const { equipItem } = await import('./src/core/inventory.js');
  const { equipBestAllGear } = await import('./src/core/companion-gear.js');
  const { upgradeItem } = await import('./src/core/forge.js');
  const { levelForStage } = await import('./src/core/combat.js');
  const s = __idle.state; const rng = new Rng(11);
  s.records.bestStage = Math.max(s.records.bestStage ?? 1, s.maxStage);
  s.materials.shards = 79000; s.materials.grimoire = 14; s.materials.ascension = 18;
  const lvl = levelForStage(s.maxStage);
  s.inventory = [];
  for (let i = 0; i < 30; i++) s.inventory.push(generateItem(s, rng, { level: lvl - 12 + (i % 10), minRarity: i % 3 ? 'epic' : 'rare' }));
  for (const it of [...s.inventory]) equipItem(s, it.id);
  equipBestAllGear(s);
  const worn = Object.values(s.equipment).filter(Boolean);
  worn.forEach((it, k) => { for (let n = 0; n < [7, 3, 5, 0, 2, 4, 1][k % 7]; n++) upgradeItem(s, it.id, rng); });
  for (let i = 0; i < 11; i++) s.inventory.push(makeItem(s, 'short_sword', 'epic', lvl - 40 + i, undefined, rng));
  for (let i = 0; i < 6; i++) s.inventory.push(generateItem(s, rng, { level: lvl - 60 }));
  s.inventory.push(makeItem(s, 'iron_helm', 'legendary', lvl, undefined, rng));
  Object.assign(__idle.ui.view, { selectedItemId: null, eqSlot: null, sheetOpen: null, gearWho: 'hero', eqTab: 'gear' });
  __idle.save();
});
async function session(name, { video = false, size = PC } = {}) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: video ? 1 : 2, ...(video ? { recordVideo: { dir: `${out}/videos/tmp-${name}`, size } } : {}) });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`✘ erreur JS (${name}) : ${e.message}`));
  await page.addInitScript((r) => { if (!sessionStorage.getItem('m')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('m', '1'); } }, raw);
  await page.addInitScript(() => { const k = Number(sessionStorage.getItem('skew') || 0); const real = Date.now.bind(Date); Date.now = () => real() + k; });
  await boot(page);
  await seed(page);
  return { page, ctx };
}
const shot = (page, n) => page.screenshot({ path: `${out}/photos/${n}.png` }).then(() => console.log(`photo ${n}`));
const ev = (page, f, a) => page.evaluate(f, a);
const wait = (page, ms) => page.waitForTimeout(ms);
const click = async (page, sel, ms = 600) => { try { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded({ timeout: 2500 }); await l.click({ timeout: 2500 }); } catch { console.log(`(absent : ${sel})`); } await wait(page, ms); };
const tab = async (page, t, v) => { await ev(page, ([t, v]) => __idle.ui.openTab(t, v ?? null), [t, v]); await wait(page, 900); };
const tall = (page, t) => ev(page, (t) => { if (!__idle.ui.panelTallFor(t)) __idle.ui.togglePanelLow(); }, t);
const away = async (page, hours) => { await ev(page, (ms) => { __idle.save(); sessionStorage.setItem('skew', String(Number(sessionStorage.getItem('skew') || 0) + ms)); }, hours * HOUR); await boot(page, 3500); };
async function finish(ctx, page, name) {
  const v = page.video(); await ctx.close();
  if (v) { await rename(await v.path(), `${out}/videos/${name}.webm`); await rm(`${out}/videos/tmp-${name}`, { recursive: true, force: true }); console.log(`vidéo ${name}`); }
}
const firstAlly = (page) => ev(page, () => (__idle.state.companions.equipped ?? []).find((id) => document.querySelector(`.eq-who[data-value="${id}"]`)) ?? null);

// ---------- Photos PC (1280 × 720) ----------
{
  const { page, ctx } = await session('pc');
  await tab(page, 'inventory'); await click(page, '.eq-doll .eq-slot[data-value="weapon"]');
  await shot(page, '01-equipement-heros-et-fiche');
  await click(page, '.eq-sheet [data-action="upgrade-item"]:not([disabled])', 900); await shot(page, '02-renforcer-avant-apres');
  await click(page, '[data-action="eq-quick"]'); await shot(page, '03-equipement-rapide-avant-apres');
  await ev(page, () => { __idle.ui.view.eqQuick = null; __idle.ui.invalidate(); }); await wait(page, 400);
  const ally = await firstAlly(page);
  if (ally) {
    await click(page, `.eq-who[data-value="${ally}"]`); await shot(page, '04-compagnon-equipement');
    await click(page, '[data-action="eq-tab"][data-value="stars"]'); await shot(page, '05-compagnon-etoiles');
    await click(page, '[data-action="eq-tab"][data-value="skills"]'); await shot(page, '06-compagnon-competences');
    await click(page, '[data-action="eq-tab"][data-value="overview"]'); await shot(page, '07-compagnon-vue-d-ensemble');
  }
  await tab(page, 'forge', { forgeSeg: 'recycle' }); await shot(page, '08-forge-les-4-ateliers');
  await click(page, '[data-action="forge-seg"][data-value="upgrade"]'); await click(page, '.fg-up-row'); await shot(page, '09-forge-renforcer');
  await click(page, '[data-action="forge-seg"][data-value="fuse"]'); await click(page, '.fg-group[data-value="weapon|epic"]'); await shot(page, '10-forge-fusion-detaillee');
  await click(page, '[data-action="forge-seg"][data-value="craft"]'); await shot(page, '11-forge-fabriquer');
  await tab(page, 'camp'); await shot(page, '12-bastion-carte');
  await click(page, '.bs-card[data-building="forge"] .bs-medal'); await click(page, '.bs-wlist [data-action="bastion-worker"]');
  await click(page, '.bs-card[data-building="forge"]'); await shot(page, '13-bastion-forgeron-et-commandes');
  await click(page, '.bs-detail [data-action="bastion-order"]'); await click(page, '.bs-detail [data-action="bastion-build"]');
  await click(page, '.bs-card[data-building="library"] .bs-medal'); await click(page, '.bs-wlist [data-action="bastion-worker"]');
  await click(page, '.bs-card[data-building="library"]'); await click(page, '.bs-detail [data-action="bastion-build"]');
  await ev(page, () => { __idle.ui.view.bastionSel = null; __idle.ui.invalidate(); }); await wait(page, 500); await shot(page, '14-bastion-chantiers-en-cours');
  await away(page, 3); await tab(page, 'camp'); await shot(page, '15-bastion-au-retour-3-h-plus-tard');
  await ev(page, () => __idle.ui.closePanel()); await wait(page, 600); await click(page, '#loot-bag', 800); await shot(page, '16-commande-livree-dans-le-coffre-de-butin');
  await click(page, '#loot-sheet [data-lb="close"]', 300); await tab(page, 'camp');
  await click(page, '.bs-res'); await click(page, '[data-action="bastion-research"]'); await ev(page, () => document.querySelector('.bs-research, .bs-res')?.scrollIntoView({ block: 'center' })); await wait(page, 500);
  await shot(page, '17-bastion-recherches');
  await tab(page, 'inventory'); await click(page, '.eq-doll .eq-slot[data-value="weapon"]'); await shot(page, '18-equipement-raccourcis-du-bastion');
  await finish(ctx, page, 'pc');
}
// ---------- Photos fenêtre haute (1116 × 993) ----------
{
  const { page, ctx } = await session('tall', { size: TALL });
  await tab(page, 'inventory'); await click(page, '.eq-doll .eq-slot[data-value="weapon"]'); await shot(page, '19-equipement-1116x993');
  await tab(page, 'forge', { forgeSeg: 'fuse' }); await click(page, '.fg-group[data-value="weapon|epic"]'); await shot(page, '20-forge-fusion-1116x993');
  await tab(page, 'camp'); await shot(page, '21-bastion-1116x993');
  await ev(page, () => { __idle.ui.openTab('arena'); }); await wait(page, 900); await shot(page, '22-arene-onglet-de-combat');
  await ev(page, () => { __idle.state.arena.cards.best = Math.max(__idle.state.arena.cards.best, 11); __idle.ui.closePanel(); __idle.ui.arenaFight(10); });
  await wait(page, 7000); await shot(page, '23-arene-noms-des-monstres');
  await finish(ctx, page, 'tall');
}
// ---------- Photos téléphone (390 × 844) ----------
{
  const { page, ctx } = await session('phone', { size: PHONE });
  await tab(page, 'inventory'); await shot(page, '24-telephone-equipement');
  await click(page, '.eq-doll .eq-slot[data-value="weapon"]'); await shot(page, '25-telephone-fiche-en-feuille-du-bas');
  await tab(page, 'forge', { forgeSeg: 'recycle' }); await shot(page, '26-telephone-forge');
  await tab(page, 'camp'); await tall(page, 'camp'); await wait(page, 600); await shot(page, '27-telephone-bastion');
  await click(page, '.bs-card[data-building="forge"]'); await shot(page, '28-telephone-bastion-forgeron');
  await finish(ctx, page, 'phone');
}

// ---------- Vidéos (1280 × 720) ----------
{
  const { page, ctx } = await session('v1', { video: true });
  await tab(page, 'inventory'); await wait(page, 1200);
  for (const s of ['weapon', 'helmet', 'armor']) await click(page, `.eq-doll .eq-slot[data-value="${s}"]`, 1300);
  await click(page, '[data-action="eq-quick"]', 2000); await click(page, '[data-action="eq-quick-ok"]', 1800);
  await click(page, '.eq-doll .eq-slot[data-value="weapon"]', 1300);
  await click(page, '.eq-sheet [data-action="upgrade-item"]:not([disabled])', 1600);
  await click(page, '.eq-sheet [data-action="upgrade-item"]:not([disabled])', 1600);
  const ally = await firstAlly(page);
  if (ally) {
    await click(page, `.eq-who[data-value="${ally}"]`, 1500);
    for (const t of ['stars', 'skills', 'overview', 'gear']) await click(page, `[data-action="eq-tab"][data-value="${t}"]`, 1700);
  }
  await finish(ctx, page, '01-equipement');
}
{
  const { page, ctx } = await session('v2', { video: true });
  await tab(page, 'forge', { forgeSeg: 'recycle' }); await wait(page, 2200);
  await click(page, '[data-action="forge-seg"][data-value="upgrade"]', 1600); await click(page, '.fg-up-row', 1500);
  await click(page, '.fg-sheet [data-action="upgrade-item"]:not([disabled])', 1800);
  await click(page, '[data-action="forge-seg"][data-value="fuse"]', 1600); await click(page, '.fg-group[data-value="weapon|epic"]', 2200);
  await click(page, '.fg-fuse-btns [data-action="fuse"]', 2500);
  await click(page, '[data-action="forge-seg"][data-value="craft"]', 1800);
  for (const s of ['armor', 'ring', 'weapon']) await click(page, `.fg-slots [data-value="${s}"]`, 900);
  await click(page, '[data-action="craft"]', 2500);
  await click(page, '[data-action="forge-seg"][data-value="recycle"]', 1500); await click(page, '.fg-step [data-action="recycle-useless"]:not([disabled])', 2500);
  await finish(ctx, page, '02-forge');
}
{
  const { page, ctx } = await session('v3', { video: true });
  await tab(page, 'camp'); await wait(page, 2500);
  await click(page, '.bs-card[data-building="forge"] .bs-medal', 1500); await click(page, '.bs-wlist [data-action="bastion-worker"]', 1500);
  await click(page, '.bs-card[data-building="forge"]', 1800);
  await click(page, '.bs-slots [data-value="armor"]', 900); await click(page, '.bs-detail [data-action="bastion-order"]', 1800);
  await click(page, '.bs-detail [data-action="bastion-build"]', 2200);
  await click(page, '.bs-card[data-building="library"] .bs-medal', 1300); await click(page, '.bs-wlist [data-action="bastion-worker"]', 1300);
  await click(page, '.bs-card[data-building="library"]', 1200); await click(page, '.bs-detail [data-action="bastion-build"]', 2000);
  await ev(page, () => { __idle.ui.view.bastionSel = null; __idle.ui.invalidate(); }); await wait(page, 2500);
  await away(page, 3); await tab(page, 'camp'); await wait(page, 2500);
  await click(page, '.bs-card[data-building="forge"]', 2200);
  await ev(page, () => { __idle.ui.view.bastionSel = null; __idle.ui.invalidate(); }); await wait(page, 600);
  await click(page, '.bs-res', 1500); await click(page, '[data-action="bastion-research"]', 2500);
  await ev(page, () => __idle.ui.closePanel()); await wait(page, 800); await click(page, '#loot-bag', 2500); await click(page, '#loot-sheet [data-lb="close"]', 500);
  await tab(page, 'forge', { forgeSeg: 'fuse' }); await click(page, '.fg-group[data-value="weapon|epic"]', 2500);
  await finish(ctx, page, '03-bastion');
}
await browser.close(); server.close();
console.log(`Médias écrits dans ${out}`);
