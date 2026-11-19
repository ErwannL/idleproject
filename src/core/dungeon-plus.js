// v10.1 (P3) : donjons plus lisibles et plus riches.
//  - 3 étoiles par donjon (Facile, Normal, Difficile gagnés) ; puis Cauchemar I, II, III… (+60 % de PV et de butin par palier).
//  - Gain principal propre à chaque donjon (affiché en grand sur sa carte, doublé à la fin du donjon).
//  - Portes de salles : entre deux salles, 2 portes au choix (Combat, Élite, Trésor, Autel, Repos), choix automatique en 10 s.
//  - Premier passage : un gros coffre en plus. Balayer ×N et Balayer tout (toutes les clés).
import { DIFFICULTY_ORDER, DUNGEONS } from '../data/dungeons.js';
import { ITEM_SETS } from '../data/sets.js';
import { grantReward } from './rewards.js';

export const DUNGEON_GAIN = {
  crypt: { key: 'grimoire', label: 'Grimoires', amount: 6 },
  sanctuary: { key: 'ascension', label: 'Pierres d\'éveil', amount: 3 },
  furnace: { key: 'shards', label: 'Éclats', amount: 60 },
  glacier: { key: 'mastery', label: 'Essences', amount: 4 },
  citadel: { key: 'fragments', label: 'Fragments', amount: 20 },
};
export const NIGHTMARE_STEP = 0.6; // +60 % de PV ennemis et de butin par palier
export const FIRST_CLEAR_CHEST = { keys: 2, grimoire: 5, ascension: 2, gems: 50 };

export const dungeonSet = (d) => ITEM_SETS.find((s) => s.zone === d.zone) ?? null;
export const dungeonStars = (state, id) => Math.max(0, Math.min(3, (state.dungeonBest?.[id] ?? -1) + 1));
export const nightmareBest = (state, id) => state.dungeonNightmare?.[id] ?? 0;
// Cauchemar ouvert après les 3 étoiles ; palier n accessible si n-1 gagné.
export const nightmareOpen = (state, id) => (dungeonStars(state, id) >= 3 ? nightmareBest(state, id) + 1 : 0);
export const nightmareMult = (n) => 1 + NIGHTMARE_STEP * Math.max(0, n);
export const roman = (n) => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] ?? String(n);

// Gain principal à la fin du donjon (mis à l'échelle de la difficulté et du Cauchemar).
export function mainGain(d, difficulty = 'easy', nightmare = 0) {
  const g = DUNGEON_GAIN[d.id];
  if (!g) return {};
  const k = (1 + DIFFICULTY_ORDER.indexOf(difficulty)) * nightmareMult(nightmare);
  return { [g.key]: Math.round(g.amount * k) };
}

// ---- Portes de salles ----
export const DOORS = {
  combat: { label: 'Combat', icon: 'weapon_sword', text: 'Une salle normale.' },
  elite: { label: 'Élite', icon: 'icon_skull', text: 'Monstres +50 % de PV, butin de la salle ×2.' },
  treasure: { label: 'Trésor', icon: 'icon_chest', text: 'Un coffre tout de suite, salle deux fois plus courte.' },
  altar: { label: 'Autel', icon: 'icon_star', text: '+20 % de dégâts jusqu\'à la fin du donjon.' },
  rest: { label: 'Repos', icon: 'icon_heart', text: 'Soigne toute l\'équipe.' },
};
const DOOR_IDS = Object.keys(DOORS);
export function offerDoors(state, rng) {
  const run = state.dungeon;
  if (!run) return null;
  const pool = [...DOOR_IDS];
  const a = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
  const b = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
  run.doors = [a, b];
  return run.doors;
}
// Choix automatique : Autel > Élite > Trésor > Repos > Combat (le plus rentable sans risque inutile).
const AUTO = ['altar', 'elite', 'treasure', 'rest', 'combat'];
export function chooseDoor(state, id = null, roomGold = 0) {
  const run = state.dungeon;
  if (!run?.doors?.length) return null;
  const pick = id && run.doors.includes(id) ? id : [...run.doors].sort((x, y) => AUTO.indexOf(x) - AUTO.indexOf(y))[0];
  run.doors = null;
  run.door = pick;
  let given = null;
  if (pick === 'treasure') {
    given = grantReward(state, { gold: Math.max(1, Math.round(roomGold * 3)), shards: 10 });
    for (const [k, v] of Object.entries(given)) run.earned[k] = (run.earned[k] ?? 0) + v;
  }
  if (pick === 'altar') (run.boons ??= []).push({ id: 'altar', rarity: 'rare', eff: { damagePct: 20 } });
  return { door: pick, given, heal: pick === 'rest' };
}
// Multiplicateurs de la salle en cours selon la porte prise.
export const doorHp = (run) => (run?.door === 'elite' ? 1.5 : 1);
export const doorReward = (run) => (run?.door === 'elite' ? 2 : 1);
export const doorKills = (run, base) => (run?.door === 'treasure' ? Math.max(1, Math.ceil(base / 2)) : base);

// Balayages possibles avec les clés actuelles.
export const sweepCount = (state, n) => Math.max(0, Math.min(n, state.keys ?? 0));
// Meilleur donjon à balayer (celui qui a le plus d'étoiles, puis le plus avancé).
export function bestSweepTarget(state) {
  const ok = DUNGEONS.filter((d) => dungeonStars(state, d.id) > 0 && state.maxStage >= d.unlockStage);
  if (!ok.length) return null;
  const d = ok.sort((a, b) => dungeonStars(state, b.id) - dungeonStars(state, a.id) || b.unlockStage - a.unlockStage)[0];
  return { id: d.id, difficulty: DIFFICULTY_ORDER[Math.max(0, dungeonStars(state, d.id) - 1)] };
}
export function sanitizeDungeonPlus(state, raw) {
  const n = raw?.dungeonNightmare;
  state.dungeonNightmare = {};
  if (n && typeof n === 'object') for (const d of DUNGEONS) { const v = n[d.id]; if (Number.isInteger(v) && v > 0) state.dungeonNightmare[d.id] = Math.min(99, v); }
}
