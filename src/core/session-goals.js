// v9.6.5 (9.5) : objectifs de session. À chaque ouverture du jeu, trois petits objectifs tirés de l'état actuel ;
// les trois remplis ouvrent un coffre (gemmes + éclats). (9.7) : paliers de puissance tous les 10 niveaux du héros.

export const SESSION_CHEST = { gems: 30, shards: 5 };

// v9.7.1 (lot 4) : trois objectifs tirés d'une réserve variée — d'abord ce que le joueur n'a pas encore essayé
// (compteur à zéro), puis le reste ; jamais un geste dont le système n'est pas ouvert.
const val = (state, key) => (key === 'stages' ? state.maxStage ?? 1 : key === 'tower' ? state.towerBest ?? 0 : key === 'dungeons' ? Object.keys(state.dungeonsCleared ?? {}).length : state.records?.[key] ?? 0);
export const GOAL_POOL = [
  { key: 'stages', label: 'Gagner 3 étapes', target: 3 },
  { key: 'kills', label: 'Vaincre 150 monstres', target: 150 },
  { key: 'bossesDefeated', label: 'Battre 2 boss', target: 2 },
  { key: 'guards', label: 'Pare 3 coups lourds', target: 3, open: (s) => (s.records?.bossesDefeated ?? 0) >= 1 },
  { key: 'manualCasts', label: 'Lance 5 compétences à la main', target: 5 },
  { key: 'recycled', label: 'Recycle 5 objets', target: 5 },
  { key: 'equips', label: 'Équipe 2 objets', target: 2 },
  { key: 'summons', label: 'Invoque un compagnon', target: 1, open: (s) => Object.keys(s.companions?.owned ?? {}).length > 0 },
  { key: 'tower', label: 'Gagne un étage de la Tour', target: 1, open: (s) => (s.maxStage ?? 1) >= 60 },
  { key: 'dungeons', label: 'Vide un donjon', target: 1, open: (s) => (s.maxStage ?? 1) >= 25 },
];

export function newSessionGoals(state, now = Date.now()) {
  const pool = GOAL_POOL.filter((g) => !g.open || g.open(state));
  // Jamais essayé d'abord (ordre mélangé par la date), puis le reste.
  const seed = Math.floor(now / 3.6e6);
  const order = (g, i) => (val(state, g.key) === 0 || g.key === 'stages' ? 0 : 1) * 100 + ((i * 7 + seed) % 11);
  const picked = pool.map((g, i) => [g, order(g, i)]).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([g]) => g);
  return {
    at: now,
    claimed: false,
    goals: picked.map((g) => ({ id: g.key, key: g.key, label: g.label, base: val(state, g.key), target: g.target })),
  };
}

export function goalProgress(state, g) {
  return Math.max(0, Math.min(g.target, val(state, g.key ?? (g.id === 'bosses' ? 'bossesDefeated' : g.id)) - g.base));
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
