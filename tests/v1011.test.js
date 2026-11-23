// v10.11 (docs/prompt-v10.11/PROMPT.md) : lisibilité et ergonomie.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('10.11 (1) : Améliorations — une ligne ne quitte jamais sa colonne, « peu utile » jugé sur un niveau, colonne jamais vide', () => {
  const up = src('src/ui/panels/upgrades.js');
  assert.doesNotMatch(up, /weakCards\.push/);
  assert.doesNotMatch(up, /Peu utiles maintenant/);
  assert.match(up, /\[key\]: level \+ 1/, 'gain d\'un seul niveau');
  assert.match(up, /Tout est au maximum ✓/);
  assert.match(up, /Il manque \$\{coin\(\)\}/);
  assert.match(src('src/ui/layout109.css'), /grid-template-areas: "strike endure" "strike earn"/);
});

test('10.11 (2) : fiche Héros — le dessin tient dans sa case, Niveau et Puissance dessous ; téléphone en grille', () => {
  const css = src('src/ui/layout109.css');
  assert.match(css, /\.eq-figure \.eq-art-box \{ overflow: hidden; contain: paint;/);
  assert.match(css, /\.eq-art-box > img\.eq-art \{ position: absolute; inset: 0;[^}]*object-fit: contain;/);
  assert.match(css, /grid-template-columns: 110px minmax\(0, 1fr\)/);
});

test('10.11 (3) : Bastion — badge pioche (pas de cadenas), « + Ouvrier », « Poser au mieux » remplit les places', async () => {
  globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const { sanitizeState } = await import('../src/core/state.js');
  const { BALANCE } = await import('../src/data/balance.js');
  const B = await import('../src/core/bastion.js');
  const s = sanitizeState(JSON.parse(src('tests/fixtures/endgame.json')), BALANCE, Date.now());
  B.bastionTick(s, Date.now());
  for (const b of Object.values(s.bastion.buildings)) b.worker = null;
  const free = B.availableWorkers(s).length;
  const placed = B.autoAssignWorkers(s);
  assert.ok(placed.length > 0);
  assert.equal(B.workersPlaced(s), Math.min(B.workerSlots(s), free, placed.length));
  const camp = src('src/ui/panels/camp.js');
  assert.doesNotMatch(camp, /bs-need[^\n]*icon_lock/);
  assert.match(camp, /\+ Ouvrier/);
  assert.match(camp, /Poser au mieux/);
  assert.match(camp, /Pose un ouvrier d\\'abord ↑/);
});

test('10.11 (4) : grand écran — combat recentré, rangée d\'actions et barre de vague centrées, sol réglé sur la bande du bas', () => {
  const scene = src('src/render/scene.js');
  assert.match(scene, /this\.centerShift = !tall && cssWidth >= 1300/);
  assert.match(scene, /this\.centerShift \?\? 0\)\) \/ SPREAD/);
  const ui = src('src/ui/ui.js');
  assert.match(ui, /const rowW = Math\.min\(area\.clientWidth - 16, 1200\);/);
  assert.match(ui, /Math\.max\(0\.55, Math\.min\(0\.86, \(H - need\)/);
  assert.match(src('src/ui/hud-quests.js'), /AW \/ 2 - used \/ 2/);
  assert.match(src('src/ui/layout109.css'), /width: min\(1400px, calc\(100% - 32px\)\)/);
});

test('10.11 (5, 6) : même forme dans un menu (pages dès 1300 px), contenu centré 1600 px, téléphone tout en plein écran', async () => {
  const P = await import('../src/ui/page.js');
  const ui = (w, tab) => ({ tab, layout: 'tall', root: { clientWidth: w }, view: {} });
  for (const t of ['skills', 'tree', 'companions', 'expeditions', 'inventory', 'upgrades', 'forge', 'camp']) assert.ok(P.pageActive(ui(1920, t)), t);
  assert.equal(P.pageActive(ui(1116, 'skills')), false, 'en dessous de 1300 px : la règle d\'avant');
  for (const t of ['summon', 'shop', 'daybook', 'companions']) assert.ok(P.pageActive(ui(390, t)), `téléphone ${t}`);
  const css = src('src/ui/layout109.css');
  assert.match(css, /calc\(\(100% - 1600px\) \/ 2\)/);
  assert.match(css, /max-height: 120px !important/);
  assert.match(src('src/ui/page.js'), /bottom \/= z;/);
});
