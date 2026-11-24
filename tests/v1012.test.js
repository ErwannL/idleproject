// v10.12 (docs/prompt-v10.12/PROMPT.md) : kit mobile (lot 1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n'); // fins de ligne Windows (CI)

// Découpe grossière d'une feuille de style en blocs { prelude, body } de premier niveau.
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

test('10.12 (kit) : les fichiers existent et index.html charge mobile-kit.css APRÈS mobile1012.css', () => {
  for (const f of ['src/ui/mobile-kit.css', 'src/ui/mobile-kit.js', 'tools/mobile-audit.mjs']) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), f);
  const html = src('index.html');
  const a = html.indexOf('src/ui/mobile1012.css');
  const b = html.indexOf('src/ui/mobile-kit.css');
  assert.ok(a > 0 && b > a, 'mobile-kit.css après mobile1012.css');
});

test('10.12 (kit) : toute règle de mobile-kit.css est limitée au téléphone (#app.m-phone) : aucun effet sur PC', () => {
  const css = src('src/ui/mobile-kit.css');
  let n = 0;
  for (const { prelude, body } of blocks(css)) {
    if (/^@keyframes/.test(prelude)) continue;
    if (/^@media/.test(prelude)) {
      assert.match(prelude, /max-width: ?600px|prefers-reduced-motion/, `@media inattendue : ${prelude}`);
      for (const inner of blocks(body)) for (const sel of inner.prelude.split(',')) { assert.match(sel.trim(), /^#app\.m-phone\b/, `règle hors téléphone : ${sel.trim()}`); n++; }
      continue;
    }
    for (const sel of prelude.split(',')) { assert.match(sel.trim(), /^#app\.m-phone\b/, `règle hors téléphone : ${sel.trim()}`); n++; }
  }
  assert.ok(n > 100, `beaucoup de règles (${n})`);
  for (const c of ['.m-frame', '.m-title', '.m-tabs', '.m-modes', '.m-card', '.m-tile', '.m-pips', '.m-stat', '.m-btn-gold', '.m-cost', '.m-bar', '.m-sheet', '.m-chip', '.m-empty']) assert.ok(css.includes(`#app.m-phone ${c}`), c);
  assert.match(css, /prefers-reduced-motion/);
});

test('10.12 (kit) : ui.js pose la classe m-phone sur #app et les actions m-help / m-sheet-close existent', () => {
  const ui = src('src/ui/ui.js');
  assert.match(ui, /classList\.toggle\('m-phone'/);
  assert.match(ui, /syncMPhone\(\)/);
  assert.match(ui, /case 'm-help'/);
  assert.match(ui, /case 'm-sheet-close'/);
});

test('10.12 (kit) : les helpers de mobile-kit.js rendent du HTML échappé avec les bonnes classes', async () => {
  globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const ctx2d = new Proxy({}, { get: (t, k) => (k === 'getImageData' || k === 'createImageData' ? (x, y, w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0)) * 4), width: w, height: h }) : k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
  globalThis.document ??= { createElement: () => ({ width: 1, height: 1, style: {}, getContext: () => ctx2d, toDataURL: () => 'data:' }) };
  globalThis.window ??= globalThis;
  const K = await import('../src/ui/mobile-kit.js');
  assert.match(K.mTitle('icon_gear', 'Forge <b>', true), /class="m-title"[\s\S]*Forge &#60;b&#62;[\s\S]*data-action="m-help"/);
  const tabs = K.mTabs([{ id: 'a', label: 'A', icon: 'icon_gear', action: 'go', value: 'a' }, { id: 'b', label: 'B', icon: 'icon_gear', action: 'go', value: 'b', badge: true }], 'b');
  assert.match(tabs, /class="m-tabs"/); assert.match(tabs, /aria-selected="true"/); assert.match(tabs, /aria-selected="false"/); assert.match(tabs, /data-action="go" data-value="a"/); assert.match(tabs, /m-dot/);
  assert.match(K.mModes([{ id: 'a', label: 'A', icon: 'icon_gear', action: 'go' }], 'a', { arrow: true }), /class="m-modes arrow"/);
  const item = { name: 'Épée "x"', rarity: 'epic', upgrades: 12, slot: 'weapon', baseId: 'nope' };
  const tile = K.mTile(item, { size: 80, action: 'select-item', id: 'i1', up: true, badge: '+817 %' });
  assert.match(tile, /class="m-tile s80 r-epic"/); assert.match(tile, /data-action="select-item" data-id="i1"/); assert.match(tile, /m-plus">\+12</); assert.match(tile, /m-up/); assert.match(tile, /m-gain/); assert.doesNotMatch(tile, /"x"/);
  assert.match(K.mTile(null, { slot: 'helmet', action: 'gear-slot' }), /m-tile s64 r-common empty/);
  const pips = (r) => (K.mPips(r).match(/<i><\/i>/g) ?? []).length;
  assert.deepEqual(['common', 'rare', 'epic', 'legendary', 'mythic', 'astral', 'ascendant'].map(pips), [1, 2, 3, 4, 5, 6, 7]);
  assert.match(K.mStat('icon_gear', 'Dégâts', '12', true), /class="m-stat big"/);
  assert.match(K.mCost('icon_shard', 5, 20), /m-cost ko/); assert.match(K.mCost('icon_shard', 50, 20), /m-cost ok/);
  const sheet = K.mSheet('Détails', '<p>x</p>', { close: 'my-close' });
  assert.match(sheet, /class="m-sheet" role="dialog" aria-modal="true" aria-label="Détails"/); assert.match(sheet, /data-action="my-close"/); assert.match(sheet, /data-action="m-sheet-close"/);
  assert.match(K.mChip('Tout', { action: 'f', value: 'all', on: true }), /class="m-chip on"/);
  assert.match(K.mEmpty('Vide', { icon: 'icon_gear', button: K.mBtn('OK') }), /class="m-empty"[\s\S]*class="m-btn"/);
  assert.match(K.mBtnGold('Go', { action: 'go' }), /class="m-btn-gold" {2}data-action="go"|class="m-btn-gold"[^>]*data-action="go"/);
  assert.match(K.mBtn('Go', { disabled: true }), /disabled/);
  assert.match(K.mBar(0.5), /--pct:50%/);
  assert.match(K.mGrid(['<i></i>'], 5), /class="m-grid" style="--cols:5"/);
});
