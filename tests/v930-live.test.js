// v9.3.0 : LIVE-OPS — serveur (routes, droits, validation, versions, calendrier automatique), client (activation,
// désactivation, hors-ligne, horloge serveur, version minimale) et bout en bout (admin « Démarrer maintenant » → le
// jeu voit l'événement au rafraîchissement suivant, sans mise à jour).
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createApp, hashPassword } from '../server/app.mjs';
import { openDatabase } from '../server/db.mjs';
import { DEFAULT_GOALS, GOALS_931, GOALS_1061, createLive, legacyCalendar, parseAmount, validateGoals } from '../server/live.mjs';
import { DEFAULT_GOALS as SITE_GOALS, goalProgress } from '../site/live.js';
import { calendarEvent } from '../src/core/ancients.js';
import { permanentSsr } from '../src/core/gacha.js';
import { LIVE_FEATURED_UNITS, LIVE_OFFER_IDS, compareVersions } from '../src/data/live-catalog.js';
import { COMPANIONS } from '../src/data/companions.js';
import { LIVE_OFFERS } from '../src/data/economy.js';
import {
  applyLive, liveAnnouncements, liveEvent, liveFeatured, liveFlag, liveKnown, liveNow, liveOfferActive, loadLiveCache, refreshLive,
  resetLive, saveLiveCache, setLiveClientVersion,
} from '../src/core/live.js';
import { currentEvent, worldBossStatus } from '../src/core/ancients.js';
import { featuredUnit } from '../src/core/gacha.js';
import { allOffers } from '../src/core/store.js';

const DAY = 86400000;
const HOUR = 3600000;
const T0 = Date.UTC(2026, 11, 1, 12);

async function setup({ keepSeed = false, at = T0, db = openDatabase(':memory:') } = {}) {
  let clock = at;
  const app = createApp({ db, siteDir: '', webDir: '', adminPasswordHash: await hashPassword('motdepasse-admin-1'), now: () => clock });
  // Calendrier repris de la 9.2.9 : retiré pour les tests qui partent d'un calendrier vide.
  if (!keepSeed) db.exec('DELETE FROM live_items; DELETE FROM live_history;');
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body, token, headers = {}) => {
    const h = { 'Content-Type': 'application/json', ...headers };
    if (token) h.Authorization = `Bearer ${token}`;
    const res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
  };
  const login = await call('POST', '/api/admin/login', { username: 'erwann', password: 'motdepasse-admin-1' });
  return {
    db, base, call, token: login.body.token,
    set: (t) => { clock = t; }, advance: (ms) => { clock += ms; }, now: () => clock,
    close: async () => { server.close(); await once(server, 'close').catch(() => {}); db.close(); },
  };
}

// ---- Serveur --------------------------------------------------------------------------------------------------------
test('live : routes admin refusées sans jeton admin, lecture publique libre', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  assert.equal((await s.call('GET', '/api/admin/live')).status, 401);
  assert.equal((await s.call('POST', '/api/admin/live/items', { kind: 'event', ref: 'ancients' })).status, 401);
  assert.equal((await s.call('PUT', '/api/admin/live/goals', { data: {} }, 'faux-jeton')).status, 401);
  const pub = await s.call('GET', '/api/live');
  assert.equal(pub.status, 200);
  assert.equal(pub.body.serverTime, T0);
  assert.equal(pub.headers.get('x-server-time'), String(T0));
  assert.match(pub.headers.get('cache-control'), /max-age=30/);
  assert.deepEqual(pub.body.events, []);
});

test('live : ETag et 304, l\'heure du serveur reste transmise', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const a = await s.call('GET', '/api/live');
  const etag = a.headers.get('etag');
  assert.ok(etag);
  s.advance(1000);
  const b = await s.call('GET', '/api/live', undefined, null, { 'If-None-Match': etag });
  assert.equal(b.status, 304);
  assert.equal(b.headers.get('x-server-time'), String(T0 + 1000));
  await s.call('POST', '/api/admin/live/items', { kind: 'event', ref: 'ancients', startsAt: T0 + DAY, endsAt: T0 + 15 * DAY, status: 'scheduled' }, s.token);
  assert.equal((await s.call('GET', '/api/live', undefined, null, { 'If-None-Match': etag })).status, 200, 'contenu changé → nouvel ETag');
});

test('live : validation stricte (type inconnu, version minimale trop basse, paramètres, dates)', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const post = (body) => s.call('POST', '/api/admin/live/items', body, s.token);
  assert.equal((await post({ kind: 'event', ref: 'inconnu' })).status, 400);
  assert.equal((await post({ kind: 'event', ref: 'ancients', minClient: '9.2.0' })).status, 400, 'type livré en 9.2.8');
  assert.equal((await post({ kind: 'offer', ref: 'offer_launch', minClient: '9.2.9' })).status, 400, 'offre livrée en 9.3.0');
  assert.equal((await post({ kind: 'event', ref: 'ancients', minClient: 'abc' })).status, 400);
  assert.equal((await post({ kind: 'event', ref: 'ancients', data: { params: { attemptsPerDay: 99 } } })).status, 400);
  assert.equal((await post({ kind: 'event', ref: 'ancients', data: { params: { boss: 'dragon' } } })).status, 400, 'boss absent du code');
  assert.equal((await post({ kind: 'event', ref: 'ancients', data: { params: { pirate: 1 } } })).status, 400);
  assert.equal((await post({ kind: 'event', ref: 'ancients', startsAt: T0 + DAY, endsAt: T0 })).status, 400);
  assert.equal((await post({ kind: 'banner', ref: 'roi_inconnu' })).status, 400);
  assert.equal((await post({ kind: 'event', ref: 'ancients', status: 'active' })).status, 400, 'activation par le bouton seulement');
  const ok = await post({ kind: 'event', ref: 'ancients', minClient: '9.4.0', data: { params: { attemptsPerDay: 5 } } });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.data.params.attemptsPerDay, 5);
  assert.equal(ok.body.data.params.coinMult, 1, 'défauts complétés');
  assert.equal(ok.body.status, 'draft');
});

test('live : calendrier automatique — démarre et s\'arrête tout seul aux dates (heure du serveur)', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const r = await s.call('POST', '/api/admin/live/items', { kind: 'event', ref: 'lights', title: 'Lueurs', startsAt: T0 + DAY, endsAt: T0 + 3 * DAY, status: 'scheduled' }, s.token);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.effective, 'scheduled');
  let pub = await s.call('GET', '/api/live');
  assert.equal(pub.body.events[0].state, 'scheduled');
  s.set(T0 + DAY);
  pub = await s.call('GET', '/api/live');
  assert.equal(pub.body.events[0].state, 'active', 'actif pile à la date de début, sans intervention');
  s.set(T0 + 3 * DAY);
  pub = await s.call('GET', '/api/live');
  assert.equal(pub.body.events.length, 0, 'retiré à la date de fin');
  const relog = await s.call('POST', '/api/admin/login', { username: 'erwann', password: 'motdepasse-admin-1' }); // session de 12 h
  const adm = await s.call('GET', '/api/admin/live', undefined, relog.body.token);
  assert.equal(adm.body.items[0].effective, 'ended');
});

test('live : démarrage en avance et arrêt en avance (surcharges manuelles), tracés dans l\'historique', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const r = await s.call('POST', '/api/admin/live/items', { kind: 'event', ref: 'ancients', startsAt: T0 + 5 * DAY, endsAt: T0 + 19 * DAY, status: 'scheduled' }, s.token);
  const early = await s.call('POST', `/api/admin/live/items/${r.body.id}/activate`, { version: r.body.version }, s.token);
  assert.equal(early.status, 200);
  assert.equal(early.body.effective, 'active');
  assert.equal(early.body.startsAt, T0);
  assert.equal(early.body.endsAt, T0 + 19 * DAY, 'fin prévue gardée');
  assert.equal((await s.call('POST', `/api/admin/live/items/${r.body.id}/activate`, { version: r.body.version }, s.token)).status, 409, 'version périmée');
  s.advance(HOUR);
  const stop = await s.call('POST', `/api/admin/live/items/${r.body.id}/stop`, { version: early.body.version }, s.token);
  assert.equal(stop.body.effective, 'ended');
  assert.equal(stop.body.endsAt, T0 + HOUR);
  assert.equal((await s.call('GET', '/api/live')).body.events.length, 0);
  const adm = await s.call('GET', '/api/admin/live', undefined, s.token);
  assert.deepEqual(adm.body.history.map((h) => h.action), ['arrêt immédiat', 'activation immédiate', 'création']);
  assert.ok(adm.body.history.every((h) => h.admin === 'erwann'));
  const entry = await s.call('GET', `/api/admin/live/history/${adm.body.history[0].id}`, undefined, s.token);
  assert.equal(entry.body.before.effective, 'active');
});

test('live : un seul événement à la fois (chevauchement refusé), interrupteurs et annonces', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  await s.call('POST', '/api/admin/live/items', { kind: 'event', ref: 'ancients', startsAt: T0 + DAY, endsAt: T0 + 15 * DAY, status: 'scheduled' }, s.token);
  const clash = await s.call('POST', '/api/admin/live/items', { kind: 'event', ref: 'lights', startsAt: T0 + 10 * DAY, endsAt: T0 + 20 * DAY, status: 'scheduled' }, s.token);
  assert.equal(clash.status, 409);
  const draft = await s.call('POST', '/api/admin/live/items', { kind: 'event', ref: 'lights', startsAt: T0 + 10 * DAY, endsAt: T0 + 20 * DAY }, s.token);
  assert.equal(draft.status, 201, 'un brouillon peut chevaucher (il ne s\'active pas)');
  const flag = await s.call('POST', '/api/admin/live/items', { kind: 'flag', ref: 'worldBoss', data: { value: false } }, s.token);
  await s.call('POST', `/api/admin/live/items/${flag.body.id}/activate`, {}, s.token);
  const ann = await s.call('POST', '/api/admin/live/items', { kind: 'announcement', title: 'Maintenance', data: { text: 'Maintenance jeudi 10 h.' } }, s.token);
  await s.call('POST', `/api/admin/live/items/${ann.body.id}/activate`, {}, s.token);
  const pub = await s.call('GET', '/api/live');
  assert.deepEqual(pub.body.flags, { worldBoss: false });
  assert.equal(pub.body.announcements[0].text, 'Maintenance jeudi 10 h.');
  assert.equal((await s.call('DELETE', `/api/admin/live/items/${ann.body.id}`, undefined, s.token)).status, 409, 'actif : arrêter d\'abord');
});

test('live : goals librement réglables — objectif 40 260 (« 40,26k »), paliers ajoutés ou retirés, compteur affiché', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  s.db.prepare("INSERT INTO preregistrations (email, consent_version, consent_at) VALUES ('a@b.fr', 'x', 1)").run();
  const before = await s.call('GET', '/api/live/goals');
  assert.equal(before.body.target, 10000, 'v10.8 : objectif 10 000 par défaut');
  assert.equal(before.body.tiers.length, 10, '6 paliers jusqu\'à 10 000 + 4 paliers bonus');
  assert.equal(before.body.tiers.filter((x) => x.at <= before.body.target).length, 6);
  assert.equal(parseAmount('40.26k'), 40260);
  assert.equal(parseAmount('40,26k'), 40260);
  assert.equal(parseAmount('40 260'), 40260);
  assert.ok(Number.isNaN(parseAmount('beaucoup')));
  const adm = await s.call('GET', '/api/admin/live', undefined, s.token);
  const data = { target: '40,26k', display: { mode: 'offset', value: 100 }, texts: { headline: 'Objectif : 40 260', reached: 'Merci !' },
    tiers: [{ at: '10k', label: '10K', name: '500 gemmes', img: 'assets/icon_gem.png' }, { at: 40260, label: '40,26K', name: 'Méga pack', excl: true }] };
  const put = await s.call('PUT', '/api/admin/live/goals', { version: adm.body.goals.version, data }, s.token);
  assert.equal(put.status, 200);
  assert.equal(put.body.data.target, 40260);
  assert.equal(put.body.realCount, 1);
  assert.equal(put.body.displayedCount, 101);
  const pub = await s.call('GET', '/api/live/goals');
  assert.equal(pub.body.target, 40260);
  assert.equal(pub.body.count, 101, 'le site ne voit que le compteur affiché');
  assert.equal(pub.body.tiers.length, 2);
  assert.equal((await s.call('GET', '/api/live')).body.goals.target, 40260);
  assert.equal((await s.call('PUT', '/api/admin/live/goals', { version: adm.body.goals.version, data }, s.token)).status, 409, 'version périmée');
  const bad = await s.call('PUT', '/api/admin/live/goals', { data: { ...data, tiers: [{ at: 20, label: 'a', name: 'b' }, { at: 10, label: 'c', name: 'd' }] } }, s.token);
  assert.equal(bad.status, 400, 'seuils croissants');
  const badImg = await s.call('PUT', '/api/admin/live/goals', { data: { ...data, tiers: [{ at: 20, label: 'a', name: 'b', img: 'https://evil/x.png' }] } }, s.token);
  assert.equal(badImg.status, 400);
});

test('live : paliers revus — goals 9.3.1 jamais modifiés remplacés, goals de l\'admin gardés, site aligné', () => {
  const db = openDatabase(':memory:');
  createLive({ db });
  db.prepare('UPDATE live_goals SET data = ? WHERE id = 1').run(JSON.stringify(GOALS_931));
  createLive({ db });
  assert.deepEqual(JSON.parse(db.prepare('SELECT data FROM live_goals WHERE id = 1').get().data), DEFAULT_GOALS);
  const mine = { ...GOALS_931, target: 42000 };
  db.prepare('UPDATE live_goals SET data = ? WHERE id = 1').run(JSON.stringify(mine));
  createLive({ db });
  assert.equal(JSON.parse(db.prepare('SELECT data FROM live_goals WHERE id = 1').get().data).target, 42000, 'réglage admin conservé');
  db.close();
  assert.doesNotThrow(() => validateGoals(DEFAULT_GOALS));
  assert.deepEqual(SITE_GOALS.tiers, DEFAULT_GOALS.tiers, 'repli du site = paliers du serveur');
  assert.equal(SITE_GOALS.target, DEFAULT_GOALS.target);
});

test('live : 10.8.2 — objectif 50 000 enregistré depuis l\'admin ramené une fois à 10 000, mode du compteur gardé', () => {
  const db = openDatabase(':memory:');
  createLive({ db });
  const edited = { ...GOALS_1061, display: { mode: 'offset', value: 120 }, texts: { ...GOALS_1061.texts, headline: 'Retouché dans l’admin' } };
  db.prepare('UPDATE live_goals SET data = ? WHERE id = 1').run(JSON.stringify(edited));
  db.prepare("DELETE FROM live_meta WHERE key = 'goals_1080'").run(); // base d'avant la 10.8.2
  createLive({ db });
  const after = JSON.parse(db.prepare('SELECT data FROM live_goals WHERE id = 1').get().data);
  assert.equal(after.target, 10000);
  assert.deepEqual(after.tiers, DEFAULT_GOALS.tiers);
  assert.deepEqual(after.display, { mode: 'offset', value: 120 }, 'mode du compteur gardé');
  // Une seule fois : si l'admin remet 50 000 ensuite, c'est gardé.
  db.prepare('UPDATE live_goals SET data = ? WHERE id = 1').run(JSON.stringify(edited));
  createLive({ db });
  assert.equal(JSON.parse(db.prepare('SELECT data FROM live_goals WHERE id = 1').get().data).target, 50000);
  db.close();
});

test('live : paliers bonus — mystère avant l\'objectif, puis la barre vise le palier bonus suivant', () => {
  const before = goalProgress({ ...DEFAULT_GOALS, count: 9000 });
  assert.equal(before.goal, 10000);
  assert.ok(before.tiers.filter((x) => x.bonus).every((x) => x.secret));
  const after = goalProgress({ ...DEFAULT_GOALS, count: 12000 });
  assert.equal(after.reached, true);
  assert.equal(after.goal, 15000);
  assert.equal(after.pct, 80);
  assert.ok(after.tiers.every((x) => !x.secret));
  assert.equal(goalProgress({ ...DEFAULT_GOALS, count: 120000 }).goal, 10000, 'tout débloqué : barre pleine');
});

// ---- Catalogue --------------------------------------------------------------------------------------------------------
test('live : catalogue cohérent avec le code (vedettes = SSR alliés, offres présentes)', () => {
  const ssr = COMPANIONS.filter((c) => c.kind === 'ally' && c.rarity === 'legendary').map((c) => c.id).sort();
  assert.deepEqual(Object.keys(LIVE_FEATURED_UNITS).sort(), ssr);
  assert.deepEqual(LIVE_OFFERS.map((o) => o.id).sort(), Object.keys(LIVE_OFFER_IDS).sort());
  assert.ok(compareVersions('9.10.0', '9.3.0') > 0);
  assert.equal(compareVersions('9.3.0', '9.3.0'), 0);
});

// ---- Client -----------------------------------------------------------------------------------------------------------
const content = (over = {}) => ({ schema: 1, validFor: 6 * HOUR, goals: null, events: [], banners: [], offers: [], announcements: [], flags: {}, ...over });
const ev = (over = {}) => ({ id: 7, type: 'ancients', title: 'Test', start: T0 - DAY, end: T0 + 13 * DAY, minClient: '9.3.0', params: { attemptsPerDay: 5 }, ...over });

test('client live : jamais répondu → calendrier codé en dur ; config connue → seulement ce qu\'elle active', () => {
  resetLive();
  setLiveClientVersion('9.3.0');
  assert.equal(liveKnown(), false);
  assert.ok(currentEvent(Date.UTC(2026, 10, 10)), 'repli : cycle de 28 jours');
  assert.ok(featuredUnit('limited', Date.UTC(2026, 10, 10)), 'repli : vedette tous les 14 jours');
  applyLive(content(), T0, { local: T0 });
  assert.equal(currentEvent(T0), null, 'config vide : aucun événement');
  assert.equal(featuredUnit('limited', T0), null, 'aucune vedette');
  applyLive(content({ events: [ev()] }), T0, { local: T0 });
  const e = currentEvent(T0);
  assert.equal(e.kind, 'grand');
  assert.equal(e.id, 'ancients-live7');
  assert.equal(e.day, 2);
  assert.equal(e.days, 14);
  const state = { economy: { events: {} }, records: { bestStage: 100 }, maxStage: 100 };
  assert.equal(worldBossStatus(state, T0).perDay, 5, 'paramètre live appliqué');
  assert.equal(currentEvent(T0 + 13 * DAY), null, 'désactivé à la date de fin');
  applyLive(content({ events: [ev({ params: { worldBoss: false } })] }), T0, { local: T0 });
  assert.equal(worldBossStatus(state, T0), null, 'World Boss coupé par la config');
  applyLive(content({ events: [ev()], flags: { worldBoss: false } }), T0, { local: T0 });
  assert.equal(liveFlag('worldBoss'), false);
  assert.equal(worldBossStatus(state, T0), null, 'interrupteur');
  resetLive();
});

test('client live : version minimale du client respectée', () => {
  resetLive();
  setLiveClientVersion('9.3.0');
  applyLive(content({ events: [ev({ minClient: '9.4.0' })], offers: [{ id: 1, offer: 'offer_launch', start: T0 - HOUR, end: null, minClient: '9.3.0' }] }), T0, { local: T0 });
  assert.equal(liveEvent(T0), null, 'événement d\'une version future ignoré');
  assert.equal(liveOfferActive('offer_launch', T0), true);
  setLiveClientVersion('9.2.9');
  assert.equal(liveOfferActive('offer_launch', T0), false, 'offre livrée en 9.3.0 : invisible en 9.2.9');
  setLiveClientVersion('9.3.0');
  applyLive(content({ events: [ev({ type: 'type_futur' })] }), T0, { local: T0 });
  assert.equal(liveEvent(T0), null, 'type inconnu du code : ignoré');
  resetLive();
});

test('client live : horloge du serveur (l\'horloge locale ne triche pas)', () => {
  resetLive();
  setLiveClientVersion('9.3.0');
  const localWrong = T0 + 30 * DAY; // horloge du PC avancée d'un mois
  applyLive(content({ events: [ev()] }), T0, { local: localWrong });
  assert.equal(liveNow(localWrong), T0, 'heure serveur retrouvée');
  assert.ok(currentEvent(liveNow(localWrong)), 'l\'événement reste ouvert malgré l\'horloge locale');
  assert.equal(liveNow(T0 - 60 * DAY), T0, 'reculer l\'horloge ne remonte pas avant la dernière heure serveur');
  resetLive();
});

test('client live : hors ligne — cache, rien ne s\'active par erreur, ce qui est en cours reste jouable', async () => {
  resetLive();
  setLiveClientVersion('9.3.0');
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const later = ev({ id: 8, type: 'lights', start: T0 + DAY, end: T0 + 15 * DAY });
  const running = { ...ev(), end: T0 + 2 * DAY };
  applyLive(content({ events: [running, later], banners: [{ id: 3, unit: 'archangel', start: T0 - HOUR, end: T0 + 3 * DAY, minClient: '9.3.0' }] }), T0, { local: T0 });
  saveLiveCache(storage);
  resetLive();
  setLiveClientVersion('9.3.0');
  const offline = async () => { throw new Error('hors ligne'); };
  assert.equal(await refreshLive({ fetchFn: offline, storage }), 'offline');
  assert.equal(liveKnown(), false, 'sans cache ni réseau : inconnu');
  assert.ok(loadLiveCache(storage));
  assert.equal(liveEvent(T0 + DAY + HOUR).id, 7, 'l\'événement en cours continue jusqu\'à sa fin connue');
  assert.equal(liveFeatured(T0 + DAY).unit, 'archangel');
  assert.equal(liveEvent(T0 + 2 * DAY + HOUR), null, 'en cours terminé ; le suivant ne démarre pas hors ligne (config périmée)');
  assert.equal(currentEvent(T0 + 2 * DAY + HOUR), null);
  assert.equal(liveAnnouncements(T0).length, 0);
  resetLive();
});

test('client live : offres activables seulement si la config live les active', () => {
  resetLive();
  setLiveClientVersion('9.3.0');
  assert.ok(!allOffers().some((o) => o.live), 'jamais répondu : aucune offre live');
  applyLive(content({ offers: [{ id: 1, offer: 'offer_launch', start: Date.now() - HOUR, end: Date.now() + DAY, minClient: '9.3.0' }] }), Date.now());
  assert.deepEqual(allOffers().filter((o) => o.live).map((o) => o.id), ['offer_launch']);
  resetLive();
});

// ---- Bout en bout -----------------------------------------------------------------------------------------------------
test('bout en bout : l\'admin clique « Démarrer maintenant », le jeu voit l\'événement au rafraîchissement suivant', async (t) => {
  const s = await setup();
  t.after(() => { resetLive(); return s.close(); });
  resetLive();
  setLiveClientVersion('9.3.0');
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  // Le jeu démarre : config lue, aucun événement.
  assert.equal(await refreshLive({ base: s.base, storage }), 'updated');
  assert.equal(currentEvent(), null);
  // Le producteur prépare l'événement (brouillon) : toujours rien côté jeu.
  const draft = await s.call('POST', '/api/admin/live/items', { kind: 'event', ref: 'ancients', title: 'Expédition de décembre', data: { params: { attemptsPerDay: 4 } } }, s.token);
  assert.equal(await refreshLive({ base: s.base, storage }), 'same', 'brouillon : config publique inchangée (304)');
  assert.equal(currentEvent(), null, 'brouillon : invisible');
  // « Le bouton ».
  const on = await s.call('POST', `/api/admin/live/items/${draft.body.id}/activate`, { version: draft.body.version }, s.token);
  assert.equal(on.status, 200);
  assert.equal(await refreshLive({ base: s.base, storage }), 'updated');
  const e = currentEvent();
  assert.ok(e, 'l\'événement apparaît sans mise à jour du jeu');
  assert.equal(e.kind, 'grand');
  assert.equal(e.title, 'Expédition de décembre');
  assert.equal(liveNow(Date.now()) >= T0, true);
  assert.equal(await refreshLive({ base: s.base, storage }), 'same', 'rien de neuf : 304');
  // Arrêt : disparaît au rafraîchissement suivant.
  s.advance(HOUR);
  await s.call('POST', `/api/admin/live/items/${draft.body.id}/stop`, { version: on.body.version }, s.token);
  assert.equal(await refreshLive({ base: s.base, storage }), 'updated');
  assert.equal(currentEvent(), null);
});

// ---- Continuité au déploiement ----------------------------------------------------------------------------------------
test('déploiement : le calendrier 9.2.9 est repris tout seul (mêmes dates, même cycle), une seule fois', async (t) => {
  const at = Date.UTC(2026, 10, 20, 9); // milieu d'un Marché des lueurs (cycle 1)
  const db = openDatabase(':memory:');
  const s = await setup({ keepSeed: true, at, db });
  t.after(() => { resetLive(); return s.close(); });
  const pub = (await s.call('GET', '/api/live')).body;
  assert.equal(pub.programmed, true);
  const cur = pub.events.find((e) => e.state === 'active');
  const old = calendarEvent(at); // calcul automatique de la 9.2.9
  assert.equal(cur.type, old.kind === 'grand' ? 'ancients' : 'lights');
  assert.equal(cur.start, old.start);
  assert.equal(cur.end, old.end);
  assert.equal(cur.cycle, old.cycle);
  assert.ok(pub.events.length >= 5, 'cycles suivants programmés');
  // v10.14 : les Fêtes du mois (type « fest ») sont programmées à part, à partir de leur premier mois.
  const legacy = pub.events.filter((e) => e.type !== 'fest');
  for (let k = 0; k < legacy.length - 1; k += 1) assert.equal(legacy[k].end, legacy[k + 1].start, 'enchaînés sans trou');
  const vedette = pub.banners.find((b) => b.state === 'active');
  assert.equal(vedette.unit, featuredUnit('limited', at).id, 'même vedette que la 9.2.9');
  // Le jeu garde l'identifiant de l'événement de la 9.2.9 (progression conservée).
  resetLive();
  setLiveClientVersion('9.3.0');
  applyLive(pub, at, { local: at });
  assert.equal(currentEvent(at).id, old.id);
  assert.equal(featuredUnit('limited', at).id, vedette.unit);
  // Idempotent : un second démarrage ne recrée rien ; l'admin peut tout modifier.
  const n = db.prepare('SELECT COUNT(*) AS n FROM live_items').get().n;
  createApp({ db, siteDir: '', webDir: '', now: () => at });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM live_items').get().n, n);
  const hist = (await s.call('GET', '/api/admin/live', undefined, s.token)).body.history;
  assert.equal(hist.filter((h) => h.action === 'reprise du calendrier 9.2.9').length, 1);
  const stop = await s.call('POST', `/api/admin/live/items/${cur.id}/stop`, {}, s.token);
  assert.equal(stop.body.effective, 'ended');
});

test('déploiement : vedettes du catalogue dans le même ordre que la rotation 9.2.9', () => {
  assert.deepEqual(Object.keys(LIVE_FEATURED_UNITS), permanentSsr().map((u) => u.id));
  const cal = legacyCalendar(Date.UTC(2026, 10, 3));
  assert.equal(cal.events[0].cycle, 1);
  assert.ok(cal.banners.length >= 6);
});

test('client live : config vide d\'un serveur qui n\'a jamais rien programmé → calendrier automatique gardé', () => {
  resetLive();
  setLiveClientVersion('9.3.0');
  const at = Date.UTC(2026, 10, 10);
  applyLive(content({ programmed: false }), at, { local: at });
  assert.equal(liveKnown(), false);
  assert.deepEqual(currentEvent(at), calendarEvent(at));
  assert.ok(featuredUnit('limited', at));
  applyLive(content({ programmed: true }), at, { local: at });
  assert.equal(currentEvent(at), null, 'programmé puis vidé : plus rien');
  resetLive();
});

test('site 10.8 : le compteur vise le prochain palier (4 sur 250, puis 300 sur 500)', () => {
  const a = goalProgress({ ...DEFAULT_GOALS, count: 4 });
  assert.equal(a.goal, 250);
  assert.ok(Math.abs(a.pct - 1.6) < 1e-9);
  assert.equal(a.tiers.find((x) => x.at === 250).state, 'next');
  const b = goalProgress({ ...DEFAULT_GOALS, count: 300 });
  assert.equal(b.tiers.find((x) => x.at === 250).state, 'reached');
  assert.equal(b.goal, 500);
  assert.equal(DEFAULT_GOALS.target, 10000);
});

test('site 10.8 : parrainage — code court, +1 seulement après confirmation, jamais soi-même, classement admin', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const a = await s.call('POST', '/api/preregister', { email: 'parrain@exemple.fr', consent: true });
  assert.equal(a.status, 202);
  assert.match(a.body.ref, /^[A-HJ-NP-Z2-9]{6}$/);
  const again = await s.call('POST', '/api/preregister', { email: 'Parrain@exemple.fr', consent: true });
  assert.equal(again.body.ref, a.body.ref, 'même code pour le même email');
  // Même adresse IP dans l'heure : pas compté.
  await s.call('POST', '/api/preregister', { email: 'moi-bis@exemple.fr', consent: true, ref: a.body.ref });
  s.advance(2 * HOUR);
  await s.call('POST', '/api/preregister', { email: 'ami@exemple.fr', consent: true, ref: a.body.ref.toLowerCase(), utm: 'tiktok' });
  const count = () => s.call('GET', `/api/preregister/ref/${a.body.ref}`).then((r) => r.body.count);
  assert.equal(await count(), 0, 'pas avant la confirmation');
  const rows = s.db.prepare('SELECT email, referrer, confirm_token, utm_source FROM preregistrations').all();
  assert.equal(rows.find((r) => r.email === 'moi-bis@exemple.fr').referrer, null);
  const ami = rows.find((r) => r.email === 'ami@exemple.fr');
  assert.equal(ami.utm_source, 'tiktok');
  assert.equal((await s.call('GET', `/api/preregister/confirm?token=${ami.confirm_token}`)).body.ok, true);
  assert.equal((await s.call('GET', `/api/preregister/confirm?token=${ami.confirm_token}`)).body.ok, false, 'une seule fois');
  assert.equal(await count(), 1);
  const top = await s.call('GET', '/api/admin/referrers', undefined, s.token);
  assert.deepEqual(top.body.referrers[0], { rank: 1, who: 'pa***@e***', ref: a.body.ref, count: 1 });
  assert.equal((await s.call('GET', '/api/admin/referrers')).status, 401);
});

test('site : vidéo de l\'accueil modifiable dans l\'admin (MP4/WebM vérifiés, aperçu, retour à l\'origine)', async (t) => {
  const { mkdtempSync, existsSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const uploadsDir = mkdtempSync(`${tmpdir()}/up-`);
  const db = openDatabase(':memory:');
  const app = createApp({ db, siteDir: '', webDir: '', uploadsDir, adminPasswordHash: await hashPassword('motdepasse-admin-1') });
  const server = createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.close(); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = (await (await fetch(`${base}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'erwann', password: 'motdepasse-admin-1' }) })).json()).token;
  const up = (kind, body, tok = token) => fetch(`${base}/api/admin/video`, { method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'X-Kind': kind }, body });
  const pub = async () => (await fetch(`${base}/api/site/video`)).json();
  assert.deepEqual(await pub(), { mp4: 'assets/trailer.mp4', webm: 'assets/trailer.webm', phone: 'assets/trailer-phone.mp4', poster: 'assets/trailer-poster.webp' });
  assert.equal((await up('video', Buffer.from('pas une vidéo du tout'))).status, 415);
  assert.equal((await fetch(`${base}/api/admin/video`, { method: 'POST', headers: { 'X-Kind': 'video' }, body: Buffer.alloc(20) })).status, 401);
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(64)]);
  assert.equal((await up('video', mp4)).status, 201);
  let v = await pub();
  assert.match(v.mp4, /^assets\/uploads\/video\/.+-site\.mp4$/);
  assert.equal(v.webm, null, 'l\'ancien WebM n\'est plus proposé');
  assert.equal(v.poster, null, 'jamais l\'image de l\'ancienne vidéo sous une nouvelle vidéo');
  assert.ok(existsSync(`${uploadsDir}/video/${v.mp4.split('/').pop()}`));
  assert.equal((await fetch(`${base}/${v.mp4}`)).status, 200, 'servie par le site');
  const png = Buffer.concat([Buffer.from([0x89]), Buffer.from('PNG\r\n\x1a\n'), Buffer.alloc(32)]);
  assert.equal((await up('poster', png)).status, 201);
  v = await pub();
  assert.match(v.poster, /\.png$/); assert.match(v.mp4, /\.mp4$/);
  await fetch(`${base}/api/admin/video`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  assert.equal((await pub()).mp4, 'assets/trailer.mp4');
  assert.match(readFileSync('site/site.js', 'utf8'), /fetch\('api\/site\/video'/);
  assert.match(readFileSync('site/admin/index.html', 'utf8'), /data-tab="site-video"/);
});

test('site : vidéos servies par morceaux (Range : 206, Content-Range), sinon 200 avec la taille', async (t) => {
  const db = openDatabase(':memory:');
  const app = createApp({ db, siteDir: fileURLToPath(new URL('../site', import.meta.url)), webDir: '' });
  const server = createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.close(); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const full = await fetch(`${base}/assets/trailer.mp4`);
  assert.equal(full.status, 200); assert.equal(full.headers.get('accept-ranges'), 'bytes');
  const size = Number(full.headers.get('content-length')); await full.arrayBuffer();
  const part = await fetch(`${base}/assets/trailer.mp4`, { headers: { Range: 'bytes=0-99' } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-range'), `bytes 0-99/${size}`);
  assert.equal((await part.arrayBuffer()).byteLength, 100);
  const tail = await fetch(`${base}/assets/trailer.mp4`, { headers: { Range: 'bytes=-10' } });
  assert.equal((await tail.arrayBuffer()).byteLength, 10);
  assert.equal((await fetch(`${base}/assets/trailer.mp4`, { headers: { Range: `bytes=${size + 5}-` } })).status, 416);
});

test('site : paliers bonus montrés dès maintenant si l\'admin le choisit (sinon « mystère » jusqu\'à l\'objectif)', () => {
  const g = validateGoals({ ...DEFAULT_GOALS, revealBonus: true });
  assert.equal(g.revealBonus, true);
  assert.equal(validateGoals(DEFAULT_GOALS).revealBonus, false);
  assert.ok(goalProgress({ ...DEFAULT_GOALS, count: 4 }).tiers.filter((x) => x.bonus).every((x) => x.secret));
  assert.ok(goalProgress({ ...DEFAULT_GOALS, revealBonus: true, count: 4 }).tiers.filter((x) => x.bonus).every((x) => !x.secret));
  assert.match(readFileSync(new URL('../site/admin/index.html', import.meta.url), 'utf8'), /id="lg-reveal"/);
});

test('site : icône pour Google (favicon.ico 48 px, PNG 192 et 512, manifeste, logo dans les données structurées)', async (t) => {
  const { existsSync } = await import('node:fs');
  for (const f of ['favicon.ico', 'favicon-192.png', 'favicon-512.png', 'apple-touch-icon.png', 'site.webmanifest']) assert.ok(existsSync(new URL(`../site/${f}`, import.meta.url)), f);
  const html = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
  assert.match(html, /rel="icon" href="\/favicon\.ico" sizes="48x48"/);
  assert.match(html, /"logo":"https:\/\/ascendrya\.com\/favicon-512\.png"/);
  const db = openDatabase(':memory:');
  const server = createServer(createApp({ db, siteDir: fileURLToPath(new URL('../site', import.meta.url)), webDir: '' })); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.close(); db.close(); });
  const r = await fetch(`http://127.0.0.1:${server.address().port}/favicon.ico`);
  assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'image/x-icon');
});

test('site : robots.txt et sitemap.xml servis, adresse canonique unique (sans www)', async (t) => {
  const db = openDatabase(':memory:');
  const server = createServer(createApp({ db, siteDir: fileURLToPath(new URL('../site', import.meta.url)), webDir: '' })); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.close(); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const robots = await fetch(`${base}/robots.txt`); assert.equal(robots.status, 200); assert.match(await robots.text(), /Sitemap: https:\/\/ascendrya\.com\/sitemap\.xml/);
  const map = await fetch(`${base}/sitemap.xml`); assert.equal(map.status, 200); assert.match(await map.text(), /<loc>https:\/\/ascendrya\.com\/<\/loc>/);
  assert.match(readFileSync(new URL('../site/index.html', import.meta.url), 'utf8'), /<link rel="canonical" href="https:\/\/ascendrya\.com\/">/);
});

test('site : une vidéo envoyée reçoit une version téléphone (540 px) et une image d\'aperçu tirée d\'elle (ffmpeg)', async (t) => {
  const { execFileSync } = await import('node:child_process');
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch { t.skip('ffmpeg absent'); return; }
  const { mkdtempSync, existsSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const uploadsDir = mkdtempSync(`${tmpdir()}/upv-`);
  const db = openDatabase(':memory:');
  const app = createApp({ db, siteDir: '', webDir: '', uploadsDir, adminPasswordHash: await hashPassword('motdepasse-admin-1') });
  const server = createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.close(); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = (await (await fetch(`${base}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'erwann', password: 'motdepasse-admin-1' }) })).json()).token;
  const body = readFileSync(new URL('../site/assets/trailer-phone.mp4', import.meta.url));
  assert.equal((await fetch(`${base}/api/admin/video`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Kind': 'video' }, body })).status, 201);
  let v = null;
  for (let i = 0; i < 120 && !(v?.phone && v?.poster); i++) { await new Promise((r) => setTimeout(r, 500)); v = await (await fetch(`${base}/api/site/video`)).json(); }
  assert.match(v.phone ?? '', /-phone\.mp4$/);
  assert.match(v.poster ?? '', /-poster\.jpg$/);
  assert.ok(existsSync(`${uploadsDir}/video/${v.phone.split('/').pop()}`));
});

// Site : les dictionnaires FR et EN ont la même structure, et l'anglais ne contient aucun texte français.
test('site i18n : mêmes clés en FR et EN, aucun accent français dans en.js', async () => {
  const [{ default: en }, { default: fr }] = await Promise.all([import('../site/i18n/en.js'), import('../site/i18n/fr.js')]);
  const shape = (v) => (typeof v === 'function' || v === null || typeof v !== 'object' ? 'leaf' : Array.isArray(v) ? v.map(shape) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])));
  const keys = (a, b, path, missing) => {
    if (a === 'leaf' || b === 'leaf') { if (a !== b) missing.push(`${path} (forme différente)`); return; }
    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) missing.push(`${path} (tableau)`); else a.forEach((x, i) => keys(x, b[i], `${path}[${i}]`, missing));
      return;
    }
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (path === 'tiers' && k === 'tags') continue; // étiquettes françaises d'origine : traduites seulement en anglais
      if (!(k in a) || !(k in b)) { missing.push(`${path}.${k}`); continue; }
      keys(a[k], b[k], path ? `${path}.${k}` : k, missing);
    }
  };
  const missing = [];
  keys(shape(fr), shape(en), '', missing);
  assert.deepEqual(missing, [], `clés différentes entre fr.js et en.js : ${missing.join(', ')}`);
  const accents = /[àâäçéèêëîïôöûùüÿœÀÂÉÈÊÎÔÛÇŒ]/;
  const bad = [];
  const walk = (v, path) => {
    if (typeof v === 'string') { if (accents.test(v) && v !== 'Français') bad.push(`${path}: ${v}`); return; }
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`));
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (path === 'tiers' && k === 'tags') continue; walk(x, path ? `${path}.${k}` : k); }
  };
  walk(en, '');
  assert.deepEqual(bad, [], `texte français dans en.js : ${bad.join(' | ')}`);
});
