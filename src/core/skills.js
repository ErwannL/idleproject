// Compétences actives : apprentissage avec les points de niveau, valeur et recharge.
import { SKILLS } from '../data/skills.js';

export function skillById(id) {
  return SKILLS.find((s) => s.id === id);
}

// v7.6 : 50 niveaux par compétence ; chaque palier de 10 niveaux coûte 1 point de plus
// (niveaux 1-10 : 1 point, 11-20 : 2 points… 41-50 : 5 points).
export function skillPointCost(level) {
  return 1 + Math.floor(level / 10);
}

// Points dépensés pour amener une compétence au niveau `level`.
export function skillPointsSpent(level) {
  let total = 0;
  for (let l = 0; l < level; l++) total += skillPointCost(l);
  return total;
}

export function skillPointsAvailable(state) {
  const spent = Object.values(state.skills).reduce((s, v) => s + skillPointsSpent(v), 0);
  return Math.max(0, state.level - spent);
}

export function skillValue(skill, level) {
  return Math.round((skill.base + skill.perLevel * (level - 1)) * 100) / 100;
}

export function skillCooldown(skill, bonus) {
  return skill.cooldown * (1 - Math.min(50, bonus.skillCooldownPct ?? 0) / 100);
}

export function learnSkill(state, id) {
  const skill = skillById(id);
  if (!skill || state.level < skill.unlockLevel) return false;
  const level = state.skills[id] ?? 0;
  if (level >= skill.maxLevel || skillPointsAvailable(state) < skillPointCost(level)) return false;
  state.skills[id] = level + 1;
  return true;
}

// Compétences prêtes à être lancées automatiquement.
export function activeSkills(state) {
  return SKILLS.filter((s) => (state.skills[s.id] ?? 0) > 0 && state.level >= s.unlockLevel);
}
