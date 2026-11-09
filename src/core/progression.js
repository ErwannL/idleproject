// v9.3.3 : progression individuelle des héros (alliés) et des familiers : doublons, niveaux de compétence, coûts.
// Le chevalier n'est jamais concerné (ses améliorations restent dans core/economy.js).
// Données d'équilibrage : data/progression.js.
import { COMPANION_RULES } from '../data/companions.js';
import { ACTIVE_EXTRA_AT, DUP_BONUS_PCT, GOLD_INDEX, SKILL_CAPS, SKILL_COSTS, SKILL_GROWTH, SKILL_VALUE_CAPS, ULT_UNLOCK_COPIES } from '../data/progression.js';

export const RESOURCE_KEYS = ['grimoire', 'ascension', 'mastery'];
export const SKILL_KINDS = ['passive', 'active', 'ultimate'];

const copies = (owned) => Math.max(1, Math.min(COMPANION_RULES.maxCopies, owned?.stars ?? 1));
// Bonus cumulé des doublons (×), calculé ici seulement.
export function dupMultiplier(owned) {
  return owned ? 1 + DUP_BONUS_PCT[copies(owned) - 1] / 100 : 1;
}
export const dupBonusPct = (owned) => (owned ? DUP_BONUS_PCT[copies(owned) - 1] : 0);

export function skillLevels(owned) {
  const s = owned?.skills ?? {};
  return { passive: s.passive ?? 1, active: s.active ?? 1, ultimate: s.ultimate ?? 1 };
}
export function skillCap(owned, kind) {
  if (kind !== 'ultimate') return SKILL_CAPS[kind];
  return copies(owned) >= ULT_UNLOCK_COPIES ? SKILL_CAPS.ultimate : SKILL_CAPS.ultimateBefore4;
}
// Multiplicateur de valeur d'une compétence à son niveau.
export const levelMult = (kind, level) => 1 + SKILL_GROWTH[kind].perLevel * (Math.max(1, level) - 1);
function milestone(table, level, base) {
  let v = base;
  for (const [at, x] of Object.entries(table ?? {})) if (level >= Number(at)) v = x;
  return v;
}

// Compétence d'une liste (data/companion-skills.js : [active, ancienne 2e, ancienne 3e, ultime]) modifiée par son niveau.
export function leveledSkill(skill, kind, level) {
  const g = SKILL_GROWTH[kind];
  const out = { ...skill, level, kind };
  if (['hit', 'burst', 'heal', 'rally'].includes(skill.type)) out.value = skill.value * levelMult(kind, level);
  if (skill.type === 'shield') out.value = skill.value + 2 * (level - 1); // bouclier : +2 points de réduction par niveau
  if (SKILL_VALUE_CAPS[skill.type] != null) out.value = Math.min(SKILL_VALUE_CAPS[skill.type], out.value);
  out.every = skill.every * milestone(g.cdAt, level, 1);
  if (skill.duration) out.duration = skill.duration + milestone(g.durationAt, level, 0);
  return out;
}

// Les compétences actives d'un perso en combat : l'active (et ses évolutions des niveaux 5 et 8) + l'ultime (dès le
// 1er exemplaire). Le passif agit par companionMultiplier (core/companions.js).
export function combatSkills(list, owned) {
  const lv = skillLevels(owned);
  const actives = list.filter((s) => !s.ultimate);
  const ult = list.find((s) => s.ultimate);
  const out = [];
  actives.forEach((s, i) => {
    if (i === 0 || lv.active >= ACTIVE_EXTRA_AT[i - 1]) out.push(leveledSkill(s, 'active', lv.active));
  });
  if (ult) out.push(leveledSkill(ult, 'ultimate', lv.ultimate));
  return out;
}

// ---- Coûts et amélioration ----
export function goldPerKill(state, killGold, refGold) {
  return Math.max(GOLD_INDEX.min, Math.min(killGold, refGold * GOLD_INDEX.cap));
}
export function skillUpgradeCost(owned, kind, killGold) {
  const lv = skillLevels(owned)[kind];
  if (lv >= skillCap(owned, kind)) return null;
  const c = SKILL_COSTS[kind][lv - 1];
  return { grimoire: c.grimoire ?? 0, ascension: c.ascension ?? 0, mastery: c.mastery ?? 0, gold: Math.ceil(c.kills * killGold) };
}
export function canAfford(state, cost) {
  if (!cost) return false;
  return state.gold >= cost.gold && RESOURCE_KEYS.every((k) => (state.materials[k] ?? 0) >= (cost[k] ?? 0));
}
export function upgradeSkill(state, id, kind, killGold) {
  const owned = state.companions.owned[id];
  if (!owned || !SKILL_KINDS.includes(kind)) return null;
  const cost = skillUpgradeCost(owned, kind, killGold);
  if (!canAfford(state, cost)) return null;
  state.gold -= cost.gold;
  for (const k of RESOURCE_KEYS) state.materials[k] -= cost[k];
  owned.skills = { ...skillLevels(owned), [kind]: skillLevels(owned)[kind] + 1 };
  return owned.skills[kind];
}

// Sauvegarde : niveaux bornés par les plafonds actuels.
export function cleanSkills(raw, owned) {
  const s = raw && typeof raw === 'object' ? raw : null;
  if (!s) return undefined;
  const n = (v) => (Number.isInteger(v) && v >= 1 ? v : 1);
  return Object.fromEntries(SKILL_KINDS.map((k) => [k, Math.min(n(s[k]), skillCap(owned, k))]));
}
// Migration 9.3.3 : un perso possédé avant la mise à jour gardait ses 3 compétences actives dès le 1er exemplaire ;
// l'active démarre donc au niveau 8 (ancienne 2e et 3e compétences gardées), passif et ultime au niveau 1.
export const MIGRATED_SKILLS = { passive: 2, active: ACTIVE_EXTRA_AT[1], ultimate: 2 }; // passif et ultime 2 : compensent l'écart entre l'ancien +5 %/doublon et le nouveau barème
