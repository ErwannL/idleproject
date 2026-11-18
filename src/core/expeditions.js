import { heraldTrack } from './chronicles.js';
// Expéditions (v8.5) : les compagnons et familiers qui ne sont pas dans l'équipe partent en mission
// (1 h, 4 h ou 12 h, en temps réel : elles avancent aussi jeu fermé) et rapportent or, matériaux, gemmes,
// clés et fragments anciens. Un compagnon en expédition ne peut pas être équipé.
import { daybookTrack } from './daybook.js';
import { BALANCE, ESSENCE_SHARDS, TICKET_GEMS } from '../data/balance.js';
import { UNITS } from '../data/banners.js'; // v9.1.3 (partie B) : persos de bannière compris
import { levelForStage, referenceKillGold, zoneIndexForStage } from './combat.js';
import { unitLevel } from './companions.js'; // v9.5.0 : niveau d'équipe
import { COMPANION_ROLES } from '../data/synergies.js'; // v9.6.2
import { unitElement, zoneElement } from './elements.js'; // v9.6.2

export const EXPEDITION_RULES = { slots: 3 };
export const EXPEDITION_TYPES = [
  // v9.6.2 (7.1) : chaque mission préfère deux rôles (+30 % de butin) ; l'élément du monde actuel ajoute +20 %.
  { id: 'patrol', label: 'Patrouille', hours: 1, text: 'Or et éclats', roles: ['archer', 'assassin'] },
  { id: 'explore', label: 'Exploration', hours: 4, text: 'Or, matériaux, gemmes, parfois une clé', roles: ['mage', 'healer'] },
  { id: 'journey', label: 'Grande expédition', hours: 12, text: 'Tout, dont des clés et des fragments anciens', roles: ['guardian', 'berserker'] },
];
const RARITY_POWER = { common: 1, rare: 1.5, epic: 2.2, legendary: 3.5 };
const HOUR = 3600 * 1000;

export function emptyExpeditions() {
  return { slots: Array(EXPEDITION_RULES.slots).fill(null), done: 0, last: Array(EXPEDITION_RULES.slots).fill(null) };
}

export function expeditionType(id) {
  return EXPEDITION_TYPES.find((t) => t.id === id);
}

// Puissance d'un compagnon en expédition : rareté, étoiles et niveau.
export function expeditionPower(state, companionId) {
  const c = UNITS.find((x) => x.id === companionId);
  const owned = state.companions.owned[companionId];
  if (!c || !owned) return 0;
  return (RARITY_POWER[c.rarity] ?? 1) * (1 + 0.2 * (Math.min(owned.stars, 5) - 1)) // v9.1.3 : inchangé, le 6e exemplaire ne compte pas ici
    * (1 + 0.05 * (unitLevel(state, companionId) - 1)); // v9.5.0 : niveau d'équipe
}

// Récompense prévue (fixée au départ) : elle grandit avec la durée, la puissance et l'étape max.
export function expeditionReward(state, companionId, typeId, balance = BALANCE) {
  const type = expeditionType(typeId);
  const p = expeditionPower(state, companionId);
  if (!type || !p) return null;
  const h = type.hours;
  const stage = levelForStage(Math.max(1, state.maxStage), balance); // v9.2.0 (monde marin) : niveau de l'étape max
  const reward = {
    gold: Math.floor(referenceKillGold(stage, balance) * 40 * h * p),
    shards: Math.round(15 * h * p) + Math.round(1.5 * h * p) * ESSENCE_SHARDS,
    // v9.1.3 : les 1,5 essence/h × p deviennent 15 éclats/h × p
    gems: h >= 4 ? Math.round(3 * h * p) : 0,
    keys: h >= 12 ? 1 + (p >= 3 ? 1 : 0) : h >= 4 && p >= 2 ? 1 : 0,
    fragments: h >= 12 ? Math.round((2 + stage / 60) * p) : h >= 4 ? Math.round((stage / 150) * p) : 0,
  };
  if (h >= 12 && p >= 3.5) reward.gems += TICKET_GEMS; // v9.1.3 : ancien ticket
  const k = expeditionAffinity(state, companionId, typeId).mult; // v9.6.2 : rôle et élément adaptés
  if (k !== 1) for (const key of ['gold', 'shards', 'gems', 'fragments']) if (reward[key]) reward[key] = Math.round(reward[key] * k);
  return Object.fromEntries(Object.entries(reward).filter(([, v]) => v > 0));
}

// v9.6.2 : bonus d'un compagnon pour une mission (rôle préféré : +30 %, élément du monde actuel : +20 %).
export function expeditionAffinity(state, companionId, typeId) {
  const type = expeditionType(typeId);
  const role = type?.roles?.includes(COMPANION_ROLES[companionId]);
  const el = unitElement(companionId) && unitElement(companionId) === zoneElement(zoneIndexForStage(Math.max(1, state.maxStage)));
  return { role, element: el, mult: (role ? 1.3 : 1) * (el ? 1.2 : 1) };
}

// v9.6.2 (7.5) : « Tout envoyer » — chaque place libre reçoit le compagnon libre le mieux adapté (mission choisie).
export function sendAllExpeditions(state, typeId = 'explore', now = Date.now(), balance = BALANCE) {
  const ex = state.expeditions;
  if (!ex) return 0;
  let n = 0;
  ex.slots.forEach((run, slot) => {
    if (run) return;
    const best = availableForExpedition(state).map((c) => ({ c, g: expeditionReward(state, c.id, typeId, balance)?.gold ?? 0 })).sort((a, b) => b.g - a.g)[0];
    if (best && startExpedition(state, slot, best.c.id, typeId, now, balance)) n += 1;
  });
  return n;
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
  return UNITS.filter((c) => state.companions.owned[c.id] && !state.companions.owned[c.id].trial && !state.companions.equipped.includes(c.id) && !away.has(c.id));
}

export function startExpedition(state, slot, companionId, typeId, now = Date.now(), balance = BALANCE) {
  const ex = state.expeditions;
  if (!ex || slot < 0 || slot >= ex.slots.length || ex.slots[slot]) return false;
  if (!availableForExpedition(state).some((c) => c.id === companionId)) return false;
  const reward = expeditionReward(state, companionId, typeId, balance);
  if (!reward) return false;
  ex.slots[slot] = { companionId, type: typeId, start: now, end: now + expeditionType(typeId).hours * HOUR, reward };
  daybookTrack(state, 'expeditions', 1, now); // v9.8 : Carnet du jour
  if (!ex.last) ex.last = Array(ex.slots.length).fill(null);
  ex.last[slot] = { companionId, type: typeId }; // v9.1.0 : « Repartir » refait la même expédition
  heraldTrack(state, 'expeditions', 1); // v9.11 (7)
  return true;
}

// v9.1.0 : « Repartir » — la dernière expédition de chaque place libre, avec le même compagnon et la même durée
// (récompense recalculée au départ). Renvoie le nombre d'expéditions relancées.
export function relaunchExpeditions(state, now = Date.now(), balance = BALANCE) {
  const ex = state.expeditions;
  let n = 0;
  ex.slots.forEach((run, slot) => {
    const last = ex.last?.[slot];
    if (!run && last && startExpedition(state, slot, last.companionId, last.type, now, balance)) n += 1;
  });
  return n;
}

// Places dont la dernière expédition peut repartir telle quelle (place libre, compagnon disponible).
export function relaunchable(state) {
  const free = new Set(availableForExpedition(state).map((c) => c.id));
  return (state.expeditions?.last ?? []).filter((l, slot) => l && !state.expeditions.slots[slot] && free.has(l.companionId)).length;
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
    for (const [k, v] of Object.entries(s.reward ?? {})) {
      if (!Number.isFinite(v) || !(v > 0)) continue;
      if (['gold', 'shards', 'gems', 'keys', 'fragments'].includes(k)) reward[k] = (reward[k] ?? 0) + v;
      else if (k === 'essence') reward.shards = (reward.shards ?? 0) + v * ESSENCE_SHARDS; // v9.1.3
      else if (k === 'tickets') reward.gems = (reward.gems ?? 0) + v * TICKET_GEMS; // v9.1.3 : ancien ticket en gemmes
    }
    seen.add(s.companionId);
    out.slots[i] = { companionId: s.companionId, type: s.type, start: s.start, end: s.end, reward };
  });
  (Array.isArray(raw.last) ? raw.last : []).slice(0, out.slots.length).forEach((l, i) => {
    if (l && typeof l === 'object' && state.companions.owned[l.companionId] && expeditionType(l.type)) out.last[i] = { companionId: l.companionId, type: l.type };
  });
  return out;
}
