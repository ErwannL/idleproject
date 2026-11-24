// v10.4 (partie 3 du plan) : Compétences dans un vrai navigateur.
//   node tools/e2e-1040-skills.mjs        → captures dans SHOTS (par défaut /tmp/ascendrya-1040-skills)
// v10.13 (lot 4) : sur PC (1920 x 1080), pour 3 classes : les 11 cartes du héros (6 Attaques + 5 Boosts) cliquées tour à tour donnent 11 data-vfx
// différents et 11 animations réellement différentes (pixels du canvas de l aperçu en combat, 160 px) ; aucune erreur JavaScript.
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
  await page.waitForSelector('#panel-body .dsk-card', { timeout: 8000 });
  await page.waitForTimeout(500);
}

// v10.13 (lot 4) : la fiche PC est l'aperçu en combat (.dsk-prev) ; cartes .dsk-card, deux modes (Attaques 6, Boosts 5). Le téléphone a sa propre vue (kit 10.12).
const FORMATS = [[1920, 1080, false, 'pc']];
const CLASSES = ['assassin', 'knight', 'pyromancer'];

for (const [w, h, touch, tag] of FORMATS) {
  const { ctx, page } = await open(w, h, { touch });
  for (const cls of CLASSES) {
    await setClass(page, cls);
    const fxs = [], sigs = [], sizes = [];
    let n = 0;
    for (const mode of ['s', 'r']) {
      if (mode === 'r') { await page.click('.dsk-mode:not(.on) .m-mode'); await page.waitForTimeout(300); }
      const count = await page.locator('#panel-body .dsk-card').count();
      n += count;
      for (let i = 0; i < count; i++) {
        await page.locator('#panel-body .dsk-card').nth(i).click();
        await page.waitForFunction((k) => document.querySelectorAll('#panel-body .dsk-card')[k]?.getAttribute('aria-pressed') === 'true', i, { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(250);
        const sel = '#panel-body .dsk-prev canvas.sk-vignette';
        fxs.push(await page.evaluate((s2) => document.querySelector(s2)?.dataset.vfx ?? null, sel));
        sizes.push(await page.evaluate((s2) => { const c = document.querySelector(s2); return c ? [c.width, c.height] : null; }, sel));
        const frames = [];
        for (let t = 0; t < 7; t++) { frames.push(await hashCanvas(page, sel)); await page.waitForTimeout(110); }
        sigs.push(frames);
        if (n - count + i === 0 || n - count + i === 5 || n - count + i === 8) await page.screenshot({ path: `${SHOTS}/${tag}-${cls}-case${n - count + i}.png` });
      }
    }
    ok(`${tag} ${cls} : 11 cartes (6 compétences + 5 Boosts)`, n === 11, `n=${n}`);
    ok(`${tag} ${cls} : 11 data-vfx différents`, new Set(fxs).size === 11 && fxs.every((x) => x && x !== 'combo_burst'), fxs.join(' '));
    // animations réellement différentes : la suite d'empreintes de chaque carte n'est celle d'aucune autre, et chaque effet se dessine
    const key = (f) => f.map((x) => `${x?.h}`).join('|');
    const keys = sigs.map(key);
    const drawn = sigs.every((f) => f.some((x) => x && x.n > 30));
    const moving = sigs.filter((f) => new Set(f.map((x) => x?.h)).size > 1).length;
    let minDiff = 7;
    for (let a2 = 0; a2 < sigs.length; a2++) for (let b2 = a2 + 1; b2 < sigs.length; b2++) { const d = sigs[a2].filter((x, k) => x?.h !== sigs[b2][k]?.h).length; minDiff = Math.min(minDiff, d); }
    ok(`${tag} ${cls} : 11 animations différentes (pixels du canvas), toutes dessinées, toutes animées`, new Set(keys).size === 11 && drawn && moving >= 10 && minDiff >= 3, `distinctes=${new Set(keys).size} dessinées=${drawn} animées=${moving} écartMin=${minDiff}/7`);
    ok(`${tag} ${cls} : vignette de 160 px (canvas)`, sizes.every((s2) => s2 && s2[0] === 160 && s2[1] === 160), JSON.stringify(sizes[0]));
    const inPrev = await page.evaluate(() => { const p = document.querySelector('#panel-body .dsk-prev'); return !!p && !!p.querySelector('canvas.sk-vignette') && p.querySelectorAll('img').length >= 3; });
    ok(`${tag} ${cls} : aperçu en combat = héros + effet animé + 2 monstres`, inPrev);
  }
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
