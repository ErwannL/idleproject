// v9.2.3 : animations image par image (PixelLab) pour bat, harpy, skeleton, repli procédural ailleurs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_ANIMS } from '../src/render/art-anim.js';
import { SPRITES } from '../src/render/sprites.js';
import { pickAnimFrame } from '../src/render/enemy-anim.js';

test('v9.2.3 : chaque image d\'animation existe et garde l\'échelle du sprite de base', () => {
  assert.ok(Object.keys(ENEMY_ANIMS).length >= 3);
  for (const [sprite, set] of Object.entries(ENEMY_ANIMS)) {
    for (const anim of Object.values(set)) {
      assert.ok(anim.frames.length >= 4 && anim.fps > 0);
      for (const key of anim.frames) assert.equal(SPRITES[key].scale, SPRITES[sprite].scale); // v9.2.3 : sprites faits main : pas d'échelle
    }
  }
});

test('v9.2.3 : choix de l\'image (sortie du sol > attaque > vol > marche) et repli', () => {
  const s = ENEMY_ANIMS.skeleton;
  assert.equal(pickAnimFrame(s, { emerge: 0, atkP: 0.5 }).key, s.emerge.frames[0]);
  assert.equal(pickAnimFrame(s, { emerge: 1 }).key, s.emerge.frames.at(-1));
  assert.equal(pickAnimFrame(s, { atkP: 0.99, moving: true }).anim, s.attack);
  assert.equal(pickAnimFrame(s, { moving: true, time: 1 / s.walk.fps }).key, s.walk.frames[1]);
  assert.equal(pickAnimFrame(s, { moving: false }), null); // au repos : sprite de base
  assert.equal(pickAnimFrame(ENEMY_ANIMS.bat, { flying: true }).anim, ENEMY_ANIMS.bat.fly);
  assert.equal(pickAnimFrame(ENEMY_ANIMS.__aucun__, { moving: true }), null); // autres ennemis : procédural
});
