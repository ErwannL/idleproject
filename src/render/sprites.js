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
  K: '#3b7de0', // plumet du heaume (couleur du héros)
  E: '#e4ebf3', I: '#a3b1c2', J: '#5f6d80', // acier (clair, moyen, sombre)
  X: '#0d0a14', // fente de visière
  B: '#2f62b8', P: '#1d3b78', // bleu chevalier (cape, gambison, bouclier)
  W: '#e8b64a', // dorure
  Z: '#6b4428', // cuir des bottes
  a: '#cccccc', A: '#888888', r: '#ffffff', // remplacés par l'objet
};

// --- Héros : chevalier (24×28, face à droite). ---
// Calques dessinés dans l'ordre : cape (derrière), corps, armure, bouclier, casque (ou heaume par défaut), arme.
// Les couleurs B/P (tabard, cape, bouclier), W (dorures) et K (plumet) changent selon le héros choisi.
export const HERO_FRAME_SIZE = { w: 24, h: 28 };
export const SHIELD_OFFSET = { x: 3, y: 12 };

const HERO_SPRITES = {
  hero_idle: { hand: {x: 18, y: 15}, rows: ["........................", "..........kkkkk.........", ".........kIIIIIk........", "........kIEEIIIIk.......", "........kIIssssIk.......", "........kIIsssesk.......", "........kIIsssssk.......", "........kIIssSSsk.......", "........kJIIIIIJk.......", ".........kkJJJkk........", "......kEEkBBBBBBkEEk....", ".....kEIJkBBWWBBkJIEk...", ".....kIJJkBWWWWBkJJIk...", "......kkkkBBWWBBkkkJk...", ".........kBBWWBBk.kJk...", ".........kPBBBBPkksk....", ".........kllllllk.......", ".........kPBBBBPk.......", "........kkJJkkJJkk......", ".........kJIk.kIJk......", ".........kJIk.kIJk......", ".........kJIk.kIJk......", ".........kEIk.kIEk......", ".........kJIk.kIJk......", ".........kJIk.kIJk......", "........kZZZk.kZZZk.....", "........kZZZZkkZZZZk....", "........kkkkkkkkkkkk...."] },
  hero_walk1: { hand: {x: 18, y: 15}, rows: ["........................", "..........kkkkk.........", ".........kIIIIIk........", "........kIEEIIIIk.......", "........kIIssssIk.......", "........kIIsssesk.......", "........kIIsssssk.......", "........kIIssSSsk.......", "........kJIIIIIJk.......", ".........kkJJJkk........", "......kEEkBBBBBBkEEk....", ".....kEIJkBBWWBBkJIEk...", ".....kIJJkBWWWWBkJJIk...", "......kkkkBBWWBBkkkJk...", ".........kBBWWBBk.kJk...", ".........kPBBBBPkksk....", ".........kllllllk.......", ".........kPBBBBPk.......", "........kkJJkkJJkk......", "........kJIk...kIJk.....", ".......kJIk.....kIJk....", ".......kJIk.....kIJk....", "......kEIk.......kIEk...", "......kJIk.......kIJk...", "......kJIk.......kIJk...", ".....kZZZk.......kZZZk..", ".....kZZZZk......kZZZZk.", ".....kkkkkk......kkkkkk."] },
  hero_walk2: { hand: {x: 18, y: 15}, rows: ["........................", "..........kkkkk.........", ".........kIIIIIk........", "........kIEEIIIIk.......", "........kIIssssIk.......", "........kIIsssesk.......", "........kIIsssssk.......", "........kIIssSSsk.......", "........kJIIIIIJk.......", ".........kkJJJkk........", "......kEEkBBBBBBkEEk....", ".....kEIJkBBWWBBkJIEk...", ".....kIJJkBWWWWBkJJIk...", "......kkkkBBWWBBkkkJk...", ".........kBBWWBBk.kJk...", ".........kPBBBBPkksk....", ".........kllllllk.......", ".........kPBBBBPk.......", "........kkJJkkJJkk......", "..........kJIIJk........", "..........kJIIJk........", "..........kJIIJk........", "..........kEIIEk........", "..........kJIIJk........", "..........kJIIJk........", ".........kZZZZZk........", ".........kZZZZZZk.......", ".........kkkkkkkk......."] },
  hero_attack: { hand: {x: 21, y: 12}, rows: ["........................", "..........kkkkk.........", ".........kIIIIIk........", "........kIEEIIIIk.......", "........kIIssssIk.......", "........kIIsssesk.......", "........kIIsssssk.......", "........kIIssSSsk.......", "........kJIIIIIJk.......", ".........kkJJJkk........", "......kEEkBBBBBBkEEk....", ".....kEIJkBBWWBBkJIEk...", ".....kIJJkBWWWWBkJJJJssk", "......kkkkBBWWBBkkkkkkk.", ".........kBBWWBBk.......", ".........kPBBBBPk.......", ".........kllllllk.......", ".........kPBBBBPk.......", "........kkJJkkJJkk......", "........kJIk...kIJk.....", ".......kJIk.....kIJk....", ".......kJIk.....kIJk....", "......kEIk.......kIEk...", "......kJIk.......kIJk...", "......kJIk.......kIJk...", ".....kZZZk.......kZZZk..", ".....kZZZZk......kZZZZk.", ".....kkkkkk......kkkkkk."] },
  helmet_default: { oy: 0, rows: ["...........KKK..........", "..........KKkkkkk.......", ".........KkEEIIIk.......", "........kEEIIIIIIk......", "........kEIIIIIIIk......", "........kIIXXXXXXk......", "........kIIIIJIJIk......", "........kIIIIIIIJk......", "........kJIIIIIJJk......", ".........kkJJJJkk......."] },
  helmet_helm: { oy: 0, rows: ["...........rrr..........", "..........rrkkkkk.......", ".........rkaaAAAk.......", "........kaaAAAAAAk......", "........kaAAAAAAAk......", "........kAAXXXXXXk......", "........kAAAAaAaAk......", "........kAAAAAAAak......", "........kaAAAAAaak......", ".........kkrrrrkk......."] },
  helmet_hood: { oy: 1, rows: ["..........kkkkk.........", ".........kaaaaak........", "........kaaarraak.......", "........kaA....Ak.......", "........kaA..a..k.......", "........kaA.....k.......", "........kAA.....k.......", "........kAAaaaaAk.......", ".........kkrrrkk........"] },
  armor_mail: { oy: 10, rows: ["......kaakaAaAaAkaak....", ".....kaAAkAaraAakAAak...", ".....kAAAkaArrAakAAAk...", "..........aAraAa........", "..........AaraAA........", "..........aAaAaA........", "..........rrrrrr........", "..........aAaAaA........"] },
  armor_tunic: { oy: 10, rows: ["..........aaaaaa........", "..........aarraa........", "..........rrrrrr........", "..........aarraa........", "..........aarraa........", "..........AaaaaA........", "........................", "..........AAAAAA........", "..........AA..AA........"] },
  cape_a: { oy: 10, rows: [".....kBBBk..............", "....kBBBBk..............", "...kBBBBPk..............", "...kBBBPPk..............", "..kBBBBPk...............", "..kBBBPPk...............", ".kBBBBPk................", ".kBBBPPk................", "kBBBBPk.................", "kBBBPPk.................", "kBBPPk..................", ".kkkk..................."] },
  cape_b: { oy: 10, rows: [".....kBBBk..............", "....kBBBBk..............", "...kBBBBPk..............", "...kBBBPPk..............", "..kBBBBPk...............", "..kBBBPPk...............", "kBBBBBPk................", "kBBBBPPk................", "kBBPPPk.................", ".kPPPk..................", "..kkk..................."] },
  cape_c: { oy: 10, rows: [".....kBBBk..............", "...kkBBBBk..............", ".kkBBBBBPk..............", "kBBBBBBPPk..............", "kBBBBBPPk...............", ".kBBBPPk................", "..kBPPk.................", "...kkk.................."] },
  shield: { rows: ["kkkkkkkk", "kBBWWBBk", "kBBWWBBk", "kWWWWWWk", "kBBWWBBk", "kBBWWBBk", "kBBWWBBk", ".kBWWBk.", "..kWWk..", "...kk..."] },
  weapon_sword: { grip: {x: 2, y: 12}, rows: ["..k..", ".kwk.", ".kak.", ".kak.", ".kak.", ".kak.", ".kak.", ".kak.", ".kak.", ".kAk.", "krrrk", ".kHk.", ".kHk.", ".kWk.", "..k.."] },
  weapon_axe: { grip: {x: 2, y: 12}, rows: ["...kkk.", "..kaaak", ".kHaaAk", ".kHaAAk", ".kHkkk.", ".kHk...", ".kHk...", ".kHk...", ".kHk...", ".kHk...", "krHrk..", ".kHk...", ".kHk...", ".kHk...", "..k...."] },
  weapon_dagger: { grip: {x: 2, y: 7}, rows: ["..k..", ".kwk.", ".kak.", ".kak.", ".kAk.", "krrrk", ".kHk.", ".kHk.", ".kWk.", "..k.."] },
};

// --- Sprites v4 : ennemis, compagnons, décor et icônes supplémentaires. ---
const EXTRA_SPRITES = {
  wraith: { rows: ["....kkkk....", "...kvvvvk...", "..kvVkkVvk..", "..kvkwkwvk..", "..kvvvvvvk..", ".kvvVvvVvvk.", ".kvvvvvvvvk.", "kvvVvvvvVvvk", "kvvvvvvvvvvk", ".kvVvkvVvk..", ".kvkk.kvvk..", "..k....kk..."], pal: {"v": "#a98ad9", "V": "#6f55a8"} },
  scorpion: { rows: ["...........kk...", "..........kok...", "...........kok..", "............kok.", "..kk........kok.", ".kook.kkkkkkook.", "kRook.koooooook.", ".kkokkoOoOoOok..", "..k.kokokokok...", "....k.k.k.k.k..."], pal: {"o": "#c0703a", "O": "#8a4a22"} },
  mummy: { rows: ["...kkkk....", "..knnnnk...", "..kRnRnk...", "..knNnNk...", "...kNnk....", "..knnNnk...", ".knNnnNnk..", ".knnNnnnk..", "..knnNnk...", "..knNnnk...", "..knk.nk...", "..knk.nk...", ".kkNk.Nkk.."], pal: {"n": "#e9dfc0", "N": "#b9ab84"} },
  yeti: { rows: [".....kkkkk......", "....kwwwwwk.....", "...kwkwwkwwk....", "...kwwbbwwwk....", "...kwwwwwwwk....", "..kkwwwwwwwkk...", ".kwwkwwwwwkwwk..", ".kwwkwwwwwkwwk..", ".kbbkwwwwwkbbk..", "..kk.kwwwwk.kk..", ".....kwwkwwk....", ".....kwk.kwk....", "....kkwk.kwkk..."], pal: {"w": "#eef4f8", "b": "#7f97a8"} },
  imp: { rows: ["..k.....k...", "..kk...kk...", "..kmkkkmk...", "..kmmmmmk...", "..kmwmwmk...", "...kmMmk....", "..kmmmmmk...", ".kmkmmmkmk..", ".kk.kmmk.kk.", "....kmmk....", "...kmk.mk...", "...kk..kk..."] },
  dragon: { rows: ["....kk..................", "...kRRk.................", "..kRRRRk.....kk.........", ".kRwkRRRk...kRRk........", "kRRRRRRRRk.kRRRRkk......", "kRRRkkRRRRkRRRRRRRk.....", ".kk..kRRRRRRRRRRRRRk....", ".....kRRYYYYRRRRRRRRk...", "....kRRYYYYYYRRRRRRRRk..", "....kRRYYYYYYRRRkRRRRRk.", ".....kRRYYYYRRRk.kRRRRk.", "......kRRRRRRRk...kkRRk.", "......kRk.kRk.......kRk.", ".....kRRk.kRRk.......kk.", ".....kkkk.kkkk.........."], pal: {"R": "#c8452a", "Y": "#f0a24a"} },
  pet_slime: { rows: ["...kkkk...", ".kkyyyykk.", "kyywyyyyYk", "kykyykyyYk", "kyyyyyyYYk", ".kkkkkkkk."] },
  pet_cat: { rows: ["k.k.......", "kokk......", "kwowk..k..", "koook.ko..", ".koooooko.", ".kooooook.", ".kok..kok."], pal: {"o": "#e09a4a", "w": "#1b1424"} },
  pet_owl: { rows: ["k......k", "kokkkkok", "koyooyok", "kokooko.", ".kooook.", ".kOooOk.", "..kOOk..", "..yk.yk."], pal: {"o": "#a8814f", "O": "#7a5a33", "y": "#ffd23f"} },
  pet_fairy: { rows: ["u.....u.", "uu.kk.uu", ".uksskU.", "..kssk..", "..kxxk..", ".kxxxxk.", "..k..k.."], pal: {"u": "#bff2ff", "U": "#7fd6f0"} },
  pet_golem: { rows: ["..kkkkkk..", ".kqqqqqqk.", ".kqukquqk.", ".kqqqqqqk.", "kqkqqqqkqk", "kqkqQQqkqk", ".k.kqqk.k.", "...kqqk...", "..kqk.kqk.", "..kkk.kkk."] },
  pet_wisp: { rows: ["....k...", "...kyk..", "..kyfk..", ".kyffyk.", ".kfwwfk.", "kffwwffk", "kfFffFfk", ".kFffFk.", "..kkkk.."], pal: {"f": "#ff8a3d", "F": "#d4462a"} },
  pyramid: { rows: [".........kk.........", "........kddk........", ".......kdddDk.......", "......kddddDDk......", ".....kdddddDDDk.....", "....kddddddDDDDk....", "...kdddddddDDDDDk...", "..kddddddddDDDDDDk..", ".kdddddddddDDDDDDDk.", "kkkkkkkkkkkkkkkkkkkk"], pal: {"d": "#e8c07f", "D": "#c4955a"} },
  cactus: { rows: ["....kk....", "...kjjk...", "...kjjk.kk", "kk.kjjkkjk", "kjkkjjkjjk", "kjjjjjjjk.", ".kkkjjkk..", "...kjjk...", "...kjjk...", "...kjjk...", "..kkkkkk.."] },
  cactus_small: { rows: [".kk.", "kjjk", "kjjk", "kkkk"] },
  dune_rock: { rows: ["...kkkk...", ".kkddddkk.", "kdddddDDDk", "kkkkkkkkkk"], pal: {"d": "#d1a062", "D": "#a87a41"} },
  bones: { rows: [".n...n.", "nnnnnnn", ".n...n."] },
  snow_peak: { rows: ["..........kk..........", ".........kwwk.........", "........kwwwwk........", ".......kwwqwwqk.......", "......kwqqqwqqqk......", ".....kqqqqqqqqqQk.....", "....kqqqqqqqqqQQQk....", "...kqqqqqqqqqqQQQQk...", "..kqqqqqqqqqqqQQQQQk..", "kkkkkkkkkkkkkkkkkkkkkk"], pal: {"w": "#ffffff", "q": "#8fa8c4", "Q": "#6c84a3"} },
  snow_pine: { rows: [".......kk.......", "......kwwk......", ".....kwjjLk.....", "....kwwjjLLk....", ".....kjwjLk.....", "....kwjjjjLk....", "...kwwjjjjLLk...", "....kjjwjjLk....", "...kwjjjjjjLk...", "..kwwjjjjjjLLk..", ".kwwwwjjjjjjLLk.", ".kkkkkkddkkkkkk.", "......kddk......", "......kdDk......"], pal: {"w": "#ffffff"} },
  ice_crystal: { rows: ["..k...", ".kuk..", ".kuUk.", "kuuUk.", "kuuUUk", "kkkkkk"], pal: {"u": "#dff6ff", "U": "#8fd0ec"} },
  snow_rock: { rows: ["..kkkk..", ".kwwwwk.", "kqqqqQQk", "kkkkkkkk"], pal: {"w": "#ffffff", "q": "#9aa7b8", "Q": "#6f7c8f"} },
  dark_castle: { rows: ["..q.q......q......q.q..", "..qqq.....qqq.....qqq..", "..qQq.....qqq.....qQq..", "..qqq....qqqqq....qqq..", "..qqqq.q.qqRqq.q.qqqq..", "..qqqqqqqqqqqqqqqqqqq..", "..qqqqqqqqQQQqqqqqqqq..", "..qqqqqqqqQQQqqqqqqqq..", "qqqqqqqqqqqqqqqqqqqqqqq"], pal: {"q": "#2a1a2e", "Q": "#140c17", "R": "#ff5a4a"} },
  dead_tree: { rows: ["..k.....k...", "..dk...kd...", "...dk.kd..k.", "k...ddd..kd.", ".dk..dd.kd..", "..ddddddd...", "....dDd.....", "....dDd.....", "....dDd.....", "...ddDDd....", "..kkkkkkk..."], pal: {"d": "#5a4048", "D": "#3a2830"} },
  gravestone: { rows: ["..kkkk..", ".kqqqqk.", "kqqkkqqk", "kqkqqkqk", "kqqkkqqk", "kqqqqqQk", "kqqqqqQk", "kkkkkkkk"] },
  lava_crystal: { rows: ["..k...", ".kRk..", ".kRyk.", "kRRyk.", "kRRyyk", "kkkkkk"] },
  banner: { rows: ["kk.......", "kWkkkkkkk", "kWkBBBBBk", "kWkBBWBBk", "kWkBWWWBk", "kWkBBWBBk", "kWkBBBBBk", "kWk.kBBk.", "kWk..kk..", "kWk......", "kWk......", "kWk......", "kWk......", "kWk......", "kkk......"] },
  icon_gem: { rows: ["..kkkkk..", ".kuuwuuk.", "kuuuwuuUk", "kkkkkkkkk", ".kuuuuUk.", "..kuuUk..", "...kUk...", "....k...."], pal: {"u": "#6fd6ff", "U": "#2f8fd0"} },
  icon_ticket: { rows: ["kkkkkkkkkk", "kRRRRRRRRk", "kRwRRRRwRk", ".kRRwwRRk.", "kRwRRRRwRk", "kRRRRRRRRk", "kkkkkkkkkk"], pal: {"R": "#e8384f"} },
  icon_key: { rows: [".kkk......", "kyyyk.....", "kykykykkkk", "kyyyyyyyyk", ".kkk.kykyk", ".....k.k.k"] },
  icon_trophy: { rows: ["kkkkkkkkk", "kyyyyyyYk", "kyyyyyyYk", ".kyyyyYk.", "..kyyYk..", "...kYk...", "...kYk...", "..kyyYk..", ".kkkkkkk."] },
  icon_mail: { rows: ["kkkkkkkkkk", "kkwwwwwwkk", "kwkwwwwkwk", "kwwkwwkwwk", "kwwwkkwwwk", "kwwwwwwwwk", "kkkkkkkkkk"] },
  icon_chest: { rows: [".kkkkkkkk.", "kddddddddk", "kdDDDDDDdk", "kkkkWWkkkk", "kdddWWdddk", "kddddddddk", "kDDDDDDDDk", "kkkkkkkkkk"] },
  icon_anvil: { rows: ["kkkkkkkkkk", "kIIIIIIIIk", ".kJIIIIIJk", "..kJIIJkk.", "...kIIk...", "..kJIIJk..", ".kkkkkkkk."] },
  icon_shard: { rows: ["..k..", ".kuk.", "kuuUk", "kuUUk", ".kUk.", "..k.."], pal: {"u": "#bfe6ff", "U": "#5fa9d9"} },
  icon_essence: { rows: ["..kk..", ".kffk.", "kfwffk", "kffffk", "kfFFfk", ".kFFk.", "..kk.."], pal: {"f": "#e27bff", "F": "#9a3fc9"} },
  skill_quick: { rows: ["........kk", ".......kwk", "......kwuk", ".....kwuk.", "k...kwuk..", "kk.kwuk...", ".kkwuk....", "..kWk.....", ".kWkk.....", "kWk.kk...."], pal: {"u": "#7fc8ff"} },
  skill_whirl: { rows: ["...kkkk...", ".kkuuuukk.", "kuuk..kuuk", "ku.kkkk.uk", "ku.kwwk.uk", "ku.kkkkuuk", "kuuk...uk.", ".kkuuuukk.", "...kkkk..."], pal: {"u": "#ff7a6b"} },
  skill_cry: { rows: ["....kk....", "...kRRk...", "..kRyyRk..", ".kRyyyyRk.", "kRyyyyyyRk", "kRRyyyyRRk", ".kRRyyRRk.", "..kkRRkk..", "....kk...."] },
  skill_holy: { rows: ["....kk....", "....ky....", "..kkyykk..", "..kyyyyk..", "....yy....", "....yy....", "....yy....", "...kyyk...", "..ky..yk.."] },
  icon_tree: { rows: ["....kk....", "...kWWk...", "..k.kk.k..", ".kWk..kWk.", "..kk..kk..", ".k..kk..k.", "kWk.kWkkWk", ".k...kk.k."] },
  icon_dungeon: { rows: ["...kkkk...", "..kqqqqk..", ".kqkkkkqk.", "kqkXXXXkqk", "kqkXXXXkqk", "kqkXXXXkqk", "kqkXXXXkqk", "kkkkkkkkkk"] },
  icon_boss: { rows: ["k........k", "kk.kkkk.kk", ".kkRRRRkk.", "..kRyRyRk.", "..kRRRRRk.", "..kRwRwRk.", "...kRRRk..", "....kkk..."], pal: {"R": "#c8452a"} },
  icon_paw: { rows: [".kk..kk..", "kook.kook", ".kk..kk..", "kk.kk.kk.", "kokooko..", ".kooook..", ".kooook..", "..kkkk..."], pal: {"o": "#e09a4a"} },
  icon_summon: { rows: ["....kk....", "...kyyk...", "kkkkyykkkk", "kyyyyyyyyk", ".kyyyyyyk.", "..kyyyyk..", ".kyyk.kyk.", "kyk....kyk", "kk......kk"] },
  icon_star: { rows: ["...k...", "..kyk..", "kkkykkk", "kyyyyyk", ".kyyyk.", "kyk.kyk", "kk...kk"] },
};

export const SPRITES = {
  ...HERO_SPRITES,
  ...EXTRA_SPRITES,
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
  icon_book: {
    pal: { m: '#7a2f3a', M: '#55202a', p: '#efe3c4' },
    rows: [
      '.kkkkkkkkk..',
      'kmmmmmmmmMk.',
      'kmWWmmWWmMk.',
      'kmWmmmmWmMk.',
      'kmmmWWmmmMk.',
      'kmmmWWmmmMk.',
      'kmWmmmmWmMk.',
      'kmWWmmWWmMk.',
      'kmmmmmmmmMk.',
      'kpppppppppk.',
      '.kkkkkkkkkk.',
    ],
  },
  icon_rebirth: {
    pal: { f: '#ff8a3d', F: '#d4462a' },
    rows: [
      '.....kk.....',
      '....kyyk....',
      '...kyffyk...',
      '.k.kfFFfk.k.',
      'kyk.kffk.kyk',
      'kyfk.kk.kfyk',
      '.kyfkyykfyk.',
      '..kyFffFyk..',
      '...kyffyk...',
      '....kFFk....',
      '.....kk.....',
    ],
  },
  icon_fragment: {
    pal: { f: '#c9a6ff', F: '#8a5ad6', g: '#f2e6ff' },
    rows: [
      '...kk...',
      '..kgfk..',
      '.kgffFk.',
      'kgfffFFk',
      'kffffFFk',
      '.kfFFFk.',
      '..kFFk..',
      '...kk...',
    ],
  },
  icon_lock: {
    rows: [
      '..kkk..',
      '.kIIIk.',
      '.kI.Ik.',
      'kkkkkkk',
      'kWWkWWk',
      'kWWkWWk',
      'kYWWWYk',
      'kkkkkkk',
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
