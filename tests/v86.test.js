import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { applyCheat, simSpeed, SKIP_SPEED } from '../src/core/cheats.js';
import { RUSHES } from '../src/data/rushes.js';
import { SKILLS } from '../src/data/skills.js';
import { ART } from '../src/render/art.js';

test('v8.6 : code SKIPBATTLE (combats passés) — bascule, vitesse maximale, sauvegardé', () => {
  const s = createNewState(Date.now(), 1);
  assert.equal(simSpeed(s), 1);
  assert.ok(applyCheat(s, 'skipbattle'));
  assert.equal(s.cheats.skipBattle, true);
  assert.equal(simSpeed(s), SKIP_SPEED);
  assert.equal(sanitizeState(JSON.parse(JSON.stringify(s))).cheats.skipBattle, true);
  applyCheat(s, 'PASSECOMBAT');
  assert.equal(simSpeed(s), 1);
});

test('v8.6 : les boosts ont leurs propres icônes (plus de réemploi des compétences)', () => {
  const skillIcons = new Set(SKILLS.map((sk) => sk.icon));
  const boostIcons = RUSHES.map((r) => r.icon);
  assert.equal(new Set(boostIcons).size, RUSHES.length);
  for (const id of boostIcons) {
    assert.ok(!skillIcons.has(id), id);
    assert.match(id, /^boost_/);
  }
  for (const id of boostIcons) assert.ok(ART[id], `icône générée : ${id}`);
});

test('v8.7 : la Tour se durcit de plus en plus vite (une ascension finit toujours)', async () => {
  const { towerLevel } = await import('../src/core/tower.js');
  const s = createNewState(Date.now(), 2);
  s.maxStage = 400;
  const d1 = towerLevel(s, 101) - towerLevel(s, 100);
  const d2 = towerLevel(s, 401) - towerLevel(s, 400);
  assert.ok(d2 > d1 * 2.5, `${d1} → ${d2}`);
  assert.ok(towerLevel(s, 429) > 200 + 429 * 3 + 4000);
});

test('v8.8 : Transcendance — Étoiles, Renaissances en partie gardées, bonus stellaires, entropie', async () => {
  const { performTranscend, transcendReward, buyTranscendPerk, enemyScaleFactor, stellarMultiplier } = await import('../src/core/transcend.js');
  const { performRebirth } = await import('../src/core/rebirth.js');
  const { computeHeroStats, rebirthMultiplier } = await import('../src/core/stats.js');
  const s = createNewState(Date.now(), 4);
  s.maxStage = 600;
  assert.equal(transcendReward(s), 0, 'verrouillée avant le monde 11 ×3');
  s.maxStage = 1883; s.stage = 1800; s.records.rebirths = 40; s.fragments = 999; s.talents = { core: 3 };
  const before = rebirthMultiplier(s);
  const stars = performTranscend(s, performRebirth);
  assert.ok(stars > 20, String(stars));
  assert.equal(s.records.rebirths, 0);
  assert.equal(s.transcend.keptRebirths, 10, '25 % de 41 (la Transcendance fait aussi une Renaissance)');
  assert.deepEqual(s.talents, {});
  assert.equal(s.fragments, 0);
  assert.equal(s.stage, 1);
  assert.equal(stellarMultiplier(s), 2);
  assert.ok(rebirthMultiplier(s) < before && rebirthMultiplier(s) > 1);
  const dmg = computeHeroStats(s).damage;
  assert.ok(buyTranscendPerk(s, 'stellar'));
  assert.ok(Math.abs(computeHeroStats(s).damage / dmg - 1.5) < 1e-9);
  assert.equal(enemyScaleFactor(s, 100).hp, 1);
  s.transcend.stars += 100;
  assert.ok(buyTranscendPerk(s, 'scaling'));
  assert.ok(enemyScaleFactor(s, 100).hp < 1);
  const back = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(back.transcend.count, 1);
  assert.equal(back.transcend.perks.stellar, 1);
});

test('v8.8 : Tour — chrono de 10 h, +temps décroissant par étage, effondrement', async () => {
  const { startTower, clearTowerFloor, towerTimeLeft, TOWER } = await import('../src/core/tower.js');
  const s = createNewState(Date.now(), 5);
  s.maxStage = 100;
  assert.ok(startTower(s));
  assert.equal(towerTimeLeft(s), TOWER.timeLimit);
  s.playSeconds += 3600;
  const r = clearTowerFloor(s);
  assert.ok(r.bonus > 0 && r.bonus <= TOWER.floorBonus);
  assert.ok(towerTimeLeft(s) > TOWER.timeLimit - 3600);
  for (let i = 0; i < 2000; i++) clearTowerFloor(s);
  assert.ok(towerTimeLeft(s) < TOWER.timeLimit + 1, 'jamais plus de 10 h devant soi');
  // Ancienne ascension sans chrono : comptée depuis son début → effondrée.
  const raw = JSON.parse(JSON.stringify(s));
  delete raw.tower.deadline;
  raw.tower.startPlay = 0; raw.playSeconds = 1e7;
  assert.equal(towerTimeLeft(sanitizeState(raw)), 0);
});

test('v8.8 : achat en masse dans l\'arbre (le moins cher d\'abord, par région)', async () => {
  const { buyTalentsCheapest, regionPoints } = await import('../src/core/rebirth.js');
  const s = createNewState(Date.now(), 6);
  s.fragments = 200;
  const n = buyTalentsCheapest(s, 'combat');
  assert.ok(n > 5);
  assert.ok(regionPoints(s, 'combat') > 0);
  assert.equal(regionPoints(s, 'resources'), 0);
  assert.ok(s.fragments < 200);
});
