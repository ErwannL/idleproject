// v10.4 (partie 8) : revue complète des menus, sur PC (1116 × 993) et sur téléphone (390 × 844). Chaque onglet de chaque
// menu est ouvert, puis chacun de ses sous-écrans (segments, onglets internes — jamais un bouton qui dépense) : aucune
// erreur JavaScript, aucune image cassée, aucun « NaN », « undefined » ou « null » à l'écran, aucun panneau vide, aucun
// débordement horizontal. Usage : node tools/e2e-1040-revue.mjs
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const { MENUS } = await import('../src/ui/nav.js');
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const raw = await readFile('tests/fixtures/endgame.json', 'utf8');
const TABS = [...new Set(MENUS.flatMap((m) => m.tabs)), 'hero', 'options', 'inbox'];
let failed = 0;
for (const [w, h, label] of [[1116, 993, 'PC 1116 × 993'], [390, 844, 'téléphone 390 × 844']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((r) => { if (!sessionStorage.getItem('c')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('c', '1'); } }, raw);
  await page.goto(url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { __idle.ui.closeModal(); const s = __idle.state; s.keys = Math.max(s.keys ?? 0, 5); s.dungeonBest = { crypt: 1 }; s.dungeonsCleared = { crypt: 3 }; });
  const check = () => page.evaluate(() => {
    const body = document.getElementById('panel-body');
    const text = body?.innerText ?? '';
    const broken = [...document.querySelectorAll('#panel img')].filter((i) => i.complete && i.naturalWidth === 0 && i.offsetParent !== null).map((i) => i.getAttribute('src'));
    return { empty: text.trim().length < 3 && !body?.querySelector('img, canvas'), bad: (text.match(/\b(NaN|undefined|null)\b/g) ?? []).slice(0, 3), broken: broken.slice(0, 3),
      over: document.documentElement.scrollWidth - innerWidth };
  });
  let screens = 0; const problems = [];
  const note = (where, r) => { screens += 1; if (r.empty) problems.push(`${where} : panneau vide`); if (r.bad.length) problems.push(`${where} : ${r.bad.join(', ')}`); if (r.broken.length) problems.push(`${where} : image cassée ${r.broken.join(', ')}`); if (r.over > 1) problems.push(`${where} : déborde de ${r.over} px`); };
  for (const t of TABS) {
    const opened = await page.evaluate((t) => { try { __idle.ui.openTab(t); return __idle.ui.tab === t; } catch (e) { return String(e.message); } }, t);
    if (opened !== true) continue; // onglet fermé à ce stade de la partie
    await page.waitForSelector('#panel-body > *', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(350);
    note(t, await check());
    // Sous-écrans : segments et onglets internes (navigation seulement).
    const subs = await page.evaluate(() => [...document.querySelectorAll('#panel-body .seg-btn, #panel-body [role="tab"], #panel-body [data-action$="-tab"], #panel-body [data-action$="-seg"], #panel-body [data-action$="-view"], #panel-body [data-action="enc-tab"]')]
      .filter((b) => !b.disabled && b.offsetParent !== null).map((b, i) => { b.dataset.rv = String(i); return i; }));
    for (const i of subs) {
      const ok = await page.evaluate((i) => { const b = document.querySelector(`#panel-body [data-rv="${i}"]`); if (!b) return false; b.click(); return true; }, i);
      if (!ok) continue;
      await page.waitForTimeout(260);
      await page.evaluate(() => __idle.ui.closeModal?.());
      note(`${t} › ${i}`, await check());
    }
  }
  const pass = !errors.length && !problems.length;
  if (!pass) failed += 1;
  console.log(`${pass ? '✔' : '✘'} ${label} : ${screens} écrans, ${errors.length} erreur(s) JavaScript, ${problems.length} défaut(s) ${[...errors.slice(0, 3), ...problems.slice(0, 6)].join(' | ')}`);
  await ctx.close();
}
await browser.close(); server.close();
console.log(failed ? `${failed} format(s) en échec` : '2/2 vérifications réussies');
process.exit(failed ? 1 : 0);
