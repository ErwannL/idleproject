// v10.4 (partie 4) : donjons — liste en bannières, page illustrée, images PixelLab, textes courts, traductions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { DUNGEONS } from '../src/data/dungeons.js';
import { BOSS_TRAITS } from '../src/core/boss-traits.js';
import { mechPill, mechKey } from '../src/ui/panels/dungeons.js';
import { EXACT_1040_DUNGEONS as EN, patterns1040Dungeons as enPatterns } from '../src/i18n/en-1040-dungeons.js';
import { EXACT_1040_DUNGEONS as KO, patterns1040Dungeons as koPatterns } from '../src/i18n/ko-1040-dungeons.js';

const read = (p) => readFileSync(p, 'utf8');
const lines = (p) => read(p).split(/\r?\n/);
const pngSize = (p) => { const b = readFileSync(p); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('Chaque donjon a une pastille de mécanique, son image PixelLab 64 × 64 et ses traductions', () => {
  const keys = new Set(DUNGEONS.map((d) => BOSS_TRAITS[d.boss] ?? 'plain'));
  assert.equal(keys.size, 5);
  for (const d of DUNGEONS) {
    const k = mechKey(d);
    assert.ok(existsSync(`assets/ui/art104/dungeon_mech_${k}.png`), `image manquante : ${k}`);
    assert.deepEqual(pngSize(`assets/ui/art104/dungeon_mech_${k}.png`), [64, 64]);
    const pill = mechPill(d);
    assert.ok(pill.split(/\s+/).length <= 16, `pastille trop longue : ${pill}`);
    assert.ok(EN[pill], `anglais manquant : ${pill}`);
    assert.ok(KO[pill], `coréen manquant : ${pill}`);
  }
  assert.match(mechPill(DUNGEONS[0]), /^Invocatrice : 2 serviteurs toutes les 12 s · ton arme : dégâts de zone$/);
});

test('Les illustrations de la page existent (tuiles de difficulté, cadenas, récompenses) et le script les reproduit', () => {
  for (const n of ['dungeon_diff_easy', 'dungeon_diff_normal', 'dungeon_diff_hard', 'dungeon_diff_lock', 'dungeon_rw_set', 'dungeon_rw_firstclear']) {
    assert.ok(existsSync(`assets/ui/art104/${n}.png`), n);
    assert.ok(existsSync(`tools/art/pixellab104/dungeons/${n}.png`), `source brute : ${n}`);
  }
  const prompts = JSON.parse(read('tools/art/pixellab104/dungeons/prompts.json'));
  assert.ok(Object.keys(prompts).length >= 11);
  assert.match(read('tools/art/pl104_dungeons.py'), /PIXELLAB_API_KEY|pl939_api/);
  assert.doesNotMatch(read('tools/art/pl104_dungeons.py'), /pk_|sk-[A-Za-z0-9]{10}/);
});

test('La page et la liste : bannières, pastille, tuiles, portes, sans emoji ni itinéraire (fins de ligne indifférentes)', () => {
  const src = lines('src/ui/panels/dungeons.js').join('\n');
  for (const c of ['dg-banner', 'dg-mech-img', 'dgp-tile', 'dgp-gains', 'dgp-door', 'dgp-team-select', 'dungeon-team-select', 'dg-enter', 'pg-top', 'pg-main', 'pg-side']) assert.ok(src.includes(c), c);
  assert.ok(!src.includes('path-card" data-action="dungeon-route"') && !src.includes('data-action="dungeon-route"'), 'plus de cartes d\'itinéraire');
  assert.ok(!/⚡|✔|🔥/.test(src.slice(src.indexOf('function banner'))), 'pas d\'emoji dans la liste ni la page');
  assert.match(read('index.html'), /src\/ui\/dungeons1040\.css/);
  assert.match(read('src/i18n/en.js'), /en-1040-dungeons\.js/);
  assert.match(read('src/i18n/ko.js'), /ko-1040-dungeons\.js/);
  const css = read('src/ui/dungeons1040.css');
  assert.match(css, /\.dg-card\.dg-banner \{[^}]*height: 148px/);
  assert.match(css, /min-height: 124px/);
});

test('Les motifs de traduction couvrent les textes variables de la page', () => {
  const cases = ['Entrer · Difficile', '×6 Archange ici', 'Équipe : Chasse aux boss', 'Balayer ×5', 'Balayer tout (3)'];
  for (const pats of [enPatterns(), koPatterns()]) for (const t of cases) assert.ok(pats.some(([re]) => re.test(t)), t);
});
