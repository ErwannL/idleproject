// Bonus permanents cumulés : pouvoirs ancestraux actifs + talents de Renaissance.
import { activePowers } from './powers.js';
import { talentEffects } from './rebirth.js';

export const BONUS_KEYS = [
  'damagePct', 'attackSpeedPct', 'maxHpPct', 'regenPct', 'armor', 'goldPct', 'dropChance',
  'damageVsNormalPct', 'damageVsBossPct', 'lowHpArmor',
];

export function collectBonuses(state) {
  const total = Object.fromEntries(BONUS_KEYS.map((k) => [k, 0]));
  const add = (effects) => {
    for (const [k, v] of Object.entries(effects)) if (k in total) total[k] += v;
  };
  for (const power of activePowers(state)) add(power.effects);
  add(talentEffects(state));
  return total;
}
