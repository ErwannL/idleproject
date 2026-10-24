// Donjons : salles successives, chemin de récompense modifiable à tout moment,
// objet final ciblé (emplacement choisi) et boss avec pouvoir ancestral.
import { BALANCE } from '../data/balance.js';
import { DUNGEON_PATHS, DUNGEON_REWARD, DUNGEONS } from '../data/dungeons.js';
import { SLOTS } from '../data/items.js';
import { referenceKillGold } from './combat.js';
import { addToInventory } from './inventory.js';
import { generateItem } from './loot.js';
import { grantReward } from './rewards.js';

export function dungeonById(id) {
  return DUNGEONS.find((d) => d.id === id);
}

export function canEnterDungeon(state, id) {
  const d = dungeonById(id);
  return Boolean(d) && !state.dungeon && state.keys >= 1 && state.maxStage >= d.unlockStage;
}

export function startDungeon(state, id, slot = 'any', path = 'gold') {
  if (!canEnterDungeon(state, id)) return false;
  const d = dungeonById(id);
  state.keys -= 1;
  state.dungeon = {
    id, room: 1, kills: 0, slot: slot in SLOTS ? slot : 'any', path: path in DUNGEON_PATHS ? path : 'gold',
    level: Math.max(1, state.maxStage + d.levelOffset), earned: {},
  };
  return true;
}

export function setDungeonPath(state, path) {
  if (!state.dungeon || !(path in DUNGEON_PATHS)) return false;
  state.dungeon.path = path;
  return true;
}

function addEarned(run, given) {
  for (const [k, v] of Object.entries(given)) run.earned[k] = (run.earned[k] ?? 0) + v;
}

// Ennemi ordinaire vaincu dans le donjon. Renvoie { roomCleared, reward } .
export function dungeonKill(state, balance = BALANCE) {
  const run = state.dungeon;
  const d = dungeonById(run.id);
  run.kills += 1;
  if (run.kills < d.killsPerRoom) return { roomCleared: false };
  const path = DUNGEON_PATHS[run.path];
  const reward = path.goldKills
    ? { gold: path.goldKills * referenceKillGold(run.level, balance) }
    : { shards: path.shards };
  const given = grantReward(state, reward);
  addEarned(run, given);
  run.room += 1;
  run.kills = 0;
  return { roomCleared: true, reward: given };
}

// Boss du donjon vaincu : récompense finale ciblée, fin de l'expédition.
export function completeDungeon(state, rng, balance = BALANCE) {
  const run = state.dungeon;
  const first = !state.dungeonsCleared[run.id];
  const slot = run.slot === 'any' ? undefined : run.slot;
  const item = generateItem(state, rng, { level: run.level, minRarity: DUNGEON_REWARD.minRarity, slot }, balance);
  const added = addToInventory(state, item, balance);
  const reward = { gems: DUNGEON_REWARD.gems, essence: DUNGEON_REWARD.essence, tickets: first ? DUNGEON_REWARD.firstClearTickets : 0 };
  const given = grantReward(state, reward);
  addEarned(run, given);
  state.dungeonsCleared[run.id] = (state.dungeonsCleared[run.id] ?? 0) + 1;
  state.dungeon = null;
  return { item, added: added.added, earned: run.earned };
}

// Défaite : l'expédition s'arrête, les récompenses des salles déjà gagnées sont conservées.
export function failDungeon(state) {
  const run = state.dungeon;
  state.dungeon = null;
  return run?.earned ?? {};
}

export function abandonDungeon(state) {
  return failDungeon(state);
}
