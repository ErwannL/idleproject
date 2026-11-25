// v9.8 (H8) : notifications du téléphone — 2 par jour au plus, désactivables.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState } from '../src/core/state.js';
import { planNotifications } from '../src/core/notify-plan.js';

test('plan : 2 par jour au plus, rien si désactivé', () => {
  const s = createNewState(1);
  const now = 1_800_000_000_000;
  s.expeditions.slots[0] = { companionId: 'squire', type: 'short', start: now, end: now + 3_600_000, reward: {} };
  const list = planNotifications(s, now, { titanOpen: true });
  const perDay = {};
  for (const n of list) perDay[new Date(n.at).toDateString()] = (perDay[new Date(n.at).toDateString()] ?? 0) + 1;
  assert.ok(Object.values(perDay).every((k) => k <= 2));
  assert.ok(list.some((n) => n.id === 1));
  s.ui.notify = { phone: false };
  assert.deepEqual(planNotifications(s, now), []);
});

// ---- v10.14.1 : notifications des fêtes du mois (ids 5 à 8) ----
import { festMonth } from '../src/data/fest.js';
import { festRecord } from '../src/core/fest.js';
import { resetLive } from '../src/core/live.js';
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
const fest = () => { resetLive(); return createNewState(at(2027, 1, 20)); };
const quiet = (list) => list.every((n) => { const h = new Date(n.at).getHours(); return h >= 9 && h < 22; });

test('fêtes : « La fête commence » le jour 1 à 12 h, jamais la nuit', () => {
  const s = fest();
  const list = planNotifications(s, at(2027, 1, 30));
  const n = list.find((x) => x.id === 5);
  assert.ok(n, 'annoncée');
  assert.equal(n.at, at(2027, 2, 1, 12));
  assert.match(n.body, /Cœurs ardents/);
  assert.ok(quiet(list));
  const later = planNotifications(fest(), at(2027, 2, 1, 13)).find((x) => x.id === 5);
  assert.equal(later.at, festMonth(0).light.start + 12 * 3_600_000, 'fête déjà commencée : on annonce la suivante');
});

test('fêtes : Brèche pleine à 6/6, à 18 h, seulement pendant le jeu', () => {
  const s = fest();
  const now = at(2027, 2, 2, 10);
  festRecord(s, now);
  const r = planNotifications(s, now).find((x) => x.id === 6);
  assert.ok(r, '2 entrées par jour : 6/6 dans 2 jours');
  assert.equal(r.at, at(2027, 2, 4, 18));
  const rec = s.economy.events['fest-2027-02-g'];
  rec.fest.rift = { stock: 6, refill: '2027-02-02', run: null, best: 0, firsts: [] };
  assert.equal(planNotifications(s, now).find((x) => x.id === 6).at, at(2027, 2, 2, 18), 'déjà pleine : ce soir');
  rec.fest.rift.run = { floor: 1 };
  assert.ok(!planNotifications(s, now).some((x) => x.id === 6), 'course en cours : rien');
  assert.ok(!planNotifications(fest(), at(2027, 2, 13, 10)).some((x) => x.id === 6), 'plus d\'entrée après la fin des combats');
});

test('fêtes : « Dernier jour » et « Échange » seulement s\'il reste quelque chose', () => {
  const s = fest();
  const now = at(2027, 2, 10, 10);
  const rec = festRecord(s, now);
  rec.coins = 0;
  rec.fest.rift = { stock: 0, refill: '2027-02-10', run: null, best: 0, firsts: [] };
  rec.boss.day = '2027-02-10'; rec.boss.used = 3;
  rec.fest.daily = { day: '2027-02-10', p: {}, done: ['d_login'] }; // « Se connecter » déjà récupérée
  const calm = planNotifications(s, now);
  assert.ok(!calm.some((x) => x.id === 7 || x.id === 8), 'rien à faire : silence');
  rec.coins = 40;
  rec.fest.rift.stock = 2;
  const list = planNotifications(s, now);
  assert.equal(list.find((x) => x.id === 7).at, at(2027, 2, 14, 18), 'la veille de l\'échange, 18 h');
  assert.equal(list.find((x) => x.id === 8).at, at(2027, 2, 15, 12), 'premier jour d\'échange, 12 h');
  assert.ok(quiet(list));
  s.ui.notify = { phone: false };
  assert.deepEqual(planNotifications(s, now), [], 'désactivables');
});

test('fêtes : 2 par jour au plus, jamais la nuit, même avec toutes les notifications', () => {
  const s = fest();
  const now = at(2027, 2, 14, 9);
  const rec = festRecord(s, now);
  rec.coins = 40;
  s.expeditions.slots[0] = { companionId: 'squire', type: 'short', start: now, end: at(2027, 2, 14, 23), reward: {} };
  const list = planNotifications(s, now, { titanOpen: true });
  const perDay = {};
  for (const n of list) { const k = new Date(n.at).toDateString(); perDay[k] = (perDay[k] ?? 0) + 1; }
  assert.ok(Object.values(perDay).every((k) => k <= 2));
  assert.ok(quiet(list), 'une expédition finie à 23 h est annoncée à 9 h');
});
