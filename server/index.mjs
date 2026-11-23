// Point d'entrée : `node server/index.mjs`. Configuration par variables d'environnement (voir .env.example).
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.mjs';
import { openDatabase } from './db.mjs';
import { createMailer } from './mailer.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

export function startServer({
  port = Number(process.env.PORT) || 8787,
  host = process.env.HOST || '127.0.0.1',
  dbFile = process.env.DB_FILE || resolve(ROOT, 'data', 'games.sqlite'),
  siteDir = process.env.SITE_DIR || resolve(ROOT, 'site'),
  webDir = process.env.WEB_DIR || resolve(ROOT, 'dist', 'web'),
  uploadsDir = process.env.UPLOADS_DIR || resolve(ROOT, 'data', 'uploads'),
  trustProxy = process.env.TRUST_PROXY === '1',
  adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || '',
  gameWeb = process.env.GAME_WEB === '1',
} = {}) {
  const db = openDatabase(dbFile);
  const log = (line) => console.log(`${new Date().toISOString()} ${line}`);
  // Emails de la préinscription (Brevo) : clé et adresses dans /etc/idle-rpg.env, jamais dans le dépôt.
  const mailer = createMailer({ apiKey: process.env.BREVO_API_KEY || '', from: process.env.MAIL_FROM || 'Ascendrya <contact@ascendrya.com>', baseUrl: process.env.PUBLIC_BASE_URL || 'https://ascendrya.com', log });
  if (!process.env.BREVO_API_KEY) log('BREVO_API_KEY absente : les emails de préinscription sont seulement journalisés');
  const server = createServer(createApp({ db, siteDir, webDir, uploadsDir, trustProxy, adminPasswordHash, gameWeb, log, mailer }));
  server.listen(port, host, () => log(`écoute sur ${host}:${port}`));
  const close = () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startServer();
