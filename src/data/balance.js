// Paramètres d'équilibrage centralisés.
// Modifier ces valeurs plutôt que la logique de jeu.

// v9.1.3 (lot E) : les tickets d'invocation sont fondus dans les gemmes. 1 ticket = 1 invocation ×1 = 100 gemmes
// (90 seulement dans un ×10 à 900) : on garde le taux le plus favorable au joueur, aucune invocation n'est perdue.
// Critère d'abandon : voir docs/refontes-v913.md (lot E, tickets).
export const TICKET_GEMS = 100;
// v9.1.3 (lot F) : les essences sont fondues dans les éclats. 1 essence = 10 éclats : c'est le prix qu'en donnaient
// les deux recettes qui en demandaient (fabrication Épique 60 éclats + 6 essences, relance des effets 10 + 1), donc
// chaque recette garde son coût total. Bilan et critère d'abandon : docs/refontes-v913.md.
export const ESSENCE_SHARDS = 10;

export const BALANCE = {
  simulation: {
    tickSeconds: 0.05, // pas fixe de la simulation
    speeds: [1, 2, 5, 10, 100], // v8.4 : ×1 par défaut ; les autres se débloquent avec des codes
    maxCatchUpSeconds: 30, // au-delà (veille, onglet gelé), on applique le calcul hors ligne (v8.5 : 600 → 30, anti-gel)
  },
  autosaveSeconds: 10,

  // Coordonnées logiques du combat (indépendantes de la taille de la fenêtre).
  // v9.3.8 : vagues groupées (campagne) — taille, point d'apparition (proche : peu de marche), pause entre deux vagues.
  waves: { size: 3, spawnX: 100, delaySeconds: 0.3, minCycleSeconds: 4.2, targetSeconds: 3, startK: 0.5, maxK: 6 },
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
    xpBase: 60, // XP pour passer du niveau 1 au niveau 2 (v9.1 : 30 → 60, montée deux fois plus lente au début)
    xpGrowth: 1.22, // v9.1 : 1,2 → 1,22 (niveau 50 : environ 4 fois plus d'XP qu'avant)
    killXp: 2,
    killXpGrowth: 1.0583, // par étape (v7.6 : 20 étapes par monde, croissance par étape divisée par 2 en log)
    bossXpMultiplier: 10,
    damagePctPerLevel: 2,
    hpPctPerLevel: 2,
    maxLevel: 1000, // v8.4 : 200 → 1000
  },

  upgrades: {
    damage: {
      label: 'Dégâts',
      description: '+3 dégâts par niveau', // v9.1.3 (A5) : les paliers sont affichés sur la ligne
      baseCost: 10,
      costGrowth: 1.13, // v8.4 : 1,17 → 1,13 (réglé par simulation : progression qui ralentit sans mur)
      oldCostGrowth: 1.17, // pour rembourser l'or dépensé avant la v8.4
      perLevel: 3,
      milestoneEvery: 10,
      milestoneMultiplier: 1.35,
      bigMilestoneEvery: 25,
      bigMilestoneMultiplier: 1.75,
    },
    attackSpeed: {
      label: "Vitesse d'attaque",
      description: "-3 % d'intervalle entre deux attaques (rendements décroissants au-delà de 3 att./s)",
      baseCost: 25,
      costGrowth: 1.15,
      oldCostGrowth: 1.22,
      perLevel: 0.03,
    },
    vitality: {
      label: 'Points de vie',
      description: '+20 PV max par niveau', // v9.1.3 (A5) : idem
      baseCost: 15,
      costGrowth: 1.13,
      oldCostGrowth: 1.16,
      perLevel: 20,
      milestoneEvery: 10,
      milestoneMultiplier: 1.4,
      bigMilestoneEvery: 25,
      bigMilestoneMultiplier: 1.75,
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
      label: 'Peau de fer', // v9.3.8 (3e) : « Armure » se confondait avec « Défense » (nom et icône)
      retired: true, // v9.3.9 (2.9) : fondue dans Défense (state.js mergeArmorIntoDefense) ; plus achetable
      description: '+1 % de réduction des dégâts subis',
      baseCost: 50,
      costGrowth: 1.22,
      perLevel: 1,
      maxLevel: 40,
    },
    // v9.2.8 : Défense — points qui réduisent les dégâts subis avec un rendement décroissant (stats.js
    // defenseReduction : capPct × D / (D + halfAt)), en plus de l'armure en %. Percée de 40 % par les boss, comme
    // l'armure. Ouverte avec Armure et Régénération (après le premier boss), sans plafond de niveau.
    defense: {
      label: 'Défense',
      description: '+10 points de Défense par niveau : réduit les dégâts subis (rendement décroissant, 60 % au plus)',
      baseCost: 200,
      costGrowth: 1.2,
      perLevel: 10,
      capPct: 60,
      halfAt: 600, // 600 points (niveau 60) = 30 % de réduction ; 1 500 points = 43 %
    },
    regen: {
      label: 'Régénération PV',
      description: '+0,2 % des PV max régénérés par seconde, ×1,1 tous les 10 niveaux',
      baseCost: 40,
      costGrowth: 1.2,
      perLevel: 0.2,
      maxLevel: 40,
      // v9.2.0 : paliers ×1,1 tous les 10 niveaux sur la part achetée (comme Dégâts et PV) : 8 → 11,7 %/s au niveau 40.
      milestoneEvery: 10,
      milestoneMultiplier: 1.1,
    },
    goldFind: {
      label: "Butin d'or",
      description: "+5 % d'or gagné, ×1,5 tous les 25 niveaux (100 niveaux au plus)",
      baseCost: 80,
      maxLevel: 100, // v9.0.6 : sans plafond, il écrasait toutes les autres améliorations
      costGrowth: 1.12,
      oldCostGrowth: 1.22,
      perLevel: 5,
      bigMilestoneEvery: 25,
      bigMilestoneMultiplier: 1.5,
    },
    // v9.2.0 : six améliorations de plus (13 au total), ouvertes une à une avec l'étape record (unlockStage, jamais
    // perdue à la Renaissance). Effets en % toujours plafonnés (maxLevel). Réglages : docs/ameliorations-v920.md.
    critDamage: {
      label: 'Dégâts critiques',
      description: '+2 % de dégâts des coups critiques par niveau (×2 → ×4 au niveau 100)',
      baseCost: 150,
      costGrowth: 1.28,
      perLevel: 2,
      maxLevel: 100,
      unlockStage: 15,
    },
    // v9.2.8 : Double attaque — chance de frapper deux fois (second coup aussitôt, critique tiré à nouveau).
    doubleAttack: {
      label: 'Double attaque',
      description: '+0,4 % de chance de frapper deux fois par niveau (20 % au niveau 50)',
      baseCost: 180,
      costGrowth: 1.3,
      perLevel: 0.4,
      maxLevel: 50,
      capPct: 20,
      unlockStage: 25,
    },
    lifesteal: {
      label: 'Vol de vie',
      description: '+0,1 % des dégâts infligés rendus en PV (3 % au plus)',
      baseCost: 120,
      costGrowth: 1.5,
      perLevel: 0.1,
      maxLevel: 30,
      unlockStage: 20,
    },
    companionPower: {
      label: 'Lien des compagnons',
      description: '+3 % de puissance des compétences des compagnons (coups, soins, cris) par niveau',
      baseCost: 250,
      costGrowth: 1.26,
      perLevel: 3,
      maxLevel: 100,
      unlockStage: 30,
    },
    dodge: {
      label: 'Esquive',
      description: "+0,5 % de chance d'esquiver un coup ennemi (moitié contre les boss, 20 % au plus)",
      baseCost: 200,
      costGrowth: 1.45,
      perLevel: 0.5,
      maxLevel: 40,
      unlockStage: 40,
    },
    bossDamage: {
      label: 'Tueur de boss',
      description: '+1 % de dégâts du héros contre les boss par niveau (+100 % au niveau 100)',
      baseCost: 300,
      costGrowth: 1.28,
      perLevel: 1,
      maxLevel: 100,
      unlockStage: 50,
    },
    xpGain: {
      label: 'Savoir',
      description: "+3 % d'expérience gagnée par niveau (+150 % au niveau 50)",
      baseCost: 200,
      costGrowth: 1.4,
      perLevel: 3,
      maxLevel: 50,
      unlockStage: 60,
    },
  },
  upgradeCategories: [
    // v9.2.8 : « Survie » devient « Défense » (même identifiant : le filtre mémorisé reste valable), avec la Défense.
    { id: 'combat', label: 'Combat', icon: 'weapon_sword', keys: ['damage', 'attackSpeed', 'crit', 'critDamage', 'doubleAttack', 'bossDamage', 'companionPower'] },
    { id: 'survival', label: 'Défense', icon: 'icon_shield', keys: ['vitality', 'defense', 'regen', 'lifesteal', 'dodge'] } /* v9.3.9 : sans Peau de fer */,
    { id: 'resources', label: 'Ressources', icon: 'coin', keys: ['goldFind', 'xpGain'] },
    { id: 'rushes', label: 'Boosts', icon: 'skill_cry', keys: [] }, // boosts à durée limitée (core/rushes.js)
  ],

  stages: {
    killsPerStage: 15, // v9.3.8 : 5 vagues de 3 (BALANCE.waves)
    bossEvery: 5,
    stagesPerZone: 20, // étapes 5, 10, 15, 20 : mini-boss, boss moyen, boss dur, méga boss
    // v7.7 : boss bien plus coriaces (ils étaient balayés en quelques coups).
    bossHpMultiplier: 45, // un boss se gagne aux dégâts…
    bossDamageMultiplier: 0.6, // …et il frappe fort (v9.2.8 : 2,4 → 0,6, avec la courbe de dégâts damageCurve)
    // v9.2.8 : un boss frappe lourd (3 à 4 coups pour tomber) mais lentement (×1,2 → ×4 l'intervalle de sa base) :
    // la régénération compte entre deux coups et le mur reste ses PV et sa rage, comme avant (×4,5).
    bossAttackInterval: 4.5,
    bossArmorPierce: 0.4, // un boss ignore 40 % de l'armure du héros
    enrageSeconds: 30, // v9.6.3 (5.3) : compte à rebours de 30 s (la rage reste douce : +4 % toutes les 10 s) ; v9.2.8 : 25 → 60 s ; au-delà, le boss enrage : dégâts ×1,3 toutes les 10 s (étape 4 : multiplicatif)
    enrageStepSeconds: 10,
    enragePct: 4, // v9.2.8 : 30 → 4 % (un héros équilibré ne tient plus des milliers de coups) ; étape 4 : ×1,3 par palier, multiplicatif (×4,8 à 85 s, ×14 à 125 s)
    // Monde 11 : méga boss berserk (et leurs invocations).
    berserk: { hp: 1.8, damage: 1, speed: 1.3, gold: 2 }, // v9.2.8 : dégâts 1,6 → 1 (courbe de dégâts damageCurve)
    // Renaissance : les boss s'adaptent (plus durs) mais rapportent plus.
    rebirthBossPct: 5, // v8.4 : 60 → 5 (la Renaissance doit rendre plus fort, pas plus faible)
    rebirthRewardPct: 50, // or, gemmes et essences des boss +50 % par Renaissance
    bossGoldMultiplier: 15,
    bossSpawnDelaySeconds: 1.2,
    bossRetryPower: 1.15, // v8.4 : boss retenté automatiquement à +15 % de puissance
    // Boss par rang (étape du monde) : multiplicateurs appliqués aux valeurs « boss » ci-dessus.
    tiers: {
      mini: { stage: 5, hp: 0.45, damage: 0.85, gold: 0.4, gems: 10 },
      mid: { stage: 10, hp: 0.65, damage: 0.95, gold: 0.6, gems: 15 },
      hard: { stage: 15, hp: 0.85, damage: 1.05, gold: 0.8, gems: 20 },
      mega: { stage: 20, hp: 1.15, damage: 1.15, gold: 1.2, gems: 35 },
      dungeon: { stage: null, hp: 1.15, damage: 1.15, gold: 1.2, gems: 35 }, // v9.0.4 : boss propres aux donjons
    },
  },

  enemyScaling: {
    // v7.6 : 20 étapes par monde (au lieu de 10) : croissance par étape = racine de l'ancienne.
    // Étape 4 (rythme) : ennemis 8 fois plus robustes au départ, croissance un peu plus douce (1,0817 → 1,075) :
    // le début se dispute (les améliorations comptent), la fin de partie n'est pas durcie (égalité vers l'étape 335).
    hpBase: 8,
    hpBaseRamp: 25, // ×8 atteint progressivement sur les 25 premières étapes
    hpGrowth: 1.075,
    damageGrowth: 1.0583,
    // v9.2.8 : ×coef × étape^exp en plus (×1 au plus bas) : un héros qui achète ses PV et sa Défense encaisse 4 à 6
    // coups ordinaires à son étape record au lieu de milliers (réglage : tools/measure-defense-v928.mjs).
    // ramp : montée douce sur les 60 premiers niveaux ; au-delà du niveau 240, ×lateGrowth par niveau ; ×cycleStep
    // à partir du 3e cycle ; rebirthPow : part du multiplicateur de Renaissance du héros reprise par les coups ennemis.
    damageCurve: { coef: 0.3, exp: 1.45, ramp: 60, knee: 240, lateGrowth: 1.002, bossPow: 1, rebirthPow: 0.8, cycleStep: 3.85 },
    goldGrowth: 1.0724,
  },

  // v9.2.2 : ruée — quand un coup du héros vaut au moins `oneShot` fois les PV d'un ennemi ordinaire, celui-ci se
  // rue vers l'équipe (vitesse × `speedMult`) et ne peut être touché qu'une fois à portée visible du contact
  // (`reach` unités au-delà de sa distance de frappe) : on voit les coups et la mort au lieu d'un ennemi tué hors champ.
  rush: { oneShot: 1, speedMult: 4, reach: 8 },

  spawn: {
    intervalSeconds: 1.4,
    maxAlive: 3,
  },

  loot: {
    dropChance: 0.1,
    // v9.1.9 : le sac se remplissait en quelques minutes. Butin des monstres ordinaires (combat et hors ligne) :
    // chance × dropScale (−70 % d'objets) et rareté tirée avec dropRarityWeights : autant d'Épiques et de Légendaires
    // par heure (rapport 7 : 1 gardé), deux fois moins de Rares, ~6 fois moins de Communs. Compensations : pièces
    // d'ensemble (setChance.rare ×2) et éclats (killShardChance : +1 éclat, à la place des Communs et Rares recyclés).
    // Mesures avant/après : docs/butin-v919.md (tools/measure-butin-v919.mjs).
    dropScale: 0.3,
    dropRarityWeights: { common: 36.7, rare: 36.7, epic: 23.3, legendary: 3.3 },
    killShardChance: 0.14, // v9.1.9 : chance d'un éclat par monstre ordinaire vaincu (compense les objets en moins)
    bossMinRarity: 'rare',
    stagePowerGrowth: 0.045, // +4,5 % de stats par niveau d'objet (linéaire jusqu'à la v8.3)
    stagePowerExp: 1.03, // v8.4 : croissance exponentielle (×1,03 par niveau d'objet)
    recycleLevelGrowth: 0.05,
    recycleGoldShare: 0.5, // étape 4 : part de l'or d'étape (voir recycleValue)
    inventorySize: 100, // v9.1.3 : au-delà, recyclage complet (or + éclats) ; ancestraux et pièces utiles au coffre
    stashSize: 300, // v9.1.3 : places du coffre (constante unique, voir core/stash.js STASH_SIZE)
    // v9.1.3 (doc3 lot 1, faille d'or) : l'or de recyclage suit min(niveau de l'objet, étape max de la partie en
    // cours). Après une Renaissance, un vieil objet de niveau 300 ne rend plus l'or de l'étape 300 à l'étape 5.
    // Mesure : docs/equipement-v913.md.
    recycleLevelCap: 'maxStage',
    signatureChance: 0.15, // chance qu'un boss lâche son objet signature
    bossEssence: 2, // « essences » garanties par boss (+1 par zone), versées en éclats (× ESSENCE_SHARDS) depuis la v9.1.3
    // Poids de chaque emplacement dans le butin (accessoires ≈ 1/3 des objets).
    slotWeights: { weapon: 3, armor: 4, accessory: 4 }, // v9.3.4 (f) : 3 places (casque + armure, 4 bijoux réunis)
    // Effets spéciaux : nombre d'effets par rareté.
    affixCount: { common: 0, rare: 1, epic: 1, legendary: 2 },
    // v8.5 : chance qu'un objet appartienne à l'ensemble de son monde, par rareté.
    setChance: { common: 0, rare: 0.24, epic: 0.25, legendary: 0.4 }, // v9.1.9 : Rare 0,12 → 0,24 (deux fois moins de Rares)
  },

  // Recyclage : matériaux rendus en plus de l'or, par rareté.
  materials: {
    shards: { common: 1, rare: 3, epic: 18, legendary: 50 }, // v9.1.3 : + les anciennes essences (1 et 3) × 10
  },

  // Forge : fabrication ciblée, relance des effets, réaffûtage au niveau actuel.
  forge: {
    craftShards: 25,
    craftGoldKills: 25, // coût en or = 25 × l'or d'un ennemi de l'étape max
    craftMinRarity: 'rare',
    // Fabrication épique : Épique ou mieux (v9.1.3 : 60 éclats + 6 essences → 120 éclats).
    epicCraft: { shards: 120, goldKills: 60 },
    reforgeShards: 20, // v9.1.3 : 10 éclats + 1 essence
    // v9.1.3 (doc3 lot 3) : relance orientée (Épique et Légendaire) : le joueur choisit l'effet de la 1re ligne.
    // Prix du doc convertis en éclats (1 essence = 10 éclats) : 50 + 5 → 100, 70 + 7 → 140, 30 + 3 → 60, 40 + 4 → 80.
    // gear = arme, casque, armure ; accessory = collier, boucles, bague, bracelet. Provisoires.
    targetReroll: { epic: { gear: 100, accessory: 140 }, legendary: { gear: 60, accessory: 80 } },
    targetRerollExcluded: ['dropChance'], // additif (core/combat.js) : changerait toute l'échelle du butin
    sharpenShardsPerLevel: 2, // réaffûtage : éclats par niveau gagné × facteur de rareté
    // Amélioration d'un objet : chaque niveau augmente une de ses statistiques (au hasard) de 12 %.
    maxUpgrades: { common: 5, rare: 5, epic: 10, legendary: 10 },
    upgradeBoostPct: 12,
    upgradeGoldKills: 6, // coût en or = 6 × (niveau + 1) × l'or d'un ennemi au niveau de l'objet
    upgradeShards: 2, // éclats = 2 × (niveau + 1)
    fusionCount: 5, // 5 objets d'une rareté (même emplacement) → 1 objet de la rareté suivante
    // v9.1.3 (doc3 lot 2) : fusion à pourcentage. Une rareté absente n'est pas fusionnable. rate = chance de la mise
    // de 5 ; stakes = mises courtes (chance de base) ; pityStep = jauge gagnée à l'échec (par emplacement + rareté).
    // Ne pas changer sans recalcul (doc3) : 125 Communs par Légendaire en mise de 5, 130 à 4, 133 à 3 ; pire cas 11.
    fusion: {
      common: { rate: 100 }, rare: { rate: 100 },
      epic: { rate: 100, stakes: { 3: 30, 4: 65 }, pityStep: 20 },
      // plus tard : legendary: { rate: 60, pityStep: 20 }, mise de 5 seulement
    },
    // v9.1.3 (doc3 lot 5) : héritage d'ensemble en fusion : chance min(pièces × 20, 40) % (« Aucun » possible).
    fusionSetInherit: { perPiece: 20, max: 40 },
    sharpenRarityFactor: { common: 1, rare: 2, epic: 3, legendary: 5 }, // réaffûtage : facteur de rareté
  },

  // Événements discrets pendant le farm (aucun ne demande de surveiller l'écran).
  events: {
    chancePerKill: 0.004,
    inboxSize: 8,
    weights: { chest: 30, merchant: 15, elite: 20, wave: 20, gems: 15, portal: 6, wanderer: 3 },
    portalGoldKills: 120,
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
    // v7.7 : deux invocations séparées. Compagnons (humains R/SR/SSR) et familiers (animaux).
    pools: {
      hero: { label: 'Apparences', rarityWeights: { rare: 76, epic: 21, legendary: 3 } }, // v9.0.6 : skins de héros
      ally: { label: 'Compagnons', rarityWeights: { rare: 76, epic: 21, legendary: 3 } },
      pet: { label: 'Familiers', rarityWeights: { common: 60, rare: 30, epic: 8.5, legendary: 1.5 } },
      // v9.1.3 (doc4 lot 4) : bannière du perso de la sortie et Archives, mêmes taux que les compagnons (déclarés ici,
      // sinon poolWeights retomberait sur l'ancien tirage unique avec des Communs, et l'unité serait indéfinie).
      banner: { label: 'Bannière', rarityWeights: { rare: 76, epic: 21, legendary: 3 } },
      archive: { label: 'Archives', rarityWeights: { rare: 76, epic: 21, legendary: 3 } },
    },
    rarityWeights: { common: 60, rare: 30, epic: 8.5, legendary: 1.5 }, // (ancien tirage unique)
    pity: { epicAfter: 10, legendaryAfter: 60 }, // garanties
    maxStars: 5,
    duplicateRefundGems: 20, // doublon d'une unité déjà à 5 étoiles
    firstBossGems: 50,
    startingGems: 100, // v9.1.3 : ancien ticket de départ, versé en gemmes
  },
  // 5 premières heures : progression très rapide, beaucoup de butin et d'invocations, puis normal.
  earlyBoost: {
    hours: 5,
    goldMultiplier: 1.5, // étape 4 : ×3 → ×1,5 au début (le début allait trop vite), décroît jusqu'à ×1
    xpMultiplier: 3,
    extraDropChance: 0.15, // +15 points de chance de butin au début
    eventMultiplier: 4, // coffres, gemmes, marchands… 4 fois plus fréquents
    bossGems: 100, // v9.1.3 : chaque victoire contre un boss donne 100 gemmes (ancien ticket) tant que le bonus dure
  },
  // Week-end (samedi + dimanche, 48 h) : or, XP, butin et événements ×2, cumulable avec le démarrage.
  weekendBoost: { multiplier: 2 },
  // Donjons : le héros SSR adapté à un donjon y écrase tout.
  // Hors de son donjon, un SSR reste un peu au-dessus d'un SR ; dans son donjon, il écrase tout.
  dungeonAffinity: { skillMultiplier: 6, passiveMultiplier: 4, damageTakenPct: 60, teamDamagePct: 150 },

  // Équipe : le chevalier (fixe) + 2 personnages (héros alliés) + 1 compagnon (familier).
  teamSlots: { ally: 2, pet: 1 },
  thirdAllyStage: 81, // v9.6.3 (3.4) : 3e place de compagnon à partir du monde 5
  companionSlots: 3,


  offline: {
    capHours: 24,
    farmMultiplier: 0.65, // hors ligne = 65 % du rythme de farm actif mesuré (35 % de moins)
    measureSeconds: 180, // durée de combat simulée pour mesurer ce rythme
    maxItems: 3, // objets réellement générés ; le surplus est converti en or (v9.1.9 : 10 × loot.dropScale, mêmes Épiques)
    gemShare: 0.3, // étape 4 : 30 % des gemmes de kill gagnées aussi hors ligne
    minSecondsForSummary: 60,
  },

  // Maîtrise des boss : paliers de victoires et récompenses.
  mastery: [
    { victories: 3, gems: 20 },
    { victories: 10, gems: 140 },
    { victories: 25, gems: 60, shards: 20 },
    { victories: 50, gems: 300 },
  ],
};
