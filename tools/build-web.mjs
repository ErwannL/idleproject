// Prépare la version web du jeu pour le serveur : `npm run build:web` → dist/web (servi sur /play/).
// Copie uniquement ce que le navigateur charge : index.html, src/, assets/.
import { cp, rm, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = resolve(ROOT, 'dist', 'web');

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp(resolve(ROOT, 'index.html'), resolve(OUT, 'index.html'));
await cp(resolve(ROOT, 'src'), resolve(OUT, 'src'), { recursive: true });
await cp(resolve(ROOT, 'assets'), resolve(OUT, 'assets'), { recursive: true });
console.log(`Version web prête : ${OUT}`);
