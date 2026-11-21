// v10.3.1 : feuille de donjon (mécanique du boss en image), portes, « Balayer tout » à total figé.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createNewState } from '../src/core/state.js';
import { sweepAllPlan } from '../src/core/dungeon-plus.js';
import { sweepAll } from '../src/core/dungeon.js';
import { Rng } from '../src/core/rng.js';
import { DUNGEONS } from '../src/data/dungeons.js';
import { BOSS_TRAITS, TRAITS } from '../src/core/boss-traits.js';
import { EXACT_1031 as EN } from '../src/i18n/en-1031-dungeons.js';
import { EXACT_1031 as KO } from '../src/i18n/ko-1031-dungeons.js';

const read = (p) => readFileSync(p, 'utf8');
const legends = () => [...read('src/ui/panels/dungeons.js').matchAll(/^ {2}(\w+): '((?:[^'\\]|\\.)*)',$/gm)].map((m) => [m[1], m[2].replace(/\\'/g, '\'')]);

test('Chaque donjon a une image de mécanique, une légende, et ses traductions', () => {
  const keys = new Set(DUNGEONS.map((d) => BOSS_TRAITS[d.boss] ?? 'plain'));
  const leg = new Map(legends());
  for (const k of keys) {
    assert.ok(k === 'plain' || TRAITS[k], `mécanique inconnue ${k}`);
    assert.ok(existsSync(`assets/ui/art103/mech_${k}.png`), `image manquante : mech_${k}.png`);
    const png = readFileSync(`assets/ui/art103/mech_${k}.png`);
    assert.equal(png.readUInt32BE(16), 96); assert.equal(png.readUInt32BE(20), 64);
    const text = leg.get(k);
    assert.ok(text && text.length > 15, `légende manquante pour ${k}`);
    assert.ok(EN[text], `anglais manquant : ${text}`); assert.ok(KO[text], `coréen manquant : ${text}`);
  }
  assert.equal(keys.size, 5, 'cinq mécaniques distinctes pour cinq donjons');
});

test('La feuille de donjon et les styles sont branchés (fins de ligne indifférentes)', () => {
  assert.match(read('index.html'), /src\/ui\/dungeons1031\.css/);
  assert.match(read('src/i18n/en.js'), /en-1031-dungeons\.js/);
  assert.match(read('src/i18n/ko.js'), /ko-1031-dungeons\.js/);
  const dg = read('src/ui/panels/dungeons.js');
  assert.ok(dg.split(/\r?\n/).some((l) => l.includes('dg-mech-img')));
  const css = read('src/ui/dungeons1031.css');
  assert.match(css, /dg-boss-portrait[^}]*256px/);
  assert.match(css, /\.door-cards \{[^}]*nowrap/);
});

test('Balayer tout : le total annoncé est reçu même si l\'étape change entre l\'aperçu et la confirmation', () => {
  const mk = () => {
    const s = createNewState(); s.maxStage = 200; s.keys = 6;
    s.dungeonBest = { crypt: 1, sanctuary: 0 }; s.dungeonsCleared = { crypt: 3, sanctuary: 2 };
    return s;
  };
  const s = mk();
  const plan = sweepAllPlan(s);
  const preview = sweepAll(structuredClone(s), plan, () => new Rng(7));
  const stageAtPreview = s.maxStage;
  s.maxStage = 260; // le héros progresse avant la confirmation
  const naive = sweepAll(structuredClone(s), plan, () => new Rng(7));
  assert.notDeepEqual(naive.earned, preview.earned, 'sans figer, le total change (le test a un sens)');
  const real = sweepAll(s, plan, () => new Rng(7), undefined, { stage: stageAtPreview });
  assert.deepEqual(real.earned, preview.earned);
  assert.equal(s.maxStage, 260, 'l\'étape du héros est rendue intacte');
});
