// Exporte les sprites (définis dans src/render/sprites.js) en fichiers PNG :
//   assets/sprites/<nom>.png  (taille réelle)
//   assets/spritesheet.png    (planche de prévisualisation ×4)
//   assets/icon.png           (icône 128 px, utilisée comme favicon)
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
  const hero = heroComposite('attack', {
    weapon: gear('short_sword', 'legendary'),
    helmet: gear('iron_helm', 'epic'),
    armor: gear('cloth_tunic', 'rare'),
  });
  const icon = document.createElement('canvas');
  icon.width = 128;
  icon.height = 128;
  const ictx = icon.getContext('2d');
  ictx.imageSmoothingEnabled = false;
  ictx.fillStyle = '#2b2238';
  ictx.beginPath();
  ictx.roundRect(0, 0, 128, 128, 20);
  ictx.fill();
  ictx.drawImage(hero, 0, 0, 24, 20, 4, 18, 120, 100);
  out['icon.png'] = toData(icon);
  return out;
});

await mkdir(`${ROOT}/assets/sprites`, { recursive: true });
for (const [path, base64] of Object.entries(files)) {
  await writeFile(`${ROOT}/assets/${path}`, Buffer.from(base64, 'base64'));
}
console.log(`${Object.keys(files).length} fichiers PNG écrits dans assets/`);
await browser.close();
server.close();
