// Donjons : courtes expéditions à salles, avec butin ciblé et choix de chemin.
// Le choix du chemin peut être changé à tout moment pendant l'expédition (rien ne bloque l'idle).
// v7.5 : chaque donjon a son héros SSR adapté (`ally`). Dans son donjon, ce héros écrase tout :
// compétence ×3, passif ×2 et dégâts subis par l'équipe réduits (BALANCE.dungeonAffinity).

export const DUNGEONS = [
  {
    id: 'crypt',
    name: 'Crypte spectrale',
    description: 'Quatre salles hantées, puis la Reine spectrale.',
    unlockStage: 12, // étape max requise
    enemies: ['skeleton', 'wraith', 'bat'],
    boss: 'spectral_queen',
    rooms: 5, // la dernière salle est celle du boss
    killsPerRoom: 6,
    levelOffset: -2, // niveau des ennemis = étape max + offset
    zone: 2, // décor utilisé (index de zone)
    ally: 'archangel', // héros SSR adapté : la lumière purifie les morts-vivants
  },
  {
    id: 'sanctuary',
    name: 'Sanctuaire sylvestre',
    description: 'Une forêt corrompue, gardée par le Loup Alpha.',
    unlockStage: 18,
    enemies: ['wolf', 'mushroom_green', 'goblin_shaman'],
    boss: 'alpha_wolf',
    rooms: 5,
    killsPerRoom: 6,
    levelOffset: -1,
    zone: 1,
    ally: 'sylvan_guardian',
  },
  {
    id: 'furnace',
    name: 'Fournaise des sables',
    description: 'Des catacombes brûlantes où sommeille le Dragon des cendres.',
    unlockStage: 28,
    enemies: ['scorpion', 'mummy', 'slime_fire'],
    boss: 'ash_dragon',
    rooms: 6,
    killsPerRoom: 6,
    levelOffset: 0,
    zone: 3,
    ally: 'ice_empress', // la glace éteint les flammes
  },
  {
    id: 'glacier',
    name: 'Glacier éternel',
    description: 'Un dédale gelé que le Chevalier déchu ne quitte jamais.',
    unlockStage: 38,
    enemies: ['yeti', 'ice_wolf', 'slime_ice'],
    boss: 'fallen_knight',
    rooms: 6,
    killsPerRoom: 7,
    levelOffset: 0,
    zone: 4,
    ally: 'demon_queen', // le feu infernal fait fondre la glace
  },
  {
    id: 'citadel',
    name: 'Citadelle des ombres',
    description: "Le trône du Roi démoniaque, au cœur des terres maudites.",
    unlockStage: 50,
    enemies: ['imp', 'wraith', 'lich'],
    boss: 'demon_king',
    rooms: 7,
    killsPerRoom: 7,
    levelOffset: 1,
    zone: 5,
    ally: 'shadow_lord', // le maître des ombres règne chez lui
  },
];

export const DUNGEON_PATHS = {
  gold: { label: "Chemin de l'or", text: 'Chaque salle rapporte un coffre d’or', goldKills: 20 },
  relics: { label: 'Chemin des reliques', text: 'Chaque salle rapporte des éclats', shards: 8 },
};

// Récompense finale : objet Épique ou mieux de l'emplacement choisi (butin ciblé).
export const DUNGEON_REWARD = { minRarity: 'epic', gems: 25, essence: 2, firstClearTickets: 1 };
export const STARTING_KEYS = 1;
