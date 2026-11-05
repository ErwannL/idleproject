// v9.2.3 : dérive des animations dessinées (PixelLab) des ennemis et boss : pieds sur la ligne du sprite de base
// (les sauteurs peuvent décoller, jamais s'enfoncer), centre horizontal stable (plus de saut ni de décalage au sol).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_ANIMS } from '../src/render/art-anim.js';
import { SPRITES } from '../src/render/sprites.js';

const AIR = new Set(['fly', 'float', 'swim']);
const FREE = new Set(['emerge', 'portal']);

// Ligne de pied, centre de la bande des pieds (quart bas), centre de masse ; décalés de (ox, oy).
function metrics(rows, ox = 0, oy = 0) {
  const pts = [];
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.' && r[x] !== ' ') pts.push([x + ox, y + oy]); });
  if (!pts.length) return null;
  const y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
  const lim = y1 - Math.max(1, Math.round((y1 - y0 + 1) * 0.25));
  const feet = pts.filter((p) => p[1] > lim);
  return { foot: y1, fx: feet.reduce((s, p) => s + p[0], 0) / feet.length, cx: pts.reduce((s, p) => s + p[0], 0) / pts.length, cy: pts.reduce((s, p) => s + p[1], 0) / pts.length };
}

test('animations des ennemis : pieds sur la ligne de base, centre horizontal stable', () => {
  const bad = [];
  let checked = 0;
  for (const [key, set] of Object.entries(ENEMY_ANIMS)) {
    if (!SPRITES[key]) continue;
    const base = metrics(SPRITES[key].rows);
    const air = Object.keys(set).some((a) => AIR.has(a)) || SPRITES[key].gait === 'fly';
    for (const [anim, a] of Object.entries(set)) {
      if (FREE.has(anim)) continue;
      const tol = Math.max(2, Math.round(SPRITES[key].rows[0].length * 0.06));
      for (const name of a.frames) {
        const m = metrics(SPRITES[name].rows, a.ox, a.oy);
        checked++;
        if (air) {
          if (Math.abs(m.cx - base.cx) > tol || Math.abs(m.cy - base.cy) > tol) bad.push(`${name} centre ${m.cx.toFixed(1)},${m.cy.toFixed(1)} / ${base.cx.toFixed(1)},${base.cy.toFixed(1)}`);
        } else if ((SPRITES[key].gait === 'hop' ? m.foot - base.foot > 1 : Math.abs(m.foot - base.foot) > 1) || Math.abs(m.fx - base.fx) > tol) {
          bad.push(`${name} pied ${m.foot}/${base.foot} x ${m.fx.toFixed(1)}/${base.fx.toFixed(1)}`);
        }
      }
    }
  }
  assert.ok(checked > 500, `images vérifiées : ${checked}`);
  assert.deepEqual(bad, []);
});
