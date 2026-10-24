// Exporte les sprites (définis dans src/render/sprites.js) en fichiers PNG :
//   assets/sprites/<nom>.png  (taille réelle)
//   assets/spritesheet.png    (planche de prévisualisation ×4)
//   assets/icon.png           (icône 128 px, favicon et fenêtre)
//   build/icon.png            (icône 256 px de l'exécutable Windows)
// Le rendu passe par le même code que le jeu, dans Chromium (Playwright).
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));

const server = await startServer(0);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:${server.address().port}/tools/blank.html`);

const files = await page.evaluate(async () => {
  const { SPRITES } = await import('/src/render/sprites.js');
  const { spriteCanvas, heroComposite } = await import('/src/render/pixel.js');
  const { ITEM_BASES } = await import('/src/data/items.js');
  const out = {};
  const toData = (canvas) => canvas.toDataURL('image/png').split(',')[1];

  for (const name of Object.keys(SPRITES)) out[`sprites/${name}.png`] = toData(spriteCanvas(name));

  // Planche : chaque sprite agrandi ×4 avec son nom.
  const names = Object.keys(SPRITES);
  const cell = { w: 120, h: 110 };
  const cols = 8;
  const sheet = document.createElement('canvas');
  sheet.width = cols * cell.w;
  sheet.height = Math.ceil(names.length / cols) * cell.h;
  const ctx = sheet.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#2b2238';
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.font = '11px sans-serif';
  names.forEach((name, i) => {
    const img = spriteCanvas(name);
    const scale = Math.max(1, Math.min(4, Math.floor(80 / Math.max(img.width, img.height))));
    const x = (i % cols) * cell.w;
    const y = Math.floor(i / cols) * cell.h;
    ctx.drawImage(img, x + (cell.w - img.width * scale) / 2, y + 6 + (80 - img.height * scale), img.width * scale, img.height * scale);
    ctx.fillStyle = '#ece6f5';
    ctx.fillText(name, x + 6, y + cell.h - 10);
  });
  out['spritesheet.png'] = toData(sheet);

  // Icône : héros équipé, agrandi.
  const gear = (id, rarity) => ({ ...ITEM_BASES.find((b) => b.id === id), baseId: id, rarity });
  const hero = heroComposite('idle', {
    weapon: gear('short_sword', 'legendary'),
    helmet: gear('iron_helm', 'epic'),
    armor: gear('cloth_tunic', 'rare'),
  });
  // Rectangle englobant les pixels opaques du chevalier composé.
  const opaqueBox = (canvas) => {
    const { data, width, height } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let x0 = width, y0 = height, x1 = -1, y1 = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  };
  const drawIcon = (size) => {
    const icon = document.createElement('canvas');
    icon.width = size;
    icon.height = size;
    const ictx = icon.getContext('2d');
    ictx.imageSmoothingEnabled = false;
    ictx.fillStyle = '#2b2238';
    ictx.beginPath();
    ictx.roundRect(0, 0, size, size, size / 6.4);
    ictx.fill();
    // Chevalier recadré (cape, corps, épée), agrandi d'un facteur entier pour rester net.
    const crop = opaqueBox(hero);
    const scale = Math.floor((size * 0.86) / Math.max(crop.w, crop.h));
    const w = crop.w * scale;
    const h = crop.h * scale;
    ictx.drawImage(hero, crop.x, crop.y, crop.w, crop.h, (size - w) / 2, (size - h) / 2, w, h);
    return toData(icon);
  };
  out['icon.png'] = drawIcon(128);
  out['../build/icon.png'] = drawIcon(256);
  return out;
});

await mkdir(`${ROOT}/assets/sprites`, { recursive: true });
await mkdir(`${ROOT}/build`, { recursive: true });
for (const [path, base64] of Object.entries(files)) {
  await writeFile(`${ROOT}/assets/${path}`, Buffer.from(base64, 'base64'));
}
console.log(`${Object.keys(files).length} fichiers PNG écrits dans assets/ et build/`);
await browser.close();
server.close();
