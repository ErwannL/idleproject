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

test('v9.2.3 : images compressées par suites et palette partagée par animation', async () => {
  const { expandRow } = await import('../src/render/sprites.js');
  assert.equal(expandRow('ab`.7`c`x5`'), 'ab.......cxxxxx');
  for (const [sprite, set] of Object.entries(ENEMY_ANIMS)) {
    for (const anim of Object.values(set)) {
      const w = SPRITES[anim.frames[0]].rows[0].length;
      for (const key of anim.frames) {
        const s = SPRITES[key];
        assert.ok(s.pal, `${sprite} ${key}`);
        assert.equal(s.pal, SPRITES[anim.frames[0]].pal); // une palette par animation
        for (const r of s.rows) { assert.equal(r.length, w); assert.ok(!r.includes('`')); }
      }
    }
  }
});

test('v9.2.3 : tous les mondes 1 à 12 ont des animations dessinées', async () => {
  const { ZONES } = await import('../src/data/zones.js');
  const { BOSSES, ENEMIES } = await import('../src/data/enemies.js');
  let withAnim = 0, total = 0;
  for (const z of ZONES.slice(0, 12)) {
    for (const t of z.enemies) { total++; if (ENEMY_ANIMS[ENEMIES[t].sprite]) withAnim++; }
    for (const t of [...Object.values(z.tierBosses ?? {}), ...z.bosses]) { total++; if (ENEMY_ANIMS[BOSSES[t].sprite ?? ENEMIES[BOSSES[t].base].sprite]) withAnim++; }
  }
  assert.ok(withAnim / total > 0.9, `${withAnim}/${total}`);
});
