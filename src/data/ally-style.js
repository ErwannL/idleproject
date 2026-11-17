// v9.7.1 (lot A) : façon de combattre de chaque compagnon (partagée par la simulation et le rendu) ; le reste se bat au
// corps à corps. Attaque de base : une action toutes les 1,2 à 1,8 s selon le style.
export const ALLY_STYLE = {
  elf_archer: 'archer', ranger: 'archer',
  pyromancer: 'fire', ice_empress: 'frost', witch: 'arcane', sylvan_guardian: 'nature', high_priest: 'holy', priestess: 'holy',
};
export const BASIC_INTERVAL = { melee: 1.25, archer: 1.3, cast: 1.5 };
// Part des dégâts des compétences « coup » (hit) reversée à l'attaque de base : même total de dégâts par seconde.
export const BASIC_SHARE = 0.4;
export const basicKind = (id) => { const s = ALLY_STYLE[id] ?? 'melee'; return s === 'archer' || s === 'melee' ? s : 'cast'; };
