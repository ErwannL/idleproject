// Rôles des compagnons et synergies d'équipe (v7.7). Le chevalier (toujours présent) est un « Gardien ».
// Une synergie s'active quand l'équipe réunit ses rôles ; ses effets s'ajoutent aux autres bonus.
// Les rôles ne dépendent pas de la rareté : un R bien placé reste utile face à un SSR.

export const ROLES = {
  guardian: { label: 'Gardien', icon: 'icon_shield', color: '#7fb0ff' },
  archer: { label: 'Archer', icon: 'skill_quick', color: '#7fe07a' },
  mage: { label: 'Mage', icon: 'skill_holy', color: '#c06bff' },
  assassin: { label: 'Assassin', icon: 'skill_whirl', color: '#b46bff' },
  healer: { label: 'Soutien', icon: 'icon_heart', color: '#ffe680' },
  berserker: { label: 'Berserker', icon: 'skill_cry', color: '#ff6a4a' },
};

export const COMPANION_ROLES = {
  squire: 'guardian', lancer: 'guardian', dwarf: 'guardian', azure_paladin: 'guardian',
  ranger: 'archer', elf_archer: 'archer',
  pyromancer: 'mage', witch: 'mage', ice_empress: 'mage', demon_queen: 'mage',
  shadow: 'assassin', ninja: 'assassin', rose_blade: 'assassin', shadow_lord: 'assassin',
  priestess: 'healer', high_priest: 'healer', sylvan_guardian: 'healer', archangel: 'healer',
  mercenary: 'berserker', barbarian: 'berserker',
};

// `roles` : rôles requis dans l'équipe (le chevalier compte comme Gardien).
export const SYNERGIES = [
  { id: 'arcane_guard', name: 'Mage protégé', roles: ['guardian', 'mage'], text: 'Le chevalier protège le mage fragile', effects: { maxHpPct: 10, damageVsNormalPct: 15 } },
  { id: 'fortress', name: 'Forteresse', roles: ['guardian', 'guardian', 'healer'], text: 'Deux gardiens et un soutien : une équipe imprenable', effects: { armor: 8, regenPct: 1 } },
  { id: 'blessed', name: 'Bénédiction', roles: ['healer'], text: 'Un soutien améliore la survie de toute l’équipe', effects: { maxHpPct: 8, regenPct: 0.5 } },
  { id: 'ambush', name: 'Embuscade', roles: ['archer', 'assassin'], text: 'L’archer affaiblit, l’assassin achève', effects: { critChance: 6, damageVsBossPct: 15 } },
  { id: 'firestorm', name: 'Pluie de feu', roles: ['archer', 'mage'], text: 'Flèches et sorts nettoient les groupes', effects: { damageVsNormalPct: 20, attackSpeedPct: 5 } },
  { id: 'executioner', name: 'Exécuteur', roles: ['assassin'], text: 'L’assassin frappe fort les cibles isolées', effects: { damageVsBossPct: 12 } },
  { id: 'carnage', name: 'Carnage', roles: ['berserker', 'assassin'], text: 'Une tornade de lames', effects: { damagePct: 12, critChance: 4 } },
  { id: 'contained_rage', name: 'Rage contenue', roles: ['berserker', 'healer'], text: 'Le soutien maintient le berserker en vie', effects: { damagePct: 15, lifesteal: 2 } },
  { id: 'vanguard', name: 'Avant-garde', roles: ['guardian', 'berserker'], text: 'Le gardien encaisse, le berserker frappe', effects: { maxHpPct: 10, damagePct: 8 } },
  { id: 'arcane_link', name: 'Lien arcanique', roles: ['mage', 'healer'], text: 'Magie et soins se répondent', effects: { skillCooldownPct: 10, maxHpPct: 6 } },
];

// Configurations d'équipe enregistrables (farm ciblé) : noms proposés par défaut.
export const LOADOUT_NAMES = ['Chasse aux monstres', 'Farm économique', 'Chasse aux boss'];
