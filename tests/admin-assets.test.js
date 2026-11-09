import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, detectImageType, safeAssetName, ASSET_MAX_BYTES } from '../server/app.mjs';
import { openDatabase } from '../server/db.mjs';

// PNG 1x1 valide (signature + IHDR + IDAT + IEND).
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc0f01f0005000201a5f6a4a40000000049454e44ae426082', 'hex');

async function setup(t) {
  const siteDir = mkdtempSync(join(tmpdir(), 'site-assets-'));
  mkdirSync(join(siteDir, 'assets'), { recursive: true });
  const db = openDatabase(':memory:');
  const server = createServer(createApp({ db, siteDir, webDir: siteDir, adminPasswordHash: '' }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.close(); db.close(); });
  return { siteDir, base: `http://127.0.0.1:${server.address().port}` };
}

test('type réel détecté par la signature, pas par le nom', () => {
  assert.equal(detectImageType(PNG), 'png');
  assert.equal(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])), 'jpg');
  assert.equal(detectImageType(Buffer.from('GIF89a......')), 'gif');
  assert.equal(detectImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ')), 'webp');
  assert.equal(detectImageType(Buffer.from('<html><script>alert(1)</script>')), null);
  assert.equal(ASSET_MAX_BYTES, 3 * 1024 * 1024);
});

test('nom de fichier sûr', () => {
  assert.equal(safeAssetName('Mon Image (1).PNG'), 'mon-image-1');
  assert.equal(safeAssetName('../../etc/passwd.png'), 'etc-passwd');
  assert.equal(safeAssetName('???.png'), 'image');
  assert.ok(safeAssetName('a'.repeat(200)).length <= 40);
});

test('envoi réservé à l\'admin, format vérifié, fichier servi ensuite', async (t) => {
  const { siteDir, base } = await setup(t);
  const anon = await fetch(`${base}/api/admin/assets`, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: PNG });
  assert.equal(anon.status, 401);
  const owner = { Authorization: 'Bearer fauxjeton' };
  assert.equal((await fetch(`${base}/api/admin/assets`, { method: 'POST', headers: owner, body: PNG })).status, 401);
});

test('admin réel : envoi PNG, fichier servi, faux fichier refusé, liste à jour', async (t) => {
  const { hashPassword } = await import('../server/app.mjs');
  const siteDir = mkdtempSync(join(tmpdir(), 'site-assets-e2e-'));
  mkdirSync(join(siteDir, 'assets'), { recursive: true });
  const db = openDatabase(':memory:');
  const server = createServer(createApp({ db, siteDir, webDir: siteDir, adminPasswordHash: await hashPassword('mot-de-passe-admin-1') }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.close(); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await (await fetch(`${base}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'erwann', password: 'mot-de-passe-admin-1' }) })).json();
  const auth = { Authorization: `Bearer ${login.token}` };
  const up = await fetch(`${base}/api/admin/assets`, { method: 'POST', headers: { ...auth, 'Content-Type': 'image/png', 'X-Filename': encodeURIComponent('Mon Palier.png') }, body: PNG });
  assert.equal(up.status, 201);
  const { path } = await up.json();
  assert.match(path, /^assets\/uploads\/[a-z0-9]+-mon-palier\.png$/);
  assert.ok(readdirSync(join(siteDir, 'assets', 'uploads')).length === 1);
  assert.equal(readFileSync(join(siteDir, path)).equals(PNG), true);
  const served = await fetch(`${base}/${path}`);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/png');
  const fake = await fetch(`${base}/api/admin/assets`, { method: 'POST', headers: { ...auth, 'Content-Type': 'image/png', 'X-Filename': 'x.png' }, body: '<script>alert(1)</script>' });
  assert.equal(fake.status, 415);
  const list = await (await fetch(`${base}/api/admin/assets`, { headers: auth })).json();
  assert.deepEqual(list.files.map((f) => f.path), [path]);
});
