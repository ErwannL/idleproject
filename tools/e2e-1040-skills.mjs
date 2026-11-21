// v10.4 (partie 3 du plan) : Compétences dans un vrai navigateur.
//   node tools/e2e-1040-skills.mjs        → captures dans SHOTS (par défaut /tmp/ascendrya-1040-skills)
// Pour 3 classes, en 1116 × 993 et 390 × 844 : les 11 cases du héros cliquées tour à tour donnent 11 data-vfx différents et
// 11 animations réellement différentes (pixels du canvas), vignette de 160 px ; survol (PC) ou appui (téléphone) d'une case
// → vignette de 48 px qui s'anime ; rien du tout avec « Réduire les animations » ; aucune erreur JavaScript.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const SHOTS = process.env.SHOTS ?? '/tmp/ascendrya-1040-skills';
mkdirSync(SHOTS, { recursive: true });
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const raw = await readFile('tests/fixtures/endgame.json', 'utf8');
const results = [];
const ok = (name, pass, info = '') => { results.push(Boolean(pass)); console.log(`${pass ? '✔' : '✘'} ${name} ${info}`); };
const errors = [];

async function open(w, h, { touch = false, reduce = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: touch ? 2 : 1, hasTouch: touch, isMobile: touch, reducedMotion: reduce ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${w}×${h} : ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|WebSocket/.test(m.text())) errors.push(`${w}×${h} console : ${m.text()}`); });
  await page.addInitScript((r) => { if (!sessionStorage.getItem('c')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('c', '1'); } }, raw);
  await page.goto(url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => __idle.ui.closeModal());
  return { ctx, page };
}

// Empreinte du canvas de la vignette : une valeur par instant.
const hashCanvas = (page, sel) => page.evaluate((s) => {
  const c = document.querySelector(s);
  if (!c) return null;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let h = 2166136261, n = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3]) n++; h = Math.imul(h ^ d[i] ^ (d[i + 1] << 8) ^ (d[i + 2] << 16) ^ (d[i + 3] << 24) ^ (i >> 2), 16777619) >>> 0; }
  return { h, n };
}, sel);

async function setClass(page, cls) {
  await page.evaluate(async (c) => {
    const m = await import('/src/data/skills.js');
    __idle.state.heroClass = c; m.applyClassSkillNames(c);
    __idle.state.level = Math.max(__idle.state.level, 60);
    __idle.ui.invalidate?.();
    __idle.ui.openTab('skills');
  }, cls);
  await page.waitForSelector('#panel-body .sk2-cell', { timeout: 8000 });
  await page.waitForTimeout(500);
}

const FORMATS = [[1116, 993, false, 'pc'], [390, 844, true, 'tel']];
const CLASSES = ['assassin', 'knight', 'pyromancer'];

for (const [w, h, touch, tag] of FORMATS) {
  const { ctx, page } = await open(w, h, { touch });
  for (const cls of CLASSES) {
    await setClass(page, cls);
    const n = await page.locator('#panel-body .sk2-cell').count();
    ok(`${tag} ${cls} : 11 cases (6 compétences + 5 Boosts)`, n === 11, `n=${n}`);
    const fxs = [], sigs = [], sizes = [];
    for (let i = 0; i < n; i++) {
      await page.locator('#panel-body .sk2-cell').nth(i).click();
      await page.waitForFunction((k) => document.querySelectorAll('#panel-body .sk2-cell')[k]?.getAttribute('aria-pressed') === 'true', i, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(250);
      const sel = '#panel-body .sk2-bubble canvas.sk-vignette:not(.sk-mini)';
      fxs.push(await page.evaluate((s) => document.querySelector(s)?.dataset.vfx ?? null, sel));
      sizes.push(await page.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? [Math.round(r.width), Math.round(r.height)] : null; }, sel));
      const frames = [];
      for (let t = 0; t < 7; t++) { frames.push(await hashCanvas(page, sel)); await page.waitForTimeout(110); }
      sigs.push(frames);
      if (i === 0 || i === 5 || i === 8) { await page.evaluate(() => document.querySelector('#panel-body .sk2-bubble')?.scrollIntoView({ block: 'end' })); await page.waitForTimeout(150); await page.screenshot({ path: `${SHOTS}/${tag}-${cls}-case${i}.png` }); }
    }
    ok(`${tag} ${cls} : 11 data-vfx différents`, new Set(fxs).size === 11 && fxs.every((x) => x && x !== 'combo_burst'), fxs.join(' '));
    // animations réellement différentes : la suite d'empreintes de chaque case n'est celle d'aucune autre, et chaque effet se dessine
    const key = (f) => f.map((x) => `${x?.h}`).join('|');
    const keys = sigs.map(key);
    const drawn = sigs.every((f) => f.some((x) => x && x.n > 30));
    const moving = sigs.filter((f) => new Set(f.map((x) => x?.h)).size > 1).length;
    // proximité : aucun effet n'a, image par image, les mêmes pixels qu'un autre (au moins 3 images sur 7 différentes)
    let minDiff = 7;
    for (let a = 0; a < sigs.length; a++) for (let b = a + 1; b < sigs.length; b++) { const d = sigs[a].filter((x, k) => x?.h !== sigs[b][k]?.h).length; minDiff = Math.min(minDiff, d); }
    ok(`${tag} ${cls} : 11 animations différentes (pixels du canvas), toutes dessinées, toutes animées`, new Set(keys).size === 11 && drawn && moving >= 10 && minDiff >= 3, `distinctes=${new Set(keys).size} dessinées=${drawn} animées=${moving} écartMin=${minDiff}/7`);
    ok(`${tag} ${cls} : vignette de 160 px`, sizes.every((s) => s && s[0] === 160 && s[1] === 160), JSON.stringify(sizes[0]));
    // la fiche garde le nom de la case choisie : la vignette est en tête
    const head = await page.evaluate(() => { const b = document.querySelector('#panel-body .sk2-bubble'); const v = b?.querySelector('canvas.sk-vignette:not(.sk-mini)'); return v && b.firstElementChild?.contains(v); });
    ok(`${tag} ${cls} : vignette en tête de la fiche`, head);

    // survol (PC) ou appui (téléphone) : petite vignette de 48 px qui joue le même effet que la grande
    const cell = page.locator('#panel-body .sk2-cell').nth(1);
    await cell.scrollIntoViewIfNeeded();
    const box = await cell.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    if (touch) await page.mouse.down();
    await page.waitForTimeout(350);
    const mini = await page.evaluate(() => { const c = document.querySelectorAll('#panel-body .sk2-cell')[1]?.querySelector('canvas.sk-mini'); if (!c) return null; const r = c.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), disp: getComputedStyle(c).display, fx: c.dataset.vfx }; });
    const bigFx = await page.evaluate(() => document.querySelectorAll('#panel-body .sk2-cell')[1] && document.querySelectorAll('#panel-body canvas.sk-mini')[1]?.dataset.vfx);
    const mh = [];
    for (let t = 0; t < 6; t++) { mh.push(await page.evaluate(() => { const c = document.querySelectorAll('#panel-body .sk2-cell')[1]?.querySelector('canvas.sk-mini'); if (!c || !c.width) return null; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0, n = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3]) n++; h = (Math.imul(h, 31) + d[i] + d[i + 1] * 3 + d[i + 3]) >>> 0; } return `${h}:${n}`; })); await page.waitForTimeout(110); }
    if (cls === 'assassin') await page.screenshot({ path: `${SHOTS}/${tag}-${cls}-apercu48.png` });
    if (touch) await page.mouse.up();
    ok(`${tag} ${cls} : ${touch ? 'appui' : 'survol'} → vignette de 48 px visible, animée, du même effet que la case`,
      mini && mini.disp === 'block' && mini.w === 48 && mini.h === 48 && mini.fx === fxs[1] && mh.every((x) => x && Number(x.split(':')[1]) > 10) && new Set(mh).size > 1, JSON.stringify({ mini, distinct: new Set(mh).size }));
    await page.mouse.move(2, 2);
    await page.waitForTimeout(250);
    const gone = await page.evaluate(() => { const c = document.querySelectorAll('#panel-body .sk2-cell')[3]?.querySelector('canvas.sk-mini'); return c ? getComputedStyle(c).display : null; });
    ok(`${tag} ${cls} : hors survol, la petite vignette est cachée`, gone === 'none', gone);
  }
  await ctx.close();
}

// « Réduire les animations » : aucune vignette en petit au survol, l'icône reste
{
  const { ctx, page } = await open(1116, 993, { reduce: true });
  await setClass(page, 'assassin');
  const cell = page.locator('#panel-body .sk2-cell').nth(2);
  await cell.hover();
  await page.waitForTimeout(350);
  const r = await page.evaluate(() => { const c = document.querySelectorAll('#panel-body .sk2-cell')[2]; const m = c.querySelector('canvas.sk-mini'); const i = c.querySelector('.sk2-ic > img'); return { calm: document.documentElement.classList.contains('reduce-motion'), mini: m ? getComputedStyle(m).display : 'absent', icon: i ? getComputedStyle(i).visibility : 'absent' }; });
  ok('« Réduire les animations » : pas d\'aperçu animé au survol, l\'icône reste visible', r.calm && r.mini === 'none' && r.icon === 'visible', JSON.stringify(r));
  await page.screenshot({ path: `${SHOTS}/pc-reduire-animations.png` });
  await ctx.close();
}

// Les autres canvas animés de l'interface ne sont pas abîmés par la mise à jour sur place : portrait animé de l'Équipement
{
  const { ctx, page } = await open(1116, 993);
  await page.evaluate(() => __idle.ui.openTab('inventory'));
  await page.waitForTimeout(1200);
  const a = await page.evaluate(() => [...document.querySelectorAll('#panel-body canvas[data-anim]')].filter((c) => c.offsetParent !== null).map((c) => `${c.dataset.anim}:${c.width}x${c.height}`));
  await page.waitForTimeout(2500);
  const b = await page.evaluate(() => [...document.querySelectorAll('#panel-body canvas[data-anim]')].filter((c) => c.offsetParent !== null).map((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return [c.dataset.anim, n]; }));
  ok('portraits animés visibles (data-anim) : toujours présents et dessinés après plusieurs mises à jour', a.length > 0 && b.length === a.length && b.every(([, n]) => n > 50), JSON.stringify({ a, b }));
  await ctx.close();
}

ok('aucune erreur JavaScript', errors.length === 0, errors.slice(0, 5).join(' / '));
const n = results.filter(Boolean).length;
console.log(`${n}/${results.length} vérifications réussies — captures : ${SHOTS}`);
await browser.close(); server.close();
process.exit(n === results.length ? 0 : 1);
