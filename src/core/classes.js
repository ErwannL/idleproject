// Classes du héros (v9.0.6) : classe active, armes autorisées, changement de classe.
import { CLASSES, STARTER_CLASS } from '../data/classes.js';
import { ITEM_BASES } from '../data/items.js';
import { itemBase, makeItem } from './loot.js';

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

export function canEquip(state, item) {
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
  const weapon = state.equipment.weapon;
  if (!weapon || canEquip(state, weapon)) return { changed: true };
  const best = state.inventory.filter((i) => i.slot === 'weapon' && canEquip(state, i)).sort((a, b) => power(b) - power(a))[0];
  if (best) {
    state.inventory.splice(state.inventory.indexOf(best), 1, weapon);
    state.equipment.weapon = best;
    return { changed: true, swapped: best };
  }
  const base = classWeaponBases(id)[0];
  if (!base) return { changed: true };
  // Une arme ancestrale garde son identité : elle retourne au sac et une arme neuve de la classe (même rareté
  // et niveau) la remplace.
  if (itemBase(weapon.baseId)?.signature) {
    state.inventory.push(weapon);
    state.equipment.weapon = makeItem(state, base.id, weapon.rarity, weapon.level);
    return { changed: true, reforged: state.equipment.weapon };
  }
  state.equipment.weapon = { ...weapon, baseId: base.id, name: base.name };
  return { changed: true, reforged: state.equipment.weapon };
}

export function sanitizeHeroClass(raw) {
  return classById(raw) ? raw : STARTER_CLASS;
}
