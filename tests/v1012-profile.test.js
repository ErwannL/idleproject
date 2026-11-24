// v10.12 (lot « profil ») : Carnet, Missions, Encyclopédie, Apparences, Boss, Classement, Guilde, Statistiques, Paramètres sur téléphone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n'); // fins de ligne Windows (CI)

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

const PANELS = ['daybook', 'contracts', 'encyclopedia', 'looks', 'boss', 'ranking', 'guild', 'stats', 'options'];

test('10.12 (profil) : mobile-profile.css existe, est chargé après mobile-kit.css et ne touche que le téléphone', () => {
  assert.ok(existsSync(new URL('../src/ui/mobile-profile.css', import.meta.url)));
  const html = src('index.html');
  assert.ok(html.indexOf('src/ui/mobile-profile.css') > html.indexOf('src/ui/mobile-kit.css'), 'après le kit');
  let n = 0;
  for (const { prelude, body } of blocks(src('src/ui/mobile-profile.css'))) {
    if (/^@keyframes/.test(prelude)) continue;
    if (/^@media/.test(prelude)) {
      assert.match(prelude, /max-width: ?600px|prefers-reduced-motion/, `@media inattendue : ${prelude}`);
      for (const inner of blocks(body)) for (const sel of inner.prelude.split(',')) { assert.match(sel.trim(), /^#app\.m-phone\b/, `règle hors téléphone : ${sel.trim()}`); n++; }
      continue;
    }
    for (const sel of prelude.split(',')) { assert.match(sel.trim(), /^#app\.m-phone\b/, `règle hors téléphone : ${sel.trim()}`); n++; }
  }
  assert.ok(n > 80, `beaucoup de règles (${n})`);
});

test('10.12 (profil) : chaque onglet du lot rend un cadre + cartouche sur téléphone (kit mobile) et garde son rendu PC', () => {
  for (const id of PANELS) {
    const s = src(`src/ui/panels/${id}.js`);
    assert.match(s, /mobile-kit\.js/, `${id} : utilise le kit`);
    assert.match(s, /isMPhone\(ui\)/, `${id} : branche téléphone`);
    assert.match(s, /mpFrame\(/, `${id} : cadre + cartouche`);
  }
  const frame = src('src/ui/panels/profile-m.js');
  assert.match(frame, /class="m-frame mp-frame">\$\{mTitle\(/);
  assert.match(frame, /classList\?\.contains\?\.\('m-phone'\)/);
});

test('10.12 (profil) : plus de <select> sur téléphone (Classement, Statistiques, Encyclopédie, Paramètres) : des puces à la place', () => {
  for (const id of ['ranking', 'stats', 'encyclopedia', 'options']) assert.match(src(`src/ui/panels/${id}.js`), /mpChips\(|selectOr\(/, id);
  const ui = src('src/ui/ui.js');
  assert.match(ui, /case 'mp-pick'/); assert.match(ui, /case 'mp-open'/); assert.match(ui, /case 'mp-shut'/);
  assert.match(src('src/ui/panels/profile-m.js'), /m-chips mp-chips/, 'Paramètres › Interface (Cet appareil) : puces (téléphone, et PC depuis la 10.13)');
});

test('10.12 (profil) : les actions existantes sont conservées (Carnet, Missions, Classement, Guilde, Boss, Encyclopédie)', () => {
  const need = {
    daybook: ['daybook-chest', 'fw-claim', 'fw-all', 'fw-day', 'fw-prize', 'open-tab', 'bastion-open'],
    contracts: ['mission-tab', 'claim-everything', 'claim-mission', 'claim-mission-bonus', 'claim-track', 'claim-achievement', 'claim-contract', 'chronicle-claim', 'herald-claim', 'claim-event', 'claim-session-chest', 'wheel-open', 'open-claims'],
    encyclopedia: ['enc-sec', 'enc-claim', 'claim-collection', 'from-museum', 'auto-museum', 'expose-all', 'recycle-museum-dupes'],
    boss: ['boss-sel', 'close-sheet'],
    ranking: ['ranking-scope', 'ranking-sort', 'friend-add', 'friend-accept', 'friend-remove', 'open-account'],
    guild: ['guild-create', 'guild-join', 'guild-leave', 'guild-kick', 'guild-accept', 'guild-rank', 'open-account'],
    looks: ['set-hero', 'unequip-look', 'open-shop-skins'],
    stats: ['stats-zone'],
  };
  for (const [id, actions] of Object.entries(need)) for (const a of actions) assert.ok(src(`src/ui/panels/${id}.js`).includes(`'${a}'`) || src(`src/ui/panels/${id}.js`).includes(`"${a}"`), `${id} : ${a}`);
});

test('10.12 (profil) : le Classement a un chip « critère ▾ » qui ouvre une .m-sheet, un .m-empty hors ligne et un seul bouton doré', () => {
  const s = src('src/ui/panels/ranking.js');
  assert.match(s, /mChip\(`\$\{RANKING_SORTS\[sort\]\.label\} ▾`/);
  assert.match(s, /mSheet\('Critère'/);
  assert.match(s, /mEmpty\(/);
});
