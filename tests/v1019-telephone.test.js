// v10.19 (parties 2, 3 et 7) : gestes, Équipement et petites corrections téléphone (contrôles de source ; le test en navigateur
// est tools/e2e-1019-swipe.mjs et le contrôle 26 de tools/mobile-audit.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const src = (p) => readFileSync(p, 'utf8');

test('10.19 (2.1-2.3) : le geste « glisser = sous-onglet suivant » ignore les rangées qui défilent à l\'horizontale', () => {
  const ui = src('src/ui/ui.js');
  assert.match(ui, /scrollWidth > el\.clientWidth \+ 2 && \(ox === 'auto' \|\| ox === 'scroll'\)/);
  assert.match(ui, /el\.scrollLeft !== left/);
  assert.match(ui, /'\.map-viewport, \.tree-viewport, #panel-subtabs, input, select, textarea'/);
  assert.ok(existsSync('tools/e2e-1019-swipe.mjs'), 'test Playwright 2.4');
});
