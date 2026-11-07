// v9.2.8 : rendu par le VRAI code du jeu (hero-draw.js drawHeroPick, arme heroHeldWeapon à la couleur de rareté)
// d'animations du héros : actuelles (ALLY_ANIMS) ou d'essai (work/prep/<anim>.json, personnages du joueur).
// Usage : node render.mjs spec.json out.json  — spec : [{id, palette, src:'game'|'prep', key, anim, weapon, frames?}]
// Sortie : out.json [{id, i, w, h, rgba(base64), held}] — rendu 140x110, sprite posé en (30, 20).
import fs from 'node:fs';
const ROOT = new URL('../../../', import.meta.url).pathname;
const { installSoftCanvas, SoftCanvas } = await import(`${ROOT}/tests/helpers/softcanvas.js`);
installSoftCanvas();
const P = await import(`${ROOT}/src/render/pixel.js`);
const A = await import(`${ROOT}/src/render/ally-anim.js`);
const D = await import(`${ROOT}/src/render/hero-draw.js`);
const { SPRITES } = await import(`${ROOT}/src/render/sprites.js`);
const PREP = `${process.env.PL_WORK ?? new URL('./work', import.meta.url).pathname}/prep/`;
// images animées du jeu (comme au chargement)
Object.assign(SPRITES, A.decodeAllyFrames());
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = [];
const loaded = {};
function prepAnim(name) {
  if (loaded[name]) return loaded[name];
  const j = JSON.parse(fs.readFileSync(`${PREP}${name}.json`, 'utf8'));
  const frames = j.frames.map((rows, i) => { const k = `trial_${name}_${i}`; SPRITES[k] = { rows, pal: j.pal }; return k; });
  const anim = { frames, ox: j.ox, oy: j.oy, fps: j.kind === 'attack' ? 24 : 12, hit: j.hit ?? 0 };
  if (j.w) anim.w = j.w.map((p) => (j.kind === 'attack' || j.kind === 'staff' ? [p[0], p[1], p[2], 0] : [p[0], p[1]]));
  return (loaded[name] = anim);
}
for (const s of spec) {
  const anim = s.src === 'prep' ? prepAnim(s.anim) : A.ALLY_ANIMS[s.key][s.anim];
  const idx = s.frames ?? anim.frames.map((_, i) => i);
  for (const i of idx) {
    const cv = new SoftCanvas(140, 110);
    const pick = { name: anim.frames[i], ox: anim.ox, oy: anim.oy, weapon: A.weaponPose(anim, i), anim, head: s.src === 'game' ? A.knightHead(anim, i) : null };
    const eq = { weapon: s.weapon };
    const held = D.drawHeroPick(cv.getContext('2d'), pick, eq, s.palette, 30, 20, { weapon: s.noWeapon ? false : undefined });
    out.push({ id: s.id, i, w: cv.width, h: cv.height, rgba: Buffer.from(cv.data).toString('base64'), behind: held?.behind ?? null });
  }
}
fs.writeFileSync(process.argv[3], JSON.stringify(out));
console.log(out.length, 'images');
