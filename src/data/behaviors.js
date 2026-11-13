// v9.6.0 (6) : comportements des monstres. Chacun a une PARADE qui se prépare avant le combat (un rôle de compagnon
// dans l'équipe, ou la classe du héros) ; avec elle, le malus disparaît. Jamais un geste à faire en combat.
// Le Gardien en parade compte seulement pour un COMPAGNON gardien (le chevalier est toujours là).
export const BEHAVIORS = {
  shooter: { name: 'Tireur', icon: 'icon_bolt', color: '#ffd84a', what: 'Reste en arrière et tire : ses coups font +60 % de dégâts.',
    counter: 'Un Archer ou un Mage dans l\'équipe (ou un héros à distance)', roles: ['archer', 'mage'], ranged: true },
  shield: { name: 'Bouclier', icon: 'icon_defense', color: '#9fc4ff', what: 'Encaisse : il ne prend que la moitié des dégâts.',
    counter: 'Un Berserker ou un Assassin (ou un héros Lancier / Arbalétrier)', roles: ['berserker', 'assassin'], classes: ['lancer', 'crossbowman'] },
  kamikaze: { name: 'Kamikaze', icon: 'icon_critdmg', color: '#ff7a3a', what: 'Explose au contact : 12 % des PV du héros.',
    counter: 'Un compagnon Gardien devant (dégâts divisés par deux)', roles: ['guardian'] },
  healer: { name: 'Soigneur', icon: 'icon_regen', color: '#7dff9a', what: 'Soigne sa vague tant qu\'il est en vie.',
    counter: 'Un Assassin, qui vise l\'arrière', roles: ['assassin'] },
  swarm: { name: 'Essaim', icon: 'tab_companions', color: '#c7a6ff', what: 'Arrive en nombre : les coups simples s\'y perdent (−30 % de dégâts).',
    counter: 'Un Mage (dégâts de zone)', roles: ['mage'] },
  flyer: { name: 'Volant', icon: 'icon_dodge', color: '#a6e6ff', what: 'Hors de portée du corps à corps : −50 % de dégâts reçus des coups au contact.',
    counter: 'Un Archer ou un Mage (ou un héros à distance)', roles: ['archer', 'mage'], ranged: true },
  thief: { name: 'Voleur', icon: 'icon_gold', color: '#ffd24a', what: 'Vaincu dans les 7 s après son arrivée : or ×3 (sinon or normal).',
    counter: 'Une équipe rapide (Assassin ou Archer)', roles: ['assassin', 'archer'] },
  charger: { name: 'Charge', icon: 'icon_damage', color: '#ff6a5a', what: 'Fonce : son premier coup fait ×2,5 de dégâts.',
    counter: 'Un compagnon Gardien au rang avant', roles: ['guardian'] },
};

// Monstres de la campagne qui portent un comportement (2 par monde à partir du monde 2 ; le monde 1 n'en a aucun).
export const ENEMY_BEHAVIOR = {
  goblin_shaman: 'shooter', mushroom_green: 'healer', // monde 2
  bat: 'flyer', skeleton_shield: 'shield', // monde 3
  skeleton_archer: 'shooter', goblin_armored: 'shield', // monde 4
  ogre: 'charger', slime_ice: 'kamikaze', // monde 5
  lich: 'healer', imp: 'thief', // monde 6
  leech_fly: 'swarm', lizardman: 'shield', // monde 7
  harpy: 'flyer', griffin_cub: 'charger', // monde 8
  magma_slime: 'kamikaze', salamander: 'shooter', // monde 9
  void_eye: 'flyer', voidling: 'swarm', // monde 10
  sea_puffer: 'kamikaze', sea_shark: 'charger', // monde 11
};

export function enemyBehavior(type) { return ENEMY_BEHAVIOR[type] ?? null; }

// Comportements d'un monde (ordre d'apparition), pour l'écran Préparation et la Carte.
export function zoneBehaviors(zone) {
  return [...new Set((zone?.enemies ?? []).map(enemyBehavior).filter(Boolean))];
}
