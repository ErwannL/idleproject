// Prépare la version web du jeu : `npm run build:web` → dist/web (version publique, servie sur /play/).
// `npm run build:dev` → dist/web-dev : version dev, codes de triche actifs, pas de synchro cloud.
// Copie uniquement ce que le navigateur charge : index.html, src/, assets/.
import { cp, rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEV = process.argv.includes('--dev');
const OUT = resolve(ROOT, 'dist', DEV ? 'web-dev' : 'web');

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp(resolve(ROOT, 'index.html'), resolve(OUT, 'index.html'));
await cp(resolve(ROOT, 'src'), resolve(OUT, 'src'), { recursive: true });
await cp(resolve(ROOT, 'assets'), resolve(OUT, 'assets'), { recursive: true });

if (DEV) {
  // Seul fichier réécrit : les valeurs de build. Le reste du code est identique à la version publique.
  const file = resolve(OUT, 'src', 'core', 'build-info.js');
  const source = await readFile(file, 'utf8');
  const dev = source
    .replace("name: 'public'", "name: 'dev'")
    .replace('cheats: false', 'cheats: true')
    .replace('cloud: true', 'cloud: false');
  if (dev === source) throw new Error('build-info.js : valeurs introuvables');
  await writeFile(file, dev);
}
console.log(`Version ${DEV ? 'dev' : 'publique'} prête : ${OUT}`);
