import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BALANCE } from '../src/data/balance.js';
import { TALENT_BRANCHES, TALENTS } from '../src/data/rebirth.js';
import { toggleCompanion } from '../src/core/companions.js';
import { computeOfflineRewards } from '../src/core/offline.js';
import { Rng } from '../src/core/rng.js';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { computeHeroStats } from '../src/core/stats.js';
import { enemyStats } from '../src/core/combat.js';

test('équipe : le chevalier, 2 personnages et 1 compagnon au maximum', () => {
  const state = createNewState(0, 1);
  const owned = ['golden_slime', 'cat', 'squire', 'ninja', 'archangel'];
  state.companions.owned = Object.fromEntries(owned.map((id) => [id, { stars: 1, level: 1 }]));
  assert.ok(toggleCompanion(state, 'golden_slime'));
  assert.ok(toggleCompanion(state, 'cat')); // le compagnon remplace l'ancien
  assert.deepEqual(state.companions.equipped, ['cat']);
  assert.ok(toggleCompanion(state, 'squire'));
  assert.ok(toggleCompanion(state, 'ninja'));
  assert.equal(toggleCompanion(state, 'archangel'), false, '2 personnages au maximum');
  assert.deepEqual(state.companions.equipped, ['cat', 'squire', 'ninja']);
  // Une sauvegarde avec trop de membres est ramenée à 2 personnages + 1 compagnon.
  const raw = JSON.parse(JSON.stringify(state));
  raw.companions.equipped = ['golden_slime', 'cat', 'squire', 'ninja', 'archangel'];
  assert.deepEqual(sanitizeState(raw).companions.equipped, ['golden_slime', 'squire', 'ninja']);
});

test('hors ligne : 65 % du farm actif, plafonné à 24 h', () => {
  assert.equal(BALANCE.offline.capHours, 24);
  assert.equal(BALANCE.offline.farmMultiplier, 0.65);
  const state = createNewState(0, 2);
  const day = computeOfflineRewards(state, 1000, 1000 + 24 * 3600 * 1000, new Rng(1));
  const twoDays = computeOfflineRewards(state, 1000, 1000 + 48 * 3600 * 1000, new Rng(1));
  assert.equal(twoDays.countedSeconds, 24 * 3600);
  assert.ok(twoDays.capped && !day.capped);
  assert.equal(twoDays.gold, day.gold);
});

test('arbre de talents : un seul arbre qui part du Cœur du chevalier', () => {
  const seen = new Set();
  const core = TALENTS.find((t) => t.id === 'core');
  assert.ok(core && !core.requires, 'nœud central');
  for (const t of TALENTS) {
    if (t === core) continue;
    assert.ok(TALENT_BRANCHES.some((b) => b.id === t.branch), t.id);
    const key = `${t.branch}:${t.row}:${t.col}`;
    assert.ok(!seen.has(key), `deux talents en ${key}`);
    seen.add(key);
    const parent = TALENTS.find((p) => p.id === t.requires?.id);
    if (t.row === 0) assert.equal(parent, core, `${t.id} : part du centre`);
    else assert.ok(parent && parent.branch === t.branch && parent.row === t.row - 1, `${t.id} : parent`);
  }
  // Chaque branche se divise en deux.
  for (const b of TALENT_BRANCHES) {
    const root = TALENTS.find((t) => t.branch === b.id && t.row === 0);
    assert.ok(TALENTS.filter((t) => t.requires?.id === root.id).length >= 2, b.id);
  }
  // Une ancienne partie avec des talents reçoit le Cœur (ses branches restent accessibles).
  const raw = JSON.parse(JSON.stringify(createNewState(0, 9)));
  raw.talents = { power: 3 };
  assert.equal(sanitizeState(raw).talents.core, 1);
});

test('PV : palier ×1,4 tous les 10 niveaux de Points de vie', () => {
  const state = createNewState(0, 3);
  state.upgrades.vitality = 9;
  const before = computeHeroStats(state).maxHp;
  state.upgrades.vitality = 10;
  const after = computeHeroStats(state).maxHp;
  assert.ok(after / before > 1.35, `${before} -> ${after}`);
});

test('équilibrage : un boss ne tue pas en un coup un chevalier au niveau de sa zone', () => {
  // Chevalier « au niveau » : PV des paliers de Points de vie atteignables à cette étape.
  for (const stage of [10, 20, 30, 40]) {
    const boss = enemyStats(stage, 'ash_dragon', true);
    const state = createNewState(0, 4);
    state.upgrades.vitality = stage;
    state.level = Math.round(stage * 0.7);
    assert.ok(boss.damage < computeHeroStats(state).maxHp * 0.5, `étape ${stage} : ${Math.round(boss.damage)} dégâts`);
  }
});
