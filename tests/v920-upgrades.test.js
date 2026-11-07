// v9.2.0 : treize améliorations à l'or — effets, bornes, coûts, déblocage progressif, Renaissance et sauvegardes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/data/balance.js';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { computeHeroStats } from '../src/core/stats.js';
import { buyUpgrade, bulkPlan, upgradeCost, upgradeMilestones } from '../src/core/economy.js';
import { createCombat, step } from '../src/core/combat.js';
import { Rng } from '../src/core/rng.js';
import { performRebirth } from '../src/core/rebirth.js';
import { BASE_UPGRADES, UPGRADE_ORDER, nextUpgradeUnlock, openUpgrades, upgradeOpen } from '../src/core/unlocks.js';
import { translate as en } from '../src/i18n/en.js';
import { translate as ko } from '../src/i18n/ko.js';

const NEW = ['critDamage', 'lifesteal', 'companionPower', 'dodge', 'bossDamage', 'xpGain'];
const NOW = Date.UTC(2026, 10, 3, 12);
const withUp = (s, key, lv) => ({ ...s, upgrades: { ...s.upgrades, [key]: lv } });

test('v9.2.0 : 13 améliorations (entre 10 et 15), chacune rangée dans une catégorie et dans l\'ordre du panneau', () => {
  const keys = Object.keys(BALANCE.upgrades);
  assert.equal(keys.length, 15); // v9.2.8 : + Défense et Double attaque
  assert.deepEqual([...UPGRADE_ORDER].sort(), [...keys].sort());
  const inCats = BALANCE.upgradeCategories.flatMap((c) => c.keys);
  for (const k of keys) assert.equal(inCats.filter((x) => x === k).length, 1, k);
  for (const k of NEW) {
    const up = BALANCE.upgrades[k];
    assert.ok(up.maxLevel > 0 && up.unlockStage > 0 && up.baseCost > 0 && up.costGrowth > 1, k);
  }
});

test('v9.2.0 : coûts en courbe géométrique, plafond respecté par l\'achat simple et groupé', () => {
  for (const k of NEW) {
    const up = BALANCE.upgrades[k];
    assert.equal(upgradeCost(k, 0), up.baseCost);
    assert.equal(upgradeCost(k, 10), Math.floor(up.baseCost * up.costGrowth ** 10));
    const s = createNewState(NOW);
    s.gold = 1e300;
    s.upgrades[k] = up.maxLevel;
    assert.equal(buyUpgrade(s, k), false);
    s.upgrades[k] = up.maxLevel - 2;
    assert.equal(bulkPlan(s, k, '100').count, 2);
  }
});

test('v9.2.0 : effet de chaque nouvelle amélioration sur les statistiques (et bornes)', () => {
  const s = createNewState(NOW);
  const base = computeHeroStats(s);
  assert.equal(base.critMultiplier, BALANCE.hero.critMultiplier);
  assert.equal(computeHeroStats(withUp(s, 'critDamage', 100)).critMultiplier, BALANCE.hero.critMultiplier + 2);
  assert.ok(computeHeroStats(withUp({ ...s, upgrades: { ...s.upgrades, crit: 50 } }, 'critDamage', 50)).dps
    > computeHeroStats(withUp(s, 'crit', 50)).dps);
  assert.ok(Math.abs(computeHeroStats(withUp(s, 'lifesteal', 30)).lifesteal - base.lifesteal - 3) < 1e-9);
  assert.equal(computeHeroStats(withUp(s, 'dodge', 40)).dodgePct, 20);
  assert.equal(computeHeroStats(withUp(s, 'dodge', 999)).dodgePct, 20); // sauvegarde trafiquée : bornée
  assert.equal(computeHeroStats(withUp(s, 'bossDamage', 100)).bossDamagePct, 100);
  assert.equal(computeHeroStats(withUp(s, 'bossDamage', 5000)).bossDamagePct, 100);
  assert.equal(computeHeroStats(withUp(s, 'companionPower', 10)).companionPowerPct, 30);
  assert.equal(computeHeroStats(withUp(s, 'xpGain', 50)).xpPct, base.xpPct + 150);
  // Aucune nouvelle ligne ne change les dégâts/s neutres sauf Dégâts critiques (avec du critique).
  for (const k of ['lifesteal', 'dodge', 'bossDamage', 'companionPower', 'xpGain']) assert.equal(computeHeroStats(withUp(s, k, 10)).dps, base.dps, k);
});

test('v9.2.0 : Régénération a maintenant des paliers (×1,1 tous les 10 niveaux), comme Dégâts et PV', () => {
  const s = createNewState(NOW);
  const pct = (lv) => (computeHeroStats(withUp(s, 'regen', lv)).regenPerSecond / computeHeroStats(withUp(s, 'regen', lv)).maxHp) * 100;
  const base = pct(0);
  assert.ok(Math.abs(pct(9) - base - 1.8) < 1e-9);
  assert.ok(Math.abs(pct(10) - base - 2 * 1.1) < 1e-9);
  assert.ok(Math.abs(pct(40) - base - 8 * 1.1 ** 4) < 1e-9);
  assert.deepEqual(upgradeMilestones('regen', 9, 10), { reached: 1.1, nextLevel: 20, nextMult: 1.1 });
});

// Combat réel : même graine, seule l'amélioration change.
function fight(state, seconds, seed = 7) {
  const world = createCombat(state);
  const rng = new Rng(seed);
  const events = [];
  for (let t = 0; t < seconds; t += 0.05) {
    step(state, world, 0.05, rng);
    events.push(...world.events);
    world.events.length = 0;
  }
  return { world, events };
}

test('v9.2.0 : Esquive appliquée par le moteur (coups esquivés, moins de coups reçus)', () => {
  const mk = (lv) => { const s = createNewState(NOW, 3); s.stage = 3; s.maxStage = 3; s.upgrades.vitality = 200; s.upgrades.dodge = lv; return s; };
  const a = fight(mk(0), 60).events;
  const b = fight(mk(40), 60).events;
  assert.equal(a.filter((e) => e.type === 'heroDodge').length, 0);
  const dodged = b.filter((e) => e.type === 'heroDodge').length;
  const hits = b.filter((e) => e.type === 'heroHit').length;
  assert.ok(dodged > 0);
  const share = dodged / (dodged + hits);
  assert.ok(share > 0.1 && share < 0.3, `part esquivée ${share}`);
});

test('v9.2.0 : Tueur de boss multiplie les coups du héros sur un boss, pas sur les monstres', () => {
  const mk = (lv) => { const s = createNewState(NOW, 3); s.stage = 5; s.maxStage = 5; s.upgrades.vitality = 300; s.upgrades.bossDamage = lv; return s; };
  const hitOf = (r, boss) => r.events.find((e) => e.type === 'heroAttack' && e.boss === boss && !e.crit)?.damage;
  const a = fight(mk(0), 8);
  const b = fight(mk(50), 8);
  assert.ok(hitOf(a, true) > 0);
  assert.ok(Math.abs(hitOf(b, true) / hitOf(a, true) - 1.5) < 1e-9);
});

test('v9.2.0 : Vol de vie soigne le héros dans le moteur', () => {
  const run = (lv) => {
    const s = createNewState(NOW, 3);
    s.stage = 3; s.maxStage = 3; s.upgrades.lifesteal = lv; s.upgrades.damage = 30;
    const world = createCombat(s);
    const rng = new Rng(5);
    let healed = 0;
    for (let t = 0; t < 20; t += 0.05) {
      world.hero.hp = 1; // PV au plus bas avant chaque pas : on mesure le soin du pas
      step(s, world, 0.05, rng);
      healed += Math.max(0, world.hero.hp - 1);
      world.events.length = 0;
    }
    return healed;
  };
  assert.ok(run(30) > run(0) * 1.5, `${run(30)} vs ${run(0)}`);
});

test('v9.2.0 : déblocage progressif — débutant 3 lignes, puis premier boss, puis étape record', () => {
  const s = createNewState(NOW);
  assert.deepEqual(openUpgrades(s, BALANCE), BASE_UPGRADES);
  s.records.bossesDefeated = 1;
  assert.deepEqual(openUpgrades(s, BALANCE), ['damage', 'attackSpeed', 'crit', 'vitality', 'defense', 'armor', 'regen', 'goldFind']); // v9.2.8 : + Défense
  assert.deepEqual(nextUpgradeUnlock(s, BALANCE), { key: 'critDamage', label: 'Dégâts critiques', stage: 15 });
  s.records.bestStage = 40;
  for (const k of ['critDamage', 'lifesteal', 'companionPower', 'dodge']) assert.ok(upgradeOpen(s, k, BALANCE), k);
  assert.ok(!upgradeOpen(s, 'bossDamage', BALANCE));
  s.records.bestStage = 60;
  assert.equal(openUpgrades(s, BALANCE).length, 15); // v9.2.8
  assert.equal(nextUpgradeUnlock(s, BALANCE), null);
  // Une ligne déjà achetée reste visible.
  const t = createNewState(NOW);
  t.upgrades.dodge = 1;
  assert.ok(upgradeOpen(t, 'dodge', BALANCE));
});

test('v9.2.0 : anciennes sauvegardes → nouvelles clés à 0, niveaux bornés ; Renaissance remet à zéro sauf la Mémoire', () => {
  const old = JSON.parse(JSON.stringify(createNewState(NOW)));
  for (const k of NEW) delete old.upgrades[k];
  old.upgrades.damage = 12;
  const s = sanitizeState(old, BALANCE, NOW);
  for (const k of NEW) assert.equal(s.upgrades[k], 0, k);
  assert.equal(s.upgrades.damage, 12);
  const t = sanitizeState({ ...old, upgrades: { ...old.upgrades, dodge: 500, critDamage: -3 } }, BALANCE, NOW);
  assert.equal(t.upgrades.dodge, 40);
  assert.equal(t.upgrades.critDamage, 0);
  const r = createNewState(NOW);
  r.stage = 80; r.maxStage = 80; r.records.bestStage = 80;
  for (const k of NEW) r.upgrades[k] = 10;
  performRebirth(r);
  for (const k of NEW) assert.ok(r.upgrades[k] < 10, k);
});

test('v9.2.0 : textes des nouvelles améliorations traduits en anglais et en coréen', () => {
  for (const k of NEW) {
    const { label, description } = BALANCE.upgrades[k];
    for (const s of [label, description]) {
      assert.notEqual(en(s), s, s);
      assert.notEqual(ko(s), s, s);
    }
  }
  assert.equal(en('Nouvelle amélioration : Esquive'), 'New upgrade: Dodge');
  assert.equal(ko('Nouvelle amélioration : Esquive'), '새 강화: 회피');
  assert.equal(en('Prochain : Esquive à l\'étape 40'), 'Next: Dodge at stage 40');
});
