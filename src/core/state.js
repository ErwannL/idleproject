// État persistant de la partie (tout ce qui est sauvegardé) et validation au chargement.
import { BALANCE } from '../data/balance.js';
import { AFFIXES, SLOTS, STARTER_WEAPON, STAT_LABELS } from '../data/items.js';
import { BOSSES } from '../data/enemies.js';
import { COMPANIONS } from '../data/companions.js';
import { CONTRACT_TYPES } from '../data/contracts.js';
import { DUNGEON_PATHS, DUNGEONS, STARTING_KEYS } from '../data/dungeons.js';
import { HEROES, STARTER_HERO } from '../data/heroes.js';
import { BOSS_POWERS, POWER_RULES } from '../data/powers.js';
import { TALENTS } from '../data/rebirth.js';
import { SKILLS } from '../data/skills.js';
import { ensureContracts } from './contracts.js';
import { emptyMissions, sanitizeMissions } from './missions.js';
import { itemBase, makeItem, rarityById } from './loot.js';
import { bossDungeon, bossFirstStage, powerSlots, rollPower } from './powers.js';
import { Rng } from './rng.js';

// v1 : prototype · v2 (format identique) · v3 : pouvoirs, Renaissance, verrou
// v4 : niveau, compétences, héros, compagnons, invocation, contrats, événements, matériaux, donjons.
export const SAVE_VERSION = 4;
export const SORT_OPTIONS = ['rarity', 'level', 'power', 'recent'];

export function createNewState(now = Date.now(), seed = Math.floor(Math.random() * 2 ** 32)) {
  const state = {
    version: SAVE_VERSION,
    createdAt: now,
    lastSaved: now,
    gold: 0,
    upgrades: Object.fromEntries(Object.keys(BALANCE.upgrades).map((k) => [k, 0])),
    stage: 1,
    maxStage: 1,
    kills: 0,
    autoAdvance: true,
    equipment: Object.fromEntries(Object.keys(SLOTS).map((slot) => [slot, null])),
    inventory: [],
    nextItemId: 1,
    rngSeed: seed >>> 0,
    records: {
      goldEarned: 0, kills: 0, bossesDefeated: 0, itemsFound: 0, rebirths: 0, contractsDone: 0, summons: 0,
    },
    ui: { slotFilter: 'all', sortBy: 'rarity', autoRecycle: 'off' },
    // Progression permanente (conservée par la Renaissance).
    level: 1,
    xp: 0,
    skills: { quick: 1 }, // points dépensés par compétence
    skillAuto: true,
    powers: {}, // bossId -> { current, pending, victories, rerolls, sinceHigh, charges, masteryClaimed }
    equippedPowers: [],
    fragments: 0,
    talents: {},
    heroes: { active: STARTER_HERO, owned: { [STARTER_HERO]: { stars: 1 } } },
    companions: { owned: {}, equipped: [] },
    gems: 0,
    tickets: BALANCE.summon.startingTickets,
    keys: STARTING_KEYS,
    materials: { shards: 0, essence: 0 },
    summon: { total: 0, sinceEpic: 0, sinceLegendary: 0 },
    contracts: [],
    nextContractId: 0,
    inbox: [],
    nextEventId: 0,
    dungeon: null,
    dungeonsCleared: {},
    missions: emptyMissions(),
    playSeconds: 0, // temps de jeu cumulé (boost des premières heures)
  };
  state.equipment.weapon = makeItem(state, STARTER_WEAPON, 'common', 1);
  ensureContracts(state, new Rng(state.rngSeed ^ 0x51ed27));
  return state;
}

export function isValidItem(item) {
  if (!item || typeof item !== 'object') return false;
  if (typeof item.id !== 'string' || !/^it\d+$/.test(item.id)) return false;
  if (!(item.slot in SLOTS) || !rarityById(item.rarity)) return false;
  const base = itemBase(item.baseId);
  if (!base || base.slot !== item.slot) return false;
  if (!Number.isInteger(item.level) || item.level < 1) return false;
  if (!item.stats || typeof item.stats !== 'object') return false;
  return Object.entries(item.stats).every(([k, v]) => k in STAT_LABELS && Number.isFinite(v));
}

function cleanItem(item) {
  const base = itemBase(item.baseId);
  const affixes = Array.isArray(item.affixes)
    ? item.affixes.filter((a) => a && a.type in AFFIXES && Number.isFinite(a.value)).map((a) => ({ type: a.type, value: a.value }))
    : [];
  const boosts = {};
  for (const [k, v] of Object.entries(obj(item.boosts))) if (Number.isInteger(v) && v > 0) boosts[k] = v;
  return {
    id: item.id, baseId: item.baseId, name: base.name, slot: item.slot,
    rarity: item.rarity, level: item.level, stats: { ...item.stats }, affixes, effect: null,
    locked: item.locked === true, upgrades: int(item.upgrades, 0), boosts,
  };
}

const int = (v, fallback, min = 0) => (Number.isInteger(v) && v >= min ? v : fallback);
const num = (v, fallback, min = 0) => (Number.isFinite(v) && v >= min ? v : fallback);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const powerIds = (bossId) => new Set(BOSS_POWERS[bossId].map((p) => p.id));

function cleanPowers(state, raw) {
  if (raw.powers && typeof raw.powers === 'object') {
    const beforeV4 = int(raw.version, 1) < 4;
    for (const bossId of Object.keys(BOSSES)) {
      const entry = raw.powers[bossId];
      if (!entry || !powerIds(bossId).has(entry.current)) continue;
      state.powers[bossId] = {
        current: entry.current,
        pending: powerIds(bossId).has(entry.pending) && entry.pending !== entry.current ? entry.pending : null,
        victories: int(entry.victories, 1, 1),
        rerolls: int(entry.rerolls, 0),
        sinceHigh: int(entry.sinceHigh, 0),
        // v3 → v4 : une charge offerte pour ne pas bloquer les relances déjà possibles.
        charges: Math.min(POWER_RULES.maxCharges, int(entry.charges, beforeV4 ? 1 : 0)),
        masteryClaimed: int(entry.masteryClaimed, 0),
      };
    }
  } else {
    // Sauvegarde v1/v2 : les boss de campagne déjà battus (étape dépassée) donnent leur pouvoir.
    const rng = new Rng(state.rngSeed ^ 0x2545f491);
    for (const bossId of Object.keys(BOSSES)) {
      const stage = bossFirstStage(bossId);
      if (stage !== null && stage < state.maxStage && !bossDungeon(bossId)) {
        state.powers[bossId] = {
          current: rollPower(bossId, rng), pending: null, victories: 1, rerolls: 0, sinceHigh: 0, charges: 1, masteryClaimed: 0,
        };
      }
    }
  }
  const wanted = Array.isArray(raw.equippedPowers) ? raw.equippedPowers : Object.keys(state.powers);
  state.equippedPowers = [...new Set(wanted)].filter((id) => state.powers[id]).slice(0, powerSlots(state));
}

function cleanCollections(state, raw) {
  const heroes = obj(raw.heroes);
  for (const hero of HEROES) {
    const stars = int(obj(heroes.owned)[hero.id]?.stars, 0, 1);
    if (stars) state.heroes.owned[hero.id] = { stars: Math.min(stars, BALANCE.summon.maxStars) };
  }
  if (state.heroes.owned[heroes.active]) state.heroes.active = heroes.active;

  const companions = obj(raw.companions);
  for (const c of COMPANIONS) {
    const owned = obj(companions.owned)[c.id];
    if (!owned) continue;
    state.companions.owned[c.id] = {
      stars: Math.min(int(owned.stars, 1, 1), BALANCE.summon.maxStars),
      level: Math.min(int(owned.level, 1, 1), 20),
    };
  }
  const equipped = Array.isArray(companions.equipped) ? companions.equipped : [];
  state.companions.equipped = [...new Set(equipped)].filter((id) => state.companions.owned[id]).slice(0, BALANCE.companionSlots);

  const summon = obj(raw.summon);
  state.summon = { total: int(summon.total, 0), sinceEpic: int(summon.sinceEpic, 0), sinceLegendary: int(summon.sinceLegendary, 0) };
}

function cleanActivities(state, raw) {
  if (Array.isArray(raw.contracts)) {
    state.contracts = raw.contracts
      .filter((c) => c && c.type in CONTRACT_TYPES && int(c.target, 0, 1) && Number.isInteger(c.id))
      .slice(0, 3)
      .map((c) => ({ id: c.id, type: c.type, target: c.target, progress: Math.min(int(c.progress, 0), c.target), reward: { ...obj(c.reward) } }));
  }
  state.nextContractId = Math.max(int(raw.nextContractId, 0), ...state.contracts.map((c) => c.id));
  ensureContracts(state, new Rng(state.rngSeed ^ state.nextContractId));

  state.missions = sanitizeMissions(raw.missions);
  state.playSeconds = Math.max(0, Number(raw.playSeconds) || 0);

  state.nextEventId = int(raw.nextEventId, 0);
  if (Array.isArray(raw.inbox)) {
    state.inbox = raw.inbox
      .filter((e) => e && Number.isInteger(e.id) && ['chest', 'merchant', 'gems'].includes(e.type))
      .filter((e) => !e.item || isValidItem(e.item))
      .slice(0, BALANCE.events.inboxSize)
      .map((e) => ({ ...e, item: e.item ? cleanItem(e.item) : undefined, reward: obj(e.reward), price: num(e.price, 0) }));
  }

  const run = raw.dungeon;
  if (run && DUNGEONS.some((d) => d.id === run.id) && run.path in DUNGEON_PATHS) {
    state.dungeon = {
      id: run.id, room: int(run.room, 1, 1), kills: int(run.kills, 0), slot: run.slot in SLOTS ? run.slot : 'any',
      path: run.path, level: int(run.level, 1, 1), earned: { ...obj(run.earned) },
    };
  }
  for (const d of DUNGEONS) {
    const n = int(obj(raw.dungeonsCleared)[d.id], 0);
    if (n) state.dungeonsCleared[d.id] = n;
  }
}

// Accepte n'importe quelle donnée lue sur disque et renvoie un état valide.
// Les champs absents ou corrompus reprennent leur valeur par défaut.
export function sanitizeState(raw, balance = BALANCE, now = Date.now()) {
  const state = createNewState(now);
  if (!raw || typeof raw !== 'object') return state;

  state.createdAt = num(raw.createdAt, now);
  state.lastSaved = num(raw.lastSaved, now);
  state.gold = Math.floor(num(raw.gold, 0));
  for (const key of Object.keys(state.upgrades)) {
    state.upgrades[key] = Math.min(int(raw.upgrades?.[key], 0), balance.upgrades[key].maxLevel ?? Infinity);
  }
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

  for (const key of Object.keys(state.records)) state.records[key] = int(raw.records?.[key], 0);
  state.fragments = int(raw.fragments, 0);
  for (const talent of TALENTS) {
    const level = int(raw.talents?.[talent.id], 0);
    if (level > 0) state.talents[talent.id] = Math.min(level, talent.max);
  }
  // v7.4 : l'arbre part du Cœur du chevalier ; une partie qui avait déjà des talents le reçoit au niveau 1.
  if (Object.keys(state.talents).length && !state.talents.core) state.talents.core = 1;

  state.level = Math.min(int(raw.level, 1, 1), balance.level.maxLevel);
  state.xp = num(raw.xp, 0);
  if (raw.skills && typeof raw.skills === 'object') {
    state.skills = {};
    for (const skill of SKILLS) {
      const level = Math.min(int(raw.skills[skill.id], 0), skill.maxLevel);
      if (level > 0) state.skills[skill.id] = level;
    }
    // Plus de points dépensés que disponibles (sauvegarde modifiée) : on repart de zéro.
    if (Object.values(state.skills).reduce((s, v) => s + v, 0) > state.level) state.skills = { quick: 1 };
  }
  state.skillAuto = raw.skillAuto !== false;
  for (const key of ['gems', 'tickets', 'keys']) state[key] = int(raw[key], state[key]);
  const materials = obj(raw.materials);
  state.materials = { shards: int(materials.shards, 0), essence: int(materials.essence, 0) };

  cleanPowers(state, raw);
  cleanCollections(state, raw);
  cleanActivities(state, raw);

  // Identifiants uniques : nextItemId dépasse tous les identifiants existants (sac, équipement, boîte).
  const used = [...state.inventory, ...Object.values(state.equipment), ...state.inbox.map((e) => e.item)]
    .filter(Boolean)
    .map((i) => Number.parseInt(i.id.slice(2), 10));
  state.nextItemId = Math.max(int(raw.nextItemId, 1, 1), ...used.map((n) => n + 1), 1);

  if (raw.ui && typeof raw.ui === 'object') {
    if (raw.ui.slotFilter === 'all' || raw.ui.slotFilter === 'accessory' || raw.ui.slotFilter in SLOTS) state.ui.slotFilter = raw.ui.slotFilter;
    if (['off', 'common', 'rare'].includes(raw.ui.autoRecycle)) state.ui.autoRecycle = raw.ui.autoRecycle;
    if (SORT_OPTIONS.includes(raw.ui.sortBy)) state.ui.sortBy = raw.ui.sortBy;
  }
  return state;
}
