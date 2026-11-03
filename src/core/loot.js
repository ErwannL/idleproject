// Génération d'objets à partir des définitions de src/data/items.js :
// statistiques selon la rareté et le niveau, effets spéciaux (Rare et mieux), objets signature de boss.
import { CLASS_WEAPON_DROP } from '../data/classes.js';
import { activeClass, classWeaponBases } from './classes.js';
import { BALANCE } from '../data/balance.js';
import { AFFIXES, ITEM_BASES, PERCENT_STATS, RARITIES, SIGNATURE_ITEMS } from '../data/items.js';
import { rollSet } from './sets.js';
import { levelForStage } from './combat.js'; // v9.2.0 (monde marin) : niveau de puissance des étapes

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

// v9.1.9 : `weights` (facultatif, { common, rare, epic, legendary }) remplace les poids de RARITIES — butin courant
// des monstres (balance.loot.dropRarityWeights), moins fréquent mais de meilleure rareté.
export function rollRarity(rng, minRarity = 'common', weights = null) {
  const pool = RARITIES.slice(Math.max(0, rarityIndex(minRarity)));
  const w = (r) => weights?.[r.id] ?? r.weight;
  const total = pool.reduce((sum, r) => sum + w(r), 0);
  let roll = rng.next() * total;
  for (const rarity of pool) {
    roll -= w(rarity);
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
// v9.1.3 (doc3 lot 3) : `forced` = type imposé à la première ligne (relance orientée), même aléa de ±20 %.
export function rollAffixes(slot, rarityId, rng, balance = BALANCE, exclude = [], forced = null) {
  const count = balance.loot.affixCount[rarityId] ?? 0;
  const rarity = rarityById(rarityId);
  const pool = Object.entries(AFFIXES).filter(([type, a]) => a.slots.includes(slot) && !exclude.includes(type)).map(([type]) => type);
  const affixes = [];
  for (let i = 0; i < count && pool.length; i++) {
    const at = i === 0 && forced && pool.includes(forced) ? pool.indexOf(forced) : Math.floor(rng.next() * pool.length);
    const type = pool.splice(at, 1)[0];
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
export function generateItem(state, rng, { level, minRarity = 'common', slot, setZone = null, weights = null } = {}, balance = BALANCE) {
  let chosen = slot;
  if (!chosen) {
    const weights = Object.entries(balance.loot.slotWeights);
    let roll = rng.next() * weights.reduce((sum, [, w]) => sum + w, 0);
    chosen = weights.find(([, w]) => (roll -= w) < 0)?.[0] ?? weights[0][0];
  }
  // v9.0.6 : la plupart des armes tombent dans la classe active (les autres restent possibles).
  const classPool = chosen === 'weapon' && state ? classWeaponBases(activeClass(state).id) : [];
  const base = classPool.length && rng.next() < CLASS_WEAPON_DROP ? rng.pick(classPool) : rng.pick(ITEM_BASES.filter((b) => b.slot === chosen));
  const rarity = rollRarity(rng, minRarity, weights);
  const set = setZone === null || setZone === undefined ? null : rollSet(setZone, rarity, rng, balance);
  return makeItem(state, base.id, rarity, Math.max(1, level), balance, rng, set);
}

// Objet signature d'un boss : Épique, parfois Légendaire.
export function makeSignatureItem(state, bossId, level, rng, balance = BALANCE) {
  const base = signatureItemFor(bossId);
  if (!base) return null;
  return makeItem(state, base.id, rng.next() < 0.25 ? 'legendary' : 'epic', Math.max(1, level), balance);
}

export function rerollAffixes(item, rng, balance = BALANCE, forced = null) {
  const base = itemBase(item.baseId);
  // L'effet principal d'un accessoire est conservé.
  const main = base.mainAffix ? [item.affixes[0]] : [];
  item.affixes = [...main, ...rollAffixes(item.slot, item.rarity, rng, balance, main.map((a) => a.type), forced)];
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

// v9.1.3 : `maxLevel` (étape max de la partie en cours, voir recycleLevelOf) plafonne le niveau compté.
export function recycleValue(item, balance = BALANCE, maxLevel = Infinity) {
  const rarity = rarityById(item.rarity);
  const level = Math.max(1, Math.min(item.level, maxLevel));
  const linear = rarity.recycleGold * (1 + balance.loot.recycleLevelGrowth * (level - 1));
  // Étape 4 : indexé sur l'or des ennemis du même niveau (avant : sans valeur passé l'étape ~80) —
  // un Commun vaut ~1 ennemi, un Légendaire ~60 ennemis de son étape.
  const indexed = rarity.recycleGold * balance.loot.recycleGoldShare * balance.enemyScaling.goldGrowth ** Math.max(0, level - 1);
  return Math.floor(Math.max(linear, indexed));
}

export function recycleMaterials(item, balance = BALANCE) {
  return { shards: balance.materials.shards[item.rarity] ?? 0 }; // v9.1.3 : essences fondues dans les éclats
}

// v9.1.3 (doc3 lot 1) : plafond de niveau du recyclage pour cette partie (étape max en cours, faille d'or).
export function recycleLevelOf(state, balance = BALANCE) {
  return balance.loot.recycleLevelCap === 'maxStage' ? levelForStage(Math.max(1, state?.maxStage ?? 1), balance) : Infinity;
}

// Score simple pour trier par puissance.
// v9.1.3 (doc3 lot 1) : chaque effet compte en valeur / valeur de base (avant : valeur brute, un Collier à +2 %
// de critique écrasait un Pendentif à +0,5 % PV/s de même rareté). Poids 4 : un effet de base 2 garde son ancien score.
const AFFIX_WEIGHT = 4;
function affixBase(base, a, i) {
  if (base?.mainAffix && i === 0 && a.type === base.mainAffix.type) return base.mainAffix.base;
  return AFFIXES[a.type]?.base || 1;
}
export function itemPower(item) {
  const s = item.stats;
  const base = itemBase(item.baseId);
  const affixScore = (item.affixes ?? []).reduce((sum, a, i) => sum + (a.value / affixBase(base, a, i)) * AFFIX_WEIGHT, 0);
  return (s.damage ?? 0) * 3 + (s.maxHp ?? 0) * 0.5 + (s.armor ?? 0) * 4 + (s.attackSpeed ?? 0) * 1.5 + affixScore;
}
