// v9.2.5 : animations de compétence — geste propre au lanceur (PixelLab) et effet propre à la compétence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPANIONS } from '../src/data/companions.js';
import { companionSkillList } from '../src/data/companion-skills.js';
import { COMPANION_ROLES } from '../src/data/synergies.js';
import { SKILLS } from '../src/data/skills.js';
import { FX_NAMES, HERO_SKILL_MOTIFS, SKILL_ANIMS, UNIT_SKILL_MOTIFS, castHeroSkill, castUnitSkill, drawSkillFx, fxContext, gestureFrame, heroGesture, unitGesture } from '../src/render/skill-fx.js';
import { SPRITES } from '../src/render/sprites.js';

const LOOKS = ['knight', 'demoness', 'fairy', 'grombar', 'ninja', 'seraph', 'valkyrie', 'vampire', 'witch'];

test('chaque compétence (héros, spéciales de classe, compagnons, ultimes compris) a un geste et un effet propres', () => {
  for (const s of [...SKILLS.map((x) => x.id), 'meteor', 'volley']) {
    const [motif, fx] = HERO_SKILL_MOTIFS[s];
    assert.ok(FX_NAMES.includes(fx), `${s} : effet ${fx}`);
    for (const look of LOOKS) assert.ok(SKILL_ANIMS[`hero_${look}`]?.[motif], `hero_${look} : geste ${motif}`);
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
