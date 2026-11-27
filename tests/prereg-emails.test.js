// Emails de la préinscription (Brevo) : confirmation, parrainage, limites, échecs, désinscription. Service d'envoi simulé.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createApp } from '../server/app.mjs';
import { openDatabase } from '../server/db.mjs';
import { MAIL_LIMITS, createMailer, parseFrom } from '../server/mailer.mjs';

const HOUR = 3600_000;
async function setup({ fail = false, limits } = {}) {
  let clock = Date.UTC(2026, 10, 23, 10);
  const sent = [];
  const transport = async (msg) => { if (fail) throw new Error('panne'); sent.push(msg); };
  const logs = [];
  const mailer = createMailer({ from: 'Ascendrya <contact@ascendrya.com>', baseUrl: 'https://ascendrya.com/', transport, now: () => clock, log: (l) => logs.push(l), limits });
  const db = openDatabase(':memory:');
  const server = createServer(createApp({ db, siteDir: '', webDir: '', now: () => clock, mailer, log: (l) => logs.push(l) }));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  return { db, call, sent, logs, advance: (ms) => { clock += ms; }, close: async () => { server.close(); await once(server, 'close').catch(() => {}); db.close(); } };
}
const tokenOf = (s, email) => s.db.prepare('SELECT confirm_token FROM preregistrations WHERE email = ?').get(email).confirm_token;

test('emails : MAIL_FROM lu, limites sous les 300 par jour de Brevo', () => {
  assert.deepEqual(parseFrom('Ascendrya <contact@ascendrya.com>'), { name: 'Ascendrya', email: 'contact@ascendrya.com' });
  assert.ok(MAIL_LIMITS.perDay <= 250 && MAIL_LIMITS.perHour < MAIL_LIMITS.perDay);
});

test('emails : nouvelle inscription → un email avec le lien de confirmation et le lien de parrainage', async (t) => {
  const s = await setup(); t.after(() => s.close());
  const r = await s.call('POST', '/api/preregister', { email: 'Nouveau@Exemple.fr', consent: true, lang: 'fr' });
  assert.equal(r.status, 202);
  assert.equal(s.sent.length, 1);
  const m = s.sent[0];
  assert.deepEqual(m.sender, { name: 'Ascendrya', email: 'contact@ascendrya.com' });
  assert.deepEqual(m.to, [{ email: 'nouveau@exemple.fr' }]);
  assert.equal(m.subject, 'Confirme ta préinscription à Ascendrya');
  const tok = tokenOf(s, 'nouveau@exemple.fr');
  assert.ok(m.htmlContent.includes(`https://ascendrya.com/?confirm=${tok}`), 'lien de confirmation');
  assert.ok(m.htmlContent.includes(`https://ascendrya.com/?ref=${r.body.ref}`), 'lien de parrainage');
  assert.ok(m.textContent.includes('?unsubscribe='), 'version texte avec la désinscription');
  // Anglais
  await s.call('POST', '/api/preregister', { email: 'new@example.com', consent: true, lang: 'en' });
  assert.equal(s.sent[1].subject, 'Confirm your Ascendrya pre-registration');
});

test('emails : même adresse deux fois dans l\'heure → un seul email ; adresse confirmée → plus d\'email', async (t) => {
  const s = await setup(); t.after(() => s.close());
  await s.call('POST', '/api/preregister', { email: 'a@exemple.fr', consent: true });
  s.advance(10 * 60_000);
  await s.call('POST', '/api/preregister', { email: 'a@exemple.fr', consent: true });
  assert.equal(s.sent.length, 1);
  s.advance(HOUR);
  await s.call('POST', '/api/preregister', { email: 'a@exemple.fr', consent: true });
  assert.equal(s.sent.length, 2, 'renvoyé après une heure');
  await s.call('GET', `/api/preregister/confirm?token=${tokenOf(s, 'a@exemple.fr')}`);
  s.advance(2 * HOUR);
  await s.call('POST', '/api/preregister', { email: 'a@exemple.fr', consent: true });
  assert.equal(s.sent.length, 2, 'adresse confirmée : rien de plus');
});

test('emails : envoi en échec → l\'inscription réussit quand même (202 + code), erreur journalisée sans l\'adresse', async (t) => {
  const s = await setup({ fail: true }); t.after(() => s.close());
  const r = await s.call('POST', '/api/preregister', { email: 'panne@exemple.fr', consent: true });
  assert.equal(r.status, 202);
  assert.match(r.body.ref, /^[A-HJ-NP-Z2-9]{6}$/);
  assert.ok(s.logs.some((l) => /échec de l'envoi/.test(l)));
  assert.ok(!s.logs.some((l) => l.includes('panne@exemple.fr')), 'jamais l\'adresse en clair');
});

test('emails : limite globale par heure', async (t) => {
  const s = await setup({ limits: { ...MAIL_LIMITS, perHour: 2 } }); t.after(() => s.close());
  for (let i = 0; i < 4; i++) await s.call('POST', '/api/preregister', { email: `x${i}@exemple.fr`, consent: true });
  assert.equal(s.sent.length, 2);
  assert.ok(s.logs.some((l) => /limite d'envoi/.test(l)));
});

test('emails : confirmation → le parrain passe de 0 à 1 et reçoit « un ami t\'a rejoint » (un par jour)', async (t) => {
  const s = await setup(); t.after(() => s.close());
  const p = await s.call('POST', '/api/preregister', { email: 'parrain@exemple.fr', consent: true });
  s.advance(2 * HOUR);
  await s.call('POST', '/api/preregister', { email: 'ami1@exemple.fr', consent: true, ref: p.body.ref });
  await s.call('POST', '/api/preregister', { email: 'ami2@exemple.fr', consent: true, ref: p.body.ref });
  const count = async () => (await s.call('GET', `/api/preregister/ref/${p.body.ref}`)).body.count;
  assert.equal(await count(), 0);
  const before = s.sent.length;
  await s.call('GET', `/api/preregister/confirm?token=${tokenOf(s, 'ami1@exemple.fr')}`);
  assert.equal(await count(), 1);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(s.sent.length, before + 1);
  assert.equal(s.sent.at(-1).to[0].email, 'parrain@exemple.fr');
  await s.call('GET', `/api/preregister/confirm?token=${tokenOf(s, 'ami2@exemple.fr')}`);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(await count(), 2);
  assert.equal(s.sent.length, before + 1, 'un seul email par jour au parrain');
});

test('emails : lien de désinscription → l\'adresse est supprimée ; jeton inconnu refusé', async (t) => {
  const s = await setup(); t.after(() => s.close());
  await s.call('POST', '/api/preregister', { email: 'stop@exemple.fr', consent: true });
  const tok = tokenOf(s, 'stop@exemple.fr');
  assert.equal((await s.call('POST', '/api/preregister/unsubscribe', { token: 'x'.repeat(20) })).body.ok, false);
  assert.equal((await s.call('POST', '/api/preregister/unsubscribe', { token: tok })).body.ok, true);
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM preregistrations').get().n, 0);
  assert.equal((await s.call('GET', '/api/preregister/confirm?token=inconnu-inconnu-123')).body.ok, false);
});

test('emails : sans BREVO_API_KEY rien ne part (journal seulement) ; aucun secret dans le dépôt', async () => {
  const logs = [];
  const m = createMailer({ apiKey: '', log: (l) => logs.push(l) });
  assert.equal(await m.send({ to: 'a@b.fr', subject: 's', html: 'h', text: 't' }), true);
  assert.match(logs[0], /pas de BREVO_API_KEY/);
  assert.match(readFileSync('.env.example', 'utf8'), /^BREVO_API_KEY=$/m);
  const site = readFileSync('site/site.js', 'utf8');
  assert.match(site, /mail\.confirmed/);
  assert.match(site, /api\/preregister\/unsubscribe/);
  assert.match(readFileSync('site/confidentialite.html', 'utf8'), /Brevo/);
});

test('préinscription : une adresse masquée recopiée (« m*********s@hotmail.fr ») est refusée, sans email ni inscription', async (t) => {
  const s = await setup(); t.after(() => s.close());
  const r = await s.call('POST', '/api/preregister', { email: 'm*********s@hotmail.fr', consent: true, lang: 'fr' });
  assert.equal(r.status, 400);
  assert.equal(s.sent.length, 0);
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM preregistrations').get().n, 0);
  const ok = await s.call('POST', '/api/preregister', { email: 'a*b@exemple.fr', consent: true, lang: 'fr' });
  assert.equal(ok.status, 202, 'une seule étoile reste autorisée (adresse valide)');
  const site = readFileSync(new URL('../site/site.js', import.meta.url), 'utf8');
  assert.match(site, /form\.errMasked/);
  for (const l of ['fr', 'en']) assert.match(readFileSync(new URL(`../site/i18n/${l}.js`, import.meta.url), 'utf8'), /errMasked:/);
});
