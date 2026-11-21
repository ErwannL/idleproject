// v10.3.1 (partie 3 du plan docs/plan-v1030.md) : feuille de donjon (portrait + mécanique en image + légende, « Entrer »
// visible), portes de salles côte à côte (clic et toucher), « Balayer tout » (total figé). Cinq formats.
// Usage : node tools/e2e-1031-dungeons.mjs   (captures dans dist/e2e-1031-dungeons ou le dossier donné en 1er argument)
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = process.argv[2] ?? 'dist/e2e-1031-dungeons';
await mkdir(OUT, { recursive: true });
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const raw = await readFile('tests/fixtures/endgame.json', 'utf8');
const results = [];
const ok = (name, pass, info = '') => { results.push(Boolean(pass)); console.log(`${pass ? '✔' : '✘'} ${name} ${info}`); };
const errors = [];
const FORMATS = [[1116, 993, 1, 'PC 1116 × 993', false], [1280, 720, 1, 'PC 1280 × 720', false], [900, 600, 1, 'PC 900 × 600', false], [1716, 1000, 1, 'PC 1716 × 1000', false], [390, 844, 3, 'téléphone 390 × 844', true]];
const IDS = ['crypt', 'sanctuary', 'furnace', 'glacier', 'citadel'];

async function open(w, h, dpr, touch) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${w}×${h} : ${e.message}`));
  await page.addInitScript((r) => { if (!sessionStorage.getItem('c')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('c', '1'); } }, raw);
  await page.goto(url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => __idle.ui.closeModal());
  return { ctx, page };
}
// État préparé ici : la sauvegarde de fin de jeu n'a aucun donjon terminé ; « Difficile » débloqué partout.
const PREP = () => {
  const s = __idle.state; s.keys = 5; s.maxStage = Math.max(s.maxStage, 200);
  s.dungeonBest = { crypt: 1, sanctuary: 1, furnace: 1, glacier: 1, citadel: 1 };
  s.dungeonsCleared = { crypt: 3, sanctuary: 3, furnace: 3, glacier: 3, citadel: 3 };
  __idle.ui.view.dungeonSheet = false; __idle.ui.view.dungeonDiff = null; __idle.ui.dgSheet(''); __idle.ui.openTab('dungeons'); __idle.ui.invalidate();
};

for (const [w, h, dpr, label, touch] of FORMATS) {
  const { ctx, page } = await open(w, h, dpr, touch);
  const before = errors.length;
  await page.evaluate(PREP);
  await page.waitForTimeout(700);
  const per = [];
  for (const id of IDS) {
    await page.evaluate(() => { __idle.ui.view.dungeonSheet = false; __idle.ui.dgSheet(''); __idle.ui.invalidate(); });
    await page.waitForTimeout(250);
    await page.click(`.dg-card .btn[data-action="dungeon-sel"][data-value="${id}"]`);
    await page.waitForTimeout(600);
    const r = await page.evaluate((id) => {
      const q = (s) => document.querySelector(s);
      const vis = (e) => { if (!e) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.left >= 0 && b.right <= innerWidth + 0.5 && b.top >= 0 && b.bottom <= innerHeight + 0.5; };
      const portrait = q('.dgp-root .dg-boss-portrait'); const mech = q('.dgp-root .dg-mech-img'); const legend = q('.dgp-root .dg-mech-text'); const enter = q('.dg-enter [data-action="enter-dungeon"]');
      const sheet = q('.dgp-root');
      const ratio = (e) => e ? e.getBoundingClientRect().width / e.naturalWidth : 0;
      const sw = sheet.scrollWidth, cw = sheet.clientWidth; // v10.4 : le conteneur est la page ou la feuille
      // le portrait et l'image doivent être visibles en faisant défiler la feuille si besoin : on ne regarde que « Entrer » sans défilement
      const pb = portrait.getBoundingClientRect(), mb = mech.getBoundingClientRect();
      return {
        id, portrait: portrait.naturalWidth > 0 && pb.width > 0, mech: mech.naturalWidth === 64 && mech.naturalHeight === 64 && mb.width > 0, mechSrc: mech.getAttribute('src'),
        legend: legend.textContent.trim().length > 10, enter: vis(enter), pw: Math.round(pb.width), mw: Math.round(mb.width), mi: Number.isInteger(ratio(mech)),
        noHScroll: sw <= cw + 1 && document.documentElement.scrollWidth <= innerWidth + 1, mechInSheet: mb.right <= sheet.getBoundingClientRect().right + 1,
        headTop: Math.round(pb.top), mechTop: Math.round(mb.top), mechBottom: Math.round(mb.bottom), enterTop: Math.round(enter.getBoundingClientRect().top),
      };
    }, id);
    per.push(r);
    if (id === 'crypt' || id === 'citadel') await page.screenshot({ path: `${OUT}/sheet-${w}x${h}-${id}.png` });
    // une capture de la feuille défilée jusqu'en haut (en tête)
  }
  const good = per.every((r) => r.portrait && r.mech && r.legend && r.enter && r.noHScroll && r.mechInSheet && r.mi);
  ok(`${label} : feuille des 5 donjons — portrait, image de mécanique (64 × 64, échelle entière), légende, « Entrer » visible, pas de défilement horizontal`, good, good ? `portrait ${per[0].pw} px, image ${per[0].mw} px` : JSON.stringify(per.filter((r) => !(r.portrait && r.mech && r.legend && r.enter && r.noHScroll && r.mechInSheet && r.mi))));
  const srcs = per.map((r) => r.mechSrc.replace(/^.*mech_|\.png$/g, ''));
  ok(`${label} : une image de mécanique par donjon (${srcs.join(', ')})`, new Set(srcs).size === 5);
  ok(`${label} : aucune erreur JS à l'ouverture des feuilles`, errors.length === before, errors.slice(before).join(' | '));
  if (w >= 900 && h >= 880) ok(`${label} : portrait du boss en grand (≥ 200 px)`, per.every((r) => r.pw >= 200), String(per[0].pw));

  // ---- portes : 2 puis 3 portes, côte à côte, 96 × 128, ouverture au clic / au toucher ----
  for (const count of [2, 3]) {
    await page.evaluate(() => { __idle.ui.view.dungeonSheet = false; __idle.ui.dgSheet(''); __idle.ui.closeModal(); });
    await page.evaluate(async (n) => {
      const s = __idle.state; s.keys = Math.max(s.keys, 2); s.dungeon = null; __idle.actions.enterDungeon('crypt', 'any', 'gold', 'easy', 'normal', 0);
      const ids = ['combat', 'elite', 'treasure', 'altar', 'rest'].slice(0, n);
      __idle.actions.offerDoors = () => { s.dungeon.doors = ids; return ids; };
      __idle.ui.closeModal(); __idle.ui.showDoors();
      await new Promise((r) => setTimeout(r, 300));
    }, count);
    await page.mouse.move(2, 2); // le survol incline la porte (rotateY) : mesure hors survol
    await page.waitForTimeout(500);
    const d = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('#modal:not(.hidden) .door-card')];
      const rects = cards.map((c) => c.getBoundingClientRect());
      const imgs = cards.map((c) => c.querySelector('img.door-art').getBoundingClientRect());
      const sameRow = rects.every((r) => Math.abs(r.top - rects[0].top) < 2);
      const ordered = rects.every((r, i) => i === 0 || r.left >= rects[i - 1].right - 1);
      const inScreen = rects.every((r) => r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight);
      const real = imgs.every((b) => Math.round(b.width) === 96 && Math.round(b.height) === 128);
      return { n: cards.length, sameRow, ordered, inScreen, real, w: imgs.map((b) => `${Math.round(b.width)}×${Math.round(b.height)}`).join(' '), hScroll: document.documentElement.scrollWidth <= innerWidth + 1 };
    });
    ok(`${label} : ${count} portes côte à côte, 96 × 128, dans l'écran`, d.n === count && d.sameRow && d.ordered && d.inScreen && d.real && d.hScroll, JSON.stringify(d));
    if (count === 3) await page.screenshot({ path: `${OUT}/doors-${w}x${h}.png` });
    // ouverture : toucher sur téléphone, clic ailleurs
    if (touch) await page.tap('#modal:not(.hidden) .door-card'); else await page.click('#modal:not(.hidden) .door-card');
    const opening = await page.evaluate(() => Boolean(document.querySelector('.door-card.opening')) || !document.querySelector('#modal:not(.hidden) .door-screen'));
    const closed = await page.waitForFunction(() => !document.querySelector('#modal:not(.hidden) .door-screen'), null, { timeout: 4000 }).then(() => true).catch(() => false);
    ok(`${label} : la porte s'ouvre ${touch ? 'au toucher' : 'au clic'} (${count} portes) puis la salle suit`, opening && closed);
    await page.evaluate(() => { const s = __idle.state; if (s.dungeon) __idle.actions.abandonDungeon(); __idle.ui.closeModal(); });
    await page.waitForTimeout(200);
  }
  await ctx.close();
}

// ---- « Balayer tout » : le total annoncé est celui qui est reçu, même si l'étape change entre l'aperçu et la confirmation ----
{
  const { ctx, page } = await open(1116, 993, 1, false);
  await page.evaluate(PREP);
  await page.waitForTimeout(600);
  const r = await page.evaluate(async () => {
    const s = __idle.state; s.keys = 5;
    const ev = (a) => { const b = document.createElement('button'); b.dataset.action = a; return b; };
    const pv = __idle.actions.sweepAllPreview();
    const goldAnnounced = pv.earned.gold ?? 0;
    const g0 = s.gold ?? 0;
    s.maxStage += 40; // le héros progresse entre l'aperçu et la confirmation
    __idle.actions.sweepAllRun();
    return { goldAnnounced, received: (s.gold ?? 0) - g0, stage: s.maxStage };
  });
  ok('Balayer tout : l\'or annoncé à l\'aperçu est l\'or reçu après un changement d\'étape', r.goldAnnounced > 0 && Math.abs(r.received - r.goldAnnounced) < 1e-6 * r.goldAnnounced + 1, JSON.stringify(r));
  await ctx.close();
}

const n = results.filter(Boolean).length;
console.log(`${n}/${results.length} vérifications réussies`);
await browser.close(); server.close();
process.exit(n === results.length && !errors.length ? 0 : 1);
