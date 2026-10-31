import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILD } from '../src/core/build-info.js';
import { sanitizeCheats } from '../src/core/cheats.js';
import { applyCheat } from '../src/core/cheat-codes.js';
import { stripCheats } from '../src/core/cloud-save.js';
import { createNewState, sanitizeState } from '../src/core/state.js';

test('version publique : codes de triche désactivés, cloud actif', () => {
  assert.equal(BUILD.name, 'public');
  assert.equal(BUILD.cheats, false);
  assert.equal(BUILD.cloud, true);
});

test('version publique : aucun code n\'est appliqué, même saisi directement', () => {
  const state = createNewState(Date.now());
  assert.equal(applyCheat(state, 'GEMRAIN', 1000), null);
  assert.equal(applyCheat(state, 'SKIPBATTLE', 1), null);
  assert.equal(applyCheat(state, 'TURBO100', 1), null);
  assert.equal(state.gems, 0);
  assert.equal(state.cheats.skipBattle, undefined);
});

test('version publique : l\'état de triche d\'une ancienne sauvegarde est ignoré au chargement', () => {
  const cleaned = sanitizeCheats({ effects: [{ code: 'TURBO100', count: 5 }], reveal: true, speeds: [100], skipBattle: true });
  assert.deepEqual(cleaned, { effects: [], reveal: false, speeds: [], skipBattle: false });
  const state = sanitizeState({ version: 9, level: 3, cheats: { skipBattle: true, speeds: [10] } });
  assert.equal(state.cheats.skipBattle, false);
  assert.deepEqual(state.cheats.speeds, []);
});

test('synchro : la sauvegarde envoyée au serveur ne contient pas de triche', () => {
  const json = JSON.stringify({ lastSaved: 5, level: 3, cheats: { effects: [{ code: 'GEMRAIN' }], reveal: true, speeds: [2], skipBattle: false } });
  const cleaned = JSON.parse(stripCheats(json));
  assert.equal(cleaned.level, 3);
  assert.equal(cleaned.cheats.effects.length, 0);
  assert.equal(cleaned.cheats.reveal, false);
  assert.equal(stripCheats(null), null);
});
