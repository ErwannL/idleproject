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
