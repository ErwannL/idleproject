// v9.1.3 (doc4, partie A) : héros, doublons et invocation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { normalizePool, summon } from '../src/core/gacha.js';
import { Rng } from '../src/core/rng.js';

const NOW = Date.UTC(2026, 10, 2, 12);

test('lot 0 : une seule normalisation du bassin (hero et pet respectés, le reste devient ally)', () => {
  assert.equal(normalizePool('hero'), 'hero');
  assert.equal(normalizePool('pet'), 'pet');
  assert.equal(normalizePool('ally'), 'ally');
  for (const x of [undefined, null, '', 'heroes', 'common', 42]) assert.equal(normalizePool(x), 'ally');
  // Apparences donne des apparences, jamais des compagnons.
  const s = createNewState(NOW);
  s.gems = 1e6;
  const res = summon(s, new Rng(7), 10, 'gems', undefined, normalizePool('hero'));
  assert.ok(res.every((r) => r.kind === 'hero'));
});

test('lot 0 : l\'historique garde le type (skin ou compagnon) et le nettoyage le conserve', () => {
  const s = createNewState(NOW);
  s.gems = 1e6;
  summon(s, new Rng(3), 10, 'gems', undefined, 'hero');
  summon(s, new Rng(4), 10, 'gems', undefined, 'ally');
  assert.ok(s.summon.history.every((h) => h.kind === 'hero' || h.kind === 'companion'));
  const back = sanitizeState(JSON.parse(JSON.stringify(s)), undefined, NOW);
  assert.deepEqual(back.summon.history.map((h) => h.kind), s.summon.history.map((h) => h.kind));
  // Ancienne entrée sans kind : acceptée telle quelle.
  s.summon.history = [{ id: 'fairy', rarity: 'rare', at: 1 }];
  assert.equal(sanitizeState(JSON.parse(JSON.stringify(s)), undefined, NOW).summon.history[0].kind, undefined);
});
