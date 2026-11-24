// v10.12 (finition) : Bastion › Recherches sur téléphone (kit mobile).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('10.12 (recherches) : mobile-research.css est chargé après le kit et ne touche que le téléphone', () => {
  const html = src('index.html');
  assert.ok(html.indexOf('src/ui/mobile-research.css') > html.indexOf('src/ui/mobile-kit.css'));
  const css = src('src/ui/mobile-research.css').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*\s*\}/g, '');
  let n = 0;
  for (const m of css.matchAll(/(^|\})\s*([^{}@]+)\{/g)) for (const sel of m[2].split(',')) { assert.match(sel.trim(), /^#app\.m-phone\b/, `hors téléphone : ${sel.trim()}`); n++; }
  assert.ok(n > 40, `des règles (${n})`);
});

test('10.12 (recherches) : l\'arbre téléphone garde les actions et passe par le kit', () => {
  const js = src('src/ui/panels/camp.js');
  const tree = js.slice(js.indexOf('function researchTreePhone'), js.indexOf('function researchSheetPhone'));
  for (const a of ['bastion-page', 'bastion-branch', 'bastion-res']) assert.ok(tree.includes(a), a);
  assert.ok(tree.includes('mModes('), 'paliers et branches en .m-modes');
  const sheet = js.slice(js.indexOf('function researchSheetPhone'));
  assert.ok(sheet.includes('bastion-research') && sheet.includes('mBtnGold') && sheet.includes('mCost'));
  assert.ok(js.includes('if (PHONE) return researchTreePhone') && js.includes('if (PHONE) return researchSheetPhone'));
});
