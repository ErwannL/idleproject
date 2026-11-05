// v9.2.3 : table d'échelle des ennemis, souffle et incantation (géométrie pure).
import test from 'node:test';
import assert from 'node:assert/strict';
import { sizeClass, sizedHeight, sizeFactor, SIZE_CLASSES } from '../src/data/enemy-sizes.js';
import { breathShape, powerPoints, powerOf } from '../src/render/enemy-fx.js';

test('échelle : la magicienne et le nécromancien restent proches du squelette, les boss plus grands', () => {
  const skel = sizedHeight(38, sizeClass('skeleton'));
  const witch = sizedHeight(65, sizeClass('mini_frost_witch', true, 'mini'));
  const necro = sizedHeight(76, sizeClass('hard_necromancer', true, 'hard'));
  assert.ok(witch / skel < 1.35 && necro / skel < 1.45, `${skel} ${witch} ${necro}`);
  assert.ok(sizedHeight(87, sizeClass('ash_dragon', true)) > necro);
  assert.equal(sizeFactor('slime', false, null, 20), 1);
  for (const c of Object.values(SIZE_CLASSES)) assert.ok(c.min <= c.max);
});

test('souffle : longueur = distance, cône plus ouvert de loin', () => {
  const near = breathShape(100, 50, 80, 60), far = breathShape(200, 50, 80, 60);
  assert.ok(Math.abs(near.len - Math.hypot(20, 10)) < 1e-9);
  assert.ok(far.len > near.len && far.spread > near.spread);
  assert.equal(powerOf('ash_dragon').kind, 'breath');
  assert.equal(powerOf('lich').kind, 'cast');
});

test('gueule et bâton repérés sur la silhouette (tournée vers la gauche)', () => {
  const w = 10, h = 10, a = new Uint8Array(w * h);
  for (let y = 3; y < 10; y++) for (let x = 4; x < 9; x++) a[y * w + x] = 1;
  a[0 * w + 2] = a[1 * w + 2] = a[2 * w + 2] = 1; // bâton
  a[4 * w + 1] = 1; // museau
  const p = powerPoints(a, w, h);
  assert.deepEqual(p.tip, [2, 0]);
  assert.equal(p.mouth[0], 1);
});
