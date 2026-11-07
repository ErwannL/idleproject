// v9.2.8 : Défense, Double attaque, Puissance de combat, coups encaissés, courbe de dégâts ennemis et sauvegardes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/data/balance.js';
import { createNewState, sanitizeState, SAVE_VERSION } from '../src/core/state.js';
import { computeHeroStats, defenseReduction } from '../src/core/stats.js';
import { createCombat, damageCurve, damageTakenFactor, enemyStats, hitsToFall, step } from '../src/core/combat.js';
import { Rng } from '../src/core/rng.js';
import { translate as en } from '../src/i18n/en.js';
import { translate as ko } from '../src/i18n/ko.js';

const NOW = Date.UTC(2026, 10, 7, 12);
const withUps = (s, ups) => ({ ...s, upgrades: { ...s.upgrades, ...ups } });

test('v9.2.8 : Défense à rendement décroissant (la moitié du plafond à halfAt, jamais le plafond)', () => {
  const d = BALANCE.upgrades.defense;
  assert.equal(defenseReduction(0), 0);
  assert.equal(defenseReduction(d.halfAt), d.capPct / 2);
  let prev = 0; let prevGain = Infinity;
  for (let p = 100; p <= 5000; p += 100) {
    const r = defenseReduction(p);
    assert.ok(r > prev && r < d.capPct, `${p} → ${r}`);
    assert.ok(r - prev < prevGain + 1e-9, 'gain de plus en plus petit');
    prevGain = r - prev; prev = r;
  }
  const s = withUps(createNewState(NOW), { defense: 60 });
  assert.equal(computeHeroStats(s).defense, 600);
  assert.equal(computeHeroStats(s).defenseReductionPct, 30);
});

test('v9.2.8 : armure et Défense réduisent les coups, percées de 40 % par les boss', () => {
  const stats = { armor: 50, defenseReductionPct: 30 };
  assert.ok(Math.abs(damageTakenFactor(stats, false) - 0.5 * 0.7) < 1e-9);
  assert.ok(Math.abs(damageTakenFactor(stats, true) - (1 - 0.3) * (1 - 0.18)) < 1e-9);
  assert.equal(damageTakenFactor({ armor: 0 }, true), 1);
});

test('v9.2.8 : Double attaque — second coup visible en combat et compté dans les dégâts/s', () => {
  const base = createNewState(NOW);
  const s = withUps(base, { doubleAttack: 50 });
  assert.equal(computeHeroStats(s).doubleAttackPct, BALANCE.upgrades.doubleAttack.capPct);
  assert.ok(Math.abs(computeHeroStats(s).dps / computeHeroStats(base).dps - 1.2) < 1e-9);
  assert.equal(computeHeroStats(withUps(base, { doubleAttack: 999 })).doubleAttackPct, 20, 'plafond même sur une sauvegarde trafiquée');
  const count = (st) => {
    const state = structuredClone(st); state.autoAdvance = false;
    const world = createCombat(state); const rng = new Rng(4);
    let doubles = 0; let attacks = 0;
    for (let t = 0; t < 60; t += BALANCE.simulation.tickSeconds) {
      step(state, world, BALANCE.simulation.tickSeconds, rng);
      for (const e of world.events) if (e.type === 'heroAttack') { attacks += 1; if (e.double) doubles += 1; }
      world.events.length = 0;
    }
    return { doubles, attacks };
  };
  assert.equal(count(base).doubles, 0);
  const r = count(s);
  assert.ok(r.doubles > 0 && r.doubles < r.attacks * 0.35, JSON.stringify(r));
});

test('v9.2.8 : Puissance de combat — grandit avec l\'attaque comme avec la survie', () => {
  const s = createNewState(NOW);
  const pc = (ups) => computeHeroStats(withUps(s, ups)).combatPower;
  assert.ok(pc({}) > 0);
  assert.ok(pc({ damage: 20 }) > pc({}));
  assert.ok(pc({ vitality: 20 }) > pc({}));
  assert.ok(pc({ defense: 20 }) > pc({}));
});

test('v9.2.8 : courbe de dégâts — début épargné, puis PV et Défense décident des coups encaissés', () => {
  assert.equal(damageCurve(0), 1);
  assert.ok(damageCurve(100) > damageCurve(50) && damageCurve(50) > 1);
  assert.ok(enemyStats(2, 'slime', false).damage < 10, 'monde 1 : un gluant tape toujours peu');
  // Héros du joueur (capture) : 230 niveaux de Dégâts, rien en PV ni en Défense, étape 4-20 : un coup suffit.
  const glass = createNewState(NOW);
  Object.assign(glass, { maxStage: 80, stage: 80, level: 110 });
  Object.assign(glass.upgrades, { damage: 230, attackSpeed: 188, crit: 50, critDamage: 53, bossDamage: 75, companionPower: 74 });
  const h0 = hitsToFall(glass);
  assert.ok(h0.normal < 1.5, `sans PV : ${h0.normal}`);
  // Le même héros avec des PV et de la Défense achetés tient plusieurs coups, boss compris.
  const tank = withUps(glass, { vitality: 140, defense: 60, armor: 30 });
  const h1 = hitsToFall({ ...glass, upgrades: tank.upgrades });
  assert.ok(h1.normal >= 4 && h1.boss >= 2, JSON.stringify(h1));
  assert.ok(h1.bossHit > h1.normalHit, 'un coup de boss reste plus fort');
});

test('v9.2.8 : sauvegarde v9 (avant Défense et Double attaque) — aucune perte, nouvelles lignes à 0', () => {
  const old = createNewState(NOW);
  old.version = 9;
  old.gold = 123456789;
  Object.assign(old.upgrades, { damage: 230, attackSpeed: 188, vitality: 12, armor: 7, crit: 50, critDamage: 53, bossDamage: 75, companionPower: 74 });
  delete old.upgrades.defense;
  delete old.upgrades.doubleAttack;
  const raw = JSON.parse(JSON.stringify(old));
  const s = sanitizeState(raw, BALANCE, NOW);
  assert.ok(SAVE_VERSION >= 10, 'une seule montée pour la 9.2.8, partagée avec l\'économie');
  for (const [k, v] of Object.entries(raw.upgrades)) assert.equal(s.upgrades[k], v, k);
  assert.equal(s.upgrades.defense, 0);
  assert.equal(s.upgrades.doubleAttack, 0);
  assert.equal(s.gold, 123456789);
});

test('v9.2.8 : textes traduits (anglais et coréen)', () => {
  for (const t of ['Défense', 'Double attaque', BALANCE.upgrades.defense.description, BALANCE.upgrades.doubleAttack.description, 'Encaisse', 'coups · boss', 'Coups encaissés (ennemi · boss)', 'Santé', 'Toutes', 'Trier']) {
    assert.notEqual(en(t), t, t);
    assert.notEqual(ko(t), t, t);
  }
  assert.equal(en('+12,5 % PV effectifs'), '+12.5% effective HP');
  assert.ok(/[가-힣]/.test(ko('+12,5 % PV effectifs')));
  assert.equal(en('PV 1,2 M · coup ordinaire 300 K · coup du boss 1 M'), 'HP 1.2 M · normal hit 300 K · boss hit 1 M');
});
