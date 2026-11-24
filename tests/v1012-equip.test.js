// v10.12 (lot « équipement ») : Héros › Équipement et fiche « Détails de l'équipement » en kit mobile.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function blocks(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  let depth = 0, start = 0, bodyStart = 0, prelude = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') { if (depth === 0) { prelude = text.slice(start, i).trim(); bodyStart = i + 1; } depth++; }
    else if (text[i] === '}') { depth--; if (depth === 0) { out.push({ prelude, body: text.slice(bodyStart, i) }); start = i + 1; } }
  }
  return out;
}

test('10.12 (équipement) : mobile-equip.css est limité au téléphone et chargé après le kit', () => {
  const css = src('src/ui/mobile-equip.css');
  let n = 0;
  for (const { prelude } of blocks(css)) {
    if (/^@/.test(prelude)) continue;
    for (const sel of prelude.split(',')) { assert.match(sel.trim(), /^#app\.m-phone\b/, `règle hors téléphone : ${sel.trim()}`); n++; }
  }
  assert.ok(n > 80, `beaucoup de règles (${n})`);
  const html = src('index.html');
  assert.ok(html.indexOf('src/ui/mobile-equip.css') > html.indexOf('src/ui/mobile-kit.css') && html.includes('mobile-equip.css'), 'mobile-equip.css après mobile-kit.css');
});

test('10.12 (équipement) : le rendu téléphone est bâti avec le kit (cadre, cartouche, modes, fiche, un seul bouton doré)', () => {
  const js = src('src/ui/panels/equip-phone.js');
  assert.match(js, /class="m-frame em">\$\{mTitle\('icon_gear', 'Équipement', true\)\}/);
  assert.match(js, /mModes\(/);
  assert.match(js, /mSheet\(/);
  assert.match(js, /'Détails de l\\'équipement'/);
  for (const action of ['gear-who', 'eq-slot', 'eq-quick', 'select-item', 'eq-tab', 'item-tab', 'upgrade-item', 'gear-up', 'upgrade-all', 'reforge', 'target-reroll', 'sharpen', 'equip', 'gear-equip', 'lock', 'to-stash', 'to-museum', 'recycle', 'eq-unequip', 'gear-unequip', 'bag-menu', 'filter']) {
    assert.ok(js.includes(`'${action}'`) || js.includes(`"${action}"`), `action ${action} gardée`);
  }
  assert.ok(!/<select/.test(js), 'aucun <select> sur téléphone');
  const inv = src('src/ui/panels/inventory.js');
  assert.match(inv, /if \(phone\) return phoneView\(/);
  assert.match(inv, /isPhoneView\(ui\)\) \{ phoneAfter/);
});

test('10.12 (équipement) : « Tout améliorer » existe dans main.js (boucle plafonnée) et ui.js', () => {
  const main = src('src/main.js');
  assert.match(main, /upgradeAll\(who\)/);
  assert.match(main, /i < 60/);
  assert.match(src('src/ui/ui.js'), /case 'upgrade-all': a\.upgradeAll\(value\)/);
});
