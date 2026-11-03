// Pouvoirs ancestraux des boss : chaque boss a sa propre liste de passifs thématiques.
// La première victoire en débloque un au hasard ; l'or permet ensuite d'en proposer un autre.
// Toutes les probabilités, coûts et effets se règlent ici.
//
// Effets possibles (additionnés entre pouvoirs et talents) :
//   damagePct, attackSpeedPct, maxHpPct (%), regenPct (% des PV max par seconde),
//   armor (points d'armure en %), goldPct (% d'or), dropChance (points de % de butin),
//   damageVsNormalPct, damageVsBossPct (%), lowHpArmor (armure en plus sous 30 % de PV).

export const POWER_RULES = {
  // Tirage : on choisit d'abord une rareté (poids ci-dessous), puis un pouvoir de cette rareté.
  rarityWeights: { common: 55, rare: 30, epic: 12, legendary: 3 },
  baseSlots: 2, // pouvoirs actifs en même temps (le talent Héritage en ajoute)
  // v9.1.3 (lot F, une seule barrière) : la relance ne coûte plus d'or, seulement une charge. Simulation
  // (tools/sim-reroll-v913.mjs) : en boucle sur le boss, l'or d'une relance (3 × l'or du boss à sa première étape)
  // est gagné aussi vite ou plus vite qu'une charge sur 14 des 15 boss mesurés ; l'or ne limitait donc presque jamais.
  // La charge garde le lien « réaffronter le boss pour relancer ». Critère d'abandon : docs/refontes-v913.md.
  pity: { after: 6, minRarity: 'epic' }, // après 6 relances sans Épique+, la suivante en garantit un
  lowHpThreshold: 0.3,
  // Relancer exige d'avoir réaffronté le boss : chaque nouvelle victoire donne une charge.
  chargesPerVictory: 1,
  maxCharges: 3,
  // Synergie : deux pouvoirs actifs de la même famille renforcent leurs effets.
  synergy: { minSameFamily: 2, bonusPct: 25 },
};

export const POWER_FAMILIES = {
  survival: { label: 'Survie', color: '#63d98a' },
  combat: { label: 'Combat', color: '#ff7a6b' },
  fortune: { label: 'Fortune', color: '#f2d083' },
};

export const BOSS_POWERS = {
  slime_king: [
    { id: 'gel_heart', name: 'Cœur gélatineux', rarity: 'common', family: 'survival', effects: { maxHpPct: 10 } },
    { id: 'ooze_regen', name: 'Suintement régénérant', rarity: 'rare', family: 'survival', effects: { regenPct: 1.5 } },
    { id: 'elastic_wall', name: 'Membrane élastique', rarity: 'rare', family: 'survival', effects: { armor: 6 } },
    { id: 'royal_jelly', name: 'Gelée royale', rarity: 'epic', family: 'survival', effects: { maxHpPct: 20, regenPct: 1 } },
    { id: 'king_hoard', name: 'Trésor du Roi', rarity: 'legendary', family: 'fortune', effects: { goldPct: 25, maxHpPct: 10 } },
  ],
  alpha_wolf: [
    { id: 'predator_instinct', name: 'Instinct du prédateur', rarity: 'common', family: 'combat', effects: { damageVsNormalPct: 12 } },
    { id: 'pack_fury', name: 'Furie de la meute', rarity: 'rare', family: 'combat', effects: { attackSpeedPct: 8 } },
    { id: 'bloodlust', name: 'Soif de sang', rarity: 'rare', family: 'combat', effects: { damagePct: 10 } },
    { id: 'alpha_fang', name: "Croc de l'Alpha", rarity: 'epic', family: 'combat', effects: { damageVsNormalPct: 25, attackSpeedPct: 5 } },
    { id: 'moon_hunter', name: 'Chasseur lunaire', rarity: 'legendary', family: 'combat', effects: { damagePct: 20, attackSpeedPct: 10 } },
  ],
  bone_lord: [
    { id: 'beyond_touch', name: 'Murmure des tombes', rarity: 'common', family: 'fortune', effects: { dropChance: 2 } },
    { id: 'bone_crusher', name: "Briseur d'os", rarity: 'rare', family: 'combat', effects: { damageVsBossPct: 15 } },
    { id: 'last_bastion', name: 'Dernier rempart', rarity: 'rare', family: 'survival', effects: { lowHpArmor: 20 } },
    { id: 'soul_harvest', name: "Moisson d'âmes", rarity: 'epic', family: 'fortune', effects: { goldPct: 15, dropChance: 2 } },
    { id: 'lich_crown', name: 'Couronne de la liche', rarity: 'legendary', family: 'combat', effects: { damageVsBossPct: 30, dropChance: 3 } },
  ],
  spectral_queen: [
    { id: 'ghost_touch', name: "Toucher de l'au-delà", rarity: 'common', family: 'fortune', effects: { dropChance: 2 } },
    { id: 'wailing', name: 'Lamentation', rarity: 'rare', family: 'combat', effects: { critChance: 5 } },
    { id: 'ethereal', name: 'Forme éthérée', rarity: 'rare', family: 'survival', effects: { armor: 8 } },
    { id: 'phantom_tithe', name: 'Dîme fantôme', rarity: 'epic', family: 'fortune', effects: { goldPct: 20, dropChance: 2 } },
    { id: 'queen_grace', name: 'Grâce de la Reine', rarity: 'legendary', family: 'fortune', effects: { dropChance: 5, goldPct: 15 } },
  ],
  ash_dragon: [
    { id: 'ember_blood', name: 'Sang de braise', rarity: 'common', family: 'combat', effects: { damagePct: 8 } },
    { id: 'dragon_blood', name: 'Sang draconique', rarity: 'rare', family: 'combat', effects: { damageVsBossPct: 20 } },
    { id: 'scale_skin', name: "Peau d'écailles", rarity: 'rare', family: 'survival', effects: { armor: 10 } },
    { id: 'hoard_heat', name: 'Chaleur du trésor', rarity: 'epic', family: 'fortune', effects: { goldPct: 25 } },
    { id: 'ash_wings', name: 'Ailes de cendre', rarity: 'legendary', family: 'combat', effects: { damageVsBossPct: 35, critChance: 5 } },
  ],
  fallen_knight: [
    { id: 'last_stand', name: 'Ultime résistance', rarity: 'common', family: 'survival', effects: { lowHpArmor: 15 } },
    { id: 'oath_broken', name: 'Serment brisé', rarity: 'rare', family: 'combat', effects: { critChance: 6 } },
    { id: 'dark_plate', name: 'Plates sombres', rarity: 'rare', family: 'survival', effects: { maxHpPct: 15 } },
    { id: 'black_vow', name: 'Vœu noir', rarity: 'epic', family: 'combat', effects: { damagePct: 15, lifesteal: 2 } },
    { id: 'fallen_glory', name: 'Gloire déchue', rarity: 'legendary', family: 'survival', effects: { maxHpPct: 25, lowHpArmor: 25 } },
  ],
  demon_king: [
    { id: 'infernal_coin', name: 'Pièce infernale', rarity: 'common', family: 'fortune', effects: { goldPct: 12 } },
    { id: 'hellfire', name: 'Feu infernal', rarity: 'rare', family: 'combat', effects: { damagePct: 12 } },
    { id: 'demon_hide', name: 'Peau démoniaque', rarity: 'rare', family: 'survival', effects: { thorns: 20 } },
    { id: 'pact', name: 'Pacte', rarity: 'epic', family: 'combat', effects: { damagePct: 15, goldPct: 10 } },
    { id: 'domination', name: 'Domination', rarity: 'legendary', family: 'fortune', effects: { goldPct: 30, damagePct: 15 } },
  ],
  // v7.7 : méga boss des mondes 7 à 10.
  boss_swamp_behemoth: [
    { id: 'bog_hide', name: 'Peau de vase', rarity: 'common', family: 'survival', effects: { maxHpPct: 12 } },
    { id: 'toxic_spores', name: 'Spores toxiques', rarity: 'rare', family: 'combat', effects: { damageVsNormalPct: 18 } },
    { id: 'mire_regen', name: 'Régénération des marais', rarity: 'rare', family: 'survival', effects: { regenPct: 2 } },
    { id: 'rot_tithe', name: 'Dîme putride', rarity: 'epic', family: 'fortune', effects: { goldPct: 20, dropChance: 3 } },
    { id: 'behemoth_will', name: 'Volonté du Béhémoth', rarity: 'legendary', family: 'survival', effects: { maxHpPct: 30, thorns: 30 } },
  ],
  boss_sky_titan: [
    { id: 'tailwind', name: 'Vent arrière', rarity: 'common', family: 'combat', effects: { attackSpeedPct: 6 } },
    { id: 'thunder_call', name: 'Appel du tonnerre', rarity: 'rare', family: 'combat', effects: { critChance: 7 } },
    { id: 'gilded_marble', name: 'Marbre doré', rarity: 'rare', family: 'survival', effects: { armor: 10 } },
    { id: 'sky_tribute', name: 'Tribut céleste', rarity: 'epic', family: 'fortune', effects: { goldPct: 30 } },
    { id: 'titan_wrath', name: 'Colère du Titan', rarity: 'legendary', family: 'combat', effects: { damagePct: 25, critChance: 8 } },
  ],
  boss_phoenix: [
    { id: 'cinders', name: 'Cendres vives', rarity: 'common', family: 'combat', effects: { damagePct: 10 } },
    { id: 'rebirth_flame', name: 'Flamme de renaissance', rarity: 'rare', family: 'survival', effects: { regenPct: 2.5 } },
    { id: 'blazing_wings', name: 'Ailes ardentes', rarity: 'rare', family: 'combat', effects: { damageVsBossPct: 22 } },
    { id: 'sun_feather', name: 'Plume solaire', rarity: 'epic', family: 'combat', effects: { damagePct: 18, lifesteal: 3 } },
    { id: 'eternal_flame', name: 'Flamme éternelle', rarity: 'legendary', family: 'survival', effects: { maxHpPct: 25, regenPct: 3, damagePct: 10 } },
  ],
  boss_void_emperor: [
    { id: 'starlight', name: 'Lueur stellaire', rarity: 'common', family: 'fortune', effects: { dropChance: 3 } },
    { id: 'void_edge', name: 'Tranchant du néant', rarity: 'rare', family: 'combat', effects: { critChance: 8 } },
    { id: 'event_horizon', name: "Horizon des événements", rarity: 'rare', family: 'survival', effects: { lowHpArmor: 25 } },
    { id: 'cosmic_hoard', name: 'Trésor cosmique', rarity: 'epic', family: 'fortune', effects: { goldPct: 30, dropChance: 3 } },
    { id: 'emperor_decree', name: "Décret de l'Empereur", rarity: 'legendary', family: 'combat', effects: { damagePct: 30, damageVsBossPct: 20 } },
  ],
  // v9.2.0 (monde marin) : pouvoirs ancestraux du Léviathan.
  boss_leviathan: [
    { id: 'sea_spray', name: 'Embruns', rarity: 'common', family: 'survival', effects: { regenPct: 2 } },
    { id: 'riptide', name: 'Courant de retour', rarity: 'rare', family: 'combat', effects: { attackSpeedPct: 8 } },
    { id: 'abyssal_scales', name: 'Écailles abyssales', rarity: 'rare', family: 'survival', effects: { armor: 10, maxHpPct: 10 } },
    { id: 'sunken_treasure', name: 'Trésor englouti', rarity: 'epic', family: 'fortune', effects: { goldPct: 30, dropChance: 3 } },
    { id: 'leviathan_tide', name: 'Marée du Léviathan', rarity: 'legendary', family: 'combat', effects: { damagePct: 30, critChance: 8 } },
  ],
};

// Libellés des effets (affichage).
// v8.5 : les effets peuvent être négatifs (clés de voûte de l'arbre) → signe explicite.
const sg = (v) => (v < 0 ? `-${String(-v).replace('.', ',')}` : `+${String(v).replace('.', ',')}`);
const mult = (v) => String(Math.round((1 + v / 100) * 100) / 100).replace('.', ',');
export const EFFECT_LABELS = {
  damagePct: (v) => `${sg(v)} % dégâts`,
  attackSpeedPct: (v) => `${sg(v)} % vitesse d'attaque`,
  maxHpPct: (v) => `${sg(v)} % PV max`,
  regenPct: (v) => `${sg(v)} % PV/s`,
  armor: (v) => `${sg(v)} % armure`,
  goldPct: (v) => `${sg(v)} % or`,
  dropChance: (v) => `${sg(v)} pts de chance de butin`,
  damageVsNormalPct: (v) => `${sg(v)} % dégâts contre les ennemis ordinaires`,
  damageVsBossPct: (v) => `${sg(v)} % dégâts contre les boss`,
  lowHpArmor: (v) => `${sg(v)} % armure sous 30 % de PV`,
  critChance: (v) => `${sg(v)} % de coup critique`,
  lifesteal: (v) => `vol de vie ${String(v).replace('.', ',')} %`,
  thorns: (v) => `épines ${String(v).replace('.', ',')} %`,
  xpPct: (v) => `${sg(v)} % XP`,
  companionPct: (v) => `${sg(v)} % effets des compagnons`,
  skillCooldownPct: (v) => `-${String(v).replace('.', ',')} % recharge des compétences`,
  powerSlots: (v) => `+${v} emplacement${v > 1 ? 's' : ''} de pouvoir`,
  rerollMaxCharges: (v) => `+${v} charge${v > 1 ? 's' : ''} de relance au plus`, // v9.1.3 : remplace la remise sur l'or
  damageMultPct: (v) => `dégâts ×${mult(v)}`,
  maxHpMultPct: (v) => `PV max ×${mult(v)}`,
  goldMultPct: (v) => `or ×${mult(v)}`,
};
