// Événements discrets : coffre, marchand, élite, vague spéciale, gemmes.
// Coffres, marchands et gemmes attendent dans la boîte de récompenses (jamais perdus) ;
// élite et vague se déroulent directement pendant le farm.
import { BALANCE } from '../data/balance.js';
import { referenceKillGold } from './combat.js';
import { addToInventory } from './inventory.js';
import { STASH_SIZE } from './stash.js';
import { generateItem } from './loot.js';
import { grantReward } from './rewards.js';

const EVENT_LABELS = {
  chest: 'Coffre découvert',
  merchant: 'Marchand ambulant',
  elite: 'Élite errante',
  wave: 'Vague spéciale',
  gems: 'Gemmes trouvées',
  portal: 'Portail vers une salle au trésor',
  wanderer: 'Boss errant vaincu',
  held: 'Objet en attente (sac et coffre pleins)', // v9.1.3 (doc3 lot 1)
};

export function eventLabel(type) {
  return EVENT_LABELS[type];
}

function pickType(rng, balance) {
  const weights = balance.events.weights;
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  let roll = rng.next() * total;
  for (const [type, w] of Object.entries(weights)) {
    roll -= w;
    if (roll < 0) return type;
  }
  return 'chest';
}

// Appelé à chaque ennemi ordinaire vaincu en campagne. Renvoie l'événement créé, ou null.
export function rollEvent(state, world, rng, balance = BALANCE, multiplier = 1) {
  if (rng.next() >= balance.events.chancePerKill * multiplier) return null;
  const type = pickType(rng, balance);
  const e = balance.events;
  const killGold = referenceKillGold(state.stage, balance);
  if (type === 'elite') {
    world.pendingElite = true;
    return { type };
  }
  if (type === 'wave') {
    world.goldWave = e.waveKills;
    return { type };
  }
  if (state.inbox.length >= e.inboxSize) return null;
  state.nextEventId += 1;
  const event = { id: state.nextEventId, type, stage: state.stage };
  if (type === 'chest') {
    event.reward = { gold: Math.floor(killGold * e.chestGoldKills), shards: 5 };
    event.item = generateItem(state, rng, { level: state.stage, minRarity: 'rare' }, balance);
  } else if (type === 'portal') {
    // Salle au trésor : beaucoup d'or, des éclats et quelques gemmes.
    event.reward = { gold: Math.floor(killGold * e.portalGoldKills), shards: 25, gems: 15 };
  } else if (type === 'wanderer') {
    // Boss errant (rare) : éclats, gemmes et un objet Épique ou mieux.
    event.reward = { shards: 30, gems: 30 }; // v9.1.3 : 3 essences → 30 éclats
    event.item = generateItem(state, rng, { level: state.stage, minRarity: 'epic' }, balance);
  } else if (type === 'merchant') {
    event.item = generateItem(state, rng, { level: state.stage, minRarity: 'epic' }, balance);
    event.price = Math.floor(killGold * e.merchantPriceKills);
  } else {
    event.reward = { gems: e.gems[0] + Math.floor(rng.next() * (e.gems[1] - e.gems[0] + 1)) };
  }
  state.inbox.push(event);
  return event;
}

// v9.1.3 (doc3 lot 1) : place pour un objet reçu — au sac, ou au coffre.
export function hasRoom(state, balance = BALANCE) {
  return state.inventory.length < balance.loot.inventorySize || (state.stash ?? []).length < STASH_SIZE;
}

// Récupère un coffre ou des gemmes. Renvoie la récompense, ou null.
// v9.1.3 : sac plein → l'objet va au coffre ; refusé seulement si les deux sont pleins (l'objet reste en attente).
export function claimEvent(state, id, balance = BALANCE) {
  const index = state.inbox.findIndex((e) => e.id === id);
  const event = state.inbox[index];
  if (!event || event.type === 'merchant') return null;
  if (event.item && !hasRoom(state, balance)) return null;
  state.inbox.splice(index, 1);
  const given = grantReward(state, event.reward);
  if (event.item) addToInventory(state, event.item, balance);
  return { ...given, item: event.item ?? null };
}

export function buyFromMerchant(state, id, balance = BALANCE) {
  const index = state.inbox.findIndex((e) => e.id === id && e.type === 'merchant');
  const event = state.inbox[index];
  if (!event || state.gold < event.price || !hasRoom(state, balance)) return false;
  state.gold -= event.price;
  addToInventory(state, event.item, balance);
  state.inbox.splice(index, 1);
  return true;
}

export function dismissEvent(state, id) {
  const index = state.inbox.findIndex((e) => e.id === id);
  if (index < 0 || state.inbox[index].type === 'held') return false; // v9.1.3 : un objet en attente ne se jette pas
  state.inbox.splice(index, 1);
  return true;
}
