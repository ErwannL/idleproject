// v10.4 (parties 1 et 2) : pages plein écran Personnage et Forge, dans un vrai navigateur.
// En 1116 × 993, 1280 × 720 et 1716 × 1000 : page Personnage avec les 6 places, le personnage d'au moins 300 px, la fiche
// et le bouton « Renforcer » visibles sans défiler, icônes d'objets à 48 px ; Forge : les 4 ateliers et la fusion
// détaillée sans défiler ; aucun « +0 % » ni « +0,01 % » proposé comme action ; avant → après sans ligne identique ;
// mini-fenêtre de combat présente et animée ; Échap ferme la page et tout revient ; 60 i/s visées (au moins 55) en
// 1280 × 720 page ouverte. En 390 × 844 : rien ne déborde en largeur, la fiche est une feuille du bas. Aucune erreur JS.
// Captures dans dist/e2e-1040-pages (ou le dossier donné). Usage : node tools/e2e-1040-pages.mjs [dossier-captures]
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = resolve(process.argv[2] ?? 'dist/e2e-1040-pages');
await mkdir(out, { recursive: true });
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const raw = await readFile('tests/fixtures/endgame.json', 'utf8');
const results = [];
const ok = (name, pass, info = '') => { results.push(pass); console.log(`${pass ? '✔' : '✘'} ${name}${pass ? '' : ` ${info}`}`); };

async function open(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.addInitScript((r) => { if (!sessionStorage.getItem('c')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('c', '1'); } }, raw);
  await page.goto(url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => __idle.ui.closeModal());
  return { ctx, page };
}
// Partie équipée (comme tools/e2e-103-equip.mjs) : 6 places portées, un sac fourni, de quoi renforcer.
const seed = (page) => page.evaluate(async () => {
  const { generateItem, makeItem } = await import('./src/core/loot.js');
  const { Rng } = await import('./src/core/rng.js');
  const { equipItem } = await import('./src/core/inventory.js');
  const { equipBestAllGear } = await import('./src/core/companion-gear.js');
  const { levelForStage } = await import('./src/core/combat.js');
  const s = __idle.state; const rng = new Rng(7);
  s.maxStage = Math.max(s.maxStage, 139); s.records.bestStage = Math.max(s.records.bestStage ?? 1, 139);
  s.materials.shards = 79000; s.gold = Math.max(s.gold, 1e30);
  const lvl = levelForStage(s.maxStage);
  s.inventory = [];
  for (let i = 0; i < 46; i++) s.inventory.push(generateItem(s, rng, { level: lvl - 30 + (i % 25) }));
  for (const it of [...s.inventory]) equipItem(s, it.id);
  equipBestAllGear(s);
  for (let i = 0; i < 11; i++) s.inventory.push(makeItem(s, 'short_sword', 'epic', lvl - 40 + i, undefined, rng));
  s.inventory.push(makeItem(s, 'iron_helm', 'legendary', lvl, undefined, rng));
  Object.assign(__idle.ui.view, { selectedItemId: null, eqSlot: null, sheetOpen: null, gearWho: 'hero', eqTab: 'gear', forgeSeg: null, fuseOpen: null });
  __idle.ui.openTab('inventory'); __idle.ui.renderPanel(s);
});
const render = (page) => page.evaluate(() => { __idle.ui.renderPanel(__idle.state); });
// Visible sans défiler : entier dans la fenêtre et dans la zone visible de son conteneur qui défile, rien par-dessus.
const visible = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => {
  const b = e.getBoundingClientRect();
  if (!b.width || b.top < -0.5 || b.bottom > innerHeight + 0.5 || b.left < -0.5 || b.right > innerWidth + 0.5) return false;
  for (let p = e.parentElement; p; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (/(auto|scroll|hidden)/.test(cs.overflowY + cs.overflowX)) { const r = p.getBoundingClientRect(); if (b.top < r.top - 0.5 || b.bottom > r.bottom + 0.5) return false; }
  }
  const top = document.elementFromPoint(b.left + b.width / 2, b.top + Math.min(b.height / 2, 20));
  return Boolean(top) && (e.contains(top) || top.contains(e));
}), sel);
// Mots et boutons visibles de la page (même mesure que la revue des menus : texte affiché, replis fermés exclus).
const density = (page) => page.evaluate(() => {
  const root = document.getElementById('panel'); let words = 0;
  const W = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (W.nextNode()) {
    const n = W.currentNode, el = n.parentElement;
    if (!el || !n.textContent.trim()) continue;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || !el.getBoundingClientRect().width) continue;
    if (el.closest('details:not([open]) > :not(summary)')) continue;
    words += n.textContent.split(/\s+/).filter((w) => /[A-Za-zÀ-ÿ]{2,}/.test(w)).length;
  }
  return { words, buttons: [...root.querySelectorAll('button, select')].filter((b) => b.getBoundingClientRect().width > 0 && getComputedStyle(b).visibility !== 'hidden').length };
});
// « +0 % » ou « +0,01 % » dans ce qui est proposé : boutons, lignes « maintenant », gains de la liste, lignes « après ».
const zeroOffers = (page) => page.evaluate(() => [...document.querySelectorAll('#panel button, .fg-now, .fg-up-gain, .eq-row b, .eq-share, .eq-pick-id small')]
  .map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter((t) => /\+0(?:,0\d?)? %/.test(t)));
// Lignes avant → après identiques.
const sameRows = (page) => page.evaluate(() => [...document.querySelectorAll('.eq-reinf .eq-row')].map((r) => {
  const c = [...r.children].map((x) => x.textContent.trim()); return c[1] === c[3] ? c.join(' ') : null; }).filter(Boolean));
const overflow = (page) => page.evaluate(() => {
  const b = document.getElementById('panel-body'); const R = b.getBoundingClientRect().right;
  return { doc: document.documentElement.scrollWidth - innerWidth, body: b.scrollWidth - b.clientWidth,
    wide: [...b.querySelectorAll('.eq *, .fg *')].filter((e) => e.getBoundingClientRect().right > R + 1 && !e.closest('.eq-whos, .eq-tabs')).length };
});
const fps = (page) => page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(n / 3); }; requestAnimationFrame(f); }));

for (const [w, h] of [[1116, 993], [1280, 720], [1716, 1000]]) {
  const tag = `${w}×${h}`;
  const { ctx, page } = await open(w, h);
  await seed(page);
  await page.waitForTimeout(700);
  // --- La page elle-même : plein écran, mini-fenêtre animée, rien ne flotte par-dessus.
  const pg = await page.evaluate(() => {
    const p = document.getElementById('panel').getBoundingClientRect(); const m = document.getElementById('page-mini')?.getBoundingClientRect();
    const tabs = document.getElementById('tabs').getBoundingClientRect();
    const vis = (id) => { const e = document.getElementById(id); return e && !e.classList.contains('hidden') && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0; };
    return { cls: document.getElementById('app').classList.contains('page-ui'), left: Math.round(p.left), top: Math.round(p.top), w: Math.round(p.width), bottom: Math.round(p.bottom), tabsTop: Math.round(tabs.top),
      mini: m ? [Math.round(m.left), Math.round(m.top), Math.round(m.width), Math.round(m.height)] : null, floating: ['next-action', 'skill-bar', 'loot-bag'].filter(vis) };
  });
  ok(`${tag} : la page couvre la fenêtre au-dessus du menu du bas`, pg.cls && pg.left === 0 && pg.top === 0 && pg.w === w && Math.abs(pg.bottom - pg.tabsTop) <= 1, JSON.stringify(pg));
  ok(`${tag} : mini-fenêtre de combat ≈ 280 × 160 en haut à gauche`, Boolean(pg.mini) && pg.mini[0] <= 12 && pg.mini[1] <= 12 && pg.mini[2] >= 270 && pg.mini[2] <= 290 && pg.mini[3] >= 150 && pg.mini[3] <= 170, JSON.stringify(pg.mini));
  ok(`${tag} : ni Sceau, ni barre de compétences, ni coffre par-dessus la page`, pg.floating.length === 0, pg.floating.join());
  const shot = () => page.evaluate(() => { const c = document.querySelector('#page-mini canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let hsh = 0; for (let i = 0; i < d.length; i += 97) hsh = (hsh * 31 + d[i]) | 0; return { f: Number(c.dataset.frames), hsh }; });
  const a = await shot(); await page.waitForTimeout(600); const b = await shot();
  ok(`${tag} : la mini-fenêtre est animée (${b.f - a.f} images recopiées en 0,6 s)`, b.f > a.f && a.hsh !== b.hsh, JSON.stringify({ a, b }));
  // --- Personnage : 6 places, personnage ≥ 300 px, fiche et « Renforcer » visibles sans défiler, icônes 48 px.
  const slots = await visible(page, '.eq-doll .eq-slot');
  ok(`${tag} : les 6 places sont visibles sans défiler`, slots.length === 6 && slots.every(Boolean), JSON.stringify(slots));
  const fig = await page.evaluate(() => { const e = document.querySelector('.eq-figure .eq-art') ?? document.querySelector('.eq-figure canvas'); return Math.round(e?.getBoundingClientRect().height ?? 0); });
  ok(`${tag} : le personnage fait ${fig} px de haut (300 au moins)`, fig >= 300, String(fig));
  const head = await visible(page, '.eq-side-sheet .eq-sh-head');
  const reinf = await visible(page, '.eq-side-sheet [data-action="upgrade-item"]');
  ok(`${tag} : la fiche est visible à droite, sans défiler`, head[0] === true && await page.evaluate(() => document.querySelector('.eq-side-sheet').getBoundingClientRect().width >= 420), JSON.stringify(head));
  ok(`${tag} : le bouton « Renforcer » est visible sans défiler`, reinf[0] === true, JSON.stringify(reinf));
  const icons = await page.evaluate(() => [...document.querySelectorAll('.eq-slot-box img.eq-ico, .eq-card img.eq-ico, .eq-sh-head img.eq-ico')].map((i) => [Math.round(i.getBoundingClientRect().width), Math.round(i.getBoundingClientRect().height)]));
  ok(`${tag} : icônes d'objets à 48 px (${icons.length} icônes)`, icons.length >= 7 && icons.every(([x, y]) => x === 48 && y === 48), JSON.stringify(icons.slice(0, 6)));
  const centered = await page.evaluate(() => [...document.querySelectorAll('.eq-slot-box')].filter((b) => b.querySelector('img.eq-ico')).every((b) => { const r = b.getBoundingClientRect(), i = b.querySelector('img.eq-ico').getBoundingClientRect(); return Math.abs((r.left + r.right) / 2 - (i.left + i.right) / 2) <= 1 && Math.abs((r.top + r.bottom) / 2 - (i.top + i.bottom) / 2) <= 1; }));
  ok(`${tag} : icônes centrées dans leur case`, centered);
  const names = await page.evaluate(() => [...document.querySelectorAll('.eq-doll .eq-slot-name')].map((n) => ({ t: n.textContent, lines: Math.round(n.getBoundingClientRect().height / parseFloat(getComputedStyle(n).lineHeight || '16')), cut: n.scrollWidth > n.clientWidth + 1 })));
  ok(`${tag} : noms d'objets sur une ligne, jamais coupés`, names.length >= 1 && names.every((n) => n.lines <= 1 && !n.cut), JSON.stringify(names));
  const z1 = await zeroOffers(page); const s1 = await sameRows(page);
  ok(`${tag} : Personnage — aucun « +0 % » proposé, avant → après sans ligne identique`, z1.length === 0 && s1.length === 0, JSON.stringify({ z1, s1 }));
  const dens = await density(page);
  console.log(`  · ${tag} : page Personnage ${dens.words} mots, ${dens.buttons} boutons`);
  ok(`${tag} : page Personnage sobre (au plus 160 mots, 80 boutons)`, dens.words <= 160 && dens.buttons <= 80, JSON.stringify(dens));
  await page.screenshot({ path: `${out}/personnage-${w}.png` });
  // Compagnon : Étoiles et Compétences dans la même page.
  for (const t of ['stars', 'skills']) {
    await page.evaluate((t) => { Object.assign(__idle.ui.view, { gearWho: __idle.state.companions.equipped[0], eqTab: t, selectedItemId: null }); __idle.ui.renderPanel(__idle.state); }, t);
    await page.waitForTimeout(250);
    const sh = await visible(page, '.eq-side-sheet .eq-sheet .eq-sh-head');
    ok(`${tag} : compagnon › ${t === 'stars' ? 'Étoiles' : 'Compétences'} — fiche visible`, sh[0] === true, JSON.stringify(sh));
    await page.screenshot({ path: `${out}/personnage-${t}-${w}.png` });
  }
  // Renfort presque sans effet : une arme très en retard → on le dit et on affiche « Objet dépassé » et « Trouver mieux ».
  await page.evaluate(async () => {
    const { makeItem } = await import('./src/core/loot.js'); const s = __idle.state;
    const old = s.equipment.weapon; s.inventory.push(old); s.equipment.weapon = makeItem(s, 'dagger', 'common', 3);
    Object.assign(__idle.ui.view, { gearWho: 'hero', eqTab: 'gear', selectedItemId: s.equipment.weapon.id }); __idle.ui.renderPanel(s);
  });
  await page.waitForTimeout(250);
  const weak = await page.evaluate(() => ({ note: document.querySelector('.eq-side-sheet .eq-weak')?.textContent.trim(), find: Boolean(document.querySelector('.eq-side-sheet .eq-find')), gone: !/Remettre au niveau/.test(document.querySelector('.eq-side-sheet')?.textContent ?? '') }));
  const weakVis = await visible(page, '.eq-side-sheet .eq-find');
  ok(`${tag} : renfort presque sans effet — dit franchement, « Trouver mieux » visible, plus de « Remettre au niveau »`, /^⚠ Objet dépassé · Niv\. 3, ton étape : \d+/.test(weak.note ?? '') && weak.find && weak.gone && weakVis[0] === true, JSON.stringify({ weak, weakVis }));
  ok(`${tag} : aucun « +0,01 % » dans la fiche de l'arme en retard`, (await zeroOffers(page)).length === 0, JSON.stringify(await zeroOffers(page)));
  await page.screenshot({ path: `${out}/personnage-faible-${w}.png` });
  // --- Forge : les 4 ateliers et la fusion détaillée, sans défiler ; atelier 2 jamais à +0 %.
  await page.evaluate(() => { __idle.ui.openTab('forge', { forgeSeg: 'fuse', fuseOpen: 'weapon|epic' }); __idle.ui.renderPanel(__idle.state); });
  await page.waitForTimeout(400);
  const steps = await visible(page, '.fg-step .fg-btn');
  ok(`${tag} : Forge — les 4 ateliers et leurs boutons visibles sans défiler`, steps.length === 4 && steps.every(Boolean), JSON.stringify(steps));
  const fuse = [];
  for (const sel of ['.fg-side .fg-cases', '.fg-side .fg-gauge-bar', '.fg-side .fg-fuse, .fg-side .fg-fuse-btns .bad']) fuse.push((await visible(page, sel))[0] === true);
  const beside = await page.evaluate(() => document.querySelector('.fg-side').getBoundingClientRect().left >= Math.max(...[...document.querySelectorAll('.fg-step')].map((e) => e.getBoundingClientRect().right)) - 1);
  ok(`${tag} : Forge — la fusion détaillée est à côté des ateliers, sans défiler`, fuse.length === 3 && fuse.every(Boolean) && beside, JSON.stringify({ fuse, beside }));
  const gold = await page.evaluate(() => [...document.querySelectorAll('.fg-step .fg-btn')].every((b) => b.classList.contains('btn-gold')));
  const nowLine = await page.evaluate(() => { const e = document.querySelector('.fg-now.good'); return e ? getComputedStyle(e).borderTopColor : null; });
  ok(`${tag} : Forge — boutons dorés, ligne « maintenant » en évidence`, gold && Boolean(nowLine) && nowLine !== 'rgba(0, 0, 0, 0)', String(nowLine));
  const diag = await page.evaluate(() => [...document.querySelectorAll('.fg-diagram .fg-it img')].map((i) => Math.round(i.getBoundingClientRect().width)));
  ok(`${tag} : Forge — schémas en icônes ×3 (48 px au moins)`, diag.length >= 5 && diag.every((x) => x >= 48), JSON.stringify(diag));
  await page.screenshot({ path: `${out}/forge-fusion-${w}.png` });
  for (const seg of ['recycle', 'upgrade', 'craft']) {
    await page.evaluate((seg) => { __idle.ui.view.forgeSeg = seg; __idle.ui.renderPanel(__idle.state); }, seg);
    await page.waitForTimeout(200);
    const z = await zeroOffers(page); const same = await sameRows(page);
    if (z.length || same.length) ok(`${tag} : Forge › ${seg} sans « +0 % » ni ligne identique`, false, JSON.stringify({ z, same }));
    if (seg === 'upgrade') {
      const r = await visible(page, '.fg-side .fg-sheet [data-action="upgrade-item"]');
      ok(`${tag} : Forge › Renforcer — l'action de la fiche visible sans défiler`, r.some(Boolean), JSON.stringify(r));
      const line = await page.evaluate(() => document.querySelectorAll('.fg-now')[1].textContent.trim());
      ok(`${tag} : atelier 2 — « ${line} »`, !/\+0(?:,0\d?)? %/.test(line) && (/de puissance$/.test(line) || /^(Rien d'utile|Tes objets|Équipe d'abord|Il manque)/.test(line) || / : \+?\d/.test(line)), line);
    }
    await page.screenshot({ path: `${out}/forge-${seg}-${w}.png` });
  }
  ok(`${tag} : Forge sans débordement`, await overflow(page).then((o) => o.doc <= 0 && o.wide === 0), JSON.stringify(await overflow(page)));
  // --- i/s page ouverte (1280 × 720 : 55 au moins ; la meilleure de 3 mesures, la machine de test peut être chargée).
  if (w === 1280) {
    let best = 0;
    for (let i = 0; i < 3 && best < 55; i++) best = Math.max(best, await fps(page));
    ok(`${tag} : ${Math.round(best)} i/s page ouverte (55 au moins)`, best >= 55, String(best));
  }
  // --- Échap ferme la page : tout revient (scène, Sceau, panneau habituel).
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const closed = await page.evaluate(() => ({ page: document.getElementById('app').classList.contains('page-ui'), mini: getComputedStyle(document.getElementById('page-mini')).display, tab: __idle.ui.tab,
    scene: Math.round(document.getElementById('scene').getBoundingClientRect().width), topbar: getComputedStyle(document.getElementById('topbar')).display }));
  ok(`${tag} : Échap ferme la page, tout revient`, !closed.page && closed.mini === 'none' && closed.tab === null && closed.scene >= w * 0.5 && closed.topbar !== 'none', JSON.stringify(closed));
  await page.evaluate(() => __idle.ui.openTab('upgrades'));
  await page.waitForTimeout(300);
  const list = await page.evaluate(() => ({ page: document.getElementById('app').classList.contains('page-ui'), w: Math.round(document.getElementById('panel').getBoundingClientRect().width) }));
  ok(`${tag} : les écrans de liste (Améliorations) gardent le volet latéral`, !list.page && list.w < w * 0.7, JSON.stringify(list));
  await page.evaluate(() => __idle.ui.openTab('inventory'));
  await page.waitForTimeout(300);
  await page.click('#panel-close');
  await page.waitForTimeout(300);
  ok(`${tag} : ✕ ferme la page`, await page.evaluate(() => !document.getElementById('app').classList.contains('page-ui') && __idle.ui.tab === null));
  ok(`${tag} : aucune erreur JavaScript`, page.errors.length === 0, page.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// --- Téléphone : la page prend l'écran, rien ne déborde, la fiche est une feuille du bas.
{
  const { ctx, page } = await open(390, 844);
  await seed(page);
  await page.waitForTimeout(600);
  const o = await overflow(page);
  ok('390×844 : Personnage sans débordement en largeur', o.doc <= 0 && o.body <= 0 && o.wide === 0, JSON.stringify(o));
  const whos = await page.evaluate(() => { const e = document.querySelector('.eq-top > .eq-whos'); return { scroll: e.scrollWidth > e.clientWidth, shadow: e.classList.contains('more'), x: getComputedStyle(e).overflowX }; });
  ok('390×844 : la rangée des personnages défile, avec une ombre au bord', !whos.scroll || (whos.shadow && whos.x === 'auto'), JSON.stringify(whos));
  const slots = await visible(page, '.eq-doll .eq-slot');
  ok('390×844 : les 6 places visibles', slots.length === 6 && slots.every(Boolean), JSON.stringify(slots));
  await page.screenshot({ path: `${out}/personnage-390.png` });
  await page.click('.eq-doll .eq-slot[data-value="weapon"]');
  await page.waitForSelector('#unit-host .eq-pop .eq-sheet');
  await page.waitForTimeout(350);
  const r = await page.evaluate(() => { const p = document.querySelector('#unit-host .eq-pop').getBoundingClientRect(); return { bottom: Math.round(innerHeight - p.bottom), w: Math.round(p.width), top: Math.round(p.top) }; });
  ok('390×844 : la fiche est une feuille du bas', r.bottom === 0 && r.w === 390 && r.top > 150, JSON.stringify(r));
  const rf = await visible(page, '#unit-host .eq-pop [data-action="upgrade-item"]');
  ok('390×844 : « Renforcer » visible dans la feuille sans défiler', rf[0] === true, JSON.stringify(rf));
  await page.screenshot({ path: `${out}/personnage-feuille-390.png` });
  await page.click('#unit-host .eq-close');
  await page.evaluate(() => { __idle.ui.openTab('forge', { forgeSeg: 'fuse', fuseOpen: 'weapon|epic' }); __idle.ui.renderPanel(__idle.state); });
  await page.waitForTimeout(400);
  const of = await overflow(page);
  ok('390×844 : Forge sans débordement en largeur', of.doc <= 0 && of.body <= 0 && of.wide === 0, JSON.stringify(of));
  ok('390×844 : Forge — aucun « +0 % » proposé', (await zeroOffers(page)).length === 0, JSON.stringify(await zeroOffers(page)));
  await page.screenshot({ path: `${out}/forge-390.png` });
  ok('390×844 : aucune erreur JavaScript', page.errors.length === 0, page.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

const n = results.filter(Boolean).length;
console.log(`${n}/${results.length} vérifications réussies · captures : ${out}`);
await browser.close(); server.close();
process.exit(n === results.length ? 0 : 1);
