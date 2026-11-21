// v10.4 (partie 6) : le Bastion se lance tout seul, et raconte ce qu'il a fait pendant l'absence du joueur.
//  - démarrage : à la première ouverture de l'écran, les meilleurs ouvriers (métier, puis rareté) sont posés dans la
//    limite des places, et un premier chantier est offert (gratuit, 15 min au plus). Une seule fois (`bastion.kicked`).
//    Une sauvegarde 10.3 dont le Bastion n'a jamais servi (0 ouvrier, rien de lancé, rien de construit) le reçoit aussi ;
//  - bulles : une par bâtiment, la première fois qu'il est ouvert (`bastion.tips`) ;
//  - « Pendant ton absence » : chantiers et recherches finis, objets commandés livrés (`bastion.away`), puis
//    « Tout récupérer » (stocks de la Mine et du Camp, commandes restées prêtes, nouvelles lues).
// Aucun équilibrage ici : les durées, coûts et effets restent ceux de data/bastion.js (le chantier offert est le
// premier chantier du jeu, tenu par tools/sim-bastion.mjs qui le joue aussi).
import { BUILD_STEPS } from '../data/bastion.js';
import { UNITS } from '../data/banners.js';
import {
  BUILDINGS, ackBastionNews, assignWorker, availableWorkers, bastionLevel, bastionOf, buildCost, buildingAccess, buildingDef, buildingLevel,
  collectOrder, collectStock, ordersReady, productionOf, researchDef, stockOf, tradeOf, workerBonus, workerSlots, workersPlaced, MINUTE,
} from './bastion.js';

export const GIFT_MINUTES = BUILD_STEPS[0].minutes; // le premier chantier offert : 15 min au plus

const unit = (id) => UNITS.find((c) => c.id === id) ?? null;
const RARITY_RANK = { common: 0, rare: 1, epic: 2, legendary: 3 };

// Le Bastion n'a jamais servi : aucun ouvrier, aucun chantier ni recherche ni commande, rien de construit au-delà de
// la Forge offerte. (Une sauvegarde 10.3 ouverte sans rien y faire est dans ce cas.)
export function bastionUnused(state) {
  const b = bastionOf(state);
  if (!b) return false;
  const busy = Object.values(b.buildings).some((s) => s.worker || s.build);
  const studied = Object.values(b.research?.levels ?? {}).some((v) => v > 0) || (b.research?.active ?? []).length > 0;
  return !busy && !studied && !(b.orders ?? []).length && bastionLevel(state) <= 1;
}

export function needsKickoff(state) {
  const b = bastionOf(state);
  return Boolean(b) && !b.kicked && bastionUnused(state);
}

// Postes à pourvoir, dans l'ordre : les bâtiments construits d'abord (la Forge), puis ceux à construire.
function posts(state) {
  return BUILDINGS.filter((d) => !d.existing && buildingAccess(state, d.id).available)
    .sort((x, y) => (buildingLevel(state, y.id) > 0) - (buildingLevel(state, x.id) > 0));
}

// Le meilleur ouvrier libre pour un bâtiment : bonus total (métier + rareté), puis rareté, puis nom.
export function bestWorkerFor(state, buildingId, taken = new Set()) {
  return availableWorkers(state).filter((c) => !taken.has(c.id))
    .sort((x, y) => workerBonus(state, y.id, buildingId).totalPct - workerBonus(state, x.id, buildingId).totalPct
      || (RARITY_RANK[y.rarity] ?? 0) - (RARITY_RANK[x.rarity] ?? 0) || x.name.localeCompare(y.name))[0] ?? null;
}

// Démarrage : pose les meilleurs ouvriers et lance le chantier offert. Renvoie { placed: [{ building, companionId,
// pct, match }], build: { building, level, ms } | null } ou null (rien à faire : déjà lancé, ou aucun compagnon libre —
// on réessaiera à la prochaine ouverture).
export function kickoffBastion(state, now = Date.now()) {
  if (!needsKickoff(state)) return null;
  const b = bastionOf(state);
  const placed = [];
  const taken = new Set();
  for (const def of posts(state)) {
    if (workersPlaced(state) >= workerSlots(state)) break;
    const c = bestWorkerFor(state, def.id, taken);
    if (!c) break;
    if (assignWorker(state, def.id, c.id, now)) continue;
    taken.add(c.id);
    const bonus = workerBonus(state, c.id, def.id);
    placed.push({ building: def.id, companionId: c.id, pct: bonus.totalPct, match: bonus.match });
  }
  if (!placed.length) return null;
  // Chantier offert : un bâtiment à construire d'abord (son premier chantier dure 15 min), sinon le moins avancé.
  const target = placed.map((p) => p.building).sort((x, y) => buildingLevel(state, x) - buildingLevel(state, y))[0];
  const cost = buildCost(state, target);
  let build = null;
  if (cost) {
    const ms = Math.min(cost.ms, GIFT_MINUTES * MINUTE);
    b.buildings[target].build = { left: ms, total: ms, level: cost.level };
    build = { building: target, level: cost.level, ms };
  }
  b.kicked = now;
  return { placed, build };
}

// ---------------------------------------------------------------- textes du démarrage

// Métiers au féminin : les compagnes (le métier s'accorde : « Reine démone, forgeronne »).
const FEMININE = new Set(['pyromancer', 'priestess', 'witch', 'elf_archer', 'demon_queen', 'ice_empress', 'sylvan_guardian', 'rose_blade', 'fairy', 'high_priestess']);
const TRADE_WORD = {
  smith: ['forgeron', 'forgeronne'], scholar: ['savant', 'savante'], miner: ['mineur', 'mineuse'],
  trainer: ['entraîneur', 'entraîneuse'], merchant: ['marchand', 'marchande'],
};
export function tradeWord(companionId) {
  const w = TRADE_WORD[tradeOf(companionId)];
  return w ? w[FEMININE.has(companionId) ? 1 : 0] : 'ouvrier';
}
// « Reine démone, forgeronne : +40 % »
export function placedLine(p) {
  return `${unit(p.companionId)?.name ?? 'Ouvrier'}, ${tradeWord(p.companionId)} : +${p.pct} %`;
}

// ---------------------------------------------------------------- bulles (une par bâtiment, une seule fois)

export function tipSeen(state, id) {
  return (bastionOf(state)?.tips ?? []).includes(id);
}
export function markTip(state, id) {
  const b = bastionOf(state);
  if (b && !tipSeen(state, id) && (buildingDef(id) || id === 'research')) b.tips = [...(b.tips ?? []), id];
}

// ---------------------------------------------------------------- « Pendant ton absence »

// Note ce que le Bastion a fini pendant l'absence (événements de bastionTick avec `away`). Les commandes livrées sont
// gardées par leur objet (identifiant, nom, rareté, place) : l'écran les montre telles qu'elles sont arrivées.
export function noteAway(state, events, now = Date.now()) {
  const b = bastionOf(state);
  if (!b || !events?.length) return false;
  const awayOrders = new Set(events.filter((e) => e.type === 'order' && e.away).map((e) => e.ref));
  const add = [];
  for (const e of events) {
    if (e.type === 'build' && e.away) add.push({ kind: 'build', ref: e.ref, level: buildingLevel(state, e.ref) });
    else if (e.type === 'research' && e.away) add.push({ kind: 'research', ref: e.ref, level: b.research.levels[e.ref] ?? 1 });
    else if (e.type === 'delivered' && awayOrders.has(e.ref) && e.item) add.push({ kind: 'item', ref: e.item.id, name: e.item.name, rarity: e.item.rarity, slot: e.item.slot });
    else if (e.type === 'order' && e.away && !events.some((x) => x.type === 'delivered' && x.ref === e.ref)) add.push({ kind: 'order', ref: e.ref, text: e.text });
  }
  if (!add.length) return false;
  const prev = b.away?.list ?? [];
  b.away = { at: now, list: [...prev, ...add].slice(-12) };
  return true;
}

// Contenu de l'écran : { builds, research, items, orders, stock: [{ id, resource, amount }] } ou null s'il n'y a rien.
export function awayReport(state) {
  const b = bastionOf(state);
  const list = b?.away?.list ?? [];
  if (!list.length) return null;
  const stock = ['mine', 'training'].map((id) => ({ id, resource: productionOf(state, id)?.resource, amount: Math.floor(stockOf(state, id)) })).filter((s) => s.resource && s.amount >= 1);
  return {
    builds: list.filter((x) => x.kind === 'build' && buildingDef(x.ref)),
    research: list.filter((x) => x.kind === 'research' && researchDef(x.ref)),
    items: list.filter((x) => x.kind === 'item'),
    orders: list.filter((x) => x.kind === 'order'),
    stock,
  };
}

// « Tout récupérer » : stocks de la Mine et du Camp, commandes restées prêtes (coffre de butin plein : elles restent
// dans la file s'il n'y a toujours pas de place), nouvelles lues. Renvoie { resources: { shards, grimoire }, items }.
export function collectAway(state, now = Date.now()) {
  const b = bastionOf(state);
  const out = { resources: {}, items: 0 };
  if (!b) return out;
  for (const id of ['mine', 'training']) {
    const got = collectStock(state, id, now);
    if (got) out.resources[got.resource] = (out.resources[got.resource] ?? 0) + got.amount;
  }
  for (const o of [...ordersReady(state)]) if (collectOrder(state, o.id, now)) out.items += 1;
  ackBastionNews(state, null, now);
  b.away = null;
  return out;
}
