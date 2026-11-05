// v9.2.5 : « Arrête de me faire le héros sans tête » et « l'épée ne suit pas la main ».
// Rend le héros (canvas logiciel, tests/helpers/softcanvas.js) pour toutes les apparences × classes × casques (dont
// « aucun ») × états — marche, attaque de classe, nage PixelLab ; poses composées (repos, frappe, sort, visée, coup
// reçu, victoire, marche, « Réduire les animations ») ; portrait ; mort — et vérifie qu'il reste une tête ou un
// casque au-dessus du torse. Vérifie aussi la prise : poing dessiné par-dessus la poignée, arme qui part de la main.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SoftCanvas, installSoftCanvas } from './helpers/softcanvas.js';

installSoftCanvas();
const P = await import('../src/render/pixel.js');
const A = await import('../src/render/ally-anim.js');
const D = await import('../src/render/hero-draw.js');
const { HEROES } = await import('../src/data/heroes.js');
const { CLASSES } = await import('../src/data/classes.js');
const { ITEM_BASES } = await import('../src/data/items.js');
const { KNIGHT_HEAD } = await import('../src/render/knight-gear.js');

const it = (baseId) => (baseId ? { baseId, rarity: 'epic' } : null);
const HELMETS = [null, ...ITEM_BASES.filter((b) => b.slot === 'helmet' && !b.signature).map((b) => b.id)];
const weaponFor = (cls) => ITEM_BASES.find((b) => b.slot === 'weapon' && cls.weapons.includes(b.sprite)).id;
const weaponsFor = (cls) => ITEM_BASES.filter((b) => b.slot === 'weapon' && !b.signature && cls.weapons.includes(b.sprite)).map((b) => b.id);
const PALETTES = HEROES.map((h) => [h.id, h.palette ?? null]);
const alpha = (cv, x, y) => (x < 0 || y < 0 || x >= cv.width || y >= cv.height ? 0 : cv.data[(y * cv.width + x) * 4 + 3]);
const opaque = (cv) => { let n = 0; for (let i = 3; i < cv.data.length; i += 4) if (cv.data[i] > 100) n++; return n; };

// Tête présente pour une image d'animation : corps seul (sans arme) rendu ; pour le chevalier, la tête suivie
// (masque de la tête au repos, tourné) doit être couverte à 70 % au moins (casque porté ou tête d'origine) ;
// pour les apparences, au moins 40 px opaques plus de 30 px au-dessus des pieds (au-dessus du torse).
function animHeadOk(pick, eq, palette, feetY) {
  const cv = new SoftCanvas(140, 120);
  const X = 30, Y = 20;
  D.drawHeroPick(cv.getContext('2d'), pick, eq, palette, X, Y, { weapon: false });
  if (pick.head && !palette?.skin) {
    const [hx, hy, deg] = pick.head, a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    let hit = 0;
    for (const [u, v] of KNIGHT_HEAD.mask) if (alpha(cv, Math.round(X + hx + u * c - v * s), Math.round(Y + hy + u * s + v * c)) > 100) hit++;
    return hit / KNIGHT_HEAD.mask.length >= 0.7 ? null : `tête couverte à ${Math.round((100 * hit) / KNIGHT_HEAD.mask.length)} %`;
  }
  return aboveTorso(cv, Y + feetY) >= 40 ? null : 'rien au-dessus du torse';
}
function aboveTorso(cv, feet) {
  let n = 0;
  for (let y = 0; y < Math.min(cv.height, feet - 30); y++) for (let x = 0; x < cv.width; x++) if (alpha(cv, x, y) > 100) n++;
  return n;
}
const feetOf = (anim) => {
  const f = P.heroAnimCanvas(anim.frames[0], null);
  let y1 = -1;
  for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) if (alpha(f, x, y)) y1 = y;
  return y1 + anim.oy;
};

test('v9.2.5 : héros jamais sans tête — animations PixelLab, toutes apparences × classes × casques', () => {
  const fails = [];
  let n = 0;
  for (const [hid, palette] of PALETTES) {
    const set = A.ALLY_ANIMS[A.heroAnimKey(palette)];
    for (const cls of CLASSES) for (const helmet of HELMETS) {
      const eq = { weapon: it(weaponFor(cls)), helmet: it(helmet), armor: it(helmet ? 'chainmail' : null) };
      for (const key of ['walk', `attack_${cls.id}`, 'swim']) {
        const anim = set[key];
        if (key === 'swim' && cls !== CLASSES[0]) continue;
        const feet = feetOf(anim);
        anim.frames.forEach((name, i) => {
          // (cadre : les images d'une animation partagent un cadre serré, la plus haute touche toujours le bord ;
          // une tête hors du cadre se voit donc par le contrôle de tête ci-dessous, pas par le bord.)
          if (key === 'swim') {
            const cv = new SoftCanvas(140, 120);
            D.drawHeroPick(cv.getContext('2d'), { name, anim, weapon: null, head: A.knightHead(anim, i) }, eq, palette, 30, 20);
            n++;
            if (opaque(cv) < 200) fails.push(`${hid}/${helmet}/swim#${i} vide`);
            return;
          }
          const err = animHeadOk({ name, anim, weapon: A.weaponPose(anim, i), head: A.knightHead(anim, i) }, eq, palette, feet);
          n++;
          if (err) fails.push(`${hid}/${cls.id}/${helmet ?? 'aucun'}/${key}#${i} : ${err}`);
        });
      }
    }
  }
  assert.ok(n > 3000, `${n} rendus`);
  if (process.env.DUMP) console.log([...new Set(fails)].join("\n"));
  assert.deepEqual(fails.slice(0, 20), [], `${fails.length} échecs`);
});

test('v9.2.5 : héros jamais sans tête — poses composées, Réduire les animations, coup reçu, mort, portrait', () => {
  const fails = [];
  const frames = ['idle', 'idle2', 'attack1', 'attack2', 'attack3', 'cast', 'hurt', 'victory', 'aim', 'shoot', 'walk1', 'walk2', 'walk3', 'walk4'];
  for (const [hid, palette] of PALETTES) for (const helmet of HELMETS) {
    const eq = { weapon: it('short_sword'), helmet: it(helmet), armor: it(helmet ? 'plate_armor' : null) };
    const bare = { ...eq, weapon: null };
    for (const f of frames) for (const cape of 'abcdef') for (const flash of [false, true]) {
      const img = P.heroComposite(f, bare, flash, cape, palette);
      if (aboveTorso(img, P.HERO_ANCHOR.y) < 40) fails.push(`${hid}/${helmet}/${f}/${cape}${flash ? '/flash' : ''}`);
    }
    // Mort : héros couché (rotation -90°) : la tête est à gauche de l'ancre des pieds.
    const dead = new SoftCanvas(140, 140);
    const ctx = dead.getContext('2d');
    ctx.translate(80, 100); ctx.rotate(-Math.PI / 2);
    ctx.drawImage(P.heroComposite('hurt', bare, false, 'a', palette), -(P.HERO_ANCHOR.x - 24), -P.HERO_ANCHOR.y + 2); // comme scene.js drawHero
    let side = 0;
    for (let y = 0; y < 140; y++) for (let x = 0; x < 80 - 8; x++) if (alpha(dead, x, y) > 100) side++;
    let under = 0, all = 0;
    for (let y = 0; y < 140; y++) for (let x = 0; x < 140; x++) if (alpha(dead, x, y) > 100) { all++; if (y > 102) under++; }
    if (side < 40 || under > all * 0.05) fails.push(`${hid}/${helmet}/mort (${side} px côté tête, ${under}/${all} sous le sol)`);
    // Portrait (fiche, Collections, Invocation, Apparences) : image de repos recadrée, tête en haut.
    const idle = P.heroComposite('idle', eq, false, 'a', palette);
    if (aboveTorso(idle, P.HERO_ANCHOR.y) < 40) fails.push(`${hid}/${helmet}/portrait`);
  }
  if (process.env.DUMP) console.log([...new Set(fails)].join("\n"));
  assert.deepEqual(fails.slice(0, 20), [], `${fails.length} échecs`);
});

test("v9.2.5 : prise de l'arme — poing redessiné par-dessus la poignée, arme qui part de la main", () => {
  const fails = [];
  for (const [hid, palette] of PALETTES) {
    const set = A.ALLY_ANIMS[A.heroAnimKey(palette)];
    for (const cls of CLASSES) for (const wid of weaponsFor(cls)) {
      const eq = { weapon: it(wid) };
      for (const key of ['walk', `attack_${cls.id}`]) {
        const anim = set[key];
        anim.frames.forEach((name, i) => {
          const wp = A.weaponPose(anim, i);
          if (!wp) return fails.push(`${hid}/${key}#${i} sans prise`);
          const pick = { name, anim, weapon: wp, head: A.knightHead(anim, i) };
          const X = 30, Y = 20;
          const body = new SoftCanvas(160, 140), full = new SoftCanvas(160, 140);
          D.drawHeroPick(body.getContext('2d'), pick, eq, palette, X, Y, { weapon: false });
          const held = D.drawHeroPick(full.getContext('2d'), pick, eq, palette, X, Y);
          const gx = X + held.gx, gy = Y + held.gy; // prise réelle (ramenée dans la main si besoin)
          // L'arme part de la main : un pixel du corps à 2 px au plus de la prise.
          let near = false;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (alpha(body, gx + dx, gy + dy) > 100) near = true;
          if (!near) fails.push(`${hid}/${key}#${i} : arme loin de la main`);
          // v9.2.5 : en marche et au repos, aucune arme ne recouvre le visage (pixels du corps à plus de 30 px
          // au-dessus des pieds identiques avec et sans arme).
          if (key === 'walk' || i === 0 || i === anim.frames.length - 1) {
            let feet = -1;
            for (let y = 0; y < 140; y++) for (let x = 0; x < 160; x++) if (alpha(body, x, y) > 100) feet = y;
            let hid2 = 0;
            for (let y = 0; y < feet - 30; y++) for (let x = 0; x < 160; x++) {
              if (alpha(body, x, y) < 100) continue;
              const o = (y * 160 + x) * 4;
              if ([0, 1, 2].some((j) => body.data[o + j] !== full.data[o + j])) hid2++;
            }
            if (hid2 >= 3) fails.push(`${hid}/${key}#${i} : arme sur le visage (${hid2} px)`);
          }
          // Main devant : autour de la prise, les pixels du corps restent ceux du corps (le poing couvre la poignée).
          if (!wp.back && !held.behind) {
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
              if (Math.hypot(dx, dy) > D.HAND_R) continue;
              const x = gx + dx, y = gy + dy;
              if (alpha(body, x, y) < 100) continue;
              const o = (y * 160 + x) * 4;
              if ([0, 1, 2].some((j) => body.data[o + j] !== full.data[o + j])) { fails.push(`${hid}/${key}#${i} : poignée par-dessus le poing`); return; }
            }
          }
        });
      }
    }
  }
  if (process.env.DUMP) console.log([...new Set(fails)].join("\n"));
  assert.deepEqual(fails.slice(0, 20), [], `${fails.length} échecs`);
});

// v9.2.5 : gestes de compétence (skill-fx.js) : le chevalier garde son casque et son armure, jamais sans tête,
// et l'arme dessinée est toujours l'arme équipée (posée par le jeu sur la prise, ou rangée dans le dos).
test('v9.2.5 : gestes de compétence — jamais sans tête, casque porté présent, arme équipée', async () => {
  const S = await import('../src/render/skill-fx.js');
  const fails = [];
  let n = 0;
  const skills = Object.keys(S.HERO_SKILL_MOTIFS);
  for (const [hid, palette] of PALETTES) for (const helmet of HELMETS.slice(0, 4)) for (const skill of skills) {
    const cls = CLASSES.find((c) => c.id === (skill === 'meteor' ? 'pyromancer' : skill === 'volley' ? 'archer' : 'knight'));
    const eq = { weapon: it(weaponFor(cls)), helmet: it(helmet), armor: it(helmet ? 'chainmail' : null) };
    const scene = { time: 0, groundY: 120, focus: true, shake: 0, underwater: false, layout: null, wx: (x) => x, hitReact() {}, burst() {}, dust() {} };
    assert.ok(S.castHeroSkill(scene, A.heroAnimKey(palette), skill, { src: { x: 0, y: 0 }, foes: [], team: [0], hero: 0, front: 60, far: 60, mid: 60 }));
    const g = scene.heroSkill;
    assert.ok(g.anim, `${hid}/${skill} : geste`);
    const feet = feetOf(g.anim);
    for (let i = 0; i < g.anim.frames.length; i++) {
      scene.time = g.start + ((i + 0.5) / g.anim.frames.length) * g.dur;
      scene.heroSkill = g;
      const pick = S.heroGesturePick(scene);
      n++;
      if (!pick) { fails.push(`${hid}/${skill}#${i} : pas d'image`); continue; }
      if (!palette?.skin && !pick.head) fails.push(`${hid}/${skill}#${i} : tête non suivie`);
      const err = animHeadOk(pick, eq, palette, feet);
      if (err) fails.push(`${hid}/${skill}/${helmet ?? 'aucun'}#${i} : ${err}`);
      if (helmet && !palette?.skin) {
        // Casque porté présent : la tête rendue diffère de celle du chevalier PixelLab de base.
        const a1 = new SoftCanvas(140, 120), a2 = new SoftCanvas(140, 120);
        D.drawHeroPick(a1.getContext('2d'), pick, eq, palette, 30, 20, { weapon: false });
        D.drawHeroPick(a2.getContext('2d'), pick, {}, palette, 30, 20, { weapon: false });
        let diff = 0;
        for (let j = 0; j < a1.data.length; j += 4) if (Math.abs(a1.data[j] - a2.data[j]) + Math.abs(a1.data[j + 1] - a2.data[j + 1]) + Math.abs(a1.data[j + 3] - a2.data[j + 3]) > 40) diff++;
        if (diff < 30) fails.push(`${hid}/${skill}/${helmet}#${i} : casque absent (${diff} px)`);
      }
      if (S.HELD_MOTIFS.has(g.motif) && !pick.weapon) fails.push(`${hid}/${skill}#${i} : arme tenue sans prise`);
      if (!S.HELD_MOTIFS.has(g.motif) && pick.weapon) fails.push(`${hid}/${skill}#${i} : arme en main hors geste tenu`);
    }
  }
  assert.ok(n > 500, `${n} rendus`);
  if (process.env.DUMP) console.log([...new Set(fails)].join('\n'));
  assert.deepEqual(fails.slice(0, 20), [], `${fails.length} échecs`);
});
