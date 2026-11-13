// Tour de l'Éternité (v8.2) : défi sans fin, un boss par étage, chaque étage plus fort que le précédent.
// Aucune clé n'est nécessaire ; les récompenses ne tombent qu'à chaque NOUVEAU record d'étage (pas de farm).
// Une défaite termine l'ascension ; l'étage atteint et la meilleure ascension sont gardés.
import { BOSSES } from '../data/enemies.js';
import { grantReward } from './rewards.js';
import { levelForStage } from './combat.js'; // v9.2.0 (monde marin) : niveau de puissance des étapes

import { grantSeal } from './seals.js'; // v9.6.2
export const TOWER = {
  unlockStage: 60, floorLevel: 3, milestone: 10, climbsPerWeek: 1, climbsPerDay: 3, // v9.6.2 (7.3) : 3 ascensions par jour
  steepness: 40, // étape 5 : déblocage 40 → 60 (calendrier étalé)
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

// v9.6.2 (7.3) : 3 ascensions par jour (le meilleur étage de la semaine reste hebdomadaire).
export function dayKey(now = Date.now()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function towerDay(state, now = Date.now()) {
  const key = dayKey(now);
  if (state.towerDay?.day !== key) state.towerDay = { day: key, climbs: 0 };
  return state.towerDay;
}
export function climbsLeft(state, now = Date.now()) {
  const w = towerWeek(state, now);
  return Math.max(0, TOWER.climbsPerDay + (w.extra ?? 0) - towerDay(state, now).climbs);
}

// v9.6.2 (7.1) : une règle tirée au sort tous les 10 étages (elle change la préparation à faire).
export const TOWER_RULES = {
  thick: { name: 'Carapaces', text: 'Les ennemis ont +40 % de PV.', hp: 1.4 },
  fierce: { name: 'Furie', text: 'Les ennemis frappent 40 % plus fort.', damage: 1.4 },
  noregen: { name: 'Sans repos', text: 'Le héros ne se régénère plus (le vol de vie marche toujours).', noRegen: true },
  swift: { name: 'Frénésie', text: 'Les ennemis attaquent 30 % plus vite.', speed: 1.3 },
};
export function towerRule(state) {
  const r = state.tower?.rule;
  return r ? TOWER_RULES[r] ?? null : null;
}

export function weeklyReward(floor) {
  return { gems: 5 + floor, fragments: floor % 5 === 0 ? Math.ceil(floor / 2) : 0 };
}

// Ordre des boss de la tour : déterministe, les méga boss tous les 10 étages.
// v9.1.3 (doc4 lot 6) : liste figée (les 46 boss de la v9.1.3) : un boss ajouté plus tard (monde d'un perso, nouveau
// monde) ne décale plus les étages. Un boss retiré des données est sauté (filtre).
export const TOWER_BOSSES = ['slime_king', 'alpha_wolf', 'bone_lord', 'spectral_queen', 'ash_dragon', 'fallen_knight', 'demon_king',
  'rotting_dryad', 'magma_colossus', 'frost_wyrm', 'obsidian_tyrant', 'crypt_archlich', 'mini_goblin_warlord', 'mini_treant',
  'mini_crystal_golem', 'mini_pharaoh', 'mini_frost_witch', 'mini_reaper', 'mid_boar_titan', 'mid_giant_spider', 'mid_crystal_bat',
  'mid_sand_worm', 'mid_mammoth', 'mid_hellhound', 'hard_scarecrow', 'hard_werewolf', 'hard_necromancer', 'hard_anubis',
  'hard_frost_giant', 'hard_demon_general', 'mini_toad_king', 'mid_hydra', 'hard_plague_doctor', 'boss_swamp_behemoth',
  'mini_harpy_queen', 'mid_thunder_griffin', 'hard_storm_valkyrie', 'boss_sky_titan', 'mini_salamander_chief', 'mid_lava_golem',
  'hard_flame_djinn', 'boss_phoenix', 'mini_void_watcher', 'mid_star_devourer', 'hard_void_knight', 'boss_void_emperor'];
const ALL = TOWER_BOSSES.filter((id) => BOSSES[id]);
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
  return Math.max(20, Math.round(levelForStage(state.maxStage) * 0.5)) + floor * TOWER.floorLevel + Math.floor((floor * floor) / TOWER.steepness);
}

// Récompense d'un nouveau record : gemmes à chaque étage, fragments tous les 5, gemmes en plus + clé tous les 10
// (v9.1.3 : l'ancien ticket vaut 100 gemmes).
export function towerReward(floor) {
  return {
    gems: 10 + floor * 2 + (floor % 10 === 0 ? 100 * (1 + Math.floor(floor / 30)) : 0),
    fragments: floor % 5 === 0 ? 5 + floor : 0,
    keys: floor % 10 === 0 ? 1 : 0,
  };
}

export function startTower(state, now = Date.now()) {
  if (!towerUnlocked(state) || state.dungeon || state.tower || state.challenge || climbsLeft(state, now) <= 0) return false;
  towerWeek(state, now).climbs += 1;
  towerDay(state, now).climbs += 1;
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
  if (floor % 5 === 0) { const z = grantSeal(state); if (z !== null) state.sealNews = { zone: z, by: 'tower' }; } // v9.6.2 : sceau
  run.earned = run.earned ?? {};
  for (const [k, v] of Object.entries(reward)) run.earned[k] = (run.earned[k] ?? 0) + v; // v9.6.2 : écran de fin
  run.floor += 1;
  // v9.6.2 : nouvelle règle à chaque palier de 10 étages.
  if (floor % 10 === 0) { const ids = Object.keys(TOWER_RULES); run.rule = ids[(floor / 10 + (state.towerBest ?? 0)) % ids.length]; }
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
    record: reached >= (state.towerBest ?? 0) && reached > 0, best: state.towerBest ?? 0, // v9.6.2 : écran de fin
    floors: reached, defeatedAt: defeated ? run.floor : null, collapsed, earned: run.earned ?? {},
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
  const d = raw.towerDay; // v9.6.2
  state.towerDay = d && typeof d.day === 'string' ? { day: d.day.slice(0, 10), climbs: int(d.climbs) ?? 0 } : null;
  if (state.tower && raw.tower?.rule && TOWER_RULES[raw.tower.rule]) state.tower.rule = raw.tower.rule;
  state.towerHistory = Array.isArray(raw.towerHistory)
    ? raw.towerHistory.filter((h) => h && int(h.floors) !== null).slice(0, 20)
      .map((h) => ({ floors: h.floors, seconds: int(h.seconds) ?? 0, at: int(h.at) ?? 0, collapsed: h.collapsed === true, defeatedAt: int(h.defeatedAt, 1) }))
    : [];
  const last = raw.towerLast;
  state.towerLast = last && int(last.floors) !== null
    ? { floors: last.floors, defeatedAt: int(last.defeatedAt, 1), seconds: int(last.seconds) ?? 0, at: int(last.at) ?? 0, collapsed: last.collapsed === true }
    : null;
}
