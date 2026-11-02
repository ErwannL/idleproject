// v9.1.3 (doc3 lot 3) : relance orientée, monde de la Prime du jour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/data/balance.js';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { canTargetReroll, targetReroll, targetRerollChoices, targetRerollCost } from '../src/core/forge.js';
import { makeItem } from '../src/core/loot.js';
import { AFFIXES, RARITIES } from '../src/data/items.js';
import { REPEATABLE, TOUCH_REPEATABLE } from '../src/ui/hold.js';
import { Rng } from '../src/core/rng.js';
import { bountyProgress, bountyZones, dailyBounty, setBountyZone } from '../src/core/bounty.js';
import { zoneIndexForStage } from '../src/core/combat.js';

const NOW = Date.UTC(2026, 10, 2, 12);

test('relance orientée : prix, raretés, cibles sans dropChance', () => {
  const s = createNewState(NOW, 3);
  const rare = makeItem(s, 'plate_armor', 'rare', 10, BALANCE, new Rng(1));
  const epic = makeItem(s, 'plate_armor', 'epic', 10, BALANCE, new Rng(1));
  const leg = makeItem(s, 'plate_armor', 'legendary', 10, BALANCE, new Rng(1));
  const accE = makeItem(s, 'necklace_ruby', 'epic', 10, BALANCE, new Rng(1));
  const accL = makeItem(s, 'necklace_ruby', 'legendary', 10, BALANCE, new Rng(1));
  assert.equal(canTargetReroll(rare), false);
  assert.deepEqual([epic, accE, leg, accL].map((i) => targetRerollCost(i)), [100, 140, 60, 80]);
  assert.equal(BALANCE.forge.reforgeShards, 20, 'relance au hasard : 10 éclats + 1 essence');
  for (const i of [epic, leg, accE, accL]) assert.ok(!targetRerollChoices(i).includes('dropChance'));
  assert.ok(!targetRerollChoices(accE).includes('critChance'), 'effet principal du Collier exclu');
  assert.ok(!REPEATABLE.has('target-reroll') && !TOUCH_REPEATABLE.has('target-reroll'));
});

test('relance orientée : 1re ligne imposée (±20 %), le reste au hasard, éclats payés', () => {
  const s = createNewState(NOW, 3);
  const leg = makeItem(s, 'plate_armor', 'legendary', 10, BALANCE, new Rng(1));
  s.inventory.push(leg);
  s.materials.shards = 1000;
  const rng = new Rng(9);
  const seconds = new Set();
  for (let n = 0; n < 40; n++) {
    assert.ok(targetReroll(s, leg.id, 'thorns', rng));
    assert.equal(leg.affixes[0].type, 'thorns');
    const b = AFFIXES.thorns.base * RARITIES.find((r) => r.id === 'legendary').statMultiplier;
    assert.ok(leg.affixes[0].value >= Math.floor(b * 0.8) && leg.affixes[0].value <= Math.ceil(b * 1.2), `±20 % : ${leg.affixes[0].value}`);
    assert.notEqual(leg.affixes[1].type, 'thorns');
    seconds.add(leg.affixes[1].type);
    if (s.materials.shards < 60) break;
  }
  assert.ok(seconds.size > 1, '2e ligne au hasard');
  assert.equal(s.materials.shards, 1000 - 60 * 16);
  s.materials.shards = 59;
  assert.equal(targetReroll(s, leg.id, 'thorns', rng), false, 'pas assez d\'éclats');
  s.materials.shards = 500;
  assert.equal(targetReroll(s, leg.id, 'dropChance', rng), false, 'dropChance refusé');
  assert.equal(s.materials.shards, 500);
  // Collier Épique : effet principal gardé, la ligne tirée est la cible.
  const acc = makeItem(s, 'necklace_ruby', 'epic', 10, BALANCE, new Rng(2));
  s.inventory.push(acc);
  assert.ok(targetReroll(s, acc.id, 'goldPct', rng));
  assert.equal(acc.affixes[0].type, 'critChance');
  assert.equal(acc.affixes[1].type, 'goldPct');
  assert.equal(s.materials.shards, 500 - 140);
});

test('Prime du jour : monde choisi parmi les mondes atteints (record), progression gardée', () => {
  const s = createNewState(NOW, 5);
  s.maxStage = 70; s.records.bestStage = 70;
  const b = dailyBounty(s, NOW);
  const zones = bountyZones(s);
  assert.equal(zones.length, zoneIndexForStage(70) + 1);
  s.codex.kills[b.type] = (s.codex.kills[b.type] ?? 0) + 40;
  assert.equal(bountyProgress(s, NOW), 40);
  const other = zones.find((z) => z !== b.zone);
  assert.ok(setBountyZone(s, other, NOW));
  assert.equal(s.bounty.zone, other);
  assert.equal(bountyProgress(s, NOW), 40, 'victoires gardées');
  assert.equal(setBountyZone(s, zones.length, NOW), false, 'monde non atteint refusé');
  // Après une Renaissance, le record compte (pas maxStage).
  s.maxStage = 1;
  assert.deepEqual(bountyZones(s), zones);
  // Sauvegarde : un départ négatif (progression transférée) survit au chargement.
  const loaded = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(loaded.bounty.zone, other);
  assert.equal(bountyProgress(loaded, NOW), 40);
  s.bounty.claimed = true;
  assert.equal(setBountyZone(s, b.zone, NOW), false, 'prime récupérée : plus de changement');
});
