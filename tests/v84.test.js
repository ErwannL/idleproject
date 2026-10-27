import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { formatNumber } from '../src/core/format.js';
import { applyCheat, unlockedSpeeds } from '../src/core/cheats.js';
import { startTower, clearTowerFloor, endTower, climbsLeft, towerWeek } from '../src/core/tower.js';
import { BALANCE } from '../src/data/balance.js';

const NOW = Date.now();

test('v8.4 : unités K M B T puis aa…zz', () => {
  assert.equal(formatNumber(1e15), '1 aa');
  assert.equal(formatNumber(2.5e18), '2,5 ab');
  assert.equal(formatNumber(1e93), '1 ba');
  assert.ok(!/e\+/.test(formatNumber(1.2e300)));
});

test('v8.4 : vitesses débloquées par code', () => {
  const s = createNewState(NOW, 1);
  assert.deepEqual(unlockedSpeeds(s), [1]);
  applyCheat(s, 'vitesse10');
  applyCheat(s, 'VITESSE100');
  assert.deepEqual(unlockedSpeeds(s), [1, 10, 100]);
  assert.deepEqual(unlockedSpeeds(sanitizeState(JSON.parse(JSON.stringify(s)))), [1, 10, 100]);
});

test('v8.4 : Tour une fois par semaine, récompense hebdomadaire distincte du record', () => {
  const s = createNewState(NOW, 1);
  s.maxStage = 80;
  assert.ok(startTower(s));
  clearTowerFloor(s); clearTowerFloor(s);
  endTower(s);
  assert.equal(climbsLeft(s), 0);
  assert.equal(startTower(s), false);
  applyCheat(s, 'TOWERPASS');
  assert.ok(startTower(s));
  const r = clearTowerFloor(s);
  assert.equal(r.record, false);
  assert.equal(r.weekly, false);
  s.towerWeek.week = '2000-01-03'; // semaine suivante : remise à zéro
  assert.equal(towerWeek(s).best, 0);
  assert.equal(climbsLeft(s), 1);
});

test('v8.4 : défaite contre un boss → on recule et on ne le retente qu\'à +15 % de puissance', async () => {
  const { createCombat, heroPower } = await import('../src/core/combat.js');
  const s = createNewState(NOW, 1);
  s.maxStage = 10; s.stage = 9; s.autoAdvance = true; s.level = BALANCE.level.maxLevel; s.upgrades.damage = 30; s.upgrades.vitality = 30;
  s.bossRetry = { stage: 10, power: heroPower(s) };
  const w = createCombat(s);
  const { step } = await import('../src/core/combat.js');
  const { Rng } = await import('../src/core/rng.js');
  s.kills = BALANCE.stages.killsPerStage - 1;
  // Tue des ennemis jusqu'à finir l'étape : on reste à 9 (pas assez fort).
  for (let i = 0; i < 4000 && s.stage === 9; i++) step(s, w, 0.05, new Rng(i));
  assert.equal(s.stage, 9);
  s.upgrades.damage = 80; s.upgrades.vitality = 80; // bien plus fort
  for (let i = 0; i < 8000 && s.stage === 9; i++) step(s, w, 0.05, new Rng(i));
  assert.equal(s.stage, 10);
  assert.equal(s.bossRetry, null);
});

test('v8.4 : migration — améliorations remboursées, objets recalculés, Renaissance multiplicative', async () => {
  const { rebirthMultiplier, computeHeroStats } = await import('../src/core/stats.js');
  const s = createNewState(NOW, 2);
  s.upgrades.damage = 100; s.upgrades.vitality = 50;
  const raw = JSON.parse(JSON.stringify(s));
  raw.version = 5;
  const back = sanitizeState(raw);
  assert.equal(back.upgrades.damage, 0);
  const expected = 10 * (1.17 ** 100 - 1) / 0.17 + 15 * (1.16 ** 50 - 1) / 0.16;
  assert.ok(Math.abs(back.gold - s.gold - expected) / expected < 1e-6);
  assert.equal(back.migrationRefund > 0, true);
  // Pas de nouveau remboursement une fois en version 6.
  const again = sanitizeState(JSON.parse(JSON.stringify({ ...back, upgrades: { ...back.upgrades, damage: 10 } })));
  assert.equal(again.upgrades.damage, 10);
  const r = createNewState(NOW, 2);
  const base = computeHeroStats(r).damage;
  r.records.rebirths = 2;
  assert.ok(Math.abs(rebirthMultiplier(r) - 2.25) < 1e-9);
  assert.ok(Math.abs(computeHeroStats(r).damage / base - 2.25) < 1e-6);
});

test('v8.4 : bannière de la semaine (Légendaire mis en avant) et historique', async () => {
  const { featuredUnit, summon, summonOdds } = await import('../src/core/gacha.js');
  const { Rng } = await import('../src/core/rng.js');
  const f = featuredUnit('ally');
  assert.equal(f.rarity, 'legendary');
  const legend = summonOdds('ally').find((r) => r.rarity === 'legendary');
  const fu = legend.units.find((u) => u.featured);
  assert.ok(Math.abs(fu.chance - legend.chance * 0.5) < 1e-9);
  const total = legend.units.reduce((a, u) => a + u.chance, 0);
  assert.ok(Math.abs(total - legend.chance) < 1e-9);
  const s = createNewState(NOW, 3);
  s.gems = 1e7;
  let featured = 0; let legends = 0;
  const rng = new Rng(4);
  for (let i = 0; i < 300; i++) for (const r of summon(s, rng, 10, 'gems')) if (r.rarity === 'legendary') { legends += 1; if (r.id === f.id) featured += 1; }
  assert.ok(legends > 20 && featured / legends > 0.35 && featured / legends < 0.65, `${featured}/${legends}`);
  assert.equal(s.summon.history.length, 60);
  assert.equal(sanitizeState(JSON.parse(JSON.stringify(s))).summon.history.length, 60);
});

test('v8.4 : prévision du prochain boss et conseils', async () => {
  const { forecastBoss, advice } = await import('../src/core/guide.js');
  const s = createNewState(NOW, 3);
  const weak = forecastBoss(s);
  s.upgrades.damage = 200; s.upgrades.vitality = 200;
  const strong = forecastBoss(s);
  assert.equal(strong.win, true);
  assert.ok(!weak.win || weak.seconds >= strong.seconds);
  s.gold = 1e30;
  assert.ok(advice(s).some((t) => t.tab === 'upgrades'));
});
