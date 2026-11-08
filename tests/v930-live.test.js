// v9.3.0 : LIVE-OPS — serveur (routes, droits, validation, versions, calendrier automatique), client (activation,
// désactivation, hors-ligne, horloge serveur, version minimale) et bout en bout (admin « Démarrer maintenant » → le
// jeu voit l'événement au rafraîchissement suivant, sans mise à jour).
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createApp, hashPassword } from '../server/app.mjs';
import { openDatabase } from '../server/db.mjs';
import { parseAmount } from '../server/live.mjs';
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

async function setup() {
  const db = openDatabase(':memory:');
  let clock = T0;
  const app = createApp({ db, siteDir: '', webDir: '', adminPasswordHash: await hashPassword('motdepasse-admin-1'), now: () => clock });
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
  assert.equal(before.body.target, 100000, 'goals d\'avant la 9.3.0 par défaut');
  assert.equal(before.body.tiers.length, 10);
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
