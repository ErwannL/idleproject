// v10.12 (lot « combat ») : Carte, Donjons, Arène, Défis, Événement sur téléphone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('10.12 combat : mobile-combat.css est chargé après mobile-kit.css et chaque règle est sous #app.m-phone', () => {
  const html = src('index.html');
  assert.ok(html.indexOf('src/ui/mobile-combat.css') > html.indexOf('src/ui/mobile-kit.css'));
  const css = src('src/ui/mobile-combat.css').replace(/\/\*[\s\S]*?\*\//g, '');
  let n = 0;
  for (const m of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) for (const sel of m[1].split(',')) { assert.match(sel.trim(), /^#app\.m-phone\b/, `règle hors téléphone : ${sel.trim()}`); n++; }
  assert.ok(n > 60, `assez de règles (${n})`);
  assert.ok(!/@media/.test(css), 'pas de @media : tout est sous #app.m-phone');
});

test('10.12 combat : chaque onglet rend un cadre + cartouche du kit sur téléphone, et garde sa voie PC', () => {
  for (const [file, title] of [['campaign', 'Carte'], ['dungeons', 'Donjons'], ['arena', 'Arène'], ['tower', 'Défis'], ['event', 'Événement']]) {
    const js = src(`src/ui/panels/${file}.js`);
    assert.match(js, /isPhoneUi\(ui\)/, `${file} : détecte le téléphone`);
    assert.match(js, /mobile-kit\.js/, `${file} : utilise le kit`);
    assert.match(js, new RegExp(`mTitle\\('[a-z_]+', '${title}'`), `${file} : cartouche « ${title} »`);
    assert.match(js, /m-frame/, `${file} : cadre`);
  }
});

test('10.12 combat : les actions existantes restent dans les rendus téléphone', () => {
  const need = {
    campaign: ['zone-sel', 'stage', 'revenge', 'retry-boss', 'advance', 'open-tab', 'cycle-pick', 'toggle-auto'],
    dungeons: ['dungeon-sel', 'sweep-n', 'sweep-all-ask'],
    tower: ['enter-tower', 'leave-tower', 'enter-challenge', 'leave-challenge', 'defi-tab'],
    arena: ['arena-mode'],
    event: ['event-fight', 'event-chain', 'event-buy', 'event-boss', 'lights-step', 'lights-all', 'lights-buy', 'event-goal'],
  };
  for (const [f, actions] of Object.entries(need)) {
    const js = src(`src/ui/panels/${f}.js`);
    for (const a of actions) assert.ok(js.includes(a), `${f} : ${a}`);
  }
  const ui = src('src/ui/ui.js');
  for (const a of ['cycle-pick', 'tower-info', 'close-panel']) assert.ok(ui.includes(`case '${a}'`), `ui.js : ${a}`);
});
