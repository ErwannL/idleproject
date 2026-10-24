import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BALANCE } from '../src/data/balance.js';
import { ITEM_BASES } from '../src/data/items.js';
import { changeStage, createCombat, enemyStats, isBossStage, resumeAdvance, stageLabel, step } from '../src/core/combat.js';
import { buyUpgrade, upgradeCost } from '../src/core/economy.js';
import { formatDuration, formatNumber } from '../src/core/format.js';
import { addToInventory, compareWithEquipped, equipItem, listInventory, recycleItem } from '../src/core/inventory.js';
import { makeItem, recycleValue, rollRarity } from '../src/core/loot.js';
import { applyOfflineRewards, computeOfflineRewards, measureFarmRate } from '../src/core/offline.js';
import { Rng } from '../src/core/rng.js';
import { BACKUP_KEY, SAVE_KEY, loadGame, saveGame } from '../src/core/save.js';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { computeHeroStats } from '../src/core/stats.js';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const NOW = 1_700_000_000_000;

function run(state, world, seconds, rng) {
  const dt = BALANCE.simulation.tickSeconds;
  for (let i = 0; i < Math.round(seconds / dt); i++) step(state, world, dt, rng, BALANCE);
}

test('formatNumber : lisible et jamais arrondi vers le haut', () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(999), '999');
  assert.equal(formatNumber(1234), '1,2 K');
  assert.equal(formatNumber(1000), '1 K');
  assert.equal(formatNumber(3_400_000), '3,4 M');
  assert.equal(formatNumber(999_999), '999,9 K');
  assert.equal(formatNumber(NaN), '0');
  assert.equal(formatDuration(3 * 3600 + 5 * 60), '3 h 05 min');
  assert.equal(formatDuration(42), '42 s');
});

test('Rng : déterministe pour une même graine', () => {
  const a = new Rng(42);
  const b = new Rng(42);
  for (let i = 0; i < 5; i++) assert.equal(a.next(), b.next());
});

test('améliorations : coût croissant et or débité', () => {
  const state = createNewState(NOW, 1);
  assert.equal(upgradeCost('damage', 0), 10);
  assert.ok(upgradeCost('damage', 5) > upgradeCost('damage', 4));
  assert.equal(buyUpgrade(state, 'damage'), false);
  state.gold = 10;
  const before = computeHeroStats(state).damage;
  assert.equal(buyUpgrade(state, 'damage'), true);
  assert.equal(state.gold, 0);
  assert.equal(computeHeroStats(state).damage, before + BALANCE.upgrades.damage.perLevel);
});

test('loot : rareté minimale respectée et stats issues des données', () => {
  const rng = new Rng(7);
  for (let i = 0; i < 200; i++) assert.notEqual(rollRarity(rng, 'rare'), 'common');
  const state = createNewState(NOW, 1);
  const common = makeItem(state, 'short_sword', 'common', 1);
  const legendary = makeItem(state, 'short_sword', 'legendary', 1);
  const base = ITEM_BASES.find((b) => b.id === 'short_sword');
  assert.equal(common.stats.damage, base.stats.damage);
  assert.ok(legendary.stats.damage > common.stats.damage);
  const axe = makeItem(state, 'battle_axe', 'epic', 1);
  assert.equal(axe.stats.attackSpeed, -8, 'les malus ne sont pas amplifiés par la rareté');
  assert.notEqual(common.id, legendary.id);
});

test('inventaire : équiper, comparer, recycler', () => {
  const state = createNewState(NOW, 1);
  const better = makeItem(state, 'short_sword', 'epic', 3);
  addToInventory(state, better);
  const diff = compareWithEquipped(state, better);
  assert.ok(diff.damage > 0 && diff.dps > 0);

  const oldWeapon = state.equipment.weapon;
  assert.ok(equipItem(state, better.id));
  assert.equal(state.equipment.weapon.id, better.id);
  assert.equal(state.inventory[0].id, oldWeapon.id, "l'ancienne arme retourne dans le sac");

  const gold = recycleItem(state, oldWeapon.id);
  assert.equal(gold, recycleValue(oldWeapon));
  assert.equal(state.gold, gold);
  assert.equal(state.inventory.length, 0);
  assert.equal(recycleItem(state, 'it999'), 0);
});

test('inventaire plein : le nouvel objet est recyclé en or', () => {
  const state = createNewState(NOW, 1);
  for (let i = 0; i < BALANCE.loot.inventorySize; i++) addToInventory(state, makeItem(state, 'dagger', 'common', 1));
  const result = addToInventory(state, makeItem(state, 'dagger', 'rare', 1));
  assert.equal(result.added, false);
  assert.ok(result.recycledGold > 0);
  assert.equal(state.inventory.length, BALANCE.loot.inventorySize);
});

test('tri et filtre du sac', () => {
  const state = createNewState(NOW, 1);
  addToInventory(state, makeItem(state, 'dagger', 'common', 1));
  addToInventory(state, makeItem(state, 'iron_helm', 'legendary', 1));
  addToInventory(state, makeItem(state, 'chainmail', 'rare', 1));
  assert.equal(listInventory(state, { sortBy: 'rarity' })[0].rarity, 'legendary');
  assert.deepEqual(listInventory(state, { slot: 'armor' }).map((i) => i.baseId), ['chainmail']);
  assert.equal(listInventory(state, { sortBy: 'recent' })[0].baseId, 'chainmail');
});

test('combat : le héros tue, gagne de l’or et progresse', () => {
  const state = createNewState(NOW, 1);
  const world = createCombat(state);
  run(state, world, 60, new Rng(3));
  assert.ok(state.records.kills > 10, `kills=${state.records.kills}`);
  assert.ok(state.gold > 0);
  assert.ok(state.maxStage >= 2);
});

test('boss : apparaît au palier et donne un objet garanti', () => {
  const state = createNewState(NOW, 1);
  state.upgrades.damage = 200;
  state.maxStage = 5;
  const world = createCombat(state);
  changeStage(state, world, 5);
  assert.ok(isBossStage(5));
  const rng = new Rng(5);
  let sawBoss = false;
  for (let i = 0; i < 400 && state.records.bossesDefeated === 0; i++) {
    step(state, world, 0.05, rng);
    if (world.enemies.some((e) => e.boss)) sawBoss = true;
  }
  assert.ok(sawBoss);
  assert.equal(state.records.bossesDefeated, 1);
  assert.equal(state.records.itemsFound, 1);
  assert.notEqual(state.inventory[0].rarity, 'common');
  assert.equal(state.maxStage, 6);
  assert.equal(state.stage, 6);
});

test('défaite : retour à l’étape précédente en mode farm, puis reprise', () => {
  const state = createNewState(NOW, 1);
  state.maxStage = 40;
  const world = createCombat(state);
  changeStage(state, world, 40);
  run(state, world, 120, new Rng(9));
  assert.equal(state.autoAdvance, false);
  assert.ok(state.stage < 40);
  const stage = state.stage;
  resumeAdvance(state, world);
  assert.equal(state.autoAdvance, true);
  assert.equal(state.stage, stage + 1);
});

test('les ennemis deviennent plus forts avec les étapes', () => {
  assert.ok(enemyStats(10, 'slime', false).hp > enemyStats(1, 'slime', false).hp);
  assert.ok(enemyStats(5, 'slime_king', true).hp > enemyStats(5, 'slime', false).hp);
  assert.equal(stageLabel(1), '1-1');
  assert.equal(stageLabel(14), '2-4');
});

test('hors ligne : plafond, horloge reculée et cohérence avec le farm actif', () => {
  const state = createNewState(NOW, 11);
  const rng = new Rng(1);

  const none = computeOfflineRewards(state, NOW, NOW - 5000, rng);
  assert.equal(none.clockSuspicious, true);
  assert.equal(none.gold, 0);

  const invalid = computeOfflineRewards(state, 0, NOW, rng);
  assert.equal(invalid.gold, 0);

  const twoHours = computeOfflineRewards(state, NOW - 2 * 3600e3, NOW, rng);
  const rate = measureFarmRate(state);
  assert.equal(twoHours.capped, false);
  assert.equal(twoHours.countedSeconds, 7200);
  assert.equal(twoHours.gold, Math.floor(rate.goldPerSecond * 7200 * BALANCE.offline.farmMultiplier));
  assert.ok(twoHours.gold > 0);

  const week = computeOfflineRewards(state, NOW - 7 * 24 * 3600e3, NOW, rng);
  assert.equal(week.capped, true);
  assert.equal(week.countedSeconds, BALANCE.offline.capHours * 3600);
  assert.ok(week.items.length <= BALANCE.offline.maxItems);

  const goldBefore = state.gold;
  const summary = applyOfflineRewards(state, week);
  assert.equal(state.gold - goldBefore, summary.totalGold);
});

test('hors ligne : rythme proche du farm actif réel', () => {
  const state = createNewState(NOW, 21);
  state.autoAdvance = false;
  const rate = measureFarmRate(state);
  const world = createCombat(state);
  run(state, world, 600, new Rng(99));
  const active = state.records.goldEarned / 600;
  assert.ok(Math.abs(active - rate.goldPerSecond) / active < 0.25, `actif=${active} mesuré=${rate.goldPerSecond}`);
});

test('sauvegarde : aller-retour, secours si corrompue, valeurs aberrantes nettoyées', () => {
  const storage = new MemoryStorage();
  const state = createNewState(NOW, 1);
  state.gold = 1234;
  state.upgrades.damage = 3;
  addToInventory(state, makeItem(state, 'iron_helm', 'epic', 2));
  assert.ok(saveGame(state, storage, NOW));
  state.gold = 5000;
  assert.ok(saveGame(state, storage, NOW + 1000));

  const loaded = loadGame(storage, BALANCE, NOW + 2000);
  assert.equal(loaded.source, 'main');
  assert.equal(loaded.state.gold, 5000);
  assert.equal(loaded.state.lastSaved, NOW + 1000);
  assert.equal(loaded.state.inventory[0].baseId, 'iron_helm');

  storage.setItem(SAVE_KEY, '{corrompu');
  const fallback = loadGame(storage, BALANCE, NOW);
  assert.equal(fallback.source, 'backup');
  assert.equal(fallback.state.gold, 1234);

  storage.setItem(BACKUP_KEY, 'null');
  assert.equal(loadGame(storage, BALANCE, NOW).source, 'new');

  const cleaned = sanitizeState({
    gold: -50, stage: 99, maxStage: 3, upgrades: { damage: 'x' },
    inventory: [{ id: 'it5', baseId: 'nope', slot: 'weapon', rarity: 'rare', level: 1, stats: {} }, null],
    nextItemId: 1,
  });
  assert.equal(cleaned.gold, 0);
  assert.equal(cleaned.stage, 3);
  assert.equal(cleaned.upgrades.damage, 0);
  assert.equal(cleaned.inventory.length, 0);
  assert.ok(cleaned.nextItemId >= 1);
});
