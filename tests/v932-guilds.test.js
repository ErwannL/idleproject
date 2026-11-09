// v9.3.2 : guildes et World Boss côté serveur (deux World Boss distincts, guilde : rôles, demandes, verrou,
// classement = moyenne des meilleurs membres, anti-abus).
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createApp, hashPassword } from '../server/app.mjs';
import { openDatabase } from '../server/db.mjs';
import { GUILD_RULES, checkReport } from '../server/guilds.mjs';

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

test('guildes : création, accès libre, demandes, rôles, exclusion, départ du chef', async (t) => {
  const s = await setup(); t.after(() => s.close());
  const [a, b, c] = [await s.user('Chef_A'), await s.user('Bob_B'), await s.user('Cleo_C')];
  assert.equal((await s.call('POST', '/api/guilds', { name: 'x', emblem: 'icon_star' }, a)).status, 400, 'nom trop court');
  const g = await s.call('POST', '/api/guilds', { name: 'Les Anciens', emblem: 'icon_crown', description: 'Bienvenue', open: false }, a);
  assert.equal(g.status, 201); assert.equal(g.body.role, 'leader');
  assert.equal((await s.call('POST', '/api/guilds', { name: 'les anciens', emblem: 'icon_star' }, b)).status, 409, 'nom unique');
  assert.equal((await s.call('POST', '/api/guild/join', { name: 'Les Anciens' }, b)).body.status, 'requested', 'guilde sur demande');
  assert.equal((await s.call('POST', '/api/guild/kick', { pseudo: 'Chef_A' }, b)).status, 404, 'non-membre : aucune action');
  const mine = await s.call('GET', '/api/guild', undefined, a);
  assert.deepEqual(mine.body.requests, ['Bob_B']);
  await s.call('POST', '/api/guild/accept', { pseudo: 'Bob_B' }, a);
  await s.call('POST', '/api/guild/settings', { open: true }, a);
  assert.equal((await s.call('POST', '/api/guild/join', { name: 'Les Anciens' }, c)).body.status, 'joined');
  assert.equal((await s.call('POST', '/api/guild/kick', { pseudo: 'Cleo_C' }, b)).status, 403, 'un membre n\'exclut pas');
  await s.call('POST', '/api/guild/role', { pseudo: 'Bob_B', role: 'officer' }, a);
  assert.equal((await s.call('POST', '/api/guild/kick', { pseudo: 'Cleo_C' }, b)).status, 200, 'un officier exclut un membre');
  await s.call('POST', '/api/guild/leave', {}, a);
  const after = await s.call('GET', '/api/guild', undefined, b);
  assert.equal(after.body.role, 'leader', 'la chefferie passe à l\'officier');
  assert.ok(after.body.log.some((l) => /quitte/.test(l.text)));
});

test('World Boss : deux modes distincts, barre mondiale partagée, scores bornés, un score par jour', async (t) => {
  const s = await setup(); t.after(() => s.close());
  const a = await s.user('Ayla_A'); const b = await s.user('Bran_B');
  const g0 = (await s.call('GET', '/api/worldboss/global')).body;
  await s.call('POST', '/api/worldboss/report', { mode: 'global', damage: 1e9, power: 1e6 }, a);
  await s.call('POST', '/api/worldboss/report', { mode: 'global', damage: 2e9, power: 1e6 }, b);
  const g1 = (await s.call('GET', '/api/worldboss/global')).body;
  assert.equal(g0.left - g1.left, 3e9, 'les dégâts de tous s\'additionnent sur la barre commune');
  await s.call('POST', '/api/worldboss/report', { mode: 'event', event: 'ancients-1', damage: 5e9, power: 1e6, tiers: 2 }, a);
  const ev = (await s.call('GET', '/api/worldboss/ranking?mode=event&period=ancients-1')).body;
  const gl = (await s.call('GET', '/api/worldboss/ranking?mode=global')).body;
  assert.equal(ev.players[0].points, 50, 'événement : conditions (paliers) en points');
  assert.equal(ev.players.length, 1); assert.equal(gl.players.length, 2, 'classements séparés');
  assert.equal((await s.call('GET', '/api/worldboss/global')).body.left, g1.left, 'l\'événement ne touche pas la barre mondiale');
  assert.equal((await s.call('POST', '/api/worldboss/report', { mode: 'global', damage: 1e12, power: 10 }, a)).status, 422, 'score borné par la puissance');
  await s.call('POST', '/api/worldboss/report', { mode: 'global', damage: 5e8, power: 1e6 }, a);
  const gl2 = (await s.call('GET', '/api/worldboss/ranking?mode=global')).body;
  assert.equal(gl2.players.find((p) => p.pseudo === 'Ayla_A').damage, 1e9, 'un score par jour : le meilleur');
  assert.throws(() => checkReport({ mode: 'x', damage: 1, power: 1 }));
});

test('guildes et World Boss : moyenne des meilleurs, verrou de 24 h après un changement', async (t) => {
  const s = await setup(); t.after(() => s.close());
  const [a, b, c] = [await s.user('Petit_A'), await s.user('Petit_B'), await s.user('Grand_C')];
  // Un nouveau joueur sans historique contribue tout de suite ; un joueur qui change de guilde attend 24 h.
  await s.call('POST', '/api/guilds', { name: 'Petite', emblem: 'icon_star' }, a);
  assert.equal((await s.call('POST', '/api/worldboss/report', { mode: 'global', damage: 1e9, power: 1e6 }, a)).body.counted, true, 'fondateur sans historique');
  await s.call('POST', '/api/guilds', { name: 'Autre', emblem: 'icon_gem' }, c);
  await s.call('POST', '/api/guild/leave', {}, c);
  await s.call('POST', '/api/worldboss/report', { mode: 'global', damage: 1, power: 1e6 }, b); // b a un historique
  await s.call('POST', '/api/guild/join', { name: 'Petite' }, b);
  s.advance(3600000);
  const r = await s.call('POST', '/api/worldboss/report', { mode: 'global', damage: 1e9, power: 1e6 }, b);
  assert.equal(r.body.counted, false, 'verrou : changement de guilde, la contribution ne compte pas tout de suite');
  s.advance(GUILD_RULES.switchLockMs + 86400000);
  for (const tok of [a, b]) assert.equal((await s.call('POST', '/api/worldboss/report', { mode: 'global', damage: 1e9, power: 1e6 }, tok)).body.counted, true);
  await s.call('POST', '/api/worldboss/report', { mode: 'global', damage: 1e9, power: 1e6 }, c); // sans guilde
  const rk = (await s.call('GET', '/api/worldboss/ranking?mode=global')).body;
  assert.equal(rk.guilds.length, 1);
  assert.equal(rk.guilds[0].score, Math.floor(3e9 / GUILD_RULES.topN), 'moyenne sur les N meilleurs places (pas la somme brute) : A (2 jours) + B (après le verrou)');
  assert.equal(rk.guilds[0].contributors, 2);
  const mine = (await s.call('GET', '/api/guild', undefined, a)).body;
  assert.ok(mine.members.every((m) => m.contrib >= 1), 'contribution affichée par membre');
  assert.equal(mine.weekly.goal, GUILD_RULES.weeklyGoal);
});
