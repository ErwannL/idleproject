// v9.7.1 (lot 2) : interaction légère en combat — jamais punitive, l'absent avance toujours.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState } from '../src/core/state.js';
import { createCombat, step, changeStage, playerCast, playerGuard, playerWeakSpot, comboBonus, combatAssist, cooldownRatio } from '../src/core/combat.js';
import { Rng } from '../src/core/rng.js';
import { SKILLS } from '../src/data/skills.js';

const NOW = 1_700_000_000_000;

test('recharges de 20 à 45 s, puissance compensée', () => {
  for (const sk of SKILLS) { const cd = sk.cooldown * cooldownRatio(sk); assert.ok(cd >= 20 && cd <= 45, sk.id); }
});

test('Mixte par défaut ; une compétence à la main compte pour l\'enchaînement', () => {
  const s = createNewState(NOW); s.level = 10; s.skills.quick = 1;
  assert.equal(combatAssist(s), 'mixed');
  const w = createCombat(s); const rng = new Rng(1);
  let cast = false;
  for (let i = 0; i < 400 && !cast; i++) { step(s, w, 0.05, rng); if (playerCast(w, 'quick')) { step(s, w, 0.05, rng); cast = w.events.some((e) => e.type === 'skill'); } w.events.length = 0; }
  assert.ok(cast, 'lancée à la main');
  assert.ok(comboBonus(w) > 1);
});

test('boss : au moins 4 occasions d\'agir sur un combat ; parade et point faible', () => {
  const s = createNewState(NOW, 4); s.maxStage = 20; s.level = 60; s.upgrades.vitality = 200; s.upgrades.damage = 5; s.skills.quick = 1; s.skills.whirl = 1;
  const w = createCombat(s); changeStage(s, w, 20);
  const rng = new Rng(4);
  let chances = 0, guards = 0, weak = 0;
  for (let i = 0; i < 1200; i++) {
    step(s, w, 0.05, rng);
    for (const e of w.events) {
      if (e.type === 'bossHeavy') { chances++; if (playerGuard(w)) guards++; }
      if (e.type === 'weakSpot') { chances++; if (playerWeakSpot(w)) weak++; }
    }
    w.events.length = 0;
    for (const id of ['quick', 'whirl']) if (playerCast(w, id)) chances++;
  }
  assert.ok(chances >= 4, `occasions : ${chances}`);
  assert.ok(guards >= 1 && weak >= 1, `parades ${guards}, points faibles ${weak}`);
});
