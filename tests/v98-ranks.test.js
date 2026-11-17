// v9.8 (H6) : Rangs du héros.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { RANKS, canDuel, duelOutcome, heroRank, rankMult, winDuel } from '../src/core/ranks.js';

test('20 rangs nommés, duel au bon niveau, +3 % par rang', () => {
  assert.equal(RANKS.length, 20);
  assert.equal(new Set(RANKS.map((r) => r.name)).size, 20);
  const s = createNewState(1);
  assert.equal(heroRank(s), 0);
  assert.equal(canDuel(s), false);
  s.level = 10;
  assert.ok(canDuel(s));
  assert.equal(duelOutcome(s, 1).won, false, 'un héros sans dégâts perd');
  assert.equal(duelOutcome(s, 1e12).won, true);
  winDuel(s);
  assert.equal(heroRank(s), 1);
  assert.ok(Math.abs(rankMult(s) - 1.03) < 1e-9);
});

test('une partie d\'avant garde ses paliers de puissance en rangs', () => {
  const s = createNewState(1); s.level = 57;
  const raw = JSON.parse(JSON.stringify(s)); delete raw.rank;
  assert.equal(sanitizeState(raw).rank, 5);
});
