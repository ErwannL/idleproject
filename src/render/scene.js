// Rendu de la scène de combat sur un canvas basse résolution agrandi en « pixel perfect ».
// Le rendu lit l'état de la simulation et ses événements ; il ne modifie jamais la partie.
import { BALANCE } from '../data/balance.js';
import { BOSSES, ENEMIES } from '../data/enemies.js';
import { RARITIES } from '../data/items.js';
import { ZONES } from '../data/zones.js';
import { zoneIndexForStage } from '../core/combat.js';
import { formatNumber } from '../core/format.js';
import { HERO_ANCHOR, drawText, heroComposite, spriteCanvas, textWidth } from './pixel.js';

export const MIN_VIEW_HEIGHT = 96;
const GROUND_DEPTH = 18; // hauteur du sol sous la ligne des pieds
const MIN_VIEW_WIDTH = 200; // largeur logique visée (zone d'apparition visible)
const STALE_EVENT_SECONDS = 1.5;

// Bruit déterministe pour placer le décor sans le stocker.
function hash(n) {
  let x = Math.floor(n) | 0;
  x = (x ^ 61) ^ (x >>> 16);
  x = (x + (x << 3)) | 0;
  x ^= x >>> 4;
  x = Math.imul(x, 0x27d4eb2d);
  x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}

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
    this.hero = { attack: 0, hurt: 0, victory: 0, respawn: 0, deathTime: 0 };
    this.shake = 0;
    this.zoneFade = 0;
    this.lastZone = -1;
  }

  // Taille du conteneur en pixels CSS. L'échelle vise ~200 px logiques de large ;
  // une fenêtre plus haute montre plus de ciel, une fenêtre plus large plus de décor.
  resize(cssWidth, cssHeight) {
    let scale = Math.min(cssHeight / MIN_VIEW_HEIGHT, cssWidth / MIN_VIEW_WIDTH);
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

  handleEvent(event, world) {
    if (world.time - event.time > STALE_EVENT_SECONDS) return;
    const heroX = BALANCE.world.heroX;
    switch (event.type) {
      case 'heroAttack': {
        this.hero.attack = 0.16;
        this.enemyFxFor(event.enemyId).hit = 0.08;
        this.effects.push({ kind: 'slash', x: heroX + 12, y: this.groundY - 12, life: 0.14, max: 0.14 });
        this.addText(formatNumber(event.damage), event.x, this.groundY - (event.boss ? 36 : 22), '#ffffff');
        if (event.boss) this.shake = Math.max(this.shake, 1);
        this.burst(event.x - 4, this.groundY - 8, '#ffffff', 3);
        break;
      }
      case 'heroHit':
        this.hero.hurt = 0.12;
        this.enemyFxFor(event.enemyId).lunge = 0.14;
        this.addText(formatNumber(Math.max(1, Math.round(event.damage))), heroX - 2, this.groundY - 26, '#ff5a5a');
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
        this.burst(heroX, this.groundY - 8, '#ff5a5a', 10, 40);
        break;
      case 'heroRespawn':
        this.hero.respawn = 1;
        break;
      default:
        break;
    }
  }

  addText(text, x, y, color) {
    this.effects.push({ kind: 'text', text, x: x - textWidth(text) / 2, y, color, life: 0.7, max: 0.7 });
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
    const { sprite, scale } = this.enemyLook(event.kind, event.boss);
    const img = spriteCanvas(sprite, { flash: true });
    this.effects.push({
      kind: 'corpse', img, x: event.x, w: img.width * scale, h: img.height * scale,
      fly: this.flyHeight(event.kind, event.boss), life: 0.3, max: 0.3,
    });
    this.enemyFx.delete(event.enemyId);
    const coins = event.boss ? 12 : Math.min(4, 1 + Math.floor(event.gold / 20));
    for (let i = 0; i < coins; i++) {
      this.effects.push({
        kind: 'coin', x: event.x + (Math.random() * 8 - 4), y: this.groundY - 10,
        vx: Math.random() * 40 - 20, vy: -40 - Math.random() * 30, life: 0.8, max: 0.8,
      });
    }
    this.addText(`+${formatNumber(event.gold)}`, event.x, this.groundY - (event.boss ? 44 : 30), '#ffd23f');
  }

  enemyLook(type, boss) {
    const def = boss ? ENEMIES[BOSSES[type].base] : ENEMIES[type];
    const frames = def.frames ?? [def.sprite];
    const sprite = frames[Math.floor(this.time * 6) % frames.length];
    return { def, sprite, scale: boss ? 2 : 1, colors: boss ? BOSSES[type].palette ?? null : null };
  }

  flyHeight(type, boss) {
    const def = boss ? ENEMIES[BOSSES[type].base] : ENEMIES[type];
    return def.flyHeight ?? 0;
  }

  render(state, world, dt) {
    this.time += dt;
    const ctx = this.ctx;
    const zoneIndex = zoneIndexForStage(state.stage);
    if (zoneIndex !== this.lastZone) {
      if (this.lastZone >= 0) this.zoneFade = 1;
      this.lastZone = zoneIndex;
    }
    for (const key of ['attack', 'hurt', 'victory']) this.hero[key] = Math.max(0, this.hero[key] - dt);
    this.hero.respawn = Math.max(0, this.hero.respawn - dt);
    this.hero.deathTime += dt;

    ctx.save();
    if (this.shake > 0) {
      ctx.translate(Math.round((Math.random() * 2 - 1) * this.shake), Math.round((Math.random() * 2 - 1) * this.shake));
      this.shake = Math.max(0, this.shake - dt * 12);
    }
    this.drawBackground(ctx, ZONES[zoneIndex], zoneIndex, world.scroll);
    this.drawEnemies(ctx, world, dt);
    this.drawHero(ctx, state, world);
    this.drawEffects(ctx, dt);
    ctx.restore();

    if (this.zoneFade > 0) {
      ctx.fillStyle = `rgba(10, 8, 16, ${Math.min(1, this.zoneFade)})`;
      ctx.fillRect(0, 0, this.width, this.height);
      this.zoneFade = Math.max(0, this.zoneFade - dt * 1.5);
    }
  }

  drawBackground(ctx, zone, zoneIndex, scroll) {
    const W = this.width;
    const p = zone.palette;

    // Ciel : dégradé en paliers de 3 px entre les couleurs de la zone.
    const stops = p.sky;
    for (let y = 0; y < this.groundY; y += 3) {
      const t = (y / this.groundY) * (stops.length - 1);
      const i = Math.min(stops.length - 2, Math.floor(t));
      ctx.fillStyle = mixColor(stops[i], stops[i + 1], Math.round((t - i) * 4) / 4);
      ctx.fillRect(0, y, W, 3);
    }

    if (zone.sky === 'clouds') {
      const tile = 70;
      const off = scroll * 0.08 + this.time * 2;
      const first = Math.floor(off / tile) - 1;
      for (let t = first; t <= first + W / tile + 2; t++) {
        const r = hash(t * 31 + 7);
        if (r < 0.35) continue;
        const cloud = spriteCanvas('cloud', { tint: { color: p.haze, alpha: zoneIndex === 0 ? 0.1 : 0.55 } });
        ctx.drawImage(cloud, Math.round(t * tile - off + r * 30), 4 + Math.floor(hash(t * 17) * 22));
      }
    }

    // Collines lointaines (silhouette procédurale).
    ctx.fillStyle = p.far;
    const farOff = scroll * 0.15;
    for (let x = 0; x < W; x++) {
      const wx = x + farOff;
      const h = 20 + Math.round(6 * Math.sin(wx * 0.031) + 4 * Math.sin(wx * 0.077 + 1.3));
      ctx.fillRect(x, this.groundY - h, 1, h);
    }

    if (zone.sky === 'ceiling') {
      ctx.fillStyle = p.far;
      ctx.fillRect(0, 0, W, 4);
      const tile = 16;
      const off = scroll * 0.5;
      const first = Math.floor(off / tile) - 1;
      const img = spriteCanvas('stalactite');
      for (let t = first; t <= first + W / tile + 2; t++) {
        if (hash(t * 13 + 5) < 0.4) continue;
        ctx.drawImage(img, Math.round(t * tile - off), 3);
      }
    }

    // Décor intermédiaire (parallaxe, voilé par la brume).
    this.drawDecorLayer(ctx, zone.midDecor, scroll * 0.45, 30, 0.55, this.groundY + 1, { color: p.haze, alpha: 0.45 }, 101);

    // Sol.
    ctx.fillStyle = p.ground;
    ctx.fillRect(0, this.groundY, W, this.height - this.groundY);
    ctx.fillStyle = p.groundTop;
    ctx.fillRect(0, this.groundY, W, 3);
    ctx.fillStyle = p.groundTopLight;
    ctx.fillRect(0, this.groundY, W, 1);
    ctx.fillStyle = p.groundDark;
    const first = Math.floor(scroll / 3);
    for (let t = first; t < first + W / 3 + 2; t++) {
      const r = hash(t * 3 + 1);
      if (r > 0.55) continue;
      const x = Math.round(t * 3 - scroll);
      ctx.fillRect(x, this.groundY + 4 + Math.floor(hash(t * 7) * (this.height - this.groundY - 5)), r < 0.15 ? 2 : 1, 1);
    }

    // Décor proche (derrière les personnages).
    this.drawDecorLayer(ctx, zone.nearDecor, scroll, 26, 0.45, this.groundY + 1, null, 202);
  }

  drawDecorLayer(ctx, names, offset, tile, density, baseY, tint, salt) {
    const first = Math.floor(offset / tile) - 2;
    for (let t = first; t <= first + this.width / tile + 3; t++) {
      const r = hash(t * 7 + salt);
      if (r > density) continue;
      const name = names[Math.floor(hash(t * 13 + salt) * names.length)];
      const img = spriteCanvas(name, tint ? { tint } : {});
      const x = Math.round(t * tile - offset + hash(t * 5 + salt) * (tile / 2));
      ctx.drawImage(img, x, baseY - img.height);
    }
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

      const { def, sprite, scale, colors } = this.enemyLook(enemy.type, enemy.boss);
      const img = spriteCanvas(sprite, { colors, flash: fx.hit > 0 });
      const w = img.width * scale;
      const h = img.height * scale;
      const bob = moving ? Math.round(Math.abs(Math.sin(this.time * 10 + enemy.id)) * scale) : 0;
      const hover = def.flyHeight ? def.flyHeight + Math.round(Math.sin(this.time * 4 + enemy.id) * 2) : 0;
      const lunge = fx.lunge > 0 ? Math.round(Math.sin((fx.lunge / 0.14) * Math.PI) * 4) : 0;
      const x = Math.round(enemy.x - w / 2 - lunge);
      const y = this.groundY - h - bob - hover + 1;

      ctx.globalAlpha = fx.appear;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(x + 2 * scale, this.groundY, w - 4 * scale, 2);
      ctx.drawImage(img, x, y, w, h);

      if (enemy.boss) {
        if (BOSSES[enemy.type].crown) {
          const crown = spriteCanvas('crown');
          ctx.drawImage(crown, x + Math.round(w / 2 - crown.width), y - 4, crown.width * 2, crown.height * 2);
        }
        // Aura pulsante.
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(this.time * 5);
        ctx.fillStyle = '#ff4d6d';
        ctx.fillRect(x + 2, this.groundY + 1, w - 4, 1);
      } else if (enemy.hp < enemy.maxHp) {
        this.drawBar(ctx, Math.round(enemy.x - 6), y - 4, 12, enemy.hp / enemy.maxHp, '#e84a5f');
      }
      ctx.globalAlpha = 1;
    }
  }

  drawHero(ctx, state, world) {
    const hero = world.hero;
    const baseX = BALANCE.world.heroX - HERO_ANCHOR.x;
    const baseY = this.groundY - HERO_ANCHOR.y + 1;

    if (hero.dead) {
      // Héros à terre, qui s'estompe.
      const img = heroComposite('idle', state.equipment, false);
      ctx.save();
      ctx.globalAlpha = Math.max(0.2, 1 - this.hero.deathTime);
      ctx.translate(BALANCE.world.heroX, this.groundY);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(img, -HERO_ANCHOR.y + 2, -HERO_ANCHOR.x - 2);
      ctx.restore();
      return;
    }

    let frame = 'idle';
    if (this.hero.attack > 0) frame = 'attack';
    else if (hero.walking) frame = ['walk1', 'idle', 'walk2', 'idle'][Math.floor(this.time * 8) % 4];

    const blink = this.hero.respawn > 0 && Math.floor(this.time * 12) % 2 === 0;
    if (blink) return;
    const img = heroComposite(frame, state.equipment, this.hero.hurt > 0);
    const jump = this.hero.victory > 0 ? Math.round(Math.abs(Math.sin(this.hero.victory * Math.PI * 2.5)) * 6) : 0;
    const lean = frame === 'attack' ? 1 : 0;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(BALANCE.world.heroX - 5, this.groundY, 10, 2);
    ctx.drawImage(img, baseX + lean, baseY - jump);

    const stats = world.heroStats;
    if (stats) this.drawBar(ctx, BALANCE.world.heroX - 7, baseY + 1 - jump, 14, hero.hp / stats.maxHp, '#5ad07a');
  }

  drawBar(ctx, x, y, w, ratio, color) {
    ctx.fillStyle = '#1b1424';
    ctx.fillRect(x - 1, y - 1, w + 2, 4);
    ctx.fillStyle = '#4a3a4f';
    ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.max(0, Math.round(w * Math.min(1, ratio))), 2);
  }

  drawEffects(ctx, dt) {
    const coin = spriteCanvas('coin');
    this.effects = this.effects.filter((fx) => {
      fx.life -= dt;
      if (fx.life <= 0) return false;
      const t = fx.life / fx.max;
      switch (fx.kind) {
        case 'text':
          fx.y -= 16 * dt;
          ctx.globalAlpha = Math.min(1, t * 2);
          drawText(ctx, fx.text, fx.x, fx.y, fx.color);
          break;
        case 'particle':
          fx.vy += 120 * dt;
          fx.x += fx.vx * dt;
          fx.y += fx.vy * dt;
          ctx.globalAlpha = t;
          ctx.fillStyle = fx.color;
          ctx.fillRect(Math.round(fx.x), Math.round(fx.y), 1, 1);
          break;
        case 'coin':
          fx.vy += 160 * dt;
          fx.x += fx.vx * dt;
          fx.y = Math.min(this.groundY - 4, fx.y + fx.vy * dt);
          ctx.globalAlpha = Math.min(1, t * 2);
          ctx.drawImage(coin, Math.round(fx.x - 2), Math.round(fx.y - 2));
          break;
        case 'slash': {
          ctx.globalAlpha = t;
          ctx.fillStyle = '#fff6c8';
          const reach = 10 * (1 - t) + 4;
          for (let a = -1.1; a <= 1.1; a += 0.18) {
            ctx.fillRect(Math.round(fx.x + Math.cos(a) * reach), Math.round(fx.y + Math.sin(a) * reach), 1, 1);
          }
          break;
        }
        case 'beam': {
          ctx.globalAlpha = Math.min(1, t * 1.5) * 0.7;
          ctx.fillStyle = fx.color;
          const w = fx.wide ? 5 : 3;
          ctx.fillRect(fx.x - Math.floor(w / 2), 0, w, this.groundY);
          ctx.globalAlpha = Math.min(1, t * 1.5);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(fx.x, 0, 1, this.groundY);
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
