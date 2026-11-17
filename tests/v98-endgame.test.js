// v9.8 (A) : bloquant — en Cycle ×3, plus rien ne mourait (surcroît de PV de la campagne appliqué aux cycles :
// ×200 000). Sauvegarde de référence fin de jeu : un monstre ordinaire meurt en moins de 10 s.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sanitizeState } from '../src/core/state.js';
import { campaignHp, CAMPAIGN_CAP, createCombat, levelsPerCycle, step } from '../src/core/combat.js';
import { Rng } from '../src/core/rng.js';

const ref = () => sanitizeState(JSON.parse(readFileSync(new URL('./fixtures/endgame.json', import.meta.url))));

test('surcroît de campagne : premier cycle seulement, plafonné', () => {
  assert.equal(campaignHp(levelsPerCycle() + 10), 1);
  assert.equal(campaignHp(2 * levelsPerCycle() + 100), 1);
  for (let n = 0; n < levelsPerCycle(); n += 7) assert.ok(campaignHp(n) <= CAMPAIGN_CAP);
});

test('sauvegarde de référence (Cycle ×3, niveau 140) : un monstre ordinaire meurt en moins de 10 s', () => {
  const s = ref();
  assert.ok(!s.unlocks, 'ancienne partie : pas de courbe de campagne');
  const w = createCombat(s);
  const rng = new Rng(1);
  const k0 = s.records.kills;
  let t = 0;
  while (t < 30 && s.records.kills === k0) { step(s, w, 0.05, rng); w.events.length = 0; t += 0.05; }
  assert.ok(s.records.kills > k0 && t < 10, `premier monstre tué en ${t.toFixed(1)} s`);
});
