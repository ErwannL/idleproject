// v9.3.9 : Défense et Peau de fer fusionnées sans perte de survie ; ennemis qui entrent par le bord de l'écran.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, mergeArmorIntoDefense, sanitizeState } from '../src/core/state.js';
import { computeHeroStats } from '../src/core/stats.js';
import { buyUpgrade } from '../src/core/economy.js';
import { openUpgrades } from '../src/core/unlocks.js';
import { createCombat, step } from '../src/core/combat.js';
import { Rng } from '../src/core/rng.js';
import { BALANCE } from '../src/data/balance.js';
import { RESOURCE_WHERE, SKILL_RESOURCES } from '../src/data/progression.js';

const NOW = Date.UTC(2026, 10, 12, 12);
const taken = (st) => { const x = computeHeroStats(st); return (1 - x.armor / 100) * (1 - x.defenseReductionPct / 100); };

test('v9.3.9 : Peau de fer convertie en Défense — dégâts subis jamais plus élevés, plus achetable ni affichée', () => {
  for (const [armor, defense] of [[1, 0], [7, 0], [15, 20], [30, 60], [40, 5], [25, 150]]) {
    const s = createNewState(NOW);
    Object.assign(s.upgrades, { armor, defense });
    const before = taken(s);
    const out = sanitizeState(JSON.parse(JSON.stringify(s)), BALANCE, NOW);
    assert.equal(out.upgrades.armor, 0, `${armor}/${defense}`);
    assert.ok(out.upgrades.defense >= defense);
    assert.ok(taken(out) <= before + 1e-9, `${armor}/${defense} : ${taken(out)} > ${before}`);
    assert.equal(mergeArmorIntoDefense(out), false, 'idempotent');
  }
  const s = createNewState(NOW);
  s.gold = 1e12;
  assert.equal(buyUpgrade(s, 'armor'), false);
  s.records.bossesDefeated = 99; s.records.bestStage = 400;
  assert.ok(!openUpgrades(s, BALANCE).includes('armor') && openUpgrades(s, BALANCE).includes('defense'));
});

test('v9.3.9 : ressources de compétence — icônes propres et « Où en trouver » pour chacune', () => {
  const icons = Object.values(SKILL_RESOURCES).map((r) => r.icon);
  assert.equal(new Set(icons).size, icons.length);
  for (const i of icons) assert.ok(!['icon_essence', 'icon_stars'].includes(i), i);
  for (const k of Object.keys(SKILL_RESOURCES)) assert.ok(RESOURCE_WHERE[k]?.length >= 2, k);
});

test('v9.3.9 : les ennemis naissent au bord de l\'écran (viewEdgeX), sans rendu au point d\'origine', () => {
  const s = createNewState(NOW, 3);
  const w = createCombat(s);
  const rng = new Rng(5);
  for (let i = 0; i < 40 && !w.enemies.length; i++) step(s, w, 0.05, rng);
  assert.ok(w.enemies.length > 0);
  assert.ok(w.enemies[0].x > BALANCE.waves.spawnX - 10 && w.enemies[0].x < 140); // point d origine (une marche d un pas)
  const s2 = createNewState(NOW, 3);
  const w2 = createCombat(s2);
  w2.viewEdgeX = 160;
  for (let i = 0; i < 40 && !w2.enemies.length; i++) step(s2, w2, 0.05, rng);
  assert.ok(w2.enemies[0].x > 150, `apparu à ${w2.enemies[0].x}`);
});
