// v10.19 (partie 4) : plus de mort « en un éclair » — plafonds des coups, Second souffle, mur de l'étape 15,
// prévision du boss, et simulation en partie neuve (tools/sim-1019-survie.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewState } from '../src/core/state.js';
import { createCombat, step, survivalCapped, survivalStageMult, hitCapPct } from '../src/core/combat.js';
import { Rng } from '../src/core/rng.js';
import { BALANCE } from '../src/data/balance.js';
import { BEHAVIORS } from '../src/data/behaviors.js';
import { TRAITS } from '../src/core/boss-traits.js';
import { forecastHtml } from '../src/ui/common.js';

const SV = BALANCE.survival;
const W = BALANCE.world;

function arena(stage = 18) {
  const state = createNewState(Date.UTC(2026, 10, 9, 8), 3);
  state.stage = stage; state.maxStage = stage;
  const world = createCombat(state);
  step(state, world, 0.01, new Rng(1)); // calcule world.heroStats
  return { state, world };
}

// Un ennemi déjà au contact, qui frappe au pas suivant ; PV immenses (le héros ne le tue pas).
function striker(world, { damage, boss = false, behavior = null, trait = null, heavy = false, hpPct = 1 }) {
  const range = 10;
  const e = {
    id: world.nextEnemyId++, type: boss ? 'slime' : 'slime', boss, elite: false, x: W.heroX + W.meleeOffset + range, hp: 1e30, maxHp: 1e30 / hpPct,
    damage, gold: 1, speed: 0, attackInterval: 1, attackTimer: 0.001, range, engaged: true, arrived: true, age: 0, summons: [], behavior, trait, heavy, rush: false,
  };
  e.hp = e.maxHp * hpPct;
  world.enemies = [e];
  return e;
}

function hitOnce(state, world, opts, rng) {
  const maxHp = world.heroStats.maxHp;
  world.hero.hp = maxHp; world.hero.dead = false; world.hero.invulnUntil = -1;
  world.enemies = [];
  const e = striker(world, opts);
  world.events.length = 0;
  step(state, world, 0.01, rng);
  const hit = world.events.find((ev) => ev.type === 'heroHit' && ev.enemyId === e.id);
  return { hit, maxHp, e };
}

test('4.2 : aucun coup ne dépasse son plafond (1 000 tirages de chaque comportement et trait)', () => {
  const { state, world } = arena();
  const rng = new Rng(7);
  const cases = [
    ...Object.keys(BEHAVIORS).filter((b) => b !== 'kamikaze').map((b) => ({ behavior: b })),
    ...Object.keys(TRAITS).map((t) => ({ trait: t, boss: true, hpPct: 0.1 })), // désespéré : sous son seuil de PV
    { boss: true, heavy: true }, { boss: true },
  ];
  for (const c of cases) {
    let n = 0;
    for (let i = 0; i < 1000; i++) {
      const damage = 10 ** (rng.next() * 12); // de 1 à 10¹² : sous et bien au-delà des PV du héros
      const { hit, maxHp, e } = hitOnce(state, world, { ...c, damage }, rng);
      if (!hit) continue; // esquive
      n += 1;
      const cap = (c.heavy ? SV.hitCapPct.heavy : c.boss ? SV.hitCapPct.boss : SV.hitCapPct.normal) / 100;
      assert.ok(hit.damage <= maxHp * cap * (1 + 1e-9), `${JSON.stringify(c)} : ${hit.damage} > ${cap} × ${maxHp}`);
      assert.equal(hitCapPct({ ...e, heavy: c.heavy }), cap * 100);
    }
    assert.ok(n > 900, `${JSON.stringify(c)} : ${n} coups`);
  }
});

test('4.1 : trait × comportement × coup lourd plafonné à ×3', () => {
  const { state, world } = arena();
  const rng = new Rng(9);
  const base = hitOnce(state, world, { damage: 1, boss: true }, rng).hit.damage;
  for (const c of [{ behavior: 'charger' }, { behavior: 'shooter' }, { trait: 'desperate', hpPct: 0.1 }, { trait: 'escalate' }]) {
    for (let i = 0; i < 1000; i++) {
      const { hit } = hitOnce(state, world, { ...c, boss: true, heavy: true, damage: 1 }, rng);
      if (hit) assert.ok(hit.damage <= base * SV.productCap * (1 + 1e-9), `${JSON.stringify(c)} : ×${hit.damage / base}`);
    }
  }
});

test('4.2 : pas de plafond en Tour, en défi « rage immédiate » ni contre le World Boss', () => {
  const s = createNewState(0, 1);
  assert.equal(survivalCapped(s, { boss: true }), true);
  assert.equal(survivalCapped({ ...s, tower: { floor: 3 } }, { boss: true }), false);
  assert.equal(survivalCapped({ ...s, worldBossRun: {} }, { boss: true }), false);
  assert.equal(survivalCapped(s, { boss: true, worldBoss: true }), false);
});

test('4.4 : le Second souffle se déclenche une seule fois par boss (1 PV, 1,5 s d\'invincibilité)', () => {
  const { state, world } = arena();
  const rng = new Rng(3);
  const maxHp = world.heroStats.maxHp;
  world.hero.hp = maxHp * (SV.secondWind.above + 0.05); // v10.20 : coup lourd plafonné à 40 %, seuil 30 %
  const boss = striker(world, { damage: 1e12, boss: true, heavy: true });
  world.events.length = 0;
  step(state, world, 0.01, rng);
  const winds = () => world.events.filter((e) => e.type === 'heroSecondWind').length;
  assert.equal(winds(), 1);
  assert.equal(world.hero.dead, false);
  assert.ok(world.hero.hp <= 1 + maxHp * 0.01, `PV ${world.hero.hp}`); // 1 PV (+ la régénération du pas)
  assert.ok(Math.abs(world.hero.invulnUntil - world.time - SV.secondWind.invulnSeconds) < 0.02);
  // Pendant l'invincibilité : aucun coup ne passe.
  boss.heavy = true; boss.attackTimer = 0.001;
  world.events.length = 0;
  step(state, world, 0.01, rng);
  assert.equal(world.events.filter((e) => e.type === 'heroHit').length, 0);
  // Après : PV remontés au-dessus du seuil, le même boss ne le redonne pas.
  world.time += 2; world.hero.hp = maxHp * (SV.secondWind.above + 0.05); boss.heavy = true; boss.attackTimer = 0.001;
  world.events.length = 0;
  step(state, world, 0.01, rng);
  assert.equal(winds(), 0);
  assert.ok(world.events.some((e) => e.type === 'heroDeath'));
});

// v10.20 (7.2) : seuil abaissé à 30 % (secondWind.above 0,5 → 0,3).
test('4.4 : pas de Second souffle sous le seuil (30 % des PV depuis la 10.20)', () => {
  const { state, world } = arena();
  world.hero.hp = world.heroStats.maxHp * (SV.secondWind.above - 0.1);
  striker(world, { damage: 1e12, boss: true, heavy: true });
  world.events.length = 0;
  step(state, world, 0.01, new Rng(2));
  assert.equal(world.events.filter((e) => e.type === 'heroSecondWind').length, 0);
  assert.equal(world.hero.dead, true);
});

test('4.5 et 4.6 : boss de l\'étape 15 −20 % (PV et dégâts), monstres des étapes 16 à 20 −10 % de dégâts', () => {
  const s = createNewState(0, 1);
  const enc = {};
  s.stage = 15; assert.deepEqual(survivalStageMult(s, enc, true), { hp: 0.8, damage: 0.8 });
  assert.deepEqual(survivalStageMult(s, enc, false), { hp: 1, damage: 1 });
  for (const st of [16, 18, 20]) { s.stage = st; assert.deepEqual(survivalStageMult(s, enc, false), { hp: 1, damage: 0.9 }); }
  s.stage = 21; assert.deepEqual(survivalStageMult(s, enc, false), { hp: 1, damage: 1 });
  s.stage = 15; assert.deepEqual(survivalStageMult(s, { dungeon: {} }, true), { hp: 1, damage: 1 });
});

test('4.7 : prévision du boss — rien les 5 premières minutes, loin du boss seulement son étape', () => {
  const s = createNewState(0, 1);
  const f = { win: false, stage: 15 };
  s.stage = 13; s.playSeconds = 100;
  assert.equal(forecastHtml(f, s), '');
  s.playSeconds = 400;
  assert.match(forecastHtml(f, s), /trop fort pour toi/);
  s.stage = 11;
  assert.match(forecastHtml(f, s), /Prochain boss à l'étape 1-15\./);
  assert.doesNotMatch(forecastHtml(f, s), /trop fort/);
});

test('4.3 : les premiers coups d\'une vague sont étalés de 0,25 s', () => {
  const { state, world } = arena(3);
  const rng = new Rng(5);
  let spawned = null;
  for (let i = 0; i < 2000 && !spawned; i++) {
    step(state, world, 0.05, rng);
    if (world.events.some((e) => e.type === 'waveStart')) spawned = world.enemies.slice(-3);
    world.events.length = 0;
  }
  assert.ok(spawned?.length === 3);
  const gaps = [spawned[1].attackTimer - spawned[0].attackTimer, spawned[2].attackTimer - spawned[1].attackTimer];
  for (const g of gaps) assert.ok(g >= SV.staggerSeconds - 1e-9, `écart ${g}`);
});

test('4.8 : simulation en partie neuve — pas plus de morts entre les étapes 13 et 21, étape 15 passée plus tôt', async () => {
  const { runSurvival } = await import('../tools/sim-1019-survie.mjs');
  const deaths = (r) => Object.entries(r.deaths).filter(([k]) => k >= 13 && k <= 21).reduce((a, [, v]) => a + v, 0);
  const after = runSurvival(1, { hours: 1.5 });
  BALANCE.survival.enabled = false;
  let before;
  try { before = runSurvival(1, { hours: 1.5 }); } finally { BALANCE.survival.enabled = true; }
  assert.ok(deaths(after) <= deaths(before), `morts 13-21 : ${deaths(before)} → ${deaths(after)}`);
  assert.ok(after.pass15 < before.pass15, `étape 15 passée : ${before.pass15} s → ${after.pass15} s`);
  assert.ok(after.pass15 - after.reach15 < 20 * 60, 'boss de l\'étape 15 passé en moins de 20 min');
});
