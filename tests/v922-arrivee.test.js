// v9.2.2 : arrivée des ennemis selon leur nature, ruée quand l'équipe tue d'un coup.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/data/balance.js';
import { BOSSES, ENEMIES } from '../src/data/enemies.js';
import { ARRIVAL_MODES, BOSS_ARRIVALS, ENEMY_ARRIVALS, arrivalFor } from '../src/data/arrivals.js';
import { ARRIVE_SECONDS, arrivalPose, arrivalProgress } from '../src/render/arrival.js';
import { createNewState } from '../src/core/state.js';
import { canHit, createCombat, isRushing, step } from '../src/core/combat.js';
import { Rng } from '../src/core/rng.js';

test('chaque ennemi et chaque boss a un mode d\'arrivée connu', () => {
  for (const id of Object.keys(ENEMIES)) assert.ok(ARRIVAL_MODES.includes(ENEMY_ARRIVALS[id]?.mode), id);
  for (const id of Object.keys(BOSSES)) assert.ok(ARRIVAL_MODES.includes(BOSS_ARRIVALS[id]?.mode), id);
  assert.deepEqual(Object.keys(ENEMY_ARRIVALS).sort(), Object.keys(ENEMIES).sort());
  assert.deepEqual(Object.keys(BOSS_ARRIVALS).sort(), Object.keys(BOSSES).sort());
});

test('seuls des volants arrivent du haut ; tout ennemi qui vole (flyHeight) arrive en vol ou à la nage', () => {
  for (const [id, def] of Object.entries(ENEMIES)) {
    const a = arrivalFor(id, false, { underwater: Boolean(def.swim) });
    if (def.flyHeight) assert.ok(['fly', 'swim'].includes(a.mode), id);
  }
  for (const id of ['golem', 'skeleton', 'slime', 'ogre', 'mummy']) assert.ok(!['fly', 'swim'].includes(arrivalFor(id).mode), id);
  assert.equal(arrivalFor('fallen_knight', true).mode, 'walk'); // plus de boss marcheur tombé du ciel
  assert.equal(arrivalFor('ash_dragon', true).mode, 'fly');
  assert.equal(arrivalFor('sea_crab', false, { underwater: true }).mode, 'walk');
  assert.equal(arrivalFor('boss_leviathan', true, { underwater: true }).mode, 'swim');
});

test('avancement : temps ou position, le plus avancé ; fini au contact', () => {
  assert.equal(arrivalProgress(0, 200, 200, 100), 0);
  assert.equal(arrivalProgress(ARRIVE_SECONDS, 200, 200, 100), 1);
  assert.equal(arrivalProgress(0, 100, 200, 100), 1); // ruée : arrivé au contact quoi qu'il arrive
  assert.ok(Math.abs(arrivalProgress(0, 150, 200, 100) - 0.5) < 1e-9);
});

test('vol : part de haut, ralentit en arrivant (descente de plus en plus lente), posé à k = 1', () => {
  const fly = { mode: 'fly', style: 'wings' };
  const ys = [0, 0.25, 0.5, 0.75, 1].map((k) => arrivalPose(fly, k, { focus: true }).dy);
  assert.equal(ys[0], 70);
  assert.equal(ys[4], 0);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] <= ys[i - 1]);
  assert.ok(ys[0] - ys[1] > ys[3] - ys[4]); // ralentissement
  assert.ok(arrivalPose(fly, 0.2, { time: 0.1 }).flap >= 0);
  assert.equal(arrivalPose({ mode: 'walk' }, 0).dy, 0);
});

test('sortie du sol et portail', () => {
  assert.equal(arrivalPose({ mode: 'burrow' }, 0).buried, 1);
  assert.equal(arrivalPose({ mode: 'burrow' }, 1).buried, 0);
  assert.equal(arrivalPose({ mode: 'portal' }, 0).alpha, 0);
  assert.equal(arrivalPose({ mode: 'portal' }, 1).alpha, 1);
  assert.ok(arrivalPose({ mode: 'portal' }, 0.4).portal > 0.9);
});

test('ruée : seulement les ennemis ordinaires tués d\'un coup, touchables près du contact', () => {
  const e = { maxHp: 100, boss: false, range: 16, rush: true, x: BALANCE.world.spawnX };
  assert.equal(isRushing(150, e), true);
  assert.equal(isRushing(50, e), false);
  assert.equal(isRushing(1e9, { ...e, boss: true }), false);
  assert.equal(canHit(e), false);
  assert.equal(canHit({ ...e, x: BALANCE.world.heroX + 20 }), true);
  assert.equal(canHit({ ...e, rush: false }), true);
});

test('équipe très forte : les ennemis se ruent et meurent près du contact', () => {
  const s = createNewState(Date.now());
  s.heroClass = 'archer';
  for (const k of Object.keys(s.upgrades)) s.upgrades[k] = 400;
  const world = createCombat(s);
  const rng = new Rng(3);
  const W = BALANCE.world;
  let kills = 0;
  for (let i = 0; i < 1200; i++) {
    step(s, world, 0.05, rng);
    for (const ev of world.events) if (ev.type === 'kill' && ev.time > world.time - 0.051) {
      kills++;
      assert.ok(ev.x <= W.heroX + W.meleeOffset + 30 + BALANCE.rush.reach, `tué à x = ${ev.x}`);
    }
  }
  assert.ok(kills > 5);
});
