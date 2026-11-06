// v9.2.6 : effets de combat PixelLab (src/render/art-vfx.js, lecteur src/render/vfx.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { VFX, VFX_ATLAS } from '../src/render/art-vfx.js';
import { DAMAGE_COLORS, vfx, vfxDuration, vfxReady } from '../src/render/vfx.js';
import { ELEMENTS } from '../src/render/element-fx.js';

test('v9.2.6 : chaque effet a ses images dans l\'atlas, une taille de jeu et une durée', () => {
  const png = Buffer.from(VFX_ATLAS.split(',')[1], 'base64');
  const W = png.readUInt32BE(16), H = png.readUInt32BE(20);
  for (const [name, e] of Object.entries(VFX)) {
    assert.equal(e.f.length, e.n, name);
    for (const [x, y] of e.f) assert.ok(x + e.w <= W && y + e.h <= H, name);
    assert.ok(e.scale > 0 && e.scale * Math.max(e.w, e.h) <= 80, name);
    assert.ok(vfxDuration(name) > 0.1, name);
  }
  assert.ok(png.length < 120 * 1024, 'atlas léger');
});

test('v9.2.6 : un impact par élément et par arme, projectiles, morts, butin, auras', () => {
  for (const el of Object.keys(ELEMENTS)) { assert.ok(VFX[`hit_${el}`], el); assert.ok(DAMAGE_COLORS[el], el); }
  for (const n of ['hit_slash', 'hit_pierce', 'hit_blunt', 'hit_arrow', 'crit_flash', 'crit_wave', 'proj_arrow', 'proj_fireball', 'proj_bolt',
    'death_smoke', 'death_soul', 'boss_explode', 'loot_coin', 'loot_gem', 'loot_shine', 'level_up', 'heal', 'buff_aura', 'debuff_aura', 'boss_appear',
    'dust_step', 'dust_land']) assert.ok(VFX[n], n);
});

test('v9.2.6 : sans atlas chargé (Node), la scène garde ses anciens effets', () => {
  assert.equal(vfxReady(), false);
  const scene = { effects: [], focus: false };
  assert.equal(vfx(scene, 'hit_fire', 0, 0), false);
  assert.equal(scene.effects.length, 0);
});
