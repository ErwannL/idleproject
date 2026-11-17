// Captures de contrôle : node tools/capture.mjs <sortie> <largeur>x<hauteur> [fixture|new] tab1 tab2 …
// Charge tests/fixtures/endgame.json (ou une partie neuve), ouvre chaque onglet et prend une capture.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFile, mkdir } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const [out = 'docs/captures', size = '1116x993', save = 'fixture', ...tabs] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
await mkdir(out, { recursive: true });
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
if (save !== 'new') {
  const raw = await readFile(save === 'fixture' ? 'tests/fixtures/endgame.json' : save, 'utf8');
  await page.addInitScript((r) => { if (!sessionStorage.getItem('cap')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('cap', '1'); } }, raw);
}
await page.goto(url + (process.env.Q ?? ''));
await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
await page.waitForTimeout(2500);
await page.evaluate(() => { document.querySelectorAll('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) [data-action="claim-offline"]').forEach((b) => b.click()); });
await page.keyboard.press('Escape');
await page.screenshot({ path: `${out}/scene.png` });
for (const t of tabs) {
  // « tab », « tab:{vue json} », ou « click:sélecteur » (clic dans la page, puis capture).
  const [tab, ...rest] = t.split(':');
  const view = rest.join(':');
  if (tab === 'click') { await page.click(view).catch((e) => console.log('clic raté', view, e.message.split('\n')[0])); await page.waitForTimeout(1500); await page.screenshot({ path: `${out}/click-${view.replace(/\W/g, '').slice(0, 30)}.png` }); continue; }
  if (tab === 'wait') { await page.waitForTimeout(Number(view)); continue; }
  await page.evaluate(([x, v]) => __idle.ui.openTab(x, v ? JSON.parse(v) : null), [tab, view]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${tab}${view ? '-' + view.replace(/\W/g, '') : ''}.png` });
}
console.log(errors.length ? `ERREURS:\n${errors.join('\n')}` : '0 erreur');
await browser.close(); server.close();
