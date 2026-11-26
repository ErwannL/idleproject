// v9.7.1 (lot 7) : fiches des GRANDS BOSS (Titans, dieux…). Une fiche = un boss complet, sans toucher au moteur :
//   art    planches d'animation (dossier, préfixe, taille d'image, ligne des pieds, filtre de couleur facultatif),
//          animations (images, cadence, images clés), points d'ancrage (yeux par image, main du jet), couleurs du rayon
//   fight  stats du moteur (boss de référence), durée, phases (seuil de vie, attaque, accélération), attaques propres
//          (annonce et parade : voir `abilities`), paliers, Éveil
//   lore, rewards, modes (histoire : face-à-face de fin de monde ; solo répétable ; commun : barre partagée)
// Moteur commun : core/world-boss.js (WorldBossFight, setup.bossId) et render/world-boss-scene.js (WorldBossScene).
// Ajouter un grand boss : docs/ajouter-contenu.md.

const COLOSSUS_ANIMS = {
  idle: { n: 8, fps: 7, loop: true }, idle3: { n: 8, fps: 9, loop: true },
  attack: { n: 9, fps: 16 }, attack3: { n: 9, fps: 18 }, hurt: { n: 9, fps: 18 },
  hurt3: { n: 9, fps: 18 }, // v9.3.0 : coup reçu de la forme de lave (phase 3)
 
  quake: { n: 9, fps: 11 }, embers: { n: 9, fps: 11 }, fury: { n: 9, fps: 12 },
  transform: { n: 13, fps: 12 }, death: { n: 13, fps: 10 }, rise: { n: 13, fps: 14, src: 'death', reverse: true },
  // v9.3.0 : jet de pierre (il arrache un rocher, le lève, le lance) et rayon des yeux (charge, faisceau, retour).
  // `durs` : durée de chaque image (s) ; `release` : image où le rocher quitte la main ; `charge` / `fire` : images
  // de la charge lumineuse et du faisceau.
  throw: { n: 13, durs: [0.07, 0.07, 0.08, 0.09, 0.12, 0.12, 0.1, 0.1, 0.24, 0.1, 0.1, 0.08, 0.08], release: 9 },
  throw3: { n: 13, durs: [0.07, 0.07, 0.08, 0.09, 0.12, 0.12, 0.1, 0.1, 0.24, 0.1, 0.1, 0.08, 0.08], release: 9 },
  beam: { n: 13, durs: [0.08, 0.08, 0.08, 0.22, 0.26, 0.1, 0.32, 0.32, 0.32, 0.1, 0.08, 0.08, 0.08], charge: [3, 4], fire: [5, 8] },
  beam3: { n: 13, durs: [0.08, 0.08, 0.08, 0.22, 0.26, 0.1, 0.32, 0.32, 0.32, 0.1, 0.08, 0.08, 0.08], charge: [3, 4], fire: [5, 8] },
};


const COLOSSUS_EYES = {
  beam: [[34, 39, 44, 38], [34, 39, 44, 38], [33, 39, 43, 38], [32, 40, 42, 39], [31, 41, 41, 40], [31, 42, 41, 41], [31, 42, 41, 41], [31, 42, 41, 41], [31, 42, 41, 41], [32, 41, 42, 40], [33, 40, 43, 39], [34, 39, 44, 38], [34, 39, 44, 38]],
  beam3: [[33, 45, 42, 45], [33, 45, 42, 45], [33, 45, 42, 45], [30, 48, 39, 48], [28, 50, 37, 50], [27, 51, 36, 51], [27, 51, 36, 51], [27, 51, 36, 51], [27, 51, 36, 51], [29, 49, 38, 49], [31, 47, 40, 47], [33, 45, 42, 45], [33, 45, 42, 45]],
};

const COLOSSUS_FIGHT = {
  boss: 'demon_king',
  name: 'Colosse des Anciens', // boss dédié (PixelLab) : render/world-boss-scene.js ; le moteur garde les stats de `boss`
  seconds: 60,
  sizeMul: 2.3, // taille à l'écran (× la taille normale du boss) ; +0,15 par phase
  // Phases : seuil de PV restants, attaque spéciale (part des PV max du héros, jamais mortelle seule), accélération.
  phases: [
    { at: 0.75, id: 'quake', name: 'Séisme infernal', hit: 0.18, speed: 1.15, power: 1.15 },
    { at: 0.5, id: 'meteors', name: 'Pluie de braises', hit: 0.24, speed: 1.3, power: 1.3 },
    { at: 0.25, id: 'fury', name: 'Fureur ancestrale', hit: 0.3, speed: 1.5, power: 1.5 },
  ],
  tiers: [0.25, 0.5, 0.75, 1], // part de la barre vidée pendant la tentative
  hitPct: 0.07, // coup ordinaire du boss : part des PV max du héros (avant armure et Défense)
  attackInterval: 2.4,
  hpFactor: 1.05, // PV du boss du jour = dégâts mesurés en 60 s × hpFactor (une bonne tentative vide la barre : Éveil)
  awaken: 1.25, // force du boss à chaque Éveil (barre vidée)
  // v9.3.0 : attaques propres au Colosse, en boucle pendant toute la tentative (retour de l'équipe : « un jet de pierre
  // et un rayon lumineux qui sort des yeux »). Dégâts : part des PV max du héros (× Éveil, jamais mortels seuls).
  // `from` : première phase où l'attaque entre dans le cycle. Cadence : `every[phase]` secondes entre deux attaques
  // (le Colosse alterne jet de pierre et rayon dès que les deux sont permis), la première à `first` s.
  abilities: [
    { id: 'boulder', name: 'Jet de pierre', hit: 0.11, from: 0 },
    { id: 'eyebeam', name: 'Rayon des Anciens', hit: 0.15, from: 1 },
  ],
  abilityFirst: 5,
  abilityEvery: [11, 9.5, 8, 6.5],
  abilityGap: 2.5, // pas d'attaque propre dans les 2,5 s qui suivent une attaque de phase ou un Éveil
};


export const GRAND_BOSSES = {
  colossus: {
    id: 'colossus', name: 'Colosse des Anciens', title: 'Le premier des Titans',
    lore: 'Il a vaincu le héros dans les ruines d\'Ascendrya. Chaque monde te rapproche de la revanche.',
    art: { dir: 'assets/world-boss', prefix: 'colossus_', frame: 128, foot: 122, anims: COLOSSUS_ANIMS, eyes: COLOSSUS_EYES,
      hands: { throw: [16, 34], throw3: [18, 44] },
      beamColors: { beam: ['#2fd8ff', '#8ff8ff', '#ffffff'], beam3: ['#ff5a1f', '#ffb04a', '#fff3c8'] } },
    fight: COLOSSUS_FIGHT,
    rewards: { gems: 50, shards: 20 },
    modes: ['story', 'solo', 'shared'],
  },
  // Boss d'essai défini par sa seule fiche (aucun code) : il reprend les planches du Colosse, teintées d'ombre.
  shade: {
    id: 'shade', name: 'Ombre du Colosse', title: 'Reflet d\'essai', test: true,
    lore: 'Une ombre du Titan, née de tes défaites. Elle sert de banc d\'essai au moteur des grands boss.',
    art: { dir: 'assets/world-boss', prefix: 'colossus_', frame: 128, foot: 122, filter: 'grayscale(1) brightness(0.55) sepia(1) hue-rotate(220deg) saturate(3)',
      anims: COLOSSUS_ANIMS, eyes: COLOSSUS_EYES, hands: { throw: [16, 34], throw3: [18, 44] },
      beamColors: { beam: ['#b04dff', '#e0a8ff', '#ffffff'], beam3: ['#ff2a8a', '#ff8ad0', '#fff0fa'] } },
    fight: { ...COLOSSUS_FIGHT, name: 'Ombre du Colosse', seconds: 45,
      phases: [{ at: 0.6, id: 'quake', name: 'Ombre tremblante', hit: 0.15, speed: 1.2, power: 1.2 }, { at: 0.3, id: 'fury', name: 'Fureur d\'ombre', hit: 0.25, speed: 1.4, power: 1.4 }],
      abilities: [{ id: 'eyebeam', name: 'Regard d\'ombre', hit: 0.12, from: 0 }] },
    rewards: { gems: 10 },
    modes: ['solo'],
  },
};
// v9.8 (H7) : Titans du jour — un par jour de la semaine (0 = dimanche), même moteur et mêmes planches que le Colosse,
// une teinte, un nom et des phases propres (fiches seules, aucun code). Ils n'entrent pas au Panthéon (titan: true).
const TITAN_ZONE = { blue: 'ocean', red: 'volcano', green: 'forest', light: 'sky', dark: 'void' };
// v10.16 : chaque Titan a SES compétences (3 attaques, 2 phases), dessinées par render/titan-skills.js.
// Chiffres repris du Colosse : attaque 1 = part du jet de pierre (0,11), attaques 2 et 3 = part du rayon (0,15) ; la 3e
// partage le tour de la 2e (`slot: 1`, voir core/world-boss.js pickAbility) : les dégâts reçus ne changent pas.
// Phases à 60 % et 30 % : 0,16 et 0,26 comme avant. `kit` = 5 × [id, nom, phrase] : 3 attaques puis les 2 phases.
const titanKit = (kit) => ({
  abilities: [
    { id: kit[0][0], name: kit[0][1], text: kit[0][2], hit: 0.11, from: 0 },
    { id: kit[1][0], name: kit[1][1], text: kit[1][2], hit: 0.15, from: 1 },
    { id: kit[2][0], name: kit[2][1], text: kit[2][2], hit: 0.15, from: 2, slot: 1 },
  ],
  phases: [
    { at: 0.6, id: kit[3][0], name: kit[3][1], text: kit[3][2], hit: 0.16, speed: 1.2, power: 1.2 },
    { at: 0.3, id: kit[4][0], name: kit[4][1], text: kit[4][2], hit: 0.26, speed: 1.45, power: 1.45 },
  ],
});
const titan = (id, element, name, title, filter, beam, kit) => ({
  id, element, name, title, titan: true, test: true, lore: `${title}. Chaque jour, un Titan différent se dresse contre Ascendrya.`,
  // v9.11 (2) : vraies planches teintées (tools/art/recolor_titans.py) au lieu d'un filtre ; décor du monde de son élément.
  zone: TITAN_ZONE[element], filterOld: filter,
  art: { dir: `assets/world-boss/${id}`, prefix: 'colossus_', frame: 128, foot: 122, anims: COLOSSUS_ANIMS, eyes: COLOSSUS_EYES,
    hands: { throw: [16, 34], throw3: [18, 44] }, beamColors: { beam: [...beam, '#ffffff'], beam3: [...beam, '#fff3c8'] } },
  fight: { ...COLOSSUS_FIGHT, name, seconds: 60, ...titanKit(kit) },
  rewards: { gems: 30 }, modes: ['solo'],
});
export const DAY_TITANS = [
  titan('titan_sun', 'light', 'Titan du Soleil', 'Titan du dimanche', 'sepia(1) saturate(4) hue-rotate(5deg) brightness(1.05)', ['#ffd23f', '#fff3a8'], [
    ['sun_lance', 'Lance solaire', 'Un javelot de lumière se plante devant le héros et éclate en croix dorée.'],
    ['sun_crown', 'Couronne de rayons', "Cinq colonnes de lumière tombent du ciel, l'une après l'autre."],
    ['sun_blind', 'Éblouissement', "Un éclair blanc aveugle toute l'équipe."],
    ['sun_rise', 'Éclat solaire', "Un soleil se lève derrière lui et le ciel passe à l'or."],
    ['sun_noon', 'Midi ardent', "Une vague de chaleur fait onduler l'air et brûle le sol."]]),
  titan('titan_moon', 'dark', 'Titan de la Lune', 'Titan du lundi', 'grayscale(1) brightness(1.15) sepia(.3) hue-rotate(180deg)', ['#c9d8ff', '#ffffff'], [
    ['moon_disc', "Disque d'argent", "Un disque pâle part en boomerang : il touche à l'aller et au retour."],
    ['moon_gaze', "Regard d'argent", "Un rayon pâle couvre l'équipe de givre."],
    ['moon_mirror', 'Reflets', 'Deux doubles transparents surgissent et frappent avec lui.'],
    ['moon_tide', 'Marée lunaire', "La nuit tombe, la lune se lève et une vague d'argent monte du sol."],
    ['moon_night', 'Nuit sans fin', "Tout s'assombrit : seuls ses yeux restent visibles, puis il frappe."]]),
  titan('titan_ember', 'red', 'Titan des Braises', 'Titan du mardi', 'sepia(1) saturate(5) hue-rotate(-25deg)', ['#ff5a1f', '#ffb04a'], [
    ['ember_bomb', 'Bombe de magma', 'Un rocher en fusion éclate en trois gouttes qui laissent des flaques de lave.'],
    ['ember_geyser', 'Geysers', "Le sol se fissure sous l'équipe, puis trois colonnes de lave jaillissent."],
    ['ember_ash', 'Souffle de cendres', "Un nuage de cendres brûlantes roule vers l'équipe."],
    ['ember_rain', 'Pluie de cendres', "Des cendres tombent jusqu'à la fin du combat."],
    ['ember_heart', 'Cœur de lave', "Son torse s'ouvre sur un cœur rougeoyant qui explose en onde de feu."]]),
  titan('titan_tide', 'blue', 'Titan des Marées', 'Titan du mercredi', 'sepia(1) saturate(4) hue-rotate(160deg)', ['#2fd8ff', '#8ff8ff'], [
    ['tide_sphere', "Sphère d'eau", 'Une bulle géante éclate en éclaboussures.'],
    ['tide_siphon', 'Siphon', 'Un tourbillon fait tourner le héros sur lui-même.'],
    ['tide_jet', 'Jet de pression', "Un trait d'eau repousse toute l'équipe."],
    ['tide_wave', 'Lame de fond', "Une vague géante traverse l'écran."],
    ['tide_abyss', 'Abysse', "L'eau monte jusqu'à mi-hauteur : le combat continue sous l'eau."]]),
  titan('titan_thorn', 'green', 'Titan des Ronces', 'Titan du jeudi', 'sepia(1) saturate(4) hue-rotate(60deg)', ['#4cd26a', '#b8ff9a'], [
    ['thorn_seed', "Graine d'épines", "La graine lancée germe en buisson d'épines devant l'équipe."],
    ['thorn_spores', 'Spores', "Un nuage vert empoisonne l'équipe."],
    ['thorn_grasp', 'Étreinte', "Des racines sortent du sol et enlacent l'équipe."],
    ['thorn_bramble', 'Ronces', 'Des lianes couvrent son corps et il grandit.'],
    ['thorn_forest', 'Forêt vivante', 'Des arbres poussent derrière lui et une haie de ronces traverse la scène.']]),
  titan('titan_storm', 'light', 'Titan de l\'Orage', 'Titan du vendredi', 'sepia(1) saturate(3) hue-rotate(200deg) brightness(1.1)', ['#9fc3ff', '#ffffff'], [
    ['storm_javelin', 'Javelot de foudre', 'Un éclair lancé en ligne droite, très rapide.'],
    ['storm_chain', "Chaîne d'éclairs", "L'éclair saute du héros à chaque compagnon."],
    ['storm_thunder', 'Tonnerre', 'Quatre éclairs tombent sur des cercles électriques.'],
    ['storm_clouds', 'Tonnerre', 'Des nuages noirs couvrent le ciel, la pluie tombe.'],
    ['storm_wrath', 'Colère du ciel', "Son corps se charge d'arcs électriques, les éclairs illuminent la scène."]]),
  titan('titan_void', 'dark', 'Titan du Néant', 'Titan du samedi', 'grayscale(1) brightness(0.6) sepia(1) hue-rotate(230deg) saturate(3)', ['#b04dff', '#e0a8ff'], [
    ['void_orb', 'Orbe du vide', 'Un petit trou noir avale la lumière puis implose.'],
    ['void_step', 'Pas du néant', 'Il disparaît en fumée violette, réapparaît plus près et frappe aussitôt.'],
    ['void_rift', 'Faille', "Une déchirure derrière l'équipe aspire tout vers elle."],
    ['void_cracks', 'Faille', 'Des fissures violettes restent ouvertes dans le décor.'],
    ['void_eclipse', 'Éclipse', 'Un soleil noir se lève, puis une déchirure traverse la cible.']]),
];
for (const t of DAY_TITANS) GRAND_BOSSES[t.id] = t;

export const grandBoss = (id) => GRAND_BOSSES[id] ?? GRAND_BOSSES.colossus;

// v10.15 : GÉANTS — de vrais nouveaux grands boss, chacun avec SA silhouette (plus des Colosses recolorés).
// Même moteur que le Colosse (core/world-boss.js, render/world-boss-scene.js) ; seules les planches changent.
//   Planches : assets/world-boss/<id>/<id>_<anim>.png, une rangée de `n` images de `frame` px (exactement `n`).
//   Minimum : idle, attack, hurt, throw (jet), beam (souffle / rayon), death. Les autres (idle3, attack3, hurt3,
//   throw3, beam3, quake, embers, transform, fury) sont facultatives : absentes, le moteur prend la plus proche
//   (render/world-boss-scene.js, ANIM_FALLBACK).
//   Attaques : `boulder` = un projectile lancé en arc (projectile propre : art.projectile), `eyebeam` = un souffle ou
//   un rayon qui part du point `eyes` (bouche, yeux, gueule) et balaie l'équipe. Phases : quake (frappe au sol),
//   meteors (pluie), fury (colère) avec les noms du géant.
//   `ready: false` tant que les planches ne sont pas dans assets/ : le géant reste hors du jeu (ni Panthéon, ni
//   rotations, ni admin). Planches posées et repères mesurés (eyes, hands) → `ready: true` ; le test
//   tests/v1015-giants.test.js vérifie alors chaque fichier.
const GIANT_ANIMS = (frame) => ({
  idle: { n: 8, fps: 8, loop: true }, idle3: { n: 8, fps: 10, loop: true },
  attack: { n: 9, fps: 16 }, attack3: { n: 9, fps: 18 }, hurt: { n: 6, fps: 16 },
  quake: { n: 9, fps: 11 }, embers: { n: 9, fps: 11 }, transform: { n: 13, fps: 12 },
  death: { n: 13, fps: 10 }, rise: { n: 13, fps: 14, src: 'death', reverse: true },
  throw: { n: 13, durs: [0.07, 0.07, 0.08, 0.09, 0.12, 0.12, 0.1, 0.1, 0.24, 0.1, 0.1, 0.08, 0.08], release: 9 },
  beam: { n: 13, durs: [0.08, 0.08, 0.08, 0.22, 0.26, 0.1, 0.32, 0.32, 0.32, 0.1, 0.08, 0.08, 0.08], charge: [3, 4], fire: [5, 8] },
  throw3: { n: 13, durs: [0.07, 0.07, 0.08, 0.09, 0.12, 0.12, 0.1, 0.1, 0.24, 0.1, 0.1, 0.08, 0.08], release: 9 },
  beam3: { n: 13, durs: [0.08, 0.08, 0.08, 0.22, 0.26, 0.1, 0.32, 0.32, 0.32, 0.1, 0.08, 0.08, 0.08], charge: [3, 4], fire: [5, 8] },
  _frame: frame,
});
// Les animations que les planches doivent fournir (les autres sont facultatives).
export const GIANT_REQUIRED_ANIMS = ['idle', 'attack', 'hurt', 'throw', 'beam', 'death'];
const GIANT_OPTIONAL = ['idle3', 'attack3', 'quake', 'embers', 'transform', 'throw3', 'beam3'];
// `extra` : planches facultatives posées (les autres sont retirées : une animation déclarée sans fichier rendrait le géant
// invisible) ; `from` : premier mois ('AAAA-MM') où le géant peut entrer dans une Fête ; `eyes`, `hands`, `box`, `shadow` :
// repères mesurés sur les planches (remplacent les valeurs provisoires).
const giant = ({ id, name, title, lore, element, zone, mapZone, accent, frame = 160, beam, projectile, debris = null, phases, abilities, ready = false, extra, from, eyes, hands, box, shadow, dx, marks = {} }) => {
  const anims = GIANT_ANIMS(frame);
  delete anims._frame;
  if (extra) for (const k of GIANT_OPTIONAL) { if (!extra.includes(k)) delete anims[k]; else anims[k] ??= { ...anims[k.replace('3', '')] }; }
  return {
    id, name, title, lore, element, zone, mapZone, accent, giant: true, ready, from, extra,
    art: { dir: `assets/world-boss/${id}`, prefix: `${id}_`, frame, foot: frame - 6, exactSheets: true, anims,
      // Repères à mesurer sur les planches finies (pixels de l'image) : `eyes.beam` = 13 × [x1, y1, x2, y2] (bouche :
      // deux fois le même point), `hands.throw` = point d'où part le projectile à l'image `release`.
      eyes: eyes ?? { beam: Array.from({ length: 13 }, () => [Math.round(frame * 0.22), Math.round(frame * 0.3), Math.round(frame * 0.22), Math.round(frame * 0.3)]) },
      hands: hands ?? { throw: [Math.round(frame * 0.15), Math.round(frame * 0.3)] },
      beamColors: { beam: [...beam, '#ffffff'], beam3: [...beam, '#fff3c8'] },
      projectile, debris,
      box: box ?? [frame * 0.06, frame * 0.08, frame * 0.88, frame * 0.88], ...(shadow ? { shadow } : {}), ...(dx ? { dx } : {}), ...marks },
    fight: { ...COLOSSUS_FIGHT, name,
      phases: [
        { at: 0.75, id: 'quake', name: phases[0], hit: 0.18, speed: 1.15, power: 1.15 },
        { at: 0.5, id: 'meteors', name: phases[1], hit: 0.24, speed: 1.3, power: 1.3 },
        { at: 0.25, id: 'fury', name: phases[2], hit: 0.3, speed: 1.5, power: 1.5 },
      ],
      abilities: [{ id: 'boulder', name: abilities[0], hit: 0.11, from: 0 }, { id: 'eyebeam', name: abilities[1], hit: 0.15, from: 1 }] },
    rewards: { gems: 60, shards: 25 },
    modes: ['solo', 'shared'],
  };
};

// v10.15 : repères du Léviathan, mesurés sur ses planches (assets/world-boss/leviathan/, tools/art/pl1015_leviathan.py).
// Souffle et jet partent de la gueule ; il a les planches facultatives idle3, attack3, hurt3, throw3, beam3, quake, embers, transform.
const leviathan = (g) => {
  const m = (pts) => pts.map(([x, y]) => [x, y, x, y]); // bouche : deux fois le même point
  const A = g.art.anims;
  A.hurt3 = { n: 6, fps: 16 };
  A.throw3 = { ...A.throw };
  A.beam3 = { ...A.beam };
  g.art.eyes.beam = m([[36, 60], [33, 52], [52, 48], [50, 45], [52, 45], [48, 42], [20, 58], [14, 62], [14, 65], [13, 62], [25, 60], [34, 62], [36, 60]]);
  g.art.eyes.beam3 = m([[36, 58], [46, 48], [48, 47], [50, 48], [34, 56], [22, 60], [20, 60], [20, 62], [15, 62], [20, 62], [20, 62], [30, 60], [36, 58]]);
  g.art.hands = { throw: [12, 66], throw3: [14, 68] };
  g.art.box = [6, 10, 152, 138];
  g.art.shadow = 56;
  g.extra = ['idle3', 'attack3', 'hurt3', 'throw3', 'beam3', 'quake', 'embers', 'transform'];
  g.from = '2027-08'; // 1er géant : août 2027 (festBoss)
  return g;
};

// Arbre-Monde : points de départ du rayon (yeux gauche et droit) sur chaque image de `beam` et `beam3`, mesurés sur les planches.
const EYES_TREANT = [[83, 86, 93, 86], [85, 80, 96, 80], [88, 74, 98, 74], [86, 71, 99, 71], [86, 71, 99, 71], [86, 72, 99, 72], [86, 73, 99, 73], [86, 74, 99, 74], [86, 75, 99, 75], [88, 76, 98, 76], [86, 80, 96, 80], [84, 84, 94, 84], [83, 86, 93, 86]];
const EYES_TREANT3 = [[77, 93, 87, 93], [76, 92, 87, 92], [72, 86, 85, 86], [75, 87, 87, 87], [74, 88, 86, 88], [74, 88, 86, 88], [70, 90, 80, 90], [74, 88, 86, 88], [67, 91, 79, 91], [68, 93, 80, 93], [66, 94, 79, 94], [66, 96, 76, 96], [77, 93, 87, 93]];

export const GIANTS = [
  // v10.16 : décor du Royaume englouti (ocean), en combat comme sur la Carte de la fête.
  leviathan(giant({ id: 'leviathan', name: 'Léviathan des Abysses', title: 'Le Titan des Abysses', element: 'blue', zone: 'ocean', mapZone: 10, accent: '#2fb8ff', ready: true,
    lore: 'Un serpent de mer aussi long qu\'une côte. Quand il remonte, la mer recule.',
    beam: ['#2fd8ff', '#8ff8ff'], projectile: { vfx: 'wb_boulder', tint: '#3fa8ff', tint3: '#8ff8ff', size: 2.4, spin: 4, dust: ['#2f6f9a', '#9fe8ff'] },
    phases: ['Lame de fond', 'Tourbillon', 'Colère des profondeurs'], abilities: ['Bulle des abysses', 'Jet abyssal'] })),
  // Planches posées (PixelLab), repères mesurés : la fiche est complétée ici (planches facultatives, souffle et jet de la phase 3).
  ((g) => ({ ...g, from: '2027-10', extra: ['idle3', 'attack3', 'throw3', 'beam3', 'quake', 'embers', 'transform'],
    art: { ...g.art, box: [8, 20, 128, 118], shadow: 54,
      anims: { ...g.art.anims, throw3: { ...g.art.anims.throw }, beam3: { ...g.art.anims.beam } },
      eyes: {
        beam: [[10, 54, 10, 54], [16, 51, 16, 51], [20, 50, 20, 50], [21, 50, 21, 50], [21, 50, 21, 50], [12, 56, 12, 56], [10, 60, 10, 60], [10, 60, 10, 60], [9, 60, 9, 60], [9, 60, 9, 60], [8, 58, 8, 58], [9, 57, 9, 57], [10, 56, 10, 56]],
        beam3: [[11, 58, 11, 58], [15, 52, 15, 52], [18, 50, 18, 50], [21, 51, 21, 51], [21, 51, 21, 51], [10, 58, 10, 58], [10, 66, 10, 66], [9, 66, 9, 66], [9, 68, 9, 68], [9, 66, 9, 66], [10, 68, 10, 68], [14, 64, 14, 64], [14, 68, 14, 68]],
      },
      hands: { throw: [16, 58], throw3: [15, 60] } } }))(giant({ id: 'dragon_mother', name: 'Mère des Dragons', title: 'Reine des ailes de feu', element: 'red', zone: 'volcano', mapZone: 8, accent: '#ff4a2a', frame: 144, ready: true,
    lore: 'Chaque dragon d\'Ascendrya est sorti d\'un de ses œufs. Elle vient reprendre ses enfants.',
    beam: ['#ff5a1f', '#ffb04a'], projectile: { vfx: 'wb_boulder', tint: '#ff6a2a', tint3: '#ffd23f', size: 2.2, spin: 6, dust: ['#5a2a1a', '#ff8a3d'] },
    phases: ['Battement d\'ailes', 'Pluie de feu', 'Brasier royal'], abilities: ['Boule de feu', 'Souffle ardent'] })),
  giant({ id: 'storm_god', name: 'Dieu de l\'Orage', title: 'Celui qui forge la foudre', element: 'light', zone: 'sky', mapZone: 7, accent: '#9fc3ff', frame: 160,
    lore: 'Un géant de nuages et de bronze. Son marteau fait tomber la pluie sur trois royaumes.',
    beam: ['#9fc3ff', '#ffffff'], projectile: { vfx: 'wb_boulder', tint: '#c9d8ff', tint3: '#ffe24a', size: 2.4, spin: 12, dust: ['#56607a', '#e0eaff'] },
    phases: ['Tonnerre', 'Pluie d\'éclairs', 'Colère du ciel'], abilities: ['Marteau-tonnerre', 'Foudre divine'],
    // v10.15 : planches PixelLab posées et repères mesurés (tools/art/pl1015_storm_god.py). `from` : 3e géant, Fête de décembre 2027.
    extra: ['idle3', 'attack3', 'throw3', 'beam3', 'quake', 'embers', 'transform'], from: '2027-12', ready: true,
    marks: { eyes: { beam: [[60, 46, 65, 46], [74, 44, 79, 44], [83, 47, 88, 47], [84, 47, 90, 47], [80, 47, 85, 47], [77, 47, 82, 47], [59, 48, 64, 48], [56, 50, 62, 50], [52, 50, 57, 50], [57, 50, 62, 50], [55, 53, 60, 53], [56, 52, 62, 52], [59, 47, 64, 47]],
      beam3: [[62, 48, 67, 48], [74, 44, 79, 44], [81, 46, 86, 46], [84, 46, 90, 46], [78, 47, 83, 47], [74, 46, 79, 46], [64, 48, 69, 48], [62, 50, 67, 50], [61, 51, 66, 51], [59, 53, 64, 53], [59, 51, 64, 51], [62, 50, 67, 50], [62, 48, 67, 48]] },
      hands: { throw: [7, 88], throw3: [17, 100] }, box: [10, 32, 106, 122], shadow: 39 } }),
  (() => { // planches PixelLab posées (assets/world-boss/hydra), repères mesurés ; 4e géant : Fête de février 2028 (festBoss)
    const g = giant({ id: 'hydra', name: 'Hydre des Marais', title: 'Les cinq têtes du marais', element: 'green', zone: 'swamp', mapZone: 6, accent: '#7be36a',
      lore: 'Coupe une tête, deux repoussent. Le marais tout entier respire avec elle.',
      beam: ['#7be36a', '#d8ff9a'], projectile: { vfx: 'wb_boulder', tint: '#7be36a', tint3: '#d8ff4a', size: 2, spin: 3, dust: ['#3a5a2a', '#a8e05a'] }, debris: '#4a6a3a',
      phases: ['Morsures', 'Pluie d\'acide', 'Cinq têtes'], abilities: ['Crachat d\'acide', 'Souffle putride'],
      ready: true, from: '2028-02', extra: ['idle3', 'attack3', 'throw3', 'beam3', 'quake', 'embers', 'transform'], box: [4, 12, 154, 140], shadow: 60,
      eyes: { beam: [[28, 54, 28, 54], [28, 54, 28, 54], [32, 46, 32, 46], [34, 44, 34, 44], [34, 46, 34, 46], [32, 50, 32, 50], [31, 47, 31, 47], [31, 50, 31, 50], [33, 48, 33, 48], [30, 53, 30, 53], [28, 55, 28, 55], [30, 50, 30, 50], [30, 50, 30, 50]],
        beam3: [[28, 55, 28, 55], [28, 55, 28, 55], [32, 52, 32, 52], [47, 45, 47, 45], [48, 45, 48, 45], [47, 42, 47, 42], [50, 38, 50, 38], [35, 50, 35, 50], [38, 58, 38, 58], [30, 52, 30, 52], [22, 55, 22, 55], [22, 52, 22, 52], [22, 52, 22, 52]] },
      hands: { throw: [10, 60], throw3: [18, 66] } });
    g.art.beamColors.beam3 = ['#ff7a1f', '#ffc04a', '#fff3c8']; // phase 3 : souffle de braise
    g.art.scale = 0.85; // très large (155 px sur 160) : un peu plus petit que sa planche, pour rester dans le cadre en phase 3
    return g;
  })(),
  (() => { const g = giant({ id: 'sand_wyrm', name: 'Ver des Sables colossal', title: 'Le dévoreur des dunes', element: 'red', zone: 'desert', mapZone: 3, accent: '#e0b15a',
    lore: 'Il nage sous les dunes. Une caravane entière a disparu dans sa gueule.',
    beam: ['#e0b15a', '#fff0b8'], projectile: { vfx: 'wb_boulder', tint: '#d8a85a', tint3: '#ff8a3d', size: 2.6, spin: 8, dust: ['#a07a3a', '#f0d08a'] }, debris: '#c8a060',
    phases: ['Dunes mouvantes', 'Tempête de sable', 'Gueule béante'], abilities: ['Rocher des dunes', 'Souffle de sable'], ready: true });
    // Planches PixelLab posées (assets/world-boss/sand_wyrm/) : throw3 et beam3 en plus, repères mesurés sur les images
    // (gueule : deux fois le même point), entrée en Fête à partir d'avril 2028 (5e géant : août 2027 + 8 mois).
    g.extra = ['throw3', 'beam3'];
    g.from = '2028-04';
    g.art.anims.throw3 = { ...g.art.anims.throw };
    g.art.anims.beam3 = { ...g.art.anims.beam };
    g.art.eyes.beam = [[40, 55, 40, 55], [37, 51, 37, 51], [34, 44, 34, 44], [32, 43, 32, 43], [27, 44, 27, 44], [24, 44, 24, 44], [21, 47, 21, 47], [19, 49, 19, 49], [20, 50, 20, 50], [22, 49, 22, 49], [27, 52, 27, 52], [34, 55, 34, 55], [40, 55, 40, 55]];
    g.art.eyes.beam3 = [[34, 77, 34, 77], [33, 64, 33, 64], [26, 59, 26, 59], [31, 59, 31, 59], [27, 62, 27, 62], [20, 61, 20, 61], [19, 64, 19, 64], [24, 66, 24, 66], [21, 72, 21, 72], [17, 71, 17, 71], [19, 73, 19, 73], [30, 73, 30, 73], [34, 77, 34, 77]];
    g.art.hands = { throw: [22, 61], throw3: [20, 73] };
    g.art.box = [4, 30, 133, 123];
    g.art.shadow = 58;
    return g; })(),
  giant({ id: 'frost_giant', name: 'Jarl du Givre', title: 'Roi des géants des glaces', element: 'blue', zone: 'mountains', mapZone: 4, accent: '#8fe4ff', frame: 160,
    lore: 'Il dort sous le glacier depuis mille hivers. Son réveil gèle les rivières.',
    beam: ['#8fe4ff', '#ffffff'], projectile: { vfx: 'wb_boulder', tint: '#bfefff', tint3: '#ffffff', size: 2.6, spin: 7, dust: ['#6a8aa0', '#e8f8ff'] }, debris: '#d8f0ff',
    phases: ['Avalanche', 'Grêle', 'Hiver éternel'], abilities: ['Bloc de glace', 'Souffle glacial'],
    // planches PixelLab posées (assets/world-boss/frost_giant), repères mesurés ; 6e géant : Fête de juin 2028 (festBoss)
    ready: true, from: '2028-06', extra: ['idle3', 'attack3', 'throw3', 'beam3', 'quake', 'embers'], box: [10, 20, 128, 134], shadow: 56, dx: 66,
    eyes: { beam: [[76, 38, 76, 38], [88, 32, 88, 32], [100, 31, 100, 31], [104, 32, 104, 32], [100, 32, 100, 32], [38, 62, 38, 62], [38, 62, 38, 62], [38, 62, 38, 62], [38, 62, 38, 62], [38, 60, 38, 60], [45, 52, 45, 52], [63, 47, 63, 47], [78, 40, 78, 40]],
      beam3: [[80, 44, 80, 44], [88, 36, 88, 36], [104, 30, 104, 30], [106, 30, 106, 30], [101, 30, 101, 30], [48, 60, 48, 60], [48, 58, 48, 58], [46, 58, 46, 58], [47, 58, 47, 58], [47, 58, 47, 58], [48, 60, 48, 60], [56, 55, 56, 55], [77, 46, 77, 46]] },
    hands: { throw: [8, 78], throw3: [6, 100] } }),
  giant({ id: 'elder_treant', name: 'Arbre-Monde', title: 'Le plus vieux des sylvains', element: 'green', zone: 'forest', mapZone: 1, accent: '#63d98a', frame: 192,
    lore: 'Une forêt entière sur ses épaules. Il ne se lève que si les bois sont menacés.',
    beam: ['#b8ff6a', '#f0ffc8'], projectile: { vfx: 'wb_boulder', tint: '#8a6a3a', tint3: '#b8ff6a', size: 2.6, spin: 5, dust: ['#5a4a2a', '#7bc85a'] }, debris: '#5aa04a',
    phases: ['Racines', 'Pluie de feuilles', 'Colère de la forêt'], abilities: ['Souche lancée', 'Rayon de sève'],
    // planches PixelLab posées (assets/world-boss/elder_treant, 192 px), repères mesurés ; 7e géant : Fête d'août 2028 (festBoss)
    ready: true, from: '2028-08', extra: ['idle3', 'attack3', 'throw3', 'beam3', 'quake', 'embers', 'transform'],
    hands: { throw: [12, 106], throw3: [18, 118] }, eyes: { beam: EYES_TREANT, beam3: EYES_TREANT3 }, box: [10, 8, 172, 178], shadow: 62, dx: 34,
    marks: { scale: 0.8, beamColors: { beam: ['#b8ff6a', '#f0ffc8', '#ffffff'], beam3: ['#ff8a2a', '#ffd23f', '#fff3c8'] } } }),
  (() => { const g = giant({ id: 'void_maw', name: 'Dévoreur du Néant', title: 'La gueule entre les étoiles', element: 'dark', zone: 'void', mapZone: 9, accent: '#b04dff',
    lore: 'Une bouche sans fond, des yeux par centaines. Il a déjà mangé un monde.',
    beam: ['#b04dff', '#e0a8ff'], projectile: { vfx: 'wb_boulder', tint: '#8a3dff', tint3: '#ff4ad8', size: 2.2, spin: 10, dust: ['#3a1a5a', '#c08aff'] }, debris: '#6a3aa0',
    phases: ['Faille', 'Pluie d\'étoiles', 'Éclipse totale'], abilities: ['Orbe du Néant', 'Regard des mille yeux'] });
    // Planches PixelLab posées (assets/world-boss/void_maw/) et repères mesurés dessus.
    g.ready = true;
    g.from = '2028-10'; // 8e géant : août 2027 + 2 mois par rang (festBoss) ; jamais pendant une fête en cours
    Object.assign(g.art.anims, {
      throw3: { ...g.art.anims.throw }, beam3: { ...g.art.anims.beam },
    });
    g.art.anims.attack3 = { n: 9, fps: 18 };
    g.art.extra = ['idle3', 'attack3', 'throw3', 'beam3', 'quake', 'embers', 'transform'];
    // Souffle : le grand œil de la tête (x1, y1) et le coin de la gueule (x2, y2), qui suivent la tête image par image.
    const eyeBeam = [[43, 57, 36, 77], [43, 57, 36, 77], [42, 57, 35, 78], [42, 57, 34, 80], [41, 57, 34, 82], [41, 57, 34, 84], [43, 58, 35, 84], [43, 58, 35, 84], [43, 58, 35, 84], [43, 58, 35, 84], [43, 57, 35, 80], [43, 57, 36, 78], [43, 57, 36, 77]];
    g.art.eyes = { beam: eyeBeam, beam3: eyeBeam };
    g.art.hands = { throw: [26, 90], throw3: [26, 90] };
    g.art.box = [10, 4, 140, 148]; g.art.shadow = 60; g.art.dx = 14; // dx : décalage à gauche, pour que la forme de colère (× 1,33) reste dans le cadre
    return g; })(),

];
for (const g of GIANTS) if (g.ready) GRAND_BOSSES[g.id] = g;
// Géants prêts (planches posées), dans l'ordre de leur arrivée dans les Fêtes (data/fest.js, festBoss).
export const READY_GIANTS = GIANTS.filter((g) => g.ready).map((g) => g.id);
export const GIANT_ORDER = GIANTS.map((g) => g.id);
// Grands boss que l'admin peut programmer (catalogue live) : fiches complètes, Titans du jour et géants prêts.
export const GRAND_BOSS_IDS = Object.keys(GRAND_BOSSES);
