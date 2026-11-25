// v10.14 : FÊTES DU MOIS — calendrier (6 mois écrits + rotation), moteur (missions, Carte du héros, World Boss, jalons,
// sentier, boutique, échange, conversion de fin), live-ops (type « fest ») et serveur (calendrier programmé d'un coup).
import test from 'node:test';
import assert from 'node:assert/strict';
import { FEST_MONTHS, FEST_NAMES, FEST_POOLS, FEST_RULES, FEST_SHEET_IDS, FEST_SHOPS, LIGHT_PATH, festAt, festLiveItems, festMonth, festSheet } from '../src/data/fest.js';
import { COMPANIONS } from '../src/data/companions.js';
import { GRAND_BOSSES } from '../src/data/grand-bosses.js';
import { LIVE_EVENT_TYPES, LIVE_FEATURED_UNITS } from '../src/data/live-catalog.js';
import {
  buyFest, claimFestMission, claimFestStep, currentFest, dailyMissions, festBossStatus, festFight, festMissions, festPath, festRecord,
  festShop, festSummonSteps, festSummons, festTrack, finishFestBoss, giveCopy, settleFests, startFestBoss,
} from '../src/core/fest.js';
import { currentEvent } from '../src/core/ancients.js';
import { featuredUnit } from '../src/core/gacha.js';
import { applyLive, resetLive, setLiveClientVersion } from '../src/core/live.js';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { openDatabase } from '../server/db.mjs';
import { createLive, importFestCalendar } from '../server/live.mjs';

const DAY = 86400000;
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime(); // heure locale, comme le calendrier
const fresh = () => { resetLive(); const s = createNewState(at(2027, 1, 20)); s.companions.owned = {}; return s; };

test('calendrier : 6 mois écrits à la main (février → juillet 2027), grande puis petite fête, 2 jours d\'échange', () => {
  assert.deepEqual(FEST_MONTHS.map((m) => m.month), ['2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07']);
  for (let i = 0; i < 6; i += 1) {
    const { grand: g, light: l, handWritten } = festMonth(i);
    assert.ok(handWritten);
    const d0 = new Date(g.start);
    assert.equal(d0.getDate(), 1, 'la grande fête commence le 1er');
    assert.equal(Math.round((g.playEnd - g.start) / DAY), 14, '14 jours de jeu');
    assert.equal(Math.round((g.end - g.playEnd) / DAY), FEST_RULES.pauseDays, 'échange');
    assert.equal(l.start, g.end, 'la petite fête suit l\'échange');
    assert.equal(Math.round((l.end - l.playEnd) / DAY), FEST_RULES.pauseDays, 'échange');
    assert.ok(Math.round((l.playEnd - l.start) / DAY) >= 10, 'petite fête : au moins 10 jours');
    assert.equal(l.end, festMonth(i + 1).grand.start, 'mois suivant enchaîné');
    assert.ok(g.title && g.currency && g.regions.length === 3 && l.title && l.currency);
  }
});

test('rotation : unités existantes, aucun héros vedette ni boss répété trop tôt', () => {
  const ids = new Set(COMPANIONS.map((c) => c.id));
  for (const id of [...FEST_POOLS.featured, ...FEST_POOLS.freeHero, ...FEST_POOLS.freePet]) assert.ok(ids.has(id), id);
  for (const id of FEST_POOLS.featured) assert.ok(LIVE_FEATURED_UNITS[id], `vedette activable : ${id}`);
  for (const id of FEST_POOLS.freeHero) assert.equal(COMPANIONS.find((c) => c.id === id).kind, 'ally');
  for (const id of FEST_POOLS.freePet) assert.notEqual(COMPANIONS.find((c) => c.id === id).kind, 'ally');
  for (const id of FEST_POOLS.boss) assert.ok(GRAND_BOSSES[id], id);
  for (const [id, name] of Object.entries(FEST_NAMES)) assert.equal(COMPANIONS.find((c) => c.id === id)?.name, name, id);
  const months = Array.from({ length: 24 }, (_, i) => festMonth(i));
  for (let i = 0; i < months.length; i += 1) {
    for (let k = 1; k < FEST_POOLS.featured.length && i + k < months.length; k += 1) assert.notEqual(months[i].grand.featured, months[i + k].grand.featured);
    for (let k = 1; k < FEST_POOLS.boss.length && i + k < months.length; k += 1) assert.notEqual(months[i].grand.boss, months[i + k].grand.boss);
  }
  assert.equal(FEST_SHEET_IDS.length, FEST_RULES.monthsAhead * 2);
  assert.equal(festSheet('2027-03-l').hero, 'elf_archer');
  assert.equal(festSheet('2031-01-g'), null);
  assert.ok(festMonth(8).grand.title.startsWith('Fête du héros'), 'au-delà des mois écrits : titre automatique');
});

test('sans serveur : le calendrier des Fêtes remplace le cycle 9.2.9 à partir de février 2027', () => {
  resetLive();
  assert.ok(currentEvent(at(2027, 1, 10)), 'janvier : ancien cycle');
  assert.equal(currentFest(at(2027, 1, 10)), null);
  assert.equal(currentEvent(at(2027, 2, 3)), null, 'février : plus d\'ancien cycle');
  const g = currentFest(at(2027, 2, 3));
  assert.equal(g.kind, 'grand');
  assert.equal(g.featured, 'demon_queen');
  assert.equal(g.phase, 'play');
  assert.equal(g.day, 3);
  assert.equal(currentFest(at(2027, 2, 15)).phase, 'pause');
  const l = currentFest(at(2027, 2, 18));
  assert.equal(l.kind, 'light');
  assert.equal(l.hero, 'rose_blade');
  assert.equal(l.pet, 'crystal_hedgehog');
  assert.equal(currentFest(at(2027, 2, 27)).phase, 'pause');
  assert.equal(featuredUnit('limited', at(2027, 2, 20)).id, 'demon_queen', 'héros du mois sur la bannière tout le mois');
  assert.equal(featuredUnit('limited', at(2027, 3, 2)).id, 'sylvan_guardian');
  assert.equal(festAt(at(2027, 3, 16)).sheet, '2027-03-g', 'échange de mars');
});

test('missions : du jour (3, même tirage pour tous) et de la fête ; rien ne compte pendant l\'échange', () => {
  const s = fresh();
  const t = at(2027, 2, 3);
  const f = currentFest(t);
  const d = dailyMissions(f, t);
  assert.equal(d.length, FEST_RULES.dailyCount);
  assert.deepEqual(dailyMissions(f, t), d);
  assert.equal(new Set(d.map((m) => m.type)).size, d.length);
  festTrack(s, 'kills', 10000, t);
  const m = festMissions(s, t);
  const kills = m.event.find((x) => x.type === 'kills');
  assert.ok(kills.ready);
  const before = festRecord(s, t).coins;
  const r = claimFestMission(s, kills.id, t);
  assert.equal(r.coins, kills.coins);
  assert.equal(festRecord(s, t).coins, before + kills.coins);
  assert.equal(claimFestMission(s, kills.id, t), null, 'une seule fois');
  const pause = at(2027, 2, 16);
  festTrack(s, 'bosses', 999, pause);
  assert.equal(festRecord(s, pause).goals.g_bosses ?? 0, 0);
});

test('grande fête : Carte du héros (bonus du héros du mois), World Boss dès l\'étape 10, jalons d\'invocation', () => {
  const s = fresh();
  const t = at(2027, 2, 4);
  const strong = { dps: 1e12, hpOf: () => 1 };
  assert.equal(festFight(s, 2, strong, t).error, 'locked');
  assert.equal(festBossStatus(s, t).open, false);
  const r1 = festFight(s, 1, strong, t);
  assert.equal(r1.reward.coins, FEST_RULES.map.stageCoins);
  s.companions.owned.demon_queen = { stars: 1, level: 1 };
  s.companions.equipped = ['demon_queen'];
  const r2 = festFight(s, 2, strong, t);
  assert.equal(r2.reward.coins, Math.round(FEST_RULES.map.stageCoins * (1 + FEST_RULES.map.featuredBonus)));
  for (let n = 3; n <= 30; n += 1) assert.ok(festFight(s, n, strong, t).won);
  assert.equal(s.economy.wallet.ssrFragment, 1, 'fragment à l\'étape 30');
  assert.equal(festFight(s, 1, { dps: 0, hpOf: () => 1 }, t).error, 'locked');
  const st = festBossStatus(s, t);
  assert.ok(st.open);
  assert.equal(st.boss, 'titan_ember');
  const setup = startFestBoss(s, () => 1000, t);
  assert.equal(setup.bossId, 'titan_ember');
  const fin = finishFestBoss(s, setup, { damage: 500, tiers: 2 }, t);
  assert.equal(fin.coins, FEST_RULES.boss.coinsBase + 2 * FEST_RULES.boss.coinsPerTier);
  startFestBoss(s, () => 1000, t); startFestBoss(s, () => 1000, t);
  assert.equal(startFestBoss(s, () => 1000, t), null, '3 tentatives par jour');
  festSummons(s, 'permanent', 50, t);
  assert.equal(festRecord(s, t).fest.summons, 0, 'seule la bannière limitée compte');
  festSummons(s, 'limited', 35, t);
  const steps = festSummonSteps(s, t);
  assert.deepEqual(steps.map((x) => x.reached), [true, true, false, false, false]);
  const got = claimFestStep(s, 's1', t);
  assert.equal(got.given.ticketLimited, 3);
  assert.equal(claimFestStep(s, 's1', t), null);
  assert.equal(festFight(s, 31, strong, at(2027, 2, 16)).error, 'pause');
});

test('petite fête : héros et familier gratuits sur le sentier, copies en boutique', () => {
  const s = fresh();
  const t = at(2027, 2, 20);
  assert.equal(currentFest(t).kind, 'light');
  festTrack(s, 'bosses', 10, t);
  assert.equal(festRecord(s, t).fest.earned, 10, 'un peu de monnaie en jouant');
  festTrack(s, 'bosses', 100, t);
  assert.equal(festRecord(s, t).fest.earned, FEST_RULES.trickle.dailyCap, 'plafonné par jour');
  festRecord(s, t).fest.earned = 600;
  festRecord(s, t).coins = 600;
  const heroStep = LIGHT_PATH.findIndex((x) => x.hero);
  const r = claimFestStep(s, `p${heroStep}`, t);
  assert.equal(r.units[0].id, 'rose_blade');
  assert.ok(r.units[0].isNew);
  assert.equal(s.companions.owned.rose_blade.stars, 1);
  const petStep = LIGHT_PATH.findIndex((x) => x.pet);
  claimFestStep(s, `p${petStep}`, t);
  assert.ok(s.companions.owned.crystal_hedgehog);
  assert.equal(festPath(s, t).filter((x) => x.claimed).length, 2);
  const shop = festShop(s, t);
  assert.deepEqual(shop.slice(0, 2).map((i) => i.unit), ['rose_blade', 'crystal_hedgehog']);
  const b = buyFest(s, 'hero', t);
  assert.equal(b.units[0].stars, 2, 'une étoile de plus');
  assert.equal(festRecord(s, t).coins, 600 - FEST_SHOPS.light[0].price);
  // Pendant l'échange : la boutique reste ouverte.
  festRecord(s, at(2027, 2, 27)).coins = 500;
  assert.ok(buyFest(s, 'pet', at(2027, 2, 27)));
  // Au maximum : conversion habituelle, rien de perdu.
  s.companions.owned.rose_blade.stars = 6;
  const over = giveCopy(s, 'rose_blade');
  assert.ok(Object.keys(over.given).length > 0);
});

test('fin d\'échange : monnaie restante convertie en éclats, une seule fois ; sauvegarde conservée (Lueurs comprises)', () => {
  const s = fresh();
  const t = at(2027, 2, 5);
  festRecord(s, t).coins = 30;
  s.economy.events['lights-3'] = { cleared: 0, coins: 0, bought: {}, goals: {}, claimed: [], boss: { day: '', used: 0, best: 0 }, fragment: false, lights: { steps: [0, 2], spent: 12, bought: { keys: 1 } } };
  const back = sanitizeState(JSON.parse(JSON.stringify(s)), undefined, t);
  const rec = back.economy.events['fest-2027-02-g'];
  assert.equal(rec.coins, 30);
  assert.equal(rec.fest.until, festMonth(0).grand.end);
  assert.deepEqual(back.economy.events['lights-3'].lights, { steps: [0, 2], spent: 12, bought: { keys: 1 } }, 'Lueurs gardées au rechargement');
  const shards = back.materials.shards;
  assert.equal(settleFests(back, at(2027, 2, 10)), 0, 'pas avant la fin');
  assert.equal(settleFests(back, at(2027, 2, 17, 1)), 30 * FEST_RULES.leftoverShards);
  assert.equal(back.materials.shards, shards + 300);
  assert.equal(settleFests(back, at(2027, 2, 18)), 0, 'une seule fois');
});

test('live-ops : type « fest » au catalogue ; la feuille et les réglages viennent de la config', () => {
  const spec = LIVE_EVENT_TYPES.fest;
  assert.equal(spec.since, '10.14.0');
  assert.deepEqual(spec.params.sheet.values, FEST_SHEET_IDS);
  resetLive();
  setLiveClientVersion('10.14.0');
  const t = at(2027, 3, 3);
  const f = festMonth(1).grand;
  applyLive({ schema: 1, programmed: true, events: [{ id: 7, type: 'fest', title: f.title, start: f.start, end: f.end, minClient: '10.14.0', params: { sheet: '2027-03-g', coinMult: 2 } }] }, t, { local: t });
  const cur = currentFest(t);
  assert.equal(cur.featured, 'sylvan_guardian');
  assert.ok(cur.live);
  const s = createNewState(t);
  assert.equal(festFight(s, 1, { dps: 1e12, hpOf: () => 1 }, t).reward.coins, FEST_RULES.map.stageCoins * 2);
  assert.equal(currentEvent(t).kind, 'fest', 'les anciens modules restent inertes');
  setLiveClientVersion('10.13.1');
  assert.equal(currentFest(t), null, 'client trop ancien : rien');
  resetLive();
});

test('serveur : 6 mois programmés au premier démarrage, une fois ; import sans écraser l\'existant', () => {
  const db = openDatabase(':memory:');
  const t0 = Date.UTC(2026, 10, 25, 9);
  createLive({ db, now: () => t0 });
  const items = db.prepare("SELECT * FROM live_items WHERE ref = 'fest' ORDER BY starts_at").all();
  assert.equal(items.length, 12, '6 mois × 2 fêtes');
  assert.equal(JSON.parse(items[0].data).params.sheet, '2027-02-g');
  const heroes = db.prepare("SELECT ref FROM live_items WHERE kind = 'banner' AND title LIKE 'Héros du mois%' ORDER BY starts_at").all().map((r) => r.ref);
  assert.deepEqual(heroes, [0, 1, 2, 3, 4, 5].map((i) => festMonth(i).grand.featured));
  const n = db.prepare('SELECT COUNT(*) AS n FROM live_items').get().n;
  createLive({ db, now: () => t0 });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM live_items').get().n, n, 'idempotent');
  const meta = { get: () => null, set: () => {} };
  assert.deepEqual(importFestCalendar(db, meta, t0, { months: 6 }), { added: 0, skipped: 18 }, 'tout est déjà occupé');
  const more = importFestCalendar(db, meta, t0, { months: 8 });
  assert.equal(more.added, 6, 'août et septembre ajoutés');
  const { events } = festLiveItems(t0, 1);
  assert.equal(events[0].sheet, '2027-02-g');
});
