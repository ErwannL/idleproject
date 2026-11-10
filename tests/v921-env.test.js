// v9.2.1 : malus d'environnement (mondes 2 à 12), contrés par une amélioration existante.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/data/balance.js';
import { ZONES } from '../src/data/zones.js';
import { ENVIRONMENTS } from '../src/data/environment.js';
import { createNewState } from '../src/core/state.js';
import { computeHeroStats } from '../src/core/stats.js';
import { applyEnvironment, envLine, environmentFor } from '../src/core/environment.js';
import { createCombat, currentEnvironment, step, zoneStartStage } from '../src/core/combat.js';
import { Rng } from '../src/core/rng.js';
import { translate as en } from '../src/i18n/en.js';
import { translate as ko } from '../src/i18n/ko.js';

const NOW = Date.UTC(2026, 10, 3, 12);
const zi = (id) => ZONES.findIndex((z) => z.id === id);

test('v9.2.1 : un malus par monde 2 à 12, aucun dans le monde 1, contre = amélioration existante et ouverte avant', () => {
  assert.equal(ENVIRONMENTS.length, ZONES.length - 1);
  assert.equal(environmentFor(createNewState(NOW), 0), null);
  for (const e of ENVIRONMENTS) {
    const up = BALANCE.upgrades[e.counter];
    assert.ok(up, e.counter);
    assert.ok(e.fullAt <= (up.maxLevel ?? Infinity), e.zone);
    assert.ok((up.unlockStage ?? 0) <= zoneStartStage(zi(e.zone)), e.zone);
  }
  assert.equal(Object.keys(BALANCE.upgrades).length, 15); // v9.2.8 : + Défense et Double attaque
  assert.ok(!BALANCE.upgradeCategories.some((c) => c.id === 'adapt'));
});

test('v9.2.1 : valeur selon le cycle (×1,25 par cycle, ×2 au plus) et part contrée selon le niveau', () => {
  const s = createNewState(NOW);
  const lava = ENVIRONMENTS.find((e) => e.zone === 'volcano');
  assert.equal(environmentFor(s, zi('volcano'), 1).pct, lava.base);
  assert.equal(environmentFor(s, zi('volcano'), 2).pct, lava.base * 1.25);
  assert.equal(environmentFor(s, zi('volcano'), 9).pct, lava.base * 2);
  s.upgrades[lava.counter] = lava.fullAt / 2;
  assert.equal(environmentFor(s, zi('volcano'), 1).countered, 50);
  assert.equal(environmentFor(s, zi('volcano'), 1).pct, lava.base / 2);
  s.upgrades[lava.counter] = 9999;
  assert.equal(environmentFor(s, zi('volcano'), 1).pct, 0);
});

test('v9.2.1 : effet de chaque malus sur les statistiques de combat', () => {
  const s = createNewState(NOW);
  s.upgrades.crit = 20; s.upgrades.armor = 10;
  const base = computeHeroStats(s);
  const st = (id) => applyEnvironment(base, environmentFor(s, zi(id), 1));
  assert.ok(st('forest').missPct > 0);
  assert.ok(st('caves').hurtMult > 1);
  assert.ok(st('desert').regenPerSecond < base.regenPerSecond);
  assert.ok(st('mountains').maxHp < base.maxHp);
  assert.ok(st('cursed').damage < base.damage);
  assert.ok(st('swamp').attackInterval > base.attackInterval);
  assert.ok(st('sky').critChance < base.critChance);
  assert.ok(st('volcano').burnPerSecond > 0);
  assert.ok(st('void').bossMult < 1);
  assert.ok(st('ocean').maxHp < base.maxHp);
  assert.ok(st('abyss').companionMult < 1);
  assert.equal(computeHeroStats(s).dps, base.dps); // la fiche (computeHeroStats) n'est pas touchée
});

function run(state, seconds, seed = 3) {
  const world = createCombat(state);
  const rng = new Rng(seed);
  const events = [];
  let minHp = Infinity;
  for (let t = 0; t < seconds; t += 0.05) {
    step(state, world, 0.05, rng);
    events.push(...world.events);
    world.events.length = 0;
    minHp = Math.min(minHp, world.hero.hp);
  }
  return { world, events, minHp };
}

test('v9.2.1 : en combat — la Lave brûle sans tuer seule, la Pénombre fait manquer, le monde 1 est intact', () => {
  const s = createNewState(NOW);
  s.stage = zoneStartStage(zi('volcano')); s.maxStage = s.stage; s.autoAdvance = false;
  s.upgrades.vitality = 400; s.upgrades.regen = 0;
  // Sans ennemi au contact : on ne mesure que la brûlure.
  const world = createCombat(s);
  world.spawnTimer = 1e9; world.bossDelay = 1e9; world.waveTimer = 1e9; // v9.3.8 : vagues
  const rng = new Rng(1);
  for (let t = 0; t < 120; t += 0.05) step(s, world, 0.05, rng);
  assert.ok(world.hero.hp >= 1 && world.hero.hp < world.heroStats.maxHp * 0.5);
  assert.ok(!world.hero.dead);

  const f = createNewState(NOW);
  f.stage = zoneStartStage(zi('forest')); f.maxStage = f.stage; f.autoAdvance = false; f.upgrades.damage = 200; f.upgrades.vitality = 200;
  assert.ok(run(f, 30).events.some((e) => e.type === 'heroMiss'));
  f.upgrades.crit = 50; // complet : plus aucun coup manqué
  assert.equal(currentEnvironment(f).pct, 0);
  assert.ok(!run(f, 30).events.some((e) => e.type === 'heroMiss'));

  const p = createNewState(NOW);
  assert.equal(currentEnvironment(p), null);
  assert.ok(!run(p, 20).events.some((e) => e.type === 'heroMiss'));
});

test('v9.2.1 : Tour et mode monde sans malus ; donjon du monde au cycle 1', () => {
  const s = createNewState(NOW);
  s.stage = 300;
  assert.ok(currentEnvironment(s));
  assert.equal(currentEnvironment({ ...s, tower: { floor: 3 } }), null);
});

test('v9.2.1 : textes traduits (anglais, coréen)', () => {
  const s = createNewState(NOW);
  for (const e of ENVIRONMENTS) {
    const line = envLine(environmentFor(s, zi(e.zone), 1));
    for (const tr of [en, ko]) {
      const out = tr(line);
      assert.ok(out && !/contré|Environnement|manquent|perdez|dégâts/.test(out), `${line} → ${out}`);
    }
  }
  for (const t of ['contré 40 %', 'contre Lave', 'Environnements des mondes']) {
    assert.notEqual(en(t), t); assert.notEqual(ko(t), t);
  }
});
