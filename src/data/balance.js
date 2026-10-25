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
    heroX: 56, // v7.5 : place pour 2 héros alliés derrière le chevalier
    spawnX: 226, // même distance d'approche qu'avant (heroX + 170)
    heroRange: 42,
    meleeOffset: 6, // les ennemis s'arrêtent un peu plus loin : le chevalier est plus large
    enemyGap: 15,
    scrollSpeed: 30,
  },

  hero: {
    baseDamage: 8,
    baseAttackInterval: 1.0,
    // Au-delà de 3 att./s, rendements décroissants (voir softAttackSpeed) ; 15 att./s au maximum.
    attackSpeed: { softCap: 3, softness: 1.5, hardCap: 15 },
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
    xpBase: 30, // XP pour passer du niveau 1 au niveau 2
    xpGrowth: 1.2,
    killXp: 2,
    killXpGrowth: 1.0583, // par étape (v7.6 : 20 étapes par monde, croissance par étape divisée par 2 en log)
    bossXpMultiplier: 10,
    damagePctPerLevel: 2,
    hpPctPerLevel: 2,
    maxLevel: 200,
  },

  upgrades: {
    damage: {
      label: 'Dégâts',
      description: '+3 dégâts par niveau, ×1,35 tous les 10 niveaux',
      baseCost: 10,
      costGrowth: 1.17,
      perLevel: 3,
      milestoneEvery: 10,
      milestoneMultiplier: 1.35,
    },
    attackSpeed: {
      label: "Vitesse d'attaque",
      description: "-3 % d'intervalle entre deux attaques (rendements décroissants au-delà de 3 att./s)",
      baseCost: 25,
      costGrowth: 1.22,
      perLevel: 0.03,
    },
    vitality: {
      label: 'Points de vie',
      description: '+20 PV max par niveau, ×1,4 tous les 10 niveaux',
      baseCost: 15,
      costGrowth: 1.16,
      perLevel: 20,
      milestoneEvery: 10,
      milestoneMultiplier: 1.4,
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
    { id: 'rushes', label: 'Boosts', icon: 'skill_cry', keys: [] }, // boosts à durée limitée (core/rushes.js)
  ],

  stages: {
    killsPerStage: 15,
    bossEvery: 5,
    stagesPerZone: 20, // étapes 5, 10, 15, 20 : mini-boss, boss moyen, boss dur, méga boss
    bossHpMultiplier: 20, // un boss se gagne aux dégâts…
    bossDamageMultiplier: 1.4, // …sans tuer en un coup un chevalier au niveau de la zone
    bossGoldMultiplier: 15,
    bossSpawnDelaySeconds: 1.2,
    // Boss par rang (étape du monde) : multiplicateurs appliqués aux valeurs « boss » ci-dessus.
    tiers: {
      mini: { stage: 5, hp: 0.45, damage: 0.85, gold: 0.4, gems: 10 },
      mid: { stage: 10, hp: 0.65, damage: 0.95, gold: 0.6, gems: 15 },
      hard: { stage: 15, hp: 0.85, damage: 1.05, gold: 0.8, gems: 20 },
      mega: { stage: 20, hp: 1.15, damage: 1.15, gold: 1.2, gems: 35 },
    },
  },

  enemyScaling: {
    // v7.6 : 20 étapes par monde (au lieu de 10) : croissance par étape = racine de l'ancienne.
    hpGrowth: 1.0817,
    damageGrowth: 1.0583,
    goldGrowth: 1.0724,
  },

  spawn: {
    intervalSeconds: 1.4,
    maxAlive: 3,
  },

  loot: {
    dropChance: 0.1,
    bossMinRarity: 'rare',
    stagePowerGrowth: 0.045, // +4,5 % de stats par niveau d'objet (v7.6 : 2 niveaux = 1 ancien)
    recycleLevelGrowth: 0.05,
    inventorySize: 40, // au-delà, les nouveaux objets sont recyclés en or
    signatureChance: 0.15, // chance qu'un boss lâche son objet signature
    bossEssence: 2, // essences garanties par boss (+1 par zone)
    // Poids de chaque emplacement dans le butin (accessoires ≈ 1/3 des objets).
    slotWeights: { weapon: 3, helmet: 2, armor: 2, amulet: 1, earring: 1, ring: 1, bracelet: 1 },
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
    // Fabrication épique : Épique ou mieux, payée aussi en essences (butin des boss).
    epicCraft: { shards: 60, essence: 6, goldKills: 60 },
    reforgeShards: 10,
    reforgeEssence: 1,
    sharpenShardsPerLevel: 2, // réaffûtage : éclats par niveau gagné × facteur de rareté
    // Amélioration d'un objet : chaque niveau augmente une de ses statistiques (au hasard) de 12 %.
    maxUpgrades: { common: 5, rare: 5, epic: 10, legendary: 10 },
    upgradeBoostPct: 12,
    upgradeGoldKills: 6, // coût en or = 6 × (niveau + 1) × l'or d'un ennemi au niveau de l'objet
    upgradeShards: 2, // éclats = 2 × (niveau + 1)
    fusionCount: 5, // 5 objets d'une rareté (même emplacement) → 1 objet de la rareté suivante
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

  // Gemmes (cristaux) gagnées en jouant, pour invoquer souvent (v7.6).
  gems: {
    killChance: 0.02, // 2 % des monstres lâchent quelques gemmes
    killAmount: [1, 3],
    levelUp: 5,
    newStage: 3, // première fois qu'une étape est atteinte
    newWorld: 25, // première fois qu'un monde est atteint
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
  // 5 premières heures : progression très rapide, beaucoup de butin et d'invocations, puis normal.
  earlyBoost: {
    hours: 5,
    goldMultiplier: 3, // ×3 au début, décroît jusqu'à ×1
    xpMultiplier: 3,
    extraDropChance: 0.15, // +15 points de chance de butin au début
    eventMultiplier: 4, // coffres, gemmes, marchands… 4 fois plus fréquents
    bossTickets: 1, // chaque victoire contre un boss donne un ticket d'invocation tant que le bonus dure
  },
  // Week-end (samedi + dimanche, 48 h) : or, XP, butin et événements ×2, cumulable avec le démarrage.
  weekendBoost: { multiplier: 2 },
  // Donjons : le héros SSR adapté à un donjon y écrase tout.
  // Hors de son donjon, un SSR reste un peu au-dessus d'un SR ; dans son donjon, il écrase tout.
  dungeonAffinity: { skillMultiplier: 6, passiveMultiplier: 4, damageTakenPct: 60, teamDamagePct: 150 },

  // Équipe : le chevalier (fixe) + 2 personnages (héros alliés) + 1 compagnon (familier).
  teamSlots: { ally: 2, pet: 1 },
  companionSlots: 3,


  offline: {
    capHours: 24,
    farmMultiplier: 0.65, // hors ligne = 65 % du rythme de farm actif mesuré (35 % de moins)
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
