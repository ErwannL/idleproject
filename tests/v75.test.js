import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ACCESSORY_SLOTS, ITEM_BASES, SLOTS } from '../src/data/items.js';
import { collectBonuses } from '../src/core/bonuses.js';
import { craftCost, craftItem, fuseItems, fusionGroups, maxUpgrades, upgradeCost, upgradeItem } from '../src/core/forge.js';
import { collectItem, equipItem } from '../src/core/inventory.js';
import { bossEssence } from '../src/core/combat.js';
import { makeItem } from '../src/core/loot.js';
import { Rng } from '../src/core/rng.js';
import { createNewState, sanitizeState } from '../src/core/state.js';

function rich(seed = 1) {
  const state = createNewState(0, seed);
  state.gold = 1e12;
  state.materials.shards = 1e6;
  return state;
}

test('amélioration : 5 niveaux pour Commun et Rare, 10 à partir d\'Épique, une statistique au hasard', () => {
  const state = rich();
  const rng = new Rng(3);
  const sword = makeItem(state, 'short_sword', 'common', 4);
  state.inventory.push(sword);
  const before = sword.stats.damage;
  const cost = upgradeCost(sword);
  assert.equal(upgradeItem(state, sword.id, rng), 'damage');
  assert.ok(sword.stats.damage > before, `${before} -> ${sword.stats.damage}`);
  assert.ok(upgradeCost(sword).gold > cost.gold, 'coût croissant');
  while (upgradeItem(state, sword.id, rng));
  assert.equal(sword.upgrades, maxUpgrades(sword));
  assert.equal(sword.upgrades, 5);
  const epic = makeItem(state, 'chainmail', 'epic', 4);
  state.inventory.push(epic);
  while (upgradeItem(state, epic.id, rng));
  assert.equal(epic.upgrades, 10);
  assert.equal(Object.values(epic.boosts).reduce((a, b) => a + b, 0), 10);
  // Sans or, pas d'amélioration.
  const poor = createNewState(0, 2);
  poor.inventory.push(makeItem(poor, 'dagger', 'rare', 1));
  assert.equal(upgradeItem(poor, poor.inventory[0].id, rng), null);
});

test('fusion : 5 objets gris d\'un emplacement donnent 1 objet bleu (niveau le plus haut)', () => {
  const state = rich(5);
  const rng = new Rng(9);
  for (const level of [3, 8, 5, 2, 4, 6]) state.inventory.push(makeItem(state, 'iron_helm', 'common', level));
  state.inventory[0].locked = true; // un objet verrouillé n'est jamais fusionné
  const groups = fusionGroups(state);
  assert.deepEqual(groups.map((g) => [g.slot, g.rarity, g.count, g.next]), [['helmet', 'common', 5, 'rare']]);
  const item = fuseItems(state, 'helmet', 'common', rng);
  assert.equal(item.rarity, 'rare');
  assert.equal(item.slot, 'helmet');
  assert.equal(item.level, 8);
  assert.equal(state.inventory.filter((i) => i.rarity === 'common').length, 1);
  assert.ok(state.inventory[0].locked);
  assert.equal(fuseItems(state, 'helmet', 'common', rng), null, 'plus assez d\'objets');
});

test('accessoires : 4 emplacements qui améliorent les statistiques secondaires', () => {
  const state = rich(7);
  for (const slot of ACCESSORY_SLOTS) assert.ok(slot in SLOTS && slot in state.equipment, slot);
  const ring = makeItem(state, 'band_ring_ruby', 'epic', 10, undefined, new Rng(1));
  assert.equal(ring.affixes[0].type, 'goldPct');
  state.inventory.push(ring);
  const before = collectBonuses(state).goldPct;
  equipItem(state, ring.id);
  assert.ok(collectBonuses(state).goldPct >= before + ring.affixes[0].value);
  // Une ancienne sauvegarde sans emplacements d'accessoires se charge et les reçoit vides.
  const raw = JSON.parse(JSON.stringify(createNewState(0, 8)));
  raw.equipment = { weapon: raw.equipment.weapon, helmet: null, armor: null };
  const loaded = sanitizeState(raw);
  for (const slot of ACCESSORY_SLOTS) assert.equal(loaded.equipment[slot], null);
  // Les améliorations d'un objet survivent à la sauvegarde.
  const helm = makeItem(state, 'iron_helm', 'rare', 3);
  state.inventory.push(helm);
  upgradeItem(state, helm.id, new Rng(2));
  const reloaded = sanitizeState(JSON.parse(JSON.stringify(state)));
  const again = reloaded.inventory.find((i) => i.id === helm.id);
  assert.equal(again.upgrades, 1);
  assert.deepEqual(again.boosts, helm.boosts);
});

test('accessoires : chaque modèle existe en plusieurs couleurs', () => {
  const rings = ITEM_BASES.filter((b) => b.slot === 'ring');
  const designs = new Set(rings.map((b) => b.sprite));
  for (const d of designs) {
    const colors = new Set(rings.filter((b) => b.sprite === d).map((b) => b.colors.gem));
    assert.ok(colors.size >= 3, `${d} : ${colors.size} couleurs`);
  }
});

test('règle de collecte : recycler au ramassage sans jamais jeter une amélioration', () => {
  const state = rich(11);
  state.ui.autoRecycle = 'common';
  const shards = state.materials.shards;
  const weak = makeItem(state, 'dagger', 'common', 1);
  state.equipment.weapon = makeItem(state, 'battle_axe', 'legendary', 20);
  const res = collectItem(state, weak);
  assert.ok(!res.added && res.auto && state.materials.shards > shards, 'commun recyclé');
  const rare = makeItem(state, 'dagger', 'rare', 1);
  assert.ok(collectItem(state, rare).added, 'Rare gardé avec la règle « Communs »');
  state.equipment.helmet = null;
  const helm = makeItem(state, 'iron_helm', 'common', 1);
  assert.ok(collectItem(state, helm).added, 'emplacement vide : objet gardé');
});

test('boss : essences garanties, et fabrication épique', () => {
  assert.equal(bossEssence(5), 2);
  assert.equal(bossEssence(45), 4);
  assert.equal(bossEssence(125), 8); // difficulté ×2 : +6
  const state = rich(12);
  state.materials.essence = 100;
  const item = craftItem(state, 'ring', new Rng(1), undefined, 'epic');
  assert.ok(['epic', 'legendary'].includes(item.rarity) && item.slot === 'ring');
  assert.equal(state.materials.essence, 100 - craftCost(state, undefined, 'epic').essence);
});
