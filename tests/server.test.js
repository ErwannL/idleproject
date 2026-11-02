import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkSave, createApp, hashPassword, LIMITS, stageLabel, summarizeSave } from '../server/app.mjs';
import { stageLabel as gameStageLabel } from '../src/core/combat.js';
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

  const save1 = JSON.stringify({ lastSaved: 1, gold: 10, level: 1, maxStage: 1 });
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
  const s = await setup({ gameWeb: true });
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
  const bad = await call(base, 'POST', '/api/admin/login', { username: 'erwann', password: 'nope-nope-nope' });
  assert.equal(bad.status, 401);
  const admin = (await call(base, 'POST', '/api/admin/login', { username: 'erwann', password: 'mot-de-passe-admin' })).body.token;
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

test('admin : aucun compte sans bootstrap ; jeu web désactivé par défaut', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  assert.equal((await call(s.url(), 'POST', '/api/admin/login', { username: 'erwann', password: 'x' })).status, 401);
  assert.equal((await fetch(s.url() + '/play/')).status, 404);
});

test('admin : mot de passe temporaire, changement obligatoire au premier login', async (t) => {
  const s = await setup({ adminPasswordHash: await hashPassword('mot-de-passe-admin') });
  t.after(() => s.close());
  const base = s.url();
  const owner = (await call(base, 'POST', '/api/admin/login', { username: 'erwann', password: 'mot-de-passe-admin' })).body.token;
  const created = await call(base, 'POST', '/api/admin/users', { username: 'Pierre' }, owner);
  assert.equal(created.status, 201);
  const temp = created.body.temporaryPassword;
  const login = await call(base, 'POST', '/api/admin/login', { username: 'pierre', password: temp });
  assert.equal(login.status, 200);
  assert.equal(login.body.mustChange, true);
  const pierre = login.body.token;
  assert.equal((await call(base, 'GET', '/api/admin/stats', undefined, pierre)).status, 403);
  assert.equal((await call(base, 'POST', '/api/admin/password', { password: temp, newPassword: 'court' }, pierre)).status, 400);
  assert.equal((await call(base, 'POST', '/api/admin/password', { password: 'faux-temp-xx', newPassword: 'nouveau-mdp-solide' }, pierre)).status, 403);
  assert.equal((await call(base, 'POST', '/api/admin/password', { password: temp, newPassword: 'nouveau-mdp-solide' }, pierre)).status, 204);
  assert.equal((await call(base, 'GET', '/api/admin/stats', undefined, pierre)).status, 200);
  const again = await call(base, 'POST', '/api/admin/login', { username: 'Pierre', password: 'nouveau-mdp-solide' });
  assert.equal(again.body.mustChange, false);
  // Réinitialisation par l'équipe : nouveau temporaire, session coupée.
  const id = (await call(base, 'GET', '/api/admin/users', undefined, owner)).body.users.find((u) => u.username === 'Pierre').id;
  const reset = await call(base, 'POST', `/api/admin/users/${id}/reset`, undefined, owner);
  assert.ok(reset.body.temporaryPassword);
  assert.equal((await call(base, 'GET', '/api/admin/stats', undefined, pierre)).status, 401);
  assert.equal((await call(base, 'POST', '/api/admin/users', { username: 'Pierre' }, owner)).status, 409);
  assert.equal((await call(base, 'DELETE', `/api/admin/users/1`, undefined, owner)).status, 400);
});

test('classement : tri, joueurs masqués, nouvelle partie exclue', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const base = s.url();
  const a = (await call(base, 'POST', '/api/register', { pseudo: 'Top_one', password: 'motdepasse1' })).body.token;
  const b = (await call(base, 'POST', '/api/register', { pseudo: 'Second_2', password: 'motdepasse1' })).body.token;
  const c = (await call(base, 'POST', '/api/register', { pseudo: 'Cache_3', password: 'motdepasse1' })).body.token;
  await call(base, 'POST', '/api/register', { pseudo: 'Neuf_44', password: 'motdepasse1' });
  await call(base, 'PUT', '/api/save', { version: 0, data: JSON.stringify({ level: 9, maxStage: 40, records: { bossesDefeated: 1 } }) }, a);
  await call(base, 'PUT', '/api/save', { version: 0, data: JSON.stringify({ level: 15, maxStage: 20, records: { bossesDefeated: 4 } }) }, b);
  await call(base, 'PUT', '/api/save', { version: 0, data: JSON.stringify({ level: 30, maxStage: 50, records: { bossesDefeated: 9 } }) }, c);
  assert.equal((await call(base, 'PUT', '/api/account/listed', { listed: false }, c)).status, 200);

  const byStage = (await call(base, 'GET', '/api/leaderboard?sort=stage')).body.players;
  assert.deepEqual(byStage.map((p) => p.pseudo), ['Top_one', 'Second_2']);
  assert.equal(byStage[0].rank, 1);
  const byLevel = (await call(base, 'GET', '/api/leaderboard?sort=level')).body.players;
  assert.equal(byLevel[0].pseudo, 'Second_2');
  const byBosses = (await call(base, 'GET', '/api/leaderboard?sort=bosses')).body.players;
  assert.equal(byBosses[0].pseudo, 'Second_2');
  assert.equal((await call(base, 'PUT', '/api/account/listed', { listed: 'oui' }, c)).status, 400);
});

test('classement v9.1.6 : nouvelles stats, invités exclus, mon rang, classement entre amis', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const base = s.url();
  const reg = async (pseudo) => (await call(base, 'POST', '/api/register', { pseudo, password: 'motdepasse1' })).body.token;
  const [a, b, c] = [await reg('Alpha_1'), await reg('Bravo_2'), await reg('Charl_3')];
  const save = (tok, o) => call(base, 'PUT', '/api/save', { version: 0, data: JSON.stringify(o) }, tok);
  await save(a, { level: 5, maxStage: 30, kills: 900, towerBest: 2, playSeconds: 50, records: { rebirths: 0, goldEarned: 1e6, bossesDefeated: 1 } });
  await save(b, { level: 9, maxStage: 20, kills: 100, towerBest: 7, playSeconds: 500, records: { rebirths: 3, goldEarned: 1e9, bossesDefeated: 2 } });
  await save(c, { level: 2, maxStage: 10, kills: 5, playSeconds: 5, records: {} });
  const top = async (sort, tok, scope = 'all') => (await call(base, 'GET', `/api/leaderboard?sort=${sort}&scope=${scope}`, undefined, tok)).body;
  assert.equal((await top('kills')).players[0].pseudo, 'Alpha_1');
  for (const sort of ['gold', 'rebirths', 'tower', 'playtime']) assert.equal((await top(sort)).players[0].pseudo, 'Bravo_2', sort);
  assert.equal((await top('gold')).players[0].value, 1e9);
  // Mon rang hors de la liste : limit=1.
  const mine = (await call(base, 'GET', '/api/leaderboard?sort=stage&limit=1', undefined, c)).body;
  assert.equal(mine.players.length, 1);
  assert.equal(mine.me.rank, 3);
  assert.equal(mine.me.pseudo, 'Charl_3');

  // Amis : demande, liste, acceptation croisée, classement entre amis, retrait.
  assert.equal((await call(base, 'GET', '/api/leaderboard?scope=friends')).status, 401);
  assert.equal((await call(base, 'POST', '/api/friends', { pseudo: 'Inconnu' }, a)).status, 404);
  assert.equal((await call(base, 'POST', '/api/friends', { pseudo: 'alpha_1' }, a)).status, 400);
  assert.equal((await call(base, 'POST', '/api/friends', { pseudo: 'bravo_2' }, a)).body.status, 'sent');
  assert.deepEqual((await call(base, 'GET', '/api/friends', undefined, b)).body.incoming, ['Alpha_1']);
  assert.deepEqual((await call(base, 'GET', '/api/friends', undefined, a)).body.outgoing, ['Bravo_2']);
  assert.deepEqual((await top('stage', a, 'friends')).players.map((p) => p.pseudo), ['Alpha_1']);
  assert.equal((await call(base, 'POST', '/api/friends/accept', { pseudo: 'Alpha_1' }, b)).body.status, 'friends');
  assert.deepEqual((await top('stage', a, 'friends')).players.map((p) => p.pseudo), ['Alpha_1', 'Bravo_2']);
  assert.equal((await top('stage', a, 'friends')).players[0].me, true);
  // Demande croisée : C demande à A, A demande à C → amis directement.
  await call(base, 'POST', '/api/friends', { pseudo: 'Alpha_1' }, c);
  assert.equal((await call(base, 'POST', '/api/friends', { pseudo: 'Charl_3' }, a)).body.status, 'friends');
  assert.equal((await call(base, 'GET', '/api/friends', undefined, a)).body.friends.length, 2);
  assert.equal((await call(base, 'DELETE', '/api/friends/Bravo_2', undefined, a)).status, 204);
  assert.deepEqual((await top('stage', b, 'friends')).players.map((p) => p.pseudo), ['Bravo_2']);
  // Invité : absent du classement public, pas de demande d'ami.
  const guest = (await call(base, 'POST', '/api/guest', {})).body;
  if (guest?.token) {
    await call(base, 'PUT', '/api/save', { version: 0, data: JSON.stringify({ level: 99, maxStage: 999, records: {} }) }, guest.token);
    assert.ok(!(await top('stage')).players.some((p) => p.pseudo === guest.pseudo));
    assert.equal((await call(base, 'POST', '/api/friends', { pseudo: 'Alpha_1' }, guest.token)).status, 403);
  }
});

test('classement v9.1.7 : temps (renaissance la plus rapide, temps pour atteindre un monde)', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const base = s.url();
  const reg = async (pseudo) => (await call(base, 'POST', '/api/register', { pseudo, password: 'motdepasse1' })).body.token;
  const [a, b, c] = [await reg('Rapide_1'), await reg('Lent_2'), await reg('Ancien_3')];
  const save = (tok, times) => call(base, 'PUT', '/api/save', { version: 0, data: JSON.stringify({ level: 5, maxStage: 50, records: {}, times }) }, tok);
  await save(a, { bestRebirth: 3600, firstZone: { 0: 0, 1: 900, 2: 2000 } });
  await save(b, { bestRebirth: 7200, firstZone: { 0: 0, 1: 600 } });
  await save(c, { firstZone: { 0: -1, 1: -1, 2: -1 } }); // partie d'avant 9.1.7 : dates inconnues, jamais classée
  const board = async (q) => (await call(base, 'GET', `/api/leaderboard?${q}`)).body;
  assert.deepEqual((await board('sort=rebirthFast')).players.map((p) => [p.pseudo, p.value]), [['Rapide_1', 3600], ['Lent_2', 7200]]);
  assert.deepEqual((await board('sort=reach&world=2')).players.map((p) => p.pseudo), ['Lent_2', 'Rapide_1']);
  const w3 = await board('sort=reach&world=3');
  assert.equal(w3.world, 3);
  assert.deepEqual(w3.players.map((p) => [p.pseudo, p.value]), [['Rapide_1', 2000]]);
  assert.equal((await board('sort=reach&world=99')).world, 11); // borné, jamais de texte dans le SQL
  assert.equal((await board("sort=reach&world=2'--")).world, 2);
  assert.equal((await board('sort=transcendFast')).players.length, 0);
});

test('anti-triche : codes refusés, partie plus ancienne refusée, renaissance acceptée, meilleure étape conservée', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const base = s.url();
  const { token } = (await call(base, 'POST', '/api/register', { pseudo: 'Tricheur', password: 'motdepasse1' })).body;
  const cheated = await call(base, 'PUT', '/api/save', { version: 0, data: JSON.stringify({ level: 5, maxStage: 5, cheats: { effects: [{ code: 'TURBO100' }], reveal: false, speeds: [] } }) }, token);
  assert.equal(cheated.status, 422);
  assert.match(cheated.body.error, /triche/);
  const clean = { level: 10, maxStage: 40, playSeconds: 1000, cheats: { effects: [], reveal: false, speeds: [], skipBattle: false } };
  assert.equal((await call(base, 'PUT', '/api/save', { version: 0, data: JSON.stringify(clean) }, token)).status, 200);
  // Partie plus ancienne (moins de temps de jeu) : refusée.
  const older = await call(base, 'PUT', '/api/save', { version: 1, data: JSON.stringify({ level: 10, maxStage: 40, playSeconds: 100 }) }, token);
  assert.equal(older.status, 422);
  assert.match(older.body.error, /plus ancienne/);
  assert.equal((await call(base, 'PUT', '/api/save', { version: 1, data: JSON.stringify({ level: 10, maxStage: 2.5, playSeconds: 1100 }) }, token)).status, 422);
  assert.equal((await call(base, 'PUT', '/api/save', { version: 1, data: JSON.stringify({ level: 10, maxStage: 12, gold: -4, playSeconds: 1100 }) }, token)).status, 422);
  // Renaissance : niveau remis à 1 et étape repartie de 1 (refusée en 9.1.2) ; le classement garde la meilleure étape.
  assert.equal((await call(base, 'PUT', '/api/save', { version: 1, data: JSON.stringify({ level: 1, maxStage: 1, playSeconds: 1200 }) }, token)).status, 200);
  const board = (await call(base, 'GET', '/api/leaderboard?sort=stage')).body.players;
  assert.equal(board[0].maxStage, 40);
  // Pas de plafond d'étape : cycles de difficulté sans fin (2001 = 6-11 ×10 était refusée).
  assert.equal((await call(base, 'PUT', '/api/save', { version: 2, data: JSON.stringify({ level: 900, maxStage: 5000, playSeconds: 1300 }) }, token)).status, 200);
});

// ---- v9.1.1 : comptes invités, compte joueur, changement de nom, analytique ----
const SAVE = (level, maxStage, lastSaved) => JSON.stringify({ level, maxStage, gold: 10, gems: 1, kills: 5, lastSaved, records: { bossesDefeated: 0 } });

test('invité : nom joueurXXXXXX, sauvegarde serveur, connexion impossible sans compte joueur', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const base = s.url();
  const g = await call(base, 'POST', '/api/guest', { platform: 'windows', gameVersion: '9.1.1' });
  assert.equal(g.status, 201);
  assert.match(g.body.pseudo, /^joueur\d{6}$/);
  assert.equal(g.body.guest, true);
  const put = await call(base, 'PUT', '/api/save', { version: 0, data: SAVE(3, 4, 1) }, g.body.token);
  assert.equal(put.status, 200);
  const acc = await call(base, 'GET', '/api/account', undefined, g.body.token);
  assert.deepEqual(acc.body, { pseudo: g.body.pseudo, guest: true, listed: true });
  // Mot de passe vide : aucune connexion possible au nom de l'invité.
  for (const password of ['', 'nimportequoi']) {
    assert.equal((await call(base, 'POST', '/api/login', { pseudo: g.body.pseudo, password })).status, 401);
  }
  const row = s.db.prepare('SELECT platform, game_version FROM accounts WHERE pseudo = ?').get(g.body.pseudo);
  assert.deepEqual({ ...row }, { platform: 'windows', game_version: '9.1.1' });
  // Valeurs inconnues filtrées.
  const g2 = await call(base, 'POST', '/api/guest', { platform: '<script>', gameVersion: 'x' });
  const row2 = s.db.prepare('SELECT platform, game_version FROM accounts WHERE pseudo = ?').get(g2.body.pseudo);
  assert.deepEqual({ ...row2 }, { platform: null, game_version: null });
});

test('invité -> compte joueur : nom choisi, progression gardée, puis changement de nom', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const base = s.url();
  const g = await call(base, 'POST', '/api/guest', {});
  const tok = g.body.token;
  await call(base, 'PUT', '/api/save', { version: 0, data: SAVE(7, 9, 1) }, tok);
  // Renommer sans compte joueur : refusé.
  assert.equal((await call(base, 'PUT', '/api/account/pseudo', { pseudo: 'Ayla', password: 'x' }, tok)).status, 403);
  // Noms réservés et mots de passe trop courts.
  assert.equal((await call(base, 'POST', '/api/account/claim', { pseudo: 'joueur123456', password: 'motdepasse1' }, tok)).status, 400);
  assert.equal((await call(base, 'POST', '/api/account/claim', { pseudo: 'Ayla', password: 'court' }, tok)).status, 400);
  await call(base, 'POST', '/api/register', { pseudo: 'Pris', password: 'motdepasse1' });
  assert.equal((await call(base, 'POST', '/api/account/claim', { pseudo: 'pris', password: 'motdepasse1' }, tok)).status, 409);
  const claim = await call(base, 'POST', '/api/account/claim', { pseudo: 'Ayla', password: 'motdepasse1' }, tok);
  assert.equal(claim.status, 200);
  assert.deepEqual(claim.body, { pseudo: 'Ayla', guest: false });
  // Une seule fois.
  assert.equal((await call(base, 'POST', '/api/account/claim', { pseudo: 'Ayla2', password: 'motdepasse1' }, tok)).status, 409);
  // Même session, même sauvegarde ; connexion par nom possible.
  assert.equal(JSON.parse((await call(base, 'GET', '/api/save', undefined, tok)).body.data).level, 7);
  const login = await call(base, 'POST', '/api/login', { pseudo: 'ayla', password: 'motdepasse1' });
  assert.equal(login.status, 200);
  // Changement de nom : mot de passe requis.
  assert.equal((await call(base, 'PUT', '/api/account/pseudo', { pseudo: 'Aylana', password: 'mauvais12' }, tok)).status, 401);
  assert.equal((await call(base, 'PUT', '/api/account/pseudo', { pseudo: 'Pris', password: 'motdepasse1' }, tok)).status, 409);
  const ren = await call(base, 'PUT', '/api/account/pseudo', { pseudo: 'Aylana', password: 'motdepasse1' }, tok);
  assert.equal(ren.status, 200);
  assert.equal((await call(base, 'POST', '/api/login', { pseudo: 'Aylana', password: 'motdepasse1' })).status, 200);
  assert.equal((await call(base, 'POST', '/api/login', { pseudo: 'Ayla', password: 'motdepasse1' })).status, 401);
  // On ne peut pas prendre un nom automatique en s'inscrivant.
  assert.equal((await call(base, 'POST', '/api/register', { pseudo: 'Joueur000001', password: 'motdepasse1' })).status, 400);
});

test('invité : suppression sans mot de passe ; création limitée par adresse', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const base = s.url();
  const g = await call(base, 'POST', '/api/guest', {});
  assert.equal((await call(base, 'DELETE', '/api/account', {}, g.body.token)).status, 204);
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n, 0);
  let last = 0;
  for (let i = 0; i < LIMITS.guestAttempts.max + 1; i += 1) last = (await call(base, 'POST', '/api/guest', {})).status;
  assert.equal(last, 429);
});

test('analytique admin : activité par jour, rétention, plateformes, versions, répartition', async (t) => {
  const s = await setup({ adminPasswordHash: await hashPassword('admin-secret-123') });
  t.after(() => s.close());
  const base = s.url();
  const a = await call(base, 'POST', '/api/guest', { platform: 'android', gameVersion: '9.1.1' });
  const b = await call(base, 'POST', '/api/guest', { platform: 'windows', gameVersion: '9.1.0' });
  await call(base, 'PUT', '/api/save', { version: 0, data: SAVE(12, 30, 1) }, a.body.token);
  await call(base, 'GET', '/api/save', undefined, a.body.token);
  s.advance(24 * 3600 * 1000);
  await call(base, 'GET', '/api/save', undefined, a.body.token); // revenu à J1
  await call(base, 'POST', '/api/account/claim', { pseudo: 'Bob', password: 'motdepasse1' }, b.body.token);
  const admin = await call(base, 'POST', '/api/admin/login', { username: 'erwann', password: 'admin-secret-123' });
  const an = await call(base, 'GET', '/api/admin/analytics?days=7', undefined, admin.body.token);
  assert.equal(an.status, 200);
  assert.equal(an.body.series.length, 7);
  const last2 = an.body.series.slice(-2);
  assert.deepEqual(last2.map((d) => d.active), [2, 1]);
  assert.deepEqual(last2.map((d) => d.newAccounts), [2, 0]);
  assert.deepEqual(last2.map((d) => d.newPlayers), [0, 1]);
  assert.equal(last2[0].minutes, 3, 'deux créations + un GET le premier jour');
  assert.deepEqual(an.body.retention.d1, { cohort: 2, back: 1, rate: 0.5 });
  assert.equal(an.body.guests, 1);
  assert.equal(an.body.registered, 1);
  assert.deepEqual(an.body.platforms.map((p) => p.key).sort(), ['android', 'windows']);
  assert.ok(an.body.versions.some((v) => v.key === '9.1.1' && v.count === 1));
  assert.equal(an.body.stageDist.find((d) => d.key === '25–49').count, 1);
  assert.equal(an.body.dau, 1);
  assert.equal(an.body.wau, 2);
  // Fiche joueur : activité et type de compte ; filtre invités / joueurs.
  const list = await call(base, 'GET', '/api/admin/players?kind=guest', undefined, admin.body.token);
  assert.equal(list.body.total, 1);
  const detail = await call(base, 'GET', `/api/admin/players/${list.body.players[0].id}`, undefined, admin.body.token);
  assert.equal(detail.body.guest, true);
  assert.equal(detail.body.platform, 'android');
  assert.equal(detail.body.activity.daysPlayed, 2);
  // Sans jeton admin : refusé.
  assert.equal((await call(base, 'GET', '/api/admin/analytics', undefined, a.body.token)).status, 401);
});

test('session glissante : un invité qui revient garde son compte au-delà de 30 jours', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const base = s.url();
  const g = await call(base, 'POST', '/api/guest', {});
  for (let i = 0; i < 3; i += 1) {
    s.advance(20 * 24 * 3600 * 1000);
    assert.equal((await call(base, 'GET', '/api/save', undefined, g.body.token)).status, 200);
  }
  s.advance(31 * 24 * 3600 * 1000);
  assert.equal((await call(base, 'GET', '/api/save', undefined, g.body.token)).status, 401);
});

test('plateforme et version transmises avec la sauvegarde (sans en-tête personnalisé)', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const base = s.url();
  const reg = await call(base, 'POST', '/api/register', { pseudo: 'Ancien', password: 'motdepasse1' });
  await call(base, 'PUT', '/api/save', { version: 0, data: SAVE(2, 2, 1), platform: 'android', gameVersion: '9.1.1' }, reg.body.token);
  const row = s.db.prepare('SELECT platform, game_version FROM accounts WHERE pseudo = ?').get('Ancien');
  assert.deepEqual({ ...row }, { platform: 'android', game_version: '9.1.1' });
});

// ---- v9.1.3 (doc4 lot 7) : score en ligne par perso (mode monde) ----
test('score en ligne : extrait de la sauvegarde, validé, meilleur gardé, joueurs listés seulement, sauvegarde jamais bloquée', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const base = s.url();
  const at = Date.UTC(2026, 9, 31, 11);
  const game = (damage, extra = {}) => JSON.stringify({ level: 30, maxStage: 100, records: { bestStage: 120 },
    companions: { owned: { demo_ssr: { stars: 4, level: 12 } } },
    worlds: { demo_ssr: { levels: 2, tiers: 1, score: { damage, stars: 3, level: 12, team: ['demo_ssr'], at, ...extra } } } });
  const a = (await call(base, 'POST', '/api/register', { pseudo: 'Lame_un', password: 'motdepasse1' })).body.token;
  const b = (await call(base, 'POST', '/api/register', { pseudo: 'Lame_deux', password: 'motdepasse1' })).body.token;
  const c = (await call(base, 'POST', '/api/register', { pseudo: 'Lame_cache', password: 'motdepasse1' })).body.token;
  assert.equal((await call(base, 'PUT', '/api/save', { version: 0, data: game(5e12) }, a)).status, 200);
  assert.equal((await call(base, 'PUT', '/api/save', { version: 0, data: game(9e12) }, b)).status, 200);
  assert.equal((await call(base, 'PUT', '/api/save', { version: 0, data: game(1e13) }, c)).status, 200);
  await call(base, 'PUT', '/api/account/listed', { listed: false }, c);
  // Score plus bas ensuite : le meilleur reste ; score impossible (étoiles > doublons) : ignoré, sauvegarde acceptée.
  assert.equal((await call(base, 'PUT', '/api/save', { version: 1, data: game(1e12) }, a)).status, 200);
  assert.equal((await call(base, 'PUT', '/api/save', { version: 2, data: game(8e13, { stars: 5 }) }, a)).status, 200);
  assert.equal((await call(base, 'PUT', '/api/save', { version: 3, data: game(1e300) }, a)).status, 200);
  const board = (await call(base, 'GET', '/api/scores?unit=demo_ssr')).body.players;
  assert.deepEqual(board.map((p) => [p.pseudo, p.damage, p.stars, p.level]), [['Lame_deux', 9e12, 3, 12], ['Lame_un', 5e12, 3, 12]]);
  assert.equal(board[0].rank, 1);
  assert.equal((await call(base, 'GET', '/api/scores?unit=../x')).status, 400);
  assert.deepEqual((await call(base, 'GET', '/api/scores?unit=shadow_lord')).body.players, []);
});

test("anti-triche : l'or d'un idle n'a pas de plafond (refusé à tort au-delà de 1e15 en 9.1.2)", () => {
  const save = { level: 37, maxStage: 48, gold: 4.2e31, gems: 1e18 };
  assert.equal(checkSave(save, summarizeSave(save), null), null);
  const bad = { level: 37, maxStage: 48, gold: Infinity };
  assert.match(checkSave(bad, summarizeSave({ ...bad, gold: -1 }), null), /or impossible/);
});

test('connexions réussies sans limite ; seuls les échecs comptent', async (t) => {
  const s = await setup({ adminPasswordHash: await hashPassword('mot-de-passe-admin') });
  t.after(() => s.close());
  const base = s.url();
  await call(base, 'POST', '/api/register', { pseudo: 'Fidele', password: 'motdepasse1' });
  for (let i = 0; i < LIMITS.authAttempts.max + 3; i += 1) {
    assert.equal((await call(base, 'POST', '/api/login', { pseudo: 'Fidele', password: 'motdepasse1' })).status, 200);
  }
  for (let i = 0; i < LIMITS.authAttempts.max; i += 1) {
    await call(base, 'POST', '/api/admin/login', { username: 'erwann', password: 'faux-mdp-xxxx' });
  }
  assert.equal((await call(base, 'POST', '/api/admin/login', { username: 'erwann', password: 'faux-mdp-xxxx' })).status, 429);
  assert.equal((await call(base, 'POST', '/api/login', { pseudo: 'Fidele', password: 'motdepasse1' })).status, 200);
});

test("libellé d'étape du serveur identique à celui du jeu (classement, admin)", () => {
  for (let stage = 1; stage <= 3000; stage += 1) assert.equal(stageLabel(stage), gameStageLabel(stage), `étape ${stage}`);
});
