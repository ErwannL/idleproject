// Héros jouables : tous des chevaliers, chacun avec un rôle distinct.
// Aucun n'est indispensable : le Chevalier de départ peut finir la campagne.
// `palette` recolore le sprite du chevalier (tabard/cape B-P, dorures W, plumet K).
// `bonus` s'applique à 1 étoile ; chaque étoile supplémentaire ajoute `perStarPct` % de ces valeurs.

export const HEROES = [
  {
    id: 'knight', name: 'Chevalier', rarity: 'common', role: 'Polyvalent',
    description: 'Équilibré entre attaque et défense.',
    palette: { B: '#2f62b8', P: '#1d3b78', W: '#e8b64a', K: '#3b7de0' },
    bonus: { damagePct: 5, maxHpPct: 5 },
  },
  {
    id: 'paladin', name: 'Paladin', rarity: 'rare', role: 'Soutien',
    description: 'Se soigne en continu et tient longtemps.',
    palette: { B: '#e8e2d0', P: '#a9a08a', W: '#e8b64a', K: '#f2d083' },
    bonus: { regenPct: 1, maxHpPct: 10 },
  },
  {
    id: 'guardian', name: 'Gardien', rarity: 'rare', role: 'Défense',
    description: 'Bouclier massif : encaisse les coups des boss.',
    palette: { B: '#3f7f4a', P: '#24502c', W: '#cfd6e0', K: '#63d98a' },
    bonus: { armor: 8, maxHpPct: 15 },
  },
  {
    id: 'fortune_knight', name: 'Chevalier de fortune', rarity: 'epic', role: 'Économie',
    description: "Ramène plus d'or et de butin de chaque combat.",
    palette: { B: '#c99a2e', P: '#8a6418', W: '#ffffff', K: '#ffffff' },
    bonus: { goldPct: 30, dropChance: 2 },
  },
  {
    id: 'berserker', name: 'Berserker', rarity: 'epic', role: 'Dégâts',
    description: 'Frappe fort et vite, au prix de sa santé.',
    palette: { B: '#b8322f', P: '#7a1d1d', W: '#e8b64a', K: '#ff5a4a' },
    bonus: { damagePct: 20, attackSpeedPct: 10, maxHpPct: -10 },
  },
  {
    id: 'dragon_knight', name: 'Chevalier dragon', rarity: 'legendary', role: 'Tueur de boss',
    description: 'Spécialiste des combats contre les boss.',
    palette: { B: '#2a1f3d', P: '#150f22', W: '#ff8a3d', K: '#ff8a3d' },
    bonus: { damageVsBossPct: 30, damagePct: 10, critChance: 5 },
  },
];

export const HERO_STAR_BONUS_PCT = 20; // +20 % des bonus du héros par étoile au-delà de la première
export const STARTER_HERO = 'knight';
