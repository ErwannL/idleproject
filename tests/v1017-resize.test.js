// v10.17 (A) : ouvrir ou fermer une fenêtre ne bouge plus le combat (logique pure : src/render/frame-hold.js, skill-fx.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { holdFrame, shiftEffects, windowKey } from '../src/render/frame-hold.js';

const HERO_X = 84;

test('même fenêtre du navigateur → même clé ; fenêtre redimensionnée ou autre taille de personnages → nouvelle clé', () => {
  assert.equal(windowKey(1366, 768, 1, 'auto'), windowKey(1366, 768, 1, 'auto'));
  assert.notEqual(windowKey(1366, 768), windowKey(1920, 1080));
  assert.notEqual(windowKey(412, 915), windowKey(915, 412)); // orientation
  assert.notEqual(windowKey(1366, 768, 1, 'auto'), windowKey(1366, 768, 1, 'big'));
});

test('PC 1366 : colonne de combat (383 px de jeu) → cadrage gardé (centerShift 203, sol 240)', () => {
  const prev = { k: 2, centerShift: 203, groundY: 240 };
  const h = holdFrame(prev, { width: 383, height: 330, heroX: HERO_X });
  assert.deepEqual(h, { centerShift: 203, groundY: 240 });
});

test('place insuffisante → on recadre (moins de décor), jamais de zoom ; sol relevé seulement s\'il ne tient plus', () => {
  const prev = { k: 2, centerShift: 243, groundY: 280 };
  const narrow = holdFrame(prev, { width: 260, height: 400, heroX: HERO_X });
  assert.ok(narrow.centerShift < 243 && narrow.centerShift >= 0);
  assert.ok(HERO_X + narrow.centerShift + 90 <= 260, 'le premier ennemi reste visible');
  assert.equal(narrow.groundY, 280);
  const low = holdFrame(prev, { width: 600, height: 200, heroX: HERO_X, depth: 18 });
  assert.equal(low.groundY, 182);
  // fermeture : la place revient → le cadrage d'origine revient exactement
  assert.deepEqual(holdFrame(prev, { width: 768, height: 400, heroX: HERO_X }), { centerShift: 243, groundY: 280 });
});

test('effets en cours décalés en X et en Y', () => {
  const list = [{ x: 10, y: 20, x0: 1, x1: 2, tx: 3, cx: 4, top: 5, sy: 6, y0: 7, y1: 8, ty: 9, life: 1 }];
  shiftEffects(list, 5, -10);
  assert.deepEqual(list[0], { x: 15, y: 10, x0: 6, x1: 7, tx: 8, cx: 9, top: -5, sy: -4, y0: -3, y1: -2, ty: -1, life: 1 });
  shiftEffects(list, 0, 0);
  assert.equal(list[0].x, 15);
});

test('scène : resize garde k/centerShift quand holdFrame est demandé, et décale les effets avec shiftEffects', () => {
  const src = readFileSync(new URL('../src/render/scene.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('  resize(cssWidth, cssHeight) {'), src.indexOf('  enemyFxFor(id) {'));
  assert.match(body, /this\.holdFrame && this\.frame/);
  assert.match(body, /if \(held\) k = held\.k;/);
  assert.match(body, /shiftEffects\(this\.effects/);
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /renderer\.holdFrame = open && renderer\.frameKey === key/);
});

test('skill-fx : chaque pièce suit le sol au dessin (groundY − g0), les suites différées gardent le repère du lancer', async () => {
  globalThis.window ??= {};
  const { drawSkillFx } = await import('../src/render/skill-fx.js').catch(() => ({}));
  if (!drawSkillFx) return; // module lié au navigateur (images) : contrôle du source ci-dessous
  const scene = { time: 1, groundY: 200, effects: [], skillFx: [] };
  const seen = [];
  scene.skillFx.push({ at: 0, dur: 5, g0: 240, p: {}, draw: () => seen.push(ty) });
  let ty = 0;
  const ctx = { translate: (x, y) => { ty += y; }, set globalAlpha(v) {} };
  drawSkillFx(scene, ctx);
  assert.deepEqual(seen, [-40], 'dessiné 40 px plus haut : le sol est monté de 40 px');
  assert.equal(ty, 0, 'repère rendu');
});

test('skill-fx.js : add() retient g0, drawSkillFx décale ; v10.16 gardé (thrust, vslash, groundWave, airArc ; pas de crescent)', () => {
  const src = readFileSync(new URL('../src/render/skill-fx.js', import.meta.url), 'utf8');
  assert.match(src, /g0: add\.g0 \?\? scene\.groundY/);
  assert.match(src, /scene\.groundY - e\.g0/);
  for (const f of ['thrust', 'vslash', 'groundWave', 'airArc']) assert.match(src, new RegExp(`function ${f}\\(`));
  assert.ok(!/function crescent\(/.test(src));
});

// v10.20 (1) : la v10.17 avait supprimé les pages PC (PC_SIDE_ONLY = true) ; elles reviennent. Héros et Équipe s'ouvrent en grande
// page avec la vignette du combat, à toutes les largeurs PC ; Combat, Invocation et Boutique gardent la colonne de combat à gauche.
test('PC : Héros et Équipe en grande page avec vignette ; Combat, Invocation, Boutique à droite de la colonne de combat', async () => {
  const { pageActive, PC_SIDE_ONLY } = await import('../src/ui/page.js');
  assert.equal(PC_SIDE_ONLY, false);
  for (const w of [1116, 1366, 1920]) {
    for (const tab of ['inventory', 'companions', 'forge', 'camp', 'upgrades', 'skills', 'tree', 'expeditions']) assert.equal(pageActive({ tab, layout: 'tall', root: { clientWidth: w }, view: {} }), true, `${tab} ${w}`);
    for (const tab of ['campaign', 'summon', 'shop']) assert.equal(pageActive({ tab, layout: 'tall', root: { clientWidth: w }, view: {} }), false, `${tab} ${w}`);
  }
  for (const tab of ['inventory', 'companions', 'forge', 'camp', 'upgrades', 'skills', 'campaign', 'summon', 'shop']) {
    assert.equal(pageActive({ tab, layout: 'tall', root: { clientWidth: 412 }, view: {} }), true, `${tab} (téléphone)`);
  }
});
