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
    heroRange: 34,
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
      label: 'Vitalité',
      description: '+20 PV max par niveau',
      baseCost: 15,
      costGrowth: 1.17,
      perLevel: 20,
    },
  },

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
  },

  offline: {
    capHours: 8,
    farmMultiplier: 0.5, // hors ligne = 50 % du rythme de farm actif mesuré
    measureSeconds: 180, // durée de combat simulée pour mesurer ce rythme
    maxItems: 10, // objets réellement générés ; le surplus est converti en or
    minSecondsForSummary: 60,
  },
};
