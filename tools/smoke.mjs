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
  await page.click('#tabs button[data-tab="upgrades"]');
  const before = await game(() => __idle.state.upgrades.damage);
  await page.click('[data-action="buy"][data-key="damage"]');
  const after = await game(() => __idle.state.upgrades.damage);
  assert(after === before + 1, `niveau ${before} -> ${after}`);
  await page.screenshot({ path: `${outDir}/compact-upgrades.png` });
});

await check('ouvrir l’inventaire, équiper un objet et voir les stats changer', async () => {
  const item = await game(() => __idle.addRandomItem('epic'));
  await page.click('#tabs button[data-tab="inventory"]');
  await page.click(`.inv-grid [data-id="${item.id}"]`);
  await page.waitForSelector('.item-detail');
  const before = await game(() => JSON.stringify(__idle.state.equipment));
  await page.screenshot({ path: `${outDir}/compact-inventory.png` });
  await page.click(`.item-detail [data-action="equip"]`);
  const equipped = await game((id) => Object.values(__idle.state.equipment).some((i) => i && i.id === id), item.id);
  const after = await game(() => JSON.stringify(__idle.state.equipment));
  assert(equipped && before !== after, 'objet non équipé');
  await page.click(`.inv-equip [data-id="${item.id}"]`);
  await page.waitForSelector('.item-detail');
  const text = await page.textContent('.item-detail');
  assert(/équipé/i.test(text), 'détail équipé absent');
  assert(await page.$(`.inv-equip [data-id="${item.id}"] .eq`), 'marque « équipé » absente');
});

await check('recycler un objet contre de l’or', async () => {
  const item = await game(() => __idle.addRandomItem('rare'));
  await page.click(`.inv-grid [data-id="${item.id}"]`);
  const gold = await game(() => __idle.state.gold);
  await page.click('.item-detail [data-action="recycle"]');
  const after = await game(() => __idle.state.gold);
  const still = await game((id) => __idle.state.inventory.some((i) => i.id === id), item.id);
  assert(after > gold && !still, `or ${gold} -> ${after}`);
});

await check('onglets avec icône et état actif distinct', async () => {
  const tabs = await game(() => [...document.querySelectorAll('#tabs button')].map((b) => ({
    tab: b.dataset.tab, icon: b.querySelector('img')?.naturalWidth > 0, active: b.classList.contains('active'),
    hidden: b.classList.contains('hidden'),
  })));
  assert(tabs.length === 10 && tabs.every((t) => t.icon), JSON.stringify(tabs));
  // Menus débloqués progressivement : compagnons, arbre, donjons et boss cachés en début de partie.
  const hidden = tabs.filter((t) => t.hidden).map((t) => t.tab).sort().join();
  assert(hidden === 'boss,companions,dungeons,tree', `onglets cachés : ${hidden}`);
  assert(tabs.filter((t) => t.active).map((t) => t.tab).join() === 'inventory', JSON.stringify(tabs));
});

await check('filtres par type et tri par niveau', async () => {
  await game(() => { __idle.addItem('iron_helm', 'common', 1); __idle.addItem('dagger', 'common', 7); });
  await page.click('.inv-filters [data-value="weapon"]');
  await page.waitForTimeout(150);
  const slots = await game(() => [...document.querySelectorAll('.inv-grid [data-id]')]
    .map((el) => __idle.state.inventory.find((i) => i.id === el.dataset.id)?.slot));
  assert(slots.length > 0 && slots.every((s) => s === 'weapon'), JSON.stringify(slots));
  await page.selectOption('[data-action="sort"]', 'level');
  await page.waitForTimeout(150);
  const levels = await game(() => [...document.querySelectorAll('.inv-grid [data-id]')]
    .map((el) => __idle.state.inventory.find((i) => i.id === el.dataset.id).level));
  assert(levels.every((l, i) => i === 0 || levels[i - 1] >= l), JSON.stringify(levels));
  await page.click('.inv-filters [data-value="all"]');
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
  await page.click('#tabs button[data-tab="campaign"]');
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
  await waitFor(() => !document.querySelector('#tabs button[data-tab="boss"]').classList.contains('hidden'), 3000);
  await page.click('#tabs button[data-tab="boss"]');
  await page.waitForTimeout(200);
  const text = await page.textContent('#panel-body');
  assert(text.includes('Roi Gluant') && text.includes('Pouvoir ancestral actuel'), text.slice(0, 200));
});

await check('changer de pouvoir exige de réaffronter le boss', async () => {
  await game(() => { __idle.state.gold += 1e6; __idle.state.powers.slime_king.pending = null; __idle.state.powers.slime_king.charges = 0; });
  await page.waitForTimeout(1200);
  const disabled = await page.$eval('[data-action="reroll"][data-boss="slime_king"]', (b) => b.disabled);
  assert(disabled, 'relance possible sans nouvelle victoire');
  const victories = await game(() => __idle.state.powers.slime_king.victories);
  await page.click('[data-action="rechallenge"][data-boss="slime_king"]');
  await waitFor((v) => __idle.state.powers.slime_king.victories > v, 30000, victories);
  const charges = await game(() => __idle.state.powers.slime_king.charges);
  assert(charges === 1, `charges ${charges}`);
  if (await page.$('#panel.hidden')) await page.click('#tabs button[data-tab="boss"]');
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
  await page.click('#tabs button[data-tab="inventory"]');
  await page.click(`.inv-grid [data-id="${item.id}"]`);
  await page.click('.item-detail [data-action="lock"]');
  await page.waitForTimeout(150);
  const disabled = await page.$eval('.item-detail [data-action="recycle"]', (b) => b.disabled);
  const locked = await game((id) => __idle.state.inventory.find((i) => i.id === id).locked, item.id);
  assert(locked && disabled, `verrou ${locked}, bouton désactivé ${disabled}`);
  assert(await page.$(`.inv-grid [data-id="${item.id}"] img.lock`), 'icône de verrou absente');
});

await check('compétences : un point par niveau, apprendre Tourbillon', async () => {
  await game(() => { __idle.state.level = Math.max(__idle.state.level, 6); });
  await page.click('#tabs button[data-tab="skills"]');
  await page.waitForTimeout(300);
  await page.click('[data-action="learn-skill"][data-key="whirl"]');
  const level = await game(() => __idle.state.skills.whirl);
  assert(level === 1, `tourbillon ${level}`);
});

await check('invocation : un ticket donne un héros ou un compagnon', async () => {
  await game(() => { __idle.state.tickets = Math.max(1, __idle.state.tickets); });
  await page.click('[data-open="summon"]');
  await page.waitForTimeout(300);
  const before = await game(() => ({ t: __idle.state.tickets, n: __idle.state.summon.total }));
  await page.click('[data-action="summon"][data-currency="tickets"]');
  const after = await game(() => ({ t: __idle.state.tickets, n: __idle.state.summon.total }));
  assert(after.t === before.t - 1 && after.n === before.n + 1, JSON.stringify({ before, after }));
  await page.screenshot({ path: `${outDir}/compact-summon.png` });
});

await check('contrats et récompenses : réclamer un contrat et un coffre', async () => {
  const id = await game(() => { const c = __idle.state.contracts[0]; c.progress = c.target; return c.id; });
  await page.click('[data-open="contracts"]');
  await page.click('[data-action="mission-tab"][data-value="contracts"]');
  await page.waitForTimeout(1200);
  const gems = await game(() => __idle.state.gems);
  await page.click(`[data-action="claim-contract"][data-value="${id}"]`);
  const after = await game(() => ({ gems: __idle.state.gems, ids: __idle.state.contracts.map((c) => c.id) }));
  assert(!after.ids.includes(id) && after.ids.length === 3, JSON.stringify(after));
  await game(() => { __idle.state.nextEventId += 1; __idle.state.inbox.push({ id: __idle.state.nextEventId, type: 'gems', stage: 1, reward: { gems: 7 } }); });
  await page.click('[data-open="inbox"]');
  await page.waitForTimeout(300);
  const before = await game(() => __idle.state.gems);
  await page.click('[data-action="claim-event"]');
  const gained = await game((b) => __idle.state.gems - b, before);
  assert(gained === 7 && after.gems >= gems, `gemmes +${gained}`);
});

await check('paramètres : version lancée et mise à jour détectée (GitHub simulé)', async () => {
  await page.route('https://api.github.com/**', (route) => route.fulfill({ status: 200, contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ tag_name: 'v99.0.0', html_url: 'https://github.com/ErwannL/idleproject/releases/tag/v99.0.0', body: 'Notes', assets: [] }) }));
  await page.click('[data-open="options"]');
  await page.waitForTimeout(300);
  const version = await page.textContent('#panel-body');
  assert(/Version lancée/.test(version), 'version absente');
  await page.click('[data-action="check-update"]');
  await page.waitForFunction(() => /Nouvelle version 99\.0\.0/.test(document.querySelector('#panel-body').textContent), null, { timeout: 5000 });
  await page.unroute('https://api.github.com/**');
});

await check('forge : fabriquer un objet avec des éclats', async () => {
  await game(() => { __idle.state.materials.shards += 500; __idle.state.gold += 1e6; });
  await page.click('#tabs button[data-tab="inventory"]');
  await page.click('[data-action="inv-tab"][data-value="forge"]');
  await page.waitForTimeout(300);
  const count = await game(() => __idle.state.inventory.length);
  await page.click('[data-action="craft"][data-value="helmet"]');
  const after = await game(() => __idle.state.inventory.length);
  assert(after === count + 1, `inventaire ${count} -> ${after}`);
  await page.click('[data-action="inv-tab"][data-value="bag"]');
});

await check('donjon : entrer avec une clé puis abandonner', async () => {
  await game(() => { __idle.state.maxStage = Math.max(__idle.state.maxStage, 25); __idle.state.keys = Math.max(1, __idle.state.keys); });
  await waitFor(() => !document.querySelector('#tabs button[data-tab="dungeons"]').classList.contains('hidden'), 3000);
  await page.click('#tabs button[data-tab="dungeons"]');
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
  await waitFor(() => !document.querySelector('#tabs button[data-tab="tree"]').classList.contains('hidden'), 3000);
  await page.click('#tabs button[data-tab="tree"]');
  await page.waitForTimeout(150);
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
        await page.click(`#tabs button[data-tab="${tab}"]`);
        await page.waitForTimeout(250);
        await page.screenshot({ path: `${outDir}/standard-${tab}.png` });
      }
      // Un second clic sur l'onglet ouvert le referme : le jeu reprend toute la hauteur.
      const before = await game(() => document.querySelector('#scene').getBoundingClientRect().height);
      await page.click('#tabs button[data-tab="tree"]');
      await page.waitForTimeout(300);
      const closed = await game(() => ({
        hidden: document.querySelector('#panel').classList.contains('hidden'),
        canvas: document.querySelector('#scene').getBoundingClientRect().height,
      }));
      assert(closed.hidden && closed.canvas > before, `onglet non refermé : ${JSON.stringify(closed)} (avant ${before})`);
      await page.screenshot({ path: `${outDir}/standard-closed.png` });
    }
  }
  await page.click('#tabs button[data-tab="inventory"]');
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
