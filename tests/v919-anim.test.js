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

test('éléments : couleur → élément, et poses d’arme par type', async () => {
  const { elementOfColor, ELEMENTS } = await import('../src/render/element-fx.js');
  assert.equal(elementOfColor('#ff6a1a'), 'fire');
  assert.equal(elementOfColor('#5fe0a0'), 'poison');
  assert.equal(elementOfColor('#ffe27a'), 'holy');
  assert.equal(elementOfColor('#b07bff'), 'shadow');
  assert.equal(elementOfColor('#7fc8ff'), 'ice');
  assert.equal(elementOfColor('#ffffff'), null);
  assert.deepEqual(Object.keys(ELEMENTS).sort(), ['fire', 'holy', 'ice', 'poison', 'shadow', 'thunder']);
});

test('préparation ennemie : « enemyWindup » ~0,25 s avant chaque coup, sans changer combat ni hasard', async () => {
  const { BALANCE } = await import('../src/data/balance.js');
  const { createCombat, step } = await import('../src/core/combat.js');
  const { Rng } = await import('../src/core/rng.js');
  const { createNewState } = await import('../src/core/state.js');
  const run = (record) => {
    const state = createNewState(1_700_000_000_000);
    const world = createCombat(state);
    world.recordEvents = record;
    const rng = new Rng(42);
    const dt = BALANCE.simulation.tickSeconds;
    const ev = [];
    for (let i = 0; i < Math.round(120 / dt); i++) { step(state, world, dt, rng, BALANCE); if (record) { ev.push(...world.events); world.events.length = 0; } }
    return { hp: world.hero.hp, gold: state.gold, stage: state.stage, ev };
  };
  const a = run(true);
  const hits = a.ev.filter((e) => e.type === 'heroHit');
  const winds = a.ev.filter((e) => e.type === 'enemyWindup');
  assert.ok(hits.length > 3, 'des coups ennemis');
  for (const h of hits.slice(1)) {
    const w = winds.filter((x) => x.enemyId === h.enemyId && x.time <= h.time).pop();
    assert.ok(w && h.time - w.time > 0.1 && h.time - w.time < 0.45, `préparation avant le coup (${w && h.time - w.time})`);
  }
  const b = run(true);
  assert.deepEqual([a.hp, a.gold, a.stage], [b.hp, b.gold, b.stage]);
});
