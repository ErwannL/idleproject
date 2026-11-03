// v9.2.0 (nage) : pose de nage au pixel entier (ciseaux + rotation Scale2x), profondeur et réduction des animations.
import test from 'node:test';
import assert from 'node:assert/strict';
import { kickFrame, kickLegs, opaqueBox, rotatePixels, scale2x, swimFloat, SWIM_DEPTH, SWIM_TILT, STROKE } from '../src/render/ocean-fx.js';

function sprite(w, h, fill) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fill(x, y); if (c) d.set([...c, 255], (y * w + x) * 4); }
  return d;
}
const colors = (d) => new Set([...Array(d.length / 4).keys()].filter((i) => d[i * 4 + 3]).map((i) => `${d[i * 4]},${d[i * 4 + 1]},${d[i * 4 + 2]},${d[i * 4 + 3]}`));

test('rotation : aucune couleur inventée, pixels pleinement opaques, image agrandie', () => {
  const d = sprite(10, 20, (x, y) => (y < 10 ? [200, 0, 0] : [0, 0, 200]));
  const r = rotatePixels(d, 10, 20, 25);
  assert.ok(r.w > 10 && r.h >= 20);
  for (const c of colors(r.data)) assert.ok(['200,0,0,255', '0,0,200,255'].includes(c), c);
  // Sens horaire : le haut du corps part vers la droite.
  const top = opaqueBox(r.data, r.w, r.h);
  let xs = [];
  for (let x = 0; x < r.w; x++) if (r.data[((top.t + 1) * r.w + x) * 4 + 3]) xs.push(x);
  assert.ok(xs[0] > r.w / 2 - 5);
});

test('scale2x double la taille sans nouvelle couleur', () => {
  const d = sprite(3, 3, (x, y) => (x === y ? [1, 2, 3] : null));
  const s = scale2x(d, 3, 3);
  assert.equal(s.length, 6 * 6 * 4);
  assert.deepEqual([...colors(s)], ['1,2,3,255']);
});

test('ciseaux : les deux jambes glissent en sens opposés, le haut du corps reste', () => {
  const w = 10, h = 10;
  const d = sprite(w, h, (x, y) => (y < 7 || x === 3 || x === 6 ? [9, 9, 9] : null));
  const k = kickLegs(d, w, h, 2, -2, 0.3);
  for (let i = 0; i < (h - 3) * w * 4; i++) assert.equal(k[i], d[i]);
  const row = (h - 1) * w;
  const xs = [...Array(w).keys()].filter((x) => k[(row + x) * 4 + 3]);
  assert.deepEqual(xs, [4, 5]); // jambe arrière 3→5, jambe avant 6→4 : elles se croisent
});

test('battement en 4 images ; flottement déphasé ±5 px ; « réduire les animations » = fixe', () => {
  const frames = new Set([0, 0.25, 0.5, 0.75].map((t) => kickFrame(t, 4).join()));
  assert.equal(frames.size, 3); // repos, ciseaux A, ciseaux B
  assert.deepEqual(kickFrame(0.3, 4, 0, true), [0, 0]);
  const v = [...Array(60).keys()].map((i) => swimFloat(SWIM_DEPTH.hero, i * 0.1));
  assert.ok(Math.max(...v) - Math.min(...v) <= 1, 'on nage, on ne flotte pas : 1 px au plus');
  assert.equal(SWIM_TILT >= 70 && SWIM_TILT <= 90, true);
  assert.deepEqual(new Set(STROKE.map((s) => s.join())).size, 5); // brasse en 6 temps
  assert.equal(swimFloat(SWIM_DEPTH.hero, 1.7, 0, true), SWIM_DEPTH.hero);
  assert.notEqual(SWIM_DEPTH.ally0, SWIM_DEPTH.ally1);
});
