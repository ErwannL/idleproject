// v9.2.9 : non-régression de la passe de stabilité (tools/e2e-stabilite.mjs, audit-overflow, i18n-coverage).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'getImageData' || k === 'createImageData'
    ? (x, y, w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0)) * 4), width: w, height: h })
    : k === 'measureText' ? () => ({ width: 1 }) : k in t ? t[k] : () => {}),
  set: (t, k, v) => { t[k] = v; return true; },
});
globalThis.document ??= { createElement: () => ({ width: 1, height: 1, style: {}, getContext: () => ctx2d, toDataURL: () => 'data:' }) };
const { createNewState } = await import('../src/core/state.js');
const summon = (await import('../src/ui/panels/summon.js')).default;
const stats = (await import('../src/ui/panels/stats.js')).default;
const en = await import('../src/i18n/en.js');
const ko = await import('../src/i18n/ko.js');
const uiWith = (view = {}) => ({ view: { open: new Set(), closed: new Set(), ...view }, tabVisible: {}, invalidate: () => {}, sessionJournal: () => null });

test('Invocation : nom accessible au singulier pour un coût de 1 (« 1 ticket limité »)', () => {
  const s = createNewState(Date.now());
  s.ui.tour = 'done';
  for (const pool of ['limited', 'permanent', 'pet']) {
    const html = summon.render(uiWith({ summonPool: pool }), s);
    const labels = [...html.matchAll(/aria-label="(×\d+ : [^"]+)"/g)].map((m) => m[1]);
    assert.ok(labels.length, `boutons ×1/×10 présents (${pool})`);
    for (const l of labels) assert.doesNotMatch(l, /^×\d+ : 1 \S+s\b/, `pas de pluriel après 1 : ${l}`);
  }
});

test('Invocation : nom accessible des boutons traduit en anglais et en coréen', () => {
  for (const t of ['×1 : 1 ticket limité', '×10 : 10 tickets limités', '×1 : 1 ticket familier', '×10 : 10 tickets permanents', '×1 : 160 gemmes']) {
    assert.ok(en.lookup(t) && !/ticket[s]? (limit|perm|famil)|gemme/.test(en.lookup(t)), `en : ${t} → ${en.lookup(t)}`);
    assert.ok(ko.lookup(t) && !/[A-Za-zÀ-ÿ]{3}/.test(ko.lookup(t)), `ko : ${t} → ${ko.lookup(t)}`);
  }
});

test('Coréen : coûts et manques au singulier traduits (« 1 fragment »)', () => {
  for (const t of ['Il manque 1 fragment', 'Coût : 1 fragment', 'Apprendre : 1 fragment', "Si tu l'équipes (emplacement vide)"]) {
    const v = ko.lookup(t);
    assert.ok(v && !/[A-Za-zÀ-ÿ]{3}/.test(v), `${t} → ${v}`);
  }
});

test('Statistiques : nom complet du monde en bulle quand la barre le coupe', () => {
  const s = createNewState(Date.now());
  const html = stats.render(uiWith(), s);
  const spans = [...html.matchAll(/<span class="tb-label"([^>]*)>/g)];
  assert.ok(spans.length > 0, 'barres présentes');
  for (const m of spans) assert.match(m[1], /title="/);
});

test('Compagnons : la grille ne serre plus les noms (une colonne de moins, nom limité à 2 lignes masqué)', () => {
  const css = readFileSync(new URL('../src/ui/fit.css', import.meta.url), 'utf8');
  assert.match(css, /\.pet-label b \{ overflow: hidden !important; \}/);
  assert.match(css, /@container \(min-width: 480px\) \{ \.pet-grid\.pet-cards \{ --thumb-cols: 4; \} \}/);
  assert.match(css, /\.upg-cats \.chip-btn \{ flex: 1 1 auto;/);
});

test('Invocation : noms de la wishlist sur 2 lignes au lieu de « … » (sélecteur plus précis qu\'economy.css, chargé après)', () => {
  const css = readFileSync(new URL('../src/ui/fit.css', import.meta.url), 'utf8');
  assert.match(css, /\.eco-wish-row \.eco-wish-btn span \{ white-space: normal;/);
});

test('Barre du haut sur téléphone : boutons Boutique et ⚙ gardés dans l\'écran (montants jamais réduits)', () => {
  const css = readFileSync(new URL('../src/ui/fit.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(max-width: 420px\) \{[\s\S]*#topbar \.top-actions \{ flex: none;[\s\S]*#topbar \.chip \{ flex: none;/);
  assert.match(css, /@media \(max-width: 340px\) \{ #topbar \.top-xp, #topbar \.brand > img \{ display: none; \}/);
});

test('Toiles relues par getImageData créées avec willReadFrequently (pas la toile de la scène)', () => {
  for (const f of ['render/pixel.js', 'render/enemy-anchor.js', 'render/enemy-anim.js', 'render/wings.js', 'render/scene.js', 'ui/themes.js']) {
    const src = readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
    assert.match(src, /const RF = \{ willReadFrequently: true \};/, f);
    assert.doesNotMatch(src.replace("this.ctx = canvas.getContext('2d');", ''), /getContext\('2d'\)/, f);
  }
});
