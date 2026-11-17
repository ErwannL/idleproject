// v9.7.1 (lot 3) : déblocages par mini-quêtes (3 gestes), dans l'ordre ; compagnon d'histoire ; anciennes parties.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { BALANCE } from '../src/data/balance.js';
import { UNLOCK_IDS, advanceUnlocks, currentQuest, isUnlocked, questSteps } from '../src/core/unlock-quests.js';
import { canRebirth } from '../src/core/rebirth.js';

const NOW = 1_700_000_000_000;

test('ordre conseillé, un système à la fois', () => {
  assert.deepEqual(UNLOCK_IDS, ['equipment', 'upgrades', 'skills', 'companion', 'forge', 'summon', 'dungeons', 'talents', 'challenges', 'rebirth']);
  const s = createNewState(NOW); s.unlocks = { done: [], base: { ...s.records } };
  assert.equal(currentQuest(s).id, 'equipment');
  assert.ok(isUnlocked(s, 'equipment') && !isUnlocked(s, 'upgrades'), 'la quête en cours ouvre son système, pas la suivante');
  s.records.kills += 10; s.records.itemsFound += 1; s.records.equips = 1;
  assert.ok(questSteps(s).every((x) => x.done));
  assert.equal(advanceUnlocks(s).id, 'equipment');
  assert.equal(currentQuest(s).id, 'upgrades');
  assert.equal(advanceUnlocks(s), null, 'la suivante repart de zéro');
});

test('compagnon d\'histoire à la fin du monde 1 ; Renaissance après le monde 3', () => {
  const s = createNewState(NOW); s.unlocks = { done: ['equipment', 'upgrades', 'skills'], base: { ...s.records } };
  s.records.bossesDefeated = 1; s.maxStage = 21;
  assert.equal(advanceUnlocks(s).id, 'companion');
  assert.ok(s.companions.owned.priestess && s.companions.equipped.includes('priestess'));
  s.maxStage = 40;
  assert.ok(!canRebirth(s), 'pas de Renaissance avant la quête');
});

test('ancienne partie : tout reste ouvert', () => {
  const old = JSON.parse(JSON.stringify(createNewState(NOW))); old.maxStage = 40;
  const s = sanitizeState(old, BALANCE, NOW);
  assert.ok(isUnlocked(s, 'summon') && isUnlocked(s, 'forge') && currentQuest(s) === null);
});
