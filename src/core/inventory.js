// Inventaire : ajout, équipement, recyclage, tri et comparaison.
import { BALANCE } from '../data/balance.js';
import { ACCESSORY_SLOTS, EQUIP_SLOTS, SLOTS, eqSlot, heroSlot } from '../data/items.js';
import { addGold } from './economy.js';
import { trackContracts } from './contracts.js';
import { itemBase, itemPower, rarityIndex, recycleLevelOf, recycleMaterials, recycleValue } from './loot.js';
import { computeHeroStats, statsWithItem } from './stats.js';
import { recordItem } from './codex.js';
import { canEquip } from './classes.js';
import { canEquip as unitCanEquip, equipGear, gearStats, setGearGenerator, unitGear } from './companion-gear.js';
import { generateItem } from './loot.js';
import { levelForStage } from './combat.js';
import { COMPANIONS } from '../data/companions.js';

// v9.3.4 (f) : butin d'équipement des modes compagnons (Arène, donjons) = objet commun, rangé sans jamais être perdu.
setGearGenerator((state, rng, opts) => {
  const item = generateItem(state, rng, { level: levelForStage(Math.max(1, state.maxStage ?? 1)), ...opts });
  if (item) placeItem(state, item);
  return item;
});

// Score d'un objet pour un compagnon (somme pondérée de ses bonus, recharge comprise).
const unitScore = (state, item) => Object.values(gearStats(item, state)).reduce((a, v) => a + v, 0);
// Compagnon de l'équipe pour qui l'objet est meilleur que ce qu'il porte (ou place vide), sinon null.
export function teamUpgradeFor(state, item) {
  for (const id of state.companions?.equipped ?? []) {
    if (!unitCanEquip(state, id, item).ok) continue;
    const worn = unitGear(state, id)[eqSlot(item)];
    if (!worn || unitScore(state, item) > unitScore(state, worn) + 1e-6) return id;
  }
  return null;
}
// « Équiper le meilleur » pour les compagnons de l'équipe : renvoie le nombre d'objets équipés.
export function equipBestTeam(state) {
  let n = 0;
  for (const id of state.companions?.equipped ?? []) {
    if (!COMPANIONS.some((c) => c.id === id)) continue;
    for (const slot of Object.keys(EQUIP_SLOTS)) {
      const cands = state.inventory.filter((i) => eqSlot(i) === slot && !i.locked && unitCanEquip(state, id, i).ok);
      const worn = unitGear(state, id)[slot];
      const best = cands.sort((a, b) => unitScore(state, b) - unitScore(state, a))[0];
      if (best && (!worn || unitScore(state, best) > unitScore(state, worn) + 1e-6) && equipGear(state, id, best.id)) n += 1;
    }
  }
  return n;
}
import { usefulSetPiece } from './sets.js';
import { autoStashSet, placeItem, storeItem } from './stash.js';
import { autoMuseum, isAncestral } from './museum.js';
import { invFeatureOpen } from './unlocks.js';

// v9.1.3 (doc3 lot 1, point 9) : Codex, Musée et garde des pièces d'ensemble sont séparés de la décision de
// recyclage : tout objet reçu (butin, Forge, donjon, coffre, marchand, Prime, fusion) passe par là.
// Renvoie un résultat si l'objet a été rangé ainsi, sinon null.
function intake(state, item, balance) {
  if (state.codex) recordItem(state, item);
  // v9.0 : objet ancestral → sa vitrine du Musée (si elle est vide ou s'il est meilleur).
  if (state.museum && autoMuseum(state, item, balance)) return { added: false, museum: true, recycledGold: 0 };
  // v8.9 : pièce d'ensemble meilleure que la meilleure gardée → rangée d'elle-même (l'ancienne est recyclée).
  // v9.1.3 : au coffre (mannequins fondus), et pas avant l'ouverture du coffre.
  if (state.stash && invFeatureOpen(state, 'stash')) {
    const replaced = autoStashSet(state, item);
    if (replaced !== false) return { added: false, mannequin: true, recycledGold: replaced ? salvage(state, replaced, balance) : 0, recycled: Boolean(replaced) };
  }
  return null;
}

// Objet payé ou donné (Forge, donjon, coffre, marchand, Prime, fusion, classe) : toujours reçu.
// v9.1.3 (doc3 lot 1) : sac plein → coffre ; coffre plein → en attente dans « À récupérer ». Avant : recyclé en
// or seulement (sans éclats), même un Légendaire payé.
export function addToInventory(state, item, balance = BALANCE) {
  state.records.itemsFound += 1;
  const kept = intake(state, item, balance);
  if (kept) return kept;
  const where = placeItem(state, item, balance);
  return { added: where === 'bag', stored: where === 'stash', held: where === 'held', recycledGold: 0 };
}

export function equipItem(state, itemId) {
  const index = state.inventory.findIndex((i) => i.id === itemId);
  if (index < 0) return false;
  const item = state.inventory[index];
  if (!canEquip(state, item)) return false; // v9.0.6 : arme ou objet d'une autre classe
  const previous = state.equipment[heroSlot(item)];
  state.inventory.splice(index, 1);
  if (previous) state.inventory.splice(index, 0, previous);
  state.equipment[heroSlot(item)] = item;
  if (state.records) state.records.equips = (state.records.equips ?? 0) + 1; // v9.7.1 (lot 3)
  return true;
}

// v10.3 (8) : « Retirer » — l'objet porté par le héros retourne au sac (même plein : jamais perdu).
export function unequipItem(state, slot) {
  const item = state.equipment?.[slot];
  if (!item) return false;
  state.equipment[slot] = null;
  state.inventory.push(item);
  return true;
}

// v10.3 (8) : ce que chaque objet du sac apporterait au héros à la place de l'objet porté.
// Map id → { pct (Puissance, en %), up (meilleur, même bilan qu'isUpgrade), slot } ; seuls les objets que le héros
// peut porter y figurent. Un seul calcul des statistiques par objet : sert aux flèches ▲, aux listes triées par gain,
// à « Mieux dans ton sac » et à l'Équipement rapide.
export function heroGains(state, balance = BALANCE, current = computeHeroStats(state, balance)) {
  const out = new Map();
  for (const item of state.inventory) {
    if (!canEquip(state, item)) continue;
    const slot = heroSlot(item);
    const next = statsWithItem(state, item, balance);
    const pct = current.combatPower > 0 ? (next.combatPower / current.combatPower - 1) * 100 : 0;
    let up;
    if (!state.equipment[slot]) up = true;
    else {
      const score = Math.log(next.dps / current.dps) + Math.log(ehp(next) / ehp(current));
      up = Math.abs(score) > 1e-4 ? score > 0 : extras(next) > extras(current) + 1e-6;
    }
    out.set(item.id, { pct, up, slot, score: state.equipment[slot] ? profileGain(current, next) : Infinity });
  }
  return out;
}
// Meilleur objet du sac pour chaque place du héros (seulement s'il est meilleur que l'objet porté) :
// { slot: { item, pct } }. `gains` = heroGains(state) déjà calculé (facultatif).
export function bestPerSlot(state, balance = BALANCE, gains = heroGains(state, balance)) {
  const best = {};
  for (const item of state.inventory) {
    const g = gains.get(item.id);
    if (!g?.up) continue;
    if (!best[g.slot] || g.score > best[g.slot].score || (g.score === best[g.slot].score && g.pct > best[g.slot].pct)) best[g.slot] = { item, pct: g.pct, score: g.score };
  }
  return best;
}
// « Équipement rapide » du héros : équipe le meilleur objet de chaque place. Renvoie le nombre d'objets équipés.
export function quickEquipHero(state, balance = BALANCE) {
  let n = 0;
  for (const { item } of Object.values(bestPerSlot(state, balance))) if (equipItem(state, item.id)) n += 1;
  return n;
}
// Aperçu de l'Équipement rapide du héros : { changes: [{ slot, from, to, pct }], before, after } (Puissance).
export function quickEquipPlan(state, balance = BALANCE, gains = undefined) {
  const current = computeHeroStats(state, balance);
  const best = bestPerSlot(state, balance, gains ?? heroGains(state, balance, current));
  const equipment = { ...state.equipment };
  const changes = Object.entries(best).map(([slot, b]) => { equipment[slot] = b.item; return { slot, from: state.equipment[slot] ?? null, to: b.item, pct: b.pct }; });
  return { changes, before: current.combatPower, after: changes.length ? computeHeroStats(state, balance, equipment).combatPower : current.combatPower };
}

// Retourne l'or gagné, ou 0 si l'objet n'est pas dans l'inventaire ou s'il est verrouillé.
export function recycleItem(state, itemId, balance = BALANCE) {
  const index = state.inventory.findIndex((i) => i.id === itemId);
  if (index < 0 || state.inventory[index].locked) return 0;
  const [item] = state.inventory.splice(index, 1);
  return salvage(state, item, balance);
}

// Règle de collecte (Automatisation) : recycler dès le ramassage les objets jusqu'à une rareté donnée
// ('off', 'common' ou 'rare'). Jamais un objet signature ni un objet meilleur que l'équipement porté.
export const AUTO_RECYCLE_RULES = { off: 'Tout garder', common: 'Recycler les Communs', rare: 'Recycler Communs et Rares' };

// v7.7 : règles de recyclage automatique configurables.
// mode : 'off' | 'pickup' (dès le ramassage) | 'full' (seulement quand le sac est plein) ;
// rarities / slots : ce qui est recyclé. Jamais : objet équipé, verrouillé, ancestral, ou meilleur que l'équipé.
export const RECYCLE_MODES = { off: 'Désactivé', pickup: 'Au ramassage', full: 'Quand le sac est plein' };

export function recycleRules(state) {
  const r = state.ui?.recycle;
  if (r) return r;
  // Ancienne règle (v7.5) : Communs, ou Communs + Rares, au ramassage.
  const legacy = state.ui?.autoRecycle ?? 'off';
  if (legacy === 'off') return { mode: 'off', rarities: ['common'], slots: Object.keys(SLOTS) };
  return { mode: 'pickup', rarities: legacy === 'rare' ? ['common', 'rare'] : ['common'], slots: Object.keys(SLOTS) };
}

// v9.1.0 : filtres enregistrés « garder si… » : un objet qui porte l'un de ces effets n'est jamais recyclé automatiquement.
export const KEEP_AFFIX_LABELS = {
  critChance: 'Coup critique', lifesteal: 'Vol de vie', thorns: 'Épines', goldPct: 'Or', damageVsBossPct: 'Dégâts contre les boss',
  damageVsNormalPct: 'Dégâts contre les ennemis', regenPct: 'Régénération', dropChance: 'Chance de butin',
};

// v9.1.3 (doc3 lot 1, point 4) : filtre « garder si tel effet », partagé par la règle, le balayage et la fusion auto.
export function keptByAffix(rules, item) {
  return Boolean((rules?.keepAffixes ?? []).length && (item.affixes ?? []).some((a) => rules.keepAffixes.includes(a.type)));
}

export function matchesRecycleRule(state, item, rules = recycleRules(state)) {
  if (item.locked || itemBase(item.baseId).signature) return false;
  if (keptByAffix(rules, item)) return false;
  if (usefulSetPiece(state, item, itemPower)) return false; // v8.5 : pièce d'un ensemble en cours de collecte
  if (!rules.rarities.includes(item.rarity) || !rules.slots.includes(item.slot)) return false;
  return !isUpgrade(state, item);
}

export function shouldAutoRecycle(state, item) {
  const rules = recycleRules(state);
  if (rules.mode === 'pickup' && matchesRecycleRule(state, item, rules)) return true;
  return autoUseless(state, item);
}
// v9.3.8 (3d) : par défaut (réglable : state.ui.autoUseless = false), un objet Commun ou Rare qui ne sert à personne de
// l'équipe (autre classe, moins bon que l'équipé) est recyclé dès sa récupération. Jamais : verrouillé, ensemble utile,
// ancestral, Épique ou mieux.
export function autoUseless(state, item) {
  if (state.ui?.autoUseless === false || item.locked || item.set || !['common', 'rare'].includes(item.rarity)) return false;
  if (itemBase(item.baseId)?.signature) return false;
  return !isUpgrade(state, item);
}

// Sac plein (mode « quand le sac est plein ») : recycle les objets du sac qui correspondent aux règles.
// v9.1.0 : renvoie { gold, count } (avant, seul l'or remontait et il était perdu pour le journal).
export function recycleForSpace(state, balance = BALANCE) {
  const rules = recycleRules(state);
  if (rules.mode !== 'full') return { gold: 0, count: 0 };
  let gold = 0;
  let count = 0;
  for (const item of [...state.inventory]) {
    if (!matchesRecycleRule(state, item, rules)) continue;
    state.inventory.splice(state.inventory.indexOf(item), 1);
    gold += salvage(state, item, balance);
    count += 1;
  }
  return { gold, count };
}

// Ramassage d'un objet : recyclé automatiquement selon la règle, sinon rangé dans le sac.
// v9.1.3 (doc3 lot 1) : butin libre (combat, hors ligne). Sac plein : ancestraux et pièces d'ensemble utiles vont au
// coffre (ou en attente), le reste est recyclé complètement (or + éclats). Avant : tout en or sans éclats.
export function collectItem(state, item, balance = BALANCE) {
  trackContracts(state, 'items', 1);
  state.records.itemsFound += 1;
  const kept = intake(state, item, balance);
  if (kept) return kept;
  if (shouldAutoRecycle(state, item)) return { added: false, auto: true, recycled: true, recycledGold: salvage(state, item, balance) };
  // v9.7.1 : sac de butin dans la scène — l'objet attend le tri du joueur (40 au plus ; plein : comportement habituel).
  // v9.8 (0.2) : les 3 premiers objets vont directement dans le sac d'Équipement (premier « Équiper » sans détour).
  if (lootBagOn(state) && state.lootBag.length < LOOT_BAG_MAX && state.records.itemsFound > 3) {
    state.lootBag.push(item);
    return { added: false, bagged: true, recycledGold: 0 };
  }
  if (state.inventory.length < balance.loot.inventorySize) {
    state.inventory.push(item);
    return { added: true, recycledGold: 0 };
  }
  const freed = recycleForSpace(state, balance);
  if (state.inventory.length < balance.loot.inventorySize) {
    state.inventory.push(item);
    return { added: true, recycledGold: 0, freed };
  }
  const rule = recycleRules(state).mode === 'full' && matchesRecycleRule(state, item);
  // Ancestral ou verrouillé : jamais recyclé (coffre, sinon en attente). Pièce utile : au coffre s'il a de la place.
  if (!rule && (item.locked || isAncestral(item))) {
    const where = placeItem(state, item, balance);
    return { added: where === 'bag', stored: where === 'stash', held: where === 'held', recycledGold: 0, freed };
  }
  if (!rule && usefulSetPiece(state, item, itemPower) && storeItem(state, item, balance)) return { added: false, stored: true, recycledGold: 0, freed };
  return { added: false, auto: rule, full: !rule, recycled: true, recycledGold: salvage(state, item, balance), freed };
}

// Recyclage : or + éclats ; compte pour les contrats.
// v9.1.3 (doc3 lot 1) : or plafonné au niveau de l'étape max de la partie en cours (faille d'or après Renaissance).
function salvage(state, item, balance) {
  const materials = recycleMaterials(item, balance);
  state.materials.shards += materials.shards;
  trackContracts(state, 'recycle', 1);
  if (state.records) state.records.recycled = (state.records.recycled ?? 0) + 1; // v9.7.1 (lot 3)
  return addGold(state, recycleValue(item, balance, recycleLevelOf(state, balance)));
}

// Or de recyclage affiché (même plafond que salvage).
export function recycleGoldOf(state, item, balance = BALANCE) {
  return recycleValue(item, balance, recycleLevelOf(state, balance));
}

export function recycleMatching(state, predicate, balance = BALANCE) {
  let gold = 0;
  let count = 0;
  state.inventory = state.inventory.filter((item) => {
    if (item.locked || !predicate(item)) return true;
    gold += salvage(state, item, balance);
    count += 1;
    return false;
  });
  return { gold, count };
}

const itemNumber = (item) => Number.parseInt(item.id.slice(2), 10) || 0;

const SORTERS = {
  rarity: (a, b) => rarityIndex(b.rarity) - rarityIndex(a.rarity) || itemPower(b) - itemPower(a) || itemNumber(b) - itemNumber(a),
  level: (a, b) => b.level - a.level || rarityIndex(b.rarity) - rarityIndex(a.rarity),
  power: (a, b) => itemPower(b) - itemPower(a),
  recent: (a, b) => itemNumber(b) - itemNumber(a),
};

export function listInventory(state, { slot = 'all', sortBy = 'rarity', rarity = 'all' } = {}) {
  const items = state.inventory.filter((i) => (slot === 'all' || i.slot === slot || eqSlot(i) === slot)
    && (rarity === 'all' || i.rarity === rarity)); // v9.3.2 : filtre de rareté
  return items.sort(SORTERS[sortBy] ?? SORTERS.rarity);
}

// Différence de statistiques si l'objet était équipé à la place de l'actuel.
export function compareWithEquipped(state, item, balance = BALANCE) {
  const current = computeHeroStats(state, balance);
  const next = statsWithItem(state, item, balance);
  return {
    damage: next.damage - current.damage,
    dps: next.dps - current.dps,
    maxHp: next.maxHp - current.maxHp,
    armor: next.armor - current.armor,
    dpsBefore: current.dps, // v10.2 : pour « +x % de dégâts/s » dans le coffre de butin
  };
}

// Amélioration par rapport à l'équipement porté (v8.0) : bilan global DPS × robustesse (PV / (1 − armure)).
// Avant, « un peu plus de PV » suffisait, même avec beaucoup moins d'armure : presque tout était protégé
// du recyclage. Les stats secondaires (or, XP, vol de vie, épines, régénération) départagent les égalités.
const ehp = (s) => s.maxHp / Math.max(0.05, 1 - s.armor / 100);
const extras = (s) => s.goldPct + s.xpPct + s.lifesteal + s.thorns + (s.regenPerSecond / s.maxHp) * 100
  + (s.bonus?.dropChance ?? 0) * 3 + (s.bonus?.damageVsBossPct ?? 0) + (s.bonus?.damageVsNormalPct ?? 0) * 0.5;
export function isUpgrade(state, item, balance = BALANCE, current = computeHeroStats(state, balance)) {
  if (!canEquip(state, item)) return Boolean(teamUpgradeFor(state, item)); // v9.3.4 (f) : meilleur pour un compagnon
  if (!state.equipment[heroSlot(item)]) return true; // emplacement vide (accessoires en particulier)
  const next = statsWithItem(state, item, balance);
  const score = Math.log(next.dps / current.dps) + Math.log(ehp(next) / ehp(current));
  if (Math.abs(score) > 1e-4) return score > 0;
  return extras(next) > extras(current) + 1e-6;
}

// « Équiper le meilleur » (étape 3) : équipe, une pièce à la fois, l'objet du sac qui améliore le plus le
// héros (même bilan qu'isUpgrade), jusqu'à ce qu'aucun objet du sac ne soit meilleur. Renvoie le nombre d'objets équipés.
// v9.5.2 (2.1) : trois profils d'équipement. Attaque : dégâts d'abord ; Survie : PV effectifs d'abord ; Fortune : or et
// butin d'abord (sans tomber trop bas en dégâts). « Équilibré » = l'ancien « Équiper le meilleur ».
export const GEAR_PROFILES = {
  balanced: { label: 'Équilibré', dps: 1, ehp: 1, gold: 0 },
  attack: { label: 'Attaque', dps: 1, ehp: 0.25, gold: 0 },
  survival: { label: 'Survie', dps: 0.25, ehp: 1, gold: 0 },
  fortune: { label: 'Fortune', dps: 0.4, ehp: 0.2, gold: 1 },
};
const goldFactor = (st) => (1 + (st.goldPct ?? 0) / 100) * (st.goldMult ?? 1);
export function profileGain(current, next, profile = 'balanced') {
  const w = GEAR_PROFILES[profile] ?? GEAR_PROFILES.balanced;
  return w.dps * Math.log(next.dps / current.dps) + w.ehp * Math.log(ehp(next) / ehp(current)) + w.gold * Math.log(goldFactor(next) / goldFactor(current));
}

export function equipBest(state, balance = BALANCE, profile = state.ui?.gearProfile ?? 'balanced') {
  let count = 0;
  for (let guard = 0; guard < 24; guard++) {
    const current = computeHeroStats(state, balance);
    let best = null;
    let bestScore = -Infinity;
    for (const item of state.inventory) {
      if (!canEquip(state, item)) continue;
      if (profile === 'balanced' && !isUpgrade(state, item, balance, current)) continue;
      const next = statsWithItem(state, item, balance);
      const score = state.equipment[heroSlot(item)] ? profileGain(current, next, profile) : Infinity;
      if (profile !== 'balanced' && !(score > 1e-6)) continue;
      if (score > bestScore) { best = item; bestScore = score; }
    }
    if (!best || !equipItem(state, best.id)) break;
    count += 1;
  }
  return count + equipBestTeam(state); // v9.3.4 (f) : toute l'équipe en un clic
}

// Mode « au ramassage » : le sac est aussi trié régulièrement (objets devenus inutiles après un meilleur équipement).
export function sweepInventory(state, balance = BALANCE) {
  const rules = recycleRules(state);
  if (rules.mode !== 'pickup') return { gold: 0, count: 0 };
  const current = computeHeroStats(state, balance);
  const doomed = new Set(state.inventory.filter((item) => !item.locked && !itemBase(item.baseId).signature
    && !keptByAffix(rules, item) && rules.rarities.includes(item.rarity) && rules.slots.includes(item.slot)
    && !usefulSetPiece(state, item, itemPower) && !isUpgrade(state, item, balance, current)).map((i) => i.id));
  return doomed.size ? recycleMatching(state, (i) => doomed.has(i.id), balance) : { gold: 0, count: 0 };
}

// Objets proposés au recyclage groupé : rareté au plus `maxRarity`.
// en excluant toujours les objets qui amélioreraient le héros.
// v7.7+ : toutes les raretés (avec confirmation) ; jamais un objet verrouillé, ancestral ou meilleur que l'équipé.
export const BULK_RECYCLE_MAX = ['common', 'rare', 'epic', 'legendary'];
export function bulkRecycleCandidates(state, maxRarity = 'common', balance = BALANCE) {
  const limit = rarityIndex(BULK_RECYCLE_MAX.includes(maxRarity) ? maxRarity : 'common');
  const current = computeHeroStats(state, balance);
  return state.inventory.filter((item) => !item.locked && !itemBase(item.baseId).signature
    && rarityIndex(item.rarity) <= limit && !usefulSetPiece(state, item, itemPower) && !isUpgrade(state, item, balance, current));
}

// v9.3.4 : objets « inutiles » du sac (bouton Recycler toujours visible) : ni verrouillés, ni ancestraux, ni pièce
// d'ensemble utile, ni meilleurs que l'équipement porté, ni Légendaires. Recyclés d'un coup : or + éclats.
export function uselessItems(state, balance = BALANCE) {
  const current = computeHeroStats(state, balance);
  return state.inventory.filter((item) => !item.locked && !itemBase(item.baseId).signature && item.rarity !== 'legendary'
    && !usefulSetPiece(state, item, itemPower) && !isUpgrade(state, item, balance, current));
}
export function recycleUseless(state, balance = BALANCE) {
  const list = uselessItems(state, balance);
  const shards0 = state.materials.shards;
  let gold = 0;
  for (const item of list) gold += recycleItem(state, item.id, balance);
  return { count: list.length, gold, shards: state.materials.shards - shards0 };
}

// Verrouiller un objet le protège de tout recyclage (simple ou groupé).
// v9.1.3 (doc3 lot 1, point 10) : aussi au coffre.
export function toggleLock(state, itemId) {
  const item = [...state.inventory, ...Object.values(state.equipment), ...(state.stash ?? [])].find((i) => i?.id === itemId);
  if (!item) return null;
  item.locked = !item.locked;
  return item.locked;
}

// v9.6.1 (2.4) : grand effet actif du héros (un seul : l'arme d'abord, puis l'ordre des places).
const MAJOR_ORDER = ['weapon', 'helmet', 'armor', 'amulet', 'ring', 'bracelet'];
export function activeMajor(state) {
  for (const k of MAJOR_ORDER) { const m = state.equipment?.[k]?.major; if (m) return { id: m, slot: k }; }
  for (const it of Object.values(state.equipment ?? {})) if (it?.major) return { id: it.major, slot: null };
  return null;
}

// --- v9.7.1 : sac de butin (zone de combat) ---
export const LOOT_BAG_MAX = 40;
export const LOOT_DESTS = ['bag', 'stash', 'recycle'];
export function lootBagOn(state) {
  return state.ui?.lootBag !== false && Array.isArray(state.lootBag);
}
// Destination proposée par défaut, selon les règles existantes : meilleur que l'équipé (ou utile à l'équipe) → Sac ;
// ancestral, verrouillé ou pièce d'ensemble utile → Coffre ; règle de recyclage ou objet inutile → Recycler ; sinon Sac.
export function suggestLootDest(state, item) {
  if (isUpgrade(state, item) || teamUpgradeFor(state, item)) return 'bag';
  if (item.locked || isAncestral(item) || usefulSetPiece(state, item, itemPower)) return 'stash';
  const rules = recycleRules(state);
  if ((rules.mode !== 'off' && matchesRecycleRule(state, item, rules)) || autoUseless(state, item)) return 'recycle';
  if (!['common', 'rare'].includes(item.rarity)) return 'bag';
  return 'recycle';
}
// Tri du sac de butin (trié par rareté puis puissance pour l'affichage).
export function lootBagList(state) {
  return [...(state.lootBag ?? [])].sort(SORTERS.rarity);
}
// Applique le tri : choices = { [id]: 'bag' | 'stash' | 'recycle' } (absent → destination proposée).
// Rien n'est perdu : un objet verrouillé ou ancestral n'est jamais recyclé ; sac plein → coffre → en attente.
// remember : les raretés recyclées deviennent la règle de recyclage « au ramassage » (recycleRules).
export function sortLootBag(state, choices = {}, { remember = false } = {}, balance = BALANCE) {
  const out = { bag: 0, stash: 0, held: 0, recycled: 0, gold: 0 };
  const recycledRarities = new Set();
  const keptRarities = new Set();
  for (const item of [...(state.lootBag ?? [])]) {
    let dest = LOOT_DESTS.includes(choices[item.id]) ? choices[item.id] : suggestLootDest(state, item);
    if (dest === 'recycle' && (item.locked || isAncestral(item))) dest = 'stash';
    state.lootBag.splice(state.lootBag.indexOf(item), 1);
    if (dest === 'recycle') {
      out.gold += salvage(state, item, balance);
      out.recycled += 1;
      recycledRarities.add(item.rarity);
      continue;
    }
    keptRarities.add(item.rarity);
    if (dest === 'bag' && state.inventory.length < balance.loot.inventorySize) { state.inventory.push(item); out.bag += 1; continue; }
    const where = placeItem(state, item, balance);
    out[where === 'held' ? 'held' : 'stash'] += 1;
  }
  if (remember && recycledRarities.size) {
    const cur = recycleRules(state);
    const rarities = [...new Set([...(cur.mode === 'off' ? [] : cur.rarities), ...recycledRarities])].filter((r) => !keptRarities.has(r) && ['common', 'rare', 'epic'].includes(r));
    if (rarities.length) state.ui.recycle = { ...cur, mode: 'pickup', rarities, slots: cur.slots ?? Object.keys(SLOTS), keepAffixes: cur.keepAffixes ?? [] };
  }
  return out;
}
// « Tout recycler sauf les meilleurs » : garde les améliorations (sac) et les objets protégés (coffre).
export function lootBagKeepBestChoices(state) {
  const choices = {};
  for (const item of state.lootBag ?? []) {
    const s = suggestLootDest(state, item);
    choices[item.id] = s === 'bag' && !(isUpgrade(state, item) || teamUpgradeFor(state, item)) ? 'recycle' : s;
  }
  return choices;
}
// Meilleure rareté en attente et présence d'une amélioration (liseré et flèche verte du sac).
export function lootBagSummary(state) {
  const bag = state.lootBag ?? [];
  let best = null;
  for (const i of bag) if (!best || rarityIndex(i.rarity) > rarityIndex(best)) best = i.rarity;
  return { count: bag.length, best, upgrade: bag.some((i) => isUpgrade(state, i)) };
}
