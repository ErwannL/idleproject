// v9.2.4 : illustrations HD pixel générées (PixelLab, generate-image-v2, sprite du jeu en référence),
// agrandies au plus proche voisin : assets/hd/px/<id>.webp (≥ 1024 px de haut) et assets/hd/px/thumb/<id>.webp
// (taille d'origine, pour les vignettes). Le jeu les préfère à l'ancienne version pixel faite à la main.
// v9.2.5 : toutes régénérées dans le style de l'archange et du paladin azur (références de style), en 224×256
// natif (meilleur rapport coût/rendu : la vitrine affiche au plus 330 px), agrandies ×3 au plus proche voisin.
export const HD_PX = new Set(['ally_archangel', 'ally_azure_paladin', 'ally_barbarian', 'ally_demon_queen', 'ally_dwarf', 'ally_elf_archer', 'ally_high_priest', 'ally_ice_empress', 'ally_lancer', 'ally_mercenary', 'ally_ninja', 'ally_priestess', 'ally_pyromancer', 'ally_ranger', 'ally_rose_blade', 'ally_shadow', 'ally_shadow_lord', 'ally_squire', 'ally_sylvan_guardian', 'ally_witch', 'hero_berserker', 'hero_dragon_knight', 'hero_fortune_knight', 'hero_guardian', 'hero_knight', 'hero_paladin', 'ninja', 'pet_cat', 'pet_fairy', 'pet_golden_slime', 'pet_golem', 'pet_owl', 'pet_wisp', 'vampire', 'witch']);
