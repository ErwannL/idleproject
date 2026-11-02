// Encyclopédie (v9.0.5) : tout ce que l'on peut rencontrer ou obtenir, découvert au fil du jeu.
// Monstres (avec leurs variantes : normale, élite, mutée), boss, mutations, équipements (une entrée par modèle
// ET par rareté) et compagnons. Le pourcentage de complétion débloque des paliers de récompenses.
import { COMPANIONS } from '../data/companions.js';
import { BOSSES, ENEMIES } from '../data/enemies.js';
import { ITEM_BASES, RARITIES, SIGNATURE_ITEMS } from '../data/items.js';
import { MUTATIONS } from './mutations.js';
import { recordItem } from './codex.js';
import { grantReward } from './rewards.js';
import { mannequinItems } from './stash.js';
import { museumItems } from './museum.js';

// Les objets ancestraux tombent Épiques, parfois Légendaires : pas d'entrée Commune ni Rare pour eux.
export const SIGNATURE_RARITIES = ['epic', 'legendary'];
export const MONSTER_VARIANTS = [
  { id: 'normal', label: 'Normal' },
  { id: 'elite', label: 'Élite' },
  { id: 'mutant', label: 'Muté' },
];

// v9.1.3 (lot E) : le Codex est fondu dans l'encyclopédie. Ses paliers deviennent les paliers de section, comptés sur
// le compteur de la section (un seul nombre par section au lieu de deux). Seuils et récompenses identiques à ceux du
// Codex (paliers précoces gardés) ; comme la section compte au moins autant que l'ancienne collection (variantes,
// raretés), aucun palier n'arrive plus tard. Les paliers déjà réclamés (`codex.claimed`, même champ) restent acquis :
// pas de double récompense (core/migrations-v913.js migrateCodex). Critère d'abandon : docs/refontes-v913.md.
export const ENCYCLOPEDIA_SECTIONS = [
  { id: 'monsters', label: 'Monstres', icon: 'icon_skull', milestones: [5, 10, 20, 30, 41], reward: { gems: 25, shards: 20 } },
  { id: 'bosses', label: 'Boss', icon: 'icon_boss', milestones: [3, 6, 12, 24, 41], reward: { gems: 140 } },
  { id: 'mutations', label: 'Mutations', icon: 'icon_star' },
  { id: 'items', label: 'Équipements', icon: 'icon_bag', milestones: [10, 25, 40, 60, 78], reward: { gems: 30, essence: 2 } },
  { id: 'companions', label: 'Compagnons et familiers', icon: 'icon_paw', milestones: [3, 6, 10, 15, 26], reward: { gems: 150 } },
];

// Paliers de complétion (pourcentage de toutes les entrées, variantes comprises).
export const ENCYCLOPEDIA_MILESTONES = [
  { pct: 10, reward: { gems: 50, shards: 20 } },
  { pct: 25, reward: { gems: 320 } },
  { pct: 40, reward: { gems: 500, shards: 60 } },
  { pct: 60, reward: { gems: 750, essence: 5 } },
  { pct: 80, reward: { gems: 1200, essence: 10 } },
  { pct: 100, reward: { gems: 3000, essence: 25 } },
];

export function itemEntries() {
  return [
    ...ITEM_BASES.flatMap((b) => RARITIES.map((r) => ({ base: b, rarity: r.id }))),
    ...SIGNATURE_ITEMS.flatMap((b) => SIGNATURE_RARITIES.map((rarity) => ({ base: b, rarity }))),
  ];
}

export function variantFound(state, enemyId, variant) {
  const c = state.codex;
  if (variant === 'elite') return Boolean(c.elite[enemyId]);
  if (variant === 'mutant') return Boolean(c.mutantOf[enemyId]);
  return Boolean(c.kills[enemyId]);
}

// Progression d'une section : { found, total } (les monstres comptent chacune de leurs variantes).
export function sectionProgress(state, id) {
  const c = state.codex;
  switch (id) {
    case 'monsters': {
      const ids = Object.keys(ENEMIES);
      const found = ids.reduce((n, k) => n + MONSTER_VARIANTS.filter((v) => variantFound(state, k, v.id)).length, 0);
      return { found, total: ids.length * MONSTER_VARIANTS.length };
    }
    case 'bosses': return { found: Object.keys(BOSSES).filter((k) => c.kills[k]).length, total: Object.keys(BOSSES).length };
    case 'mutations': return { found: MUTATIONS.filter((m) => c.mutants[m.id]).length, total: MUTATIONS.length };
    case 'items': {
      const list = itemEntries();
      return { found: list.filter((e) => c.itemRar[`${e.base.id}:${e.rarity}`]).length, total: list.length };
    }
    case 'companions': return { found: COMPANIONS.filter((x) => state.companions.owned[x.id]).length, total: COMPANIONS.length };
    default: return { found: 0, total: 0 };
  }
}

export function encyclopediaProgress(state) {
  const sections = ENCYCLOPEDIA_SECTIONS.map((s) => ({ ...s, ...sectionProgress(state, s.id) }));
  const found = sections.reduce((n, s) => n + s.found, 0);
  const total = sections.reduce((n, s) => n + s.total, 0);
  return { sections, found, total, pct: total ? (found / total) * 100 : 0 };
}

// v9.1.3 : palier de section (ancien Codex) : { found, total, claimed, next, ready } ; next = null quand tout est pris.
export function sectionStatus(state, id) {
  const sec = ENCYCLOPEDIA_SECTIONS.find((s) => s.id === id);
  const { found, total } = sectionProgress(state, id);
  const claimed = state.codex.claimed?.[id] ?? 0;
  const ms = sec?.milestones ?? [];
  const raw = ms[claimed];
  const next = raw === undefined || (claimed > 0 && Math.min(ms[claimed - 1], total) >= total) ? null : Math.min(raw, total);
  return { found, total, claimed, next, ready: next !== null && found >= next, reward: sec?.reward ?? {} };
}

export function claimSection(state, id) {
  const st = sectionStatus(state, id);
  if (!st.ready) return null;
  state.codex.claimed[id] = st.claimed + 1;
  return grantReward(state, st.reward);
}

export const SECTIONS_WITH_MILESTONES = ENCYCLOPEDIA_SECTIONS.filter((s) => s.milestones);

// Prochain palier : { index, pct, reward, ready } ou null quand tout est récupéré.
export function encyclopediaNext(state) {
  const i = state.codex.encClaimed ?? 0;
  const m = ENCYCLOPEDIA_MILESTONES[i];
  if (!m) return null;
  const { pct } = encyclopediaProgress(state);
  return { index: i, ...m, ready: pct >= m.pct - 1e-9 };
}

export function claimEncyclopedia(state) {
  const next = encyclopediaNext(state);
  if (!next?.ready) return null;
  state.codex.encClaimed = next.index + 1;
  return grantReward(state, next.reward);
}

// Au chargement : les objets déjà possédés (sac, coffre, équipement, mannequins, Musée, boîte) sont découverts.
export function seedEncyclopedia(state) {
  if (!state.codex) return;
  const owned = [...state.inventory, ...(state.stash ?? []), ...Object.values(state.equipment ?? {}),
    ...(state.inbox ?? []).map((e) => e.item), ...mannequinItems(state), ...museumItems(state)];
  for (const item of owned) if (item?.baseId && item.rarity) recordItem(state, item);
}
