// v9.2.1 : déplacement propre à chaque monde (src/data/traversal.js, src/render/traversal-fx.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ZONES } from '../src/data/zones.js';
import { TRAVERSAL, traversalFor } from '../src/data/traversal.js';
import { installTraversalFx } from '../src/render/traversal-fx.js';

test('chaque monde a son style, le monde 1 marche normalement, les mondes 2 à 12 ont chacun le leur', () => {
  for (const z of ZONES) assert.ok(TRAVERSAL[z.id], z.id);
  assert.equal(traversalFor('plains').style, 'walk');
  const styles = ZONES.slice(1).map((z) => traversalFor(z.id).style);
  assert.equal(new Set(styles).size, styles.length);
  assert.ok(!styles.includes('walk'));
  assert.equal(traversalFor('inconnu').style, 'walk');
});

function scene(zone, { focus = false, walking = true } = {}) {
  const s = { time: 0, focus, groundY: 100, width: 200, effects: [] };
  installTraversalFx(s);
  s.setTraversal({ id: zone });
  s.travWalking = walking;
  return s;
}

test('hauteurs : marais enfoncé, néant en lévitation, nuages en bonds ; réduire les animations = hauteur fixe', () => {
  assert.ok(scene('swamp').travLift(0) < 0);
  assert.ok(scene('void').travLift(0) >= 4);
  const sky = scene('sky');
  const hs = [];
  for (let t = 0; t < 1; t += 0.05) { sky.time = t; hs.push(sky.travLift(0)); }
  assert.ok(Math.max(...hs) > Math.min(...hs) + 6);
  const calm = scene('sky', { focus: true });
  for (let t = 0; t < 1; t += 0.1) { calm.time = t; assert.equal(calm.travLift(0), 5); }
  assert.ok(hs.every(Number.isInteger));
});

test('glissade : poses de repos majoritaires ; lévitation : jamais de pas ; marais : cadence lente', () => {
  const ice = scene('mountains');
  let rest = 0;
  for (let t = 0; t < 4; t += 0.01) { ice.time = t; if (ice.travWalk(0, true) === 0) rest++; }
  assert.ok(rest > 250);
  const v = scene('void');
  for (let t = 0; t < 2; t += 0.05) { v.time = t; assert.equal(v.travWalk(0, true), 0); }
  const count = (z) => { const s = scene(z); let n = 0, prev; for (let t = 0; t < 4; t += 0.005) { s.time = t; const k = s.travWalk(0, true); if (k !== prev) n++; prev = k; } return n; };
  assert.ok(count('swamp') < count('plains') * 0.7);
});

test('réduire les animations : aucun effet ni trace aux pieds', () => {
  for (const z of Object.keys(TRAVERSAL)) {
    const s = scene(z, { focus: true });
    for (let t = 0; t < 3; t += 0.03) { s.time = t; s.travFeet('h', 50, true, 0); }
    assert.equal(s.effects.length, 0, z);
    assert.equal((s.travMarks ?? []).length, 0, z);
  }
});
