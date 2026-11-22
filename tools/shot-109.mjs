// v10.9 : captures rapides pour le cadrage. node tools/shot-109.mjs <sortie> <WxH> [js à exécuter après le démarrage] [attente ms]
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [out, size = '1116x993', js = '', wait = '800'] = process.argv.slice(2);
const [width, height] = size.split('x').map(Number);
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const fx = JSON.parse(await readFile('tests/fixtures/endgame.json', 'utf8'));
fx.maxStage = Math.max(fx.maxStage ?? 1, 200); fx.gold = 1e60; fx.materials.shards = 6000; fx.playSeconds = 1e5; fx.records = { ...fx.records, bestStage: Math.max(fx.records?.bestStage ?? 1, 200) };
const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log(`✘ erreur JS : ${e.message}`));
page.on('console', (m) => { if (m.type() === 'log' && m.text().startsWith('»')) console.log(m.text()); });
await page.addInitScript((r) => { if (!sessionStorage.getItem('m')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('m', '1'); } }, JSON.stringify(fx));
await page.goto(url);
await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
await page.waitForTimeout(6000);
await page.evaluate(() => { document.querySelectorAll('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) [data-action="offline-claim"]').forEach((b) => b.click()); __idle.ui.closeModal(); });
if (js) { await page.evaluate(`(async () => { ${js} })()`); }
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
await browser.close(); server.close();
