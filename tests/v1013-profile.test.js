// v10.13 (lot « profil » PC) : Paramètres, Classement, Guilde, Statistiques, Boss, Encyclopédie en kit sur PC (desk-profile.css).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('10.13 (profil PC) : desk-profile.css est chargé après desk-kit.css et ne touche que le PC', () => {
  const html = src('index.html');
  assert.ok(html.indexOf('src/ui/desk-profile.css') > html.indexOf('src/ui/desk-kit.css'), 'après desk-kit.css');
  const css = src('src/ui/desk-profile.css').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*\s*\}/g, '');
  let n = 0;
  for (const m of css.matchAll(/(^|[};])\s*([^{};@]+)\{/g)) for (const sel of m[2].split(',')) { assert.match(sel.trim(), /^#app:not\(\.m-phone\)(\s|$)/, `hors PC : ${sel.trim()}`); n++; }
  assert.ok(n > 150, `des règles (${n})`);
});

test('10.13 (profil PC) : les six onglets rendent le kit sur PC (cadre + cartouche) ; « Cet appareil » sans <select>', () => {
  for (const id of ['options', 'ranking', 'guild', 'stats', 'boss', 'encyclopedia']) {
    const s = src(`src/ui/panels/${id}.js`);
    assert.match(s, /isMPhone\(ui\)/, `${id} : isMPhone`);
    assert.match(s, /mpFrame\(/, `${id} : cadre + cartouche`);
  }
  const ui = src('src/ui/ui.js');
  const extra = ui.slice(ui.indexOf('  interfaceExtra() {'), ui.indexOf('  openSearch() {'));
  assert.doesNotMatch(extra, /<select/, 'Cet appareil : puces et interrupteurs');
  assert.match(extra, /interfaceExtraPhone\(pref\)/);
  assert.match(extra, /capture-key/);
  assert.match(extra, /reset-keys/);
});

test('10.13 (profil PC) : les réglages et actions du PC sont conservés dans le rendu en kit', () => {
  const need = {
    options: ['lang', 'save', 'export-save', 'import-open', 'import-save', 'tour-full', 'replay-prologue', 'reset', 'combat-assist', 'char-size', 'vigil-auto', 'simple-mode', 'notify',
      'cinematics', 'screen-shake', 'auto-equip', 'skill-names', 'gain-feed', 'big-auras', 'metrics-opt-in', 'sleep-mode', 'show-journal', 'show-shortcuts', 'theme', 'mute', 'volume', 'opt-tab'],
    ranking: ['ranking-scope', 'ranking-sort', 'ranking-world', 'friend-add', 'friend-accept', 'friend-remove', 'open-account'],
    guild: ['guild-create', 'guild-join', 'guild-leave', 'guild-search', 'guild-kick', 'guild-accept', 'guild-rank', 'open-account'],
    boss: ['boss-sel', 'rechallenge', 'take-power', 'keep-power', 'reroll', 'toggle-power', 'claim-mastery'],
    encyclopedia: ['enc-sec', 'enc-claim', 'claim-collection', 'from-museum', 'auto-museum', 'expose-all', 'recycle-museum-dupes'],
  };
  for (const [id, actions] of Object.entries(need)) {
    const s = src(`src/ui/panels/${id}.js`);
    for (const a of actions) assert.ok(s.includes(`'${a}'`) || s.includes(`action="${a}"`), `${id} : ${a}`);
  }
});
