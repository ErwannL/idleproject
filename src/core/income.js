// v9.2.8 : revenus mensuels de tickets (document du producteur, sections 5 et 10). Chaque source a son plafond par mois
// civil (data/economy.js, INCOME) et passe par un seul registre (`state.economy.ledger`) : une action ne compte qu'une
// fois, et la somme des plafonds est exactement la cible mensuelle (180 limités, 120 permanents, 90 familiers ; tests).
// Les gemmes (cristaux) gardent leurs sources d'avant, inchangées.
import { INCOME } from '../data/economy.js';
import { grantReward } from './rewards.js';
import { ensureEconomy } from './wallet.js';

const pad = (n) => String(n).padStart(2, '0');
export const monthKey = (now = Date.now()) => { const d = new Date(now); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
export const dayKey = (now = Date.now()) => { const d = new Date(now); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

export function ledger(state, now = Date.now()) {
  const eco = ensureEconomy(state);
  const month = monthKey(now);
  if (eco.ledger.month !== month) eco.ledger = { month, counts: {}, got: {}, last: {} };
  return eco.ledger;
}

// Verse `give` au titre de la source `id`, dans la limite de son plafond du mois. Renvoie ce qui a été donné.
function pay(state, id, give, cap, now) {
  const l = ledger(state, now);
  const got = (l.got[id] ??= {});
  const out = {};
  for (const [k, v] of Object.entries(give)) {
    const room = cap?.[k] != null ? Math.max(0, cap[k] - (got[k] ?? 0)) : v;
    const n = Math.min(v, room);
    if (n > 0) { out[k] = n; got[k] = (got[k] ?? 0) + n; }
  }
  return Object.keys(out).length ? grantReward(state, out) : {};
}

// Une fois par jour et par source.
function once(state, id, now) {
  const l = ledger(state, now);
  const today = dayKey(now);
  if (l.last[id] === today) return false;
  l.last[id] = today;
  return true;
}

function milestones(state, src, now) {
  const l = ledger(state, now);
  const n = (l.counts[src.counter] = (l.counts[src.counter] ?? 0) + 1);
  const step = src.steps.find((s) => s.at === n);
  return step ? pay(state, `${src.counter}@${n}`, step.give, null, now) : {};
}

const merge = (...list) => {
  const out = {};
  for (const r of list) for (const [k, v] of Object.entries(r ?? {})) out[k] = (out[k] ?? 0) + v;
  return out;
};

// Jour de connexion compté (refreshMissions).
export function incomeLogin(state, now = Date.now()) {
  if (!once(state, 'login', now)) return {};
  return merge(pay(state, 'loginDaily', INCOME.loginDaily.each, INCOME.loginDaily.cap, now), milestones(state, INCOME.loginMilestones, now));
}

// Bonus des missions journalières récupéré (toutes faites).
export function incomeMissions(state, now = Date.now()) {
  if (!once(state, 'missions', now)) return {};
  return merge(pay(state, 'missionsDaily', INCOME.missionsDaily.each, INCOME.missionsDaily.cap, now), milestones(state, INCOME.missionsMilestones, now));
}

// Premier boss vaincu du jour : un ticket, limité puis permanent en alternance.
export function incomeBoss(state, now = Date.now()) {
  if (!once(state, 'boss', now)) return {};
  const l = ledger(state, now);
  const n = (l.counts.boss = (l.counts.boss ?? 0) + 1);
  const [a, b] = INCOME.bossDaily.alternate;
  const key = n % 2 === 1 ? a : b;
  return pay(state, 'bossDaily', { [key]: 1 }, INCOME.bossDaily.cap, now);
}

// Premier donjon terminé du jour : un ticket familier.
export function incomeDungeon(state, now = Date.now()) {
  if (!once(state, 'dungeon', now)) return {};
  return pay(state, 'dungeonDaily', INCOME.dungeonDaily.each, INCOME.dungeonDaily.cap, now);
}

// Palier de la piste du mois récupéré.
export function incomeTrack(state, now = Date.now()) {
  return pay(state, 'trackTier', INCOME.trackTier.each, INCOME.trackTier.cap, now);
}

// Plafond mensuel d'une monnaie, toutes sources récurrentes comprises (hors événements).
export function monthlyCaps() {
  const out = {};
  const add = (k, v) => { out[k] = (out[k] ?? 0) + v; };
  for (const src of Object.values(INCOME)) {
    if (src.cap) for (const [k, v] of Object.entries(src.cap)) add(k, v);
    if (src.steps) for (const s of src.steps) for (const [k, v] of Object.entries(s.give)) add(k, v);
  }
  return out;
}

// Pour l'écran « Revenus du mois » : par groupe (login, missions, advanced, other), reçu et plafond.
export function incomeReport(state, now = Date.now()) {
  const l = ledger(state, now);
  const groups = {};
  for (const [id, src] of Object.entries(INCOME)) {
    const g = (groups[src.group] ??= { got: {}, cap: {} });
    const caps = src.cap ?? {};
    for (const [k, v] of Object.entries(caps)) g.cap[k] = (g.cap[k] ?? 0) + v;
    if (src.steps) for (const s of src.steps) for (const [k, v] of Object.entries(s.give)) g.cap[k] = (g.cap[k] ?? 0) + v;
    const got = src.steps ? src.steps.map((s) => l.got[`${src.counter}@${s.at}`] ?? {}) : [l.got[id] ?? {}];
    for (const r of got) for (const [k, v] of Object.entries(r)) g.got[k] = (g.got[k] ?? 0) + v;
  }
  return groups;
}
