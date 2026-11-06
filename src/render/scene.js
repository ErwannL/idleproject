// Rendu de la scène de combat sur un canvas basse résolution agrandi en « pixel perfect ».
// Le rendu lit l'état de la simulation et ses événements ; il ne modifie jamais la partie.
import { mutationById } from '../core/mutations.js';
import { auraColors } from '../data/auras.js';
import { BALANCE } from '../data/balance.js';
import { drawTeamFx } from './team-fx.js';
import { installClassFx } from './class-fx.js';
import { installMutationFx } from './mutation-fx.js'; // v9.2.3 : ennemis mutés lisibles
import { MUTATION_PACE, SHEEN_STEPS, mutatedCanvas, mutationSize } from './mutation-look.js'; // v9.2.3 : apparence des mutations
import { installTraversalFx } from './traversal-fx.js'; // v9.2.1 : déplacement propre à chaque monde
import { DRAWN_TRAIL, HURT_COOLDOWN, HURT_TIME, armSwing, attackCurve, dissolveFrames, pickAnimFrame } from './enemy-anim.js';
import { animBoxes, animStride, anchorOffset, boxOf, groundLegs, QUADRUPEDS as LEG_GROUNDED } from './enemy-anchor.js'; // v9.2.5 : calage des images dessinées
import { BREATH_START, CAST_RELEASE, breathSafeAnims, drawBreath, drawOrbGlow, headMouth, powerOf, powerPointsOf } from './enemy-fx.js'; // v9.2.3
import { HERO_HEIGHT, sizeFactor, visibleSize } from '../data/enemy-sizes.js'; // v9.2.3 : table d'échelle (v9.2.4 : taille visible)
import { ENEMY_ANIMS } from './art-anim.js'; // v9.2.3 : bat, harpy, skeleton dessinés image par image
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
import { DAMAGE_COLORS, drawDamageText, drawVfx, drawVfxFrame, projFrame, vfx, vfxReady } from './vfx.js'; // v9.2.6 : effets de combat PixelLab

// Vue resserrée : le chevalier (≈ 40 px) occupe un bon tiers de la hauteur de la scène.
export const MIN_VIEW_HEIGHT = 96;
const GROUND_DEPTH = 18; // hauteur du sol sous la ligne des pieds
// Hauteur logique maximale : les plus hauts calques peints (forêt, piliers, forge : 322 px posés à 320 px
// au-dessus du sol) doivent toucher le haut de la scène. Au-delà, on zoome au lieu de montrer leur bord
// coupé net (arbres « tranchés » dans une fenêtre haute, v9.1.3).
export const MAX_VIEW_HEIGHT = 320 + GROUND_DEPTH;
const MIN_VIEW_WIDTH = 160; // largeur logique minimale (zoom : le chevalier reste grand)
const MAX_SCALE = 3; // zoom maximal : une grande fenêtre montre plus de décor
// Les positions de la simulation (BALANCE.world) sont agrandies à l'affichage pour
// s'accorder aux sprites v5, plus détaillés ; la simulation elle-même ne change pas.
export const WORLD_SCALE = 1.5;
// Durée de l'attaque d'un compagnon (préparation puis coup).
// v9.0.8 : façon de combattre de chaque compagnon (le reste se bat au corps à corps) et durée de chaque geste.
const ALLY_STYLE = {
  elf_archer: 'archer', ranger: 'archer',
  pyromancer: 'fire', ice_empress: 'frost', witch: 'arcane', sylvan_guardian: 'nature', high_priest: 'holy', priestess: 'holy',
};
const ALLY_GESTURE_TIME = { melee: 0.62, archer: 0.42, cast: 0.72, support: 0.8, burst: 0.8 };
const CAST_ORB = {
  fire: ['fx_fireball1', 'fx_fireball2'], frost: ['fx_frost1', 'fx_frost2'], arcane: ['fx_soul1', 'fx_soul2'],
  nature: ['fx_spark'], holy: ['fx_spark'],
};
const SUPPORT_COLOR = { heal: '#7dff9a', shield: '#7fc8ff', rally: '#ffd23f', gold: '#ffe08a' };

// Durée de vie d'un objet tombé : saut, repos au sol, puis aspiration vers le chevalier.
const LOOT_LIFE = 4;

// Aura des boss par rang (mini, moyen, dur, méga).
const BOSS_AURAS = {
  berserk: { color: '#ff0030', ember: '#1a0008', width: 3, alpha: 0.6, speed: 10, embers: 0.5 },
  mini: { color: '#ffb050', ember: '#ffe08a', width: 1, alpha: 0.35, speed: 4, embers: 0 },
  mid: { color: '#ff4d6d', ember: '#ffb0a8', width: 1, alpha: 0.45, speed: 5, embers: 0.05 },
  hard: { color: '#ff4dd2', ember: '#ffc0f0', width: 2, alpha: 0.4, speed: 6, embers: 0.15 },
  mega: { color: '#ff2020', ember: '#ffd23f', width: 2, alpha: 0.55, speed: 7, embers: 0.35 },
  dungeon: { color: '#b04dff', ember: '#e8c0ff', width: 2, alpha: 0.55, speed: 6, embers: 0.3 }, // v9.0.4 : boss de donjon
};
const HERO_X = BALANCE.world.heroX * WORLD_SCALE;

// Particules d'ambiance par zone, sur deux profondeurs (derrière et devant les personnages) :
// elles défilent avec la parallaxe et donnent de la vie au décor même quand le chevalier se bat.
const AMBIENT = {
  plains: { colors: ['#fff6b0', '#ffffff', '#c8f08a'], count: 14, vx: -6, vy: -3, wobble: 6, size: 1 }, // pollen
  forest: { colors: ['#e8ff7a', '#b8ff6a', '#fff6a0'], count: 16, vx: -2, vy: -2, wobble: 10, size: 1, glow: true }, // lucioles
  caves: { colors: ['#9fe8ff', '#e0a8ff', '#ffffff'], count: 12, vx: 0, vy: -4, wobble: 3, size: 1, glow: true }, // éclats
  desert: { colors: ['#ffe2a8', '#f4c27a'], count: 18, vx: -28, vy: 1, wobble: 2, size: 1 }, // sable
  mountains: { colors: ['#ffffff', '#e6f2ff'], count: 26, vx: -10, vy: 14, wobble: 8, size: 1 }, // neige
  cursed: { colors: ['#ff8a3a', '#ffcc4a', '#ff5a2a'], count: 18, vx: -3, vy: -12, wobble: 5, size: 1, glow: true }, // braises
  swamp: { colors: ['#b8ff6a', '#7adf5a', '#d8ff9a'], count: 16, vx: -2, vy: -3, wobble: 9, size: 1, glow: true }, // spores
  sky: { colors: ['#ffffff', '#fff2c0', '#d8eeff'], count: 14, vx: -16, vy: -1, wobble: 4, size: 1 }, // plumes, vent
  volcano: { colors: ['#ff6a2a', '#ffb43a', '#ff3a1a'], count: 24, vx: -4, vy: -16, wobble: 4, size: 1, glow: true }, // braises
  void: { colors: ['#c9a6ff', '#7fd4ff', '#ffffff'], count: 20, vx: -1, vy: -2, wobble: 12, size: 1, glow: true }, // poussière d'étoiles
  abyss: { colors: ['#ff3a3a', '#ff8a3a', '#7a1a2a'], count: 22, vx: -2, vy: -10, wobble: 6, size: 1, glow: true }, // cendres rouges
  ocean: { colors: ['#9fe8ff', '#d8fbff', '#5ab8d8'], count: 26, vx: -1, vy: -2, wobble: 10, size: 1, glow: true }, // v9.2.0 : particules en suspension
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
const MAX_FLOATING_TEXTS = 6;
// v9.2.6 : projectiles dessinés par PixelLab (boucles animées) à la place des anciens sprites fixes.
const PROJ_VFX = { fx_arrow: 'proj_arrow', fx_arrow_fire1: 'proj_fireball', fx_fireball1: 'proj_fireball', fx_soul1: 'proj_soul', fx_meteor: 'proj_fireball' };
const FLYING_PETS = new Set(['owl', 'fairy', 'wisp']);
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
    const { data, width, height } = img.getContext('2d').getImageData(0, 0, img.width, img.height);
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
    const { data, width, height } = img.getContext('2d').getImageData(0, 0, img.width, img.height);
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
  const g = c.getContext('2d');
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
    const minWidth = cssWidth < 560 && cssHeight > cssWidth * 0.45 ? 215 : MIN_VIEW_WIDTH;
    let scale = Math.min(cssHeight / MIN_VIEW_HEIGHT, cssWidth / minWidth, MAX_SCALE);
    if (scale >= 3) scale = Math.floor(scale);
    scale = Math.max(0.5, scale, cssHeight / MAX_VIEW_HEIGHT);
    this.width = Math.max(120, Math.floor(cssWidth / scale));
    this.height = Math.max(MIN_VIEW_HEIGHT, Math.floor(cssHeight / scale));
    this.groundY = this.height - GROUND_DEPTH;
    // Rendu à la résolution de l'écran (k pixels par pixel de jeu) : les sprites restent nets mais
    // les personnages et le décor se déplacent pixel d'écran par pixel d'écran (mouvement fluide).
    this.k = Math.max(1, Math.round(scale * (window.devicePixelRatio || 1)));
    this.canvas.width = this.width * this.k;
    this.canvas.height = this.height * this.k;
    this.canvas.style.width = `${Math.round(this.width * scale)}px`;
    this.canvas.style.height = `${Math.round(this.height * scale)}px`;
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

  // Position à l'écran d'un x du monde. Grand écran (v8.1) : la zone d'approche est étirée pour que
  // les ennemis apparaissent au bord DROIT de la scène et avancent (au lieu de surgir au milieu).
  wx(x) {
    const near = (BALANCE.world.heroX + 70) * WORLD_SCALE;
    const spawn = BALANCE.world.spawnX * WORLD_SCALE;
    const sx = x * WORLD_SCALE;
    const edge = this.width + 24;
    if (sx <= near || edge <= spawn) return sx;
    return near + ((sx - near) * (edge - near)) / (spawn - near);
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
        const drawnSlash = vfx(this, 'hit_slash', heroX + 22 + sx, this.groundY - 14 - this.waterLift(), { delay: 0.05, size: event.crit ? 1.3 : 1, tint: event.crit ? '#ffd23f' : null, life: 0.22 });
        if (!drawnSlash && event.crit) this.sprite(['fx_slash_crit'], heroX + 18 + sx, this.groundY + 4 - this.waterLift(), 0.22, { delay: 0.07, tint: '#ffd23f' });
        else if (!drawnSlash) this.sprite(['fx_slash1', 'fx_slash2', 'fx_slash3'], heroX + 14 + sx, this.groundY + 1 - this.waterLift(), 0.18, { delay: 0.07 });
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
          this.addText(formatNumber(event.damage), event.x, this.groundY - (event.boss ? 64 : 42), c0, c1);
        }
        break;
      case 'skill':
        // v9.2.5 : geste propre à la compétence et effet synchronisé (skill-fx.js) ; ancien effet en repli.
        if (castHeroSkill(this, this.skillKey, event.skillId, fxContext(this, world, { x: HERO_X + 4, y: this.groundY - 22 }, HERO_X))) break;
        this.skillEffect(event);
        break;
      case 'companionSkill': {
        const companion = companionById(event.companionId);
        // v9.2.5 : chaque compétence (ultime comprise) a son geste et son effet (skill-fx.js).
        const known = companion && companionSkillList(companion, COMPANION_ROLES[companion.id] ?? 'pet')[event.skill];
        if (known) {
          const slot = this.layout?.slots.get(companion.id);
          const sx = slot?.cx ?? heroX - 30;
          castUnitSkill(this, companion, known.name, event.skillType ?? known.type, fxContext(this, world, { x: sx, y: this.groundY - 22 }, heroX));
          break;
        }
        if (companion?.kind === 'ally') {
          // v9.0.8 : geste propre au compagnon (saut d'attaque, tir, sort, soutien), l'effet part de sa place.
          this.allyGesture(companion, world, heroX, event.skillType);
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
          this.shake = Math.max(this.shake, 2);
        }
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
        break;
      }
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
        if (event.boss) this.shake = Math.max(this.shake, 2);
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
        this.effects.push({ kind: 'loot', item: event.item, color, x0, x: x0, y0: at.y, y: at.y, life: LOOT_LIFE, max: LOOT_LIFE });
        this.burst(x0, at.y - 4, color, big ? 14 : 6, 50);
        vfx(this, 'loot_burst', x0, at.y, { tint: color, size: big ? 1.3 : 0.9 }); // v9.2.6 : gerbe d'étincelles de rareté
        if (event.item.rarity === 'legendary') this.shake = Math.max(this.shake, 3);
        break;
      }
      case 'bossSummon':
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

  addText(text, x, y, color, light = '#ffffff', big = false) {
    const texts = this.effects.filter((e) => e.kind === 'text');
    if (texts.length >= MAX_FLOATING_TEXTS) this.effects.splice(this.effects.indexOf(texts[0]), 1);
    this.effects.push({ kind: 'text', text, x: x - textWidth(text, FONT_BIG) / 2, y, cx: x, y0: y, color, light, life: big ? 0.95 : 0.8, max: big ? 0.95 : 0.8, pop: big });
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
      fx.knock = Math.min(boss ? 4 : 8, (fx.knock ?? 0) + (crit ? 5 : 3) * (boss ? 0.5 : 1));
      fx.squash = 0.14;
      if (crit && !this.focus) this.hitstop = Math.max(this.hitstop ?? 0, 0.06);
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
    if (hitName) vfx(this, hitName, ix + 2, iy, { size: big });
    if (crit) { vfx(this, 'crit_flash', ix + 2, iy, { size: boss ? 1.1 : 0.9 }); vfx(this, 'crit_wave', ix + 2, Math.min(G - 2, iy + 10), { size: 0.9 }); }
    if (!drawn) this.sprite(['fx_hit'], ix + 2, iy + 6, 0.14, { tint: crit ? '#ffd23f' : null });
    if (crit) {
      this.effects.push({ kind: 'ring', x: ix, y: iy, color: '#ffd23f', life: 0.25, max: 0.25, r: 12 });
      this.shake = Math.max(this.shake, boss ? 3 : 2);
    } else if (boss) this.shake = Math.max(this.shake, 1);
    // v9.1.9 : impact élémentaire selon la couleur du coup (feu, glace, poison, sacré, ombre) ou l'élément donné.
    if (el) this.elementFx(ix, iy, el, crit || boss);
    // v9.2.6 : couleur du chiffre selon le coup (critique doré, élément, coup simple blanc).
    const [c0, c1] = DAMAGE_COLORS[crit ? 'crit' : el ?? 'hit'] ?? DAMAGE_COLORS.hit;
    if (damage) this.addText(formatNumber(damage), x, G - (boss ? 58 : 36), c0, c1, crit);
  }

  killEffect(event) {
    // Éclatement en pixels : quelques pixels du sprite volent en éclats (couleurs réelles du monstre).
    // v9.2.5 : scissipare divisé : ses deux moitiés sont son corps (mutation-fx.js), pas de chute ni de corps en plus.
    const split = Boolean(this.splitGone?.delete(event.enemyId));
    const fxe0 = this.enemyFx.get(event.enemyId);
    const fxe = split ? (fxe0 ? { ...fxe0, img: null } : fxe0) : fxe0;
    if (fxe?.img && !this.focus) this.shatter(fxe);
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
      fly: this.flyHeight(event.kind, event.boss), life: 0.3, max: 0.3,
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
    try { data = img.getContext('2d').getImageData(0, 0, img.width, img.height).data; } catch { return; }
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
      this.shake = Math.max(this.shake, 2);
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
      def, sprite, base, heroLike: Boolean(bossDef?.heroLike), scale: bossScale * (SPRITES[sprite]?.scale ?? 1) * fit,
      colors: (bossDef ? bossDef.palette : def.palette) ?? null,
    };
  }

  flyHeight(type, boss) {
    const def = boss ? ENEMIES[BOSSES[type].base] : ENEMIES[type];
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
    if (this.focus) this.shake = 0;
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
      ctx.translate(Math.round((Math.random() * 2 - 1) * this.shake), Math.round((Math.random() * 2 - 1) * this.shake));
      this.shake = Math.max(0, this.shake - dt * 12);
    }
    this.drawBackground(ctx, ZONES[zoneIndex], this.smoothScroll(world));
    // v9.0.8 : chacun dans sa case (chevalier | familier | compagnons) ; si l'équipe ne tient pas à gauche du
    // chevalier, tout le combat glisse vers la droite (en douceur) plutôt que de faire se chevaucher les personnages.
    this.layout = this.teamLayout(state);
    const wantShift = Math.max(0, 3 - this.layout.left);
    this.viewShift = this.viewShift === undefined ? wantShift : this.viewShift + (wantShift - this.viewShift) * Math.min(1, dt * 4);
    const shift = Math.round(this.viewShift);
    ctx.save();
    ctx.translate(shift, 0);
    this.drawEnemies(ctx, world, dt);
    // v9.2.1 (marais) : l'équipe patauge — corps enfoncés (travLift) et coupés à la surface de l'eau.
    const wade = this.trav?.wade;
    if (wade) { ctx.save(); ctx.beginPath(); ctx.rect(-shift - 8, 0, this.width + 16, this.groundY - 2); ctx.clip(); }
    this.drawCompanions(ctx, state, world, dt);
    const pet = world.hero.dead ? null : equippedCompanions(state).find((c) => c.kind !== 'ally');
    if (pet) this.drawPet(ctx, world, pet);
    this.drawHero(ctx, state, world);
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
    if (!front && zone.underwater) drawOceanBack(this, ctx, scroll); // v9.2.0 : rayons, poissons de fond, kelp
    if (front) this.drawAmbient(ctx, zone, scroll, true);
    if (front && zone.underwater) drawOceanFront(this, ctx, scroll, this.dt ?? 0); // caustiques, bulles, voile bleu
  }

  // Particules d'ambiance : positions calculées à partir du temps (aucun état à garder).
  drawAmbient(ctx, zone, scroll, front) {
    const a = AMBIENT[zone.id];
    if (!a || this.focus) return;
    const factor = front ? 1.15 : 0.55;
    const W = this.width + 20;
    const H = this.groundY + 4;
    const n = front ? Math.round(a.count / 3) : a.count;
    for (let i = 0; i < n; i++) {
      const seed = i * 97 + (front ? 13 : 0);
      const r1 = ((seed * 9301 + 49297) % 233280) / 233280;
      const r2 = ((seed * 4271 + 1013) % 7919) / 7919;
      const speed = 0.6 + r2 * 0.8;
      let x = (r1 * W + a.vx * speed * this.time - scroll * factor) % W;
      if (x < 0) x += W;
      let y = (r2 * H + a.vy * speed * this.time) % H;
      if (y < 0) y += H;
      x += Math.sin(this.time * 1.3 + i) * a.wobble * 0.3;
      const color = a.colors[i % a.colors.length];
      const blink = a.glow ? 0.45 + 0.55 * Math.abs(Math.sin(this.time * (1.5 + r1) + i)) : 0.85;
      ctx.globalAlpha = blink * (front ? 1 : 0.7);
      ctx.fillStyle = color;
      const size = front ? 2 : a.size;
      ctx.fillRect(Math.round(x - 10), Math.round(y), size, size);
      if (a.glow && front) {
        ctx.globalAlpha = blink * 0.25;
        ctx.fillRect(Math.round(x - 11), Math.round(y - 1), size + 2, size + 2);
      }
    }
    ctx.globalAlpha = 1;
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
      const pose = arrivalPose(arrival, k, { height: enemy.boss ? 90 : 70, time: this.time, focus: this.focus });
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
        atkP, hurtP: fx.hurt > 0 && !this.focus ? 1 - fx.hurt / HURT_TIME : null, flying, swimming: this.underwater && arrival.mode === 'swim', moving, time: this.time * mPace, phase: enemy.id * 0.7, walkStep,
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
      const x = this.snap(Math.max(exd - w / 2, HERO_X + 12) - lunge + (fx.knock > 0.5 ? fx.knock : 0) + pose.dx);
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
        this.drawBar(ctx, headX - 16, headY - 6, 32, enemy.hp / enemy.maxHp, '#e84a5f');
      } else if (enemy.elite || enemy.mutation || enemy.hp < enemy.maxHp) {
        this.drawBar(ctx, headX - 9, headY - 5, 18, enemy.hp / enemy.maxHp, enemy.elite ? '#ff9a3d' : mutation ? mutation.color : '#e84a5f');
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
  allyGesture(companion, world, heroX, skillType) {
    const type = skillType ?? companion.skill?.type;
    const style = ALLY_STYLE[companion.id] ?? 'melee';
    const support = ['heal', 'shield', 'rally', 'gold'].includes(type);
    const kind = support ? 'support' : type === 'burst' ? 'burst' : style === 'archer' ? 'archer' : style === 'melee' ? 'melee' : 'cast';
    this.allyAnims ??= new Map();
    this.allyAnims.set(companion.id, { kind, start: this.time, max: ALLY_GESTURE_TIME[kind],
      color: (kind === 'support' ? SUPPORT_COLOR[type] : null) ?? companion.fx ?? '#ffffff' });
    const slot = this.layout?.slots.get(companion.id);
    const ax = slot?.cx ?? heroX - 30;
    const G = this.groundY;
    const color = companion.fx ?? '#ffffff';
    const front = world.enemies[0];
    const tx = front ? this.wx(front.x) - 4 : heroX + 40;
    const hit = (x) => {
      this.sprite(['fx_slash1', 'fx_slash2', 'fx_slash3'], x, G + 1 - this.waterLift(), 0.2, { tint: color });
      this.burst(x, G - 16, color, 8, 30);
      if (front) this.hitReact(front.id, x, { color });
    };
    if (kind === 'melee') {
      // Saut : l'onde tranchante part au sommet du bond et file jusqu'à l'ennemi.
      this.later(0.24, () => this.projectile(['fx_wave'], ax + 8, G - 30, tx, G - 18, 0.2, {
        targetId: front?.id, trail: [color], trailVy: 0, onHit: () => hit(tx) }));
      this.later(0.46, () => this.dust(ax, 3));
    } else if (kind === 'archer') {
      this.later(0.14, () => this.projectile(['fx_arrow'], ax + 8, G - 24, tx, G - 18, 0.22, {
        arc: 6, rotate: 1, targetId: front?.id, trail: ['#e8e0c8'], trailVy: 0, onHit: () => hit(tx) }));
    } else if (kind === 'cast') {
      const style2 = ALLY_STYLE[companion.id];
      this.later(0.3, () => this.projectile(CAST_ORB[style2] ?? ['fx_spark'], ax + 6, G - 34, tx, G - 18, 0.3, {
        arc: 8, targetId: front?.id, trail: [color], onHit: () => { hit(tx); this.burst(tx, G - 18, color, 10, 40); } }));
    } else if (kind === 'burst') {
      this.later(0.3, () => {
        for (const e of world.enemies) {
          const x = this.wx(e.x);
          this.sprite(['fx_burst'], x, G - 2, 0.35, { tint: color });
          this.burst(x, G - 18, color, 6, 34);
        }
        this.shake = Math.max(this.shake, 2);
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
        this.effects.push({ kind: 'ring', x: heroX, y: G - 14, color: c, life: 0.5, max: 0.5, r: 12 });
        if (type === 'gold') this.burst(heroX, G - 30, c, 10, 40);
      });
    }
  }

  // v9.0.8 : position du corps d'un compagnon selon son geste (aucune déformation du dessin).
  // { dx, dy } en pixels de jeu (dy > 0 = vers le haut), glow = intensité du halo, ghosts = images rémanentes.
  allyPose(companion, walking, i) {
    const a = this.allyAnims?.get(companion.id);
    const t = this.time + i * 0.41;
    const gesture = this.allyGesturePose(companion, a);
    const pose = gesture ?? this.allyMovePose(companion, walking, t);
    const gait = SPRITES[companion.sprite]?.gait;
    if (gait === 'fly') {
      // Battement d'ailes (~4 par seconde) : le corps remonte à chaque coup d'aile vers le bas.
      const phase = (t * 4) % 1;
      pose.flap = phase;
      pose.dy = (gesture ? pose.dy : 0) + 5 + Math.sin(phase * Math.PI * 2 - Math.PI / 2) * -1.2;
    }
    if (gait === 'glide' && gesture) { pose.dy += 4; pose.glide = true; }
    return pose;
  }

  allyGesturePose(companion, a) {
    if (a) {
      const k = (this.time - a.start) / a.max;
      if (k >= 1 || k < 0) this.allyAnims.delete(companion.id);
      else {
        const arc = (p0, p1, h) => (k < p0 || k > p1 ? 0 : Math.sin(((k - p0) / (p1 - p0)) * Math.PI) * h);
        switch (a.kind) {
          case 'melee': // élan (recul d'un pas), puis pas en avant et frappe : on reste au sol
            return { dx: k < 0.25 ? -1.5 * (k / 0.25) : -1.5 + arc(0.25, 0.8, 3.5) + 1.5 * Math.min(1, (k - 0.25) / 0.2),
              dy: arc(0.3, 0.6, 2), glow: 0, ghosts: k > 0.3 && k < 0.6, lunge: k > 0.25 && k < 0.7, color: a.color,
              arm: k < 0.25 ? -25 : k < 0.55 ? 40 : k < 0.7 ? 20 : 0 }; // v9.1.9 : bras qui frappe
          case 'burst':
            return { dx: arc(0.15, 0.75, 1), dy: k < 0.15 ? -1 : arc(0.15, 0.75, 10), glow: arc(0.1, 0.9, 0.9), ghosts: k > 0.2 && k < 0.7, color: a.color };
          case 'archer': // recul au tir, puis retour
            return { dx: k < 0.15 ? -k / 0.15 : -Math.max(0, 1 - (k - 0.15) / 0.5), dy: 0, glow: 0, color: a.color };
          case 'cast': // lévitation, halo qui pulse
            return { dx: 0, dy: arc(0, 1, 5), glow: arc(0, 1, 1), color: a.color };
          default: // soutien
            return { dx: 0, dy: arc(0, 1, 4), glow: arc(0, 1, 1), color: a.color };
        }
      }
    }
    return null;
  }

  // v9.0.8 : démarche selon le personnage — pas de marche (images de pas), vol, glissade ou sauts.
  allyMovePose(companion, walking, t) {
    const gait = SPRITES[companion.sprite]?.gait;
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
    if (this.maxStars(companion)) this.drawStarAura(ctx, cx0 + pose.dx, y, w, h, companion);
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
      const t = tint.getContext('2d');
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



  // v8.9 : compagnon aux étoiles maximales → aura lumineuse (couleur de sa rareté) et étincelles qui montent.
  maxStars(companion) {
    return (this.state?.companions.owned[companion.id]?.stars ?? 0) >= COMPANION_RULES.maxCopies; // v9.1.3 : 5★ = 6 exemplaires
  }

  // v9.0.5 : aura façon « Super guerrier » — flammes en pixels qui montent autour du personnage, aux couleurs
  // propres à chacun (3 couches pour un SSR, 2 pour un SR, 1 sinon ; de l'extérieur vers le cœur), traits
  // d'énergie qui filent vers le haut et, pour les SSR, éclairs qui crépitent.
  drawStarAura(ctx, cx, top, w, h, companion) {
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
    if (flying) {
      const hover = 30 + Math.sin(this.time * 3) * 3;
      // Battement d'ailes : écrasement vertical rapide autour du centre du sprite.
      const flap = 1; // v9.0.8 : plus d'écrasement du dessin (vol = flottement)
      const cy = this.groundY - hover - img.height / 2;
      this.drawShadow(ctx, x + img.width / 2, img.width * 0.5);
      if (this.maxStars(companion)) this.drawStarAura(ctx, x + img.width / 2, cy - img.height / 2, img.width, img.height, companion);
      ctx.save();
      ctx.translate(this.snap(x + img.width / 2), this.snap(cy));
      ctx.scale(1, flap);
      this.drawStarOutline(ctx, companion, companion.sprite, -img.width / 2, -img.height / 2);
      petImg(-img.width / 2, -img.height / 2);
      ctx.restore();
      return;
    }
    // Petits bonds en marchant, avec écrasement à la réception.
    const phase = Math.abs(Math.sin(this.time * (walking ? 9 : 2.5)));
    // v9.0.8 : seul le slime avance par sauts ; chat et golem trottinent (petit balancement d'un pixel).
    const hopper = companion.id === 'golden_slime';
    const hop = (walking ? phase * (hopper ? 4 : 1) : phase * 0.6) + this.travLift(2.5); // v9.2.1 : hauteur du monde
    this.travFeet(companion.id, x + img.width / 2, walking, 2.5, true);
    const squash = 1; // v9.0.8 : bonds sans écrasement du dessin
    this.drawShadow(ctx, x + img.width / 2, img.width * 0.8 - hop);
    if (this.maxStars(companion)) this.drawStarAura(ctx, x + img.width / 2, this.groundY - img.height, img.width, img.height, companion);
    ctx.save();
    ctx.translate(this.snap(x + img.width / 2), this.groundY + 1 - this.snap(hop));
    ctx.scale(2 - squash, squash);
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
    if (this.maxStars(companion)) this.drawStarAura(ctx, x + img.width / 2, py + oy, img.width, img.height, companion);
    if (canvas === img) this.drawStarOutline(ctx, companion, companion.sprite, px, py);
    const pa = pickAllyAnim({ sprite: companion.sprite, walking, swimming: true, time: this.time, seed: 0.5 }); // v9.2.3 : nage PixelLab
    if (pa) ctx.drawImage(spriteCanvas(pa.name), this.snap(x) + pa.ox, this.groundY + 1 - img.height - lift + pa.oy);
    else swimDraw(ctx, canvas, px, py, canvas.width, canvas.height, { time: this.time, phase: 2.2, amp, mode, focus: this.focus || amp === 0 });
    this.petBubble = (this.petBubble ?? 0.7) - (this.dt ?? 0);
    if (this.petBubble <= 0 && !this.focus) {
      this.petBubble = 1 + Math.random();
      addBubble(this, x + img.width * 0.8, py + oy + 2, { vy: -14, r: 1, life: 1.8 });
    }
  }

  // v9.0.8 : rang de l'équipe, de droite à gauche — chevalier | familier | 1er compagnon | 2e compagnon. Chaque
  // personnage a sa case, de la largeur réelle (opaque) de son sprite, avec 3 px d'écart : aucun chevauchement.
  teamLayout(state) {
    const GAP = 3;
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
    const pet = team.find((c) => c.kind !== 'ally');
    if (pet) place(pet);
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

  drawBar(ctx, x, y, w, ratio, color) {
    const filled = Math.max(0, Math.round(w * Math.min(1, ratio)));
    ctx.fillStyle = '#1a1226';
    ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle = '#3a2a40';
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, filled, 3);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillRect(x, y, filled, 1);
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
        case 'flash':
          ctx.globalAlpha = t * 0.35;
          ctx.fillStyle = fx.color;
          ctx.fillRect(0, 0, this.width, this.height);
          break;
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
            x = fx.x0 + 14 + (HERO_X - fx.x0 - 14) * e;
            y = this.groundY - 2 - 20 * e - Math.sin(k * Math.PI) * 10;
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
        case 'beam': {
          // v9.2.2 : colonne de lumière sur toute la hauteur, qui s'estompe vers le haut (plus de trait coupé net).
          const w = fx.wide ? 7 : 4, G = this.groundY, a = Math.min(1, t * 1.5);
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
          if (fx.frames) {
            // v9.1.9 : dissolution tramée (pixels qui s'éteignent), sans écrasement flou.
            const k = Math.min(fx.frames.length - 1, Math.floor((1 - t) * fx.frames.length));
            ctx.drawImage(fx.frames[k], Math.round(fx.x - fx.w / 2), Math.round(fx.top ?? this.groundY - fx.h - fx.fly + 1), fx.w, fx.h); // v9.2.2 : là où il est mort
            break;
          }
          ctx.globalAlpha = t;
          const h = Math.max(1, Math.round(fx.h * t));
          ctx.drawImage(fx.img, Math.round(fx.x - fx.w / 2), this.groundY - h - fx.fly + 1, fx.w, h);
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

// Attaques de classe (render/class-fx.js).
installClassFx(SceneRenderer.prototype, { HERO_X, ATTACK_TIME, CAST_TIME });
installMutationFx(SceneRenderer.prototype, { HERO_X });
installElementFx(SceneRenderer.prototype);
installTraversalFx(SceneRenderer.prototype);
