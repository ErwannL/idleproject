// Auras des compagnons et familiers aux étoiles maximales (v9.0.5) : flammes façon « Super guerrier », aux couleurs
// propres à chacun. Du cœur (le plus clair) vers l'extérieur : 3 couleurs pour un SSR (Légendaire), 2 pour un SR
// (Épique), 1 pour les autres.
export const AURA_COLORS = {
  // Familiers
  golden_slime: ['#ffd23f'],
  cat: ['#ffb36b'],
  owl: ['#d8b27a'],
  fairy: ['#9dffb8'],
  golem: ['#d6f4ff', '#5fc8ff'],
  wisp: ['#ffffff', '#ffd23f', '#ff6a1a'],
  // Compagnons R
  squire: ['#8fc0ff'],
  mercenary: ['#dfe6ee'],
  ranger: ['#86e07a'],
  pyromancer: ['#ff6a2a'],
  priestess: ['#fff2a8'],
  lancer: ['#5fa0ff'],
  shadow: ['#a07bff'],
  dwarf: ['#ffa040'],
  // Compagnons SR
  azure_paladin: ['#ffffff', '#4fa3ff'],
  rose_blade: ['#ffd6ea', '#ff5fa8'],
  witch: ['#c8ff9a', '#a24bff'],
  elf_archer: ['#fff1a0', '#4fd16a'],
  high_priest: ['#fff8d0', '#7fd4ff'],
  ninja: ['#ffb0b0', '#e02a3a'],
  barbarian: ['#ffd28a', '#ff4a2a'],
  // Compagnons SSR
  archangel: ['#ffffff', '#ffe27a', '#5fb4ff'],
  demon_queen: ['#ffd0e0', '#ff2a4a', '#8a1aff'],
  ice_empress: ['#ffffff', '#8ff0ff', '#3f6bff'],
  shadow_lord: ['#efe0ff', '#a64bff', '#3a1490'],
  demo_ssr: ['#f5e6ff', '#d07bff', '#4a1870'], // v9.1.3 (partie B) : perso de bannière de démonstration
  sylvan_guardian: ['#f2ffd8', '#7fe07a', '#1f8a4a'],
};

const COUNT = { legendary: 3, epic: 2 };

// Couleurs de l'aura d'un compagnon (nombre selon la rareté).
export function auraColors(companion) {
  const n = COUNT[companion.rarity] ?? 1;
  const list = AURA_COLORS[companion.id] ?? ['#e6efff', '#9fc4ff', '#5f7fff'];
  return list.slice(0, n);
}
