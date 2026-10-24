// Statistiques du héros : base + améliorations + équipement + bonus permanents
// (pouvoirs ancestraux actifs et talents de Renaissance).
import { BALANCE } from '../data/balance.js';
import { SLOTS } from '../data/items.js';
import { collectBonuses } from './bonuses.js';

export function sumEquipmentStats(equipment) {
  const total = { damage: 0, maxHp: 0, armor: 0, attackSpeed: 0 };
  for (const slot of Object.keys(SLOTS)) {
    const item = equipment[slot];
    if (!item) continue;
    for (const [stat, value] of Object.entries(item.stats)) {
      total[stat] = (total[stat] ?? 0) + value;
    }
  }
  return total;
}

export function computeHeroStats(state, balance = BALANCE, equipment = state.equipment) {
  const { hero, upgrades } = balance;
  const gear = sumEquipmentStats(equipment);
  const bonus = collectBonuses(state, equipment);
  const ups = state.upgrades;
  const levelBonus = (state.level ?? 1) - 1;

  const dmg = upgrades.damage;
  const milestones = Math.floor(state.upgrades.damage / dmg.milestoneEvery);
  const damage = (hero.baseDamage + state.upgrades.damage * dmg.perLevel + gear.damage)
    * dmg.milestoneMultiplier ** milestones * (1 + bonus.damagePct / 100)
    * (1 + (balance.level.damagePctPerLevel * levelBonus) / 100);

  const upgradeFactor = Math.pow(1 - upgrades.attackSpeed.perLevel, state.upgrades.attackSpeed);
  const gearSpeedPct = Math.max(-50, gear.attackSpeed);
  const attackInterval = Math.max(
    hero.minAttackInterval,
    (hero.baseAttackInterval * upgradeFactor) / ((1 + gearSpeedPct / 100) * (1 + bonus.attackSpeedPct / 100)),
  );

  const maxHp = Math.max(1, (hero.baseMaxHp + ups.vitality * upgrades.vitality.perLevel + gear.maxHp)
    * (1 + bonus.maxHpPct / 100) * (1 + (balance.level.hpPctPerLevel * levelBonus) / 100));
  const armor = Math.min(hero.armorCapPct, Math.max(0, gear.armor + bonus.armor + (ups.armor ?? 0) * upgrades.armor.perLevel));
  const regenPct = hero.regenPerSecondPct + bonus.regenPct + (ups.regen ?? 0) * upgrades.regen.perLevel;
  const critChance = Math.min(hero.critCapPct, bonus.critChance + (ups.crit ?? 0) * upgrades.crit.perLevel);

  return {
    damage,
    attackInterval,
    attacksPerSecond: 1 / attackInterval,
    // DPS moyen, coups critiques compris (hors compétences).
    dps: (damage / attackInterval) * (1 + (critChance / 100) * (hero.critMultiplier - 1)),
    maxHp,
    armor,
    regenPerSecond: (maxHp * regenPct) / 100,
    critChance,
    lifesteal: bonus.lifesteal,
    thorns: bonus.thorns,
    goldPct: bonus.goldPct + (ups.goldFind ?? 0) * upgrades.goldFind.perLevel,
    xpPct: bonus.xpPct,
    bonus,
  };
}

// Statistiques si `item` remplaçait l'objet équipé du même emplacement.
export function statsWithItem(state, item, balance = BALANCE) {
  return computeHeroStats(state, balance, { ...state.equipment, [item.slot]: item });
}
