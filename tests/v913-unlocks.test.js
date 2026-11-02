// v9.1.3 (lot F) : Coffre et Forge s'ouvrent à un seuil, puis restent visibles s'ils ont servi (mannequins fondus dans le coffre).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { INV_UNLOCKS, invFeatureOpen, markInvUsed, nextInvUnlock } from '../src/core/unlocks.js';
import { addToInventory } from '../src/core/inventory.js';
import { makeItem } from '../src/core/loot.js';
import { endSave, oldSave, NOW } from './helpers/v913-saves.js';

test('déblocage progressif : seuils, record d\'étape, « toujours visible si déjà utilisé »', () => {
  const s = createNewState(NOW, 3);
  assert.deepEqual(INV_UNLOCKS.map((u) => [u.id, u.stage]), [['forge', 10], ['stash', 20]]);
  for (const u of INV_UNLOCKS) assert.equal(invFeatureOpen(s, u.id), false, u.id);
  assert.equal(nextInvUnlock(s).id, 'forge');
  s.records.bestStage = 20; // Renaissance : maxStage retombe, le record reste
  s.maxStage = 1;
  assert.ok(invFeatureOpen(s, 'forge') && invFeatureOpen(s, 'stash'));
  const t = createNewState(NOW, 4);
  t.stash.push(makeItem(t, 'iron_helm', 'rare', 5));
  assert.ok(invFeatureOpen(t, 'stash'), 'coffre déjà utilisé');
  const u = createNewState(NOW, 6);
  markInvUsed(u, 'forge');
  const back = sanitizeState(JSON.parse(JSON.stringify(u)), undefined, NOW);
  assert.ok(invFeatureOpen(back, 'forge'), 'mémorisé dans la sauvegarde');
});

test('déblocage progressif : pas de rangement auto des ensembles avant l\'ouverture du coffre', () => {
  const s = createNewState(NOW, 5);
  const piece = makeItem(s, 'iron_helm', 'epic', 5, undefined, null, 'plains');
  const r = addToInventory(s, piece);
  assert.notEqual(r.mannequin, true);
  assert.ok(s.inventory.some((x) => x.id === piece.id), 'la pièce reste dans le sac');
});

test('déblocage progressif : anciennes sauvegardes — tout reste ouvert', () => {
  for (const raw of [oldSave(), endSave()]) {
    const s = sanitizeState(raw, undefined, NOW);
    for (const u of INV_UNLOCKS) assert.ok(invFeatureOpen(s, u.id), u.id);
  }
});
