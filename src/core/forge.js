// Forge : fabrication ciblée (choix de l'emplacement), relance des effets spéciaux,
// réaffûtage d'un objet au niveau de l'étape maximale, amélioration et fusion.
import { BALANCE } from '../data/balance.js';
import { ACCESSORY_SLOTS, AFFIXES, ITEM_BASES, RARITIES } from '../data/items.js';
import { referenceKillGold } from './combat.js';
import { addToInventory, isUpgrade, keptByAffix, recycleRules } from './inventory.js';
import { generateItem, itemBase, itemPower, makeItem, rarityIndex, refreshItemStats, rerollAffixes } from './loot.js';
import { trackMissions } from './missions.js';
import { CLASS_WEAPON_DROP } from '../data/classes.js';
import { activeClass, canEquip, classWeaponBases } from './classes.js';
import { usefulSetPiece } from './sets.js';

// tier 'rare' : Rare ou mieux (or + éclats) ; 'epic' : Épique ou mieux (or + plus d'éclats ; v9.1.3 : plus d'essences).
export function craftCost(state, balance = BALANCE, tier = 'rare') {
  const f = balance.forge;
  const kill = referenceKillGold(state.maxStage, balance);
  if (tier === 'epic') return { gold: Math.floor(f.epicCraft.goldKills * kill), shards: f.epicCraft.shards };
  return { gold: Math.floor(f.craftGoldKills * kill), shards: f.craftShards };
}

export function craftItem(state, slot, rng, balance = BALANCE, tier = 'rare') {
  const cost = craftCost(state, balance, tier);
  if (state.gold < cost.gold || state.materials.shards < cost.shards) return null;
  if (state.inventory.length >= balance.loot.inventorySize) return null;
  state.gold -= cost.gold;
  state.materials.shards -= cost.shards;
  const minRarity = tier === 'epic' ? 'epic' : balance.forge.craftMinRarity;
  const item = generateItem(state, rng, { level: state.maxStage, minRarity, slot }, balance);
  addToInventory(state, item, balance);
  trackMissions(state, 'upgrades', 1);
  return item;
}

// v9.1.3 (doc3 lot 1, point 10) : la Forge voit aussi le coffre.
const findItem = (state, id) => [...state.inventory, ...Object.values(state.equipment), ...(state.stash ?? [])].find((i) => i?.id === id);

export function canReforge(item) {
  return Boolean(item) && rarityIndex(item.rarity) >= 1 && !itemBase(item.baseId).signature;
}

export function reforgeItem(state, id, rng, balance = BALANCE) {
  const item = findItem(state, id);
  const f = balance.forge;
  if (!canReforge(item) || state.materials.shards < f.reforgeShards) return false;
  state.materials.shards -= f.reforgeShards;
  rerollAffixes(item, rng, balance);
  // v9.1.3 (doc3 lot 1, point 7) : les renforcements d'effets s'appliquent tout de suite aux nouveaux effets
  // (avant, ils semblaient perdus jusqu'au prochain recalcul).
  for (const a of item.affixes ?? []) delete a.base;
  refreshItemStats(item, balance);
  return true;
}

// v9.1.3 (doc3 lot 3) : relance orientée. Épique et Légendaire seulement (pas les ancestraux, effets fixes) ;
// la 1re ligne d'effet tirée (après l'effet principal d'un accessoire) devient l'effet choisi, valeur ±20 % ;
// les autres lignes (Légendaire) restent au hasard. `dropChance` n'est jamais une cible.
export function targetRerollCost(item, balance = BALANCE) {
  const row = balance.forge.targetReroll?.[item?.rarity];
  if (!row) return null;
  return ACCESSORY_SLOTS.includes(item.slot) ? row.accessory : row.gear;
}
export function canTargetReroll(item, balance = BALANCE) {
  return canReforge(item) && targetRerollCost(item, balance) !== null;
}
// Effets proposés pour la 1re ligne : ceux de l'emplacement, hors effet principal et hors exclus.
export function targetRerollChoices(item, balance = BALANCE) {
  if (!canTargetReroll(item, balance)) return [];
  const main = itemBase(item.baseId).mainAffix?.type;
  const excluded = new Set(balance.forge.targetRerollExcluded ?? []);
  return Object.entries(AFFIXES).filter(([type, a]) => a.slots.includes(item.slot) && type !== main && !excluded.has(type)).map(([type]) => type);
}
export function targetReroll(state, id, type, rng, balance = BALANCE) {
  const item = findItem(state, id);
  const cost = targetRerollCost(item, balance);
  if (!canTargetReroll(item, balance) || !targetRerollChoices(item, balance).includes(type) || state.materials.shards < cost) return false;
  state.materials.shards -= cost;
  rerollAffixes(item, rng, balance, type);
  for (const a of item.affixes ?? []) delete a.base;
  refreshItemStats(item, balance);
  return true;
}

export function sharpenCost(state, item, balance = BALANCE) {
  if (!item || item.level >= state.maxStage) return 0;
  return balance.forge.sharpenShardsPerLevel * (state.maxStage - item.level) * (balance.forge.sharpenRarityFactor[item.rarity] ?? 1); // v9.1.3 (doc3 lot 2) : table dans BALANCE
}

export function sharpenItem(state, id, balance = BALANCE) {
  const item = findItem(state, id);
  const cost = sharpenCost(state, item, balance);
  if (!cost || state.materials.shards < cost) return false;
  state.materials.shards -= cost;
  item.level = state.maxStage;
  refreshItemStats(item, balance);
  return true;
}

// --- Amélioration : chaque niveau augmente une statistique de l'objet au hasard (+12 %). ---
export function maxUpgrades(item, balance = BALANCE) {
  return balance.forge.maxUpgrades[item.rarity] ?? 0;
}

export function upgradeCost(item, balance = BALANCE) {
  const f = balance.forge;
  const n = (item.upgrades ?? 0) + 1;
  return { gold: Math.floor(f.upgradeGoldKills * n * referenceKillGold(item.level, balance)), shards: f.upgradeShards * n };
}

// Statistiques améliorables : les statistiques positives et l'effet principal d'un accessoire.
export function upgradableStats(item) { // v9.1.3 (doc3 lot 3) : exportée pour l'outil de mesure
  const base = itemBase(item.baseId);
  const stats = Object.entries(base.stats).filter(([, v]) => v > 0).map(([k]) => k);
  if (base.mainAffix) stats.push('main');
  // v8.2 : les effets spéciaux (affixes) s'améliorent aussi — indispensable pour les accessoires et les
  // objets ancestraux qui n'ont parfois aucune statistique de base (avant, « Améliorer » ne faisait rien).
  (item.affixes ?? []).forEach((a, i) => {
    if (!(base.mainAffix && i === 0 && a.type === base.mainAffix.type)) stats.push(`affix:${i}`);
  });
  return stats;
}

// Renvoie le nom de la statistique améliorée, ou null.
export function upgradeItem(state, id, rng, balance = BALANCE) {
  const item = findItem(state, id);
  if (!item || (item.upgrades ?? 0) >= maxUpgrades(item, balance)) return null;
  const cost = upgradeCost(item, balance);
  if (state.gold < cost.gold || state.materials.shards < cost.shards) return null;
  const stats = upgradableStats(item);
  if (!stats.length) return null;
  state.gold -= cost.gold;
  state.materials.shards -= cost.shards;
  const stat = stats[Math.floor(rng.next() * stats.length)];
  item.boosts = { ...(item.boosts ?? {}), [stat]: (item.boosts?.[stat] ?? 0) + 1 };
  item.upgrades = (item.upgrades ?? 0) + 1;
  refreshItemStats(item, balance);
  trackMissions(state, 'upgrades', 1);
  return stat;
}

// --- Fusion : 5 objets d'un même emplacement et d'une même rareté → 1 objet de la rareté suivante. ---
// v9.1.3 (doc3 lot 2) : fusion à pourcentage. Table `BALANCE.forge.fusion` : une rareté absente n'est pas
// fusionnable ; `rate` = chance de la mise de 5, `stakes` = mises plus courtes (chance de base), `pityStep` = jauge
// gagnée à l'échec. Commun et Rare : 5 pour 1, sûr. Épique : 5 = 100 %, 4 = 65 %, 3 = 30 %.
export function fusionRule(rarity, balance = BALANCE) {
  const rule = balance.forge.fusion?.[rarity];
  return rule && rarityIndex(rarity) >= 0 && rarityIndex(rarity) < RARITIES.length - 1 ? rule : null;
}
export const fusableRarities = (balance = BALANCE) => RARITIES.map((r) => r.id).filter((r) => fusionRule(r, balance));

// Mises possibles d'une rareté, de la plus courte à 5.
export function fusionStakes(rarity, balance = BALANCE) {
  const rule = fusionRule(rarity, balance);
  if (!rule) return [];
  const n = balance.forge.fusionCount;
  return [...Object.keys(rule.stakes ?? {}).map(Number).filter((k) => k > 0 && k < n), n].sort((a, b) => a - b);
}

export const pityKey = (slot, rarity) => `${slot}|${rarity}`;
export const fusionPity = (state, slot, rarity) => state.fusionPity?.[pityKey(slot, rarity)] ?? 0;

// Chance d'une mise en % : base + jauge, au plus 100. `base` seule : sans la jauge. null = mise impossible.
export function fusionChance(state, slot, rarity, stake, balance = BALANCE, { base = false } = {}) {
  const rule = fusionRule(rarity, balance);
  if (!rule) return null;
  const rate = stake === balance.forge.fusionCount ? rule.rate : rule.stakes?.[stake];
  if (!Number.isFinite(rate)) return null;
  return Math.min(100, rate + (base ? 0 : fusionPity(state, slot, rarity)));
}

const fusable = (item) => !item.locked && !itemBase(item.baseId).signature;

// v9.1.3 : la fusion à la main (un groupe ou « Fusionner tout ») protège comme l'automatique — objet meilleur que
// l'équipé, pièce d'ensemble utile — et en plus tout objet payé (renforcé avec de l'or et des éclats).
// v9.1.3 (doc3 lot 1, point 4) : et le filtre « garder si tel effet » des règles de recyclage.
// v9.1.3 (doc3 lot 2) : une seule protection pour tout (groupes, écran, main.js, fusion auto). Toujours exclus :
// verrouillés et ancestraux. Exclus sauf « Inclure » (à la main seulement) : renforcés, meilleurs que l'équipé,
// pièces d'ensemble utiles, effets à garder, objets d'un build. `fusionKeep(state)` = automatique et « Fusionner
// tout » ; `{ include: ['weapon|epic'] }` = groupes dont le joueur a inclus les objets protégés.
// Le prédicat porte `reason(item)` : 'locked', 'ancestral', 'upgraded', 'better', 'set', 'affix', 'build' ou null.
export function fusionKeep(state, { include = [] } = {}) {
  const rules = recycleRules(state);
  const inBuild = new Set((state.loadouts ?? []).flatMap((l) => Object.values(l?.gear ?? {})).filter(Boolean));
  const included = new Set(include);
  const reason = (i) => {
    if (i.locked) return 'locked';
    if (itemBase(i.baseId).signature) return 'ancestral';
    if ((i.upgrades ?? 0) > 0) return 'upgraded';
    if (inBuild.has(i.id)) return 'build';
    if (keptByAffix(rules, i)) return 'affix';
    if (usefulSetPiece(state, i, itemPower)) return 'set';
    if (isUpgrade(state, i)) return 'better';
    return null;
  };
  const keep = (i) => {
    const r = reason(i);
    if (!r) return false;
    if (r === 'locked' || r === 'ancestral') return true;
    return !included.has(pityKey(i.slot, i.rarity));
  };
  keep.reason = reason;
  return keep;
}

// Groupes du sac : [{ slot, rarity, next, bag, usable, protected, auto, stakes }].
// bag = objets du sac de ce couple ; usable = ceux que `keep` laisse passer ; protected = protégés qu'un appui
// sur « Inclure » rend utilisables (hors verrouillés et ancestraux). Seuil d'écran : la plus petite mise (3 pour
// l'Épique, 5 ailleurs) en objets utilisables ou incluables. auto = « Fusionner tout » / fusion auto possibles
// (5 utilisables et 100 % de base).
export function fusionGroups(state, balance = BALANCE, keep = null) {
  const n = balance.forge.fusionCount;
  const groups = new Map();
  for (const item of state.inventory) {
    if (!fusionRule(item.rarity, balance)) continue;
    const key = pityKey(item.slot, item.rarity);
    if (!groups.has(key)) groups.set(key, { slot: item.slot, rarity: item.rarity, bag: 0, usable: 0, protected: 0 });
    const g = groups.get(key);
    g.bag += 1;
    if (!fusable(item)) continue;
    if (!keep?.(item)) g.usable += 1;
    else if (!['locked', 'ancestral'].includes(keep.reason?.(item))) g.protected += 1;
  }
  return [...groups.values()]
    .map((g) => {
      const stakes = fusionStakes(g.rarity, balance);
      return { ...g, count: g.usable, next: RARITIES[rarityIndex(g.rarity) + 1].id, stakes,
        auto: g.usable >= n && fusionChance(state, g.slot, g.rarity, n, balance, { base: true }) >= 100 };
    })
    .filter((g) => g.usable + g.protected >= g.stakes[0])
    .sort((a, b) => rarityIndex(a.rarity) - rarityIndex(b.rarity) || a.slot.localeCompare(b.slot));
}

// Objets qu'une mise consommerait : armes non portables d'abord, puis niveau croissant.
export function fusionPool(state, slot, rarity, keep = null) {
  return state.inventory.filter((i) => i.slot === slot && i.rarity === rarity && fusable(i) && !keep?.(i))
    .sort((a, b) => Number(canEquip(state, a)) - Number(canEquip(state, b)) || a.level - b.level);
}

// Fusionne `stake` objets du groupe (5 par défaut). null = fusion impossible (rareté non fusionnable, mise
// inconnue, pas assez d'objets). Sinon { ok, item, returned, lost, chance } :
// - réussite : nouvel objet au niveau du meilleur ; jauge remise à 0, sauf si la mise de 5 était à 100 % sans elle ;
// - échec : l'objet de plus haut niveau reste dans le sac (jamais retiré : pas de faux objet trouvé), les autres
//   sont perdus (`lost` = leur nombre), jauge +pityStep (au plus 100).
// v9.1.3 (doc3 lot 2) : une arme fusionnée suit la règle du butin (70 % de modèles de la classe active).
// v9.1.3 (doc3 lot 5) : héritage d'ensemble. Ensembles présents parmi les objets consommés, avec la chance
// min(pièces × perPiece, max) % que le résultat en fasse partie : [{ set, n, chance }], le plus fréquent d'abord.
export function fusionInheritOptions(used, balance = BALANCE) {
  const rule = balance.forge.fusionSetInherit;
  if (!rule) return [];
  const counts = new Map();
  for (const i of used) if (i.set) counts.set(i.set, (counts.get(i.set) ?? 0) + 1);
  return [...counts].map(([set, n]) => ({ set, n, chance: Math.min(rule.max, n * rule.perPiece) }))
    .sort((a, b) => b.n - a.n || a.set.localeCompare(b.set));
}
// Objets qu'une mise consommerait (pour l'écran : chance d'héritage de la mise la plus haute possible).
export function fusionUsed(state, slot, rarity, keep, stake) {
  return fusionPool(state, slot, rarity, keep).slice(0, stake);
}

// `inherit` (lot 5) : 'auto' = ensemble le plus fréquent parmi les objets consommés, un id = cet ensemble,
// null = « Aucun ». Le tirage d'héritage n'a lieu qu'après une réussite et seulement s'il y a des pièces :
// chances, jauge et garanties du lot 2 inchangées.
export function fuseItems(state, slot, rarity, rng, balance = BALANCE, keep = null, stake = balance.forge.fusionCount, inherit = 'auto') {
  const chance = fusionChance(state, slot, rarity, stake, balance);
  if (chance === null) return null;
  const pool = fusionPool(state, slot, rarity, keep);
  if (pool.length < stake) return null;
  const used = pool.slice(0, stake);
  const rule = fusionRule(rarity, balance);
  const key = pityKey(slot, rarity);
  state.fusionPity ??= {};
  const success = chance >= 100 || rng.next() * 100 < chance;
  if (!success) {
    const returned = used.reduce((best, i) => (i.level > best.level ? i : best), used[0]);
    const ids = new Set(used.filter((i) => i !== returned).map((i) => i.id));
    state.inventory = state.inventory.filter((i) => !ids.has(i.id));
    state.fusionPity[key] = Math.min(100, fusionPity(state, slot, rarity) + (rule.pityStep ?? 0));
    return { ok: false, item: null, returned, lost: ids.size, chance };
  }
  const ids = new Set(used.map((i) => i.id));
  state.inventory = state.inventory.filter((i) => !ids.has(i.id));
  const safe = stake === balance.forge.fusionCount && rule.rate >= 100;
  if (!safe) delete state.fusionPity[key];
  const level = Math.max(...used.map((i) => i.level));
  const classPool = slot === 'weapon' ? classWeaponBases(activeClass(state).id) : [];
  const base = classPool.length && rng.next() < CLASS_WEAPON_DROP
    ? rng.pick(classPool) : rng.pick(ITEM_BASES.filter((b) => b.slot === slot));
  const item = makeItem(state, base.id, RARITIES[rarityIndex(rarity) + 1].id, level, balance, rng);
  if (inherit !== null) {
    const opts = fusionInheritOptions(used, balance);
    const pick = inherit === 'auto' ? opts[0] : opts.find((o) => o.set === inherit);
    if (pick && rng.next() * 100 < pick.chance) item.set = pick.set;
  }
  addToInventory(state, item, balance);
  return { ok: true, item, returned: null, lost: 0, chance };
}

// Fusion automatique (v8.1) : dès que 5 objets du même emplacement et de la même rareté (parmi les raretés
// choisies) sont dans le sac, ils sont fusionnés. v9.1.3 (doc3 lot 2) : mise de 5 seulement, à 100 % de base
// seulement, jamais un objet protégé (`fusionKeep`). Renvoie les objets créés.
export function autoFuse(state, rng, _isUpgrade = null, balance = BALANCE) { // v9.1.3 : 3e paramètre gardé pour les appelants
  const rules = state.ui?.autoFuse;
  if (!rules?.on || !rules.rarities?.length) return [];
  const made = [];
  for (let guard = 0; guard < 50; guard++) {
    const keep = fusionKeep(state);
    const g = fusionGroups(state, balance, keep).find((x) => x.auto && rules.rarities.includes(x.rarity));
    if (!g) break;
    const r = fuseItems(state, g.slot, g.rarity, rng, balance, keep);
    if (!r?.ok) break;
    made.push(r.item);
  }
  return made;
}

// « Fusionner tout » : mêmes règles que l'automatique, toutes raretés. Renvoie le nombre de fusions réussies.
export function fuseAll(state, rng, balance = BALANCE) {
  let n = 0;
  for (let guard = 0; guard < 500; guard++) {
    const keep = fusionKeep(state);
    const g = fusionGroups(state, balance, keep).find((x) => x.auto);
    if (!g) break;
    const r = fuseItems(state, g.slot, g.rarity, rng, balance, keep);
    if (!r?.ok) break;
    n += 1;
  }
  return n;
}

// v9.1.3 (doc3 lot 2) : message d'échec, ex. « Échec (65 %) : 3 objets perdus, Hache rendue, jauge Arme +20 ».
const FEMININE = new Set(['Épée', 'Hache', 'Dague', 'Massue', 'Lance', 'Hallebarde', 'Arbalète', 'Baguette', 'Faux', 'Faucheuse',
  'Cuirasse', 'Robe', 'Chevalière', 'Créoles']);
export function fusionFailText(result, slotLabel, step) {
  const word = String(result.returned?.name ?? '').split(' ')[0];
  const plural = /s$/.test(word) && word !== 'Faux';
  const given = `rendu${FEMININE.has(word) ? 'e' : ''}${plural ? 's' : ''}`;
  const n = result.lost;
  return `Échec (${result.chance} %) : ${n} objet${n > 1 ? 's' : ''} perdu${n > 1 ? 's' : ''}, ${result.returned?.name} ${given}, jauge ${slotLabel} +${step}`;
}
