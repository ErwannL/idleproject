import { heraldTrack } from './chronicles.js';
// Compétences actives : apprentissage avec les points de niveau, valeur et recharge.
import { LOADOUT_SIZE, SKILLS } from '../data/skills.js';

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
  heraldTrack(state, 'skills', 1); // v9.11 (7)
  return true;
}

// Compétences prêtes à être lancées automatiquement.
// v9.7.1 (lot 6) : compétences de la classe du héros (communes + propres), et les 3 actives choisies (sinon les
// trois premières apprises).
export function classSkills(state) {
  const cls = state.heroClass ?? 'knight';
  return SKILLS.filter((s) => !s.cls || s.cls === cls);
}
export function activeSkills(state) {
  const learned = classSkills(state).filter((s) => (state.skills[s.id] ?? 0) > 0 && state.level >= s.unlockLevel);
  const pick = Array.isArray(state.skillLoadout) ? learned.filter((s) => state.skillLoadout.includes(s.id)) : [];
  return (pick.length ? pick : learned).slice(0, LOADOUT_SIZE);
}
export function toggleLoadout(state, id) {
  const learned = classSkills(state).filter((s) => (state.skills[s.id] ?? 0) > 0).map((s) => s.id);
  if (!learned.includes(id)) return false;
  let cur = (Array.isArray(state.skillLoadout) ? state.skillLoadout : activeSkills(state).map((s) => s.id)).filter((x) => learned.includes(x));
  cur = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-LOADOUT_SIZE);
  state.skillLoadout = cur;
  return true;
}

// « Répartir mes points » (v9.1.0) : répartition équilibrée entre les compétences déjà apprises — chaque point va à
// la moins haute (à égalité, la première de la liste). Sans compétence apprise, la première débloquée est apprise.
// Renvoie le nombre de niveaux achetés.
export function distributeSkillPoints(state) {
  let n = 0;
  for (let guard = 0; guard < 2000; guard++) {
    // v9.3.5 : une compétence débloquée mais pas encore apprise passe d'abord (sinon le guide la proposait sans fin).
    const open = SKILLS.filter((s) => state.level >= s.unlockLevel && (state.skills[s.id] ?? 0) < s.maxLevel);
    const fresh = open.filter((s) => !(state.skills[s.id] ?? 0)).slice(0, 1);
    const learned = open.filter((s) => (state.skills[s.id] ?? 0) > 0);
    const pool = fresh.length ? fresh : learned.length ? learned : open.slice(0, 1);
    const target = pool.filter((s) => skillPointsAvailable(state) >= skillPointCost(state.skills[s.id] ?? 0))
      .sort((a, b) => (state.skills[a.id] ?? 0) - (state.skills[b.id] ?? 0))[0];
    if (!target || !learnSkill(state, target.id)) break;
    n += 1;
  }
  return n;
}
