// v10.4 (plan 10.4, partie 5) : coffre de butin vivant en continu et vraie arrivée de l'objet. Dans les 5 formats :
// deux captures à 0,5 s d'écart montrent le coffre à deux hauteurs ; étincelles et rayon (Épique) ; un objet lâché décrit
// un arc EN TOURNANT, le couvercle s'ouvre, des pièces jaillissent, la pastille grossit puis revient ; bulle selon la
// rareté ; Légendaire : flash doré sur la scène et son de cloche (appel audio espionné) ; « Réduire les animations » :
// ni flottaison ni étincelles ni flash, mais l'arrivée de l'objet ; coût du dessin au repos sur 600 images ; 60 i/s ;
// aucune erreur JS. Captures hors du dépôt. Usage : node tools/e2e-1040-chest.mjs [dossier]
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const raw = await readFile('tests/fixtures/endgame.json', 'utf8');
const OUT = process.argv[2] ?? join(tmpdir(), 'ascendrya-captures-1040-chest');
await mkdir(OUT, { recursive: true });
const results = [];
const ok = (name, pass, info = '') => { results.push(pass); console.log(`${pass ? '✔' : '✘'} ${name} ${info}`); };
const wait = (page, ms) => page.waitForTimeout(ms);

async function open(w, h, { touch = false, dpr = 1, hooks = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, ...(touch ? { hasTouch: true, isMobile: true } : {}) });
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', (e) => page.errors.push(e.message));
  await page.addInitScript((r) => { if (!sessionStorage.getItem('c')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('c', '1'); } }, raw);
  if (hooks) await page.addInitScript(() => {
    // Relevé des dessins du coffre (hauteur à l'écran) et des étincelles (carrés blancs d'un pixel d'art de la scène).
    window.__draws = []; window.__sparks = 0; window.__hooksOn = true;
    const di = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
      if (img?.dataset?.lootChest && this.canvas.id === 'scene') { const m = this.getTransform(); window.__draws.push({ kind: img.dataset.lootChest, y: a[1] * m.d + m.f, at: performance.now() }); if (window.__draws.length > 400) window.__draws.shift(); }
      return di.call(this, img, ...a);
    };
    const fr = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
      const L = window.__idle?.renderer?.lootChest?.L;
      if (L && this.canvas.id === 'scene' && this.fillStyle === '#ffffff' && w === L.m && h === L.m && this.globalAlpha < 1) window.__sparks++;
      return fr.call(this, x, y, w, h);
    };
    window.__bell = 0;
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await wait(page, 2500);
  await page.evaluate(() => {
    __idle.ui.closeModal(); document.querySelectorAll('.howto-card, .learn-card, .tour').forEach((e) => e.remove());
    if (window.__hooksOn) { // les vrais butins du combat ne perturbent pas les mesures : seuls nos objets lâchés passent
      const rh = __idle.renderer.handleEvent.bind(__idle.renderer), uh = __idle.ui.handleEvent.bind(__idle.ui);
      __idle.renderer.handleEvent = (ev, ...a) => (ev?.type === 'drop' && !ev.fromTest ? undefined : rh(ev, ...a));
      __idle.ui.handleEvent = (ev, ...a) => (ev?.type === 'drop' && !ev.fromTest ? undefined : uh(ev, ...a));
    }
    const play = __idle.ui.sound.play.bind(__idle.ui.sound);
    __idle.ui.sound.play = (name, o) => { if (name === 'chestBell') window.__bell++; return play(name, o); }; // espion audio
  });
  return { ctx, page };
}

const fill = (page, n = 4, rarity = 'rare') => page.evaluate(async ([n, rarity]) => {
  const s = __idle.state; const pool = [...s.inventory, ...(s.stash ?? []), ...Object.values(s.equipment).filter(Boolean)];
  s.ui.hints = [...(s.ui.hints ?? []), 'loot-chest'];
  s.lootBag = Array.from({ length: n }, (_, k) => ({ ...structuredClone(pool[k % pool.length]), id: `c${k}-${Date.now()}`, rarity, locked: false }));
  __idle.ui.lootBag.lastKey = ''; __idle.ui.lootBag.update(s);
  await new Promise((res) => setTimeout(res, 1600));
}, [n, rarity]);

// Lâche un objet (événement « drop » réel) ; renvoie ce que le coffre a fait pendant 1,3 s (relevé toutes les 40 ms).
const drop = (page, rarity, weapon = false) => page.evaluate(async ([rarity, weapon]) => {
  const s = __idle.state, world = __idle.world, chest = __idle.renderer.lootChest;
  const base = (weapon ? s.lootBag.find((i) => i.slot === 'weapon') : null) ?? s.lootBag[0];
  const item = { ...structuredClone(base), id: `d-${rarity}-${Date.now()}`, rarity };
  s.lootBag.push(item);
  const foe = world.enemies.find((e) => !e.dead) ?? null;
  const bell0 = window.__bell, arrivals0 = chest.arrivals;
  const ev = { type: 'drop', item, x: foe ? foe.x : 300, enemyId: foe?.id ?? -1, bagged: true, time: world.time, fromTest: true };
  __idle.renderer.handleEvent(ev, world); __idle.ui.handleEvent(ev, s);
  const rec = { angles: [], ys: [], lids: [], pops: [], flashes: 0, flew: 0, bubbleAt: null, texts: [] };
  const t0 = performance.now(), c0 = chest.t; // durée comptée en temps de la scène (la machine de test peut être lente)
  const canvas = document.getElementById('scene'), c2 = canvas.getContext('2d');
  const mean = () => { const d = c2.getImageData(0, 0, canvas.width, canvas.height).data; let r = 0, g = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 97) { r += d[i]; g += d[i + 1]; n++; } return (r + g) / n; };
  const dark = mean(); let bright = 0;
  while (chest.t - c0 < 2 && performance.now() - t0 < 15000) {
    await new Promise((res) => setTimeout(res, 20));
    const f = chest.flies.find((q) => q.id === item.id);
    if (f) { rec.flew++; rec.angles.push(f.angle); rec.ys.push(f.y); }
    rec.lids.push(chest.lidIndex); rec.pops.push(chest.pillScale);
    if (chest.t - chest.flashStart < 0.5 && chest.t >= chest.flashStart) { rec.flashes++; bright = Math.max(bright, mean() - dark); }
    if (chest.bubble) rec.texts.push(chest.bubble.text);
  }
  return {
    flew: rec.flew, spin: Math.max(...rec.angles, 0) - Math.min(...rec.angles, 0), arcDy: Math.max(...rec.ys, 0) - Math.min(...rec.ys, 1e9),
    lidMax: Math.max(...rec.lids), popMax: Math.max(...rec.pops), popEnd: rec.pops.at(-1), arrived: chest.arrivals - arrivals0,
    coins: chest.coins.length, texts: [...new Set(rec.texts)], flash: chest.flashStart > 0 && chest.flashStart >= chest.openStart - 1e-9 && chest.arrivals > arrivals0 ? bright : 0,
    flashFrames: rec.flashes, bell: window.__bell - bell0, hop: chest.hopRise, itemFly: item.baseId, itemSlot: item.slot,
  };
}, [rarity, weapon]);

const FORMATS = [[1116, 993], [1280, 720], [1716, 1000], [900, 600], [390, 844, true]];
for (const [w, h, phone] of FORMATS) {
  const label = `${w}×${h}`;
  const { ctx, page } = await open(w, h, { touch: Boolean(phone), dpr: phone ? 3 : 1 });
  await fill(page, 4, 'rare');

  // 1. Repos : deux captures à 0,5 s d'écart, le coffre à deux hauteurs ; étincelles ; le bouton reste posé sur le coffre.
  let heights = null;
  for (let tries = 0; tries < 4 && !heights; tries++) {
    await page.screenshot({ path: `${OUT}/${w}x${h}-1a-repos.png` });
    const a = await page.evaluate(() => ({ f: __idle.renderer.lootChest.floatY, y: window.__draws.at(-1).y }));
    await wait(page, 500);
    await page.screenshot({ path: `${OUT}/${w}x${h}-1b-repos-0,5s.png` });
    const b = await page.evaluate(() => ({ f: __idle.renderer.lootChest.floatY, y: window.__draws.at(-1).y }));
    if (a.y !== b.y) heights = { a, b };
    else await wait(page, 130);
  }
  ok(`${label} : deux captures à 0,5 s d'écart : le coffre est à deux hauteurs différentes`, Boolean(heights), JSON.stringify(heights));
  const rest = await page.evaluate(async () => {
    const chest = __idle.renderer.lootChest; const f = []; const t0 = performance.now(), c0 = chest.t; window.__sparks = 0;
    while (chest.t - c0 < 1.3 && performance.now() - t0 < 15000) { f.push(chest.floatY); await new Promise((res) => setTimeout(res, 25)); }
    const btn = document.getElementById('loot-bag').getBoundingClientRect(), cv = document.getElementById('scene').getBoundingClientRect();
    const dpr = cv.width ? document.getElementById('scene').width / cv.width : 1; const d = chest.dev;
    const cx = cv.left + (d.x + d.w / 2) / dpr, cy = cv.top + (d.y + d.h / 2) / dpr;
    return { min: Math.min(...f), max: Math.max(...f), sparks: window.__sparks, onChest: btn.left <= cx && btn.right >= cx && btn.top <= cy + 6 && btn.bottom >= cy - 6, glow: chest.glowColor };
  });
  ok(`${label} : flottaison de ±4 px sur 1 s`, rest.min <= -3 && rest.max >= 3 && rest.min >= -4 && rest.max <= 4, `${rest.min}..${rest.max}`);
  ok(`${label} : étincelles qui montent`, rest.sparks >= 3, `${rest.sparks} points en 1,3 s`);
  ok(`${label} : le bouton invisible reste posé sur le coffre`, rest.onChest);

  // 2. Un Rare : arc en tournant, couvercle, pièces, pastille, bulle « Butin rare ! » ; captures du vol.
  // (images successives du vol : une première chute pour les captures, puis une seconde mesurée sans capture en même temps)
  const flightP = drop(page, 'rare');
  for (const ms of [120, 200, 200, 200]) { await wait(page, ms); await page.screenshot({ path: `${OUT}/${w}x${h}-2-vol-${ms}.png` }); }
  await flightP;
  await wait(page, 1500);
  const r = await drop(page, 'rare');
  ok(`${label} : objet Rare : arc EN TOURNANT jusqu'au coffre (0,8 s), couvercle ouvert (images 0 → 5), pièces`, r.flew >= 5 && r.spin >= Math.PI * 2 && r.arcDy > 20 && r.lidMax === 5 && r.arrived >= 1, JSON.stringify({ flew: r.flew, spin: r.spin.toFixed(2), arcDy: Math.round(r.arcDy), lid: r.lidMax, arrived: r.arrived }));
  ok(`${label} : la pastille grossit puis revient ; bulle « Butin rare ! »`, r.popMax > 1.3 && r.popEnd === 1 && r.texts.includes('Butin rare !'), JSON.stringify({ pop: r.popMax.toFixed(2), end: r.popEnd, text: r.texts.join('|') }));
  await wait(page, 2200);

  // 3. Une arme : l'icône qui vole est celle de l'objet réellement tombé.
  const wp = await drop(page, 'epic', true);
  ok(`${label} : une arme tombe : elle vole (${wp.itemSlot}) puis arrive, bulle « Butin épique ! »`, wp.flew >= 5 && wp.arrived >= 1 && wp.texts.includes('Butin épique !'), JSON.stringify({ slot: wp.itemSlot, base: wp.itemFly, text: wp.texts.join('|') }));
  const icon = await page.evaluate(async () => {
    const s = __idle.state; const it = s.lootBag.find((i) => i.slot === 'weapon') ?? s.lootBag[0];
    const { itemDropCanvas } = await import('./src/render/pixel.js');
    const c = itemDropCanvas(it); return { w: c.width, h: c.height, slot: it.slot };
  });
  ok(`${label} : l'icône dessinée est celle de l'objet (${icon.slot}, ${icon.w}×${icon.h})`, icon.w > 1 && icon.h > 1);
  await wait(page, 2200);

  // 4. Légendaire : flash doré, saut, cloche, bulle.
  const lg = await drop(page, 'legendary');
  await page.screenshot({ path: `${OUT}/${w}x${h}-3-legendaire.png` });
  ok(`${label} : Légendaire : flash doré sur la scène, grand saut, cloche, bulle « Butin légendaire ! »`, lg.flash > 15 && lg.hop === 7 && lg.bell >= 1 && lg.texts.includes('Butin légendaire !'), JSON.stringify({ flash: Math.round(lg.flash * 10) / 10, hop: lg.hop, bell: lg.bell, text: lg.texts.join('|') }));
  const ep = await drop(page, 'epic');
  ok(`${label} : Épique : pas de flash ni de cloche`, ep.bell === 0 && ep.flash < 10, JSON.stringify({ bell: ep.bell, flash: ep.flash }));
  await wait(page, 600);
  await page.screenshot({ path: `${OUT}/${w}x${h}-4-epique-rayon.png` });

  // 5. « Réduire les animations » : ni flottaison ni étincelles ni flash ; l'arrivée de l'objet reste (arc, couvercle, pièces, pastille, bulle, cloche).
  await page.evaluate(async () => { const { setPref } = await import('./src/ui/prefs.js'); setPref('motion', 'reduce'); });
  await wait(page, 2400);
  const calm = await page.evaluate(async () => {
    const chest = __idle.renderer.lootChest; const f = []; const t0 = performance.now(), c0 = chest.t; window.__sparks = 0;
    while (chest.t - c0 < 1.3 && performance.now() - t0 < 15000) { f.push(chest.floatY); await new Promise((res) => setTimeout(res, 25)); }
    return { min: Math.min(...f), max: Math.max(...f), sparks: window.__sparks, focus: __idle.renderer.focus };
  });
  ok(`${label} : réduire les animations : pas de flottaison ni d'étincelles`, calm.focus && calm.min === 0 && calm.max === 0 && calm.sparks === 0, JSON.stringify(calm));
  const cr = await drop(page, 'legendary');
  ok(`${label} : réduire les animations : l'objet arrive quand même (arc, couvercle, pastille, bulle, cloche), sans flash`, cr.flew >= 5 && cr.arcDy > 20 && cr.lidMax === 5 && cr.popMax > 1.3 && cr.texts.includes('Butin légendaire !') && cr.bell >= 1 && cr.flash < 10 && cr.spin === 0, JSON.stringify({ flew: cr.flew, arcDy: Math.round(cr.arcDy), lid: cr.lidMax, pop: cr.popMax.toFixed(2), text: cr.texts.join('|'), bell: cr.bell, flash: cr.flash, spin: cr.spin }));
  await page.screenshot({ path: `${OUT}/${w}x${h}-5-reduit.png` });
  await page.evaluate(async () => { const { setPref } = await import('./src/ui/prefs.js'); setPref('motion', 'auto'); });

  ok(`${label} : aucune erreur JavaScript`, page.errors.length === 0, page.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// Coût du dessin au repos (600 images) et i/s en 1280 × 720.
{
  const { ctx, page } = await open(1280, 720, { hooks: false });
  const measure = () => page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(n / 3); }; requestAnimationFrame(f); }));
  const base = await measure(); // même page sans coffre : référence de la machine (Chromium sans carte graphique)
  await fill(page, 6, 'epic');
  const fps = await measure();
  ok(`1280×720 : ${Math.round(fps)} i/s avec le coffre vivant (Épique : flottaison, lueur, étincelles, rayon) ; ${Math.round(base)} i/s sans coffre`, fps >= 55 || fps >= base * 0.8, `(60 i/s sur une machine avec carte graphique ; ici le coffre coûte ${Math.max(0, Math.round((1 - fps / base) * 100))} %)`);
  const cost = await page.evaluate(async () => {
    const { drawLootChest, drawLootChestTop } = await import('./src/render/loot-chest.js');
    const r = __idle.renderer; const ctx = r.ctx; const N = 600;
    r.dt = 1 / 60; ctx.save(); let best = 1e9;
    for (let k = 0; k < 3; k++) { // meilleur de 3 séries de 600 images (la machine de test peut être chargée)
      const t0 = performance.now();
      for (let i = 0; i < N; i++) { drawLootChest(r, ctx, __idle.world); drawLootChestTop(r, ctx); }
      best = Math.min(best, (performance.now() - t0) / N);
    }
    ctx.restore(); return best;
  });
  ok('1280×720 : coût du dessin du coffre au repos < 0,3 ms par image (600 images)', cost < 0.3, `${cost.toFixed(3)} ms`);
  ok('1280×720 : aucune erreur JavaScript', page.errors.length === 0, page.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
server.close();
const n = results.filter(Boolean).length;
console.log(`${n}/${results.length} vérifications réussies`);
process.exit(n === results.length ? 0 : 1);
