// v9.1.3 : hauts faits justes (S1 : Ménagerie complète atteignable, S1b : records d'étape et de niveau).
import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/data/balance.js';
import { COMPANIONS } from '../src/data/companions.js';
import { ACHIEVEMENTS, achievementProgress } from '../src/core/achievements.js';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { addXp } from '../src/core/level.js';

const ach = (id) => ACHIEVEMENTS.find((a) => a.id === id);

test('S1 : Ménagerie complète = tous les compagnons et familiers existants', () => {
  const state = createNewState(0, 1);
  assert.equal(ach('team3').target, COMPANIONS.length);
  for (const c of COMPANIONS) state.companions.owned[c.id] = { level: 1, stars: 1 };
  state.companions.owned.inconnu = { level: 1 };
  const p = achievementProgress(state, ach('team3'));
  assert.equal(p.value, COMPANIONS.length);
  assert.ok(p.done);
});

test('S1b : étape et niveau ne retombent pas après une Renaissance', () => {
  const state = createNewState(0, 2);
  addXp(state, 1e12);
  const lvl = state.level;
  assert.ok(lvl > 25);
  assert.equal(state.records.bestLevel, lvl);
  state.records.bestStage = 120;
  state.maxStage = 120;
  // Renaissance : niveau et étape repartent à 1.
  state.level = 1; state.maxStage = 1; state.stage = 1;
  assert.ok(achievementProgress(state, ach('lvl1')).done);
  assert.ok(achievementProgress(state, ach('stage2')).done);
  const back = sanitizeState(JSON.parse(JSON.stringify(state)), BALANCE, 0);
  assert.equal(back.records.bestLevel, lvl);
});

test('S1b : migration — record de niveau initialisé depuis l\'état et les hauts faits réclamés', () => {
  const raw = JSON.parse(JSON.stringify(createNewState(0, 3)));
  delete raw.records.bestLevel;
  raw.level = 40;
  let back = sanitizeState(raw, BALANCE, 0);
  assert.equal(back.records.bestLevel, 40);
  raw.level = 3;
  raw.achievements = { claimed: { lvl2: true, stage3: true } };
  back = sanitizeState(raw, BALANCE, 0);
  assert.equal(back.records.bestLevel, 100);
  assert.ok(back.records.bestStage >= 141);
});
