// v9.2.7 : rendu — pieds au sol des alliés (compagnons, familiers, apparences), volants/marcheurs, rage du héros.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.Image ??= class {};

const bottom = (rows) => { for (let y = rows.length - 1; y >= 0; y--) if ([...rows[y]].some((c) => c !== '.' && c !== ' ')) return y; return -1; };

test('pieds au sol : marche image par image et attaque (point le plus bas) à 1 px près de la pose de repos', async () => {
  const { SPRITES, expandRow } = await import('../src/render/sprites.js');
  const { ALLY_ANIMS } = await import('../src/render/ally-anim.js');
  const rowsOf = (k) => SPRITES[k].rows.map((r) => (Array.isArray(r) ? r.join('') : r.includes('`') ? expandRow(r) : r));
  const bad = [];
  let n = 0;
  for (const [k, set] of Object.entries(ALLY_ANIMS)) {
    const ref = k.startsWith('hero_') ? set.walk.oy + bottom(rowsOf(set.walk.frames[0])) : bottom(rowsOf(k));
    for (const [an, a] of Object.entries(set)) {
      if (an === 'swim' || an === 'hover') continue; // nage et vol : pas de sol
      const bs = a.frames.map((f) => a.oy + bottom(rowsOf(f)));
      const d = an === 'walk' ? bs.map((b) => b - ref) : [Math.max(...bs) - ref];
      n += d.length;
      if (d.some((x) => Math.abs(x) > 1)) bad.push(`${k} ${an} ${d.join(',')}`);
    }
  }
  assert.ok(n > 300);
  assert.deepEqual(bad, []);
});

test('volants et marcheurs : robes longues au sol, ailés en vol stationnaire, phénix en vol', async () => {
  const { allyGait, airDef } = await import('../src/render/scene.js');
  const { pickAllyAnim, ALLY_ANIMS } = await import('../src/render/ally-anim.js');
  const { ENEMIES, BOSSES } = await import('../src/data/enemies.js');
  for (const s of ['ally_pyromancer', 'ally_priestess', 'ally_high_priest', 'ally_ice_empress']) assert.equal(allyGait(s), 'walk', s);
  for (const s of ['ally_archangel', 'ally_demon_queen']) {
    assert.ok(ALLY_ANIMS[s].hover, s);
    assert.equal(pickAllyAnim({ sprite: s, walking: true, time: 0.3, seed: 0 }).kind, 'hover');
  }
  assert.ok(airDef('boss_phoenix', true, ENEMIES[BOSSES.boss_phoenix.base]).flyHeight > 0);
  assert.equal(airDef('mid_thunder_griffin', true, ENEMIES[BOSSES.mid_thunder_griffin.base]).flyHeight ?? 0, 0); // se pose
});

// v9.2.9 : placement à l'écran : le héros est dessiné comme dans scene.js (baseY = sol − HERO_ANCHOR.y + 1) ; pour
// chaque apparence, la marche et l'attaque de chaque classe posent les pieds comme la pose de repos composée
// (heroComposite : semelles 2 px dans le bord du sol), à 1 px près.
test('v9.2.9 : héros posé sur la ligne de sol à l\'écran — chaque apparence, marche et attaque de chaque classe', async () => {
  const { installSoftCanvas, SoftCanvas } = await import('./helpers/softcanvas.js');
  installSoftCanvas();
  const A = await import('../src/render/ally-anim.js');
  const D = await import('../src/render/hero-draw.js');
  const { HERO_ANCHOR } = await import('../src/render/pixel.js');
  const { CLASSES } = await import('../src/data/classes.js');
  const G = 100, baseY = G - HERO_ANCHOR.y + 1;
  const bad = [];
  for (const look of ['knight', 'witch', 'vampire', 'ninja', 'grombar', 'seraph', 'valkyrie', 'demoness', 'fairy']) {
    const pal = look === 'knight' ? null : { skin: look }, set = A.ALLY_ANIMS[A.heroAnimKey(pal)];
    for (const k of ['walk', ...CLASSES.map((c) => `attack_${c.id}`)]) {
      const a = set[k], feet = [];
      a.frames.forEach((name, i) => {
        const cv = new SoftCanvas(160, 140);
        D.drawHeroPick(cv.getContext('2d'), { name, anim: a, weapon: A.weaponPose(a, i), head: A.knightHead(a, i) }, {}, pal, 40, baseY, { weapon: false });
        let low = -1;
        for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (cv.data[(y * cv.width + x) * 4 + 3] > 100) low = y;
        feet.push(low - G);
      });
      const d = k === 'walk' ? feet : [Math.max(...feet)];
      if (d.some((x) => Math.abs(x - 2) > 1)) bad.push(`${look} ${k} ${d.join(',')}`);
    }
  }
  assert.deepEqual(bad, []);
});
