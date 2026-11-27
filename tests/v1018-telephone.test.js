// v10.18 (parties 2 et 3) : écran de combat et fenêtres sur téléphone — contrôles statiques (le contrôle dans le navigateur
// est fait par tools/mobile-audit.mjs, contrôles 21 à 24, et tools/desk-audit.mjs, contrôles 16 à 18).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { disabledReason } from '../src/ui/why-off.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const css = read('src/ui/telephone1018.css');
const ui = read('src/ui/ui.js');

test('la feuille telephone1018.css est chargée après les feuilles de la 10.17', () => {
  const html = read('index.html');
  const at = html.indexOf('src/ui/telephone1018.css');
  assert.ok(at > 0, 'lien présent');
  assert.ok(at > html.indexOf('src/ui/finitions10171.css'), 'après finitions10171.css');
});

test('2.1 : touche gardée = coche ronde de 18 px en haut à droite, « en attente » dans l\'aria-label', () => {
  assert.match(ui, /<b class="sk-queued" aria-hidden="true">✓<\/b>/);
  assert.ok(!/✓ en attente<\/b>/.test(ui), 'plus de pastille « ✓ en attente » sous la touche');
  assert.match(ui, /setAttribute\('aria-label', q \? `\$\{sk\.name\} : en attente` : sk\.name\)/);
  const rule = css.match(/\.sk-queued \{([^}]*)\}/)?.[1] ?? '';
  assert.match(rule, /width: 18px/); assert.match(rule, /height: 18px/); assert.match(rule, /right: -6px/); assert.match(rule, /top: -6px/); assert.match(rule, /border-radius: 50%/);
});

test('2.2 : Sceau — titre et raison sur une ligne (12 px), la colonne des touches garde sa largeur', () => {
  assert.match(css, /#next-action-text \{[^}]*white-space: nowrap; overflow: hidden;/);
  assert.match(css, /#next-action-why \{[^}]*white-space: nowrap; overflow: hidden; font-size: 12px/);
  assert.match(css, /#combat-console \{ grid-template-columns: max-content minmax\(0, 1fr\) 48px; \}/);
});

test('2.3 : « ⚡ Boosts » fait au moins 66 px', () => {
  const m = css.match(/#boost-toggle \{[^}]*min-width: (\d+)px/);
  assert.ok(m && Number(m[1]) >= 66);
});

test('2.4 : « Avance auto » n\'est plus sous la carte d\'objectif (touche ronde de 44 px à côté)', () => {
  assert.match(css, /#stage-area #auto-toggle \{ width: 44px;/);
  assert.match(css, /#hq-left > #hq-path,\s*#app#app\.m-phone #hud106\.hq-phone #hq-left > #hq-carnet \{ width: calc\(100% - 50px\)/);
});

test('2.5 : le numéro d\'étape de la carte de zone ne se coupe pas (« 1-13 » insécable)', () => {
  assert.match(ui, /<span class="zn-n">\$\{labelBase\}<\/span>/);
  assert.match(css, /#zone-name \.zn-n \{ white-space: nowrap; \}/);
});

test('2.6 et 3.5 : les audits vérifient boutons recouverts, texte générique, sous-onglets sous ✕, blocs du combat', () => {
  const ma = read('tools/mobile-audit.mjs');
  for (const k of [21, 22, 23, 24]) assert.match(ma, new RegExp(`add\\(${k}, m\\)`), `mobile-audit : contrôle ${k}`);
  assert.match(ma, /opt\('sizes', '412x915,405x896,390x844,360x800'\)/);
  const da = read('tools/desk-audit.mjs');
  for (const k of [16, 17, 18]) assert.match(da, new RegExp(`add\\(${k}, m\\)`), `desk-audit : contrôle ${k}`);
  const a = read('tools/audit-1018.mjs');
  for (const f of ['__touchCover', '__genericWhy', '__subtabsUnderClose', '__hudOverlap']) assert.ok(a.includes(`window.${f} =`), f);
  assert.match(a, /elementFromPoint/);
});

test('3.1 et 3.2 : sous-onglets avant la croix (56 px), dégradé, en-tête opaque ; onglet allumé ramené à l\'écran', () => {
  assert.match(css, /#panel-subtabs \{ max-width: calc\(100vw - 48px\); background: #0d1427 !important;/);
  assert.match(css, /mask-image: linear-gradient\(90deg, #000 calc\(100% - 24px\), transparent\)/);
  assert.match(css, /#panel > header \{[^}]*background: #0d1427 !important;[^}]*box-shadow/);
  assert.match(ui, /setTimeout\(center, 350\)/);
});

test('3.3 : pied « Tout récupérer (n) | Voir » — doré à sa largeur (15 px), « Voir » prend le reste', () => {
  assert.match(css, /\.mp-claimbar \.m-btn-gold \{ flex: 0 0 auto;[^}]*font-size: 15px;/);
  assert.match(css, /\.mp-claimbar button\.m-btn \{ flex: 1 1 0;/);
});

test('3.4 : Carnet — gros lot hors du filet, une ligne au-dessus, grille de 6 colonnes ; « 60 Gemmes » avec une espace', async () => {
  const why = read('src/ui/why-off.js');
  assert.match(why, /\.fw-prize-c'\)\) continue;/);
  assert.match(read('src/ui/panels/daybook.js'), /Gros lot du jour 7 : un compagnon Épique au choix/);
  assert.match(css, /\.mp-fw \.fw-prize \{ display: grid; grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(read('src/ui/common.js'), /\$\{formatNumber\(Math\.floor\(v\)\)\}\$\{\/rw-big\|named\/\.test\(cls\) \? ` <small class="rw-name">/);
});

test('3.5 : le filet regarde aussi la carte .m-card et les frères précédents (comme l\'audit)', () => {
  const why = read('src/ui/why-off.js'), aud = read('tools/audit-1016.mjs');
  for (const src of [why, aud]) {
    assert.match(src, /closest\('\.m-card'\), b\)/);
    assert.match(src, /before\(b\) \|\| before\(b\.parentElement\) \|\| before\(b\.parentElement\?\.parentElement\)/);
    assert.match(src, /\.fw-prize-c/);
  }
  // la raison générique existe encore en dernier recours, mais l'audit échoue si elle s'affiche (contrôle 22 / 17)
  assert.equal(disabledReason({ text: 'Bouton' }), "Pas disponible pour l'instant");
  assert.match(read('tools/audit-1018.mjs'), /Pas disponible pour l'instant/);
});

test('3.6 : Arène — une seule croix (celle du panneau), « ? » dans le ruban, formation avant les étages, « Combattre » en bas', () => {
  const arena = read('src/ui/panels/arena.js');
  assert.match(arena, /mTitle\('icon_paw', 'Arène', true\)\}\$\{mModes/);
  assert.ok(!/mTitle\('icon_paw', 'Arène', true, \{ close: 'close-panel' \}\)/.test(arena));
  assert.match(css, /#panel:has\(\.ar-frame\) > header \{ display: flex; \}/);
  const order = (sel) => Number(css.match(new RegExp(`> \\.ar-scroll > :is\\(${sel.replace('.', '\\.')}\\) \\{ order: (\\d+); \\}`))?.[1]);
  assert.ok(order('.m-modes') < order('.cf-card') && order('.cf-card') < order('.ct-floors'), 'modes → formation → étages');
  assert.match(read('src/ui/panels/arena-cards-view.js'), /<\/div>\$\{go\}` : main \+ go/, '« Combattre » hors de la zone qui défile');
});

test('3.7 et 3.8 : pages trop vides illustrées ; Expéditions sans boutons grisés inutiles', () => {
  assert.match(read('src/ui/panels/tower.js'), /page-fill page-fill-tower/);
  assert.match(read('src/ui/panels/forge.js'), /page-fill page-fill-forge/);
  assert.match(read('src/ui/panels/camp.js'), /mt-ann-art/);
  const exp = read('src/ui/panels/expeditions.js');
  assert.match(exp, /ready \? mBtn\(`Tout récupérer \(\$\{ready\}\)`/);
  assert.ok(!/disabled: !ready \}\)\}\$\{mBtn\(`Repartir/.test(exp), 'plus de « Tout récupérer » / « Repartir » grisés');
});

test('nouveaux textes traduits (anglais, coréen)', async () => {
  for (const lang of ['en', 'ko']) {
    const m = await import(`../src/i18n/${lang}-1018.js`);
    assert.ok(m.EXACT_1018['Gros lot du jour 7 : un compagnon Épique au choix'], lang);
    const pats = m.patterns1018((s) => (s === 'Frappe rapide' ? 'X' : null));
    const hit = pats.find(([re]) => re.test('Frappe rapide : en attente'));
    assert.ok(hit, `${lang} : motif « … : en attente »`);
    assert.ok(hit[1]('Frappe rapide : en attente'.match(hit[0])).startsWith('X'));
    assert.match(read(`src/i18n/${lang}.js`), new RegExp(`from './${lang}-1018\\.js'`));
  }
  const { translate } = await import('../src/i18n/en.js');
  assert.equal(translate('Gros lot du jour 7 : un compagnon Épique au choix'), 'Day 7 grand prize: an Epic companion of your choice');
});
