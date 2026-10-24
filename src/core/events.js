// Événements discrets : coffre, marchand, élite, vague spéciale, gemmes.
// Coffres, marchands et gemmes attendent dans la boîte de récompenses (jamais perdus) ;
// élite et vague se déroulent directement pendant le farm.
import { BALANCE } from '../data/balance.js';
import { referenceKillGold } from './combat.js';
import { addToInventory } from './inventory.js';
import { generateItem } from './loot.js';
import { grantReward } from './rewards.js';

const EVENT_LABELS = {
  chest: 'Coffre découvert',
  merchant: 'Marchand ambulant',
  elite: 'Élite errante',
  wave: 'Vague spéciale',
  gems: 'Gemmes trouvées',
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
export function rollEvent(state, world, rng, balance = BALANCE) {
  if (rng.next() >= balance.events.chancePerKill) return null;
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
  } else if (type === 'merchant') {
    event.item = generateItem(state, rng, { level: state.stage, minRarity: 'epic' }, balance);
    event.price = Math.floor(killGold * e.merchantPriceKills);
  } else {
    event.reward = { gems: e.gems[0] + Math.floor(rng.next() * (e.gems[1] - e.gems[0] + 1)) };
  }
  state.inbox.push(event);
  return event;
}

// Récupère un coffre ou des gemmes. Renvoie la récompense, ou null.
export function claimEvent(state, id, balance = BALANCE) {
  const index = state.inbox.findIndex((e) => e.id === id);
  const event = state.inbox[index];
  if (!event || event.type === 'merchant') return null;
  if (event.item && state.inventory.length >= balance.loot.inventorySize) return null;
  state.inbox.splice(index, 1);
  const given = grantReward(state, event.reward);
  if (event.item) addToInventory(state, event.item, balance);
  return { ...given, item: event.item ?? null };
}

export function buyFromMerchant(state, id, balance = BALANCE) {
  const index = state.inbox.findIndex((e) => e.id === id && e.type === 'merchant');
  const event = state.inbox[index];
  if (!event || state.gold < event.price || state.inventory.length >= balance.loot.inventorySize) return false;
  state.gold -= event.price;
  addToInventory(state, event.item, balance);
  state.inbox.splice(index, 1);
  return true;
}

export function dismissEvent(state, id) {
  const index = state.inbox.findIndex((e) => e.id === id);
  if (index < 0) return false;
  state.inbox.splice(index, 1);
  return true;
}
