// Compagnons : bonus passifs (selon niveau, étoiles et talents) et compétence automatique.
import { BALANCE } from '../data/balance.js';
import { COMPANION_RULES, COMPANIONS } from '../data/companions.js';
import { referenceKillGold } from './combat.js';
import { talentEffects } from './rebirth.js';
import { DUNGEONS } from '../data/dungeons.js';
import { COMPANION_ROLES, SYNERGIES } from '../data/synergies.js';

export function companionById(id) {
  return COMPANIONS.find((c) => c.id === id);
}

export function companionMultiplier(state, id) {
  const owned = state.companions.owned[id];
  if (!owned) return 0;
  const bond = (talentEffects(state).companionPct ?? 0) / 100;
  return (1 + COMPANION_RULES.levelBonusPct * (owned.level - 1))
    * (1 + COMPANION_RULES.starBonusPct * (owned.stars - 1)) * (1 + bond);
}

export function equippedCompanions(state) {
  return state.companions.equipped.map(companionById).filter(Boolean);
}

// Héros adapté au donjon en cours (DUNGEONS[].ally) : il y écrase tout.
export function dungeonAffinity(state, id) {
  if (!state.dungeon) return false;
  return DUNGEONS.find((d) => d.id === state.dungeon.id)?.ally === id;
}

// Multiplicateur des dégâts subis : réduits quand le héros adapté au donjon fait partie de l'équipe.
export function dungeonDamageTaken(state, balance = BALANCE) {
  const ally = state.dungeon && DUNGEONS.find((d) => d.id === state.dungeon.id)?.ally;
  return ally && state.companions.equipped.includes(ally) ? 1 - balance.dungeonAffinity.damageTakenPct / 100 : 1;
}

// Rôles présents dans l'équipe (le chevalier compte comme Gardien).
export function teamRoles(state) {
  return ['guardian', ...equippedCompanions(state).map((c) => COMPANION_ROLES[c.id]).filter(Boolean)];
}

// Synergies actives : chaque rôle requis doit être couvert (un membre ne compte qu'une fois).
export function activeSynergies(state) {
  const roles = teamRoles(state);
  return SYNERGIES.filter((syn) => {
    const pool = [...roles];
    return syn.roles.every((r) => {
      const i = pool.indexOf(r);
      if (i < 0) return false;
      pool.splice(i, 1);
      return true;
    });
  });
}

export function companionEffects(state, balance = BALANCE) {
  const out = {};
  for (const syn of activeSynergies(state)) {
    for (const [k, v] of Object.entries(syn.effects)) out[k] = (out[k] ?? 0) + v;
  }
  for (const c of equippedCompanions(state)) {
    const home = dungeonAffinity(state, c.id);
    const m = companionMultiplier(state, c.id) * (home ? balance.dungeonAffinity.passiveMultiplier : 1);
    for (const [k, v] of Object.entries(c.passive)) out[k] = (out[k] ?? 0) + v * m;
    // Dans son donjon, le SSR galvanise toute l'équipe.
    if (home) out.damagePct = (out.damagePct ?? 0) + balance.dungeonAffinity.teamDamagePct;
  }
  return out;
}

export function companionUpgradeCost(state, id, balance = BALANCE) {
  const owned = state.companions.owned[id];
  if (!owned) return Infinity;
  return Math.floor(COMPANION_RULES.upgradeCostKills * referenceKillGold(state.maxStage, balance)
    * COMPANION_RULES.upgradeCostGrowth ** (owned.level - 1));
}

export function upgradeCompanion(state, id, balance = BALANCE) {
  const owned = state.companions.owned[id];
  if (!owned || owned.level >= COMPANION_RULES.maxLevel) return false;
  const cost = companionUpgradeCost(state, id, balance);
  if (state.gold < cost) return false;
  state.gold -= cost;
  owned.level += 1;
  return true;
}

// Catégorie d'équipe : 'ally' (personnage) ou 'pet' (compagnon).
export function teamKind(c) {
  return c?.kind === 'ally' ? 'ally' : 'pet';
}

export function equippedOfKind(state, kind) {
  return equippedCompanions(state).filter((c) => teamKind(c) === kind);
}

// Garde au plus `teamSlots[kind]` membres de chaque catégorie (ordre conservé).
export function clampTeam(equipped, balance = BALANCE) {
  const count = { ally: 0, pet: 0 };
  return equipped.filter((id) => {
    const kind = teamKind(companionById(id));
    if (!companionById(id) || count[kind] >= balance.teamSlots[kind]) return false;
    count[kind] += 1;
    return true;
  });
}

// Remplace un membre de l'équipe par un autre de la même catégorie (équipe pleine).
export function replaceCompanion(state, newId, oldId) {
  const c = companionById(newId);
  const old = companionById(oldId);
  if (!c || !old || !state.companions.owned[newId] || teamKind(c) !== teamKind(old)) return false;
  const index = state.companions.equipped.indexOf(oldId);
  if (index < 0 || state.companions.equipped.includes(newId)) return false;
  state.companions.equipped[index] = newId;
  return true;
}

// Équiper / retirer. Le compagnon (1 place) remplace l'ancien ; les personnages sont limités à 2.
export function toggleCompanion(state, id, balance = BALANCE) {
  const c = companionById(id);
  if (!c || !state.companions.owned[id]) return false;
  const index = state.companions.equipped.indexOf(id);
  if (index >= 0) {
    state.companions.equipped.splice(index, 1);
    return true;
  }
  const kind = teamKind(c);
  const same = state.companions.equipped.filter((x) => teamKind(companionById(x)) === kind);
  if (same.length >= balance.teamSlots[kind]) {
    if (kind !== 'pet') return false;
    state.companions.equipped = state.companions.equipped.filter((x) => !same.includes(x));
  }
  state.companions.equipped.push(id);
  return true;
}
