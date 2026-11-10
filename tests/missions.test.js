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

test('missions : jour, semaine (v9.3.8) et piste du mois', () => {
  assert.equal(periodKey('weekly', day(2026, 10, 25)), '2026-10-19'); // dimanche → lundi précédent
  assert.equal(periodKey('weekly', day(2026, 10, 26)), '2026-10-26');
  assert.equal(periodKey('monthly', day(2026, 10, 25)), '2026-10');
  const state = createNewState(0, 3);
  refreshMissions(state, day(2026, 10, 25));
  trackContracts(state, 'kills', 500);
  assert.equal(state.missions.daily.progress.kills, 300);
  assert.equal(state.missions.track.progress.kills, 500);
  refreshMissions(state, day(2026, 10, 26));
  assert.equal(state.missions.daily.progress.kills, undefined);
  assert.equal(state.missions.track.progress.kills, 500); // même mois
  refreshMissions(state, day(2026, 11, 1));
  assert.equal(state.missions.track.progress.kills, undefined); // 1er du mois : nouvelle piste
  // v9.3.8 : la Semaine compte aussi, et repart le lundi.
  assert.equal(state.missions.weekly.key, '2026-10-26');
  trackContracts(state, 'kills', 40);
  assert.equal(state.missions.weekly.progress.kills, 40);
  refreshMissions(state, day(2026, 11, 2));
  assert.equal(state.missions.weekly.progress.kills, undefined);
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

test('connexion (v9.1.3) : jour compté à l\'ouverture, sans remise à zéro, cases non récupérées gardées', () => {
  const state = createNewState(0, 5);
  refreshMissions(state, day(2026, 10, 1));
  assert.equal(loginDay(state), 0);
  assert.ok(claimLogin(state));
  assert.equal(claimLogin(state), null);
  refreshMissions(state, day(2026, 10, 2)); // ouvert sans récupérer
  assert.equal(state.missions.login.days, 2);
  assert.equal(loginDay(state), 1);
  refreshMissions(state, day(2026, 10, 5)); // jours manqués : pas de retour au jour 1
  assert.equal(state.missions.login.days, 3);
  assert.equal(state.missions.track.progress.logins, 3);
  const gems = state.gems;
  const given = claimLogin(state); // jours 2 et 3 d'un coup (v9.1.3 : l'ancien ticket du jour 2 vaut 100 gemmes)
  assert.deepEqual(given, { gems: 150 });
  assert.equal(state.gems, gems + 150);
  assert.equal(loginDay(state), 3);
  // Au plus un cycle en attente.
  for (let d = 6; d < 20; d++) refreshMissions(state, day(2026, 10, d));
  assert.equal(state.missions.login.days - state.missions.login.claimed, 7);
});

test('connexion (v9.1.3) : migration de l\'ancienne série', () => {
  const old = (login) => sanitizeState({ ...JSON.parse(JSON.stringify(createNewState(0, 5))), missions: { login } }, BALANCE, 0).missions.login;
  // Jour du dernier lancement non récupéré : il reste à récupérer.
  assert.deepEqual(old({ lastDay: '2026-10-02', streak: 2, claimedDay: '2026-10-01' }), { lastDay: '2026-10-02', days: 2, claimed: 1 });
  assert.deepEqual(old({ lastDay: '2026-10-02', streak: 2, claimedDay: '2026-10-02' }), { lastDay: '2026-10-02', days: 2, claimed: 2 });
  assert.deepEqual(old({ lastDay: '', streak: 0, claimedDay: '' }), { lastDay: '', days: 0, claimed: 0 });
});

test('démarrage rapide : bonus fort au début, disparu après 5 h de jeu', () => {
  const state = createNewState(0, 6);
  const weekday = new Date(2026, 9, 21, 12).getTime(); // un mercredi (pas de bonus de week-end)
  const start = earlyBoost(state, BALANCE, weekday);
  assert.equal(start.gold, BALANCE.earlyBoost.goldMultiplier);
  assert.ok(start.dropChance > 0 && start.bossGems > 0);
  state.playSeconds = BALANCE.earlyBoost.hours * 3600;
  const later = earlyBoost(state, BALANCE, weekday);
  assert.equal(later.gold, 1);
  assert.equal(later.dropChance, 0);
  assert.equal(later.bossGems, 0);
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

test('week-end : ×2 cumulable avec le démarrage rapide', async () => {
  const { isWeekend } = await import('../src/core/boost.js');
  const saturday = new Date(2026, 9, 24, 15).getTime();
  const monday = new Date(2026, 9, 26, 15).getTime();
  assert.ok(isWeekend(saturday));
  assert.ok(!isWeekend(monday));
  const state = createNewState(0, 8);
  assert.equal(earlyBoost(state, BALANCE, saturday).gold, BALANCE.earlyBoost.goldMultiplier * 2);
  state.playSeconds = 1e9;
  assert.equal(earlyBoost(state, BALANCE, saturday).gold, 2);
  assert.equal(earlyBoost(state, BALANCE, monday).gold, 1);
});
