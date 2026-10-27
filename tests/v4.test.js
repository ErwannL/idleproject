import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BALANCE } from '../src/data/balance.js';
import { COMPANIONS } from '../src/data/companions.js';
import { DUNGEONS } from '../src/data/dungeons.js';
import { AFFIXES, SIGNATURE_ITEMS } from '../src/data/items.js';
import { POWER_RULES } from '../src/data/powers.js';
import { ZONES } from '../src/data/zones.js';
import { changeStage, createCombat, currentEncounter, step } from '../src/core/combat.js';
import { companionEffects, toggleCompanion, upgradeCompanion } from '../src/core/companions.js';
import { claimContract, trackContracts } from '../src/core/contracts.js';
import { canEnterDungeon, setDungeonPath, startDungeon } from '../src/core/dungeon.js';
import { buyFromMerchant, claimEvent, dismissEvent, rollEvent } from '../src/core/events.js';
import { craftItem, reforgeItem, sharpenItem } from '../src/core/forge.js';
import { summon, summonOdds } from '../src/core/gacha.js';
import { heroEffects, setActiveHero } from '../src/core/heroes.js';
import { addToInventory, recycleItem } from '../src/core/inventory.js';
import { addXp, xpForLevel } from '../src/core/level.js';
import { generateItem, itemBase, makeItem, makeSignatureItem } from '../src/core/loot.js';
import { applyOfflineRewards, computeOfflineRewards } from '../src/core/offline.js';
import { claimMastery, powerEffects, recordBossVictory, synergyFamilies } from '../src/core/powers.js';
import { Rng } from '../src/core/rng.js';
import { learnSkill, skillPointsAvailable } from '../src/core/skills.js';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { computeHeroStats } from '../src/core/stats.js';

const NOW = 1_700_000_000_000;
const run = (state, world, seconds, rng) => {
  for (let i = 0; i < seconds * 20; i++) step(state, world, 0.05, rng);
};

test('11 mondes, chacun avec ses ennemis, son boss et son décor', () => {
  assert.equal(ZONES.length, 11);
  for (const zone of ZONES) assert.ok(zone.enemies.length >= 2 && zone.bosses.length === 1, zone.id);
});

test('objets : effets spéciaux selon la rareté et objets signature de boss', () => {
  const state = createNewState(NOW, 1);
  const rng = new Rng(4);
  for (let i = 0; i < 50; i++) {
    const item = generateItem(state, rng, { level: 5, minRarity: 'legendary' });
    // Les accessoires ont en plus leur effet principal.
    assert.equal(item.affixes.length, BALANCE.loot.affixCount.legendary + (itemBase(item.baseId).mainAffix ? 1 : 0));
    assert.equal(new Set(item.affixes.map((a) => a.type)).size, item.affixes.length, 'pas de doublon');
    for (const a of item.affixes) assert.ok(AFFIXES[a.type].slots.includes(item.slot));
  }
  assert.equal(generateItem(state, rng, { level: 1, minRarity: 'common', slot: 'helmet' }).slot, 'helmet');
  for (const sig of SIGNATURE_ITEMS) {
    const item = makeSignatureItem(state, sig.signature, 10, rng);
    assert.deepEqual(item.affixes, sig.affixes);
    assert.ok(['epic', 'legendary'].includes(item.rarity));
  }
});

test('effets spéciaux appliqués : critique, vol de vie et épines', () => {
  const state = createNewState(NOW, 1);
  const weapon = makeItem(state, 'short_sword', 'epic', 1);
  weapon.affixes = [{ type: 'critChance', value: 10 }, { type: 'lifesteal', value: 5 }];
  state.equipment.weapon = weapon;
  state.equipment.armor = { ...makeItem(state, 'chainmail', 'epic', 1), affixes: [{ type: 'thorns', value: 20 }] };
  const stats = computeHeroStats(state);
  assert.equal(stats.critChance, 10);
  assert.equal(stats.lifesteal, 5);
  assert.equal(stats.thorns, 20);
});

test('niveau : l\'XP des combats fait monter le héros et donne des points de compétence', () => {
  const state = createNewState(NOW, 1);
  assert.equal(addXp(state, xpForLevel(1) + xpForLevel(2)), 2);
  assert.equal(state.level, 3);
  assert.equal(skillPointsAvailable(state), 2);
  const before = computeHeroStats(createNewState(NOW, 1));
  assert.ok(computeHeroStats(state).damage > before.damage);

  const fight = createNewState(NOW, 2);
  run(fight, createCombat(fight), 60, new Rng(2));
  assert.ok(fight.level > 1 || fight.xp > 0);
});

test('compétences : apprentissage, déblocage par niveau et lancement automatique', () => {
  const state = createNewState(NOW, 1);
  assert.equal(learnSkill(state, 'whirl'), false, 'Tourbillon demande le niveau 5');
  state.level = 5;
  assert.ok(learnSkill(state, 'whirl'));
  assert.ok(learnSkill(state, 'quick'));
  const world = createCombat(state);
  let casts = 0;
  const rng = new Rng(3);
  for (let i = 0; i < 20 * 40; i++) {
    step(state, world, 0.05, rng);
    casts += world.events.filter((e) => e.type === 'skill').length;
    world.events.length = 0;
  }
  assert.ok(casts >= 4, `lancements : ${casts}`);
});

test('invocation : coût, probabilités affichées, garantie et doublons', () => {
  const odds = summonOdds();
  assert.ok(Math.abs(odds.reduce((s, r) => s + r.chance, 0) - 1) < 1e-9);
  const state = createNewState(NOW, 1);
  assert.equal(summon(state, new Rng(1), 1, 'gems'), null, 'pas assez de gemmes');
  assert.ok(summon(state, new Rng(1), 1, 'tickets'), 'ticket de départ');
  state.gems = 900 * 7;
  const results = [];
  for (let i = 0; i < 7; i++) results.push(...summon(state, new Rng(i + 10), 10, 'gems'));
  assert.equal(state.gems, results.reduce((sum, r) => sum + r.refund, 0), 'seuls les remboursements de doublons restent');
  // Garantie : au moins un Épique+ toutes les 10 invocations, un Légendaire en 60.
  for (let i = 0; i + 10 <= results.length; i += 10) {
    assert.ok(results.slice(i, i + 10).some((r) => ['epic', 'legendary'].includes(r.rarity)), `série ${i}`);
  }
  assert.ok(results.slice(0, 60).some((r) => r.rarity === 'legendary'));
  assert.ok(results.some((r) => !r.isNew), 'des doublons');
  for (const r of results) {
    const owned = (r.kind === 'hero' ? state.heroes.owned : state.companions.owned)[r.id];
    assert.ok(owned.stars >= 1 && owned.stars <= BALANCE.summon.maxStars);
  }
});

test('héros : bonus de rôle, étoiles et changement de héros', () => {
  const state = createNewState(NOW, 1);
  assert.equal(setActiveHero(state, 'berserker'), false, 'héros non possédé');
  state.heroes.owned.berserker = { stars: 1 };
  assert.ok(setActiveHero(state, 'berserker'));
  const one = heroEffects(state).damagePct;
  state.heroes.owned.berserker.stars = 3;
  assert.ok(heroEffects(state).damagePct > one);
});

test('compagnons : équipement limité, niveaux et effets', () => {
  const state = createNewState(NOW, 1);
  for (const c of COMPANIONS) state.companions.owned[c.id] = { stars: 1, level: 1 };
  for (const c of COMPANIONS) toggleCompanion(state, c.id);
  // Équipe : 2 personnages + 1 compagnon (le dernier compagnon équipé remplace le précédent).
  assert.equal(state.companions.equipped.length, BALANCE.teamSlots.ally + BALANCE.teamSlots.pet);
  toggleCompanion(state, 'golden_slime');
  assert.ok(state.companions.equipped.includes('golden_slime'));
  assert.equal(state.companions.equipped.length, 3);
  const gold = companionEffects(state).goldPct;
  state.gold = 1e9;
  assert.ok(upgradeCompanion(state, 'golden_slime'));
  assert.ok(companionEffects(state).goldPct > gold);
});

test('compagnon « Pluie d\'or » : de l\'or en plus pendant le combat', () => {
  const base = createNewState(NOW, 5);
  base.autoAdvance = false;
  const withPet = structuredClone(base);
  withPet.companions = { owned: { golden_slime: { stars: 1, level: 1 } }, equipped: ['golden_slime'] };
  run(base, createCombat(base), 120, new Rng(1));
  run(withPet, createCombat(withPet), 120, new Rng(1));
  assert.ok(withPet.records.goldEarned > base.records.goldEarned * 1.2, `${base.records.goldEarned} -> ${withPet.records.goldEarned}`);
});

test('contrats : progression automatique, récompense et remplacement', () => {
  const state = createNewState(NOW, 1);
  assert.equal(state.contracts.length, 3);
  assert.equal(new Set(state.contracts.map((c) => c.type)).size, 3, 'trois objectifs différents');
  const contract = state.contracts[0];
  assert.equal(claimContract(state, contract.id, new Rng(1)), null, 'pas encore rempli');
  trackContracts(state, contract.type, contract.target);
  const gems = state.gems;
  assert.ok(claimContract(state, contract.id, new Rng(1)));
  assert.ok(state.gems > gems || state.tickets > 0);
  assert.equal(state.contracts.length, 3);
  assert.ok(!state.contracts.some((c) => c.id === contract.id));
  assert.equal(state.records.contractsDone, 1);
});

test('événements discrets : coffre, marchand, élite et vague, jamais bloquants', () => {
  const state = createNewState(NOW, 1);
  const rules = { ...BALANCE, events: { ...BALANCE.events, chancePerKill: 1 } };
  const world = createCombat(state);
  const seen = new Set();
  for (let seed = 0; seed < 600 && seen.size < 7; seed++) {
    const e = rollEvent(state, world, new Rng(seed), rules);
    if (e) seen.add(e.type);
    if (state.inbox.length >= BALANCE.events.inboxSize) state.inbox.length = 0;
  }
  assert.deepEqual([...seen].sort(), ['chest', 'elite', 'gems', 'merchant', 'portal', 'wanderer', 'wave']);
  assert.ok(world.pendingElite && world.goldWave > 0);

  state.inbox = [];
  let chest = null;
  let merchant = null;
  for (let seed = 0; (!chest || !merchant) && seed < 500; seed++) {
    rollEvent(state, world, new Rng(seed), rules);
    chest ??= state.inbox.find((e) => e.type === 'chest');
    merchant ??= state.inbox.find((e) => e.type === 'merchant');
  }
  const gold = state.gold;
  assert.ok(claimEvent(state, chest.id));
  assert.ok(state.gold > gold && state.inventory.some((i) => i.id === chest.item.id));
  assert.equal(buyFromMerchant(state, merchant.id), false, 'or insuffisant');
  state.gold = merchant.price;
  assert.ok(buyFromMerchant(state, merchant.id));
  assert.equal(state.gold, 0);
  const left = state.inbox[0];
  if (left) assert.ok(dismissEvent(state, left.id));
});

test('recyclage : éclats et essences ; forge : fabrication ciblée, relance d\'effets, réaffûtage', () => {
  const state = createNewState(NOW, 1);
  const epic = makeItem(state, 'dagger', 'epic', 1, BALANCE, new Rng(1));
  addToInventory(state, epic);
  recycleItem(state, epic.id);
  assert.equal(state.materials.shards, BALANCE.materials.shards.epic);
  assert.equal(state.materials.essence, BALANCE.materials.essence.epic);

  state.maxStage = 10;
  state.gold = 1e9;
  state.materials = { shards: 500, essence: 5 };
  const crafted = craftItem(state, 'armor', new Rng(2));
  assert.equal(crafted.slot, 'armor');
  assert.equal(crafted.level, 10);
  assert.ok(['rare', 'epic', 'legendary'].includes(crafted.rarity));

  const before = JSON.stringify(crafted.affixes);
  let changed = false;
  for (let i = 0; i < 5 && !changed; i++) {
    assert.ok(reforgeItem(state, crafted.id, new Rng(100 + i)));
    changed = JSON.stringify(crafted.affixes) !== before;
  }
  assert.ok(changed, 'effets relancés');

  const old = makeItem(state, 'short_sword', 'rare', 2);
  addToInventory(state, old);
  const damage = old.stats.damage;
  assert.ok(sharpenItem(state, old.id));
  assert.equal(old.level, 10);
  assert.ok(old.stats.damage > damage);
  assert.equal(sharpenItem(state, old.id), false, 'déjà au niveau maximum');
});

test('donjon : clé, salles, chemin modifiable, boss avec pouvoir et butin ciblé', () => {
  const state = createNewState(NOW, 7);
  const dungeon = DUNGEONS[0];
  assert.equal(canEnterDungeon(state, dungeon.id), false, 'étape requise');
  state.maxStage = dungeon.unlockStage;
  state.upgrades.damage = 150;
  state.upgrades.vitality = 100;
  assert.ok(startDungeon(state, dungeon.id, 'helmet', 'relics'));
  assert.equal(state.keys, 0);
  assert.equal(canEnterDungeon(state, dungeon.id), false, 'une expédition à la fois');
  assert.ok(setDungeonPath(state, 'gold'));
  assert.equal(currentEncounter(state).dungeon.id, dungeon.id);
  const world = createCombat(state);
  const rng = new Rng(8);
  let complete = null;
  for (let i = 0; i < 20 * 300 && !complete; i++) {
    step(state, world, 0.05, rng);
    complete = world.events.find((e) => e.type === 'dungeonComplete');
    world.events.length = 0;
  }
  assert.ok(complete, 'donjon terminé');
  assert.equal(state.dungeon, null);
  assert.equal(complete.item.slot, 'helmet');
  assert.ok(['epic', 'legendary'].includes(complete.item.rarity));
  assert.ok(state.powers.spectral_queen, 'pouvoir de la Reine spectrale');
  assert.equal(state.dungeonsCleared.crypt, 1);
});

test('défaite en donjon : fin de l\'expédition, retour à la campagne', () => {
  const state = createNewState(NOW, 9);
  state.maxStage = 40;
  startDungeon(state, 'crypt', 'any', 'gold');
  const world = createCombat(state);
  run(state, world, 60, new Rng(9));
  assert.equal(state.dungeon, null);
  assert.ok(state.maxStage === 40, 'la campagne est intacte');
});

test('maîtrise et synergies des pouvoirs', () => {
  const state = createNewState(NOW, 1);
  const rng = new Rng(1);
  for (let i = 0; i < 3; i++) recordBossVictory(state, 'slime_king', rng);
  const gems = state.gems;
  assert.ok(claimMastery(state, 'slime_king'));
  assert.ok(state.gems > gems);
  assert.equal(claimMastery(state, 'slime_king'), null, 'palier suivant non atteint');

  recordBossVictory(state, 'alpha_wolf', rng);
  state.powers.slime_king.current = 'gel_heart';
  state.powers.alpha_wolf.current = 'bloodlust';
  state.equippedPowers = ['slime_king', 'alpha_wolf'];
  assert.deepEqual(synergyFamilies(state), []);
  state.powers.alpha_wolf.current = 'pack_fury';
  state.powers.slime_king.current = 'ooze_regen';
  recordBossVictory(state, 'bone_lord', rng);
  state.powers.bone_lord.current = 'last_bastion';
  state.equippedPowers = ['slime_king', 'bone_lord'];
  assert.deepEqual(synergyFamilies(state), ['survival']);
  assert.equal(powerEffects(state).regenPct, 1.5 * (1 + POWER_RULES.synergy.bonusPct / 100));
});

test('migration v3 → v4 : sauvegarde conservée, nouveaux champs, charge offerte', () => {
  const v3 = createNewState(NOW, 3);
  for (const key of ['level', 'xp', 'skills', 'heroes', 'companions', 'gems', 'tickets', 'keys', 'materials', 'summon',
    'contracts', 'nextContractId', 'inbox', 'nextEventId', 'dungeon', 'dungeonsCleared']) delete v3[key];
  v3.version = 3;
  v3.gold = 777;
  v3.maxStage = 12;
  v3.upgrades = { damage: 4, attackSpeed: 2, vitality: 1 };
  v3.powers = { slime_king: { current: 'gel_heart', pending: null, victories: 2, rerolls: 0, sinceHigh: 0 } };
  v3.equippedPowers = ['slime_king'];
  const s = sanitizeState(JSON.parse(JSON.stringify(v3)), BALANCE, NOW);
  // v8.4 : les niveaux d'amélioration sont remboursés en or (nouveaux coûts).
  assert.ok(s.gold > 777);
  assert.equal(s.upgrades.damage, 0);
  assert.equal(s.upgrades.crit, 0);
  assert.equal(s.powers.slime_king.charges, 1);
  assert.equal(s.level, 1);
  assert.equal(s.heroes.active, 'knight');
  assert.equal(s.contracts.length, 3);
  assert.equal(s.keys, 1);
});

test('hors ligne : XP et contrats progressent aussi', () => {
  const state = createNewState(NOW, 4);
  const kills = state.contracts.find((c) => c.type === 'kills');
  const rewards = computeOfflineRewards(state, NOW - 3600e3, NOW, new Rng(1));
  assert.ok(rewards.xp > 0);
  applyOfflineRewards(state, rewards);
  assert.ok(state.level > 1 || state.xp > 0);
  if (kills) assert.ok(kills.progress > 0);
});

test('les 7 boss donnent un pouvoir et la campagne de zone 4 à 6 se joue', () => {
  const state = createNewState(NOW, 11);
  state.maxStage = 120;
  state.upgrades.damage = 450;
  state.upgrades.vitality = 330;
  const world = createCombat(state);
  for (const stage of [80, 100, 120]) {
    changeStage(state, world, stage);
    const rng = new Rng(stage);
    for (let i = 0; i < 20 * 60 && state.stage === stage; i++) step(state, world, 0.05, rng);
  }
  for (const boss of ['ash_dragon', 'fallen_knight', 'demon_king']) assert.ok(state.powers[boss], boss);
});
