// Inventaire : ajout, équipement, recyclage, tri et comparaison.
import { BALANCE } from '../data/balance.js';
import { addGold } from './economy.js';
import { itemPower, rarityIndex, recycleValue } from './loot.js';
import { computeHeroStats, statsWithItem } from './stats.js';

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

// Retourne l'or gagné, ou 0 si l'objet n'est pas dans l'inventaire.
export function recycleItem(state, itemId, balance = BALANCE) {
  const index = state.inventory.findIndex((i) => i.id === itemId);
  if (index < 0) return 0;
  const [item] = state.inventory.splice(index, 1);
  return addGold(state, recycleValue(item, balance));
}

export function recycleMatching(state, predicate, balance = BALANCE) {
  let gold = 0;
  let count = 0;
  state.inventory = state.inventory.filter((item) => {
    if (!predicate(item)) return true;
    gold += addGold(state, recycleValue(item, balance));
    count += 1;
    return false;
  });
  return { gold, count };
}

const itemNumber = (item) => Number.parseInt(item.id.slice(2), 10) || 0;

const SORTERS = {
  rarity: (a, b) => rarityIndex(b.rarity) - rarityIndex(a.rarity) || itemPower(b) - itemPower(a),
  power: (a, b) => itemPower(b) - itemPower(a),
  recent: (a, b) => itemNumber(b) - itemNumber(a),
};

export function listInventory(state, { slot = 'all', sortBy = 'rarity' } = {}) {
  const items = state.inventory.filter((i) => slot === 'all' || i.slot === slot);
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
