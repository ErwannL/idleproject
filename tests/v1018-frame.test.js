// v10.18 (1) : téléphone — la scène garde le même cadrage, fenêtre ouverte ou fermée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bandHeight, BAND_GAME_PX, pageActive } from '../src/ui/page.js';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('v10.18 (1.1) : bande du haut de hauteur fixe ≈ 150 px (sol + 90 px de jeu), bornée', () => {
  assert.equal(BAND_GAME_PX, 90);
  assert.equal(bandHeight(1.5), 147);
  assert.equal(bandHeight(2), 170);
  assert.equal(bandHeight(1), 140);
});

test('v10.18 (1.2) : sur téléphone, l\'Arène s\'ouvre en page comme les autres onglets', () => {
  const root = { clientWidth: 405 };
  for (const tab of ['arena', 'campaign', 'dungeons', 'tower', 'inventory', 'shop']) assert.equal(pageActive({ tab, layout: 'tall', root }), true, tab);
});

test('v10.18 (1.3) : la scène garde sa taille derrière la page sur téléphone (barre du haut et HUD cachés sans retirer leur place)', () => {
  const css = src('src/ui/page.css');
  assert.match(css, /page-ui\.page-narrow #main-col > #topbar, #app#app\.page-ui\.page-narrow #hud \{ visibility: hidden !important; \}/);
  assert.match(css, /page-narrow #panel#panel#panel \{ top: var\(--pg-band-h, 150px\) !important; \}/);
});

test('v10.18 (1.4) : familier et compagnons gardent leur case (jamais devant le héros), pas seulement face aux grands boss', () => {
  const s = src('src/render/scene.js');
  assert.match(s, /this\.bigBoss \|\| \(!this\.soloUnit && !Number\.isFinite\(this\.fixedShift\)\)/);
  assert.match(s, /anim0\.reach = Math\.min\(anim0\.reach, anim0\.room\)/);
});
