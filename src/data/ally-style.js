// v9.7.1 (lot A) : façon de combattre de chaque compagnon (partagée par la simulation et le rendu) ; le reste se bat au
// corps à corps. Attaque de base : une action toutes les 1,2 à 1,8 s selon le style.
export const ALLY_STYLE = {
  elf_archer: 'archer', ranger: 'archer',
  pyromancer: 'fire', ice_empress: 'frost', witch: 'arcane', sylvan_guardian: 'nature', high_priest: 'holy', priestess: 'holy',
  archangel: 'holy', // v10.0 (9.1) : l'Archange lance ses sorts (pas de pas, de la main)
};
// v10.0 (9.1) : point « main » de chaque lanceur (pixels de jeu : avant du centre de sa case, hauteur au-dessus du sol) :
// la lueur de charge s'y allume et le projectile en part, à l'image du coup.
export const ALLY_HAND = {
  pyromancer: [8, 24], ice_empress: [8, 28], witch: [8, 26], sylvan_guardian: [7, 26], high_priest: [8, 30], priestess: [7, 26], archangel: [9, 30],
  elf_archer: [10, 22], ranger: [10, 22],
};
export const handOf = (id) => ALLY_HAND[id] ?? (ALLY_STYLE[id] === 'archer' ? [10, 22] : [7, 26]);
// v10.0 (9.2) : attaques dessinées figées (moins de 15 % de pixels qui changent par image, voir tools/art/check_anims.py) :
// on joue à la place l'animation de sort, qui est un vrai geste, en attendant la nouvelle génération.
export const FROZEN_ATTACK = new Set(['ally_mercenary', 'ally_barbarian', 'ally_lancer', 'ally_azure_paladin', 'ally_rose_blade', 'ally_pyromancer', 'pet_fairy', 'ally_ninja']);
export const BASIC_INTERVAL = { melee: 1.25, archer: 1.3, cast: 1.5 };
// Part des dégâts des compétences « coup » (hit) reversée à l'attaque de base : même total de dégâts par seconde.
export const BASIC_SHARE = 0.4;
export const basicKind = (id) => { const s = ALLY_STYLE[id] ?? 'melee'; return s === 'archer' || s === 'melee' ? s : 'cast'; };
