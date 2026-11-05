// v9.2.3 : apparence des mutations (render/mutation-look.js) et portée du Géant (core/mutations.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { MUTATION_SIZE, SPLIT_CHILD_SIZE, eyePixels, mutationSize, recolor } from '../src/render/mutation-look.js';
import { maybeMutate, MUTATIONS } from '../src/core/mutations.js';

test('taille des mutés : géant ×1,5 à ×1,7, scissipare plus petit, doubles encore plus petits', () => {
  assert.ok(MUTATION_SIZE.giant >= 1.5 && MUTATION_SIZE.giant <= 1.7);
  assert.ok(MUTATION_SIZE.split < 1);
  assert.equal(mutationSize({ mutation: 'giant' }), MUTATION_SIZE.giant);
  assert.equal(mutationSize({ mutation: 'armored' }), 1);
  assert.equal(mutationSize({ splitChild: true }), SPLIT_CHILD_SIZE);
  assert.equal(mutationSize(null), 1);
});

test('recoloration : frénétique rougit, vampirique bleuit/violette, cuirassé se désature', () => {
  const [r, g] = recolor('frenzied', 120, 120, 120);
  assert.ok(r > g + 40);
  const [vr, vg, vb] = recolor('vampire', 120, 120, 120);
  assert.ok(vb > vg && vr > vg);
  const [ar, ag, ab] = recolor('armored', 200, 80, 40);
  assert.ok(Math.abs(ar - ag) < 120 && ab > 40);
  assert.deepEqual(recolor('inconnue', 1, 2, 3), [1, 2, 3]);
});

test('yeux du frénétique : deux pixels sombres de la tête, du côté gauche', () => {
  const w = 12, h = 16, d = new Uint8ClampedArray(w * h * 4);
  for (let y = 2; y < 14; y++) for (let x = 2; x < 10; x++) { const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 200; d[i + 3] = 255; }
  for (const [x, y] of [[3, 4], [5, 4]]) { const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 10; }
  assert.deepEqual(eyePixels(d, w, h).sort((a, b) => a[0] - b[0]), [[3, 4], [5, 4]]);
});

test('le Géant s\'arrête plus loin (portée +6) et le scissipare plus près', () => {
  const rng = (vals) => { let i = 0; return { next: () => vals[i++ % vals.length] } };
  const state = { maxStage: 50, transcend: { count: 0 } };
  const pick = (id) => MUTATIONS.findIndex((m) => m.id === id) / MUTATIONS.length + 0.001;
  const giant = { hp: 10, maxHp: 10, gold: 1, speed: 1, range: 16, attackInterval: 1, attackTimer: 1 };
  maybeMutate(state, giant, rng([0, pick('giant')]));
  assert.equal(giant.mutation, 'giant');
  assert.equal(giant.range, 22);
  const split = { hp: 10, maxHp: 10, gold: 1, speed: 1, range: 16, attackInterval: 1, attackTimer: 1 };
  maybeMutate(state, split, rng([0, pick('split')]));
  assert.equal(split.range, 14);
});
