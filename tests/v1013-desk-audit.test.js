// v10.13 (lot 1) : kit PC (desk-kit.css) et contrôle automatique PC (tools/desk-audit.mjs).
// Le contrôle complet est lent : DESK_AUDIT=1 node --test tests/v1013-desk-audit.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('10.13 (kit PC) : desk-kit.css est chargé après les feuilles mobile-* et ne touche que le PC', () => {
  const html = src('index.html');
  const at = html.indexOf('src/ui/desk-kit.css');
  assert.ok(at > 0, 'desk-kit.css dans index.html');
  for (const m of html.matchAll(/src\/ui\/(mobile-[a-z0-9]+)\.css/g)) assert.ok(at > html.indexOf(m[0]), `après ${m[1]}`);
  const css = src('src/ui/desk-kit.css').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*\s*\}/g, '');
  let n = 0;
  // on retire les blocs @media pour ne garder que les règles (leurs règles internes sont lues aussi)
  for (const m of css.matchAll(/(^|[};])\s*([^{};@]+)\{/g)) for (const sel of m[2].split(',')) { assert.match(sel.trim(), /^#app(#app)?(\.page-ui(\.page-narrow|:not\(\.page-narrow\))?)?:not\(\.m-phone\)(\s|$)/, `hors PC : ${sel.trim()}`); n++; }
  assert.ok(n > 100, `des règles (${n})`);
});

test('10.13 (kit PC) : les composants et les grilles du kit sont définis', () => {
  const css = src('src/ui/desk-kit.css');
  for (const c of ['.m-frame', '.m-title', '.m-tabs', '.m-modes', '.m-mode', '.m-tile', '.m-stat', '.m-cost', '.m-btn-gold', '.m-btn', '.m-chip', '.m-card', '.m-bar', '.m-grid', '.m-sheet', '.d-cols3a', '.d-cols3b', '.d-cols2'])
    assert.ok(css.includes(`not(.m-phone) ${c}`), c);
  assert.match(css, /\.d-cols3a \{ grid-template-columns: 380px 400px minmax\(0, 1fr\)/);
  assert.match(css, /\.d-cols3b \{ grid-template-columns: 340px minmax\(0, 1fr\) 470px/);
  assert.match(css, /\.d-cols2 \{ grid-template-columns: minmax\(0, 1fr\) 465px/);
  assert.match(css, /\.m-mode \{ height: 86px/);
  assert.match(css, /\.m-btn-gold \{\s*height: 62px/);
  assert.match(css, /padding: 80px 22px 22px/);
  assert.match(css, /padding: 6px 24px 20px var\(--d-frame-left\)/);
});

test('10.13 (desk-audit) : les 9 contrôles, les 4 tailles PC et les outils de capture existent', () => {
  for (const f of ['tools/desk-audit.mjs', 'tools/compare-1013.mjs', 'tools/capture-1013.mjs', 'tools/lib-1013.mjs']) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), f);
  const a = src('tools/desk-audit.mjs');
  for (let i = 1; i <= 9; i++) assert.ok(a.includes(`${i}: '`), `contrôle ${i}`);
  const lib = src('tools/lib-1013.mjs');
  for (const s of ['1116x993', '1366x768', '1878x1245', '1920x1080', '412x915', '390x844']) assert.ok(lib.includes(s), s);
  for (const o of ['--tabs', '--sizes', '--games', '--out']) assert.ok(a.includes(`'${o.slice(2)}'`), o);
});

test('10.13 (desk-audit) : contrôle PC complet (seulement avec DESK_AUDIT=1)', async (t) => {
  if (process.env.DESK_AUDIT !== '1') { t.skip('DESK_AUDIT=1 pour lancer le contrôle PC'); return; }
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('node', ['tools/desk-audit.mjs', '--out', 'docs/screenshots/v10.13/apres'], { encoding: 'utf8', timeout: 1800000 });
  assert.equal(r.status, 0, r.stdout.slice(-3000));
});
