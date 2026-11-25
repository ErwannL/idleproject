// v10.14.1 : World Boss de fête — classement PAR TRANCHES (10 %, 30 %, 60 %), remis à zéro à chaque fête, sans rang absolu.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createApp, hashPassword } from '../server/app.mjs';
import { openDatabase } from '../server/db.mjs';
import { bracketOf } from '../server/guilds.mjs';

const T0 = Date.UTC(2026, 10, 9, 12);
async function setup() {
  let clock = T0;
  const db = openDatabase(':memory:');
  const app = createApp({ db, siteDir: '', webDir: '', adminPasswordHash: await hashPassword('motdepasse-admin-1'), now: () => clock });
  const server = createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body, token) => {
    const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = `Bearer ${token}`;
    const res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text(); return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  const user = async (pseudo) => (await call('POST', '/api/register', { pseudo, password: 'motdepasse1' })).body.token;
  return { call, user, advance: (ms) => { clock += ms; }, close: async () => { server.close(); await once(server, 'close').catch(() => {}); db.close(); } };
}


test('tranches : bracketOf (10 %, 30 %, 60 %, puis participant)', () => {
  assert.equal(bracketOf(0, 1).id, 'top10', 'seul en lice : en tête');
  assert.equal(bracketOf(0, 20).id, 'top10');
  assert.equal(bracketOf(1, 20).id, 'top10');
  assert.equal(bracketOf(2, 20).id, 'top30');
  assert.equal(bracketOf(5, 20).id, 'top30');
  assert.equal(bracketOf(6, 20).id, 'top60');
  assert.equal(bracketOf(11, 20).id, 'top60');
  assert.equal(bracketOf(12, 20).id, 'part');
  assert.equal(bracketOf(0, 0), null);
});

test('World Boss de fête : tranche renvoyée au rapport, aucune liste de joueurs, remise à zéro à chaque fête', async (t) => {
  const s = await setup(); t.after(() => s.close());
  const names = ['Ayla_A', 'Bran_B', 'Cleo_C', 'Dara_D', 'Eli_E'];
  const tokens = []; for (const n of names) tokens.push(await s.user(n));
  const report = (i, damage, event = 'fest-2027-02-g') => s.call('POST', '/api/worldboss/report', { mode: 'event', event, damage, power: 1e6, tiers: 1 }, tokens[i]);
  for (let i = 0; i < 5; i += 1) await report(i, 1e9 * (5 - i));
  const last = await report(4, 1e9); // meilleur essai du jour conservé : 1e9 reste le plus bas
  assert.equal(last.body.bracket.id, 'part', 'dernier sur 5 : hors des tranches');
  const top = await s.call('GET', '/api/worldboss/bracket?period=fest-2027-02-g', undefined, tokens[0]);
  assert.equal(top.body.bracket.id, 'top10');
  assert.equal(top.body.players, 5);
  const mid = (await s.call('GET', '/api/worldboss/bracket?period=fest-2027-02-g', undefined, tokens[2])).body.bracket;
  assert.equal(mid.id, 'top60', '3e sur 5 : 40 % devant');
  const rk = (await s.call('GET', '/api/worldboss/ranking?mode=event&period=fest-2027-02-g', undefined, tokens[1])).body;
  assert.deepEqual(rk.players, [], 'pas de classement absolu');
  assert.deepEqual(rk.guilds, []);
  assert.equal(rk.bracket.id, 'top30');
  // autre fête : tout repart de zéro
  assert.equal((await s.call('GET', '/api/worldboss/bracket?period=fest-2027-02-l', undefined, tokens[0])).body.bracket, null);
  const solo = await report(0, 5e9, 'fest-2027-03-g');
  assert.equal(solo.body.bracket.id, 'top10', 'nouvelle fête : classement neuf');
  // événements non-fête : classement absolu inchangé
  await s.call('POST', '/api/worldboss/report', { mode: 'event', event: 'ancients-1', damage: 5e9, power: 1e6, tiers: 2 }, tokens[0]);
  const old = (await s.call('GET', '/api/worldboss/ranking?mode=event&period=ancients-1')).body;
  assert.equal(old.players.length, 1);
  assert.equal(old.bracket, undefined);
  assert.equal((await s.call('GET', '/api/worldboss/bracket?period=ancients-1', undefined, tokens[0])).status, 400, 'tranches réservées aux fêtes');
  assert.equal((await s.call('GET', '/api/worldboss/bracket?period=fest-2027-02-g')).status, 401, 'connexion requise');
});

test('admin : la feuille de la fête s\'affiche « 2027-02-g · Fête des Cœurs ardents »', async () => {
  const { LIVE_EVENT_TYPES } = await import('../src/data/live-catalog.js');
  const p = LIVE_EVENT_TYPES.fest.params.sheet;
  assert.equal(p.labels['2027-02-g'], '2027-02-g · Fête des Cœurs ardents');
  assert.equal(p.labels['2027-02-l'], '2027-02-l · Bal des Lames roses');
  assert.ok(p.values.every((id) => p.labels[id].startsWith(`${id} · `)));
  const admin = (await import('node:fs')).readFileSync(new URL('../site/admin/live-admin.js', import.meta.url), 'utf8');
  assert.match(admin, /p\.labels\?\.\[x\]/, 'le menu admin lit les libellés');
});
