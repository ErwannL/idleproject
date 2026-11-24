// v10.12 (lot 4) : Héros › Améliorations, Compétences, Talents, Forge sur téléphone (kit mobile).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('10.12 (hero) : mobile-hero.css est chargé après mobile-kit.css et toutes ses règles sont sous #app.m-phone', () => {
  const html = src('index.html');
  assert.ok(html.indexOf('src/ui/mobile-hero.css') > html.indexOf('src/ui/mobile-kit.css'), 'chargé après le kit');
  let n = 0;
  for (const { prelude, body } of blocks(src('src/ui/mobile-hero.css'))) {
    if (/^@keyframes/.test(prelude)) continue;
    if (/^@media/.test(prelude)) { for (const inner of blocks(body)) for (const sel of inner.prelude.split(',')) { assert.match(sel.trim(), /^#app\.m-phone\b/, sel); n++; } continue; }
    for (const sel of prelude.split(',')) { assert.match(sel.trim(), /^#app\.m-phone\b/, `règle hors téléphone : ${sel.trim()}`); n++; }
  }
  assert.ok(n > 80, `beaucoup de règles (${n})`);
});

test('10.12 (hero) : chaque panneau rend un .m-frame + .m-title sur téléphone et garde son rendu PC derrière le test m-phone', () => {
  for (const [file, title] of [['upgrades', "mTitle('icon_upgrade', 'Améliorations'"], ['skills', "mTitle('skill_quick', 'Compétences'"], ['tree', "mTitle('icon_tree', 'Talents'"], ['forge', "mTitle('icon_anvil', 'Forge'"]]) {
    const s = src(`src/ui/panels/${file}.js`);
    assert.ok(s.includes(title), `${file} : cartouche`);
    assert.match(s, /class="m-frame m-hero/, `${file} : cadre`);
    assert.match(s, /classList\.contains\('m-phone'\)/, `${file} : détection du téléphone`);
  }
});

test('10.12 (hero) : les actions existantes restent reliées (achat, quantité, tout acheter, apprendre, forge, talents)', () => {
  const all = ['upgrades', 'skills', 'tree', 'forge'].map((f) => src(`src/ui/panels/${f}.js`)).join('\n');
  for (const a of ['buy-amount', 'buy-best', 'buy-all-arm', 'data-action="buy"', 'learn-skill', 'upgrade-rush', 'distribute-skills', 'skill-auto', 'rush-auto', 'talent-best', 'talent-branch', 'tree-seg', 'forge-seg', 'recycle-useless', 'forge-up-sel', 'upgrade-item', 'gear-up', 'fuse-open', 'fuse-set', 'fuse-include', 'fuse-all', 'craft-slot', "action: 'craft'", 'rebirth', 'transcend']) {
    assert.ok(all.includes(a), `action ${a} présente`);
  }
  const ui = src('src/ui/ui.js');
  assert.match(ui, /case 'm-set'/);
  assert.match(ui, /case 'm-sheet-x'/);
});

test('10.12 (hero) : pas de <select> dans les vues téléphone, et les fiches sont rendues depuis l\'état de vue (id mSkillSheet / mTreeSheet)', () => {
  for (const f of ['skills', 'tree']) assert.match(src(`src/ui/panels/${f}.js`), /id: 'm(Skill|Tree)Sheet'/);
  const up = src('src/ui/panels/upgrades.js');
  const phone = up.slice(up.indexOf('if (phone) {\n      // v10.12'), up.indexOf('if (pageActive(ui) && !pageNarrow(ui))'));
  assert.ok(phone.length > 500 && !/<select/.test(phone));
});
