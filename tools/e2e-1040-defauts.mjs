// v10.4 (partie 7, « Petits défauts relevés ») : vérifié dans un vrai navigateur, sur la sauvegarde de fin de jeu.
//   node tools/e2e-1040-defauts.mjs            → tuile et cartes d'Arène sans nom coupé (5 formats), 5 onglets à 20 % d'image
//                                               au moins, aucune image cassée, aucun débordement horizontal, aucune erreur JS ;
//                                               captures PC et téléphone dans $CAPTURE_DIR (par défaut : dossier temporaire).
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const raw = await readFile('tests/fixtures/endgame.json', 'utf8');
const CAP = process.env.CAPTURE_DIR ?? join(tmpdir(), 'ascendrya-1040-defauts');
await mkdir(CAP, { recursive: true });
const results = [];
const ok = (name, pass, info = '') => { results.push(Boolean(pass)); console.log(`${pass ? '✔' : '✘'} ${name} ${info}`); };
const errors = [];
async function open(w, h, dpr = 1) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${w}×${h} : ${e.message}`));
  await page.addInitScript((r) => { if (!sessionStorage.getItem('c')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('c', '1'); } }, raw);
  await page.goto(url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => __idle.ui.closeModal());
  return { ctx, page };
}
const FORMATS = [[1116, 993, 1, 'PC 1116 × 993'], [1280, 720, 1, 'PC 1280 × 720'], [390, 844, 3, 'téléphone 390 × 844'], [900, 600, 1, 'PC 900 × 600'], [1716, 1000, 1, 'PC 1716 × 1000']];
const TABS = ['upgrades', 'contracts', 'stats', 'shop', 'summon'];
const NAMES = { upgrades: 'Améliorations', contracts: 'Missions', stats: 'Statistiques', shop: 'Boutique', summon: 'Invocation' };

// Part d'image dans le premier écran du panneau : même mesure que tools/art/check_screens.mjs.
const shareOf = (tab) => async (page) => page.evaluate(async (t) => {
  __idle.ui.openTab(t); await new Promise((res) => setTimeout(res, 900));
  const body = document.getElementById('panel-body');
  const pb = body.getBoundingClientRect();
  const view = { top: pb.top, bottom: Math.min(innerHeight, pb.bottom), left: pb.left, right: pb.right };
  let hit = 0, n = 0;
  for (let y = view.top + 4; y < view.bottom; y += 8) for (let x = view.left + 4; x < view.right; x += 8) {
    n++;
    const el = document.elementFromPoint(x, y);
    const pic = el?.closest?.('img, canvas, .dg-card, .arena-tile, .art-banner-wrap, [style*="background-image"]');
    if (pic && body.contains(pic)) hit++;
  }
  return hit / Math.max(1, n);
}, tab);

for (const [w, h, dpr, label] of FORMATS) {
  const { ctx, page } = await open(w, h, dpr);
  // ---- 1 : aucun nom coupé (cartes de l'Arène, tuile « Arène à cartes ») ----
  await page.evaluate(() => __idle.ui.openTab('arena'));
  await page.waitForSelector('#panel-body .pcard', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  const cards = await page.evaluate(() => [...document.querySelectorAll('#panel-body .pcard .pc-top b, #panel-body .am-name')].map((b) => ({
    name: b.textContent.trim(), cut: b.scrollHeight > b.clientHeight + 1 || b.scrollWidth > b.clientWidth + 1 })));
  const cut = cards.filter((c) => c.cut).map((c) => c.name);
  ok(`1 ${label} : ${cards.length} noms de cartes, aucun coupé`, cards.length >= 3 && cut.length === 0, cut.join(' | '));
  const pal = cards.some((c) => /Paladin d.azur/.test(c.name));
  ok(`1 ${label} : « Paladin d'azur » est écrit en entier`, pal && !cut.some((n) => /Paladin/.test(n)));
  await page.evaluate(() => __idle.ui.openTab('campaign'));
  await page.waitForSelector('#panel-body .arena-tile', { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(300);
  const tile = await page.evaluate(() => {
    const t = document.querySelector('#panel-body .arena-tile');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { w: r.width, kids: [...t.children].map((c) => { const q = c.getBoundingClientRect(); return { cut: c.scrollWidth > c.clientWidth + 1 || q.left < r.left - 0.5 || q.right > r.right + 0.5 || q.top < r.top - 0.5 || q.bottom > r.bottom + 0.5, txt: c.textContent.trim() }; }) };
  });
  ok(`1 ${label} : tuile « Arène à cartes » entière`, Boolean(tile) && tile.kids.length === 2 && tile.kids.every((k) => !k.cut), JSON.stringify(tile?.kids));

  // ---- 2 : part d'image, images chargées, pas de débordement ----
  for (const t of TABS) {
    const share = await shareOf(t)(page);
    await page.waitForTimeout(500);
    const info = await page.evaluate(async () => {
      const body = document.getElementById('panel-body');
      const urls = new Set();
      for (const el of body.querySelectorAll('[style*="background-image"]')) for (const m of el.getAttribute('style').matchAll(/url\(([^)]+)\)/g)) urls.add(m[1].replace(/["']/g, ''));
      const broken = [];
      for (const im of body.querySelectorAll('img')) { im.loading = 'eager'; if (im.src && !(im.complete && im.naturalWidth > 0)) broken.push(im.getAttribute('src')); }
      await Promise.all([...urls].map((u) => new Promise((res) => { const i = new Image(); i.onload = res; i.onerror = () => { broken.push(u); res(); }; i.src = u; })));
      for (let i = 0; i < 20 && [...body.querySelectorAll('img')].some((im) => im.src && !im.complete); i++) await new Promise((res) => setTimeout(res, 150)); // images paresseuses
      broken.length = 0;
      for (const im of body.querySelectorAll('img')) if (im.src && !(im.complete && im.naturalWidth > 0)) broken.push(im.getAttribute('src'));
      await Promise.all([...urls].map((u) => new Promise((res) => { const i = new Image(); i.onload = res; i.onerror = () => { broken.push(u); res(); }; i.src = u; })));
      return { broken: [...new Set(broken)], overflowBody: body.scrollWidth - body.clientWidth, overflowPage: document.documentElement.scrollWidth - innerWidth, tab: __idle.ui.tab };
    });
    const pc = Math.round(share * 100);
    if (w >= 1116 || w === 390) ok(`2 ${label} · ${NAMES[t]} : ${pc} % d'image (≥ 20 %)`, share >= 0.2, '');
    else console.log(`· ${label} · ${NAMES[t]} : ${pc} % d'image (mesure indicative)`);
    ok(`2 ${label} · ${NAMES[t]} : aucune image cassée, aucun débordement horizontal`, info.tab === t && info.broken.length === 0 && info.overflowBody <= 1 && info.overflowPage <= 1, JSON.stringify(info.broken.slice(0, 3)) + (info.overflowBody > 1 || info.overflowPage > 1 ? ` débord ${info.overflowBody}/${info.overflowPage}` : ''));
    if ((w === 1116 && h === 993) || w === 390) await page.screenshot({ path: join(CAP, `${t}_${w}.png`) });
  }
  await ctx.close();
}
ok('aucune erreur JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`Captures : ${CAP}`);
const n = results.filter(Boolean).length;
console.log(`${n}/${results.length} vérifications réussies`);
await browser.close(); server.close();
process.exit(n === results.length ? 0 : 1);
