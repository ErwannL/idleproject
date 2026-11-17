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

import { DAY_TITANS } from '../src/data/grand-bosses.js';
import { finishTitan, startTitan, titanToday, titanTriesLeft } from '../src/core/titan.js';
test('Titan du jour : 7 titans, 2 essais, tranche payée une fois', () => {
  assert.equal(DAY_TITANS.length, 7);
  const s = createNewState(1); s.maxStage = 50; s.level = 30;
  const now = 1_800_000_000_000;
  assert.equal(titanToday(now).id, DAY_TITANS[new Date(now).getDay()].id);
  const a = startTitan(s, now);
  assert.ok(a && titanTriesLeft(s, now) === 1);
  const r1 = finishTitan(s, a, { damage: a.maxHp * 0.7 }, now);
  assert.equal(r1.tier, 'Top 10 %'); assert.ok(r1.given);
  const b = startTitan(s, now);
  const r2 = finishTitan(s, b, { damage: a.maxHp * 0.9 }, now);
  assert.equal(r2.given, null, 'déjà payée');
  assert.equal(startTitan(s, now), null);
});
