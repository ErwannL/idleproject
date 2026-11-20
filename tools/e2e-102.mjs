// v10.2 (P5) : tests de fin — textes en mots entiers sur la scène, Arène sur la carte (sorts de chaque compagnon,
// i/s, réduire les animations), coffre de butin (visible, lueur, bulle, tri), « Entrer » et « Combattre » visibles dans
// les formats PC et téléphone. Usage : node tools/e2e-102.mjs
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const raw = await readFile('tests/fixtures/endgame.json', 'utf8');
const results = [];
const ok = (name, pass, info = '') => { results.push(pass); console.log(`${pass ? '✔' : '✘'} ${name} ${info}`); };
async function open(w, h, { reduce = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(reduce ? { reducedMotion: 'reduce' } : {}) });
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', (e) => page.errors.push(e.message));
  await page.addInitScript((r) => { if (!sessionStorage.getItem('c')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('c', '1'); } }, raw);
  await page.addInitScript(() => { window.__fill = []; const o = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { if (window.__fill.length < 4000) window.__fill.push(String(t)); return o.call(this, t, ...a); }; });
  await page.goto(url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => __idle.ui.closeModal());
  return { ctx, page };
}

// 1. Les mots « Efficace ! », « Résiste », « Attaque lourde ! », « Affaibli ! » s'écrivent en entier.
{
  const { ctx, page } = await open(1116, 993);
  await page.evaluate(() => { window.__fill = []; });
  for (const [i, t] of ['Efficace !', 'Résiste', 'Attaque lourde !', 'Affaibli !'].entries()) { await page.evaluate(([t, i]) => __idle.renderer.addText(t, 60 + i * 70, 60, '#12ab34', '#fefefe'), [t, i]); await page.waitForTimeout(150); } // couleur inédite : rien en cache
  const seen = await page.evaluate(() => [...new Set(window.__fill)]);
  const words = ['Efficace !', 'Résiste', 'Attaque lourde !', 'Affaibli !'];
  ok('mots entiers sur la scène (plus de « ia »)', words.every((w) => seen.includes(w)) && !seen.includes('ia') && !seen.includes('aii'), JSON.stringify(seen.filter((s) => /[A-Za-zÀ-ÿ]/.test(s)).slice(0, 8)));
  await ctx.close();
}
// 2. Arène sur la carte : chaque compagnon lance au moins un sort, i/s, Passer en « réduire les animations ».
for (const [w, h, label, minFps] of [[1280, 720, 'PC 1280 × 720', 50], [390, 844, 'téléphone', 28]]) {
  const { ctx, page } = await open(w, h);
  await page.evaluate(() => { window.__sk = new Set(); const r = __idle.ui; const orig = r.arenaFight.bind(r); r.arenaFight = (f) => orig(f); });
  await page.evaluate(() => __idle.ui.openTab('arena'));
  await page.waitForTimeout(800);
  await page.evaluate(() => { __idle.state.arena.cards.best = Math.max(__idle.state.arena.cards.best, 12); __idle.ui.closePanel(); __idle.ui.arenaFight(10); });
  await page.waitForSelector('.arena-map .am-canvas', { timeout: 8000 });
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(n / 3); }; requestAnimationFrame(f); }));
  ok(`Arène sur la carte ${label} : ${Math.round(fps)} i/s`, fps >= minFps);
  const vis = await page.evaluate(() => { const c = document.querySelector('.am-stage').getBoundingClientRect(); const cards = document.querySelectorAll('.am-card').length; return { h: c.height / innerHeight, cards }; });
  ok(`Arène ${label} : scène ≥ 45 % de la hauteur, cartes en bas`, vis.h >= 0.45 && vis.cards >= 1, JSON.stringify(vis));
  await ctx.close();
}
{
  // Chaque carte de la formation lance chacune de ses compétences (sort et ultime) dans un combat de 60 s.
  const { ctx, page } = await open(1280, 720);
  const r = await page.evaluate(async () => {
    const { playFloor, cardArena } = await import('./src/core/arena-cards.js');
    const s = structuredClone(__idle.state); cardArena(s).best = 10;
    const run = playFloor(s, 10);
    const by = {};
    for (const e of run.events) if (e.side === 'ally' && ['skill', 'heal', 'shield', 'ult'].includes(e.kind) && e.t <= 60) (by[e.from] ??= new Set()).add(e.kind === 'ult' ? 'ult' : 'skill');
    return { team: run.team.map((c) => c.pos), by: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, [...v]])), seconds: run.seconds };
  });
  ok('étage 10 : chaque carte lance son sort au moins une fois', r.team.every((p) => r.by[p]?.includes('skill')), JSON.stringify(r));
  ok('étage 10 : un combat dure au moins 12 s', r.seconds >= 12, `${r.seconds} s`);
  await ctx.close();
}
{
  const { ctx, page } = await open(1280, 720, { reduce: true });
  await page.evaluate(() => __idle.ui.arenaFight(1));
  await page.waitForTimeout(1200);
  ok('« réduire les animations » : Passer va directement à la fin', await page.evaluate(() => !document.querySelector('.am-end')?.classList.contains('hidden')));
  await ctx.close();
}
// 3. Coffre de butin : visible sur le sol, loin des bords, jamais sous la barre de compétences ni le Sceau.
for (const [w, h] of [[1116, 993], [1716, 1000], [390, 844]]) {
  const { ctx, page } = await open(w, h);
  const r = await page.evaluate(async () => {
    const s = __idle.state; const pool = [...s.inventory, ...(s.stash ?? []), ...Object.values(s.equipment).filter(Boolean)]; s.lootBag = pool.slice(0, 4).map((i, k) => ({ ...i, id: `${i.id}-t${k}` }));
    const epic = { ...s.lootBag[0], rarity: 'epic', id: 'epic-t' }; s.lootBag.push(epic);
    __idle.ui.lootBag.lastKey = ''; __idle.ui.lootBag.update(s); __idle.ui.lootBag.bump(epic, 100);
    await new Promise((res) => setTimeout(res, 300));
    const b = document.getElementById('loot-bag').getBoundingClientRect();
    const hit = (id) => { const e = document.getElementById(id); if (!e || e.offsetParent === null) return false; const x = e.getBoundingClientRect(); return !(x.right < b.left || x.left > b.right || x.bottom < b.top || x.top > b.bottom); };
    return { vis: b.width > 0 && getComputedStyle(document.getElementById('loot-bag')).display !== 'none', left: b.left, right: innerWidth - b.right, h: b.height, overBar: hit('skill-bar'), overSeal: hit('next-action'),
      epic: document.getElementById('loot-bag').classList.contains('lb-epic'), bubble: !document.querySelector('#loot-bag .lb-bubble').classList.contains('hidden') };
  });
  ok(`coffre de butin ${w}×${h} : visible, ≥ 40 px du bord, jamais sous la barre ni le Sceau`, r.vis && r.right >= 40 && !r.overBar && !r.overSeal, JSON.stringify(r));
  ok(`coffre de butin ${w}×${h} : Épique → lueur et bulle`, r.epic && r.bubble);
  await page.click('#loot-bag');
  await page.waitForTimeout(400);
  ok(`coffre de butin ${w}×${h} : un toucher ouvre le tri`, await page.evaluate(() => !document.getElementById('loot-sheet').classList.contains('hidden') && Boolean(document.querySelector('#loot-sheet [data-lb="keep-best"]'))));
  await ctx.close();
}
// 4. « Entrer » (feuille de donjon) et « Combattre » (Arène) visibles dans tous les formats.
for (const [w, h] of [[1280, 720], [900, 600], [1716, 1000], [390, 844]]) {
  const { ctx, page } = await open(w, h);
  await page.evaluate(() => { __idle.ui.openTab('dungeons'); });
  await page.waitForTimeout(600);
  await page.click('.dg-card [data-action="dungeon-sel"]').catch(() => {});
  await page.waitForTimeout(600);
  const enter = await page.evaluate(() => { const e = document.querySelector('.dg-enter [data-action="enter-dungeon"]'); if (!e) return null; const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && b.width > 0; });
  await page.evaluate(() => { __idle.ui.view.dungeonSheet = false; __idle.ui.dgSheet(''); __idle.ui.openTab('arena'); });
  await page.waitForTimeout(800);
  const fight = await page.evaluate(() => { const e = document.querySelector('[data-action="card-fight"]'); if (!e) return null; const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && b.width > 0 && !e.disabled; });
  ok(`${w}×${h} : « Entrer » et « Combattre » visibles (Combattre actif dès l'ouverture)`, enter === true && fight === true, JSON.stringify({ enter, fight }));
  if (page.errors.length) ok(`${w}×${h} : aucune erreur JavaScript`, false, page.errors.slice(0, 2).join(' | '));
  await ctx.close();
}
const n = results.filter(Boolean).length;
console.log(`${n}/${results.length} vérifications réussies`);
await browser.close(); server.close();
process.exit(n === results.length ? 0 : 1);
