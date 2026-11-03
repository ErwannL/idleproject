// v9.1.9 : animations dérivées (bras par segment, courbe d'attaque, tramage de dissolution).
import test from 'node:test';
import assert from 'node:assert/strict';
import { armGeometry, attackCurve, bayer, rotateSource } from '../src/render/enemy-anim.js';

test('épaule placée devant l’axe du corps, côté du regard', () => {
  const w = 20, h = 20, a = new Uint8Array(w * h);
  for (let y = 2; y < 18; y++) for (let x = 5; x < 15; x++) a[y * w + x] = 255;
  const g = armGeometry(a, w, h, -1);
  assert.ok(g.sx < 10 && g.sy > g.y0 && g.y1 > g.sy);
  assert.ok(armGeometry(a, w, h, 1).sx > 10);
  assert.equal(armGeometry(new Uint8Array(4), 2, 2), null);
});

test('rotation au pixel : coordonnées entières, épaule fixe', () => {
  const g = { sx: 5, sy: 5 };
  assert.deepEqual(rotateSource(5, 5, g, 0.7), [5, 5]);
  for (const v of rotateSource(9, 3, g, 0.4)) assert.ok(Number.isInteger(v));
});

test('attaque en trois temps, décalages entiers', () => {
  const ph = [0.1, 0.4, 0.9].map((p) => attackCurve(p));
  assert.deepEqual(ph.map((c) => c.phase), ['wind', 'strike', 'recover']);
  for (let p = 0; p < 1; p += 0.05) assert.ok(Number.isInteger(attackCurve(p).dx));
  assert.ok(ph[0].arm < 0 && ph[1].arm > 0);
});

test('matrice de Bayer 4×4 complète', () => {
  const s = new Set(); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) s.add(bayer(x, y));
  assert.equal(s.size, 16);
});
