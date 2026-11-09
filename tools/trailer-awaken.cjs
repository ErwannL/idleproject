// v9.3.1 : trailer « ASCENDRYA — AWAKEN YOUR LEGEND » : rend docs/promo/trailer-awaken/stage.html image par image.
//   ROOT : dossier servi qui contient stage.html, PressStart2P.ttf, assets/ (lien vers assets du jeu), frames/ (captures
//   tools/record-trailer.mjs), ba2/shot-p1|p3 et aw/wake (captures du World Boss), aw/ui-*.png (captures de l'interface).
//   NODE_PATH=$(npm root -g) node tools/trailer-awaken.cjs ROOT OUT_DIR W H TEXT(1|0) [FROM TO]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const [,, ROOT, OUT, W = '1920', H = '1080', TEXT = '1', FROM = '0', TO = '40'] = process.argv;
const TYPES = { '.html': 'text/html', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.js': 'text/javascript' };
const srv = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] ?? 'application/octet-stream' }); r.end(b); } });
}).listen(0);
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +W, height: +H } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(`http://localhost:${srv.address().port}/stage.html?w=${W}&h=${H}&text=${TEXT}`);
  await p.evaluate(() => window.ready);
  const n0 = Math.round(+FROM * 60), n1 = Math.round(+TO * 60);
  for (let n = n0; n < n1; n++) {
    await p.evaluate((t) => window.render(t), n / 60);
    await p.screenshot({ path: `${OUT}/f${String(n).padStart(5, '0')}.png` });
    if (n % 300 === 0) console.log(`${(n / 60).toFixed(1)} s`);
  }
  await b.close(); srv.close();
})();
