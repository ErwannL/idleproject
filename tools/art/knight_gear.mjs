// v9.2.4 : tête du chevalier PixelLab suivie image par image, pour poser le casque VRAIMENT porté sur ses animations
// (comme l'arme, tools/art/weapon_anchor.py). Modèle : casque et visage de la vue de repos (première image de
// attack_knight, alignée sur le héros composé), sans le plumet ; cherché dans chaque image en position et en
// inclinaison (rotation libre au plus proche voisin autour du centre de la tête, comme rotateFree de pixel.js).
// Écrit src/render/knight-gear.js : pivot de la tête au repos, ligne du cou, et pour chaque animation du chevalier
// une entrée [x, y, angle] par image (coin du sprite de jeu). Usage : node tools/art/knight_gear.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { decodeAllyFrames, ALLY_ANIMS } = await import(path.join(ROOT, 'src/render/ally-anim.js'));
const { SPRITES } = await import(path.join(ROOT, 'src/render/sprites.js'));
const F = decodeAllyFrames();
const PLUME = new Set(['K', '4', '8']);
const set = ALLY_ANIMS.hero_knight;
const col = (f, x, y) => { const r = f.rows[y]; const c = r && r[x]; return !c || c === '.' ? null : f.pal[c] ?? c; };

// Modèle : pixels opaques de la vue de repos sous le masque du casque de base (casque composé à (10, 16 + oy)).
const helm = SPRITES.helmet_default, HX = 10, HY = 16 + (helm.oy ?? 0);
const ref = set.attack_knight, f0 = F[ref.frames[0]];
const tpl = [];
helm.rows.forEach((r, y) => [...r].forEach((c, x) => {
  if (c === '.') return;
  const gx = HX + x, gy = HY + y, lx = gx - ref.ox, ly = gy - ref.oy;
  const ch = f0.rows[ly]?.[lx];
  if (!ch || ch === '.' || PLUME.has(ch) || ch === 'b' || ch === 'c') return;
  tpl.push({ gx, gy, c: f0.pal[ch] });
}));
const P0 = [tpl.reduce((s, p) => s + p.gx, 0) / tpl.length, tpl.reduce((s, p) => s + p.gy, 0) / tpl.length].map(Math.round);
const neck = Math.max(...tpl.map((p) => p.gy)) - P0[1];
const rel = tpl.map((p) => ({ u: p.gx - P0[0], v: p.gy - P0[1], c: p.c }));

function track(anim, degs, R) {
  let prev = null;
  return anim.frames.map((name) => {
    const f = F[name];
    let best = [-1];
    const cands = prev ? degs.filter((d) => Math.abs(d - prev[2]) <= 30) : degs;
    for (const deg of cands) {
      const a = (deg * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a);
      const pts = rel.map((p) => [Math.round(p.u * cs - p.v * sn), Math.round(p.u * sn + p.v * cs), p.c]);
      const cx = prev ? prev[0] : P0[0], cy = prev ? prev[1] : P0[1];
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const px = cx + dx, py = cy + dy;
        let s = 0;
        for (const [u, v, c] of pts) if (col(f, px + u - anim.ox, py + v - anim.oy) === c) s++;
        s -= 0.02 * (Math.abs(deg) + Math.abs(dx) + Math.abs(dy)); // à égalité : la pose la plus proche
        if (s > best[0]) best = [s, px, py, deg];
      }
    }
    prev = best.slice(1);
    return [best[1], best[2], best[3], Math.round((100 * Math.max(0, best[0])) / rel.length)];
  });
}
const out = {};
const land = Array.from({ length: 13 }, (_, i) => -30 + i * 5);
for (const [k, a] of Object.entries(set)) {
  if (k === 'swim') {
    // Nage : le corps est couché (tête devant, à droite) ; première image cherchée dans tout le cadre.
    // Nage : corps couché, tête devant (à droite) et d'un autre dessin que la vue debout : la tête est le centre
    // des pixels d'acier et de visage des 14 colonnes de droite du corps, sommet du crâne vers l'avant (90°).
    out[k] = a.frames.map((name) => {
      const f = F[name];
      let x1 = 0;
      f.rows.forEach((r) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') x1 = Math.max(x1, x); });
      let sx = 0, sy = 0, n = 0;
      f.rows.forEach((r, y) => { for (let x = x1 - 13; x <= x1; x++) { const c = r[x]; if (c && c !== '.' && c !== 'b' && c !== 'c' && !PLUME.has(c)) { sx += x; sy += y; n++; } } });
      return [Math.round(sx / n) + a.ox, Math.round(sy / n) + a.oy, 90, 100];
    });
  } else out[k] = track(a, land, 9);
}
// Lissage léger (moyenne 1-2-1 de l'angle et de la position) sans toucher la première ni la dernière image.
for (const k of Object.keys(out)) {
  const s = out[k], loop = k === 'walk' || k === 'swim';
  out[k] = s.map((p, i) => {
    if (!loop && (i === 0 || i === s.length - 1)) return p.slice(0, 3);
    const a = s[(i - 1 + s.length) % s.length], b = s[(i + 1) % s.length];
    return [0, 1, 2].map((j) => Math.round((a[j] + 2 * p[j] + b[j]) / 4));
  });
  console.log(k.padEnd(18), s.map((p) => `${p[0]},${p[1]},${p[2]}°(${p[3]}%)`).join(' '));
}
const js = `// FICHIER GÉNÉRÉ par tools/art/knight_gear.mjs — ne pas modifier à la main.
// v9.2.4 : tête du chevalier PixelLab suivie image par image (casque porté posé sur l'animation).
// pivot : centre de la tête au repos (coin du sprite de jeu) ; neck : ligne du cou sous le pivot ;
// heads[anim][i] = [x, y, angle] : position du pivot et inclinaison (degrés horaires) de la tête à l'image i.
export const KNIGHT_HEAD = ${JSON.stringify({ pivot: P0, neck, heads: out })};
`;
fs.writeFileSync(path.join(ROOT, 'src/render/knight-gear.js'), js);
console.log('pivot', P0, 'cou', neck, 'modèle', rel.length, 'px');
