// Rendu de la scène de combat sur un canvas basse résolution agrandi en « pixel perfect ».
// Le rendu lit l'état de la simulation et ses événements ; il ne modifie jamais la partie.
import { mutationById } from '../core/mutations.js';
import { auraColors } from '../data/auras.js';
import { BALANCE } from '../data/balance.js';
import { drawTeamFx } from './team-fx.js';
import { installClassFx } from './class-fx.js';
import { BOSSES, ENEMIES } from '../data/enemies.js';
import { RARITIES } from '../data/items.js';
import { ZONES } from '../data/zones.js';
import { currentEncounter } from '../core/combat.js';
import { companionById, equippedCompanions } from '../core/companions.js';
import { formatNumber } from '../core/format.js';
import { activeHero } from '../core/heroes.js';
import { activeClass } from '../core/classes.js';
import { BG } from './bg.js';
import { FONT_BIG, SPRITES } from './sprites.js';
import { HERO_ANCHOR, drawBigText, heroComposite, itemDropCanvas, spriteCanvas, textWidth } from './pixel.js';

// Vue resserrée : le chevalier (≈ 40 px) occupe un bon tiers de la hauteur de la scène.
export const MIN_VIEW_HEIGHT = 96;
const GROUND_DEPTH = 18; // hauteur du sol sous la ligne des pieds
const MIN_VIEW_WIDTH = 160; // largeur logique minimale (zoom : le chevalier reste grand)
const MAX_SCALE = 3; // zoom maximal : une grande fenêtre montre plus de décor
// Les positions de la simulation (BALANCE.world) sont agrandies à l'affichage pour
// s'accorder aux sprites v5, plus détaillés ; la simulation elle-même ne change pas.
export const WORLD_SCALE = 1.5;
// Durée de l'attaque d'un compagnon (préparation puis coup).
const ALLY_ATTACK_TIME = 0.5;

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
const FLYING_PETS = new Set(['owl', 'fairy', 'wisp']);
const STALE_EVENT_SECONDS = 1.5;
const ATTACK_TIME = 0.3; // durée de l'animation d'attaque (élan, frappe, suite)
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
    this.allyAttack = new Map();
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
    scale = Math.max(0.5, scale);
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
    switch (event.type) {
      case 'heroAttack': {
        this.hero.attack = ATTACK_TIME;
        // v9.0.6 : chaque classe a sa propre attaque (voir classAttack()).
        if (event.kind && event.kind !== 'slash') {
          // Tir et magie : pas d'élan d'épée (poses de tir / de sort à la place).
          if (['arrow', 'bolt', 'fireball', 'lightning', 'soul'].includes(event.kind)) this.hero.attack = 0;
          this.classAttack(event);
          break;
        }
        this.hero.dash = ATTACK_TIME;
        this.hero.dashTo = event.x;
        // Arc de taille dessiné (bleu, ou doré et plus grand sur un coup critique), puis impact.
        const sx = this.dashReach(event.x);
        this.dust(HERO_X - 4, 3);
        if (event.crit) this.sprite(['fx_slash_crit'], heroX + 18 + sx, this.groundY + 4, 0.22, { delay: 0.07, tint: '#ffd23f' });
        else this.sprite(['fx_slash1', 'fx_slash2', 'fx_slash3'], heroX + 14 + sx, this.groundY + 1, 0.18, { delay: 0.07 });
        // L'impact (éclair blanc, recul, étincelles, chiffre) tombe quand la lame touche, pas au début du geste.
        this.later(0.09, () => this.hitReact(event.enemyId, event.x, { crit: event.crit, boss: event.boss, damage: event.damage, color: '#ffffff' }));
        break;
      }
      case 'enemyHit':
        // v9.0.6 : les coups du héros (attaque) réagissent à l'impact réel (lame ou projectile qui arrive) : voir hitReact().
        if (event.source === 'attack') break;
        this.enemyFxFor(event.enemyId).hit = 0.08;
        this.enemyFxFor(event.enemyId).knock = Math.min(6, (this.enemyFxFor(event.enemyId).knock ?? 0) + 2);
        if (event.source !== 'hero') this.sprite(['fx_hit'], event.x, this.groundY - 10, 0.14);
        if (event.source === 'skill' || event.source === 'companion') {
          this.addText(formatNumber(event.damage), event.x, this.groundY - (event.boss ? 64 : 42), event.source === 'skill' ? '#7fd6ff' : '#9cf08a');
        }
        break;
      case 'skill':
        this.skillEffect(event);
        break;
      case 'companionSkill': {
        const companion = companionById(event.companionId);
        if (companion?.kind === 'ally') {
          // Héros allié : pose d'attaque, puis effet de sa couleur sur l'ennemi de tête.
          this.allyAttack.set(companion.id, ALLY_ATTACK_TIME);
          const front = world.enemies[0];
          const x = front ? this.wx(front.x) : heroX + 40;
          if (['hit', 'burst'].includes(companion.skill?.type)) {
            this.sprite(['fx_slash1', 'fx_slash2', 'fx_slash3'], x - 6, this.groundY + 1, 0.2, { delay: 0.08, tint: companion.fx });
          } else {
            this.sprite(['fx_spark'], heroX, this.groundY - 40, 0.5, { tint: companion.fx });
          }
        } else {
          this.effects.push({ kind: 'ring', x: heroX - 28, y: this.groundY - 14, color: '#9cf08a', life: 0.5, max: 0.5, r: 10 });
        }
        break;
      }
      case 'levelUp':
        this.effects.push({ kind: 'beam', x: heroX, color: '#ffd23f', life: 1, max: 1, wide: true });
        this.burst(heroX, this.groundY - 28, '#ffd23f', 14, 46);
        for (let i = 0; i < 5; i++) this.sprite(['fx_spark'], heroX - 16 + i * 8, this.groundY - 30 - (i % 2) * 14, 0.6, { delay: i * 0.08 });
        break;
      case 'heroHit':
        this.hero.hurt = 0.18;
        this.enemyFxFor(event.enemyId).lunge = 0.14;
        this.addText(formatNumber(Math.max(1, Math.round(event.damage))), heroX - 4, this.groundY - 48, '#ff5a5a', '#ffb0a8');
        if (event.boss) this.shake = Math.max(this.shake, 2);
        break;
      case 'kill': {
        // Tué par un projectile encore en vol : l'ennemi reste affiché (figé) jusqu'à l'impact, puis s'effondre.
        const pending = this.inFlight?.get(event.enemyId);
        if (pending && pending > this.time) {
          const fx = this.enemyFx.get(event.enemyId);
          if (fx?.img) this.effects.push({ kind: 'ghost', img: fx.img, x: fx.sx, y: fx.sy, w: fx.sw, h: fx.sh, life: pending - this.time, max: pending - this.time });
          this.later(pending - this.time, () => this.killEffect(event));
        } else this.killEffect(event);
        break;
      }
      case 'drop': {
        const color = rarityColor(event.item.rarity);
        const big = event.item.rarity === 'legendary' || event.item.rarity === 'epic';
        this.effects.push({ kind: 'beam', x: Math.round(event.x), color, life: 1.4, max: 1.4, wide: big });
        // L'objet jaillit du monstre, retombe en brillant, puis file vers le sac du chevalier.
        this.effects.push({ kind: 'loot', item: event.item, color, x0: event.x, x: event.x, y: this.groundY, life: LOOT_LIFE, max: LOOT_LIFE });
        this.burst(event.x, this.groundY - 6, color, big ? 14 : 6, 50);
        if (event.item.rarity === 'legendary') this.shake = Math.max(this.shake, 3);
        break;
      }
      case 'bossSummon':
        this.shake = Math.max(this.shake, 3);
        this.burst(HERO_X + 60, this.groundY - 20, '#ff0030', 18, 60);
        break;
      case 'gems':
        // Gemmes (cristaux) : petite gemme qui saute et texte bleu.
        this.sprite(['icon_gem'], event.x, this.groundY - 16, 0.9);
        this.addText(`+${event.gems}`, event.x, this.groundY - 40, '#6fd6ff', '#d8f6ff');
        this.burst(event.x, this.groundY - 14, '#6fd6ff', 6, 34);
        break;
      case 'bossSpawn':
        this.shake = Math.max(this.shake, 3);
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
    this.effects.push({ kind: 'text', text, x: x - textWidth(text, FONT_BIG) / 2, y, color, light, life: big ? 0.95 : 0.8, max: big ? 0.95 : 0.8, pop: big });
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
  dust(x, count) {
    for (let i = 0; i < count; i++) {
      this.effects.push({ kind: 'puff', x: x + (Math.random() * 6 - 3), y: this.groundY - 1, vx: -10 - Math.random() * 16, vy: -4 - Math.random() * 6,
        life: 0.35 + Math.random() * 0.2, max: 0.5, color: i % 2 ? '#d8d0b8' : '#a89e86' });
    }
  }

  // v9.0.6 : impact d'un coup du héros sur un ennemi — éclair blanc, recul, écrasement, étincelles dans le sens du
  // coup, chiffre ; sur un critique : arrêt sur image, anneau, secousse et étincelles dorées.
  hitReact(enemyId, x, { crit = false, boss = false, damage = 0, color = '#ffffff', y = null } = {}) {
    const fx = this.enemyFx.get(enemyId);
    const G = this.groundY;
    const ix = fx?.seen > this.time - 0.2 ? fx.edge + 2 : x - 6;
    const iy = y ?? (fx?.seen > this.time - 0.2 ? fx.sy + fx.sh * 0.5 : G - 12);
    if (fx) {
      fx.hit = crit ? 0.13 : 0.08;
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
    this.sprite(['fx_hit'], ix + 2, iy + 6, 0.14, { tint: crit ? '#ffd23f' : null });
    if (crit) {
      this.effects.push({ kind: 'ring', x: ix, y: iy, color: '#ffd23f', life: 0.25, max: 0.25, r: 12 });
      this.shake = Math.max(this.shake, boss ? 3 : 2);
    } else if (boss) this.shake = Math.max(this.shake, 1);
    if (damage) this.addText(formatNumber(damage), x, G - (boss ? 58 : 36), crit ? '#ffd23f' : '#ffffff', crit ? '#fff6c8' : '#ffffff', crit);
  }

  killEffect(event) {
    // Éclatement en pixels : quelques pixels du sprite volent en éclats (couleurs réelles du monstre).
    const fxe = this.enemyFx.get(event.enemyId);
    if (fxe?.img && !this.focus) this.shatter(fxe);
    const { sprite, scale, heroLike, colors } = this.enemyLook(event.kind, event.boss);
    const img = heroLike
      ? heroComposite('idle', { weapon: { baseId: 'fallen_blade', rarity: 'epic' } }, true, 'b', colors, true)
      : spriteCanvas(sprite, { flash: true });
    this.effects.push({
      kind: 'corpse', img, x: this.wx(event.x), w: img.width * scale, h: img.height * scale,
      fly: this.flyHeight(event.kind, event.boss), life: 0.3, max: 0.3,
    });
    this.enemyFx.delete(event.enemyId);
    const coins = event.boss ? 12 : Math.min(4, 1 + Math.floor(event.gold / 20));
    for (let i = 0; i < coins; i++) {
      this.effects.push({
        kind: 'coin', x: this.wx(event.x) + (Math.random() * 10 - 5), y: this.groundY - 14,
        vx: Math.random() * 40 - 20, vy: -40 - Math.random() * 30, life: 0.8, max: 0.8,
      });
    }
  }

  shatter(fx) {
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
  enemyLook(type, boss, attacking = false, phase = 0, moving = true) {
    const bossDef = boss ? BOSSES[type] : null;
    const def = boss ? ENEMIES[bossDef.base] : ENEMIES[type];
    const base = bossDef?.sprite ?? def.sprite;
    let frames = bossDef?.sprite ? [base] : def.frames ?? [base];
    if (frames.length === 1 && SPRITES[`${base}_b`]) frames = [base, `${base}_b`];
    // Marche : 6 images/s (4 pour les boss) ; au contact, respiration plus lente.
    const fps = moving ? (boss ? 4 : 6) : 2.5;
    const step = Math.floor(this.time * fps + phase);
    let sprite = frames[step % frames.length];
    if (attacking && SPRITES[`${base}_atk`]) sprite = `${base}_atk`;
    if (!SPRITES[sprite]) sprite = SPRITES[base] ? base : def.sprite;
    return {
      step,
      // v9.0.7 : un sprite en pleine définition (chara design PixelLab) porte son propre facteur d'échelle.
      def, sprite, heroLike: Boolean(bossDef?.heroLike), scale: (bossDef ? bossDef.scale ?? 1 : 1) * (SPRITES[sprite]?.scale ?? 1),
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
    // Mode concentration : pas de secousses ni de particules d'ambiance, effets allégés.
    this.focus = Boolean(state.ui?.focus);
    if (this.focus) this.shake = 0;
    const zoneIndex = currentEncounter(state).zoneIndex;
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
    this.drawEnemies(ctx, world, dt);
    this.drawCompanions(ctx, state, world, dt);
    this.drawHero(ctx, state, world);
    // Le familier trottine devant le chevalier (sinon il disparaît derrière lui).
    const pet = world.hero.dead ? null : equippedCompanions(state).find((c) => c.kind !== 'ally');
    if (pet) this.drawPet(ctx, world, pet);
    drawTeamFx(this, ctx, state, world, HERO_X);
    this.drawBackground(ctx, ZONES[zoneIndex], this.smoothScroll(world), true); // premier plan
    this.drawEffects(ctx, dt);
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
    if (front) this.drawAmbient(ctx, zone, scroll, true);
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
    for (let i = world.enemies.length - 1; i >= 0; i--) {
      const enemy = world.enemies[i];
      const fx = this.enemyFxFor(enemy.id);
      fx.appear = Math.min(1, fx.appear + dt * 5);
      fx.hit = Math.max(0, fx.hit - dt);
      fx.lunge = Math.max(0, fx.lunge - dt);
      fx.squash = Math.max(0, (fx.squash ?? 0) - dt);
      fx.knock = (fx.knock ?? 0) * Math.exp(-dt * 14); // recul qui revient en douceur
      // En marche tant qu'il n'est pas au contact (état de la simulation, stable d'une image à l'autre :
      // comparer les positions entre deux images faisait clignoter l'animation, la simulation avançant par pas).
      const moving = !enemy.engaged;
      const alpha = Math.min(1, world.alpha ?? 1);
      const ex = this.wx((enemy.prevX ?? enemy.x) + (enemy.x - (enemy.prevX ?? enemy.x)) * alpha);

      const { def, sprite, scale, colors, heroLike, step } = this.enemyLook(enemy.type, enemy.boss, fx.lunge > 0, enemy.id * 0.37, moving);
      // Le Chevalier déchu utilise le corps du héros, retourné, avec une épée sombre.
      const img = heroLike
        ? heroComposite(fx.lunge > 0 ? 'attack' : moving ? ['walk1', 'walk2'][Math.floor(this.time * 6) % 2] : 'idle',
          { weapon: { baseId: 'fallen_blade', rarity: 'epic' } }, fx.hit > 0, 'b', colors, true)
        : spriteCanvas(sprite, { colors, flash: fx.hit > 0 });
      const w = img.width * scale;
      const h = img.height * scale;
      // Rebond synchronisé sur l'image de marche (1 px sur la 2e image), jamais pour les volants.
      const bob = moving && !def.flyHeight && step % 2 ? 1 : 0;
      const hover = def.flyHeight ? def.flyHeight * WORLD_SCALE + this.snap(Math.sin(this.time * 4 + enemy.id) * 3) : 0;
      const lunge = fx.lunge > 0 ? this.snap(Math.sin((fx.lunge / 0.14) * Math.PI) * 6) : 0;
      // Les grands sprites (boss, ogre…) restent devant le chevalier sans le chevaucher.
      const x = this.snap(Math.max(ex - w / 2, HERO_X + 12) - lunge + (fx.knock > 0.5 ? fx.knock : 0));
      const y = this.groundY - h - bob - hover + 1;
      // Géométrie à l'écran (projectiles qui visent la cible, impacts, ennemi figé à la mort).
      Object.assign(fx, { sx: x, sy: y, sw: w, sh: h, seen: this.time, img, edge: x + bodyEdge(img) * scale });

      ctx.globalAlpha = fx.appear;
      this.drawShadow(ctx, ex, Math.max(6, w * 0.7));
      if (enemy.boss) this.drawBossAura(ctx, enemy, sprite, colors, x, y, w, h, fx.appear);
      if (enemy.elite) {
        // Élite errante : halo rouge pulsant.
        const glow = spriteCanvas(sprite, { colors, tint: { color: '#ff3b3b', alpha: 1 } });
        ctx.globalAlpha = fx.appear * (0.5 + 0.3 * Math.sin(this.time * 8));
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(glow, x + dx, y + dy, w, h);
        ctx.globalAlpha = fx.appear;
      }
      const mutation = enemy.mutation ? mutationById(enemy.mutation) : null;
      if (mutation) {
        // v9.0.4 : ennemi muté — contour de la couleur de sa mutation, pulsé (géant : un peu plus grand).
        const glow = spriteCanvas(sprite, { colors, tint: { color: mutation.color, alpha: 1 } });
        ctx.globalAlpha = fx.appear * (0.55 + 0.35 * Math.sin(this.time * 6 + enemy.id));
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1]]) ctx.drawImage(glow, x + dx, y + dy, w, h);
        ctx.globalAlpha = fx.appear;
      }
      if (fx.squash > 0) {
        // Écrasement à l'impact (ancré aux pieds) : plus large et plus bas, très bref.
        const k = fx.squash / 0.14;
        const w2 = Math.round(w * (1 + 0.12 * k));
        const h2 = Math.round(h * (1 - 0.14 * k));
        ctx.drawImage(img, x - Math.round((w2 - w) / 2), y + (h - h2), w2, h2);
      } else ctx.drawImage(img, x, y, w, h);
      if (mutation) {
        // Marqueur : losange de couleur au-dessus de la tête.
        const mx = Math.round(ex);
        const my = Math.round(y - 11 + Math.sin(this.time * 4 + enemy.id) * 1.5);
        ctx.fillStyle = '#0c0d10';
        ctx.fillRect(mx - 3, my - 1, 7, 3);
        ctx.fillRect(mx - 1, my - 3, 3, 7);
        ctx.fillStyle = mutation.color;
        ctx.fillRect(mx - 2, my, 5, 1);
        ctx.fillRect(mx, my - 2, 1, 5);
        ctx.fillRect(mx - 1, my - 1, 3, 3);
      }

      if (enemy.boss) {
        // Aura pulsante et barre de vie large.
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(this.time * 5);
        ctx.fillStyle = '#ff4d6d';
        ctx.fillRect(x + 2, this.groundY + 1, w - 4, 1);
        ctx.globalAlpha = 1;
        this.drawBar(ctx, Math.round(ex - 16), y - 6, 32, enemy.hp / enemy.maxHp, '#e84a5f');
      } else if (enemy.elite || enemy.mutation || enemy.hp < enemy.maxHp) {
        this.drawBar(ctx, Math.round(ex - 9), y - 5, 18, enemy.hp / enemy.maxHp, enemy.elite ? '#ff9a3d' : mutation ? mutation.color : '#e84a5f');
      }
      ctx.globalAlpha = 1;
    }
  }

  // Aura des boss selon leur rang : contour lumineux pulsant (plus épais et plus rouge pour les méga boss),
  // braises qui montent autour des boss durs et méga boss.
  drawBossAura(ctx, enemy, sprite, colors, x, y, w, h, appear) {
    const tier = enemy.berserk ? 'berserk' : BOSSES[enemy.type]?.tier ?? 'mega';
    const look = BOSS_AURAS[tier];
    const glow = spriteCanvas(sprite, { colors, tint: { color: look.color, alpha: 1 } });
    const pulse = 0.5 + 0.5 * Math.sin(this.time * look.speed + enemy.id);
    ctx.globalAlpha = appear * (look.alpha + 0.25 * pulse);
    for (let r = 1; r <= look.width; r++) {
      for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r]]) ctx.drawImage(glow, x + dx, y + dy, w, h);
    }
    ctx.globalAlpha = 1;
    if (look.embers && Math.random() < look.embers) {
      this.effects.push({
        kind: 'particle', x: x + Math.random() * w, y: y + h * (0.3 + Math.random() * 0.7), vx: (Math.random() - 0.5) * 6, vy: -18 - Math.random() * 14,
        color: Math.random() < 0.5 ? look.color : look.ember, life: 0.9, max: 0.9,
      });
    }
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
      ctx.drawImage(img, -HERO_ANCHOR.y + 2, -HERO_ANCHOR.x - 2);
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
      const t = ATTACK_TIME - this.hero.attack;
      frame = t < 0.07 ? 'attack1' : t < 0.17 ? 'attack2' : 'attack3';
    } else if (this.hero.cast > 0) frame = 'cast';
    else if (this.hero.hurt > 0) frame = 'hurt';
    else if (this.hero.victory > 0) frame = 'victory';
    else if (hero.walking) frame = `walk${1 + (Math.floor(this.time * 9) % 4)}`;

    const blink = this.hero.respawn > 0 && Math.floor(this.time * 12) % 2 === 0;
    if (blink) return;
    // Cape : flotte au vent en marchant, ondule doucement à l'arrêt.
    const cape = hero.walking
      ? ['c', 'a'][Math.floor(this.time * 6) % 2]
      : ['a', 'b'][Math.floor(this.time * 2.5) % 2];
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

    this.drawShadow(ctx, HERO_X, 22);
    // Cri de guerre : aura dorée ; Rempart du golem : aura bleue (flammes d'énergie derrière le chevalier).
    for (const [active, tint] of [[world.buffs?.cry > 0, { color: '#ffc23a', alpha: 0.75 }], [world.buffs?.shield > 0, null]]) {
      if (!active) continue;
      const aura = spriteCanvas(Math.floor(this.time * 8) % 2 ? 'fx_aura1' : 'fx_aura2', tint ? { tint } : {});
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(this.time * 10);
      ctx.drawImage(aura, Math.round(HERO_X + 4 - aura.width / 2), this.groundY - aura.height + 1 - jump);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(img, baseX + lean, baseY - jump);

    const stats = world.heroStats;
    if (stats) this.drawBar(ctx, HERO_X - 11 + dash, baseY - 2 - jump, 22, hero.hp / stats.maxHp, '#5ad07a');
  }

  // Compagnons : suivent le chevalier, les volants planent au-dessus de son épaule.
  // Héros allié : à taille humaine derrière le chevalier ; marche, respiration, pose d'attaque.
  drawAlly(ctx, world, companion, i) {
    const s = companion.sprite;
    const t = this.allyAttack.get(companion.id) ?? 0;
    const attacking = t > 0;
    const walking = world.hero.walking;
    let frame;
    let lunge = 0;
    if (attacking) {
      // Attaque en deux temps : préparation (recul), puis coup porté vers l'avant.
      const k = 1 - t / ALLY_ATTACK_TIME;
      const winding = k < 0.35 && SPRITES[`${s}_wind`];
      frame = winding ? `${s}_wind` : `${s}_atk`;
      lunge = winding ? -2 : Math.round(Math.sin(Math.min(1, (k - 0.35) / 0.4) * Math.PI) * 6);
    } else if (walking && SPRITES[`${s}_w1`]) {
      // Cycle de marche en 4 temps : passage → pas avant → passage → pas arrière.
      frame = [s, `${s}_w1`, s, `${s}_w2`][Math.floor(this.time * 9 + i * 2) % 4];
    } else {
      const step = Math.floor(this.time * (walking ? 7 : 2) + i);
      frame = step % 2 ? `${s}_b` : s;
    }
    const img = spriteCanvas(frame);
    const sc = SPRITES[frame]?.scale ?? 1; // v9.0.7 : sprite en pleine définition, ramené à la taille du jeu
    const w = img.width * sc;
    const h = img.height * sc;
    const bob = walking && !attacking ? this.snap(Math.abs(Math.sin(this.time * 9 * Math.PI / 2 + i)) * 1) : 0;
    // Le 2e personnage se tient un peu en retrait (plus loin et légèrement plus haut).
    const x = HERO_X - 26 - i * 24 - w / 2 + lunge;
    const y = this.groundY - h + 1 - i * 2 - bob;
    this.drawShadow(ctx, x + w / 2, 18 - bob * 2);
    if (this.maxStars(companion)) this.drawStarAura(ctx, x + w / 2, y, w, h, companion);
    this.drawStarOutline(ctx, companion, frame, this.snap(x), y, w, h);
    ctx.drawImage(img, this.snap(x), y, w, h);
  }

  // v8.9 : compagnon aux étoiles maximales → aura lumineuse (couleur de sa rareté) et étincelles qui montent.
  maxStars(companion) {
    return (this.state?.companions.owned[companion.id]?.stars ?? 0) >= BALANCE.summon.maxStars;
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
    const x = HERO_X - 6 - img.width / 2;
    if (flying) {
      const hover = 30 + Math.sin(this.time * 3) * 3;
      // Battement d'ailes : écrasement vertical rapide autour du centre du sprite.
      const flap = 1 - Math.abs(Math.sin(this.time * 12)) * 0.14;
      const cy = this.groundY - hover - img.height / 2;
      this.drawShadow(ctx, x + img.width / 2, img.width * 0.5);
      if (this.maxStars(companion)) this.drawStarAura(ctx, x + img.width / 2, cy - img.height / 2, img.width, img.height, companion);
      ctx.save();
      ctx.translate(this.snap(x + img.width / 2), this.snap(cy));
      ctx.scale(1, flap);
      this.drawStarOutline(ctx, companion, companion.sprite, -img.width / 2, -img.height / 2);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
      return;
    }
    // Petits bonds en marchant, avec écrasement à la réception.
    const phase = Math.abs(Math.sin(this.time * (walking ? 9 : 2.5)));
    const hop = walking ? phase * 4 : phase * 0.8;
    const squash = walking && phase < 0.25 ? 0.9 : 1;
    this.drawShadow(ctx, x + img.width / 2, img.width * 0.8 - hop);
    if (this.maxStars(companion)) this.drawStarAura(ctx, x + img.width / 2, this.groundY - img.height, img.width, img.height, companion);
    ctx.save();
    ctx.translate(this.snap(x + img.width / 2), this.groundY + 1 - this.snap(hop));
    ctx.scale(2 - squash, squash);
    this.drawStarOutline(ctx, companion, companion.sprite, -img.width / 2, -img.height);
    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }

  drawCompanions(ctx, state, world, dt) {
    this.state = state;
    if (world.hero.dead) return;
    for (const [id, t] of this.allyAttack) this.allyAttack.set(id, Math.max(0, t - dt));
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
      switch (fx.kind) {
        case 'text':
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
        case 'flash':
          ctx.globalAlpha = t * 0.35;
          ctx.fillStyle = fx.color;
          ctx.fillRect(0, 0, this.width, this.height);
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
        case 'ember':
          // Braise / trace laissée par un projectile : flotte un peu et s'éteint.
          fx.y += (fx.vy ?? -8) * dt;
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
          ctx.drawImage(coin, Math.round(fx.x - coin.width / 2), Math.round(fx.y - coin.height / 2));
          break;
        case 'loot': {
          const img = itemDropCanvas(fx.item);
          const age = fx.max - fx.life;
          let x = fx.x0;
          let y;
          if (age < 0.5) {
            // Saut en cloche, un peu vers l'avant.
            const k = age / 0.5;
            x = fx.x0 + 14 * k;
            y = this.groundY - 2 - Math.sin(k * Math.PI) * 26;
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
          // Halo de rareté qui pulse.
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
          ctx.globalAlpha = 1;
          ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2));
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
          ctx.globalAlpha = Math.min(1, t * 1.5) * 0.7;
          ctx.fillStyle = fx.color;
          const w = fx.wide ? 7 : 4;
          const top = Math.max(0, this.groundY - 90); // colonne de lumière bornée : pas de trait sur tout l'écran
          ctx.fillRect(fx.x - Math.floor(w / 2), top, w, this.groundY - top);
          ctx.globalAlpha = Math.min(1, t * 1.5);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(fx.x, top, 1, this.groundY - top);
          break;
        }
        case 'corpse': {
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
