import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { arenaState, companionProfile, fight, floorSetup, runFloor, runSurvival, survivalTriesLeft, survivalWave } from '../src/core/arena.js';
import { ARENA } from '../src/data/arena.js';
import { COMPANIONS } from '../src/data/companions.js';
import { ADV, WEAK } from '../src/core/elements.js';

const DAY = Date.UTC(2026, 10, 9, 12);
function player() {
  const s = createNewState(DAY, 1);
  s.maxStage = 40;
  for (const id of ['pyromancer', 'priestess', 'phoenix', 'ice_empress']) s.companions.owned[id] = { level: 10, stars: 2 };
  return s;
}

test('arène : aucun héros — seuls les compagnons demandés combattent', () => {
  const s = player();
  const r = runSurvival(s, 'pyromancer', DAY);
  assert.deepEqual(r.team.map((p) => p.id), ['pyromancer'], 'Survie : un seul compagnon');
  const who = new Set(r.fight.events.filter((e) => e.who).map((e) => e.who));
  assert.deepEqual([...who], ['pyromancer'], 'aucune autre unité (pas de héros)');
  const f = runFloor(s, ['priestess', 'phoenix', 'ice_empress', 'pyromancer'], DAY);
  assert.equal(f.team.length, ARENA.floors.teamSize, 'Étages : 3 au plus');
  for (const e of f.fight.events.filter((x) => x.who)) assert.ok(['priestess', 'phoenix', 'ice_empress'].includes(e.who));
  assert.ok(!f.team.some((p) => !COMPANIONS.find((c) => c.id === p.id)), 'que des compagnons ou familiers');
});

test('arène : 3 essais de survie par jour, remis le lendemain ; paliers donnés une seule fois', () => {
  const s = player();
  for (let i = 0; i < 3; i++) assert.ok(runSurvival(s, 'pyromancer', DAY));
  assert.equal(survivalTriesLeft(s, DAY), 0);
  assert.equal(runSurvival(s, 'pyromancer', DAY), null);
  assert.equal(survivalTriesLeft(s, DAY + 86400000), 3);
  const claimed = arenaState(s, DAY).survival.claimed.length;
  const gems = s.gems;
  runSurvival(s, 'pyromancer', DAY + 86400000);
  assert.ok(arenaState(s, DAY + 86400000).survival.claimed.length >= claimed);
  assert.ok(s.gems >= gems);
  assert.equal(new Set(arenaState(s, DAY + 86400000).survival.claimed).size, arenaState(s, DAY + 86400000).survival.claimed.length, 'aucun palier en double');
});

test('arène : étages permanents, récompense au premier passage seulement', () => {
  const s = player();
  const a = runFloor(s, ['priestess', 'phoenix', 'pyromancer'], DAY);
  assert.ok(a.won, 'étage 1 franchi');
  assert.equal(arenaState(s).floors.best, 1);
  const b = runFloor(s, ['priestess', 'phoenix', 'pyromancer'], DAY);
  assert.equal(b.floor, 2, 'on continue à l\'étage suivant (pas de répétition de la récompense du 1)');
});

test('arène : les ennemis frappent selon les affinités (une seule fois par coup)', () => {
  const ally = { id: 'x', element: 'green', maxHp: 1e9, atk: 0, def: 0, interval: 99, skill: null };
  const mk = (el) => ({ n: 1, foes: [{ element: el, maxHp: 1e9, atk: 100, def: 0, interval: 1, regen: 0 }] });
  const hurt = (el) => fight([ally], [mk(el)], { seed: 1, limit: 3 }).events.find((e) => e.kind === 'hurt').d;
  assert.equal(hurt('red'), 100 * ADV, 'rouge > vert');
  assert.equal(hurt('blue'), 100 * WEAK, 'bleu < vert');
  assert.equal(hurt('light'), 100, 'neutre');
});

test('arène : profils, vagues et étages déterministes ; sauvegarde relue', () => {
  const s = player();
  const p = companionProfile(s, 'pyromancer');
  assert.ok(p.maxHp > 0 && p.atk > 0 && p.element === 'red');
  assert.deepEqual(survivalWave(7, 3), survivalWave(7, 3));
  assert.deepEqual(floorSetup(10), floorSetup(10));
  assert.ok(floorSetup(10).boss && survivalWave(10, 1).boss);
  runSurvival(s, 'pyromancer', DAY);
  const back = sanitizeState(JSON.parse(JSON.stringify(s)), undefined, DAY);
  assert.deepEqual(back.arena.survival.best, s.arena.survival.best);
  assert.equal(back.arena.survival.tries, 1);
  assert.equal(sanitizeState({ ...JSON.parse(JSON.stringify(s)), arena: 'bad' }, undefined, DAY).arena, null);
});

import { GLOBAL_BOSS, finishGlobalBoss, globalBossLeft, startGlobalBoss } from '../src/core/arena.js';
test('World Boss mondial : 1 tentative par jour, distinct du World Boss d\'événement (aucun écu)', () => {
  const s = player();
  const eco = JSON.stringify(s.economy);
  const setup = startGlobalBoss(s, 1e6, DAY);
  assert.ok(setup && setup.event === 'global');
  assert.equal(startGlobalBoss(s, 1e6, DAY), null, 'une seule tentative');
  assert.equal(globalBossLeft(s, DAY), 0);
  const gems = s.gems;
  const r = finishGlobalBoss(s, setup, { damage: 1234.7, tiers: 1 }, DAY);
  assert.equal(r.damage, 1234); assert.equal(r.coins, 0);
  assert.equal(s.gems, gems + GLOBAL_BOSS.reward.gems);
  assert.equal(JSON.stringify(s.economy), eco, 'rien n\'est compté pour l\'événement');
  assert.equal(globalBossLeft(s, DAY + 86400000), 1, 'nouvelle tentative le lendemain');
});
