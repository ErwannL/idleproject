// Préinscrits déjà présents avant les emails : leur crée un code de parrainage et un jeton de confirmation, puis leur
// envoie l'email de confirmation, par petits lots (limites d'envoi respectées : MAIL_LIMITS de server/mailer.mjs).
// À lancer une seule fois, à la main, sur le serveur, avec les variables de /etc/idle-rpg.env :
//   node tools/prereg-backfill.mjs                 → simulation : compte ce qui serait fait, n'écrit et n'envoie rien
//   node tools/prereg-backfill.mjs --send --lot 100 → crée les codes et envoie au plus 100 emails (relancer le lendemain pour la suite)
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../server/db.mjs';
import { newRefCode } from '../server/app.mjs';
import { MAIL_LIMITS, confirmationEmail, createMailer } from '../server/mailer.mjs';

const args = process.argv.slice(2);
const send = args.includes('--send');
const lot = Math.min(MAIL_LIMITS.perDay, Number(args[args.indexOf('--lot') + 1]) || 100);
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const db = openDatabase(process.env.DB_FILE || resolve(ROOT, 'data', 'games.sqlite'));
const log = (l) => console.log(l);

const missing = db.prepare('SELECT email FROM preregistrations WHERE ref IS NULL OR confirm_token IS NULL').all();
const waiting = db.prepare('SELECT COUNT(*) AS n FROM preregistrations WHERE confirmed_at IS NULL AND mailed_at IS NULL').get().n;
console.log(`${missing.length} préinscrit(s) sans code ni jeton · ${waiting} sans email de confirmation · lot : ${lot}`);
if (!send) { console.log('Simulation seulement : ajoute --send pour écrire et envoyer.'); process.exit(0); }
if (!process.env.BREVO_API_KEY) { console.log('BREVO_API_KEY absente : rien n\'est envoyé.'); process.exit(1); }

const setCodes = db.prepare('UPDATE preregistrations SET ref = COALESCE(ref, ?), confirm_token = COALESCE(confirm_token, ?) WHERE email = ?');
for (const { email } of missing) {
  for (let i = 0; i < 8; i++) { try { setCodes.run(newRefCode(), randomBytes(24).toString('base64url'), email); break; } catch (e) { if (i === 7) throw e; } }
}
const mailer = createMailer({ apiKey: process.env.BREVO_API_KEY, from: process.env.MAIL_FROM, baseUrl: process.env.PUBLIC_BASE_URL || 'https://ascendrya.com', log });
const rows = db.prepare('SELECT email, ref, confirm_token, lang FROM preregistrations WHERE confirmed_at IS NULL AND mailed_at IS NULL ORDER BY consent_at LIMIT ?').all(lot);
const count = db.prepare('SELECT COUNT(*) AS n FROM preregistrations WHERE referrer = ? AND confirmed_at IS NOT NULL');
const mark = db.prepare('UPDATE preregistrations SET mailed_at = ? WHERE email = ?');
let ok = 0;
for (const r of rows) {
  const m = confirmationEmail({ lang: r.lang ?? 'fr', baseUrl: mailer.baseUrl, token: r.confirm_token, ref: r.ref, count: count.get(r.ref).n });
  if (await mailer.send({ to: r.email, ...m })) { mark.run(Date.now(), r.email); ok += 1; }
  else break; // limite atteinte ou erreur : on s'arrête, la suite partira au prochain lancement
  await new Promise((res) => setTimeout(res, 300));
}
console.log(`${ok} email(s) envoyé(s) sur ${rows.length}.`);
db.close();
