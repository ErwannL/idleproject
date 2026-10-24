// Compétences actives : apprentissage avec les points de niveau, valeur et recharge.
import { SKILLS } from '../data/skills.js';

export function skillById(id) {
  return SKILLS.find((s) => s.id === id);
}

export function skillPointsAvailable(state) {
  const spent = Object.values(state.skills).reduce((s, v) => s + v, 0);
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
  if (level >= skill.maxLevel || skillPointsAvailable(state) < 1) return false;
  state.skills[id] = level + 1;
  return true;
}

// Compétences prêtes à être lancées automatiquement.
export function activeSkills(state) {
  return SKILLS.filter((s) => (state.skills[s.id] ?? 0) > 0 && state.level >= s.unlockLevel);
}
