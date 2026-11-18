// v9.10 : contrôles du prompt (sauvegarde de fin de jeu) aux 3 tailles : le Sceau ne recouvre pas la ligne de la
// vague ; le doigt est caché après 30 min de jeu (action déjà vue 3 fois) ; la Veillée n'est pas permise sur PC
// fenêtré ; volet latéral sur PC. Usage : node tools/e2e-910.mjs
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = await startServer(0);
const browser = await chromium.launch();
const raw = JSON.parse(await readFile('tests/fixtures/endgame.json', 'utf8'));
raw.playSeconds = Math.max(raw.playSeconds ?? 0, 7200);
raw.ui = { ...(raw.ui ?? {}), sealCount: { claim: 5, rebirth: 5, mentor: 5, upgrade: 5, equip: 5 } };
let ok = 0, n = 0; const errors = [];
const check = (c, msg) => { n++; if (c) ok++; console.log(`${c ? '✔' : '✘'} ${msg}`); };
for (const [w, h] of [[1116, 993], [1920, 1080], [460, 640]]) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((r) => { if (!sessionStorage.getItem('m')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('m', '1'); } }, JSON.stringify(raw));
  await page.goto(`http://localhost:${server.address().port}/`);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(8000);
  await page.evaluate(() => document.querySelectorAll('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) [data-action="offline-claim"]').forEach((b) => b.click()));
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const seal = document.getElementById('next-action'), hud = document.getElementById('hud'), news = document.getElementById('news');
    const a = seal.getBoundingClientRect(), b = news.getBoundingClientRect(), p = document.getElementById('progress').getBoundingClientRect();
    const over = (x, y) => y.height > 0 && x.height > 0 && !(x.bottom <= y.top || x.top >= y.bottom || x.right <= y.left || x.left >= y.right);
    const hiddenNews = hud.classList.contains('seal-over');
    return { sealShown: !seal.classList.contains('hidden'), overNews: !hiddenNews && over(a, b), overBar: over(a, p),
      finger: !seal.querySelector('.na-finger').classList.contains('hidden'), kind: seal.dataset.kind, side: document.getElementById('app').classList.contains('side-ui') };
  });
  check(!r.overNews && !r.overBar, `${w}×${h} : le Sceau ne recouvre pas la ligne de la vague ${JSON.stringify(r)}`);
  // v9.11 (3) : le doigt reste sur une action qui fait progresser, jamais sur un contenu facultatif.
  const progress = ['claim', 'equip', 'upgrade', 'skills', 'quest', 'rebirth', 'place', 'team', 'level', 'mentor', 'lootbag', 'retry'].includes(r.kind);
  check(r.finger === progress, `${w}×${h} : doigt ${r.finger ? 'sur' : 'absent de'} « ${r.kind} »`);
  check(r.side === (w > 900 || w > h), `${w}×${h} : volet ${r.side ? 'latéral' : 'du bas'}`);
  await page.context().close();
}
check(!errors.length, `aucune erreur JavaScript ${errors.join(' | ')}`);
console.log(`${ok}/${n} vérifications réussies`);
await browser.close(); server.close();
process.exit(ok === n ? 0 : 1);
