// v9.2.1 : malus d'environnement — dans chaque monde sauf le premier, le lieu lui-même gêne le héros (un seul malus par
// monde, chiffré, un peu plus fort à chaque cycle de difficulté). Chacun est contré par une amélioration à l'or
// EXISTANTE dont l'effet y répond logiquement (`counter`) : le malus baisse en proportion du niveau de cette
// amélioration et disparaît à `fullAt` (part contrée = niveau / fullAt, 100 % au plus). Rien de nouveau à acheter.
// Moteur : core/environment.js ; réglages et mesures : docs/environnement-v921.md (tools/measure-env-v921.mjs).
//
// kind : ce que touche le malus (core/environment.js puis core/combat.js) :
//   miss      — part des attaques du héros qui manquent        hurt      — dégâts reçus en plus
//   regen     — régénération de PV en moins                    maxHp     — PV max en moins
//   damage    — dégâts du héros en moins                       speed     — vitesse d'attaque en moins
//   crit      — chance de critique en moins (part de l'actuelle)
//   burn      — PV max perdus par seconde (jamais mortel seul : la brûlure s'arrête à 1 PV)
//   boss      — dégâts contre les boss en moins                armor     — armure en moins (part de l'actuelle)
//   companion — puissance des compétences des compagnons en moins
// base : valeur au cycle 1 (en %, ou en % des PV max par seconde pour burn).
export const ENV_CYCLE_STEP = 0.25; // +25 % de la valeur de base par cycle au-delà du premier…
export const ENV_CYCLE_MAX = 2; // …jusqu'à ×2 au plus
export const ENV_REDUCE_CAP = 90; // un malus « en moins » ne retire jamais plus de 90 % d'une statistique

export const ENVIRONMENTS = [
  { zone: 'forest', name: 'Pénombre', kind: 'miss', base: 25, icon: 'icon_tree', counter: 'crit', fullAt: 30 },
  { zone: 'caves', name: 'Éclats de cristal', kind: 'hurt', base: 45, icon: 'icon_shard', counter: 'defense', fullAt: 40 } /* v9.3.9 : Défense (Peau de fer fondue) */,
  { zone: 'desert', name: 'Soif', kind: 'regen', base: 90, icon: 'icon_regen', counter: 'regen', fullAt: 40 },
  { zone: 'mountains', name: 'Froid mordant', kind: 'maxHp', base: 40, icon: 'icon_heart', counter: 'vitality', fullAt: 110 },
  { zone: 'cursed', name: 'Malédiction', kind: 'damage', base: 30, icon: 'icon_skull', counter: 'damage', fullAt: 160 },
  { zone: 'swamp', name: 'Boue', kind: 'speed', base: 35, icon: 'skill_quick', counter: 'attackSpeed', fullAt: 160 },
  { zone: 'sky', name: 'Rafales', kind: 'crit', base: 90, icon: 'icon_crit', counter: 'critDamage', fullAt: 100 },
  { zone: 'volcano', name: 'Lave', kind: 'burn', base: 5, icon: 'icon_alert', counter: 'regen', fullAt: 40 },
  { zone: 'void', name: 'Distorsion', kind: 'boss', base: 45, icon: 'icon_boss', counter: 'bossDamage', fullAt: 100 },
  { zone: 'ocean', name: 'Pression', kind: 'maxHp', base: 40, icon: 'icon_shield', counter: 'vitality', fullAt: 260 },
  { zone: 'abyss', name: 'Corruption', kind: 'companion', base: 60, icon: 'icon_essence', counter: 'companionPower', fullAt: 100 },
];

export const ENV_BY_ZONE = Object.fromEntries(ENVIRONMENTS.map((e) => [e.zone, e]));
