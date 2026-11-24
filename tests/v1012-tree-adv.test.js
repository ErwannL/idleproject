// v10.12 (tour 2) : Arbre avancé sur téléphone — une région à la fois, nœuds ronds, fiche de talent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('10.12 : l\'arbre avancé téléphone passe par phoneAdvanced, sans zoom, avec fiche et actions existantes', () => {
  const js = src('src/ui/panels/tree.js');
  assert.match(js, /seg === 'tree'\) content = phoneAdvanced\(ui, state\)/);
  assert.match(js, /function phoneTalentSheet/);
  assert.match(js, /action: 'buy-talent'/);
  assert.match(js, /action: 'buy-talent-max'/);
  assert.match(js, /action: 'respec-talents'/);
  assert.match(js, /action: 'ask-buy-talents'/);
  assert.match(js, /m-tnode/);
});

test('10.12 : le CSS de l\'arbre avancé est sous #app.m-phone', () => {
  const css = src('src/ui/mobile-hero.css').split('/* ---------- Arbre avancé')[1];
  assert.ok(css && css.includes('.m-tnode'));
  for (const line of css.split('\n').filter((l) => /\{/.test(l))) assert.match(line.trim(), /^#app\.m-phone\b/, line);
});
