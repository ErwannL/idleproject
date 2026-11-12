// v9.2.5 : animations de compétence — geste propre au lanceur (PixelLab) et effet propre à la compétence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPANIONS } from '../src/data/companions.js';
import { companionSkillList } from '../src/data/companion-skills.js';
import { COMPANION_ROLES } from '../src/data/synergies.js';
import { SKILLS } from '../src/data/skills.js';
import { FX_NAMES, HERO_SKILL_MOTIFS, SKILL_ANIMS, UNIT_SKILL_MOTIFS, castHeroSkill, castUnitSkill, drawSkillFx, fxContext, gestureFrame, heroGesture, unitGesture } from '../src/render/skill-fx.js';
import { SPRITES } from '../src/render/sprites.js';
import { ALLY_ANIMS } from '../src/render/ally-anim.js';

const LOOKS = ['knight', 'demoness', 'fairy', 'grombar', 'ninja', 'seraph', 'valkyrie', 'vampire', 'witch'];

test('chaque compétence (héros, spéciales de classe, compagnons, ultimes compris) a un geste et un effet propres', () => {
  for (const s of [...SKILLS.map((x) => x.id), 'meteor', 'volley']) {
    const [motif, fx] = HERO_SKILL_MOTIFS[s];
    assert.ok(FX_NAMES.includes(fx), `${s} : effet ${fx}`);
    for (const look of LOOKS) assert.ok(SKILL_ANIMS[`hero_${look}`]?.[motif] ?? ALLY_ANIMS[`hero_${look}`]?.[motif], `hero_${look} : geste ${motif}`);
  }
  for (const c of COMPANIONS) {
    for (const sk of companionSkillList(c, COMPANION_ROLES[c.id] ?? 'pet')) {
      const entry = UNIT_SKILL_MOTIFS[c.sprite]?.[sk.name];
      assert.ok(entry, `${c.id} : ${sk.name}`);
      assert.ok(FX_NAMES.includes(entry[1]), `${c.id} : effet ${entry[1]}`);
      assert.ok(SKILL_ANIMS[c.sprite]?.[entry[0]], `${c.id} : geste ${entry[0]}`);
    }
  }
});

test('images des gestes chargées dans les SPRITES, même cadre d\'une image à l\'autre', () => {
  for (const anims of Object.values(SKILL_ANIMS)) {
    for (const a of Object.values(anims)) {
      assert.ok(a.frames.length >= 8);
      const w = SPRITES[a.frames[0]].rows[0].length;
      for (const f of a.frames) assert.equal(SPRITES[f].rows[0].length, w, f);
    }
  }
});

function fakeScene(focus = false) {
  const calls = [];
  return {
    time: 0, groundY: 120, focus, shake: 0, underwater: false, calls,
    layout: { slots: new Map([['archangel', { cx: 30 }]]) },
    wx: (x) => x * 1.5,
    hitReact: (id) => calls.push(['hit', id]),
    burst: () => calls.push(['burst']),
    dust: () => calls.push(['dust']),
  };
}

const fakeCtx = () => ({ globalAlpha: 1, fillStyle: '', rects: 0, fillRect() { this.rects += 1; } });
const world = { enemies: [{ id: 1, x: 100 }, { id: 2, x: 120 }] };

function play(scene, seconds) {
  const ctx = fakeCtx();
  for (let t = 0; t < seconds; t += 1 / 60) { scene.time = t; drawSkillFx(scene, ctx); }
  return ctx.rects;
}

test('météore : le geste du héros se joue, la météorite tombe puis frappe tous les ennemis avec une secousse', () => {
  const s = fakeScene();
  assert.ok(castHeroSkill(s, 'hero_knight', 'meteor', fxContext(s, world, { x: 50, y: 98 }, 50)));
  assert.ok(heroGesture(s), 'geste en cours');
  const drawn = play(s, 3);
  assert.ok(drawn > 200, 'effet dessiné');
  assert.deepEqual(s.calls.filter((c) => c[0] === 'hit').map((c) => c[1]).sort(), [1, 2]);
  assert.ok(s.shake >= 4);
  assert.equal(s.skillFx.length, 0, 'tout est fini');
  s.time = 5;
  assert.equal(heroGesture(s), null, 'geste terminé');
});

test('« Réduire les animations » : le geste reste, l\'effet est sobre (bien moins de pixels, aucune secousse)', () => {
  const full = fakeScene();
  const calm = fakeScene(true);
  const archangel = COMPANIONS.find((c) => c.id === 'archangel');
  for (const s of [full, calm]) castUnitSkill(s, archangel, 'Aile protectrice', 'heal', fxContext(s, world, { x: 30, y: 98 }, 50));
  assert.ok(unitGesture(calm, 'archangel'), 'geste gardé');
  const a = play(full, 3), b = play(calm, 3);
  assert.ok(b < a / 5, `sobre : ${b} contre ${a}`);
  assert.equal(calm.shake, 0);
});

test('image du geste : défile du début à la fin puis s\'arrête', () => {
  const anim = { frames: ['a', 'b', 'c', 'd'], fps: 4, ox: 1, oy: 2 };
  const g = { anim, start: 0, dur: 1 };
  assert.equal(gestureFrame(g, 0).name, 'a');
  assert.equal(gestureFrame(g, 0.8).name, 'd');
  assert.equal(gestureFrame(g, 1), null);
});

test('v9.2.5 : geste du barbare — même hache qu\'en marche et en attaque (geste à épée remplacé)', async () => {
  const F = await import('../src/render/skill-fx.js');
  const { ALLY_ANIMS } = await import('../src/render/ally-anim.js');
  for (const m of ['blade_dance', 'ground_smash']) assert.equal(F.unitSkillAnim('ally_barbarian', m), ALLY_ANIMS.ally_barbarian.attack);
  assert.ok(F.unitSkillAnim('ally_barbarian', 'roar'));
  assert.notEqual(F.unitSkillAnim('ally_mercenary', 'blade_dance'), ALLY_ANIMS.ally_mercenary.attack);
});

// v9.2.5 : visage des compagnons jamais caché par l'arme — attaque et gestes : dans la tête de chaque image (haut de
// la silhouette, même hauteur que la tête de marche), les couleurs de peau et des yeux présentes dans toutes les images
// de marche gardent au moins 40 % de leur surface. Écarts relevés et regardés (planche) : têtes de trois quarts gardées.
test('v9.2.5 : visage des compagnons visible sur toutes les images d\'attaque et de geste', async () => {
  const { SoftCanvas, installSoftCanvas } = await import('./helpers/softcanvas.js');
  installSoftCanvas();
  const P = await import('../src/render/pixel.js');
  const F = await import('../src/render/skill-fx.js');
  const W = 200, H = 160;
  const place = (a, f) => { const cv = new SoftCanvas(W, H); cv.getContext('2d').drawImage(P.heroAnimCanvas(f, null), 40 + a.ox, 30 + a.oy); return cv; };
  const skin = (d, i) => d[i] > 150 && d[i] > d[i + 2] + 30 && d[i + 1] > 90 && d[i] >= d[i + 1];
  const top = (cv) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (cv.data[(y * W + x) * 4 + 3] > 100) return y; return 0; };
  // v9.4.0 : Sorcière (attaque) regardée à l'œil : visage visible, le grand chapeau et l'orbe faussent la mesure.
  // Regardés à l'œil : bouclier levé (pas l'arme) et tête de trois quarts (à garder), arc d'effet devant le masque, tête baissée sous la traînée (Carnage).
  const SEEN = /^(ally_witch\/attack|ally_azure_paladin\/raise_shield|ally_ice_empress\/(cast_forward|raise_staff)|ally_ninja\/leap_slash|ally_mercenary\/ground_smash)#/;
  const fails = [];
  for (const [k, set] of Object.entries(ALLY_ANIMS)) {
    if (!k.startsWith('ally_') || !set.walk || !set.attack) continue;
    const rest = place(set.walk, set.walk.frames[0]);
    let y1 = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rest.data[(y * W + x) * 4 + 3] > 100) y1 = y;
    const hh = Math.round((y1 - top(rest)) * 0.42);
    const head = (cv) => { const t = top(cv), s = new Map(); for (let y = t; y < t + hh; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (cv.data[i + 3] < 100 || !skin(cv.data, i)) continue; const c = cv.data[i] << 16 | cv.data[i + 1] << 8 | cv.data[i + 2]; s.set(c, (s.get(c) ?? 0) + 1); } return s; };
    const wh = set.walk.frames.map((f) => head(place(set.walk, f)));
    const pal = new Set([...wh[0].keys()].filter((c) => wh.every((h) => h.has(c))));
    const n = (h) => [...h].reduce((s, [c, v]) => s + (pal.has(c) ? v : 0), 0);
    const ref = Math.min(...wh.map(n));
    if (ref < 12) continue; // visage masqué (casque fermé)
    const anims = [['attack', set.attack], ...Object.keys(F.SKILL_ANIMS[k] ?? {}).map((m) => [m, F.unitSkillAnim(k, m)])];
    for (const [m, a] of anims) a.frames.forEach((f, i) => { const v = n(head(place(a, f))); if (v < ref * 0.4 && !SEEN.test(`${k}/${m}#${i}`)) fails.push(`${k}/${m}#${i} : ${v}/${ref}`); });
  }
  assert.deepEqual(fails, []);
});
