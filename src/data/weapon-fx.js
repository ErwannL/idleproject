// v9.3.2 : effets visuels des armes selon leur rareté (les 4 raretés du jeu : data/items.js RARITIES).
// Purement visuels : aucune statistique n'en dépend (les dégâts viennent des données de l'objet).
// Coupés par le mode « effets réduits » (scene.focus).
//   trail   : largeur et opacité de la traînée de frappe ;
//   glow    : lueur le long de la lame au repos (0 = aucune) ; pulse : vitesse de la pulsation ;
//   motes   : particules qui montent de la lame (par seconde) ;
//   impact  : étincelles en plus à l'impact du coup de base ; ring : onde à l'impact ;
//   skill   : éclat autour du héros quand il lance une compétence (0 = aucun).
export const WEAPON_FX = {
  common: { color: '#dfe8f0', trail: 1, trailAlpha: 0.45, glow: 0, pulse: 0, motes: 0, impact: 0, ring: false, skill: 0 },
  rare: { color: '#6ab8ff', trail: 1.15, trailAlpha: 0.55, glow: 0.35, pulse: 2, motes: 1.5, impact: 3, ring: false, skill: 0.5 },
  epic: { color: '#c87aff', trail: 1.4, trailAlpha: 0.65, glow: 0.6, pulse: 3, motes: 4, impact: 6, ring: true, skill: 0.8 },
  legendary: { color: '#ffc23a', trail: 1.8, trailAlpha: 0.8, glow: 0.9, pulse: 4, motes: 9, impact: 10, ring: true, skill: 1.2, aura: true },
};
export const weaponFx = (weapon) => WEAPON_FX[weapon?.rarity] ?? WEAPON_FX.common;
