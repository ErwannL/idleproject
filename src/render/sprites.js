// Assets pixel art du prototype, dessinés pour le projet (aucun asset externe).
//
// Chaque sprite est une grille de caractères ; chaque caractère renvoie à une couleur
// de BASE_PALETTE (ou de la palette locale `pal`). '.' = transparent.
// Les caractères 'a' (couleur principale), 'A' (ombre) et 'r' (rareté) sont remplacés
// à l'exécution par les couleurs de l'objet équipé.
//
// Ces grilles sont des placeholders remplaçables : modifier une grille ici met à jour le jeu
// et `npm run export-assets` régénère les PNG de assets/.

export const BASE_PALETTE = {
  k: '#1b1424', // contour
  w: '#ffffff',
  s: '#f2c39b', S: '#cf946a', // peau
  h: '#7a4426', // cheveux
  e: '#1b1424', // yeux
  t: '#6c5a8e', T: '#4b3d66', // vêtements de base
  l: '#4a2c1a', // ceinture
  p: '#3a3a5a', // pantalon
  b: '#5b3a22', // bottes
  g: '#62d05a', G: '#3a9a46', // gluant
  c: '#86b84a', C: '#5f8a33', // peau de gobelin
  o: '#8a5a33', O: '#6a4224', // tissu de gobelin
  f: '#8c8f9e', F: '#5e6170', // loup
  R: '#e8384f', // yeux rouges
  m: '#d8423a', M: '#a32b2b', // chapeau de champignon
  v: '#7a4fa8', V: '#55337a', // chauve-souris
  n: '#e8e2cf', N: '#b5ad95', // os
  y: '#ffd23f', Y: '#c8961e', // or
  j: '#4a9a3e', i: '#79c95c', L: '#2f6e30', // feuillage
  d: '#7a5230', D: '#553820', // tronc
  q: '#8b8f99', Q: '#62666f', // roche
  u: '#8fe8ff', U: '#3fa8d8', // cristal
  x: '#ef6aa6', z: '#ffe066', // fleurs
  H: '#6b4423', // manche d'arme
  E: '#e4ebf3', I: '#a3b1c2', J: '#5f6d80', // acier (clair, moyen, sombre)
  X: '#0d0a14', // fente de visière
  B: '#2f62b8', P: '#1d3b78', // bleu chevalier (cape, gambison, bouclier)
  W: '#e8b64a', // dorure
  Z: '#6b4428', // cuir des bottes
  a: '#cccccc', A: '#888888', r: '#ffffff', // remplacés par l'objet
};

// --- Héros : petit chevalier (20×22, face à droite). ---
// Calques dessinés dans l'ordre : cape (derrière), corps, armure, casque, arme.
// Sans équipement, le chevalier porte un camail, un gambison bleu, des épaulières et un bouclier.
const KNIGHT_TOP = [
  '....................',
  '....................',
  '........kkkk........',
  '.......kIIIIk.......',
  '......kIEEIIIk......',
  '......kIIssssk......',
  '......kIIssesk......',
  '......kIIsssSk......',
  '.......kIIIIk.......',
  '......kJIIIIJk......',
];
const KNIGHT_TORSO = [
  '....kEJkBBBBBkEJk...',
  '....kJJkBBWBBkJJk...',
  '...kWPPkBWWWBkJsk...',
  '...kPWPkBBWBBk.kk...',
  '...kWPPklllllk......',
  '....kWPkBBBBBk......',
];
const KNIGHT_TORSO_ATTACK = [
  '....kEJkBBBBBkEJk...',
  '....kJJkBBWBBkJJJssk',
  '...kWPPkBWWWBkkkkk..',
  '...kPWPkBBWBBk......',
  '...kWPPklllllk......',
  '....kWPkBBBBBk......',
];
const KNIGHT_LEGS_IDLE = [
  '....kkkkJJkJJk......',
  '.......kJIkIJk......',
  '.......kJIkIJk......',
  '.......kJIkIJk......',
  '......kZZZkZZZk.....',
  '......kkkkkkkkk.....',
];
const KNIGHT_LEGS_STRIDE = [
  '....kkkkJJkJJk......',
  '......kJIk.kIJk.....',
  '.....kJIk...kIJk....',
  '.....kJIk...kIJk....',
  '....kZZZk...kZZZk...',
  '....kkkkk...kkkkk...',
];
const KNIGHT_LEGS_PASS = [
  '....kkkkJJkJJk......',
  '........kJIJk.......',
  '........kJIJk.......',
  '........kJIJk.......',
  '.......kZZZZk.......',
  '.......kkkkkk.......',
];

export const HERO_FRAME_SIZE = { w: 20, h: 22 };

export const SPRITES = {
  hero_idle: { rows: [...KNIGHT_TOP, ...KNIGHT_TORSO, ...KNIGHT_LEGS_IDLE], hand: { x: 15, y: 12 } },
  hero_walk1: { rows: [...KNIGHT_TOP, ...KNIGHT_TORSO, ...KNIGHT_LEGS_STRIDE], hand: { x: 15, y: 12 } },
  hero_walk2: { rows: [...KNIGHT_TOP, ...KNIGHT_TORSO, ...KNIGHT_LEGS_PASS], hand: { x: 15, y: 12 } },
  hero_attack: { rows: [...KNIGHT_TOP, ...KNIGHT_TORSO_ATTACK, ...KNIGHT_LEGS_STRIDE], hand: { x: 18, y: 11 } },

  // Cape courte, animée (3 images), dessinée derrière le corps (oy = première ligne).
  cape_a: {
    oy: 9,
    rows: [
      '.....kBk............',
      '...kBBBk............',
      '..kBBBPk............',
      '..kBBPk.............',
      '.kBBBPk.............',
      '.kBBPPk.............',
      'kBBBPk..............',
      'kBPPk...............',
      '.kkk................',
    ],
  },
  cape_b: {
    oy: 9,
    rows: [
      '.....kBk............',
      '...kBBBk............',
      '..kBBBPk............',
      '.kBBBPk.............',
      'kBBBPPk.............',
      'kBBPPk..............',
      '.kBPPk..............',
      '..kkk...............',
    ],
  },
  cape_c: {
    oy: 9,
    rows: [
      '.....kBk............',
      '..kkBBBk............',
      'kBBBBBPk............',
      'kBBBBPk.............',
      '.kBBPPk.............',
      '..kPPk..............',
      '...kk...............',
    ],
  },

  // --- Équipement superposé au héros (oy = ligne de départ sur le corps). ---
  helmet_helm: {
    oy: 0,
    rows: [
      '........rrr.........',
      '.......rrkkkk.......',
      '......rkaaaaak......',
      '......kaaaaaaak.....',
      '......kaAAAAaak.....',
      '......kaaaXXXXk.....',
      '......kaaaAaAak.....',
      '......kAaaaaaAk.....',
      '.......kkkkkkk......',
    ],
  },
  helmet_hood: {
    oy: 2,
    rows: [
      '........kkkk........',
      '.......kaaaak.......',
      '......kaarraak......',
      '......kaA...........',
      '......kaA...........',
      '......kaA...........',
      '.......kAa..........',
    ],
  },
  armor_mail: {
    oy: 10,
    rows: [
      '....kaAkaAaAakaAk...',
      '....kAAkAaraAkAA....',
      '........aAraA.a.....',
      '........AaAaA.......',
      '........rrrrr.......',
      '........aAaAa.......',
    ],
  },
  armor_tunic: {
    oy: 10,
    rows: [
      '........aaaaa.......',
      '........aarAa.......',
      '........arrra.......',
      '........aarAa.......',
      '....................',
      '........aAaAa.......',
      '........AAkAA.......',
    ],
  },
  // Armes verticales, lame vers le haut ; `grip` = pixel tenu dans la main.
  weapon_sword: {
    grip: { x: 2, y: 10 },
    rows: ['..k..', '.kwk.', '.kak.', '.kak.', '.kak.', '.kak.', '.kak.', '.kAk.', 'krrrk', '.kHk.', '.kHk.', '.kWk.', '..k..'],
  },
  weapon_axe: {
    grip: { x: 2, y: 10 },
    rows: ['...kkk.', '..kaaak', '.kHaaAk', '.kHaAAk', '.kHkkk.', '.kHk...', '.kHk...', '.kHk...', 'krHrk..', '.kHk...', '.kHk...', '.kHk...', '..k....'],
  },
  weapon_dagger: {
    grip: { x: 2, y: 5 },
    rows: ['..k..', '.kwk.', '.kak.', '.kAk.', 'krrrk', '.kHk.', '.kWk.', '..k..'],
  },

  // --- Icônes d'interface (12 px environ). ---
  icon_upgrade: {
    rows: [
      '.....kk.....',
      '....kWWk....',
      '...kWWWWk...',
      '..kWWWWWWk..',
      '.kkkWWWWkkk.',
      '...kWWWWk...',
      '...kWWWWk...',
      '...kWYYWk...',
      '...kWYYWk...',
      '...kYYYYk...',
      '...kkkkkk...',
    ],
  },
  icon_bag: {
    rows: [
      '....kkkk....',
      '...koWWok...',
      '....kook....',
      '...kooook...',
      '..koooooOk..',
      '.kooooooOOk.',
      '.koooWWooOk.',
      '.koooWWooOk.',
      '.kooooooOOk.',
      '..kOOOOOOk..',
      '...kkkkkk...',
    ],
  },
  icon_hero: {
    rows: [
      '....kkkk....',
      '...kEEIIk...',
      '..kEIIIIJk..',
      '..kIIIIIJk..',
      '..kXXXXXXk..',
      '..kIIJIIJk..',
      '..kIIIIIJk..',
      '..kIJIJIJk..',
      '...kIIIJk...',
      '....kkkk....',
    ],
  },
  icon_map: {
    pal: { m: '#e9d29a', M: '#b88f52', R: '#c0392b' },
    rows: [
      '.kkkkkkkkkk.',
      '.kmmmmmmmMk.',
      '.kmRmmmmmMk.',
      '.kmmRRmmmMk.',
      '.kmmmmRmmMk.',
      '.kmmmmmRmMk.',
      '.kmmmmmRkMk.',
      '.kMMMMMMMMk.',
      '.kkkkkkkkkk.',
    ],
  },
  icon_gear: {
    rows: [
      '....kkkk....',
      '.kk.kIIk.kk.',
      '.kIkkIIkkIk.',
      '..kIIIIIIk..',
      'kkkIIkkIIkkk',
      'kIIIk..kIIIk',
      'kIIIk..kIIIk',
      'kkkIIkkIIkkk',
      '..kIIIIIIk..',
      '.kIkkIIkkIk.',
      '.kk.kIIk.kk.',
      '....kkkk....',
    ],
  },
  icon_heart: {
    rows: [
      '.kk...kk.',
      'kRRk.kRRk',
      'kRwRkRRRk',
      'kRRRRRRRk',
      '.kRRRRRk.',
      '..kRRRk..',
      '...kRk...',
      '....k....',
    ],
  },
  icon_bolt: {
    rows: [
      '...kkkk',
      '..kyyk.',
      '.kyyk..',
      'kyyyyyk',
      'kkkyyk.',
      '..kyk..',
      '.kyk...',
      '.kk....',
    ],
  },
  icon_shield: {
    rows: [
      'kkkkkkkkk',
      'kBBBWBBBk',
      'kBBBWBBBk',
      'kWWWWWWWk',
      'kBBBWBBBk',
      'kBBBWBBBk',
      '.kBBWBBk.',
      '..kBWBk..',
      '...kWk...',
      '....k....',
    ],
  },
  icon_skull: {
    rows: [
      '.kkkkk.',
      'knnnnnk',
      'knknknk',
      'knnnnnk',
      '.knknk.',
      '..kkk..',
    ],
  },

  // --- Ennemis (face à gauche, vers le héros), alignés par le bas. ---
  slime: {
    rows: [
      '......kkkk......',
      '....kkggggkk....',
      '...kgggwggggk...',
      '..kggwwgggggGk..',
      '..kgkgggkgggGk..',
      '..kgggggggggGk..',
      '..kGgggggggGGk..',
      '...kkkkkkkkkk...',
    ],
  },
  goblin: {
    rows: [
      '.....kkkk.......',
      '...kkccccck.....',
      '..kcckcccck.....',
      '..kccccCcck.....',
      '...kcwcwck......',
      '....kkkkk.......',
      '...koooook......',
      '..kcoooooock....',
      '..kcoOOOOock....',
      '...koooook......',
      '...kook.kok.....',
      '...kck..kck.....',
      '..kkck..kkck....',
    ],
  },
  wolf: {
    rows: [
      '.kk.............',
      '.kfk........kk..',
      'kfffk......kfk..',
      'kRfffkkkkkkfk...',
      'kfffffffffffk...',
      '.kkFfffffffFk...',
      '..kfk.kfk.kfk...',
      '..kfk.kfk.kfk...',
      '..kkk.kkk.kkk...',
    ],
  },
  mushroom: {
    rows: [
      '.....kkkkkk.....',
      '...kkmmwmmmkk...',
      '..kmmmmmmwmmmk..',
      '.kmwmmmmmmmmMMk.',
      '.kMMMMMMMMMMMMk.',
      '..kkkkkkkkkkkk..',
      '....ksksssk.....',
      '....ksssssk.....',
      '....ksSSSsk.....',
      '...kkssssskk....',
      '...kkkkkkkkk....',
    ],
  },
  bat_up: {
    rows: [
      '.k..........k...',
      '.vk...kk...kv...',
      '.vvk.kvvk.kvv...',
      '.vvvkvRvvkvvv...',
      '..vvkvvvvkvv....',
      '....kvwvwk......',
      '.....kkkk.......',
    ],
  },
  bat_down: {
    rows: [
      '................',
      '......kk........',
      '....kkvvkk......',
      '..kvvkRvvkvvk...',
      '.kvvvkvwvkvvvk..',
      '.kvv.kkkk..vvk..',
      '.k..........k...',
    ],
  },
  skeleton: {
    rows: [
      '.....kkkkk......',
      '....knnnnnk.....',
      '....kknnknk.....',
      '....knnnnnk.....',
      '.....knknk......',
      '......kkk.......',
      '....kknnnkk.....',
      '...knkNnNknk....',
      '...k.knnnk.k....',
      '....kkNnnNkk....',
      '.....knk.knk....',
      '.....knk.knk....',
      '.....knk.knk....',
      '....kkkk.kkkk...',
    ],
  },
  crown: {
    rows: ['y.y.y', 'yyyyy', 'yYyYy'],
  },

  // --- Décor modulaire, aligné par le bas sur le sol. ---
  tree: {
    rows: [
      '......kkkk......',
      '....kkjjjjkk....',
      '...kjjijjjjjk...',
      '..kjjiijjjjjLk..',
      '.kjjijjjjjjjLLk.',
      '.kjjjjjjjjjLLLk.',
      '.kLjjjjjjjLLLLk.',
      '..kLLjjjjjLLLk..',
      '...kkLLLLLLkk...',
      '.....kkddkk.....',
      '......kddk......',
      '......kdDk......',
      '......kdDk......',
      '.....kddDDk.....',
    ],
  },
  pine: {
    rows: [
      '.......kk.......',
      '......kjjk......',
      '.....kjijLk.....',
      '....kjjjjLLk....',
      '.....kjijLk.....',
      '....kjijjjLk....',
      '...kjjjjjjLLk...',
      '....kjjijjLk....',
      '...kjijjjjjLk...',
      '..kjjjjjjjjLLk..',
      '.kjjjjjjjjjjLLk.',
      '.kkkkkkddkkkkkk.',
      '......kddk......',
      '......kdDk......',
    ],
  },
  bush: {
    rows: [
      '...kkkk...',
      '.kkjjijkk.',
      'kjjijjjjLk',
      'kjjjjjjLLk',
      '.kkkkkkkk.',
    ],
  },
  rock: {
    rows: [
      '..kkkk..',
      '.kqqqQk.',
      'kqqqqQQk',
      'kkkkkkkk',
    ],
  },
  flowers: {
    rows: [
      '.x...z.',
      'xzx.zxz',
      '.x.j.z.',
      '.j.j.j.',
    ],
  },
  grass: {
    rows: ['.j.j.', 'jijji'],
  },
  mushroom_small: {
    rows: ['.kkk.', 'kmwmk', 'kkkkk', '.kSk.'],
  },
  crystal: {
    rows: [
      '..k...',
      '.kuk..',
      '.kuUk.',
      'kuuUk.',
      'kuuUUk',
      'kkkkkk',
    ],
  },
  stalagmite: {
    rows: [
      '..kk..',
      '..kqk.',
      '.kqQk.',
      '.kqqQk',
      'kqqqQk',
      'kkkkkk',
    ],
  },
  stalactite: {
    rows: [
      'kkkkkk',
      'kqqqQk',
      '.kqQk.',
      '.kqk..',
      '..k...',
    ],
  },
  castle: {
    rows: [
      '..q.q............q.q..',
      '..qqq.....q.q....qqq..',
      '..qqq.....qqq....qqq..',
      '..qQq.....qqq....qQq..',
      '..qqqq.q.qqqqq.q.qqq..',
      '..qqqqqqqqqQqqqqqqqq..',
      '..qqqqqqqqQQQqqqqqqq..',
      '..qqqqqqqqQQQqqqqqqq..',
      'qqqqqqqqqqqqqqqqqqqqqq',
    ],
  },
  cloud: {
    pal: { c: '#dceef6' },
    rows: [
      '....wwww......',
      '..wwwwwwww.ww.',
      '.wwwwwwwwwwwww',
      'wwwwwwwwwwwwww',
      '.cccccccccccc.',
    ],
  },
  coin: {
    rows: ['.kkk.', 'kyywk', 'kyyYk', 'kyYYk', '.kkk.'],
  },
};

// Remplit les lignes trop courtes avec du transparent.
export function normalizeRows(rows) {
  const width = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => r.padEnd(width, '.'));
}

// Rotation de 90° dans le sens horaire (le haut de l'image passe à droite).
export function rotateRowsCW(rows) {
  const grid = normalizeRows(rows);
  const h = grid.length;
  const w = grid[0].length;
  const out = [];
  for (let y = 0; y < w; y++) {
    let line = '';
    for (let x = 0; x < h; x++) line += grid[h - 1 - x][y];
    out.push(line);
  }
  return out;
}

// Petite police pixel 3×5 pour les nombres flottants.
export const FONT = {
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
  ',': ['0', '0', '0', '1', '1'],
  '+': ['000', '010', '111', '010', '000'],
  '-': ['000', '000', '111', '000', '000'],
  K: ['101', '101', '110', '101', '101'],
  M: ['101', '111', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  T: ['111', '010', '010', '010', '010'],
  Q: ['111', '101', '101', '111', '001'],
  a: ['000', '011', '101', '101', '011'],
  i: ['1', '0', '1', '1', '1'],
  ' ': ['0', '0', '0', '0', '0'],
};
