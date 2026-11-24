// v10.12 (lot « équipe ») : Compagnons, Bastion, Expéditions sur téléphone (kit mobile).
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

test('10.12 (équipe) : mobile-team.css est chargé après mobile-kit.css et ne touche que le téléphone', () => {
  const html = src('index.html');
  assert.ok(html.indexOf('src/ui/mobile-team.css') > html.indexOf('src/ui/mobile-kit.css'), 'après le kit');
  let n = 0;
  for (const { prelude, body } of blocks(src('src/ui/mobile-team.css'))) {
    if (/^@keyframes/.test(prelude)) continue;
    const rules = /^@media/.test(prelude) ? blocks(body).map((b) => b.prelude) : [prelude];
    for (const r of rules) for (const sel of r.split(',')) { assert.match(sel.trim(), /^#app\.m-phone\b/, `règle hors téléphone : ${sel.trim()}`); n++; }
  }
  assert.ok(n > 40, `des règles (${n})`);
});

test('10.12 (équipe) : les trois panneaux rendent un cadre + cartouche du kit sur téléphone, sans <select>', () => {
  const comp = src('src/ui/panels/companions.js');
  assert.match(comp, /m-frame mt-frame mt-comp/);
  assert.match(comp, /mTitle\('icon_paw', 'Compagnons', true\)/);
  assert.match(comp, /mModes\(/);
  for (const a of ['gear-team', 'upgrade-team', 'companion-sel', 'comp-tab', 'toggle-companion', 'set-front']) assert.ok(comp.includes(a), a);
  const camp = src('src/ui/panels/camp.js');
  assert.match(camp, /m-frame mt-frame mt-bastion/);
  assert.match(camp, /mTitle\('tab_expeditions', 'Bastion', true\)/);
  for (const a of ['bastion-view', 'bastion-autoplace', 'bastion-kick-ok', 'bastion-age-ok', 'bastion-worker', 'bastion-build', 'bastion-research']) assert.ok(camp.includes(a), a);
  assert.match(camp, /Continuer/);
  const exp = src('src/ui/panels/expeditions.js');
  assert.match(exp, /m-frame mt-frame mt-exp/);
  assert.match(exp, /mTitle\('icon_chest', 'Expéditions', true\)/);
  const phoneBlock = exp.slice(exp.indexOf('function phoneSlot'), exp.indexOf("export default {"));
  assert.ok(!/<select/.test(phoneBlock), 'aucun <select> dans la vue téléphone des Expéditions');
  for (const a of ['start-expedition', 'send-all-expeditions', 'claim-all-expeditions', 'relaunch-expeditions', 'recall-expedition', 'claim-expedition']) assert.ok(exp.includes(a), a);
  const ui = src('src/ui/ui.js');
  for (const a of ["case 'exp-open'", "case 'exp-pick-tile'", "case 'exp-slot-dur'", "case 'gear-filter-set'"]) assert.ok(ui.includes(a), a);
});
