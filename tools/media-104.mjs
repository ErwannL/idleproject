// Photos et vidéos des nouveautés 10.4 (pages plein écran, Personnage, Forge, Bastion, donjons, compétences, coffre) :
// node tools/media-104.mjs <sortie>
import { createRequire } from 'node:module';
import { readFile, mkdir, rename, rm } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] ?? 'dist/media-10.4';
// MEDIA_ONLY=absence,v2 : ne refaire que certaines parties (photos, absence, phone, v1, v2, v3, v4).
const ONLY = (process.env.MEDIA_ONLY ?? '').split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
await mkdir(`${out}/photos`, { recursive: true }); await mkdir(`${out}/videos`, { recursive: true });
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const fx = JSON.parse(await readFile('tests/fixtures/endgame.json', 'utf8'));
fx.maxStage = Math.max(fx.maxStage ?? 1, 200);
fx.materials.shards = 6000; fx.materials.grimoire = 14; fx.gold = 1e60;
const raw = JSON.stringify(fx);
const PC = { width: 1280, height: 720 }, TALL = { width: 1116, height: 993 }, WIDE = { width: 1716, height: 1000 }, PHONE = { width: 390, height: 844 };
const HOUR = 3_600_000;
async function boot(page, wait = 8500) {
  await page.goto(url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(wait);
  await page.evaluate(() => { document.querySelectorAll('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) [data-action="offline-claim"]').forEach((b) => b.click()); __idle.ui.closeModal(); });
}
// Partie de démonstration : héros et compagnons équipés, sac fourni (11 armes Épiques à fusionner), donjons ouverts.
const seed = (page) => page.evaluate(async () => {
  const { generateItem, makeItem } = await import('./src/core/loot.js');
  const { Rng } = await import('./src/core/rng.js');
  const { equipItem } = await import('./src/core/inventory.js');
  const { equipBestAllGear } = await import('./src/core/companion-gear.js');
  const { upgradeItem } = await import('./src/core/forge.js');
  const { levelForStage } = await import('./src/core/combat.js');
  const s = __idle.state; const rng = new Rng(11);
  s.records.bestStage = Math.max(s.records.bestStage ?? 1, s.maxStage);
  s.materials.shards = 79000; s.materials.grimoire = 14; s.materials.ascension = 18; s.keys = Math.max(s.keys ?? 0, 5);
  s.dungeonBest = { crypt: 1, sanctuary: 1, furnace: 1, glacier: 1, citadel: 1 };
  s.dungeonsCleared = { crypt: 3, sanctuary: 2, furnace: 2, glacier: 2, citadel: 2 };
  const lvl = levelForStage(s.maxStage);
  s.inventory = [];
  for (let i = 0; i < 30; i++) s.inventory.push(generateItem(s, rng, { level: lvl - 12 + (i % 10), minRarity: i % 3 ? 'epic' : 'rare' }));
  for (const it of [...s.inventory]) equipItem(s, it.id);
  equipBestAllGear(s);
  Object.values(s.equipment).filter(Boolean).forEach((it, k) => { for (let n = 0; n < [7, 3, 5, 0, 2, 4, 1][k % 7]; n++) upgradeItem(s, it.id, rng); });
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
const click = async (page, sel, ms = 700) => { try { await page.locator(sel).first().click({ timeout: 3000 }); } catch { console.log(`(absent : ${sel})`); } await wait(page, ms); };
const tab = async (page, t, v) => { await ev(page, ([t, v]) => __idle.ui.openTab(t, v ?? null), [t, v]); await wait(page, 1300); };
const away = async (page, hours) => { await ev(page, (ms) => { __idle.save(); sessionStorage.setItem('skew', String(Number(sessionStorage.getItem('skew') || 0) + ms)); }, hours * HOUR); await page.goto(url); await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 }); await wait(page, 5000); };
// Au retour : on récupère d'abord le récit hors ligne (un seul écran à la fois), puis vient « Pendant ton absence ».
const absence = async (page) => {
  await page.evaluate(() => document.querySelector('#modal:not(.hidden) [data-action="offline-claim"]')?.click());
  await page.waitForSelector('#bastion-away', { timeout: 8000 }).catch(() => console.log('(pas d\'écran « Pendant ton absence »)'));
  await page.waitForTimeout(900);
};
const closeTips = (page) => ev(page, () => document.querySelectorAll('.learn-card [data-close], .howto-card [data-close], .bs-tip [data-action="bastion-tip"], .bs-kick button').forEach((b) => b.click()));
async function finish(ctx, page, name) {
  const v = page.video(); await ctx.close();
  if (v) { await rename(await v.path(), `${out}/videos/${name}.webm`); await rm(`${out}/videos/tmp-${name}`, { recursive: true, force: true }); console.log(`vidéo ${name}`); }
}
const chest = (page, n = 3) => ev(page, (n) => {
  const s = __idle.state; const pool = [...s.inventory, ...Object.values(s.equipment).filter(Boolean)];
  s.lootBag = Array.from({ length: n }, (_, k) => ({ ...structuredClone(pool[k % pool.length]), id: `m${k}-${Date.now()}`, rarity: 'rare', locked: false }));
  __idle.ui.lootBag.lastKey = ''; __idle.ui.lootBag.update(s);
}, n);
const drop = (page, rarity) => ev(page, (rarity) => {
  const s = __idle.state; const it = { ...structuredClone(s.lootBag[0] ?? s.inventory[0]), id: `d-${Date.now()}`, rarity };
  s.lootBag.push(it); __idle.ui.lootBag.lastKey = ''; __idle.ui.lootBag.update(s); __idle.ui.lootBag.bump(it, 300);
}, rarity);
const skills = async (page) => { await tab(page, 'skills'); };

// ---------- Photos : PC 1280 × 720, fenêtre haute 1116 × 993, grand écran 1716 × 1000 ----------
for (const [size, tag] of [[PC, ''], [TALL, '-1116x993'], [WIDE, '-1716x1000']]) {
  if (!want('photos')) break;
  const { page, ctx } = await session(`p${tag}`, { size });
  await tab(page, 'inventory'); await click(page, '.eq-doll .eq-slot[data-value="weapon"]'); await shot(page, `01-page-personnage${tag}`);
  if (!tag) {
    await click(page, '[data-action="eq-tab"][data-value="overview"]'); await shot(page, '02-personnage-vue-d-ensemble');
    const ally = await ev(page, () => (__idle.state.companions.equipped ?? []).find((id) => document.querySelector(`.eq-who[data-value="${id}"]`)) ?? null);
    if (ally) { await click(page, `.eq-who[data-value="${ally}"]`); await click(page, '[data-action="eq-tab"][data-value="stars"]'); await shot(page, '03-compagnon-etoiles'); }
  }
  await tab(page, 'forge', { forgeSeg: 'fuse' }); await click(page, '.fg-group[data-value="weapon|epic"]'); await shot(page, `04-page-forge-fusion${tag}`);
  if (!tag) { await click(page, '[data-action="forge-seg"][data-value="upgrade"]'); await click(page, '.fg-up-row'); await shot(page, '05-forge-renforcer'); }
  await tab(page, 'camp'); await wait(page, 1500); await shot(page, `06-bastion-demarrage-automatique${tag}`);
  await closeTips(page); await wait(page, 500); await shot(page, `07-bastion-village${tag}`);
  await click(page, '.bs-plot[data-building="forge"]'); await closeTips(page); await wait(page, 400); await shot(page, `08-bastion-fiche-du-forgeron${tag}`);
  await click(page, '.bs-top [data-action="bastion-view"][data-value="research"]'); await click(page, '.bs-tree .bs-node[data-value="sharp"], #bs-research .bs-node'); await shot(page, `09-bastion-arbre-des-recherches${tag}`);
  await tab(page, 'dungeons'); await shot(page, `10-donjons-bannieres${tag}`);
  await click(page, '[data-action="dungeon-sel"][data-value="crypt"]', 1200); await shot(page, `11-page-du-donjon${tag}`);
  await ev(page, () => { __idle.ui.dgSheet?.(''); __idle.ui.view.dungeonSheet = false; __idle.ui.closePanel(); }); await wait(page, 600);
  if (!tag) {
    await skills(page); await click(page, '.sk2-cell:nth-of-type(2)'); await shot(page, '12-competences-vignette-160');
    await click(page, '.sk2-cell:nth-of-type(5)'); await shot(page, '13-competences-autre-animation');
    for (const t of ['upgrades', 'contracts', 'shop', 'summon', 'stats']) { await tab(page, t); await shot(page, `14-illustrations-${t}`); }
    await ev(page, () => __idle.ui.closePanel()); await wait(page, 500);
    await chest(page); await wait(page, 1500); await shot(page, '15-coffre-vivant-et-tour-du-bastion');
    await drop(page, 'epic'); await wait(page, 400); await shot(page, '16-objet-qui-arrive-en-tournant');
    await wait(page, 700); await shot(page, '17-coffre-ouvert-bulle-de-rarete');
    await drop(page, 'legendary'); await wait(page, 950); await shot(page, '18-butin-legendaire');
  }
  await finish(ctx, page, `p${tag}`);
}
// ---------- « Pendant ton absence » : une commande, un chantier, 3 h d'absence ----------
if (want('absence')) {
  const { page, ctx } = await session('absence');
  await tab(page, 'camp'); await wait(page, 1200); await closeTips(page); await wait(page, 500);
  await click(page, '.bs-plot[data-building="forge"]'); await closeTips(page); await wait(page, 400);
  await click(page, '.bs-side [data-action="bastion-order"]');
  await away(page, 3); await absence(page); await shot(page, '19-pendant-ton-absence');
  await finish(ctx, page, 'absence');
}
// ---------- Photos téléphone ----------
if (want('phone')) {
  const { page, ctx } = await session('phone', { size: PHONE });
  await tab(page, 'inventory'); await shot(page, '20-telephone-personnage');
  await click(page, '.eq-doll .eq-slot[data-value="weapon"]'); await shot(page, '21-telephone-fiche-en-feuille-du-bas');
  await tab(page, 'forge', { forgeSeg: 'recycle' }); await shot(page, '22-telephone-forge');
  await tab(page, 'camp'); await closeTips(page); await wait(page, 600); await shot(page, '23-telephone-bastion');
  await click(page, '.bs-plot[data-building="forge"]'); await closeTips(page); await shot(page, '24-telephone-bastion-fiche');
  await tab(page, 'dungeons'); await shot(page, '25-telephone-donjons-bannieres');
  await click(page, '[data-action="dungeon-sel"][data-value="crypt"]', 1200); await shot(page, '26-telephone-page-du-donjon');
  await finish(ctx, page, 'phone');
}
// ---------- Vidéos (1280 × 720) ----------
if (want('v1')) {
  const { page, ctx } = await session('v1', { video: true });
  await tab(page, 'inventory'); await wait(page, 1500);
  for (const s of ['weapon', 'helmet', 'armor']) await click(page, `.eq-doll .eq-slot[data-value="${s}"]`, 1400);
  await click(page, '.eq-doll .eq-slot[data-value="weapon"]', 1200);
  await click(page, '.eq-sheet [data-action="upgrade-item"]:not([disabled])', 1700); await click(page, '.eq-sheet [data-action="upgrade-item"]:not([disabled])', 1700);
  await tab(page, 'forge', { forgeSeg: 'recycle' }); await wait(page, 1800);
  await click(page, '[data-action="forge-seg"][data-value="upgrade"]', 1800);
  await click(page, '[data-action="forge-seg"][data-value="fuse"]', 1500); await click(page, '.fg-group[data-value="weapon|epic"]', 2200);
  await click(page, '.fg-fuse-btns [data-action="fuse"]', 2600);
  await click(page, '[data-action="forge-seg"][data-value="craft"]', 2200);
  await finish(ctx, page, '01-pages-personnage-et-forge');
}
if (want('v2')) {
  const { page, ctx } = await session('v2', { video: true });
  await ev(page, () => __idle.ui.closePanel()); await wait(page, 2500);
  await click(page, '#bastion-tower', 4000); await closeTips(page); await wait(page, 2500);
  await click(page, '.bs-plot[data-building="forge"]', 2200); await closeTips(page); await wait(page, 1200);
  await click(page, '.bs-side [data-action="bastion-order"]', 2500);
  await click(page, '.bs-plot[data-building="library"]', 2200); await closeTips(page); await wait(page, 1500);
  await click(page, '.bs-top [data-action="bastion-view"][data-value="research"]', 3000);
  await click(page, '.bs-top [data-action="bastion-view"][data-value="map"]', 2500);
  await away(page, 3); await absence(page); await wait(page, 2500);
  await click(page, '#bastion-away .btn-gold, #bastion-away button', 2500);
  await tab(page, 'camp'); await closeTips(page); await wait(page, 2000);
  await click(page, '.bs-top [data-action="bastion-view"][data-value="research"]', 2200);
  await click(page, '.bs-tree .bs-node[data-value="sharp"], #bs-research .bs-node', 1800); await click(page, '.bs-side [data-action="bastion-research"]', 3000);
  await click(page, '.bs-top [data-action="bastion-view"][data-value="map"]', 3500);
  await finish(ctx, page, '02-bastion');
}
if (want('v3')) {
  const { page, ctx } = await session('v3', { video: true });
  await tab(page, 'dungeons'); await wait(page, 2000);
  await ev(page, () => document.getElementById('panel-body')?.scrollTo({ top: 400, behavior: 'smooth' })); await wait(page, 1800);
  await ev(page, () => document.getElementById('panel-body')?.scrollTo({ top: 0, behavior: 'smooth' })); await wait(page, 1200);
  await click(page, '[data-action="dungeon-sel"][data-value="crypt"]', 3500);
  await click(page, '.dgp-diff [data-value="normal"], [data-action="dungeon-diff"][data-value="normal"]', 2000);
  await ev(page, () => { __idle.ui.dgSheet?.(''); __idle.ui.view.dungeonSheet = false; __idle.ui.invalidate(); }); await wait(page, 800);
  await skills(page); await wait(page, 1500);
  for (let i = 1; i <= 6; i++) await click(page, `.sk2-cell:nth-of-type(${i})`, 2200);
  await finish(ctx, page, '03-donjons-et-competences');
}
if (want('v4')) {
  const { page, ctx } = await session('v4', { video: true });
  await ev(page, () => __idle.ui.closePanel()); await chest(page, 2); await wait(page, 4000);
  for (const r of ['rare', 'epic', 'rare', 'legendary']) { await drop(page, r); await wait(page, 3000); }
  await click(page, '#loot-bag', 3000);
  await finish(ctx, page, '04-coffre-de-butin-vivant');
}
await browser.close(); server.close();
console.log(`Médias écrits dans ${out}`);
