// Missions journalières, piste du mois (v9.1.3 : hebdomadaires et mensuelles fondues) et calendrier de connexion.
// Les périodes sont des clés de date locales : un changement de clé réinitialise la période.
import { LOGIN_CALENDAR, MISSION_PERIODS, MISSION_TRACK } from '../data/missions.js';
import { grantReward } from './rewards.js';
import { incomeBoss, incomeDungeon, incomeLogin, incomeMissions, incomeTrack } from './income.js'; // v9.2.8
import { trackEventGoal } from './ancients.js'; // v9.2.8 : objectifs du petit événement
import { tickSubscriptions } from './store.js'; // v9.2.8 : part du jour d'un abonnement (achat réel seulement)
import { RESOURCE_SOURCES } from '../data/progression.js'; // v9.3.3

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function periodKey(period, now = Date.now()) {
  const d = new Date(now);
  if (period === 'monthly') return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  if (period === 'weekly') {
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
    return dayKey(monday);
  }
  return dayKey(d);
}

// Millisecondes avant la prochaine réinitialisation d'une période.
export function periodRemaining(period, now = Date.now()) {
  const d = new Date(now);
  let next;
  if (period === 'monthly') next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  else if (period === 'weekly') next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 - ((d.getDay() + 6) % 7));
  else next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return Math.max(0, next.getTime() - now);
}

export function emptyMissions() {
  return {
    ...Object.fromEntries(MISSION_PERIODS.map((p) => [p.id, { key: '', progress: {}, claimed: [], bonus: false }])),
    track: { key: '', progress: {}, claimed: 0 }, // v9.1.3 : piste du mois (claimed = paliers récupérés)
    // v9.1.3 : `days` = jours de connexion comptés (à l'ouverture du jeu, sans remise à zéro quand un jour manque),
    // `claimed` = cases du calendrier déjà récupérées ; une case non récupérée reste récupérable (7 au plus en attente).
    login: { lastDay: '', days: 0, claimed: 0 },
  };
}

// À appeler régulièrement : réinitialise les périodes échues et compte la connexion du jour.
export function refreshMissions(state, now = Date.now()) {
  state.missions ??= emptyMissions();
  for (const p of MISSION_PERIODS) {
    const key = periodKey(p.id, now);
    if (state.missions[p.id].key !== key) state.missions[p.id] = { key, progress: {}, claimed: [], bonus: false };
  }
  const month = periodKey('monthly', now);
  if (state.missions.track.key !== month) state.missions.track = { key: month, progress: {}, claimed: 0 };
  const today = periodKey('daily', now);
  const login = state.missions.login;
  if (login.lastDay !== today) {
    login.days += 1;
    login.claimed = Math.max(login.claimed, login.days - LOGIN_CALENDAR.length);
    login.lastDay = today;
    trackMissions(state, 'login', 1);
    incomeLogin(state, now); // v9.2.8 : tickets de connexion (plafond mensuel)
    tickSubscriptions(state, now);
  }
}

export function trackMissions(state, type, amount = 1) {
  if (!state.missions || !(amount > 0)) return;
  // v9.2.8 : premier boss / premier donjon du jour (tickets, plafonds mensuels) et objectifs du petit événement.
  if (type === 'bosses') incomeBoss(state);
  if (type === 'dungeons') incomeDungeon(state);
  trackEventGoal(state, type, amount);
  for (const p of MISSION_PERIODS) {
    const run = state.missions[p.id];
    for (const m of p.missions) {
      if (m.type === type) run.progress[m.id] = Math.min(m.target, (run.progress[m.id] ?? 0) + amount);
    }
  }
  const track = state.missions.track;
  for (const g of MISSION_TRACK.goals) {
    if (g.type === type) track.progress[g.id] = Math.min(g.target, (track.progress[g.id] ?? 0) + amount);
  }
}

// v9.1.3 : avancement de la piste (0..100) = moyenne des objectifs, chacun plafonné à 100 %.
export function trackPct(state) {
  const p = state.missions?.track?.progress ?? {};
  const sum = MISSION_TRACK.goals.reduce((s, g) => s + Math.min(1, (p[g.id] ?? 0) / g.target), 0);
  return (sum / MISSION_TRACK.goals.length) * 100;
}

// Prochain palier de la piste : { index, pct, reward, ready } ou null quand tout est pris.
export function trackNext(state) {
  const i = state.missions?.track?.claimed ?? 0;
  const tier = MISSION_TRACK.tiers[i];
  if (!tier) return null;
  return { index: i, ...tier, ready: trackPct(state) >= tier.pct - 1e-9 };
}

export function claimTrackTier(state) {
  const next = trackNext(state);
  if (!next?.ready) return null;
  state.missions.track.claimed = next.index + 1;
  return mergeReward(grantReward(state, next.reward), incomeTrack(state)); // v9.2.8 : + ticket familier
}

export function missionPeriod(id) {
  return MISSION_PERIODS.find((p) => p.id === id);
}

export function missionStatus(state, periodId, mission) {
  const run = state.missions[periodId];
  const progress = run.progress[mission.id] ?? 0;
  return { progress, done: progress >= mission.target, claimed: run.claimed.includes(mission.id) };
}

export function claimMission(state, periodId, missionId) {
  const period = missionPeriod(periodId);
  const mission = period?.missions.find((m) => m.id === missionId);
  if (!mission) return null;
  const st = missionStatus(state, periodId, mission);
  if (!st.done || st.claimed) return null;
  state.missions[periodId].claimed.push(mission.id);
  return grantReward(state, mission.reward);
}

// v9.3.5 : une mission ne demande jamais une fonction encore verrouillée (recyclage et invocations après le premier
// boss) : elle est masquée et ne compte pas pour la récompense complète.
const MISSION_GATE = { recycle: (s) => (s.records?.bossesDefeated ?? 0) >= 1, summons: (s) => (s.records?.bossesDefeated ?? 0) >= 1,
  dungeons: (s) => (s.records?.bestStage ?? 1) >= 25 };
export const missionOpen = (state, m) => !MISSION_GATE[m.type] || MISSION_GATE[m.type](state);
export const openMissions = (state, period) => period.missions.filter((m) => missionOpen(state, m));

export function bonusReady(state, periodId) {
  const period = missionPeriod(periodId);
  const run = state.missions[periodId];
  return !run.bonus && openMissions(state, period).every((m) => run.claimed.includes(m.id));
}

export function claimMissionBonus(state, periodId) {
  if (!missionPeriod(periodId) || !bonusReady(state, periodId)) return null;
  state.missions[periodId].bonus = true;
  const given = grantReward(state, missionPeriod(periodId).bonus);
  // v9.3.3 : ressources universelles (quotidien : grimoires ; semaine : pierres et essences).
  const extra = periodId === 'daily' ? RESOURCE_SOURCES.dailyMissions : periodId === 'weekly' ? RESOURCE_SOURCES.weeklyChest : null;
  if (extra) Object.assign(given, grantReward(state, extra));
  return periodId === 'daily' ? mergeReward(given, incomeMissions(state)) : given; // v9.2.8 : tickets des missions
}

// Jour du calendrier (0..6) de la prochaine case à récupérer.
export function loginDay(state) {
  return state.missions.login.claimed % LOGIN_CALENDAR.length;
}

// v9.1.3 : nombre de cases de connexion en attente (jours ouverts mais pas encore récupérés).
export function loginPending(state) {
  const login = state.missions.login;
  return Math.max(0, login.days - login.claimed);
}

export function loginReady(state) {
  return loginPending(state) > 0;
}

// Récompense de toutes les cases en attente, sans les récupérer.
export function loginPendingReward(state) {
  const total = {};
  for (let i = 0; i < loginPending(state); i++) mergeReward(total, LOGIN_CALENDAR[(state.missions.login.claimed + i) % LOGIN_CALENDAR.length]);
  return total;
}

// v9.1.3 : récupère toutes les cases en attente d'un coup ; renvoie le total donné (ou null).
export function claimLogin(state) {
  if (!loginReady(state)) return null;
  const total = {};
  while (loginReady(state)) {
    const reward = LOGIN_CALENDAR[loginDay(state)];
    state.missions.login.claimed += 1;
    mergeReward(total, grantReward(state, reward));
  }
  return total;
}

// Quelque chose à récupérer ? (badge de l'interface)
export function missionsClaimable(state) {
  if (!state.missions) return false;
  if (loginReady(state)) return true;
  if (trackNext(state)?.ready) return true;
  return MISSION_PERIODS.some((p) => bonusReady(state, p.id)
    || p.missions.some((m) => { const st = missionStatus(state, p.id, m); return st.done && !st.claimed; }));
}

export function sanitizeMissions(raw) {
  const out = emptyMissions();
  if (!raw || typeof raw !== 'object') return out;
  const str = (v) => (typeof v === 'string' ? v.slice(0, 16) : '');
  for (const p of MISSION_PERIODS) {
    const r = raw[p.id];
    if (!r || typeof r !== 'object') continue;
    const ids = new Set(p.missions.map((m) => m.id));
    const progress = {};
    for (const m of p.missions) {
      const v = Number(r.progress?.[m.id]);
      if (Number.isFinite(v) && v > 0) progress[m.id] = Math.min(m.target, Math.floor(v));
    }
    out[p.id] = {
      key: str(r.key),
      progress,
      claimed: Array.isArray(r.claimed) ? [...new Set(r.claimed.filter((id) => ids.has(id)))] : [],
      bonus: r.bonus === true,
    };
  }
  const t = raw.track;
  if (t && typeof t === 'object') {
    const progress = {};
    for (const g of MISSION_TRACK.goals) {
      const v = Number(t.progress?.[g.id]);
      if (Number.isFinite(v) && v > 0) progress[g.id] = Math.min(g.target, Math.floor(v));
    }
    const c = Number(t.claimed);
    out.track = { key: str(t.key), progress, claimed: Number.isInteger(c) && c > 0 ? Math.min(c, MISSION_TRACK.tiers.length) : 0 };
  }
  const l = raw.login;
  if (l && typeof l === 'object') {
    const count = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? Math.min(n, 100000) : 0; };
    const lastDay = str(l.lastDay);
    if ('days' in l) {
      const days = count(l.days);
      out.login = { lastDay, days, claimed: Math.min(days, Math.max(count(l.claimed), days - LOGIN_CALENDAR.length)) };
    } else {
      // v9.1.3 : ancienne série → jours comptés ; la case du dernier jour reste à récupérer si elle ne l'a pas été.
      const days = count(l.streak);
      out.login = { lastDay, days, claimed: days > 0 && str(l.claimedDay) !== lastDay ? days - 1 : days };
    }
  }
  return out;
}

// Additionne deux récompenses ({ gems: 10 } + { gems: 5, tickets: 1 }).
export function mergeReward(total, given) {
  for (const [k, v] of Object.entries(given ?? {})) total[k] = (total[k] ?? 0) + v;
  return total;
}

// « Tout récupérer » : connexion, missions remplies puis coffres bonus. Renvoie le total (ou null).
export function claimAllMissions(state) {
  const total = {};
  let count = 0;
  const add = (given) => { if (given) { mergeReward(total, given); count += 1; } };
  add(claimLogin(state));
  for (const p of MISSION_PERIODS) {
    for (const m of p.missions) add(claimMission(state, p.id, m.id));
    add(claimMissionBonus(state, p.id));
  }
  while (trackNext(state)?.ready) add(claimTrackTier(state));
  return count ? total : null;
}
