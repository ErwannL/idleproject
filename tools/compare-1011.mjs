// v10.11 (9) : planche avant / après — la même vue en 10.9.2 et en 10.11, côte à côte, dans les 4 tailles.
// node tools/compare-1011.mjs <dossier de l'ancienne version> [sortie=docs/screenshots/v10.11]
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { join, extname, resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const [oldDir, OUT = 'docs/screenshots/v10.11'] = process.argv.slice(2);
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
fx.maxStage = 200; fx.playSeconds = 1e5; fx.materials.shards = 6000; fx.records = { ...fx.records, bestStage: 200 };
const SIZES = { '2548x1390': [2548, 1390], '1920x1080': [1920, 1080], '1116x993': [1116, 993], '390x844': [390, 844] };
const VIEWS = {
  jeu: '',
  ameliorations: "__idle.state.gold=1000; __idle.ui.openTab('upgrades');",
  heros: "__idle.ui.openTab('inventory'); await new Promise(r=>setTimeout(r,500)); document.querySelectorAll('[data-action=gear-who]')[1]?.click();",
  bastion: "for (const b of Object.values(__idle.state.bastion?.buildings ?? {})) b.worker = null; const {openBastion}=await import('./src/ui/panels/camp.js'); openBastion(__idle.ui); await new Promise(r=>setTimeout(r,800)); document.querySelectorAll('.bs-kick button').forEach(b=>b.click()); document.querySelectorAll('.bs-age-new').forEach(e=>e.remove());",
  compagnons: "__idle.ui.openTab('companions');",
};
const browser = await chromium.launch();
async function shoot(url, size, js, file) {
  const [w, h] = SIZES[size];
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.addInitScript((r) => { if (!sessionStorage.getItem('m')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('m', '1'); } }, JSON.stringify(fx));
  await page.goto(url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(5000);
  await page.evaluate(() => { document.querySelectorAll('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) [data-action="offline-claim"]').forEach((b) => b.click()); __idle.ui.closeModal(); });
  if (js) await page.evaluate(`(async () => { ${js} })()`).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: file, type: 'jpeg', quality: 72 });
  await ctx.close();
}
const before = await serve(resolve(oldDir)), after = await serve(resolve('.'));
const rows = [];
for (const [view, js] of Object.entries(VIEWS)) for (const size of Object.keys(SIZES)) {
  const a = `${OUT}/${view}-${size}-10.9.2.jpg`, b = `${OUT}/${view}-${size}-10.11.jpg`;
  await shoot(before.url, size, js, a); await shoot(after.url, size, js, b);
  rows.push({ view, size, a: a.split('/').pop(), b: b.split('/').pop() });
  console.log(view, size);
}
await browser.close(); before.srv.close(); after.srv.close();
await writeFile(`${OUT}/planche.html`, `<!doctype html><meta charset="utf-8"><title>Avant / après 10.11</title><style>body{background:#111;color:#eee;font:14px system-ui;margin:16px}
  .r{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 24px}img{width:100%;border:1px solid #444}h2{margin:18px 0 6px;font-size:16px}</style>
  <h1>Ascendrya : 10.9.2 (gauche) et 10.11 (droite)</h1>${rows.map((r) => `<h2>${r.view} · ${r.size}</h2><div class="r"><img src="${r.a}" loading="lazy"><img src="${r.b}" loading="lazy"></div>`).join('')}`);
