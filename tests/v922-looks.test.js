// v9.2.2 : apparences dans un sous-onglet visible Héros › Apparences.
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

const { MENUS, navPath } = await import('../src/ui/nav.js');
const looks = (await import('../src/ui/panels/looks.js')).default;
const hero = (await import('../src/ui/panels/hero.js')).default;
const { createNewState } = await import('../src/core/state.js');
const { translate: en } = await import('../src/i18n/en.js');
const { translate: ko } = await import('../src/i18n/ko.js');

const ui = (view = {}) => ({ view: { open: new Set(), closed: new Set(), ...view }, tabVisible: {} });

test('Héros › Apparences : sous-onglet du menu Héros, état et bouton Équiper sur chaque carte', () => {
  assert.ok(MENUS.find((m) => m.id === 'hero').tabs.includes('looks'));
  assert.equal(navPath('looks'), 'Héros › Apparences');
  const s = createNewState(Date.now());
  s.heroes.owned.fairy = { stars: 1 };
  const html = looks.render(ui(), s);
  assert.match(html, /look-status on">Équipée/);
  assert.match(html, /look-status owned">Possédée/);
  assert.match(html, /Verrouillée/);
  assert.match(html, /Obtenu par invocation/);
  assert.match(html, /<button[^>]*data-action="set-hero" data-value="fairy">Équiper<\/button>/);
  // La fiche n'a plus de segment Apparence, seulement un raccourci.
  const sheet = hero.render(ui(), s);
  assert.doesNotMatch(sheet, /data-value="look"/);
  assert.match(sheet, /data-action="open-looks"/);
});

test('Apparences : chaînes traduites en anglais et en coréen', () => {
  for (const t of ['Apparences', 'Équipée', 'Possédée', 'Verrouillée', 'Équiper', 'Apparence équipée', "Touchez une apparence possédée pour l'équiper. Bonus +20 % par étoile.", 'Équiper Paladin']) {
    assert.notEqual(en(t), t, t);
    assert.notEqual(ko(t), t, t);
  }
});
