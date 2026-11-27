// v10.18 (partie 5) : finitions PC — ce qui se vérifie sans navigateur (largeurs, défilement, règles CSS, gabarits).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { combatColumn, sideMin } from '../src/ui/pc-layout.js';
import { marqueePlan, MQ_PAUSE } from '../src/ui/marquee.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const css = read('src/ui/pc1018.css');

test('5.5 fenêtre de droite : au moins max(480 px, 30 %) à toutes les largeurs PC', () => {
  for (const w of [1024, 1116, 1366, 1600, 1878, 1920, 2560, 3840]) {
    for (const meet of [0, 300, 900, 1500, 3000]) {
      const col = combatColumn(w, meet);
      assert.ok(w - col >= sideMin(w), `${w} px, rencontre ${meet} : fenêtre ${w - col} px`);
      assert.ok(w - col >= Math.max(480, w * 0.3) - 1);
      assert.ok(col >= 420);
    }
  }
  assert.equal(sideMin(1366), 480);
  assert.equal(sideMin(1920), 576);
});

test('5.5 la colonne de combat ne change pas là où la v10.17 laissait déjà assez de place (le héros ne bouge pas)', () => {
  const old = (w, meet) => Math.round(Math.max(420, Math.min(w - 600, Math.max(meet + 24, w * 0.5))));
  for (const w of [1116, 1366, 1878, 1920]) for (const meet of [0, 400, 800, 1200]) assert.equal(combatColumn(w, meet), old(w, meet));
});

test('5.5 la règle CSS de la fenêtre porte le même plancher', () => {
  assert.match(css, /width:\s*max\(480px,\s*30%,\s*calc\(100% - var\(--combat-col/);
  assert.match(read('index.html'), /src\/ui\/pc1018\.css/);
});

test('5.6 marquee : part du début du texte et y reste 1,5 s', () => {
  for (const dist of [3, 40, 400]) {
    const { total, offsets } = marqueePlan(dist);
    assert.equal(offsets[0], 0);
    assert.ok(Math.abs(offsets[1] * total - 1500) < 1e-6, 'pause de 1,5 s au début');
    assert.equal(MQ_PAUSE, 1500);
  }
  const src = read('src/ui/marquee.js');
  assert.match(src, /currentTime = 0/, 'chaque nouveau défilement repart du début');
  assert.match(src, /span\.offsetWidth/, 'mesure sans transformation (éclair du fil)');
  assert.match(src, /fonts\?\.ready/, 'remesure après le chargement des polices');
});

test('5.1 nom de zone PC : format court et défilement, sans toucher au téléphone', () => {
  assert.match(css, /#app:not\(\.m-phone\) #zone-name \.zn-t \{ letter-spacing/);
  assert.match(read('src/ui/marquee.js'), /'#app:not\(\.m-phone\) #zone-name \.zn-t'/);
});

// v10.20 (3.2) : mis à jour — le pied doré collant recouvrait les lignes de la grande page ; « Tout acheter » retourne dans la carte
// du haut, à côté de ×1 ×10 ×100 Max (data-nodock : gold-dock.js le laisse en place ; data-gold-top : voulu en haut pour le contrôle 15).
test('5.2 → 10.20 (3.2) Améliorations PC : « Tout acheter » dans la carte du haut, pas dans le pied doré', () => {
  assert.match(read('src/ui/panels/upgrades.js'), /<div class="upg-buyall-row" data-nodock data-gold-top>\$\{amounts\}\$\{buyAll\}<\/div>/);
});

test('5.3 Bastion PC : notification hors du cadre, en toast en bas, fermée après 6 s', () => {
  const camp = read('src/ui/panels/camp.js');
  assert.match(camp, /<\/aside><\/div><\/div>\$\{kickRibbon\(ui\)\}`/);
  assert.match(camp, /const KICK_MS = 6000;/);
  assert.match(css, /\.bs-kick\.bs-toast \{ top: auto !important; bottom: \d+px !important;/);
});

test('5.4 Forge et Améliorations PC : une seule bannière', () => {
  assert.match(css, /:has\(> :is\(\.d-upg, \.d-forge\)\) > :is\(\.art-banner-wrap, \.tab-lead\) \{ display: none; \}/);
  assert.doesNotMatch(css, /\.m-title \{ display: none; \}/, 'le cartouche du cadre reste (contrôle 4 de desk-audit)');
  assert.match(css, /\.d-upg \.d-topart/);
  assert.match(css, /\.fg-top > \.fg-top-art \{ display: none; \}/);
  for (const line of css.split('\n').filter((l) => /^[#.@]/.test(l) && !l.startsWith('@keyframes') && !l.startsWith('@media'))) {
    assert.match(line, /:not\(\.m-phone\)/, `règle PC seulement : ${line.slice(0, 60)}`);
  }
});
