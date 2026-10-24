// Paramètres d'équilibrage centralisés.
// Modifier ces valeurs plutôt que la logique de jeu.

export const BALANCE = {
  simulation: {
    tickSeconds: 0.05, // pas fixe de la simulation
    maxCatchUpSeconds: 600, // au-delà (veille, onglet gelé), on applique le calcul hors ligne
  },
  autosaveSeconds: 10,

  // Coordonnées logiques du combat (indépendantes de la taille de la fenêtre).
  world: {
    heroX: 40,
    spawnX: 210,
    heroRange: 42,
    meleeOffset: 6, // les ennemis s'arrêtent un peu plus loin : le chevalier est plus large
    enemyGap: 15,
    scrollSpeed: 30,
  },

  hero: {
    baseDamage: 10,
    baseAttackInterval: 1.0,
    minAttackInterval: 0.25,
    baseMaxHp: 100,
    regenPerSecondPct: 2,
    respawnSeconds: 3,
    armorCapPct: 60,
    critMultiplier: 2,
    critCapPct: 75,
  },

  // Niveau du héros : chaque ennemi donne de l'XP ; chaque niveau donne +2 % dégâts et PV
  // et 1 point de compétence.
  level: {
    xpBase: 20, // XP pour passer du niveau 1 au niveau 2
    xpGrowth: 1.16,
    killXp: 2,
    killXpGrowth: 1.12, // par étape
    bossXpMultiplier: 10,
    damagePctPerLevel: 2,
    hpPctPerLevel: 2,
    maxLevel: 200,
  },

  upgrades: {
    damage: {
      label: 'Dégâts',
      description: '+3 dégâts par niveau, ×1,5 tous les 10 niveaux',
      baseCost: 10,
      costGrowth: 1.15,
      perLevel: 3,
      milestoneEvery: 10,
      milestoneMultiplier: 1.5,
    },
    attackSpeed: {
      label: "Vitesse d'attaque",
      description: "-4 % d'intervalle entre deux attaques",
      baseCost: 25,
      costGrowth: 1.22,
      perLevel: 0.04,
    },
    vitality: {
      label: 'Points de vie',
      description: '+20 PV max par niveau',
      baseCost: 15,
      costGrowth: 1.17,
      perLevel: 20,
    },
    crit: {
      label: 'Coup critique',
      description: '+1 % de chance de coup critique (dégâts ×2)',
      baseCost: 100,
      costGrowth: 1.25,
      perLevel: 1,
      maxLevel: 50,
    },
    armor: {
      label: 'Armure',
      description: '+1 % de réduction des dégâts subis',
      baseCost: 50,
      costGrowth: 1.22,
      perLevel: 1,
      maxLevel: 40,
    },
    regen: {
      label: 'Régénération PV',
      description: '+0,2 % des PV max régénérés par seconde',
      baseCost: 40,
      costGrowth: 1.2,
      perLevel: 0.2,
      maxLevel: 40,
    },
    goldFind: {
      label: "Butin d'or",
      description: "+5 % d'or gagné",
      baseCost: 80,
      costGrowth: 1.22,
      perLevel: 5,
    },
  },
  upgradeCategories: [
    { id: 'combat', label: 'Combat', icon: 'weapon_sword', keys: ['damage', 'attackSpeed', 'crit'] },
    { id: 'survival', label: 'Survie', icon: 'icon_shield', keys: ['vitality', 'armor', 'regen'] },
    { id: 'resources', label: 'Ressources', icon: 'coin', keys: ['goldFind'] },
  ],

  stages: {
    killsPerStage: 10,
    bossEvery: 5,
    stagesPerZone: 10,
    bossHpMultiplier: 12,
    bossDamageMultiplier: 2,
    bossGoldMultiplier: 15,
    bossSpawnDelaySeconds: 1.2,
  },

  enemyScaling: {
    hpGrowth: 1.16,
    damageGrowth: 1.13,
    goldGrowth: 1.14,
  },

  spawn: {
    intervalSeconds: 1.4,
    maxAlive: 3,
  },

  loot: {
    dropChance: 0.1,
    bossMinRarity: 'rare',
    stagePowerGrowth: 0.12, // +12 % de stats par niveau d'objet
    recycleLevelGrowth: 0.1,
    inventorySize: 40, // au-delà, les nouveaux objets sont recyclés en or
    signatureChance: 0.15, // chance qu'un boss lâche son objet signature
    // Effets spéciaux : nombre d'effets par rareté.
    affixCount: { common: 0, rare: 1, epic: 1, legendary: 2 },
  },

  // Recyclage : matériaux rendus en plus de l'or, par rareté.
  materials: {
    shards: { common: 1, rare: 3, epic: 8, legendary: 20 },
    essence: { common: 0, rare: 0, epic: 1, legendary: 3 },
  },

  // Forge : fabrication ciblée, relance des effets, réaffûtage au niveau actuel.
  forge: {
    craftShards: 25,
    craftGoldKills: 25, // coût en or = 25 × l'or d'un ennemi de l'étape max
    craftMinRarity: 'rare',
    reforgeShards: 10,
    reforgeEssence: 1,
    sharpenShardsPerLevel: 2, // réaffûtage : éclats par niveau gagné × facteur de rareté
  },

  // Événements discrets pendant le farm (aucun ne demande de surveiller l'écran).
  events: {
    chancePerKill: 0.004,
    inboxSize: 8,
    weights: { chest: 30, merchant: 15, elite: 20, wave: 20, gems: 15 },
    chestGoldKills: 30,
    merchantPriceKills: 40,
    eliteHpMultiplier: 5,
    eliteGoldMultiplier: 8,
    eliteGems: 10,
    waveKills: 15,
    waveGoldMultiplier: 2,
    gems: [5, 15],
  },

  // Monnaies d'invocation (gagnées uniquement en jouant).
  summon: {
    gemCost: 100,
    tenPullGemCost: 900,
    rarityWeights: { common: 60, rare: 30, epic: 8.5, legendary: 1.5 },
    pity: { epicAfter: 10, legendaryAfter: 60 }, // garanties
    maxStars: 5,
    duplicateRefundGems: 20, // doublon d'une unité déjà à 5 étoiles
    firstBossGems: 50,
    startingTickets: 1,
  },
  companionSlots: 3,


  offline: {
    capHours: 8,
    farmMultiplier: 0.5, // hors ligne = 50 % du rythme de farm actif mesuré
    measureSeconds: 180, // durée de combat simulée pour mesurer ce rythme
    maxItems: 10, // objets réellement générés ; le surplus est converti en or
    minSecondsForSummary: 60,
  },

  // Maîtrise des boss : paliers de victoires et récompenses.
  mastery: [
    { victories: 3, gems: 20 },
    { victories: 10, gems: 40, tickets: 1 },
    { victories: 25, gems: 60, essence: 2 },
    { victories: 50, gems: 100, tickets: 2 },
  ],
};
