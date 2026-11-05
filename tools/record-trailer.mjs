// Bande-annonce du site : `node tools/record-trailer.mjs` puis ouvrir http://127.0.0.1:5199/tools/trailer.html?record
// La page envoie chaque image (JPEG) ; ffmpeg (celui de Playwright, ou FFMPEG=…) encode en VP9
// → site/assets/trailer.webm (+ affiche trailer-poster.jpg).
import { spawn } from 'node:child_process';
import { createWriteStream, readdirSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const statics = await startServer(5198);
const FILES = { '/save/trailer.webm': 'site/assets/trailer.webm', '/save/trailer-poster.jpg': 'site/assets/trailer-poster.jpg' };

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  const dir = `${homedir()}/AppData/Local/ms-playwright`;
  const last = readdirSync(dir).filter((d) => d.startsWith('ffmpeg-')).sort().pop();
  return `${dir}/${last}/ffmpeg-win64.exe`;
}
let encoder = null;
const FRAMES = `${tmpdir()}/trailer-frames.mjpeg`;

createServer(async (req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/video/')) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    // Les images s'accumulent dans un seul fichier, lu ensuite par ffmpeg (pas d'entrée par tube dans ce build).
    if (req.url === '/video/start') {
      encoder = createWriteStream(FRAMES);
    } else if (req.url === '/video/frame') {
      if (!encoder.write(Buffer.concat(chunks))) await new Promise((ok) => encoder.once('drain', ok));
    } else if (req.url === '/video/end') {
      await new Promise((ok) => encoder.end(ok));
      const ff = spawn(ffmpegPath(), ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '30', '-i', FRAMES,
        '-c:v', 'libvpx-vp9', '-b:v', '2500k', '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', ROOT + 'site/assets/trailer.webm'], { stdio: 'inherit' });
      await new Promise((ok) => ff.on('close', ok));
      await rm(FRAMES);
      console.log('écrit site/assets/trailer.webm');
    }
    return res.writeHead(204).end();
  }
  const target = FILES[req.url];
  if (req.method === 'POST' && target) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    await writeFile(ROOT + target, Buffer.concat(chunks));
    console.log(`écrit ${target} (${Buffer.concat(chunks).length} octets)`);
    return res.writeHead(204).end();
  }
  // Le reste est relayé au serveur statique.
  const up = await fetch(`http://127.0.0.1:${statics.address().port}${req.url}`);
  res.writeHead(up.status, { 'Content-Type': up.headers.get('content-type') || 'application/octet-stream' });
  res.end(Buffer.from(await up.arrayBuffer()));
}).listen(5199, '127.0.0.1', () => console.log('http://127.0.0.1:5199/tools/trailer.html'));
