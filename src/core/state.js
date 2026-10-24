// État persistant de la partie (tout ce qui est sauvegardé) et validation au chargement.
import { BALANCE } from '../data/balance.js';
import { ITEM_BASES, SLOTS, STARTER_WEAPON, STAT_LABELS } from '../data/items.js';
import { BOSSES } from '../data/enemies.js';
import { BOSS_POWERS } from '../data/powers.js';
import { TALENTS } from '../data/rebirth.js';
import { makeItem, rarityById } from './loot.js';
import { bossFirstStage, powerSlots, rollPower } from './powers.js';
import { Rng } from './rng.js';

// v1 : prototype · v2 (format identique) · v3 : pouvoirs ancestraux, Renaissance, verrouillage d'objets.
export const SAVE_VERSION = 3;
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
    records: { goldEarned: 0, kills: 0, bossesDefeated: 0, itemsFound: 0, rebirths: 0 },
    ui: { slotFilter: 'all', sortBy: 'rarity' },
    // Progression permanente (conservée par la Renaissance).
    powers: {}, // bossId -> { current, pending, victories, rerolls, sinceHigh }
    equippedPowers: [], // bossIds dont le pouvoir est actif
    fragments: 0,
    talents: {}, // talentId -> niveau
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
    locked: item.locked === true,
  };
}

const powerIds = (bossId) => new Set(BOSS_POWERS[bossId].map((p) => p.id));

function cleanPowers(state, raw) {
  if (raw.powers && typeof raw.powers === 'object') {
    for (const bossId of Object.keys(BOSSES)) {
      const entry = raw.powers[bossId];
      if (!entry || !powerIds(bossId).has(entry.current)) continue;
      state.powers[bossId] = {
        current: entry.current,
        pending: powerIds(bossId).has(entry.pending) && entry.pending !== entry.current ? entry.pending : null,
        victories: int(entry.victories, 1, 1),
        rerolls: int(entry.rerolls, 0),
        sinceHigh: int(entry.sinceHigh, 0),
      };
    }
  } else {
    // Sauvegarde v1/v2 : les boss déjà battus (étape dépassée) donnent leur pouvoir, de façon déterministe.
    const rng = new Rng(state.rngSeed ^ 0x2545f491);
    for (const bossId of Object.keys(BOSSES)) {
      if (bossFirstStage(bossId) < state.maxStage) {
        state.powers[bossId] = { current: rollPower(bossId, rng), pending: null, victories: 1, rerolls: 0, sinceHigh: 0 };
      }
    }
  }
  const wanted = Array.isArray(raw.equippedPowers) ? raw.equippedPowers : Object.keys(state.powers);
  state.equippedPowers = [...new Set(wanted)].filter((id) => state.powers[id]).slice(0, powerSlots(state));
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
  state.fragments = int(raw.fragments, 0);
  for (const talent of TALENTS) {
    const level = int(raw.talents?.[talent.id], 0);
    if (level > 0) state.talents[talent.id] = Math.min(level, talent.max);
  }
  cleanPowers(state, raw);
  if (raw.ui && typeof raw.ui === 'object') {
    if (raw.ui.slotFilter === 'all' || raw.ui.slotFilter in SLOTS) state.ui.slotFilter = raw.ui.slotFilter;
    if (SORT_OPTIONS.includes(raw.ui.sortBy)) state.ui.sortBy = raw.ui.sortBy;
  }
  return state;
}
