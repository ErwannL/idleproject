// Classes du héros (v9.0.6) : un clic change tout le style de combat — armes autorisées, portée, façon de
// frapper (zone, perçant, chaîne, volée, météore…), animations et bonus de classe. Casques, armures et
// accessoires vont à toutes les classes ; seules les armes sont réservées (famille = `sprite` de la base).
// `style` : 'melee' (fonce au contact), 'reach' (allonge), 'ranged' (tire de loin), 'magic' (sorts de loin).
// `range` : portée d'attaque (unités de BALANCE.world ; le corps à corps vaut 42).
// `attack` : règles de l'attaque automatique (voir core/classes.js) ; `effects` : bonus permanents de classe.
export const CLASSES = [
  {
    id: 'knight', name: 'Chevalier', weapons: ['sword', 'greatsword'], style: 'melee', range: 42, unlockStage: 1,
    color: '#5fa0ff', text: 'Équilibré et solide : fonce au contact, coups d\'épée en arc.',
    effects: { maxHpPct: 10, armor: 2 }, attack: { kind: 'slash' },
  },
  {
    id: 'archer', name: 'Archer', weapons: ['bow', 'longbow'], style: 'ranged', range: 110, unlockStage: 1,
    color: '#86e07a', text: 'Tire de loin avant que l\'ennemi n\'arrive ; toutes les 4 flèches, une pluie de flèches.',
    effects: { attackSpeedPct: 10, damagePct: -10, maxHpPct: -15 }, attack: { kind: 'arrow', volleyEvery: 4, volley: 4, volleyFactor: 0.6 },
  },
  {
    id: 'pyromancer', name: 'Mage de feu', weapons: ['staff'], style: 'magic', range: 100, unlockStage: 1,
    color: '#ff7a2a', text: 'Boules de feu qui explosent sur les ennemis proches ; toutes les 6 attaques, un météore.',
    effects: { damagePct: -15, maxHpPct: -20 }, attack: { kind: 'fireball', splash: 0.5, splashRadius: 34, meteorEvery: 6, meteorFactor: 0.8 },
  },
  {
    id: 'berserker', name: 'Berserker', weapons: ['axe', 'whip'], style: 'melee', range: 42, unlockStage: 15,
    color: '#ff4a3a', text: 'Frappe brutale qui fend aussi les ennemis derrière la cible.',
    effects: { damagePct: 20, maxHpPct: -10 }, attack: { kind: 'cleave', splash: 0.3, splashRadius: 30 },
  },
  {
    id: 'lancer', name: 'Lancier', weapons: ['spear', 'halberd'], style: 'reach', range: 62, unlockStage: 25,
    color: '#5fd0ff', text: 'Grande allonge : l\'estoc transperce la cible et l\'ennemi suivant.',
    effects: { damagePct: 5 }, attack: { kind: 'thrust', pierce: 1, pierceFactor: 0.6 },
  },
  {
    id: 'paladin', name: 'Paladin', weapons: ['mace', 'hammer'], style: 'melee', range: 42, unlockStage: 35,
    color: '#ffe27a', text: 'Très résistant ; chaque coup fait tomber un rai de lumière sacrée.',
    effects: { maxHpPct: 20, armor: 5, regenPct: 0.5, damagePct: -5 }, attack: { kind: 'smite', splash: 0.15, splashRadius: 26 },
  },
  {
    id: 'assassin', name: 'Assassin', weapons: ['dagger', 'katar'], style: 'melee', range: 42, unlockStage: 45,
    color: '#b07bff', text: 'Coups très rapides et critiques, surgit dans l\'ombre de sa cible.',
    effects: { attackSpeedPct: 25, critChance: 10, maxHpPct: -15 }, attack: { kind: 'shadow' },
  },
  {
    id: 'crossbowman', name: 'Arbalétrier', weapons: ['crossbow'], style: 'ranged', range: 100, unlockStage: 55,
    color: '#c8a070', text: 'Carreaux lourds qui transpercent toute la file d\'ennemis.',
    effects: { damagePct: 15, attackSpeedPct: -15, maxHpPct: -10 }, attack: { kind: 'bolt', pierce: 9, pierceFactor: 0.6 },
  },
  {
    id: 'stormcaller', name: 'Mage de foudre', weapons: ['wand', 'scepter'], style: 'magic', range: 100, unlockStage: 65,
    color: '#7fd4ff', text: 'Éclairs qui rebondissent sur 3 autres ennemis.',
    effects: { attackSpeedPct: 5, damagePct: -10, maxHpPct: -20 }, attack: { kind: 'lightning', chain: 3, chainFactor: 0.5 },
  },
  {
    id: 'necromancer', name: 'Nécromancien', weapons: ['scythe'], style: 'magic', range: 80, unlockStage: 80,
    color: '#5fe0a0', text: 'Âmes errantes qui drainent la vie ; la faux moissonne les ennemis proches.',
    effects: { lifesteal: 6, damagePct: -5 }, attack: { kind: 'soul', splash: 0.2, splashRadius: 28 },
  },
];

export const STARTER_CLASS = 'knight';
// Part des armes du butin tirées dans la classe active (le reste : n'importe quelle classe).
export const CLASS_WEAPON_DROP = 0.7;
