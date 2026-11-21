// Photos et vidéos des nouveautés 10.6 (écran de jeu : quêtes et événements, coffre en bas à droite, Prime du Héraut,
// Marché des Lueurs, équipement, Améliorations, tri du coffre, fenêtre large) : node tools/media-106.mjs <sortie>
import { createRequire } from 'node:module';
import { readFile, mkdir, rename, rm } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] ?? 'dist/media-10.6';
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
// v10.6 : partie avancée (plus de « premières minutes »), coffre garni, prime du Héraut affichée.
const ready = (page) => ev(page, () => {
  const s = __idle.state; s.playSeconds = Math.max(s.playSeconds ?? 0, 4000);
  const pool = s.inventory.slice(0, 7);
  s.lootBag = pool.map((x, k) => ({ ...structuredClone(x), id: `m${k}`, rarity: ['rare', 'epic', 'legendary'][k % 3] }));
  s.ui.hints = [...(s.ui.hints ?? []), 'loot-chest'];
  __idle.ui.lootBag.lastKey = ''; __idle.ui.lootBag.update(s);
  document.querySelectorAll('.learn-card, .howto-card').forEach((e) => e.remove());
});
const bounty = (page) => ev(page, async () => {
  const B = await import('./src/core/herald-bounty.js');
  const s = __idle.state; s.heraldBounty = { day: '', count: 0, active: null, lastEnd: 0 };
  B.maybeStartBounty(s, Date.now(), 999); __idle.ui.hudQuests.shownAt = 0; __idle.ui.hudQuests.touchedBounty = true;
});
const SIZES = { '1116x993': TALL, '2536x1011': { width: 2536, height: 1011 }, telephone: PHONE };

if (want('photos')) {
  for (const [tag, size] of Object.entries(SIZES)) {
    const sfx = tag === '1116x993' ? '' : `-${tag}`;
    const { page, ctx } = await session(`photos-${tag}`, { size });
    await ready(page); await wait(page, 2500);
    await shot(page, `01-ecran-de-jeu-quetes-et-evenements${sfx}`);
    await bounty(page); await wait(page, 1600);
    await shot(page, `02-prime-du-heraut${sfx}`);
    await ev(page, () => __idle.ui.actions.bountyRefuse()); await wait(page, 600);
    await shot(page, `03-coffre-en-bas-a-droite${sfx}`);
    await tab(page, 'event'); await wait(page, 800);
    await shot(page, `04-marche-des-lueurs${sfx}`);
    await tab(page, 'inventory');
    await click(page, '.eq-doll .eq-slot[data-value="weapon"]', 900);
    await shot(page, `05-equipement-filtre-par-case${sfx}`);
    await ev(page, () => { const c = document.querySelectorAll('.eq-bag-grid .eq-card:not(.worn)')[2]; c?.scrollIntoView({ block: 'center' }); });
    await click(page, '.eq-bag-grid .eq-card:not(.worn) >> nth=2', 1200);
    await shot(page, `06-equipement-fenetre-de-l-objet${sfx}`);
    await tab(page, 'upgrades');
    await shot(page, `07-ameliorations-en-groupes${sfx}`);
    await ev(page, () => __idle.ui.closePanel?.()); await wait(page, 500);
    await ev(page, () => __idle.ui.lootBag.toggle(true)); await wait(page, 600);
    await click(page, '.lb-tile >> nth=1', 600);
    await shot(page, `08-tri-du-coffre-en-grille${sfx}`);
    await ev(page, () => __idle.ui.lootBag.toggle(false));
    await tab(page, 'camp'); await click(page, '[data-action="bastion-tab"][data-value="research"], [data-value="research"]', 1000);
    await shot(page, `09-recherches-noms-et-medaillons${sfx}`);
    await tab(page, 'dungeons'); await ev(page, () => { __idle.ui.view.dungeonSheet = 'glacier'; __idle.ui.invalidate(); }); await wait(page, 1200);
    await shot(page, `10-page-du-donjon${sfx}`);
    await tab(page, 'tree');
    await shot(page, `11-talents-medaillons${sfx}`);
    await tab(page, 'shop');
    await shot(page, `12-boutique-illustree${sfx}`);
    await ctx.close();
  }
}

if (want('videos')) {
  { // 1. Écran de jeu : la Prime arrive en glissant, la colonne d'événements, une quête finie.
    const { page, ctx } = await session('01-ecran-de-jeu', { video: true, size: TALL });
    await ready(page); await wait(page, 2500);
    await bounty(page); await wait(page, 3500);
    await ev(page, () => { const s = __idle.state; s.records.bestStage = Math.max(s.records.bestStage, 999); }); await wait(page, 1200);
    await click(page, '#hq-path', 2500);
    await click(page, '#hq-events .hq-ev >> nth=2', 2500); await ev(page, () => __idle.ui.closeModal()); await wait(page, 1500);
    await finish(ctx, page, '01-ecran-de-jeu-quetes-evenements-prime');
  }
  { // 2. Coffre : objets qui volent jusqu'en bas à droite, tri en grille.
    const { page, ctx } = await session('02-coffre', { video: true, size: TALL });
    await ready(page); await wait(page, 7000);
    await click(page, '#loot-bag', 1500); await click(page, '.lb-tile >> nth=0', 1500); await click(page, '.lb-tile >> nth=3', 2000);
    await finish(ctx, page, '02-coffre-en-bas-a-droite-et-tri');
  }
  { // 3. Événement : affiche, carte des lanternes, échoppe.
    const { page, ctx } = await session('03-evenement', { video: true, size: TALL });
    await ready(page); await tab(page, 'event'); await wait(page, 1500);
    await click(page, '.lt-node.ready >> nth=0', 2500); await ev(page, () => __idle.ui.closeModal());
    await ev(page, () => document.querySelector('.lt-shop')?.scrollIntoView({ behavior: 'smooth' })); await wait(page, 2500);
    await finish(ctx, page, '03-marche-des-lueurs');
  }
  { // 4. Équipement : filtre, fenêtre de l'objet, l'objet vole dans sa case, la Puissance défile.
    const { page, ctx } = await session('04-equipement', { video: true, size: { width: 1716, height: 1000 } });
    await ready(page); await tab(page, 'inventory');
    await click(page, '.eq-doll .eq-slot[data-value="weapon"]', 1500);
    await click(page, '.eq-bag-grid .eq-card:not(.worn) >> nth=0', 1800);
    await click(page, '.eq-itempop [data-action="equip"]', 2500);
    await tab(page, 'upgrades'); await wait(page, 2500);
    await finish(ctx, page, '04-equipement-et-ameliorations');
  }
}
await browser.close(); server.close();
console.log(`Médias écrits dans ${out}`);
