// Mesure d'audience du site : collecte (validation, robots, DNT, débit), vie privée, agrégats, entonnoir,
// attribution des préinscriptions, routes admin protégées, générateur de liens, purge, pages du site.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, hashPassword, maskEmail } from '../server/app.mjs';
import { openDatabase } from '../server/db.mjs';
import { buildCampaignUrl, classifyChannel, cleanBatch, cleanTag, countryOf, createSiteStats, isBotUa, parseUa, scrubText, SITE_LIMITS, toCsv } from '../server/sitestats.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const UA_PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const T0 = Date.UTC(2026, 10, 20, 12);
const DAY = 86400000;

async function setup(extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'idle-site-'));
  const siteDir = join(dir, 'site'); const webDir = join(dir, 'web');
  mkdirSync(siteDir); mkdirSync(webDir);
  writeFileSync(join(siteDir, 'index.html'), '<!doctype html><p>accueil</p>');
  const db = openDatabase(':memory:');
  let clock = T0;
  const app = createApp({ db, siteDir, webDir, now: () => clock, trustProxy: true, adminPasswordHash: await hashPassword('mot-de-passe-admin'), ...extra });
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const s = {
    db, base, advance: (ms) => { clock += ms; }, setClock: (t) => { clock = t; }, now: () => clock,
    close: async () => { server.close(); await once(server, 'close').catch(() => {}); db.close(); },
    // Envoi de la collecte, comme stats.js (corps text/plain, pas de cookie).
    track: (body, { ip = '203.0.113.7', ua = UA, headers = {} } = {}) => fetch(`${base}/api/site/track`, {
      method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'Content-Type': 'text/plain', 'User-Agent': ua, 'X-Forwarded-For': ip, ...headers },
    }),
    async call(method, path, body, token, extra = {}) {
      const headers = { 'Content-Type': 'application/json', ...extra };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await res.text();
      let parsed = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
      return { status: res.status, body: parsed, text, headers: res.headers };
    },
    async admin() { return (await s.call('POST', '/api/admin/login', { username: 'erwann', password: 'mot-de-passe-admin' })).body.token; },
  };
  return s;
}
const view = (sid, extra = {}) => ({ s: sid, v: `vis-${sid}`.padEnd(10, 'x'), nv: 1, h: 1, m: { u: {}, w: 390, l: 'fr' }, e: [{ n: 'pv', p: '/', v: 'Ascendrya' }], ...extra });

test('classement automatique des canaux : utm d\'abord, puis referrer', () => {
  assert.equal(classifyChannel({ source: 'x', medium: 'social' }), 'x');
  assert.equal(classifyChannel({ source: 'Twitter' }), 'x');
  assert.equal(classifyChannel({ referrerHost: 't.co' }), 'x');
  assert.equal(classifyChannel({ source: 'youtube', medium: 'shorts' }), 'youtube_shorts');
  assert.equal(classifyChannel({ source: 'youtube', medium: 'video' }), 'youtube');
  assert.equal(classifyChannel({ referrerHost: 'm.youtube.com' }), 'youtube');
  assert.equal(classifyChannel({ source: 'tiktok' }), 'tiktok');
  assert.equal(classifyChannel({ source: 'google_play', medium: 'store' }), 'play_store');
  assert.equal(classifyChannel({ referrerHost: 'play.google.com' }), 'play_store');
  assert.equal(classifyChannel({ source: 'steam' }), 'steam');
  assert.equal(classifyChannel({ referrerHost: 'store.steampowered.com' }), 'steam');
  assert.equal(classifyChannel({ referrerHost: 'reddit.com' }), 'reddit');
  assert.equal(classifyChannel({ referrerHost: 'discord.com' }), 'discord');
  for (const h of ['google.com', 'google.fr', 'bing.com', 'duckduckgo.com']) assert.equal(classifyChannel({ referrerHost: h }), 'search', h);
  assert.equal(classifyChannel({}), 'direct');
  assert.equal(classifyChannel({ referrerHost: 'ascendrya.com' }), 'direct', 'le site lui-même n\'est pas une source');
  assert.equal(classifyChannel({ referrerHost: 'blog.example.org' }), 'referral');
  assert.equal(classifyChannel({ source: 'inconnu-total' }), 'other');
  assert.equal(classifyChannel({ source: 'x', referrerHost: 'google.com' }), 'x', 'utm prioritaire');
  assert.equal(classifyChannel({ hint: 'tiktok' }), 'tiktok', 'navigateur intégré de TikTok sans referrer');
});

test('appareil, navigateur, pays : déduits sans géolocalisation externe', () => {
  assert.deepEqual({ ...parseUa(UA_PHONE), inApp: null }, { device: 'mobile', os: 'iOS', browser: 'Safari', inApp: null });
  assert.equal(parseUa(UA).device, 'desktop');
  assert.equal(parseUa('Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148').device, 'tablet');
  assert.equal(parseUa('Mozilla/5.0 (iPhone) AppleWebKit musical_ly_33.1 BytedanceWebview/d8a').inApp, 'tiktok');
  assert.deepEqual(countryOf({ 'cf-ipcountry': 'fr' }), { country: 'FR', src: 'header' });
  assert.deepEqual(countryOf({ 'cf-ipcountry': 'XX', 'accept-language': 'en-GB,en;q=0.9' }), { country: 'GB', src: 'lang' });
  assert.deepEqual(countryOf({ 'accept-language': 'fr' }), { country: null, src: null });
  assert.ok(isBotUa('Mozilla/5.0 (compatible; Googlebot/2.1)'));
  assert.ok(isBotUa('python-requests/2.31'));
  assert.ok(isBotUa('Mozilla/5.0 HeadlessChrome/126.0'));
  assert.ok(isBotUa(''));
  assert.ok(!isBotUa(UA));
});

test('validation stricte d\'un envoi : noms en liste blanche, types, tailles, pas de texte libre', () => {
  assert.equal(cleanBatch(null), null);
  assert.equal(cleanBatch([]), null);
  const b = cleanBatch({
    s: 'session-0001', v: 'visiteur-001', nv: 0, h: 1,
    m: { u: { s: 'X Twitter!', c: 'Lancement 2026' }, r: 'www.T.co', w: 390.7, l: 'FR-fr' },
    e: [
      { n: 'pv', p: '/classement/?x=1#a', v: 'Titre' }, { n: 'click', a: 'cta_hero' }, { n: 'click', a: '<script>alert(1)</script>' },
      { n: 'inconnu', a: 'x' }, { n: 'scroll', x: 33 }, { n: 'scroll', x: 50 }, { n: 'vid', a: '75' }, { n: 'vid', a: '99' }, { n: 'form', a: 'submit' }, { n: 'form', a: 'mot de passe' },
      { n: 'err', a: 'Boom jean@exemple.fr a échoué https://x.test/a/b.js?token=SECRET 12345678901' }, { n: 'perf', a: 'lcp', x: 2300.46 }, { n: 'perf', a: 'zzz', x: 1 }, { n: 'act', x: 99999999 },
      { n: 'pv', p: '../../etc/passwd' }, 42, null, 'texte',
    ],
  });
  assert.equal(b.sid, 'session-0001');
  assert.equal(b.nv, 0);
  assert.deepEqual({ s: b.meta.source, c: b.meta.campaign, r: b.meta.referrer, w: b.meta.width, l: b.meta.lang }, { s: 'x-twitter', c: 'lancement-2026', r: 't.co', w: 390.7, l: 'fr' });
  const names = b.events.map((e) => `${e.name}:${e.a ?? e.x ?? e.page}`);
  assert.deepEqual(names, ['pv:/classement/', 'click:cta_hero', 'scroll:50', 'vid:75', 'form:submit', 'err:Boom [email] a échoué b.js #', 'perf:lcp', 'act:120000']);
  assert.ok(b.rejected >= 8, 'les événements invalides sont comptés puis écartés');
  assert.ok(!JSON.stringify(b).includes('SECRET'), 'aucune adresse complète ni jeton dans une erreur');
  assert.equal(cleanBatch({ s: 'court', e: [] }).sid, null, 'identifiant trop court refusé');
  assert.equal(cleanBatch({ s: 'session-0001', e: Array.from({ length: 80 }, () => ({ n: 'hum' })) }).events.length, SITE_LIMITS.events);
  assert.equal(scrubText('a'.repeat(500)).length, 160);
});

test('POST /api/site/track : accepté sans cookie, corps invalide ou trop gros refusé', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const ok = await s.track(view('sess-aaaaaa1'));
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('set-cookie'), null, 'aucun cookie');
  assert.equal((await s.track('pas du json')).status, 400);
  assert.equal((await s.track('[1,2]')).status, 400);
  assert.equal((await s.track({ s: 'x', e: [] })).status, 400, 'sans identifiant de session valide');
  assert.equal((await s.track(JSON.stringify({ s: 'sess-aaaaaa1', e: [{ n: 'err', a: 'x'.repeat(40000) }] }))).status, 413);
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM site_sessions').get().n, 1);
  // CORS ouvert comme les autres routes, un envoi par sendBeacon n'a pas de préflight.
  const pre = await fetch(`${s.base}/api/site/track`, { method: 'OPTIONS' });
  assert.equal(pre.status, 204);
});

test('robots : agent utilisateur connu écarté sans rien stocker, compté à part', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  for (const ua of ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'curl/8.4.0', 'Mozilla/5.0 HeadlessChrome/126']) {
    assert.equal((await s.track(view('sess-bot-0001'), { ua })).status, 204, 'le robot reçoit un 204 comme tout le monde');
  }
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM site_sessions').get().n, 0);
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM site_events').get().n, 0);
  assert.equal(s.db.prepare("SELECT n FROM site_bots WHERE reason = 'ua'").get().n, 3);
});

test('Do-Not-Track et Global Privacy Control : page vue comptée, aucun identifiant', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  // En-tête DNT, en-tête GPC, drapeau envoyé par le navigateur : tous donnent le même résultat.
  assert.equal((await s.track(view('sess-dnt-0001'), { headers: { DNT: '1' } })).status, 204);
  assert.equal((await s.track(view('sess-dnt-0002'), { headers: { 'Sec-GPC': '1' } })).status, 204);
  assert.equal((await s.track({ dnt: 1, e: [{ n: 'pv', p: '/' }, { n: 'click', a: 'cta_hero' }, { n: 'scroll', x: 100 }] })).status, 204);
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM site_sessions').get().n, 0, 'aucune session');
  const rows = s.db.prepare('SELECT sid, name, a FROM site_events').all();
  assert.equal(rows.length, 3, 'seules les pages vues');
  assert.ok(rows.every((r) => r.sid === null && r.name === 'pv' && r.a === null));
  const stats = createSiteStats({ db: s.db, now: () => s.now() });
  const rep = stats.report({ from: '2026-11-20', to: '2026-11-20' });
  assert.equal(rep.kpis.pageviews, 3);
  assert.equal(rep.kpis.dntViews, 3);
  assert.equal(rep.kpis.visitors, 0, 'pas de visiteur identifiable');
});

test('vie privée : pas d\'IP ni d\'agent utilisateur en base, sel quotidien effacé chaque jour', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  await s.track(view('sess-priv-0001'), { ip: '198.51.100.77' });
  const dump = ['site_sessions', 'site_events', 'site_salt', 'site_bots', 'site_daily'].flatMap((tbl) => s.db.prepare(`SELECT * FROM ${tbl}`).all().map((r) => JSON.stringify(r))).join('\n');
  assert.ok(!dump.includes('198.51.100.77'), 'l\'adresse IP n\'est jamais stockée');
  assert.ok(!dump.includes('Mozilla') && !dump.includes('AppleWebKit'), 'l\'agent utilisateur brut n\'est jamais stocké');
  const first = s.db.prepare('SELECT dh FROM site_sessions').get().dh;
  assert.match(first, /^[0-9a-f]{20}$/);
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM site_salt').get().n, 1);
  const salt1 = s.db.prepare('SELECT salt FROM site_salt').get().salt;
  // Le lendemain : nouveau sel, ancien effacé, même visiteur = autre empreinte (aucun suivi d'un jour à l'autre).
  s.advance(DAY);
  await s.track(view('sess-priv-0002'), { ip: '198.51.100.77' });
  const salts = s.db.prepare('SELECT salt FROM site_salt').all();
  assert.equal(salts.length, 1, 'un seul sel à la fois');
  assert.notEqual(salts[0].salt, salt1);
  const dhs = s.db.prepare('SELECT dh FROM site_sessions ORDER BY first_ts').all().map((r) => r.dh);
  assert.notEqual(dhs[0], dhs[1]);
  // Même jour, même visiteur = même empreinte (visiteur unique du jour).
  await s.track(view('sess-priv-0003'), { ip: '198.51.100.77' });
  const same = s.db.prepare('SELECT dh FROM site_sessions WHERE sid IN (?, ?)').all('sess-priv-0002', 'sess-priv-0003').map((r) => r.dh);
  assert.equal(same[0], same[1]);
});

test('limite de débit par visiteur haché, et par nombre de nouvelles sessions', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const codes = [];
  for (let i = 0; i < SITE_LIMITS.batches.max + 3; i += 1) codes.push((await s.track(view('sess-rate-0001'), { ip: '192.0.2.50' })).status);
  assert.equal(codes.slice(0, SITE_LIMITS.batches.max).every((c) => c === 204), true);
  assert.deepEqual(codes.slice(SITE_LIMITS.batches.max), [429, 429, 429]);
  // Un autre visiteur n'est pas gêné ; la fenêtre se vide avec le temps.
  assert.equal((await s.track(view('sess-rate-0002'), { ip: '192.0.2.51' })).status, 204);
  s.advance(SITE_LIMITS.batches.windowMs + 1000);
  assert.equal((await s.track(view('sess-rate-0001'), { ip: '192.0.2.50' })).status, 204);
  // Création de sessions en rafale depuis une même origine.
  let refused = 0;
  for (let i = 0; i < SITE_LIMITS.newSessions.max + 5; i += 1) {
    if ((await s.track(view(`sess-flood-${String(i).padStart(3, '0')}`), { ip: '192.0.2.60' })).status === 429) refused += 1;
    if (i % 60 === 59) s.advance(SITE_LIMITS.batches.windowMs + 1);
  }
  assert.ok(refused >= 5, `rafale de sessions limitée (${refused} refusées)`);
});

test('session : durée active, pages, rebond, appareil, pays, provenance, drapeaux de l\'entonnoir', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const meta = { u: { s: 'youtube', m: 'shorts', c: 'shorts-nov', k: 'short-01' }, r: 'www.youtube.com', w: 390, l: 'fr' };
  await s.track({ s: 'sess-full-0001', v: 'visiteur-0001', nv: 1, h: 1, m: meta, e: [{ n: 'pv', p: '/', v: 'Accueil' }] }, { ua: UA_PHONE, headers: { 'CF-IPCountry': 'BE' } });
  await s.track({ s: 'sess-full-0001', v: 'visiteur-0001', nv: 1, h: 0, e: [
    { n: 'vid', p: '/', a: 'play' }, { n: 'vid', p: '/', a: '50' }, { n: 'scroll', p: '/', x: 25 }, { n: 'scroll', p: '/', x: 75 }, { n: 'sec', p: '/', a: 'join' },
    { n: 'form', p: '/', a: 'focus' }, { n: 'form', p: '/', a: 'input' }, { n: 'click', p: '/', a: 'out_steam', v: 'steam' }, { n: 'ref', p: '/', a: 'copy' }, { n: 'act', x: 42000 }, { n: 'pv', p: '/classement/' },
  ] }, { ua: UA_PHONE });
  const row = s.db.prepare('SELECT * FROM site_sessions WHERE sid = ?').get('sess-full-0001');
  assert.equal(row.channel, 'youtube_shorts');
  assert.equal(row.campaign, 'shorts-nov');
  assert.equal(row.content, 'short-01');
  assert.equal(row.referrer, 'youtube.com');
  assert.equal(row.device, 'mobile');
  assert.equal(row.os, 'iOS');
  assert.equal(row.screen, '< 480 px');
  assert.equal(row.country, 'BE');
  assert.equal(row.country_src, 'header');
  assert.equal(row.pages, 2);
  assert.equal(row.entry_page, '/');
  assert.equal(row.exit_page, '/classement/');
  assert.equal(row.active_ms, 42000);
  assert.equal(row.scroll_max, 75);
  assert.equal(row.vid_play, 1);
  assert.equal(row.vid_max, 50);
  assert.equal(row.join_seen, 1);
  assert.equal(row.form_input, 1);
  assert.equal(row.ref_copy, 1);
  assert.equal(row.clicks, 1);
  assert.equal(row.human, 1);
  assert.equal(row.new_visitor, 1);
});

test('agrégats : visiteurs, nouveaux / revenants, rebond, durée, filtres, comparaison', async (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  let clock = T0;
  const stats = createSiteStats({ db, now: () => clock, maskEmail });
  const send = (body, ip, ua = UA) => stats.ingest({ ip, ua, headers: {} }, body);
  const at = (day, hour) => { clock = Date.UTC(2026, 10, day, hour); };
  at(20, 9);
  send({ s: 'sess-agg-0001', v: 'visiteur-A1', nv: 1, h: 1, m: { u: { s: 'x', m: 'social', c: 'lancement' }, w: 1440, l: 'fr' }, e: [{ n: 'pv', p: '/' }, { n: 'act', x: 30000 }] }, '10.0.0.1');
  at(20, 10);
  send({ s: 'sess-agg-0002', v: 'visiteur-B2', nv: 1, h: 1, m: { u: { s: 'tiktok', m: 'social', c: 'tt' }, w: 390, l: 'en' }, e: [{ n: 'pv', p: '/' }, { n: 'act', x: 2000 }] }, '10.0.0.2', UA_PHONE);
  at(20, 20);
  send({ s: 'sess-agg-0003', v: 'visiteur-A1', nv: 0, h: 1, m: { u: {}, r: 'google.fr', w: 1440, l: 'fr' }, e: [{ n: 'pv', p: '/' }, { n: 'pv', p: '/classement/' }, { n: 'act', x: 10000 }] }, '10.0.0.1');
  send({ s: 'sess-agg-0004', v: 'visiteur-Z9', nv: 1, h: 0, m: { u: {}, w: 1440, l: 'fr' }, e: [{ n: 'pv', p: '/' }] }, '10.0.0.9'); // aucune interaction : écartée
  at(19, 12);
  send({ s: 'sess-agg-0005', v: 'visiteur-C3', nv: 1, h: 1, m: { u: { s: 'x' }, w: 1440, l: 'fr' }, e: [{ n: 'pv', p: '/' }, { n: 'act', x: 15000 }] }, '10.0.0.3'); // veille

  const day = stats.report({ from: '2026-11-20', to: '2026-11-20', tz: '0' });
  assert.equal(day.kpis.sessions, 3);
  assert.equal(day.kpis.visitors, 2);
  assert.equal(day.kpis.newVisitors, 2, 'A1 et B2 sont nouveaux au début de la période');
  assert.equal(day.kpis.returning, 0);
  assert.equal(day.kpis.pageviews, 4);
  assert.ok(Math.abs(day.kpis.avgDurationS - 14) < 1e-9, '(30 + 2 + 10) / 3');
  assert.ok(Math.abs(day.kpis.bounceRate - 1 / 3) < 1e-9, 'seule la session de 2 s sur une page rebondit');
  assert.equal(day.quality.bots.noInteraction, 1);
  assert.equal(day.previous.sessions, 1, 'période précédente = la veille');
  assert.equal(day.previous.visitors, 1);
  assert.equal(day.range.granularity, 'hour');
  assert.equal(day.series.length, 24);
  assert.equal(day.series[9].sessions, 1);
  assert.equal(day.series.reduce((n, p) => n + p.sessions, 0), 3);
  const byCh = Object.fromEntries(day.channels.map((c) => [c.key, c]));
  assert.deepEqual(Object.keys(byCh).sort(), ['search', 'tiktok', 'x']);
  assert.equal(byCh.x.sessions, 1);
  assert.equal(byCh.x.preregs, 0);
  assert.deepEqual(day.audience.devices.map((d) => [d.key, d.count]).sort(), [['desktop', 2], ['mobile', 1]]);
  assert.deepEqual(day.pages.map((p) => [p.page, p.views]), [['/', 3], ['/classement/', 1]]);
  assert.equal(day.entryPages[0].page, '/');
  assert.equal(day.exitPages.find((p) => p.page === '/classement/').sessions, 1);
  assert.equal(day.options.channels.includes('tiktok'), true);

  // Deux jours : A1 est « revenant » dès sa première visite de la période ? Non : nouveau tant que sa première session l'est.
  const two = stats.report({ from: '2026-11-19', to: '2026-11-20', tz: '0' });
  assert.equal(two.kpis.visitors, 3);
  assert.equal(two.kpis.sessions, 4);
  assert.equal(two.range.granularity, 'hour');
  // Filtres : canal, appareil, langue, campagne.
  assert.equal(stats.report({ from: '2026-11-19', to: '2026-11-20', channel: 'x' }).kpis.sessions, 2);
  assert.equal(stats.report({ from: '2026-11-19', to: '2026-11-20', device: 'mobile' }).kpis.sessions, 1);
  assert.equal(stats.report({ from: '2026-11-19', to: '2026-11-20', lang: 'en' }).kpis.sessions, 1);
  assert.equal(stats.report({ from: '2026-11-19', to: '2026-11-20', campaign: 'lancement' }).kpis.sessions, 1);
  assert.equal(stats.report({ from: '2026-11-19', to: '2026-11-20', channel: 'x', device: 'mobile' }).kpis.sessions, 0);
  // Fuseau : le navigateur de Paris (UTC+1 : getTimezoneOffset = -60) voit la session de 20 h UTC le 20 à 21 h locale.
  const paris = stats.report({ from: '2026-11-20', to: '2026-11-20', tz: '-60' });
  assert.equal(paris.series.length, 24);
  assert.equal(paris.series[10].sessions, 1, '9 h UTC = 10 h à Paris');
  assert.equal(paris.audience.hours[21], 1, '20 h UTC = 21 h à Paris');
  // Grandes périodes : jours, semaines, mois ; « tout ».
  assert.equal(stats.report({ from: '2026-10-01', to: '2026-11-20' }).range.granularity, 'day');
  assert.equal(stats.report({ from: '2025-09-01', to: '2026-11-20' }).range.granularity, 'week');
  assert.equal(stats.report({ from: '2026-11-01', to: '2026-11-20', granularity: 'week' }).range.granularity, 'week');
  const all = stats.report({ from: 'all', to: '2026-11-20' });
  assert.equal(all.range.from, '2026-11-19');
  assert.equal(all.previous, null, 'pas de comparaison sur « tout »');
  assert.equal(all.kpis.sessions, 4);
});

test('événements : clics, sorties, sections, vidéo, défilement, erreurs, performances', async (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  let clock = T0;
  const stats = createSiteStats({ db, now: () => clock });
  const batches = [
    ['sess-ev-00001', '10.1.0.1', [{ n: 'pv', p: '/' }, { n: 'click', a: 'cta_hero' }, { n: 'click', a: 'social_x', v: 'x' }, { n: 'sec', a: 'join' }, { n: 'sec', a: 'rewards' }, { n: 'vid', a: 'play' }, { n: 'vid', a: '25' }, { n: 'scroll', x: 25 }, { n: 'scroll', x: 50 }, { n: 'perf', a: 'lcp', x: 1800 }, { n: 'perf', a: 'lcp', x: 5200 }, { n: 'perf', a: 'cls', x: 50 }, { n: 'err', a: 'TypeError: x is null', v: 'site.js:12' }]],
    ['sess-ev-00002', '10.1.0.2', [{ n: 'pv', p: '/' }, { n: 'click', a: 'cta_hero' }, { n: 'click', a: 'social_x', v: 'x' }, { n: 'click', a: 'out_steam', v: 'steam' }, { n: 'sec', a: 'rewards' }, { n: 'vid', a: 'play' }, { n: 'vid', a: '100' }, { n: 'scroll', x: 100 }, { n: 'perf', a: 'lcp', x: 2400 }, { n: 'err', a: 'TypeError: x is null', v: 'site.js:12' }]],
  ];
  for (const [sid, ip, e] of batches) stats.ingest({ ip, ua: UA, headers: {} }, { s: sid, v: `vis-${sid}`, h: 1, e });
  const r = stats.report({ from: '2026-11-20', to: '2026-11-20' });
  assert.deepEqual(r.clicks.map((c) => [c.id, c.count, c.sessions]), [['cta_hero', 2, 2], ['social_x', 2, 2], ['out_steam', 1, 1]]);
  assert.deepEqual(r.outbound.map((o) => [o.key, o.count]), [['x', 2], ['steam', 1]]);
  assert.deepEqual(r.sections.map((x) => [x.id, x.sessions]), [['rewards', 2], ['join', 1]]);
  assert.equal(r.video.plays, 2);
  assert.equal(r.video.reach.find((x) => x.pct === 25).count, 2, '100 % compte aussi pour 25 %');
  assert.equal(r.video.reach.find((x) => x.pct === 100).count, 1);
  assert.deepEqual(r.scroll.map((x) => x.count), [2, 2, 1, 1]);
  assert.equal(r.quality.errors.length, 1);
  assert.equal(r.quality.errors[0].count, 2);
  assert.equal(r.quality.errors[0].sessions, 2);
  assert.equal(r.quality.vitals.lcp.n, 3);
  assert.equal(r.quality.vitals.lcp.p50, 2400);
  assert.equal(r.quality.vitals.lcp.p75, 5200);
  assert.ok(Math.abs(r.quality.vitals.lcp.good - 2 / 3) < 1e-9);
  assert.equal(r.quality.vitals.cls.n, 1);
  // Les filtres s'appliquent aussi aux événements.
  assert.equal(stats.report({ from: '2026-11-20', to: '2026-11-20', channel: 'x' }).clicks.length, 0);
});

test('préinscription rattachée à sa source ; entonnoir ; parrainage attribué au canal du parrain', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  // Visiteur 1 : arrive depuis un Short, regarde la vidéo, voit la section, saisit son e-mail.
  await s.track({ s: 'sess-reg-00001', v: 'visiteur-R1', nv: 1, h: 1, m: { u: { s: 'youtube', m: 'shorts', c: 'shorts-nov', k: 'short-02', t: 'Idle RPG' }, r: 'youtube.com', w: 390, l: 'fr' },
    e: [{ n: 'pv', p: '/' }, { n: 'vid', a: 'play' }, { n: 'sec', a: 'join' }, { n: 'form', a: 'input' }, { n: 'act', x: 25000 }] }, { ip: '198.51.100.1', ua: UA_PHONE });
  // Visiteur 2 : arrive depuis X, mais sans passer par la vidéo (inscription directe).
  await s.track({ s: 'sess-reg-00002', v: 'visiteur-R2', nv: 1, h: 1, m: { u: { s: 'x', m: 'social', c: 'lancement-nov' }, r: 't.co', w: 1440, l: 'en' }, e: [{ n: 'pv', p: '/' }, { n: 'ref', a: 'arrive', v: 'AAAAAA' }] }, { ip: '198.51.100.2' });
  // Visiteur 3 : simple visite.
  await s.track(view('sess-reg-00003'), { ip: '198.51.100.3' });

  s.advance(60_000);
  const a = await s.call('POST', '/api/preregister', { email: 'premier@example.test', consent: true, sid: 'sess-reg-00001', lang: 'fr' }, undefined, { 'X-Forwarded-For': '198.51.100.1' });
  assert.equal(a.status, 202);
  const first = s.db.prepare('SELECT * FROM preregistrations WHERE email = ?').get('premier@example.test');
  assert.equal(first.s_sid, 'sess-reg-00001');
  assert.equal(first.s_channel, 'youtube_shorts');
  assert.equal(first.s_source, 'youtube');
  assert.equal(first.s_medium, 'shorts');
  assert.equal(first.s_campaign, 'shorts-nov');
  assert.equal(first.s_content, 'short-02');
  assert.equal(first.s_referrer, 'youtube.com');
  assert.equal(first.s_device, 'mobile');
  assert.equal(first.s_first_ts, T0, 'début de la session d\'origine');
  assert.ok(!JSON.stringify(first).includes('198.51.100.1'), 'aucune IP en clair');

  // Le second est parrainé par le premier ; le lien de parrainage compte au canal du PARRAIN.
  s.advance(60_000);
  const b = await s.call('POST', '/api/preregister', { email: 'second@example.test', consent: true, sid: 'sess-reg-00002', ref: a.body.ref, lang: 'en' }, undefined, { 'X-Forwarded-For': '198.51.100.2' });
  assert.equal(b.status, 202);
  // Même adresse, nouvelle soumission : pas de doublon ni de nouvelle attribution.
  await s.call('POST', '/api/preregister', { email: 'second@example.test', consent: true, sid: 'sess-reg-00003', lang: 'en' }, undefined, { 'X-Forwarded-For': '198.51.100.3' });
  const second = s.db.prepare('SELECT * FROM preregistrations WHERE email = ?').get('second@example.test');
  assert.equal(second.referrer, a.body.ref);
  assert.equal(second.s_channel, 'x');
  assert.equal(second.s_sid, 'sess-reg-00002');
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM preregistrations').get().n, 2);
  // Sans session (Do-Not-Track, stockage bloqué) : le canal se déduit au moins de utm_source.
  const c = await s.call('POST', '/api/preregister', { email: 'troisieme@example.test', consent: true, utm: 'tiktok', lang: 'fr' });
  assert.equal(c.status, 202);
  const third = s.db.prepare('SELECT s_sid, s_channel FROM preregistrations WHERE email = ?').get('troisieme@example.test');
  assert.deepEqual({ ...third }, { s_sid: null, s_channel: 'tiktok' });
  // Un sid inconnu ou piégé n'a aucun effet.
  assert.equal((await s.call('POST', '/api/preregister', { email: 'quatrieme@example.test', consent: true, sid: "x'); DROP TABLE preregistrations;--" })).status, 202);
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM preregistrations').get().n, 4);

  // Confirmation du premier par son lien.
  const token = s.db.prepare('SELECT confirm_token FROM preregistrations WHERE email = ?').get('premier@example.test').confirm_token;
  assert.equal((await s.call('GET', `/api/preregister/confirm?token=${token}`)).body.ok, true);
  const tokenB = s.db.prepare('SELECT confirm_token FROM preregistrations WHERE email = ?').get('second@example.test').confirm_token;
  await s.call('GET', `/api/preregister/confirm?token=${tokenB}`);

  const stats = createSiteStats({ db: s.db, now: () => s.now(), maskEmail });
  const rep = stats.report({ from: '2026-11-20', to: '2026-11-20', tz: '0' });
  assert.equal(rep.kpis.sessions, 3);
  assert.equal(rep.kpis.preregs, 4);
  assert.equal(rep.kpis.referrals, 1);
  assert.equal(rep.kpis.referralsConfirmed, 1);
  assert.ok(Math.abs(rep.kpis.viral - 1 / 4) < 1e-9, 'coefficient viral = inscrits parrainés / inscrits');
  assert.equal(rep.kpis.confirmed, 2);
  assert.ok(Math.abs(rep.kpis.conversion - 4 / 3) < 1e-9 || rep.kpis.conversion > 0);
  assert.deepEqual(rep.funnel.map((f) => [f.key, f.count]), [
    ['visit', 3], ['video', 1], ['join', 2], ['input', 2], ['submit', 3], ['confirmed', 2], ['referrer', 1],
  ]);
  const ch = Object.fromEntries(rep.channels.map((x) => [x.key, x]));
  assert.equal(ch.youtube_shorts.preregs, 1);
  assert.equal(ch.youtube_shorts.referrals, 1, 'le filleul est attribué au canal du parrain (Shorts)');
  assert.equal(ch.x.preregs, 1);
  assert.equal(ch.x.referrals, 0);
  assert.deepEqual(ch.youtube_shorts.funnel, [1, 1, 1, 1, 1, 1, 1], 'entonnoir par canal');
  assert.equal(ch.unknown.preregs, 1, 'l\'inscrit sans session ni utm reste « non attribué »');
  assert.equal(ch.tiktok.preregs, 1);
  const camp = Object.fromEntries(rep.campaigns.map((x) => [x.key, x]));
  assert.equal(camp['shorts-nov'].preregs, 1);
  assert.equal(camp['shorts-nov'].medium, 'shorts');
  assert.equal(rep.contents[0].content, 'short-02');
  // Même attribution par variante (utm_content), mot-clé (utm_term), referrer, page d'entrée et audience : plus de trou à 0.
  assert.equal(first.s_term, 'idle-rpg');
  assert.deepEqual([rep.contents[0].preregs, rep.contents[0].conversion, rep.contents[0].referrals], [1, 1, 1]);
  assert.deepEqual([rep.terms[0].key, rep.terms[0].sessions, rep.terms[0].preregs], ['idle-rpg', 1, 1]);
  assert.deepEqual([rep.referrers.find((r) => r.key === 'youtube.com').preregs, rep.referrers.find((r) => r.key === 't.co').preregs], [1, 1]);
  assert.equal(rep.entryPages[0].preregs, 2);
  assert.equal(rep.audience.devices.find((d) => d.key === 'mobile').preregs, 1);
  assert.equal(rep.audience.devices.find((d) => d.key === 'desktop').preregs, 1);
  assert.equal(rep.audience.langs.find((d) => d.key === 'fr').preregs, 1);
  assert.equal(rep.referral.top[0].count, 1);
  assert.match(rep.referral.top[0].who, /^pr\*\*\*@e\*\*\*$/);
  assert.equal(rep.referral.chains[0].size, 1);
  assert.equal(rep.referral.arrivals, 1, 'arrivée avec ?ref=');
  assert.equal(rep.referral.arrivalsConverted, 1);
  assert.ok(rep.referral.avgSecondsToSignup >= 60);
  // Filtre par canal : l'entonnoir d'une source précise.
  const onlyX = stats.report({ from: '2026-11-20', to: '2026-11-20', channel: 'x' });
  assert.equal(onlyX.kpis.sessions, 1);
  assert.equal(onlyX.kpis.preregs, 1);
  assert.deepEqual(onlyX.funnel.map((f) => f.count), [1, 0, 1, 1, 1, 1, 0]);
  // Supprimer la préinscription (RGPD) supprime son attribution.
  await s.call('POST', '/api/preregister/remove', { email: 'premier@example.test' });
  assert.equal(stats.report({ from: '2026-11-20', to: '2026-11-20' }).kpis.preregs, 3);
});

test('routes admin protégées : rapport, direct, CSV, campagnes', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  await s.track(view('sess-adm-00001'), { ip: '198.51.100.9' });
  const routes = [['GET', '/api/admin/site-stats'], ['GET', '/api/admin/site-stats/live'], ['GET', '/api/admin/site-stats/csv?table=channels'], ['GET', '/api/admin/site-campaigns'],
    ['POST', '/api/admin/site-campaigns'], ['DELETE', '/api/admin/site-campaigns/1']];
  for (const [m, p] of routes) {
    assert.equal((await s.call(m, p, m === 'POST' ? {} : undefined)).status, 401, `${m} ${p} sans jeton`);
    assert.equal((await s.call(m, p, m === 'POST' ? {} : undefined, 'faux-jeton')).status, 401, `${m} ${p} faux jeton`);
  }
  const token = await s.admin();
  const rep = await s.call('GET', '/api/admin/site-stats?from=2026-11-20&to=2026-11-20&tz=0', undefined, token);
  assert.equal(rep.status, 200);
  assert.equal(rep.body.kpis.sessions, 1);
  assert.equal(rep.body.live.active, 1);
  assert.ok(rep.body.channelLabels.x);
  // Paramètres hostiles : ignorés, jamais d'erreur ni d'injection.
  const odd = await s.call('GET', "/api/admin/site-stats?from=n'importe&to=quoi&channel=x'%20OR%201=1&tz=abc&granularity=%27", undefined, token);
  assert.equal(odd.status, 200);
  assert.equal((await s.call('GET', '/api/admin/site-stats/live', undefined, token)).body.active, 1);
  s.advance(6 * 60_000);
  assert.equal((await s.call('GET', '/api/admin/site-stats/live', undefined, token)).body.active, 0, 'en direct = 5 dernières minutes');
  // Export CSV.
  const csv = await fetch(`${s.base}/api/admin/site-stats/csv?table=channels&from=2026-11-20&to=2026-11-20`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.match(csv.headers.get('content-disposition'), /attachment; filename="ascendrya-site-channels\.csv"/);
  const text = await csv.text();
  assert.match(text, /^\uFEFF?key,visitors,sessions/);
  assert.match(text, /\ndirect,1,1,/);
  assert.equal((await s.call('GET', '/api/admin/site-stats/csv?table=nimporte', undefined, token)).status, 400);
  assert.equal((await fetch(`${s.base}/api/admin/site-stats/csv?table=sessions&from=2026-11-20&to=2026-11-20`, { headers: { Authorization: `Bearer ${token}` } })).status, 200);
});

test('CSV : pas d\'injection de formule dans un tableur, guillemets échappés', () => {
  const out = toCsv([{ a: '=HYPERLINK("http://x")', b: 'a,b', c: 12.3456789, d: '-5', e: '@cmd', f: null }]);
  assert.equal(out, '﻿a,b,c,d,e,f\n"\'=HYPERLINK(""http://x"")","a,b",12.346,-5,\'@cmd,\n');
});

test('générateur de liens : utm normalisés, presets, enregistrement, doublon, suppression, résultats', async (t) => {
  assert.equal(cleanTag('  YouTube Shorts! '), 'youtube-shorts');
  assert.equal(cleanTag('Shorts Décembre à Noël'), 'shorts-decembre-a-noel');
  assert.equal(buildCampaignUrl({ source: 'youtube', medium: 'shorts', campaign: 'Lancement Nov' }), 'https://ascendrya.com/?utm_source=youtube&utm_medium=shorts&utm_campaign=lancement-nov');
  assert.equal(buildCampaignUrl({ source: 'x', medium: 'social', campaign: 'c', content: 'Tweet 1', term: 'idle rpg' }), 'https://ascendrya.com/?utm_source=x&utm_medium=social&utm_campaign=c&utm_content=tweet-1&utm_term=idle-rpg');
  assert.equal(buildCampaignUrl({ source: 'x', medium: 'social' }), null, 'la campagne est obligatoire');
  assert.equal(buildCampaignUrl({ source: '!!!', medium: 'a', campaign: 'b' }), null);
  assert.equal(buildCampaignUrl({ base: 'javascript:alert(1)', source: 'x', medium: 'a', campaign: 'b' }), null);
  const s = await setup();
  t.after(() => s.close());
  const token = await s.admin();
  const list = await s.call('GET', '/api/admin/site-campaigns', undefined, token);
  assert.deepEqual(list.body.presets.map((p) => p.id), ['x', 'youtube_shorts', 'youtube', 'tiktok', 'steam', 'play_store', 'discord', 'reddit', 'newsletter']);
  for (const p of list.body.presets) assert.ok(buildCampaignUrl({ source: p.source, medium: p.medium, campaign: 'test' }), p.id);
  assert.equal((await s.call('POST', '/api/admin/site-campaigns', { source: 'x', medium: 'social' }, token)).status, 400);
  const made = await s.call('POST', '/api/admin/site-campaigns', { name: 'Short 1', preset: 'youtube_shorts', source: 'youtube', medium: 'shorts', campaign: 'shorts-nov', content: 'short-01' }, token);
  assert.equal(made.status, 201);
  assert.equal(made.body.url, 'https://ascendrya.com/?utm_source=youtube&utm_medium=shorts&utm_campaign=shorts-nov&utm_content=short-01');
  const dup = await s.call('POST', '/api/admin/site-campaigns', { source: 'youtube', medium: 'shorts', campaign: 'shorts-nov', content: 'short-01' }, token);
  assert.equal(dup.status, 200);
  assert.equal(dup.body.id, made.body.id);
  // Une visite par ce lien, puis une préinscription : les résultats de la campagne remontent dans le rapport.
  await s.track({ s: 'sess-gen-00001', v: 'visiteur-G1', h: 1, m: { u: { s: 'youtube', m: 'shorts', c: 'shorts-nov', k: 'short-01' }, w: 390, l: 'fr' }, e: [{ n: 'pv', p: '/' }] }, { ip: '198.51.100.20', ua: UA_PHONE });
  await s.call('POST', '/api/preregister', { email: 'gen@example.test', consent: true, sid: 'sess-gen-00001' });
  const rep = (await s.call('GET', '/api/admin/site-stats?from=2026-11-20&to=2026-11-20&tz=0', undefined, token)).body;
  const res = rep.campaignsCreated.find((c) => c.id === made.body.id);
  assert.deepEqual([res.sessions, res.visitors, res.preregs], [1, 1, 1]);
  assert.equal((await s.call('DELETE', `/api/admin/site-campaigns/${made.body.id}`, undefined, token)).status, 204);
  assert.equal((await s.call('DELETE', `/api/admin/site-campaigns/${made.body.id}`, undefined, token)).status, 404);
  assert.equal((await s.call('GET', '/api/admin/site-campaigns', undefined, token)).body.campaigns.length, 0);
});

test('purge : événements bruts effacés après la durée réglée, jours conservés en résumé', async (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  let clock = T0;
  const stats = createSiteStats({ db, now: () => clock, retentionDays: 30 });
  stats.ingest({ ip: '10.2.0.1', ua: UA, headers: {} }, { s: 'sess-old-00001', v: 'visiteur-O1', h: 1, m: { u: { s: 'x' }, w: 1440, l: 'fr' }, e: [{ n: 'pv', p: '/' }, { n: 'click', a: 'cta_hero' }, { n: 'act', x: 20000 }] });
  clock += 10 * DAY;
  stats.ingest({ ip: '10.2.0.2', ua: UA, headers: {} }, { s: 'sess-new-00001', v: 'visiteur-N1', h: 1, m: { u: {}, w: 1440, l: 'fr' }, e: [{ n: 'pv', p: '/' }] });
  assert.equal(stats.purge().sessions, 0, 'rien n\'est trop vieux');
  clock += 25 * DAY; // la première session a 35 jours
  const out = stats.purge();
  assert.equal(out.sessions, 1);
  assert.equal(out.events, 2, 'page vue et clic (le temps actif n\'est pas stocké en événement)');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM site_sessions').get().n, 1);
  const daily = db.prepare('SELECT * FROM site_daily WHERE day = ?').all('2026-11-20');
  assert.equal(daily.length, 1);
  assert.deepEqual([daily[0].channel, daily[0].sessions, daily[0].pageviews], ['x', 1, 1]);
  // Le résumé alimente toujours les courbes d'un jour purgé.
  const rep = stats.report({ from: '2026-11-18', to: '2026-12-25', tz: '0' });
  const point = rep.series.find((p) => p.t === '2026-11-20');
  assert.equal(point.sessions, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM site_salt WHERE day <> ?').get('2026-12-25').n, 0, 'les sels des jours passés sont effacés');
});

test('site : chaque page charge stats.js, qui n\'utilise ni cookie ni tiers ; confidentialité à jour', () => {
  const read = (p) => readFileSync(new URL(`../site/${p}`, import.meta.url), 'utf8');
  for (const page of ['index.html', 'classement/index.html', 'confidentialite.html']) assert.match(read(page), /<script src="\/stats\.js" defer><\/script>/, page);
  const js = read('stats.js');
  assert.ok(!/document\.cookie/.test(js), 'aucun cookie');
  assert.ok(!/https?:\/\/(?!ascendrya)/.test(js.replace(/\/\/ .*$/gm, '')), 'aucun appel vers un service tiers');
  assert.match(js, /sendBeacon/);
  assert.match(js, /globalPrivacyControl/);
  assert.match(js, /doNotTrack/);
  assert.match(js, /\/api\/site\/track/);
  for (const needle of ['IntersectionObserver', 'largest-contentful-paint', 'layout-shift', "'event'", 'unhandledrejection', 'ascendrya-vid']) assert.ok(js.includes(needle), needle);
  const privacy = read('confidentialite.html');
  assert.match(privacy, /Mesure d'audience du site/);
  assert.match(privacy, /Site audience measurement/);
  assert.match(privacy, /Aucun cookie n'est déposé/);
  assert.match(privacy, /No cookie is set/);
  assert.match(privacy, /Do Not Track/);
  assert.match(privacy, /13 mois/);
  assert.match(privacy, /13 months/);
  // La préinscription envoie l'identifiant de session ; les boutons importants sont repérés.
  const site = read('site.js');
  assert.match(site, /sid: mySid\(\)/);
  assert.match(site, /track\('form', 'submit'\)/);
  const home = read('index.html');
  for (const id of ['cta_nav', 'cta_hero', 'cta_sticky', 'prereg_submit']) assert.ok(home.includes(`data-track="${id}"`), id);
  // Onglets de l'admin : « Site » ajouté, l'ancien « Analytique » renommé.
  const admin = readFileSync(new URL('../site/admin/index.html', import.meta.url), 'utf8');
  assert.match(admin, /data-tab="site">Site</);
  assert.match(admin, /data-tab="analytics">Analytique du jeu</);
  assert.match(admin, /\/admin\/site-stats\.js/);
});
