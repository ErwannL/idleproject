import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, hashPassword, LIMITS } from '../server/app.mjs';
import { openDatabase } from '../server/db.mjs';

async function setup(extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'idle-srv-'));
  const siteDir = join(dir, 'site');
  const webDir = join(dir, 'web');
  mkdirSync(siteDir);
  mkdirSync(webDir);
  writeFileSync(join(siteDir, 'index.html'), '<!doctype html><p>accueil</p>');
  writeFileSync(join(webDir, 'index.html'), '<!doctype html><p>jeu</p>');
  const db = openDatabase(':memory:');
  let clock = Date.UTC(2026, 9, 31, 12);
  const app = createApp({ db, siteDir, webDir, now: () => clock, ...extra });
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    db,
    advance: (ms) => { clock += ms; },
    close: async () => {
      server.close();
      await once(server, 'close').catch(() => {});
      db.close();
    },
    url: () => `http://127.0.0.1:${server.address().port}`,
  };
}

async function call(base, method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

test('inscription, connexion et refus du mauvais mot de passe', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const base = s.url();
  const reg = await call(base, 'POST', '/api/register', { pseudo: 'Ayla_01', password: 'motdepasse1' });
  assert.equal(reg.status, 201);
  assert.ok(reg.body.token);
  const dup = await call(base, 'POST', '/api/register', { pseudo: 'ayla_01', password: 'autremdp12' });
  assert.equal(dup.status, 409, 'pseudo insensible à la casse');
  const bad = await call(base, 'POST', '/api/login', { pseudo: 'Ayla_01', password: 'mauvais-mdp' });
  assert.equal(bad.status, 401);
  const ok = await call(base, 'POST', '/api/login', { pseudo: 'AYLA_01', password: 'motdepasse1' });
  assert.equal(ok.status, 200);
  assert.notEqual(ok.body.token, reg.body.token);
});

test('pseudo et mot de passe validés', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const base = s.url();
  assert.equal((await call(base, 'POST', '/api/register', { pseudo: 'a b', password: 'motdepasse1' })).status, 400);
  assert.equal((await call(base, 'POST', '/api/register', { pseudo: 'ok_name', password: 'court' })).status, 400);
});

test('sauvegarde : push versionné, refus 409 si périmée, pull', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const base = s.url();
  const { token } = (await call(base, 'POST', '/api/register', { pseudo: 'joueur', password: 'motdepasse1' })).body;
  assert.equal((await call(base, 'GET', '/api/save', undefined, token)).body.data, null);

  const save1 = JSON.stringify({ lastSaved: 1, gold: 10 });
  const put1 = await call(base, 'PUT', '/api/save', { version: 0, data: save1 }, token);
  assert.equal(put1.status, 200);
  assert.equal(put1.body.version, 1);

  const stale = await call(base, 'PUT', '/api/save', { version: 0, data: JSON.stringify({ gold: 99 }) }, token);
  assert.equal(stale.status, 409);
  assert.equal(stale.body.version, 1);

  const pulled = await call(base, 'GET', '/api/save', undefined, token);
  assert.equal(pulled.body.data, save1);
  assert.equal(pulled.body.version, 1);
});

test('sauvegarde refusée sans jeton ou avec du JSON invalide', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const base = s.url();
  const { token } = (await call(base, 'POST', '/api/register', { pseudo: 'joueur', password: 'motdepasse1' })).body;
  assert.equal((await call(base, 'GET', '/api/save')).status, 401);
  assert.equal((await call(base, 'GET', '/api/save', undefined, 'faux-jeton')).status, 401);
  const broken = await call(base, 'PUT', '/api/save', { version: 0, data: '{pas du json' }, token);
  assert.equal(broken.status, 400);
});

test('taille maximale de sauvegarde', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const base = s.url();
  const { token } = (await call(base, 'POST', '/api/register', { pseudo: 'joueur', password: 'motdepasse1' })).body;
  const huge = JSON.stringify({ blob: 'x'.repeat(LIMITS.saveBody) });
  const res = await call(base, 'PUT', '/api/save', { version: 0, data: huge }, token);
  assert.equal(res.status, 413);
});

test('déconnexion invalide le jeton', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const base = s.url();
  const { token } = (await call(base, 'POST', '/api/register', { pseudo: 'joueur', password: 'motdepasse1' })).body;
  assert.equal((await call(base, 'POST', '/api/logout', undefined, token)).status, 204);
  assert.equal((await call(base, 'GET', '/api/save', undefined, token)).status, 401);
});

test('session expirée après 30 jours', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const base = s.url();
  const { token } = (await call(base, 'POST', '/api/register', { pseudo: 'joueur', password: 'motdepasse1' })).body;
  s.advance(LIMITS.sessionMs + 1);
  assert.equal((await call(base, 'GET', '/api/save', undefined, token)).status, 401);
});

test('limitation des tentatives de connexion', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const base = s.url();
  await call(base, 'POST', '/api/register', { pseudo: 'joueur', password: 'motdepasse1' });
  let last;
  for (let i = 0; i <= LIMITS.authAttempts.max; i += 1) {
    last = await call(base, 'POST', '/api/login', { pseudo: 'joueur', password: 'mauvais-mdp' });
  }
  assert.equal(last.status, 429);
});

test('suppression de compte : données effacées, mot de passe requis', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const base = s.url();
  const { token } = (await call(base, 'POST', '/api/register', { pseudo: 'joueur', password: 'motdepasse1' })).body;
  await call(base, 'PUT', '/api/save', { version: 0, data: '{"gold":1}' }, token);

  assert.equal((await call(base, 'DELETE', '/api/account', { password: 'faux-mdp' }, token)).status, 401);
  assert.equal((await call(base, 'DELETE', '/api/account', { password: 'motdepasse1' }, token)).status, 204);

  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n, 0);
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM saves').get().n, 0);
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
  assert.equal((await call(base, 'POST', '/api/login', { pseudo: 'joueur', password: 'motdepasse1' })).status, 401);
});

test('préinscription : consentement obligatoire, email normalisé, réponse identique', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const base = s.url();
  assert.equal((await call(base, 'POST', '/api/preregister', { email: 'a@b.fr', consent: false })).status, 400);
  assert.equal((await call(base, 'POST', '/api/preregister', { email: 'pas-un-email', consent: true })).status, 400);
  const res = await call(base, 'POST', '/api/preregister', { email: ' Ami@Exemple.FR ', consent: true });
  assert.equal(res.status, 202);
  const row = s.db.prepare('SELECT email, consent_version FROM preregistrations').get();
  assert.equal(row.email, 'ami@exemple.fr');
  assert.ok(row.consent_version);
  await call(base, 'POST', '/api/preregister', { email: 'ami@exemple.fr', consent: true });
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM preregistrations').get().n, 1);
});

test('retrait de la liste de préinscription', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const base = s.url();
  await call(base, 'POST', '/api/preregister', { email: 'ami@exemple.fr', consent: true });
  assert.equal((await call(base, 'POST', '/api/preregister/remove', { email: 'AMI@exemple.fr' })).status, 202);
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM preregistrations').get().n, 0);
});

test('fichiers statiques : site, /play, pas de traversée de dossier', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const base = s.url();
  const home = await fetch(base + '/');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /accueil/);
  assert.match(await (await fetch(base + '/play/')).text(), /jeu/);
  assert.equal((await fetch(base + '/play/..%2F..%2Fetc%2Fpasswd')).status, 403);
  assert.equal((await fetch(base + '/api/inconnue')).status, 404);
});

test('admin : stats, liste joueurs, suppression, export CSV', async (t) => {
  const s = await setup({ adminPasswordHash: await hashPassword('mot-de-passe-admin') });
  t.after(() => s.close());
  const base = s.url();
  const { token } = (await call(base, 'POST', '/api/register', { pseudo: 'Alice', password: 'motdepasse1' })).body;
  await call(base, 'PUT', '/api/save', { version: 0, data: JSON.stringify({ level: 12, maxStage: 30, gold: 500, gems: 3, records: { bossesDefeated: 2 } }) }, token);
  await call(base, 'POST', '/api/preregister', { email: 'ami@exemple.fr', consent: true });

  assert.equal((await call(base, 'GET', '/api/admin/stats')).status, 401);
  const bad = await call(base, 'POST', '/api/admin/login', { password: 'nope-nope-nope' });
  assert.equal(bad.status, 401);
  const admin = (await call(base, 'POST', '/api/admin/login', { password: 'mot-de-passe-admin' })).body.token;
  const h = (path, method = 'GET', body) => call(base, method, path, body, admin);

  const stats = (await h('/api/admin/stats')).body;
  assert.equal(stats.accounts, 1);
  assert.equal(stats.withSave, 1);
  assert.equal(stats.maxLevel, 12);
  assert.equal(stats.preregistrations, 1);

  const list = (await h('/api/admin/players?sort=level')).body;
  assert.equal(list.total, 1);
  assert.equal(list.players[0].pseudo, 'Alice');
  assert.equal(list.players[0].level, 12);
  assert.equal(list.players[0].bossesDefeated, 2);
  const id = list.players[0].id;
  assert.equal((await h(`/api/admin/players/${id}`)).body.progress.heroes, 0);

  const csv = await fetch(`${base}/api/admin/preregistrations.csv`, { headers: { Authorization: `Bearer ${admin}` } });
  assert.match(await csv.text(), /ami@exemple\.fr/);

  assert.equal((await h(`/api/admin/players/${id}`, 'DELETE')).status, 204);
  assert.equal((await h('/api/admin/players')).body.total, 0);
  assert.equal((await call(base, 'GET', '/api/preregister/count')).body.count, 1);
});

test('admin désactivé sans hash configuré', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  assert.equal((await call(s.url(), 'POST', '/api/admin/login', { password: 'x' })).status, 404);
});
