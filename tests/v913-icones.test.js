// v9.1.3 (chantier 6, doc2 §4) : icônes de menu 20×20 dessinées et branchées (une icône = un seul sens).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ART } from '../src/render/art.js';

const NEW = ['icon_crit', 'icon_regen', 'icon_tower', 'icon_expedition', 'icon_stars', 'icon_xp', 'icon_crown', 'icon_timer', 'icon_alert', 'icon_gold', 'icon_damage'];

test('icônes de menu : 11 sprites 20×20 générés par tools/art/icons.py', () => {
  for (const id of NEW) {
    assert.ok(ART[id], id);
    const n = ART[id].scale === 0.5 ? 48 : 20; // v9.4.0 : icônes PixelLab 48×48 (scale 0,5)
    assert.equal(ART[id].rows.length, n, id);
    assert.ok(ART[id].rows.every((r) => r.length === n), id);
  }
});

test('icônes de menu : plus de double sens ni d\'emoji ✧ 👑 ⌛ dans les panneaux', () => {
  const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
  assert.match(read('ui/panels/upgrades.js'), /crit: 'icon_crit'/);
  assert.match(read('ui/panels/upgrades.js'), /regen: 'icon_regen'/);
  assert.match(read('ui/ui.js'), /tower: 'tab_challenges'/); // v9.4.0 : onglets PixelLab
  assert.match(read('ui/ui.js'), /expeditions: 'tab_expeditions'/);
  for (const p of ['ui/panels/tower.js', 'ui/panels/tree.js', 'ui/common.js']) assert.doesNotMatch(read(p), /[✧👑⌛]/u, p);
});
