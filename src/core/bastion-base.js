// v10.3 (partie 10) : le Bastion — règles de base, sans dépendance vers le combat, le butin ou la Forge (ce fichier
// est lu par core/bonuses.js, core/stats.js, core/companions.js, core/forge.js… : il ne doit importer que des données).
// core/bastion.js le complète (coûts, commandes forgées, pas du jeu) et réexporte tout : l'interface importe bastion.js.
//  - l'état vit dans `state.bastion` : { buildings: { forge: { level, worker, build }, … }, research, orders, … } ;
//    absent ou vide = Bastion pas encore ouvert ;
//  - tout avance en temps réel (jeu fermé compris) : chaque travail garde ce qu'il lui RESTE à faire (`left`, en ms de
//    travail) et `advance(state, now)` l'avance depuis `bastion.at` à la vitesse de l'ouvrier en place. Retirer un
//    ouvrier met donc un chantier en pause, sans calcul de date à refaire ;
//  - jamais d'attente obligatoire pour l'histoire : aucune donnée de campagne ne lit ce fichier.
import {
  BASTION_MAX_LEVEL, BASTION_UNLOCK_STAGE, BUILDINGS, FORGE_PERKS, LIBRARY, MINE, ORDER_TIERS, RESEARCH, RESEARCH_BRANCHES,
  RESEARCH_STEPS, RESEARCH_UNLOCK_LEVEL, TRADES, TRADE_POST, TRAINING, WORKER_RULES,
} from '../data/bastion.js';
import { UNITS } from '../data/banners.js';
import { RARITIES, SLOTS } from '../data/items.js';
import { COMPANION_ROLES } from '../data/synergies.js';

export const HOUR = 3_600_000;
export const MINUTE = 60_000;

export const BASTION_AWAY_MS = 60_000; // au-delà : le joueur était parti → rappel au retour (Carnet, Sceau)
export const BASTION_SEAL_MS = 90_000; // le Sceau dit la chose une fois, pendant ce temps au plus

// Le Bastion s'ouvre à l'étape record 40 (jamais avant : un nouveau joueur a déjà assez à apprendre).
export function bastionOpen(state) {
  return Math.max(state?.maxStage ?? 1, state?.records?.bestStage ?? 1) >= BASTION_UNLOCK_STAGE;
}

export function buildingLevel(state, id) {
  return Math.max(0, Math.floor(state?.bastion?.buildings?.[id]?.level ?? 0));
}

// Niveau de la Forge du forgeron (0 = pas encore construite : la Forge garde ses chiffres de base).
export const forgeLevel = (state) => buildingLevel(state, 'forge');

// Ce que la Forge du forgeron apporte à un niveau donné.
export function forgePerks(state, level = forgeLevel(state)) {
  const p = FORGE_PERKS;
  const L = Math.max(0, level);
  return {
    level: L,
    fusionPoints: L * p.fusionPointsPerLevel,
    fusionCap: p.fusionCap,
    maxUpgradeBonus: L * p.maxUpgradePerLevel,
    upgradeCostPct: Math.min(p.upgradeCostPctCap, L * p.upgradeCostPctPerLevel),
    orderSlots: p.orderSlotsAt.filter((at) => L >= at).length,
    orderCostPct: Math.min(p.orderCostPctCap, L * p.orderCostPctPerLevel),
    legendaryOrders: L >= p.legendaryOrderLevel,
  };
}

// ---------------------------------------------------------------- état

const LEVELED = BUILDINGS.filter((b) => !b.existing);
export const buildingDef = (id) => BUILDINGS.find((b) => b.id === id) ?? null;
const emptyBuilding = (def) => ({ level: def.startLevel ?? 0, worker: null, build: null });

export function emptyBastion(now = Date.now()) {
  return {
    at: now, openedAt: now,
    buildings: Object.fromEntries(LEVELED.map((b) => [b.id, emptyBuilding(b)])),
    research: { levels: {}, active: [] },
    orders: [], nextOrder: 1,
    stock: { mine: 0, training: 0 },
    trade: { day: '', used: 0 },
    news: [], notices: [], cards: [],
    kicked: 0, tips: [], away: null, // v10.4 (6) : démarrage fait, bulles vues, « Pendant ton absence » (core/bastion-start.js)
  };
}

// L'état du Bastion, ou null tant qu'il n'est pas ouvert.
export function bastionOf(state) {
  return state?.bastion?.buildings?.forge ? state.bastion : null;
}

// Ouvre le Bastion quand l'étape 40 est atteinte (Forge du forgeron offerte au niveau 1). Renvoie vrai à l'ouverture.
export function ensureBastion(state, now = Date.now()) {
  if (bastionOf(state) || !bastionOpen(state)) return false;
  state.bastion = emptyBastion(now);
  return true;
}

const bestStage = (state) => Math.max(state?.maxStage ?? 1, state?.records?.bestStage ?? 1);
// Même règle que l'onglet Expéditions (ui.js) : 5 compagnons, ou une expédition déjà faite.
const expeditionsOpen = (state) => Object.keys(state.companions?.owned ?? {}).length >= 5
  || (state.expeditions?.slots ?? []).some(Boolean) || (state.expeditions?.done ?? 0) > 0;

// Niveau du Bastion = somme des niveaux des bâtiments.
export function bastionLevel(state) {
  return LEVELED.reduce((t, b) => t + buildingLevel(state, b.id), 0);
}

// Bâtiment disponible ? Un seul à l'ouverture, puis un par un : étape record atteinte ET bâtiment précédent construit.
// Renvoie { available, reason } (reason : la condition, en une ligne, quand il est verrouillé).
export function buildingAccess(state, id) {
  const def = buildingDef(id);
  if (!def || !bastionOf(state)) return { available: false, reason: `S'ouvre à l'étape ${BASTION_UNLOCK_STAGE}` };
  if (def.existing) return expeditionsOpen(state) ? { available: true, reason: '' } : { available: false, reason: 'S\'ouvre avec 5 compagnons' };
  if (buildingLevel(state, id) > 0) return { available: true, reason: '' };
  if (def.bastionLevel) {
    return bastionLevel(state) >= def.bastionLevel ? { available: true, reason: '' } : { available: false, reason: `Bastion niveau ${def.bastionLevel} requis` };
  }
  if (bestStage(state) < def.stage) return { available: false, reason: `Arrive à l'étape ${def.stage}` };
  const staged = LEVELED.filter((b) => b.stage);
  const prev = staged[staged.indexOf(def) - 1];
  if (prev && buildingLevel(state, prev.id) < 1) return { available: false, reason: `Construis d'abord : ${prev.name}` };
  return { available: true, reason: '' };
}

// ---------------------------------------------------------------- ouvriers

const unit = (id) => UNITS.find((c) => c.id === id) ?? null;
const ROLE_TRADE = { guardian: 'trainer', archer: 'miner', mage: 'scholar', assassin: 'miner', healer: 'scholar', berserker: 'smith' };
// Métier d'un compagnon : son champ `trade` (data/companions.js), sinon celui de son rôle (persos de bannière).
export function tradeOf(companionId) {
  const c = unit(companionId);
  return c?.trade ?? ROLE_TRADE[COMPANION_ROLES[companionId]] ?? null;
}

export function workerSlots(state) {
  const lv = bastionLevel(state);
  return WORKER_RULES.slotsAt.filter((at) => lv >= at).length;
}
export function workersPlaced(state) {
  return Object.values(bastionOf(state)?.buildings ?? {}).filter((b) => b.worker).length;
}
export const workerOf = (state, buildingId) => bastionOf(state)?.buildings?.[buildingId]?.worker ?? null;
export function workerBuilding(state, companionId) {
  const b = bastionOf(state);
  if (!b || !companionId) return null;
  return Object.keys(b.buildings).find((id) => b.buildings[id].worker === companionId) ?? null;
}

const inTeam = (state, id) => (state.companions?.equipped ?? []).includes(id);
const away = (state, id) => (state.expeditions?.slots ?? []).some((s) => s?.companionId === id);
// Un ouvrier est un compagnon possédé (kind 'ally', pas à l'essai) qui n'est ni dans l'équipe, ni en expédition.
export function canWork(state, companionId) {
  const c = unit(companionId);
  const owned = state.companions?.owned?.[companionId];
  return Boolean(c && c.kind === 'ally' && owned && !owned.trial && !inTeam(state, companionId) && !away(state, companionId));
}
// Compagnons qu'on peut poser sur un bâtiment (ceux déjà posés ailleurs compris : ils changent de poste).
export function availableWorkers(state) {
  return UNITS.filter((c) => canWork(state, c.id));
}

// Bonus d'un ouvrier dans un bâtiment : rareté (+5 à +20 %), métier (+20 % au bon bâtiment), recherche « Ouvriers appliqués ».
export function workerBonus(state, companionId, buildingId) {
  const c = unit(companionId);
  if (!c) return { rarityPct: 0, tradePct: 0, researchPct: 0, totalPct: 0, factor: 1, match: false };
  const rarityPct = WORKER_RULES.rarityBonusPct[c.rarity] ?? 0;
  const match = Boolean(buildingId) && buildingDef(buildingId)?.trade === tradeOf(companionId);
  const tradePct = match ? WORKER_RULES.tradeBonusPct : 0;
  const researchPct = researchEffects(state).workerPct ?? 0;
  const totalPct = rarityPct + tradePct + researchPct;
  return { rarityPct, tradePct, researchPct, totalPct, factor: 1 + totalPct / 100, match };
}

// Vitesse de production d'un bâtiment : 50 % sans ouvrier, sinon 100 % + bonus de l'ouvrier.
export function productionFactor(state, buildingId) {
  const w = workerOf(state, buildingId);
  return w ? workerBonus(state, w, buildingId).factor : WORKER_RULES.idlePct / 100;
}
// Vitesse d'un chantier : à l'arrêt sans ouvrier.
const buildFactor = (state, buildingId) => (workerOf(state, buildingId) ? productionFactor(state, buildingId) : 0);

// Pose un ouvrier sur un bâtiment (il quitte son ancien poste ; l'ouvrier déjà en place est remplacé).
// Renvoie null si c'est fait, sinon la raison du refus.
export function assignWorker(state, buildingId, companionId, now = Date.now()) {
  const b = bastionOf(state);
  const def = buildingDef(buildingId);
  if (!b || !def || def.existing || !buildingAccess(state, buildingId).available) return 'Ce bâtiment n\'est pas encore ouvert.';
  if (!state.companions?.owned?.[companionId] || unit(companionId)?.kind !== 'ally') return 'Seuls tes compagnons peuvent travailler au Bastion.';
  if (inTeam(state, companionId)) return 'Ce compagnon est dans l\'équipe : retire-le d\'abord.';
  if (away(state, companionId)) return 'Ce compagnon est en expédition.';
  if (!canWork(state, companionId)) return 'Ce compagnon ne peut pas travailler.';
  advance(state, now);
  const slot = b.buildings[buildingId];
  if (slot.worker === companionId) return null;
  const from = workerBuilding(state, companionId);
  if (!from && !slot.worker && workersPlaced(state) >= workerSlots(state)) return `Toutes les places d'ouvrier sont prises (${workerSlots(state)}).`;
  if (from) b.buildings[from].worker = null;
  slot.worker = companionId;
  return null;
}

export function removeWorker(state, buildingId, now = Date.now()) {
  const slot = bastionOf(state)?.buildings?.[buildingId];
  if (!slot?.worker) return false;
  advance(state, now);
  slot.worker = null;
  return true;
}

// Un compagnon rejoint l'équipe ou part en expédition : il quitte son bâtiment. Appelé par core/companions.js et
// core/expeditions.js ; `why` : 'team' ou 'expedition'. Renvoie l'avis { companionId, building, why, paused } ou null.
// L'avis est aussi gardé dans `bastion.notices` : l'interface le dit au joueur (une fois).
// Sans `now` (core/companions.js ne connaît pas l'heure), le travail compte jusqu'au dernier pas du Bastion (une seconde).
export function releaseWorker(state, companionId, why = 'team', now = null) {
  const b = bastionOf(state);
  const from = workerBuilding(state, companionId);
  if (!b || !from) return null;
  if (now !== null) advance(state, now);
  const paused = Boolean(b.buildings[from].build);
  b.buildings[from].worker = null;
  const notice = { companionId, building: from, why, paused };
  b.notices = [...(b.notices ?? []), notice].slice(-6);
  return notice;
}

// Filet de sécurité (équipe changée par un Build, une équipe conseillée, une sauvegarde abîmée…) : aucun ouvrier
// n'est aussi dans l'équipe ou en expédition.
export function reconcileWorkers(state, now = Date.now()) {
  const b = bastionOf(state);
  if (!b) return [];
  const out = [];
  for (const slot of Object.values(b.buildings)) {
    if (!slot.worker) continue;
    if (canWork(state, slot.worker)) continue;
    const why = away(state, slot.worker) ? 'expedition' : inTeam(state, slot.worker) ? 'team' : 'gone';
    const n = releaseWorker(state, slot.worker, why, now);
    if (n) out.push(n); else slot.worker = null;
  }
  return out;
}

// Texte de l'avertissement (toast) quand un ouvrier quitte son poste.
export function workerNoticeText(notice) {
  const c = unit(notice.companionId);
  const def = buildingDef(notice.building);
  const where = notice.why === 'expedition' ? 'part en expédition' : notice.why === 'team' ? 'rejoint l\'équipe' : 'n\'est plus disponible';
  return `${c?.name ?? 'Ton ouvrier'} ${where} et quitte ${def?.the ?? 'son bâtiment'}${notice.paused ? ' : le chantier est en pause' : ' : production à 50 %'}`;
}
export function takeNotices(state) {
  const b = bastionOf(state);
  if (!b?.notices?.length) return [];
  const out = b.notices;
  b.notices = [];
  return out;
}

// ---------------------------------------------------------------- chantiers

// Temps réel restant d'un travail (ms) à la vitesse actuelle ; Infinity s'il est en pause.
const remaining = (job, factor) => (factor > 0 ? job.left / factor : Infinity);
export function buildRemaining(state, id) {
  const job = bastionOf(state)?.buildings?.[id]?.build;
  return job ? remaining(job, buildFactor(state, id)) : null;
}

// ---------------------------------------------------------------- production (Mine, Camp d'entraînement)

const PRODUCERS = { mine: { rule: MINE, resource: 'shards' }, training: { rule: TRAINING, resource: 'grimoire' } };
const capHours = (rule, level) => rule.capHours[0] + ((rule.capHours[1] - rule.capHours[0]) * (Math.max(1, level) - 1)) / (BASTION_MAX_LEVEL - 1);
// Production d'un bâtiment à un niveau donné : { perHour (sans ouvrier ni bonus), cap, capHours, resource } ou null.
export function productionOf(state, id, level = buildingLevel(state, id)) {
  const p = PRODUCERS[id];
  if (!p || level < 1) return null;
  const boost = id === 'mine' ? 1 + (researchEffects(state).minePct ?? 0) / 100 : 1;
  const perHour = (p.rule.basePerHour + p.rule.perLevel * level) * boost;
  const hours = capHours(p.rule, level);
  return { perHour, capHours: hours, cap: Math.max(1, Math.floor(perHour * hours)), resource: p.resource };
}
export const stockOf = (state, id) => Math.max(0, bastionOf(state)?.stock?.[id] ?? 0);

// Récupère le stock d'un bâtiment (unités entières). Renvoie { resource, amount } ou null.
export function collectStock(state, id, now = Date.now()) {
  const b = bastionOf(state);
  const prod = productionOf(state, id);
  if (!b || !prod) return null;
  advance(state, now);
  const amount = Math.floor(b.stock[id] ?? 0);
  if (amount < 1) return null;
  b.stock[id] -= amount;
  state.materials[prod.resource] = (state.materials[prod.resource] ?? 0) + amount;
  return { resource: prod.resource, amount };
}

// ---------------------------------------------------------------- recherches (Bibliothèque)

export const researchDef = (id) => RESEARCH.find((r) => r.id === id) ?? null;
export const researchLevel = (state, id) => {
  const def = researchDef(id);
  return def ? Math.max(0, Math.min(def.max, Math.floor(bastionOf(state)?.research?.levels?.[id] ?? 0))) : 0;
};
export const branchOf = (branch) => RESEARCH.filter((r) => r.branch === branch);

// Effets cumulés de toutes les recherches : { damagePct, maxHpPct, goldPct, critChance, … }.
export function researchEffects(state) {
  const levels = state?.bastion?.research?.levels;
  const out = {};
  if (!levels) return out;
  for (const r of RESEARCH) {
    const lv = Math.max(0, Math.min(r.max, Math.floor(levels[r.id] ?? 0)));
    if (!lv) continue;
    for (const [k, v] of Object.entries(r.effect)) out[k] = Math.round(((out[k] ?? 0) + v * lv) * 100) / 100;
  }
  return out;
}
// Part des recherches lue par les statistiques du héros (core/bonuses.js, source « Recherches »).
const HERO_KEYS = ['damagePct', 'maxHpPct', 'critChance', 'armor', 'regenPct', 'goldPct', 'xpPct'];
export function researchBonuses(state) {
  const all = researchEffects(state);
  return Object.fromEntries(HERO_KEYS.filter((k) => all[k]).map((k) => [k, all[k]]));
}
// Total au niveau maximal (affichage et tests des plafonds).
export function researchCaps() {
  const out = {};
  for (const r of RESEARCH) for (const [k, v] of Object.entries(r.effect)) out[k] = Math.round(((out[k] ?? 0) + v * r.max) * 100) / 100;
  return out;
}

export function researchSlots(state) {
  const lv = buildingLevel(state, 'library');
  return lv < 1 ? 0 : lv >= LIBRARY.secondSlotLevel ? 2 : 1;
}

// État d'une recherche pour l'écran : { def, level, active, unlocked, lockedBy, maxed }.
export function researchStatus(state, id) {
  const def = researchDef(id);
  const list = branchOf(def.branch);
  const prev = list[list.indexOf(def) - 1];
  const unlocked = !prev || researchLevel(state, prev.id) >= Math.min(RESEARCH_UNLOCK_LEVEL, prev.max);
  const active = (bastionOf(state)?.research?.active ?? []).find((a) => a.id === id) ?? null;
  return { def, level: researchLevel(state, id), active, unlocked, lockedBy: unlocked ? null : prev, maxed: researchLevel(state, id) >= def.max };
}

export function researchRemaining(state, id) {
  const job = (bastionOf(state)?.research?.active ?? []).find((a) => a.id === id);
  return job ? remaining(job, productionFactor(state, 'library')) : null;
}

// ---------------------------------------------------------------- commandes du forgeron

export const orderTier = (id) => ORDER_TIERS.find((t) => t.id === id) ?? null;
export const orderSlots = (state) => forgePerks(state).orderSlots;
export function orderTierOpen(state, tierId) {
  const t = orderTier(tierId);
  return Boolean(t) && forgeLevel(state) >= (t.forgeLevel ?? 1);
}
// Chances de rareté du résultat, en % : [{ rarity, pct }].
export function orderChances(tierId) {
  const t = orderTier(tierId);
  const total = Object.values(t?.weights ?? {}).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(t?.weights ?? {}).map(([rarity, w]) => ({ rarity, pct: Math.round((w / total) * 100) }));
}
export function ordersInProgress(state) {
  return (bastionOf(state)?.orders ?? []).filter((o) => !o.ready);
}
export function ordersReady(state) {
  return (bastionOf(state)?.orders ?? []).filter((o) => o.ready);
}

export function orderRemaining(state, order) {
  return order && !order.ready ? remaining(order, productionFactor(state, 'forge')) : null;
}
export const orderLabel = (order) => `${SLOTS[order.slot] ?? 'Objet'} ${order.item ? RARITIES.find((r) => r.id === order.item.rarity)?.label ?? '' : orderTier(order.tier)?.label ?? ''}`.trim();

// ---------------------------------------------------------------- Comptoir

const dayKey = (now) => { const d = new Date(now); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export function tradeLeft(state, now = Date.now()) {
  const b = bastionOf(state);
  const lv = buildingLevel(state, 'trade');
  if (!b || lv < 1) return 0;
  const max = TRADE_POST.perDay.base + TRADE_POST.perDay.perLevel * lv;
  return Math.max(0, max - (b.trade?.day === dayKey(now) ? b.trade.used ?? 0 : 0));
}
// Taux d'un échange au niveau du Comptoir : { give, get, giveAmount, getAmount }. Acheter coûte moins cher, vendre rapporte plus.
export function tradeOffer(state, offerId, level = buildingLevel(state, 'trade')) {
  const o = TRADE_POST.offers.find((x) => x.id === offerId);
  if (!o) return null;
  const k = (TRADE_POST.ratePctPerLevel / 100) * Math.max(0, level - 1);
  return o.sell
    ? { ...o, giveAmount: 1, getAmount: Math.round(o.price * (1 + k)) }
    : { ...o, giveAmount: Math.max(1, Math.round(o.price * (1 - k))), getAmount: 1 };
}
export function trade(state, offerId, now = Date.now()) {
  const b = bastionOf(state);
  const o = tradeOffer(state, offerId);
  if (!b || !o || tradeLeft(state, now) < 1 || (state.materials?.[o.give] ?? 0) < o.giveAmount) return null;
  if (b.trade?.day !== dayKey(now)) b.trade = { day: dayKey(now), used: 0 };
  b.trade.used += 1;
  state.materials[o.give] -= o.giveAmount;
  state.materials[o.get] = (state.materials[o.get] ?? 0) + o.getAmount;
  return o;
}

// ---------------------------------------------------------------- le temps passe

// Garde un rappel pour le retour du joueur (Carnet, Sceau) : { kind, ref, text }.
export function pushNews(state, kind, ref, text, now = Date.now()) {
  const b = bastionOf(state);
  if (b) b.news = [...(b.news ?? []), { kind, ref, text, at: now, seal: 0, book: false }].slice(-12);
}

// Avance tout le Bastion jusqu'à `now` : production, chantiers, recherches, commandes. Renvoie les événements
// { type: 'build' | 'research', ref, text, away } — `away` : le joueur n'était pas là (plus d'une minute, ou fenêtre
// masquée) : l'événement devient un rappel (Carnet, Sceau) au lieu d'un simple message. Une commande arrivée au bout
// est seulement marquée (`left` à 0, `away` gardé) : core/bastion.js forge l'objet et le livre (`settle`).
export function advance(state, now = Date.now(), { away: forcedAway = false } = {}) {
  const b = bastionOf(state);
  if (!b) return [];
  const dt = Number.isFinite(now - b.at) ? Math.max(0, now - b.at) : 0; // horloge reculée : rien n'avance
  b.at = now;
  if (!(dt > 0)) return [];
  const wasAway = forcedAway || dt >= BASTION_AWAY_MS;
  const events = [];
  const say = (kind, ref, text) => {
    events.push({ type: kind, ref, text, away: wasAway });
    if (wasAway) pushNews(state, kind, ref, text, now);
  };
  // Production d'abord (au niveau d'avant les chantiers finis pendant l'absence).
  for (const id of Object.keys(PRODUCERS)) {
    const prod = productionOf(state, id);
    if (!prod) continue;
    b.stock[id] = Math.min(prod.cap, Math.max(0, b.stock[id] ?? 0) + (prod.perHour * productionFactor(state, id) * dt) / HOUR);
  }
  for (const [id, slot] of Object.entries(b.buildings)) {
    if (!slot.build) continue;
    slot.build.left -= dt * buildFactor(state, id);
    if (slot.build.left > 0) continue;
    slot.level = Math.min(BASTION_MAX_LEVEL, slot.level + 1);
    slot.build = null;
    say('build', id, `${buildingDef(id).name} niveau ${slot.level}`);
  }
  const lib = productionFactor(state, 'library');
  for (const job of [...b.research.active]) {
    job.left -= dt * lib;
    if (job.left > 0) continue;
    const def = researchDef(job.id);
    b.research.levels[job.id] = Math.min(def.max, researchLevel(state, job.id) + 1);
    b.research.active = b.research.active.filter((a) => a !== job);
    say('research', job.id, `${def.name} niveau ${b.research.levels[job.id]}`);
  }
  const forge = productionFactor(state, 'forge');
  for (const order of b.orders) {
    if (order.ready || order.left <= 0) continue;
    order.left -= dt * forge;
    if (order.left <= 0) { order.left = 0; order.away = wasAway; }
  }
  return events;
}

// Bâtiments arrivés dont la carte de déblocage n'a pas encore été montrée (une à la fois, dans l'ordre).
export function nextBuildingCard(state) {
  const b = bastionOf(state);
  if (!b) return null;
  const def = BUILDINGS.find((x) => !x.existing && buildingAccess(state, x.id).available && !(b.cards ?? []).includes(x.id));
  return def ?? null;
}
export function markBuildingCard(state, id) {
  const b = bastionOf(state);
  if (b && !(b.cards ?? []).includes(id)) b.cards = [...(b.cards ?? []), id];
}

// ---------------------------------------------------------------- rappels : chacun dit la chose UNE seule fois

const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

// Carnet : « Le Bastion a fini 2 chantiers » (chantiers et recherches finis, commandes prêtes), ou null.
export function bastionDaybookLine(state) {
  const list = (bastionOf(state)?.news ?? []).filter((n) => !n.book);
  if (!list.length) return null;
  const works = list.filter((n) => n.kind !== 'order').length;
  const orders = list.length - works;
  if (works && orders) return `Le Bastion a fini ${plural(works, 'chantier')} et ${plural(orders, 'commande')}`;
  return works ? `Le Bastion a fini ${plural(works, 'chantier')}` : `Le Bastion a fini ${plural(orders, 'commande')}`;
}

// Sceau, une fois par retour : « Commande prête : Arme Épique » (commande d'abord, puis chantier, puis recherche).
// Renvoie la consigne { id: 'bastion', text, action, value, why } ou null. Tant que l'interface ne l'a pas montrée
// (bastionSealShown), elle reste proposée ; une fois montrée, elle s'efface d'elle-même après BASTION_SEAL_MS.
export function bastionSeal(state, now = Date.now()) {
  const list = (bastionOf(state)?.news ?? []).filter((n) => n.seal === 0 || n.seal > now);
  if (!list.length) return null;
  const pick = list.find((n) => n.kind === 'order') ?? list.find((n) => n.kind === 'build') ?? list[0];
  const head = pick.kind === 'order' ? 'Commande prête' : pick.kind === 'build' ? 'Chantier terminé' : 'Recherche terminée';
  const more = list.length - 1;
  return {
    id: 'bastion', text: `${head} : ${pick.text}`, action: 'bastion-open',
    value: pick.kind === 'order' ? 'forge' : pick.kind === 'research' ? 'research' : pick.ref,
    why: more > 1 ? `Et ${more} autres nouvelles du Bastion` : more === 1 ? 'Et 1 autre nouvelle du Bastion' : pick.kind === 'order' ? 'Ton objet t\'attend dans le coffre de butin' : 'Le Bastion a travaillé pendant ton absence',
  };
}
// L'interface vient de montrer la consigne du Bastion : toutes les nouvelles du moment sont dites (une fois par retour).
export function bastionSealShown(state, now = Date.now()) {
  for (const n of bastionOf(state)?.news ?? []) if (n.seal === 0) n.seal = now + BASTION_SEAL_MS;
  prune(state, now);
}
// Le joueur a vu : `channel` 'book' (Carnet lu), 'seal' (Sceau touché) ou rien (écran du Bastion ouvert : tout est dit).
export function ackBastionNews(state, channel = null, now = Date.now()) {
  for (const n of bastionOf(state)?.news ?? []) {
    if (channel !== 'seal') n.book = true;
    if (channel !== 'book') n.seal = 1;
  }
  prune(state, now);
}
function prune(state, now) {
  const b = bastionOf(state);
  if (b) b.news = (b.news ?? []).filter((n) => !(n.book && n.seal !== 0 && n.seal <= now));
}

// Notification du téléphone (core/notify-plan.js) : quand tous les travaux en cours seront finis. { at, title, body } ou null.
export function bastionNotification(state, now = Date.now()) {
  const b = bastionOf(state);
  if (!b) return null;
  const ends = [];
  for (const id of Object.keys(b.buildings)) { const r = buildRemaining(state, id); if (r !== null && Number.isFinite(r)) ends.push(r); }
  for (const job of b.research.active) { const r = researchRemaining(state, job.id); if (Number.isFinite(r)) ends.push(r); }
  const orders = ordersInProgress(state);
  for (const o of orders) { const r = orderRemaining(state, o); if (Number.isFinite(r)) ends.push(r); }
  if (!ends.length) return null;
  return { at: Math.round(now + Math.max(...ends)), title: 'Le Bastion a fini', body: orders.length ? `Commande prête : ${orderLabel(orders[0])}` : 'Tes chantiers et recherches sont terminés.' };
}

// Raccourcis lus par la Forge et l'écran d'Équipement : commandes en cours / places de commande ; recherches en
// cours / places ; ouvriers posés / places. Liste vide si le Bastion n'est pas ouvert.
export function bastionShortcuts(state, now = Date.now()) { // eslint-disable-line no-unused-vars
  const b = bastionOf(state);
  if (!b) return [];
  const slots = researchSlots(state);
  return [
    { id: 'forge', label: 'Forge du forgeron', busy: ordersInProgress(state).length, total: orderSlots(state), ready: ordersReady(state).length },
    { id: 'research', label: 'Recherches', busy: b.research.active.length, total: slots, ready: 0, locked: slots < 1 },
    { id: 'workers', label: 'Ouvriers', busy: workersPlaced(state), total: workerSlots(state), ready: 0 },
  ];
}

// ---------------------------------------------------------------- sauvegarde

const num = (v, min = 0, max = Infinity) => (Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : min);
const cleanJob = (raw, maxMs) => {
  if (!raw || typeof raw !== 'object' || !Number.isFinite(raw.left) || !Number.isFinite(raw.total) || raw.total <= 0) return null;
  const total = num(raw.total, 1, maxMs);
  return { left: num(raw.left, 0, total), total };
};

// Répare `state.bastion` (sauvegarde abîmée ou ancienne) : niveaux bornés, ouvriers possédés et libres, travaux valides,
// stocks plafonnés. Une sauvegarde sans Bastion mais déjà à l'étape 40 : le Bastion s'ouvre (Forge niveau 1 offerte).
export function sanitizeBastion(raw, state, now = Date.now(), isItem = () => true, cleanItem = (i) => i) {
  if (!bastionOpen(state)) return null;
  const out = emptyBastion(now);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  out.openedAt = num(raw.openedAt, 0, now) || now;
  out.at = Number.isFinite(raw.at) && raw.at > 0 ? Math.min(raw.at, now) : now;
  const seen = new Set();
  for (const def of LEVELED) {
    const r = raw.buildings?.[def.id];
    const slot = out.buildings[def.id];
    if (!r || typeof r !== 'object') continue;
    slot.level = Math.floor(num(r.level, def.startLevel ?? 0, BASTION_MAX_LEVEL));
    if (typeof r.worker === 'string' && !seen.has(r.worker)) { slot.worker = r.worker; seen.add(r.worker); }
    const j = slot.level < BASTION_MAX_LEVEL ? cleanJob(r.build, 8 * HOUR) : null;
    if (j) slot.build = { ...j, level: slot.level + 1 };
  }
  state.bastion = out; // les règles ci-dessous lisent l'état en cours de réparation
  for (const [id, slot] of Object.entries(out.buildings)) {
    if (slot.worker && (!canWork(state, slot.worker) || !buildingAccess(state, id).available)) slot.worker = null;
    if (slot.level < 1 && !buildingAccess(state, id).available) slot.build = null;
  }
  while (workersPlaced(state) > workerSlots(state)) Object.values(out.buildings).reverse().find((s) => s.worker).worker = null;
  for (const r of RESEARCH) {
    const lv = Math.floor(num(raw.research?.levels?.[r.id], 0, r.max));
    if (lv) out.research.levels[r.id] = lv;
  }
  const actives = new Set();
  for (const a of Array.isArray(raw.research?.active) ? raw.research.active : []) {
    const def = researchDef(a?.id);
    const j = cleanJob(a, RESEARCH_STEPS.maxMinutes * MINUTE);
    if (!def || !j || actives.has(def.id) || researchLevel(state, def.id) >= def.max || out.research.active.length >= Math.max(1, researchSlots(state))) continue;
    actives.add(def.id);
    out.research.active.push({ id: def.id, ...j, level: researchLevel(state, def.id) + 1 });
  }
  if (researchSlots(state) < 1) out.research.active = [];
  let nextOrder = 1;
  for (const o of Array.isArray(raw.orders) ? raw.orders : []) {
    const t = orderTier(o?.tier);
    if (!t || !SLOTS[o.slot] || out.orders.length >= 3) continue;
    const id = Number.isInteger(o.id) && o.id > 0 ? o.id : nextOrder;
    nextOrder = Math.max(nextOrder, id + 1);
    if (o.ready && o.item && isItem(o.item)) { out.orders.push({ id, slot: o.slot, tier: t.id, left: 0, total: t.hours * HOUR, ready: true, item: cleanItem(o.item) }); continue; }
    const j = cleanJob(o, 8 * HOUR);
    if (j) out.orders.push({ id, slot: o.slot, tier: t.id, ...j, ready: false, item: null });
  }
  out.nextOrder = Math.max(nextOrder, Number.isInteger(raw.nextOrder) && raw.nextOrder > 0 ? raw.nextOrder : 1);
  for (const id of Object.keys(PRODUCERS)) out.stock[id] = num(raw.stock?.[id], 0, productionOf(state, id)?.cap ?? 0);
  if (raw.trade && typeof raw.trade.day === 'string') out.trade = { day: raw.trade.day.slice(0, 12), used: Math.floor(num(raw.trade.used, 0, 99)) };
  out.news = (Array.isArray(raw.news) ? raw.news : []).filter((n) => n && ['build', 'research', 'order'].includes(n.kind) && typeof n.text === 'string')
    .slice(-12).map((n) => ({ kind: n.kind, ref: n.ref ?? null, text: n.text.slice(0, 80), at: num(n.at, 0, now), seal: num(n.seal, 0), book: Boolean(n.book) }));
  out.cards = (Array.isArray(raw.cards) ? raw.cards : []).filter((id) => buildingDef(id)).slice(0, BUILDINGS.length);
  // v10.4 (6) : démarrage automatique fait (date), bulles vues, rapport « Pendant ton absence ».
  out.kicked = num(raw.kicked, 0, now);
  out.tips = [...new Set((Array.isArray(raw.tips) ? raw.tips : []).filter((id) => buildingDef(id) || id === 'research'))];
  const KINDS = ['build', 'research', 'item', 'order'];
  const list = (Array.isArray(raw.away?.list) ? raw.away.list : []).filter((x) => x && KINDS.includes(x.kind) && (typeof x.ref === 'string' || Number.isFinite(x.ref)))
    .slice(-12).map((x) => ({ kind: x.kind, ref: x.ref, ...(Number.isFinite(x.level) ? { level: Math.floor(num(x.level, 0, 99)) } : {}),
      ...(typeof x.name === 'string' ? { name: x.name.slice(0, 80) } : {}), ...(typeof x.rarity === 'string' ? { rarity: x.rarity.slice(0, 20) } : {}),
      ...(typeof x.slot === 'string' ? { slot: x.slot.slice(0, 20) } : {}), ...(typeof x.text === 'string' ? { text: x.text.slice(0, 80) } : {}) }));
  out.away = list.length ? { at: num(raw.away.at, 0, now), list } : null;
  return out;
}

export { BUILDINGS, ORDER_TIERS, RESEARCH, RESEARCH_BRANCHES, TRADES };
