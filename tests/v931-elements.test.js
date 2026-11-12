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

import { createCombat, step } from '../src/core/combat.js';
import { createNewState } from '../src/core/state.js';
import { Rng } from '../src/core/rng.js';

test('v9.5.1 types : +50 % / −30 % (avant +25 / −20), héros neutre, cas neutres', () => {
  assert.equal(ADV, 1.5);
  assert.equal(WEAK, 0.7);
  assert.equal(elementMultiplier(null, 'dark'), 1, 'héros neutre contre tout');
  assert.equal(elementMultiplier('dark', null), 1, 'ennemi contre héros neutre');
  assert.equal(elementMultiplier('light', 'red'), 1, 'lumière ne domine pas les 3 types');
  assert.equal(elementMultiplier('red', 'dark'), 1);
  for (const a of Object.keys(ELEMENTS)) assert.equal(elementMultiplier(a, a), 1, `${a} contre ${a}`);
});

test('v9.3.2 types en combat : le héros frappe en neutre, chaque coup de compagnon porte un seul multiplicateur', () => {
  const state = createNewState(0, 1);
  state.companions.owned.pyromancer = { level: 10, stars: 1 };
  state.companions.equipped = ['pyromancer'];
  const world = createCombat(state);
  world.recordEvents = true;
  const rng = new Rng(3);
  const hits = [];
  for (let i = 0; i < 1200; i++) { world.events = []; step(state, world, 0.05, rng); for (const e of world.events) if (e.type === 'enemyHit') hits.push(e); }
  const enemyEl = ZONE_ELEMENT[0]; // plaines : vert
  const hero = hits.filter((h) => h.source === 'attack');
  const comp = hits.filter((h) => h.source === 'companion');
  assert.ok(hero.length > 0);
  assert.ok(hero.every((h) => h.elem === 1), 'héros neutre');
  assert.ok(comp.length > 0, 'la pyromancienne a frappé');
  assert.ok(comp.every((h) => h.elem === elementMultiplier('red', enemyEl)), 'pyromancienne rouge contre vert : +25 % une fois');
});
