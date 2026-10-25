import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DUNGEONS } from '../src/data/dungeons.js';
import { COMPANIONS } from '../src/data/companions.js';
import { BALANCE } from '../src/data/balance.js';
import { earlyBoost } from '../src/core/boost.js';
import { dungeonAffinity, dungeonDamageTaken } from '../src/core/companions.js';
import { trackContracts } from '../src/core/contracts.js';
import {
  claimLogin, claimMission, claimMissionBonus, loginDay, missionsClaimable, periodKey, refreshMissions,
} from '../src/core/missions.js';
import { createNewState, sanitizeState } from '../src/core/state.js';

const day = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();

test('missions : réinitialisation quotidienne, hebdomadaire (lundi) et mensuelle', () => {
  assert.equal(periodKey('weekly', day(2026, 10, 25)), '2026-10-19'); // dimanche → lundi précédent
  assert.equal(periodKey('weekly', day(2026, 10, 26)), '2026-10-26');
  assert.equal(periodKey('monthly', day(2026, 10, 25)), '2026-10');
  const state = createNewState(0, 3);
  refreshMissions(state, day(2026, 10, 25));
  trackContracts(state, 'kills', 500);
  assert.equal(state.missions.daily.progress.kills, 300);
  assert.equal(state.missions.weekly.progress.kills, 500);
  refreshMissions(state, day(2026, 10, 26));
  assert.equal(state.missions.daily.progress.kills, undefined);
  assert.equal(state.missions.weekly.progress.kills, undefined); // lundi : nouvelle semaine
  assert.equal(state.missions.monthly.progress.kills, 500);
});

test('missions : récompenses en gemmes, coffre bonus quand tout est récupéré', () => {
  const state = createNewState(0, 4);
  refreshMissions(state, day(2026, 10, 25));
  assert.ok(missionsClaimable(state));
  const gems = state.gems;
  assert.ok(claimMission(state, 'daily', 'login'));
  assert.equal(claimMission(state, 'daily', 'login'), null); // pas deux fois
  assert.equal(claimMission(state, 'daily', 'kills'), null); // pas encore rempli
  for (const [type, n] of [['kills', 300], ['bosses', 3], ['recycle', 15], ['summons', 3]]) trackContracts(state, type, n);
  for (const id of ['kills', 'bosses', 'recycle', 'summons']) assert.ok(claimMission(state, 'daily', id));
  assert.ok(claimMissionBonus(state, 'daily'));
  assert.equal(claimMissionBonus(state, 'daily'), null);
  assert.ok(state.gems > gems + 150);
  // Sauvegarde : l'état des missions survit au rechargement.
  const back = sanitizeState(JSON.parse(JSON.stringify(state)), BALANCE, 0);
  assert.deepEqual(back.missions, state.missions);
});

test('connexion : série de jours consécutifs, remise à zéro après un jour manqué', () => {
  const state = createNewState(0, 5);
  refreshMissions(state, day(2026, 10, 1));
  assert.equal(loginDay(state), 0);
  assert.ok(claimLogin(state));
  assert.equal(claimLogin(state), null);
  refreshMissions(state, day(2026, 10, 2));
  assert.equal(state.missions.login.streak, 2);
  assert.equal(loginDay(state), 1);
  refreshMissions(state, day(2026, 10, 5)); // jours manqués
  assert.equal(state.missions.login.streak, 1);
  assert.equal(state.missions.monthly.progress.logins, 3);
});

test('démarrage rapide : bonus fort au début, disparu après 5 h de jeu', () => {
  const state = createNewState(0, 6);
  const start = earlyBoost(state);
  assert.equal(start.gold, BALANCE.earlyBoost.goldMultiplier);
  assert.ok(start.dropChance > 0 && start.bossTickets > 0);
  state.playSeconds = BALANCE.earlyBoost.hours * 3600;
  const later = earlyBoost(state);
  assert.equal(later.gold, 1);
  assert.equal(later.dropChance, 0);
  assert.equal(later.bossTickets, 0);
});

test('donjons : chaque SSR a son donjon et y écrase tout', () => {
  const ssr = COMPANIONS.filter((c) => c.kind === 'ally' && c.rarity === 'legendary').map((c) => c.id);
  assert.equal(ssr.length, 5);
  assert.deepEqual([...DUNGEONS.map((d) => d.ally)].sort(), [...ssr].sort());
  const state = createNewState(0, 7);
  const d = DUNGEONS[1];
  state.companions.owned[d.ally] = { stars: 1, level: 1 };
  state.companions.equipped = [d.ally];
  assert.equal(dungeonDamageTaken(state), 1);
  state.dungeon = { id: d.id, room: 1, kills: 0, slot: 'any', path: 'gold', level: 10, earned: {} };
  assert.ok(dungeonAffinity(state, d.ally));
  assert.ok(!dungeonAffinity(state, DUNGEONS[0].ally));
  assert.ok(dungeonDamageTaken(state) < 1);
});
