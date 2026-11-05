// v9.2.3 : table d'échelle des ennemis et boss (taille à l'écran, en pixels de jeu ; silhouette du héros : 27 px
// visibles dans son cadre de 48).
// Chaque ennemi garde sa taille dessinée tant qu'elle tombe dans la fourchette de sa catégorie ; sinon elle y est
// ramenée (la magicienne n'est plus deux fois plus haute que le squelette, les boss restent nettement plus grands).
export const HERO_HEIGHT = 27;

export const SIZE_CLASSES = {
  petite_bete: { label: 'petite bête', min: 16, max: 28 },
  petit_humanoide: { label: 'petit humanoïde', min: 24, max: 30 },
  humanoide: { label: 'humanoïde', min: 28, max: 36 },
  grosse_bete: { label: 'grosse bête', min: 36, max: 46 },
  mini_humanoide: { label: 'mini-boss humanoïde', min: 40, max: 46 },
  mini_bete: { label: 'mini-boss bête', min: 44, max: 52 },
  boss_moyen: { label: 'boss intermédiaire', min: 48, max: 58 },
  boss_dur_humanoide: { label: 'boss redoutable humanoïde', min: 44, max: 50 },
  boss_dur_bete: { label: 'boss redoutable bête', min: 52, max: 62 },
  boss_humanoide: { label: 'boss de monde humanoïde', min: 50, max: 58 },
  boss_bete: { label: 'boss de monde bête', min: 64, max: 82 },
};

// Ennemis ordinaires (par type) ; sans entrée : humanoïde.
const ENEMY_CLASS = {
  petite_bete: ['slime', 'slime_blue', 'slime_ice', 'slime_fire', 'magma_slime', 'mandrake', 'boar', 'wolf', 'ice_wolf', 'bat',
    'scorpion', 'salamander', 'obsidian_beetle', 'voidling', 'toad', 'leech_fly', 'cloud_spirit', 'griffin_cub', 'sea_eel',
    'sea_bladefish', 'sea_crab'],
  petit_humanoide: ['goblin', 'goblin_shaman', 'goblin_armored', 'imp', 'mushroom', 'mushroom_green', 'wraith', 'ash_wraith'],
  grosse_bete: ['golem', 'yeti', 'ogre', 'sky_automaton', 'void_eye', 'sea_jelly', 'sea_puffer', 'sea_octopus', 'sea_shark', 'sea_merfolk'],
};

// Boss humanoïdes (les autres, par rang, sont des bêtes).
const HUMANOID_BOSSES = new Set(['mini_goblin_warlord', 'mini_pharaoh', 'mini_frost_witch', 'mini_reaper', 'mini_salamander_chief',
  'mini_harpy_queen', 'hard_scarecrow', 'hard_necromancer', 'hard_anubis', 'hard_demon_general', 'hard_plague_doctor',
  'hard_storm_valkyrie', 'hard_flame_djinn', 'hard_void_knight', 'bone_lord', 'fallen_knight', 'boss_void_emperor', 'spectral_queen',
  'crypt_archlich']);

const BY_TYPE = Object.fromEntries(Object.entries(ENEMY_CLASS).flatMap(([c, list]) => list.map((t) => [t, c])));

// Catégorie d'un ennemi (`tier` : rang du boss, mini/mid/hard ou absent pour un boss de monde).
export function sizeClass(type, boss = false, tier = null) {
  if (!boss) return BY_TYPE[type] ?? 'humanoide';
  const h = HUMANOID_BOSSES.has(type);
  if (tier === 'mini') return h ? 'mini_humanoide' : 'mini_bete';
  if (tier === 'mid') return 'boss_moyen';
  if (tier === 'hard') return h ? 'boss_dur_humanoide' : 'boss_dur_bete';
  return h ? 'boss_humanoide' : 'boss_bete';
}

// Hauteur à l'écran retenue pour une hauteur dessinée `natural`.
export function sizedHeight(natural, cls) {
  const c = SIZE_CLASSES[cls] ?? SIZE_CLASSES.humanoide;
  return Math.max(c.min, Math.min(c.max, natural));
}

// v9.2.3 : plafonds propres à quelques ennemis dont la silhouette dessinée paraît trop grande dans leur catégorie
// (magicienne de glace : chapeau pointu et bâton, 1,3 fois le squelette ; ramenée à ~1,1 fois).
export const HEIGHT_CAP = { mini_frost_witch: 40 };

// Facteur à appliquer à l'échelle de dessin (1 si la taille dessinée convient déjà).
export function sizeFactor(type, boss, tier, natural) {
  if (!natural) return 1;
  const h = Math.min(sizedHeight(natural, sizeClass(type, boss, tier)), HEIGHT_CAP[type] ?? Infinity);
  return h / natural;
}
