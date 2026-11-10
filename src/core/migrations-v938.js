// v9.3.8 (2.5) : le héros revient à 6 places (Arme, Casque, Armure, Collier, Anneau, Bracelet).
// 1. Avant la relecture (raw) : l'équipement en 3 places de la 9.3.4 (weapon, armor, accessory) est rangé par type :
//    une « armure » qui est un casque va au casque, l'« accessoire » va à la place de son bijou.
// 2. Après la relecture : chaque pièce réunie (`parts` : le casque dans l'armure, les bijoux dans l'accessoire) redevient
//    un objet à part entière — même rareté, niveau, améliorations, statistiques et effets. Il est porté si sa place est
//    libre, sinon rangé (sac, puis coffre ; jamais perdu). Les objets du sac, du coffre et ceux des compagnons aussi.
import { HERO_PLACE } from '../data/items.js';

export function migrateEquipmentPlaces938(raw) {
  const eq = raw?.equipment;
  if (!eq || typeof eq !== 'object' || !('accessory' in eq)) return raw;
  const out = { weapon: eq.weapon ?? null };
  for (const it of [eq.armor, eq.accessory, eq.helmet, eq.amulet, eq.ring, eq.bracelet, eq.earring]) {
    const place = it && typeof it === 'object' ? HERO_PLACE[it.slot] : null;
    if (place && !out[place]) out[place] = it;
  }
  raw.equipment = out;
  return raw;
}

// `make(part, parent)` : crée un objet complet depuis une pièce (nouvel identifiant, stats recalculées).
// `place(item)` : range un objet (sac, sinon coffre). Renvoie le nombre de pièces rendues.
export function splitParts938(state, { make, place }) {
  let n = 0;
  const split = (item) => {
    if (!item?.parts?.length) return [];
    const parts = item.parts.map((p) => make(p, item));
    delete item.parts;
    n += parts.length;
    return parts;
  };
  for (const item of Object.values(state.equipment)) {
    for (const p of split(item)) {
      const slot = HERO_PLACE[p.slot];
      if (slot && !state.equipment[slot]) state.equipment[slot] = p; else place(p);
    }
  }
  for (const list of [state.inventory, state.stash]) for (const item of [...list]) for (const p of split(item)) place(p);
  for (const slots of Object.values(state.companionGear?.equipped ?? {})) for (const item of Object.values(slots)) for (const p of split(item)) place(p);
  return n;
}
