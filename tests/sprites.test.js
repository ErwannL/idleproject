import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

import { BOSSES, ENEMIES } from '../src/data/enemies.js';
import { ITEM_BASES } from '../src/data/items.js';
import { ZONES } from '../src/data/zones.js';
import { BG } from '../src/render/bg.js';
import { BASE_PALETTE, FONT, FONT_BIG, HERO_FRAME_SIZE, SPRITES, rotateRowsCW } from '../src/render/sprites.js';

test('chaque sprite utilise des lignes de même largeur et des couleurs connues', () => {
  for (const [name, sprite] of Object.entries(SPRITES)) {
    const width = sprite.rows[0].length;
    const palette = { ...BASE_PALETTE, ...(sprite.pal ?? {}) };
    sprite.rows.forEach((row, y) => {
      assert.equal(row.length, width, `${name} ligne ${y} : largeur ${row.length} au lieu de ${width}`);
      for (const ch of row) assert.ok(ch === '.' || ch in palette, `${name} : couleur inconnue « ${ch} »`);
    });
  }
});

test('les images et calques du héros ont la taille du chevalier', () => {
  const { w, h } = HERO_FRAME_SIZE;
  for (const frame of ['idle', 'idle2', 'walk1', 'walk2', 'walk3', 'walk4', 'attack1', 'attack2', 'attack3', 'cast', 'hurt', 'victory']) {
    const sprite = SPRITES[`hero_${frame}`];
    assert.ok(sprite, frame);
    assert.equal(sprite.rows.length, h, frame);
    assert.ok(sprite.rows.every((r) => r.length === w), frame);
    assert.ok(sprite.hand && [0, 90, 180, 270].includes(sprite.rot ?? 0), `${frame} : main et rotation de l'arme`);
  }
  for (const name of ['cape_a', 'cape_b', 'cape_c', 'helmet_helm', 'helmet_hood', 'armor_mail', 'armor_tunic']) {
    const sprite = SPRITES[name];
    assert.equal(sprite.rows[0].length, w, name);
    assert.ok((sprite.oy ?? 0) + sprite.rows.length <= h, `${name} dépasse du corps`);
  }
});

test('le point de prise des armes est sur le manche (ni vide, ni sur la lame)', () => {
  for (const name of ['weapon_sword', 'weapon_axe', 'weapon_dagger']) {
    const { rows, grip } = SPRITES[name];
    const ch = rows[grip.y][grip.x];
    assert.ok(ch !== '.' && !['a', 'A', '1', '2'].includes(ch), `${name} : « ${ch} »`);
  }
});

test('les données référencent des sprites existants', () => {
  for (const enemy of Object.values(ENEMIES)) {
    for (const frame of enemy.frames ?? [enemy.sprite]) assert.ok(SPRITES[frame], frame);
  }
  for (const boss of Object.values(BOSSES)) {
    assert.ok(ENEMIES[boss.base], boss.base);
    if (boss.sprite) assert.ok(SPRITES[boss.sprite], boss.sprite);
  }
  for (const base of ITEM_BASES) {
    const prefix = base.slot === 'weapon' ? 'weapon' : base.slot;
    assert.ok(SPRITES[`${prefix}_${base.sprite}`], base.id);
  }
  for (const zone of ZONES) {
    const bg = BG[zone.id];
    assert.ok(bg && bg.sky.length >= 2 && bg.layers.length >= 3, `décor de ${zone.id}`);
    for (const layer of bg.layers) assert.ok(existsSync(new URL(`../assets/bg/${layer.file}`, import.meta.url)), layer.file);
    for (const id of zone.enemies) assert.ok(ENEMIES[id], id);
    for (const id of zone.bosses) assert.ok(BOSSES[id], id);
  }
});

test('effets de combat présents', () => {
  for (const name of ['fx_slash1', 'fx_slash2', 'fx_slash3', 'fx_slash_crit', 'fx_wave', 'fx_whirl1', 'fx_whirl2', 'fx_burst', 'fx_aura1', 'fx_aura2', 'fx_spark', 'fx_hit']) {
    assert.ok(SPRITES[name], name);
  }
});

test('rotation horaire : le haut passe à droite', () => {
  assert.deepEqual(rotateRowsCW(['ab', 'cd', 'ef']), ['eca', 'fdb']);
});

test('polices : glyphes de 5 lignes (petite) et 7 lignes (dégâts)', () => {
  for (const [ch, glyph] of Object.entries(FONT)) assert.equal(glyph.length, 5, ch);
  for (const [ch, glyph] of Object.entries(FONT_BIG)) assert.equal(glyph.length, 7, ch);
});
