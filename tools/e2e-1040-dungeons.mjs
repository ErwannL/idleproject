// v10.4 (partie 4 du plan docs/plan-v1040.md) : donjons — liste en bannières, page du donjon illustrée.
// Usage : node tools/e2e-1040-dungeons.mjs   (captures dans dist/e2e-1040-dungeons ou le dossier donné en 1er argument)
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = process.argv[2] ?? 'dist/e2e-1040-dungeons';
await mkdir(OUT, { recursive: true });
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const raw = await readFile('tests/fixtures/endgame.json', 'utf8');
const results = [];
const ok = (name, pass, info = '') => { results.push(Boolean(pass)); console.log(`${pass ? '✔' : '✘'} ${name} ${info}`); };
const errors = [];
const FORMATS = [
  [1116, 993, 1, 'PC 1116 × 993', false, true], [1280, 720, 1, 'PC 1280 × 720', false, true], [1716, 1000, 1, 'PC 1716 × 1000', false, true],
  [900, 600, 1, 'PC 900 × 600', false, false], [390, 844, 3, 'téléphone 390 × 844', true, false],
];
const IDS = ['crypt', 'sanctuary', 'furnace', 'glacier', 'citadel'];

async function open(w, h, dpr, touch) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${w}×${h} : ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|503|404/.test(m.text())) errors.push(`${w}×${h} console : ${m.text().slice(0, 160)}`); });
  await page.addInitScript((r) => { if (!sessionStorage.getItem('c')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('c', '1'); } }, raw);
  await page.goto(url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => __idle.ui.closeModal());
  return { ctx, page };
}
// État préparé ici : la sauvegarde de fin de jeu n'a aucun donjon terminé ; « Difficile » débloqué partout, 3 équipes enregistrées.
const PREP = () => {
  const s = __idle.state; s.keys = 5; s.maxStage = Math.max(s.maxStage, 200);
  s.dungeonBest = { crypt: 2, sanctuary: 1, furnace: 1, glacier: 1, citadel: 1 };
  s.dungeonsCleared = { crypt: 3, sanctuary: 3, furnace: 3, glacier: 3, citadel: 3 };
  const eq = [...s.companions.equipped];
  s.loadouts[0].team = eq.slice(0, 1); s.loadouts[1].team = eq.slice(); s.loadouts[1].name = 'Chasse aux boss';
  s.loadouts[2].team = eq.slice(0, 2);
  __idle.ui.view.dungeonSheet = false; __idle.ui.view.dungeonDiff = null; __idle.ui.view.dungeonHelp = false; __idle.ui.dgSheet(''); __idle.ui.openTab('dungeons'); __idle.ui.invalidate();
};
// Mots visibles de la page (le menu déroulant compte pour son option choisie) et nombre d'images chargées.
const STATS = () => {
  const root = document.querySelector('.dgp-root');
  const vis = (e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (cs.display === 'contents') return true; return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  let text = '';
  const walk = (n) => {
    if (n.nodeType === 3) { text += ` ${n.nodeValue}`; return; }
    if (n.nodeType !== 1 || n.tagName === 'OPTION' || n.tagName === 'SCRIPT' || n.tagName === 'STYLE' || !vis(n)) return;
    if (n.tagName === 'SELECT') { text += ` ${n.selectedOptions[0]?.textContent ?? ''}`; return; }
    n.childNodes.forEach(walk);
  };
  walk(root);
  const words = text.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t));
  const imgs = [...root.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth > 0 && vis(i));
  return { words: words.length, sample: words.join(' '), images: imgs.length, emoji: /\p{Extended_Pictographic}/u.test(root.innerText) };
};

for (const [w, h, dpr, label, touch, noScroll] of FORMATS) {
  const { ctx, page } = await open(w, h, dpr, touch);
  const before = errors.length;
  await page.evaluate(PREP);
  await page.waitForTimeout(700);

  // ---- liste : 5 bannières, une par ligne ----
  const list = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.dg-banner')];
    const rects = cards.map((c) => c.getBoundingClientRect());
    const panel = document.querySelector('.dg-grid').getBoundingClientRect();
    return { n: cards.length, rows: new Set(rects.map((r) => Math.round(r.top))).size, minH: Math.round(Math.min(...rects.map((r) => r.height))), w: Math.round(rects[0].width), pw: Math.round(panel.width),
      hScroll: document.documentElement.scrollWidth > innerWidth + 1, boss: cards.every((c) => c.querySelector('.dg-boss')?.naturalWidth > 0), emoji: /\p{Extended_Pictographic}/u.test(document.querySelector('.dg-grid').innerText) };
  });
  // les 5 se voient en défilant : chacune peut être amenée dans l'écran
  let seen = 0;
  for (let i = 0; i < 5; i++) {
    const ok1 = await page.evaluate((i) => { const c = document.querySelectorAll('.dg-banner')[i]; c.scrollIntoView({ block: 'center' }); const b = c.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth; }, i);
    if (ok1) seen += 1;
  }
  ok(`${label} : liste en 5 bannières, une par ligne, visibles en défilant, ${list.w} × ${list.minH} px, pas de débordement, sans emoji`,
    list.n === 5 && list.rows === 5 && seen === 5 && !list.hScroll && list.boss && !list.emoji && list.minH >= (touch ? 120 : 140) && list.w >= (touch ? w - 40 : 400), JSON.stringify({ ...list, seen }));
  await page.evaluate(() => document.querySelector('.dg-banner').scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: `${OUT}/list-${w}x${h}.png` });

  // ---- page du donjon, pour les 5 donjons ----
  const per = [];
  for (const id of IDS) {
    await page.evaluate(() => { __idle.ui.view.dungeonSheet = false; __idle.ui.dgSheet(''); __idle.ui.invalidate(); });
    await page.waitForTimeout(700);
    await page.evaluate((id) => document.querySelector(`.dg-banner .btn[data-action="dungeon-sel"][data-value="${id}"]`).scrollIntoView({ block: 'center' }), id);
    await page.click(`.dg-banner .btn[data-action="dungeon-sel"][data-value="${id}"]`);
    await page.waitForTimeout(700);
    const r = await page.evaluate((id) => {
      const q = (s) => document.querySelector(s);
      const inView = (e) => { if (!e) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.left >= -0.5 && b.right <= innerWidth + 0.5 && b.top >= -0.5 && b.bottom <= innerHeight + 0.5; };
      const sheet = q('.dgp-root'); const body = q('.dgp-body'); const enter = q('.dg-enter [data-action="enter-dungeon"]');
      const boss = q('.dgp-root .dg-boss-portrait'); const mech = q('.dgp-root .dg-mech-img');
      const secs = [...document.querySelectorAll('.dgp-root .dgp-sec')];
      const hero = q('.dgp-hero').getBoundingClientRect();
      return {
        id, enter: inView(enter), enterText: enter?.textContent.replace(/\s+/g, ' ').trim(), boss: boss.naturalWidth > 0 && boss.getBoundingClientRect().height >= (innerHeight < 700 ? 110 : 140),
        bossH: Math.round(boss.getBoundingClientRect().height), mech: mech.naturalWidth === 64 && mech.src.includes('art104/dungeon_mech_'), mechSrc: mech.getAttribute('src'),
        pill: q('.dg-mech-text').textContent.trim(), tiles: document.querySelectorAll('.dgp-tile').length, doors: document.querySelectorAll('.dgp-door img').length, gains: document.querySelectorAll('.dgp-gain').length,
        // rien d'important ne demande de défiler : chaque section est entièrement dans l'écran, et le corps ne défile pas
        secsVisible: secs.every(inView), bodyScroll: [body, q('.pg-main'), q('.pg-side')].filter(Boolean).some((e) => e.scrollHeight > e.clientHeight + 1), noHScroll: sheet.scrollWidth <= sheet.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1,
        heroShare: Math.round(100 * hero.height / innerHeight), stats: null,
        old: Boolean(q('.dgp-root .path-card, .dgp-root .reward-grid, .dgp-root .dungeon-info, .dgp-root .trait-box')), selectOk: (() => { const s = q('.dgp-team-select'); return Boolean(s) && s.options.length >= 3; })(),
      };
    }, id);
    r.stats = await page.evaluate(STATS);
    per.push(r);
    if (id === 'crypt' || id === 'citadel') await page.screenshot({ path: `${OUT}/page-${w}x${h}-${id}.png` });
  }
  const c = per[0];
  ok(`${label} : page du donjon (5 donjons) — mots ≤ 60, images ≥ 12, sans emoji`, per.every((r) => r.stats.words <= 60 && r.stats.images >= 12 && !r.stats.emoji), `mots ${per.map((r) => r.stats.words).join('/')}, images ${per.map((r) => r.stats.images).join('/')}`);
  ok(`${label} : « Entrer · Normal/Difficile · 1 clé » visible sans défiler`, per.every((r) => r.enter && /^Entrer · \S+ · 1 clé/.test(r.enterText)), per.map((r) => r.enterText).join(' | '));
  ok(`${label} : boss en grand (${c.bossH} px), pastille de mécanique avec son image PixelLab, 3 tuiles, 5 portes, rangée de gains`, per.every((r) => r.boss && r.mech && r.tiles === 3 && r.doors === 5 && r.gains >= 5 && /^[A-ZÉ]/.test(r.pill)), per.map((r) => r.pill).join(' | '));
  ok(`${label} : une image de mécanique par donjon`, new Set(per.map((r) => r.mechSrc)).size === 5);
  ok(`${label} : plus de cartes d'itinéraire, de « Butin : … · Chemin : … » ni de phrases d'aide sur la page`, per.every((r) => !r.old));
  ok(`${label} : aucun défilement horizontal`, per.every((r) => r.noHScroll));
  if (noScroll) ok(`${label} : rien d'important ne demande de défiler (sections entières à l'écran, corps sans défilement)`, per.every((r) => r.secsVisible && !r.bodyScroll), JSON.stringify(per.filter((r) => !r.secsVisible || r.bodyScroll).map((r) => r.id)));
  else console.log(`  (info ${label} : sections à l'écran ${per.every((r) => r.secsVisible)}, corps défile ${per.some((r) => r.bodyScroll)})`);
  if (w === 1116) console.log(`  mots de la page (crypte) : ${per[0].stats.sample}`);
  ok(`${label} : aucune erreur JS à l'ouverture des pages`, errors.length === before, errors.slice(before).join(' | '));

  // ---- menu déroulant des équipes, changement de difficulté, « ? » ----
  await page.evaluate(() => { __idle.ui.view.dungeonSheet = false; __idle.ui.dgSheet(''); __idle.ui.invalidate(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('.dg-banner .btn[data-action="dungeon-sel"][data-value="crypt"]').scrollIntoView({ block: 'center' }));
  await page.click('.dg-banner .btn[data-action="dungeon-sel"][data-value="crypt"]');
  await page.waitForTimeout(500);
  const team = await page.evaluate(() => {
    const s = document.querySelector('.dgp-team-select');
    const idx = [...s.options].findIndex((o) => /Chasse aux boss/.test(o.textContent));
    return { labelOk: /^Équipe : /.test(s.options[1]?.textContent ?? ''), idx, value: s.options[idx]?.value };
  });
  await page.selectOption('.dgp-team-select', team.value);
  await page.waitForTimeout(500);
  const team2 = await page.evaluate(() => ({ eq: __idle.state.companions.equipped.length, shown: document.querySelector('.dgp-team-select').selectedOptions[0].textContent, faces: document.querySelectorAll('.dgp-face').length }));
  ok(`${label} : menu déroulant « Équipe : Chasse aux boss » — applique l'équipe et la montre`, team.labelOk && team.idx > 0 && /Chasse aux boss/.test(team2.shown) && team2.faces >= 1, JSON.stringify({ team, team2 }));
  // changement de difficulté : tuile Normal puis Difficile
  const dif = [];
  for (const d of ['normal', 'hard', 'easy']) {
    await page.click(`.dgp-tile[data-value="${d}"]`);
    await page.waitForTimeout(300);
    dif.push(await page.evaluate((d) => ({ d, active: document.querySelector('.dgp-tile.active')?.dataset.value, enter: document.querySelector('.dg-enter [data-action="enter-dungeon"]').dataset.diff, text: document.querySelector('.dg-enter [data-action="enter-dungeon"]').textContent.replace(/\s+/g, ' ').trim(), nm: document.querySelector('.dgp-nm') !== null }), d));
  }
  ok(`${label} : changement de difficulté (tuiles) — l'« Entrer » suit`, dif.every((x) => x.active === x.d && x.enter === x.d) && /Normal/.test(dif[0].text) && /Difficile/.test(dif[1].text) && dif[1].nm, JSON.stringify(dif.map((x) => x.text)));
  // « ? » : les phrases d'aide s'ouvrent, puis se ferment
  await page.click('.dg-help');
  await page.waitForTimeout(300);
  const help = await page.evaluate(() => { const p = document.querySelector('.dgp-help'); const b = p?.getBoundingClientRect(); return { open: Boolean(p), inScreen: Boolean(b) && b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight, hasSlot: Boolean(p?.querySelector('[data-action="dungeon-slot-select"]')), words: (p?.innerText ?? '').split(/\s+/).length }; });
  await page.screenshot({ path: `${OUT}/help-${w}x${h}.png` });
  await page.click('.dg-help');
  await page.waitForTimeout(200);
  ok(`${label} : « ? » ouvre l'aide (phrases, butin ciblé, chemin) dans l'écran`, help.open && help.inScreen && help.hasSlot && help.words > 30, JSON.stringify(help));
  // « Entrer » lance le donjon : itinéraire Normal par défaut
  await page.click('.dg-enter [data-action="enter-dungeon"]');
  await page.waitForTimeout(500);
  const run = await page.evaluate(() => ({ d: __idle.state.dungeon?.id, route: __idle.state.dungeon?.route, diff: __idle.state.dungeon?.difficulty, sheet: Boolean(document.querySelector('.dgp-root')) }));
  ok(`${label} : « Entrer » lance le donjon (itinéraire Normal par défaut), la page se ferme`, run.d === 'crypt' && run.route === 'normal' && run.diff === 'easy' && !run.sheet, JSON.stringify(run));
  await page.evaluate(() => { if (__idle.state.dungeon) __idle.actions.abandonDungeon(); __idle.ui.closeModal(); });
  await ctx.close();
}

// ---- cas particuliers : donjon non terminé (tuiles verrouillées, cadenas), sans équipe enregistrée ----
{
  const { ctx, page } = await open(1116, 993, 1, false);
  await page.evaluate(() => {
    const s = __idle.state; s.keys = 3; s.maxStage = Math.max(s.maxStage, 200); s.dungeonBest = {}; s.dungeonsCleared = {};
    s.loadouts.forEach((l) => { l.team = null; });
    __idle.ui.view.dungeonSheet = false; __idle.ui.view.dungeonDiff = null; __idle.ui.openTab('dungeons'); __idle.ui.invalidate();
  });
  await page.waitForTimeout(600);
  await page.click('.dg-banner .btn[data-action="dungeon-sel"][data-value="crypt"]');
  await page.waitForTimeout(500);
  const v = await page.evaluate(() => ({
    locks: document.querySelectorAll('.dgp-tile.locked .dgp-lock').length, cond: [...document.querySelectorAll('.dgp-tile.locked small')].map((e) => e.textContent), disabled: [...document.querySelectorAll('.dgp-tile.locked')].every((t) => t.disabled),
    select: Boolean(document.querySelector('.dgp-team-select')), chest: document.querySelector('.dgp-gain.r-legendary')?.textContent.trim(), nm: Boolean(document.querySelector('.dgp-nm')),
  }));
  ok('Donjon jamais terminé : 2 tuiles verrouillées (cadenas + condition), gros coffre du premier passage affiché, pas de menu d\'équipes sans équipe enregistrée, pas de Cauchemar', v.locks === 2 && v.cond.join('|') === 'Après Facile|Après Normal' && v.disabled && v.chest === '×1' && !v.select && !v.nm, JSON.stringify(v));
  await page.screenshot({ path: `${OUT}/page-locked-1116x993.png` });
  await ctx.close();
}

const n = results.filter(Boolean).length;
console.log(`${n}/${results.length} vérifications réussies`);
await browser.close(); server.close();
process.exit(n === results.length && !errors.length ? 0 : 1);
