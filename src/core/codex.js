// Codex : suivi des découvertes et récompenses de collection.
import { COLLECTIONS } from '../data/codex.js';
import { BOSSES, ENEMIES } from '../data/enemies.js';
import { ITEM_BASES } from '../data/items.js';
import { COMPANIONS } from '../data/companions.js';
import { grantReward } from './rewards.js';

export function recordKill(state, type) {
  state.codex.kills[type] = (state.codex.kills[type] ?? 0) + 1;
}

export function recordItem(state, item) {
  state.codex.items[item.baseId] = 1;
}

// Progression de chaque collection : { found, total }.
export function collectionProgress(state, id) {
  const kills = Object.keys(state.codex.kills);
  switch (id) {
    case 'monsters': return { found: kills.filter((k) => ENEMIES[k]).length, total: Object.keys(ENEMIES).length };
    case 'bosses': return { found: kills.filter((k) => BOSSES[k]).length, total: Object.keys(BOSSES).length };
    case 'items': return { found: Object.keys(state.codex.items).length, total: ITEM_BASES.length };
    case 'companions': return { found: Object.keys(state.companions.owned).length, total: COMPANIONS.length };
    default: return { found: 0, total: 0 };
  }
}

// Palier suivant à récupérer (ou null), et nombre de paliers déjà récupérés.
export function collectionStatus(state, c) {
  const claimed = state.codex.claimed[c.id] ?? 0;
  const { found, total } = collectionProgress(state, c.id);
  const next = c.milestones[claimed] ?? null;
  return { found, total, claimed, next, ready: next !== null && found >= next };
}

export function claimCollection(state, id) {
  const c = COLLECTIONS.find((x) => x.id === id);
  if (!c || !collectionStatus(state, c).ready) return null;
  state.codex.claimed[id] = (state.codex.claimed[id] ?? 0) + 1;
  return grantReward(state, c.reward);
}

export function collectionsClaimable(state) {
  return COLLECTIONS.some((c) => collectionStatus(state, c).ready);
}

export function sanitizeCodex(raw) {
  const out = { kills: {}, items: {}, claimed: {} };
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw.kills ?? {})) if ((ENEMIES[k] || BOSSES[k]) && Number(v) > 0) out.kills[k] = Math.floor(Number(v));
  const bases = new Set(ITEM_BASES.map((b) => b.id));
  for (const k of Object.keys(raw.items ?? {})) if (bases.has(k)) out.items[k] = 1;
  for (const c of COLLECTIONS) {
    const n = Number(raw.claimed?.[c.id]);
    if (Number.isInteger(n) && n > 0) out.claimed[c.id] = Math.min(n, c.milestones.length);
  }
  return out;
}
