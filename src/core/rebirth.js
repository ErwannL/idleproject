// Renaissance (prestige) et talents permanents.
import { REBIRTH, TALENTS } from '../data/rebirth.js';
import { PRESTIGE } from '../data/prestige.js';

export function talentById(id) {
  return TALENTS.find((t) => t.id === id);
}

export function talentCost(talent, level) {
  return talent.costBase + talent.costStep * level;
}

// Effets cumulés d'un talent à un niveau donné.
export function talentLevelEffects(talent, level) {
  const out = {};
  for (let i = 0; i < level; i++) {
    const step = talent.levels ? talent.levels[i] : talent.perLevel;
    for (const [k, v] of Object.entries(step ?? {})) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

export function talentEffects(state) {
  const out = {};
  for (const talent of TALENTS) {
    for (const [k, v] of Object.entries(talentLevelEffects(talent, state.talents[talent.id] ?? 0))) {
      out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

// Un nœud de l'arbre se débloque quand son parent atteint le niveau requis.
export function talentUnlocked(state, talent) {
  return !talent.requires || (state.talents[talent.requires.id] ?? 0) >= talent.requires.level;
}

export function buyTalent(state, id) {
  const talent = talentById(id);
  if (!talent) return false;
  const level = state.talents[id] ?? 0;
  if (level >= talent.max || !talentUnlocked(state, talent)) return false;
  const cost = talentCost(talent, level);
  if (state.fragments < cost) return false;
  state.fragments -= cost;
  state.talents[id] = level + 1;
  return true;
}

export function canRebirth(state) {
  return state.maxStage >= REBIRTH.minStage;
}

export function rebirthReward(state) {
  if (!canRebirth(state)) return 0;
  const prestigeBonus = 1 + (PRESTIGE.fragmentBonusPct * (state.prestige?.count ?? 0)) / 100;
  return Math.floor(((state.maxStage - 1) / REBIRTH.divisor) ** REBIRTH.exponent * prestigeBonus);
}

// Réinitialise la campagne, l'or et les améliorations ; conserve tout le reste.
// Renvoie le nombre de fragments gagnés (0 si la Renaissance n'est pas possible).
export function performRebirth(state, keepPower = state.equippedPowers?.[0]) {
  const reward = rebirthReward(state);
  if (reward <= 0) return 0;
  // Un seul pouvoir ancestral conservé (celui choisi, sinon le premier actif).
  const kept = state.powers?.[keepPower] ? keepPower : Object.keys(state.powers ?? {})[0];
  state.powers = kept ? { [kept]: state.powers[kept] } : {};
  state.equippedPowers = kept ? [kept] : [];
  // Niveau du héros, compétences et niveau de l'équipe repartent de zéro.
  state.level = 1;
  state.xp = 0;
  state.skills = { quick: 1 };
  for (const c of Object.values(state.companions?.owned ?? {})) c.level = 1;
  state.fragments += reward;
  state.records.rebirths += 1;
  state.gold = 0;
  for (const key of Object.keys(state.upgrades)) state.upgrades[key] = 0;
  state.stage = 1;
  state.maxStage = 1;
  state.kills = 0;
  state.autoAdvance = true;
  return reward;
}
