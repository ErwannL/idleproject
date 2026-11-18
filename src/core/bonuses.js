// Bonus cumulés de toutes les sources permanentes : pouvoirs ancestraux actifs (avec synergies),
// talents, héros actif, compagnons équipés et effets spéciaux de l'équipement porté.
import { boonEffects } from './boons.js';
import { EQUIP_SLOTS, HERO_SLOTS, SLOTS, eqSlot, heroSlot } from '../data/items.js';
import { companionEffects } from './companions.js';
import { heroEffects } from './heroes.js';
import { classEffects } from './classes.js';
import { powerEffects } from './powers.js';
import { prestigeEffects } from './prestige.js';
import { rushEffects } from './rushes.js';
import { talentEffects } from './rebirth.js';
import { achievementEffects } from './achievements.js';
import { setEffects } from './sets.js';
import { museumEffects } from './museum.js';

export const BONUS_KEYS = [
  'damagePct', 'attackSpeedPct', 'maxHpPct', 'regenPct', 'armor', 'goldPct', 'dropChance',
  'damageVsNormalPct', 'damageVsBossPct', 'lowHpArmor', 'critChance', 'lifesteal', 'thorns',
  'xpPct', 'skillCooldownPct',
  // v8.5 : multiplicateurs (clés de voûte de l'arbre, ensembles d'équipement) — additionnés entre eux,
  // puis appliqués en facteur (×(1 + total / 100)).
  'damageMultPct', 'maxHpMultPct', 'goldMultPct',
];

export function gearAffixEffects(equipment) {
  const out = {};
  for (const slot of Object.keys(HERO_SLOTS)) {
    const it = equipment[slot];
    for (const affix of [...(it?.affixes ?? []), ...(it?.parts ?? []).flatMap((p) => p.affixes ?? [])]) out[affix.type] = (out[affix.type] ?? 0) + affix.value;
  }
  return out;
}

// Détail par source (affiché dans la fiche du héros) et total.
export function bonusSources(state, equipment = state.equipment) {
  return {
    powers: powerEffects(state),
    talents: talentEffects(state),
    hero: heroEffects(state),
    heroClass: classEffects(state), // v9.0.6
    companions: companionEffects(state),
    gear: gearAffixEffects(equipment),
    prestige: prestigeEffects(state),
    rushes: rushEffects(state),
    achievements: achievementEffects(state),
    sets: setEffects(equipment),
    museum: museumEffects(state),
    boons: boonEffects(state), // v9.9 (K7/K8) : bénédictions de donjon, rencontres de route
  };
}

export function collectBonuses(state, equipment = state.equipment) {
  const total = Object.fromEntries(BONUS_KEYS.map((k) => [k, 0]));
  for (const effects of Object.values(bonusSources(state, equipment))) {
    for (const [k, v] of Object.entries(effects)) if (k in total) total[k] += v;
  }
  return total;
}
