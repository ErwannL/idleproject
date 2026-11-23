// v10.9 (partie 7) : contrôle automatique du cadrage. Parcourt l'écran de jeu, tous les onglets et les 5 âges du Bastion
// en 1116 × 993, 2536 × 1011 et 390 × 844, et signale :
//   - une image qui dépasse de plus de 4 px la case qui la contient (case qui coupe : overflow hidden / clip) ;
//   - un texte couvert à plus de 25 % par une image qui n'est pas son fond ;
//   - un texte coupé sans « … » (scrollWidth > clientWidth avec overflow hidden) ;
//   - deux étiquettes qui se chevauchent sur la carte du Bastion ;
//   - l'absence du coffre de butin sur l'écran de jeu.
// Écrit une planche de captures et le rapport dans docs/screenshots/v10.9/.
// Usage : node tools/audit-109.mjs [--sizes 1116x993,2536x1011,390x844] [--tabs upgrades,camp] [--out docs/screenshots/v10.9]
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const SIZES = opt('--sizes', '1116x993,1920x1080,2548x1390,390x844').split(','); // v10.11 (8) : l'écran du joueur et le 1080p
const GOLD = opt('--gold', ''); // v10.11 (8) : --gold 1000 = la partie du joueur (peu d'or)
const TABS = opt('--tabs', 'inventory,upgrades,skills,tree,forge,companions,camp,expeditions,summon,shop,daybook,contracts,dungeons,tower,arena,world,looks,stats,options,encyclopedia').split(',');
const OUT = opt('--out', 'docs/screenshots/v10.9');
await mkdir(OUT, { recursive: true });

const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const fx = JSON.parse(await readFile('tests/fixtures/endgame.json', 'utf8'));
fx.maxStage = Math.max(fx.maxStage ?? 1, 200); fx.gold = GOLD ? Number(GOLD) : 1e60; fx.materials.shards = 6000; fx.playSeconds = 1e5;
fx.records = { ...fx.records, bestStage: Math.max(fx.records?.bestStage ?? 1, 200) };

// Contrôles lancés dans la page : renvoie une liste de problèmes { kind, where, text }.
const CHECKS = () => {
  const out = [];
  const name = (e) => `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}${typeof e.className === 'string' && e.className ? `.${e.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''}`;
  const visible = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && e.offsetParent !== null; };
  const root = document.querySelector('#panel:not(.hidden)') ?? document.getElementById('app');
  // 1. Images qui dépassent de leur case (seulement si la case coupe : sinon l'image déborde volontairement).
  for (const im of root.querySelectorAll('img')) {
    if (!visible(im)) continue;
    if (getComputedStyle(im).animationName !== 'none') continue; // image animée (respiration, saut) : déborde un instant
    const box = im.parentElement; if (!box) continue;
    const cs = getComputedStyle(box);
    if (!/hidden|clip/.test(cs.overflow + cs.overflowX + cs.overflowY)) continue;
    const a = im.getBoundingClientRect(), b = box.getBoundingClientRect();
    const over = Math.max(b.left - a.left, a.right - b.right, b.top - a.top, a.bottom - b.bottom);
    if (over > 4 && a.width < b.width * 1.5) out.push({ kind: 'image-dépasse', where: `${name(box)} > ${name(im)}`, text: `${Math.round(over)} px` });
  }
  // 2 et 3. Textes coupés sans « … » et textes couverts par une image.
  const texts = [...root.querySelectorAll('b, small, span, p, h2, h3, h4, label, button, .nm, .dt')].filter((e) => visible(e) && e.childElementCount === 0 && e.textContent.trim().length > 1);
  for (const e of texts.slice(0, 1500)) {
    const cs = getComputedStyle(e);
    if (/hidden|clip/.test(cs.overflow + cs.overflowX) && e.scrollWidth > e.clientWidth + 1 && cs.textOverflow !== 'ellipsis' && !(+cs.webkitLineClamp > 0)) out.push({ kind: 'texte-coupé', where: name(e), text: e.textContent.trim().slice(0, 40) });
    const r = e.getBoundingClientRect();
    let hit = 0;
    for (const [fx, fy] of [[0.25, 0.5], [0.5, 0.5], [0.75, 0.5], [0.5, 0.25]]) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy;
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
      const top = document.elementFromPoint(x, y);
      if (top && top.tagName === 'IMG' && !e.contains(top) && !top.contains(e) && (e.compareDocumentPosition(top) & Node.DOCUMENT_POSITION_FOLLOWING) && !top.closest('.bs-ground, .px.bs-ground') && getComputedStyle(top).pointerEvents !== 'none') hit += 1;
    }
    if (hit >= 2) out.push({ kind: 'texte-couvert', where: name(e), text: e.textContent.trim().slice(0, 40) });
  }
  // 4. Étiquettes du Bastion qui se chevauchent.
  const tags = [...document.querySelectorAll('.bs-village .bs-tag')].filter(visible).map((e) => ({ e, r: e.getBoundingClientRect() }));
  for (let i = 0; i < tags.length; i++) for (let j = i + 1; j < tags.length; j++) {
    const a = tags[i].r, b = tags[j].r;
    if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push({ kind: 'étiquettes-chevauchées', where: 'bastion', text: `${tags[i].e.textContent.trim()} / ${tags[j].e.textContent.trim()}` });
  }
  const world = document.querySelector('.bs-village');
  if (world && visible(world)) {
    const W = world.getBoundingClientRect();
    for (const p of document.querySelectorAll('.bs-village .bs-plot')) {
      const r = p.getBoundingClientRect();
      if (r.left < W.left - 8 || r.right > W.right + 8 || r.top < W.top - 8 || r.bottom > W.bottom + 8) out.push({ kind: 'bâtiment-hors-carte', where: p.dataset.building, text: '' });
    }
  }
  // v10.11 (8.1) : titre de groupe sans aucune ligne sous lui.
  for (const g of root.querySelectorAll('.upg-group, section:has(> .section-title)')) {
    if (!visible(g)) continue;
    const rows = g.querySelectorAll('.upg-card, .upg-all-max, button, .card');
    if (!rows.length) out.push({ kind: 'groupe-vide', where: name(g), text: g.textContent.trim().slice(0, 30) });
  }
  // v10.11 (8.2) : image qui chevauche une case d'objet, une carte de statistique ou la pastille Niveau/Puissance (> 8 px).
  const blocks = [...root.querySelectorAll('.eq-stat, .eq-slot-box, .eq-id, .upg-card')].filter(visible).map((e) => ({ e, r: e.getBoundingClientRect() }));
  for (const im of root.querySelectorAll('img.eq-art, .eq-art-box img, .eq-art-box canvas')) {
    if (!visible(im)) continue;
    const a = im.getBoundingClientRect();
    for (const b of blocks) {
      if (b.e.contains(im)) continue;
      const ox = Math.min(a.right, b.r.right) - Math.max(a.left, b.r.left), oy = Math.min(a.bottom, b.r.bottom) - Math.max(a.top, b.r.top);
      if (ox > 8 && oy > 8) { out.push({ kind: 'image-sur-bloc', where: `${name(im)} / ${name(b.e)}`, text: `${Math.round(ox)}×${Math.round(oy)}` }); break; }
    }
  }
  // v10.11 (8.3) : centrage d'une page (écart marge gauche / marge droite du contenu).
  const pm = document.querySelector('#app.page-ui #panel-body');
  if (pm && innerWidth >= 1300) {
    const kids = [...pm.children].filter(visible).map((e) => e.getBoundingClientRect());
    if (kids.length) { const l = Math.min(...kids.map((r) => r.left)), r = Math.max(...kids.map((k) => k.right)); if (Math.abs(l - (innerWidth - r)) > 24 + 300) out.push({ kind: 'page-décentrée', where: 'panel-body', text: `${Math.round(l)} / ${Math.round(innerWidth - r)}` }); }
  }
  // v10.11 (8.5) : téléphone — le premier bouton d'action de l'onglet est dans l'écran sans défiler.
  if (innerWidth <= 600 && document.querySelector('#panel:not(.hidden)')) {
    const first = [...root.querySelectorAll('#panel-body button:not(.subtab):not([disabled]), #panel-body [data-action]:not(.subtab)')].find(visible);
    if (first && first.getBoundingClientRect().top > innerHeight - 70) out.push({ kind: 'premier-bouton-hors-écran', where: name(first), text: String(Math.round(first.getBoundingClientRect().top)) });
  }
  return out;
};

const report = [];
const shots = [];
for (const size of SIZES) {
  const [width, height] = size.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.push({ size, where: 'page', kind: 'erreur-js', text: e.message }));
  await page.addInitScript((r) => { if (!sessionStorage.getItem('m')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('m', '1'); } }, JSON.stringify(fx));
  await page.goto(url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(5000);
  const closeAll = () => page.evaluate(() => { document.querySelectorAll('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) [data-action="offline-claim"]').forEach((b) => b.click()); __idle.ui.closeModal?.(); __idle.ui.closeTab?.(); });
  await closeAll();
  // Écran de jeu : coffre visible, aucune zone qui en chevauche une autre.
  await page.waitForTimeout(800);
  const play = await page.evaluate(() => {
    const out = [];
    const c = document.getElementById('loot-bag');
    if (!c || c.classList.contains('hidden') || c.getBoundingClientRect().width < 10) out.push({ kind: 'coffre-absent', where: 'écran de jeu', text: '' });
    const ids = ['zone-card', 'hq-events', 'boost-group', 'auto-toggle', 'hq-left', 'skill-bar', 'next-action', 'loot-bag', 'scene-bottom'];
    const R = ids.map((id) => { const e = document.getElementById(id); if (!e || e.offsetParent === null || e.classList.contains('hidden')) return null; const r = e.getBoundingClientRect(); return r.width > 2 ? { id, r } : null; }).filter(Boolean);
    for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
      const a = R[i].r, b = R[j].r;
      if (a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2) out.push({ kind: 'blocs-chevauchés', where: 'écran de jeu', text: `${R[i].id} / ${R[j].id}` });
    }
    // v10.11 (8.3, 8.4) : combat au centre en grand écran, et pas de grand vide entre la barre de vague et le menu.
    const r = __idle.ui.renderer;
    if (innerWidth >= 1300 && r) {
      const cv = r.canvas.getBoundingClientRect();
      const meet = ((r.heroScreenX ?? 0) + 34 * r.scale) / (r.width * r.scale); // en px de la scène (l'interface peut être zoomée)
      if (meet < 0.40 || meet > 0.55) out.push({ kind: 'combat-décentré', where: 'scène', text: `${Math.round(meet * 100)} %` });
    }
    const hud = document.getElementById('hud'), tabs = document.getElementById('tabs');
    if (hud && tabs && hud.offsetParent) {
      const top = hud.getBoundingClientRect().bottom, bottom = tabs.getBoundingClientRect().top;
      const items = [...document.querySelectorAll('#stage-area button, #stage-area #scene-bottom, #stage-area #env-chip')].filter((e) => e.offsetParent && !e.classList.contains('hidden')).map((e) => e.getBoundingClientRect()).filter((b) => b.top >= top && b.bottom <= bottom).sort((a, b) => a.top - b.top);
      let y = top, gap = 0; for (const b of items) { gap = Math.max(gap, b.top - y); y = Math.max(y, b.bottom); } gap = Math.max(gap, bottom - y);
      if (gap > 160 && innerWidth > 600) out.push({ kind: 'grand-vide', where: 'sous la barre de vague', text: `${Math.round(gap)} px` });
    }
    return out;
  });
  report.push(...play.map((p) => ({ size, ...p })));
  const f0 = `${OUT}/${size}-jeu.jpg`; await page.screenshot({ path: f0, type: 'jpeg', quality: 78 }); shots.push(f0);
  for (const tab of TABS) {
    await closeAll();
    const ok = await page.evaluate((t) => { try { __idle.ui.openTab(t); return true; } catch { return false; } }, tab);
    if (!ok) continue;
    await page.waitForTimeout(700);
    const found = await page.evaluate(CHECKS);
    report.push(...found.map((p) => ({ size, tab, ...p })));
    const f = `${OUT}/${size}-${tab}.jpg`; await page.screenshot({ path: f, type: 'jpeg', quality: 78 }); shots.push(f);
  }
  // Bastion : les 5 âges.
  for (let age = 1; age <= 5; age++) {
    await closeAll();
    await page.evaluate(async (a) => {
      const s = __idle.state; const stg = [40, 120, 180, 240, 300][a - 1];
      s.maxStage = stg; s.records.bestStage = stg; if (s.bastion) s.bastion.age = a;
      const { openBastion } = await import('./src/ui/panels/camp.js'); openBastion(__idle.ui);
    }, age);
    await page.waitForTimeout(900);
    await page.evaluate(() => document.querySelectorAll('.bs-kick button, .bs-age-new').forEach((b) => (b.tagName === 'BUTTON' ? b.click() : b.remove())));
    const found = await page.evaluate(CHECKS);
    report.push(...found.map((p) => ({ size, tab: `bastion-âge-${age}`, ...p })));
    const f = `${OUT}/${size}-bastion-age${age}.jpg`;
    const map = await page.$('.bs-village');
    await (map ?? page).screenshot({ path: f, type: 'jpeg', quality: 78 }); shots.push(f);
  }
  await ctx.close();
}
await browser.close(); server.close();

// Planche : une page HTML qui montre toutes les captures d'un coup.
const html = `<!doctype html><meta charset="utf-8"><title>Cadrage v10.9</title><style>body{background:#111;color:#eee;font:14px system-ui;margin:16px}
  .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:12px}figure{margin:0}img{width:100%;border:1px solid #444}figcaption{font-size:12px;opacity:.8}</style>
  <h1>Cadrage v10.9 : ${report.length} signalement${report.length > 1 ? 's' : ''}</h1>
  <div class="g">${shots.map((s) => `<figure><img src="${s.split('/').pop()}" loading="lazy"><figcaption>${s.split('/').pop()}</figcaption></figure>`).join('')}</div>`;
await writeFile(`${OUT}/planche.html`, html);
await writeFile(`${OUT}/rapport.json`, JSON.stringify(report, null, 1));
const by = {};
for (const r of report) by[r.kind] = (by[r.kind] ?? 0) + 1;
console.log(`${shots.length} captures · ${report.length} signalements`, by);
for (const r of report.slice(0, 60)) console.log(`  ${r.size} ${r.tab ?? ''} ${r.kind} : ${r.where} ${r.text ?? ''}`);
process.exitCode = report.some((r) => ['coffre-absent', 'étiquettes-chevauchées', 'bâtiment-hors-carte', 'erreur-js', 'blocs-chevauchés', 'groupe-vide', 'image-sur-bloc', 'combat-décentré'].includes(r.kind)) ? 1 : 0;
