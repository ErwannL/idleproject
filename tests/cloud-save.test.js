import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';
import { openDatabase } from '../server/db.mjs';
import { createCloudClient, CloudError, isFreshSave, reconcile, syncOnce } from '../src/core/cloud-save.js';
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

  deviceA.setItem(SAVE_KEY, JSON.stringify({ lastSaved: 500, gold: 42 }));
  const first = await syncOnce({ client: clientA, storage: deviceA });
  assert.equal(first.action, 'push');
  assert.equal(first.version, 1);

  await clientB.login('joueur_1', 'motdepasse1');
  const second = await syncOnce({ client: clientB, storage: deviceB });
  assert.equal(second.action, 'pull');
  assert.equal(deviceB.getItem(SAVE_KEY), JSON.stringify({ lastSaved: 500, gold: 42 }));
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
