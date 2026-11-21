// v10.7 (6 bis) : sprite de repos de chaque héros jouable, tel que le combat le dessine (palette et apparence comprises),
// sans équipement → tools/art/pixellab107/skins/ref_<id>.png. Usage : node tools/art/dump_skin_refs.mjs
import { createRequire } from 'node:module';
import { writeFile, mkdir } from 'node:fs/promises';
import { startServer } from '../serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = await startServer(0);
const b = await chromium.launch(); const page = await b.newPage();
await page.goto(`http://localhost:${server.address().port}/tools/blank.html`);
const out = await page.evaluate(async () => {
  const { HEROES } = await import('/src/data/heroes.js');
  const P = await import('/src/render/pixel.js');
  const { makeItem } = await import('/src/core/loot.js');
  const { createNewState } = await import('/src/core/state.js');
  const st = createNewState(Date.now());
  // v10.7 : les héros de base tiennent l'arme de leur classe (le Berserker la hache, le Chevalier dragon la lance…).
  const WEAPON = { knight: 'short_sword', paladin: 'war_hammer', guardian: 'mace', fortune_knight: 'short_sword', berserker: 'battle_axe', dragon_knight: 'spear' };
  const res = {};
  for (const h of HEROES) {
    const eq = WEAPON[h.id] ? { weapon: makeItem(st, WEAPON[h.id], 'epic', 10) } : {};
    const c = P.heroComposite(0, eq, false, 'a', h.palette ?? null, false);
    res[h.id] = c.toDataURL('image/png');
  }
  return res;
});
await mkdir('tools/art/pixellab107/skins', { recursive: true });
for (const [id, url] of Object.entries(out)) await writeFile(`tools/art/pixellab107/skins/ref_${id}.png`, Buffer.from(url.split(',')[1], 'base64'));
console.log(Object.keys(out).join(' '));
await b.close(); server.close();
