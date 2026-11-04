// v9.2.2 : mode d'arrivée de chaque ennemi et de chaque boss (rendu seulement, voir src/render/arrival.js).
//   walk   : à pied (ou en rampant, en roulant) depuis le bord droit — le cas par défaut ;
//   fly    : en vol, descente en courbe depuis le haut à droite puis ralentissement à hauteur de combat ;
//            `style` : 'wings' (battements d'ailes) ou 'float' (ondulation : fantômes, yeux, esprits) ;
//   swim   : à la nage (monde marin), descente ondulante depuis le haut à droite ;
//   burrow : sort du sol (racines, morts-vivants, vers, golems de roche ou de lave) ;
//   portal : sort d'un portail (démons, créatures du néant, mages).
// Aucun ennemi ne tombe plus du haut sans voler : la chute des boss (v9.1.9) ne sert plus qu'aux volants.

export const ARRIVAL_MODES = ['walk', 'fly', 'swim', 'burrow', 'portal'];

const W = { mode: 'walk' };
const WINGS = { mode: 'fly', style: 'wings' };
const FLOAT = { mode: 'fly', style: 'float' };
const SWIM = { mode: 'swim' };
const BURROW = { mode: 'burrow' };
const PORTAL = { mode: 'portal' };

// Ennemis ordinaires (toutes les clés de ENEMIES).
// v9.2.2 : ailés qui se posent et marchent une fois au contact (quadrupèdes) ; les autres battent des ailes tout le combat.
export const WINGED_LANDERS = new Set(['griffin_cub', 'mid_thunder_griffin', 'ash_dragon']);

export const ENEMY_ARRIVALS = {
  // Plaines
  slime: W, goblin: W, boar: W, mandrake: BURROW,
  // Forêt
  wolf: W, mushroom: BURROW, mushroom_green: BURROW, goblin_shaman: W, slime_blue: W,
  // Grottes
  bat: WINGS, skeleton: BURROW, skeleton_shield: W, golem: BURROW,
  // Désert
  scorpion: BURROW, mummy: BURROW, skeleton_archer: W, goblin_armored: W,
  // Montagnes
  yeti: W, ice_wolf: W, slime_ice: W, ogre: W,
  // Terres maudites
  imp: PORTAL, wraith: FLOAT, lich: PORTAL, slime_fire: W,
  // Marais
  toad: W, bog_zombie: BURROW, leech_fly: WINGS, lizardman: W,
  // Îles célestes
  harpy: WINGS, cloud_spirit: FLOAT, griffin_cub: WINGS, sky_automaton: W,
  // Volcan
  magma_slime: W, salamander: W, ash_wraith: FLOAT, obsidian_beetle: BURROW,
  // Néant
  void_eye: FLOAT, star_stalker: PORTAL, shadow_knight: PORTAL, voidling: PORTAL,
  // Royaume englouti (le crabe marche sur le fond)
  sea_bladefish: SWIM, sea_jelly: SWIM, sea_crab: W, sea_eel: SWIM, sea_puffer: SWIM, sea_octopus: SWIM, sea_shark: SWIM, sea_merfolk: SWIM,
};

// Boss (toutes les clés de BOSSES). v9.2.2 : le Wyrm de givre (serpent sans ailes) ondule au lieu de battre des ailes.
export const BOSS_ARRIVALS = {
  slime_king: W, alpha_wolf: W, bone_lord: BURROW, spectral_queen: FLOAT, ash_dragon: WINGS, fallen_knight: W, demon_king: PORTAL,
  rotting_dryad: BURROW, magma_colossus: BURROW, frost_wyrm: FLOAT, obsidian_tyrant: W, crypt_archlich: PORTAL,
  mini_goblin_warlord: W, mini_treant: BURROW, mini_crystal_golem: BURROW, mini_pharaoh: BURROW, mini_frost_witch: PORTAL, mini_reaper: FLOAT,
  mid_boar_titan: W, mid_giant_spider: W, mid_crystal_bat: WINGS, mid_sand_worm: BURROW, mid_mammoth: W, mid_hellhound: PORTAL,
  hard_scarecrow: BURROW, hard_werewolf: W, hard_necromancer: PORTAL, hard_anubis: W, hard_frost_giant: W, hard_demon_general: PORTAL,
  mini_toad_king: W, mid_hydra: W, hard_plague_doctor: W, boss_swamp_behemoth: BURROW,
  mini_harpy_queen: WINGS, mid_thunder_griffin: WINGS, hard_storm_valkyrie: WINGS, boss_sky_titan: W,
  mini_salamander_chief: W, mid_lava_golem: BURROW, hard_flame_djinn: FLOAT, boss_phoenix: WINGS,
  mini_void_watcher: FLOAT, mid_star_devourer: PORTAL, hard_void_knight: PORTAL, boss_void_emperor: PORTAL,
  mini_crab_king: W, mid_kraken: SWIM, hard_megalodon: SWIM, boss_leviathan: SWIM,
};

// Mode d'arrivée d'un ennemi. Sous l'eau, tout ce qui ne marche pas sur le fond nage ; un volant y nage aussi.
export function arrivalFor(type, boss = false, { underwater = false } = {}) {
  const a = (boss ? BOSS_ARRIVALS[type] : ENEMY_ARRIVALS[type]) ?? W;
  if (underwater && a.mode !== 'walk') return SWIM;
  if (!underwater && a.mode === 'swim') return FLOAT; // créature marine invoquée hors de l'eau (repli)
  return a;
}
