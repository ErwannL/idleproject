// v10.0 (9.2) : exporte toutes les images des animations des alliés (base + supplémentaires) en JSON :
// { sprite: { anim: { ox, oy, frames: [ { w, h, px: [[r,g,b,a]…] } ] } } } — lu par tools/art/check_anims.py.
// Usage : node tools/art/dump_ally_frames.mjs <sortie.json>
import { writeFile } from 'node:fs/promises';
import * as base from '../../src/render/art-anim-allies.js';
import * as extra from '../../src/render/art-anim-allies-extra.js';
import { expandRow } from '../../src/render/sprites.js';
const out = {};
for (const m of [base, extra]) {
  for (const [sprite, anims] of Object.entries(m.ALLY_ANIMS)) {
    if (!sprite.startsWith('ally_') && !sprite.startsWith('pet_')) continue;
    for (const [name, a] of Object.entries(anims)) {
      let prev = null;
      const frames = a.frames.map((f) => {
        const art = m.ALLY_ANIM_ART[f];
        const rows = art.rows.map((r, y) => (r === '' && prev ? prev[y] : expandRow(r)));
        prev = rows;
        const pal = m.ALLY_ANIM_PALS[art.pr];
        return { rows: rows.map((r) => (Array.isArray(r) ? r.join('') : r)), pal };
      });
      (out[sprite] ??= {})[name] = { ox: a.ox, oy: a.oy, frames };
    }
  }
}
await writeFile(process.argv[2] ?? 'ally-frames.json', JSON.stringify(out));
console.log(Object.keys(out).length, 'personnages');
