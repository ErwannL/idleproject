// Rôles des compagnons et synergies d'équipe (v7.7). Le chevalier (toujours présent) est un « Gardien ».
// Une synergie s'active quand l'équipe réunit ses rôles ; ses effets s'ajoutent aux autres bonus.
// Les rôles ne dépendent pas de la rareté : un R bien placé reste utile face à un SSR.

// v9.5.0 (3.2) : chaque rôle dit ce qu'il fait en combat et contre quoi il est bon (une phrase).
export const ROLES = {
  guardian: { label: 'Gardien', icon: 'icon_defense', color: '#7fb0ff', does: 'Encaisse devant et protège l\'équipe.', good: 'Bon contre les charges et les kamikazes.' },
  archer: { label: 'Archer', icon: 'icon_bolt', color: '#7fe07a', does: 'Tire de loin, sans attendre le contact.', good: 'Bon contre les volants et les tireurs.' },
  mage: { label: 'Mage', icon: 'tab_skills', color: '#c06bff', does: 'Frappe plusieurs ennemis d\'un sort.', good: 'Bon contre les essaims et les vagues groupées.' },
  assassin: { label: 'Assassin', icon: 'icon_crit', color: '#b46bff', does: 'Vise l\'arrière et achève les blessés.', good: 'Bon contre les soigneurs et les boss.' },
  healer: { label: 'Soutien', icon: 'icon_regen', color: '#ffe680', does: 'Soigne et renforce l\'équipe.', good: 'Bon dans les combats longs et les mondes durs.' },
  berserker: { label: 'Berserker', icon: 'icon_damage', color: '#ff6a4a', does: 'Frappe très fort au corps à corps.', good: 'Bon contre les boucliers et les boss.' },
};

export const COMPANION_ROLES = {
  squire: 'guardian', lancer: 'guardian', dwarf: 'guardian', azure_paladin: 'guardian',
  ranger: 'archer', elf_archer: 'archer',
  pyromancer: 'mage', witch: 'mage', ice_empress: 'mage', demon_queen: 'mage',
  shadow: 'assassin', ninja: 'assassin', rose_blade: 'assassin', shadow_lord: 'assassin',
  priestess: 'healer', high_priest: 'healer', sylvan_guardian: 'healer', archangel: 'healer',
  mercenary: 'berserker', barbarian: 'berserker',
  demo_ssr: 'assassin', // v9.1.3 (doc4 partie B) : perso de bannière de démonstration (data/banners.js, inactif par défaut)
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
  // v8.1 : nouvelles synergies (deux compagnons du même rôle, trios, alliances inattendues).
  { id: 'volley', name: 'Salve', roles: ['archer', 'archer'], text: 'Deux archers : une pluie de flèches continue', effects: { attackSpeedPct: 12, damageVsNormalPct: 10 } },
  { id: 'arcane_circle', name: 'Cercle arcanique', roles: ['mage', 'mage'], text: 'Deux mages tracent un cercle de puissance', effects: { damagePct: 14, skillCooldownPct: 8 } },
  { id: 'shadow_pact', name: 'Pacte des ombres', roles: ['assassin', 'assassin'], text: 'Deux lames dans l’ombre, aucune cible n’échappe', effects: { critChance: 10, damageVsBossPct: 10 } },
  { id: 'holy_choir', name: 'Chœur sacré', roles: ['healer', 'healer'], text: 'Deux soutiens chantent : la lumière soigne sans cesse', effects: { regenPct: 1.5, maxHpPct: 12 } },
  { id: 'warband', name: 'Horde', roles: ['berserker', 'berserker'], text: 'Deux berserkers déchaînés', effects: { damagePct: 20, lifesteal: 1 } },
  { id: 'shield_wall', name: 'Mur de boucliers', roles: ['guardian', 'guardian'], text: 'Deux gardiens côte à côte : rien ne passe', effects: { armor: 6, maxHpPct: 8 } },
  { id: 'hunters_mark', name: 'Marque du chasseur', roles: ['archer', 'berserker'], text: 'L’archer marque la proie, le berserker la déchire', effects: { damageVsBossPct: 14, critChance: 3 } },
  { id: 'spellblade', name: 'Lame-sort', roles: ['mage', 'assassin'], text: 'Lames enchantées et sorts rapides', effects: { attackSpeedPct: 8, damagePct: 8 } },
  { id: 'sacred_hunt', name: 'Chasse sacrée', roles: ['archer', 'healer'], text: 'Des flèches bénies qui soignent en frappant', effects: { lifesteal: 2, damageVsNormalPct: 8 } },
  { id: 'bulwark_of_fire', name: 'Rempart ardent', roles: ['guardian', 'guardian', 'mage'], text: 'Deux gardiens tiennent la ligne pendant que le mage embrase tout', effects: { armor: 5, damagePct: 10 } },
];

// Effets visuels sur la scène (v8.1), dessinés par src/render/team-fx.js.
export const SYNERGY_FX = {
  blessed: 'halo', holy_choir: 'halo', fortress: 'dome', shield_wall: 'dome', bulwark_of_fire: 'dome',
  firestorm: 'fire_rain', volley: 'arrow_rain', sacred_hunt: 'arrow_rain', ambush: 'shadow_strike', shadow_pact: 'shadow_strike',
  executioner: 'mark', hunters_mark: 'mark', arcane_guard: 'rune_circle', arcane_circle: 'rune_circle', arcane_link: 'rune_circle',
  carnage: 'blades', warband: 'blades', spellblade: 'blades', contained_rage: 'ember', vanguard: 'ember',
};

// Configurations d'équipe enregistrables (farm ciblé) : noms proposés par défaut.
export const LOADOUT_NAMES = ['Chasse aux monstres', 'Farm économique', 'Chasse aux boss'];
