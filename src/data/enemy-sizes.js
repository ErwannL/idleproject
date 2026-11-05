// v9.2.4 : table d'échelle des ennemis et boss par créature réelle (taille à l'écran, en pixels de jeu ; silhouette du
// héros : 27 px de corps dans son cadre de 48, une cinquantaine avec la cape et le chapeau à l'écran).
// La « taille » d'un ennemi est mesurée sur sa silhouette opaque (sans les marges transparentes du cadre) :
// max(hauteur visible, moitié de la largeur visible), pour qu'une anguille ou un requin, longs et bas, ne soient pas
// comptés comme minuscules. Chaque ennemi est ramené exactement à la taille de référence de sa créature.
// Échelle de référence (ennemis ordinaires) : chauve-souris, moustique < gluant < araignée, scorpion < loup, sanglier
// < gobelin < squelette, humain < ours, golem < géant < dragon. Aucun ennemi ordinaire sous MIN_SIZE (lisibilité).
export const HERO_HEIGHT = 27;
export const MIN_SIZE = 26;

// Paliers de créatures réelles (ennemis ordinaires).
export const SIZE_LADDER = {
  minuscule: { label: 'chauve-souris, moustique, rejeton', size: 27 },
  gluant: { label: 'gluant', size: 29 },
  insecte: { label: 'araignée, scorpion, scarabée, crapaud, crabe', size: 31 },
  petit_humanoide: { label: 'gobelin, diablotin, champignon, spectre', size: 32 },
  bete: { label: 'loup, sanglier, jeune griffon', size: 34 },
  humain: { label: 'squelette, humain, momie, harpie', size: 38 },
  grand_humain: { label: 'liche, homme-lézard, chevalier, triton', size: 40 },
  ours: { label: 'ours, golem, yéti, automate', size: 46 },
  geant: { label: 'ogre, requin', size: 50 },
};

const ENEMY_LADDER = {
  minuscule: ['bat', 'leech_fly', 'voidling', 'mandrake'],
  gluant: ['slime', 'slime_blue', 'slime_ice', 'slime_fire', 'magma_slime', 'cloud_spirit'],
  insecte: ['scorpion', 'obsidian_beetle', 'salamander', 'toad', 'sea_crab', 'sea_puffer', 'sea_eel', 'sea_bladefish'],
  petit_humanoide: ['goblin', 'goblin_shaman', 'goblin_armored', 'imp', 'mushroom', 'mushroom_green', 'wraith', 'ash_wraith'],
  bete: ['wolf', 'ice_wolf', 'boar', 'griffin_cub'],
  humain: ['skeleton', 'skeleton_shield', 'skeleton_archer', 'mummy', 'bog_zombie', 'harpy', 'star_stalker', 'void_eye', 'sea_jelly'],
  grand_humain: ['lich', 'lizardman', 'shadow_knight', 'sea_merfolk', 'sea_octopus'],
  ours: ['golem', 'yeti', 'sky_automaton'],
  geant: ['ogre', 'sea_shark'],
};
const BY_TYPE = Object.fromEntries(Object.entries(ENEMY_LADDER).flatMap(([c, list]) => list.map((t) => [t, c])));

// Boss : taille de référence propre (créature réelle × rang : mini < boss < redoutable < boss de monde).
// Dragon, léviathan, béhémoth et wyrm en haut ; humanoïdes plus petits que les grandes bêtes du même rang.
export const BOSS_SIZE = {
  // mini-boss
  mini_goblin_warlord: 40, mini_frost_witch: 40, mini_pharaoh: 42, mini_salamander_chief: 42, mini_reaper: 44,
  mini_harpy_queen: 44, mini_crab_king: 44, mini_void_watcher: 46, mini_toad_king: 46, mini_crystal_golem: 50, mini_treant: 50,
  // boss intermédiaires
  mid_crystal_bat: 44, mid_giant_spider: 46, mid_hellhound: 50, mid_boar_titan: 52, mid_star_devourer: 52,
  mid_sand_worm: 56, mid_thunder_griffin: 56, mid_kraken: 56, mid_lava_golem: 58, mid_mammoth: 60, mid_hydra: 60,
  // boss redoutables
  hard_necromancer: 44, hard_scarecrow: 46, hard_plague_doctor: 46, hard_anubis: 48, hard_storm_valkyrie: 48,
  hard_flame_djinn: 48, hard_void_knight: 50, hard_werewolf: 52, hard_demon_general: 52, hard_megalodon: 52, hard_frost_giant: 64,
  // boss de monde et de donjon
  bone_lord: 54, spectral_queen: 54, slime_king: 56, crypt_archlich: 56, alpha_wolf: 58, boss_void_emperor: 60,
  demon_king: 64, boss_leviathan: 64, boss_sky_titan: 70, rotting_dryad: 70, boss_swamp_behemoth: 76,
  boss_phoenix: 76, magma_colossus: 76, obsidian_tyrant: 76, frost_wyrm: 80, ash_dragon: 82,
};
// Boss sans entrée : selon le rang.
const BOSS_DEFAULT = { mini: 44, mid: 52, hard: 50, dungeon: 66, mega: 60 };

// Taille visible d'un sprite (en pixels du sprite) : max(hauteur, largeur / 2) de la silhouette opaque. Mise en cache.
const visCache = new WeakMap();
export function visibleSize(sprite) {
  if (!sprite?.rows) return 0;
  if (visCache.has(sprite)) return visCache.get(sprite);
  let top = Infinity, bottom = -1, left = Infinity, right = -1;
  sprite.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '.' || row[x] === ' ') continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  });
  const v = bottom < 0 ? 0 : Math.max(bottom - top + 1, (right - left + 1) / 2);
  visCache.set(sprite, v);
  return v;
}

// Taille de référence (pixels de jeu) d'un ennemi (`tier` : rang du boss, absent pour un boss de monde).
export function targetSize(type, boss = false, tier = null) {
  if (boss) return BOSS_SIZE[type] ?? BOSS_DEFAULT[tier ?? 'mega'] ?? 60;
  return Math.max(MIN_SIZE, SIZE_LADDER[BY_TYPE[type] ?? 'humain'].size);
}

// Palier d'un ennemi ordinaire (pour les planches et les tests).
export const sizeClass = (type) => BY_TYPE[type] ?? 'humain';

// Facteur à appliquer à l'échelle de dessin pour une taille visible `natural` (pixels de jeu, à l'échelle actuelle).
export function sizeFactor(type, boss, tier, natural) {
  if (!natural) return 1;
  return targetSize(type, boss, tier) / natural;
}
