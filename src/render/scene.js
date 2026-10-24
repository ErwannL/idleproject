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
import { HERO_ANCHOR, drawText, heroComposite, spriteCanvas, textWidth } from './pixel.js';

// Vue resserrée : le chevalier occupe une bonne partie de la hauteur de la scène.
export const MIN_VIEW_HEIGHT = 78;
const GROUND_DEPTH = 13; // hauteur du sol sous la ligne des pieds
const MIN_VIEW_WIDTH = 124; // largeur logique minimale : le chevalier reste grand même en colonne étroite
const MAX_FLOATING_TEXTS = 6;
const FLYING_PETS = new Set(['owl', 'fairy', 'wisp']);
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
        this.effects.push({ kind: 'slash', x: heroX + 16, y: this.groundY - 16, life: 0.14, max: 0.14, big: event.crit });
        if (event.boss) this.shake = Math.max(this.shake, 1);
        this.burst(event.x - 4, this.groundY - 8, event.crit ? '#ffd23f' : '#ffffff', event.crit ? 6 : 3);
        this.addText(formatNumber(event.damage), event.x, this.groundY - (event.boss ? 38 : 24), event.crit ? '#ffd23f' : '#ffffff');
        break;
      }
      case 'enemyHit':
        this.enemyFxFor(event.enemyId).hit = 0.08;
        if (event.source === 'skill' || event.source === 'companion') {
          this.addText(formatNumber(event.damage), event.x, this.groundY - (event.boss ? 42 : 28), event.source === 'skill' ? '#7fd6ff' : '#9cf08a');
        }
        break;
      case 'skill':
        this.skillEffect(event);
        break;
      case 'companionSkill':
        this.effects.push({ kind: 'ring', x: heroX - 18, y: this.groundY - 12, color: '#9cf08a', life: 0.5, max: 0.5, r: 8 });
        break;
      case 'levelUp':
        this.effects.push({ kind: 'beam', x: heroX, color: '#ffd23f', life: 1, max: 1, wide: true });
        this.burst(heroX, this.groundY - 20, '#ffd23f', 12, 40);
        break;
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
    const texts = this.effects.filter((e) => e.kind === 'text');
    if (texts.length >= MAX_FLOATING_TEXTS) this.effects.splice(this.effects.indexOf(texts[0]), 1);
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
    const { sprite, scale, heroLike, colors } = this.enemyLook(event.kind, event.boss);
    const img = heroLike
      ? heroComposite('idle', { weapon: { baseId: 'fallen_blade', rarity: 'epic' } }, true, 'b', colors, true)
      : spriteCanvas(sprite, { flash: true });
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
  }

  skillEffect(event) {
    const heroX = BALANCE.world.heroX;
    const y = this.groundY - 14;
    if (event.skillId === 'whirl') this.effects.push({ kind: 'ring', x: heroX + 4, y, color: '#ff7a6b', life: 0.4, max: 0.4, r: 30 });
    else if (event.skillId === 'cry') this.effects.push({ kind: 'ring', x: heroX, y, color: '#ffd23f', life: 0.5, max: 0.5, r: 18 });
    else if (event.skillId === 'holy') {
      this.effects.push({ kind: 'beam', x: Math.round(event.x), color: '#ffe680', life: 0.8, max: 0.8, wide: true });
      this.shake = Math.max(this.shake, 2);
    } else this.effects.push({ kind: 'slash', x: heroX + 16, y: y - 2, life: 0.2, max: 0.2, big: true, color: '#7fd6ff' });
  }

  // Apparence d'un ennemi : sprite, échelle, palette (boss et variantes comme le loup des glaces).
  enemyLook(type, boss) {
    const bossDef = boss ? BOSSES[type] : null;
    const def = boss ? ENEMIES[bossDef.base] : ENEMIES[type];
    const frames = bossDef?.sprite ? [bossDef.sprite] : def.frames ?? [def.sprite];
    const sprite = frames[Math.floor(this.time * 6) % frames.length];
    return {
      def, sprite, heroLike: Boolean(bossDef?.heroLike), scale: bossDef ? bossDef.scale ?? 2 : 1,
      colors: (bossDef ? bossDef.palette : def.palette) ?? null,
    };
  }

  flyHeight(type, boss) {
    const def = boss ? ENEMIES[BOSSES[type].base] : ENEMIES[type];
    return def.flyHeight ?? 0;
  }

  render(state, world, dt) {
    this.time += dt;
    const ctx = this.ctx;
    const zoneIndex = currentEncounter(state).zoneIndex;
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
    this.drawCompanions(ctx, state, world);
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

    // Silhouettes lointaines (châteaux des plaines…), voilées par la brume.
    if (zone.farDecor) {
      this.drawDecorLayer(ctx, zone.farDecor, scroll * 0.1, 150, 0.6, this.groundY - 14, { color: p.haze, alpha: 0.55 }, 303);
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

      const { def, sprite, scale, colors, heroLike } = this.enemyLook(enemy.type, enemy.boss);
      // Le Chevalier déchu utilise le corps du héros, retourné, avec une épée sombre.
      const img = heroLike
        ? heroComposite(fx.lunge > 0 ? 'attack' : moving ? ['walk1', 'walk2'][Math.floor(this.time * 6) % 2] : 'idle',
          { weapon: { baseId: 'fallen_blade', rarity: 'epic' } }, fx.hit > 0, 'b', colors, true)
        : spriteCanvas(sprite, { colors, flash: fx.hit > 0 });
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
      if (enemy.elite) {
        // Élite errante : halo rouge pulsant.
        const glow = spriteCanvas(sprite, { colors, tint: { color: '#ff3b3b', alpha: 1 } });
        ctx.globalAlpha = fx.appear * (0.5 + 0.3 * Math.sin(this.time * 8));
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(glow, x + dx, y + dy, w, h);
        ctx.globalAlpha = fx.appear;
      }
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
      } else if (enemy.elite || enemy.hp < enemy.maxHp) {
        this.drawBar(ctx, Math.round(enemy.x - 6), y - 4, 12, enemy.hp / enemy.maxHp, enemy.elite ? '#ff9a3d' : '#e84a5f');
      }
      ctx.globalAlpha = 1;
    }
  }

  drawHero(ctx, state, world) {
    const hero = world.hero;
    const baseX = BALANCE.world.heroX - HERO_ANCHOR.x;
    const baseY = this.groundY - HERO_ANCHOR.y + 1;

    const palette = activeHero(state).palette;
    if (hero.dead) {
      // Héros à terre, qui s'estompe.
      const img = heroComposite('idle', state.equipment, false, 'a', palette);
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
    // Cape : flotte au vent en marchant, ondule doucement à l'arrêt.
    const cape = hero.walking
      ? ['c', 'a'][Math.floor(this.time * 6) % 2]
      : ['a', 'b'][Math.floor(this.time * 2.5) % 2];
    const img = heroComposite(frame, state.equipment, this.hero.hurt > 0, cape, palette);
    const jump = this.hero.victory > 0 ? Math.round(Math.abs(Math.sin(this.hero.victory * Math.PI * 2.5)) * 6) : 0;
    const lean = frame === 'attack' ? 1 : 0;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(BALANCE.world.heroX - 7, this.groundY, 14, 2);
    // Cri de guerre : aura dorée ; Rempart du golem : aura bleue.
    for (const [active, color] of [[world.buffs?.cry > 0, '#ffd23f'], [world.buffs?.shield > 0, '#7fd6ff']]) {
      if (!active) continue;
      const aura = heroComposite(frame, state.equipment, false, cape, palette);
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(this.time * 10);
      const glow = this.tintedComposite(aura, color);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]]) ctx.drawImage(glow, baseX + lean + dx, baseY - jump + dy);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(img, baseX + lean, baseY - jump);

    const stats = world.heroStats;
    if (stats) this.drawBar(ctx, BALANCE.world.heroX - 8, baseY + 1 - jump, 16, hero.hp / stats.maxHp, '#5ad07a');
  }

  tintedComposite(source, color) {
    this.tintCache ??= new Map();
    const key = `${color}`;
    let canvas = this.tintCache.get(key);
    if (!canvas || canvas.width !== source.width) {
      canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      this.tintCache.set(key, canvas);
    }
    const c = canvas.getContext('2d');
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.drawImage(source, 0, 0);
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = color;
    c.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }

  // Compagnons : suivent le chevalier, les volants planent au-dessus de son épaule.
  drawCompanions(ctx, state, world) {
    if (world.hero.dead) return;
    equippedCompanions(state).forEach((companion, i) => {
      const img = spriteCanvas(companion.sprite);
      const flying = FLYING_PETS.has(companion.id);
      const x = BALANCE.world.heroX - 22 - i * 13;
      const hop = world.hero.walking ? Math.round(Math.abs(Math.sin(this.time * 9 + i)) * 2) : 0;
      const hover = flying ? 16 + Math.round(Math.sin(this.time * 3 + i) * 2) : 0;
      const y = this.groundY - img.height + 1 - hop - hover;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(x + 1, this.groundY, img.width - 2, 1);
      ctx.drawImage(img, Math.round(x), y);
    });
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
          ctx.fillStyle = fx.color ?? (fx.big ? '#ffd23f' : '#fff6c8');
          const reach = (fx.big ? 14 : 10) * (1 - t) + 4;
          for (let a = -1.1; a <= 1.1; a += 0.14) {
            ctx.fillRect(Math.round(fx.x + Math.cos(a) * reach), Math.round(fx.y + Math.sin(a) * reach), fx.big ? 2 : 1, 1);
          }
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
          const w = fx.wide ? 5 : 3;
          const top = Math.max(0, this.groundY - 64); // colonne de lumière bornée : pas de trait sur tout l'écran
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
