// v10.19 (partie 5 et 7.4) : Titans — noms uniques, bandeau « ATTAQUE + nom » sur les 5 attaques, flash de couleur sans
// blanc plein (Titans et combat normal), Nuit sans fin assez claire, ciel de l'Orage foncé, chiffres gardés dans le canvas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAY_TITANS } from '../src/data/grand-bosses.js';
import { EXACT_1016_TITANS as EN } from '../src/i18n/en-1016-titans.js';
import { EXACT_1016_TITANS as KO } from '../src/i18n/ko-1016-titans.js';
import { markHit, tintAlpha, HIT_FLASH_TIME, TINT_ALPHA } from '../src/render/boss-feel.js';
import { clampTextX } from '../src/render/vfx.js';

const SKILLS = readFileSync(new URL('../src/render/titan-skills.js', import.meta.url), 'utf8');
const UI = readFileSync(new URL('../src/ui/world-boss.js', import.meta.url), 'utf8');
const kit = (t) => [...t.fight.abilities, ...t.fight.phases];

test('5.4 : les 5 attaques de chaque Titan ont des noms différents (et pas de doublon entre Titans)', () => {
  const all = DAY_TITANS.flatMap((t) => kit(t).map((s) => s.name));
  assert.equal(new Set(all).size, all.length, `doublons : ${all.filter((n, i) => all.indexOf(n) !== i)}`);
  const by = Object.fromEntries(DAY_TITANS.flatMap((t) => kit(t).map((s) => [s.id, s.name])));
  assert.equal(by.storm_clouds, "Ciel d'orage");
  assert.equal(by.void_cracks, 'Fissures du vide');
  for (const n of ["Ciel d'orage", 'Fissures du vide']) {
    assert.ok(EN[n] && KO[n], `traduction de ${n}`);
  }
});

test('5.5 : bandeau « Attaque + nom » pour les 3 attaques et pour les 2 attaques de phase des Titans', () => {
  assert.match(UI, /fight\.bossId === 'colossus' \? 'Attaque du Colosse' : 'Attaque'/, 'attaques 1 à 3');
  assert.match(UI, /titanPhase = String\(fight\.bossId \?\? ''\)\.startsWith\('titan_'\)/);
  assert.match(UI, /titanPhase \? `<small><span>Attaque<\/span>/, 'attaques 4 et 5 (phases)');
  for (const t of DAY_TITANS) assert.ok(t.id.startsWith('titan_'));
});

test('5.1 : flash des Titans de leur couleur (≤ 35 %, 0,15 s), jamais blanc ni plein écran opaque', () => {
  assert.match(SKILLS, /TITAN_FLASH_TIME = 0\.15/);
  assert.match(SKILLS, /TITAN_FLASH_ALPHA = 0\.35/);
  const flashes = [...SKILLS.matchAll(/flash: ([^,}\s]+)/g)].map((m) => m[1]);
  assert.ok(flashes.length >= 30);
  for (const f of flashes) assert.doesNotMatch(f, /'#(f{3}|f{6}|fff3a8|e0eaff)'/i, `flash blanc : ${f}`);
  assert.doesNotMatch(SKILLS, /0\.92 \* \(1 - u\)/, "plus d'éclair blanc plein écran (Éblouissement)");
  assert.doesNotMatch(SKILLS, /fillStyle = '#e8f4ff'/, 'plus de silhouette de givre blanche (Regard d’argent)');
  for (const id of ['sun_rise', 'storm_clouds', 'void_cracks']) {
    const body = SKILLS.slice(SKILLS.indexOf(`function ${{ sun_rise: 'sunRise', storm_clouds: 'stormClouds', void_cracks: 'voidCracks' }[id]}(`));
    const fn = body.slice(0, body.indexOf('\n}\n'));
    assert.match(fn, /tint: (GOLD|VOLT|VOID)/, `${id} : impact teinté de la couleur du Titan`);
  }
});

test('7.4 : combat normal : un coup donne un flash de couleur ≤ 35 % en 0,15 s, jamais de silhouette blanche', () => {
  for (const crit of [false, true]) {
    const fx = { hit: 0 };
    assert.equal(markHit(fx, 0, { boss: false, crit, color: '#ffffff' }), 'color');
    assert.equal(fx.hit, 0, 'pas de flash blanc (fx.hit)');
    assert.equal(fx.tint, HIT_FLASH_TIME);
    assert.ok(HIT_FLASH_TIME <= 0.15);
    assert.notEqual(fx.tintColor.toLowerCase(), '#ffffff');
    assert.ok(tintAlpha(fx) > 0 && tintAlpha(fx) <= 0.35 && TINT_ALPHA <= 0.35);
    fx.tint -= 0.1; assert.ok(tintAlpha(fx) < TINT_ALPHA, "s'efface");
  }
  const fx = { hit: 0 }; markHit(fx, 0, { boss: false, color: '#5aa8ff' });
  assert.equal(fx.tintColor, '#5aa8ff', "couleur de l'élément du coup");
});

test('5.2 : Nuit sans fin : héros et sol à 45 % de luminosité au moins, nuit derrière l’équipe, contour visible', async () => {
  const m = await import('../src/render/titan-skills.js').catch(() => null);
  if (m) {
    assert.ok(m.nightGroundLight() >= m.NIGHT_MIN_LIGHT && m.NIGHT_MIN_LIGHT >= 0.45, `sol à ${Math.round(m.nightGroundLight() * 100)} %`);
  } else {
    const n = (k) => Number(SKILLS.match(new RegExp(`${k} = ([\\d.]+)`))[1]);
    assert.ok((1 - n('NIGHT_AMBIENT_DARK')) * (1 - n('NIGHT_GROUND_DARK')) >= 0.45);
  }
  const night = SKILLS.slice(SKILLS.indexOf('function moonNight('));
  const fn = night.slice(0, night.indexOf('\n}\n'));
  assert.match(fn, /layer: 'back'/, 'le voile de la nuit est derrière l’équipe');
  assert.doesNotMatch(fn, /0\.9 \* a/, 'plus de voile noir à 90 % par-dessus tout');
  assert.match(fn, /strokeStyle = '#9fb4ff'; ctx\.lineWidth = 1\.5/, 'contour de l’équipe');
});

test('5.3 : Orage : ciel gris-bleu foncé, éclairs de fond plafonnés', () => {
  assert.match(SKILLS, /STORM_SKY = '#1c2638'/);
  assert.match(SKILLS, /STORM_FLICK_MAX = 0\.15/);
  assert.doesNotMatch(SKILLS, /fillStyle = '#dfe8ff'/, 'plus de ciel presque blanc');
  assert.match(SKILLS, /bossId === 'titan_storm'/, 'ciel foncé dès le début du combat');
});

test('5.6 : les chiffres de dégâts restent entiers dans le canvas', () => {
  // canvas de 240 px de large (téléphone), chiffre de 30 px poussé à droite par l’éventail
  assert.equal(clampTextX(250, 30, 0, 240), 240 - 2 - 15);
  assert.equal(clampTextX(-5, 30, 0, 240), 2 + 15);
  assert.equal(clampTextX(100, 30, 0, 240), 100);
  // calque décalé (repère du monde) : bornes déplacées
  assert.equal(clampTextX(400, 20, 150, 390), 390 - 2 - 10);
  const vfxSrc = readFileSync(new URL('../src/render/vfx.js', import.meta.url), 'utf8');
  assert.match(vfxSrc, /const cx = textCenterIn\(scene, ctx,/);
});
