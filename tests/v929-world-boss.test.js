// v9.2.9 : World Boss en vrai combat (core/world-boss.js, core/ancients.js), bouton Boutique de la barre du haut
// (pastille : core/store.js shopFreeAvailable), traductions anglaise et coréenne.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createNewState } from '../src/core/state.js';
import { WORLD_BOSS, WorldBossFight, attemptCoins, attemptSeed, bossHpForDay } from '../src/core/world-boss.js';
import { eventRecord, finishWorldBoss, startWorldBoss, worldBossDay, worldBossStatus } from '../src/core/ancients.js';
import { EVENTS } from '../src/data/economy.js';
import { shopFreeAvailable } from '../src/core/store.js';
import { dayKey } from '../src/core/income.js';
import { EXACT_929 as EN } from '../src/i18n/en-929.js';
import { lookup as en } from '../src/i18n/en.js';
import { lookup as ko } from '../src/i18n/ko.js';

const NOW = new Date(`${EVENTS.anchor}T12:00:00`).getTime() + 2 * 86400000; // grand événement, jour 3

function player() {
  const s = createNewState(NOW);
  Object.assign(s, { maxStage: 60, stage: 60, level: 80, skillAuto: true });
  s.records.bestStage = 60;
  s.records.bossesDefeated = 10;
  for (const k of Object.keys(s.upgrades)) s.upgrades[k] = 25;
  s.skills = { quick: 4, whirl: 3 };
  for (const id of ['archangel', 'demon_queen', 'wisp']) s.companions.owned[id] = { level: 10, stars: 3 };
  s.companions.equipped = ['archangel', 'demon_queen', 'wisp'];
  eventRecord(s, NOW).cleared = EVENTS.grand.worldBoss.unlockStage;
  return s;
}

test('World Boss : combat du vrai moteur, reproductible, sans toucher à l\'état du joueur', () => {
  const s = player();
  const before = JSON.stringify(s);
  const hp = bossHpForDay(s);
  const a = new WorldBossFight(s, { seed: 42, maxHp: hp }).finish();
  const b = new WorldBossFight(s, { seed: 42, maxHp: hp }).finish();
  assert.equal(JSON.stringify(s), before, 'copie de travail : or, missions, objets du joueur inchangés');
  assert.equal(a.damage, b.damage, 'même graine, même score');
  assert.ok(a.damage > 0);
  assert.deepEqual(a.team, ['archangel', 'demon_queen', 'wisp'], 'toute l\'équipe combat');
  // PV du jour calés pour qu'une tentative ordinaire passe des phases sans vider la barre d'emblée.
  assert.ok(a.cleared > 0.5 && a.cleared < 1.2, `part de la barre : ${a.cleared}`);
  assert.ok(a.phase >= 2 || a.layer > 0, `au moins deux phases franchies : ${JSON.stringify(a)}`);
});

test('World Boss : les phases (75 / 50 / 25 %) lancent une attaque spéciale et renforcent le boss', () => {
  const s = player();
  const f = new WorldBossFight(s, { seed: 3, maxHp: Math.round(bossHpForDay(s) / 5) });
  // Barre courte : vidée en une quinzaine de secondes → trois phases puis Éveil.
  while (!f.done && f.layer < 1) f.tick();
  const kinds = f.out.map((o) => o.type);
  assert.deepEqual(kinds.slice(0, 3), ['phase', 'phase', 'phase']);
  assert.ok(kinds.includes('awaken'));
  for (const ev of f.out.filter((o) => o.type === 'phase')) assert.ok(ev.damage > 0);
  const boss = f.boss;
  assert.ok(boss.sizeMul >= WORLD_BOSS.sizeMul, 'boss géant');
  assert.ok(f.world.hero.hp >= 1 || f.world.hero.dead === false);
});

test('World Boss : tentatives du jour, record, dégâts du jour et paliers', () => {
  const s = player();
  const left0 = worldBossStatus(s, NOW).left;
  assert.equal(left0, EVENTS.grand.worldBoss.attemptsPerDay);
  const setup = startWorldBoss(s, () => 1000, NOW);
  assert.equal(setup.maxHp, 1000);
  assert.equal(setup.seed, attemptSeed(dayKey(NOW), 1));
  assert.equal(worldBossStatus(s, NOW).left, left0 - 1, 'tentative comptée au départ');
  const coins0 = eventRecord(s, NOW).coins;
  const r = finishWorldBoss(s, setup, { damage: 800, tiers: 3 }, NOW);
  assert.deepEqual([r.damage, r.record, r.today, r.coins], [800, true, 800, attemptCoins(3)]);
  assert.equal(eventRecord(s, NOW).coins - coins0, attemptCoins(3));
  const setup2 = startWorldBoss(s, () => 5, NOW);
  assert.equal(setup2.maxHp, 1000, 'PV du boss fixés pour la journée');
  const r2 = finishWorldBoss(s, setup2, { damage: 300, tiers: 1 }, NOW);
  assert.deepEqual([r2.record, r2.best, r2.today], [false, 800, 1100]);
  assert.deepEqual(worldBossDay(s, NOW), { today: 1100, todayBest: 800, hp: 1000, tiers: 3, best: 800 });
  startWorldBoss(s, () => 5, NOW);
  assert.equal(startWorldBoss(s, () => 5, NOW), null, 'plus de tentative');
  // Lendemain : tentatives et dégâts du jour remis à zéro, record gardé.
  const next = NOW + 86400000;
  assert.equal(worldBossStatus(s, next).left, left0);
  assert.equal(worldBossDay(s, next).today, 0);
  assert.equal(worldBossDay(s, next).best, 800);
});

test('World Boss : écus — au plus l\'ancien forfait (économie inchangée)', () => {
  assert.equal(attemptCoins(WORLD_BOSS.tiers.length), EVENTS.grand.worldBoss.coinsPerAttempt);
  assert.ok(attemptCoins(0) > 0 && attemptCoins(0) < attemptCoins(2));
});

test('Boutique en haut : pastille si une part quotidienne attend', () => {
  const s = player();
  assert.equal(shopFreeAvailable(s, NOW), false);
  s.economy.store.subs.sub_blessing = { until: NOW + 5 * 86400000, lastDay: dayKey(NOW - 86400000) };
  assert.equal(shopFreeAvailable(s, NOW), true);
  s.economy.store.subs.sub_blessing.lastDay = dayKey(NOW);
  assert.equal(shopFreeAvailable(s, NOW), false);
});

test('v9.2.9 : textes traduits en anglais et en coréen', () => {
  const texts = [...Object.keys(EN), 'Éveil', 'Dégâts infligés', 'Passer ⏭', 'Nouveau record !', 'Réessayer', 'Boutique', 'World Boss : 19,7 M dégâts',
    "Combat de 60 s avec toute l'équipe. Phases à 75, 50 et 25 % des PV.", WORLD_BOSS.name, ...WORLD_BOSS.phases.map((p) => p.name)];
  for (const t of texts) {
    const e = en(t);
    const k = ko(t);
    assert.ok(e && !/[éèàùç]|Dégâts|Phases à/.test(e), `anglais : ${t} → ${e}`);
    assert.ok(k && /[가-힣]/.test(k), `coréen : ${t} → ${k}`);
  }
});
