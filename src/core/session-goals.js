// v9.6.5 (9.5) : objectifs de session. À chaque ouverture du jeu, trois petits objectifs tirés de l'état actuel ;
// les trois remplis ouvrent un coffre (gemmes + éclats). (9.7) : paliers de puissance tous les 10 niveaux du héros.

export const SESSION_CHEST = { gems: 30, shards: 5 };

// Trois objectifs adaptés à la partie : étapes à gagner, monstres à vaincre, boss à battre.
export function newSessionGoals(state, now = Date.now()) {
  const r = state.records ?? {};
  const stage = state.maxStage ?? 1;
  return {
    at: now,
    claimed: false,
    goals: [
      { id: 'stages', label: 'Gagner 3 étapes', base: stage, target: 3 },
      { id: 'kills', label: 'Vaincre 150 monstres', base: r.kills ?? 0, target: 150 },
      { id: 'bosses', label: 'Battre 2 boss', base: r.bossesDefeated ?? 0, target: 2 },
    ],
  };
}

export function goalProgress(state, g) {
  const r = state.records ?? {};
  const now = g.id === 'stages' ? state.maxStage ?? 1 : g.id === 'kills' ? r.kills ?? 0 : r.bossesDefeated ?? 0;
  return Math.max(0, Math.min(g.target, now - g.base));
}

export function sessionDone(state) {
  const s = state.sessionGoals;
  return Boolean(s && !s.claimed && s.goals.every((g) => goalProgress(state, g) >= g.target));
}

// Ouvre le coffre si les trois objectifs sont remplis. Renvoie la récompense ou null.
export function claimSessionChest(state) {
  if (!sessionDone(state)) return null;
  state.sessionGoals.claimed = true;
  state.gems = (state.gems ?? 0) + SESSION_CHEST.gems;
  state.materials = state.materials ?? {};
  state.materials.shards = (state.materials.shards ?? 0) + SESSION_CHEST.shards;
  return { ...SESSION_CHEST };
}

// Palier de puissance : 1 tous les 10 niveaux du héros, +3 % de dégâts chacun.
export const TIER_EVERY = 10;
export const TIER_BONUS = 0.03;
export function powerTier(level) { return Math.floor(Math.max(0, level ?? 0) / TIER_EVERY); }
export function powerTierMult(level) { return 1 + TIER_BONUS * powerTier(level); }
