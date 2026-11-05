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

test("l'image du coup tombe à l'impact ; v9.2.3 : toute arme suit l'attaque, posée sur la prise de l'image", () => {
  const a = { frames: new Array(9).fill('x'), hit: 4 };
  assert.equal(phaseFrame(a, 0, 0.3), 0);
  assert.equal(phaseFrame(a, 0.3, 0.3), 4);
  assert.equal(phaseFrame(a, 0.999, 0.3), 8);
  const o = { palette: null, classId: 'knight', style: 'melee', weapon: 'greatsword', attack: 0.3, time: 0, attackTime: 0.3, castTime: 0.35 };
  const p = pickHeroAnim(o, {});
  assert.equal(p.name, ALLY_ANIMS.hero_knight.attack_knight.frames[0]);
  assert.ok(p.weapon && Number.isFinite(p.weapon.x) && Number.isFinite(p.weapon.deg), 'prise de l\'arme');
  assert.equal(pickHeroAnim({ ...o, attack: 0, hurt: 0.2 }, {}), null);
  // Marche : arme en main (prise suivie), jamais dans le dos.
  const w = pickHeroAnim({ ...o, attack: 0, walking: true, time: 0.2 }, {});
  assert.ok(w.weapon && !w.weapon.back);
});

test("v9.2.3 : chaque attaque et chaque marche du héros a une prise d'arme par image, proche de la main au repos", () => {
  for (const [key, anims] of Object.entries(ALLY_ANIMS)) {
    if (!key.startsWith('hero_')) continue;
    for (const [anim, a] of Object.entries(anims)) {
      if (anim === 'swim') continue;
      assert.equal(a.w?.length, a.frames.length, `${key}.${anim} : prises`);
      // Première image = pose de repos : main du héros composé (42, 51) à 3 px près.
      assert.ok(Math.abs(a.w[0][0] - 42) <= 3 && Math.abs(a.w[0][1] - 51) <= 3, `${key}.${anim} : main au repos ${a.w[0]}`);
    }
  }
});
