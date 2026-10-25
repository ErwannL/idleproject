// Missions périodiques (journalières, hebdomadaires, mensuelles) et calendrier de connexion.
// Les périodes sont des clés de date locales : un changement de clé réinitialise la période.
import { LOGIN_CALENDAR, MISSION_PERIODS } from '../data/missions.js';
import { grantReward } from './rewards.js';

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
    login: { lastDay: '', streak: 0, claimedDay: '' },
  };
}

function previousDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

// À appeler régulièrement : réinitialise les périodes échues et compte la connexion du jour.
export function refreshMissions(state, now = Date.now()) {
  state.missions ??= emptyMissions();
  for (const p of MISSION_PERIODS) {
    const key = periodKey(p.id, now);
    if (state.missions[p.id].key !== key) state.missions[p.id] = { key, progress: {}, claimed: [], bonus: false };
  }
  const today = periodKey('daily', now);
  const login = state.missions.login;
  if (login.lastDay !== today) {
    login.streak = login.lastDay === previousDay(today) ? login.streak + 1 : 1;
    login.lastDay = today;
    trackMissions(state, 'login', 1);
  }
}

export function trackMissions(state, type, amount = 1) {
  if (!state.missions || !(amount > 0)) return;
  for (const p of MISSION_PERIODS) {
    const run = state.missions[p.id];
    for (const m of p.missions) {
      if (m.type === type) run.progress[m.id] = Math.min(m.target, (run.progress[m.id] ?? 0) + amount);
    }
  }
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

export function bonusReady(state, periodId) {
  const period = missionPeriod(periodId);
  const run = state.missions[periodId];
  return !run.bonus && period.missions.every((m) => run.claimed.includes(m.id));
}

export function claimMissionBonus(state, periodId) {
  if (!missionPeriod(periodId) || !bonusReady(state, periodId)) return null;
  state.missions[periodId].bonus = true;
  return grantReward(state, missionPeriod(periodId).bonus);
}

// Jour du calendrier (0..6) correspondant à la série actuelle.
export function loginDay(state) {
  return (Math.max(1, state.missions.login.streak) - 1) % LOGIN_CALENDAR.length;
}

export function loginReady(state) {
  const login = state.missions.login;
  return login.lastDay !== '' && login.claimedDay !== login.lastDay;
}

export function claimLogin(state) {
  if (!loginReady(state)) return null;
  state.missions.login.claimedDay = state.missions.login.lastDay;
  return grantReward(state, LOGIN_CALENDAR[loginDay(state)]);
}

// Quelque chose à récupérer ? (badge de l'interface)
export function missionsClaimable(state) {
  if (!state.missions) return false;
  if (loginReady(state)) return true;
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
  const l = raw.login;
  if (l && typeof l === 'object') {
    const streak = Number(l.streak);
    out.login = { lastDay: str(l.lastDay), streak: Number.isInteger(streak) && streak > 0 ? Math.min(streak, 100000) : 0, claimedDay: str(l.claimedDay) };
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
  return count ? total : null;
}
