// Classes du héros (v9.0.6) : classe active, armes autorisées, changement de classe.
import { applyClassSkillNames } from '../data/skills.js';
import { CLASSES, STARTER_CLASS } from '../data/classes.js';
import { ITEM_BASES } from '../data/items.js';
import { itemBase, itemPower, makeItem, refreshItemStats } from './loot.js';
import { placeItem } from './stash.js';
import { COMPANIONS } from '../data/companions.js';
import { gearClassOf } from '../data/companion-gear.js';

export const classById = (id) => CLASSES.find((c) => c.id === id) ?? null;

export function activeClass(state) {
  return classById(state.heroClass) ?? classById(STARTER_CLASS);
}

export function classUnlocked(state, id) {
  const c = classById(id);
  return Boolean(c) && ((state.maxStage ?? 1) >= c.unlockStage || state.cheats?.allClasses === true);
}

// Classe d'une arme (null pour un casque, une armure ou un accessoire : toutes les classes les portent).
export function weaponClass(baseOrId) {
  const base = typeof baseOrId === 'string' ? itemBase(baseOrId) : baseOrId;
  if (!base || base.slot !== 'weapon') return null;
  return CLASSES.find((c) => c.weapons.includes(base.sprite)) ?? null;
}

// v9.3.4 (f) : classe d'équipement du héros (Attaquant, Défenseur, Soutien), selon sa classe de combat.
const DEFENDER_CLASSES = new Set(['knight', 'paladin', 'lancer']);
export function heroGearClass(state) { return DEFENDER_CLASSES.has(activeClass(state).id) ? 'defender' : 'attacker'; }
// Classe d'un objet ; les objets d'avant 9.3.4 (sans classe) suivent celle du héros.
export const itemClass = (state, item) => item?.cls ?? heroGearClass(state);
// Classe d'un objet lâché : celles de l'équipe en place (héros ×3, chaque compagnon ×1), 15 % au hasard.
export function rollItemClass(state, rng) {
  const all = ['attacker', 'defender', 'support']; // v9.3.8 : plus d'objets de familier
  if (rng.next() < 0.15) return all[Math.floor(rng.next() * all.length)];
  const pool = [heroGearClass(state), heroGearClass(state), heroGearClass(state)];
  for (const id of state.companions?.equipped ?? []) { const u = COMPANIONS.find((c) => c.id === id); if (u?.kind === 'ally') pool.push(gearClassOf(u)); }
  return pool[Math.floor(rng.next() * pool.length)];
}

export function canEquip(state, item) {
  if (item?.cls && item.cls !== heroGearClass(state)) return false; // v9.3.4 (f)
  const c = weaponClass(item?.baseId);
  return !c || c.id === activeClass(state).id;
}

// Bases d'armes de la classe (butin ciblé, arme de remplacement).
export function classWeaponBases(classId) {
  const c = classById(classId);
  return ITEM_BASES.filter((b) => b.slot === 'weapon' && c?.weapons.includes(b.sprite));
}

export function classEffects(state) {
  return { ...activeClass(state).effects };
}

// Portée d'attaque du héros (et de ses compétences).
export function classRange(state, balance) {
  return Math.max(balance.world.heroRange, activeClass(state).range);
}

// Change de classe. L'arme portée, si elle n'est pas de la nouvelle classe, est remplacée par la meilleure
// arme compatible du sac ; à défaut, elle est « reforgée » dans la première arme de la classe (même rareté,
// niveau, améliorations et effets) : changer de classe ne fait jamais perdre de puissance.
// Renvoie { changed, reforged, swapped } ou null.
export function setHeroClass(state, id, power = () => 0) {
  if (!classUnlocked(state, id) || state.heroClass === id) return null;
  state.heroClass = id;
  applyClassSkillNames(id); // v9.8 (F)
  const weapon = state.equipment.weapon;
  if (!weapon || canEquip(state, weapon)) return { changed: true };
  const best = state.inventory.filter((i) => i.slot === 'weapon' && canEquip(state, i)).sort((a, b) => power(b) - power(a))[0];
  if (best) {
    state.inventory.splice(state.inventory.indexOf(best), 1, weapon);
    state.equipment.weapon = best;
    return { changed: true, swapped: best };
  }
  const reforged = reforgeForClass(state, weapon, id);
  if (!reforged) return { changed: true };
  // Une arme ancestrale garde son identité : elle retourne au sac (v9.1.3 : ou au coffre, ou en attente — jamais
  // perdue ni rognée au chargement) et une arme de la classe la remplace.
  if (itemBase(weapon.baseId)?.signature) placeItem(state, weapon);
  state.equipment.weapon = reforged;
  return { changed: true, reforged };
}

// v9.1.3 (doc3 lot 1, point 5) : arme de remplacement sans perte. Même rareté, niveau, effets, renforcements et
// verrou ; statistiques recalculées sur la nouvelle base (avant : `{ ...weapon, baseId }` gardait celles de l'ancienne
// base, et l'arme neuve d'un ancestral n'avait ni effets ni renforcements). Les renforcements d'une statistique
// absente de la nouvelle base passent aux dégâts. Parmi les armes de la classe, la plus puissante est retenue.
// Une arme ancestrale reste au sac : sa copie prend un nouvel identifiant.
export function reforgeForClass(state, weapon, classId) {
  const ancestral = Boolean(itemBase(weapon.baseId)?.signature);
  let best = null;
  for (const base of classWeaponBases(classId)) {
    const boosts = {};
    for (const [k, n] of Object.entries(weapon.boosts ?? {})) {
      const key = k.startsWith('affix:') || k === 'main' || (base.stats[k] ?? 0) > 0 ? k : 'damage';
      boosts[key] = (boosts[key] ?? 0) + n;
    }
    const fresh = makeItem(state, base.id, weapon.rarity, weapon.level);
    state.nextItemId -= 1; // identifiant attribué une seule fois, après le choix
    const item = {
      ...fresh, id: weapon.id, locked: Boolean(weapon.locked), upgrades: weapon.upgrades ?? 0,
      boosts, affixes: (weapon.affixes ?? []).map((a) => ({ ...a })), ...(weapon.set ? { set: weapon.set } : {}),
    };
    refreshItemStats(item);
    if (!best || itemPower(item) > itemPower(best)) best = item;
  }
  if (best && ancestral) { best.id = `it${state.nextItemId}`; state.nextItemId += 1; }
  return best;
}

export function sanitizeHeroClass(raw) {
  return classById(raw) ? raw : STARTER_CLASS;
}
