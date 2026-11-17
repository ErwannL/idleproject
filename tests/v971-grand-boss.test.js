// v9.7.1 (lot 7) : moteur commun des grands boss — le Colosse est une fiche, un second boss d'essai défini par sa seule
// fiche se lance sans toucher au code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState } from '../src/core/state.js';
import { WorldBossFight, WORLD_BOSS } from '../src/core/world-boss.js';
import { GRAND_BOSSES } from '../src/data/grand-bosses.js';

const NOW = 1_700_000_000_000;

test('chaque fiche est complète', () => {
  for (const [id, b] of Object.entries(GRAND_BOSSES)) {
    assert.equal(b.id, id);
    for (const k of ['dir', 'prefix', 'frame', 'foot', 'anims', 'eyes', 'hands', 'beamColors']) assert.ok(b.art[k] !== undefined, `${id}.art.${k}`);
    for (const k of ['boss', 'name', 'seconds', 'phases', 'abilities', 'tiers']) assert.ok(b.fight[k] !== undefined, `${id}.fight.${k}`);
    assert.ok(b.fight.phases.every((p, i, a) => i === 0 || p.at < a[i - 1].at), 'seuils de vie décroissants');
  }
  assert.equal(WORLD_BOSS, GRAND_BOSSES.colossus.fight, 'le Colosse est la fiche colossus');
});

test('le boss d\'essai (fiche seule) se lance et se termine', () => {
  const s = createNewState(NOW); s.level = 30; s.maxStage = 40;
  const f = new WorldBossFight(s, { bossId: 'shade', seed: 2, maxHp: 1e6 });
  assert.equal(f.cfg.name, 'Ombre du Colosse');
  const r = f.finish();
  assert.ok(r.damage > 0 && f.time >= GRAND_BOSSES.shade.fight.seconds - 0.05);
  const story = new WorldBossFight(s, { bossId: 'colossus', seconds: 10, maxHp: 1e9 });
  story.finish();
  assert.ok(story.time <= 10.05, 'face-à-face de l\'histoire : durée de la fiche remplacée (10 s au monde 1)');
});
