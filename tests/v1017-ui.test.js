// v10.17 (parties C, D, E) : texte qui défile, 4 styles de bouton en variables, thèmes, bannières, points de compétence,
// fragments, Boutique, Bastion. Contrôles de source (le rendu est contrôlé par tools/text-fit-audit.mjs, tools/theme-audit.mjs,
// tools/desk-audit.mjs et tools/mobile-audit.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { marqueePlan, MQ_PAUSE, MQ_SPEED } from '../src/ui/marquee.js';
import { translate as en } from '../src/i18n/en.js';
import { translate as ko } from '../src/i18n/ko.js';
import { EXACT_1017_UI as EN } from '../src/i18n/en-1017-ui.js';
import { EXACT_1017_UI as KO } from '../src/i18n/ko-1017-ui.js';
import { mpBanner } from '../src/ui/panels/profile-m.js';
import { BTN_EXCLUDE, MAX_BTN_STYLES } from '../tools/audit-1017.mjs';
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('10.17 (C) : défilement : 30 px/s, 1,5 s de pause au début et à la fin', () => {
  assert.equal(MQ_SPEED, 30);
  assert.equal(MQ_PAUSE, 1500);
  const p = marqueePlan(90); // 3 s de trajet
  assert.equal(p.total, 1500 + 3000 + 1500 + 400);
  assert.deepEqual(p.offsets.map((x) => Math.round(x * 1000) / 1000), [0, Math.round(1500 / 6400 * 1000) / 1000, Math.round(4500 / 6400 * 1000) / 1000, Math.round(6000 / 6400 * 1000) / 1000, 1]);
  for (let i = 1; i < p.offsets.length; i++) assert.ok(p.offsets[i] > p.offsets[i - 1]);
});

test('10.17 (C) : marquee chargé (CSS et JS), désactivé par « Réduire les animations » (2 lignes)', () => {
  const html = src('index.html');
  assert.match(html, /src\/ui\/marquee\.css/);
  assert.match(html, /src\/ui\/ui1017\.css/);
  assert.match(html, /id="news-text" class="mq"/);
  assert.match(html, /id="hp-cur"/);
  assert.match(src('src/main.js'), /initMarquee\(\)/);
  const js = src('src/ui/marquee.js');
  assert.match(js, /reduceMotion\(\)/);
  assert.match(js, /MutationObserver/);
  assert.match(src('src/ui/marquee.css'), /\.mq-wrap \{[^}]*white-space: normal/);
});

test('10.17 (D) : 4 styles de bouton en variables, un arrondi, 3 tailles de texte, hauteurs 44/36 et 48/40', () => {
  const c = src('src/ui/ui1017.css');
  assert.match(c, /--btn-r: 10px; --btn-h: 44px; --btn-h2: 36px; --btn-fs-s: 13px; --btn-fs: 15px; --btn-fs-l: 18px;/);
  assert.match(c, /#app\.m-phone \{ --btn-h: 48px; --btn-h2: 40px; \}/); // v10.17.1 (8) : secondaires 40 px
  for (const v of ['--btn-gold-bg', '--btn-bg', '--btn-link-ink', '--btn-danger-bg']) assert.ok(c.includes(`var(${v})`), v);
  assert.equal(MAX_BTN_STYLES, 4);
  assert.match(BTN_EXCLUDE, /\[role="tab"\]/);
  assert.match(BTN_EXCLUDE, /\.m-chip/);
});

test('10.17 (D) : bannières des écrans pauvres en image, Boutique en clair', () => {
  for (const l of ['Objectifs', 'Missions', 'Paramètres', 'Classement', 'Statistiques']) assert.match(mpBanner(l), /class="mp-banner"><img class="px" src="assets\/ui\/art\d+\/\w+\.png"/, l);
  assert.equal(mpBanner('Guilde'), '');
  assert.match(src('src/ui/panels/shop.js'), /m-soon m-soon-big" role="note"><b>🔒 Achats bientôt disponibles<\/b>/);
});

test('10.17 (D) : un raccourci avec var() est aussi recoloré par le thème', () => {
  const t = src('src/ui/themes.js');
  assert.match(t, /const SHORTHANDS = \['background', 'border'/);
  assert.match(t, /style\.cssText\.includes\('var\('\)/);
});

test('10.17 (E) : points de compétence en grand et sur « Héros », fragments « Où en trouver », Bastion en notification', () => {
  const sk = src('src/ui/panels/skills.js');
  assert.match(sk, /function ptsBanner\(pts, cls\)/);
  assert.match(sk, /points à dépenser/);
  assert.match(src('index.html'), /id="pts-hero"/);
  assert.match(src('src/ui/ui.js'), /skillPointsAvailable\(state\)/);
  assert.match(src('src/ui/panels/tree.js'), /const missingGo = \(n\) => `\$\{missing\(n\)\} <button type="button" class="why-go" data-action="open-tab" data-value="upgrades">Où en trouver ›<\/button>`/);
  const camp = src('src/ui/panels/camp.js');
  assert.match(camp, /bs-kick bs-toast/);
  assert.match(camp, /const KICK_MS = 6000;/);
  assert.doesNotMatch(camp, /function kickSheet/);
});

test('10.17 : textes en anglais et en coréen, branchés à la fin de en.js et ko.js', () => {
  assert.deepEqual(Object.keys(EN).sort(), Object.keys(KO).sort());
  // v10.18 : d'autres fichiers de textes se branchent après celui-ci (plus d'ancre de fin de fichier).
  assert.match(src('src/i18n/en.js'), /import \{ EXACT_1017_UI, patterns1017Ui \} from '\.\/en-1017-ui\.js';\s*for[^\n]*\nPATTERNS\.unshift\(\.\.\.patterns1017Ui\(\)\);/);
  assert.match(src('src/i18n/ko.js'), /import \{ EXACT_1017_UI, patterns1017Ui \} from '\.\/ko-1017-ui\.js';\s*for[^\n]*\nPATTERNS\.unshift\(\.\.\.patterns1017Ui\(\)\);/);
  assert.equal(en('points à dépenser'), 'points to spend');
  assert.equal(en('🔒 Achats bientôt disponibles'), '🔒 Purchases coming soon');
  assert.equal(en('152 points de compétence à dépenser'), '152 skill points to spend');
  assert.equal(ko('Il manque 3 fragments'), '조각 3개 부족');
  assert.notEqual(ko('points à dépenser'), 'points à dépenser');
});
