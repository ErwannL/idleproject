// v9.3.4 (f) : équipement unique — migration des sauvegardes d'avant le format 12 (aucune perte de puissance).
// 1. Chevalier : 7 emplacements → 3 places. L'armure garde le casque comme pièce réunie (`parts`), l'accessoire
//    garde les 3 autres bijoux portés : statistiques et effets identiques, chaque pièce garde son niveau et ses
//    améliorations. Les builds suivent (armure ← armure ou casque, accessoire ← premier bijou).
// 2. Compagnons (9.3.3) : chaque pièce de leur ancien sac devient un objet commun de même rareté, même amélioration,
//    même profil de bonus (`cg`) et de la classe de son porteur (ou de la première classe compatible) ; les pièces
//    portées restent portées, les autres vont au sac (le surplus au coffre, jamais perdu).
import { GEAR_BASES, gearClassOf } from '../data/companion-gear.js';
import { COMPANIONS } from '../data/companions.js';
import { ITEM_BASES } from '../data/items.js';

const JEWELS = ['amulet', 'earring', 'ring', 'bracelet'];
const asPart = (it) => ({ baseId: it.baseId, stats: { ...(it.stats ?? {}) }, affixes: (it.affixes ?? []).map((a) => ({ type: a.type, value: a.value })),
  rarity: it.rarity, level: it.level, boosts: { ...(it.boosts ?? {}) } });

export function migrateEquipment934(raw) {
  const eq = raw.equipment;
  if (!eq || typeof eq !== 'object' || ('accessory' in eq && !('helmet' in eq))) return raw;
  const ok = (x) => x && typeof x === 'object';
  const armor = ok(eq.armor) ? eq.armor : ok(eq.helmet) ? eq.helmet : null;
  if (armor && ok(eq.armor) && ok(eq.helmet)) armor.parts = [asPart(eq.helmet)];
  const jewels = JEWELS.map((k) => eq[k]).filter(ok).sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
  const acc = jewels[0] ?? null;
  if (acc && jewels.length > 1) acc.parts = jewels.slice(1).map(asPart);
  raw.equipment = { weapon: ok(eq.weapon) ? eq.weapon : null, armor, accessory: acc };
  for (const l of Array.isArray(raw.loadouts) ? raw.loadouts : []) {
    const g = l?.gear;
    if (!g || typeof g !== 'object') continue;
    l.gear = { weapon: g.weapon ?? null, armor: g.armor ?? g.helmet ?? null, accessory: JEWELS.map((k) => g[k]).find(Boolean) ?? null };
  }
  return raw;
}

// Base commune la plus proche d'une pièce de compagnon (même place) : la première non ancestrale du bon type.
const BASE_FOR = { offense: 'short_sword', guard: 'chainmail', trinket: 'band_ring_ruby' };

// `make(baseId, rarity, level)` crée un objet commun (makeItem) ; `place(item)` le range (sac, sinon coffre).
export function migrateCompanionGear934(state, raw, { make, place, level }) {
  const g = raw?.companionGear;
  if (!g || typeof g !== 'object' || !Array.isArray(g.bag)) return 0;
  const wearer = {};
  for (const [unit, slots] of Object.entries(g.equipped && typeof g.equipped === 'object' ? g.equipped : {})) {
    for (const [slot, id] of Object.entries(slots ?? {})) wearer[id] = { unit, slot };
  }
  state.companionGear ??= { equipped: {} };
  let n = 0;
  for (const p of g.bag) {
    const base = GEAR_BASES.find((b) => b.id === p?.baseId);
    if (!base || !['common', 'rare', 'epic', 'legendary'].includes(p.rarity)) continue;
    const w = wearer[p.id];
    const unit = w && COMPANIONS.find((c) => c.id === w.unit && state.companions.owned[c.id]);
    const cls = unit ? gearClassOf(unit) : base.classes[0];
    const baseId = ITEM_BASES.some((b) => b.id === BASE_FOR[base.slot]) ? BASE_FOR[base.slot] : ITEM_BASES[0].id;
    const item = make(baseId, p.rarity, level);
    Object.assign(item, { cls, cg: base.id, upgrades: Number.isInteger(p.up) ? p.up : 0, locked: p.locked === true });
    const slot = { offense: 'weapon', guard: 'armor', trinket: 'accessory' }[base.slot];
    if (unit && base.classes.includes(cls) && !state.companionGear.equipped[unit.id]?.[slot]) (state.companionGear.equipped[unit.id] ??= {})[slot] = item;
    else place(item);
    n += 1;
  }
  return n;
}
