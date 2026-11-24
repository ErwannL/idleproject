// v10.12 (rattrapage) : fiches Encyclopédie, fiche Boss et Paramètres reconstruits avec le kit sur téléphone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('10.12 rattrapage : les fiches de l\'Encyclopédie n\'utilisent plus le HTML d\'origine sur téléphone', () => {
  const s = src('src/ui/panels/encyclopedia.js');
  assert.match(s, /function pMonster/); assert.match(s, /function pBoss/); assert.match(s, /function pItem/); assert.match(s, /function pCompanion/); assert.match(s, /function pEnv/);
  assert.doesNotMatch(s, /detail\(state, key\)\.replaceAll/, 'plus de HTML d\'origine assombri');
  assert.match(s, /mpSwitch\('Exposition auto', 'auto-museum'/);
});

test('10.12 rattrapage : fiche Boss en kit, mêmes actions', () => {
  const s = src('src/ui/panels/boss.js');
  assert.match(s, /function bossDetailPhone/);
  for (const a of ['rechallenge', 'take-power', 'keep-power', 'reroll', 'toggle-power', 'claim-mastery']) assert.ok(s.includes(`'${a}'`) || s.includes(`"${a}"`), a);
  assert.doesNotMatch(s.slice(s.indexOf('function bossPhone'), s.indexOf('export default')), /\$\{bossDetail\(/, 'la fiche téléphone n\'appelle plus bossDetail');
});

test('10.12 rattrapage : Paramètres en interrupteurs et puces (plus de case à cocher ni de select sur téléphone)', () => {
  const o = src('src/ui/panels/options.js');
  assert.match(o, /function generalPhone/); assert.match(o, /function interfacePhone/); assert.match(o, /function soundPhone/);
  assert.match(o, /m-phone|isMPhone/);
  const u = src('src/ui/ui.js');
  assert.match(u, /interfaceExtraPhone\(pref\)/);
  const m = src('src/ui/panels/profile-m.js');
  for (const k of ['combat', 'motion', 'uiScale', 'compact', 'qtyMenu', 'skillGrid', 'bossFocus', 'panelFold', 'colorAid', 'contrast']) assert.ok(m.includes(`'${k}'`), `réglage ${k}`);
  assert.match(m, /<input type="checkbox" data-action="\$\{action\}"/);
});

test('10.12 rattrapage : le CSS ajouté reste limité au téléphone', () => {
  const css = src('src/ui/mobile-profile.css').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/(^|\})\s*([^{}@]+)\{/g)) for (const sel of m[2].split(',')) assert.match(sel.trim(), /^#app\.m-phone\b/, sel.trim());
});
