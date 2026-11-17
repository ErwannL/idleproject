// v9.8 (H2) : balayage d'un donjon déjà réussi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState } from '../src/core/state.js';
import { canSweepDungeon, sweepDungeon } from '../src/core/dungeon.js';
import { DUNGEONS } from '../src/data/dungeons.js';
import { Rng } from '../src/core/rng.js';

test('balayage : seulement après une victoire, coûte une clé, rapporte la récompense', () => {
  const s = createNewState(1_700_000_000_000);
  const d = DUNGEONS[0];
  s.maxStage = d.unlockStage + 5; s.keys = 3;
  assert.equal(canSweepDungeon(s, d.id), false, 'jamais réussi');
  s.dungeonBest[d.id] = 0; s.dungeonsCleared[d.id] = 1;
  const gems = s.gems;
  const r = sweepDungeon(s, d.id, new Rng(7));
  assert.ok(r && r.sweep && r.item);
  assert.equal(s.keys, 2);
  assert.equal(s.dungeon, null);
  assert.ok(s.gems > gems);
  assert.equal(canSweepDungeon(s, d.id, 'hard'), false, 'difficulté pas encore gagnée');
});
