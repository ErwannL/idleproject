// v9.2.3 : grilles des armes de génération des animations du héros (rareté Commun, prise), pour
// tools/art/pixellab_allies.py (repérage de l'arme dans les images PixelLab). Usage : node tools/art/dump_weapons.mjs
import fs from 'node:fs';
import { BASE_PALETTE, SPRITES } from '../../src/render/sprites.js';
import { itemColors } from '../../src/render/pixel.js';
import { ITEM_BASES } from '../../src/data/items.js';
import { CLASSES } from '../../src/data/classes.js';

const out = {};
for (const c of CLASSES) {
  const base = ITEM_BASES.find((b) => b.slot === 'weapon' && b.sprite === c.weapons[0] && !b.signature);
  const s = SPRITES[`weapon_${base.sprite}`];
  const pal = { ...BASE_PALETTE, ...(s.pal ?? {}), ...itemColors({ baseId: base.id, rarity: 'common' }) };
  out[c.id] = { sprite: base.sprite, grip: s.grip, rows: s.rows.map((r) => [...r].map((ch) => (ch === '.' ? null : pal[ch]))) };
}
fs.writeFileSync(new URL('./pixellab/anim_allies/_ref/weapons.json', import.meta.url), JSON.stringify(out));
console.log(Object.entries(out).map(([k, v]) => `${k}:${v.sprite}`).join(' '));
