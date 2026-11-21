// v10.3 (partie 10) : test de bout en bout du Bastion, dans le navigateur, en 1116 × 993, 1280 × 720 et 390 × 844.
// L'écran s'ouvre sans erreur JavaScript ni débordement horizontal ; on pose un ouvrier, on lance un chantier et une
// commande, on ferme le jeu 3 h (horloge avancée, page rechargée), au retour le chantier est fini, la commande est dans
// le coffre de butin, le Sceau et le Carnet le disent une fois ; puis une recherche, 1 h de plus, et une commande
// restée « prête » (coffre de butin plein) qu'on récupère. v10.4 (partie 6) : même parcours sur la page du Bastion
// (carte du village, fiche à droite ou feuille du bas) ; le démarrage automatique pose les ouvriers à la première
// ouverture (vérifié en détail par tools/e2e-1040-bastion.mjs). Captures : dist/e2e-103-bastion/ (ou le dossier donné en argument).
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
  // (la carte du village défile en largeur sur téléphone : ce qui est dans son cadre défilant ne compte pas)
  const wide = [...body.querySelectorAll('.bastion *')].filter((e) => !e.closest('.bs-village') && e.getBoundingClientRect().right > body.getBoundingClientRect().right + 1 && e.offsetParent !== null).length;
  return { doc: document.documentElement.scrollWidth - innerWidth, panel: body.scrollWidth - body.clientWidth, wide };
});
const tap = async (page, sel) => { await page.evaluate(() => { if (document.querySelector('#modal:not(.hidden) #bastion-away')) __idle.ui.closeModal(); }); await page.locator(sel).first().scrollIntoViewIfNeeded(); /* v10.4 : « Pendant ton absence » passe d'abord */ await page.locator(sel).first().click(); await page.waitForTimeout(350); };
// Téléphone : la feuille du bas couvre la liste ; on la ferme (✕) avant de toucher un autre bâtiment.
// (le panneau peut être redessiné pendant le toucher : on réessaie)
const closeSheet = async (page, w) => { for (let i = 0; i < 3 && w <= 560 && await page.locator('.bs-side.is-open .bs-close').count(); i++) await tap(page, '.bs-side.is-open .bs-close').catch(() => {}); };
// v10.4 : la carte (et pas l'arbre des recherches) ; un bâtiment s'ouvre d'un toucher ; un portrait pose l'ouvrier.
const toMap = (page) => page.evaluate(() => { __idle.ui.view.bastionView = 'map'; __idle.ui.view.bastionKick = null; __idle.ui.invalidate(); });
const placeFirst = async (page, id) => { await tap(page, `.bs-plot[data-building="${id}"]`); await tap(page, '.bs-side .bs-wcard:not(.here):not(.busy)'); };

for (const [w, h] of [[1116, 993], [1280, 720], [390, 844]]) {
  const tag = `${w}×${h}`;
  const shot = (page, n) => page.screenshot({ path: `${out}/${w}x${h}-${n}.png` });
  const { ctx, page } = await open(w, h);
  await page.evaluate(() => __idle.ui.openTab('camp'));
  if (w <= 560) await page.evaluate(() => { if (!__idle.ui.panelTallFor('camp')) __idle.ui.togglePanelLow(); }); // téléphone : panneau déplié (bouton ⤢)
  await page.waitForTimeout(900);
  await toMap(page);
  await page.waitForTimeout(400);
  const first = await page.evaluate(() => ({ title: document.getElementById('panel-title').textContent, cards: document.querySelectorAll('.bs-plot').length, locked: document.querySelectorAll('.bs-plot.locked').length,
    lock: document.querySelector('.bs-plot.locked .bs-tag')?.textContent ?? '', kicked: __idle.state.bastion.kicked > 0 }));
  ok(`${tag} : l'écran du Bastion s'ouvre (6 bâtiments, les suivants verrouillés avec leur condition)`, /Bastion/.test(first.title) && first.cards === 6 && first.locked >= 2 && /Après|Étape|Bastion niv/.test(first.lock) && first.kicked, JSON.stringify(first));
  // Le démarrage a posé la Forge et la Bibliothèque ; on retire l'ouvrier de la Forge : la carte le signale en rouge.
  await page.evaluate(() => __idle.actions.bastion('worker', 'forge', null));
  await page.waitForFunction(() => document.querySelector('.bs-plot[data-building="forge"] .bs-need'), null, { timeout: 4000 }).catch(() => {});
  const idle = await page.evaluate(() => ({ need: Boolean(document.querySelector('.bs-plot[data-building="forge"] .bs-need')), title: document.querySelector('.bs-plot[data-building="forge"] .bs-need')?.title ?? '' }));
  ok(`${tag} : sans ouvrier, la carte l'écrit en rouge`, idle.need && /Aucun ouvrier : à l'arrêt/.test(idle.title), JSON.stringify(idle));
  let o = await overflow(page);
  ok(`${tag} : aucun débordement horizontal`, o.doc <= 0 && o.panel <= 1 && o.wide === 0, JSON.stringify(o));
  await shot(page, '1-carte');

  // Poser un ouvrier sur la Forge : la fiche montre les portraits (le meilleur métier en tête) ; un toucher le pose.
  await tap(page, '.bs-plot[data-building="forge"]');
  const pick = await page.evaluate(() => ({ rows: document.querySelectorAll('.bs-side .bs-wcard').length, top: document.querySelector('.bs-side .bs-wcard')?.title, bonus: document.querySelector('.bs-side .bs-wcard .bs-wbonus')?.textContent }));
  await tap(page, '.bs-side .bs-wcard:not(.busy)');
  const worker = await page.evaluate(() => __idle.state.bastion.buildings.forge.worker);
  ok(`${tag} : un toucher pose l'ouvrier (forgeron en tête de liste)`, Boolean(worker) && pick.rows >= 3 && /Forgeron/.test(pick.top), JSON.stringify({ worker, ...pick }));
  // Lancer le chantier : « Améliorer : niv. 1 → 2 », effets avant → après, coût « tu as … », durée.
  const up = await page.evaluate(() => { const b = [...document.querySelectorAll('.bs-side .bs-block')].find((x) => /Améliorer/.test(x.textContent)); return b ? { title: b.querySelector('.bs-block-title').textContent, ups: b.querySelectorAll('.bs-fxrow.up').length, have: [...b.querySelectorAll('.bs-cost')].every((c) => /^tu as /.test(c.title)), dur: b.querySelector('.bs-dur')?.textContent } : null; });
  ok(`${tag} : « Améliorer : niv. 1 → 2 » montre chaque effet avant → après, le coût « tu as … » et la durée`, up && /niv\. 1 → 2/.test(up.title) && up.ups >= 3 && up.have && /\d+ min/.test(up.dur ?? ''), JSON.stringify(up));
  await shot(page, '2-forge');
  await tap(page, '.bs-side [data-action="bastion-build"]');
  ok(`${tag} : chantier lancé`, await page.evaluate(() => Boolean(__idle.state.bastion.buildings.forge.build)));
  // Commande : place en icônes, rareté minimale (Légendaire+ cadenassée avant le niveau 6).
  await tap(page, '.bs-slots [data-value="armor"]');
  const tiers = await page.evaluate(() => [...document.querySelectorAll('.bs-tier')].map((t) => t.textContent.replace(/\s+/g, ' ').trim()));
  await tap(page, '.bs-side [data-action="bastion-order"]');
  const order = await page.evaluate(() => __idle.state.bastion.orders[0]);
  ok(`${tag} : commande passée (place choisie, Rare+)`, order?.slot === 'armor' && order?.tier === 'rare' && tiers.some((t) => /Légendaire\+.*niv\. 6/.test(t)), JSON.stringify({ order: order && { slot: order.slot, tier: order.tier }, tiers }));
  // Bibliothèque : le démarrage y a posé un ouvrier et lancé sa construction (chantier offert, 15 min).
  await closeSheet(page, w);
  await tap(page, '.bs-plot[data-building="library"]');
  ok(`${tag} : Bibliothèque en construction`, await page.evaluate(() => Boolean(__idle.state.bastion.buildings.library.build && __idle.state.bastion.buildings.library.worker && document.querySelector('.bs-side .bs-bar.build'))));
  o = await overflow(page);
  ok(`${tag} : panneau du bâtiment sans débordement`, o.doc <= 0 && o.panel <= 1 && o.wide === 0, JSON.stringify(o));
  // Les minuteurs avancent sans redessiner le panneau.
  await closeSheet(page, w);
  // (Un butin, une récompense… peuvent redessiner le panneau : on cherche une fenêtre de 2 s sans redessin.)
  let live = null;
  for (let i = 0; i < 5 && !live?.ok; i++) {
    const before = await page.evaluate(() => ({ at: __idle.ui.lastRender, text: document.querySelector('.bs-plot[data-building="library"] .bs-time[data-bt-end]').textContent }));
    await page.waitForTimeout(2200);
    const after = await page.evaluate(() => ({ at: __idle.ui.lastRender, text: document.querySelector('.bs-plot[data-building="library"] .bs-time[data-bt-end]').textContent }));
    live = { ok: after.at === before.at && after.text !== before.text, from: before.text, to: after.text, redrawn: after.at !== before.at };
  }
  ok(`${tag} : le temps restant se met à jour sans redessin`, live.ok, `${live.from} → ${live.to}`);
  await shot(page, '3-bibliotheque');
  // La carte avec ses ouvriers : médaillon, petit sprite devant le bâtiment, barre de chantier et temps restant.
  await page.evaluate(() => { __idle.ui.view.bastionSel = null; __idle.ui.invalidate(); });
  await page.waitForTimeout(500);
  await page.waitForTimeout(400);
  const posted = await page.evaluate(() => ({ sprites: document.querySelectorAll('.bs-plot .bs-worker canvas').length, tools: document.querySelectorAll('.bs-plot .bs-tool').length, bars: document.querySelectorAll('.bs-plot .bs-bar.build').length,
    named: [...document.querySelectorAll('.bs-plot .bs-worker')].every((x) => x.title.length > 1) }));
  ok(`${tag} : sur la carte, petit ouvrier animé (avec son nom) devant chaque bâtiment occupé, barre de chantier`, posted.sprites === 2 && posted.tools === 2 && posted.bars === 2 && posted.named, JSON.stringify(posted));
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
  await tap(page, '.bs-top [data-action="bastion-view"][data-value="research"]');
  await tap(page, '#bs-research .bs-node[data-value="sharp"]');
  const res = await page.evaluate(() => ({ cols: document.querySelectorAll('#bs-research .bs-branch').length, tiles: document.querySelectorAll('#bs-research .bs-node').length, locked: document.querySelectorAll('#bs-research .bs-node.locked').length, versus: /Gardées après les Renaissances/.test(document.querySelector('.bs-versus')?.textContent ?? '') }));
  await tap(page, '[data-action="bastion-research"]');
  const active = await page.evaluate(() => ({ job: __idle.state.bastion.research.active[0]?.id, green: Boolean(document.querySelector('#bs-research .bs-node.active[data-value="sharp"]')) }));
  ok(`${tag} : Recherches en 3 branches de 6, suivantes cadenassées, différence avec les Talents écrite`, res.cols === 3 && res.tiles === 18 && res.locked === 15 && res.versus, JSON.stringify(res));
  ok(`${tag} : recherche lancée, bordée de vert`, active.job === 'sharp' && active.green, JSON.stringify(active));
  o = await overflow(page);
  ok(`${tag} : bandeau des Recherches sans débordement`, o.doc <= 0 && o.panel <= 1 && o.wide === 0, JSON.stringify(o));
  await page.evaluate(() => document.getElementById('bs-research').scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(250);
  await shot(page, '5-recherches');
  // Deuxième commande, coffre de butin plein : elle attend « prête » dans la file, puis on la récupère.
  await toMap(page);
  await page.waitForTimeout(300);
  await closeSheet(page, w);
  await tap(page, '.bs-plot[data-building="forge"]');
  await tap(page, '.bs-side [data-action="bastion-order"]');
  const second = await page.evaluate(() => { const s = __idle.state; const it = s.equipment.weapon; while (s.lootBag.length < 40) s.lootBag.push({ ...structuredClone(it), id: `it${900000 + s.lootBag.length}` }); return s.bastion.orders.length; });
  ok(`${tag} : deuxième commande passée`, second === 1);
  await away(page, 2);
  const waiting = await page.evaluate(() => { const s = __idle.state; return { sharp: s.bastion.research.levels.sharp ?? 0, ready: s.bastion.orders.filter((x) => x.ready).length, chest: s.lootBag.length }; });
  ok(`${tag} : 2 h plus tard, recherche finie ; coffre de butin plein → la commande attend « prête », rien n'est perdu`, waiting.sharp === 1 && waiting.ready === 1 && waiting.chest === 40, JSON.stringify(waiting));
  await page.evaluate(() => { __idle.ui.closeModal(); __idle.ui.openTab('camp'); __idle.ui.view.bastionView = 'map'; __idle.ui.view.bastionSel = 'forge'; __idle.ui.invalidate(); });
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
  await page.evaluate(() => { __idle.ui.openTab('camp'); __idle.ui.view.bastionView = 'map'; __idle.ui.view.bastionSel = 'forge'; __idle.ui.invalidate(); }); // v10.4 : les ouvriers en grille dans la fiche
  await page.waitForTimeout(600);
  await shot(page, '7-ouvriers');
  o = await overflow(page);
  ok(`${tag} : écran des ouvriers sans débordement`, o.doc <= 0 && o.panel <= 1 && o.wide === 0, JSON.stringify(o));
  // ---- v10.3.1 : Mine de cristal, Camp d'entraînement, Comptoir, Expéditions, clavier et lexique.
  // État préparé : bâtiments construits (niveau 2), un stock prêt à récupérer, de quoi échanger ; les ouvriers se posent d'un toucher.
  await page.evaluate(() => {
    const s = __idle.state; const b = s.bastion;
    for (const id of ['forge', 'library', 'mine', 'training', 'trade']) b.buildings[id].level = Math.max(b.buildings[id].level, 2);
    b.stock.mine = 40; b.stock.training = 99; // (le plafond du Camp au niveau 2 limite le stock à 1 grimoire)
    s.materials.shards = 6000; s.materials.grimoire = 5; s.companions.equipped = s.companions.equipped.slice(0, 2);
    __idle.ui.view.bastionSel = null; __idle.ui.view.bastionView = 'map'; __idle.ui.openTab('camp'); __idle.ui.invalidate();
  });
  await page.waitForTimeout(700);
  for (const id of ['mine', 'training', 'trade']) {
    await closeSheet(page, w);
    await placeFirst(page, id);
  }
  const placed = await page.evaluate(() => ['mine', 'training', 'trade'].map((id) => Boolean(__idle.state.bastion.buildings[id].worker)));
  ok(`${tag} : ouvriers posés sur la Mine, le Camp d'entraînement et le Comptoir`, placed.every(Boolean), JSON.stringify(placed));
  const mat = (k) => page.evaluate((key) => __idle.state.materials[key], k);
  // Mine de cristal : la carte s'ouvre, la production est écrite, « Récupérer » verse le stock en éclats.
  await closeSheet(page, w);
  await tap(page, '.bs-plot[data-building="mine"]');
  const mine = await page.evaluate(() => ({ head: document.querySelector('.bs-side .bs-shead b')?.textContent, block: document.querySelector('.bs-side .bs-stock')?.textContent.replace(/\s+/g, ' ').trim(), perHour: document.querySelector('.bs-side')?.textContent.match(/([\d,]+) éclats par heure/)?.[1] }));
  const shardsBefore = await mat('shards');
  await shot(page, '8-mine');
  await tap(page, '.bs-side [data-action="bastion-collect"]');
  const shardsAfter = await mat('shards');
  ok(`${tag} : Mine de cristal — production écrite, « Récupérer » verse le stock en éclats`, /Mine de cristal/.test(mine.head) && Boolean(mine.perHour) && shardsAfter - shardsBefore >= 40, JSON.stringify({ ...mine, gain: shardsAfter - shardsBefore }));
  o = await overflow(page);
  ok(`${tag} : Mine de cristal sans débordement`, o.doc <= 0 && o.panel <= 1 && o.wide === 0, JSON.stringify(o));
  // Camp d'entraînement : des grimoires.
  await closeSheet(page, w);
  await tap(page, '.bs-plot[data-building="training"]');
  const camp = await page.evaluate(() => document.querySelector('.bs-side .bs-shead b')?.textContent);
  const gBefore = await mat('grimoire');
  await shot(page, '9-camp-entrainement');
  await tap(page, '.bs-side [data-action="bastion-collect"]');
  const gAfter = await mat('grimoire');
  ok(`${tag} : Camp d'entraînement — « Récupérer » verse les grimoires`, /Camp d'entraînement/.test(camp) && gAfter - gBefore >= 1, `${camp} +${gAfter - gBefore}`);
  o = await overflow(page);
  ok(`${tag} : Camp d'entraînement sans débordement`, o.doc <= 0 && o.panel <= 1 && o.wide === 0, JSON.stringify(o));
  // Comptoir : six échanges, taux, limite du jour ; un échange réel.
  await closeSheet(page, w);
  await tap(page, '.bs-plot[data-building="trade"]');
  const post = await page.evaluate(() => ({ head: document.querySelector('.bs-side .bs-shead b')?.textContent, rows: document.querySelectorAll('.bs-side .bs-trade').length, left: document.querySelector('.bs-side')?.textContent.match(/(\d+) échanges? aujourd/)?.[1] }));
  const before = { shards: await mat('shards'), grimoire: await mat('grimoire') };
  await shot(page, '10-comptoir');
  await tap(page, '.bs-side [data-action="bastion-trade"][data-value="buy-grimoire"]');
  const after = { shards: await mat('shards'), grimoire: await mat('grimoire'), left: await page.evaluate(() => document.querySelector('.bs-side')?.textContent.match(/(\d+) échanges? aujourd/)?.[1]) };
  ok(`${tag} : Comptoir — 6 offres, un échange verse 1 grimoire contre des éclats et réduit la limite du jour`, /Comptoir/.test(post.head) && post.rows === 6 && after.grimoire === before.grimoire + 1 && after.shards < before.shards && Number(after.left) === Number(post.left) - 1,
    JSON.stringify({ post, before, after }));
  o = await overflow(page);
  ok(`${tag} : Comptoir sans débordement`, o.doc <= 0 && o.panel <= 1 && o.wide === 0, JSON.stringify(o));
  // Expéditions : le bâtiment reprend l'écran des expéditions.
  await closeSheet(page, w);
  await tap(page, '.bs-plot[data-building="expeditions"]');
  const exp = await page.evaluate(() => ({ head: document.querySelector('.bs-side .bs-shead b')?.textContent, embed: document.querySelector('.bs-side .bs-embed')?.textContent.replace(/\s+/g, ' ').trim().length ?? 0, buttons: document.querySelectorAll('.bs-side .bs-embed button').length }));
  await shot(page, '11-expeditions');
  ok(`${tag} : Expéditions — le bâtiment ouvre l'écran des expéditions`, /Expéditions/.test(exp.head) && exp.embed > 80 && exp.buttons >= 1, JSON.stringify(exp));
  o = await overflow(page);
  ok(`${tag} : Expéditions sans débordement`, o.doc <= 0 && o.panel <= 1 && o.wide === 0, JSON.stringify(o));
  // Clavier : les bâtiments sont des boutons ; Entrée et Espace les ouvrent, le focus se voit, Espace ne touche pas l'avance automatique.
  await closeSheet(page, w);
  await page.evaluate(() => { __idle.ui.view.bastionSel = null; __idle.ui.invalidate(); });
  await page.waitForTimeout(500);
  const auto0 = await page.evaluate(() => __idle.state.autoAdvance);
  // Au clavier : on arrive sur la carte avec Tab (la mise au point par la souris ne montre pas de contour).
  await page.locator('.bs-plot[data-building="mine"]').focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  const ring = await page.evaluate(() => { const c = getComputedStyle(document.activeElement); return { cls: document.activeElement.className, width: parseFloat(c.outlineWidth), style: c.outlineStyle, color: c.outlineColor }; });
  ok(`${tag} : un bâtiment de la carte au clavier a un contour visible`, /bs-plot/.test(ring.cls) && ring.width >= 2 && ring.style !== 'none', JSON.stringify(ring));
  await shot(page, '12-clavier-focus');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(450);
  const viaEnter = await page.evaluate(() => document.querySelector('.bs-side')?.dataset.sel);
  await closeSheet(page, w);
  await page.evaluate(() => { __idle.ui.view.bastionSel = null; __idle.ui.invalidate(); });
  await page.waitForTimeout(450);
  await page.locator('.bs-plot[data-building="training"]').focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await page.waitForTimeout(450);
  const viaSpace = await page.evaluate(() => ({ sel: document.querySelector('.bs-side')?.dataset.sel, auto: __idle.state.autoAdvance }));
  ok(`${tag} : Entrée ouvre la Mine, Espace ouvre le Camp d'entraînement (sans changer l'avance automatique)`, viaEnter === 'mine' && viaSpace.sel === 'training' && viaSpace.auto === auto0, JSON.stringify({ viaEnter, viaSpace, auto0 }));
  // Lexique : « Mots du Bastion » (au bas de la fiche) — Bastion, Ouvrier, Chantier, Recherche ouvrent une carte d'explication.
  await page.evaluate(() => { __idle.ui.view.bastionSel = 'forge'; __idle.ui.invalidate(); });
  await page.waitForTimeout(450);
  const words = [];
  for (const word of ['Bastion', 'Ouvrier', 'Chantier', 'Recherche']) {
    await page.locator(`.bs-word[data-lex="${word}"]`).scrollIntoViewIfNeeded();
    await page.locator(`.bs-word[data-lex="${word}"]`).click();
    await page.waitForTimeout(300);
    words.push(await page.evaluate((wd) => { const m = document.getElementById('modal'); const ok2 = !m.classList.contains('hidden') && m.querySelector('.gloss-card h2')?.textContent === wd && m.querySelector('.gloss-card p')?.textContent.length > 40; __idle.ui.closeModal(); return ok2; }, word));
  }
  ok(`${tag} : le lexique du Bastion ouvre sa carte (Bastion, Ouvrier, Chantier, Recherche)`, words.every(Boolean), JSON.stringify(words));
  await page.locator('.bs-words').scrollIntoViewIfNeeded();
  await shot(page, '13-lexique');
  ok(`${tag} : aucune erreur JavaScript`, page.errors.length === 0, page.errors.slice(0, 3).join(' | '));
  await ctx.close();
}
const n = results.filter(Boolean).length;
console.log(`${n}/${results.length} vérifications réussies · captures : ${out}/`);
await browser.close(); server.close();
process.exit(n === results.length ? 0 : 1);
