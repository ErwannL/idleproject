// v9.2.5 : ennemis — calage des images dessinées, une seule flamme, bouches de l'hydre, division du Scissipare.
import test from 'node:test';
import assert from 'node:assert/strict';
import { anchorOffset, opaqueBox } from '../src/render/enemy-anchor.js';
import { BREATH_FRAME_MAP, breathSafeAnims, headMouth, HEAD_MOUTHS, powerOf } from '../src/render/enemy-fx.js';
import { halfPath } from '../src/render/mutation-fx.js';
import { SPLIT_OFFSETS, splitChildren } from '../src/core/mutations.js';
import { ENEMY_ANIMS } from '../src/render/art-anim.js';
import { DRAWN_TRAIL } from '../src/render/enemy-anim.js';

const mask = (w, h, rects) => {
  const a = new Uint8Array(w * h);
  for (const [x0, y0, x1, y1] of rects) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) a[y * w + x] = 255;
  return a;
};

test('boîte opaque : bords et centre de la silhouette', () => {
  const b = opaqueBox(mask(10, 10, [[2, 3, 5, 8]]), 10, 10);
  assert.deepEqual([b.top, b.bottom, b.left, b.right, b.cx], [3, 8, 2, 5, 4]);
  assert.equal(opaqueBox(new Uint8Array(4), 2, 2), null);
});

test('calage : pieds sur le bas du sprite de base (marche image par image, attaque sur l\'image la plus basse)', () => {
  const base = { top: 2, bottom: 20, left: 4, right: 13, cx: 9 };
  const walk = [{ top: 0, bottom: 15, left: 0, right: 9, cx: 5 }, { top: 1, bottom: 17, left: 0, right: 9, cx: 5 }];
  // Marche : chaque image a ses pieds sur la ligne du sol.
  assert.deepEqual(anchorOffset(base, walk, 0, 'walk'), { ox: 4, oy: 5 });
  assert.deepEqual(anchorOffset(base, walk, 1, 'walk'), { ox: 4, oy: 3 });
  // Attaque (saut) : l'image la plus basse touche le sol, les autres gardent leur hauteur relative.
  const atk = [{ ...walk[0] }, { ...walk[0], bottom: 10 }];
  assert.equal(anchorOffset(base, atk, 0, 'attack').oy, anchorOffset(base, atk, 1, 'attack').oy);
  assert.equal(anchorOffset(base, atk, 0, 'attack').oy + atk[0].bottom, base.bottom);
  // Vol : la hauteur d'origine est gardée.
  assert.equal(anchorOffset(base, walk, 0, 'fly', { ox: 0, oy: -7 }, false).oy, -7);
});

test('une seule flamme : images du chien de l\'enfer sans flamme dessinée, phénix et chef salamandre sans souffle', () => {
  assert.equal(powerOf('boss_phoenix'), null);
  assert.equal(powerOf('mini_salamander_chief'), null);
  assert.ok(DRAWN_TRAIL.has('boss_phoenix') && DRAWN_TRAIL.has('mini_salamander_chief'));
  for (const [base, map] of Object.entries(BREATH_FRAME_MAP)) {
    const safe = breathSafeAnims(base, ENEMY_ANIMS[base]);
    assert.equal(safe.attack.frames.length, ENEMY_ANIMS[base].attack.frames.length);
    assert.deepEqual(safe.attack.frames, map.map((i) => ENEMY_ANIMS[base].attack.frames[i]));
    assert.equal(safe.walk, ENEMY_ANIMS[base].walk);
  }
  // Images avec flamme dans la gueule (chien de l'enfer : 4, 5) jamais jouées.
  for (const i of [4, 5]) assert.ok(!breathSafeAnims('mid_hellhound', ENEMY_ANIMS.mid_hellhound).attack.frames.includes(`mid_hellhound__attack${i}`));
});

test('hydre : trois bouches par image d\'attaque, choisies à tour de rôle', () => {
  assert.equal(powerOf('mid_hydra').heads, 3);
  assert.equal(HEAD_MOUTHS.mid_hydra.length, ENEMY_ANIMS.mid_hydra.attack.frames.length);
  const m0 = headMouth('mid_hydra__attack0', 0), m2 = headMouth('mid_hydra__attack0', 2);
  assert.ok(m0[0] < m2[0]); // de gauche à droite
  assert.deepEqual(headMouth('mid_hydra__attack1', 4), headMouth('mid_hydra__attack1', 1));
  assert.equal(headMouth('mid_hydra__walk0', 0), null);
  assert.deepEqual(headMouth('boss_ash_dragon__attack5', 0), [1, 33]); // v9.2.5 : gueule du dragon relevée à la main
});

test('Scissipare : les doubles naissent où les moitiés atterrissent, trajectoire en arc', () => {
  const kids = splitChildren({ id: 1, mutation: 'split', x: 100, maxHp: 10, hp: 0, gold: 6, attackInterval: 1 }, 7);
  assert.deepEqual(kids.map((k) => k.x - 100), SPLIT_OFFSETS);
  assert.deepEqual(kids.map((k) => k.id), [7, 8]);
  const a = halfPath(0, 10, 50, 30, 50), b = halfPath(1, 10, 50, 30, 50), m = halfPath(0.5, 10, 50, 30, 50, 14);
  assert.deepEqual([a.x, a.y, b.x, b.y], [10, 50, 30, 50]);
  assert.equal(m.y, 50 - 14);
});

// v9.2.5 (retours joueur : souffle, pattes, glisse, file d'attente)
test('gueules relevées à la main : chaque image d\'attaque des ennemis à souffle annotée', async () => {
  const { MOUTHS, mouthAt } = await import('../src/render/enemy-fx.js');
  for (const [base, t] of Object.entries(MOUTHS)) {
    if (t.attack) assert.equal(t.attack.length, ENEMY_ANIMS[base].attack.frames.length, base);
    assert.ok(mouthAt(base), base);
  }
  assert.deepEqual(mouthAt('mid_hellhound__attack0'), [11, 30]);
  assert.equal(mouthAt('wolf__attack0'), null);
});

test('pattes : le côté resté en l\'air descend jusqu\'au sol, effets ignorés', async () => {
  const { solidMask, legPlan, legSource, footRow, isFirePixel } = await import('../src/render/enemy-anchor.js');
  const w = 20, h = 20, d = new Uint8ClampedArray(w * h * 4);
  const put = (x, y, rgb = [80, 50, 40]) => d.set([...rgb, 255], (y * w + x) * 4);
  for (let y = 4; y < 12; y++) for (let x = 2; x < 18; x++) put(x, y); // corps
  for (let y = 12; y < 19; y++) { put(3, y); put(4, y); } // patte avant, jusqu'au sol (18)
  for (let y = 12; y < 15; y++) { put(15, y); put(16, y); } // patte arrière levée (14)
  put(10, 19, [255, 200, 40]); // étincelle de feu sous le corps : ignorée
  assert.ok(isFirePixel(255, 200, 40));
  const m = solidMask(d, w, h);
  assert.equal(footRow(m, w, h), 18);
  const p = legPlan(m, w, h);
  assert.equal(p.sides.length, 1); assert.equal(p.sides[0].dir, 1); assert.equal(p.sides[0].gap, 4);
  // La patte arrière touche maintenant le sol : la ligne 18 de la colonne 16 vient d'un pixel de la patte.
  const sy = legSource(p, 16, 18);
  assert.ok(sy >= 12 && sy <= 14);
});

test('pas de marche mesuré : pied d\'appui qui recule de 3 px par image', async () => {
  const { strideOf } = await import('../src/render/enemy-anchor.js');
  const w = 40, h = 10;
  const frame = (x0) => { const mask = new Uint8Array(w * h); for (let y = 7; y < 10; y++) for (let x = x0; x < x0 + 4; x++) mask[y * w + x] = 1; return { mask, w, h, foot: 9 }; };
  assert.equal(strideOf([frame(5), frame(8), frame(11), frame(14), frame(17), frame(20)]), 3);
});

test('file : un ennemi bloqué derrière un ennemi au contact attend sans marcher', async () => {
  const { BALANCE } = await import('../src/data/balance.js');
  const W = BALANCE.world;
  const a = { x: W.heroX + W.meleeOffset + 16, range: 16, speed: 20 }, b = { x: a.x + W.enemyGap, range: 16, speed: 20 };
  // reproduit la règle de combat.js (file)
  const step = (list) => list.forEach((e, i) => { const prev = list[i - 1]; const stopX = prev ? prev.x + W.enemyGap : W.heroX + W.meleeOffset + e.range; e.x = Math.max(stopX, e.x - e.speed * 0.1); e.engaged = !prev && e.x <= stopX + 0.01; e.queued = Boolean(prev) && e.x <= stopX + 0.01 && Boolean(prev.engaged || prev.queued); });
  step([a, b]);
  assert.ok(a.engaged); assert.ok(b.queued);
  const src = (await import('node:fs')).readFileSync(new URL('../src/core/combat.js', import.meta.url), 'utf8');
  assert.match(src, /enemy\.queued = Boolean\(prev\) && enemy\.x <= stopX \+ 0\.01 && Boolean\(prev\.engaged \|\| prev\.queued\)/);
});
