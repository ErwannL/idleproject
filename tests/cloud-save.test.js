import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';
import { openDatabase } from '../server/db.mjs';
import { BEFORE_LOGIN_KEY, createCloudClient, CloudError, isFreshSave, reconcile, syncOnce } from '../src/core/cloud-save.js';
import { SAVE_KEY } from '../src/core/save.js';

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k) };
}

async function startApi(t) {
  const dir = mkdtempSync(join(tmpdir(), 'idle-cloud-'));
  mkdirSync(join(dir, 'site'));
  mkdirSync(join(dir, 'web'));
  const db = openDatabase(':memory:');
  const server = createServer(createApp({ db, siteDir: join(dir, 'site'), webDir: join(dir, 'web') }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    server.close();
    db.close();
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test('reconcile : la partie la plus récente gagne', () => {
  const old = JSON.stringify({ lastSaved: 100, kills: 5, maxStage: 3 });
  const recent = JSON.stringify({ lastSaved: 200, kills: 9, maxStage: 4 });
  assert.equal(reconcile(null, null), 'none');
  assert.equal(reconcile(old, null), 'push');
  assert.equal(reconcile(null, recent), 'pull');
  assert.equal(reconcile(old, recent), 'pull');
  assert.equal(reconcile(recent, old), 'push');
  assert.equal(reconcile(recent, recent), 'none');
});

test('cycle complet : compte, push depuis un appareil, pull sur un autre', async (t) => {
  const baseUrl = await startApi(t);
  const deviceA = memoryStorage();
  const deviceB = memoryStorage();
  const clientA = createCloudClient({ baseUrl, storage: deviceA });
  const clientB = createCloudClient({ baseUrl, storage: deviceB });

  await clientA.register('Joueur_1', 'motdepasse1');
  assert.equal(clientA.isLoggedIn(), true);
  assert.equal(clientA.pseudo(), 'Joueur_1');

  deviceA.setItem(SAVE_KEY, JSON.stringify({ lastSaved: 500, gold: 42, level: 1, maxStage: 1 }));
  const first = await syncOnce({ client: clientA, storage: deviceA });
  assert.equal(first.action, 'push');
  assert.equal(first.version, 1);

  await clientB.login('joueur_1', 'motdepasse1');
  const second = await syncOnce({ client: clientB, storage: deviceB });
  assert.equal(second.action, 'pull');
  assert.equal(deviceB.getItem(SAVE_KEY), JSON.stringify({ lastSaved: 500, gold: 42, level: 1, maxStage: 1 }));
});

test('une nouvelle partie locale ne remplace jamais la sauvegarde cloud', () => {
  const fresh = JSON.stringify({ lastSaved: 900, stage: 1, maxStage: 1, level: 1, kills: 0 });
  const cloud = JSON.stringify({ lastSaved: 100, maxStage: 20, level: 8, kills: 300 });
  assert.equal(isFreshSave(fresh), true);
  assert.equal(isFreshSave(cloud), false);
  assert.equal(reconcile(fresh, cloud), 'pull');
});

test('hors ligne : erreur réseau explicite, sauvegarde locale intacte', async () => {
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ lastSaved: 1 }));
  const client = createCloudClient({ baseUrl: 'http://127.0.0.1:1', storage });
  storage.setItem('idle-rpg.cloud-token', 'jeton');
  await assert.rejects(() => syncOnce({ client, storage }), (err) => err instanceof CloudError && err.status === 0);
  assert.equal(storage.getItem(SAVE_KEY), JSON.stringify({ lastSaved: 1 }));
});

test('suppression du compte : données serveur effacées, session locale oubliée', async (t) => {
  const baseUrl = await startApi(t);
  const storage = memoryStorage();
  const client = createCloudClient({ baseUrl, storage });
  await client.register('Suppr_01', 'motdepasse1');
  await client.deleteAccount('motdepasse1');
  assert.equal(client.isLoggedIn(), false);
  await assert.rejects(() => client.login('Suppr_01', 'motdepasse1'), (err) => err.status === 401);
});

// ---- v9.1.1 ----
const game = (level, maxStage, lastSaved) => JSON.stringify({ level, maxStage, gold: 1, gems: 0, kills: 3, lastSaved, records: {} });

test('invité automatique : sauvegarde en ligne dès le départ, puis compte joueur et autre appareil', async (t) => {
  const baseUrl = await startApi(t);
  const pc = memoryStorage();
  const client = createCloudClient({ baseUrl, storage: pc, client: { platform: 'windows', version: '9.1.1' } });
  pc.setItem(SAVE_KEY, game(5, 8, 100));
  const name = await client.guest();
  assert.match(name, /^joueur\d{6}$/);
  assert.equal(client.isGuest(), true);
  assert.equal((await syncOnce({ client, storage: pc })).action, 'push');
  await client.claim('Ayla', 'motdepasse1');
  assert.equal(client.isGuest(), false);
  assert.equal(client.pseudo(), 'Ayla');
  // Téléphone : déjà un invité avec quelques minutes (plus récentes), puis connexion au compte joueur.
  const phone = memoryStorage();
  const other = createCloudClient({ baseUrl, storage: phone });
  phone.setItem(SAVE_KEY, game(2, 2, 999));
  await other.guest();
  await syncOnce({ client: other, storage: phone });
  await other.login('Ayla', 'motdepasse1');
  const r = await syncOnce({ client: other, storage: phone, preferRemote: true });
  assert.equal(r.action, 'pull', 'la partie du compte gagne à la connexion');
  assert.equal(JSON.parse(phone.getItem(SAVE_KEY)).level, 5);
  assert.equal(JSON.parse(phone.getItem(BEFORE_LOGIN_KEY)).level, 2, 'copie de la partie du téléphone');
  // Renommage depuis le téléphone ; le PC le voit au prochain refresh.
  await other.rename('Aylana', 'motdepasse1');
  assert.equal((await client.refresh()).pseudo, 'Aylana');
  assert.equal(client.pseudo(), 'Aylana');
});

test('déconnexion volontaire : plus d\'invité automatique jusqu\'à une nouvelle connexion', async (t) => {
  const baseUrl = await startApi(t);
  const st = memoryStorage();
  const client = createCloudClient({ baseUrl, storage: st });
  await client.register('Bob_1', 'motdepasse1');
  await client.logout();
  assert.equal(client.optedOut(), true);
  assert.equal(client.isLoggedIn(), false);
  await client.login('Bob_1', 'motdepasse1');
  assert.equal(client.optedOut(), false);
  // Session expirée d'un invité : forget() n'empêche pas d'en recréer un.
  await client.logout();
  await client.guest();
  client.forget();
  assert.equal(client.optedOut(), false);
});

test('la politique de sécurité (CSP) du jeu autorise le serveur de sauvegarde', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const csp = html.match(/connect-src ([^";]+)/)[1].split(/\s+/);
  const cfg = readFileSync(new URL('../src/core/cloud-config.js', import.meta.url), 'utf8');
  const origin = new URL(cfg.match(/'(https:\/\/[^']+)'/)[1]).origin;
  assert.ok(csp.includes(origin), `${origin} absent de connect-src`);
});

test('v9.1.3 : partie en ligne d\'une version plus récente — ni chargée, ni écrasée', async (t) => {
  const baseUrl = await startApi(t);
  const st = memoryStorage();
  const client = createCloudClient({ baseUrl, storage: st });
  await client.register('Neuf_1', 'motdepasse1');
  const future = JSON.stringify({ version: 99, level: 9, maxStage: 9, gold: 1, gems: 0, kills: 3, lastSaved: 5, records: {} });
  await client.push(0, future);
  st.setItem(SAVE_KEY, JSON.stringify({ version: 7, level: 1, maxStage: 1, kills: 50, lastSaved: 999, records: {} }));
  const r = await syncOnce({ client, storage: st, maxSaveVersion: 7 });
  assert.equal(r.action, 'newer');
  assert.equal(r.newerVersion, 99);
  assert.equal(JSON.parse(st.getItem(SAVE_KEY)).version, 7, 'rien chargé');
  assert.equal(JSON.parse((await client.pull()).data).version, 99, 'rien écrasé');
});

test('v9.1.3 : un jeu 9.1.2 (format 7, sans blocage « newer ») ne peut pas écraser une partie migrée (format 8)', async (t) => {
  const baseUrl = await startApi(t);
  const st = memoryStorage();
  const client = createCloudClient({ baseUrl, storage: st });
  await client.register('Migre_1', 'motdepasse1');
  const migrated = JSON.stringify({ version: 8, level: 50, maxStage: 90, gold: 1, gems: 0, kills: 3, lastSaved: 5, records: {} });
  const { version } = await client.push(0, migrated);
  // Le jeu 9.1.2 ignore maxSaveVersion : sa partie locale (plus récente) part vers le serveur.
  st.setItem(SAVE_KEY, JSON.stringify({ version: 7, level: 50, maxStage: 90, kills: 50, lastSaved: 999, records: {} }));
  await assert.rejects(() => syncOnce({ client, storage: st }), /trop ancienne/);
  const remote = await client.pull();
  assert.equal(remote.version, version);
  assert.equal(JSON.parse(remote.data).version, 8, 'partie migrée intacte');
});
