import assert from 'node:assert/strict';
import { rebirthMultiplier } from '../src/core/stats.js';
import { test } from 'node:test';

import { BALANCE } from '../src/data/balance.js';
import { BOSSES } from '../src/data/enemies.js';
import { ZONES } from '../src/data/zones.js';
import { bossesForStage, bossTierForStage, createCombat, enemyStats, step, zoneStartStage } from '../src/core/combat.js';
import { claimAllMissions, refreshMissions } from '../src/core/missions.js';
import { buyPerk, prestigeEffects } from '../src/core/prestige.js';
import { performRebirth } from '../src/core/rebirth.js';
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
    if (zone.gauntlet) continue;
    const base = zoneStartStage(i) - 1;
    assert.equal(BOSSES[bossesForStage(base + 5)[0]].tier, 'mini');
    assert.equal(BOSSES[bossesForStage(base + 15)[0]].tier, 'hard');
    assert.deepEqual(bossesForStage(base + 20), zone.bosses);
  }
  // Un méga boss est plus coriace qu'un mini-boss au même niveau.
  assert.ok(enemyStats(20, 'slime_king', true).hp > enemyStats(20, 'mini_goblin_warlord', true).hp);
  // Monde 12 (v9.2.0 : après le Royaume englouti) : chaque étape est le méga boss d'un monde ; ensuite retour au monde 1.
  assert.deepEqual(bossesForStage(221), ZONES[0].bosses);
  assert.deepEqual(bossesForStage(230), ZONES[9].bosses);
  assert.deepEqual(bossesForStage(250), ZONES[0].bosses);
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

test('renaissance (prestige fusionné) : bonus permanent et bonus éternels en fragments', () => {
  const state = createNewState(0, 4);
  state.maxStage = 40;
  state.level = 30;
  state.companions.owned = { squire: { stars: 2, level: 7 } };
  state.powers = { slime_king: { current: 'gel_heart' }, alpha_wolf: { current: 'pack_fury' } };
  state.equippedPowers = ['alpha_wolf', 'slime_king'];
  assert.ok(performRebirth(state, 'slime_king') > 0);
  assert.deepEqual(Object.keys(state.powers), ['slime_king'], 'un seul pouvoir conservé');
  assert.equal(state.level, 1);
  assert.equal(state.companions.owned.squire.level, 1);
  assert.equal(state.companions.owned.squire.stars, 2);
  assert.ok(rebirthMultiplier(state) > 1, 'bonus permanent par Renaissance (v8.4 : multiplicateur)');
  state.fragments = 100;
  assert.ok(buyPerk(state, 'power'));
  assert.equal(state.fragments, 90);
  // Anciennes étoiles de prestige converties en fragments.
  const back = sanitizeState({ ...JSON.parse(JSON.stringify(state)), version: 5, prestige: { count: 1, stars: 3, perks: {} } }, BALANCE, 0);
  assert.equal(back.fragments, 90 + 30);
  assert.equal(back.prestige.stars, 0);
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
