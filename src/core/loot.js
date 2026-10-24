// Génération d'objets à partir des définitions de src/data/items.js :
// statistiques selon la rareté et le niveau, effets spéciaux (Rare et mieux), objets signature de boss.
import { BALANCE } from '../data/balance.js';
import { AFFIXES, ITEM_BASES, PERCENT_STATS, RARITIES, SIGNATURE_ITEMS } from '../data/items.js';

const ALL_BASES = [...ITEM_BASES, ...SIGNATURE_ITEMS];

export function rarityById(id) {
  return RARITIES.find((r) => r.id === id);
}

export function rarityIndex(id) {
  return RARITIES.findIndex((r) => r.id === id);
}

export function itemBase(baseId) {
  return ALL_BASES.find((b) => b.id === baseId);
}

export function signatureItemFor(bossId) {
  return SIGNATURE_ITEMS.find((b) => b.signature === bossId) ?? null;
}

export function rollRarity(rng, minRarity = 'common') {
  const pool = RARITIES.slice(Math.max(0, rarityIndex(minRarity)));
  const total = pool.reduce((sum, r) => sum + r.weight, 0);
  let roll = rng.next() * total;
  for (const rarity of pool) {
    roll -= rarity.weight;
    if (roll < 0) return rarity.id;
  }
  return pool[pool.length - 1].id;
}

export function itemStatValue(stat, baseValue, rarity, level, balance = BALANCE) {
  // Les bonus sont amplifiés par la rareté, les malus (ex. hache plus lente) non.
  let value = baseValue > 0 ? baseValue * rarity.statMultiplier : baseValue;
  if (PERCENT_STATS.has(stat)) return Math.round(value * 10) / 10;
  value *= 1 + balance.loot.stagePowerGrowth * (level - 1);
  return Math.round(value);
}

function computeStats(base, rarity, level, balance) {
  const stats = {};
  for (const [stat, value] of Object.entries(base.stats)) stats[stat] = itemStatValue(stat, value, rarity, level, balance);
  return stats;
}

// Effets spéciaux tirés au hasard parmi ceux autorisés pour l'emplacement (sans doublon).
export function rollAffixes(slot, rarityId, rng, balance = BALANCE) {
  const count = balance.loot.affixCount[rarityId] ?? 0;
  const rarity = rarityById(rarityId);
  const pool = Object.entries(AFFIXES).filter(([, a]) => a.slots.includes(slot)).map(([type]) => type);
  const affixes = [];
  for (let i = 0; i < count && pool.length; i++) {
    const type = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
    const raw = AFFIXES[type].base * rarity.statMultiplier * (0.8 + 0.4 * rng.next());
    affixes.push({ type, value: raw < 3 ? Math.round(raw * 10) / 10 : Math.round(raw) });
  }
  return affixes;
}

export function makeItem(state, baseId, rarityId, level, balance = BALANCE, rng = null) {
  const base = itemBase(baseId);
  const rarity = rarityById(rarityId);
  const id = `it${state.nextItemId}`;
  state.nextItemId += 1;
  const affixes = base.affixes
    ? base.affixes.map((a) => ({ ...a }))
    : rng ? rollAffixes(base.slot, rarityId, rng, balance) : [];
  return {
    id, baseId, name: base.name, slot: base.slot, rarity: rarityId, level,
    stats: computeStats(base, rarity, level, balance), affixes, effect: null, locked: false,
  };
}

// options.slot : limite le tirage à un emplacement (butin ciblé de la forge et des donjons).
export function generateItem(state, rng, { level, minRarity = 'common', slot } = {}, balance = BALANCE) {
  const pool = slot ? ITEM_BASES.filter((b) => b.slot === slot) : ITEM_BASES;
  const base = rng.pick(pool);
  return makeItem(state, base.id, rollRarity(rng, minRarity), Math.max(1, level), balance, rng);
}

// Objet signature d'un boss : Épique, parfois Légendaire.
export function makeSignatureItem(state, bossId, level, rng, balance = BALANCE) {
  const base = signatureItemFor(bossId);
  if (!base) return null;
  return makeItem(state, base.id, rng.next() < 0.25 ? 'legendary' : 'epic', Math.max(1, level), balance);
}

export function rerollAffixes(item, rng, balance = BALANCE) {
  item.affixes = rollAffixes(item.slot, item.rarity, rng, balance);
}

// Recalcule les statistiques après un changement de niveau (réaffûtage).
export function refreshItemStats(item, balance = BALANCE) {
  item.stats = computeStats(itemBase(item.baseId), rarityById(item.rarity), item.level, balance);
}

export function recycleValue(item, balance = BALANCE) {
  const rarity = rarityById(item.rarity);
  return Math.floor(rarity.recycleGold * (1 + balance.loot.recycleLevelGrowth * (item.level - 1)));
}

export function recycleMaterials(item, balance = BALANCE) {
  return { shards: balance.materials.shards[item.rarity] ?? 0, essence: balance.materials.essence[item.rarity] ?? 0 };
}

// Score simple pour trier par puissance.
export function itemPower(item) {
  const s = item.stats;
  const affixScore = (item.affixes ?? []).reduce((sum, a) => sum + a.value * 2, 0);
  return (s.damage ?? 0) * 3 + (s.maxHp ?? 0) * 0.5 + (s.armor ?? 0) * 4 + (s.attackSpeed ?? 0) * 1.5 + affixScore;
}
