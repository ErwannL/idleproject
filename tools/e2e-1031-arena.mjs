// v10.3.1 : fin de la partie 6 du plan docs/plan-v1030.md (« Arène : le combat se joue sur une carte »), vérifiée dans
// un vrai navigateur en 1280 × 720, 1116 × 993 et 390 × 844 : deux rangs distincts (ordonnées et tailles), personne hors
// de l'écran, compagnon vaincu encore dessiné, mécanique du boss, ultime, i/s, fin de combat (2 lignes de récompenses,
// « Étage suivant »), Boss commun joué dans ArenaScene. Captures : dossier temporaire du système (hors du dépôt), ou E2E_OUT.
//   node tools/e2e-1031-arena.mjs
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = process.env.E2E_OUT ?? join(tmpdir(), 'e2e-1031');
console.log(`captures : ${OUT}`);
await mkdir(OUT, { recursive: true });
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const raw = await readFile('tests/fixtures/endgame.json', 'utf8');
const results = [];
const ok = (name, pass, info = '') => { results.push(Boolean(pass)); console.log(`${pass ? '✔' : '✘'} ${name} ${info}`); };
const errors = [];
async function open(w, h, dpr = 1) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${w}×${h} : ${e.message}`));
  await page.addInitScript((r) => { if (!sessionStorage.getItem('c')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('c', '1'); } }, raw);
  await page.goto(url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => __idle.ui.closeModal());
  // La sauvegarde de fin de jeu n'a pas encore d'Arène à cartes : l'onglet la crée (formation auto, calibrage).
  await page.evaluate(() => __idle.ui.openTab('arena'));
  await page.waitForTimeout(800);
  return { ctx, page };
}
// Un étage, premier passage (récompense) : best = f - 1.
async function fight(page, f, first = true) {
  await page.evaluate(({ f, first }) => { const c = __idle.state.arena.cards; c.best = first ? f - 1 : Math.max(c.best, f); __idle.ui.closePanel(); __idle.ui.arenaFight(f); }, { f, first });
  await page.waitForSelector('.arena-map .am-canvas', { timeout: 8000 });
}
const fps = (page) => page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(n / 3); }; requestAnimationFrame(f); }));
// Positions à l'écran (pixels CSS de la scène) des compagnons et des monstres, et largeur de la scène.
const layout = (page) => page.evaluate(() => {
  const el = document.querySelector('.arena-map'); const s = el.scene; const st = el.querySelector('.am-stage').getBoundingClientRect();
  return { w: st.width, h: st.height, allies: s.allyMarks(), foes: s.marks().filter((m) => !m.minion), mech: s.mech.length, played: s.mechPlayed.length };
});

// i/s demandés : 60 en 1280 × 720 (marge de mesure : 55), 30 sur téléphone ; 1116 × 993 (plus de pixels) : 40.
const FORMATS = [[1280, 720, 1, 'PC 1280 × 720', 55], [1116, 993, 1, 'PC 1116 × 993', 40], [390, 844, 3, 'téléphone 390 × 844', 30]];
for (const [w, h, dpr, label, minFps] of FORMATS) {
  const tag = `${w}x${h}`;
  const { ctx, page } = await open(w, h, dpr);
  // ---- Étage 10 (boss + une carte derrière ; formation 3 devant, 2 derrière) ----
  await fight(page, 10);
  // Temps de la scène (et non de l'horloge) : la machine de test peut être lente en 390 × 844 × 3.
  await page.waitForFunction(() => document.querySelector('.arena-map')?.scene?.t >= 1.6, null, { timeout: 60000 });
  const L = await layout(page);
  const front = L.allies.filter((a) => !a.back), back = L.allies.filter((a) => a.back);
  ok(`${label} : deux rangs de compagnons (pieds plus haut et ×0,9 derrière)`, front.length && back.length && back.every((b) => b.foot < front[0].foot - 4 && b.k < front[0].k),
    JSON.stringify({ front: front.map((a) => [a.id, Math.round(a.x), Math.round(a.foot)]), back: back.map((a) => [a.id, Math.round(a.x), Math.round(a.foot), a.k]) }));
  const fb = L.foes.filter((m) => m.back), ff = L.foes.filter((m) => !m.back);
  ok(`${label} : deux rangs de monstres (l'arrière plus haut, plus loin)`, fb.length && ff.length && fb.every((b) => b.feet < ff[0].feet - 4 && b.x > ff[0].x), JSON.stringify(L.foes.map((m) => [m.name, m.back, Math.round(m.x), Math.round(m.feet)])));
  const inside = (x, half) => x - half >= -1 && x + half <= L.w + 1;
  ok(`${label} : aucun compagnon ni monstre hors de l'écran`, L.allies.every((a) => a.placed && inside(a.x, 8)) && L.foes.every((m) => m.seen && inside(m.x, 8)),
    JSON.stringify({ w: Math.round(L.w), a: L.allies.map((a) => Math.round(a.x)), f: L.foes.map((m) => Math.round(m.x)) }));
  ok(`${label} : mécanique du boss jouée (nom dans la barre, événements)`, L.mech >= 1 && L.played >= 1 && await page.evaluate(() => !document.querySelector('.am-mech').classList.contains('hidden') && document.querySelector('.am-mech b').textContent.length > 2), `${L.played}/${L.mech}`);
  // i/s : mesurés à 1 pixel d'écran par pixel CSS (comme tools/e2e-102.mjs) ; le navigateur de test dessine sans carte
  // graphique, un écran ×3 n'y dit rien de la vitesse sur un vrai téléphone.
  {
    const c1 = dpr === 1 ? null : await open(w, h, 1);
    const p1 = c1 ? c1.page : page;
    if (c1) { await fight(p1, 10); await p1.waitForTimeout(1500); }
    const f = await fps(p1);
    ok(`${label} : ${Math.round(f)} i/s dans l'Arène`, f >= minFps);
    if (c1) await c1.ctx.close();
  }
  await page.screenshot({ path: `${OUT}/combat-${tag}.png` });
  // Ultime : zoom et flash avant l'effet.
  const ult = await page.evaluate(() => new Promise((res) => { const el = document.querySelector('.arena-map'); const t0 = performance.now(); let zoom = 0, flash = 0;
    const f = () => { const z = Number((el.querySelector('.am-canvas').style.transform.match(/scale\(([\d.]+)\)/) ?? [0, 1])[1]); zoom = Math.max(zoom, z); flash = Math.max(flash, Number(el.querySelector('.am-flash').style.opacity || 0));
      if (zoom > 1.05 && flash > 0.3) res({ zoom, flash }); else if (performance.now() - t0 > 30000) res({ zoom, flash, timeout: true }); else requestAnimationFrame(f); }; f(); }));
  ok(`${label} : ultime — zoom léger puis flash`, ult.zoom > 1.05 && ult.zoom <= 1.081 && ult.flash > 0.3, JSON.stringify(ult));
  // Fin : Passer → le compagnon vaincu reste dessiné, couché ; les vainqueurs debout ; récompenses sur 2 lignes.
  await page.evaluate(() => document.querySelector('.am-skip').click());
  await page.waitForTimeout(2800);
  const end = await page.evaluate(() => {
    const el = document.querySelector('.arena-map'); const s = el.scene; const n0 = s.fallenDrawn ?? 0;
    return new Promise((res) => setTimeout(() => {
      const rows = [...el.querySelectorAll('.am-end-rows .am-rw-row')];
      const ids = [...s.downIds];
      res({ down: ids, drawn: (s.fallenDrawn ?? 0) - n0, kept: ids.every((id) => s.state.companions.equipped.includes(id) && s.r.layout?.slots.get(id)),
        rows: rows.map((r) => r.querySelector('small').textContent), tops: rows.map((r) => Math.round(r.getBoundingClientRect().top)), primary: el.querySelector('.am-end .primary-action')?.textContent ?? '', onTop: (() => { const b = el.querySelector('.am-end .primary-action')?.getBoundingClientRect(); return Boolean(b) && document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)?.closest('.primary-action') != null; })(),
        stars: el.querySelectorAll('.am-end-stars span').length, won: s.run.won });
    }, 400));
  });
  ok(`${label} : compagnon vaincu encore dessiné (couché, grisé)`, end.down.length >= 1 && end.drawn > 0 && end.kept, JSON.stringify(end));
  ok(`${label} : récompenses sur 2 lignes (Progression / Matériaux), « Étage suivant » en bouton principal`, end.won && end.rows.join('|') === 'Progression|Matériaux' && end.tops[1] > end.tops[0] && /Étage suivant/.test(end.primary) && end.onTop && end.stars === 3, JSON.stringify(end));
  await page.screenshot({ path: `${OUT}/fin-${tag}.png` });
  await page.evaluate(() => document.querySelector('.arena-map').close());
  // ---- Étage 45 (5 monstres : 3 devant, 2 derrière) et gardien 25 ----
  for (const fl of [45, 25]) {
    await fight(page, fl, false);
    await page.waitForFunction(() => document.querySelector('.arena-map')?.scene?.t >= 1.4, null, { timeout: 60000 });
    const M = await layout(page);
    const b = M.foes.filter((m) => m.back), fr = M.foes.filter((m) => !m.back);
    ok(`${label} : étage ${fl}, monstres sur deux rangs, tous à l'écran`, b.length && fr.length && M.foes.every((m) => m.seen && inside(m.x, 8)) && M.allies.every((a) => inside(a.x, 8)),
      JSON.stringify(M.foes.map((m) => [m.name, m.back, Math.round(m.x)])));
    await page.screenshot({ path: `${OUT}/etage${fl}-${tag}.png` });
    await page.evaluate(() => document.querySelector('.arena-map').close());
  }
  await ctx.close();
}

ok('aucune erreur de page', !errors.length, errors.slice(0, 3).join(' | '));
const n = results.filter(Boolean).length;
console.log(`${n}/${results.length} vérifications réussies`);
await browser.close(); server.close();
process.exit(n === results.length ? 0 : 1);
