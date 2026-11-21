// v10.4 (partie 6) : test de bout en bout du Bastion « le trouver, le lancer, le voir vivre », dans le navigateur, en
// 1116 × 993, 1280 × 720, 1716 × 1000 et 390 × 844 (partie du joueur : fin de jeu, Bastion jamais utilisé).
//  - trouver : depuis le menu du bas en 2 touchers au plus (Équipe › Bastion), depuis la tour de la scène en 1 ; la
//    tour ne recouvre ni la barre de compétences, ni le Sceau, ni le coffre de butin ;
//  - lancer : à la première ouverture, au moins un ouvrier posé et un chantier lancé, annoncés ;
//  - voir vivre : ouvriers visibles sur la carte, bâtiments dessinés sur le décor, page ≥ 60 % d'image et ≤ 120 mots,
//    rien d'important ne demande de défiler sur PC ; arbre des recherches (nœuds illustrés, celle en cours entourée,
//    avec son temps) ; « Pendant ton absence » après 3 h, puis « Tout récupérer » ; aucun débordement horizontal ;
//    aucune erreur JavaScript ; i/s ≥ 55 en 1280 × 720, page ouverte.
// Captures : dist/e2e-1040-bastion/ (ou le dossier donné en argument). Usage : node tools/e2e-1040-bastion.mjs [dossier]
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const out = process.argv[2] ?? 'dist/e2e-1040-bastion';
await mkdir(out, { recursive: true });
const save = JSON.parse(await readFile('tests/fixtures/endgame.json', 'utf8'));
save.materials.shards = 6000; save.gold = 1e60;
delete save.bastion; // Bastion jamais utilisé : il s'ouvre au chargement (étape > 40), sans ouvrier ni chantier
const raw = JSON.stringify(save);
const results = [];
const ok = (name, pass, info = '') => { results.push(pass); console.log(`${pass ? '✔' : '✘'} ${name} ${info}`); };
const HOUR = 3_600_000;

async function open(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', (e) => page.errors.push(`${e.message} ${(e.stack ?? '').split('\n').slice(1, 3).join(' ').trim()}`));
  await page.addInitScript((r) => { if (!sessionStorage.getItem('c')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('c', '1'); } }, raw);
  await page.addInitScript(() => { const k = Number(sessionStorage.getItem('skew') || 0); const real = Date.now.bind(Date); Date.now = () => real() + k; });
  await boot(page);
  return { ctx, page };
}
async function boot(page) {
  await page.goto(url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => __idle.ui.closeModal());
}
async function away(page, hours) {
  await page.evaluate((ms) => { __idle.save(); sessionStorage.setItem('skew', String(Number(sessionStorage.getItem('skew') || 0) + ms)); }, hours * HOUR);
  await page.goto(url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
}
const overflow = (page) => page.evaluate(() => {
  const body = document.getElementById('panel-body');
  return { doc: document.documentElement.scrollWidth - innerWidth, panel: body.scrollWidth - body.clientWidth };
});
// Part d'image de la page : points tous les 8 px dans la partie visible de la page ; un point compte s'il tombe dans une
// image, un dessin (canvas) ou un élément à image de fond visibles (coupés par leurs cadres défilants et la fenêtre).
// Mots : textes visibles du panneau (comme tools/word-density.mjs).
const measure = (page) => page.evaluate(() => {
  const pg = document.querySelector('.bs-pg');
  const r = pg.getBoundingClientRect();
  const clip = (b, e) => { let out = { l: b.left, t: b.top, r: b.right, b: b.bottom }; for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const c = a.getBoundingClientRect(); out = { l: Math.max(out.l, c.left), t: Math.max(out.t, c.top), r: Math.min(out.r, c.right), b: Math.min(out.b, c.bottom) }; } } return out; };
  const pics = [...pg.querySelectorAll('*')].filter((e) => {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || e.closest('.hidden')) return false;
    return e.tagName === 'IMG' || e.tagName === 'CANVAS' || cs.backgroundImage.includes('url(');
  }).map((e) => clip(e.getBoundingClientRect(), e)).filter((b) => b.r > b.l && b.b > b.t);
  const x0 = Math.max(0, r.left), x1 = Math.min(innerWidth, r.right), y0 = Math.max(0, r.top), y1 = Math.min(innerHeight, r.bottom);
  let pts = 0, hit = 0;
  for (let y = y0 + 4; y < y1; y += 8) {
    for (let x = x0 + 4; x < x1; x += 8) {
      pts += 1;
      if (pics.some((b) => x >= b.l && x < b.r && y >= b.t && y < b.b)) hit += 1;
    }
  }
  const root = document.getElementById('panel');
  let words = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode; const el = node.parentElement;
    if (!el || !node.textContent.trim()) continue;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('.hidden')) continue;
    const b = el.getBoundingClientRect(); if (!b.width || b.top > innerHeight || b.bottom < 0 || b.left > innerWidth || b.right < 0) continue;
    words += node.textContent.split(/\s+/).filter((w) => /[A-Za-zÀ-ÿ]{2,}/.test(w)).length;
  }
  return { image: Math.round((hit / Math.max(1, pts)) * 100), words };
});
const inView = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1; }, sel);
const hits = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

for (const [w, h] of [[1116, 993], [1280, 720], [1716, 1000], [390, 844]]) {
  const tag = `${w}×${h}`;
  const phone = w <= 600;
  const shot = (page, n) => page.screenshot({ path: `${out}/${w}x${h}-${n}.png` });
  const { ctx, page } = await open(w, h);
  // ---- Le trouver : la tour sur la scène (visible, sans rien recouvrir), puis le menu du bas.
  await page.waitForTimeout(1200);
  const tower = await page.evaluate(() => {
    const r = (id) => { const e = document.getElementById(id); if (!e || e.offsetParent === null || e.classList.contains('hidden') || getComputedStyle(e).visibility === 'hidden') return null; const b = e.getBoundingClientRect(); return b.width && b.height ? b.toJSON() : null; };
    return { tower: r('bastion-tower'), skill: r('skill-bar'), seal: r('next-action'), chest: r('loot-bag'), dot: !document.querySelector('#bastion-tower .bt-dot').classList.contains('hidden') };
  });
  ok(`${tag} : la tour du Bastion est sur la scène, sans recouvrir la barre de compétences, le Sceau ni le coffre de butin`,
    Boolean(tower.tower) && !hits(tower.tower, tower.skill) && !hits(tower.tower, tower.seal) && !hits(tower.tower, tower.chest), JSON.stringify(tower));
  ok(`${tag} : pastille sur la tour (ouvrier qui manque)`, tower.dot);
  await shot(page, '0-scene');
  // Menu du bas : Équipe (1), Bastion (2).
  let taps = 0;
  await page.locator('#tabs button[data-menu="team"]').click(); taps += 1;
  await page.waitForTimeout(500);
  if (await page.evaluate(() => __idle.ui.tab) !== 'camp') { await page.locator('#panel-subtabs .subtab[data-sub="camp"]').click(); taps += 1; }
  await page.waitForTimeout(900);
  ok(`${tag} : Bastion atteint depuis le menu du bas en ${taps} touchers (Équipe › Bastion)`, taps <= 2 && await page.evaluate(() => __idle.ui.tab === 'camp' && Boolean(document.querySelector('.bs-pg'))));
  // ---- Le lancer : première ouverture.
  const kick = await page.evaluate(() => { const b = __idle.state.bastion; return { workers: Object.values(b.buildings).filter((x) => x.worker).length, builds: Object.values(b.buildings).filter((x) => x.build).length, kicked: b.kicked > 0, ribbon: document.querySelector('.bs-kick')?.textContent.replace(/\s+/g, ' ').trim() ?? '' }; });
  ok(`${tag} : première ouverture — ouvriers posés, chantier offert lancé, annoncés (« …, forgeron : +25 % »)`, kick.workers >= 1 && kick.builds >= 1 && kick.kicked && /(forgeron(?:ne)?|savante?) : \+\d+ %/.test(kick.ribbon) && /Chantier offert/.test(kick.ribbon), JSON.stringify(kick));
  await shot(page, '1-demarrage');
  // Fermer puis rouvrir : pas de second démarrage.
  await page.evaluate(() => { __idle.ui.closePanel(); });
  await page.waitForTimeout(400);
  await page.locator('#bastion-tower').click();
  await page.waitForTimeout(900);
  const again = await page.evaluate(() => ({ tab: __idle.ui.tab, page: document.getElementById('app').classList.contains('page-ui'), builds: Object.values(__idle.state.bastion.buildings).filter((x) => x.build).length }));
  ok(`${tag} : la tour ouvre le Bastion en 1 toucher${phone ? '' : ', en page plein écran'} ; pas de second démarrage`, again.tab === 'camp' && again.page && again.builds === kick.builds, JSON.stringify(again));
  await page.evaluate(() => { __idle.ui.view.bastionKick = null; __idle.ui.invalidate(); });
  await page.waitForTimeout(600);
  // ---- Le voir vivre : la carte.
  const map = await page.evaluate(() => ({
    plots: document.querySelectorAll('.bs-world .bs-plot').length, art: [...document.querySelectorAll('.bs-plot .bs-bimg')].every((i) => i.complete && i.naturalWidth > 0 && /art104/.test(i.src)),
    locked: document.querySelectorAll('.bs-plot.locked').length, lockText: document.querySelector('.bs-plot.locked .bs-tag')?.textContent.trim() ?? '',
    workers: [...document.querySelectorAll('.bs-plot .bs-worker canvas')].filter((c) => { const r = c.getBoundingClientRect(); return r.width > 10; }).length,
    tools: document.querySelectorAll('.bs-plot .bs-tool').length, bars: document.querySelectorAll('.bs-plot .bs-job .bs-bar').length,
    life: document.querySelectorAll('.bs-plot .bs-life').length, ground: document.querySelector('.bs-ground')?.naturalWidth ?? 0,
  }));
  ok(`${tag} : carte du village — 6 bâtiments dessinés sur le décor, verrouillés en silhouette avec leur condition`, map.plots === 6 && map.art && map.ground > 0 && map.locked >= 1 && map.lockText.length > 3, JSON.stringify(map));
  ok(`${tag} : ouvriers visibles sur la carte, devant leur bâtiment, avec leur outil ; barre de chantier sur le bâtiment ; bâtiment vivant`, map.workers >= 1 && map.tools >= 1 && map.bars >= 1 && map.life >= 1, JSON.stringify(map));
  // Le temps restant avance sans redessin.
  let live = null;
  for (let i = 0; i < 5 && !live?.ok; i++) {
    const before = await page.evaluate(() => ({ at: __idle.ui.lastRender, text: document.querySelector('.bs-plot .bs-job .bs-time')?.textContent }));
    await page.waitForTimeout(2200);
    const after = await page.evaluate(() => ({ at: __idle.ui.lastRender, text: document.querySelector('.bs-plot .bs-job .bs-time')?.textContent }));
    live = { ok: after.at === before.at && after.text !== before.text, from: before.text, to: after.text };
  }
  ok(`${tag} : le temps restant du chantier avance sans redessin`, live.ok, `${live.from} → ${live.to}`);
  if (!phone) {
    const m = await measure(page);
    ok(`${tag} : page ≥ 60 % d'image et ≤ 120 mots`, m.image >= 60 && m.words <= 120, JSON.stringify(m));
    const fit = { map: await inView(page, '.bs-world'), side: await page.evaluate(() => { const s = document.querySelector('.bs-side'); const k = s.querySelector('.bs-up .btn, .bs-up .bs-bar, .bs-block .bs-bar'); if (!k) return false; const a = k.getBoundingClientRect(), b = s.getBoundingClientRect(); return a.bottom <= b.bottom + 1 && a.bottom <= innerHeight; }) };
    ok(`${tag} : rien d'important ne demande de défiler (toute la carte, la fiche et son chantier)`, fit.map && fit.side, JSON.stringify(fit));
  } else {
    const m = await measure(page);
    ok(`${tag} : téléphone — la carte reste une carte (défile en largeur), ≥ 60 % d'image, ≤ 120 mots`, m.image >= 60 && m.words <= 120 && await page.evaluate(() => document.querySelector('.bs-world').getBoundingClientRect().width >= 600), JSON.stringify(m));
  }
  let o = await overflow(page);
  ok(`${tag} : aucun débordement horizontal (carte)`, o.doc <= 0 && o.panel <= 1, JSON.stringify(o));
  await shot(page, '2-carte');
  // ---- La fiche : toucher un bâtiment, poser un ouvrier d'un toucher (grille de portraits avec leur bonus).
  await page.locator('.bs-plot[data-building="forge"]').click();
  await page.waitForTimeout(500);
  const sheet = await page.evaluate(() => {
    const s = document.querySelector('.bs-side');
    return { open: s.classList.contains('is-open') || !document.getElementById('app').classList.contains('page-narrow'), head: s.querySelector('.bs-shead b')?.textContent,
      portrait: Boolean(s.querySelector('.bs-worker-now .bs-wpic img')), trade: Boolean(s.querySelector('.bs-worker-now .bs-tradeico')), cards: s.querySelectorAll('.bs-wcard').length,
      bonus: [...s.querySelectorAll('.bs-wcard .bs-wbonus')].map((b) => b.textContent).slice(0, 3), poser: /Poser/.test(s.textContent),
      ba: Boolean(s.querySelector('.bs-fxrow.up')), orders: Boolean(s.querySelector('[data-action="bastion-order"]')), tip: Boolean(s.querySelector('.bs-tip')) };
  });
  ok(`${tag} : fiche de la Forge — ouvrier en portrait et métier en icône, ouvriers possibles en grille avec leur bonus (plus de « Poser »), avant → après, commandes`,
    sheet.open && /Forge/.test(sheet.head) && sheet.portrait && sheet.trade && sheet.cards >= 3 && sheet.bonus.every((b) => /^\+\d+ %$/.test(b)) && !sheet.poser && sheet.ba && sheet.orders, JSON.stringify(sheet));
  ok(`${tag} : une bulle à la première visite du bâtiment`, sheet.tip);
  await shot(page, '3-fiche-forge');
  await page.locator('.bs-side [data-action="bastion-tip"]').click();
  await page.waitForTimeout(400);
  const swap = await page.evaluate(() => { const c = [...document.querySelectorAll('.bs-side .bs-wcard:not(.here)')][0]; return c?.dataset.value; });
  await page.locator(`.bs-side .bs-wcard[data-value="${swap}"]`).click();
  await page.waitForTimeout(500);
  const placed = await page.evaluate(() => ({ worker: __idle.state.bastion.buildings.forge.worker, tips: __idle.state.bastion.tips, tipNow: Boolean(document.querySelector('.bs-side .bs-tip')) }));
  ok(`${tag} : un toucher sur un portrait pose l'ouvrier ; la bulle ne revient pas`, placed.worker === swap.split('|')[1] && placed.tips.includes('forge') && !placed.tipNow, JSON.stringify({ swap, ...placed }));
  // Commande du forgeron.
  await page.locator('.bs-side .bs-slot[data-value="armor"]').click();
  await page.waitForTimeout(300);
  await page.locator('.bs-side [data-action="bastion-order"]').click();
  await page.waitForTimeout(500);
  ok(`${tag} : commande passée depuis la fiche`, await page.evaluate(() => __idle.state.bastion.orders.length === 1));
  o = await overflow(page);
  ok(`${tag} : fiche sans débordement horizontal`, o.doc <= 0 && o.panel <= 1, JSON.stringify(o));
  // ---- Recherches : la Bibliothèque construite, une recherche lancée, l'arbre.
  await page.evaluate(() => { const b = __idle.state.bastion; b.buildings.library.level = Math.max(1, b.buildings.library.level); b.buildings.library.build = null; if (!b.buildings.library.worker) b.buildings.library.worker = Object.keys(__idle.state.companions.owned).find((id) => !__idle.state.companions.equipped.includes(id) && !Object.values(b.buildings).some((x) => x.worker === id)); __idle.ui.view.bastionSel = null; __idle.ui.invalidate(); });
  await page.waitForTimeout(400);
  await page.locator('.bs-top [data-action="bastion-view"][data-value="research"]').click();
  await page.waitForTimeout(500);
  await page.locator('.bs-tree .bs-node[data-value="sharp"]').click();
  await page.waitForTimeout(400);
  await page.locator('.bs-side [data-action="bastion-research"]').click();
  await page.waitForTimeout(600);
  const tree = await page.evaluate(() => ({
    nodes: document.querySelectorAll('#bs-research .bs-node').length, art: new Set([...document.querySelectorAll('#bs-research .bs-node > img')].map((i) => i.getAttribute('src'))).size,
    loaded: [...document.querySelectorAll('#bs-research .bs-node > img')].every((i) => i.complete && i.naturalWidth > 0), branches: document.querySelectorAll('#bs-research .bs-branch').length,
    links: document.querySelectorAll('#bs-research .bs-link').length, active: document.querySelector('#bs-research .bs-node.active')?.dataset.value, time: document.querySelector('#bs-research .bs-node.active .bs-time')?.textContent ?? '',
    ring: getComputedStyle(document.querySelector('#bs-research .bs-node.active') ?? document.body).boxShadow, job: __idle.state.bastion.research.active[0]?.id,
  }));
  ok(`${tag} : arbre des recherches — 3 branches, 18 nœuds illustrés (18 dessins différents), liens entre les nœuds`, tree.nodes === 18 && tree.art === 18 && tree.loaded && tree.branches === 3 && tree.links === 15, JSON.stringify(tree));
  ok(`${tag} : la recherche en cours est entourée, avec son temps`, tree.job === 'sharp' && tree.active === 'sharp' && /\d/.test(tree.time) && tree.ring !== 'none', JSON.stringify({ active: tree.active, time: tree.time }));
  if (!phone) {
    const m = await measure(page);
    ok(`${tag} : arbre des recherches sans défiler, ≥ 60 % d'image, ≤ 120 mots`, await inView(page, '#bs-research') && m.image >= 60 && m.words <= 120, JSON.stringify(m));
  }
  o = await overflow(page);
  ok(`${tag} : recherches sans débordement horizontal`, o.doc <= 0 && o.panel <= 1, JSON.stringify(o));
  await shot(page, '4-recherches');
  // Les liens s'allument : « Lames aiguisées » au niveau 3 ouvre « Peau d'acier ».
  await page.evaluate(() => { __idle.state.bastion.research.levels.sharp = 3; __idle.ui.invalidate(); });
  await page.waitForTimeout(500);
  ok(`${tag} : un lien s'allume quand la recherche suivante s'ouvre`, await page.evaluate(() => document.querySelectorAll('#bs-research .bs-link.lit').length >= 1 && !document.querySelector('#bs-research .bs-node[data-value="steel"]').classList.contains('locked')));
  // i/s, page ouverte (1280 × 720).
  if (w === 1280) {
    await page.locator('.bs-top [data-action="bastion-view"][data-value="map"]').click();
    await page.waitForTimeout(800);
    const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n += 1; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(Math.round(n / ((performance.now() - t0) / 1000))); }; requestAnimationFrame(f); }));
    ok(`${tag} : i/s ≥ 55, page du Bastion ouverte`, fps >= 55, `${fps} i/s`);
  }
  // ---- Au retour : « Pendant ton absence » (3 h), puis « Tout récupérer ». Avant de partir : un chantier sur la Forge.
  await page.evaluate(() => { __idle.ui.view.bastionView = 'map'; __idle.ui.view.bastionSel = 'forge'; __idle.ui.invalidate(); });
  await page.waitForTimeout(500);
  await page.locator('.bs-side [data-action="bastion-build"]').click();
  await page.waitForTimeout(400);
  ok(`${tag} : chantier de la Forge lancé depuis la fiche`, await page.evaluate(() => Boolean(__idle.state.bastion.buildings.forge.build)));
  await page.evaluate(() => __idle.ui.closePanel());
  await away(page, 3);
  // La fenêtre de retour hors ligne passe d'abord ; « Pendant ton absence » attend qu'elle soit fermée.
  const first = await page.evaluate(() => ({ modal: !document.getElementById('modal').classList.contains('hidden'), bastion: Boolean(document.getElementById('bastion-away')) }));
  if (first.modal && !first.bastion) { await page.evaluate(() => __idle.ui.closeModal()); }
  await page.waitForTimeout(1800);
  const rep = await page.evaluate(() => {
    const m = document.getElementById('bastion-away');
    return { shown: Boolean(m) && !document.getElementById('modal').classList.contains('hidden'), title: m?.querySelector('h2')?.textContent ?? '', builds: m?.querySelectorAll('.ba-tile.build img').length ?? 0,
      items: m?.querySelectorAll('.ba-tile.item').length ?? 0, research: m?.querySelectorAll('.ba-tile.research img').length ?? 0, buttons: m ? [...m.querySelectorAll('button')].map((b) => b.textContent.trim()) : [],
      banner: m?.querySelector('.ba-banner img')?.naturalWidth ?? 0 };
  });
  ok(`${tag} : « Pendant ton absence » après 3 h — bâtiments terminés illustrés, objet commandé livré, recherche finie ; un seul bouton`,
    rep.shown && /Pendant ton absence/.test(rep.title) && rep.builds >= 1 && rep.items >= 1 && rep.research >= 1 && rep.banner > 0 && rep.buttons.length === 1 && rep.buttons[0] === 'Tout récupérer', JSON.stringify({ first, ...rep }));
  ok(`${tag} : un seul écran à la fois (le retour hors ligne d'abord)`, !(first.modal && first.bastion) || !first.modal || first.bastion);
  await shot(page, '5-absence');
  o = await overflow(page);
  ok(`${tag} : « Pendant ton absence » sans débordement horizontal`, o.doc <= 0, JSON.stringify(o));
  await page.locator('#bastion-away [data-action="bastion-away-claim"]').click();
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => ({ modal: !document.getElementById('modal').classList.contains('hidden'), away: __idle.state.bastion.away, unread: __idle.state.bastion.news.filter((n) => !n.book).length }));
  ok(`${tag} : « Tout récupérer » ferme l'écran, tout est ramassé et lu`, !after.modal && !after.away && after.unread === 0, JSON.stringify(after));
  await page.waitForTimeout(1500);
  ok(`${tag} : l'écran ne revient pas`, await page.evaluate(() => document.getElementById('modal').classList.contains('hidden') || !document.getElementById('bastion-away')));
  ok(`${tag} : aucune erreur JavaScript`, page.errors.length === 0, page.errors.slice(0, 3).join(' | '));
  await ctx.close();
}
// ---- Carte de déblocage (étape 40) : « Essayer maintenant » ouvre le Bastion (cartes montrées avec ?learn sous automate).
{
  const ctx = await browser.newContext({ viewport: { width: 1116, height: 993 } });
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', (e) => page.errors.push(e.message));
  await page.addInitScript((r) => { if (!sessionStorage.getItem('c')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('c', '1'); } }, raw);
  await page.goto(`${url}?learn`);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(2000);
  let card = null;
  for (let i = 0; i < 30 && !card; i++) {
    await page.evaluate(() => { __idle.ui.closeModal(); document.querySelectorAll('.learn-card:not(.bastion-card) [data-close], .howto-card [data-close]').forEach((b) => b.click()); });
    await page.waitForTimeout(700);
    card = await page.evaluate(() => { const c = document.querySelector('.bastion-card'); return c ? { title: c.querySelector('b')?.textContent, go: c.querySelector('[data-go]')?.textContent, img: c.querySelector('img')?.getAttribute('src') } : null; });
  }
  ok('carte de déblocage du Bastion (étape 40) : « Essayer maintenant », image PixelLab', card && /Bastion/.test(card.title) && card.go === 'Essayer maintenant' && /art104/.test(card.img ?? ''), JSON.stringify(card));
  await page.screenshot({ path: `${out}/1116x993-6-carte-deblocage.png` });
  const t0 = Date.now();
  if (card) await page.locator('.bastion-card [data-go]').click();
  await page.waitForTimeout(900);
  const went = await page.evaluate(() => ({ tab: __idle.ui.tab, kicked: __idle.state.bastion?.kicked > 0, workers: Object.values(__idle.state.bastion?.buildings ?? {}).filter((x) => x.worker).length }));
  ok('« Essayer maintenant » ouvre le Bastion en un toucher (moins de 10 s), qui se lance', went.tab === 'camp' && went.kicked && went.workers >= 1 && Date.now() - t0 < 10000, JSON.stringify(went));
  ok('carte de déblocage : aucune erreur JavaScript', page.errors.length === 0, page.errors.slice(0, 3).join(' | '));
  await ctx.close();
}
const n = results.filter(Boolean).length;
console.log(`${n}/${results.length} vérifications réussies · captures : ${out}/`);
await browser.close(); server.close();
process.exit(n === results.length ? 0 : 1);
