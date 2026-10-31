import { BUILD } from '../src/core/build-info.js';
// Ces tests vérifient la logique des codes : ils tournent en version dev (les codes sont absents de la version publique).
BUILD.cheats = true;
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BALANCE } from '../src/data/balance.js';
import { BOSSES } from '../src/data/enemies.js';
import { ZONES } from '../src/data/zones.js';
import { applyCheat } from '../src/core/cheats.js';
import { claimCollection, collectionStatus } from '../src/core/codex.js';
import { COLLECTIONS } from '../src/data/codex.js';
import { bossesForStage, createCombat, isGauntletStage, rebirthHeat, step, zoneStartStage } from '../src/core/combat.js';
import { activeSynergies, companionEffects, replaceCompanion } from '../src/core/companions.js';
import { completeDungeon, startDungeon, unlockedDifficulties } from '../src/core/dungeon.js';
import { buyUpgradeBulk } from '../src/core/economy.js';
import { earlyBoost } from '../src/core/boost.js';
import { summon, summonPool } from '../src/core/gacha.js';
import { addToInventory, collectItem } from '../src/core/inventory.js';
import { applyLoadout, saveLoadout } from '../src/core/loadouts.js';
import { makeItem } from '../src/core/loot.js';
import { newContract } from '../src/core/contracts.js';
import { Rng } from '../src/core/rng.js';
import { createNewState, sanitizeState } from '../src/core/state.js';

const NOW = new Date(2026, 9, 21, 12).getTime(); // un mercredi

test('11 mondes : le monde 11 a 10 étapes, chacune contre un méga boss berserk qui invoque ses boss', () => {
  assert.equal(ZONES.length, 11);
  const start = zoneStartStage(10);
  assert.equal(start, 201);
  assert.ok(isGauntletStage(start) && isGauntletStage(start + 9) && !isGauntletStage(start + 10));
  assert.deepEqual(bossesForStage(start + 6), ZONES[6].bosses);
  for (const z of ZONES.slice(0, 10)) {
    for (const id of [...z.bosses, ...Object.values(z.tierBosses ?? {})]) assert.ok(BOSSES[id], id);
  }
  // Combat : le méga boss est berserk et appelle ses 3 boss à 75 %, 50 % et 25 % de PV.
  const state = createNewState(NOW, 3);
  state.maxStage = start;
  state.stage = start;
  state.upgrades.vitality = 2000;
  const world = createCombat(state);
  const rng = new Rng(7);
  const summons = new Set();
  let boss = null;
  for (let i = 0; i < 2000 && summons.size < 3; i++) {
    step(state, world, 0.05, rng);
    for (const e of world.events) if (e.type === 'bossSummon') summons.add(e.kind);
    world.events.length = 0;
    boss ??= world.enemies.find((e) => e.boss && !e.summoned);
    if (!boss) continue;
    assert.ok(boss.berserk);
    // On abaisse les PV du boss d'un palier, et on écarte ses invocations pour que le héros le frappe.
    world.enemies = world.enemies.filter((e) => !e.summoned);
    boss.hp = Math.min(boss.hp, boss.maxHp * (0.7 - 0.25 * summons.size));
  }
  assert.equal(summons.size, 3, [...summons].join());
});

test('donjons : difficultés débloquées une à une, plus durs, et ils rapportent des fragments', () => {
  const state = createNewState(NOW, 4);
  state.maxStage = 40;
  state.keys = 5;
  assert.deepEqual(unlockedDifficulties(state, 'crypt'), ['easy']);
  assert.equal(startDungeon(state, 'crypt', 'any', 'gold', 'hard'), false);
  assert.ok(startDungeon(state, 'crypt', 'any', 'gold', 'easy'));
  assert.ok(state.dungeon.level < state.maxStage); // v8.3 : Facile = sous l'étape max
  const fragments = state.fragments;
  completeDungeon(state, new Rng(1));
  assert.ok(state.fragments > fragments);
  assert.deepEqual(unlockedDifficulties(state, 'crypt'), ['easy', 'normal']);
  assert.ok(startDungeon(state, 'crypt', 'any', 'gold', 'normal'));
  assert.ok(state.dungeon.level >= state.maxStage - 4);
});

test('recyclage automatique « sac plein » : libère de la place selon les règles', () => {
  const state = createNewState(NOW, 5);
  state.ui.recycle = { mode: 'full', rarities: ['common'], slots: ['helmet'] };
  state.equipment.helmet = makeItem(state, 'iron_helm', 'legendary', 50); // casque porté bien meilleur
  for (let i = 0; i < BALANCE.loot.inventorySize; i++) addToInventory(state, makeItem(state, i % 2 ? 'dagger' : 'iron_helm', 'common', 1));
  const locked = state.inventory.find((i) => i.slot === 'helmet');
  locked.locked = true;
  const res = collectItem(state, makeItem(state, 'dagger', 'rare', 1));
  assert.ok(res.added);
  assert.ok(state.inventory.includes(locked), 'objet verrouillé conservé');
  assert.ok(state.inventory.every((i) => i.slot !== 'helmet' || i.locked), 'casques communs recyclés');
});

test('synergies, remplacement et configurations d’équipe', () => {
  const state = createNewState(NOW, 6);
  for (const id of ['pyromancer', 'priestess', 'ranger', 'cat']) state.companions.owned[id] = { stars: 1, level: 1 };
  state.companions.equipped = ['pyromancer', 'priestess'];
  const ids = activeSynergies(state).map((s) => s.id);
  assert.ok(ids.includes('arcane_guard') && ids.includes('arcane_link'));
  assert.ok(companionEffects(state).maxHpPct > 0);
  assert.ok(saveLoadout(state, 0));
  assert.ok(replaceCompanion(state, 'ranger', 'priestess'));
  assert.deepEqual(state.companions.equipped, ['pyromancer', 'ranger']);
  assert.ok(applyLoadout(state, 0));
  assert.deepEqual(state.companions.equipped, ['pyromancer', 'priestess']);
});

test('codex : collections avec paliers de récompenses', () => {
  const state = createNewState(NOW, 7);
  for (const id of ['slime', 'goblin', 'boar', 'mandrake', 'wolf']) state.codex.kills[id] = 1;
  const monsters = COLLECTIONS.find((c) => c.id === 'monsters');
  assert.ok(collectionStatus(state, monsters).ready);
  const gems = state.gems;
  assert.ok(claimCollection(state, 'monsters'));
  assert.ok(state.gems > gems);
  assert.equal(claimCollection(state, 'monsters'), null);
  const back = sanitizeState(JSON.parse(JSON.stringify(state)), BALANCE, NOW);
  assert.deepEqual(back.codex, state.codex);
});

test('codes de triche : ×100 sans limite de durée (v8.7), révélation des donjons', () => {
  const state = createNewState(NOW, 8);
  assert.equal(applyCheat(state, 'nope'), null);
  assert.ok(applyCheat(state, 'turbo100'));
  assert.ok(earlyBoost(state, BALANCE, NOW).gold >= 100);
  assert.equal(earlyBoost(state, BALANCE, NOW + 2 * 3600 * 1000).cheat, 100);
  assert.ok(applyCheat(state, 'ORACLE'));
  assert.ok(state.cheats.reveal);
});

test('invocations séparées, achat groupé, contrats rares, boss adaptés aux Renaissances', () => {
  assert.ok(summonPool('ally').every((u) => u.ally));
  assert.ok(summonPool('pet').every((u) => !u.ally));
  const state = createNewState(NOW, 9);
  state.gems = 900;
  const pets = summon(state, new Rng(3), 10, 'gems', BALANCE, 'pet');
  assert.ok(pets.every((u) => !u.ally));
  state.gold = 1e6;
  assert.equal(buyUpgradeBulk(state, 'damage', '10'), 10);
  assert.ok(buyUpgradeBulk(state, 'damage', 'max') > 0);
  let rare = 0;
  for (let i = 0; i < 200; i++) rare += newContract(state, new Rng(i)).rare ? 1 : 0;
  assert.ok(rare > 5 && rare < 60);
  state.records.rebirths = 2;
  const heat = rebirthHeat(state);
  assert.ok(heat.boss > 1 && heat.reward > 1);
});
