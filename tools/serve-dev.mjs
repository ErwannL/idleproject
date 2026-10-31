// Lance la version dev en local : `npm run serve:dev` → http://127.0.0.1:8790/play/
// Base et API séparées de la production ; la version dev n'envoie rien au cloud.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/index.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
process.env.WEB_DIR ??= resolve(ROOT, 'dist', 'web-dev');
process.env.PORT ??= '8790';
process.env.DB_FILE ??= resolve(ROOT, 'data', 'dev.sqlite');
startServer();
