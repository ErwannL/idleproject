// v10.6 (partie 10) : tests de fin. Pour chaque taille (1116 × 993, 2536 × 1011, 390 × 844) : capture de l'écran de jeu
// et de chaque onglet dans docs/screenshots/v10.6/<taille>/, part d'image de chaque onglet (1116 × 993), coffre jamais
// sur un monstre ni un héros, écran de jeu (1 quête, 3 tâches, 5 événements ; téléphone : 1 quête, 4 icônes), filtre de
// l'équipement et fenêtre d'objet, aucune erreur JS ni CSP.
// Usage : node tools/e2e-1060.mjs [--no-shots]   → code 1 si un contrôle échoue.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const SHOTS = !process.argv.includes('--no-shots');
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const raw = await readFile('tests/fixtures/endgame.json', 'utf8');
const TABS = ['inventory', 'upgrades', 'skills', 'tree', 'forge', 'companions', 'expeditions', 'camp', 'summon', 'shop', 'campaign', 'dungeons', 'arena', 'tower', 'event', 'contracts', 'daybook', 'boss', 'encyclopedia', 'stats', 'looks'];
const SIZES = [[1116, 993], [2536, 1011], [390, 844]];
const results = [];
const ok = (name, pass, info = '') => { results.push(pass); console.log(`${pass ? '✔' : '✘'} ${name} ${info}`); };
const report = { share: {} };

async function open(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(w < 500 ? { hasTouch: true, isMobile: true } : {}) });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_NAME|Failed to load resource|net::/.test(m.text())) page.errors.push(m.text()); });
  await page.addInitScript((r) => { if (!sessionStorage.getItem('c')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('c', '1'); } }, raw);
  await page.goto(url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    __idle.ui.closeModal(); document.querySelectorAll('.howto-card, .learn-card, .tour').forEach((e) => e.remove());
    const s = __idle.state; s.playSeconds = Math.max(s.playSeconds ?? 0, 4000); // partie avancée : plus de « premières minutes »
    const eq = Object.values(s.equipment).filter(Boolean); const R = ['common', 'rare', 'epic', 'legendary'];
    if (!s.inventory.length && eq.length) s.inventory = Array.from({ length: 24 }, (_, k) => { const it = structuredClone(eq[k % eq.length]); it.id = `e2e${k}`; it.rarity = R[k % 4]; it.locked = false; for (const key of Object.keys(it.stats)) it.stats[key] *= 0.6 + (k % 7) * 0.15; return it; });
    s.lootBag = s.inventory.slice(0, 5).map((x, k) => ({ ...structuredClone(x), id: `lb${k}`, rarity: 'epic' }));
    __idle.ui.lootBag.lastKey = ''; __idle.ui.lootBag.update(s);
  });
  await page.waitForTimeout(5000);
  return { ctx, page };
}

const rectsOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

for (const [w, h] of SIZES) {
  const tag = `${w}x${h}`;
  const dir = `docs/screenshots/v10.6/${tag}`;
  if (SHOTS) await mkdir(dir, { recursive: true });
  const { ctx, page } = await open(w, h);
  // Coffre : relevé de sa place et des unités pendant 3 s.
  const chest = await page.evaluate(async () => {
    const r = __idle.renderer, c = r.lootChest; const out = { places: new Set(), hits: 0 };
    for (let i = 0; i < 30; i++) {
      await new Promise((res) => setTimeout(res, 100));
      if (!c?.dev) continue;
      out.places.add(`${c.dev.x}|${c.L.feet}`);
      const box = { x: c.dev.x, y: c.dev.y, w: c.dev.w, h: c.dev.h };
      for (const fx of r.enemyFx?.values() ?? []) { if (!fx.sw || r.time - (fx.seen ?? -9) > 0.3) continue; const k = r.k; const e = { x: fx.sx * k + (c.L.shiftDev ?? 0), y: (fx.sy ?? 0) * k, w: fx.sw * k, h: (fx.sh ?? 40) * k }; if (e.x < box.x + box.w && e.x + e.w > box.x && e.y < box.y + box.h && e.y + e.h > box.y) out.hits++; }
      const feet = (r.groundY + 1) * r.k; if (box.y < feet) out.hits++; // jamais sur le terrain (au-dessus du sol)
    }
    return { places: out.places.size, hits: out.hits, shown: Boolean(c?.dev) };
  });
  ok(`${tag} : coffre affiché, à une seule place, jamais sur le terrain`, chest.shown && chest.places <= 1 && chest.hits === 0, JSON.stringify(chest));
  // Écran de jeu.
  const hud = await page.evaluate(() => {
    const vis = (e) => e && !e.classList.contains('hidden') && e.offsetParent !== null && e.getBoundingClientRect().width > 0;
    const evs = [...document.querySelectorAll('#hq-events .hq-ev:not(.hq-more)')].filter(vis).length;
    return { quest: vis(document.getElementById('hq-path')), tasks: document.querySelectorAll('#hq-carnet .hq-task').length, chip: Boolean(document.querySelector('.hq-carnet-chip')), evs };
  });
  if (w < 500) ok(`${tag} : la quête et 4 icônes d'événement`, hud.quest && hud.evs >= 4, JSON.stringify(hud));
  else if (w / h > 2) ok(`${tag} : la quête, le Carnet et 5 événements`, hud.quest && hud.chip && hud.evs >= 5, JSON.stringify(hud));
  else ok(`${tag} : la quête, 3 tâches et 5 événements`, hud.quest && hud.tasks === 3 && hud.evs >= 5, JSON.stringify(hud));
  if (SHOTS) await page.screenshot({ path: `${dir}/00-ecran-de-jeu.png` });
  // Onglets.
  for (const t of TABS) {
    const share = await page.evaluate(async (tab) => {
      __idle.ui.openTab(tab); await new Promise((res) => setTimeout(res, 1600));
      const b0 = document.getElementById('panel-body'); if (b0) b0.scrollTop = 0; await new Promise((res) => setTimeout(res, 300));
      const body = document.getElementById('panel-body');
      if (!body) return -1;
      const pb = body.getBoundingClientRect();
      let hit = 0, n = 0;
      for (let y = pb.top + 4; y < Math.min(innerHeight, pb.bottom); y += 8) for (let x = pb.left + 4; x < pb.right; x += 8) {
        n++; const el = document.elementFromPoint(x, y);
        const pic = el?.closest?.('img, canvas, svg, .dg-card, .arena-tile, .art-banner-wrap, .lt-key, .lt-map, .upg-group-head, [style*="background-image"]');
        if (pic && body.contains(pic)) hit++;
      }
      return hit / Math.max(1, n);
    }, t);
    if (w === 1116) report.share[t] = Math.round(share * 100);
    if (SHOTS) await page.screenshot({ path: `${dir}/${t}.png` });
  }
  if (w === 1116) {
    // Équipement : filtre par case et fenêtre d'objet.
    const eq = await page.evaluate(async () => {
      const s = __idle.state; const eq0 = Object.values(s.equipment).filter(Boolean); // le recyclage automatique a pu vider le sac
      s.inventory = Array.from({ length: 12 }, (_, k) => { const it = structuredClone(eq0[k % eq0.length]); it.id = `eq${k}`; it.locked = true; return it; });
      __idle.ui.openTab('inventory'); await new Promise((r) => setTimeout(r, 800));
      document.querySelector('.eq-doll .eq-slot[data-value=weapon]')?.click(); await new Promise((r) => setTimeout(r, 600));
      const cards = [...document.querySelectorAll('.eq-bag-grid .eq-card:not(.worn)')];
      const only = cards.every((c) => __idle.state.inventory.find((i) => i.id === c.dataset.id)?.slot === 'weapon');
      cards[0]?.click(); await new Promise((r) => setTimeout(r, 1500));
      const p = document.querySelector('.eq-itempop')?.getBoundingClientRect();
      return { n: cards.length, only, pop: Boolean(p && p.width > 200) };
    });
    ok('Équipement : la case Arme filtre le sac, un toucher ouvre la fenêtre de l\'objet', eq.only && eq.pop, JSON.stringify(eq));
    if (SHOTS) await page.screenshot({ path: `${dir}/inventory-fenetre-objet.png` });
    for (const [t, v] of Object.entries(report.share)) ok(`part d'image ${t}`, v >= (t === 'event' ? 50 : 35), `${v} %`);
  }
  ok(`${tag} : aucune erreur JS ni CSP`, page.errors.length === 0, page.errors.slice(0, 3).join(' | '));
  await ctx.close();
}
await mkdir('docs/screenshots/v10.6', { recursive: true });
await writeFile('docs/screenshots/v10.6/mesures.json', JSON.stringify(report, null, 2));
await browser.close(); server.close();
const fails = results.filter((x) => !x).length;
console.log(fails ? `${fails} échec(s)` : 'tout est bon');
process.exit(fails ? 1 : 0);
