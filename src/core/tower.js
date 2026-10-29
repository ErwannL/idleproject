// Tour de l'Éternité (v8.2) : défi sans fin, un boss par étage, chaque étage plus fort que le précédent.
// Aucune clé n'est nécessaire ; les récompenses ne tombent qu'à chaque NOUVEAU record d'étage (pas de farm).
// Une défaite termine l'ascension ; l'étage atteint et la meilleure ascension sont gardés.
import { BOSSES } from '../data/enemies.js';
import { grantReward } from './rewards.js';

export const TOWER = {
  unlockStage: 60, floorLevel: 3, milestone: 10, climbsPerWeek: 1, steepness: 40, // étape 5 : déblocage 40 → 60 (calendrier étalé)
  // v8.8 : la tour s'effondre au bout de 10 h de jeu (temps de combat : la vitesse le fait défiler plus vite) ;
  // chaque nouvel étage la stabilise un peu (+5 min × 0,98^étage, sans dépasser 10 h devant soi).
  timeLimit: 10 * 3600, floorBonus: 300, floorBonusDecay: 0.98,
};

// v8.4 : une ascension par semaine (remise à zéro le lundi, heure locale). Récompenses :
// - record absolu (une seule fois par étage, à vie) : towerReward ;
// - meilleur étage de la semaine (chaque semaine) : weeklyReward.
export function weekKey(now = Date.now()) {
  const d = new Date(now);
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

export function towerWeek(state, now = Date.now()) {
  const key = weekKey(now);
  if (state.towerWeek?.week !== key) state.towerWeek = { week: key, best: 0, climbs: 0, extra: 0 };
  return state.towerWeek;
}

export function climbsLeft(state, now = Date.now()) {
  const w = towerWeek(state, now);
  return Math.max(0, TOWER.climbsPerWeek + (w.extra ?? 0) - w.climbs);
}

export function weeklyReward(floor) {
  return { gems: 5 + floor, fragments: floor % 5 === 0 ? Math.ceil(floor / 2) : 0 };
}

// Ordre des boss de la tour : déterministe, tous les boss du jeu, les méga boss tous les 10 étages.
const ALL = Object.keys(BOSSES);
const MEGA = ALL.filter((id) => !/^(mini|mid|hard)_/.test(id));
const OTHERS = ALL.filter((id) => /^(mini|mid|hard)_/.test(id));

export function towerUnlocked(state) {
  return state.maxStage >= TOWER.unlockStage || (state.towerBest ?? 0) > 0 || Boolean(state.tower);
}

export function towerBoss(floor) {
  if (floor % TOWER.milestone === 0) return MEGA[(floor / TOWER.milestone - 1) % MEGA.length];
  return OTHERS[(floor * 7 + 3) % OTHERS.length];
}

// Niveau des ennemis : part d'environ la moitié de l'étape max, +3 niveaux par étage, et (v8.7) une pente qui
// s'accentue : +f²/40 niveaux (étage 100 : +250, étage 400 : +4 000). Une ascension finit toujours par s'arrêter.
export function towerLevel(state, floor) {
  return Math.max(20, Math.round(state.maxStage * 0.5)) + floor * TOWER.floorLevel + Math.floor((floor * floor) / TOWER.steepness);
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

export function startTower(state, now = Date.now()) {
  if (!towerUnlocked(state) || state.dungeon || state.tower || state.challenge || climbsLeft(state, now) <= 0) return false;
  towerWeek(state, now).climbs += 1;
  state.tower = { floor: 1, startPlay: state.playSeconds ?? 0, deadline: (state.playSeconds ?? 0) + TOWER.timeLimit };
  return true;
}

// Boss de l'étage vaincu : étage suivant ; récompense seulement au-delà du record.
export function clearTowerFloor(state) {
  const run = state.tower;
  const floor = run.floor;
  const record = floor > (state.towerBest ?? 0);
  const week = towerWeek(state);
  const weekly = floor > week.best;
  const reward = {};
  const add = (r) => { for (const [k, v] of Object.entries(grantReward(state, r))) reward[k] = (reward[k] ?? 0) + v; };
  if (record) { add(towerReward(floor)); state.towerBest = floor; }
  if (weekly) { add(weeklyReward(floor)); week.best = floor; }
  run.floor += 1;
  // L'étage franchi stabilise la tour : un peu de temps en plus, de moins en moins à mesure qu'on monte.
  const now = state.playSeconds ?? 0;
  const bonus = TOWER.floorBonus * TOWER.floorBonusDecay ** floor;
  run.deadline = Math.min(now + TOWER.timeLimit, (run.deadline ?? now + TOWER.timeLimit) + bonus);
  return { floor, record, weekly, reward, bonus: Math.round(bonus) };
}

// Temps (de jeu) restant avant l'effondrement de la tour.
export function towerTimeLeft(state) {
  const run = state.tower;
  if (!run) return 0;
  return Math.max(0, (run.deadline ?? (run.startPlay ?? 0) + TOWER.timeLimit) - (state.playSeconds ?? 0));
}

export function endTower(state, { defeated = true, collapsed = false } = {}) {
  const run = state.tower;
  if (!run) return null;
  const reached = run.floor - 1;
  state.towerLast = {
    floors: reached, defeatedAt: defeated ? run.floor : null, collapsed,
    seconds: Math.max(0, Math.round((state.playSeconds ?? 0) - (run.startPlay ?? 0))), at: Date.now(),
  };
  state.tower = null;
  // v8.9 : historique des ascensions (écran Records).
  state.towerHistory = [{ ...state.towerLast }, ...(state.towerHistory ?? [])].slice(0, 20);
  return state.towerLast;
}

export function sanitizeTower(state, raw) {
  const int = (v, min = 0) => (Number.isInteger(v) && v >= min ? v : null);
  state.towerBest = int(raw.towerBest) ?? 0;
  const run = raw.tower;
  state.tower = run && int(run.floor, 1) ? { floor: run.floor, startPlay: Number(run.startPlay) || 0 } : null;
  // Ascension d'avant la v8.8 : chrono de 10 h compté depuis son début (une ascension sans fin s'effondre au chargement).
  if (state.tower) state.tower.deadline = Number.isFinite(run.deadline) ? run.deadline : state.tower.startPlay + TOWER.timeLimit;
  const w = raw.towerWeek;
  state.towerWeek = w && typeof w.week === 'string'
    ? { week: w.week.slice(0, 10), best: int(w.best) ?? 0, climbs: int(w.climbs) ?? 0, extra: int(w.extra) ?? 0 } : null;
  state.towerHistory = Array.isArray(raw.towerHistory)
    ? raw.towerHistory.filter((h) => h && int(h.floors) !== null).slice(0, 20)
      .map((h) => ({ floors: h.floors, seconds: int(h.seconds) ?? 0, at: int(h.at) ?? 0, collapsed: h.collapsed === true, defeatedAt: int(h.defeatedAt, 1) }))
    : [];
  const last = raw.towerLast;
  state.towerLast = last && int(last.floors) !== null
    ? { floors: last.floors, defeatedAt: int(last.defeatedAt, 1), seconds: int(last.seconds) ?? 0, at: int(last.at) ?? 0, collapsed: last.collapsed === true }
    : null;
}
