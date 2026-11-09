// v9.2.0 (monde marin) : Royaume englouti (monde 11), migration des sauvegardes, niveaux de puissance inchangés.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ZONES } from '../src/data/zones.js';
import { BOSSES, ENEMIES } from '../src/data/enemies.js';
import { ITEM_SETS } from '../src/data/sets.js';
import { SIGNATURE_ITEMS } from '../src/data/items.js';
import { BOSS_POWERS } from '../src/data/powers.js';
import { BOSS_LORE, ZONE_INTRO } from '../src/data/lore.js';
import { ART } from '../src/render/art.js';
import { BG } from '../src/render/bg.js';
import { BOSS_TRAITS, TRAITS, tickTide } from '../src/core/boss-traits.js';
import { bossesForStage, enemyStats, levelForStage, locateStage, stageLabel, stagesPerCycle, zoneStartStage } from '../src/core/combat.js';
import { stageTo920 } from '../src/core/migrations-v920.js';
import { SAVE_VERSION, createNewState, sanitizeState } from '../src/core/state.js';
import { translate as en } from '../src/i18n/en.js';
import { translate as ko } from '../src/i18n/ko.js';

const ocean = ZONES[10];
const ids = [...ocean.enemies, ...ocean.bosses, ...Object.values(ocean.tierBosses)];

test('monde 11 : Royaume englouti sous-marin, 8 monstres et 4 boss, puis le Trône de l\'Abysse (monde 12)', () => {
  assert.equal(ocean.id, 'ocean');
  assert.ok(ocean.underwater);
  assert.equal(ZONES[11].id, 'abyss');
  assert.equal(ocean.enemies.length, 8);
  assert.equal(stagesPerCycle(), 230);
  assert.equal(zoneStartStage(10), 201);
  assert.deepEqual(bossesForStage(205), ['mini_crab_king']);
  assert.deepEqual(bossesForStage(210), ['mid_kraken']);
  assert.deepEqual(bossesForStage(215), ['hard_megalodon']);
  assert.deepEqual(bossesForStage(220), ['boss_leviathan']);
  assert.equal(stageLabel(220), '11-20');
  assert.equal(stageLabel(221), '12-1');
});

test('monstres et boss complets : sprites (nage, nage 2, attaque), mécanique, ensemble, objet, pouvoirs, textes, décor', () => {
  for (const id of ocean.enemies) {
    assert.ok(ENEMIES[id].swim, id);
    for (const s of ['', '_b', '_atk']) assert.ok(ART[`${id}${s}`], `${id}${s}`);
  }
  for (const id of [...ocean.bosses, ...Object.values(ocean.tierBosses)]) {
    assert.ok(BOSSES[id] && ENEMIES[BOSSES[id].base], id);
    for (const s of ['', '_b', '_atk']) assert.ok(ART[`${BOSSES[id].sprite}${s}`], `${id}${s}`);
    assert.ok(TRAITS[BOSS_TRAITS[id]], `mécanique ${id}`);
  }
  assert.ok(ITEM_SETS.find((s) => s.id === 'ocean' && s.zone === 10) && ART.set_ocean);
  assert.ok(SIGNATURE_ITEMS.some((i) => i.signature === 'boss_leviathan'));
  assert.equal(BOSS_POWERS.boss_leviathan.length, 5);
  assert.ok(BOSS_LORE.boss_leviathan && ZONE_INTRO.ocean);
  assert.ok(BG.ocean.layers.length >= 5);
  for (const id of ids) {
    const name = (ENEMIES[id] ?? BOSSES[id]).name;
    assert.notEqual(en(name), name, `anglais : ${name}`);
    assert.notEqual(ko(name), name, `coréen : ${name}`);
  }
});

test('Marée (Léviathan) : régénère, un coup critique l\'arrête 3 s', () => {
  const boss = { trait: 'tidal', hp: 500, maxHp: 1000 };
  const world = { time: 10, enemies: [boss] };
  tickTide(world, 1);
  assert.equal(boss.hp, 510);
  boss.critAt = 9;
  tickTide(world, 1);
  assert.equal(boss.hp, 510);
});

test('niveau de puissance : toute ancienne étape garde exactement sa puissance après conversion', () => {
  for (let s = 1; s <= 3 * 210 + 5; s++) {
    const n = stageTo920(s);
    assert.equal(levelForStage(n), s, `étape ${s} → ${n}`);
    assert.equal(enemyStats(levelForStage(n), 'slime', false).hp, enemyStats(s, 'slime', false).hp);
  }
  assert.equal(levelForStage(201), 201);
  assert.equal(levelForStage(220), 210); // le Royaume englouti couvre les niveaux 201 à 210
  assert.equal(levelForStage(231), 211); // cycle ×2 : comme l'ancienne étape 211
});

test('migration v8 → v9 : ni recul ni saut (même monde, même étape dans le monde, même cycle)', () => {
  assert.equal(SAVE_VERSION, 11); // v9.3.3 : 10 → 11 (niveaux de compétence) // v9.2.8 : 9 → 10 (économie)
  const cases = [[150, 150, 'sky'], [200, 200, 'void'], [205, 225, 'abyss'], [210, 230, 'abyss'], [211, 231, 'plains'], [275, 295, 'desert'], [420, 460, 'abyss']];
  for (const [old, now, zone] of cases) {
    assert.equal(stageTo920(old), now, String(old));
    assert.equal(ZONES[locateStage(now).zone].id, zone, String(old));
  }
  const raw = JSON.parse(JSON.stringify(createNewState(1, 1)));
  Object.assign(raw, { version: 8, stage: 204, maxStage: 207, bossRetry: { stage: 207, power: 3 } });
  raw.records.bestStage = 260;
  raw.times.firstZone = { 0: 1, 9: 50, 10: 70 };
  raw.times.where = { '10:1': 30, '2:2': 5 };
  const s = sanitizeState(raw, undefined, 2);
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(s.stage, 224);
  assert.equal(s.maxStage, 227);
  assert.equal(s.records.bestStage, 280);
  assert.equal(s.bossRetry.stage, 227);
  assert.deepEqual(s.times.firstZone, { 0: 1, 9: 50, 11: 70 });
  assert.equal(s.times.where['11:1'], 30);
  assert.equal(s.times.where['2:2'], 5);
  // Une sauvegarde déjà au format 9 n'est pas reconvertie.
  const again = sanitizeState(JSON.parse(JSON.stringify(s)), undefined, 3);
  assert.equal(again.maxStage, 227);
  // Une partie avant le monde 11 ne change pas.
  const early = sanitizeState({ ...JSON.parse(JSON.stringify(createNewState(1, 1))), version: 8, stage: 120, maxStage: 133 }, undefined, 2);
  assert.equal(early.maxStage, 133);
});
