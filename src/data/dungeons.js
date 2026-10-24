// Donjons : courtes expéditions à salles, avec butin ciblé et choix de chemin.
// Le choix du chemin peut être changé à tout moment pendant l'expédition (rien ne bloque l'idle).

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
  },
];

export const DUNGEON_PATHS = {
  gold: { label: "Chemin de l'or", text: 'Chaque salle rapporte un coffre d’or', goldKills: 20 },
  relics: { label: 'Chemin des reliques', text: 'Chaque salle rapporte des éclats', shards: 8 },
};

// Récompense finale : objet Épique ou mieux de l'emplacement choisi (butin ciblé).
export const DUNGEON_REWARD = { minRarity: 'epic', gems: 25, essence: 2, firstClearTickets: 1 };
export const STARTING_KEYS = 1;
