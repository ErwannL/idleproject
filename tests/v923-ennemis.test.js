// v9.2.3 : table d'échelle des ennemis, souffle et incantation (géométrie pure).
import test from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_SIZE, MIN_SIZE, sizeFactor, targetSize, visibleSize } from '../src/data/enemy-sizes.js';
import { breathShape, powerPoints, powerOf } from '../src/render/enemy-fx.js';

// v9.2.4 : table par créature réelle (remplace les fourchettes par catégorie de la v9.2.3).
test('échelle : la magicienne et le nécromancien restent proches du squelette, les boss plus grands', () => {
  const skel = targetSize('skeleton');
  const witch = targetSize('mini_frost_witch', true, 'mini');
  const necro = targetSize('hard_necromancer', true, 'hard');
  assert.ok(witch / skel < 1.35 && necro / skel < 1.45, `${skel} ${witch} ${necro}`);
  assert.ok(targetSize('ash_dragon', true) > necro);
  assert.equal(sizeFactor('slime', false, null, targetSize('slime')), 1);
  assert.equal(sizeFactor('slime', false, null, 0), 1);
});

test('échelle v9.2.4 : ordre des créatures réelles et minimum lisible', () => {
  const t = (x) => targetSize(x);
  assert.ok(t('bat') < t('slime') && t('slime') < t('scorpion') && t('scorpion') < t('wolf') && t('wolf') < t('skeleton'));
  assert.ok(t('skeleton') < t('golem') && t('golem') < t('ogre'));
  assert.ok(targetSize('hard_frost_giant', true, 'hard') < targetSize('ash_dragon', true));
  for (const x of ['bat', 'leech_fly', 'voidling', 'mandrake', 'slime', 'goblin', 'imp', 'sea_eel']) assert.ok(t(x) >= MIN_SIZE, x);
  for (const v of Object.values(BOSS_SIZE)) assert.ok(v > t('skeleton'));
  // Taille visible : silhouette opaque, max(hauteur, largeur / 2).
  assert.equal(visibleSize({ rows: ['....', '.ab.', '.ab.', '....'] }), 2);
  assert.equal(visibleSize({ rows: ['abcdefgh', '........'] }), 4);
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
