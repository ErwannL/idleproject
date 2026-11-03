// Ensembles d'équipement (v8.5) : une famille par monde. Les objets Rares et mieux trouvés dans un monde
// (campagne, donjons, défi) appartiennent parfois à son ensemble. 2, 4 et 6 pièces différentes portées
// donnent des bonus ; le bonus à 6 pièces est un multiplicateur. Les ensembles des mondes lointains
// sont plus forts.
// v9.1.3 (doc3 lot 5) : chaque ensemble a une activité où il est le meilleur, aucun n'est le meilleur partout
// (mesures : tools/measure-sets-v913.mjs, docs/equipement-v913.md). Pré : XP (niveaux) ; Chasseur : ennemis ordinaires et
// vitesse ; Cristal, Givre, Marais : robustesse ; Désert : or ; Linceul, Volcan : boss ; Néant : équilibre.
export const SET_PIECES = [2, 4, 6];

export const ITEM_SETS = [
  { id: 'plains', zone: 0, name: 'Panoplie du Pré', color: '#9be36b', bonuses: { 2: { maxHpPct: 15 }, 4: { goldPct: 30 }, 6: { xpPct: 100 } } }, // v9.1.3 (doc3 lot 5) : rôle niveaux (XP) au farm (avant 6 : dégâts ×1,3)
  { id: 'forest', zone: 1, name: 'Parure du Chasseur', color: '#5fbf6a', bonuses: { 2: { damageVsNormalPct: 40 }, 4: { attackSpeedPct: 15 }, 6: { damageVsNormalPct: 120 } } }, // v9.1.3 (doc3 lot 5) : rôle ennemis ordinaires et vitesse (avant 20 / 10 / dégâts ×1,35)
  { id: 'caves', zone: 2, name: 'Armure de cristal', color: '#8fd6ff', bonuses: { 2: { armor: 5 }, 4: { maxHpPct: 30 }, 6: { maxHpMultPct: 40 } } },
  { id: 'desert', zone: 3, name: 'Atours du désert', color: '#f2c46b', bonuses: { 2: { goldPct: 25 }, 4: { dropChance: 2 }, 6: { goldMultPct: 60 } } },
  { id: 'mountains', zone: 4, name: 'Harnois du givre', color: '#cfe8ff', bonuses: { 2: { maxHpPct: 20 }, 4: { lowHpArmor: 15 }, 6: { maxHpMultPct: 50 } } },
  { id: 'cursed', zone: 5, name: 'Linceul maudit', color: '#b77bff', bonuses: { 2: { lifesteal: 2 }, 4: { damageVsBossPct: 30 }, 6: { damageMultPct: 45 } } },
  { id: 'swamp', zone: 6, name: 'Cuir des marais', color: '#8fae4a', bonuses: { 2: { regenPct: 1 }, 4: { thorns: 40 }, 6: { maxHpMultPct: 55 } } },
  { id: 'sky', zone: 7, name: 'Plumage céleste', color: '#bfe7ff', bonuses: { 2: { attackSpeedPct: 8 }, 4: { critChance: 8 }, 6: { damageMultPct: 55 } } },
  { id: 'volcano', zone: 8, name: 'Forge du volcan', color: '#ff7a3d', bonuses: { 2: { damagePct: 25 }, 4: { damageVsBossPct: 40 }, 6: { damageMultPct: 65 } } },
  { id: 'void', zone: 9, name: 'Éclat du Néant', color: '#9a7bff', bonuses: { 2: { critChance: 6 }, 4: { skillCooldownPct: 15 }, 6: { damageMultPct: 60, maxHpMultPct: 60 } } }, // v9.1.3 (doc3 lot 5) : rôle équilibre dégâts × robustesse (avant 50 / 50)
  // v9.2.0 (monde marin) : Parure des marées — rôle régénération et critiques (le contre de la Marée du Léviathan).
  { id: 'ocean', zone: 10, name: 'Parure des marées', color: '#3ad0e0', bonuses: { 2: { regenPct: 1.5 }, 4: { critChance: 8 }, 6: { damageMultPct: 62, maxHpMultPct: 50 } } },
];
