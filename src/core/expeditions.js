// Expéditions (v8.5) : les compagnons et familiers qui ne sont pas dans l'équipe partent en mission
// (1 h, 4 h ou 12 h, en temps réel : elles avancent aussi jeu fermé) et rapportent or, matériaux, gemmes,
// clés et fragments anciens. Un compagnon en expédition ne peut pas être équipé.
import { BALANCE } from '../data/balance.js';
import { COMPANIONS } from '../data/companions.js';
import { referenceKillGold } from './combat.js';

export const EXPEDITION_RULES = { slots: 3 };
export const EXPEDITION_TYPES = [
  { id: 'patrol', label: 'Patrouille', hours: 1, text: 'Or et éclats' },
  { id: 'explore', label: 'Exploration', hours: 4, text: 'Or, matériaux, gemmes, parfois une clé' },
  { id: 'journey', label: 'Grande expédition', hours: 12, text: 'Tout, dont des clés et des fragments anciens' },
];
const RARITY_POWER = { common: 1, rare: 1.5, epic: 2.2, legendary: 3.5 };
const HOUR = 3600 * 1000;

export function emptyExpeditions() {
  return { slots: Array(EXPEDITION_RULES.slots).fill(null), done: 0 };
}

export function expeditionType(id) {
  return EXPEDITION_TYPES.find((t) => t.id === id);
}

// Puissance d'un compagnon en expédition : rareté, étoiles et niveau.
export function expeditionPower(state, companionId) {
  const c = COMPANIONS.find((x) => x.id === companionId);
  const owned = state.companions.owned[companionId];
  if (!c || !owned) return 0;
  return (RARITY_POWER[c.rarity] ?? 1) * (1 + 0.2 * (owned.stars - 1)) * (1 + 0.05 * (owned.level - 1));
}

// Récompense prévue (fixée au départ) : elle grandit avec la durée, la puissance et l'étape max.
export function expeditionReward(state, companionId, typeId, balance = BALANCE) {
  const type = expeditionType(typeId);
  const p = expeditionPower(state, companionId);
  if (!type || !p) return null;
  const h = type.hours;
  const stage = Math.max(1, state.maxStage);
  const reward = {
    gold: Math.floor(referenceKillGold(stage, balance) * 40 * h * p),
    shards: Math.round(15 * h * p),
    essence: Math.round(1.5 * h * p),
    gems: h >= 4 ? Math.round(3 * h * p) : 0,
    keys: h >= 12 ? 1 + (p >= 3 ? 1 : 0) : h >= 4 && p >= 2 ? 1 : 0,
    fragments: h >= 12 ? Math.round((2 + stage / 60) * p) : h >= 4 ? Math.round((stage / 150) * p) : 0,
    tickets: h >= 12 && p >= 3.5 ? 1 : 0,
  };
  return Object.fromEntries(Object.entries(reward).filter(([, v]) => v > 0));
}

export function companionsAway(state) {
  return new Set((state.expeditions?.slots ?? []).filter(Boolean).map((s) => s.companionId));
}

export function isAway(state, companionId) {
  return companionsAway(state).has(companionId);
}

// Compagnons disponibles : obtenus, hors de l'équipe et pas déjà partis.
export function availableForExpedition(state) {
  const away = companionsAway(state);
  return COMPANIONS.filter((c) => state.companions.owned[c.id] && !state.companions.equipped.includes(c.id) && !away.has(c.id));
}

export function startExpedition(state, slot, companionId, typeId, now = Date.now(), balance = BALANCE) {
  const ex = state.expeditions;
  if (!ex || slot < 0 || slot >= ex.slots.length || ex.slots[slot]) return false;
  if (!availableForExpedition(state).some((c) => c.id === companionId)) return false;
  const reward = expeditionReward(state, companionId, typeId, balance);
  if (!reward) return false;
  ex.slots[slot] = { companionId, type: typeId, start: now, end: now + expeditionType(typeId).hours * HOUR, reward };
  return true;
}

export function expeditionDone(run, now = Date.now()) {
  return Boolean(run) && now >= run.end;
}

export function readyExpeditions(state, now = Date.now()) {
  return (state.expeditions?.slots ?? []).filter((s) => expeditionDone(s, now)).length;
}

// Retour : la récompense est donnée si la mission est finie (rappel anticipé : rien).
export function claimExpedition(state, slot, now = Date.now(), grant) {
  const run = state.expeditions?.slots[slot];
  if (!run) return null;
  state.expeditions.slots[slot] = null;
  if (!expeditionDone(run, now)) return {};
  state.expeditions.done += 1;
  return grant(state, run.reward);
}

export function sanitizeExpeditions(raw, state) {
  const out = emptyExpeditions();
  if (!raw || typeof raw !== 'object') return out;
  out.done = Number.isInteger(raw.done) && raw.done > 0 ? raw.done : 0;
  const seen = new Set();
  (Array.isArray(raw.slots) ? raw.slots : []).slice(0, out.slots.length).forEach((s, i) => {
    if (!s || typeof s !== 'object' || !state.companions.owned[s.companionId] || seen.has(s.companionId) || !expeditionType(s.type)) return;
    if (!Number.isFinite(s.start) || !Number.isFinite(s.end) || s.end < s.start) return;
    const reward = {};
    for (const [k, v] of Object.entries(s.reward ?? {})) if (['gold', 'shards', 'essence', 'gems', 'keys', 'fragments', 'tickets'].includes(k) && Number.isFinite(v) && v > 0) reward[k] = v;
    seen.add(s.companionId);
    out.slots[i] = { companionId: s.companionId, type: s.type, start: s.start, end: s.end, reward };
  });
  return out;
}
