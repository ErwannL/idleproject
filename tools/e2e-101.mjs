// v10.1 : parcours d'un joueur neuf qui ne suit QUE ce que le jeu lui montre (cartes « Comment jouer », cartes de
// déblocage « Essayer maintenant », doigt du tutoriel, Sceau). Vérifie :
//  - 3 premières minutes : jamais plus d'un appel à l'action à la fois ; chaque Sceau affiché a son « pourquoi » ;
//  - au bout de 12 minutes (ou dès que tout est fait) : ≥ 1 compagnon placé, ≥ 1 objet équipé, ≥ 5 améliorations,
//    ≥ 1 compétence apprise ; aucune consigne du Sceau répétée plus de 3 fois ;
//  - glossaire : toucher l'icône d'or ouvre sa carte ; aucun « avant → après » identique dans Améliorations.
// Usage : node tools/e2e-101.mjs [minutes=12]
import { createRequire } from 'node:module';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const MIN = Number(process.argv[2] ?? 12);
const server = await startServer(0);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1116, height: 993 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/?quests&learn`);
await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
const t0 = Date.now();
let multi = 0, noWhy = 0, seen = new Map(), lastText = '', done = null;
while (Date.now() - t0 < MIN * 60000) {
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => {
    const vis = (el) => el && !el.classList.contains('hidden') && el.offsetParent !== null;
    // Appels à l'action visibles en même temps (hors cartes d'apprentissage, qui suspendent le reste).
    const ctas = ['#next-action', '#quest-banner.ready', '.tuto-finger:not([hidden])'].filter((s) => vis(document.querySelector(s))).length;
    const learn = document.querySelector('.howto-card button, .learn-card [data-go]');
    const seal = document.querySelector('#next-action');
    const text = vis(seal) ? document.getElementById('next-action-text')?.textContent ?? '' : '';
    const why = vis(seal) ? document.getElementById('next-action-why')?.textContent ?? '' : '';
    if (learn) learn.click();
    else {
      const layer = document.getElementById('tuto-layer');
      const f = layer?.querySelector('.tuto-finger:not([hidden])');
      if (f && layer.target) layer.target.click();
      else if (vis(seal)) seal.click();
      document.querySelector('.best-card.first-item button')?.click();
      document.querySelector('#modal:not(.hidden) [data-action="summon-place"]')?.click();
      document.querySelector('#modal:not(.hidden) [data-action="close-modal"]')?.click();
    }
    const s = __idle.state;
    return { ctas, text, why, learn: Boolean(learn), team: (s.companions?.equipped ?? []).length, items: Object.values(s.equipment ?? {}).filter(Boolean).length,
      ups: Object.values(s.upgrades ?? {}).reduce((a, b) => a + b, 0), skills: Object.values(s.skills ?? {}).filter((v) => (v?.level ?? v) > 0).length };
  });
  const sec = (Date.now() - t0) / 1000;
  if (sec <= 180 && r.ctas > 1 && !r.learn) multi++;
  if (r.text && !r.why.trim()) noWhy++;
  if (r.text && r.text !== lastText) seen.set(r.text, (seen.get(r.text) ?? 0) + 1);
  lastText = r.text;
  if (r.team >= 1 && r.items >= 1 && r.ups >= 5 && r.skills >= 1) { done = { ...r, sec: Math.round(sec) }; break; }
  done = { ...r, sec: Math.round(sec), partial: true };
}
const repeats = [...seen].filter(([, n]) => n > 3);
// Glossaire et avant → après.
await page.evaluate(() => { document.querySelector('#modal:not(.hidden) [data-action="close-modal"]')?.click(); });
await page.click('#topbar .chip[data-currency="gold"]').catch(() => {});
await page.waitForTimeout(400);
const gloss = await page.evaluate(() => Boolean(document.querySelector('#modal:not(.hidden) .gloss-card')));
await page.evaluate(() => { document.querySelector('#modal:not(.hidden) [data-action="close-modal"]')?.click(); __idle.ui.openTab('upgrades'); });
await page.waitForTimeout(600);
const same = await page.evaluate(() => [...document.querySelectorAll('.upg-effect')].filter((e) => { const f = e.querySelector('.from')?.textContent, t = e.querySelector('.to')?.textContent; return f && t && f.trim() === t.trim(); }).length);
const checks = [
  ['un seul appel à l\'action à la fois (3 premières minutes)', multi === 0, `${multi} s avec plusieurs`],
  ['chaque Sceau a son « pourquoi »', noWhy === 0, `${noWhy} sans`],
  ['12 min : compagnon placé, objet équipé, 5 améliorations, 1 compétence', !done?.partial, JSON.stringify(done)],
  ['aucune consigne répétée plus de 3 fois', repeats.length === 0, repeats.map(([t, n]) => `${t}×${n}`).join(', ')],
  ['icône d\'or → carte de glossaire', gloss, ''],
  ['aucun avant → après identique', same === 0, `${same}`],
  ['aucune erreur JavaScript', errors.length === 0, errors.slice(0, 3).join(' | ')],
];
for (const [n, ok, info] of checks) console.log(`${ok ? '✔' : '✘'} ${n} ${info}`);
const ok = checks.filter((c) => c[1]).length;
console.log(`${ok}/${checks.length} vérifications réussies`);
await browser.close(); server.close();
process.exit(ok === checks.length ? 0 : 1);
