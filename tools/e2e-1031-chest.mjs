// v10.3.1 (plan 10.2, partie 7) : le coffre de butin est dessiné dans la scène (canvas), plus un bouton DOM visible.
// Dans les 5 formats : coffre dessiné dans le canvas, sur le sol, à ≥ 40 px des bords, ni sous la barre de compétences
// ni sous le Sceau ; un objet Épique ramassé vole jusqu'au coffre, change la lueur et montre la bulle ; toucher le coffre
// dessiné ouvre le tri ; « Garder le meilleur » donne le même résultat que lootBagKeepBestChoices ; aucune erreur JS.
// Captures hors du dépôt (dossier temporaire, ou le dossier donné). Usage : node tools/e2e-1031-chest.mjs [dossier]
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
const OUT = process.argv[2] ?? join(tmpdir(), 'ascendrya-captures-1031'); // hors du dépôt
await mkdir(OUT, { recursive: true });
const results = [];
const ok = (name, pass, info = '') => { results.push(pass); console.log(`${pass ? '✔' : '✘'} ${name} ${info}`); };
const wait = (page, ms) => page.waitForTimeout(ms);

async function open(w, h, { touch = false, dpr = 1 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, ...(touch ? { hasTouch: true, isMobile: true } : {}) });
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', (e) => page.errors.push(e.message));
  await page.addInitScript((r) => { if (!sessionStorage.getItem('c')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('c', '1'); } }, raw);
  // Relevé des dessins du coffre (image repérée par data-loot-chest) et des textes écrits dans le canvas de la scène.
  await page.addInitScript(() => {
    window.__chestDraws = []; window.__fill = [];
    const di = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
      if (img?.dataset?.lootChest && this.canvas.id === 'scene') { const m = this.getTransform(); window.__chestDraws.push({ kind: img.dataset.lootChest, x: a[0] * m.a + m.e, y: a[1] * m.d + m.f, w: img.width, h: img.height, at: performance.now() }); if (window.__chestDraws.length > 200) window.__chestDraws.shift(); }
      return di.call(this, img, ...a);
    };
    const ft = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { if (this.canvas.id === 'scene') { window.__fill.push(String(t)); if (window.__fill.length > 2000) window.__fill.shift(); } return ft.call(this, t, ...a); };
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await wait(page, 2500);
  await page.evaluate(() => { __idle.ui.closeModal(); document.querySelectorAll('.howto-card, .learn-card, .tour').forEach((e) => e.remove()); });
  return { ctx, page };
}

// Remplit le coffre (objets rares) et attend une image : renvoie la géométrie du coffre dessiné (px CSS de la page).
const fill = (page, n = 4, rarity = 'rare') => page.evaluate(async ([n, rarity]) => {
  const s = __idle.state; const pool = [...s.inventory, ...(s.stash ?? []), ...Object.values(s.equipment).filter(Boolean)];
  s.ui.hints = [...(s.ui.hints ?? []), 'loot-chest']; // bulle « première fois » déjà vue : on teste celle de l'Épique
  s.lootBag = Array.from({ length: n }, (_, k) => ({ ...structuredClone(pool[k % pool.length]), id: `c${k}-${Date.now()}`, rarity, locked: false }));
  __idle.ui.lootBag.lastKey = ''; __idle.ui.lootBag.update(s);
  await new Promise((res) => setTimeout(res, 1600)); // le coffre se pose (il peut glisser avec le sol)
}, [n, rarity]);

const geometry = (page) => page.evaluate(() => {
  const cv = document.getElementById('scene'); const c = cv.getBoundingClientRect(); const a = document.getElementById('stage-area').getBoundingClientRect();
  const dpr = cv.width / c.width;
  const d = window.__chestDraws.filter((x) => performance.now() - x.at < 300).pop();
  const btn = document.getElementById('loot-bag'); const b = btn.getBoundingClientRect();
  if (!d) return { drawn: false };
  const body = __idle.renderer.lootChest.dev; // v10.4 : corps du coffre (l'image dessinée est plus grande : couvercle ouvert)
  const box = { left: c.left + body.x / dpr, top: c.top + body.y / dpr, w: body.w / dpr, h: body.h / dpr };
  box.right = box.left + box.w; box.bottom = box.top + box.h;
  const feet = c.top + __idle.renderer.groundY * (c.height / __idle.renderer.height);
  const over = (id) => { const e = document.getElementById(id); if (!e || e.offsetParent === null) return false; const x = e.getBoundingClientRect(); return [box, b].some((r) => !(x.right <= r.left || x.left >= r.right || x.bottom <= r.top || x.top >= r.bottom)); };
  const cs = getComputedStyle(btn);
  return {
    drawn: true, inCanvas: d && cv.id === 'scene', kind: d.kind,
    left: Math.round(box.left - a.left), right: Math.round(a.right - box.right), top: Math.round(box.top - a.top), h: Math.round(box.h), ground: Math.round(box.bottom - feet),
    overBar: over('skill-bar'), overSeal: over('next-action'),
    hit: { w: Math.round(b.width), h: Math.round(b.height), onChest: b.left <= box.left + box.w / 2 && b.right >= box.left + box.w / 2 && b.top <= box.top + box.h / 2 && b.bottom >= box.top + box.h / 2, left: Math.round(b.left - a.left), right: Math.round(a.right - b.right) },
    domInvisible: cs.backgroundColor === 'rgba(0, 0, 0, 0)' && btn.querySelectorAll('img').length === 0 && [...btn.children].every((e) => e.getBoundingClientRect().width <= 1),
    cursor: cs.cursor, label: btn.getAttribute('aria-label'),
    center: { x: box.left + box.w / 2, y: box.top + box.h / 2 },
  };
});

for (const [w, h, phone] of [[1116, 993], [1716, 1000], [1280, 720], [900, 600], [390, 844, true]]) {
  const label = `${w}×${h}`;
  const { ctx, page } = await open(w, h, { touch: Boolean(phone), dpr: phone ? 3 : 1 }); // téléphone : écran ×3, au toucher
  await fill(page, 4, 'rare');
  const g = await geometry(page);
  ok(`${label} : coffre dessiné dans le canvas de la scène (pas d'élément DOM visible)`, g.drawn && g.inCanvas && g.domInvisible, JSON.stringify({ kind: g.kind, domInvisible: g.domInvisible }));
  ok(`${label} : sur le sol, ≈ ${phone ? 64 : 96} px de haut`, g.drawn && Math.abs(g.ground) <= 14 && g.h >= (phone ? 44 : 80) && g.h <= (phone ? 80 : 120), JSON.stringify({ ground: g.ground, h: g.h }));
  ok(`${label} : à ≥ 40 px des bords, ni sous la barre de compétences ni sous le Sceau`, g.left >= 40 && g.right >= 40 && g.top >= 40 && g.hit.left >= 40 && g.hit.right >= 40 && !g.overBar && !g.overSeal, JSON.stringify({ left: g.left, right: g.right, top: g.top, bar: g.overBar, seal: g.overSeal }));
  ok(`${label} : zone de toucher ≥ 44 px posée sur le coffre, curseur main, libellé accessible`, g.hit.w >= 44 && g.hit.h >= 44 && g.hit.onChest && g.cursor === 'pointer' && /Coffre de butin/.test(g.label ?? ''), JSON.stringify({ hit: g.hit, cursor: g.cursor, label: g.label }));
  await page.screenshot({ path: `${OUT}/${w}x${h}-1-coffre.png` });

  // Un objet Épique ramassé (événement « drop » réel, comme en combat) : vol, lueur, bulle, couvercle et pièces.
  const before = await page.evaluate(() => ({ glow: __idle.renderer.lootChest.glowColor, epic: __idle.renderer.lootChest.epic }));
  const flew = await page.evaluate(async () => {
    const s = __idle.state, world = __idle.world; const base = s.lootBag[0];
    const epic = { ...structuredClone(base), id: `epic-${Date.now()}`, rarity: 'epic' };
    s.lootBag.push(epic);
    const foe = world.enemies.find((e) => !e.dead) ?? null;
    const ev = { type: 'drop', item: epic, x: foe ? foe.x : 300, enemyId: foe?.id ?? -1, bagged: true, time: world.time };
    __idle.renderer.handleEvent(ev, world); __idle.ui.handleEvent(ev, s);
    const chest = __idle.renderer.lootChest; const t0 = chest.t;
    await new Promise((res) => setTimeout(res, 250));
    const mid = { flying: chest.flies.some((f) => f.id === epic.id), bubble: null };
    await new Promise((res) => setTimeout(res, 900));
    mid.bubble = chest.bubble?.text ?? null; mid.fill = [...new Set(window.__fill)].includes('Butin épique !'); // v10.4 : la bulle monte à l'arrivée de l'objet
    return { ...mid, landed: !chest.flies.some((f) => f.id === epic.id), opened: chest.openUntil > t0, coins: chest.coins.length + (chest.openUntil > t0 ? 3 : 0) };
  });
  await wait(page, 50);
  const after = await page.evaluate(() => ({ glow: __idle.renderer.lootChest.glowColor, epic: __idle.renderer.lootChest.epic, ray: __idle.ui.lootBag.btn.classList.contains('lb-epic') }));
  ok(`${label} : objet Épique ramassé → il vole jusqu'au coffre, le couvercle s'entrouvre`, flew.flying && flew.landed && flew.opened, JSON.stringify(flew));
  ok(`${label} : la lueur passe à l'Épique (rayon de lumière) et la bulle « Butin épique ! » s'affiche`, before.glow !== after.glow && after.epic && after.ray && flew.bubble === 'Butin épique !' && flew.fill, JSON.stringify({ before, after, bubble: flew.bubble }));
  // Capture pendant un vol (nouvel Épique) : objet en l'air, rayon, bulle.
  await page.evaluate(() => { const s = __idle.state; const it = { ...structuredClone(s.lootBag[0]), id: `epic2-${Date.now()}`, rarity: 'epic' }; s.lootBag.push(it); const w = __idle.world; const foe = w.enemies.find((e) => !e.dead); const ev = { type: 'drop', item: it, x: foe ? foe.x : 300, enemyId: foe?.id ?? -1, bagged: true, time: w.time }; __idle.renderer.handleEvent(ev, w); __idle.ui.handleEvent(ev, s); });
  await wait(page, 380);
  await page.screenshot({ path: `${OUT}/${w}x${h}-2-epique-en-vol.png` });
  await wait(page, 500);
  await page.screenshot({ path: `${OUT}/${w}x${h}-3-couvercle-pieces.png` });

  // Toucher (ou cliquer) le coffre dessiné ouvre le tri « Coffre de butin ».
  const g2 = await geometry(page);
  if (phone) await page.touchscreen.tap(g2.center.x, g2.center.y); else await page.mouse.click(g2.center.x, g2.center.y);
  await wait(page, 400);
  const sheet = await page.evaluate(() => { const s = document.getElementById('loot-sheet'); return { open: !s.classList.contains('hidden'), title: s.querySelector('.lb-head b')?.textContent, keep: Boolean(s.querySelector('[data-lb="keep-best"]')) }; });
  ok(`${label} : ${phone ? 'toucher' : 'cliquer'} le coffre dessiné ouvre « Coffre de butin »`, sheet.open && sheet.title === 'Coffre de butin' && sheet.keep, JSON.stringify(sheet));
  await page.screenshot({ path: `${OUT}/${w}x${h}-4-tri.png` });

  // « Garder le meilleur » : même résultat que lootBagKeepBestChoices appliqué à une copie de la partie.
  const keep = await page.evaluate(async () => {
    const { lootBagKeepBestChoices, sortLootBag } = await import('./src/core/inventory.js');
    const s = __idle.state; const copy = structuredClone(s); const ids = s.lootBag.map((i) => i.id);
    sortLootBag(copy, lootBagKeepBestChoices(copy));
    const where = (st, id) => st.inventory.some((i) => i.id === id) ? 'inv' : (st.stash ?? []).some((i) => i.id === id) ? 'stash' : st.lootBag.some((i) => i.id === id) ? 'bag' : Object.values(st.equipment).some((i) => i?.id === id) ? 'equip' : 'gone';
    document.querySelector('#loot-sheet [data-lb="keep-best"]').click();
    await new Promise((res) => setTimeout(res, 300));
    const want = ids.map((id) => where(copy, id)), got = ids.map((id) => where(s, id));
    return { same: JSON.stringify(want) === JSON.stringify(got), want, got, closed: document.getElementById('loot-sheet').classList.contains('hidden') };
  });
  ok(`${label} : « Garder le meilleur » = lootBagKeepBestChoices`, keep.same, JSON.stringify(keep));

  // Plein : il déborde et dit « Coffre plein : trie-le ».
  const full = await page.evaluate(async () => {
    const { LOOT_BAG_MAX } = await import('./src/core/inventory.js');
    const s = __idle.state; const pool = [...s.inventory, ...Object.values(s.equipment).filter(Boolean)];
    s.lootBag = Array.from({ length: LOOT_BAG_MAX }, (_, k) => ({ ...structuredClone(pool[k % pool.length]), id: `f${k}-${Date.now()}` }));
    __idle.ui.lootBag.lastKey = ''; __idle.ui.lootBag.update(s);
    await new Promise((res) => setTimeout(res, 400));
    return { full: __idle.renderer.lootChest.full, bubble: __idle.renderer.lootChest.bubble?.text, fill: [...new Set(window.__fill)].includes('Coffre plein : trie-le') };
  });
  ok(`${label} : plein → pièces au sol et bulle « Coffre plein : trie-le »`, full.full && full.bubble === 'Coffre plein : trie-le' && full.fill, JSON.stringify(full));
  await page.screenshot({ path: `${OUT}/${w}x${h}-5-plein.png` });

  // Touche B (clavier) : ouvre et ferme le tri.
  if (!phone) {
    await page.keyboard.press('b'); await wait(page, 300);
    const kb = await page.evaluate(() => !document.getElementById('loot-sheet').classList.contains('hidden'));
    await page.click('#loot-sheet [data-lb="close"]'); await wait(page, 200);
    ok(`${label} : la touche B ouvre le tri, ✕ le ferme`, kb && await page.evaluate(() => document.getElementById('loot-sheet').classList.contains('hidden')));
  }
  ok(`${label} : aucune erreur JavaScript`, page.errors.length === 0, page.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// Pas de coffre dans l'Arène (et sa Survie : même scène plein écran), ni sans objet ; i/s et coût du dessin en 1280 × 720.
{
  const { ctx, page } = await open(1280, 720);
  await fill(page, 6, 'epic');
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(n / 3); }; requestAnimationFrame(f); }));
  ok(`1280×720 : ${Math.round(fps)} i/s avec le coffre (Épique, rayon)`, fps >= 50);
  const cost = await page.evaluate(async () => {
    const { drawLootChest, drawLootChestTop } = await import('./src/render/loot-chest.js');
    const r = __idle.renderer; const ctx = r.ctx; const N = 400;
    ctx.save(); const t0 = performance.now();
    for (let i = 0; i < N; i++) { drawLootChest(r, ctx, __idle.world); drawLootChestTop(r, ctx); }
    const ms = (performance.now() - t0) / N; ctx.restore(); return ms;
  });
  ok(`1280×720 : dessin du coffre ≤ 0,5 ms par image`, cost <= 0.5, `${cost.toFixed(3)} ms`);
  await page.evaluate(() => { __idle.ui.closePanel?.(); __idle.ui.arenaFight(1); });
  await page.waitForSelector('.arena-map .am-canvas', { timeout: 8000 });
  await wait(page, 900);
  const arena = await page.evaluate(() => ({ btn: document.getElementById('loot-bag').classList.contains('hidden'), drawn: window.__chestDraws.some((d) => performance.now() - d.at < 400) }));
  ok('Arène : pas de coffre (ni dessiné, ni zone de toucher)', arena.btn && !arena.drawn, JSON.stringify(arena));
  await page.evaluate(() => { document.querySelector('.arena-map')?.remove(); __idle.ui.arenaOpen = false; const s = __idle.state; s.lootBag = []; __idle.ui.lootBag.update(s); });
  await wait(page, 500);
  const empty = await page.evaluate(() => ({ btn: document.getElementById('loot-bag').classList.contains('hidden'), drawn: window.__chestDraws.some((d) => performance.now() - d.at < 300) }));
  ok('coffre vide : ni dessiné, ni zone de toucher', empty.btn && !empty.drawn, JSON.stringify(empty));
  ok('1280×720 (Arène) : aucune erreur JavaScript', page.errors.length === 0, page.errors.slice(0, 3).join(' | '));
  await ctx.close();
}
const n = results.filter(Boolean).length;
console.log(`${n}/${results.length} vérifications réussies`);
await browser.close(); server.close();
process.exit(n === results.length ? 0 : 1);
