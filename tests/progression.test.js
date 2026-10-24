import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BALANCE } from '../src/data/balance.js';
import { BOSS_POWERS, POWER_RULES } from '../src/data/powers.js';
import { REBIRTH, TALENTS } from '../src/data/rebirth.js';
import { changeStage, createCombat, step } from '../src/core/combat.js';
import { addToInventory, bulkRecycleCandidates, recycleItem, recycleMatching, toggleLock } from '../src/core/inventory.js';
import { makeItem, rarityIndex } from '../src/core/loot.js';
import { measureFarmRate } from '../src/core/offline.js';
import {
  activePowers, bossFirstStage, powerById, powerProbabilities, powerSlots, recordBossVictory,
  rerollCost, rerollPower, resolveReroll, setPowerActive,
} from '../src/core/powers.js';
import { buyTalent, canRebirth, performRebirth, rebirthReward, talentCost } from '../src/core/rebirth.js';
import { Rng } from '../src/core/rng.js';
import { loadGame, saveGame } from '../src/core/save.js';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { computeHeroStats } from '../src/core/stats.js';

const NOW = 1_700_000_000_000;

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

function stateWithPower(bossId = 'slime_king', seed = 1) {
  const state = createNewState(NOW, seed);
  recordBossVictory(state, bossId, new Rng(seed));
  return state;
}

test('données : chaque boss a des pouvoirs uniques et des probabilités qui somment à 1', () => {
  const ids = new Set();
  for (const [bossId, list] of Object.entries(BOSS_POWERS)) {
    assert.ok(list.length >= 2, bossId);
    for (const p of list) {
      assert.ok(!ids.has(p.id), `identifiant en double : ${p.id}`);
      ids.add(p.id);
      assert.ok(rarityIndex(p.rarity) >= 0, p.id);
      assert.ok(Object.keys(p.effects).length > 0, p.id);
    }
    const total = powerProbabilities(bossId).reduce((s, x) => s + x.chance, 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `${bossId} : ${total}`);
    const without = powerProbabilities(bossId, { excludeId: list[0].id });
    assert.ok(Math.abs(without.reduce((s, x) => s + x.chance, 0) - 1) < 1e-9);
    assert.ok(!without.some((x) => x.power.id === list[0].id));
  }
});

test('première victoire : un pouvoir thématique, puis seulement le compteur de victoires', () => {
  const state = createNewState(NOW, 1);
  const rng = new Rng(4);
  const power = recordBossVictory(state, 'slime_king', rng);
  assert.ok(power && BOSS_POWERS.slime_king.some((p) => p.id === power.id));
  assert.equal(state.powers.slime_king.current, power.id);
  assert.deepEqual(state.equippedPowers, ['slime_king'], 'activé automatiquement s\'il reste un emplacement');
  assert.equal(recordBossVictory(state, 'slime_king', rng), null);
  assert.equal(state.powers.slime_king.victories, 2);
  assert.equal(state.powers.slime_king.current, power.id);
});

test('combat : vaincre le boss débloque son pouvoir et émet un événement', () => {
  const state = createNewState(NOW, 1);
  state.upgrades.damage = 200;
  state.maxStage = 5;
  const world = createCombat(state);
  changeStage(state, world, 5);
  const rng = new Rng(5);
  for (let i = 0; i < 400 && state.records.bossesDefeated === 0; i++) step(state, world, 0.05, rng);
  assert.ok(state.powers.slime_king);
  assert.ok(world.events.some((e) => e.type === 'powerUnlocked' && e.bossId === 'slime_king'));
});

test('relance : coûte de l\'or, propose sans remplacer, refus et acceptation', () => {
  const state = stateWithPower();
  const rng = new Rng(9);
  const before = state.powers.slime_king.current;
  const cost = rerollCost(state, 'slime_king');
  assert.ok(cost > 0);

  assert.equal(rerollPower(state, 'slime_king', rng), null, 'or insuffisant');
  assert.equal(state.powers.slime_king.pending, null);

  state.gold = cost * 3;
  const offer = rerollPower(state, 'slime_king', rng);
  assert.ok(offer);
  assert.equal(state.gold, cost * 2);
  assert.equal(state.powers.slime_king.current, before, 'jamais remplacé automatiquement');
  assert.notEqual(offer.pending.id, before, 'proposition toujours différente');
  assert.equal(rerollPower(state, 'slime_king', rng), null, 'une seule proposition à la fois');

  assert.ok(resolveReroll(state, 'slime_king', false));
  assert.equal(state.powers.slime_king.current, before);
  assert.equal(state.powers.slime_king.pending, null);

  const second = rerollPower(state, 'slime_king', rng);
  assert.ok(resolveReroll(state, 'slime_king', true));
  assert.equal(state.powers.slime_king.current, second.pending.id);
  assert.equal(resolveReroll(state, 'slime_king', true), false, 'rien à résoudre');
  assert.equal(rerollPower(state, 'alpha_wolf', rng), null, 'boss jamais vaincu');
});

test('relance : garantie Épique+ après la série prévue', () => {
  const state = stateWithPower('alpha_wolf');
  const entry = state.powers.alpha_wolf;
  entry.current = 'predator_instinct';
  entry.sinceHigh = POWER_RULES.pity.after;
  state.gold = 1e9;
  for (let seed = 0; seed < 20; seed++) {
    entry.sinceHigh = POWER_RULES.pity.after;
    entry.pending = null;
    const offer = rerollPower(state, 'alpha_wolf', new Rng(seed));
    assert.ok(offer.guaranteed);
    assert.ok(rarityIndex(offer.pending.rarity) >= rarityIndex(POWER_RULES.pity.minRarity), offer.pending.id);
    assert.equal(entry.sinceHigh, 0);
  }
});

test('emplacements limités et effets appliqués aux statistiques', () => {
  const state = createNewState(NOW, 1);
  const base = computeHeroStats(state);
  for (const bossId of ['slime_king', 'alpha_wolf', 'bone_lord']) recordBossVictory(state, bossId, new Rng(1));
  assert.equal(state.equippedPowers.length, POWER_RULES.baseSlots);
  assert.equal(setPowerActive(state, 'bone_lord', true), false, 'emplacements pleins');

  state.powers.slime_king.current = 'gel_heart';
  state.powers.alpha_wolf.current = 'moon_hunter';
  state.equippedPowers = ['slime_king', 'alpha_wolf'];
  const boosted = computeHeroStats(state);
  assert.ok(Math.abs(boosted.maxHp - base.maxHp * 1.1) < 1e-9);
  assert.ok(Math.abs(boosted.damage - base.damage * 1.2) < 1e-9);
  assert.ok(boosted.attacksPerSecond > base.attacksPerSecond);

  assert.ok(setPowerActive(state, 'alpha_wolf', false));
  assert.deepEqual(activePowers(state).map((p) => p.id), ['gel_heart']);
  assert.ok(setPowerActive(state, 'bone_lord', true));
});

test('bonus d\'or et de dégâts contre les boss pris en compte par le combat et le hors ligne', () => {
  const plain = createNewState(NOW, 3);
  plain.autoAdvance = false;
  const rich = structuredClone(plain);
  rich.powers.slime_king = { current: 'king_hoard', pending: null, victories: 1, rerolls: 0, sinceHigh: 0 };
  rich.equippedPowers = ['slime_king'];
  const a = measureFarmRate(plain, BALANCE, 120);
  const b = measureFarmRate(rich, BALANCE, 120);
  assert.ok(b.goldPerSecond > a.goldPerSecond * 1.15, `${a.goldPerSecond} -> ${b.goldPerSecond}`);
});

test('sauvegarde : pouvoirs, proposition en attente, talents et verrou restaurés', () => {
  const storage = new MemoryStorage();
  const state = stateWithPower();
  state.gold = 1e6;
  rerollPower(state, 'slime_king', new Rng(2));
  state.fragments = 7;
  state.talents.power = 2;
  const item = makeItem(state, 'dagger', 'epic', 3);
  addToInventory(state, item);
  toggleLock(state, item.id);
  saveGame(state, storage, NOW);

  const loaded = loadGame(storage, BALANCE, NOW).state;
  assert.deepEqual(loaded.powers, state.powers);
  assert.ok(loaded.powers.slime_king.pending);
  assert.deepEqual(loaded.equippedPowers, ['slime_king']);
  assert.equal(loaded.fragments, 7);
  assert.equal(loaded.talents.power, 2);
  assert.equal(loaded.inventory[0].locked, true);
});

test('migration : une sauvegarde v1/v2 reçoit les pouvoirs des boss déjà battus', () => {
  const old = createNewState(NOW, 77);
  delete old.powers;
  delete old.equippedPowers;
  delete old.fragments;
  delete old.talents;
  old.version = 1;
  old.maxStage = 17; // boss des étapes 5 et 15 battus, pas celui de l'étape 25
  const migrated = sanitizeState(JSON.parse(JSON.stringify(old)), BALANCE, NOW);
  assert.deepEqual(Object.keys(migrated.powers).sort(), ['alpha_wolf', 'slime_king']);
  assert.equal(migrated.equippedPowers.length, 2);
  const again = sanitizeState(JSON.parse(JSON.stringify(old)), BALANCE, NOW);
  assert.deepEqual(again.powers, migrated.powers, 'migration déterministe');
  assert.equal(bossFirstStage('bone_lord'), 25);
});

test('nettoyage : pouvoirs inconnus ou incohérents ignorés', () => {
  const s = sanitizeState({
    maxStage: 3,
    powers: { slime_king: { current: 'moon_hunter' }, alpha_wolf: { current: 'pack_fury', pending: 'pack_fury', victories: -2 } },
    equippedPowers: ['alpha_wolf', 'alpha_wolf', 'ghost'],
    talents: { power: 999, nope: 3 },
    fragments: -4,
  }, BALANCE, NOW);
  assert.equal(s.powers.slime_king, undefined, 'pouvoir d\'un autre boss refusé');
  assert.equal(s.powers.alpha_wolf.pending, null);
  assert.equal(s.powers.alpha_wolf.victories, 1);
  assert.deepEqual(s.equippedPowers, ['alpha_wolf']);
  assert.equal(s.talents.power, TALENTS.find((t) => t.id === 'power').max);
  assert.equal(s.fragments, 0);
  assert.equal(powerById('moon_hunter').bossId, 'alpha_wolf');
});

test('Renaissance : seuil, récompense, réinitialisation et conservation', () => {
  const state = stateWithPower();
  state.maxStage = REBIRTH.minStage - 1;
  assert.equal(canRebirth(state), false);
  assert.equal(performRebirth(state), 0);

  state.maxStage = 30;
  state.stage = 29;
  state.gold = 5000;
  state.upgrades = { damage: 20, attackSpeed: 5, vitality: 7 };
  addToInventory(state, makeItem(state, 'dagger', 'rare', 20));
  const weapon = state.equipment.weapon;
  const reward = rebirthReward(state);
  assert.equal(reward, Math.floor((29 / REBIRTH.divisor) ** REBIRTH.exponent));
  assert.equal(performRebirth(state), reward);
  assert.equal(state.fragments, reward);
  assert.equal(state.records.rebirths, 1);
  assert.deepEqual([state.stage, state.maxStage, state.gold], [1, 1, 0]);
  assert.deepEqual(state.upgrades, { damage: 0, attackSpeed: 0, vitality: 0 });
  assert.ok(state.powers.slime_king, 'pouvoirs conservés');
  assert.equal(state.equipment.weapon, weapon, 'équipement conservé');
  assert.equal(state.inventory.length, 1, 'sac conservé');
});

test('talents : coût, plafond, effets et emplacement de pouvoir supplémentaire', () => {
  const state = createNewState(NOW, 1);
  const base = computeHeroStats(state);
  assert.equal(buyTalent(state, 'power'), false, 'pas de fragments');
  state.fragments = 100;
  assert.ok(buyTalent(state, 'power'));
  assert.equal(state.fragments, 100 - talentCost(TALENTS[0], 0));
  assert.ok(Math.abs(computeHeroStats(state).damage - base.damage * 1.1) < 1e-9);

  const slots = powerSlots(state);
  assert.ok(buyTalent(state, 'legacy'));
  assert.equal(powerSlots(state), slots + 1);
  const cost = rerollCost(stateWithPower(), 'slime_king');
  const discounted = stateWithPower();
  discounted.talents.legacy = 2;
  assert.ok(rerollCost(discounted, 'slime_king') < cost);

  state.fragments = 1e6;
  while (buyTalent(state, 'hunt'));
  assert.equal(state.talents.hunt, TALENTS.find((t) => t.id === 'hunt').max);
  assert.equal(buyTalent(state, 'nope'), false);
});

test('verrouillage : un objet verrouillé n\'est jamais recyclé', () => {
  const state = createNewState(NOW, 1);
  const item = makeItem(state, 'leather_hood', 'common', 1);
  addToInventory(state, item);
  state.equipment.helmet = makeItem(state, 'iron_helm', 'legendary', 5);
  assert.equal(toggleLock(state, item.id), true);
  assert.equal(recycleItem(state, item.id), 0);
  assert.deepEqual(bulkRecycleCandidates(state, 'rare'), []);
  assert.equal(recycleMatching(state, () => true).count, 0);
  assert.equal(state.inventory.length, 1);
  assert.equal(toggleLock(state, item.id), false);
  assert.ok(recycleItem(state, item.id) > 0);
  assert.equal(toggleLock(state, 'it999'), null);
});
