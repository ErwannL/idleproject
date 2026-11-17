// v9.8 (B7) : libellés coupés — ouvre les panneaux à une largeur donnée, en fr/en/ko, et liste les textes tronqués
// (ellipsis ou débordement). Usage : node tools/label-check.mjs [largeur=460] [hauteur=900]
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [w = 460, h = 900] = process.argv.slice(2).map(Number);
const TABS = ['inventory', 'upgrades', 'skills', 'forge', 'tree', 'hero', 'companions', 'summon', 'expeditions', 'campaign', 'dungeons', 'tower', 'boss', 'event', 'daybook', 'contracts', 'encyclopedia', 'shop', 'options'];
const server = await startServer(0);
const browser = await chromium.launch();
const raw = await readFile('tests/fixtures/endgame.json', 'utf8');
let total = 0;
for (const lang of ['fr', 'en', 'ko']) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  await page.addInitScript(([r, l]) => { if (!sessionStorage.getItem('lc')) { localStorage.setItem('idle-rpg.save', r); localStorage.setItem('idle-rpg.lang', l); sessionStorage.setItem('lc', '1'); } }, [raw, lang]);
  await page.goto(`http://localhost:${server.address().port}/`);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(6000);
  await page.evaluate(() => document.querySelectorAll('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) [data-action="offline-claim"]').forEach((b) => b.click()));
  for (const tab of TABS) {
    await page.evaluate((t) => __idle.ui.openTab(t), tab);
    await page.waitForTimeout(500);
    const cut = await page.evaluate(() => [...document.querySelectorAll('#panel *')].filter((e) => {
      if (!e.childElementCount && e.textContent.trim() && e.offsetParent) {
        const cs = getComputedStyle(e);
        return (cs.textOverflow === 'ellipsis' || cs.overflow === 'hidden') && e.scrollWidth > e.clientWidth + 1;
      }
      return false;
    }).map((e) => `${e.textContent.trim().slice(0, 40)} <${e.tagName.toLowerCase()}.${[...e.classList].join('.')} ⊂ .${[...(e.parentElement?.classList ?? [])].join('.')}>`));
    if (cut.length) { total += cut.length; console.log(`${lang} ${tab} : ${[...new Set(cut)].join(' | ')}`); }
  }
  await page.close();
}
console.log(`total ${total}`);
await browser.close(); server.close();
