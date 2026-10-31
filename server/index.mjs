// Point d'entrée : `node server/index.mjs`. Configuration par variables d'environnement (voir .env.example).
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.mjs';
import { openDatabase } from './db.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

export function startServer({
  port = Number(process.env.PORT) || 8787,
  host = process.env.HOST || '127.0.0.1',
  dbFile = process.env.DB_FILE || resolve(ROOT, 'data', 'games.sqlite'),
  siteDir = process.env.SITE_DIR || resolve(ROOT, 'site'),
  webDir = process.env.WEB_DIR || resolve(ROOT, 'dist', 'web'),
  trustProxy = process.env.TRUST_PROXY === '1',
  adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || '',
} = {}) {
  const db = openDatabase(dbFile);
  const log = (line) => console.log(`${new Date().toISOString()} ${line}`);
  const server = createServer(createApp({ db, siteDir, webDir, trustProxy, adminPasswordHash, log }));
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
