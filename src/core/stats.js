// Statistiques du héros : base + améliorations + équipement + bonus permanents
// (pouvoirs ancestraux actifs et talents de Renaissance).
import { bondBonus } from '../data/bonds.js'; // v9.7.1 (lot 6)
import { blessingMult } from './blessing.js'; // v9.7.1 : bénédiction de départ
import { rankMult } from './ranks.js';
import { riftEchoMult } from './combat.js'; // v9.6.5 (10.4) : échos des Failles
import { BALANCE } from '../data/balance.js';
import { EQUIP_SLOTS, HERO_SLOTS, SLOTS, eqSlot, heroSlot } from '../data/items.js';
import { collectBonuses } from './bonuses.js';
import { cheatMultiplier } from './cheats.js';
import { PRESTIGE } from '../data/prestige.js';
import { challengeRule } from './challenge.js';
import { rebirthBase, stellarMultiplier } from './transcend.js';
import { rebirthPower } from './rebirth.js';
import { bastionMult, buildingLevel, researchEffects } from './bastion-base.js'; // v10.3 (10.4) ; v10.8 : Âges

// v8.4 : chaque Renaissance multiplie dégâts, PV et or (×1,5 par défaut).
// v8.8 : + les Renaissances conservées par la Transcendance, et le multiplicateur stellaire.
export function rebirthMultiplier(state) {
  const n = rebirthPower(state) + (state.prestige?.count ?? 0) + (state.transcend?.keptRebirths ?? 0);
  return Math.min(1e200, rebirthBase(state, PRESTIGE.rebirthMultiplier ?? 1) ** n * stellarMultiplier(state));
}

export function sumEquipmentStats(equipment) {
  const total = { damage: 0, maxHp: 0, armor: 0, attackSpeed: 0 };
  for (const slot of Object.keys(HERO_SLOTS)) {
    const item = equipment[slot];
    if (!item) continue;
    for (const src of [item, ...(item.parts ?? [])]) { // v9.3.4 (f) : pièces réunies comprises
      for (const [stat, value] of Object.entries(src.stats ?? {})) total[stat] = (total[stat] ?? 0) + value;
    }
  }
  return total;
}

// Vitesse d'attaque (att./s) : linéaire jusqu'au seuil, puis rendements décroissants (logarithme) :
// elle progresse toujours, de plus en plus lentement, sans plafond brutal.
export function softAttackSpeed(raw, hero = BALANCE.hero) {
  const { softCap, softness, hardCap } = hero.attackSpeed;
  const v = raw <= softCap ? raw : softCap + softness * Math.log(1 + (raw - softCap) / softness);
  return Math.min(hardCap, v);
}

export function computeHeroStats(state, balance = BALANCE, equipment = state.equipment) {
  const { hero, upgrades } = balance;
  const gear = sumEquipmentStats(equipment);
  const bonus = collectBonuses(state, equipment);
  const ups = state.upgrades;
  const levelBonus = (state.level ?? 1) - 1;

  const dmg = upgrades.damage;
  const milestones = Math.floor(state.upgrades.damage / dmg.milestoneEvery);
  const big = (u, lv) => (u.bigMilestoneEvery ? u.bigMilestoneMultiplier ** Math.floor(lv / u.bigMilestoneEvery) : 1);
  const reborn = rebirthMultiplier(state);
  const damage = (hero.baseDamage + state.upgrades.damage * dmg.perLevel + gear.damage)
    * dmg.milestoneMultiplier ** milestones * big(dmg, state.upgrades.damage) * reborn * (1 + bonus.damagePct / 100)
    * (1 + (balance.level.damagePctPerLevel * levelBonus) / 100) * cheatMultiplier(state, 'damage') * blessingMult(state, 'damage') * (1 + bondBonus(state, 'damagePct') / 100)
    * rankMult(state) // v9.8 (H6) : rang du héros, +3 % par rang gagné en duel (remplace les paliers de puissance)
    * bastionMult(state, 'damage') // v10.8 (4) : Âges du Bastion et recherches des paliers II à V (multiplicatif)
    * Math.max(0.1, 1 + (bonus.damageMultPct ?? 0) / 100) * (state.challenge ? challengeRule(state, 'heroDamage') ?? 1 : 1);

  const upgradeFactor = Math.pow(1 - upgrades.attackSpeed.perLevel, state.upgrades.attackSpeed);
  const gearSpeedPct = Math.max(-50, gear.attackSpeed);
  const rawSpeed = ((1 + gearSpeedPct / 100) * (1 + bonus.attackSpeedPct / 100)) / (hero.baseAttackInterval * upgradeFactor);
  const attackInterval = 1 / softAttackSpeed(rawSpeed, hero);

  const vit = upgrades.vitality;
  const hpMilestones = vit.milestoneEvery ? Math.floor(ups.vitality / vit.milestoneEvery) : 0;
  const maxHp = Math.max(1, (hero.baseMaxHp + ups.vitality * vit.perLevel + gear.maxHp)
    * (vit.milestoneMultiplier ?? 1) ** hpMilestones * big(vit, ups.vitality) * reborn * (1 + bonus.maxHpPct / 100) * (1 + (balance.level.hpPctPerLevel * levelBonus) / 100)) * cheatMultiplier(state, 'hp') * blessingMult(state, 'hp') * (1 + bondBonus(state, 'maxHpPct') / 100)
    * Math.max(0.1, 1 + (bonus.maxHpMultPct ?? 0) / 100) * (state.challenge ? challengeRule(state, 'heroHp') ?? 1 : 1) * bastionMult(state, 'hp'); // v10.8 (4)
  const armor = Math.min(hero.armorCapPct, Math.max(0, gear.armor + bonus.armor + (ups.armor ?? 0) * upgrades.armor.perLevel));
  // v9.2.0 : paliers de la Régénération (×1,1 tous les 10 niveaux, sur la part achetée seulement).
  const rg = upgrades.regen;
  const regenPct = hero.regenPerSecondPct + bonus.regenPct
    + (ups.regen ?? 0) * rg.perLevel * (rg.milestoneMultiplier ?? 1) ** (rg.milestoneEvery ? Math.floor((ups.regen ?? 0) / rg.milestoneEvery) : 0);
  const critChance = Math.min(hero.critCapPct, bonus.critChance + (ups.crit ?? 0) * upgrades.crit.perLevel + bondBonus(state, 'critChance')); // v9.7.1 : liens

  // v9.2.0 : nouvelles améliorations (niveau borné par maxLevel, même sur une sauvegarde trafiquée).
  const lv = (k) => Math.min(upgrades[k]?.maxLevel ?? Infinity, Math.max(0, ups[k] ?? 0));
  const per = (k) => lv(k) * (upgrades[k]?.perLevel ?? 0);
  const critMultiplier = hero.critMultiplier + per('critDamage') / 100; // ×2 → ×4 au niveau 100
  // v9.2.8 : Défense (points → réduction à rendement décroissant) et Double attaque.
  const defense = (ups.defense ?? 0) * (upgrades.defense?.perLevel ?? 0);
  const defenseReductionPct = defenseReduction(defense, balance);
  const doubleAttackPct = Math.min(upgrades.doubleAttack?.capPct ?? 100, per('doubleAttack'));
  const dps = (damage / attackInterval) * (1 + (critChance / 100) * (critMultiplier - 1)) * (1 + doubleAttackPct / 100);
  // v9.2.8 : PV effectifs contre un coup ordinaire (armure puis Défense) et Puissance de combat (PC) : moyenne
  // géométrique des dégâts/s et des PV effectifs, ×10 (un seul nombre qui résume attaque et survie).
  const effectiveHp = maxHp / Math.max(0.01, (1 - armor / 100) * (1 - defenseReductionPct / 100));
  const combatPower = Math.round(10 * Math.sqrt(Math.max(0, dps) * effectiveHp));

  return {
    damage,
    attackInterval,
    attacksPerSecond: 1 / attackInterval,
    // DPS moyen, coups critiques et doubles attaques compris (hors compétences).
    dps,
    defense,
    defenseReductionPct,
    doubleAttackPct,
    effectiveHp,
    combatPower,
    critMultiplier,
    maxHp,
    armor,
    regenPerSecond: (maxHp * regenPct) / 100,
    critChance,
    lifesteal: bonus.lifesteal + per('lifesteal'),
    dodgePct: Math.min(20, per('dodge')), // v9.2.0 : moitié contre les boss (core/combat.js)
    bossDamagePct: per('bossDamage'), // facteur à part, en plus des « dégâts contre les boss » des talents/objets
    companionPowerPct: per('companionPower') + bondBonus(state, 'companionPowerPct') + (researchEffects(state).companionPowerPct ?? 0) + 3 * buildingLevel(state, 'runes') + ((bastionMult(state, 'companion') - 1) * 100), // v9.7.1 (lot 6) : liens · v10.3 : recherche · v10.8 : runes et « Meute »
    thorns: bonus.thorns,
    goldPct: bonus.goldPct + (ups.goldFind ?? 0) * upgrades.goldFind.perLevel,
    // Multiplicateur d'or (Renaissances × paliers du Butin d'or), appliqué en plus du goldPct.
    goldMult: riftEchoMult(state, balance) * reborn * big(upgrades.goldFind, ups.goldFind ?? 0) * Math.max(0.1, 1 + (bonus.goldMultPct ?? 0) / 100),
    rebirthMult: reborn,
    xpPct: bonus.xpPct + per('xpGain'),
    bonus,
  };
}

// v9.2.8 : réduction des dégâts subis par la Défense, en % : plafond × D / (D + K). Rendement décroissant : la moitié
// du plafond à D = K, jamais le plafond lui-même.
export function defenseReduction(points, balance = BALANCE) {
  const d = balance.upgrades.defense;
  if (!d || !(points > 0)) return 0;
  return (d.capPct * points) / (points + d.halfAt);
}

// Statistiques si `item` remplaçait l'objet équipé du même emplacement.
export function statsWithItem(state, item, balance = BALANCE) {
  return computeHeroStats(state, balance, { ...state.equipment, [heroSlot(item)]: item });
}
