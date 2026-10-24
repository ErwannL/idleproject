// État persistant de la partie (tout ce qui est sauvegardé) et validation au chargement.
import { BALANCE } from '../data/balance.js';
import { ITEM_BASES, SLOTS, STARTER_WEAPON, STAT_LABELS } from '../data/items.js';
import { makeItem, rarityById } from './loot.js';

export const SAVE_VERSION = 1;
export const SORT_OPTIONS = ['rarity', 'level', 'power', 'recent'];

export function createNewState(now = Date.now(), seed = Math.floor(Math.random() * 2 ** 32)) {
  const state = {
    version: SAVE_VERSION,
    createdAt: now,
    lastSaved: now,
    gold: 0,
    upgrades: { damage: 0, attackSpeed: 0, vitality: 0 },
    stage: 1,
    maxStage: 1,
    kills: 0,
    autoAdvance: true,
    equipment: { weapon: null, helmet: null, armor: null },
    inventory: [],
    nextItemId: 1,
    rngSeed: seed >>> 0,
    records: { goldEarned: 0, kills: 0, bossesDefeated: 0, itemsFound: 0 },
    ui: { slotFilter: 'all', sortBy: 'rarity' },
  };
  state.equipment.weapon = makeItem(state, STARTER_WEAPON, 'common', 1);
  return state;
}

export function isValidItem(item) {
  if (!item || typeof item !== 'object') return false;
  if (typeof item.id !== 'string' || !/^it\d+$/.test(item.id)) return false;
  if (!(item.slot in SLOTS) || !rarityById(item.rarity)) return false;
  const base = ITEM_BASES.find((b) => b.id === item.baseId);
  if (!base || base.slot !== item.slot) return false;
  if (!Number.isInteger(item.level) || item.level < 1) return false;
  if (!item.stats || typeof item.stats !== 'object') return false;
  return Object.entries(item.stats).every(([k, v]) => k in STAT_LABELS && Number.isFinite(v));
}

function cleanItem(item) {
  const base = ITEM_BASES.find((b) => b.id === item.baseId);
  return {
    id: item.id, baseId: item.baseId, name: base.name, slot: item.slot,
    rarity: item.rarity, level: item.level, stats: { ...item.stats }, effect: null,
  };
}

const int = (v, fallback, min = 0) => (Number.isInteger(v) && v >= min ? v : fallback);
const num = (v, fallback, min = 0) => (Number.isFinite(v) && v >= min ? v : fallback);

// Accepte n'importe quelle donnée lue sur disque et renvoie un état valide.
// Les champs absents ou corrompus reprennent leur valeur par défaut.
export function sanitizeState(raw, balance = BALANCE, now = Date.now()) {
  const state = createNewState(now);
  if (!raw || typeof raw !== 'object') return state;

  state.createdAt = num(raw.createdAt, now);
  state.lastSaved = num(raw.lastSaved, now);
  state.gold = Math.floor(num(raw.gold, 0));
  for (const key of Object.keys(state.upgrades)) state.upgrades[key] = int(raw.upgrades?.[key], 0);
  state.maxStage = int(raw.maxStage, 1, 1);
  state.stage = Math.min(int(raw.stage, 1, 1), state.maxStage);
  state.kills = Math.min(int(raw.kills, 0), balance.stages.killsPerStage);
  state.autoAdvance = typeof raw.autoAdvance === 'boolean' ? raw.autoAdvance : true;
  state.rngSeed = int(raw.rngSeed, state.rngSeed);

  if (raw.equipment && typeof raw.equipment === 'object') {
    for (const slot of Object.keys(SLOTS)) {
      const item = raw.equipment[slot];
      state.equipment[slot] = isValidItem(item) && item.slot === slot ? cleanItem(item) : null;
    }
  }
  const items = Array.isArray(raw.inventory) ? raw.inventory.filter(isValidItem) : [];
  state.inventory = items.slice(0, balance.loot.inventorySize).map(cleanItem);

  // Identifiants uniques : nextItemId doit dépasser tous les identifiants existants.
  const used = [...state.inventory, ...Object.values(state.equipment)]
    .filter(Boolean)
    .map((i) => Number.parseInt(i.id.slice(2), 10));
  state.nextItemId = Math.max(int(raw.nextItemId, 1, 1), ...used.map((n) => n + 1), 1);

  for (const key of Object.keys(state.records)) state.records[key] = int(raw.records?.[key], 0);
  if (raw.ui && typeof raw.ui === 'object') {
    if (raw.ui.slotFilter === 'all' || raw.ui.slotFilter in SLOTS) state.ui.slotFilter = raw.ui.slotFilter;
    if (SORT_OPTIONS.includes(raw.ui.sortBy)) state.ui.sortBy = raw.ui.sortBy;
  }
  return state;
}
