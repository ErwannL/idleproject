// Bonus cumulés de toutes les sources permanentes : pouvoirs ancestraux actifs (avec synergies),
// talents, héros actif, compagnons équipés et effets spéciaux de l'équipement porté.
import { SLOTS } from '../data/items.js';
import { companionEffects } from './companions.js';
import { heroEffects } from './heroes.js';
import { powerEffects } from './powers.js';
import { prestigeEffects } from './prestige.js';
import { rushEffects } from './rushes.js';
import { talentEffects } from './rebirth.js';

export const BONUS_KEYS = [
  'damagePct', 'attackSpeedPct', 'maxHpPct', 'regenPct', 'armor', 'goldPct', 'dropChance',
  'damageVsNormalPct', 'damageVsBossPct', 'lowHpArmor', 'critChance', 'lifesteal', 'thorns',
  'xpPct', 'skillCooldownPct',
];

export function gearAffixEffects(equipment) {
  const out = {};
  for (const slot of Object.keys(SLOTS)) {
    for (const affix of equipment[slot]?.affixes ?? []) out[affix.type] = (out[affix.type] ?? 0) + affix.value;
  }
  return out;
}

// Détail par source (affiché dans la fiche du héros) et total.
export function bonusSources(state, equipment = state.equipment) {
  return {
    powers: powerEffects(state),
    talents: talentEffects(state),
    hero: heroEffects(state),
    companions: companionEffects(state),
    gear: gearAffixEffects(equipment),
    prestige: prestigeEffects(state),
    rushes: rushEffects(state),
  };
}

export function collectBonuses(state, equipment = state.equipment) {
  const total = Object.fromEntries(BONUS_KEYS.map((k) => [k, 0]));
  for (const effects of Object.values(bonusSources(state, equipment))) {
    for (const [k, v] of Object.entries(effects)) if (k in total) total[k] += v;
  }
  return total;
}
