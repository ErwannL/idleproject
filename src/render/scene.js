// Rendu de la scène de combat sur un canvas basse résolution agrandi en « pixel perfect ».
// Le rendu lit l'état de la simulation et ses événements ; il ne modifie jamais la partie.
import { BALANCE } from '../data/balance.js';
import { BOSSES, ENEMIES } from '../data/enemies.js';
import { RARITIES } from '../data/items.js';
import { ZONES } from '../data/zones.js';
import { currentEncounter } from '../core/combat.js';
import { equippedCompanions } from '../core/companions.js';
import { formatNumber } from '../core/format.js';
import { activeHero } from '../core/heroes.js';
import { BG } from './bg.js';
import { FONT_BIG } from './sprites.js';
import { HERO_ANCHOR, drawBigText, heroComposite, spriteCanvas, textWidth } from './pixel.js';

// Vue resserrée : le chevalier (≈ 40 px) occupe un bon tiers de la hauteur de la scène.
export const MIN_VIEW_HEIGHT = 96;
const GROUND_DEPTH = 18; // hauteur du sol sous la ligne des pieds
const MIN_VIEW_WIDTH = 160; // largeur logique minimale (zoom : le chevalier reste grand)
const MAX_SCALE = 4; // zoom maximal : une grande fenêtre montre plus de décor
// Les positions de la simulation (BALANCE.world) sont agrandies à l'affichage pour
// s'accorder aux sprites v5, plus détaillés ; la simulation elle-même ne change pas.
export const WORLD_SCALE = 1.5;
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
    this.hero = { attack: 0, hurt: 0, victory: 0, respawn: 0, deathTime: 0, cast: 0 };
    this.shake = 0;
    this.zoneFade = 0;
    this.lastZone = -1;
  }

  // Taille du conteneur en pixels CSS. L'échelle vise ~200 px logiques de large ;
  // une fenêtre plus haute montre plus de ciel, une fenêtre plus large plus de décor.
  resize(cssWidth, cssHeight) {
    // Zoom plafonné : dans une grande fenêtre, on voit davantage du niveau plutôt qu'un chevalier géant.
    let scale = Math.min(cssHeight / MIN_VIEW_HEIGHT, cssWidth / MIN_VIEW_WIDTH, MAX_SCALE);
    if (scale >= 3) scale = Math.floor(scale);
    scale = Math.max(0.5, scale);
    this.width = Math.max(120, Math.floor(cssWidth / scale));
    this.height = Math.max(MIN_VIEW_HEIGHT, Math.floor(cssHeight / scale));
    this.groundY = this.height - GROUND_DEPTH;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
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

  handleEvent(raw, world) {
    if (world.time - raw.time > STALE_EVENT_SECONDS) return;
    const event = raw.x === undefined ? raw : { ...raw, x: raw.x * WORLD_SCALE };
    const heroX = HERO_X;
    switch (event.type) {
      case 'heroAttack': {
        this.hero.attack = ATTACK_TIME;
        // Arc de taille dessiné (bleu, ou doré et plus grand sur un coup critique), puis impact.
        if (event.crit) this.sprite(['fx_slash_crit'], heroX + 18, this.groundY + 4, 0.22, { delay: 0.07, tint: '#ffd23f' });
        else this.sprite(['fx_slash1', 'fx_slash2', 'fx_slash3'], heroX + 14, this.groundY + 1, 0.18, { delay: 0.07 });
        this.sprite(['fx_hit'], event.x - 4, this.groundY - 10, 0.14, { delay: 0.1, tint: event.crit ? '#ffd23f' : null });
        if (event.boss) this.shake = Math.max(this.shake, 1);
        this.burst(event.x - 6, this.groundY - 12, event.crit ? '#ffd23f' : '#ffffff', event.crit ? 8 : 4);
        this.addText(formatNumber(event.damage), event.x, this.groundY - (event.boss ? 58 : 36), event.crit ? '#ffd23f' : '#ffffff', event.crit ? '#fff6c8' : '#ffffff');
        break;
      }
      case 'enemyHit':
        this.enemyFxFor(event.enemyId).hit = 0.08;
        if (event.source !== 'hero') this.sprite(['fx_hit'], event.x, this.groundY - 10, 0.14);
        if (event.source === 'skill' || event.source === 'companion') {
          this.addText(formatNumber(event.damage), event.x, this.groundY - (event.boss ? 64 : 42), event.source === 'skill' ? '#7fd6ff' : '#9cf08a');
        }
        break;
      case 'skill':
        this.skillEffect(event);
        break;
      case 'companionSkill':
        this.effects.push({ kind: 'ring', x: heroX - 28, y: this.groundY - 14, color: '#9cf08a', life: 0.5, max: 0.5, r: 10 });
        break;
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
      case 'kill':
        this.killEffect(event);
        break;
      case 'drop': {
        const color = rarityColor(event.item.rarity);
        const big = event.item.rarity === 'legendary' || event.item.rarity === 'epic';
        this.effects.push({ kind: 'beam', x: Math.round(event.x), color, life: 1.4, max: 1.4, wide: big });
        this.burst(event.x, this.groundY - 6, color, big ? 14 : 6, 50);
        if (event.item.rarity === 'legendary') this.shake = Math.max(this.shake, 3);
        break;
      }
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

  addText(text, x, y, color, light = '#ffffff') {
    const texts = this.effects.filter((e) => e.kind === 'text');
    if (texts.length >= MAX_FLOATING_TEXTS) this.effects.splice(this.effects.indexOf(texts[0]), 1);
    this.effects.push({ kind: 'text', text, x: x - textWidth(text, FONT_BIG) / 2, y, color, light, life: 0.8, max: 0.8 });
  }

  burst(x, y, color, count, speed = 30) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      this.effects.push({
        kind: 'particle', x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - 20,
        color, life: 0.4 + Math.random() * 0.3, max: 0.7,
      });
    }
  }

  killEffect(event) {
    const { sprite, scale, heroLike, colors } = this.enemyLook(event.kind, event.boss);
    const img = heroLike
      ? heroComposite('idle', { weapon: { baseId: 'fallen_blade', rarity: 'epic' } }, true, 'b', colors, true)
      : spriteCanvas(sprite, { flash: true });
    this.effects.push({
      kind: 'corpse', img, x: event.x * WORLD_SCALE, w: img.width * scale, h: img.height * scale,
      fly: this.flyHeight(event.kind, event.boss), life: 0.3, max: 0.3,
    });
    this.enemyFx.delete(event.enemyId);
    const coins = event.boss ? 12 : Math.min(4, 1 + Math.floor(event.gold / 20));
    for (let i = 0; i < coins; i++) {
      this.effects.push({
        kind: 'coin', x: event.x * WORLD_SCALE + (Math.random() * 10 - 5), y: this.groundY - 14,
        vx: Math.random() * 40 - 20, vy: -40 - Math.random() * 30, life: 0.8, max: 0.8,
      });
    }
  }

  skillEffect(event) {
    const heroX = HERO_X;
    const G = this.groundY;
    this.hero.cast = CAST_TIME;
    if (event.skillId === 'quick') {
      // Vague d'énergie lancée vers l'ennemi.
      const target = event.x * WORLD_SCALE;
      this.sprite(['fx_wave'], heroX + 12, G - 10, 0.3, { vx: (target - heroX - 12) / 0.3, delay: 0.05 });
    } else if (event.skillId === 'whirl') {
      this.sprite(['fx_whirl1', 'fx_whirl2', 'fx_whirl1', 'fx_whirl2', 'fx_whirl1', 'fx_whirl2'], heroX, G + 3, 0.4);
    } else if (event.skillId === 'cry') {
      for (let i = 0; i < 6; i++) this.sprite(['fx_spark'], heroX - 18 + i * 7, G - 40 - (i % 3) * 6, 0.5, { delay: i * 0.05, tint: '#ffd23f' });
    } else if (event.skillId === 'holy') {
      const target = Math.round(event.x * WORLD_SCALE);
      this.effects.push({ kind: 'beam', x: target, color: '#ffe680', life: 0.8, max: 0.8, wide: true });
      this.sprite(['fx_burst'], target, G + 1, 0.5, { tint: '#ffe680' });
      this.shake = Math.max(this.shake, 2);
    }
  }

  // Effet dessiné (images d'un sprite jouées sur `life` secondes), centré en x, posé sur y.
  sprite(frames, x, y, life, { delay = 0, tint = null, vx = 0 } = {}) {
    this.effects.push({ kind: 'sprite', frames, x, y, life: life + delay, max: life, delay, tint, vx });
  }

  // Apparence d'un ennemi : sprite, échelle, palette (boss et variantes comme le loup des glaces).
  enemyLook(type, boss) {
    const bossDef = boss ? BOSSES[type] : null;
    const def = boss ? ENEMIES[bossDef.base] : ENEMIES[type];
    const frames = bossDef?.sprite ? [bossDef.sprite] : def.frames ?? [def.sprite];
    const sprite = frames[Math.floor(this.time * 6) % frames.length];
    return {
      def, sprite, heroLike: Boolean(bossDef?.heroLike), scale: bossDef ? bossDef.scale ?? 1 : 1,
      colors: (bossDef ? bossDef.palette : def.palette) ?? null,
    };
  }

  flyHeight(type, boss) {
    const def = boss ? ENEMIES[BOSSES[type].base] : ENEMIES[type];
    return (def.flyHeight ?? 0) * WORLD_SCALE;
  }

  render(state, world, dt) {
    this.time += dt;
    const ctx = this.ctx;
    const zoneIndex = currentEncounter(state).zoneIndex;
    if (zoneIndex !== this.lastZone) {
      if (this.lastZone >= 0) this.zoneFade = 1;
      this.lastZone = zoneIndex;
    }
    for (const key of ['attack', 'hurt', 'victory', 'cast']) this.hero[key] = Math.max(0, this.hero[key] - dt);
    this.hero.respawn = Math.max(0, this.hero.respawn - dt);
    this.hero.deathTime += dt;

    ctx.save();
    if (this.shake > 0) {
      ctx.translate(Math.round((Math.random() * 2 - 1) * this.shake), Math.round((Math.random() * 2 - 1) * this.shake));
      this.shake = Math.max(0, this.shake - dt * 12);
    }
    this.drawBackground(ctx, ZONES[zoneIndex], this.smoothScroll(world));
    this.drawEnemies(ctx, world, dt);
    this.drawCompanions(ctx, state, world);
    this.drawHero(ctx, state, world);
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
    const bg = BG[zone.id];
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
    if (!a) return;
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

  // Défilement interpolé entre deux pas de simulation.
  smoothScroll(world) {
    const prev = world.prevScroll ?? world.scroll;
    return (prev + (world.scroll - prev) * Math.min(1, world.alpha ?? 1)) * WORLD_SCALE;
  }

  // Calque répété horizontalement, décalé de `offset` pixels.
  drawLayer(ctx, img, offset, y) {
    if (!img) return;
    const w = img.width;
    let x = -(Math.floor(offset) % w);
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
      const moving = fx.lastX !== null && Math.abs(fx.lastX - enemy.x) > 0.01;
      fx.lastX = enemy.x;
      const alpha = Math.min(1, world.alpha ?? 1);
      const ex = ((enemy.prevX ?? enemy.x) + (enemy.x - (enemy.prevX ?? enemy.x)) * alpha) * WORLD_SCALE;

      const { def, sprite, scale, colors, heroLike } = this.enemyLook(enemy.type, enemy.boss);
      // Le Chevalier déchu utilise le corps du héros, retourné, avec une épée sombre.
      const img = heroLike
        ? heroComposite(fx.lunge > 0 ? 'attack' : moving ? ['walk1', 'walk2'][Math.floor(this.time * 6) % 2] : 'idle',
          { weapon: { baseId: 'fallen_blade', rarity: 'epic' } }, fx.hit > 0, 'b', colors, true)
        : spriteCanvas(sprite, { colors, flash: fx.hit > 0 });
      const w = img.width * scale;
      const h = img.height * scale;
      const bob = moving ? Math.round(Math.abs(Math.sin(this.time * 10 + enemy.id)) * scale) : 0;
      const hover = def.flyHeight ? def.flyHeight * WORLD_SCALE + Math.round(Math.sin(this.time * 4 + enemy.id) * 3) : 0;
      const lunge = fx.lunge > 0 ? Math.round(Math.sin((fx.lunge / 0.14) * Math.PI) * 6) : 0;
      // Les grands sprites (boss, ogre…) restent devant le chevalier sans le chevaucher.
      const x = Math.round(Math.max(ex - w / 2, HERO_X + 12) - lunge);
      const y = this.groundY - h - bob - hover + 1;

      ctx.globalAlpha = fx.appear;
      this.drawShadow(ctx, ex, Math.max(6, w * 0.7));
      if (enemy.elite) {
        // Élite errante : halo rouge pulsant.
        const glow = spriteCanvas(sprite, { colors, tint: { color: '#ff3b3b', alpha: 1 } });
        ctx.globalAlpha = fx.appear * (0.5 + 0.3 * Math.sin(this.time * 8));
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(glow, x + dx, y + dy, w, h);
        ctx.globalAlpha = fx.appear;
      }
      ctx.drawImage(img, x, y, w, h);

      if (enemy.boss) {
        // Aura pulsante et barre de vie large.
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(this.time * 5);
        ctx.fillStyle = '#ff4d6d';
        ctx.fillRect(x + 2, this.groundY + 1, w - 4, 1);
        ctx.globalAlpha = 1;
        this.drawBar(ctx, Math.round(ex - 16), y - 6, 32, enemy.hp / enemy.maxHp, '#e84a5f');
      } else if (enemy.elite || enemy.hp < enemy.maxHp) {
        this.drawBar(ctx, Math.round(ex - 9), y - 5, 18, enemy.hp / enemy.maxHp, enemy.elite ? '#ff9a3d' : '#e84a5f');
      }
      ctx.globalAlpha = 1;
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
    let frame = ['idle', 'idle2'][Math.floor(this.time * 2) % 2];
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
    const lean = frame === 'attack2' ? 2 : frame === 'hurt' ? -2 : 0;

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
    if (stats) this.drawBar(ctx, HERO_X - 11, baseY - 2 - jump, 22, hero.hp / stats.maxHp, '#5ad07a');
  }

  // Compagnons : suivent le chevalier, les volants planent au-dessus de son épaule.
  drawCompanions(ctx, state, world) {
    if (world.hero.dead) return;
    equippedCompanions(state).forEach((companion, i) => {
      const img = spriteCanvas(companion.sprite);
      const flying = FLYING_PETS.has(companion.id);
      const x = HERO_X - 36 - i * 20 - img.width / 2;
      const hop = world.hero.walking ? Math.round(Math.abs(Math.sin(this.time * 9 + i)) * 3) : 0;
      const hover = flying ? 26 + Math.round(Math.sin(this.time * 3 + i) * 3) : 0;
      const y = this.groundY - img.height + 1 - hop - hover;
      if (!flying) this.drawShadow(ctx, x + img.width / 2, img.width * 0.8);
      ctx.drawImage(img, Math.round(x), y);
    });
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
    this.effects = this.effects.filter((fx) => {
      fx.life -= dt;
      if (fx.life <= 0) return false;
      const t = fx.life / fx.max;
      switch (fx.kind) {
        case 'text':
          fx.y -= (fx.life > fx.max - 0.12 ? 60 : 14) * dt; // petit rebond puis montée lente
          ctx.globalAlpha = Math.min(1, t * 2.5);
          drawBigText(ctx, fx.text, fx.x, fx.y, fx.color, fx.light);
          break;
        case 'particle':
          fx.vy += 120 * dt;
          fx.x += fx.vx * dt;
          fx.y += fx.vy * dt;
          ctx.globalAlpha = t;
          ctx.fillStyle = fx.color;
          ctx.fillRect(Math.round(fx.x), Math.round(fx.y), 2, 2);
          break;
        case 'coin':
          fx.vy += 160 * dt;
          fx.x += fx.vx * dt;
          fx.y = Math.min(this.groundY - 4, fx.y + fx.vy * dt);
          ctx.globalAlpha = Math.min(1, t * 2);
          ctx.drawImage(coin, Math.round(fx.x - coin.width / 2), Math.round(fx.y - coin.height / 2));
          break;
        case 'sprite': {
          if (fx.life > fx.max) break; // pas encore commencé
          const k = 1 - t;
          const name = fx.frames[Math.min(fx.frames.length - 1, Math.floor(k * fx.frames.length))];
          const img = spriteCanvas(name, fx.tint ? { tint: { color: fx.tint, alpha: 0.65 } } : {});
          const x = fx.x + fx.vx * (fx.max - fx.life);
          ctx.globalAlpha = Math.min(1, t * 4);
          ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(fx.y - img.height));
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
    if (this.effects.length > 400) this.effects.splice(0, this.effects.length - 400);
  }
}
