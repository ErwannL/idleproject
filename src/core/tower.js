// Tour de l'Éternité (v8.2) : défi sans fin, un boss par étage, chaque étage plus fort que le précédent.
// Aucune clé n'est nécessaire ; les récompenses ne tombent qu'à chaque NOUVEAU record d'étage (pas de farm).
// Une défaite termine l'ascension ; l'étage atteint et la meilleure ascension sont gardés.
import { BOSSES } from '../data/enemies.js';
import { grantReward } from './rewards.js';

export const TOWER = { unlockStage: 40, floorLevel: 3, milestone: 10 };

// Ordre des boss de la tour : déterministe, tous les boss du jeu, les méga boss tous les 10 étages.
const ALL = Object.keys(BOSSES);
const MEGA = ALL.filter((id) => !/^(mini|mid|hard)_/.test(id));
const OTHERS = ALL.filter((id) => /^(mini|mid|hard)_/.test(id));

export function towerUnlocked(state) {
  return state.maxStage >= TOWER.unlockStage;
}

export function towerBoss(floor) {
  if (floor % TOWER.milestone === 0) return MEGA[(floor / TOWER.milestone - 1) % MEGA.length];
  return OTHERS[(floor * 7 + 3) % OTHERS.length];
}

// Niveau des ennemis : part d'environ la moitié de l'étape max, +3 niveaux par étage.
export function towerLevel(state, floor) {
  return Math.max(20, Math.round(state.maxStage * 0.5)) + floor * TOWER.floorLevel;
}

// Récompense d'un nouveau record : gemmes à chaque étage, fragments tous les 5, ticket + clé tous les 10.
export function towerReward(floor) {
  return {
    gems: 10 + floor * 2,
    fragments: floor % 5 === 0 ? 5 + floor : 0,
    tickets: floor % 10 === 0 ? 1 + Math.floor(floor / 30) : 0,
    keys: floor % 10 === 0 ? 1 : 0,
  };
}

export function startTower(state) {
  if (!towerUnlocked(state) || state.dungeon || state.tower) return false;
  state.tower = { floor: 1, startPlay: state.playSeconds ?? 0 };
  return true;
}

// Boss de l'étage vaincu : étage suivant ; récompense seulement au-delà du record.
export function clearTowerFloor(state) {
  const run = state.tower;
  const floor = run.floor;
  const record = floor > (state.towerBest ?? 0);
  let reward = {};
  if (record) {
    reward = grantReward(state, towerReward(floor));
    state.towerBest = floor;
  }
  run.floor += 1;
  return { floor, record, reward };
}

export function endTower(state, { defeated = true } = {}) {
  const run = state.tower;
  if (!run) return null;
  const reached = run.floor - 1;
  state.towerLast = {
    floors: reached, defeatedAt: defeated ? run.floor : null,
    seconds: Math.max(0, Math.round((state.playSeconds ?? 0) - (run.startPlay ?? 0))), at: Date.now(),
  };
  state.tower = null;
  return state.towerLast;
}

export function sanitizeTower(state, raw) {
  const int = (v, min = 0) => (Number.isInteger(v) && v >= min ? v : null);
  state.towerBest = int(raw.towerBest) ?? 0;
  const run = raw.tower;
  state.tower = run && int(run.floor, 1) ? { floor: run.floor, startPlay: Number(run.startPlay) || 0 } : null;
  const last = raw.towerLast;
  state.towerLast = last && int(last.floors) !== null
    ? { floors: last.floors, defeatedAt: int(last.defeatedAt, 1), seconds: int(last.seconds) ?? 0, at: int(last.at) ?? 0 }
    : null;
}
