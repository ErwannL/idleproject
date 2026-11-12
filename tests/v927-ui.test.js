// v9.2.7 : arbre de talents lisible (valeur, coût, état, ce que ça débloque) et traductions des nouveaux textes.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'getImageData' || k === 'createImageData'
    ? (x, y, w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0)) * 4), width: w, height: h })
    : k === 'measureText' ? () => ({ width: 1 }) : k in t ? t[k] : () => {}),
  set: (t, k, v) => { t[k] = v; return true; },
});
globalThis.document ??= { createElement: () => ({ width: 1, height: 1, getContext: () => ctx2d, toDataURL: () => 'data:' }) };
const { createNewState } = await import('../src/core/state.js');
const tree = await import('../src/ui/panels/tree.js');
const { EXACT_927 } = await import('../src/i18n/en-927.js');
const ko = await import('../src/i18n/ko-927.js');
const uiWith = (view = {}, open = []) => ({ view: { open: new Set(open), closed: new Set(), ...view }, tabVisible: {}, invalidate: () => {} });

test('Arbre : chaque nœud montre icône, valeur et coût ; le Cœur montre ce qu\'il débloque', () => {
  const s = createNewState(Date.now());
  s.records.rebirths = 3; // v9.3.9 : arbre avancé
  s.fragments = 100;
  const html = tree.default.render(uiWith({ treeSeg: 'tree' }), s);
  assert.match(html, /class="tnode k-core open afford/);
  assert.match(html, /class="tn-cost">/);
  assert.match(html, /class="tn-val">\+\d/);
  assert.match(html, /Débloque ensuite :/);
  assert.match(html, /class="tnode k-small locked"/); // voisins du Cœur visibles, verrouillés
  assert.match(html, /class="region-label"/);
  assert.match(html, /tree-legend2/);
  assert.ok(!html.includes('data-action="tree-zoom"'), 'zoom fluide sans redessiner');
});

test('Arbre : un nœud appris au maximum est marqué, sans coût', () => {
  const s = createNewState(Date.now());
  s.records.rebirths = 3; // v9.3.9 : arbre avancé
  s.talents.core = 5;
  const html = tree.default.render(uiWith({ treeSeg: 'tree' }), s);
  const core = html.match(/<button class="tnode k-core[^"]*"[\s\S]*?<\/button>/)[0];
  assert.match(core, /maxed/);
  assert.match(core, /tn-max/);
  assert.ok(!core.includes('tn-cost'));
});

test('Traductions 9.2.7 : mêmes clés en anglais et en coréen', () => {
  assert.deepEqual(Object.keys(ko.EXACT_927).sort(), Object.keys(EXACT_927).sort());
  for (const v of Object.values(ko.EXACT_927)) assert.ok(!/[àâçéèêëîïôûù]/i.test(v));
});
