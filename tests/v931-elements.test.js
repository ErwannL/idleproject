import test from 'node:test';
import assert from 'node:assert/strict';
import { ADV, WEAK, ELEMENTS, UNIT_ELEMENT, ZONE_ELEMENT, elementMultiplier } from '../src/core/elements.js';
import { COMPANIONS } from '../src/data/companions.js';
import { ZONES } from '../src/data/zones.js';

test('v9.3.1 types : triangle rouge > vert > bleu > rouge, lumière ⇄ ténèbres', () => {
  assert.equal(elementMultiplier('red', 'green'), ADV);
  assert.equal(elementMultiplier('green', 'blue'), ADV);
  assert.equal(elementMultiplier('blue', 'red'), ADV);
  assert.equal(elementMultiplier('green', 'red'), WEAK);
  assert.equal(elementMultiplier('light', 'dark'), ADV);
  assert.equal(elementMultiplier('dark', 'light'), ADV);
  assert.equal(elementMultiplier('red', 'light'), 1);
  assert.equal(elementMultiplier(null, 'red'), 1);
});

test('v9.3.1 types : chaque compagnon et chaque monde a un type', () => {
  for (const c of COMPANIONS) assert.ok(ELEMENTS[UNIT_ELEMENT[c.id]], c.id);
  assert.equal(ZONE_ELEMENT.length, ZONES.length);
});
