// Test de bout en bout dans un vrai navigateur (Chromium via Playwright).
// Vérifie les critères d'acceptation du prototype et enregistre des captures.
// Prérequis : Playwright installé (`npm i -D playwright && npx playwright install chromium`).
// Usage : npm run smoke [-- dossier-captures]
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { startServer } from './serve.mjs';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Playwright introuvable : npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const outDir = resolve(process.argv[2] ?? 'docs/screenshots');
await mkdir(outDir, { recursive: true });

const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 400, height: 250 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✔ ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.log(`  ✘ ${name}\n      ${error.message}`);
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const game = (fn, arg) => page.evaluate(fn, arg);
// v9.1.0 : les panneaux sont regroupés en 4 menus (barre verticale) avec des onglets : clic sur le menu,
// puis sur le sous-onglet ; un clic sur le sous-onglet déjà ouvert referme le panneau (comme avant sur l'onglet).
async function clickTab(tab) {
  const open = await game((t) => __idle.ui.tab === t, tab);
  if (open) { await page.click('#panel-close'); return; }
  await game((t) => __idle.ui.openTab(t), tab);
}
const waitFor = (fn, timeout = 20000, arg) => page.waitForFunction(fn, arg, { timeout, polling: 100 });
function shiftSaveOnNextLoad(deltaMs, flag) {
  return page.addInitScript(([delta, name]) => {
    if (sessionStorage.getItem(name)) return;
    sessionStorage.setItem(name, '1');
    const raw = JSON.parse(localStorage.getItem('idle-rpg.save'));
    raw.lastSaved += delta;
    localStorage.setItem('idle-rpg.save', JSON.stringify(raw));
  }, [deltaMs, flag]);
}

// v9.3.4 : la popup d'objet est modale ; on la ferme avant de toucher le sac.
async function closePop() { await game(() => { if (__idle.ui.view.sheetOpen) { __idle.ui.view.sheetOpen = null; __idle.ui.renderPanel(__idle.state); } }); await page.waitForTimeout(100); }

console.log(`Test de fumée sur ${url}`);
await page.goto(url);

await check('le jeu démarre et affiche la scène de combat', async () => {
  await waitFor(() => window.__idle && document.querySelector('#scene').width > 0, 5000);
  const size = await game(() => [document.querySelector('#scene').width, document.querySelector('#scene').height]);
  assert(size[0] >= 120 && size[1] >= 78, `canvas ${size}`);
});

await check('le héros attaque automatiquement, les ennemis meurent et donnent de l’or', async () => {
  await waitFor(() => __idle.state.records.kills >= 2 && __idle.state.gold > 0);
  await page.screenshot({ path: `${outDir}/compact-combat.png` });
});

await check('acheter une amélioration avec l’or', async () => {
  await game(() => { __idle.state.gold += 500; });
  await clickTab('upgrades');
  const before = await game(() => __idle.state.upgrades.damage);
  await page.click('[data-action="buy"][data-key="damage"]');
  const after = await game(() => __idle.state.upgrades.damage);
  assert(after === before + 1, `niveau ${before} -> ${after}`);
  await page.screenshot({ path: `${outDir}/compact-upgrades.png` });
});

await check('ouvrir l’inventaire, équiper un objet et voir les stats changer', async () => {
  // v9.0.6 : un objet que toutes les classes portent (une arme peut être réservée à une autre classe).
  const item = await game(() => __idle.addItem('iron_helm', 'epic', 3));
  await clickTab('inventory');
  await closePop();
  await page.click(`.inv-grid [data-id="${item.id}"]`);
  await page.waitForSelector('.item-pop');
  const before = await game(() => JSON.stringify(__idle.state.equipment));
  await page.screenshot({ path: `${outDir}/compact-inventory.png` });
  await page.click(`.item-pop [data-action="equip"]`);
  const equipped = await game((id) => Object.values(__idle.state.equipment).some((i) => i && i.id === id), item.id);
  const after = await game(() => JSON.stringify(__idle.state.equipment));
  assert(equipped && before !== after, 'objet non équipé');
  await closePop();
  await page.click(`.inv-equip [data-id="${item.id}"]`);
  await page.waitForSelector('.item-pop');
  const text = await page.textContent('.item-pop');
  assert(/équipé|porté/i.test(text), 'détail équipé absent');
  assert(await page.$(`.inv-equip [data-id="${item.id}"] .eq`), 'marque « équipé » absente');
});

await check('recycler un objet contre de l’or', async () => {
  const item = await game(() => __idle.addRandomItem('rare'));
  await closePop();
  await page.click(`.inv-grid [data-id="${item.id}"]`);
  const gold = await game(() => __idle.state.gold);
  await page.click('.item-pop [data-action="recycle"]');
  const after = await game(() => __idle.state.gold);
  const still = await game((id) => __idle.state.inventory.some((i) => i.id === id), item.id);
  assert(after > gold && !still, `or ${gold} -> ${after}`);
});

await check('onglets avec icône et état actif distinct', async () => {
  // v9.0.6 : 6 menus en barre verticale ; le menu du panneau ouvert est actif, ses sous-onglets en haut du panneau.
  const tabs = await game(() => [...document.querySelectorAll('#tabs button')].map((b) => ({
    menu: b.dataset.menu, icon: b.querySelector('img')?.naturalWidth > 0, active: b.classList.contains('active'),
    hidden: b.classList.contains('hidden'),
  })));
  // v9.1.0 : 4 menus (Héros, Aventure, Équipe, Objectifs). En début de partie, Équipe est encore caché.
  assert(tabs.length === 4 && tabs.every((t) => t.icon), JSON.stringify(tabs));
  assert(tabs.filter((t) => t.active).map((t) => t.menu).join() === 'hero', JSON.stringify(tabs));
  const hidden = await game(() => Object.entries(__idle.ui.tabVisible).filter(([, v]) => v === false).map(([k]) => k).sort().join());
  assert(hidden.includes('tree') && hidden.includes('dungeons') && hidden.includes('tower'), `onglets cachés : ${hidden}`);
  // Le bouton « Prochaine action » est là et propose une seule chose.
  const next = await page.textContent('#next-action');
  assert(next.trim().length > 3, `prochaine action : ${next}`);
});

await check('filtres par type et tri par niveau', async () => {
  await game(() => { __idle.addItem('iron_helm', 'common', 1); __idle.addItem('dagger', 'common', 7); });
  await game(() => __idle.ui.openTab('inventory')); await closePop();
  await page.click('[data-action="filter"][data-value="weapon"]'); // v9.1.3 : filtre en icônes
  await page.waitForTimeout(150);
  const slots = await game(() => [...document.querySelectorAll('.inv-grid [data-id]')]
    .map((el) => __idle.state.inventory.find((i) => i.id === el.dataset.id)?.slot));
  assert(slots.length > 0 && slots.every((s) => s === 'weapon'), JSON.stringify(slots));
  await page.selectOption('[data-action="sort"]', 'level');
  await page.waitForTimeout(150);
  const levels = await game(() => [...document.querySelectorAll('.inv-grid [data-id]')]
    .map((el) => __idle.state.inventory.find((i) => i.id === el.dataset.id).level));
  assert(levels.every((l, i) => i === 0 || levels[i - 1] >= l), JSON.stringify(levels));
  await page.click('[data-action="filter"][data-value="all"]');
  await page.waitForTimeout(150);
});

await check('recyclage groupé : confirmation et objets protégés', async () => {
  const ids = await game(() => {
    __idle.state.inventory = [];
    const helm = __idle.addItem('iron_helm', 'epic', 1);
    __idle.actions.equip(helm.id);
    const weak = __idle.addItem('leather_hood', 'common', 1);
    const weakRare = __idle.addItem('leather_hood', 'rare', 1);
    const epic = __idle.addItem('leather_hood', 'epic', 1);
    __idle.state.equipment.armor = null;
    const upgrade = __idle.addItem('chainmail', 'common', 1);
    return { weak: weak.id, weakRare: weakRare.id, epic: epic.id, upgrade: upgrade.id };
  });
  await page.waitForTimeout(150);
  await game(() => __idle.ui.openTab('inventory')); await closePop();
  // v9.3.4 : Builds et réglages du sac derrière ⚙.
  if (!(await page.$('[data-action="bulk-rarity"]')) && !(await page.$('[data-value="bag-settings"]'))) await page.click('[data-action="bag-menu"]');
  await page.waitForTimeout(150);
  // v9.1.0 : le recyclage en lot est dans « Réglages du sac » (replié).
  if (!(await page.$('[data-action="bulk-rarity"]'))) await page.click('[data-action="toggle-section"][data-value="bag-settings"]');
  await page.waitForTimeout(150);
  // v9.1.3 : « Recycler en lot » est un repli des réglages du sac.
  if (!(await page.$('[data-action="bulk-rarity"]'))) await page.click('[data-action="toggle-section"][data-value="bag-lot"]');
  await page.waitForTimeout(150);
  await page.selectOption('[data-action="bulk-rarity"]', 'rare');
  await page.click('[data-action="bulk-recycle"]');
  await page.waitForTimeout(150);
  const armed = await page.textContent('[data-action="bulk-recycle"]');
  assert(armed.includes('Confirmer'), armed);
  const kept = await game((w) => __idle.state.inventory.some((i) => i.id === w), ids.weak);
  assert(kept, 'recyclé sans confirmation');
  await page.click('[data-action="bulk-recycle"]');
  const left = await game(() => __idle.state.inventory.map((i) => i.id));
  assert(!left.includes(ids.weak) && !left.includes(ids.weakRare), `restants ${left}`);
  assert(left.includes(ids.epic) && left.includes(ids.upgrade), `objets protégés recyclés : ${left}`);
});

await check('un boss apparaît au palier et donne une récompense', async () => {
  await game(() => {
    __idle.state.upgrades.damage = 120;
    __idle.state.upgrades.vitality = 60;
    __idle.state.maxStage = Math.max(__idle.state.maxStage, 20);
    __idle.state.autoAdvance = false;
  });
  await clickTab('campaign');
  await page.click('.stage-grid [data-stage="20"]'); // méga boss du monde 1 (pouvoir ancestral)
  await waitFor(() => __idle.world.enemies.some((e) => e.boss), 10000);
  await page.click('#panel-close');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/compact-boss.png` });
  const found = await game(() => __idle.state.records.itemsFound);
  await waitFor(() => __idle.state.records.bossesDefeated >= 1, 20000);
  const after = await game(() => __idle.state.records.itemsFound);
  assert(after > found, 'aucun objet garanti');
});

await check('pouvoir ancestral : débloqué au premier boss et affiché dans le Codex', async () => {
  const entry = await game(() => __idle.state.powers.slime_king);
  assert(entry && entry.current, 'aucun pouvoir débloqué');
  await waitFor(() => __idle.ui.tabVisible['boss'] !== false, 3000);
  await clickTab('boss');
  await page.waitForTimeout(200);
  const text = await page.textContent('#panel-body');
  assert(text.includes('Roi Gluant') && text.includes('Pouvoir actuel'), text.slice(0, 200));
});

await check('changer de pouvoir exige de réaffronter le boss', async () => {
  await game(() => { __idle.state.powers.slime_king.pending = null; __idle.state.powers.slime_king.charges = 0; });
  await page.waitForTimeout(1200);
  const disabled = await page.$eval('[data-action="reroll"][data-boss="slime_king"]', (b) => b.disabled);
  assert(disabled, 'relance possible sans nouvelle victoire');
  const victories = await game(() => __idle.state.powers.slime_king.victories);
  await page.click('[data-action="rechallenge"][data-boss="slime_king"]');
  await waitFor((v) => __idle.state.powers.slime_king.victories > v, 30000, victories);
  const charges = await game(() => __idle.state.powers.slime_king.charges);
  assert(charges === 1, `charges ${charges}`);
  if (await page.$('#panel.hidden')) await clickTab('boss');
  await page.waitForTimeout(1200);
  const enabled = await page.$eval('[data-action="reroll"][data-boss="slime_king"]', (b) => !b.disabled);
  assert(enabled, 'relance toujours bloquée après la victoire');
});

await check('relance : proposition, refus puis acceptation, sans écrasement automatique', async () => {
  await game(() => { __idle.state.powers.slime_king.charges = 3; });
  await page.waitForTimeout(1200);
  const before = await game(() => __idle.state.powers.slime_king.current);
  await page.click('[data-action="reroll"][data-boss="slime_king"]');
  await page.waitForSelector('.power-offer');
  const offer = await game(() => __idle.state.powers.slime_king);
  assert(offer.current === before && offer.pending && offer.pending !== before, JSON.stringify(offer));
  await page.click('[data-action="keep-power"][data-boss="slime_king"]');
  await page.waitForTimeout(150);
  const kept = await game(() => __idle.state.powers.slime_king);
  assert(kept.current === before && kept.pending === null, JSON.stringify(kept));
  await page.click('[data-action="reroll"][data-boss="slime_king"]');
  await page.waitForSelector('.power-offer');
  const proposed = await game(() => __idle.state.powers.slime_king.pending);
  await page.click('[data-action="take-power"][data-boss="slime_king"]');
  await page.waitForTimeout(150);
  const taken = await game(() => __idle.state.powers.slime_king);
  assert(taken.current === proposed && taken.pending === null, JSON.stringify(taken));
  // Une proposition en attente survit au rechargement.
  await page.click('[data-action="reroll"][data-boss="slime_king"]');
  await page.waitForSelector('.power-offer');
  await page.screenshot({ path: `${outDir}/compact-codex-offer.png` });
  const pending = await game(() => __idle.state.powers.slime_king.pending);
  await page.reload();
  await waitFor(() => window.__idle, 5000);
  const after = await game(() => __idle.state.powers.slime_king);
  assert(after.pending === pending && after.current === taken.current, JSON.stringify(after));
  await game(() => __idle.actions.resolvePower('slime_king', false));
  await page.click('[data-action="close-modal"]').catch(() => {});
});

await check('verrouillage : un objet verrouillé ne peut pas être recyclé', async () => {
  const item = await game(() => __idle.addItem('dagger', 'common', 1));
  await clickTab('inventory');
  await closePop();
  await page.click(`.inv-grid [data-id="${item.id}"]`);
  await page.click('.item-pop [data-action="item-more"]'); // v9.3.4 : verrou dans le menu « ⋯ »
  await page.click('.item-pop [data-action="lock"]');
  await page.waitForTimeout(150);
  const disabled = await page.$eval('.item-pop [data-action="recycle"]', (b) => b.disabled);
  const locked = await game((id) => __idle.state.inventory.find((i) => i.id === id).locked, item.id);
  assert(locked && disabled, `verrou ${locked}, bouton désactivé ${disabled}`);
  assert(await page.$(`.inv-grid [data-id="${item.id}"] img.lock`), 'icône de verrou absente');
});

await check('compétences : un point par niveau, apprendre Tourbillon', async () => {
  await game(() => { __idle.state.level = Math.max(__idle.state.level, 6); });
  await clickTab('skills');
  await page.waitForTimeout(300);
  await page.click('[data-action="skill-sel"][data-value="s:whirl"]'); // v9.3.4 : grille + bulle
  await page.click('[data-action="learn-skill"][data-key="whirl"]');
  const level = await game(() => __idle.state.skills.whirl);
  assert(level === 1, `tourbillon ${level}`);
});

await check('invocation : 100 gemmes donnent un héros ou un compagnon', async () => { // v9.1.3 : tickets fondus
  await game(() => { __idle.state.gems = Math.max(100, __idle.state.gems); });
  await waitFor(() => __idle.ui.tabVisible.summon !== false, 3000);
  await game(() => __idle.ui.openTab('summon'));
  await page.waitForTimeout(300);
  const before = await game(() => ({ n: __idle.state.summon.total }));
  await page.click('[data-action="summon"][data-currency="gems"][data-value="1"]');
  const after = await game(() => ({ n: __idle.state.summon.total }));
  assert(after.n === before.n + 1, JSON.stringify({ before, after }));
  // Animation d'invocation : un clic révèle tout, un second ferme.
  // L'animation ne se joue que pour une nouveauté.
  if (await game(() => __idle.ui.view.lastSummon?.some((r) => r.isNew))) {
    await page.waitForSelector('.summon-fx');
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${outDir}/compact-summon-reveal.png` });
  }
  for (let i = 0; i < 2 && (await page.$('.summon-fx')); i++) await page.click('.summon-fx');
  assert(!(await page.$('.summon-fx')), 'animation d\'invocation non fermée');
  // v9.1.9 : une apparence neuve ouvre « Nouvelle apparence débloquée ! » après l'animation : « Porter maintenant » puis fermer.
  if (await page.waitForSelector('.skin-reveal', { timeout: 1500 }).catch(() => null)) {
    await page.$eval('.skin-reveal [data-sr="wear"]', (b) => b.click());
    for (let i = 0; i < 12 && (await page.$('.skin-reveal')); i++) await page.$eval('.skin-reveal [data-sr="close"]', (b) => b.click());
    assert(!(await page.$('.skin-reveal')), 'révélation d\'apparence non fermée');
  }
  await page.screenshot({ path: `${outDir}/compact-summon.png` });
});

await check('contrats et récompenses : réclamer un contrat et un coffre', async () => {
  const id = await game(() => { const c = __idle.state.contracts[0]; c.progress = c.target; return c.id; });
  await waitFor(() => __idle.ui.tabVisible.contracts !== false, 3000);
  await page.keyboard.press('m');
  await page.click('[data-action="mission-tab"][data-value="today"]');
  await page.waitForTimeout(1200);
  const gems = await game(() => __idle.state.gems);
  await page.click(`[data-action="claim-contract"][data-value="${id}"]`);
  const after = await game(() => ({ gems: __idle.state.gems, ids: __idle.state.contracts.map((c) => c.id) }));
  assert(!after.ids.includes(id) && after.ids.length === 3, JSON.stringify(after));
  await game(() => { __idle.state.nextEventId += 1; __idle.state.inbox.push({ id: __idle.state.nextEventId, type: 'gems', stage: 1, reward: { gems: 7 } }); });
  await game(() => __idle.ui.openTab('inbox'));
  await page.waitForTimeout(1200);
  const before = await game(() => ({ gems: __idle.state.gems, inbox: __idle.state.inbox.length }));
  // v9.1.0 : À récupérer — un seul bouton pour tout (v9.1.3 : dans une fenêtre, plus un onglet).
  await page.click('#modal-card [data-action="claim-everything"]');
  const got = await game((b) => ({ gems: __idle.state.gems - b.gems, inbox: __idle.state.inbox.length }), before);
  assert(got.gems >= 7 && got.inbox === 0 && after.gems >= gems, JSON.stringify(got));
  await page.click('#modal-card [data-action="close-modal"]');
});

await check('paramètres : version lancée et mise à jour détectée (GitHub simulé)', async () => {
  await page.route('https://api.github.com/**', (route) => route.fulfill({ status: 200, contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ tag_name: 'v99.0.0', html_url: 'https://github.com/ErwannL/idleproject/releases/tag/v99.0.0', body: 'Notes', assets: [] }) }));
  await page.click('[data-open="options"]');
  await page.waitForTimeout(300);
  const version = await page.textContent('#panel-body');
  assert(/[Vv]ersion lancée/.test(version), 'version absente');
  await page.click('[data-action="check-update"]');
  await page.waitForFunction(() => /Nouvelle version 99\.0\.0/.test(document.querySelector('#panel-body').textContent), null, { timeout: 5000 });
  await page.unroute('https://api.github.com/**');
});

await check('forge : fabriquer un objet avec des éclats', async () => {
  // v9.1.3 : la Forge s'ouvre à l'étape 10 (core/unlocks.js).
  await game(() => { __idle.state.materials.shards += 500; __idle.state.gold += 1e6; __idle.state.records.bestStage = Math.max(10, __idle.state.records.bestStage); });
  await game(() => __idle.ui.openTab('forge')); // v9.3.4 : Forge à part
  await page.waitForTimeout(300);
  if (!(await page.$('[data-action="craft-slot"]'))) await page.click('[data-action="toggle-section"][data-value="forge-craft"]');
  await page.waitForTimeout(200);
  await page.selectOption('[data-action="craft-slot"]', 'helmet');
  await page.waitForTimeout(200);
  const count = await game(() => __idle.state.inventory.length);
  await page.click('[data-action="craft"][data-tier="rare"]');
  const after = await game(() => __idle.state.inventory.length);
  assert(after === count + 1, `inventaire ${count} -> ${after}`);
  await game(() => __idle.ui.openTab('inventory'));
});

await check('vitesse ×10 : l’inventaire reste cliquable (pas de redessin pendant le clic)', async () => {
  await game(() => { __idle.state.ui.speed = 10; for (let i = 0; i < 4; i++) __idle.addItem('iron_helm', 'common', 1).locked = true; });
  if (await game(() => __idle.ui.tab !== 'inventory')) await clickTab('inventory');
  await page.waitForSelector('.inv-grid .item-frame', { timeout: 5000 }).catch(async (e) => {
    const dbg = await game(() => ({ tab: __idle.ui.tab, dirty: __idle.ui.dirty, pd: __idle.ui.pointerDown, inv: __idle.state.inventory.length,
      html: document.querySelector('#panel-body').innerHTML.slice(0, 200) }));
    throw new Error(`${e.message} ${JSON.stringify(dbg)}`);
  });
  for (let i = 0; i < 5; i++) {
    const ids = await page.$$eval('.inv-grid .item-frame', (els) => els.map((e) => e.dataset.id));
    const id = ids[i % ids.length];
    await closePop();
    await page.click(`.inv-grid [data-id="${id}"]`);
    await page.waitForTimeout(150);
    const sel = await game(() => window.__idle.ui.view.selectedItemId);
    assert(sel === id, `sélection ${sel} ≠ ${id}`);
  }
  await game(() => { __idle.state.ui.speed = 1; });
});

await check('clavier : onglet par touche, flèches entre les boutons, Entrée maintenue = achat en continu', async () => {
  await game(() => { __idle.state.gold += 1e40; __idle.ui.closePanel(); __idle.ui.lastSub = { hero: 'upgrades' }; });
  await page.click('#scene', { position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press('1'); // v9.1.0 : 1 = Héros (chiffre fixe par menu)
  await page.waitForTimeout(300);
  const tab = await game(() => __idle.ui.tab);
  assert(tab === 'upgrades', `onglet ${tab}`);
  const inPanel = await game(() => Boolean(document.activeElement?.closest('#panel-body')));
  assert(inPanel, 'la sélection n\'est pas dans le panneau');
  const before = await game(() => document.activeElement?.outerHTML.slice(0, 80));
  await page.keyboard.press('ArrowDown');
  const after = await game(() => document.activeElement?.outerHTML.slice(0, 80));
  assert(before !== after, 'les flèches ne déplacent pas la sélection');
  const key = await game(() => { const b = document.querySelector('#panel-body [data-action="buy"]:not([disabled])'); b.focus(); return b.dataset.key; });
  const lvl = await game((k) => __idle.state.upgrades[k], key);
  await page.keyboard.down('Enter');
  await page.waitForTimeout(1600);
  await page.keyboard.up('Enter');
  const lvl2 = await game((k) => __idle.state.upgrades[k], key);
  assert(lvl2 >= lvl + 3, `niveaux ${lvl} → ${lvl2}`);
});

await check('donjon : entrer avec une clé puis abandonner', async () => {
  await game(() => { __idle.state.maxStage = Math.max(__idle.state.maxStage, 25); __idle.state.keys = Math.max(1, __idle.state.keys); });
  await waitFor(() => __idle.ui.tabVisible['dungeons'] !== false, 3000);
  await clickTab('dungeons');
  await page.waitForTimeout(300);
  const keys = await game(() => __idle.state.keys);
  await page.click('[data-action="enter-dungeon"]');
  await page.waitForTimeout(300);
  const inside = await game(() => ({ d: __idle.state.dungeon, keys: __idle.state.keys }));
  assert(inside.d && inside.keys === keys - 1, JSON.stringify(inside));
  await page.screenshot({ path: `${outDir}/compact-dungeon.png` });
  await page.click('[data-action="abandon-dungeon"]');
  const out = await game(() => __idle.state.dungeon);
  assert(out === null, 'toujours dans le donjon');
});

await check('Renaissance : confirmation, réinitialisation et conservation des déblocages', async () => {
  await game(() => { __idle.state.maxStage = 31; });
  await waitFor(() => __idle.ui.tabVisible['tree'] !== false, 3000);
  await game(() => __idle.ui.openTab('tree', { treeSeg: 'rebirth' }));
  await page.waitForTimeout(300);
  await page.click('[data-action="rebirth"]');
  await page.waitForSelector('#modal:not(.hidden)');
  const text = await page.textContent('#modal-card');
  assert(text.includes('Conservé') && text.includes('Réinitialisé'), text);
  const before = await game(() => ({ powers: JSON.stringify(__idle.state.powers), weapon: __idle.state.equipment.weapon.id }));
  await page.click('[data-action="confirm-rebirth"]');
  await page.waitForTimeout(200);
  const after = await game(() => ({
    stage: __idle.state.maxStage, gold: __idle.state.gold, fragments: __idle.state.fragments,
    powers: JSON.stringify(__idle.state.powers), weapon: __idle.state.equipment.weapon.id, rebirths: __idle.state.records.rebirths,
  }));
  assert(after.stage === 1 && after.gold === 0 && after.fragments > 0 && after.rebirths === 1, JSON.stringify(after));
  assert(after.powers === before.powers && after.weapon === before.weapon, 'déblocage perdu');
  const fragments = after.fragments;
  await page.click('[data-action="tree-seg"][data-value="tree"]').catch(() => {});
  await page.waitForTimeout(300);
  await page.click('[data-action="buy-talent"][data-key="core"]');
  await page.waitForTimeout(150);
  const talent = await game(() => [__idle.state.talents.core, __idle.state.fragments]);
  assert(talent[0] === 1 && talent[1] < fragments, JSON.stringify(talent));
  await page.screenshot({ path: `${outDir}/compact-rebirth.png` });
});

await check('la progression est sauvegardée et restaurée après relance', async () => {
  const before = await game(() => ({ gold: __idle.state.gold, damage: __idle.state.upgrades.damage, inv: __idle.state.inventory.length }));
  await page.reload();
  await waitFor(() => window.__idle, 5000);
  const after = await game(() => ({ gold: __idle.state.gold, damage: __idle.state.upgrades.damage, inv: __idle.state.inventory.length }));
  assert(after.damage === before.damage && after.inv >= before.inv && after.gold >= before.gold - 1, JSON.stringify({ before, after }));
});

await check('le calcul hors ligne affiche un résumé cohérent après une absence', async () => {
  // Absence simulée : avant le rechargement suivant (et après la sauvegarde de sortie),
  // on recule l'horodatage de la sauvegarde de 3 h.
  await shiftSaveOnNextLoad(-3 * 3600 * 1000, 'back');
  const gold = await game(() => __idle.state.gold);
  await page.reload();
  await page.waitForSelector('#modal:not(.hidden)', { timeout: 10000 });
  const text = await page.textContent('#modal-card');
  assert(text.includes('Bon retour') && text.includes('3 h'), text);
  const after = await game(() => __idle.state.gold);
  assert(after > gold, `or ${gold} -> ${after}`);
  await page.screenshot({ path: `${outDir}/compact-offline.png` });
  await page.click('[data-action="close-modal"]');
});

await check('horloge reculée : aucun gain', async () => {
  await shiftSaveOnNextLoad(24 * 3600 * 1000, 'forward');
  const gold = await game(() => __idle.state.gold);
  await page.reload();
  await page.waitForSelector('#modal:not(.hidden)', { timeout: 10000 });
  const text = await page.textContent('#modal-card');
  assert(text.includes('Horloge incohérente'), text);
  const after = await game(() => __idle.state.gold);
  assert(after <= gold + 50, `or ${gold} -> ${after}`);
  await page.click('[data-action="close-modal"]');
});

await check('l’interface s’adapte au redimensionnement', async () => {
  const expected = [[520, 150, 'strip'], [320, 200, 'mini'], [400, 250, 'mini'], [460, 640, 'tall'], [980, 620, 'tall']];
  for (const [w, h, layout] of expected) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(300);
    const info = await game(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      cls: document.querySelector('#app').className,
      canvas: document.querySelector('#scene').getBoundingClientRect().height,
    }));
    assert(!info.overflow, `débordement horizontal à ${w}×${h}`);
    assert(info.cls === `layout-${layout}`, `${w}×${h} : ${info.cls}`);
    if (layout === 'strip') {
      // Mode barre : seulement la scène (et l'or), rien d'autre ne prend de place.
      const strip = await game(() => ({
        topbar: document.querySelector('#topbar').offsetParent !== null,
        tabs: document.querySelector('#tabs').offsetParent !== null,
        gold: document.querySelector('#strip-gold').offsetParent !== null,
      }));
      assert(!strip.topbar && !strip.tabs && strip.gold, `mode barre : ${JSON.stringify(strip)}`);
      await page.screenshot({ path: `${outDir}/strip.png` });
      continue;
    }
    if (layout !== 'mini') {
      // Fenêtre haute : la scène reste grande, panneau ouvert ou non.
      assert(info.canvas >= 140, `${layout} : scène ${info.canvas}px`);
    }
    if (layout === 'tall') {
      for (const tab of ['upgrades', 'inventory', 'hero', 'skills', 'campaign', 'boss', 'tree']) {
        await clickTab(tab);
        await page.waitForTimeout(250);
        await page.screenshot({ path: `${outDir}/standard-${tab}.png` });
      }
      // Un second clic sur l'onglet ouvert le referme : le jeu reprend toute la hauteur.
      const before = await game(() => document.querySelector('#scene').getBoundingClientRect().height);
      await clickTab('tree');
      await page.waitForTimeout(300);
      const closed = await game(() => ({
        hidden: document.querySelector('#panel').classList.contains('hidden'),
        canvas: document.querySelector('#scene').getBoundingClientRect().height,
      }));
      assert(closed.hidden && closed.canvas > before, `onglet non refermé : ${JSON.stringify(closed)} (avant ${before})`);
      await page.screenshot({ path: `${outDir}/standard-closed.png` });
    }
  }
  await clickTab('inventory');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/wide.png` });
});

await check('aucune erreur JavaScript', async () => {
  assert(errors.length === 0, errors.join('\n'));
});

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} vérifications réussies. Captures : ${outDir}`);
process.exit(failed.length ? 1 : 0);
