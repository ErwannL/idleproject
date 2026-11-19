// Donjons : salles successives, chemin de récompense modifiable à tout moment,
// objet final ciblé (emplacement choisi) et boss avec pouvoir ancestral.
import { BALANCE } from '../data/balance.js';
import { DIFFICULTY_ORDER, DUNGEON_DIFFICULTIES, DUNGEON_PATHS, DUNGEON_REWARD, DUNGEONS } from '../data/dungeons.js';
import { SLOTS } from '../data/items.js';
import { levelForStage, referenceKillGold } from './combat.js'; // v9.2.0 (monde marin) : niveau des étapes
import { addToInventory } from './inventory.js';
import { generateItem } from './loot.js';
import { grantReward } from './rewards.js';
import { RESOURCE_SOURCES } from '../data/progression.js'; // v9.3.3
import { trackMissions } from './missions.js';
import { rollGear } from './companion-gear.js';
import { GEAR_SOURCES } from '../data/companion-gear.js';
import { FIRST_CLEAR_CHEST, doorKills, doorReward, mainGain, nightmareMult, nightmareOpen } from './dungeon-plus.js'; // v10.1 (P3)

export function dungeonById(id) {
  return DUNGEONS.find((d) => d.id === id);
}

export function canEnterDungeon(state, id) {
  const d = dungeonById(id);
  return Boolean(d) && !state.dungeon && !state.tower && !state.challenge && state.keys >= 1 && state.maxStage >= d.unlockStage;
}

// Difficultés débloquées pour un donjon : Facile, puis Normal (1 victoire en Facile), puis Difficile.
export function unlockedDifficulties(state, id) {
  const best = state.dungeonBest?.[id] ?? -1;
  return DIFFICULTY_ORDER.filter((_, i) => i <= best + 1);
}

// v9.6.2 (7.2) : itinéraire choisi avant d'entrer (pendant le donjon, rien à faire).
import { grantSeal } from './seals.js'; // v9.6.2
export const DUNGEON_ROUTES = {
  normal: { label: 'Normal', text: 'Le donjon tel quel.', rooms: 0, hp: 1, reward: 1 },
  short: { label: 'Court et dur', text: '2 salles de moins, monstres +60 % de PV.', rooms: -2, hp: 1.6, reward: 1 },
  long: { label: 'Long et sûr', text: '2 salles de plus, monstres −25 % de PV, butin ×1,2.', rooms: 2, hp: 0.75, reward: 1.2 },
  treasure: { label: 'Trésor gardé', text: 'Monstres +50 % de PV (Élites), butin ×1,6.', rooms: 0, hp: 1.5, reward: 1.6 },
};
export function dungeonRooms(state, d) { return Math.max(2, d.rooms + (DUNGEON_ROUTES[state.dungeon?.route]?.rooms ?? 0)); }
const routeOf = (run) => DUNGEON_ROUTES[run?.route] ?? DUNGEON_ROUTES.normal;
export const routeHp = (state) => routeOf(state.dungeon).hp * nightmareMult(state.dungeon?.nightmare ?? 0) * (state.dungeon?.door === 'elite' ? 1.5 : 1); // v10.1 : Cauchemar, porte Élite
const scaleReward = (r, k) => (k === 1 ? r : Object.fromEntries(Object.entries(r).map(([key, v]) => [key, typeof v === 'number' ? v * k : v])));

export function startDungeon(state, id, slot = 'any', path = 'gold', difficulty = 'easy', route = 'normal', nightmare = 0) {
  if (!canEnterDungeon(state, id) || !unlockedDifficulties(state, id).includes(difficulty)) return false;
  const nm = Number.isInteger(nightmare) && nightmare > 0 && difficulty === 'hard' ? Math.min(nightmare, nightmareOpen(state, id)) : 0;
  const d = dungeonById(id);
  const diff = DUNGEON_DIFFICULTIES[difficulty];
  state.keys -= 1;
  state.dungeon = {
    id, room: 1, kills: 0, slot: slot in SLOTS ? slot : 'any', path: path in DUNGEON_PATHS ? path : 'gold', difficulty,
    level: Math.max(1, levelForStage(state.maxStage) + d.levelOffset + diff.levelBonus), earned: {},
    startPlay: state.playSeconds ?? 0, route: route in DUNGEON_ROUTES ? route : 'normal', nightmare: nm,
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
  if (run.kills < doorKills(run, d.killsPerRoom)) return { roomCleared: false };
  const path = DUNGEON_PATHS[run.path];
  const reward = path.goldKills
    ? { gold: path.goldKills * referenceKillGold(run.level, balance) }
    : { shards: path.shards };
  Object.assign(reward, RESOURCE_SOURCES.dungeonRoom); // v9.3.3 : grimoires de combat
  const given = grantReward(state, scaleReward(reward, routeOf(run).reward * doorReward(run) * nightmareMult(run.nightmare ?? 0))); // v9.6.2 : itinéraire ; v10.1 : porte, Cauchemar
  addEarned(run, given);
  run.room += 1;
  run.kills = 0;
  run.door = null;
  run.roomGold = reward.gold ?? 0;
  return { roomCleared: true, reward: given };
}

// Boss du donjon vaincu : récompense finale ciblée, fin de l'expédition.
export function completeDungeon(state, rng, balance = BALANCE) {
  const run = state.dungeon;
  const first = !state.dungeonsCleared[run.id];
  const slot = run.slot === 'any' ? undefined : run.slot;
  const item = generateItem(state, rng, { level: run.level, minRarity: DUNGEON_REWARD.minRarity, slot, setZone: dungeonById(run.id).zone }, balance);
  const added = addToInventory(state, item, balance);
  const diff = DUNGEON_DIFFICULTIES[run.difficulty] ?? DUNGEON_DIFFICULTIES.easy;
  // Fragments anciens (arbre de talents) : la récompense phare des donjons, plus la difficulté est haute.
  const reward = {
    gems: DUNGEON_REWARD.gems * diff.gems + (first ? DUNGEON_REWARD.firstClearGems : 0), shards: DUNGEON_REWARD.shards * diff.shards, // v9.1.3 : essences fondues dans les éclats
    fragments: diff.fragments,
    ...RESOURCE_SOURCES.dungeonClear, // v9.3.3 : grimoires et pierres d'ascension
  };
  // v10.1 (P3) : gain principal du donjon, Cauchemar (+60 % par palier).
  for (const [k, v] of Object.entries(mainGain(dungeonById(run.id), run.difficulty ?? 'easy', run.nightmare ?? 0))) reward[k] = (reward[k] ?? 0) + v;
  const given = grantReward(state, scaleReward(reward, routeOf(run).reward * nightmareMult(run.nightmare ?? 0))); // v9.6.2 : itinéraire
  const chest = first ? grantReward(state, FIRST_CLEAR_CHEST) : null; // v10.1 : gros coffre du premier passage
  if (chest) addEarned(run, chest);
  if (run.nightmare > 0) { state.dungeonNightmare ??= {}; state.dungeonNightmare[run.id] = Math.max(state.dungeonNightmare[run.id] ?? 0, run.nightmare); }
  addEarned(run, given);
  state.dungeonsCleared[run.id] = (state.dungeonsCleared[run.id] ?? 0) + 1;
  const rank = DIFFICULTY_ORDER.indexOf(run.difficulty ?? 'easy');
  state.dungeonBest[run.id] = Math.max(state.dungeonBest[run.id] ?? -1, rank);
  trackMissions(state, 'dungeons', 1);
  { const z = grantSeal(state, balance); if (z !== null) state.sealNews = { zone: z, by: 'dungeon' }; } // v9.6.2 : sceau
  if (rng.next() < GEAR_SOURCES.dungeonClearChance) run.gear = rollGear(state, rng, { minRarity: 'rare' }); // v9.3.3
  recordRun(state, run, runReport(state, run, { won: true }));
  state.dungeon = null;
  return { item, added: added.added, earned: run.earned, id: run.id, difficulty: run.difficulty ?? 'easy', rank, first, chest, nightmare: run.nightmare ?? 0 }; // v9.3.5 : écran de victoire
}

// v9.8 (H2) : balayage — refaire d'un appui un donjon déjà réussi à cette difficulté, même récompense (1 clé).
export function canSweepDungeon(state, id, difficulty = 'easy') {
  return canEnterDungeon(state, id) && (state.dungeonBest?.[id] ?? -1) >= DIFFICULTY_ORDER.indexOf(difficulty);
}
export function sweepDungeon(state, id, rng, { slot = 'any', path = 'gold', difficulty = 'easy', nightmare = 0 } = {}, balance = BALANCE) {
  if (!canSweepDungeon(state, id, difficulty) || !startDungeon(state, id, slot, path, difficulty, 'normal', Math.min(nightmare, state.dungeonNightmare?.[id] ?? 0))) return null;
  const d = dungeonById(id);
  for (let room = 0; room < dungeonRooms(state, d); room++) {
    state.dungeon.kills = d.killsPerRoom - 1;
    dungeonKill(state, balance);
  }
  return { ...completeDungeon(state, rng, balance), sweep: true };
}

// v8.1 : rapport d'expédition (dernière tentative + meilleure par donjon et difficulté) :
// salle atteinte, PV restants du boss, durée, niveau, équipement, compagnons et familier.
export function runReport(state, run, { won = false, bossHpPct = null } = {}) {
  const d = dungeonById(run.id);
  const progress = won ? d.rooms + 1 : run.room + (bossHpPct === null ? 0 : 1 - bossHpPct / 100);
  return {
    won, room: run.room, rooms: d.rooms, bossHpPct, progress: Math.round(progress * 1000) / 1000,
    seconds: Math.max(0, Math.round((state.playSeconds ?? 0) - (run.startPlay ?? state.playSeconds ?? 0))),
    level: state.level, heroLevel: run.level, at: Date.now(),
    gear: Object.values(state.equipment).filter(Boolean).map((i) => ({ baseId: i.baseId, name: i.name, rarity: i.rarity, level: i.level, upgrades: i.upgrades ?? 0 })),
    team: [...state.companions.equipped],
  };
}

function recordRun(state, run, report) {
  const key = `${run.id}:${run.difficulty ?? 'easy'}`;
  const entry = state.dungeonRuns[key] ?? {};
  entry.last = report;
  if (!entry.best || report.progress > entry.best.progress
    || (report.progress === entry.best.progress && report.seconds < entry.best.seconds)) entry.best = report;
  entry.tries = (entry.tries ?? 0) + 1;
  state.dungeonRuns[key] = entry;
  return entry;
}

export function dungeonRunInfo(state, id, difficulty) {
  return state.dungeonRuns?.[`${id}:${difficulty}`] ?? null;
}

// Défaite : l'expédition s'arrête, les récompenses des salles déjà gagnées sont conservées.
export function failDungeon(state, { bossHpPct = null } = {}) {
  const run = state.dungeon;
  if (run) recordRun(state, run, runReport(state, run, { bossHpPct }));
  state.dungeon = null;
  return run?.earned ?? {};
}

export function abandonDungeon(state) {
  const run = state.dungeon;
  state.dungeon = null;
  return run?.earned ?? {};
}

// v10.1 (P3) : Balayer ×N (autant que de clés, N au plus) — un seul résumé (objets et ressources cumulés).
export function sweepDungeonN(state, id, rng, n, opts = {}, balance = BALANCE) {
  const out = { items: [], earned: {}, count: 0, id, difficulty: opts.difficulty ?? 'easy' };
  for (let i = 0; i < n; i++) {
    const r = sweepDungeon(state, id, rng, opts, balance);
    if (!r) break;
    out.count += 1; out.items.push(r.item);
    for (const [k, v] of Object.entries(r.earned ?? {})) out.earned[k] = (out.earned[k] ?? 0) + v;
  }
  return out.count ? out : null;
}
