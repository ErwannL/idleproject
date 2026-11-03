// v9.2.1 : façon de se déplacer propre à chaque monde (héros, compagnons, familiers), dans l'esprit de la nage du
// Royaume englouti. Données seulement : le rendu est dans src/render/traversal-fx.js. Tableau commenté :
// docs/deplacements-v921.md.
//   rate  : cadence des pas (1 = marche normale)
//   lift  : hauteur au-dessus du sol (px ; négatif = enfoncé, ex. dans l'eau du marais)
//   gait  : 'walk' (pas), 'slide' (pousse puis glisse), 'hop' (sauts de nuage en nuage), 'float' (lévitation)
//   feet  : effet aux pieds, prints : traces laissées au sol (couleur), colors : palette de l'effet
export const TRAVERSAL = {
  plains: { style: 'walk', rate: 1, lift: 0, gait: 'walk', feet: 'dust' },
  forest: { style: 'sneak', rate: 0.8, lift: 0, gait: 'walk', feet: 'leaves', colors: ['#4f7a2e', '#7aa23a', '#8a5a2a', '#c08a3a'] },
  caves: { style: 'crystal', rate: 0.9, lift: 0, gait: 'walk', feet: 'glint', colors: ['#ffffff', '#bff4ff', '#7fd8ff', '#c89cff'] },
  desert: { style: 'sand', rate: 0.85, lift: 0, gait: 'walk', feet: 'sand', prints: '#b8884a', haze: true, colors: ['#f0d08a', '#d8b06a', '#b8884a'] },
  mountains: { style: 'slide', rate: 1, lift: 0, gait: 'slide', feet: 'snow', prints: '#a8c0d8', colors: ['#ffffff', '#e0f0ff', '#b8d4f0'] },
  cursed: { style: 'mist', rate: 0.85, lift: 0, gait: 'walk', feet: 'mist', colors: ['#6a3a8a', '#9a5ab8', '#3a1a4a', '#c8a0ff'] },
  swamp: { style: 'wade', rate: 0.6, lift: -7, gait: 'walk', feet: 'splash', wade: true, colors: ['#4a5a2a', '#6a7a3a', '#8a9a5a', '#c8d0a0'] },
  sky: { style: 'cloud', rate: 1, lift: 0, gait: 'hop', feet: 'cloud', colors: ['#ffffff', '#e8f4ff', '#bcd8f0'] },
  volcano: { style: 'ember', rate: 0.7, lift: 0, gait: 'walk', feet: 'ember', prints: '#ff7a2a', colors: ['#ffe27a', '#ff9a2a', '#ff4a1a', '#5a2a1a'] },
  void: { style: 'float', rate: 1, lift: 6, gait: 'float', feet: 'stars', colors: ['#ffffff', '#d8c8ff', '#9a7aff', '#5a3ab8'] },
  ocean: { style: 'swim', rate: 1, lift: 0, gait: 'swim', feet: null },
  abyss: { style: 'shadow', rate: 0.75, lift: 0, gait: 'walk', feet: 'shadow', colors: ['#1a0a1a', '#3a0a1a', '#a01a2a', '#ff3a3a'] },
};

export function traversalFor(zoneId) {
  return TRAVERSAL[zoneId] ?? TRAVERSAL.plains;
}
