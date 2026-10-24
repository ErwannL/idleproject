// Petit serveur statique sans dépendance : `npm start` puis ouvrir http://localhost:5173
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

export function startServer(port = Number(process.env.PORT) || 5173, host = '127.0.0.1') {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let path = normalize(join(ROOT, decodeURIComponent(url.pathname)));
      if (path !== ROOT && !path.startsWith(ROOT + sep)) {
        res.writeHead(403).end();
        return;
      }
      let info = await stat(path).catch(() => null);
      if (info?.isDirectory()) {
        path = join(path, 'index.html');
        info = await stat(path).catch(() => null);
      }
      if (!info) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Introuvable');
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      createReadStream(path).pipe(res);
    } catch {
      res.writeHead(500).end();
    }
  });
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolvePromise(server));
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await startServer();
  const { port } = server.address();
  console.log(`Idle RPG : http://localhost:${port}  (Ctrl+C pour arrêter)`);
}
