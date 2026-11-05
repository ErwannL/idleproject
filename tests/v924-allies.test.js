// v9.2.4 : alliés — l'apparence garde son corps, l'arme reste dans la main, cadence constante à 60 i/s.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALLY_ANIMS } from '../src/render/art-anim-allies.js';
import { KNIGHT_PIVOT, decodeAllyFrames, heroWearsGear, knightHead, phaseFrame, pickAllyAnim, pickHeroAnim } from '../src/render/ally-anim.js';

const FRAMES = decodeAllyFrames();
const base = { classId: 'knight', style: 'melee', time: 0, attackTime: 0.3, castTime: 0.35 };

test('chevalier avec casque ou armure : animation PixelLab gardée, tête suivie sur chaque image pour le casque porté', () => {
  const helm = { helmet: { baseId: 'iron_helm', rarity: 'epic' } };
  assert.equal(heroWearsGear(null, helm), true);
  assert.equal(heroWearsGear({ skin: 'valkyrie' }, helm), false);
  assert.equal(heroWearsGear(null, {}), false);
  const atk = pickHeroAnim({ ...base, palette: null, equipment: helm, attack: 0.2 }, {});
  assert.ok(atk?.name.startsWith('hero_knight_knight_attack') && atk.head, 'attaque PixelLab + tête');
  const walk = pickHeroAnim({ ...base, palette: null, equipment: helm, walking: true }, {});
  assert.ok(walk?.name.startsWith('hero_knight_walk') && walk.head, 'marche PixelLab + tête');
  for (const [name, a] of Object.entries(ALLY_ANIMS.hero_knight)) {
    a.frames.forEach((f, i) => {
      const h = knightHead(a, i);
      assert.ok(h && h.every(Number.isFinite), `${name}[${i}] : tête`);
      if (name !== 'swim') assert.ok(Math.hypot(h[0] - KNIGHT_PIVOT[0], h[1] - KNIGHT_PIVOT[1]) <= 16 && Math.abs(h[2]) <= 30, `${name}[${i}] : tête à ${h}`);
    });
    // Pas de saut de la tête d'une image à la suivante (au plus 8 px).
    for (let i = 1; i < a.frames.length; i++) {
      const p = knightHead(a, i - 1), q = knightHead(a, i);
      assert.ok(Math.hypot(q[0] - p[0], q[1] - p[1]) <= 8, `${name}[${i}] : saut de la tête`);
    }
  }
  // Une apparence garde ses propres images, avec ou sans équipement, pour chaque classe.
  for (const sk of ['demoness', 'fairy', 'grombar', 'ninja', 'seraph', 'valkyrie', 'vampire', 'witch']) {
    for (const cls of ['knight', 'berserker', 'lancer', 'paladin', 'assassin']) {
      const p = pickHeroAnim({ ...base, classId: cls, palette: { skin: sk }, equipment: helm, attack: 0.15 }, {});
      assert.ok(p?.name.startsWith(`hero_${sk}_`), `${sk}/${cls} : ${p?.name}`);
    }
    const w = pickHeroAnim({ ...base, palette: { skin: sk }, equipment: helm, walking: true }, {});
    assert.ok(w?.name.startsWith(`hero_${sk}_walk`));
  }
});

test('glissade et sauts : pas de marche dessinée (pas de clignotement marche / repos)', () => {
  assert.equal(pickHeroAnim({ ...base, palette: { skin: 'ninja' }, walking: true, gait: 'slide' }, {}), null);
});

test('cadence constante : à 60 i/s, chaque image du geste reste le même temps (± 1 image d\'écran)', () => {
  const holds = (seq) => { const h = []; let c = 1; for (let i = 1; i < seq.length; i++) { if (seq[i] === seq[i - 1]) c++; else { h.push(c); c = 1; } } h.push(c); return h; };
  for (const [key, anims] of Object.entries(ALLY_ANIMS)) {
    for (const [name, a] of Object.entries(anims)) {
      if (!name.startsWith('attack')) continue;
      const T = key.startsWith('hero_') ? 0.3 : 0.62, hitK = key.startsWith('hero_') ? 0.3 : 0.39;
      const seq = [];
      for (let f = 0; f < T * 60; f++) seq.push(phaseFrame(a, f / (T * 60), hitK));
      assert.equal(phaseFrame(a, hitK, hitK), a.hit, `${key}.${name} : image du coup`);
      const inner = holds(seq).slice(1, -1); // début et fin : pose de repos tenue
      assert.ok(Math.max(...inner) - Math.min(...inner) <= 1, `${key}.${name} : ${holds(seq)}`);
    }
  }
});

test("l'arme reste dans la main : prise à 1,5 px au plus du corps sur chaque image du héros", () => {
  for (const [key, anims] of Object.entries(ALLY_ANIMS)) {
    if (!key.startsWith('hero_')) continue;
    for (const [name, a] of Object.entries(anims)) {
      if (!a.w) continue;
      a.frames.forEach((f, i) => {
        if (Math.hypot(a.w[i][0] - 42, a.w[i][1] - 51) <= 3) return; // main de repos (pose composée identique)
        const rows = FRAMES[f].rows, gx = a.w[i][0] - a.ox, gy = a.w[i][1] - a.oy;
        let best = 99;
        for (let y = Math.max(0, gy - 4); y <= Math.min(rows.length - 1, gy + 4); y++) {
          for (let x = Math.max(0, gx - 4); x <= Math.min(rows[0].length - 1, gx + 4); x++) if (rows[y][x] !== '.') best = Math.min(best, Math.hypot(x - gx, y - gy));
        }
        assert.ok(best <= 1.5, `${key}.${name}[${i}] : prise à ${best.toFixed(1)} px du corps`);
      });
    }
  }
});

test('compagnons : l\'image du coup tombe à l\'instant de l\'effet du geste', () => {
  const p = pickAllyAnim({ sprite: 'ally_squire', gesture: { kind: 'melee', k: 0.39 }, time: 0, seed: 0 });
  assert.equal(p.name, ALLY_ANIMS.ally_squire.attack.frames[ALLY_ANIMS.ally_squire.attack.hit]);
});
