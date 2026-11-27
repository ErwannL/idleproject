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

test('10.19 (3) : Équipement téléphone : modes en haut, une ligne personnage, 6 places sur une rangée, « Équiper le meilleur (N) », puis le Sac', () => {
  const s = src('src/ui/panels/equip-phone.js');
  const ret = s.match(/<div class="m-frame em em19">[^\n]*/)[0];
  const order = ['modeBar', 'whoRow', 'charLine', 'slotTiles', 'bestButton', 'content', 'statsBlock'].map((k) => ret.indexOf(k));
  assert.ok(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), `ordre : ${order}`);
  assert.match(s, /⬆ Équiper le meilleur \(\$\{n\}\)/);
  assert.match(s, /action: 'eq-quick'/);
  assert.match(s, /mGrid\(cells, cells\.length\)/);
  const css = src('src/ui/mobile-equip.css');
  assert.match(css, /\.em19 \.em-who \{ width: 44px; height: 44px;/);
  assert.match(css, /\.em-mini \{[^}]*width: 56px; height: 56px;/);
  for (const rule of css.split('\n').filter((l) => /em19|em-line|em-mini|em-best|em-better/.test(l) && l.includes('{'))) assert.ok(rule.startsWith('#app.m-phone') || rule.startsWith('@media'), `règle hors téléphone : ${rule}`);
  assert.match(src('tools/mobile-audit.mjs'), /26: 'Équipement : haut du Sac pas visible sans défiler'/);
});

test('10.19 (7.1, 7.2, 7.3, 7.5, 7.6) : marquee depuis le début, pièces derrière les fenêtres, bulle au-dessus de la barre, marge de la Forge', () => {
  const mq = src('src/ui/marquee.js');
  assert.match(mq, /MQ_PAUSE = 1500/);
  assert.match(mq, /if \(st\.covered && !covered\) st\.anim\.currentTime = 0;/);
  assert.match(src('src/ui/mobile-hud.css'), /#combat-console #news-text \{[^}]*white-space: nowrap; overflow: hidden;/);
  assert.match(src('src/main.js'), /#modal:not\(\.hidden\)'\) \|\| \(ui\.root\.classList\.contains\('m-phone'\) && ui\.root\.classList\.contains\('panel-open'\)\)\) return;/);
  const tuto = src('src/ui/tutorial.js');
  assert.match(tuto, /if \(st\.finger && !panelOpen\) \{/);
  assert.match(tuto, /bubble\.classList\.add\('tuto-down'\)/);
  assert.match(src('src/ui/mobile-hero.css'), /\.m-fg-body\.m-fg-craft \{ padding-bottom: 72px; \}/);
  assert.ok(existsSync('tools/e2e-1019-phone.mjs'));
});

test('10.19 (7.1) : plan du marquee : 1,5 s de pause au début', async () => {
  const { marqueePlan } = await import('../src/ui/marquee.js');
  const p = marqueePlan(90);
  assert.equal(Math.round(p.offsets[1] * p.total), 1500);
});
