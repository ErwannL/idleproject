// v10.3 (partie 10) : test de bout en bout du Bastion, dans le navigateur, en 1116 × 993, 1280 × 720 et 390 × 844.
// L'écran s'ouvre sans erreur JavaScript ni débordement horizontal ; on pose un ouvrier, on lance un chantier et une
// commande, on ferme le jeu 3 h (horloge avancée, page rechargée), au retour le chantier est fini, la commande est dans
// le coffre de butin, le Sceau et le Carnet le disent une fois ; puis une recherche, 1 h de plus, et une commande
// restée « prête » (coffre de butin plein) qu'on récupère. Captures : dist/e2e-103-bastion/ (ou le dossier donné en argument).
// Usage : node tools/e2e-103-bastion.mjs
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const out = process.argv[2] ?? 'dist/e2e-103-bastion';
await mkdir(out, { recursive: true });
// Partie de fin de jeu, avec de quoi payer : des éclats et de l'or (les coûts suivent les revenus du joueur).
const save = JSON.parse(await readFile('tests/fixtures/endgame.json', 'utf8'));
save.materials.shards = 6000; save.materials.grimoire = 12;
save.gold = 1e60;
const raw = JSON.stringify(save);
const results = [];
const ok = (name, pass, info = '') => { results.push(pass); console.log(`${pass ? '✔' : '✘'} ${name} ${info}`); };
const HOUR = 3_600_000;

async function open(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', (e) => page.errors.push(e.message));
  await page.addInitScript((r) => { if (!sessionStorage.getItem('c')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('c', '1'); } }, raw);
  // Horloge avancée : le décalage (ms) est lu au chargement de la page.
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
// « Le jeu est fermé N heures » : sauvegarde, horloge avancée, page rechargée.
async function away(page, hours) {
  await page.evaluate((ms) => { __idle.save(); sessionStorage.setItem('skew', String(Number(sessionStorage.getItem('skew') || 0) + ms)); }, hours * HOUR);
  await boot(page);
}
const overflow = (page) => page.evaluate(() => {
  const body = document.getElementById('panel-body');
  const wide = [...body.querySelectorAll('.bastion *')].filter((e) => e.getBoundingClientRect().right > body.getBoundingClientRect().right + 1 && e.offsetParent !== null).length;
  return { doc: document.documentElement.scrollWidth - innerWidth, panel: body.scrollWidth - body.clientWidth, wide };
});
const tap = async (page, sel) => { await page.locator(sel).first().scrollIntoViewIfNeeded(); await page.locator(sel).first().click(); await page.waitForTimeout(350); };
// Téléphone : la feuille du bas couvre la liste ; on la ferme (✕) avant de toucher un autre bâtiment.
const closeSheet = async (page, w) => { if (w <= 560 && await page.locator('.bs-detail .bs-close').count()) await tap(page, '.bs-detail .bs-close'); };

for (const [w, h] of [[1116, 993], [1280, 720], [390, 844]]) {
  const tag = `${w}×${h}`;
  const shot = (page, n) => page.screenshot({ path: `${out}/${w}x${h}-${n}.png` });
  const { ctx, page } = await open(w, h);
  await page.evaluate(() => __idle.ui.openTab('camp'));
  if (w <= 560) await page.evaluate(() => { if (!__idle.ui.panelTallFor('camp')) __idle.ui.togglePanelLow(); }); // téléphone : panneau déplié (bouton ⤢)
  await page.waitForTimeout(900);
  const first = await page.evaluate(() => ({ title: document.getElementById('panel-title').textContent, cards: document.querySelectorAll('.bs-card').length, locked: document.querySelectorAll('.bs-card.locked').length,
    head: document.querySelector('.bs-head')?.textContent ?? '', idle: document.querySelector('.bs-card[data-building="forge"] .bs-idle')?.textContent ?? '' }));
  ok(`${tag} : l'écran du Bastion s'ouvre (6 bâtiments, les suivants verrouillés avec leur condition)`, /Bastion/.test(first.title) && first.cards === 6 && first.locked >= 2 && /même jeu fermé/.test(first.head), JSON.stringify(first));
  ok(`${tag} : sans ouvrier, la carte l'écrit en rouge`, /Aucun ouvrier : à l'arrêt/.test(first.idle));
  let o = await overflow(page);
  ok(`${tag} : aucun débordement horizontal`, o.doc <= 0 && o.panel <= 1 && o.wide === 0, JSON.stringify(o));
  await shot(page, '1-carte');

  // Poser un ouvrier sur la Forge (le « + » en pointillés ouvre la liste, le meilleur métier en tête).
  await tap(page, '.bs-card[data-building="forge"] .bs-medal');
  const pick = await page.evaluate(() => ({ rows: document.querySelectorAll('.bs-wlist .bs-wrow').length, top: document.querySelector('.bs-wlist .bs-wrow b')?.textContent, bonus: document.querySelector('.bs-wlist .bs-wbonus')?.textContent }));
  await tap(page, '.bs-wlist [data-action="bastion-worker"]');
  const worker = await page.evaluate(() => __idle.state.bastion.buildings.forge.worker);
  ok(`${tag} : un toucher pose l'ouvrier (forgeron en tête de liste)`, Boolean(worker) && pick.rows >= 3, JSON.stringify({ worker, ...pick }));
  // Lancer le chantier : « Améliorer : niv. 1 → 2 », effets avant → après, coût « tu as … », durée.
  const up = await page.evaluate(() => { const b = [...document.querySelectorAll('.bs-detail .bs-block')].find((x) => /Améliorer/.test(x.textContent)); return b ? { title: b.querySelector('.bs-block-title').textContent, ups: b.querySelectorAll('.bs-fxrow.up').length, have: /tu as/.test(b.textContent), dur: b.querySelector('.bs-dur')?.textContent } : null; });
  ok(`${tag} : « Améliorer : niv. 1 → 2 » montre chaque effet avant → après, le coût « tu as … » et la durée`, up && /niv\. 1 → 2/.test(up.title) && up.ups >= 3 && up.have && /Durée/.test(up.dur ?? ''), JSON.stringify(up));
  await shot(page, '2-forge');
  await tap(page, '.bs-detail [data-action="bastion-build"]');
  ok(`${tag} : chantier lancé`, await page.evaluate(() => Boolean(__idle.state.bastion.buildings.forge.build)));
  // Commande : place en icônes, rareté minimale (Légendaire+ cadenassée avant le niveau 6).
  await tap(page, '.bs-slots [data-value="armor"]');
  const tiers = await page.evaluate(() => [...document.querySelectorAll('.bs-tier')].map((t) => t.textContent.replace(/\s+/g, ' ').trim()));
  await tap(page, '.bs-detail [data-action="bastion-order"]');
  const order = await page.evaluate(() => __idle.state.bastion.orders[0]);
  ok(`${tag} : commande passée (place choisie, Rare+)`, order?.slot === 'armor' && order?.tier === 'rare' && tiers.some((t) => /Légendaire\+.*niv\. 6/.test(t)), JSON.stringify({ order: order && { slot: order.slot, tier: order.tier }, tiers }));
  // Bibliothèque : ouvrier puis construction (15 min).
  await closeSheet(page, w);
  await tap(page, '.bs-card[data-building="library"] .bs-medal');
  await tap(page, '.bs-wlist [data-action="bastion-worker"]');
  await tap(page, '.bs-detail [data-action="bastion-build"]');
  ok(`${tag} : Bibliothèque en construction`, await page.evaluate(() => Boolean(__idle.state.bastion.buildings.library.build)));
  o = await overflow(page);
  ok(`${tag} : panneau du bâtiment sans débordement`, o.doc <= 0 && o.panel <= 1 && o.wide === 0, JSON.stringify(o));
  // Les minuteurs avancent sans redessiner le panneau.
  await closeSheet(page, w);
  // (Un butin, une récompense… peuvent redessiner le panneau : on cherche une fenêtre de 2 s sans redessin.)
  let live = null;
  for (let i = 0; i < 5 && !live?.ok; i++) {
    const before = await page.evaluate(() => ({ at: __idle.ui.lastRender, text: document.querySelector('.bs-card[data-building="library"] [data-bt-end]:not(i)').textContent }));
    await page.waitForTimeout(2200);
    const after = await page.evaluate(() => ({ at: __idle.ui.lastRender, text: document.querySelector('.bs-card[data-building="library"] [data-bt-end]:not(i)').textContent }));
    live = { ok: after.at === before.at && after.text !== before.text, from: before.text, to: after.text, redrawn: after.at !== before.at };
  }
  ok(`${tag} : le temps restant se met à jour sans redessin`, live.ok, `${live.from} → ${live.to}`);
  await shot(page, '3-bibliotheque');
  // La carte avec ses ouvriers : médaillon, petit sprite devant le bâtiment, barre de chantier et temps restant.
  await page.evaluate(() => { __idle.ui.view.bastionSel = null; __idle.ui.invalidate(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { document.getElementById('panel-body').scrollTop = document.querySelector('.bs-map').offsetTop - 4; });
  await page.waitForTimeout(400);
  const posted = await page.evaluate(() => ({ medals: document.querySelectorAll('.bs-medal:not(.empty) img').length, sprites: document.querySelectorAll('.bs-worker canvas').length, tools: document.querySelectorAll('.bs-tool').length, bars: document.querySelectorAll('.bs-card .bs-bar.build').length }));
  ok(`${tag} : sur la carte, médaillon et petit ouvrier animé devant chaque bâtiment occupé, barre de chantier`, posted.medals === 2 && posted.sprites === 2 && posted.tools === 2 && posted.bars === 2, JSON.stringify(posted));
  await shot(page, '3-chantiers');

  // Jeu fermé 3 h.
  await away(page, 3);
  const back = await page.evaluate(() => { const s = __idle.state; return { forge: s.bastion.buildings.forge.level, library: s.bastion.buildings.library.level, orders: s.bastion.orders.length, chest: s.lootBag.filter((i) => i.slot === 'armor').length, news: s.bastion.news.length }; });
  ok(`${tag} : au retour (3 h), chantiers finis et commande livrée dans le coffre de butin`, back.forge === 2 && back.library === 1 && back.orders === 0 && back.chest >= 1, JSON.stringify(back));
  // Sceau : une fois par retour (les récompenses passent devant : on les récupère d'abord).
  let seal = { text: '', hidden: true };
  for (let i = 0; i < 5 && !/Commande prête|Chantier terminé/.test(seal.text); i++) {
    await page.evaluate(() => { __idle.actions.claimEverything?.(); __idle.ui.closeModal(); });
    await page.waitForTimeout(900);
    seal = await page.evaluate(() => ({ text: document.getElementById('next-action-text')?.textContent ?? '', hidden: document.getElementById('next-action')?.classList.contains('hidden') }));
  }
  ok(`${tag} : le Sceau annonce le Bastion au retour`, /Commande prête|Chantier terminé/.test(seal.text) && !seal.hidden, JSON.stringify(seal));
  // Carnet : « Le Bastion a fini … », une seule fois.
  await page.evaluate(() => __idle.ui.openTab('daybook'));
  await page.waitForTimeout(700);
  const line = await page.evaluate(() => document.querySelector('.db-bastion b')?.textContent ?? '');
  await shot(page, '4-carnet');
  await page.evaluate(() => __idle.ui.openTab('camp'));
  await page.waitForTimeout(600);
  await page.evaluate(() => __idle.ui.openTab('daybook'));
  await page.waitForTimeout(600);
  const again = await page.evaluate(() => Boolean(document.querySelector('.db-bastion')));
  ok(`${tag} : le Carnet le dit une seule fois`, /Le Bastion a fini 2 chantiers et 1 commande/.test(line) && !again, JSON.stringify({ line, again }));
  await page.waitForTimeout(1200);
  const sealAfter = await page.evaluate(() => document.getElementById('next-action-text')?.textContent ?? '');
  ok(`${tag} : le Sceau ne le redit pas`, !/Commande prête|Chantier terminé/.test(sealAfter), sealAfter);

  // Recherche : la Bibliothèque est construite.
  const modal = await page.evaluate(() => { const m = document.getElementById('modal'); const t = m.classList.contains('hidden') ? '' : (m.querySelector('h2')?.textContent ?? m.textContent.slice(0, 60)); __idle.ui.closeModal(); return t; });
  if (modal) console.log(`  (fenêtre fermée : ${modal})`);
  await page.evaluate(() => __idle.ui.openTab('camp'));
  await page.waitForTimeout(600);
  await tap(page, '.bs-res[data-value="sharp"]');
  const res = await page.evaluate(() => ({ cols: document.querySelectorAll('.bs-col').length, tiles: document.querySelectorAll('.bs-res').length, locked: document.querySelectorAll('.bs-res.locked').length, versus: /ne se perdent pas aux Renaissances/.test(document.querySelector('.bs-versus')?.textContent ?? '') }));
  await tap(page, '[data-action="bastion-research"]');
  const active = await page.evaluate(() => ({ job: __idle.state.bastion.research.active[0]?.id, green: Boolean(document.querySelector('.bs-res.active[data-value="sharp"]')) }));
  ok(`${tag} : Recherches en 3 colonnes de 6, suivantes cadenassées, différence avec les Talents écrite`, res.cols === 3 && res.tiles === 18 && res.locked === 15 && res.versus, JSON.stringify(res));
  ok(`${tag} : recherche lancée, bordée de vert`, active.job === 'sharp' && active.green, JSON.stringify(active));
  o = await overflow(page);
  ok(`${tag} : bandeau des Recherches sans débordement`, o.doc <= 0 && o.panel <= 1 && o.wide === 0, JSON.stringify(o));
  await page.evaluate(() => document.getElementById('bs-research').scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(250);
  await shot(page, '5-recherches');
  // Deuxième commande, coffre de butin plein : elle attend « prête » dans la file, puis on la récupère.
  await tap(page, '.bs-card[data-building="forge"]');
  await tap(page, '.bs-detail [data-action="bastion-order"]');
  const second = await page.evaluate(() => { const s = __idle.state; const it = s.equipment.weapon; while (s.lootBag.length < 40) s.lootBag.push({ ...structuredClone(it), id: `it${900000 + s.lootBag.length}` }); return s.bastion.orders.length; });
  ok(`${tag} : deuxième commande passée`, second === 1);
  await away(page, 2);
  const waiting = await page.evaluate(() => { const s = __idle.state; return { sharp: s.bastion.research.levels.sharp ?? 0, ready: s.bastion.orders.filter((x) => x.ready).length, chest: s.lootBag.length }; });
  ok(`${tag} : 2 h plus tard, recherche finie ; coffre de butin plein → la commande attend « prête », rien n'est perdu`, waiting.sharp === 1 && waiting.ready === 1 && waiting.chest === 40, JSON.stringify(waiting));
  await page.evaluate(() => { __idle.ui.openTab('camp'); __idle.ui.view.bastionSel = 'forge'; __idle.ui.invalidate(); });
  await page.waitForTimeout(700);
  const row = await page.evaluate(() => document.querySelector('.bs-order.ready')?.textContent.replace(/\s+/g, ' ').trim() ?? '');
  ok(`${tag} : la file l'écrit (« prête · le coffre de butin est plein », bouton Récupérer)`, /prête · le coffre de butin est plein/.test(row) && /Récupérer/.test(row), row);
  await shot(page, '6-commande-prete');
  // Une place se libère dans le coffre de butin : « Récupérer » (le pas du jeu la livrerait aussi de lui-même).
  await page.evaluate(() => { __idle.state.lootBag.length = 3; });
  await page.locator('[data-action="bastion-collect-order"]').first().click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(1200);
  const got = await page.evaluate(() => { const s = __idle.state; return { orders: s.bastion.orders.length, chest: s.lootBag.length }; });
  ok(`${tag} : la commande est récupérée dans le coffre de butin`, got.orders === 0 && got.chest === 4, JSON.stringify(got));
  // Un ouvrier mis dans l'équipe quitte son bâtiment, avec un avertissement.
  const warn = await page.evaluate(async () => {
    const s = __idle.state; const w = s.bastion.buildings.forge.worker;
    const said = []; const toast = __idle.ui.toast.bind(__idle.ui); __idle.ui.toast = (t, c) => { said.push(t); toast(t, c); };
    s.companions.equipped = s.companions.equipped.slice(0, 1);
    __idle.actions.toggleCompanion(w);
    await new Promise((r) => setTimeout(r, 1500));
    return { inTeam: s.companions.equipped.includes(w), still: s.bastion.buildings.forge.worker, toast: said.join(' | ') };
  });
  ok(`${tag} : l'ouvrier mis dans l'équipe quitte la Forge, avec un avertissement`, warn.inTeam && warn.still === null && /quitte la Forge du forgeron/.test(warn.toast), JSON.stringify(warn));
  await page.evaluate(() => { __idle.ui.openTab('camp'); __idle.ui.view.bastionSel = 'workers'; __idle.ui.invalidate(); });
  await page.waitForTimeout(600);
  await shot(page, '7-ouvriers');
  o = await overflow(page);
  ok(`${tag} : écran des ouvriers sans débordement`, o.doc <= 0 && o.panel <= 1 && o.wide === 0, JSON.stringify(o));
  ok(`${tag} : aucune erreur JavaScript`, page.errors.length === 0, page.errors.slice(0, 3).join(' | '));
  await ctx.close();
}
const n = results.filter(Boolean).length;
console.log(`${n}/${results.length} vérifications réussies · captures : ${out}/`);
await browser.close(); server.close();
process.exit(n === results.length ? 0 : 1);
