// Rendu de la scène de combat sur un canvas basse résolution agrandi en « pixel perfect ».
// Le rendu lit l'état de la simulation et ses événements ; il ne modifie jamais la partie.
import { SKILLS } from '../data/skills.js'; // v9.9 (K11)
import { awakenedSkill } from '../core/companions.js'; // v9.9 (K17)
import { ELEMENTS, unitElement } from '../core/elements.js';
import { t as tr } from '../i18n/i18n.js'; // v9.7.1 : noms de compétences traduits
import { mutationById } from '../core/mutations.js';
import { auraColors } from '../data/auras.js';
import { BALANCE } from '../data/balance.js';
import { drawTeamFx } from './team-fx.js';
import { installClassFx } from './class-fx.js';
import { installMutationFx, tooShort } from './mutation-fx.js'; // v9.2.3 : ennemis mutés lisibles
import { MUTATION_PACE, SHEEN_STEPS, mutatedCanvas, mutationSize } from './mutation-look.js'; // v9.2.3 : apparence des mutations
import { installTraversalFx } from './traversal-fx.js'; // v9.2.1 : déplacement propre à chaque monde
import { DRAWN_TRAIL, HURT_COOLDOWN, HURT_TIME, armSwing, attackCurve, dissolveFrames, pickAnimFrame } from './enemy-anim.js';
import { animBoxes, animStride, anchorOffset, boxOf, groundLegs, QUADRUPEDS as LEG_GROUNDED } from './enemy-anchor.js'; // v9.2.5 : calage des images dessinées
import { BREATH_START, CAST_RELEASE, breathSafeAnims, drawBreath, drawOrbGlow, headMouth, powerOf, powerPointsOf } from './enemy-fx.js'; // v9.2.3
import { HERO_HEIGHT, sizeFactor, visibleSize } from '../data/enemy-sizes.js'; // v9.2.3 : table d'échelle (v9.2.4 : taille visible)
import { ENEMY_ANIMS } from './art-anim.js'; // v9.2.3 : bat, harpy, skeleton dessinés image par image
import { enemyExtraReady } from './sprites.js'; // v9.7.1 (lot C) : animations chargées à la demande
enemyExtraReady.then((extra) => { if (extra) for (const [k, v] of Object.entries(extra)) Object.assign((ENEMY_ANIMS[k] ??= {}), v); });
import { ARRIVE_SECONDS_BY_MODE, arrivalPose, arrivalProgress } from './arrival.js'; // v9.2.2 : arrivée des ennemis
import { arrivalFor, WINGED_LANDERS } from '../data/arrivals.js';
import { drawArrivalFx } from './arrival-fx.js'; // v9.2.2 : sol qui se fend, portail
import { WING_LIFT, floatDraw, wingFrames, wingPose, wingRig } from './wings.js'; // v9.2.2 : ailes, ondulation
import { elementOfColor, installElementFx } from './element-fx.js';
import { BOSSES, ENEMIES } from '../data/enemies.js';
import { RARITIES } from '../data/items.js';
import { ZONES } from '../data/zones.js';
import { currentEncounter } from '../core/combat.js';
import { companionById, equippedCompanions } from '../core/companions.js';
import { COMPANION_RULES } from '../data/companions.js';
import { formatNumber } from '../core/format.js';
import { activeHero } from '../core/heroes.js';
import { activeClass } from '../core/classes.js';
import { BG } from './bg.js';
import { waterAccent } from './water-fx.js'; // v9.2.1
import { addBubble, drawOceanBack, drawOceanFront, kickFrame, STROKE, strokeStep, swimDraw, swimFloat, swimPose, swirl, SWIM_DEPTH, SWIM_TILT } from './ocean-fx.js'; // v9.2.0 (monde marin)
import { FONT_BIG, SPRITES } from './sprites.js';
import { drawHeroPick } from './hero-draw.js'; // v9.2.5 : arme tenue (poing sur la poignée)
import { HERO_ANCHOR, SWIM_AXIS, SWIM_BODY, drawBigText, heroAnimCanvas, heroBackWeapon, heroComposite, heroSwim, itemDropCanvas, knightGearCanvas, spriteCanvas, textWidth } from './pixel.js';
import { ALLY_ANIMS, KNIGHT_NECK, KNIGHT_PIVOT, heroAnimKey, heroWearsGear, knightHead, loopFrame, pickAllyAnim, pickHeroAnim } from './ally-anim.js'; // v9.2.3 : alliés animés (PixelLab)
import { itemBase } from '../core/loot.js';
import { castHeroSkill, castUnitSkill, drawSkillFx, fxContext, heroGesturePick, unitGesture } from './skill-fx.js'; // v9.2.5 : gestes et effets de compétence
import { companionSkillList } from '../data/companion-skills.js';
import { COMPANION_ROLES } from '../data/synergies.js';
import { drawWorldVfx, eventVfx } from './vfx-world.js'; // v9.2.6 : compétences, boss, environnement, mutations, ambiance
import { weaponFx } from '../data/weapon-fx.js'; // v9.3.2 : effets d'arme selon la rareté
import { DAMAGE_COLORS, drawDamageText, drawVfx, drawVfxFrame, projFrame, vfx, vfx2Ready, vfxReady } from './vfx.js'; // v9.2.6 : effets de combat PixelLab
import { unitGear } from '../core/companion-gear.js'; // v9.3.3 : halo d'équipement
// v9.2.9 : toiles de travail relues par getImageData : mémoire côté processeur (avertissement Chrome « willReadFrequently »).
const RF = { willReadFrequently: true };

// Vue resserrée : le chevalier (≈ 40 px) occupe un bon tiers de la hauteur de la scène.
export const MIN_VIEW_HEIGHT = 96;
const GROUND_DEPTH = 18; // hauteur du sol sous la ligne des pieds
// Hauteur logique maximale : les plus hauts calques peints (forêt, piliers, forge : 322 px posés à 320 px
// au-dessus du sol) doivent toucher le haut de la scène. Au-delà, on zoome au lieu de montrer leur bord
// coupé net (arbres « tranchés » dans une fenêtre haute, v9.1.3).
export const MAX_VIEW_HEIGHT = 320 + GROUND_DEPTH;
const TALL_VIEW_WIDTH = 240; // v9.7.1 : largeur logique d'une scène haute de téléphone (150 → 240)
// v9.7.1 : cadrage par la taille du héros : le chevalier (≈ 66 px) fait ≈ 15 % de la hauteur de scène.
const HERO_PX = 66; // silhouette mesurée (casque et panache compris)
const HERO_FRAC = 0.15;
const AUTO_MAX_SCALE = 4;
// v9.7.1 : Paramètres > Interface > Taille des personnages (multiplicateur de l'échelle automatique).
const SIZE_PREFS = { auto: 1, small: 0.8, medium: 1.15, large: 1.35 };
// v9.7.1 : écartement à l'affichage autour du héros (distance d'arrêt et file d'ennemis plus aérées).
const SPREAD = 1.9;
// Les positions de la simulation (BALANCE.world) sont agrandies à l'affichage pour
// s'accorder aux sprites v5, plus détaillés ; la simulation elle-même ne change pas.
export const WORLD_SCALE = 1.5;
// Durée de l'attaque d'un compagnon (préparation puis coup).
// v9.0.8 : façon de combattre de chaque compagnon (le reste se bat au corps à corps) et durée de chaque geste.
import { ALLY_STYLE, basicKind, handOf } from '../data/ally-style.js'; // v9.7.1 : partagé avec la simulation (attaque de base)
// v9.7.1 (lot A) : gestes un peu plus longs — avec l'attaque de base (1,25 à 1,5 s), un compagnon agit ≈ 60 % du temps.
const ALLY_GESTURE_TIME = { melee: 0.85, archer: 0.85, cast: 0.95, support: 0.95, burst: 0.95 };
const CAST_ORB = {
  fire: ['fx_fireball1', 'fx_fireball2'], frost: ['fx_frost1', 'fx_frost2'], arcane: ['fx_soul1', 'fx_soul2'],
  nature: ['fx_spark'], holy: ['fx_spark'],
};
const SUPPORT_COLOR = { heal: '#7dff9a', shield: '#7fc8ff', rally: '#ffd23f', gold: '#ffe08a' };

// Durée de vie d'un objet tombé : saut, repos au sol, puis aspiration vers le chevalier.
const LOOT_LIFE = 4;
// v9.7.1 (lot C) : durées des poses dessinées « compétence » et « annonce » des boss.
const SKILL_TIME = 0.9, TELE_TIME = 0.8;

// Aura des boss par rang (mini, moyen, dur, méga).
const BOSS_AURAS = {
  berserk: { color: '#ff0030', ember: '#1a0008', width: 3, alpha: 0.6, speed: 10, embers: 0.5 },
  mini: { color: '#ffb050', ember: '#ffe08a', width: 1, alpha: 0.35, speed: 4, embers: 0 },
  mid: { color: '#ff4d6d', ember: '#ffb0a8', width: 1, alpha: 0.45, speed: 5, embers: 0.05 },
  hard: { color: '#ff4dd2', ember: '#ffc0f0', width: 2, alpha: 0.4, speed: 6, embers: 0.15 },
  mega: { color: '#ff2020', ember: '#ffd23f', width: 2, alpha: 0.55, speed: 7, embers: 0.35 },
  dungeon: { color: '#b04dff', ember: '#e8c0ff', width: 2, alpha: 0.55, speed: 6, embers: 0.3 }, // v9.0.4 : boss de donjon
};
import { BEHAVIORS } from '../data/behaviors.js'; // v9.6.0
const HERO_X = BALANCE.world.heroX * WORLD_SCALE;
// v9.5.1 : couleur de la barre de vie des monstres selon leur élément (lisible sur le décor).
const ELEMENT_BAR = { red: '#ff5a3c', blue: '#3ca8ff', green: '#4cd26a', light: '#ffd84a', dark: '#b07bff' };

// Particules d'ambiance par zone, sur deux profondeurs (derrière et devant les personnages) :
// elles défilent avec la parallaxe et donnent de la vie au décor même quand le chevalier se bat.
const AMBIENT = {
  plains: { colors: ['#fff6b0', '#ffffff', '#c8f08a'], count: 14, vx: -6, vy: -3, wobble: 6, size: 1, birds: { n: 3, color: '#2a2a3a', size: 1 } }, // pollen + v9.2.7 : vol d'oiseaux
  forest: { colors: ['#e8ff7a', '#b8ff6a', '#fff6a0'], count: 16, vx: -2, vy: -2, wobble: 10, size: 1, glow: true }, // lucioles
  caves: { colors: ['#9fe8ff', '#e0a8ff', '#ffffff'], count: 10, vx: 0, vy: -2, wobble: 2, size: 1, glow: true, shape: 'sparkle', back: true }, // v9.2.7 : étincelles en croix, derrière seulement
  desert: { colors: ['#ffe2a8', '#f4c27a'], count: 22, vx: -70, vy: 0, wobble: 1, size: 1, shape: 'streak', low: 46, birds: { n: 2, color: '#3a1a10', size: 2, circle: true } }, // v9.2.7 : sable rasant + vautours
  mountains: { colors: ['#ffffff', '#e6f2ff'], count: 26, vx: -10, vy: 14, wobble: 8, size: 1, birds: { n: 1, color: '#2a2a3a', size: 2, circle: true } }, // neige + v9.2.7 : aigle
  cursed: { colors: ['#ff8a3a', '#ffcc4a', '#ff5a2a'], count: 18, vx: -3, vy: -12, wobble: 5, size: 1, glow: true }, // braises
  swamp: { colors: ['#b8ff6a', '#7adf5a', '#d8ff9a'], count: 16, vx: -2, vy: -3, wobble: 9, size: 1, glow: true }, // spores
  sky: { colors: ['#ffffff', '#fff2c0', '#d8eeff'], count: 14, vx: -16, vy: -1, wobble: 4, size: 1, birds: { n: 4, color: '#ffffff', size: 1 } }, // plumes, vent + v9.2.7 : oiseaux blancs
  volcano: { colors: ['#ff6a2a', '#ffb43a', '#ff3a1a'], count: 24, vx: -4, vy: -16, wobble: 4, size: 1, glow: true }, // braises
  void: { colors: ['#c9a6ff', '#7fd4ff', '#ffffff'], count: 20, vx: -1, vy: -2, wobble: 12, size: 1, glow: true }, // poussière d'étoiles
  abyss: { colors: ['#ff3a3a', '#ff8a3a', '#7a1a2a'], count: 22, vx: -2, vy: -10, wobble: 6, size: 1, glow: true }, // cendres rouges
  ocean: { colors: ['#9fe8ff', '#d8fbff', '#5ab8d8'], count: 18, vx: -1, vy: -10, wobble: 6, size: 1, shape: 'bubble' }, // v9.2.7 : bulles qui montent ; v9.2.0 : particules en suspension
};

// Calques de décor (PNG générés par tools/art/scenery.py), chargés à la demande.
const layers = new Map();
function layer(file) {
  let img = layers.get(file);
  if (!img) {
    img = new Image();
    img.onerror = () => { img.failed = true; };
    img.src = `assets/bg/${file}`;
    layers.set(file, img);
  }
  return img.complete && !img.failed && img.naturalWidth > 0 ? img : null;
}
const MAX_FLOATING_TEXTS = 3; // v9.8 (E1) : 3 chiffres à la fois au plus (ils cachaient les personnages)
// v9.2.6 : projectiles dessinés par PixelLab (boucles animées) à la place des anciens sprites fixes.
const PROJ_VFX = { fx_arrow: 'proj_arrow', fx_arrow_fire1: 'proj_fireball', fx_fireball1: 'proj_fireball', fx_soul1: 'proj_soul', fx_meteor: 'proj_fireball' };
// v9.2.7 : couleur de la traînée de frappe selon la rareté de l'arme.
const TRAIL_COLORS = { common: '#dfe8f0', uncommon: '#8af07a', rare: '#6ab8ff', epic: '#c87aff', legendary: '#ffc23a', mythic: '#ff5a6a' };
const FLYING_PETS = new Set(['owl', 'fairy', 'wisp', 'dragonling', 'phoenix']);
// v9.3.3 : familiers dont le dessin regarde vers la gauche : retournés pour faire face aux ennemis comme les autres.
const LEFT_FACING_PETS = new Set(['phoenix']); // v9.2.9 : + dragonnet et phénix (ailés)
// v9.2.7 : volant ou marcheur, sans entre-deux. Les robes longues (« glide ») qui ont un vrai cycle de marche
// PixelLab marchent, pieds au sol ; seuls les volants (ailes) flottent, avec ombre et sans cycle de pas.
// v9.2.7 : un ennemi ailé qui ne se pose pas (phénix, valkyrie…) mais hérite d'une base marcheuse vole vraiment :
// hauteur de vol propre (10 px), ombre, aucun pas — avant, il battait des ailes les pieds au sol.
const airCache = new Map();
export function airDef(type, boss, def) {
  if (def.flyHeight) return def;
  const key = `${boss ? 'b' : 'e'}:${type}`;
  let d = airCache.get(key);
  if (!d) {
    const a = arrivalFor(type, boss);
    const winged = a.mode === 'fly' && a.style === 'wings' && !WINGED_LANDERS.has(type);
    d = winged ? { ...def, flyHeight: 10 } : def;
    airCache.set(key, d);
  }
  return d;
}
export function allyGait(sprite) {
  const g = SPRITES[sprite]?.gait;
  return g === 'glide' && ALLY_ANIMS[sprite]?.walk ? 'walk' : g;
}
const STALE_EVENT_SECONDS = 1.5;
const HERO_FADE = 0.07; // v9.2.4 : fondu marche -> frappe (s)
const ATTACK_TIME = 0.3; // durée de l'animation d'attaque (élan, frappe, suite)
const ENEMY_ATK = 0.32; // v9.1.9 : attaque ennemie (préparation, coup, retour)
const CAST_TIME = 0.35; // durée de la pose de sort

const mixCache = new Map();
function mixColor(a, b, t) {
  const key = `${a}${b}${t}`;
  let color = mixCache.get(key);
  if (!color) {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    color = `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
    mixCache.set(key, color);
  }
  return color;
}

// Bord avant réel (premier pixel opaque à gauche, au milieu de la hauteur) d'un sprite : les flèches et les
// impacts touchent le corps, pas la marge transparente de l'image.
const edgeCache = new WeakMap();
function bodyEdge(img) {
  let edge = edgeCache.get(img);
  if (edge !== undefined) return edge;
  edge = 0;
  try {
    const { data, width, height } = img.getContext('2d', RF).getImageData(0, 0, img.width, img.height);
    let best = width;
    for (let y = Math.floor(height * 0.3); y < Math.floor(height * 0.75); y++) {
      for (let x = 0; x < best; x++) if (data[(y * width + x) * 4 + 3] > 0) { best = x; break; }
    }
    edge = best < width ? best : 0;
  } catch { edge = 0; }
  edgeCache.set(img, edge);
  return edge;
}

// Étendue horizontale opaque d'un canvas { l, r } (premier et dernier pixel non transparent), avec cache.
const spanCache = new WeakMap();
function opaqueSpan(img) {
  let span = spanCache.get(img);
  if (span) return span;
  span = { l: 0, r: img.width - 1 };
  try {
    const { data, width, height } = img.getContext('2d', RF).getImageData(0, 0, img.width, img.height);
    let l = width;
    let r = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 0) { if (x < l) l = x; if (x > r) r = x; }
      }
    }
    if (r >= l) span = { l, r };
  } catch { /* canvas illisible : toute la largeur */ }
  spanCache.set(img, span);
  return span;
}

// v9.0.8 : mouvement du corps, calculé en continu (en plus des images du sprite) — respiration douce à l'arrêt,
// rebond et balancement en marche, sauts écrasés pour les gluants, trot pour les quadrupèdes.
// Renvoie { sx, sy, dy, rot } : échelles (ancrées aux pieds), hauteur et inclinaison (radians, + = vers la droite).
const HOPPERS = /slime|jelly|blob|mandrake/;
const QUADRUPEDS = /boar|wolf|hound|bear|spider|rat|cat_|tiger|lizard|scorp|beetle|crab|mammoth/;
function bodyMotion(sprite, t, moving, facing) {
  if (HOPPERS.test(sprite)) {
    const p = (t * (moving ? 2.4 : 1.1)) % 1;
    const air = Math.sin(p * Math.PI);
    const land = Math.max(0, 1 - p * 6) + Math.max(0, (p - 0.85) * 6.6);
    return moving
      ? { sx: 1 + 0.16 * land - 0.06 * air, sy: 1 - 0.16 * land + 0.08 * air, dy: air * 5, rot: 0 }
      : { sx: 1 + 0.05 * Math.sin(t * 3), sy: 1 - 0.05 * Math.sin(t * 3), dy: 0, rot: 0 };
  }
  // Pas d'inclinaison ni d'étirement (le dessin reste intact) : trot rapide et bas, marche à petits bonds.
  void facing;
  if (QUADRUPEDS.test(sprite)) {
    return moving
      ? { sx: 1, sy: 1, dy: Math.abs(Math.sin(t * 12)) * 1.5, rot: 0 }
      : { sx: 1, sy: 1, dy: (Math.sin(t * 2.2) + 1) * 0.3, rot: 0 };
  }
  return moving
    ? { sx: 1, sy: 1, dy: Math.abs(Math.sin(t * 9)) * 2, rot: 0 }
    : { sx: 1, sy: 1, dy: (Math.sin(t * 2.2) + 1) * 0.35, rot: 0 };
}

// Applique un mouvement de corps autour des pieds (cx, feet) : tout ce qui est dessiné ensuite suit le corps.
function withMotion(ctx, cx, feet, m, draw) {
  ctx.save();
  ctx.translate(cx, feet - m.dy);
  ctx.rotate(m.rot);
  ctx.scale(m.sx, m.sy);
  ctx.translate(-cx, -feet);
  draw();
  ctx.restore();
}

// Silhouette teintée d'un canvas (images rémanentes), avec cache par canvas.
const ghostCache = new WeakMap();
function spriteCanvasTint(source, color) {
  let c = ghostCache.get(source);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = source.width;
  c.height = source.height;
  const g = c.getContext('2d', RF);
  g.drawImage(source, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  ghostCache.set(source, c);
  return c;
}

function rarityColor(id) {
  return RARITIES.find((r) => r.id === id)?.color ?? '#ffffff';
}

const PET_MOVE = { cat: 'bound', kitsune: 'bound', golem: 'bound', crystal_hedgehog: 'bound', jade_turtle: 'bound', owl: 'dive', phoenix: 'dive', dragonling: 'dive', golden_slime: 'bounce', wisp: 'streak', fairy: 'streak' };
const IMPACT_TINT = { fire: '#ff7a2a', ice: '#7fd6ff', thunder: '#bff4ff', poison: '#7fe06a', shadow: '#b46bff', holy: '#ffe680' };
export class SceneRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 240;
    this.height = MIN_VIEW_HEIGHT;
    this.groundY = MIN_VIEW_HEIGHT - GROUND_DEPTH; // ligne des pieds
    this.time = 0;
    this.effects = [];
    this.enemyFx = new Map();
    this.hero = { attack: 0, hurt: 0, victory: 0, respawn: 0, deathTime: 0, cast: 0, dash: 0, dashTo: 0, shoot: 0, aim: 0, shadow: 0 };
    this.shake = 0;
    this.zoneFade = 0;
    this.lastZone = -1;
  }

  // Taille du conteneur en pixels CSS. L'échelle vise ~200 px logiques de large ;
  // une fenêtre plus haute montre plus de ciel, une fenêtre plus large plus de décor.
  resize(cssWidth, cssHeight) {
    // Zoom plafonné : dans une grande fenêtre, on voit davantage du niveau plutôt qu'un chevalier géant.
    // Étape 3 : écran de téléphone (portrait) → un peu plus de champ, pour voir les ennemis arriver.
    // v9.7.1 : cadrage basé sur la taille du héros (≈ 15 % de la hauteur de scène) et échelle toujours nette :
    // scale × devicePixelRatio est un entier (100 %, 125 %, 150 %…), plus de demi-pas ni de pixels inégaux.
    const dpr = window.devicePixelRatio || 1;
    const pref = (SIZE_PREFS[SceneRenderer.sizePref] ?? 1) * (this.zoom ?? 1); // v9.8 (I6) : zoom propre (vitrine). Paramètres > Interface > Taille des personnages
    // v9.8.1 : portrait de téléphone seulement si la fenêtre elle-même est étroite (une scène étroite à côté du panneau
    // sur PC n'est pas un téléphone : la grande barre du boss y reste).
    const tall = cssWidth < 560 && cssHeight > cssWidth * 1.1 && (typeof innerWidth === 'undefined' || innerWidth < 700);
    const wide = !tall && cssWidth >= 470 && cssHeight >= 360; // v9.8.1 : 470 (à 1100 px de fenêtre, la grande barre du boss reste affichée) // v9.8 (B4) : 560 → 520 (panneau plus large : la barre du boss reste en grand)
    let scale;
    if (tall) {
      // Téléphone portrait : ≈ 240 px logiques de large (au lieu de 150) pour voir arriver les ennemis.
      scale = cssWidth / (TALL_VIEW_WIDTH / pref);
    } else {
      // Héros ≈ 15 % de la hauteur, largeur logique ≥ 380 px en 16:9 (480 px en 21:9), plafond 4.
      // v9.8 (0.8) : scène presque carrée (fenêtre haute) : moins de ciel, héros plus grand (260 px logiques de large).
      const minW = (cssWidth / cssHeight > 2.1 ? 480 : cssHeight / cssWidth > 0.8 ? 260 : 380) / pref;
      // Scène basse (paysage, petite fenêtre) : le héros prend une part plus grande (15 % à 700 px → 32 % à 250 px).
      const frac = Math.min(0.32, Math.max(cssHeight / cssWidth > 0.8 ? 0.2 : HERO_FRAC, HERO_FRAC + ((700 - cssHeight) / 450) * 0.17));
      scale = Math.min((frac * pref * cssHeight) / HERO_PX, cssWidth >= 560 ? cssWidth / minW : cssWidth / 240, AUTO_MAX_SCALE * pref);
    }
    // Les calques peints montent à 320 px au-dessus du sol : avec le sol remonté (≈ 65 %), la scène peut monter à ≈ 490 px.
    scale = Math.max(scale, cssHeight / (tall || wide ? 490 : MAX_VIEW_HEIGHT), 0.5);
    // Petites hauteurs (paysage, widget) : une marge au-dessus de la tête égale à la hauteur du HUD.
    const hud = this.hudPx ?? 0;
    const room = cssHeight - hud; // place sous le HUD pour le héros et le sol
    if (!tall && room > 0) scale = Math.min(scale, room / (HERO_PX + GROUND_DEPTH + 4));
    // Échelle nette : nombre entier de pixels d'écran par pixel du jeu (minimum 1).
    const k = Math.max(1, Math.round(scale * dpr), Math.round((cssHeight / (tall || wide ? 490 : MAX_VIEW_HEIGHT)) * dpr));
    scale = k / dpr;
    this.scale = scale;
    this.width = Math.max(120, Math.floor(cssWidth / scale));
    this.height = Math.max(MIN_VIEW_HEIGHT, Math.floor(cssHeight / scale));
    const prevGround = this.groundY;
    const lift0 = this.groundLift ?? (tall ? 0.68 : wide ? 0.74 : 0); // v9.11 (2, 6) : grands boss plus bas ; scène PC moins de briques vides
    // v10.0 (1) : la colonne sous le sol (vague, compétences, Sceau) doit tenir : sinon c'est la scène qui rétrécit.
    const lift = this.groundLift == null && this.liftCap && lift0 ? Math.min(lift0, this.liftCap) : lift0;
    this.groundY = lift ? Math.max(MIN_VIEW_HEIGHT - GROUND_DEPTH, Math.min(this.height - GROUND_DEPTH, Math.round(this.height * lift))) : this.height - GROUND_DEPTH;
    // v9.3.9 : la grande scène PC range les infos du combat (vague, boss, prochain déblocage) dans la terre, sous le sol.
    this.wide = wide && this.groundY < this.height - GROUND_DEPTH - 30;
    this.tall = tall;
    const play = this.canvas.parentElement?.parentElement;
    if (play?.style) {
      play.classList.toggle('wide-scene', this.wide);
      play.style.setProperty('--ground-px', `${Math.round((this.groundY + GROUND_DEPTH) * scale)}px`);
      play.style.setProperty('--feet-px', `${Math.round((this.groundY + 1) * scale)}px`); // v9.7.1 : sac de butin posé au sol
    }
    // v9.3.1 : un menu ouvert/fermé change la hauteur de la scène : les effets en cours (corps d'un monstre tué,
    // mort animée, chiffres, étincelles) suivent le sol au lieu de rester collés à l'ancienne hauteur (« au plafond »).
    const dy = this.groundY - prevGround;
    if (dy && Number.isFinite(dy)) {
      for (const fx of this.effects) for (const key of ['y', 'top', 'sy', 'y0', 'y1', 'ty']) if (typeof fx[key] === 'number') fx[key] += dy;
    }
    // Rendu à la résolution de l'écran (k pixels par pixel de jeu) : les sprites restent nets mais
    // les personnages et le décor se déplacent pixel d'écran par pixel d'écran (mouvement fluide).
    this.k = k;
    // v9.7.1 : la toile couvre tout le conteneur (plus de bande vide sous le sol) ; la dernière ligne est la terre.
    this.height = Math.max(this.height, Math.ceil(cssHeight / scale));
    this.width = Math.max(this.width, Math.ceil(cssWidth / scale));
    this.canvas.width = this.width * this.k;
    this.canvas.height = this.height * this.k;
    this.canvas.style.width = `${(this.width * k) / dpr}px`;
    this.canvas.style.height = `${(this.height * k) / dpr}px`;
    this.ctx.imageSmoothingEnabled = false;
  }

  enemyFxFor(id) {
    let fx = this.enemyFx.get(id);
    if (!fx) {
      fx = { appear: 0, hit: 0, lunge: 0, lastX: null };
      this.enemyFx.set(id, fx);
    }
    return fx;
  }

  // Position à l'écran d'un x du monde. v9.3.9 : plus d'étirement (sur PC, la zone d'approche était affichée jusqu'à
  // 5,8 fois trop vite : les monstres « se téléportaient ») ; les ennemis naissent au bord droit (viewEdgeX).
  wx(x) {
    // v9.7.1 : le héros reste à sa place, les ennemis sont écartés (distance d'arrêt, file) d'un facteur SPREAD.
    return HERO_X + (x - BALANCE.world.heroX) * SPREAD;
  }

  // Bord droit de la scène en x du monde (un peu au-delà, pour entrer en marchant).
  get viewEdgeX() {
    return BALANCE.world.heroX + (this.width + 14 - HERO_X) / SPREAD;
  }

  handleEvent(raw, world) {
    if (world.time - raw.time > STALE_EVENT_SECONDS) return;
    const event = raw.x === undefined ? raw : { ...raw, x: this.wx(raw.x) };
    const heroX = HERO_X;
    this.mutationEvent(event, world); // v9.2.3 : apparition, division, « Bloqué », vol de vie des mutés
    eventVfx(this, event, world, HERO_X); // v9.2.6
    switch (event.type) {
      case 'heroAttack': {
        // v9.2.4 : geste raccourci quand les coups s'enchaînent plus vite que 0,3 s (vitesse d'attaque élevée) : il
        // recommençait avant la fin et restait figé sur les images d'élan, à saccades. Durée = 90 % de l'écart
        // précédent entre deux coups, entre 0,12 et 0,3 s ; l'image du coup tombe toujours au même instant relatif.
        const gap = this.time - (this.hero.lastStrikeAt ?? -9);
        this.hero.lastStrikeAt = this.time;
        this.hero.strikeTime = Math.min(ATTACK_TIME, Math.max(0.12, gap * 0.9));
        this.hero.attack = this.hero.strikeTime;
        if (this.underwater) swirl(this, event.x - 6, this.groundY - 14, event.crit ? 9 : 5); // v9.2.0 : remous de bulles
        // v9.0.6 : chaque classe a sa propre attaque (voir classAttack()).
        if (event.kind && event.kind !== 'slash') {
          // Tir et magie : pas d'élan d'épée (poses de tir / de sort à la place).
          if (['arrow', 'bolt', 'fireball', 'lightning', 'soul'].includes(event.kind)) this.hero.attack = 0;
          // v9.2.5 : météore et pluie de flèches : geste du héros et effet synchronisé (skill-fx.js).
          const special = event.special && castHeroSkill(this, this.skillKey, event.special, fxContext(this, world, { x: HERO_X + 4, y: this.groundY - 22 }, HERO_X));
          this.classAttack(special ? { ...event, special: null } : event);
          break;
        }
        this.hero.dash = ATTACK_TIME;
        this.hero.dashTo = event.x;
        // Arc de taille dessiné (bleu, ou doré et plus grand sur un coup critique), puis impact.
        const sx = this.dashReach(event.x);
        this.dust(HERO_X - 4, 3);
        // v9.2.6 : arc de taille dessiné (PixelLab), doré et plus grand sur un critique ; ancien arc en repli.
        // v9.11 (1) : coup critique = arc en dégradé (blanc au bord, doré au centre, transparent au bout) avec traînée,
        // pas plus grand que le héros, et une étincelle à l'impact (plus de « banane » jaune pâle).
        // v10.0 (3) : plus de croissant à chaque coup. Sur un coup critique seulement : une traînée d'arme fine et
        // courbe qui s'efface en 0,15 s, jamais deux à la fois.
        if (event.crit) this.critTrail(heroX + 16 + sx, this.groundY - 16 - this.waterLift());
        // L'impact (éclair blanc, recul, étincelles, chiffre) tombe quand la lame touche, pas au début du geste.
        this.later(0.09, () => this.hitReact(event.enemyId, event.x, { crit: event.crit, boss: event.boss, damage: event.damage, color: '#ffffff', weapon: 'none' }));
        break;
      }
      case 'enemyHit':
        // v9.0.6 : les coups du héros (attaque) réagissent à l'impact réel (lame ou projectile qui arrive) : voir hitReact().
        if (event.source === 'attack') break;
        this.enemyFxFor(event.enemyId).hit = 0.08;
        this.enemyFxFor(event.enemyId).knock = Math.min(6, (this.enemyFxFor(event.enemyId).knock ?? 0) + 2);
        if (event.source !== 'hero' && !vfx(this, 'hit_blunt', event.x - 4, this.groundY - 14, { size: 0.7 })) this.sprite(['fx_hit'], event.x, this.groundY - 10, 0.14);
        if (event.source === 'skill' || event.source === 'companion') {
          const [c0, c1] = DAMAGE_COLORS[event.source];
          this.addText(formatNumber(event.damage), event.x, this.groundY - (event.boss ? 64 : 42), c0, c1, false, event.damage);
        }
        // v9.3.1 : types : coup efficace (avantage d'élément) ou peu efficace, signalé au-dessus de l'ennemi.
        // v9.3.2 : AVANTAGE / DÉSAVANTAGE (au plus une fois toutes les 0,7 s par ennemi, pour rester lisible).
        if (event.elem && event.elem !== 1) {
          const fxe = this.enemyFxFor(event.enemyId);
          if (this.time - (fxe.elemAt ?? -9) > 0.7) {
            fxe.elemAt = this.time;
            const y = this.groundY - (event.boss ? 80 : 56);
            if (event.elem > 1) { this.addText('Efficace !', event.x, y, '#6dff8a', '#e6ffe8'); /* v9.5.1 (4.3) */ if (!this.focus) this.burst(event.x, this.groundY - 18, '#ffd23f', 5, 40); }
            else this.addText('Résiste', event.x, y, '#8a93a8', '#e0e6f0');
          }
        }
        break;
      case 'bossHeavy': // v9.6.3 (5.3)
        this.addText('Attaque lourde !', event.x, this.groundY - 90, '#ff5a5a', '#ffd8d0');
        this.shake = Math.max(this.shake, 2);
        break;
      case 'bossWeak':
        this.addText('Affaibli !', event.x, this.groundY - 90, '#ffd24a', '#fff6c8');
        break;
      case 'skill':
        // v9.7.1 (lot 3 bis) : trois temps — préparation (lueur au héros), impact (arrêt d'image 0,05 s), retombée (effets).
        if (!this.focus) { this.effects.push({ kind: 'halo', x: HERO_X, y: this.groundY - 16, color: '#ffe9a8', life: 0.3, max: 0.3 }); this.hitstop = Math.max(this.hitstop ?? 0, 0.05); }
        // v9.3.9 (2.3) : une compétence qui touche plusieurs ennemis secoue l'écran.
        // v9.8 (B1) : plus de secousse sur une action du héros ou d'un compagnon. (v9.9 : l'ancien « if » sans corps rendait
        // le geste d'arme conditionnel — corrigé.)
        // v9.2.5 : geste propre à la compétence et effet synchronisé (skill-fx.js) ; ancien effet en repli.
        this.weaponSkillFlourish(HERO_X + 4, this.weaponEq); // v9.3.2 : l'arme participe à la compétence
        // v9.9 (K11) : étiquette de sort au-dessus du héros (1 s), à la couleur de sa classe.
        { const sk = SKILLS.find((x) => x.id === event.skillId);
          if (sk && SceneRenderer.skillNames !== false && !this.focus) {
            const old = this.effects.filter((e) => e.kind === 'callout');
            if (old.length >= 3) this.effects.splice(this.effects.indexOf(old[0]), 1);
            const half = Math.min(this.width / 2 - 2, sk.name.length * 1.6 + 4);
            this.pushCallout({ kind: 'callout', text: sk.name, x: Math.max(half, Math.min(this.width - half, HERO_X)), y: this.groundY - 50, color: '#ffd23f', life: 1, max: 1, half });
          } }
        if (castHeroSkill(this, this.skillKey, event.skillId, fxContext(this, world, { x: HERO_X + 4, y: this.groundY - 22 }, HERO_X))) break;
        this.skillEffect(event);
        break;
      case 'companionBasic': {
        // v9.7.1 (lot A) : attaque de base entre deux compétences — le geste « attack » existant (compagnons et familiers).
        const companion = companionById(event.companionId);
        // v10.0 (9.1) : file de gestes (un geste à la fois par compagnon, 0,45 s au moins entre deux).
        if (companion) this.queueAlly(companion.id, () => this.allyGesture(companion, world, heroX, 'hit'), { dur: ALLY_GESTURE_TIME[basicKind(companion.id)] ?? 0.85 });
        break;
      }
      case 'companionSkill': {
        // v10.0 (9.1) : la compétence attend la fin du geste en cours du compagnon (l'ultime passe devant tout).
        const run = () => {
          const companion = companionById(event.companionId);
          if (companion) this.skillCallout(companion, event, world); // v9.7.1 (lot A) : nom, halo, ralenti de l'ultime
          // v9.2.5 : chaque compétence (ultime comprise) a son geste et son effet (skill-fx.js).
          const known = companion && (event.skill === 99 ? awakenedSkill(companion.id) : companionSkillList(companion, COMPANION_ROLES[companion.id] ?? 'pet')[event.skill]);
          if (known) {
            const slot = this.layout?.slots.get(companion.id);
            const sx = slot?.cx ?? heroX - 30;
            castUnitSkill(this, companion, known.name, event.skillType ?? known.type, fxContext(this, world, { x: sx, y: this.groundY - 22 }, heroX));
            // v10.0 (9.1) : le corps bouge aussi pendant la compétence (ruée d'un combattant sur un coup, pas d'un mage).
            if (companion.kind === 'ally') this.allyGesture(companion, world, heroX, event.skillType ?? known.type, event.ultimate, true);
            return;
          }
          if (companion?.kind === 'ally') {
            // v9.0.8 : geste propre au compagnon (saut d'attaque, tir, sort, soutien), l'effet part de sa place.
            this.allyGesture(companion, world, heroX, event.skillType, event.ultimate);
          } else {
            this.effects.push({ kind: 'ring', x: heroX - 28, y: this.groundY - 14, color: '#9cf08a', life: 0.5, max: 0.5, r: 10 });
          }
          // v9.1.3 (doc4 lot 2) : effet générique d'ultime (rare : 30 s), aux couleurs du compagnon — colonne de
          // lumière sur la cible, gerbe d'étincelles et petite secousse. Sans texte (la scène n'est pas traduite).
          if (event.ultimate) {
            const color = companion?.fx ?? '#ffd23f';
            const x = Math.round(world.enemies[0] ? this.wx(world.enemies[0].x) : heroX + 60);
            this.effects.push({ kind: 'beam', x, color, life: 0.9, max: 0.9, wide: true });
            this.effects.push({ kind: 'ring', x, y: this.groundY - 18, color, life: 0.6, max: 0.6, r: 22 });
            this.burst(x, this.groundY - 24, color, 16, 52);
            /* v9.8 (B1) : plus de secousse sur une action du héros ou d'un compagnon */
          }

        };
        this.queueAlly(event.companionId, run, { dur: event.ultimate ? 1.2 : 0.95, ultimate: Boolean(event.ultimate) });
        break;
      }
      case 'levelUp':
        vfx(this, 'level_up', heroX, this.groundY + 1, { size: 1 }); // v9.2.6 : colonne dorée dessinée
        this.effects.push({ kind: 'beam', x: heroX, color: '#ffd23f', life: 1, max: 1, wide: true });
        this.burst(heroX, this.groundY - 28, '#ffd23f', 14, 46);
        for (let i = 0; i < 5; i++) this.sprite(['fx_spark'], heroX - 16 + i * 8, this.groundY - 30 - (i % 2) * 14, 0.6, { delay: i * 0.08 });
        break;
      case 'enemyWindup': {
        const efx = this.enemyFxFor(event.enemyId);
        efx.windup = 0.25;
        efx.wound = true;
        efx.swings = (efx.swings ?? 0) + 1; // v9.7.1 : une attaque sur deux = seconde attaque (attack2)
        break;
      }
      case 'bossHeavy': this.enemyFxFor(event.enemyId).tele = TELE_TIME; break; // v9.7.1 (lot C) : annonce dessinée
      case 'bossEnrage': this.enemyFxFor(event.enemyId).skill = SKILL_TIME; break; // rage : compétence dessinée
      case 'heroHit':
        this.hero.hurt = 0.18;
        if (this.underwater) swirl(this, HERO_X + 12, this.groundY - 16, 4); // v9.2.0 : la morsure brasse l'eau
        {
          // v9.1.9 : la préparation a déjà été jouée (événement enemyWindup) : on reprend au coup.
          const efx = this.enemyFxFor(event.enemyId);
          efx.lunge = efx.windup > 0 || efx.wound ? ENEMY_ATK * 0.7 : ENEMY_ATK;
          efx.windup = 0;
          efx.wound = false;
        }
        vfx(this, 'hit_blunt', heroX + 8, this.groundY - 20, { size: event.boss ? 1 : 0.7, flip: true }); // v9.2.6 : coup reçu
        this.addText(formatNumber(Math.max(1, Math.round(event.damage))), heroX - 4, this.groundY - 48, ...DAMAGE_COLORS.hurt);
        if (event.boss) this.shake = Math.max(this.shake, 3.5); // v9.3.9 : coup de boss
        break;
      // v9.3.8 : vagues groupées — annonce de la vague ; à la dernière, pluie d'or (visuelle) à la fin de l'étape.
      case 'waveStart': break; // v9.3.8 : la vague est écrite dans la barre (« Vague 2/5 ») ; la police des dégâts n'a pas de lettres
      case 'stage':
        if (!event.boss && !this.focus) for (let i = 0; i < 14; i++) {
          this.effects.push({ kind: 'coin', x: 30 + Math.random() * (this.width - 60), y: 10 + Math.random() * 20, vx: Math.random() * 20 - 10, vy: 20 + Math.random() * 30, life: 1.1, max: 1.1, seed: i });
        }
        break;
      case 'kill': {
        // Tué par un projectile encore en vol : l'ennemi reste affiché (figé) jusqu'à l'impact, puis s'effondre.
        const pending = this.inFlight?.get(event.enemyId);
        if (pending && pending > this.time) {
          const fx = this.enemyFx.get(event.enemyId);
          const v = fx?.vis; // v9.2.4 : l'image affichée, pas l'image de base
          if (v) this.effects.push({ kind: 'ghost', img: v.img, x: v.x, y: v.y, w: v.w, h: v.h, life: pending - this.time, max: pending - this.time });
          this.later(pending - this.time, () => this.killEffect(event));
        } else this.killEffect(event);
        break;
      }
      case 'drop': {
        const color = rarityColor(event.item.rarity);
        const big = event.item.rarity === 'legendary' || event.item.rarity === 'epic';
        // v9.2.2 : l'objet part de la position réelle de l'ennemi à sa mort (volant, encore en l'air, sprite décalé
        // devant le chevalier), puis retombe au sol. Avant : x de la simulation, toujours au sol.
        const at = this.deathSpot(event.enemyId) ?? { x: event.x, y: this.groundY - 2 };
        const x0 = Math.max(HERO_X + 16, Math.min(this.width - 20, at.x));
        this.effects.push({ kind: 'beam', x: Math.round(x0), color, life: 1.4, max: 1.4, wide: big });
        // L'objet jaillit du monstre, retombe en brillant, puis file vers le sac du chevalier.
        this.effects.push({ kind: 'loot', toBag: Boolean(event.bagged), item: event.item, color, x0, x: x0, y0: at.y, y: at.y, life: LOOT_LIFE, max: LOOT_LIFE });
        this.burst(x0, at.y - 4, color, big ? 14 : 6, 50);
        vfx(this, 'loot_burst', x0, at.y, { tint: color, size: big ? 1.3 : 0.9 }); // v9.2.6 : gerbe d'étincelles de rareté
        if (event.item.rarity === 'legendary') /* v9.8 (B1) : plus de secousse sur une action du héros ou d'un compagnon */
        break;
      }
      case 'bossSummon':
        // v9.7.1 (lot C) : le maître joue sa compétence dessinée (invocation) quand l'événement le désigne.
        if (world.enemies.some((e) => e.id === event.enemyId && e.boss)) this.enemyFxFor(event.enemyId).skill = SKILL_TIME;
        this.shake = Math.max(this.shake, 3);
        this.burst(HERO_X + 60, this.groundY - 20, '#ff0030', 18, 60);
        break;
      case 'gems':
        // Gemmes (cristaux) : petite gemme qui saute et texte bleu.
        if (!vfx(this, 'loot_gem', event.x, this.groundY - 22, { life: 0.9, vy: -12, loop: true })) this.sprite(['icon_gem'], event.x, this.groundY - 16, 0.9);
        this.addText(`+${event.gems}`, event.x, this.groundY - 40, '#6fd6ff', '#d8f6ff');
        this.burst(event.x, this.groundY - 14, '#6fd6ff', 6, 34);
        break;
      case 'bossSpawn':
        this.shake = Math.max(this.shake, 3);
        // v9.2.6 : cercle d'invocation à l'endroit où le boss surgit.
        vfx(this, 'boss_appear', Math.min(this.width - 30, event.x ?? HERO_X + 90), this.groundY + 2);
        break;
      case 'bossDefeated':
        this.hero.victory = 0.8;
        this.shake = Math.max(this.shake, 3);
        break;
      case 'heroDeath':
        this.hero.deathTime = 0;
        this.burst(heroX, this.groundY - 12, '#ff5a5a', 12, 44);
        break;
      case 'heroRespawn':
        this.hero.respawn = 1;
        break;
      default:
        break;
    }
  }

  // v9.5.3 (5.5) : au plus 3 anneaux à la fois (les plus anciens s'effacent) : les cercles empilés ne cachent plus le combat.
  capRings() {
    const rings = this.effects.filter((e) => e.kind === 'ring');
    for (let i = 0; i < rings.length - 3; i++) this.effects.splice(this.effects.indexOf(rings[i]), 1);
  }

  // v10.1 (P5) : deux noms de compétence ne se chevauchent plus (« Coup de taille » + « …llante ») : le nouveau monte
  // d'une ligne tant qu'il recouvre un nom encore affiché (au plus 4 lignes), sinon le plus ancien s'efface.
  pushCallout(fx) {
    const live = this.effects.filter((e) => e.kind === 'callout' && e.life > 0.05);
    for (let k = 0; k < 4; k++) {
      const hit = live.some((e) => Math.abs(e.y - fx.y) < 8 && Math.abs(e.x - fx.x) < (e.half ?? 20) + fx.half);
      if (!hit) { this.effects.push(fx); return; }
      fx.y -= 8;
    }
    const oldest = live[0];
    if (oldest) this.effects.splice(this.effects.indexOf(oldest), 1);
    this.effects.push(fx);
  }

  addText(text, x, y, color, light = '#ffffff', big = false, value = null) {
    const texts = this.effects.filter((e) => e.kind === 'text');
    // v9.11 (2) : coups rapprochés sur la même cible → un seul chiffre qui s'additionne et rejaillit (plus de pile de
    // « 3,6 Qi » identiques, surtout contre un grand boss).
    if (Number.isFinite(value)) {
      const m = texts.find((e) => Number.isFinite(e.value) && e.max - e.life < 0.6 && Math.abs((e.baseX ?? e.cx) - x) < 34);
      if (m) {
        m.value += value; m.text = formatNumber(Math.round(m.value)); m.life = m.max; m.pop = true;
        if (big) { m.color = color; m.light = light; }
        delete m.cache; m.x = m.cx - textWidth(m.text, FONT_BIG) / 2;
        return;
      }
    }
    if (texts.length >= MAX_FLOATING_TEXTS) this.effects.splice(this.effects.indexOf(texts[0]), 1);
    // v9.7.1 : chiffres en éventail — un coup proche d'un chiffre récent est décalé (gauche/droite, plus haut) au lieu
    // de s'empiler (« 3t362?7KK » illisible).
    const near = texts.filter((e) => e.max - e.life < 0.35 && Math.abs((e.baseX ?? e.cx) - x) < 16).length;
    const baseX = x;
    if (near) {
      x += (near % 2 ? 1 : -1) * Math.ceil(near / 2) * 9;
      y -= Math.min(4, near) * 5;
    }
    // v9.10 (8) : plus jamais deux chiffres au même endroit — tant qu'un chiffre vivant recouvre la place, on monte
    // d'une ligne (au plus 5).
    const w = textWidth(text, FONT_BIG);
    for (let k = 0; k < 5; k++) {
      const hit = texts.some((e) => e.life > 0.1 && Math.abs(e.y - y) < 8 && Math.abs(e.cx - x) < (w + textWidth(e.text, FONT_BIG)) / 2);
      if (!hit) break;
      y -= 9;
      x += k % 2 ? -4 : 4;
    }
    this.effects.push({ baseX, kind: 'text', text, value, x: x - w / 2, y, cx: x, y0: y, color, light, life: big ? 0.95 : 0.8, max: big ? 0.95 : 0.8, pop: big });
  }

  burst(x, y, color, count, speed = 30) {
    if (this.focus) count = Math.min(count, 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      this.effects.push({
        kind: 'particle', x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - 20,
        color, life: 0.4 + Math.random() * 0.3, max: 0.7,
      });
    }
  }

  // Appel différé, synchronisé sur le temps de la scène.
  later(delay, fn) {
    this.effects.push({ kind: 'call', fn, life: delay, max: delay });
  }

  // Petits nuages de poussière aux pieds (bond, réception).
  // v9.2.2 : effets d'arrivée (arrival-fx.js) ; sillage de bulles à la nage, filets d'air en vol.
  arrivalFx(enemy, fx, arrival, pose, k, ex, w, h) {
    if (this.focus) return;
    drawArrivalFx(this, this.ctx, enemy, fx, arrival, pose, k, w, h);
    if ((arrival.mode === 'swim' || arrival.mode === 'fly') && pose.dy > 6 && (this.frameNo + enemy.id) % 4 === 0) {
      const y = this.groundY - h / 2 - pose.dy;
      this.effects.push({ kind: 'particle', x: ex + w / 2 + pose.dx, y, vx: 14, vy: arrival.mode === 'swim' ? -12 : -4,
        color: arrival.mode === 'swim' ? '#bfe8ff' : '#e8f0ff', life: 0.35, max: 0.35 });
    }
  }

  dust(x, count) {
    // v9.2.6 : poussière dessinée — petit nuage de pas, ou nuage d'atterrissage pour un gros appui.
    if (vfx(this, count >= 4 ? 'dust_land' : 'dust_step', x, this.groundY - (count >= 4 ? 7 : 4), { flip: true, size: count >= 4 ? 0.9 : 1 })) count = Math.min(count, 1);
    for (let i = 0; i < count; i++) {
      this.effects.push({ kind: 'puff', x: x + (Math.random() * 6 - 3), y: this.groundY - 1, vx: -10 - Math.random() * 16, vy: -4 - Math.random() * 6,
        life: 0.35 + Math.random() * 0.2, max: 0.5, color: i % 2 ? '#d8d0b8' : '#a89e86' });
    }
  }

  // v9.0.6 : impact d'un coup du héros sur un ennemi — éclair blanc, recul, écrasement, étincelles dans le sens du
  // coup, chiffre ; sur un critique : arrêt sur image, anneau, secousse et étincelles dorées.
  hitReact(enemyId, x, { crit = false, boss = false, damage = 0, color = '#ffffff', y = null, element = null, weapon = 'slash' } = {}) {
    const fx = this.enemyFx.get(enemyId);
    const G = this.groundY;
    const ix = fx?.seen > this.time - 0.2 ? fx.edge + 2 : x - 6;
    const iy = y ?? (fx?.seen > this.time - 0.2 ? fx.sy + fx.sh * 0.5 : G - 12);
    if (fx) {
      fx.hit = crit ? 0.13 : 0.08;
      // v9.2.3 : coup reçu dessiné (PixelLab) : sur un critique, ou au plus une fois toutes les HURT_COOLDOWN secondes.
      if ((crit || this.time - (fx.hurtAt ?? -99) > HURT_COOLDOWN) && !(fx.lunge > 0) && !(fx.windup > 0)) { fx.hurt = HURT_TIME; fx.hurtAt = this.time; }
      // v9.3.9 (2.3) : recul 2 à 3 fois plus fort (en pixels de la scène, donc proportionnel à sa taille).
      fx.knock = Math.min(boss ? 9 : 18, (fx.knock ?? 0) + (crit ? 12 : 7) * (boss ? 0.5 : 1));
      fx.squash = crit ? 0.2 : 0.14;
      // v9.2.7 : léger arrêt sur image à chaque coup (le coup « pèse »), plus long sur un critique ; espacé d'au
      // moins 0,2 s pour ne pas ralentir les vitesses d'attaque élevées.
      if (!this.focus && (crit || this.time - (this.hitstopAt ?? -9) > 0.2)) {
        this.hitstop = Math.max(this.hitstop ?? 0, crit ? 0.1 : 0.045); // v9.3.9 : critique 100 ms
        this.hitstopAt = this.time;
      }
    }
    const sparkColor = crit ? '#ffd23f' : color;
    for (let i = 0; i < (crit ? 9 : 5); i++) {
      const a = -0.9 + Math.random() * 1.6; // vers la droite (sens du coup), un peu vers le haut
      const v = 50 + Math.random() * 70;
      this.effects.push({ kind: 'spark', x: ix, y: iy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, color: i % 3 ? sparkColor : '#ffffff', life: 0.22, max: 0.22 });
    }
    // v9.2.6 : impact dessiné (PixelLab) selon l'élément, sinon selon l'arme (taille, estoc, contondant, flèche) ;
    // critique : éclat doré et onde. Ancien éclat en repli tant que l'atlas n'est pas chargé.
    const el = element ?? elementOfColor(color);
    const big = (crit ? 1.25 : 1) * (boss ? 1.15 : 1);
    const hitName = el ? `hit_${el}` : weapon === 'none' ? null : `hit_${weapon}`;
    const drawn = vfxReady();
    // v10.0 (3) : impact = éclat dessiné (étoile de lumière et 6 à 8 étincelles, 0,25 s) de la couleur de l'élément,
    // à la place des disques (orange à spirale), anneaux et ondes ; l'ancien impact reste en repli sans le second atlas.
    if (vfx2Ready('v_impact')) vfx(this, 'v_impact', ix + 2, iy, { size: big * (crit ? 1.1 : 0.85), life: 0.25, tint: crit ? '#ffd23f' : IMPACT_TINT[el] ?? null });
    else if (hitName) vfx(this, hitName, ix + 2, iy, { size: big });
    if (!drawn) this.sprite(['fx_hit'], ix + 2, iy + 6, 0.14, { tint: crit ? '#ffd23f' : null });
    // v9.1.9 : impact élémentaire selon la couleur du coup (feu, glace, poison, sacré, ombre) ou l'élément donné.
    if (el) this.elementFx(ix, iy, el, crit || boss);
    // v9.2.6 : couleur du chiffre selon le coup (critique doré, élément, coup simple blanc).
    const [c0, c1] = DAMAGE_COLORS[crit ? 'crit' : el ?? 'hit'] ?? DAMAGE_COLORS.hit;
    if (damage) this.addText(formatNumber(damage), x, G - (boss ? 58 : 36), c0, c1, crit, damage);
  }

  // v10.0 (9.1) : file de gestes par compagnon — chaque action attend la fin de la précédente (0,45 s au moins entre
  // deux gestes du même compagnon) ; l'équipe est décalée de 0,15 s pour ne pas agir comme un seul bloc ; l'ultime
  // passe devant. File bornée (3) : les attaques de base en trop sont oubliées.
  queueAlly(id, fn, { dur = 0.9, ultimate = false } = {}) {
    const q = (this.allyQ ??= new Map()).get(id) ?? [];
    const job = { fn, dur, ultimate };
    if (ultimate) q.unshift(job); else q.push(job);
    while (q.length > 3) { const i = q.findIndex((j) => !j.ultimate); q.splice(i >= 0 ? i : q.length - 1, 1); }
    this.allyQ.set(id, q);
  }

  processAllyQueue() {
    if (!this.allyQ) return;
    const busy = (this.allyBusy ??= new Map());
    for (const [id, q] of this.allyQ) {
      if (!q.length || this.time < (busy.get(id) ?? -9) || this.time < (this.teamNext ?? -9)) continue;
      const job = q.shift();
      job.fn();
      busy.set(id, this.time + Math.max(0.45, job.dur));
      this.teamNext = this.time + 0.15;
      (this.gestureLog ??= []).push({ id, t: this.time }); // tests : écart entre deux gestes
      if (this.gestureLog.length > 200) this.gestureLog.shift();
    }
  }

  critTrail(x, y, color = '#ffd23f') {
    if (this.focus || this.time - (this.trailAt ?? -9) < 0.4) return; // au plus une traînée toutes les 0,4 s
    this.trailAt = this.time;
    this.effects = this.effects.filter((e) => e.kind !== 'wtrail');
    this.effects.push({ kind: 'wtrail', x, y, color, life: 0.15, max: 0.15, flip: (this.trailFlip = !this.trailFlip) });
  }

  killEffect(event) {
    // Éclatement en pixels : quelques pixels du sprite volent en éclats (couleurs réelles du monstre).
    // v9.2.5 : scissipare divisé : ses deux moitiés sont son corps (mutation-fx.js), pas de chute ni de corps en plus.
    const split = Boolean(this.splitGone?.delete(event.enemyId));
    const fxe0 = this.enemyFx.get(event.enemyId);
    const fxe = split ? (fxe0 ? { ...fxe0, img: null } : fxe0) : fxe0;
    if (fxe?.img && !this.focus) this.shatter(fxe);
    // v9.3.9 (2.3) : coup de grâce — arrêt sur image plus long (au plus toutes les 0,25 s : les vagues meurent groupées).
    if (!this.focus && this.time - (this.killStopAt ?? -9) > 0.25) { this.hitstop = Math.max(this.hitstop ?? 0, event.boss ? 0.12 : 0.08); this.killStopAt = this.time; }
    const { sprite, scale, heroLike, colors, base } = this.enemyLook(event.kind, event.boss);
    // v9.2.3 : mort dessinée (PixelLab) : le monstre s'effondre là où il est mort, puis s'efface.
    const death = !heroLike && !this.focus && fxe?.img ? ENEMY_ANIMS[base]?.death : null;
    if (death) {
      const k = fxe.sw / fxe.img.width; // échelle réelle à l'écran (géant, scissipare compris)
      // v9.2.4 : un volant tué en l'air tombe jusqu'au sol pendant sa chute dessinée (au lieu de s'allonger dans le vide).
      // v9.2.5 : chute recalée sur le sprite de base (corps couché sur le sol, pas au-dessus ni dedans).
      const bb = boxOf(spriteCanvas(base, { colors }));
      const at = anchorOffset(bb, animBoxes(death, (key) => spriteCanvas(key, { colors })), 0, 'death', death);
      const drop = Math.max(0, this.groundY + 1 - (fxe.sy + (bb ? (bb.bottom + 1) * k : fxe.sh)));
      this.effects.push({ kind: 'death', anim: death, colors, x: fxe.sx, y: fxe.sy, k, drop, ox: at.ox, oy: at.oy, life: event.boss ? 1.3 : 0.9, max: event.boss ? 1.3 : 0.9 });
    }
    // v9.2.4 : même image que celle affichée à l'instant de la mort (image dessinée comprise), à la même place.
    const vis = fxe?.vis;
    const img = heroLike
      ? heroComposite('idle', { weapon: { baseId: 'fallen_blade', rarity: 'epic' } }, true, 'b', colors, true)
      : spriteCanvas(vis?.key ?? sprite, { colors, flash: true });
    const k0 = vis && !heroLike ? vis.w / vis.img.width : scale;
    if (!split) this.effects.push({
      kind: 'corpse', img, x: vis ? vis.x + vis.w / 2 : this.wx(event.x), top: vis ? vis.y : undefined, w: img.width * k0, h: img.height * k0,
      fly: this.flyHeight(event.kind, event.boss), life: 0.3, max: 0.3, fling: !this.focus && !event.boss, // v9.3.9 : projeté en arrière
    });
    if (death && !split) this.effects.splice(this.effects.length - 1, 1); // pas de second corps
    if (!this.focus && fxe?.img && !death) {
      // v9.1.9 : mort plus vivante : le corps se dissout (tramage) et des étincelles montent.
      const last = this.effects[this.effects.length - 1];
      Object.assign(last, { img: vis.img, frames: dissolveFrames(vis.img), life: event.boss ? 0.9 : 0.5, max: event.boss ? 0.9 : 0.5 });
      for (let i = 0; i < (event.boss ? 16 : 6); i++) {
        this.effects.push({ kind: 'particle', x: fxe.sx + Math.random() * fxe.sw, y: fxe.sy + fxe.sh * (0.2 + Math.random() * 0.7),
          vx: (Math.random() - 0.5) * 10, vy: -14 - Math.random() * 20, color: i % 2 ? '#ffffff' : '#c8b8ff', life: 0.7, max: 0.7 });
      }
    }
    // v9.2.6 : mort dessinée (PixelLab) : bouffée de fumée et âme qui s'échappe ; boss : grande explosion.
    if (fxe0) {
      const cx = fxe0.sx + fxe0.sw / 2;
      const cy = fxe0.sy + fxe0.sh * 0.6;
      if (event.boss) { vfx(this, 'boss_explode', cx, cy, { size: Math.max(1, fxe0.sh / 60) }); vfx(this, 'death_smoke', cx, this.groundY - 8, { size: 1.4, delay: 0.25 }); }
      else vfx(this, 'death_smoke', cx, cy, { size: Math.max(0.7, Math.min(1.3, fxe0.sh / 36)), delay: 0.12 });
      vfx(this, 'death_soul', cx, fxe0.sy + fxe0.sh * 0.4, { delay: 0.2, vy: -16, life: 0.8 });
    }
    // v9.2.2 : position réelle à la mort (centre du sprite à l'écran), pour le butin et les pièces.
    if (fxe0?.img) {
      this.deaths ??= new Map();
      this.deaths.set(event.enemyId, { x: fxe0.sx + fxe0.sw / 2, y: Math.min(this.groundY - 2, fxe0.sy + fxe0.sh * 0.6), t: this.time });
      for (const [id, d] of this.deaths) if (this.time - d.t > 5) this.deaths.delete(id);
    }
    this.enemyFx.delete(event.enemyId);
    const spot = this.deathSpot(event.enemyId);
    const coins = event.boss ? 12 : Math.min(4, 1 + Math.floor(event.gold / 20));
    for (let i = 0; i < coins; i++) {
      this.effects.push({
        kind: 'coin', x: (spot?.x ?? this.wx(event.x)) + (Math.random() * 10 - 5), y: spot ? Math.min(spot.y, this.groundY - 14) : this.groundY - 14,
        vx: Math.random() * 40 - 20, vy: -40 - Math.random() * 30, life: 0.8, max: 0.8, seed: i,
      });
    }
  }

  // v9.2.2 : où l'ennemi est mort (ou se trouve encore, s'il attend un projectile en vol), à l'écran.
  deathSpot(enemyId) {
    if (enemyId == null) return null;
    const d = this.deaths?.get(enemyId);
    if (d) return d;
    const fx = this.enemyFx.get(enemyId);
    return fx?.img ? { x: fx.sx + fx.sw / 2, y: Math.min(this.groundY - 2, fx.sy + fx.sh * 0.6) } : null;
  }

  shatter(fx0) {
    const fx = fx0.vis ? { img: fx0.vis.img, sx: fx0.vis.x, sy: fx0.vis.y, sw: fx0.vis.w } : fx0; // v9.2.4 : image affichée
    const img = fx.img;
    let data;
    try { data = img.getContext('2d', RF).getImageData(0, 0, img.width, img.height).data; } catch { return; }
    const pts = [];
    for (let i = 0; i < 40 && pts.length < 14; i++) {
      const px = Math.floor(Math.random() * img.width);
      const py = Math.floor(Math.random() * img.height);
      const o = (py * img.width + px) * 4;
      if (data[o + 3] > 0) pts.push({ px, py, color: `rgb(${data[o]},${data[o + 1]},${data[o + 2]})` });
    }
    const sx = fx.sw / img.width;
    for (const p of pts) {
      this.effects.push({ kind: 'particle', x: fx.sx + p.px * sx, y: fx.sy + p.py * sx, vx: 20 + Math.random() * 50, vy: -30 - Math.random() * 50,
        color: p.color, life: 0.5 + Math.random() * 0.3, max: 0.8, size: 2 });
    }
  }

  skillEffect(event) {
    const heroX = HERO_X;
    const G = this.groundY;
    this.hero.cast = CAST_TIME;
    if (event.skillId === 'quick') {
      // Vague d'énergie lancée vers l'ennemi.
      const target = this.wx(event.x);
      this.sprite(['fx_wave'], heroX + 12, G - 10, 0.3, { vx: (target - heroX - 12) / 0.3, delay: 0.05 });
    } else if (event.skillId === 'whirl') {
      this.sprite(['fx_whirl1', 'fx_whirl2', 'fx_whirl1', 'fx_whirl2', 'fx_whirl1', 'fx_whirl2'], heroX, G + 3, 0.4);
    } else if (event.skillId === 'cry') {
      for (let i = 0; i < 6; i++) this.sprite(['fx_spark'], heroX - 18 + i * 7, G - 40 - (i % 3) * 6, 0.5, { delay: i * 0.05, tint: '#ffd23f' });
    } else if (event.skillId === 'holy') {
      const target = Math.round(this.wx(event.x));
      this.effects.push({ kind: 'beam', x: target, color: '#ffe680', life: 0.8, max: 0.8, wide: true });
      this.sprite(['fx_burst'], target, G + 1, 0.5, { tint: '#ffe680' });
      this.elementFx(target, G - 14, 'holy', true);
      /* v9.8 (B1) : plus de secousse sur une action du héros ou d'un compagnon */
    }
  }

  // v9.0.6 : distance du bond vers la cible (corps à corps) — le héros avance vers l'ennemi pour frapper.
  dashReach(targetX) {
    return Math.max(0, Math.min(26, targetX - HERO_X - 22));
  }

  // Projectile qui vole de (x0, y0) à (x1, y1) en `time` secondes (en cloche si `arc` > 0), puis effet d'impact.
  projectile(frames, x0, y0, x1, y1, time, { arc = 0, delay = 0, rotate = 0, impact = null, targetId, onHit = null, trail = null, trailVy } = {}) {
    this.effects.push({ kind: 'proj', frames, x0, y0, x1, y1, arc, rotate, life: time + delay, max: time, delay, targetId, onHit, trail, trailVy });
    // Ennemi visé : il reste affiché jusqu'à l'impact même si le coup l'a déjà tué (voir 'kill').
    if (targetId !== undefined) {
      this.inFlight ??= new Map();
      this.inFlight.set(targetId, Math.max(this.inFlight.get(targetId) ?? 0, this.time + delay + time));
    }
    if (impact) impact(delay + time);
  }

  // Effet dessiné (images d'un sprite jouées sur `life` secondes), centré en x, posé sur y.
  sprite(frames, x, y, life, { delay = 0, tint = null, vx = 0 } = {}) {
    this.effects.push({ kind: 'sprite', frames, x, y, life: life + delay, max: life, delay, tint, vx });
  }

  // Apparence d'un ennemi : sprite, échelle, palette (boss et variantes comme le loup des glaces).
  // Images : repos / marche (<nom>, <nom>_b) et attaque (<nom>_atk) quand elles existent.
  enemyLook(type, boss, attacking = false, phase = 0, moving = true, pace = 1) {
    const bossDef = boss ? BOSSES[type] : null;
    const def = boss ? ENEMIES[bossDef.base] : ENEMIES[type];
    const base = bossDef?.sprite ?? def.sprite;
    let frames = bossDef?.sprite || SPRITES[base]?.scale ? [base] : def.frames ?? [base]; // pleine définition : une image
    // v9.0.8 : pas de marche (bipèdes, quadrupèdes redessinés) : repos → pas 1 → repos → pas 2.
    if (moving && SPRITES[base]?.scale && SPRITES[`${base}_w1`]) frames = [base, `${base}_w1`, base, `${base}_w2`];
    if (frames.length === 1 && SPRITES[`${base}_b`]) frames = [base, `${base}_b`];
    // Marche : 6 images/s (4 pour les boss) ; au contact, respiration plus lente.
    const fps = (moving ? (boss ? 4 : 6) : 2.5) * pace; // v9.2.2 : `pace` (ruée, battements d'ailes à l'arrivée)
    const step = Math.floor(this.time * fps + phase);
    let sprite = frames[step % frames.length];
    if (attacking && SPRITES[`${base}_atk`]) sprite = `${base}_atk`;
    if (!SPRITES[sprite]) sprite = SPRITES[base] ? base : def.sprite;
    // v9.2.3 : table d'échelle (src/data/enemy-sizes.js) : taille crédible par rapport au héros, boss plus grands.
    const bossScale = bossDef ? bossDef.scale ?? 1 : 1;
    const ref = SPRITES[base] ?? SPRITES[sprite];
    // v9.2.4 : taille mesurée sur la silhouette visible (sans les marges du cadre), ramenée à la taille de référence de
    // sa créature (héros : 27 px visibles).
    const natural = (bossDef?.heroLike ? HERO_HEIGHT : visibleSize(ref) * (ref?.scale ?? 1)) * bossScale;
    const fit = sizeFactor(type, boss, bossDef?.tier, natural);
    return {
      step,
      // v9.0.7 : un sprite en pleine définition (chara design PixelLab) porte son propre facteur d'échelle.
      // v9.2.3 : `base` choisit les animations dessinées (boss compris).
      def: airDef(type, boss, def), sprite, base, heroLike: Boolean(bossDef?.heroLike), scale: bossScale * (SPRITES[sprite]?.scale ?? 1) * fit,
      colors: (bossDef ? bossDef.palette : def.palette) ?? null,
    };
  }

  flyHeight(type, boss) {
    const def = airDef(type, boss, boss ? ENEMIES[BOSSES[type].base] : ENEMIES[type]);
    return (def.flyHeight ?? 0) * WORLD_SCALE;
  }

  render(state, world, dt) {
    // Arrêt sur image (coup critique) : la scène ralentit fortement pendant un instant — le coup « pèse ».
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      dt *= 0.12;
    }
    this.time += dt;
    this.frameNo = (this.frameNo ?? 0) + 1;
    const ctx = this.ctx;
    // Réduire les animations (v9.1.0, réglage de l'appareil ou préférence du système ; ancien « mode concentration ») :
    // pas de secousses ni de particules d'ambiance, effets allégés.
    this.focus = Boolean(state.ui?.focus) || Boolean(this.calm);
    this.skillKey = heroAnimKey(activeHero(state).palette); // v9.2.5 : gestes de compétence du héros
    if (this.focus || state.ui?.shake === false) this.shake = 0; // v9.3.9 : réglage « Tremblement de l'écran »
    this.bigAuras = state.ui?.bigAuras === true; // v9.5.3
    this.capRings();
    const zoneIndex = currentEncounter(state).zoneIndex;
    this.underwater = Boolean(ZONES[zoneIndex]?.underwater); // v9.2.0 (monde marin) : on nage
    this.dt = dt;
    this.setTraversal(ZONES[zoneIndex]); // v9.2.1
    this.travWalking = Boolean(world.hero.walking);
    if (zoneIndex !== this.lastZone) {
      if (this.lastZone >= 0) this.zoneFade = 1;
      this.lastZone = zoneIndex;
    }
    for (const key of ['attack', 'hurt', 'victory', 'cast']) this.hero[key] = Math.max(0, this.hero[key] - dt);
    this.hero.respawn = Math.max(0, this.hero.respawn - dt);
    for (const k of ['dash', 'shoot', 'aim', 'shadow']) this.hero[k] = Math.max(0, this.hero[k] - dt);
    this.hero.deathTime += dt;

    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (this.shake > 0) {
      // v9.8 (B1) : secousse réservée aux événements de boss, plafonnée à 1,5 px, qui retombe vite.
      const amp = Math.min(this.shake, 1.5);
      ctx.translate(Math.round((Math.random() * 2 - 1) * amp), Math.round((Math.random() * 2 - 1) * amp));
      this.shake = Math.max(0, this.shake - dt * 16);
    }
    this.drawBackground(ctx, ZONES[zoneIndex], this.smoothScroll(world));
    // v9.0.8 : chacun dans sa case (chevalier | familier | compagnons) ; si l'équipe ne tient pas à gauche du
    // chevalier, tout le combat glisse vers la droite (en douceur) plutôt que de faire se chevaucher les personnages.
    this.layout = this.teamLayout(state);
    // v10.0 (8) : sur téléphone (portrait), le décalage est plafonné : au moins un ennemi reste à l'écran devant le héros
    // (l'arrière de l'équipe peut sortir à gauche).
    const wantShift = Math.min(Math.max(0, 3 - this.layout.left), this.tall ? Math.max(0, this.width - 130 - HERO_X) : 1e9);
    this.viewShift = this.viewShift === undefined ? wantShift : this.viewShift + (wantShift - this.viewShift) * Math.min(1, dt * 4);
    // v9.10 (6) : vitrine d'un compagnon — il est seul (pas de héros) et recentré à la place du héros.
    // v10.3 (audit) : une scène peut fixer elle-même son cadrage (fixedShift : l'Arène centre la mêlée entière).
    const shift = Number.isFinite(this.fixedShift) ? Math.round(this.fixedShift)
      : Math.round(this.viewShift) + (this.soloUnit ? Math.round((HERO_X - this.layout.left) * 0.55) : 0);
    ctx.save();
    ctx.translate(shift, 0);
    this.drawEnemies(ctx, world, dt);
    // v9.2.1 (marais) : l'équipe patauge — corps enfoncés (travLift) et coupés à la surface de l'eau.
    const wade = this.trav?.wade;
    if (wade) { ctx.save(); ctx.beginPath(); ctx.rect(-shift - 8, 0, this.width + 16, this.groundY - 2); ctx.clip(); }
    this.processAllyQueue(); // v10.0 (9.1)
    this.drawCompanions(ctx, state, world, dt);
    // v10.3 (audit) : tous les familiers de l'équipe (la campagne n'en a qu'un ; une formation d'Arène peut en avoir deux,
    // le second n'était ni placé ni dessiné).
    const pets = world.hero.dead ? [] : equippedCompanions(state).filter((c) => c.kind !== 'ally');
    for (let i = pets.length - 1; i >= 0; i--) this.drawPet(ctx, world, pets[i]);
    if (!this.soloUnit) this.drawHero(ctx, state, world);
    if (wade) ctx.restore();
    drawTeamFx(this, ctx, state, world, HERO_X);
    ctx.restore();
    this.drawBackground(ctx, ZONES[zoneIndex], this.smoothScroll(world), true); // premier plan
    ctx.save();
    ctx.translate(shift, 0);
    // Effets au ras du sol (halo des robes, souffle des ailes) : par-dessus les herbes du premier plan.
    for (const draw of this.groundFx ?? []) draw(ctx);
    this.drawTravGround(ctx, this.smoothScroll(world), dt); // v9.2.1 : traces, nuages, surface du marais
    this.groundFx = [];
    this.drawEffects(ctx, dt);
    drawSkillFx(this, ctx); // v9.2.5 : effets de compétence
    this.drawMutationFx(ctx, dt); // v9.2.3
    drawWorldVfx(this, ctx, ZONES[zoneIndex], world, HERO_X, state); // v9.2.6 : auras, malus, ambiance
    ctx.restore();
    ctx.restore();

    if (this.zoneFade > 0) {
      ctx.fillStyle = `rgba(10, 8, 16, ${Math.min(1, this.zoneFade)})`;
      ctx.fillRect(0, 0, this.width, this.height);
      this.zoneFade = Math.max(0, this.zoneFade - dt * 1.5);
    }
  }

  // Décor de la zone : dégradé du ciel puis calques peints (assets/bg, manifeste BG généré par
  // tools/art/scenery.py), du plus lointain au plus proche, chacun à sa vitesse de parallaxe.
  drawBackground(ctx, zone, scroll, front = false) {
    const bg = BG[zone.id] ?? BG.cursed; // (décor manquant : repli)
    const G = this.groundY;
    if (!front) {
      const stops = bg.sky;
      for (let y = 0; y < G; y += 3) {
        const t = Math.min(0.999, y / G) * (stops.length - 1);
        const i = Math.min(stops.length - 2, Math.floor(t));
        ctx.fillStyle = mixColor(stops[i], stops[i + 1], Math.round((t - i) * 4) / 4);
        ctx.fillRect(0, y, this.width, 3);
      }
      ctx.fillStyle = bg.ground;
      ctx.fillRect(0, G, this.width, this.height - G);
    }
    for (const l of bg.layers) {
      if (Boolean(l.front) !== front) continue;
      // Avant le sol : particules lointaines, entre le décor et les personnages.
      if (!front && l === bg.layers[bg.layers.length - 1 - bg.layers.filter((x) => x.front).length]) this.drawAmbient(ctx, zone, scroll, false);
      const y = l.anchor === 'top' ? l.y : G + l.y;
      this.drawLayer(ctx, layer(l.file), scroll * l.factor + this.time * (l.drift ?? 0), y);
    }
    if (!front) this.fillEarth(ctx); // v9.7.1 : la terre du monde sous le sol (plus de bande sombre vide)
    if (!front && zone.underwater) drawOceanBack(this, ctx, scroll); // v9.2.0 : rayons, poissons de fond, kelp
    if (front) this.drawAmbient(ctx, zone, scroll, true);
    if (front && zone.underwater) drawOceanFront(this, ctx, scroll, this.dt ?? 0); // caustiques, bulles, voile bleu
  }

  // v9.7.1 : recopie la bande de sol (pierres, herbe) vers le bas, assombrie avec la profondeur.
  fillEarth(ctx) {
    const k = this.k ?? 1;
    const top = (this.groundY + 4) * k, band = (GROUND_DEPTH - 6) * k, bottom = this.height * k;
    if (bottom - (top + band) < 2 || band <= 0) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let y = top + band; y < bottom; y += band) ctx.drawImage(this.canvas, 0, top, this.canvas.width, band, 0, y, this.canvas.width, band);
    const g = ctx.createLinearGradient(0, top + band, 0, bottom);
    g.addColorStop(0, 'rgba(10,8,6,0.35)');
    g.addColorStop(1, 'rgba(10,8,6,0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(0, top + band, this.canvas.width, bottom - top - band);
    ctx.restore();
  }

  // Particules d'ambiance : positions calculées à partir du temps (aucun état à garder).
  drawAmbient(ctx, zone, scroll, front) {
    const a = AMBIENT[zone.id];
    if (!a || this.focus) return;
    if (front && a.back) return; // v9.2.7 : jamais collées sur les personnages (étincelles des grottes)
    const factor = front ? 1.15 : 0.55;
    const W = this.width + 20;
    const H = this.groundY + 4;
    const top = a.low ? this.groundY - a.low : 0;
    const n = front ? Math.round(a.count / 3) : a.count;
    for (let i = 0; i < n; i++) {
      const seed = i * 97 + (front ? 13 : 0);
      const r1 = ((seed * 9301 + 49297) % 233280) / 233280;
      const r2 = ((seed * 4271 + 1013) % 7919) / 7919;
      const speed = 0.6 + r2 * 0.8;
      let x = (r1 * W + a.vx * speed * this.time - scroll * factor) % W;
      if (x < 0) x += W;
      let y = (r2 * (H - top) + a.vy * speed * this.time) % (H - top);
      if (y < 0) y += H - top;
      y += top;
      x += Math.sin(this.time * 1.3 + i) * a.wobble * 0.3;
      const color = a.colors[i % a.colors.length];
      const blink = a.glow ? 0.45 + 0.55 * Math.abs(Math.sin(this.time * (1.5 + r1) + i)) : 0.85;
      const X = Math.round(x - 10), Y = Math.round(y);
      ctx.fillStyle = color;
      // v9.2.7 : formes lisibles selon le monde.
      if (a.shape === 'sparkle') {
        const tw = Math.max(0, Math.sin(this.time * (1.2 + r1) + i * 2.1));
        if (tw < 0.2) continue;
        ctx.globalAlpha = tw * 0.9;
        ctx.fillRect(X, Y, 1, 1);
        if (tw > 0.6) { ctx.globalAlpha = (tw - 0.5); ctx.fillRect(X - 1, Y, 3, 1); ctx.fillRect(X, Y - 1, 1, 3); }
        continue;
      }
      if (a.shape === 'streak') {
        const len = 3 + Math.round(r1 * 5);
        ctx.globalAlpha = 0.35 * (front ? 1.4 : 1);
        ctx.fillRect(X, Y, len, 1);
        ctx.globalAlpha = 0.7;
        ctx.fillRect(X, Y, 1, 1);
        continue;
      }
      if (a.shape === 'bubble') {
        ctx.globalAlpha = front ? 0.7 : 0.45;
        if (r2 > 0.5) { ctx.fillRect(X, Y - 1, 1, 1); ctx.fillRect(X - 1, Y, 1, 1); ctx.fillRect(X + 1, Y, 1, 1); ctx.fillRect(X, Y + 1, 1, 1); } else ctx.fillRect(X, Y, 1, 1);
        continue;
      }
      ctx.globalAlpha = blink * (front ? 1 : 0.7);
      const size = front ? 2 : a.size;
      ctx.fillRect(X, Y, size, size);
      if (a.glow && front) {
        ctx.globalAlpha = blink * 0.25;
        ctx.fillRect(X - 1, Y - 1, size + 2, size + 2);
      }
    }
    if (!front && a.birds) this.drawBirds(ctx, a.birds);
    ctx.globalAlpha = 1;
  }

  // v9.2.7 : oiseaux en vol battu, haut dans le ciel (ailes en V, deux poses), en petite troupe ou en cercle (rapaces).
  drawBirds(ctx, b) {
    const W = this.width + 40;
    const skyH = Math.max(20, this.groundY - 90);
    ctx.fillStyle = b.color;
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < b.n; i++) {
      let x, y;
      if (b.circle) {
        const a = this.time * 0.35 + i * 2.4;
        x = this.width * (0.3 + 0.4 * ((i * 0.37) % 1)) + Math.cos(a) * 30;
        y = 18 + (i * 13) % skyH * 0.4 + Math.sin(a) * 8;
      } else {
        x = W - ((this.time * 14 + i * 9 + 200) % W) + (i % 2) * 6;
        y = 22 + (i % 3) * 6 + Math.round(Math.sin(this.time * 0.8) * 3);
      }
      const up = Math.floor(this.time * (b.circle ? 3 : 7) + i * 1.7) % 2 === 0;
      const s = b.size, X = Math.round(x), Y = Math.round(y);
      ctx.fillRect(X, Y, s, s); // corps
      if (up) { ctx.fillRect(X - s, Y - s, s, s); ctx.fillRect(X - 2 * s, Y - 2 * s, s, s); ctx.fillRect(X + s, Y - s, s, s); ctx.fillRect(X + 2 * s, Y - 2 * s, s, s); } else { ctx.fillRect(X - s, Y, s, s); ctx.fillRect(X - 2 * s, Y + s, s, s); ctx.fillRect(X + s, Y, s, s); ctx.fillRect(X + 2 * s, Y + s, s, s); }
    }
  }

  // v9.2.7 : traînée de frappe : ruban qui suit la pointe de l'arme pendant le geste (taille : croissant ; estoc
  // de lance ou de dague : trait droit), net (couleur pleine, bord clair), qui s'efface en 0,12 s. Coordonnées de
  // jeu ; l'arme reste dans la main (le ruban part de la moitié de la lame, jamais de la main).
  weaponTrail(ctx, held, weapon) {
    const pts = (this.trailPts ??= []);
    const now = this.time;
    if (held?.tipX != null && !this.focus) {
      const last = pts[pts.length - 1];
      const p = { t: now, x1: held.tipX, y1: held.tipY, x0: held.ax + (held.tipX - held.ax) * 0.7, y0: held.ay + (held.tipY - held.ay) * 0.7 };
      if (!last || Math.hypot(p.x1 - last.x1, p.y1 - last.y1) > 0.5) pts.push(p);
    }
    const LIFE = 0.12;
    while (pts.length && now - pts[0].t > LIFE) pts.shift();
    if (pts.length > 12) pts.splice(0, pts.length - 12);
    if (pts.length < 2) return;
    const color = TRAIL_COLORS[weapon?.rarity] ?? '#ffffff';
    const wf = weaponFx(weapon); // v9.3.2 : ruban plus large et plus vif selon la rareté
    for (let i = 1; i < pts.length; i++) {
      const a0 = pts[i - 1], b0 = pts[i];
      const widen = (p) => ({ ...p, x0: p.x1 + (p.x0 - p.x1) * wf.trail, y0: p.y1 + (p.y0 - p.y1) * wf.trail });
      const a = widen(a0), b = widen(b0);
      const k = 1 - (now - a.t) / LIFE;
      if (k <= 0) continue;
      ctx.globalAlpha = wf.trailAlpha * k;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.x0, a.y0); ctx.lineTo(a.x1, a.y1); ctx.lineTo(b.x1, b.y1); ctx.lineTo(b.x0, b.y0);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.95 * k;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(b.x1, b.y1); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // v9.3.2 : arme au repos selon sa rareté : lueur pulsée le long de la lame, particules qui en montent, aura
  // (légendaire). Visuel seulement ; coupé en mode effets réduits.
  weaponAura(ctx, held, weapon) {
    const wf = weaponFx(weapon);
    if (this.focus || !held || held.tipX == null || !wf.glow) return;
    const { ax, ay, tipX, tipY } = held;
    const pulse = 0.75 + 0.25 * Math.sin(this.time * wf.pulse * Math.PI);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.strokeStyle = wf.color;
    for (const [w, a] of [[6, 0.3], [3, 0.6], [1.2, 0.9]]) {
      ctx.globalAlpha = wf.glow * a * pulse;
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(ax + (tipX - ax) * 0.3, ay + (tipY - ay) * 0.3); ctx.lineTo(tipX, tipY); ctx.stroke();
    }
    if (wf.aura) {
      const g = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 9);
      g.addColorStop(0, wf.color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.35 * pulse; ctx.fillStyle = g; ctx.fillRect(tipX - 9, tipY - 9, 18, 18);
    }
    ctx.restore();
    this.moteAcc = (this.moteAcc ?? 0) + (this.dt ?? 0) * wf.motes;
    while (this.moteAcc >= 1) {
      this.moteAcc -= 1;
      const u = 0.3 + Math.random() * 0.7;
      this.effects.push({ kind: 'spark', x: ax + (tipX - ax) * u, y: ay + (tipY - ay) * u, vx: (Math.random() - 0.5) * 8, vy: -14 - Math.random() * 10,
        color: Math.random() < 0.3 ? '#ffffff' : wf.color, life: 0.5, max: 0.5 });
    }
  }

  // v9.3.2 : impact du coup de base selon la rareté de l'arme : étincelles en plus, onde (épique et légendaire).
  weaponImpact(x, y, weapon, crit = false) {
    const wf = weaponFx(weapon);
    if (this.focus || !wf.impact) return;
    // v10.1 (P5) : plus d'anneau de couleur (le « croissant violet » contre les Titans) à chaque coup : sur un critique
    // seulement, une traînée de 0,15 s ; les coups normaux gardent leurs étincelles.
    if (crit) this.critTrail(x - 8, y, wf.color);
    for (let i = 0; i < wf.impact; i++) {
      const a = -1.2 + Math.random() * 2.4, v = 40 + Math.random() * 80;
      this.effects.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 15, color: i % 2 ? wf.color : '#ffffff', life: 0.3, max: 0.3 });
    }
  }

  // v9.3.2 : compétence lancée avec une arme rare ou mieux : éclat de la couleur de l'arme autour du héros.
  weaponSkillFlourish(heroX, weapon) {
    const wf = weaponFx(weapon);
    if (this.focus || !wf.skill) return;
    const y = this.groundY - 18;
    this.effects.push({ kind: 'ring', x: heroX, y, color: wf.color, life: 0.45, max: 0.45, r: 12 + 10 * wf.skill });
    this.burst(heroX, y, wf.color, Math.round(8 * wf.skill), 40 + 20 * wf.skill);
  }

  // Arrondi au pixel d'écran (et non au pixel de jeu) pour les éléments en mouvement.
  snap(v) {
    return Math.round(v * this.k) / this.k;
  }

  // Défilement interpolé entre deux pas de simulation.
  smoothScroll(world) {
    const prev = world.prevScroll ?? world.scroll;
    return (prev + (world.scroll - prev) * Math.min(1, world.alpha ?? 1)) * WORLD_SCALE;
  }

  // Calque répété horizontalement, décalé de `offset` pixels.
  drawLayer(ctx, img, offset, y) {
    if (!img) return;
    const w = img.width;
    let x = -(this.snap(offset) % w);
    if (x > 0) x -= w;
    for (; x < this.width; x += w) ctx.drawImage(img, x, Math.round(y));
  }

  drawEnemies(ctx, world, dt) {
    const scrollPx = this.smoothScroll(world); // v9.2.2 : sol qui défile (trou, portail)
    for (let i = world.enemies.length - 1; i >= 0; i--) {
      const enemy = world.enemies[i];
      const fx = this.enemyFxFor(enemy.id);
      fx.appear = Math.min(1, fx.appear + dt * 5);
      // v9.2.5 : double de scissipare caché tant que sa moitié est en l'air (mutation-fx.js), visible d'un coup à l'atterrissage.
      if (fx.hold > 0) { fx.hold -= dt; fx.appear = fx.hold > 0 ? 0 : 1; }
      fx.hit = Math.max(0, fx.hit - dt);
      fx.hurt = Math.max(0, (fx.hurt ?? 0) - dt);
      fx.tele = Math.max(0, (fx.tele ?? 0) - dt); fx.skill = Math.max(0, (fx.skill ?? 0) - dt); // v9.7.1 (lot C)
      fx.lunge = Math.max(0, fx.lunge - dt);
      fx.squash = Math.max(0, (fx.squash ?? 0) - dt);
      fx.knock = (fx.knock ?? 0) * Math.exp(-dt * 14); // recul qui revient en douceur
      // En marche tant qu'il n'est pas au contact (état de la simulation, stable d'une image à l'autre :
      // comparer les positions entre deux images faisait clignoter l'animation, la simulation avançant par pas).
      // v9.2.5 : bloqué dans la file derrière un ennemi arrêté (`queued`, combat.js) : pose d'attente (respiration), sans
      // jouer la marche sur place ; il repart en marche dès que la file avance.
      const moving = !enemy.engaged && !enemy.queued;
      const alpha = Math.min(1, world.alpha ?? 1);
      const ex = this.wx((enemy.prevX ?? enemy.x) + (enemy.x - (enemy.prevX ?? enemy.x)) * alpha);

      // v9.2.3 : apparence des mutations (mutation-look.js) : taille (géant ×1,6, scissipare plus petit), cadence.
      const mutation = enemy.mutation ? mutationById(enemy.mutation) : null;
      const mPace = this.focus ? 1 : MUTATION_PACE[enemy.mutation] ?? 1;
      const { def, sprite, base, scale: lookScale, colors, heroLike, step } = this.enemyLook(enemy.type, enemy.boss, fx.lunge > 0, enemy.id * 0.37, moving,
        (enemy.rush && moving ? 2.2 : 1) * mPace);
      const scale = lookScale * mutationSize(enemy);
      // v9.2.5 : quadrupèdes : pattes du fond posées sur le sol (enemy-anchor.js groundLegs), hors marche (le pas lève les pattes).
      const quad = LEG_GROUNDED.has(base);
      const ecv = (key, o) => (quad && !/__walk\d+$/.test(key) && !/_w\d$/.test(key) ? groundLegs(spriteCanvas(key, o), spriteCanvas(key, { colors })) : spriteCanvas(key, o));
      this.enemyCanvas = ecv;
      const mutLook = (c) => (mutation && !heroLike && fx.hit <= 0 ? mutatedCanvas(c, mutation.id, Math.floor(this.time * 5 + enemy.id) % (SHEEN_STEPS * 3)) : c);
      // Le Chevalier déchu utilise le corps du héros, retourné, avec une épée sombre.
      const img = heroLike
        ? heroComposite(fx.lunge > 0 ? 'attack' : moving ? ['walk1', 'walk2'][Math.floor(this.time * 6) % 2] : 'idle',
          { weapon: { baseId: 'fallen_blade', rarity: 'epic' } }, fx.hit > 0, 'b', colors, true)
        : mutLook(ecv(sprite, { colors, flash: fx.hit > 0 }));
      const w = img.width * scale;
      const h = img.height * scale;
      // Rebond synchronisé sur l'image de marche (1 px sur la 2e image), jamais pour les volants.
      const hd = Boolean(SPRITES[sprite]?.scale);
      const bob = moving && !def.flyHeight && !hd && step % 2 ? 1 : 0;
      const hover = def.flyHeight ? def.flyHeight * WORLD_SCALE + this.snap(Math.sin(this.time * 4 + enemy.id) * 3) : 0;
      // v9.1.9 : attaque en trois temps (préparation, coup, retour) au lieu d'un simple glissement.
      fx.windup = Math.max(0, (fx.windup ?? 0) - dt);
      const atk = fx.lunge > 0 ? attackCurve(1 - fx.lunge / ENEMY_ATK) : fx.windup > 0 ? attackCurve(0.3 * (1 - fx.windup / 0.25)) : null;
      const lunge = atk ? (this.focus ? Math.max(0, atk.dx) >> 1 : atk.dx) : 0;
      // v9.2.2 : arrivée selon la nature de l'ennemi (src/data/arrivals.js) : à pied, en vol (descente en courbe
      // depuis le haut, battements d'ailes ou ondulation), à la nage, en sortant du sol ou d'un portail.
      // Remplace la chute depuis le haut de tous les boss (v9.1.9), incohérente pour un marcheur.
      const arrival = arrivalFor(enemy.type, enemy.boss, { underwater: this.underwater });
      const startX = this.width + 16;
      if (fx.arriveAt === undefined && ex < startX) {
        // Point de sortie du sol / portail fixe et bien visible à l'écran ; l'ennemi rejoint ensuite sa position.
        fx.arriveAt = this.time;
        fx.portalX = Math.min(ex, this.width - 20);
        fx.burrowX = Math.min(ex, this.width - w / 2 - 6);
        fx.anchor = scrollPx;
      }
      // Le trou et le portail restent attachés au sol quand le décor défile.
      if (fx.anchor !== undefined) { fx.bx = fx.burrowX - (scrollPx - fx.anchor); fx.px = fx.portalX - (scrollPx - fx.anchor); }
      // Fini d'arriver avant d'être touchable (portée de la ruée, BALANCE.rush.reach) : jamais tué en plein vol.
      const contactX = this.wx(BALANCE.world.heroX + BALANCE.world.meleeOffset + (def.range ?? 16) + (enemy.boss ? 8 : 0) + (BALANCE.rush?.reach ?? 0)) + 2;
      let k = fx.arriveAt === undefined ? 0 : arrivalProgress(this.time - fx.arriveAt, ex, startX, contactX, ARRIVE_SECONDS_BY_MODE[arrival.mode]);
      let pose = arrivalPose(arrival, k, { height: enemy.boss ? 90 : 70, time: this.time, focus: this.focus });
      // v9.6.4 (8.1) : respiration au repos — le monstre arrêté sur la ligne se soulève d'1 px par moments.
      if (k >= 1 && !this.focus && (enemy.engaged || enemy.queued) && !(fx.lunge > 0)) pose = { ...pose, dy: (pose.dy ?? 0) + (Math.sin(this.time * 2.6 + enemy.id * 1.7) > 0.55 ? 1 : 0) };
      // v9.2.3 : portail dessiné (PixelLab) : pas de second portail procédural.
      if (k < 1 && !fx.landed && !(arrival.mode === 'portal' && !heroLike && ENEMY_ANIMS[base]?.portal)) this.arrivalFx(enemy, fx, arrival, pose, k, ex, w, h);
      // v9.2.2 : position dessinée : sort du sol sur place, ou du portail (part de l'intérieur), puis rejoint ex.
      let exd = ex;
      if (k < 1 && arrival.mode === 'burrow' && fx.bx !== undefined) exd = fx.bx + (ex - fx.bx) * pose.settle;
      if (k < 1 && arrival.mode === 'portal' && fx.px !== undefined) exd = fx.px + w * 0.5 + (ex - fx.px - w * 0.5) * pose.settle;
      // v9.2.2 : battements d'ailes (wings.js) tant qu'il vole : à l'arrivée, et en combat s'il vole (flyHeight).
      const flying = !heroLike && arrival.mode === 'fly' && (k < 1 || def.flyHeight > 0 || (arrival.style === 'wings' && !WINGED_LANDERS.has(enemy.type)));
      // v9.2.3 : images dessinées (PixelLab) pour quelques ennemis ; les autres gardent les déformations procédurales.
      const atkP = fx.lunge > 0 ? 1 - fx.lunge / ENEMY_ATK : fx.windup > 0 ? 0.3 * (1 - fx.windup / 0.25) : null;
      // v9.2.3 : tous les ennemis et boss des mondes 1 à 12 (boss compris) ; nage sous l'eau, sortie du sol ou du portail dessinées.
      const anims = heroLike ? null : breathSafeAnims(base, ENEMY_ANIMS[base]); // v9.2.5 : sans la flamme dessinée en double
      // v9.2.5 : cadence de marche accordée à l'avance réelle par rapport au sol (pieds immobiles pendant l'appui) :
      // vitesse à l'écran moins le défilement du sol, lissée, divisée par le pas mesuré de l'animation (enemy-anchor.js).
      if (fx.lastEx !== undefined && dt > 0) {
        const v = Math.max(0, (fx.lastEx - ex - (scrollPx - fx.lastScroll)) / dt);
        fx.vRel = fx.vRel === undefined ? v : fx.vRel + (v - fx.vRel) * Math.min(1, dt * 8);
      }
      fx.lastEx = ex; fx.lastScroll = scrollPx;
      let walkStep = null;
      if (anims?.walk && moving) {
        const stride = animStride(anims.walk, (key) => ecv(key, { colors }));
        // Pas trop court pour être mesuré (gluants, robes, champignons : pas de pied posé) : cadence d'origine.
        // Cadence bornée entre la moitié et 4 fois celle dessinée (départ, arrêt, ruée, approche de loin où l'écran est resserré : wx).
        if (stride >= 1.5) {
          const fps = Math.max(anims.walk.fps * 0.5, Math.min(anims.walk.fps * 4, (fx.vRel ?? 0) / (stride * scale)));
          fx.walkStep = (fx.walkStep ?? enemy.id * 0.7) + dt * fps; walkStep = fx.walkStep;
        }
      }
      const drawn = pickAnimFrame(anims, {
        emerge: arrival.mode === 'burrow' && k < 1 ? pose.emerge : null, portal: arrival.mode === 'portal' && k < 1 ? Math.min(1, k / 0.85) : null,
        atkP, hurtP: fx.hurt > 0 && !this.focus ? 1 - fx.hurt / HURT_TIME : null, alt: (fx.swings ?? 0) % 2 === 0,
        skillP: fx.skill > 0 && !this.focus ? 1 - fx.skill / SKILL_TIME : null, teleP: fx.tele > 0 && !this.focus ? Math.min(0.999, 1 - fx.tele / TELE_TIME) : null, flying, swimming: this.underwater && arrival.mode === 'swim', moving, time: this.time * mPace, phase: enemy.id * 0.7, walkStep,
      });
      if (drawn && (drawn.anim === anims.emerge || drawn.anim === anims.portal)) { pose.buried = 0; pose.dx = 0; pose.dy = 0; pose.alpha = 1; } // la sortie est dessinée
      const drawnPortal = drawn?.anim === anims?.portal;
      // v9.2.5 : images dessinées recalées sur le sprite de base (pieds sur le sol, centre stable : enemy-anchor.js),
      // sauf en vol et à la nage (hauteur voulue).
      const baseBox = heroLike ? null : boxOf(ecv(base, { colors }));
      let dox = 0, doy = 0;
      if (drawn) {
        const name = Object.keys(anims).find((n) => anims[n] === drawn.anim);
        ({ ox: dox, oy: doy } = anchorOffset(baseBox, animBoxes(drawn.anim, (key) => ecv(key, { colors })), drawn.anim.frames.indexOf(drawn.key), name, drawn.anim,
          !flying && !def.flyHeight && !(this.underwater && arrival.mode === 'swim')));
      }
      const rig = flying && arrival.style === 'wings' && !drawn ? wingRig(sprite) : null;
      const wp = rig ? wingPose(this.time, enemy.id * 0.7, this.focus) : 0;
      // v9.2.3 : un flottement dessiné (`float`) garde l'ondulation procédurale par-dessus (balancement, traîne).
      const floating = flying && !rig && (!drawn || drawn.anim === anims?.float) && !(this.underwater && def.swim);
      const paint = (canvas, px, py) => {
        if (drawn && !floating) { ctx.drawImage(canvas, px + dox * scale, py + doy * scale, canvas.width * scale, canvas.height * scale); return; }
        if (rig) {
          const fr = wingFrames(canvas, rig)?.[wp];
          if (fr) { ctx.drawImage(fr.canvas, px - fr.pad * scale, py - fr.pad * scale, fr.canvas.width * scale, fr.canvas.height * scale); return; }
        }
        // Ondulation : balancement, bas qui ondule et traîne derrière pendant l'arrivée.
        if (floating && drawn) { floatDraw(ctx, canvas, px + dox * scale, py + doy * scale, canvas.width * scale, canvas.height * scale, { time: this.time, phase: enemy.id, amp: this.focus ? 0.6 : 2 + 4 * pose.wave, trail: this.focus ? 0 : 10 * pose.wave }); return; }
        if (floating) { floatDraw(ctx, canvas, px, py, w, h, { time: this.time, phase: enemy.id, amp: this.focus ? 0.6 : 2 + 4 * pose.wave, trail: this.focus ? 0 : 10 * pose.wave }); return; }
        ctx.drawImage(canvas, px, py, w, h);
      };
      if (k >= 1 && !fx.landed) {
        fx.landed = true;
        if (enemy.boss && !this.focus && arrival.mode !== 'walk' && !def.flyHeight && !this.underwater) {
          this.shake = Math.max(this.shake, 3); this.dust(ex - 10, 4); this.dust(ex + 10, 4); this.burst(ex, this.groundY - 4, '#e8d8b0', 10, 40);
        }
      }
      // v9.2.2 : ruée (équipe bien plus forte) : course rapide, poussière derrière.
      if (enemy.rush && moving && k > 0.3 && !this.focus && !def.flyHeight && !this.underwater && (this.frameNo + enemy.id) % 3 === 0) this.dust(ex + w / 2, 1);
      // Les grands sprites (boss, ogre…) restent devant le chevalier sans le chevaucher.
      const x = this.snap(Math.max(exd - w / 2, HERO_X + (enemy.boss ? 20 : 12)) - lunge + (fx.knock > 0.5 ? fx.knock : 0) + pose.dx);
      // v9.2.5 : pieds réels (bas opaque du sprite de base) sur le sol, et non le bas du cadre.
      // Images de pas (_w1/_w2) sans image dessinée : le pied au sol de chaque image reste sur la ligne du sol.
      const stepBox = !drawn && !heroLike && !flying && sprite !== base ? boxOf(ecv(sprite, { colors })) : null;
      const footH = baseBox && !heroLike ? (baseBox.bottom + 1) * scale + (stepBox ? (stepBox.bottom - baseBox.bottom) * scale : 0) : h;
      const y = this.groundY - footH - bob - hover + 1 - pose.dy - (rig && !this.focus ? WING_LIFT[wp] : 0) + Math.round(pose.buried * h);
      // Géométrie à l'écran (projectiles qui visent la cible, impacts, ennemi figé à la mort).
      Object.assign(fx, { sx: x, sy: y, sw: w, sh: h, seen: this.time, img, edge: x + bodyEdge(img) * scale });
      // v9.2.4 : image réellement affichée (image dessinée PixelLab et son décalage, ou sprite de base) : le corps figé,
      // la dissolution, les éclats et la division la reprennent, au lieu de superposer l'image de base décalée.
      const shown = drawn ? ecv(drawn.key, { colors }) : img;
      fx.vis = drawn
        ? { key: drawn.key, img: shown, x: x + dox * scale, y: y + doy * scale, w: shown.width * scale, h: shown.height * scale }
        : { key: heroLike ? null : sprite, img, x, y, w, h };

      ctx.globalAlpha = fx.appear * pose.alpha;
      if (pose.buried < 0.6 && pose.alpha > 0.3) this.drawShadow(ctx, exd + pose.dx, Math.max(6, w * 0.7 * (1 - Math.min(0.6, pose.dy / 120))));
      // v9.2.2 : sort du sol (seule la partie au-dessus de la ligne du sol se voit) ou du portail (partie sortie).
      const clipW = arrival.mode === 'portal' && k < 1 && !this.focus && !drawnPortal ? fx.px + Math.max(0, (k - 0.6) / 0.4) * w * 1.5 : this.width; // la partie encore dans le portail reste cachée
      const clipped = pose.buried > 0 || clipW < this.width;
      if (clipped) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, clipW, pose.buried > 0 ? this.groundY + 1 : this.height); ctx.clip(); }
      if (enemy.boss) this.drawBossAura(ctx, enemy, drawn?.key ?? sprite, colors, x, y, w, h, fx.appear, paint); // v9.2.3 : l'aura suit l'image dessinée
      // v9.0.8 : corps animé en continu (marche, sauts des gluants, trot, respiration ; buste projeté à l'attaque).
      const attackK = atk?.phase === 'strike' ? 1 : 0;
      const stepping = moving && hd && ['walk', 'quad'].includes(SPRITES[sprite]?.gait); // les images de pas suffisent
      const motion = def.flyHeight || heroLike || stepping || drawn ? { sx: 1, sy: 1, dy: 0, rot: 0 }
        : bodyMotion(sprite, this.time * (enemy.boss ? 0.75 : 1) + enemy.id * 0.61, moving, -1);
      if (attackK > 0) motion.dy += attackK * 2; // petit saut en frappant (le recul/élan horizontal existe déjà)
      withMotion(ctx, x + w / 2, y + h, motion, () => {
        if (enemy.elite) {
          // Élite errante : halo rouge pulsant.
          const glow = ecv(drawn?.key ?? sprite, { colors, tint: { color: '#ff3b3b', alpha: 1 } });
          ctx.globalAlpha = fx.appear * (0.5 + 0.3 * Math.sin(this.time * 8));
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) paint(glow, x + dx, y + dy);
          ctx.globalAlpha = fx.appear * pose.alpha;
        }
        if (mutation) {
          // v9.0.4 : ennemi muté — contour de la couleur de sa mutation ; v9.2.3 : plus épais et propre à chacune.
          const glow = ecv(drawn?.key ?? sprite, { colors, tint: { color: mutation.color, alpha: 1 } });
          this.drawMutationAura(ctx, enemy, mutation, glow, x, y, fx.appear * pose.alpha, paint, fx, { src: drawn ? ecv(drawn.key, { colors }) : heroLike ? img : ecv(sprite, { colors }), scale, moving, w, h, ox: drawn ? dox * scale : 0, oy: drawn ? doy * scale : 0 });
          ctx.globalAlpha = fx.appear * pose.alpha;
        }
        if (drawn) {
          paint(mutLook(ecv(drawn.key, { colors, flash: fx.hit > 0 })), x, y + (fx.squash > 0.07 ? 1 : 0)); // v9.2.3
        } else if (fx.squash > 0) {
          // Écrasement à l'impact (ancré aux pieds) : plus large et plus bas, très bref.
          // v9.1.9 : pixel-perfect : plus d'étirement non entier, le corps s'affaisse d'1 px puis revient.
          ctx.drawImage(img, x, y + (fx.squash > 0.07 ? 1 : 0), w, h);
        } else if (atk && atk.arm && hd && !heroLike && !def.flyHeight && SPRITES[sprite]?.gait === 'walk') {
          // v9.1.9 : le bras/l'arme bouge (segment tourné autour de l'épaule, voir enemy-anim.js).
          const sw = armSwing(img, atk.arm, -1);
          if (sw) ctx.drawImage(sw.canvas, x - sw.pad * scale, y - sw.pad * scale, sw.canvas.width * scale, sw.canvas.height * scale);
          else ctx.drawImage(img, x, y, w, h);
        } else if (this.underwater && def.swim) {
          // v9.2.0 (monde marin) : nage propre à chaque créature (queue, cloche, anguille ; le crabe marche).
          // v9.2.2 : ondulation bien plus ample pendant l'arrivée (corps et queue).
          swimDraw(ctx, img, x, y, w, h, { time: this.time, phase: enemy.id * 0.9, amp: (def.swim === 'eel' ? 2 : 1.5) * (1 + 2.5 * pose.wave), mode: def.swim, focus: this.focus, body: pose.wave });
        } else paint(img, x, y);
        // v9.2.5 : fente du Scissipare, par-dessus le corps (mutation-fx.js).
        if (mutation?.id === 'split' && !heroLike) this.drawSplitSeam(ctx, enemy, { src: drawn ? ecv(drawn.key, { colors }) : img, x, y, scale, ox: drawn ? dox * scale : 0, oy: drawn ? doy * scale : 0 }, fx.appear * pose.alpha);
      });
      if (clipped) ctx.restore();
      // v9.2.3 : pouvoir de l'ennemi (src/render/enemy-fx.js) : l'orbe du bâton brille à la préparation, le sort part
      // au coup ; le souffle sort de la gueule et va jusqu'au héros (longueur = distance, cône plus ouvert de loin).
      const power = heroLike ? null : powerOf(enemy.type);
      if (power && atkP !== null && !this.focus) {
        const shown = drawn ? ecv(drawn.key, { colors }) : img;
        const pts = powerPointsOf(shown);
        const ox = x + (drawn ? dox * scale : 0), oy = y + (drawn ? doy * scale : 0);
        const G = this.groundY;
        if (pts && power.kind === 'cast') {
          const tx = ox + pts.tip[0] * scale, ty = oy + pts.tip[1] * scale;
          if (atkP < CAST_RELEASE) drawOrbGlow(ctx, tx, ty, power.colors, atkP / CAST_RELEASE, this.time);
          else if (!fx.cast) {
            fx.cast = true;
            this.projectile(CAST_ORB[power.orb] ?? ['fx_spark'], tx, ty, HERO_X + 8, G - 20, 0.12, { trail: [power.colors[1]] });
            this.later(0.12, () => this.burst(HERO_X + 8, G - 20, power.colors[1], 8, 34));
          }
        } else if (pts && power.kind === 'breath' && atkP >= BREATH_START && !fx.breathed) {
          fx.breathed = true;
          // v9.2.5 : hydre : une des trois bouches, à tour de rôle (enemy-fx.js HEAD_MOUTHS).
          const head = power.heads ? (fx.headNo = ((fx.headNo ?? -1) + 1) % power.heads) : null;
          const mp = headMouth(drawn?.key ?? sprite, head) || pts.mouth; // v9.2.5 : gueule relevée à la main (MOUTHS)
          const mx = ox + mp[0] * scale, my = oy + mp[1] * scale;
          // v9.2.4 : la gueule suit l'ennemi pendant le souffle (recul, élan, déplacement) : le jet s'allonge ou se raccourcit
          // à chaque image selon la distance réelle jusqu'au héros.
          this.effects.push({ kind: 'breath', x0: mx, y0: my, x1: HERO_X + 6, y1: G - 18, colors: power.colors, short: power.short, life: 0.42, max: 0.42,
            enemyId: enemy.id, dx0: mx - x, dy0: my - y, head });
        }
      }
      if (atkP === null) { fx.cast = false; fx.breathed = false; }
      if (atk?.phase === 'strike' && !fx.smeared && !power && !(drawn && DRAWN_TRAIL.has(base))) { // v9.2.3 : traînée déjà dessinée
        // Traînée de frappe (arc de pixels) devant l'ennemi, une fois par coup.
        fx.smeared = true;
        this.sprite(['fx_slash1', 'fx_slash2', 'fx_slash3'], x - 4, this.groundY + 1 - this.waterLift(), 0.16, { tint: enemy.boss ? '#ff6a5a' : '#f0e6d0' });
        if (enemy.boss && !this.focus) this.shake = Math.max(this.shake, 2);
      }
      if (!atk) fx.smeared = false;
      // v9.2.3 : étiquette de la mutation (losange + nom) au-dessus de la barre de PV, à la place du seul losange.
      // v9.2.5 : étiquette et barre centrées sur la silhouette réelle, juste au-dessus de la tête (haut opaque du sprite
      // de base, sans le rebond ni l'élan de l'attaque), au lieu du centre et du haut du cadre.
      // Suit l'image affichée (tête réelle de l'image dessinée), lissé pour ne pas trembler d'une image à l'autre.
      const vb = heroLike ? null : boxOf(fx.vis.img);
      if (vb) {
        const kv = fx.vis.h / fx.vis.img.height;
        const tx = fx.vis.x + vb.cx * kv + lunge, ty = fx.vis.y + vb.top * kv + bob;
        // Lissage du décalage par rapport au corps (et non de la position : il suivrait l'ennemi avec retard).
        const a = fx.headDx === undefined ? 1 : Math.min(1, dt * 30);
        fx.headDx = fx.headDx === undefined ? tx - x : fx.headDx + (tx - x - fx.headDx) * a;
        fx.headDy = fx.headDy === undefined ? ty - y : fx.headDy + (ty - y - fx.headDy) * a;
      }
      const headX = vb ? Math.round(x + fx.headDx) : Math.round(exd);
      const headY = vb ? Math.round(y + fx.headDy) : y;
      if (mutation) this.drawMutationTag(ctx, enemy, mutation, headX, headY - 6, fx.appear * pose.alpha);

      if (enemy.boss) {
        // Aura pulsante et barre de vie large.
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(this.time * 5);
        ctx.fillStyle = '#ff4d6d';
        ctx.fillRect(x + 2, this.groundY + 1, w - 4, 1);
        ctx.globalAlpha = 1;
        this.drawBar(ctx, headX - 16, headY - 6, 32, enemy.hp / enemy.maxHp, '#e84a5f', this.ghostHp(fx, enemy));
        this.hpPercent(ctx, enemy, headX, headY + 1); // v9.8 (A) : on voit si les coups portent
        drawElementIcon(ctx, enemy.element, headX - 22, headY - 7);
      } else { // v9.5.1 (4.3) : barre toujours visible, à la couleur de l'élément du monstre
        this.drawBar(ctx, headX - 9, headY - 5, 18, enemy.hp / enemy.maxHp, enemy.elite ? '#ff9a3d' : mutation ? mutation.color : ELEMENT_BAR[enemy.element] ?? '#e84a5f', this.ghostHp(fx, enemy));
        if (enemy.hp < enemy.maxHp && enemy.hp / enemy.maxHp > 0.97) this.hpPercent(ctx, enemy, headX, headY + 1); // v9.8 (A)
        // v9.6.0 (6.3) : icône du comportement au-dessus de la barre ; estompée si l'équipe a la parade.
        if (enemy.behavior && BEHAVIORS[enemy.behavior]) {
          ctx.globalAlpha = world.parries?.[enemy.behavior] ? 0.45 : 1;
          ctx.drawImage(spriteCanvas(BEHAVIORS[enemy.behavior].icon), headX - 5, headY - 16, 10, 10);
          ctx.globalAlpha = 1;
        }
        drawElementIcon(ctx, enemy.element, headX - 15, headY - 6);
      }
      ctx.globalAlpha = 1;
    }
  }

  // Aura des boss selon leur rang : contour lumineux pulsant (plus épais et plus rouge pour les méga boss),
  // braises qui montent autour des boss durs et méga boss.
  drawBossAura(ctx, enemy, sprite, colors, x, y, w, h, appear, paint = (c, px, py) => ctx.drawImage(c, px, py, w, h)) {
    const tier = enemy.berserk ? 'berserk' : BOSSES[enemy.type]?.tier ?? 'mega';
    const look = BOSS_AURAS[tier];
    const glow = (this.enemyCanvas ?? spriteCanvas)(sprite, { colors, tint: { color: look.color, alpha: 1 } }); // v9.2.5 : même image que le corps
    const pulse = 0.5 + 0.5 * Math.sin(this.time * look.speed + enemy.id);
    ctx.globalAlpha = appear * (look.alpha + 0.25 * pulse);
    for (let r = 1; r <= look.width; r++) {
      for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r]]) paint(glow, x + dx, y + dy); // v9.2.2 : suit les ailes
    }
    ctx.globalAlpha = 1;
    if (look.embers && Math.random() < look.embers) {
      this.effects.push({
        kind: 'particle', x: x + Math.random() * w, y: y + h * (0.3 + Math.random() * 0.7), vx: (Math.random() - 0.5) * 6, vy: -18 - Math.random() * 14,
        color: Math.random() < 0.5 ? look.color : look.ember, life: 0.9, max: 0.9,
      });
    }
  }

  // v9.2.0 (nage) : hauteur moyenne du groupe au-dessus du sol sous l'eau (traînées de coups à cette profondeur).
  waterLift() {
    return this.underwater ? 2 : 0;
  }

  drawHero(ctx, state, world) {
    const hero = world.hero;
    const baseX = HERO_X - HERO_ANCHOR.x;
    const baseY = this.groundY - HERO_ANCHOR.y + 1;

    const palette = activeHero(state).palette;
    if (hero.dead) {
      // Héros à terre, qui s'estompe.
      const img = heroComposite('hurt', state.equipment, false, 'a', palette);
      ctx.save();
      ctx.globalAlpha = Math.max(0.2, 1 - this.hero.deathTime);
      ctx.translate(HERO_X, this.groundY);
      ctx.rotate(-Math.PI / 2);
      // v9.2.5 : couché SUR le sol, tête à gauche (avant, les axes étaient inversés : le corps passait sous le sol).
      ctx.drawImage(img, -(HERO_ANCHOR.x - 24), -HERO_ANCHOR.y + 2);
      ctx.restore();
      return;
    }

    // Animation : attaque en trois temps (élan, frappe, suite), sort, coup reçu, victoire, marche, respiration.
    // v9.0.6 : les tireurs gardent la pose de visée tant qu'un ennemi est à portée (l'arbalète est tenue à l'horizontale).
    const style = activeClass(state).style;
    const engaged = !hero.walking && world.enemies.length > 0;
    let frame = ['idle', 'idle2'][Math.floor(this.time * 2) % 2];
    if (style === 'ranged' && engaged && activeClass(state).id === 'archer') frame = this.hero.shoot > ATTACK_TIME - 0.14 ? 'shoot' : 'aim';
    else if (style === 'ranged' && engaged) frame = 'attack2';
    if (this.hero.attack > 0) {
      const t = ((this.hero.strikeTime ?? ATTACK_TIME) - this.hero.attack) * (ATTACK_TIME / (this.hero.strikeTime ?? ATTACK_TIME)); // v9.2.4 : geste raccourci
      frame = t < 0.07 ? 'attack1' : t < 0.17 ? 'attack2' : 'attack3';
    } else if (this.hero.cast > 0) frame = 'cast';
    else if (this.hero.hurt > 0) frame = 'hurt';
    else if (this.hero.victory > 0) frame = 'victory';
    else if (hero.walking) { const k = this.travWalk(0, true); frame = k ? `walk${k}` : 'idle'; } // v9.2.1 : cadence/glisse/saut du monde
    // v9.2.0 (nage) : hors frappe/sort/coup reçu, le héros nage toujours — les images de pas servent de brasse
    // (le bras libre pagaie), plus lentes ; la visée des tireurs est gardée.
    // v9.2.0 (nage) : crawl en 6 temps (STROKE) ; sur place, même nage plus lente. Le tir visé reste (redressé).
    const swimStep = strokeStep(this.time, hero.walking ? 8 : 5, 0, this.focus);
    if (this.underwater && (['idle', 'idle2', 'victory'].includes(frame) || frame.startsWith('walk'))) frame = STROKE[swimStep][0];

    const blink = this.hero.respawn > 0 && Math.floor(this.time * 12) % 2 === 0;
    if (blink) return;
    // Cape : flotte au vent en marchant, ondule doucement à l'arrêt.
    // v9.1.9 : cycle de 6 images (plus rapide en marche) ; « réduire les animations » : 2 images lentes.
    const cape = this.focus ? ['a', 'b'][Math.floor(this.time * 2) % 2]
      : 'abcdef'[Math.floor(this.time * (this.underwater ? 3 : hero.walking ? 12 : 5)) % 6]; // v9.2.0 : sous l'eau, la cape flotte lentement
    const img = heroComposite(frame, state.equipment, this.hero.hurt > 0.1, cape, palette);
    const jump = this.hero.victory > 0 ? Math.round(Math.abs(Math.sin(this.hero.victory * Math.PI * 2.5)) * 6) : 0;
    // v9.0.6 : corps à corps — le héros bondit vers l'ennemi pour frapper puis revient (aller-retour en cloche).
    const dashK = this.hero.dash > 0 ? Math.sin((1 - this.hero.dash / ATTACK_TIME) * Math.PI) : 0;
    const dash = Math.round(this.dashReach(this.hero.dashTo) * dashK);
    const recoil = this.hero.aim > ATTACK_TIME - 0.08 ? -1 : 0;
    const lean = (frame === 'attack2' && style !== 'ranged' ? 2 : frame === 'hurt' ? -2 : 0) + dash + recoil;
    if (this.hero.shadow > 0 && dash > 4) {
      // Assassin : images rémanentes violettes le long du bond.
      const ghost = heroComposite(frame, state.equipment, false, cape, palette);
      const tintGhost = spriteCanvasTint(ghost, '#a070ff');
      for (const f of [0.35, 0.7]) {
        ctx.globalAlpha = 0.35 * (1 - f / 2);
        ctx.drawImage(tintGhost, baseX + Math.round(dash * f), baseY - jump);
      }
      ctx.globalAlpha = 1;
    }

    this.drawShadow(ctx, HERO_X, this.underwater ? 14 : 22); // v9.2.0 : ombre réduite sous le nageur
    // Cri de guerre : aura dorée ; Rempart du golem : aura bleue (flammes d'énergie derrière le chevalier).
    for (const [active, tint] of [[world.buffs?.cry > 0, { color: '#ffc23a', alpha: 0.75 }], [world.buffs?.shield > 0, null]]) {
      if (!active) continue;
      const aura = spriteCanvas(Math.floor(this.time * 8) % 2 ? 'fx_aura1' : 'fx_aura2', tint ? { tint } : {});
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(this.time * 10);
      ctx.drawImage(aura, Math.round(HERO_X + 4 - aura.width / 2), this.groundY - aura.height + 1 - jump);
      ctx.globalAlpha = 1;
    }
    let lift = 0;
    let barY = baseY - 2 - jump;
    if (this.underwater) {
      // v9.2.0 (nage) : le héros nage couché, tête devant — sprites de crawl dessinés (tools/art/swim.py, 6 images :
      // bras qui tirent, jambes en ciseaux, cape et plumet qui traînent), petit élan à chaque traction, sillage de
      // bulles derrière les pieds ; balancement d'1 px au plus. Pour frapper/viser il se redresse, puis se recouche.
      lift = swimFloat(SWIM_DEPTH.hero, this.time, 0, this.focus);
      const striking = this.hero.attack > 0 || this.hero.cast > 0;
      const aiming = style === 'ranged' && engaged;
      const swimming = !striking && !aiming && this.hero.hurt <= 0;
      const tilt = this.hero.hurt > 0 ? 20 : striking ? (frame === 'attack1' ? 15 : 5) : 0;
      const surge = swimming ? STROKE[swimStep][1] : 0;
      if (striking && !this.swimStrike) { this.swimStrike = true; swirl(this, HERO_X - 8, baseY - lift + 26, 6); } // remous du redressement
      if (!striking) this.swimStrike = false;
      if (swimming) {
        // Crawl dessiné (6 images), arme le long du dos ; ondulation douce depuis la tête (cape, jambes).
        const sw = heroSwim(swimStep, state.equipment, palette, false);
        const px = HERO_X - SWIM_BODY.x - SWIM_AXIS.x + surge, py = this.groundY - 22 - lift - SWIM_BODY.y - SWIM_AXIS.y; // v9.2.1 : dessin agrandi
        const swim = ALLY_ANIMS[heroAnimKey(palette)]?.swim; // v9.2.3 : vrai crawl PixelLab (bras et jambes qui battent)
        if (swim) {
          ctx.drawImage(heroBackWeapon(state.equipment, 'swim'), px, py);
          const sf = loopFrame(swim, this.time, hero.walking ? 1 : 0.7);
          this.drawHeroFrame(ctx, sf, swim, knightHead(swim, swim.frames.indexOf(sf)), state.equipment, palette, px + swim.ox, py + swim.oy); // v9.2.4 : équipement porté
        } else swimDraw(ctx, sw, px, py, sw.width, sw.height, { time: this.time, amp: 1, mode: 'dolphin', focus: this.focus });
        barY = this.groundY - 22 - lift - 24;
      } else {
        // Redressé pour frapper / viser / encaisser (pose debout, à peine penchée), puis retour à la nage.
        const pose = swimPose(img, { tilt });
        ctx.drawImage(pose.canvas, baseX + lean - pose.ox, baseY - jump - lift - pose.oy);
      }
      this.mouthBubble = (this.mouthBubble ?? 1) - (this.dt ?? 0);
      if (this.mouthBubble <= 0 && !this.focus) {
        this.mouthBubble = (hero.walking ? 0.25 : 0.5) + Math.random() * 0.3;
        // Sillage derrière les pieds (le corps couché : pieds à gauche, à mi-hauteur).
        const midY = this.groundY - 22 - lift;
        addBubble(this, HERO_X - 34 + surge, midY + (Math.random() * 6 - 3), { vx: -22, vy: -6, r: Math.random() < 0.3 ? 2 : 1, life: 1.1 });
        if (Math.random() < 0.3) addBubble(this, HERO_X + 22, midY - 7, { vy: -16, r: 1, life: 2 }); // bouche
      }
    } else {
      // v9.2.1 : hauteur propre au monde (nuage, lévitation, enfoncé dans le marais) et effets aux pieds.
      lift = this.travLift(0);
      // v9.2.3 : marche et attaque dessinées image par image (PixelLab, ally-anim.js), arme en main.
      // v9.2.5 : geste de compétence, avec le vrai casque, la vraie armure et l'arme vraiment équipée (en main pour le
      // bâton et l'arc, rangée dans le dos sinon) ; Tourbillon : miroir alterné autour du corps (rotation).
      const sg = heroGesturePick(this);
      if (sg) {
        ctx.save();
        if (sg.flip) { ctx.translate(2 * HERO_X, 0); ctx.scale(-1, 1); }
        if (!sg.held) ctx.drawImage(heroBackWeapon(state.equipment), baseX, baseY - lift);
        drawHeroPick(ctx, sg, state.equipment, palette, baseX, baseY - lift);
        ctx.restore();
      }
      const anim = sg ? null : pickHeroAnim({ palette, equipment: state.equipment, classId: activeClass(state).id, style, weapon: state.equipment.weapon && itemBase(state.equipment.weapon.baseId)?.sprite,
        // v9.2.4 : marche PixelLab seulement au pas (glissade, sauts de nuage : poses composées), sans clignoter entre
        // la marche dessinée et la pose de repos à chaque temps de glisse ; cadence du monde (rate).
        walking: frame.startsWith('walk'), walkRate: this.trav?.rate ?? 1,
        gait: this.trav?.gait ?? 'walk', engaged, attack: this.hero.attack, shoot: this.hero.shoot, aim: this.hero.aim, cast: this.hero.cast,
        hurt: this.hero.hurt, victory: this.hero.victory, time: this.time, attackTime: ATTACK_TIME, strikeTime: this.hero.strikeTime ?? ATTACK_TIME, castTime: CAST_TIME }, (this.heroAnimMem ??= {}));
      // v9.2.3 : l'arme vraiment équipée (forme, rareté) est posée sur la prise de l'image, devant ou derrière le corps.
      // v9.2.5 : arme derrière ou devant selon la main, poing redessiné par-dessus la poignée (hero-draw.js).
      const hx = baseX + lean, hy = baseY - jump - lift;
      const held = anim ? drawHeroPick(ctx, anim, state.equipment, palette, hx, hy) : null;
      if (!anim && !sg) ctx.drawImage(img, baseX + lean, baseY - jump - lift);
      // v9.2.4 : frappe lancée en plein pas : la dernière image de marche (arme comprise) s'efface en 0,07 s
      // par-dessus la première image du geste, au lieu d'un saut de quelques pixels d'une image à l'autre.
      const kind = !anim ? 'pose' : anim.anim === ALLY_ANIMS[heroAnimKey(palette)]?.walk ? 'walk' : 'attack';
      if (this.heroLast?.kind === 'walk' && kind === 'attack') this.heroFade = { ...this.heroLast, left: HERO_FADE };
      if (kind !== 'attack') this.heroFade = null;
      if (this.heroFade && this.heroFade.left > 0) {
        const f = this.heroFade;
        ctx.globalAlpha = f.left / HERO_FADE;
        drawHeroPick(ctx, f.anim, state.equipment, palette, hx, hy); // v9.2.5 : même prise que l'image courante
        ctx.globalAlpha = 1;
        f.left -= this.dt ?? 0;
      }
      this.heroLast = { kind, anim, held };
      this.weaponEq = state.equipment.weapon;
      this.weaponAura(ctx, held, state.equipment.weapon); // v9.3.2
      // v9.2.7 : traînée seulement pendant la frappe (de l'image qui précède le coup jusqu'au coup), pas pendant l'élan.
      const fi = anim ? anim.anim.frames.indexOf(anim.name) : -1, hitI = anim?.anim.hit ?? 99;
      this.weaponTrail(ctx, kind === 'attack' && this.hero.attack > 0 && fi >= hitI - 2 && fi <= hitI + 1 ? held : null, state.equipment.weapon);
      this.travFeet('hero', HERO_X - 2, hero.walking, 0);
    }

    const stats = world.heroStats;
    if (stats) this.drawBar(ctx, HERO_X - 11 + dash, barY === baseY - 2 - jump ? barY - lift : barY, 22, hero.hp / stats.maxHp, '#5ad07a');
  }

  // v9.2.4 : image PixelLab du héros ; le chevalier y porte son vrai casque et sa vraie armure (pixel.js knightGearCanvas).
  drawHeroFrame(ctx, name, anim, head, equipment, palette, x, y) {
    if (heroWearsGear(palette, equipment) && head) {
      const g = knightGearCanvas(name, anim, head, KNIGHT_PIVOT, KNIGHT_NECK, equipment, palette);
      ctx.drawImage(g.canvas, x - g.m, y - g.m);
    } else ctx.drawImage(heroAnimCanvas(name, palette), x, y);
  }

  // Compagnons : suivent le chevalier, les volants planent au-dessus de son épaule.
  // Héros allié : à taille humaine derrière le chevalier ; marche, respiration, pose d'attaque.
  // v9.0.8 : déclenche le geste d'un compagnon et ses effets (au bon moment du geste).
  allyGesture(companion, world, heroX, skillType, ultimate = false, poseOnly = false) {
    const type = skillType ?? companion.skill?.type;
    const style = ALLY_STYLE[companion.id] ?? 'melee';
    const support = ['heal', 'shield', 'rally', 'gold'].includes(type);
    const kind = support ? 'support' : type === 'burst' ? 'burst' : style === 'archer' ? 'archer' : style === 'melee' ? 'melee' : 'cast';
    this.allyAnims ??= new Map();
    // v9.7.1 (lot B) : l'ultime joue son animation dédiée (ALLY_ANIMS[...].ultimate) quand elle existe.
    this.allyAnims.set(companion.id, { kind: ultimate && ALLY_ANIMS[companion.sprite]?.ultimate ? 'ultimate' : kind, start: this.time, max: ultimate ? 1.2 : ALLY_GESTURE_TIME[kind],
      color: (kind === 'support' ? SUPPORT_COLOR[type] : null) ?? companion.fx ?? '#ffffff' });
    const slot = this.layout?.slots.get(companion.id);
    const ax = slot?.cx ?? heroX - 30;
    const G = this.groundY;
    const color = companion.fx ?? '#ffffff';
    const front = world.enemies[0];
    // v10.0 (9.1) : contre un grand boss, la cible est le bord de sa silhouette (personne ne traverse le boss).
    const ffx = front ? this.enemyFx.get(front.id) : null;
    const tx = front ? (this.bigBoss && ffx?.edge ? ffx.edge : this.wx(front.x) - 4) : heroX + 40;
    // Ruée : 60 à 70 % de la distance jusqu'à la cible, au plus 70 px de jeu.
    const anim0 = this.allyAnims.get(companion.id);
    if (anim0) anim0.reach = Math.max(0, Math.min(70, (tx - ax) * 0.65));
    const [hdx, hdy] = handOf(companion.id);
    if (poseOnly) return; // v10.0 (9.1) : compétence dessinée — seulement le déplacement (ruée, pas en avant)
    const hit = (x) => {
      this.sprite(['fx_slash1', 'fx_slash2', 'fx_slash3'], x, G + 1 - this.waterLift(), 0.2, { tint: color });
      this.burst(x, G - 16, color, 8, 30);
      if (front) this.hitReact(front.id, x, { color });
    };
    if (kind === 'melee') {
      // v10.0 (9.1) : ruée jusqu'au-devant de la cible (0,12 s, images rémanentes), coup au contact, retour en 0,2 s
      // avec un petit saut arrière (allyGesturePose). Plus d'onde tranchante : elle reste aux compétences de zone.
      this.later(0.02, () => this.dust(ax, 3));
      this.later(0.33, () => hit(tx));
      this.later(0.82, () => this.dust(ax, 2));
    } else if (kind === 'archer') {
      // v10.0 (9.1) : un pas en arrière, la corde tendue tenue 0,15 s, puis la flèche part de l'arc.
      this.later(0.3, () => this.projectile(['fx_arrow'], ax - 2 + hdx, G - hdy, tx, G - 18, 0.22, {
        arc: 6, rotate: 1, targetId: front?.id, trail: ['#e8e0c8'], trailVy: 0, onHit: () => hit(tx) }));
    } else if (kind === 'cast') {
      // v10.0 (9.1) : un pas en avant, lueur de charge dans la main (0,25 s, couleur de l'élément), puis le projectile
      // part de la main à l'image du coup ; petit recul ensuite (allyGesturePose).
      const style2 = ALLY_STYLE[companion.id];
      const el = ELEMENTS[unitElement(companion.id)]?.color ?? color;
      this.later(0.1, () => { if (!this.focus) this.effects.push({ kind: 'handglow', id: companion.id, dx: hdx + 6, dy: hdy, color: el, life: 0.25, max: 0.25 }); });
      this.later(0.36, () => this.projectile(CAST_ORB[style2] ?? ['fx_spark'], ax + 6 + hdx, G - hdy, tx, G - 18, 0.3, {
        arc: 8, targetId: front?.id, trail: [color], onHit: () => { hit(tx); this.burst(tx, G - 18, color, 10, 40); } }));
    } else if (kind === 'burst') {
      this.later(0.3, () => {
        for (const e of world.enemies) {
          const x = this.wx(e.x);
          this.sprite(['fx_burst'], x, G - 2, 0.35, { tint: color });
          this.burst(x, G - 18, color, 6, 34);
        }
        /* v9.8 (B1) : plus de secousse sur une action du héros ou d'un compagnon */
      });
      this.later(0.6, () => this.dust(ax, 4));
    } else {
      // Soutien : étincelles de sa couleur qui volent vers le chevalier, puis anneau autour de lui.
      const c = SUPPORT_COLOR[type] ?? color;
      this.later(0.28, () => {
        for (let k = 0; k < 4; k++) {
          this.projectile(['fx_spark'], ax, G - 30 - k * 3, heroX, G - 24, 0.32, { delay: k * 0.05, arc: 10 + k * 3, trail: [c] });
        }
      });
      this.later(0.62, () => {
        // v9.7.1 (lot E) : soin, ralliement et bouclier dessinés (PixelLab, 12 images) au lieu d'un anneau tracé.
        const art = { heal: 'sk_heal', rally: 'sk_rally', shield: 'sk_shield' }[type];
        if (art && vfxReady() && !this.focus) vfx(this, art, heroX, G + 1, { size: art === 'sk_shield' ? 0.32 : 0.45, alpha: 0.6, back: true }); // v9.8.1 (I8) : sous les pieds
        else this.effects.push({ kind: 'ring', x: heroX, y: G - 14, color: c, life: 0.5, max: 0.5, r: 12 });
        if (type === 'gold') this.burst(heroX, G - 30, c, 10, 40);
      });
    }
  }

  // v9.7.1 (lot A) : compétence visible — nom au-dessus du compagnon (0,8 s, sa couleur), court halo ; ultime : ralenti de
  // 0,15 s et cadre coloré. Les noms se coupent dans Paramètres (SceneRenderer.skillNames).
  skillCallout(companion, event, world) {
    const known = (event.skill === 99 ? awakenedSkill(companion.id) : companionSkillList(companion, COMPANION_ROLES[companion.id] ?? 'pet')[event.skill]);
    const slot = this.layout?.slots.get(companion.id);
    const cx = slot?.cx ?? HERO_X - 30;
    const G = this.groundY;
    const color = ELEMENTS[unitElement(companion.id)]?.color ?? companion.fx ?? '#ffd23f'; // v9.9 (K11) : couleur de l'élément
    if (SceneRenderer.skillNames !== false && known?.name) {
      const half = Math.min(this.width / 2 - 2, known.name.length * 1.6 + 4); // v9.8 (E9) : bulle gardée dans le cadre
      const old = this.effects.filter((e) => e.kind === 'callout');
      if (old.length >= 3) this.effects.splice(this.effects.indexOf(old[0]), 1);
      this.pushCallout({ kind: 'callout', text: known.name, x: Math.max(half, Math.min(this.width - half, cx)), y: G - 46, color, life: 1, max: 1, half });
    }
    if (!this.focus) this.effects.push({ kind: 'halo', x: cx, y: G - 16, color, life: 0.35, max: 0.35 });
    if (event.ultimate) {
      // v9.7.1 (lot 3 bis) : un ultime est un moment — fond assombri 0,4 s, cadre coloré, puis une vague de sa couleur
      // qui traverse toute la scène (1,6 s) ; les personnages restent visibles (dessinée en liseré, pas en aplat).
      this.hitstop = Math.max(this.hitstop ?? 0, 0.15);
      this.effects.push({ kind: 'frame', color, life: 0.6, max: 0.6 });
      if (!this.focus) {
        this.effects.push({ kind: 'darken', life: 0.4, max: 0.4 });
        this.later(0.25, () => this.effects.push({ kind: 'sweep', x0: cx, color, life: 1.6, max: 1.6 }));
      }
    }
  }

  // v9.0.8 : position du corps d'un compagnon selon son geste (aucune déformation du dessin).
  // { dx, dy } en pixels de jeu (dy > 0 = vers le haut), glow = intensité du halo, ghosts = images rémanentes.
  allyPose(companion, walking, i) {
    const a = this.allyAnims?.get(companion.id);
    const t = this.time + i * 0.41;
    const gesture = this.allyGesturePose(companion, a);
    const pose = gesture ?? this.allyMovePose(companion, walking, t);
    const gait = allyGait(companion.sprite);
    if (gait === 'fly') {
      // Battement d'ailes : le corps remonte à chaque coup d'aile vers le bas. v9.2.7 : vol bien au-dessus du sol
      // (9 px, ombre au sol), au rythme du cycle de vol stationnaire PixelLab quand il existe.
      const hz = ALLY_ANIMS[companion.sprite]?.hover ? 1.5 : 4;
      const phase = (t * hz) % 1;
      pose.flap = phase;
      pose.dy = (gesture ? pose.dy : 0) + 9 + Math.sin(phase * Math.PI * 2 - Math.PI / 2) * -1.5;
    }
    if (gait === 'glide' && gesture) { pose.dy += 4; pose.glide = true; }
    // v9.11 (2) : l'équipe vit (grands boss) — tremble quand le boss frappe, se baisse derrière sa garde au jet de pierre.
    if (!this.focus && this.teamHurt > this.time) pose.dx = (pose.dx ?? 0) + (Math.floor(this.time * 40 + i) % 2 ? 1 : -1);
    if (!this.focus && this.teamBrace > this.time) pose.dy = (pose.dy ?? 0) - 2;
    return pose;
  }

  allyGesturePose(companion, a) {
    if (a) {
      const k = (this.time - a.start) / a.max;
      if (k >= 1 || k < 0) this.allyAnims.delete(companion.id);
      else {
        const arc = (p0, p1, h) => (k < p0 || k > p1 ? 0 : Math.sin(((k - p0) / (p1 - p0)) * Math.PI) * h);
        switch (a.kind) {
          case 'melee': { // v10.0 (9.1) : ruée (0,12 s), coup au contact, retour (0,2 s) avec un petit saut arrière
            const R = a.reach ?? 30;
            const dx = k < 0.14 ? R * (k / 0.14) : k < 0.72 ? R : R * Math.max(0, 1 - (k - 0.72) / 0.24);
            return { dx, dy: arc(0.72, 0.96, 4), glow: 0, ghosts: k < 0.16 || (k > 0.72 && k < 0.9), lunge: k < 0.72, color: a.color,
              arm: k < 0.25 ? -25 : k < 0.55 ? 40 : k < 0.7 ? 20 : 0 };
          }
          case 'burst':
            return { dx: arc(0.15, 0.75, 1), dy: k < 0.15 ? -1 : arc(0.15, 0.75, 10), glow: arc(0.1, 0.9, 0.9), ghosts: k > 0.2 && k < 0.7, color: a.color };
          case 'archer': // v10.0 (9.1) : un pas en arrière, corde tendue, tir, retour
            return { dx: k < 0.15 ? -2 * (k / 0.15) : k < 0.5 ? -2 : -2 * Math.max(0, 1 - (k - 0.5) / 0.4), dy: 0, glow: 0, color: a.color };
          case 'cast': // v10.0 (9.1) : un pas de 6 px en avant, sort, petit recul de 3 px, retour
            return { dx: k < 0.15 ? 6 * (k / 0.15) : k < 0.4 ? 6 : k < 0.55 ? 6 - 9 * ((k - 0.4) / 0.15) : -3 * Math.max(0, 1 - (k - 0.55) / 0.4),
              dy: arc(0.1, 0.5, 1.5), glow: arc(0.1, 0.45, 1), color: a.color };
          default: // soutien
            return { dx: 0, dy: arc(0, 1, 4), glow: arc(0, 1, 1), color: a.color };
        }
      }
    }
    return null;
  }

  // v9.0.8 : démarche selon le personnage — pas de marche (images de pas), vol, glissade ou sauts.
  allyMovePose(companion, walking, t) {
    const gait = allyGait(companion.sprite);
    if (gait === 'fly') return { dx: 0, dy: 5, glow: 0 }; // battement et hauteur ajoutés dans allyPose
    // Robe longue : flotte en permanence 2 à 3 px au-dessus du sol (balancement plus ample en avançant).
    if (gait === 'glide') return { dx: 0, dy: 4 + Math.sin(t * (walking ? 4.5 : 2)) * (walking ? 1 : 0.8), glow: 0, glide: true };
    if (walking && gait === 'hop') return { dx: 0, dy: Math.abs(Math.sin(t * 6)) * 4, glow: 0 };
    if (walking && this.trav && !this.underwater) {
      // v9.2.1 : cadence du monde (pas lents du marais, prudents sur la lave…) ; glisse, saut ou lévitation = pose de repos.
      const seed = (companion.id.length % 3) + 1;
      if (!this.travWalk(seed, true)) return { dx: 0, dy: 0, glow: 0 };
      return { dx: 0, dy: 0, glow: 0, step: Math.floor(this.time * 9 * this.trav.rate) };
    }
    if (walking) return { dx: 0, dy: 0, glow: 0, step: Math.floor(this.time * 9) }; // les images de pas portent le mouvement
    return { dx: 0, dy: (Math.sin(t * 2.2) + 1) * 0.35, glow: 0 };
  }

  drawAlly(ctx, world, companion, i) {
    const s = companion.sprite;
    const walking = world.hero.walking;
    const hd = Boolean(SPRITES[s]?.scale);
    const pose = this.allyPose(companion, walking, i);
    (this.allyPoseDx ??= new Map()).set(companion.id, pose.dx ?? 0); // v10.0 (9.1) : lueur de la main qui suit le corps
    // v9.2.0 (nage) : sous l'eau, pas de pas au sol — les images de pas battent lentement (brasse) et tout le
    // corps flotte à sa propre profondeur (voir plus bas).
    const swimming = this.underwater;
    if (swimming && pose.step !== undefined) pose.step = Math.floor(this.time * 6);
    else if (swimming && SPRITES[s]?.gait === 'walk' && !this.allyAnims?.get(companion.id)) pose.step = Math.floor(this.time * 5);
    if (swimming && !this.allyAnims?.get(companion.id) && SPRITES[s]?.gait !== 'fly') pose.dy = 0;
    // Anciens sprites (dessinés image par image) : leurs propres images de marche et d'attaque.
    let frame = s;
    if (pose.flap !== undefined && SPRITES[`${s}_f1`]) {
      // Ailes : hautes → milieu → basses → milieu.
      frame = pose.flap < 0.3 ? `${s}_f1` : pose.flap < 0.5 ? s : pose.flap < 0.8 ? `${s}_f2` : s;
    } else if (hd && pose.step !== undefined && SPRITES[`${s}_w1`]) {
      // Pas de marche synchronisé avec le chevalier : repos → pas 1 → repos → pas 2.
      frame = [s, `${s}_w1`, s, `${s}_w2`][(pose.step + i * 2) % 4];
    } else if (hd && pose.lunge && SPRITES[`${s}_w1`]) frame = `${s}_w1`; // pas en avant pour frapper
    if (!hd) {
      const a = this.allyAnims?.get(companion.id);
      if (a) frame = (this.time - a.start) / a.max < 0.3 && SPRITES[`${s}_wind`] ? `${s}_wind` : SPRITES[`${s}_atk`] ? `${s}_atk` : s;
      else if (walking && SPRITES[`${s}_w1`]) frame = [s, `${s}_w1`, s, `${s}_w2`][Math.floor(this.time * 9 + i * 2) % 4];
      else if (Math.floor(this.time * 2 + i) % 2 && SPRITES[`${s}_b`]) frame = `${s}_b`;
    }
    // v9.2.3 : marche, geste et nage dessinés image par image (PixelLab) : placés depuis le sprite de repos.
    const a0 = this.allyAnims?.get(companion.id);
    const pa = unitGesture(this, companion.id) ?? pickAllyAnim({ sprite: s, walking, swimming, gesture: a0 ? { kind: a0.kind, k: Math.min(1, (this.time - a0.start) / a0.max) } : null, time: this.time, seed: i * 0.37 });
    if (pa) frame = s;
    const img = spriteCanvas(frame);
    const sc = SPRITES[frame]?.scale ?? 1;
    const w = img.width * sc;
    const h = img.height * sc;
    const slot = this.layout?.slots.get(companion.id);
    const x0 = slot ? slot.x : HERO_X - 26 - i * 24 - w / 2;
    const cx0 = slot ? slot.cx : x0 + w / 2;
    const x = x0 + pose.dx;
    const lift = swimming ? swimFloat(SWIM_DEPTH[`ally${i}`] ?? 13, this.time, i * 2.1 + 1.3, this.focus) : 0;
    // v9.2.1 : hauteur propre au monde (sauf volants) et effets aux pieds.
    const tl = swimming || SPRITES[s]?.gait === 'fly' ? 0 : this.travLift((companion.id.length % 3) + 1);
    const y = this.groundY + 1 - h - pose.dy - lift - tl;
    if (!swimming && SPRITES[s]?.gait !== 'fly') this.travFeet(companion.id, cx0, walking, (companion.id.length % 3) + 1);
    // Poussière à chaque pas de marche.
    if (pose.step !== undefined) {
      this.allySteps ??= new Map();
      if (this.allySteps.get(companion.id) !== pose.step) {
        this.allySteps.set(companion.id, pose.step);
        if (!this.focus && !swimming && pose.step % 4 === 1) this.dust(cx0 - 3, 1);
      }
    }
    // Ailés : souffle au sol à chaque coup d'aile vers le bas (traits et poussière chassés des deux côtés).
    if (pose.flap !== undefined) {
      this.allyFlaps ??= new Map();
      const down = pose.flap >= 0.5 && pose.flap < 0.8;
      if (down && !this.allyFlaps.get(companion.id) && !this.focus && !swimming) {
        const gx = cx0 + pose.dx;
        this.effects.push({ kind: 'gust', x: gx, y: this.groundY - 1, color: '#f4fbff', life: 0.45, max: 0.45 });
        // Filets d'air qui descendent sous le personnage vers le sol.
        for (let k = -1; k <= 1; k++) {
          this.effects.push({ kind: 'ember', x: gx + k * 5, y: this.groundY - pose.dy - 2, vx: k * 6, vy: 40, life: 0.18, max: 0.18, color: '#ffffff' });
          this.effects.push({ kind: 'ember', x: gx + k * 5, y: this.groundY - pose.dy, vx: k * 6, vy: 40, life: 0.16, max: 0.16, color: '#dff0ff' });
        }
        for (const side of [-1, 1]) {
          this.effects.push({ kind: 'puff', x: gx + side * 3, y: this.groundY - 1, vx: side * (20 + Math.random() * 14), vy: -3 - Math.random() * 4,
            life: 0.35, max: 0.5, color: '#d8d0b8' });
        }
      }
      this.allyFlaps.set(companion.id, down);
    }
    // Robe longue : cercle lumineux au sol (par-dessus les herbes) et poussière d'étoiles qui tombe de l'ourlet ;
    // en avançant, la poussière forme une traînée derrière le personnage.
    if (pose.glide) {
      const color = companion.fx ?? '#bfe6ff';
      const gx = cx0 + pose.dx;
      const rw = Math.max(6, Math.round(w * 0.34));
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 3 + i);
      const G = this.groundY;
      (this.groundFx ??= []).push((c) => {
        c.globalAlpha = 0.3 + 0.15 * pulse;
        c.fillStyle = color;
        c.fillRect(Math.round(gx - rw + 2), G - 2, rw * 2 - 4, 3);
        c.globalAlpha = 0.75;
        c.fillRect(Math.round(gx - rw), G - 1, 2, 1);
        c.fillRect(Math.round(gx + rw - 2), G - 1, 2, 1);
        c.fillRect(Math.round(gx - rw + 2), G - 3, rw * 2 - 4, 1);
        c.fillRect(Math.round(gx - rw + 2), G + 1, rw * 2 - 4, 1);
        c.globalAlpha = 1;
      });
      this.allyMotes ??= new Map();
      if (!this.focus && this.time - (this.allyMotes.get(companion.id) ?? 0) > (walking ? 0.05 : 0.11)) {
        this.allyMotes.set(companion.id, this.time);
        this.effects.push({ kind: 'ember', x: gx + (Math.random() - 0.5) * w * 0.6, y: G - pose.dy + 1,
          vx: walking ? -24 - Math.random() * 12 : (Math.random() - 0.5) * 6, vy: walking ? 3 : 5 + Math.random() * 3,
          life: 0.7, max: 0.7, color: Math.random() < 0.5 ? '#ffffff' : color });
      }
    }
    // Ombre au sol : plus petite et plus claire quand le personnage est en l'air.
    ctx.globalAlpha = Math.max(0.35, 1 - (pose.dy + lift) / 18);
    this.drawShadow(ctx, cx0 + pose.dx, Math.max(10, w * 0.5 - pose.dy - lift / 2));
    ctx.globalAlpha = 1;
    if (this.maxStars(companion)) this.drawStarAura(ctx, cx0 + pose.dx, y, w, h, companion); this.gearGlow(ctx, cx0 + pose.dx, y, w, h, companion); // v9.3.3
    // Images rémanentes du saut, de la couleur du compagnon.
    if (pose.ghosts && !swimming) {
      const ghost = spriteCanvas(frame, { tint: { color: pose.color, alpha: 1 } });
      for (const [f, al] of [[0.45, 0.22], [0.8, 0.12]]) {
        ctx.globalAlpha = al;
        ctx.drawImage(ghost, x0 + pose.dx * (1 - f), y + pose.dy * f, w, h);
      }
      ctx.globalAlpha = 1;
    }
    // Halo de sort : silhouette lumineuse de sa couleur autour du corps.
    if (pose.glow > 0.02 && !swimming) {
      const glow = spriteCanvas(frame, { tint: { color: pose.color, alpha: 1 } });
      ctx.globalAlpha = 0.65 * pose.glow;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1]]) ctx.drawImage(glow, x + dx, y + dy, w, h);
      ctx.globalAlpha = 1;
    }
    if (!swimming) this.drawStarOutline(ctx, companion, frame, x, y, w, h);
    // v9.1.9 : compagnon à pied qui frappe : son bras/arme tourne autour de l'épaule (voir enemy-anim.js).
    const sw = pose.arm && SPRITES[frame]?.gait === 'walk' ? armSwing(img, pose.arm, 1) : null;
    if (pa) {
      const ai = spriteCanvas(pa.name);
      ctx.drawImage(ai, Math.round(x + pa.ox * sc), Math.round(y + pa.oy * sc), ai.width * sc, ai.height * sc);
    } else if (swimming) this.drawSwimmer(ctx, sw ? sw.canvas : img, sw ? Math.round(x - sw.pad * sc) : x, sw ? Math.round(y - sw.pad * sc) : y, sc, {
      gait: SPRITES[s]?.gait, gesture: Boolean(this.allyAnims?.get(companion.id)), walking, seed: i * 1.7 + 0.8, glow: pose.glow, color: pose.color, mouth: { x: cx0 + pose.dx - w * 0.6, y: y + h * 0.6 } });
    else if (sw) ctx.drawImage(sw.canvas, Math.round(x - sw.pad * sc), Math.round(y - sw.pad * sc), sw.canvas.width * sc, sw.canvas.height * sc);
    else ctx.drawImage(img, x, y, w, h);
  }

  // v9.2.0 (nage) : compagnon sous l'eau — penché vers l'avant, jambes (ou queue) en ciseaux, cheveux/robe qui
  // flottent ; les volants planent en ondulant sans se pencher ; l'attaque part de la nage (moins penché).
  drawSwimmer(ctx, img, x, y, sc, { gait, gesture, walking, seed, mouth, glow = 0, color = '#ffffff' }) {
    const fly = gait === 'fly';
    const glide = gait === 'glide';
    // Couchés tête devant (vol plané horizontal pour les volants, un peu moins couchés) ; redressés pour frapper.
    const tilt = gesture ? 15 : fly ? 55 : SWIM_TILT - 15; // ~65° : visage et bras restent lisibles sur les grands sprites
    const [back, front] = fly || glide || gesture ? [0, 0] : kickFrame(this.time, walking ? 10 : 6, seed * 3, this.focus, 1.5);
    const pose = swimPose(img, { tilt, back, front, legFrac: 0.3 });
    const surge = gesture || fly ? 0 : STROKE[strokeStep(this.time, walking ? 8 : 5, seed * 2, this.focus)][1];
    const px = x - pose.ox * sc + surge, py = y - pose.oy * sc;
    const w = pose.canvas.width * sc, h = pose.canvas.height * sc;
    if (glow > 0.02) {
      // Halo de sort autour de la pose de nage (silhouette teintée de sa couleur).
      const tint = document.createElement('canvas');
      tint.width = pose.canvas.width; tint.height = pose.canvas.height;
      const t = tint.getContext('2d', RF);
      t.drawImage(pose.canvas, 0, 0);
      t.globalCompositeOperation = 'source-in';
      t.fillStyle = color;
      t.fillRect(0, 0, tint.width, tint.height);
      ctx.globalAlpha = 0.65 * glow;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(tint, px + dx, py + dy, w, h);
      ctx.globalAlpha = 1;
    }
    // Cheveux/robe : bandes de 2 px qui ondulent (haut pour les cheveux ; ourlet pour une robe ; tout le corps en vol).
    // Ondulation du corps couché depuis la tête : robe en queue de sirène (ample), cheveux/jambes (légère).
    swimDraw(ctx, pose.canvas, px, py, w, h, { time: this.time, phase: seed, amp: gesture ? 0 : glide ? 2.5 : 1, mode: 'dolphin', focus: this.focus || gesture });
    this.allyBubbles ??= new Map();
    const next = this.allyBubbles.get(seed) ?? this.time + 0.5;
    if (!this.focus && this.time >= next) {
      this.allyBubbles.set(seed, this.time + 0.35 + Math.random() * 0.4);
      addBubble(this, mouth.x, mouth.y, { vx: -20, vy: -6, r: Math.random() < 0.4 ? 2 : 1, life: 1.2 }); // sillage derrière les pieds
    } else if (!this.allyBubbles.has(seed)) this.allyBubbles.set(seed, next);
  }



  // v9.3.3 : équipement épique ou légendaire porté → halo au sol de la couleur de la meilleure pièce et, pour une
  // légendaire, quelques étincelles. Purement visuel (les stats viennent des données), coupé en effets réduits.
  gearGlow(ctx, cx, top, w, h, companion) {
    if (this.focus || !this.state?.companionGear) return;
    const pieces = Object.values(unitGear(this.state, companion.id)).filter(Boolean);
    const best = ['legendary', 'epic'].find((r) => pieces.some((p) => p.rarity === r));
    if (!best) return;
    const color = best === 'legendary' ? '#ffc23a' : '#c87aff';
    const pulse = 0.6 + 0.4 * Math.sin(this.time * 3 + companion.id.length);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Halo autour du corps (vole ou marche : même rendu) + liseré au sol.
    const cy = top + h * 0.55, r = Math.max(w, h) * 0.6;
    const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.6, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = (best === 'legendary' ? 0.45 : 0.3) * pulse;
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    if (best === 'legendary' && Math.random() < 0.2) this.effects.push({ kind: 'spark', x: cx + (Math.random() - 0.5) * w, y: top + h - 2, vx: 0, vy: -18, color, life: 0.5, max: 0.5 });
  }

  // v8.9 : compagnon aux étoiles maximales → aura lumineuse (couleur de sa rareté) et étincelles qui montent.
  maxStars(companion) {
    return (this.state?.companions.owned[companion.id]?.stars ?? 0) >= COMPANION_RULES.maxCopies; // v9.1.3 : 5★ = 6 exemplaires
  }

  // v9.0.5 : aura façon « Super guerrier » — flammes en pixels qui montent autour du personnage, aux couleurs
  // propres à chacun (3 couches pour un SSR, 2 pour un SR, 1 sinon ; de l'extérieur vers le cœur), traits
  // d'énergie qui filent vers le haut et, pour les SSR, éclairs qui crépitent.
  drawStarAura(ctx, cx, top, w, h, companion) {
    // v9.5.3 (5.5) : effets lisibles — l'aura permanente se réduit au liseré (drawStarOutline) ; les grandes flammes
    // ne s'affichent que si le joueur les demande (Paramètres : « Grandes auras »), jamais en effets réduits.
    if (!this.bigAuras || this.focus) return;
    const colors = auraColors(companion);
    const layers = colors.length === 1 ? [colors[0], colors[0]] : colors;
    const feet = top + h;
    const t = this.time;
    const seed = companion.id.length * 7.3;
    for (let l = layers.length - 1; l >= 0; l--) {
      // Couche l : 0 = cœur (plus étroit, plus opaque) ; la dernière est la plus large.
      const k = layers.length > 1 ? l / (layers.length - 1) : 0;
      const half = Math.round(w * 0.32 + 2 + k * 5);
      const tall = h * 0.9 + 3 + k * 10;
      const alpha = 0.95 - k * 0.3;
      ctx.fillStyle = layers[l];
      for (let x = -half; x <= half; x++) {
        const u = x / half;
        const body = Math.pow(1 - u * u, 0.45);
        // Langues de flamme : bosses qui défilent vers le haut et vacillent à chaque colonne.
        const tongue = Math.pow(Math.max(0, Math.sin(u * 7 + seed + l * 1.7 - t * 5)), 3) * (5 + k * 5)
          + Math.max(0, Math.sin(x * 2.1 + t * 17 + l)) * 2;
        const y0 = Math.round(feet - tall * body - tongue * body);
        const y1 = Math.round(feet + 2 - (1 - Math.sqrt(1 - u * u)) * 4);
        if (y1 <= y0) continue;
        // Flamme « creuse » : intérieur translucide, bord vif (le personnage reste lisible).
        ctx.globalAlpha = alpha * 0.28;
        ctx.fillRect(Math.round(cx + x), y0, 1, y1 - y0);
        ctx.globalAlpha = alpha;
        ctx.fillRect(Math.round(cx + x), y0, 1, Math.min(y1 - y0, Math.abs(u) > 0.85 ? 8 : 3));
      }
    }
    // Traits d'énergie qui montent le long du corps.
    for (let n = 0; n < 8; n++) {
      const p = (t * 1.3 + n / 8 + seed) % 1;
      const sx = Math.round(cx + Math.sin(n * 2.4 + seed) * (w * 0.5 + 2));
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.95;
      ctx.fillStyle = n % 2 ? '#ffffff' : colors[0];
      ctx.fillRect(sx, Math.round(feet - p * (h + 12)), 1, 4 + (n % 3));
    }
    // SSR : éclairs qui crépitent par intermittence.
    if (companion.rarity === 'legendary') {
      const beat = Math.floor(t * 6);
      for (let b = 0; b < 2; b++) {
        if (((beat * 7 + b * 13 + Math.round(seed)) % 5) > 1) continue;
        ctx.globalAlpha = 1;
        ctx.fillStyle = b ? colors[colors.length - 1] : '#ffffff';
        let bx = Math.round(cx + (b ? 1 : -1) * (w * 0.35 + ((beat + b) % 3)));
        let by = Math.round(top + h * 0.15 + ((beat * 3 + b * 5) % Math.max(1, Math.round(h * 0.4))));
        for (let s = 0; s < 6; s++) {
          ctx.fillRect(bx, by, 1, 2);
          by += 2;
          bx += ((beat + s + b) % 3) - 1;
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // Contour net du personnage (couleur du cœur de son aura), dessiné juste avant son sprite pour le détacher des flammes.
  drawStarOutline(ctx, companion, sprite, x, y, w = null, h = null) {
    if (!this.maxStars(companion)) return;
    const glow = spriteCanvas(sprite, { tint: { color: auraColors(companion)[0], alpha: 1 } });
    ctx.globalAlpha = 0.9;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(glow, x + dx, y + dy, w ?? glow.width, h ?? glow.height);
    ctx.globalAlpha = 1;
  }

  // Familier : trottine aux pieds du chevalier (dessiné devant lui) ; les volants planent en battant des ailes.
  drawPet(ctx, world, companion) {
    const img = spriteCanvas(companion.sprite);
    const flying = FLYING_PETS.has(companion.id);
    const walking = world.hero.walking;
    const slot = this.layout?.slots.get(companion.id); // v9.0.8 : sa propre case, entre le chevalier et les compagnons
    const x = slot ? slot.x : HERO_X - 6 - img.width / 2;
    if (this.underwater) { this.drawSwimPet(ctx, companion, img, x, flying, walking); return; } // v9.2.0 (nage)
    // v9.2.3 : familier animé image par image (PixelLab) : marche/vol en boucle, geste ; placé depuis le sprite de repos.
    const a0 = this.allyAnims?.get(companion.id);
    const pa = unitGesture(this, companion.id) ?? pickAllyAnim({ sprite: companion.sprite, walking, swimming: false, always: true, time: this.time, seed: 0.5,
      gesture: a0 ? { kind: a0.kind, k: Math.min(1, (this.time - a0.start) / a0.max) } : null });
    const petImg = (dx, dy) => (pa ? ctx.drawImage(spriteCanvas(pa.name), dx + pa.ox, dy + pa.oy) : ctx.drawImage(img, dx, dy));
    // v10.0 (9.1) : le familier va frapper puis revient à sa case — bond (chat, renard, golem, hérisson, tortue),
    // piqué (hibou, phénix, dragonnet), rebond sur la cible (slime), passage en traînée (feu follet, fée).
    let mvx = 0, mvy = 0;
    if (a0 && !this.focus) {
      const k = Math.min(1, (this.time - a0.start) / a0.max);
      const R = a0.reach ?? 24;
      const out = k < 0.18 ? k / 0.18 : k < 0.6 ? 1 : Math.max(0, 1 - (k - 0.6) / 0.3);
      const arcK = (p0, p1) => (k < p0 || k > p1 ? 0 : Math.sin(((k - p0) / (p1 - p0)) * Math.PI));
      const style = PET_MOVE[companion.id] ?? 'bound';
      mvx = R * out;
      if (style === 'bound') mvy = 8 * arcK(0, 0.22) + 5 * arcK(0.6, 0.9);
      else if (style === 'bounce') mvy = 14 * arcK(0, 0.3) + 6 * arcK(0.3, 0.45) + 8 * arcK(0.6, 0.9);
      else if (style === 'dive') mvy = -18 * arcK(0, 0.6); // vers le bas (piqué), puis remontée
      if (style === 'streak' && k < 0.25 && Math.floor(this.time * 30) % 2) this.effects.push({ kind: 'spark', x: x + img.width / 2 + mvx - 6, y: this.groundY - (flying ? 30 : 10), vx: -30, vy: 0, color: companion.fx ?? '#9fe8ff', life: 0.2, max: 0.2 });
    }
    if (flying) {
      const hover = 30 + Math.sin(this.time * 3) * 3 + mvy;
      // Battement d'ailes : écrasement vertical rapide autour du centre du sprite.
      const flap = 1; // v9.0.8 : plus d'écrasement du dessin (vol = flottement)
      const cy = this.groundY - hover - img.height / 2;
      this.drawShadow(ctx, x + img.width / 2, img.width * 0.5);
      if (this.maxStars(companion)) this.drawStarAura(ctx, x + img.width / 2, cy - img.height / 2, img.width, img.height, companion); this.gearGlow(ctx, x + img.width / 2, cy - img.height / 2, img.width, img.height, companion); // v9.3.3
      ctx.save();
      ctx.translate(this.snap(x + mvx + img.width / 2), this.snap(cy));
      ctx.scale(LEFT_FACING_PETS.has(companion.id) ? -1 : 1, flap);
      this.drawStarOutline(ctx, companion, companion.sprite, -img.width / 2, -img.height / 2);
      petImg(-img.width / 2, -img.height / 2);
      ctx.restore();
      return;
    }
    // Petits bonds en marchant, avec écrasement à la réception.
    const phase = Math.abs(Math.sin(this.time * (walking ? 9 : 2.5)));
    // v9.0.8 : seul le slime avance par sauts ; chat et golem trottinent (petit balancement d'un pixel).
    const hopper = companion.id === 'golden_slime';
    const hop = (walking ? phase * (hopper ? 4 : 1) : phase * 0.6) + this.travLift(2.5) + mvy; // v9.2.1 : hauteur du monde
    this.travFeet(companion.id, x + img.width / 2, walking, 2.5, true);
    const squash = 1; // v9.0.8 : bonds sans écrasement du dessin
    this.drawShadow(ctx, x + img.width / 2, img.width * 0.8 - hop);
    if (this.maxStars(companion)) this.drawStarAura(ctx, x + img.width / 2, this.groundY - img.height, img.width, img.height, companion); this.gearGlow(ctx, x + img.width / 2, this.groundY - img.height, img.width, img.height, companion); // v9.3.3
    ctx.save();
    ctx.translate(this.snap(x + mvx + img.width / 2), this.groundY + 1 - this.snap(hop));
    ctx.scale((2 - squash) * (LEFT_FACING_PETS.has(companion.id) ? -1 : 1), squash);
    this.drawStarOutline(ctx, companion, companion.sprite, -img.width / 2, -img.height);
    petImg(-img.width / 2, -img.height);
    ctx.restore();
  }

  // v9.2.0 (nage) : familier sous l'eau — chat/golem pagaient (avant relevé, tête hors de l'eau façon nage du
  // chien, pattes qui battent vite), les volants ondulent plus haut, le slime flotte et pulse (cloche qui ondule).
  drawSwimPet(ctx, companion, img, x, flying, walking) {
    const slime = companion.id === 'golden_slime';
    const lift = swimFloat(flying ? SWIM_DEPTH.pet + 20 : SWIM_DEPTH.pet, this.time, 2.6, this.focus);
    let canvas = img, ox = 0, oy = 0, mode = 'body', amp = 0, surge = 0;
    if (flying) { ({ canvas, ox, oy } = swimPose(img, { tilt: 15 })); mode = 'dolphin'; amp = 2; } // vol plané penché
    else if (slime) { mode = 'jelly'; amp = 1.5; surge = !this.focus && Math.floor(this.time * 3) % 2 ? 1 : 0; } // avance par contractions
    else {
      // Nage du chien en ligne : tête devant à peine relevée, pattes qui pagaient vite.
      const [back, front] = kickFrame(this.time, walking ? 12 : 8, 1, this.focus, 1);
      ({ canvas, ox, oy } = swimPose(img, { tilt: -6, back, front, legFrac: 0.4 }));
      surge = STROKE[strokeStep(this.time, walking ? 10 : 7, 1, this.focus)][1] > 0 ? 1 : 0;
    }
    // Pulsation du slime : il se tasse d'1 px puis se relâche (sans étirement).
    const pulse = slime && !this.focus && Math.floor(this.time * 3) % 2 ? 1 : 0;
    const px = this.snap(x) - ox + surge, py = this.groundY + 1 - img.height - lift - oy + pulse;
    ctx.globalAlpha = 0.6;
    this.drawShadow(ctx, x + img.width / 2, img.width * 0.6);
    ctx.globalAlpha = 1;
    if (this.maxStars(companion)) this.drawStarAura(ctx, x + img.width / 2, py + oy, img.width, img.height, companion); this.gearGlow(ctx, x + img.width / 2, py + oy, img.width, img.height, companion); // v9.3.3
    const mirror = LEFT_FACING_PETS.has(companion.id); // v9.3.3
    if (mirror) { ctx.save(); ctx.translate(2 * this.snap(x) + img.width, 0); ctx.scale(-1, 1); }
    if (canvas === img) this.drawStarOutline(ctx, companion, companion.sprite, px, py);
    const pa = pickAllyAnim({ sprite: companion.sprite, walking, swimming: true, time: this.time, seed: 0.5 }); // v9.2.3 : nage PixelLab
    if (pa) ctx.drawImage(spriteCanvas(pa.name), this.snap(x) + pa.ox, this.groundY + 1 - img.height - lift + pa.oy);
    else swimDraw(ctx, canvas, px, py, canvas.width, canvas.height, { time: this.time, phase: 2.2, amp, mode, focus: this.focus || amp === 0 });
    if (mirror) ctx.restore();
    this.petBubble = (this.petBubble ?? 0.7) - (this.dt ?? 0);
    if (this.petBubble <= 0 && !this.focus) {
      this.petBubble = 1 + Math.random();
      addBubble(this, x + img.width * 0.8, py + oy + 2, { vy: -14, r: 1, life: 1.8 });
    }
  }

  // v9.0.8 : rang de l'équipe, de droite à gauche — chevalier | familier | 1er compagnon | 2e compagnon. Chaque
  // personnage a sa case, de la largeur réelle (opaque) de son sprite, avec 3 px d'écart : aucun chevauchement.
  teamLayout(state) {
    const GAP = this.bigBoss ? 8 : 3; // v10.0 (4) : grands boss — au moins 24 px d'écran entre deux cases
    const team = equippedCompanions(state);
    const heroImg = heroComposite('idle', state.equipment, false, 'a', activeHero(state).palette);
    let cursor = HERO_X - HERO_ANCHOR.x + opaqueSpan(heroImg).l - GAP;
    // v9.2.1 : sous l'eau, les corps sont couchés : chaque case prend la largeur de la pose de nage réellement
    // dessinée (nageur agrandi, compagnons penchés, familier), 4 px d'écart pour l'élan des brasses.
    const wet = this.underwater;
    let wetAllies = 0;
    if (wet) {
      const sw = heroSwim(0, state.equipment, activeHero(state).palette, false);
      cursor = HERO_X - SWIM_BODY.x - SWIM_AXIS.x + opaqueSpan(sw).l - GAP;
    }
    const slots = new Map();
    const place = (c) => {
      const img = spriteCanvas(c.sprite);
      const sc = SPRITES[c.sprite]?.scale ?? 1;
      if (wet && !(c.kind !== 'ally' && c.id === 'golden_slime')) {
        const ally = c.kind === 'ally';
        const fly = ally ? SPRITES[c.sprite]?.gait === 'fly' : FLYING_PETS.has(c.id);
        const pose = swimPose(img, { tilt: ally ? (fly ? 55 : SWIM_TILT - 15) : fly ? 15 : -6 });
        const span = opaqueSpan(pose.canvas);
        // v9.2.1 : le 2e compagnon nage plus bas que le 1er (SWIM_DEPTH) : il peut glisser de 60 % sous lui, ce qui
        // garde de la place aux ennemis sur téléphone sans que les corps se recouvrent.
        const tuck = ally && wetAllies++ > 0 ? Math.round((span.r - span.l + 1) * sc * 0.6) : 0;
        const x = cursor - (span.r + 1) * sc + pose.ox * sc - 2 + tuck;
        slots.set(c.id, { x, cx: x + (img.width / 2) * sc });
        cursor = x - pose.ox * sc + span.l * sc - GAP;
        return;
      }
      const span = opaqueSpan(img);
      const x = cursor - (span.r + 1) * sc; // bord opaque droit du personnage collé à la case précédente
      slots.set(c.id, { x, cx: x + ((span.l + span.r + 1) / 2) * sc });
      cursor = x + span.l * sc - GAP;
    };
    team.filter((c) => c.kind !== 'ally').forEach(place); // v10.3 (audit) : chaque familier a sa case (un seul en campagne)
    team.filter((c) => c.kind === 'ally').forEach(place);
    return { slots, left: cursor + GAP };
  }

  drawCompanions(ctx, state, world, dt) {
    this.state = state;
    if (world.hero.dead) return;
    // Du plus éloigné au plus proche : 2e compagnon puis 1er (le familier est dessiné après le chevalier).
    const team = equippedCompanions(state);
    const allies = team.filter((c) => c.kind === 'ally');
    for (let i = allies.length - 1; i >= 0; i--) this.drawAlly(ctx, world, allies[i], i);
  }

  // v9.8 (A) : pourcentage de vie restante sous la barre (deux décimales tant que la barre bouge à peine) : un gros
  // chiffre de dégâts sans effet visible ne trompe plus le joueur.
  hpPercent(ctx, enemy, cx, y) {
    const r = Math.max(0, enemy.hp / enemy.maxHp) * 100;
    const t = `${r > 99 ? r.toFixed(2) : r.toFixed(r > 10 ? 0 : 1)} %`.replace('.', ',');
    ctx.save();
    ctx.font = '700 5px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 2; ctx.strokeStyle = '#120c1c'; ctx.strokeText(t, cx, y + 4);
    ctx.fillStyle = '#ffd6dc'; ctx.fillText(t, cx, y + 4);
    ctx.restore();
  }

  drawBar(ctx, x, y, w, ratio, color, ghost = 0) {
    const filled = Math.max(0, Math.round(w * Math.min(1, ratio)));
    ctx.fillStyle = '#1a1226';
    ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle = '#3a2a40';
    ctx.fillRect(x, y, w, 3);
    // v9.3.9 (2.3) : la vie perdue reste un instant en blanc, puis descend (barre en deux temps).
    const g = Math.max(filled, Math.round(w * Math.min(1, ghost)));
    if (g > filled) { ctx.fillStyle = '#fff4e0'; ctx.fillRect(x + filled, y, g - filled, 3); }
    ctx.fillStyle = color;
    ctx.fillRect(x, y, filled, 3);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillRect(x, y, filled, 1);
  }

  // v9.3.9 : part blanche de la barre de vie — tient 0,35 s après le dernier coup, puis rattrape la vraie vie.
  ghostHp(fx, enemy) {
    const r = enemy.hp / enemy.maxHp;
    if (!fx) return r;
    if (fx.ghost === undefined || r > fx.ghost) { fx.ghost = r; fx.ghostR = r; fx.ghostAt = this.time; }
    if (r < (fx.ghostR ?? r)) { fx.ghostR = r; fx.ghostAt = this.time; }
    if (this.time - fx.ghostAt > 0.35) fx.ghost = Math.max(r, fx.ghost - (this.dt ?? 0.016) * 1.6);
    return fx.ghost;
  }

  // Ombre portée ovale sous un personnage.
  drawShadow(ctx, cx, w) {
    ctx.fillStyle = 'rgba(10, 20, 10, 0.28)';
    const half = Math.round(w / 2);
    ctx.fillRect(Math.round(cx - half + 2), this.groundY, half * 2 - 4, 1);
    ctx.fillRect(Math.round(cx - half), this.groundY + 1, half * 2, 2);
    ctx.fillRect(Math.round(cx - half + 2), this.groundY + 3, half * 2 - 4, 1);
  }

  drawEffects(ctx, dt) {
    const coin = spriteCanvas('coin');
    const spawned = []; // particules créées pendant le parcours (ajoutées après le filtrage)
    this.spawnSink = spawned; // v9.2.1 : remous créés par water-fx.js pendant le parcours
    const finished = []; // appels de fin d'effet (impacts…), exécutés après le filtrage
    this.effects = this.effects.filter((fx) => {
      fx.life -= dt;
      if (fx.life <= 0) {
        // Fin d'un effet : appel différé, ou projectile qui touche sa cible (exécutés après le tri de la liste,
        // sinon les effets qu'ils créent seraient perdus).
        if (fx.kind === 'call') finished.push(fx.fn);
        if (fx.kind === 'proj' && fx.onHit) finished.push(() => fx.onHit(fx.cx ?? fx.x1, fx.cy ?? fx.y1));
        return false;
      }
      const t = fx.life / fx.max;
      if (this.underwater && waterAccent(this, ctx, fx, dt, t)) return true; // v9.2.1 : accents aquatiques des attaques
      switch (fx.kind) {
        case 'text':
          if (fx.cx !== undefined && drawDamageText(this, ctx, fx)) break; // v9.2.6 : chiffre en cache, rebond
          fx.y -= (fx.life > fx.max - 0.12 ? 60 : 14) * dt; // petit rebond puis montée lente (positions au pixel d'écran)
          ctx.globalAlpha = Math.min(1, t * 2.5);
          if (fx.pop && fx.life > fx.max - 0.16) {
            // Critique : le chiffre jaillit en double taille, puis reprend sa taille.
            const wText = textWidth(fx.text, FONT_BIG);
            ctx.save();
            ctx.translate(Math.round(fx.x + wText / 2), this.snap(fx.y));
            ctx.scale(2, 2);
            drawBigText(ctx, fx.text, -Math.round(wText / 2), -4, fx.color, fx.light);
            ctx.restore();
          } else drawBigText(ctx, fx.text, Math.round(fx.x), this.snap(fx.y), fx.color, fx.light);
          break;
        case 'breath': { // v9.2.3
          const src = this.enemyFx.get(fx.enemyId);
          if (src?.seen > this.time - 0.1) {
            // v9.2.5 : la gueule (ou la tête choisie de l'hydre) est relue sur l'image affichée à chaque image : le jet
            // suit la tête pendant l'animation ; image sans repère : même décalage qu'à l'image précédente.
            const v = src.vis;
            const p = v?.img ? (headMouth(v.key, fx.head) ?? powerPointsOf(v.img)?.mouth) : null; // v9.2.5 : gueule relevée (MOUTHS)
            if (p) { fx.x0 = v.x + (p[0] * v.w) / v.img.width; fx.y0 = v.y + (p[1] * v.h) / v.img.height; fx.dx0 = fx.x0 - src.sx; fx.dy0 = fx.y0 - src.sy; }
            else { fx.x0 = src.sx + fx.dx0; fx.y0 = src.sy + fx.dy0; }
          }
          drawBreath(ctx, fx, t, this.time);
          break;
        }
        case 'vfx': // v9.2.6 : effet dessiné par PixelLab (vfx.js)
          drawVfx(this, ctx, fx, dt);
          break;
        case 'callout': { // v9.7.1 (lot A) : nom de la compétence, petit texte de la couleur du compagnon
          if (tooShort(tr(fx.text))) break; // v10.1 (P5)
          ctx.save();
          ctx.globalAlpha = Math.min(1, t * 4);
          ctx.font = '800 6px system-ui, "Noto Sans KR", "Malgun Gothic", sans-serif';
          ctx.textAlign = 'center';
          const y = fx.y - (1 - t) * 4;
          ctx.lineWidth = 2; ctx.strokeStyle = '#120c1c'; ctx.strokeText(tr(fx.text), fx.x, y);
          ctx.fillStyle = fx.color; ctx.fillText(tr(fx.text), fx.x, y);
          ctx.restore();
          break;
        }
        case 'halo': { // v9.7.1 (lot A) : court halo de la compétence, autour du compagnon (un liseré, pas un aplat)
          ctx.globalAlpha = t * 0.8;
          ctx.strokeStyle = fx.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(fx.x, fx.y, 9 + (1 - t) * 6, 14 + (1 - t) * 6, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'darken': { // v9.7.1 (lot 3 bis) : fond assombri pendant l'annonce d'un ultime
          // v9.8 (E3) : dessiné sans le décalage de l'équipe ni la secousse — avant, une bande à gauche restait claire
          // (« bande de ciel plus claire ») quand l'équipe était décalée de plus de 40 px.
          const m = ctx.getTransform(); ctx.save(); ctx.setTransform(m.a, 0, 0, m.d, 0, 0);
          ctx.globalAlpha = 0.45 * Math.min(1, t * 3);
          ctx.fillStyle = '#05030c';
          ctx.fillRect(0, 0, this.width, this.height);
          ctx.restore();
          break;
        }
        case 'sweep': { // v9.7.1 (lot 3 bis) : vague d'ultime qui traverse toute la scène, de l'équipe au bord droit
          const k = 1 - t;
          const x = fx.x0 + (this.width + 40 - fx.x0) * k;
          const G = this.groundY;
          ctx.globalAlpha = Math.min(1, t * 2.5);
          ctx.strokeStyle = fx.color; ctx.lineWidth = 2;
          for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - i * 7, G - 52); ctx.quadraticCurveTo(x + 10 - i * 7, G - 26, x - i * 7, G + 1); ctx.stroke(); }
          ctx.globalAlpha *= 0.5;
          ctx.fillStyle = fx.color;
          for (let i = 0; i < 6; i++) ctx.fillRect(Math.round(x - 4 - i * 9), Math.round(G - 10 - ((i * 17 + this.frameNo) % 40)), 2, 2);
          break;
        }
        case 'frame': { // v9.7.1 (lot A) : ultime — cadre coloré autour de la scène
          // v9.8 (E3) : au bord réel de la scène (avant : décalé avec l'équipe, d'où un trait vertical au milieu de la scène).
          const m = ctx.getTransform(); ctx.save(); ctx.setTransform(m.a, 0, 0, m.d, 0, 0);
          ctx.globalAlpha = t * 0.9;
          ctx.strokeStyle = fx.color;
          ctx.lineWidth = 3;
          ctx.strokeRect(1.5, 1.5, this.width - 3, this.height - 3);
          ctx.restore();
          break;
        }
        case 'flash': {
          const m = ctx.getTransform(); ctx.save(); ctx.setTransform(m.a, 0, 0, m.d, 0, 0); // v9.8 (E3) : tout l'écran, quel que soit le décalage
          ctx.globalAlpha = t * 0.35;
          ctx.fillStyle = fx.color;
          ctx.fillRect(0, 0, this.width, this.height);
          ctx.restore();
          break;
        }
        case 'epx': case 'eglow': case 'elinger':
          this.drawElementEffect(ctx, fx, t, dt);
          break;
        case 'particle':
          fx.vy += 120 * dt;
          fx.x += fx.vx * dt;
          fx.y = Math.min(this.groundY, fx.y + fx.vy * dt);
          ctx.globalAlpha = t;
          ctx.fillStyle = fx.color;
          ctx.fillRect(Math.round(fx.x), Math.round(fx.y), fx.size ?? 2, fx.size ?? 2);
          break;
        case 'spark': {
          // Étincelle d'impact : petit trait qui file dans le sens du coup.
          fx.vy += 200 * dt;
          const px = fx.x;
          const py = fx.y;
          fx.x += fx.vx * dt;
          fx.y += fx.vy * dt;
          ctx.globalAlpha = Math.min(1, t * 2);
          ctx.fillStyle = fx.color;
          ctx.fillRect(Math.round(fx.x), Math.round(fx.y), 1, 1);
          ctx.fillRect(Math.round((fx.x + px) / 2), Math.round((fx.y + py) / 2), 1, 1);
          break;
        }
        case 'puff':
          fx.x += fx.vx * dt;
          fx.y += fx.vy * dt;
          ctx.globalAlpha = t * 0.8;
          ctx.fillStyle = fx.color;
          ctx.fillRect(Math.round(fx.x), Math.round(fx.y), t > 0.5 ? 2 : 1, t > 0.5 ? 2 : 1);
          break;
        case 'gust': {
          // v9.0.8 : souffle d'un battement d'ailes au sol — traits qui s'écartent des deux côtés et s'effacent.
          const u = 1 - t;
          ctx.globalAlpha = Math.min(1, t * 1.1);
          ctx.fillStyle = fx.color;
          for (const side of [-1, 1]) {
            const r = 3 + u * 20;
            ctx.fillRect(Math.round(fx.x + side * r - (side < 0 ? 7 : 0)), fx.y, 7, 2);
            ctx.fillRect(Math.round(fx.x + side * (r * 0.65) - (side < 0 ? 4 : 0)), fx.y - 3, 4, 1);
            ctx.fillRect(Math.round(fx.x + side * (r * 1.2) - (side < 0 ? 2 : 0)), fx.y - 1, 2, 1);
          }
          break;
        }
        case 'ember':
          // Braise / trace laissée par un projectile : flotte un peu et s'éteint.
          fx.y += (fx.vy ?? -8) * dt;
          fx.x += (fx.vx ?? 0) * dt;
          ctx.globalAlpha = t;
          ctx.fillStyle = fx.color;
          ctx.fillRect(Math.round(fx.x), Math.round(fx.y), 1, 1);
          break;
        case 'ghost':
          // Ennemi tué par un projectile encore en vol : figé jusqu'à l'impact.
          ctx.globalAlpha = 1;
          ctx.drawImage(fx.img, fx.x, fx.y, fx.w, fx.h);
          break;
        case 'stuck': {
          // Flèche plantée dans l'ennemi : elle suit la cible, puis tombe si la cible disparaît.
          const target = this.enemyFx.get(fx.targetId);
          if (target?.seen > this.time - 0.1 && !fx.falling) { fx.x = target.sx + fx.ox; fx.y = target.sy + fx.oy; } else {
            fx.falling = true;
            fx.vy = (fx.vy ?? 0) + 200 * dt;
            fx.y = Math.min(this.groundY - 1, fx.y + fx.vy * dt);
          }
          const img = spriteCanvas(fx.frame);
          ctx.globalAlpha = Math.min(1, t * 3);
          ctx.drawImage(img, Math.round(fx.x - img.width + 4), Math.round(fx.y - img.height / 2));
          break;
        }
        case 'coin':
          fx.vy += 160 * dt;
          fx.x += fx.vx * dt;
          fx.y = Math.min(this.groundY - 4, fx.y + fx.vy * dt);
          ctx.globalAlpha = Math.min(1, t * 2);
          // v9.2.6 : pièce qui tourne (PixelLab) ; sobre : pièce fixe.
          if (vfxReady() && !this.focus) drawVfxFrame(ctx, 'loot_coin', (projFrame('loot_coin', this.time) + (fx.seed ?? 0)) % 6, fx.x, fx.y, { alpha: Math.min(1, t * 2) });
          else ctx.drawImage(coin, Math.round(fx.x - coin.width / 2), Math.round(fx.y - coin.height / 2));
          break;
        case 'loot': {
          const img = itemDropCanvas(fx.item);
          const age = fx.max - fx.life;
          let x = fx.x0;
          let y;
          if (age < 0.5) {
            // Saut en cloche, un peu vers l'avant. v9.2.2 : depuis la hauteur réelle de l'ennemi, retombe au sol.
            const k = age / 0.5;
            const g = this.groundY - 2;
            const y0 = Math.min(g, fx.y0 ?? g);
            x = fx.x0 + 14 * k;
            y = y0 + (g - y0) * k * k - Math.sin(k * Math.PI) * (y0 < g - 20 ? 10 : 26);
          } else if (age < LOOT_LIFE - 0.5) {
            // Posé au sol (le décor défile : il suit le sol), avec un petit rebond à l'atterrissage.
            x = fx.x0 + 14;
            y = this.groundY - 2 - Math.abs(Math.sin((age - 0.5) * 9)) * 2 * Math.max(0, 1.1 - age);
          } else {
            // Aspiré vers le chevalier.
            const k = Math.min(1, (age - (LOOT_LIFE - 0.5)) / 0.5);
            const e = k * k;
            // v9.7.1 : vers le sac de butin (bas droite de la scène) si l'objet y attend son tri.
            const tx = fx.toBag ? this.width - 22 : HERO_X;
            x = fx.x0 + 14 + (tx - fx.x0 - 14) * e;
            y = this.groundY - 2 - (fx.toBag ? 4 : 20) * e - Math.sin(k * Math.PI) * (fx.toBag ? 18 : 10);
          }
          // Halo de rareté qui pulse. v9.2.6 : éclat dessiné (PixelLab) teinté de la rareté, derrière l'objet.
          if (vfxReady() && !this.focus) drawVfxFrame(ctx, 'loot_shine', projFrame('loot_shine', this.time), x, y - img.height / 2, { tint: fx.color, size: 1.2, alpha: 0.9 });
          ctx.globalAlpha = 0.35 + 0.25 * Math.sin(this.time * 12);
          ctx.fillStyle = fx.color;
          ctx.fillRect(this.snap(x - img.width / 2 - 1), Math.round(y - img.height - 1), img.width + 2, img.height + 2);
          ctx.globalAlpha = Math.min(1, fx.life * 3);
          ctx.drawImage(img, this.snap(x - img.width / 2), Math.round(y - img.height));
          if (Math.random() < 0.3) {
            spawned.push({ kind: 'particle', x, y: y - img.height / 2, vx: (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 10, color: fx.color, life: 0.4, max: 0.4 });
          }
          break;
        }
        case 'sprite': {
          if (fx.life > fx.max) break; // pas encore commencé
          const k = 1 - t;
          const name = fx.frames[Math.min(fx.frames.length - 1, Math.floor(k * fx.frames.length))];
          const img = spriteCanvas(name, fx.tint ? { tint: { color: fx.tint, alpha: 0.65 } } : {});
          const x = fx.x + fx.vx * (fx.max - fx.life);
          ctx.globalAlpha = Math.min(1, t * 4);
          ctx.drawImage(img, this.snap(x - img.width / 2), Math.round(fx.y - img.height));
          break;
        }
        case 'proj': {
          if (fx.life > fx.max) break; // pas encore parti
          const k = 1 - t;
          // Tête chercheuse : la cible avance pendant le vol, le projectile vise sa position actuelle (bord avant).
          const target = fx.targetId !== undefined ? this.enemyFx.get(fx.targetId) : null;
          if (target?.seen > this.time - 0.1) {
            fx.x1 = target.edge + 3;
            fx.y1 = target.sy + target.sh * (target.sh > 30 ? 0.45 : 0.55);
          }
          const name = fx.frames[Math.floor(this.time * 12) % fx.frames.length];
          const img = spriteCanvas(name, fx.rotate ? { rotate: fx.rotate } : {});
          const pv = vfxReady() && PROJ_VFX[fx.frames[0]]; // v9.2.6 : projectile animé PixelLab
          // La pointe (bord droit du sprite) arrive sur la cible : le projectile ne la traverse pas.
          const tipX = fx.rotate ? 0 : img.width / 2 - 2;
          const x = fx.x0 + (fx.x1 - tipX - fx.x0) * k;
          const y = fx.y0 + (fx.y1 - fx.y0) * k - Math.sin(k * Math.PI) * fx.arc;
          fx.cx = x + tipX;
          fx.cy = y;
          if (fx.trail && !this.focus && Math.random() < 0.8) {
            spawned.push({ kind: 'ember', x: x - img.width / 2 + Math.random() * 3, y: y + (Math.random() * 4 - 2), vy: fx.trailVy ?? -10,
              color: fx.trail[Math.floor(Math.random() * fx.trail.length)], life: 0.25, max: 0.25 });
          }
          if (this.underwater && !this.focus && Math.random() < 0.6) addBubble(this, x - img.width / 2, y + (Math.random() * 4 - 2), { vy: -10, r: Math.random() < 0.3 ? 2 : 1, life: 0.9 }); // v9.2.0
          ctx.globalAlpha = 1;
          if (pv) {
            // Orienté selon sa trajectoire (cloche, chute verticale de la pluie de flèches) ; la pointe en tête.
            const k2 = Math.min(1, k + 0.02);
            const nx = fx.x0 + (fx.x1 - tipX - fx.x0) * k2 - x;
            const ny = fx.y0 + (fx.y1 - fx.y0) * k2 - Math.sin(k2 * Math.PI) * fx.arc - y;
            const rot = Math.abs(nx) + Math.abs(ny) > 0.01 ? Math.atan2(ny, nx) : 0;
            drawVfxFrame(ctx, pv, projFrame(pv, this.time), x + tipX, y, { tip: true, rot, size: fx.frames[0] === 'fx_meteor' ? 1.6 : 1 });
          } else ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2));
          break;
        }
        case 'zap': {
          // Éclair en zigzag (redessiné à chaque image : il crépite), du héros vers chaque cible.
          ctx.globalAlpha = Math.min(1, t * 2);
          for (let i = 1; i < fx.pts.length; i++) {
            const a = fx.pts[i - 1];
            const b = fx.pts[i];
            let px = a.x;
            let py = a.y;
            const n = Math.max(3, Math.round(Math.abs(b.x - a.x) / 6));
            for (let j = 1; j <= n; j++) {
              const nx = a.x + ((b.x - a.x) * j) / n;
              const ny = a.y + ((b.y - a.y) * j) / n + (j < n ? (Math.random() - 0.5) * 8 : 0);
              const steps = Math.max(1, Math.round(Math.hypot(nx - px, ny - py)));
              for (let q = 0; q <= steps; q++) {
                const xx = Math.round(px + ((nx - px) * q) / steps);
                const yy = Math.round(py + ((ny - py) * q) / steps);
                ctx.fillStyle = '#3f8cff';
                ctx.fillRect(xx - 1, yy - 1, 3, 3);
                ctx.fillStyle = fx.color;
                ctx.fillRect(xx, yy, 1, 1);
              }
              px = nx;
              py = ny;
            }
          }
          break;
        }
        case 'streak': {
          if (fx.life > fx.max) break;
          ctx.globalAlpha = t;
          ctx.fillStyle = fx.color;
          ctx.fillRect(Math.round(fx.x0), Math.round(fx.y), Math.round(fx.x1 - fx.x0), 1);
          ctx.globalAlpha = t * 0.5;
          ctx.fillRect(Math.round(fx.x0), Math.round(fx.y) - 1, Math.round(fx.x1 - fx.x0), 3);
          break;
        }
        case 'ring': {
          ctx.globalAlpha = t;
          ctx.fillStyle = fx.color;
          const r = fx.r * (1 - t * 0.6) + 2;
          for (let a = 0; a < Math.PI * 2; a += 0.2) {
            ctx.fillRect(Math.round(fx.x + Math.cos(a) * r), Math.round(fx.y + Math.sin(a) * r * 0.5), 1, 1);
          }
          break;
        }
        case 'handglow': {
          // v10.0 (9.1) : lueur de charge dans la main du lanceur (couleur de son élément), avant le lâcher du sort.
          const sl = this.layout?.slots.get(fx.id);
          if (!sl) break;
          const k = 1 - t;
          const x = sl.cx + fx.dx + (this.allyPoseDx?.get(fx.id) ?? 0), y = this.groundY - fx.dy;
          const g = ctx.createRadialGradient(x, y, 0, x, y, 3 + k * 5);
          g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, fx.color); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 0.9; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
          ctx.fillRect(x - 9, y - 9, 18, 18); ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'wtrail': {
          // v10.0 (3) : traînée d'arme — arc fin (blanc au bord, doré au cœur), qui s'efface en 0,15 s.
          const k = 1 - t;
          const a0 = fx.flip ? 0.9 : -1.3, a1 = fx.flip ? -0.5 : 0.7;
          ctx.save();
          ctx.lineCap = 'round';
          for (const [w, c, al] of [[3, fx.color, 0.55], [1, '#ffffff', 1]]) {
            ctx.globalAlpha = al * t;
            ctx.strokeStyle = c;
            ctx.lineWidth = w;
            ctx.beginPath();
            ctx.arc(fx.x, fx.y, 13, a0, a0 + (a1 - a0) * Math.min(1, k * 2.2), a1 < a0);
            ctx.stroke();
          }
          ctx.restore();
          break;
        }
        case 'beam': {
          // v9.2.2 : colonne de lumière sur toute la hauteur, qui s'estompe vers le haut (plus de trait coupé net).
          // v9.8 (E2/E3) : 0,3 s au plus et deux fois moins opaque (les colonnes restaient sur la scène : rayons blancs,
          // « rectangle violet » d'un objet Épique) ; aucune avec « Réduire les animations ».
          const age = fx.max - fx.life;
          if (this.focus || age > 0.3) break;
          const w = fx.wide ? 7 : 4, G = this.groundY, a = 0.5 * (1 - age / 0.3);
          const fade = (c, k) => { const g = ctx.createLinearGradient(0, 0, 0, G); g.addColorStop(0, c + '00'); g.addColorStop(0.45, c + Math.round(k * 160).toString(16).padStart(2, '0')); g.addColorStop(1, c + Math.round(k * 255).toString(16).padStart(2, '0')); return g; };
          const col = /^#[0-9a-f]{6}$/i.test(fx.color) ? fx.color : '#ffffff';
          ctx.globalAlpha = a * 0.7;
          ctx.fillStyle = fade(col, 1);
          ctx.fillRect(fx.x - Math.floor(w / 2), 0, w, G);
          ctx.globalAlpha = a;
          ctx.fillStyle = fade('#ffffff', 1);
          ctx.fillRect(fx.x, 0, 1, G);
          break;
        }
        case 'death': {
          // v9.2.3 : chute dessinée image par image (75 % du temps), puis le corps s'efface.
          const p = 1 - t;
          const n = fx.anim.frames.length;
          const key = fx.anim.frames[Math.min(n - 1, Math.floor(Math.min(1, p / 0.75) * n))];
          const c = spriteCanvas(key, { colors: fx.colors });
          ctx.globalAlpha = p < 0.75 ? 1 : Math.max(0, 1 - (p - 0.75) / 0.25);
          const fall = (fx.drop ?? 0) * Math.min(1, p / 0.75) ** 2; // v9.2.4
          ctx.drawImage(c, Math.round(fx.x + (fx.ox ?? fx.anim.ox) * fx.k), Math.round(fx.y + fall + (fx.oy ?? fx.anim.oy) * fx.k), c.width * fx.k, c.height * fx.k);
          break;
        }
        case 'corpse': {
          // v9.3.9 (2.3) : le monstre tué est projeté en arrière (petit arc) et clignote avant d'éclater.
          const u = fx.fling ? 1 - t : 0;
          const fdx = Math.round(u * 22);
          const fdy = -Math.round(Math.sin(Math.min(1, u * 1.6) * Math.PI) * 9);
          if (fx.fling && Math.floor(u * 10) % 2 === 1) ctx.globalAlpha = 0.35;
          if (fx.frames) {
            // v9.1.9 : dissolution tramée (pixels qui s'éteignent), sans écrasement flou.
            const k = Math.min(fx.frames.length - 1, Math.floor((1 - t) * fx.frames.length));
            ctx.drawImage(fx.frames[k], Math.round(fx.x - fx.w / 2) + fdx, Math.round(fx.top ?? this.groundY - fx.h - fx.fly + 1) + fdy, fx.w, fx.h); // v9.2.2 : là où il est mort
            break;
          }
          ctx.globalAlpha = Math.min(ctx.globalAlpha, t);
          const h = Math.max(1, Math.round(fx.h * t));
          ctx.drawImage(fx.img, Math.round(fx.x - fx.w / 2) + fdx, this.groundY - h - fx.fly + 1 + fdy, fx.w, h);
          break;
        }
        default:
          break;
      }
      ctx.globalAlpha = 1;
      return true;
    });
    this.effects.push(...spawned);
    for (const fn of finished) fn();
    if (this.effects.length > 400) this.effects.splice(0, this.effects.length - 400);
  }
}

// v9.3.2 : icône de type (5×5 px de jeu) : forme propre à chaque type (pas seulement la couleur) :
// rouge = flamme (triangle), bleu = goutte, vert = feuille (losange), lumière = étoile (croix), ténèbres = croissant.
const ELEM_SHAPES = {
  red: ['..#..', '.###.', '.###.', '#####', '.###.'], blue: ['..#..', '.###.', '#####', '#####', '.###.'],
  green: ['..#..', '.###.', '#####', '.###.', '..#..'], light: ['..#..', '..#..', '#####', '..#..', '..#..'],
  dark: ['.###.', '##...', '##...', '##...', '.###.'],
};
const ELEM_COLORS = { red: '#ff5a3c', blue: '#3ca8ff', green: '#4cd26a', light: '#ffe27a', dark: '#a46bff' };
export function drawElementIcon(ctx, el, x, y) {
  const shape = ELEM_SHAPES[el];
  if (!shape) return;
  ctx.fillStyle = '#10131c';
  ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 7, 7);
  ctx.fillStyle = ELEM_COLORS[el];
  shape.forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') ctx.fillRect(Math.round(x) + i, Math.round(y) + j, 1, 1); }));
}

// Attaques de classe (render/class-fx.js).
SceneRenderer.sizePref = 'auto'; // v9.7.1 : réglage « Taille des personnages »
SceneRenderer.skillNames = true; // v9.7.1 (lot A) : noms des compétences des compagnons (Paramètres)
installClassFx(SceneRenderer.prototype, { HERO_X, ATTACK_TIME, CAST_TIME });
installMutationFx(SceneRenderer.prototype, { HERO_X });
installElementFx(SceneRenderer.prototype);
installTraversalFx(SceneRenderer.prototype);
