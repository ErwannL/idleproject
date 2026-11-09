// v9.3.3 : équipement des héros (alliés) et des familiers, adapté à leur classe et à leur anatomie.
// Le chevalier garde son propre équipement (data/items.js) : rien de partagé, sauf les éclats et l'or pour améliorer.
// Tout est configurable ici : classes, emplacements, pièces, compatibilités, profils de stats, coûts, sources.
import { COMPANION_ROLES } from './synergies.js';

// 4 classes d'équipement, regroupant les rôles réels du jeu (data/synergies.js ROLES) ; les familiers n'ont pas de rôle.
export const GEAR_CLASSES = {
  attacker: { label: 'Attaquant', roles: ['archer', 'mage', 'assassin', 'berserker'] },
  defender: { label: 'Défenseur', roles: ['guardian'] },
  support: { label: 'Soutien', roles: ['healer'] },
  beast: { label: 'Familier', roles: [] },
};
export function gearClassOf(unit) {
  if (!unit || unit.kind !== 'ally') return 'beast';
  const role = COMPANION_ROLES[unit.id];
  return Object.entries(GEAR_CLASSES).find(([, c]) => c.roles.includes(role))?.[0] ?? 'attacker';
}

// 3 emplacements ; leur nom dépend de la classe (pas d'épée ni d'armure humaine sur un familier).
export const GEAR_SLOTS = ['offense', 'guard', 'trinket'];
export const SLOT_NAMES = {
  attacker: { offense: 'Arme', guard: 'Armure légère', trinket: 'Anneau' },
  defender: { offense: 'Arme', guard: 'Armure lourde', trinket: 'Emblème' },
  support: { offense: 'Focalisateur', guard: 'Robe', trinket: 'Talisman' },
  beast: { offense: 'Crocs runiques', guard: 'Collier renforcé', trinket: 'Rune' },
};

// Statistiques (en %) : atk = puissance des attaques et compétences offensives, hp = PV, def = défense,
// heal = puissance des soins, boucliers et cris, cd = recharge des compétences (réduction).
export const STAT_NAMES = { atk: 'Attaque', hp: 'PV', def: 'Défense', heal: 'Soins et soutien', cd: 'Recharge' };

// Pièces : chaque base définit son emplacement, ses classes compatibles et son profil (valeurs au niveau Commun +0).
export const GEAR_BASES = [
  { id: 'runeblade', name: 'Lame runique', slot: 'offense', classes: ['attacker', 'defender'], stats: { atk: 6 } },
  { id: 'warbow', name: 'Arc de guerre', slot: 'offense', classes: ['attacker'], stats: { atk: 5, cd: 2 } },
  { id: 'focus', name: 'Orbe focalisateur', slot: 'offense', classes: ['support'], stats: { heal: 7 } },
  { id: 'fangs', name: 'Crocs runiques', slot: 'offense', classes: ['beast'], stats: { atk: 6 } },
  { id: 'leather', name: 'Armure de cuir', slot: 'guard', classes: ['attacker', 'support'], stats: { hp: 5, def: 2 } },
  { id: 'plate', name: 'Armure de plates', slot: 'guard', classes: ['defender'], stats: { hp: 7, def: 5 } },
  { id: 'robe', name: 'Robe bénie', slot: 'guard', classes: ['support'], stats: { hp: 4, heal: 3 } },
  { id: 'collar', name: 'Collier renforcé', slot: 'guard', classes: ['beast'], stats: { hp: 6, def: 3 } },
  { id: 'shell', name: 'Carapace gravée', slot: 'guard', classes: ['beast', 'defender'], stats: { def: 7 } },
  { id: 'ring', name: 'Anneau de bataille', slot: 'trinket', classes: ['attacker'], stats: { atk: 3, cd: 3 } },
  { id: 'emblem', name: 'Emblème du rempart', slot: 'trinket', classes: ['defender'], stats: { def: 3, heal: 3 } },
  { id: 'talisman', name: 'Talisman de lumière', slot: 'trinket', classes: ['support'], stats: { heal: 4, cd: 3 } },
  { id: 'rune', name: 'Rune ancestrale', slot: 'trinket', classes: ['beast', 'attacker', 'defender', 'support'], stats: { atk: 2, hp: 2, cd: 2 } },
];

// Rareté : mêmes 4 raretés que le chevalier ; multiplicateur des stats et plafond d'amélioration.
export const GEAR_RARITY = {
  common: { mult: 1, maxUp: 5, weight: 60 },
  rare: { mult: 1.6, maxUp: 5, weight: 28 },
  epic: { mult: 2.5, maxUp: 10, weight: 10 },
  legendary: { mult: 4, maxUp: 10, weight: 2 },
};
export const GEAR_UP_PCT = 8;          // +8 % des stats de la pièce par niveau d'amélioration
// Coût d'amélioration (+n → +n+1) : éclats et or (ennemis de l'étape max) × facteur de rareté.
export const GEAR_UP_COST = { shards: 6, shardsGrowth: 1.35, kills: 15, killsGrowth: 1.3, rarity: { common: 1, rare: 1.5, epic: 2.5, legendary: 4 } };
export const GEAR_BAG_SIZE = 60;
export const GEAR_RECYCLE_SHARDS = { common: 2, rare: 5, epic: 20, legendary: 60 };
// Sources : premier passage d'un étage de l'Arène (1 pièce), donjon terminé (35 %).
export const GEAR_SOURCES = { arenaFloor: 1, dungeonClearChance: 0.35 };
