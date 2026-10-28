// Codex : suivi des découvertes et récompenses de collection.
import { COLLECTIONS } from '../data/codex.js';
import { BOSSES, ENEMIES } from '../data/enemies.js';
import { ITEM_BASES, RARITIES, SIGNATURE_ITEMS } from '../data/items.js';
import { MUTATIONS } from './mutations.js';

// Modèles d'équipement de la collection : ordinaires et ancestraux (v9.0 : les ancestraux étaient comptés au
// ramassage mais effacés au chargement, et absents du total).
const COLLECTION_ITEMS = [...ITEM_BASES, ...SIGNATURE_ITEMS];
import { COMPANIONS } from '../data/companions.js';
import { grantReward } from './rewards.js';

export function recordKill(state, type, enemy = null) {
  state.codex.kills[type] = (state.codex.kills[type] ?? 0) + 1;
  // v9.0.5 : variantes pour l'Encyclopédie (élite, muté).
  if (enemy?.elite && ENEMIES[type]) state.codex.elite[type] = (state.codex.elite[type] ?? 0) + 1;
  if (enemy?.mutation) {
    state.codex.mutants[enemy.mutation] = (state.codex.mutants[enemy.mutation] ?? 0) + 1;
    if (ENEMIES[type]) state.codex.mutantOf[type] = 1;
  }
}

export function recordItem(state, item) {
  state.codex.items[item.baseId] = 1;
  if (item.rarity) state.codex.itemRar[`${item.baseId}:${item.rarity}`] = 1; // v9.0.5 : Encyclopédie (une entrée par rareté)
}

// Progression de chaque collection : { found, total }.
export function collectionProgress(state, id) {
  const kills = Object.keys(state.codex.kills);
  switch (id) {
    case 'monsters': return { found: kills.filter((k) => ENEMIES[k]).length, total: Object.keys(ENEMIES).length };
    case 'bosses': return { found: kills.filter((k) => BOSSES[k]).length, total: Object.keys(BOSSES).length };
    case 'items': return { found: COLLECTION_ITEMS.filter((b) => state.codex.items[b.id]).length, total: COLLECTION_ITEMS.length };
    case 'companions': return { found: Object.keys(state.companions.owned).length, total: COMPANIONS.length };
    default: return { found: 0, total: 0 };
  }
}

// v9.0 : ce qu'il reste à découvrir dans une collection : [{ id, name, kind }].
export function collectionMissing(state, id) {
  const kills = state.codex.kills;
  switch (id) {
    case 'monsters': return Object.entries(ENEMIES).filter(([k]) => !kills[k]).map(([k, e]) => ({ id: k, name: e.name, kind: 'enemy', sprite: e.sprite }));
    case 'bosses': return Object.entries(BOSSES).filter(([k]) => !kills[k]).map(([k, b]) => ({ id: k, name: b.name, kind: 'enemy', sprite: b.sprite ?? ENEMIES[b.base]?.sprite }));
    case 'items': return COLLECTION_ITEMS.filter((b) => !state.codex.items[b.id]).map((b) => ({ id: b.id, name: b.name, kind: 'item', slot: b.slot }));
    case 'companions': return COMPANIONS.filter((c) => !state.companions.owned[c.id]).map((c) => ({ id: c.id, name: c.name, kind: 'companion' }));
    default: return [];
  }
}

// Palier suivant à récupérer (ou null), et nombre de paliers déjà récupérés.
export function collectionStatus(state, c) {
  const claimed = state.codex.claimed[c.id] ?? 0;
  const { found, total } = collectionProgress(state, c.id);
  // Palier plafonné au nombre réel d'éléments (et jamais deux fois le même palier).
  const raw = c.milestones[claimed];
  const next = raw === undefined || (claimed > 0 && Math.min(c.milestones[claimed - 1], total) >= total) ? null : Math.min(raw, total);
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
  const out = emptyCodex();
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw.kills ?? {})) if ((ENEMIES[k] || BOSSES[k]) && Number(v) > 0) out.kills[k] = Math.floor(Number(v));
  const bases = new Set(COLLECTION_ITEMS.map((b) => b.id));
  for (const k of Object.keys(raw.items ?? {})) if (bases.has(k)) out.items[k] = 1;
  for (const c of COLLECTIONS) {
    const n = Number(raw.claimed?.[c.id]);
    if (Number.isInteger(n) && n > 0) out.claimed[c.id] = Math.min(n, c.milestones.length);
  }
  // v9.0.5 : Encyclopédie.
  for (const [k, v] of Object.entries(raw.elite ?? {})) if (ENEMIES[k] && Number(v) > 0) out.elite[k] = Math.floor(Number(v));
  for (const [k, v] of Object.entries(raw.mutants ?? {})) if (MUTATIONS.some((m) => m.id === k) && Number(v) > 0) out.mutants[k] = Math.floor(Number(v));
  for (const k of Object.keys(raw.mutantOf ?? {})) if (ENEMIES[k]) out.mutantOf[k] = 1;
  const rarities = new Set(RARITIES.map((r) => r.id));
  for (const k of Object.keys(raw.itemRar ?? {})) {
    const [base, rarity] = k.split(':');
    if (bases.has(base) && rarities.has(rarity)) out.itemRar[k] = 1;
  }
  const e = Number(raw.encClaimed);
  if (Number.isInteger(e) && e > 0) out.encClaimed = e;
  return out;
}

export function emptyCodex() {
  return { kills: {}, items: {}, claimed: {}, elite: {}, mutants: {}, mutantOf: {}, itemRar: {}, encClaimed: 0 };
}
