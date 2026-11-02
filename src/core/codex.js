// Codex : suivi des découvertes (kills, objets, variantes). v9.1.3 (lot E) : les collections et leurs paliers sont
// fondus dans l'encyclopédie (core/encyclopedia.js sectionStatus) ; `claimed` garde les paliers de section réclamés.
import { BOSSES, ENEMIES } from '../data/enemies.js';
import { ITEM_BASES, RARITIES, SIGNATURE_ITEMS } from '../data/items.js';
import { MUTATIONS } from './mutations.js';

// Modèles d'équipement de la collection : ordinaires et ancestraux (v9.0 : les ancestraux étaient comptés au
// ramassage mais effacés au chargement, et absents du total).
const COLLECTION_ITEMS = [...ITEM_BASES, ...SIGNATURE_ITEMS];

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

export function sanitizeCodex(raw) {
  const out = emptyCodex();
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw.kills ?? {})) if ((ENEMIES[k] || BOSSES[k]) && Number(v) > 0) out.kills[k] = Math.floor(Number(v));
  const bases = new Set(COLLECTION_ITEMS.map((b) => b.id));
  for (const k of Object.keys(raw.items ?? {})) if (bases.has(k)) out.items[k] = 1;
  for (const id of ['monsters', 'bosses', 'items', 'companions']) { // v9.1.3 : bornés par migrateCodex
    const n = Number(raw.claimed?.[id]);
    if (Number.isInteger(n) && n > 0) out.claimed[id] = n;
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
