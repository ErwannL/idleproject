// Génération d'objets à partir des définitions de src/data/items.js :
// statistiques selon la rareté et le niveau, effets spéciaux (Rare et mieux), objets signature de boss.
import { CLASS_WEAPON_DROP } from '../data/classes.js';
import { activeClass, classWeaponBases } from './classes.js';
import { BALANCE } from '../data/balance.js';
import { AFFIXES, ITEM_BASES, PERCENT_STATS, RARITIES, SIGNATURE_ITEMS } from '../data/items.js';
import { rollSet } from './sets.js';

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
  // v8.4 : croissance exponentielle avec le niveau (les ennemis grandissent aussi exponentiellement).
  value *= balance.loot.stagePowerExp ? balance.loot.stagePowerExp ** (level - 1) : 1 + balance.loot.stagePowerGrowth * (level - 1);
  return Math.round(value);
}

// `boosts` : niveaux d'amélioration reçus par chaque statistique (+12 % chacun, les malus ne grandissent pas).
function computeStats(base, rarity, level, balance, boosts = {}) {
  const stats = {};
  for (const [stat, value] of Object.entries(base.stats)) {
    const raw = itemStatValue(stat, value, rarity, level, balance);
    const boost = raw > 0 ? 1 + ((boosts[stat] ?? 0) * balance.forge.upgradeBoostPct) / 100 : 1;
    stats[stat] = PERCENT_STATS.has(stat) ? Math.round(raw * boost * 10) / 10 : Math.round(raw * boost);
  }
  return stats;
}

// Effet principal d'un accessoire : grandit avec la rareté et (modérément) avec le niveau.
function mainAffixValue(main, rarity, level) {
  const raw = main.base * rarity.statMultiplier * (1 + 0.01 * (level - 1));
  return raw < 3 ? Math.round(raw * 10) / 10 : Math.round(raw);
}

// Effets spéciaux tirés au hasard parmi ceux autorisés pour l'emplacement (sans doublon).
// `exclude` : types déjà présents (effet principal d'un accessoire).
export function rollAffixes(slot, rarityId, rng, balance = BALANCE, exclude = []) {
  const count = balance.loot.affixCount[rarityId] ?? 0;
  const rarity = rarityById(rarityId);
  const pool = Object.entries(AFFIXES).filter(([type, a]) => a.slots.includes(slot) && !exclude.includes(type)).map(([type]) => type);
  const affixes = [];
  for (let i = 0; i < count && pool.length; i++) {
    const type = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
    const raw = AFFIXES[type].base * rarity.statMultiplier * (0.8 + 0.4 * rng.next());
    affixes.push({ type, value: raw < 3 ? Math.round(raw * 10) / 10 : Math.round(raw) });
  }
  return affixes;
}

export function makeItem(state, baseId, rarityId, level, balance = BALANCE, rng = null, set = null) {
  const base = itemBase(baseId);
  const rarity = rarityById(rarityId);
  const id = `it${state.nextItemId}`;
  state.nextItemId += 1;
  const main = base.mainAffix ? [{ type: base.mainAffix.type, value: mainAffixValue(base.mainAffix, rarity, level) }] : [];
  const affixes = base.affixes
    ? base.affixes.map((a) => ({ ...a }))
    : [...main, ...(rng ? rollAffixes(base.slot, rarityId, rng, balance, main.map((a) => a.type)) : [])];
  return {
    id, baseId, name: base.name, slot: base.slot, rarity: rarityId, level,
    stats: computeStats(base, rarity, level, balance), affixes, effect: null, locked: false,
    upgrades: 0, boosts: {}, ...(set ? { set } : {}),
  };
}

// options.slot : limite le tirage à un emplacement (butin ciblé de la forge et des donjons).
// Sans emplacement imposé, on tire d'abord l'emplacement (poids de balance.loot.slotWeights), puis un
// modèle : les accessoires, déclinés en plusieurs couleurs, ne remplissent pas tout le butin.
// options.setZone (v8.5) : monde d'origine → l'objet peut appartenir à l'ensemble de ce monde.
export function generateItem(state, rng, { level, minRarity = 'common', slot, setZone = null } = {}, balance = BALANCE) {
  let chosen = slot;
  if (!chosen) {
    const weights = Object.entries(balance.loot.slotWeights);
    let roll = rng.next() * weights.reduce((sum, [, w]) => sum + w, 0);
    chosen = weights.find(([, w]) => (roll -= w) < 0)?.[0] ?? weights[0][0];
  }
  // v9.0.6 : la plupart des armes tombent dans la classe active (les autres restent possibles).
  const classPool = chosen === 'weapon' && state ? classWeaponBases(activeClass(state).id) : [];
  const base = classPool.length && rng.next() < CLASS_WEAPON_DROP ? rng.pick(classPool) : rng.pick(ITEM_BASES.filter((b) => b.slot === chosen));
  const rarity = rollRarity(rng, minRarity);
  const set = setZone === null || setZone === undefined ? null : rollSet(setZone, rarity, rng, balance);
  return makeItem(state, base.id, rarity, Math.max(1, level), balance, rng, set);
}

// Objet signature d'un boss : Épique, parfois Légendaire.
export function makeSignatureItem(state, bossId, level, rng, balance = BALANCE) {
  const base = signatureItemFor(bossId);
  if (!base) return null;
  return makeItem(state, base.id, rng.next() < 0.25 ? 'legendary' : 'epic', Math.max(1, level), balance);
}

export function rerollAffixes(item, rng, balance = BALANCE) {
  const base = itemBase(item.baseId);
  // L'effet principal d'un accessoire est conservé.
  const main = base.mainAffix ? [item.affixes[0]] : [];
  item.affixes = [...main, ...rollAffixes(item.slot, item.rarity, rng, balance, main.map((a) => a.type))];
}

// Recalcule les statistiques après un changement de niveau (réaffûtage) ou une amélioration.
export function refreshItemStats(item, balance = BALANCE) {
  const base = itemBase(item.baseId);
  const rarity = rarityById(item.rarity);
  item.stats = computeStats(base, rarity, item.level, balance, item.boosts ?? {});
  if (base.mainAffix && item.affixes[0]?.type === base.mainAffix.type) {
    const boost = 1 + ((item.boosts?.main ?? 0) * balance.forge.upgradeBoostPct) / 100;
    const v = mainAffixValue(base.mainAffix, rarity, item.level) * boost;
    item.affixes[0].value = v < 3 ? Math.round(v * 10) / 10 : Math.round(v);
  }
  // Affixes améliorés (v8.2) : valeur d'origine mémorisée dans `base`, +12 % par niveau d'amélioration.
  (item.affixes ?? []).forEach((a, i) => {
    const n = item.boosts?.[`affix:${i}`] ?? 0;
    if (!n) return;
    if (!Number.isFinite(a.base)) a.base = a.value;
    const v = a.base * (1 + (n * balance.forge.upgradeBoostPct) / 100);
    a.value = v < 3 ? Math.round(v * 10) / 10 : Math.round(v * 10) / 10;
  });
}

export function recycleValue(item, balance = BALANCE) {
  const rarity = rarityById(item.rarity);
  const linear = rarity.recycleGold * (1 + balance.loot.recycleLevelGrowth * (item.level - 1));
  // Étape 4 : indexé sur l'or des ennemis du même niveau (avant : sans valeur passé l'étape ~80) —
  // un Commun vaut ~1 ennemi, un Légendaire ~60 ennemis de son étape.
  const indexed = rarity.recycleGold * balance.loot.recycleGoldShare * balance.enemyScaling.goldGrowth ** Math.max(0, item.level - 1);
  return Math.floor(Math.max(linear, indexed));
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
