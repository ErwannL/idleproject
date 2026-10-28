// Inventaire : ajout, équipement, recyclage, tri et comparaison.
import { BALANCE } from '../data/balance.js';
import { ACCESSORY_SLOTS, SLOTS } from '../data/items.js';
import { addGold } from './economy.js';
import { trackContracts } from './contracts.js';
import { itemBase, itemPower, rarityIndex, recycleMaterials, recycleValue } from './loot.js';
import { computeHeroStats, statsWithItem } from './stats.js';
import { recordItem } from './codex.js';
import { usefulSetPiece } from './sets.js';
import { autoMannequin } from './stash.js';

// Inventaire plein : l'objet est recyclé en or plutôt que perdu.
export function addToInventory(state, item, balance = BALANCE) {
  state.records.itemsFound += 1;
  if (state.inventory.length >= balance.loot.inventorySize) {
    return { added: false, recycledGold: addGold(state, recycleValue(item, balance)) };
  }
  state.inventory.push(item);
  return { added: true, recycledGold: 0 };
}

export function equipItem(state, itemId) {
  const index = state.inventory.findIndex((i) => i.id === itemId);
  if (index < 0) return false;
  const item = state.inventory[index];
  const previous = state.equipment[item.slot];
  state.inventory.splice(index, 1);
  if (previous) state.inventory.splice(index, 0, previous);
  state.equipment[item.slot] = item;
  return true;
}

// Retourne l'or gagné, ou 0 si l'objet n'est pas dans l'inventaire ou s'il est verrouillé.
export function recycleItem(state, itemId, balance = BALANCE) {
  const index = state.inventory.findIndex((i) => i.id === itemId);
  if (index < 0 || state.inventory[index].locked) return 0;
  const [item] = state.inventory.splice(index, 1);
  return salvage(state, item, balance);
}

// Règle de collecte (Automatisation) : recycler dès le ramassage les objets jusqu'à une rareté donnée
// ('off', 'common' ou 'rare'). Jamais un objet signature ni un objet meilleur que l'équipement porté.
export const AUTO_RECYCLE_RULES = { off: 'Tout garder', common: 'Recycler les Communs', rare: 'Recycler Communs et Rares' };

// v7.7 : règles de recyclage automatique configurables.
// mode : 'off' | 'pickup' (dès le ramassage) | 'full' (seulement quand le sac est plein) ;
// rarities / slots : ce qui est recyclé. Jamais : objet équipé, verrouillé, ancestral, ou meilleur que l'équipé.
export const RECYCLE_MODES = { off: 'Désactivé', pickup: 'Au ramassage', full: 'Quand le sac est plein' };

export function recycleRules(state) {
  const r = state.ui?.recycle;
  if (r) return r;
  // Ancienne règle (v7.5) : Communs, ou Communs + Rares, au ramassage.
  const legacy = state.ui?.autoRecycle ?? 'off';
  if (legacy === 'off') return { mode: 'off', rarities: ['common'], slots: Object.keys(SLOTS) };
  return { mode: 'pickup', rarities: legacy === 'rare' ? ['common', 'rare'] : ['common'], slots: Object.keys(SLOTS) };
}

export function matchesRecycleRule(state, item, rules = recycleRules(state)) {
  if (item.locked || itemBase(item.baseId).signature) return false;
  if (usefulSetPiece(state, item, itemPower)) return false; // v8.5 : pièce d'un ensemble en cours de collecte
  if (!rules.rarities.includes(item.rarity) || !rules.slots.includes(item.slot)) return false;
  return !isUpgrade(state, item);
}

export function shouldAutoRecycle(state, item) {
  const rules = recycleRules(state);
  return rules.mode === 'pickup' && matchesRecycleRule(state, item, rules);
}

// Sac plein (mode « quand le sac est plein ») : recycle les objets du sac qui correspondent aux règles.
export function recycleForSpace(state, balance = BALANCE) {
  const rules = recycleRules(state);
  if (rules.mode !== 'full') return 0;
  let gold = 0;
  for (const item of [...state.inventory]) {
    if (!matchesRecycleRule(state, item, rules)) continue;
    state.inventory.splice(state.inventory.indexOf(item), 1);
    gold += salvage(state, item, balance);
  }
  return gold;
}

// Ramassage d'un objet : recyclé automatiquement selon la règle, sinon rangé dans le sac.
export function collectItem(state, item, balance = BALANCE) {
  trackContracts(state, 'items', 1);
  if (state.codex) recordItem(state, item);
  // v8.9 : pièce d'ensemble meilleure que celle de son mannequin → directement dessus (l'ancienne est recyclée).
  if (state.mannequins) {
    const replaced = autoMannequin(state, item);
    if (replaced !== false) {
      state.records.itemsFound += 1;
      return { added: false, mannequin: true, recycledGold: replaced ? salvage(state, replaced, balance) : 0 };
    }
  }
  if (shouldAutoRecycle(state, item)) {
    state.records.itemsFound += 1;
    return { added: false, auto: true, recycledGold: salvage(state, item, balance) };
  }
  if (state.inventory.length >= balance.loot.inventorySize) {
    const freed = recycleForSpace(state, balance);
    if (recycleRules(state).mode === 'full' && matchesRecycleRule(state, item) && state.inventory.length >= balance.loot.inventorySize) {
      state.records.itemsFound += 1;
      return { added: false, auto: true, recycledGold: freed + salvage(state, item, balance) };
    }
  }
  return addToInventory(state, item, balance);
}

// Recyclage : or + matériaux (éclats, essences) ; compte pour les contrats.
function salvage(state, item, balance) {
  const materials = recycleMaterials(item, balance);
  state.materials.shards += materials.shards;
  state.materials.essence += materials.essence;
  trackContracts(state, 'recycle', 1);
  return addGold(state, recycleValue(item, balance));
}

export function recycleMatching(state, predicate, balance = BALANCE) {
  let gold = 0;
  let count = 0;
  state.inventory = state.inventory.filter((item) => {
    if (item.locked || !predicate(item)) return true;
    gold += salvage(state, item, balance);
    count += 1;
    return false;
  });
  return { gold, count };
}

const itemNumber = (item) => Number.parseInt(item.id.slice(2), 10) || 0;

const SORTERS = {
  rarity: (a, b) => rarityIndex(b.rarity) - rarityIndex(a.rarity) || itemPower(b) - itemPower(a) || itemNumber(b) - itemNumber(a),
  level: (a, b) => b.level - a.level || rarityIndex(b.rarity) - rarityIndex(a.rarity),
  power: (a, b) => itemPower(b) - itemPower(a),
  recent: (a, b) => itemNumber(b) - itemNumber(a),
};

export function listInventory(state, { slot = 'all', sortBy = 'rarity' } = {}) {
  const items = state.inventory.filter((i) => slot === 'all' || i.slot === slot || (slot === 'accessory' && ACCESSORY_SLOTS.includes(i.slot)));
  return items.sort(SORTERS[sortBy] ?? SORTERS.rarity);
}

// Différence de statistiques si l'objet était équipé à la place de l'actuel.
export function compareWithEquipped(state, item, balance = BALANCE) {
  const current = computeHeroStats(state, balance);
  const next = statsWithItem(state, item, balance);
  return {
    damage: next.damage - current.damage,
    dps: next.dps - current.dps,
    maxHp: next.maxHp - current.maxHp,
    armor: next.armor - current.armor,
  };
}

// Amélioration par rapport à l'équipement porté (v8.0) : bilan global DPS × robustesse (PV / (1 − armure)).
// Avant, « un peu plus de PV » suffisait, même avec beaucoup moins d'armure : presque tout était protégé
// du recyclage. Les stats secondaires (or, XP, vol de vie, épines, régénération) départagent les égalités.
const ehp = (s) => s.maxHp / Math.max(0.05, 1 - s.armor / 100);
const extras = (s) => s.goldPct + s.xpPct + s.lifesteal + s.thorns + (s.regenPerSecond / s.maxHp) * 100
  + (s.bonus?.dropChance ?? 0) * 3 + (s.bonus?.damageVsBossPct ?? 0) + (s.bonus?.damageVsNormalPct ?? 0) * 0.5;
export function isUpgrade(state, item, balance = BALANCE, current = computeHeroStats(state, balance)) {
  if (!state.equipment[item.slot]) return true; // emplacement vide (accessoires en particulier)
  const next = statsWithItem(state, item, balance);
  const score = Math.log(next.dps / current.dps) + Math.log(ehp(next) / ehp(current));
  if (Math.abs(score) > 1e-4) return score > 0;
  return extras(next) > extras(current) + 1e-6;
}

// Mode « au ramassage » : le sac est aussi trié régulièrement (objets devenus inutiles après un meilleur équipement).
export function sweepInventory(state, balance = BALANCE) {
  const rules = recycleRules(state);
  if (rules.mode !== 'pickup') return { gold: 0, count: 0 };
  const current = computeHeroStats(state, balance);
  const doomed = new Set(state.inventory.filter((item) => !item.locked && !itemBase(item.baseId).signature
    && rules.rarities.includes(item.rarity) && rules.slots.includes(item.slot)
    && !usefulSetPiece(state, item, itemPower) && !isUpgrade(state, item, balance, current)).map((i) => i.id));
  return doomed.size ? recycleMatching(state, (i) => doomed.has(i.id), balance) : { gold: 0, count: 0 };
}

// Objets proposés au recyclage groupé : rareté au plus `maxRarity`.
// en excluant toujours les objets qui amélioreraient le héros.
// v7.7+ : toutes les raretés (avec confirmation) ; jamais un objet verrouillé, ancestral ou meilleur que l'équipé.
export const BULK_RECYCLE_MAX = ['common', 'rare', 'epic', 'legendary'];
export function bulkRecycleCandidates(state, maxRarity = 'common', balance = BALANCE) {
  const limit = rarityIndex(BULK_RECYCLE_MAX.includes(maxRarity) ? maxRarity : 'common');
  const current = computeHeroStats(state, balance);
  return state.inventory.filter((item) => !item.locked && !itemBase(item.baseId).signature
    && rarityIndex(item.rarity) <= limit && !usefulSetPiece(state, item, itemPower) && !isUpgrade(state, item, balance, current));
}

// Verrouiller un objet le protège de tout recyclage (simple ou groupé).
export function toggleLock(state, itemId) {
  const item = [...state.inventory, ...Object.values(state.equipment)].find((i) => i?.id === itemId);
  if (!item) return null;
  item.locked = !item.locked;
  return item.locked;
}
