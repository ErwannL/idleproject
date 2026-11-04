#!/usr/bin/env node
// v9.2.2 : mesure de la ruée (BALANCE.rush) avec le moteur réel : temps moyen par vague (étape ordinaire de
// 15 ennemis) pour une équipe qui tue d'un coup, sans ruée (avant) et avec (après), pour trois classes
// (corps à corps, archer, mage) et deux mondes. Horloge et hasard fixes.
// Usage : node tools/measure-ruee-v922.mjs
const T0 = new Date(2026, 10, 4, 10).getTime();
let simMs = 0;
Date.now = () => T0 + simMs;
let seed = 0x9e3779b9;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

const { BALANCE } = await import('../src/data/balance.js');
const { createNewState } = await import('../src/core/state.js');
const { createCombat, step, isBossStage } = await import('../src/core/combat.js');
const { Rng } = await import('../src/core/rng.js');

const DT = BALANCE.simulation.tickSeconds;
const RUSH = BALANCE.rush;

function run(heroClass, startStage, rush, waves = 12) {
  BALANCE.rush = rush ? RUSH : null;
  simMs = 0; seed = 0x9e3779b9;
  const s = createNewState(T0);
  s.heroClass = heroClass;
  s.stage = startStage; s.maxStage = startStage;
  for (const k of Object.keys(s.upgrades)) s.upgrades[k] = 400; // équipe très forte : tue d'un coup
  const world = createCombat(s);
  const rng = new Rng(1234);
  let t = 0, cleared = 0, last = 0;
  const times = [];
  let stage = s.stage;
  while (cleared < waves && t < 3600) {
    step(s, world, DT, rng); t += DT; simMs += DT * 1000;
    if (s.stage !== stage) {
      if (!isBossStage(stage)) times.push(t - last);
      last = t; stage = s.stage; cleared++;
    }
  }
  BALANCE.rush = RUSH;
  return times.reduce((a, b) => a + b, 0) / Math.max(1, times.length);
}

console.log('classe   | étape | avant (s/vague) | après (s/vague) | écart');
for (const cls of ['knight', 'archer', 'pyromancer']) {
  for (const st of [2, 141]) {
    const a = run(cls, st, false), b = run(cls, st, true);
    console.log(`${cls.padEnd(9)}| ${String(st).padEnd(6)}| ${a.toFixed(2).padEnd(16)}| ${b.toFixed(2).padEnd(16)}| ${((b / a - 1) * 100).toFixed(1)} %`);
  }
}
