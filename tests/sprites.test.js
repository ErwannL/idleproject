import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

import { BOSSES, ENEMIES } from '../src/data/enemies.js';
import { ITEM_BASES } from '../src/data/items.js';
import { ZONES } from '../src/data/zones.js';
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
  for (const frame of ['idle', 'walk1', 'walk2', 'attack']) {
    const rows = SPRITES[`hero_${frame}`].rows;
    assert.equal(rows.length, h, frame);
    assert.ok(rows.every((r) => r.length === w), frame);
  }
  for (const name of ['cape_a', 'cape_b', 'cape_c', 'helmet_helm', 'helmet_hood', 'armor_mail', 'armor_tunic']) {
    const sprite = SPRITES[name];
    assert.equal(sprite.rows[0].length, w, name);
    assert.ok(sprite.oy + sprite.rows.length <= h, `${name} dépasse du corps`);
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
    for (const layer of ['far', 'mid', 'ground', zone.sky === 'ceiling' ? 'top' : 'clouds']) {
      assert.ok(existsSync(new URL(`../assets/bg/${zone.id}_${layer}.png`, import.meta.url)), `${zone.id}_${layer}`);
    }
    for (const id of zone.enemies) assert.ok(ENEMIES[id], id);
    for (const id of zone.bosses) assert.ok(BOSSES[id], id);
  }
});

test('rotation horaire : le haut passe à droite', () => {
  assert.deepEqual(rotateRowsCW(['ab', 'cd', 'ef']), ['eca', 'fdb']);
});

test('polices : glyphes de 5 lignes (petite) et 7 lignes (dégâts)', () => {
  for (const [ch, glyph] of Object.entries(FONT)) assert.equal(glyph.length, 5, ch);
  for (const [ch, glyph] of Object.entries(FONT_BIG)) assert.equal(glyph.length, 7, ch);
});
