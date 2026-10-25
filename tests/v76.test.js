import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BALANCE } from '../src/data/balance.js';
import { BOSSES } from '../src/data/enemies.js';
import { ZONES } from '../src/data/zones.js';
import { bossesForStage, bossTierForStage, createCombat, enemyStats, step } from '../src/core/combat.js';
import { claimAllMissions, refreshMissions } from '../src/core/missions.js';
import { buyPerk, canPrestige, performPrestige, prestigeEffects } from '../src/core/prestige.js';
import { activateRush, rushEffects, tickRushes, upgradeRush } from '../src/core/rushes.js';
import { learnSkill, skillPointCost, skillPointsAvailable } from '../src/core/skills.js';
import { computeHeroStats, softAttackSpeed } from '../src/core/stats.js';
import { Rng } from '../src/core/rng.js';
import { createNewState, oldStageToNew, sanitizeState } from '../src/core/state.js';
import { trackContracts } from '../src/core/contracts.js';

test('mondes de 20 étapes : mini-boss (5), boss (10), boss dur (15), méga boss (20)', () => {
  assert.equal(bossTierForStage(5), 'mini');
  assert.equal(bossTierForStage(10), 'mid');
  assert.equal(bossTierForStage(15), 'hard');
  assert.equal(bossTierForStage(20), 'mega');
  assert.equal(bossTierForStage(7), null);
  for (const [i, zone] of ZONES.entries()) {
    const base = i * 20;
    assert.equal(BOSSES[bossesForStage(base + 5)[0]].tier, 'mini');
    assert.equal(BOSSES[bossesForStage(base + 15)[0]].tier, 'hard');
    assert.deepEqual(bossesForStage(base + 20), zone.bosses);
  }
  // Un méga boss est plus coriace qu'un mini-boss au même niveau.
  assert.ok(enemyStats(20, 'slime_king', true).hp > enemyStats(20, 'mini_goblin_warlord', true).hp);
  // Après le monde 6 : retour au monde 1, avec des ennemis plus forts.
  assert.deepEqual(bossesForStage(140), ZONES[0].bosses);
});

test('ancienne sauvegarde (10 étapes par monde) convertie sans perdre la progression', () => {
  assert.equal(oldStageToNew(1), 1);
  assert.equal(oldStageToNew(10), 19);
  assert.equal(oldStageToNew(11), 21);
  const raw = { version: 4, stage: 25, maxStage: 25, inventory: [], equipment: {} };
  const s = sanitizeState(raw, BALANCE, 0);
  assert.equal(s.maxStage, 49);
});

test("vitesse d'attaque : rendements décroissants mais toujours en progrès", () => {
  assert.equal(softAttackSpeed(2), 2);
  assert.ok(softAttackSpeed(6) > softAttackSpeed(5));
  assert.ok(softAttackSpeed(12) > softAttackSpeed(10));
  assert.ok(softAttackSpeed(12) < 12);
  const state = createNewState(0, 1);
  state.upgrades.attackSpeed = 61;
  const a = computeHeroStats(state).attacksPerSecond;
  state.upgrades.attackSpeed = 62;
  assert.ok(computeHeroStats(state).attacksPerSecond > a);
});

test('compétences : 50 niveaux, paliers plus chers', () => {
  assert.equal(skillPointCost(0), 1);
  assert.equal(skillPointCost(10), 2);
  const state = createNewState(0, 2);
  state.level = 40;
  state.skills = { quick: 10 };
  const before = skillPointsAvailable(state);
  assert.ok(learnSkill(state, 'quick'));
  assert.equal(skillPointsAvailable(state), before - 2);
});

test('missions : tout récupérer', () => {
  const state = createNewState(0, 3);
  refreshMissions(state, new Date(2026, 9, 21, 12).getTime());
  trackContracts(state, 'kills', 300);
  const gems = state.gems;
  const total = claimAllMissions(state);
  assert.ok(total.gems > 0);
  assert.equal(state.gems, gems + total.gems);
  assert.equal(claimAllMissions(state), null);
});

test('prestige : après le monde 6, étoiles et bonus éternels', () => {
  const state = createNewState(0, 4);
  state.maxStage = 100;
  assert.ok(!canPrestige(state));
  state.maxStage = 130;
  state.fragments = 50;
  state.talents = { core: 1 };
  const stars = performPrestige(state);
  assert.ok(stars >= 1);
  assert.equal(state.fragments, 0);
  assert.deepEqual(state.talents, {});
  assert.equal(state.maxStage, 1);
  assert.ok(prestigeEffects(state).damagePct > 0);
  assert.ok(buyPerk(state, 'power'));
  const back = sanitizeState(JSON.parse(JSON.stringify(state)), BALANCE, 0);
  assert.deepEqual(back.prestige, state.prestige);
});

test('boosts à durée limitée : activation, durée, recharge, mode auto', () => {
  const state = createNewState(0, 5);
  state.level = 30;
  assert.ok(activateRush(state, 'rage'));
  assert.ok(!activateRush(state, 'rage'), 'pas deux fois');
  assert.ok(rushEffects(state).damagePct >= 100);
  tickRushes(state, 31);
  assert.equal(rushEffects(state).damagePct, undefined);
  assert.ok(state.rushes.cooldown.rage > 0);
  tickRushes(state, 300);
  state.rushes.auto = true;
  const { started } = tickRushes(state, 0.1);
  assert.ok(started.includes('rage'));
  state.gold = 1e12;
  assert.ok(upgradeRush(state, 'rage'));
  // La lame fantôme frappe pendant le combat.
  const s2 = createNewState(0, 6);
  s2.level = 30;
  activateRush(s2, 'phantom');
  const world = createCombat(s2);
  const rng = new Rng(1);
  let hits = 0;
  for (let i = 0; i < 400; i++) {
    step(s2, world, 0.05, rng);
    hits += world.events.filter((e) => e.type === 'phantomHit').length;
    world.events.length = 0;
  }
  assert.ok(hits > 5);
});
