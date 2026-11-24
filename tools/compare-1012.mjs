// v10.12 (§9) : planche avant / après — chaque onglet du téléphone en 10.11.4 et en 10.12, côte à côte (412x915, fixture fin de jeu).
// node tools/compare-1012.mjs <dossier de l'ancienne version (10.11.4)> [sortie=docs/screenshots/v10.12/avant-apres] [vue,vue,…]
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { join, extname, resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const [oldDir, OUT = 'docs/screenshots/v10.12/avant-apres', only] = process.argv.slice(2);
await mkdir(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2' };
async function serve(root) {
  const srv = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    try { const data = await readFile(join(root, p)); res.writeHead(200, { 'Content-Type': TYPES[extname(p)] ?? 'application/octet-stream' }); res.end(data); }
    catch { res.writeHead(404); res.end(); }
  }).listen(0, '127.0.0.1');
  await once(srv, 'listening');
  return { srv, url: `http://127.0.0.1:${srv.address().port}/` };
}
const fx = JSON.parse(await readFile('tests/fixtures/endgame.json', 'utf8'));
fx.maxStage = Math.max(fx.maxStage ?? 1, 200); fx.gold = 1e60; fx.materials.shards = 6000; fx.playSeconds = 1e5; fx.records = { ...fx.records, bestStage: Math.max(fx.records?.bestStage ?? 1, 200) };
const W = 412, H = 915;
const TABS = ['inventory', 'upgrades', 'skills', 'tree', 'forge', 'companions', 'camp', 'expeditions', 'campaign', 'dungeons', 'arena', 'tower', 'event', 'summon', 'shop', 'daybook', 'contracts', 'encyclopedia', 'looks', 'boss', 'ranking', 'guild', 'stats', 'options'];
const wait = (ms) => `await new Promise(r=>setTimeout(r,${ms}));`;
const VIEWS = Object.fromEntries(TABS.map((t) => [t, `__idle.ui.openTab('${t}');`]));
VIEWS['fiche-objet'] = `__idle.ui.openTab('inventory'); ${wait(1500)} document.querySelector('[data-action="eq-slot"]')?.click();`;
VIEWS['fiche-competence'] = `__idle.ui.openTab('skills'); ${wait(1500)} (document.querySelector('.m-tile[data-key="mSkillSheet"]') ?? document.querySelector('[data-action="skill-sel"]:not(.locked)'))?.click();`;
const names = only ? only.split(',') : Object.keys(VIEWS);
const browser = await chromium.launch();
async function shoot(url, js, file) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript((r) => { if (!sessionStorage.getItem('m')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('m', '1'); } }, JSON.stringify(fx));
  await page.goto(url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(5000);
  await page.evaluate(() => { document.querySelectorAll('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) [data-action="offline-claim"]').forEach((b) => b.click()); __idle.ui.closeModal(); });
  await page.evaluate(`(async () => { ${js} })()`).catch(() => {});
  await page.waitForTimeout(2800); // les fondus finissent
  await page.screenshot({ path: file, type: 'jpeg', quality: 70 });
  await ctx.close();
}
const before = await serve(resolve(oldDir)), after = await serve(resolve('.'));
for (const view of names) {
  await shoot(before.url, VIEWS[view], `${OUT}/${view}-10.11.4.jpg`); await shoot(after.url, VIEWS[view], `${OUT}/${view}-10.12.jpg`);
  console.log(view);
}
await browser.close(); before.srv.close(); after.srv.close();
await writeFile(`${OUT}/planche.html`, `<!doctype html><meta charset="utf-8"><title>Avant / après 10.12</title><style>body{background:#111;color:#eee;font:14px system-ui;margin:16px}
  .r{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 24px;max-width:860px}img{width:100%;border:1px solid #444}h2{margin:18px 0 6px;font-size:16px}</style>
  <h1>Ascendrya sur téléphone (412x915) : 10.11.4 (gauche) et 10.12 (droite)</h1>${Object.keys(VIEWS).map((v) => `<h2 id="${v}">${v}</h2><div class="r"><img src="${v}-10.11.4.jpg" loading="lazy" alt="${v} 10.11.4"><img src="${v}-10.12.jpg" loading="lazy" alt="${v} 10.12"></div>`).join('')}`);
