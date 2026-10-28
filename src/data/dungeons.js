// Donjons : courtes expéditions à salles, avec butin ciblé et choix de chemin.
// Le choix du chemin peut être changé à tout moment pendant l'expédition (rien ne bloque l'idle).
// v7.5 : chaque donjon a son héros SSR adapté (`ally`). Dans son donjon, ce héros écrase tout :
// compétence, passif, dégâts de l'équipe fortement augmentés et dégâts subis réduits (BALANCE.dungeonAffinity).

export const DUNGEONS = [
  {
    id: 'crypt',
    roles: ['healer', 'mage'], // rôles conseillés (synergies)
    name: 'Crypte spectrale',
    description: 'Quatre salles hantées, puis la Reine spectrale.',
    unlockStage: 25, // étape max requise (monde 2-5)
    enemies: ['skeleton', 'wraith', 'bat'],
    boss: 'spectral_queen',
    rooms: 5, // la dernière salle est celle du boss
    killsPerRoom: 6,
    levelOffset: -4, // niveau des ennemis = étape max + offset
    zone: 2, // décor utilisé (index de zone)
    ally: 'archangel', // héros SSR adapté : la lumière purifie les morts-vivants
  },
  {
    id: 'sanctuary',
    roles: ['mage', 'guardian'], // rôles conseillés (synergies)
    name: 'Sanctuaire sylvestre',
    description: 'Une forêt corrompue où règne la Dryade pourrissante.',
    unlockStage: 35,
    enemies: ['wolf', 'mushroom_green', 'goblin_shaman'],
    boss: 'rotting_dryad',
    rooms: 5,
    killsPerRoom: 6,
    levelOffset: -2,
    zone: 1,
    ally: 'sylvan_guardian',
  },
  {
    id: 'furnace',
    roles: ['mage', 'healer'], // rôles conseillés (synergies)
    name: 'Fournaise des sables',
    description: 'Des catacombes brûlantes où gronde le Colosse de magma.',
    unlockStage: 55,
    enemies: ['scorpion', 'mummy', 'slime_fire'],
    boss: 'magma_colossus',
    rooms: 6,
    killsPerRoom: 6,
    levelOffset: 0,
    zone: 3,
    ally: 'ice_empress', // la glace éteint les flammes
  },
  {
    id: 'glacier',
    roles: ['berserker', 'mage'], // rôles conseillés (synergies)
    name: 'Glacier éternel',
    description: 'Un dédale gelé où s\'enroule le Wyrm de givre.',
    unlockStage: 75,
    enemies: ['yeti', 'ice_wolf', 'slime_ice'],
    boss: 'frost_wyrm',
    rooms: 6,
    killsPerRoom: 7,
    levelOffset: 0,
    zone: 4,
    ally: 'demon_queen', // le feu infernal fait fondre la glace
  },
  {
    id: 'citadel',
    roles: ['assassin', 'healer'], // rôles conseillés (synergies)
    name: 'Citadelle des ombres',
    description: "La forteresse du Tyran d'obsidienne, au cœur des terres maudites.",
    unlockStage: 95,
    enemies: ['imp', 'wraith', 'lich'],
    boss: 'obsidian_tyrant',
    rooms: 7,
    killsPerRoom: 7,
    levelOffset: 2,
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

// v7.7 : trois difficultés, bien plus dures que la campagne (niveau d'ennemi au-dessus de l'étape max,
// PV et dégâts multipliés). Les fragments anciens (arbre de talents) se gagnent ici.
// Normal se débloque après une victoire en Facile, Difficile après une victoire en Normal.
export const DUNGEON_DIFFICULTIES = {
  // v8.3 : Facile = un peu en dessous de votre étape max (avant : au-dessus, PV ×2 — bien plus dur que la campagne).
  easy: { label: 'Facile', skulls: 1, levelBonus: -8, hp: 1, damage: 1, fragments: 4, gems: 1, essence: 1 },
  normal: { label: 'Normal', skulls: 3, levelBonus: 2, hp: 1.6, damage: 1.5, fragments: 12, gems: 1.6, essence: 2 },
  hard: { label: 'Difficile', skulls: 5, levelBonus: 12, hp: 3, damage: 2.5, fragments: 30, gems: 2.5, essence: 3 },
};
export const DIFFICULTY_ORDER = ['easy', 'normal', 'hard'];
