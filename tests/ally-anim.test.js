// v9.2.3 : animations PixelLab des alliés — cadre et ligne des pieds stables entre les images, sans dérive.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALLY_ANIMS } from '../src/render/art-anim-allies.js';
import { decodeAllyFrames, phaseFrame, pickHeroAnim, heroAttackAnim } from '../src/render/ally-anim.js';

const FRAMES = decodeAllyFrames();
const grid = (name) => FRAMES[name].rows;
const box = (rows) => {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }));
  return { x0, y0, x1, y1 };
};

test('chaque animation garde un cadre commun (même largeur, même hauteur)', () => {
  for (const [key, anims] of Object.entries(ALLY_ANIMS)) {
    for (const [anim, a] of Object.entries(anims)) {
      assert.ok(a.frames.length >= 4, `${key}.${anim} : trop peu d'images`);
      const g0 = grid(a.frames[0]);
      for (const f of a.frames) {
        const g = grid(f);
        assert.equal(g.length, g0.length, `${f} : hauteur`);
        assert.ok(g.every((r) => r.length === g0[0].length), `${f} : largeur`);
      }
    }
  }
});

test('marche et attaque : pieds sur la même ligne à chaque image ; nage : corps centré sans dérive', () => {
  for (const [key, anims] of Object.entries(ALLY_ANIMS)) {
    for (const [anim, a] of Object.entries(anims)) {
      const boxes = a.frames.map((f) => box(grid(f)));
      if (anim === 'swim') {
        const cs = boxes.map((b) => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]);
        for (const c of cs) assert.ok(Math.abs(c[0] - cs[0][0]) <= 1 && Math.abs(c[1] - cs[0][1]) <= 1, `${key}.swim : dérive`);
      } else {
        for (const b of boxes) assert.equal(b.y1, boxes[0].y1, `${key}.${anim} : pieds qui bougent`);
      }
    }
  }
});

test("l'image du coup tombe à l'impact ; arme d'une autre forme : pose composée par le jeu", () => {
  const a = { frames: new Array(9).fill('x'), hit: 4 };
  assert.equal(phaseFrame(a, 0, 0.3), 0);
  assert.equal(phaseFrame(a, 0.3, 0.3), 4);
  assert.equal(phaseFrame(a, 0.999, 0.3), 8);
  assert.equal(heroAttackAnim(null, 'knight', 'greatsword'), null);
  if (ALLY_ANIMS.hero_knight?.attack_knight) {
    assert.ok(heroAttackAnim(null, 'knight', 'sword'));
    const o = { palette: null, classId: 'knight', style: 'melee', weapon: 'sword', attack: 0.3, time: 0, attackTime: 0.3, castTime: 0.35 };
    assert.equal(pickHeroAnim(o, {}).name, ALLY_ANIMS.hero_knight.attack_knight.frames[0]);
    assert.equal(pickHeroAnim({ ...o, attack: 0, hurt: 0.2 }, {}), null);
  }
});
