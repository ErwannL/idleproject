// Vidéo d'accueil du site : modes (une / deux vidéos), analyse + conseils, état par variante, version d'URL, sécurité.
// ffprobe / ffmpeg sont simulés : le test ne dépend pas de leur présence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, hashPassword } from '../server/app.mjs';
import { openDatabase } from '../server/db.mjs';
import { ADVICE_LIMITS, phoneIsStale, resolveVideo, summarizeProbe, versionedUrl, videoAdvice, videoVersion } from '../server/video.mjs';

const MB = 1048576;
// Faux fichiers : signature MP4/WebM + marqueurs lus par la fausse sonde (DUR durée, H hauteur, AUD son, HEVC codec).
const mp4 = (marks = '') => Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from(`ftypisom ${marks}`), Buffer.alloc(32)]);
const webm = (marks = '') => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from(` ${marks}`), Buffer.alloc(32)]);
const png = Buffer.concat([Buffer.from([0x89]), Buffer.from('PNG\r\n\x1a\n'), Buffer.alloc(32)]);

function fakeProbeData(buf, size) {
  const t = buf.toString('latin1');
  const num = (k, d) => Number((new RegExp(`${k}=(\\d+)`).exec(t) ?? [])[1] ?? d);
  const h = num('H', 1080);
  const streams = [{ codec_type: 'video', codec_name: /HEVC/.test(t) ? 'hevc' : 'h264', width: Math.round(h * 16 / 9), height: h, avg_frame_rate: '30/1' }];
  if (/AUD/.test(t)) streams.push({ codec_type: 'audio', codec_name: 'aac' });
  return { streams, format: { duration: String(num('DUR', 20)), size: String(size), format_name: 'mov,mp4', bit_rate: String(num('BR', 2_000_000)) } };
}

async function setup({ videoMaxBytes, ffprobe = true, ffmpeg = true, siteFiles = null } = {}) {
  const uploadsDir = mkdtempSync(join(tmpdir(), 'sv-up-'));
  let siteDir = '';
  if (siteFiles) {
    siteDir = mkdtempSync(join(tmpdir(), 'sv-site-'));
    mkdirSync(join(siteDir, 'assets'));
    for (const [name, buf] of Object.entries(siteFiles)) writeFileSync(join(siteDir, 'assets', name), buf);
  }
  const runs = [];
  const tools = {
    has: async () => ({ ffmpeg, ffprobe }),
    probe: async (file) => {
      if (!ffprobe) return { available: false, data: null };
      const buf = readFileSync(file);
      return { available: true, data: fakeProbeData(buf, buf.length) };
    },
    run: async (args) => {
      runs.push(args);
      if (!ffmpeg) return false;
      const out = args.at(-1);
      writeFileSync(out, out.endsWith('.jpg') ? Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]) : mp4('DUR=20 H=540'));
      return true;
    },
  };
  const db = openDatabase(':memory:');
  const app = createApp({ db, siteDir, webDir: '', uploadsDir, videoMaxBytes, tools, adminPasswordHash: await hashPassword('motdepasse-admin-1') });
  const server = createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = (await (await fetch(`${base}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'erwann', password: 'motdepasse-admin-1' }) })).json()).token;
  const auth = { Authorization: `Bearer ${token}` };
  const up = (kind, body, headers = {}) => fetch(`${base}/api/admin/video`, { method: 'POST', headers: { ...auth, 'X-Kind': kind, ...headers }, body });
  const json = (method, path, body) => fetch(`${base}${path}`, { method, headers: { ...auth, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const state = async () => (await json('GET', '/api/admin/video')).json();
  const settle = async () => { for (let i = 0; i < 100; i++) { const s = await state(); if (!s.busy.length) return s; await new Promise((r) => setTimeout(r, 20)); } throw new Error('travail jamais fini'); };
  return { base, up, json, state, settle, runs, uploadsDir, db, auth, close: () => { server.close(); db.close(); } };
}
const row = (s, key) => s.variants.find((r) => r.key === key);

test('video : toutes les routes admin exigent la connexion, la lecture publique reste libre', async (t) => {
  const s = await setup(); t.after(s.close);
  const bare = (method, path) => fetch(`${s.base}${path}`, { method, headers: { 'X-Kind': 'video', 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : '{}' });
  for (const [m, p] of [['GET', '/api/admin/video'], ['POST', '/api/admin/video'], ['PUT', '/api/admin/video/mode'], ['POST', '/api/admin/video/rebuild'], ['DELETE', '/api/admin/video/phone'], ['DELETE', '/api/admin/video']]) {
    assert.equal((await bare(m, p)).status, 401, `${m} ${p}`);
  }
  const pub = await (await fetch(`${s.base}/api/site/video`)).json();
  assert.equal(pub.mp4, 'assets/trailer.mp4');
  assert.ok(pub.version);
});

test('video : une seule vidéo -> le serveur fabrique téléphone et aperçu, source « fabriquée »', async (t) => {
  const s = await setup(); t.after(s.close);
  assert.equal((await s.up('video', mp4('DUR=20 H=1080'))).status, 201);
  const st = await s.settle();
  assert.equal(st.mode, 'single');
  assert.match(st.phone, /-phone\.mp4$/);
  assert.match(st.poster, /-poster\.jpg$/);
  assert.equal(row(st, 'mp4').source, 'envoyée');
  assert.equal(row(st, 'phone').source, 'fabriquée');
  assert.equal(row(st, 'poster').source, 'fabriquée');
  assert.equal(row(st, 'webm').source, 'absente');
  assert.equal(st.stale, false);
  assert.equal(row(st, 'mp4').info.height, 1080);
  assert.ok(row(st, 'phone').size > 0);
  const args = s.runs.find((a) => a.includes('scale=-2:540,fps=30'));
  assert.ok(args, 'ffmpeg : 540 p, 30 i/s');
  // Noms fabriqués côté serveur : rien du client ne finit dans le nom du fichier.
  for (const f of readdirSync(`${s.uploadsDir}/video`)) assert.match(f, /^[a-z0-9]+-(site|phone|poster)\.(mp4|jpg)$/);
});

test('video : deux vidéos -> pas de fabrication ; téléphone et PC remplaçables séparément ; retard signalé puis refait', async (t) => {
  const s = await setup(); t.after(s.close);
  assert.equal((await s.json('PUT', '/api/admin/video/mode', { mode: 'dual', posterMode: 'manual' })).status, 200);
  assert.equal((await s.up('video', mp4('DUR=20'))).status, 201);
  assert.equal((await s.up('phone', mp4('DUR=20 H=540'))).status, 201);
  let st = await s.settle();
  assert.equal(s.runs.length, 0, 'aucun ffmpeg en mode deux vidéos');
  assert.equal(row(st, 'phone').source, 'envoyée');
  assert.match(st.phone, /-tel\.mp4$/);
  const pcBefore = st.mp4;
  assert.equal((await s.up('phone', mp4('DUR=20 H=480'))).status, 201);
  st = await s.state();
  assert.equal(st.mp4, pcBefore, 'la vidéo PC n\'a pas bougé');
  assert.equal(row(st, 'phone').info.height, 480);
  // Retard : version téléphone fabriquée, puis nouvelle vidéo PC en mode « deux vidéos ».
  await s.json('PUT', '/api/admin/video/mode', { mode: 'single' });
  await s.json('POST', '/api/admin/video/rebuild', { what: 'phone' });
  st = await s.settle();
  assert.equal(row(st, 'phone').source, 'fabriquée');
  assert.equal(st.stale, false);
  await s.json('PUT', '/api/admin/video/mode', { mode: 'dual' });
  assert.equal((await s.up('mp4', mp4('DUR=33'))).status, 201);
  st = await s.settle();
  assert.equal(st.stale, true, 'téléphone plus ancien que la vidéo PC');
  assert.equal(row(st, 'phone').stale, true);
  assert.match(row(st, 'phone').advice[0].text, /plus ancienne/);
  assert.equal((await s.json('POST', '/api/admin/video/rebuild', { what: 'phone' })).status, 202);
  st = await s.settle();
  assert.equal(st.stale, false);
});

test('video : le cas du bug — téléphone d\'origine resté sur l\'ancienne vidéo, détecté et refait', async (t) => {
  const s = await setup({ siteFiles: { 'trailer.mp4': mp4('DUR=30'), 'trailer.webm': webm('DUR=30'), 'trailer-phone.mp4': mp4('DUR=12 H=540'), 'trailer-poster.webp': Buffer.from('RIFF....WEBPxxxx') } });
  t.after(s.close);
  let st = await s.state();
  assert.equal(st.stale, true, 'durées 30 s / 12 s');
  assert.equal(row(st, 'phone').source, 'défaut du dépôt');
  await s.json('POST', '/api/admin/video/rebuild', { what: 'phone' });
  st = await s.settle();
  assert.equal(st.stale, false);
  assert.equal(row(st, 'phone').source, 'fabriquée');
  assert.equal(row(st, 'mp4').source, 'défaut du dépôt');
  // Revenir à l'origine : plus rien d'envoyé.
  assert.equal((await s.json('DELETE', '/api/admin/video')).status, 200);
  st = await s.state();
  assert.equal(st.phone, 'assets/trailer-phone.mp4');
  assert.deepEqual(readdirSync(`${s.uploadsDir}/video`), []);
});

test('video : limite de taille configurable, 413 clair, aucun fichier temporaire laissé', async (t) => {
  const s = await setup({ videoMaxBytes: 2 * MB }); t.after(s.close);
  const big = Buffer.concat([mp4(), Buffer.alloc(3 * MB)]);
  const res = await s.up('video', big);
  assert.equal(res.status, 413);
  assert.match((await res.json()).error, /trop lourde.*2 Mo au plus/);
  assert.equal((await s.state()).limits.videoMaxMb, 2);
  assert.deepEqual(readdirSync(`${s.uploadsDir}/video`), []);
  assert.equal((await s.up('poster', Buffer.concat([png, Buffer.alloc(4 * MB)]))).status, 413);
  assert.equal((await s.up('video', Buffer.concat([mp4(), Buffer.alloc(MB)]))).status, 201);
});

test('video : type vérifié (signature + type annoncé), genres fermés, rien du client dans les chemins', async (t) => {
  const s = await setup(); t.after(s.close);
  assert.equal((await s.up('video', Buffer.from('<?php echo 1; ?>'))).status, 415);
  assert.equal((await s.up('video', mp4(), { 'Content-Type': 'image/png' })).status, 415, 'type annoncé qui ment');
  assert.equal((await s.up('video', mp4(), { 'Content-Type': 'video/mp4' })).status, 201);
  assert.equal((await s.up('phone', webm())).status, 415, 'téléphone : MP4 seulement');
  assert.equal((await s.up('webm', mp4())).status, 415);
  assert.equal((await s.up('poster', mp4())).status, 415);
  assert.equal((await s.up('../../etc/passwd', mp4())).status, 400);
  assert.equal((await s.up('video', Buffer.alloc(0))).status, 400);
  const bad = await fetch(`${s.base}/api/admin/video/..%2Fx`, { method: 'DELETE', headers: s.auth });
  assert.equal(bad.status, 404);
  assert.equal((await s.json('PUT', '/api/admin/video/mode', { mode: '../x' })).status, 400);
  assert.equal((await s.json('POST', '/api/admin/video/rebuild', { what: 'webm' })).status, 400);
  const st = await s.state();
  assert.match(st.mp4, /^assets\/uploads\/video\/[a-z0-9]+-site\.mp4$/);
});

test('video : aperçu envoyé à la main (gardé au changement de vidéo), supprimé -> refait automatiquement', async (t) => {
  const s = await setup(); t.after(s.close);
  assert.equal((await s.up('poster', png)).status, 201);
  let st = await s.state();
  assert.equal(st.posterMode, 'manual');
  assert.equal(row(st, 'poster').source, 'envoyée');
  const mine = st.poster;
  await s.up('video', mp4());
  st = await s.settle();
  assert.equal(st.poster, mine);
  assert.equal((await s.json('DELETE', '/api/admin/video/poster')).status, 200);
  st = await s.settle();
  assert.equal(st.posterMode, 'auto');
  assert.match(st.poster, /-poster\.jpg$/);
});

test('video : supprimer la dernière vidéo PC envoyée remet tout à l\'origine ; sans ffmpeg, refus clair', async (t) => {
  const s = await setup(); t.after(s.close);
  await s.up('video', mp4()); await s.settle();
  const del = await s.json('DELETE', '/api/admin/video/mp4');
  assert.equal(del.status, 200);
  const st = await del.json();
  assert.equal(st.custom, false);
  assert.equal(st.mp4, 'assets/trailer.mp4');
  assert.deepEqual(readdirSync(`${s.uploadsDir}/video`), []);
  const n = await setup({ ffmpeg: false, ffprobe: false }); t.after(n.close);
  const r = await n.json('POST', '/api/admin/video/rebuild', { what: 'phone' });
  assert.equal(r.status, 503);
  assert.match((await r.json()).error, /ffmpeg/);
  assert.equal((await n.up('video', mp4())).status, 201, 'l\'envoi marche sans outils');
  const ns = await n.settle();
  assert.equal(ns.phone, null);
  assert.equal(row(ns, 'mp4').info.analyzed, false);
  assert.ok(ns.advice.some((a) => /ffmpeg/.test(a.text)));
});

test('version d\'URL : ?v= ajouté ou remplacé, change quand un fichier change', async (t) => {
  assert.equal(versionedUrl('assets/a.mp4', 'k1'), 'assets/a.mp4?v=k1');
  assert.equal(versionedUrl('assets/a.mp4?v=old&x=1', 'k2'), 'assets/a.mp4?x=1&v=k2');
  assert.equal(versionedUrl(null, 'k'), null);
  assert.equal(versionedUrl('a.mp4', ''), 'a.mp4');
  const D = { mp4: 'assets/trailer.mp4', webm: 'assets/trailer.webm', phone: 'assets/trailer-phone.mp4', poster: 'assets/trailer-poster.webp' };
  const u0 = resolveVideo(null, D);
  assert.notEqual(videoVersion(null, u0, { 'assets/trailer-phone.mp4': 1 }), videoVersion(null, u0, { 'assets/trailer-phone.mp4': 2 }), 'le fichier d\'origine change -> version change');
  const s = await setup(); t.after(s.close);
  const v0 = (await (await fetch(`${s.base}/api/site/video`)).json()).version;
  await s.up('video', mp4()); await s.settle();
  const v1 = (await (await fetch(`${s.base}/api/site/video`)).json()).version;
  assert.notEqual(v0, v1);
  assert.match(readFileSync('site/site.js', 'utf8'), /v=\$\{encodeURIComponent\(version\)\}/);
  assert.match(readFileSync('site/site.js', 'utf8'), /phone: reelUrl\(c\.phone, v\)/);
});

test('analyse : résumé ffprobe, sans ffprobe, fichier illisible', () => {
  const info = summarizeProbe({ available: true, data: fakeProbeData(Buffer.from('DUR=45 H=2160 AUD'), 50 * MB) }, 50 * MB);
  assert.deepEqual({ w: info.width, h: info.height, d: info.duration, c: info.codec, a: info.hasAudio, s: info.size }, { w: 3840, h: 2160, d: 45, c: 'h264', a: true, s: 50 * MB });
  assert.equal(summarizeProbe({ available: false, data: null }, 10).analyzed, false);
  assert.equal(summarizeProbe({ available: true, data: null }, 10).reason, 'illisible');
});

test('conseils : lourde, 4K, longue, codec, son, pas de téléphone, ffprobe absent', () => {
  const info = (o) => ({ analyzed: true, width: 1920, height: 1080, duration: 20, size: 5 * MB, bitrate: 2_000_000, codec: 'h264', hasAudio: false, ...o });
  const texts = (i, role, ctx) => videoAdvice(i, role, ctx).map((a) => a.text).join(' | ');
  assert.match(texts(info({ width: 3840, height: 2160 }), 'pc', { hasPhone: false }), /Trop lourde pour le téléphone.*mets une version téléphone \(ou laisse le serveur la faire\)/);
  assert.match(texts(info({ size: 41 * MB }), 'pc', { hasPhone: false }), /Trop lourde/);
  assert.match(texts(info({ bitrate: 9_000_000 }), 'pc', { hasPhone: false }), /Trop lourde/);
  assert.doesNotMatch(texts(info({ size: 41 * MB }), 'pc', { hasPhone: true }), /Trop lourde/);
  assert.match(texts(info({}), 'pc', { hasPhone: false }), /Pas de version téléphone/);
  assert.match(texts(info({ duration: 61 }), 'pc', { hasPhone: true }), /Vidéo longue \(61 s\)/);
  assert.doesNotMatch(texts(info({ duration: ADVICE_LIMITS.longSeconds }), 'pc', { hasPhone: true }), /longue/);
  assert.match(texts(info({ codec: 'hevc' }), 'pc', { hasPhone: true }), /HEVC non lu/);
  assert.doesNotMatch(texts(info({ codec: 'hevc' }), 'pc', { hasPhone: true, webmOk: true }), /HEVC/);
  assert.match(texts(info({ hasAudio: true }), 'pc', { hasPhone: true }), /le son est coupé sur le site/);
  assert.match(texts(info({ height: 1080 }), 'phone', {}), /Version téléphone encore lourde/);
  assert.match(texts(info({ height: 540, size: MB, bitrate: 1_000_000 }), 'phone', {}), /Rien à redire/);
  assert.match(texts({ analyzed: false, reason: 'absent' }, 'pc', {}), /ffprobe n'est pas installé/);
  assert.match(texts({ analyzed: false, reason: 'illisible' }, 'pc', {}), /pas lu comme une vidéo/);
});

test('retard de la version téléphone : seulement si fabriquée depuis une autre vidéo PC, ou défauts incohérents', () => {
  assert.equal(phoneIsStale({ mp4: 'a', phone: 'b', src: { phone: 'fabriquée' }, pcId: 'x', phoneFrom: 'x' }), false);
  assert.equal(phoneIsStale({ mp4: 'a', phone: 'b', src: { phone: 'fabriquée' }, pcId: 'y', phoneFrom: 'x' }), true);
  assert.equal(phoneIsStale({ mp4: 'a', phone: 'b', src: { phone: 'envoyée' }, pcId: 'y' }), false, 'montage vertical voulu');
  assert.equal(phoneIsStale({ mp4: 'a', phone: null }), false);
  assert.equal(phoneIsStale(null, true), true);
  assert.equal(phoneIsStale(null, false), false);
});

test('admin et site : écrans et appels en place', () => {
  const admin = readFileSync('site/admin/index.html', 'utf8');
  for (const id of ['sv-body', 'sv-stale-fix', 'sv-reset', 'sv-progress']) assert.match(admin, new RegExp(`id="${id}"`));
  assert.match(admin, /Une seule vidéo/); assert.match(admin, /Deux vidéos/);
  assert.match(admin, /Refaire depuis la vidéo PC/);
  assert.ok(existsSync('server/video.mjs'));
});
