// v10.13 (lot 3, § 3) : Héros › Équipement sur PC (equip-desk.js) : trois colonnes, rangée « qui » (objets des compagnons ici),
// Reforger en trois cartes illustrées, Avant / Après avec Garder / Revenir, « Changer le type » (core/forge.js), un seul bouton doré.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'getImageData' || k === 'createImageData'
    ? (x, y, w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0)) * 4), width: w, height: h })
    : k === 'measureText' ? () => ({ width: 1 }) : k in t ? t[k] : () => {}),
  set: (t, k, v) => { t[k] = v; return true; },
});
globalThis.document ??= { createElement: () => ({ width: 1, height: 1, getContext: () => ctx2d, toDataURL: () => 'data:' }) };

const { BALANCE } = await import('../src/data/balance.js');
const { createNewState, sanitizeState } = await import('../src/core/state.js');
const { makeItem } = await import('../src/core/loot.js');
const { Rng } = await import('../src/core/rng.js');
const forge = await import('../src/core/forge.js');
const inv = await import('../src/core/inventory.js');
const { generateItem } = await import('../src/core/loot.js');
const { levelForStage } = await import('../src/core/combat.js');
const inventoryPanel = (await import('../src/ui/panels/inventory.js')).default;

const uiWith = (view = {}) => ({ view: { open: new Set(), closed: new Set(), ...view }, tabVisible: {} });
const phoneUi = (view = {}) => ({ view: { open: new Set(), closed: new Set(), ...view }, tabVisible: {}, root: { classList: { contains: () => true }, clientWidth: 412 } });
function rich(stage = 139) {
  const s = createNewState(Date.UTC(2026, 10, 24, 12));
  s.maxStage = stage; s.records.bestStage = stage;
  s.gold = 1e30; s.materials.shards = 1e6;
  return s;
}
const endgame = () => sanitizeState(JSON.parse(readFileSync('tests/fixtures/endgame.json', 'utf8')));
const count = (html, re) => (html.match(re) ?? []).length;

test('Changer le type : même famille de classe, même niveau, renforts et effets gardés, 40 éclats', () => {
  const s = rich();
  const dagger = makeItem(s, 'dagger', 'epic', 130, BALANCE, new Rng(2));
  dagger.upgrades = 3; dagger.boosts = { damage: 3 };
  s.inventory.push(dagger);
  assert.equal(forge.retypeCost(), 40);
  assert.ok(forge.canRetype(dagger));
  assert.deepEqual(forge.retypeChoices(dagger).map((b) => b.id), ['katar'], 'dague → katar (même classe : Assassin)');
  const before = { level: dagger.level, rarity: dagger.rarity, upgrades: dagger.upgrades, affixes: JSON.stringify(dagger.affixes), shards: s.materials.shards };
  assert.equal(forge.retypeItem(s, dagger.id, new Rng(5)), true);
  assert.equal(dagger.baseId, 'katar');
  assert.equal(dagger.name, 'Katar');
  assert.equal(dagger.level, before.level); assert.equal(dagger.rarity, before.rarity); assert.equal(dagger.upgrades, before.upgrades);
  assert.equal(JSON.stringify(dagger.affixes), before.affixes, 'les effets sont gardés');
  assert.equal(s.materials.shards, before.shards - 40);
  // Pas assez d'éclats, armure, objet ancestral : rien ne change, rien n'est payé.
  s.materials.shards = 39;
  assert.equal(forge.retypeItem(s, dagger.id, new Rng(5)), false);
  assert.equal(s.materials.shards, 39);
  const mail = makeItem(s, 'chainmail', 'epic', 50, BALANCE, new Rng(1)); s.inventory.push(mail);
  assert.ok(!forge.canRetype(mail));
  const alpha = makeItem(s, 'alpha_fang_blade', 'epic', 50, BALANCE, new Rng(1));
  assert.ok(!forge.canRetype(alpha));
});

test('PC : Reforger = trois cartes illustrées toujours visibles, effets à icônes derrière « Choisir… », un seul bouton doré', () => {
  const s = rich();
  const w = makeItem(s, 'dagger', 'epic', 130, BALANCE, new Rng(3));
  s.equipment.weapon = w;
  const html = inventoryPanel.render(uiWith({ selectedItemId: w.id, itemTab: 'reforge' }), s);
  assert.equal(count(html, /class="de-rcard[ "]/g), 3);
  for (const t of ['Changer l\'effet', 'Relance orientée', 'Changer le type']) assert.ok(html.includes(`<b>${t.replace(/'/g, '&#39;')}</b>`), t);
  for (const art of ['fuse', 'upgrade', 'craft']) assert.ok(html.includes(`assets/ui/art104/forge_step_${art}.png`), art);
  assert.ok(html.includes('data-action="reforge"') && html.includes('data-action="rf-pick"') && html.includes('data-action="retype-item"'));
  assert.ok(!html.includes('<select') && !html.includes('Plus : '));
  assert.equal(count(html, /class="m-btn-gold/g), 1, 'un seul bouton doré');
  assert.ok(!html.includes('class="de-effects"'), 'la liste des effets est fermée tant qu\'on n\'a pas touché « Choisir… »');
  const open = inventoryPanel.render(uiWith({ selectedItemId: w.id, itemTab: 'reforge', rfPickOpen: w.id, rerollType: 'critChance' }), s);
  assert.ok(open.includes('class="de-effects"') && count(open, /class="de-eff[ "]/g) >= 4, 'liste d\'effets');
  assert.ok(count(open, /class="de-eff[^>]*><img/g) >= 4, 'chaque effet a son icône');
  assert.match(open, /data-action="target-reroll" data-id="[^"]+" data-value="critChance"/);
});

test('PC : après un changement d\'effet, Avant / Après avec Garder et Revenir (Garder est le doré)', () => {
  const s = rich();
  const w = makeItem(s, 'dagger', 'epic', 130, BALANCE, new Rng(3));
  s.equipment.weapon = w;
  const snap = { affixes: [{ type: 'goldPct', value: 7 }], stats: w.stats, boosts: {}, upgrades: w.upgrades ?? 0, level: w.level };
  const html = inventoryPanel.render(uiWith({ selectedItemId: w.id, itemTab: 'reforge', rfPrev: { id: w.id, snap } }), s);
  assert.ok(html.includes('class="de-ab"') && html.includes('<h5>Avant</h5>') && html.includes('<h5>Après</h5>'));
  assert.ok(html.includes('data-action="reforge-keep"') && html.includes('data-action="reforge-revert"'));
  assert.equal(count(html, /class="m-btn-gold/g), 1, 'un seul doré : Garder');
  assert.match(html, /class="m-btn-gold"\s+data-action="reforge-keep"/);
  // Après un renfort, l'ancien effet ne revient plus (l'objet a changé) : pas d'Avant / Après.
  const moved = inventoryPanel.render(uiWith({ selectedItemId: w.id, itemTab: 'reforge', rfPrev: { id: w.id, snap: { ...snap, upgrades: 4 } } }), s);
  assert.ok(!moved.includes('class="de-ab"'));
});

test('PC : Équipement = rangée « qui » (héros + compagnons), objets des compagnons ici, Équipement rapide · toute l\'équipe', () => {
  const e = endgame();
  const id = e.companions.equipped[0];
  const hero = inventoryPanel.render(uiWith(), e);
  assert.ok(count(hero, /data-action="gear-who"/g) >= 2, 'héros + au moins un compagnon');
  assert.ok(hero.includes('data-action="gear-team"') && hero.includes('Équipement rapide · toute l&#39;équipe'));
  assert.ok(hero.includes('data-action="eq-quick" data-value="hero"') || /disabled data-action="eq-quick"/.test(hero));
  const unit = inventoryPanel.render(uiWith({ gearWho: id }), e);
  assert.equal(count(unit, /data-action="eq-slot"/g), 3, 'trois places pour un compagnon');
  assert.ok(unit.includes('class="em-who r-') && unit.includes('aria-pressed="true"'));
  assert.ok(unit.includes('data-action="eq-tab" data-value="stars"') && unit.includes('data-action="eq-tab" data-value="skills"'));
  // Étoiles et Compétences s'ouvrent dans la colonne de détail, avec un retour.
  const stars = inventoryPanel.render(uiWith({ gearWho: id, eqTab: 'stars' }), e);
  assert.ok(stars.includes('class="de-back"') && stars.includes('em-stars'));
});

test('PC : un seul bouton doré par fiche, jamais « Renforcer +1 » ni « Remettre au niveau »', () => {
  const s = rich(139); // équipe complète et à jour, sauf une dague Commune de niveau 3 : « Objet dépassé »
  const rng = new Rng(5);
  for (let i = 0; i < 40; i++) s.inventory.push(generateItem(s, rng, { level: levelForStage(139) - (i % 5) }));
  for (const it of [...s.inventory]) inv.equipItem(s, it.id);
  s.inventory = [];
  const w = makeItem(s, 'dagger', 'common', 3, BALANCE, rng);
  s.equipment.weapon = w;
  for (const itemTab of ['up', 'reforge', 'equip']) {
    const html = inventoryPanel.render(uiWith({ selectedItemId: w.id, itemTab }), s);
    assert.ok(count(html, /class="m-btn-gold/g) <= 1, `mode ${itemTab} : au plus un doré`);
    assert.ok(!/Renforcer \+1|Remettre au niveau|btn btn-gold/.test(html), `mode ${itemTab} : pas d'ancien bouton`);
  }
  const up = inventoryPanel.render(uiWith({ selectedItemId: w.id, itemTab: 'up' }), s);
  assert.ok(up.includes('class="de-old"') && up.includes('data-action="find-better"'), 'étiquette « Objet dépassé » et « Trouver mieux »');
  // Objet du sac (non porté) : le doré est « Équiper », jamais en double avec « Mieux dans ton sac ».
  const bag = makeItem(s, 'dagger', 'epic', 200, BALANCE, new Rng(4)); s.inventory.push(bag);
  const eq = inventoryPanel.render(uiWith({ selectedItemId: bag.id }), s);
  assert.ok(count(eq, /class="m-btn-gold/g) <= 1);
  assert.ok(!eq.includes('Mieux dans ton sac'));
});

test('téléphone inchangé : même fiche kit mobile, aucune classe PC', () => {
  const s = rich();
  const w = makeItem(s, 'dagger', 'epic', 130, BALANCE, new Rng(3));
  s.equipment.weapon = w;
  const html = inventoryPanel.render(phoneUi({ selectedItemId: w.id, sheetOpen: 'item', itemTab: 'reforge' }), s);
  assert.ok(html.includes('class="m-frame em"') && !html.includes('de-cols') && !html.includes('de-rcard'));
});

test('anglais : étiquettes de la fiche PC et « Objet dépassé » / « Trouver mieux »', async () => {
  const { translate } = await import('../src/i18n/en.js');
  for (const [fr, en] of [['Reforger', 'Reforge'], ['Relance orientée', 'Targeted reroll'], ['Changer le type', 'Change the type'], ['Garder', 'Keep'], ['Revenir', 'Revert'],
    ['Trouver mieux ›', 'Find better ›'], ['Équipement rapide · toute l\'équipe', 'Quick gear · whole team'], ['Sac 12 / 100', 'Bag 12 / 100'],
    ['⚠ Objet dépassé · Niv. 310, ton étape : 325', '⚠ Outdated item · Lv. 310, your stage: 325']]) assert.equal(translate(fr), en, fr);
});
