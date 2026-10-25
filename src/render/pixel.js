// Conversion des grilles de sprites en canvas (avec cache) et texte pixel.
import { RARITIES } from '../data/items.js';
import { itemBase } from '../core/loot.js';
import { BASE_PALETTE, FONT, FONT_BIG, SHIELD_OFFSET, SPRITES, normalizeRows, rotateRowsCW } from './sprites.js';

const cache = new Map();

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function paint(rows, palette) {
  const grid = normalizeRows(rows);
  const canvas = createCanvas(grid[0].length, grid.length);
  const ctx = canvas.getContext('2d');
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      ctx.fillStyle = palette[ch] ?? '#ff00ff';
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return canvas;
}

// Recouvre les pixels opaques d'une couleur (flash blanc, brume de profondeur, silhouette).
function tinted(source, color, alpha) {
  const canvas = createCanvas(source.width, source.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function mirrored(source) {
  const canvas = createCanvas(source.width, source.height);
  const ctx = canvas.getContext('2d');
  ctx.translate(source.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(source, 0, 0);
  return canvas;
}

// options : colors (remplacements de palette), rotate, tint {color, alpha}, flash, flip (miroir horizontal)
export function spriteCanvas(name, options = {}) {
  const { colors = null, rotate = false, tint = null, flash = false, flip = false } = options;
  const key = `${name}|${colors ? JSON.stringify(colors) : ''}|${rotate}|${tint ? tint.color + tint.alpha : ''}|${flash}|${flip}`;
  let canvas = cache.get(key);
  if (canvas) return canvas;

  const sprite = SPRITES[name];
  if (flip) {
    canvas = mirrored(spriteCanvas(name, { colors, rotate, tint, flash }));
  } else if (flash || tint) {
    const base = spriteCanvas(name, { colors, rotate });
    canvas = flash ? tinted(base, '#ffffff', 1) : tinted(base, tint.color, tint.alpha);
  } else {
    const palette = { ...BASE_PALETTE, ...(sprite.pal ?? {}), ...(colors ?? {}) };
    canvas = paint(rotate ? rotateRowsCW(sprite.rows) : sprite.rows, palette);
  }
  cache.set(key, canvas);
  return canvas;
}

// Éclaircit (t > 0) ou assombrit (t < 0) une couleur #rrggbb.
export function shade(color, t) {
  const c = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  const target = t > 0 ? [255, 250, 230] : [20, 12, 40];
  const k = Math.abs(t);
  return `#${c.map((v, i) => Math.round(v + (target[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
}

// Couleurs d'un objet équipé : principale (a), ombre (A), rareté (r) et leurs nuances.
export function itemColors(item) {
  const base = itemBase(item.baseId);
  const rarity = RARITIES.find((r) => r.id === item.rarity);
  return {
    a: base.colors.main, A: base.colors.shade, 1: shade(base.colors.main, 0.45), 2: shade(base.colors.shade, -0.45),
    r: rarity.color, 3: shade(rarity.color, 0.45), 9: shade(rarity.color, -0.4),
  };
}

// Palette d'un héros (B tabard, P ombre, W dorure, K plumet) complétée de ses nuances.
export function heroColors(palette) {
  if (!palette) return null;
  const p = { ...palette };
  if (p.B) p[4] = shade(p.B, 0.3);
  if (p.P) p[5] = shade(p.P, -0.4);
  if (p.W) { p[6] = shade(p.W, 0.4); p[7] = shade(p.W, -0.35); }
  if (p.K) p[8] = shade(p.K, -0.35);
  return p;
}

function itemSpriteName(item) {
  const base = itemBase(item.baseId);
  return `${base.slot === 'weapon' ? 'weapon' : base.slot}_${base.sprite}`;
}

// Héros composé : cape, corps, armure, bouclier, casque (heaume par défaut), arme.
// `palette` recolore le chevalier selon le héros choisi (tabard, cape, bouclier, dorures, plumet).
// Les pieds sont en (HERO_ANCHOR.x, HERO_ANCHOR.y) ; marge à droite pour l'arme tendue.
export const HERO_SIZE = { w: 68, h: 48 };
const BODY_OFFSET = { x: 4, y: 3 };
export const HERO_ANCHOR = { x: BODY_OFFSET.x + 19, y: BODY_OFFSET.y + 43 };
export const CAPE_FRAMES = ['a', 'b', 'c'];

export function heroComposite(frame, equipment, flash = false, cape = 'a', palette = null, flip = false) {
  const gear = ['weapon', 'helmet', 'armor']
    .map((slot) => (equipment[slot] ? `${equipment[slot].baseId}/${equipment[slot].rarity}` : '-'))
    .join(',');
  const key = `hero|${frame}|${gear}|${flash}|${cape}|${palette ? JSON.stringify(palette) : ''}|${flip}`;
  let canvas = cache.get(key);
  if (canvas) return canvas;

  if (flip) {
    canvas = mirrored(heroComposite(frame, equipment, flash, cape, palette));
  } else if (flash) {
    canvas = tinted(heroComposite(frame, equipment, false, cape, palette), '#ffffff', 1);
  } else {
    canvas = createCanvas(HERO_SIZE.w, HERO_SIZE.h);
    const ctx = canvas.getContext('2d');
    const body = SPRITES[`hero_${frame}`];
    const { x: ox, y: oy } = BODY_OFFSET;
    const colors = heroColors(palette);
    ctx.drawImage(spriteCanvas(`cape_${cape}`, { colors }), ox, oy + SPRITES[`cape_${cape}`].oy);
    // L'écu est porté au bras arrière : derrière le corps, il dépasse sur le côté.
    ctx.drawImage(spriteCanvas('shield', { colors }), ox + SHIELD_OFFSET.x, oy + SHIELD_OFFSET.y);
    ctx.drawImage(spriteCanvas(`hero_${frame}`, { colors }), ox, oy);
    if (equipment.armor) {
      const name = itemSpriteName(equipment.armor);
      ctx.drawImage(spriteCanvas(name, { colors: { ...colors, ...itemColors(equipment.armor) } }), ox, oy + SPRITES[name].oy);
    }
    const helmet = equipment.helmet ? itemSpriteName(equipment.helmet) : 'helmet_default';
    const helmetColors = equipment.helmet ? { ...colors, ...itemColors(equipment.helmet) } : colors;
    ctx.drawImage(spriteCanvas(helmet, { colors: helmetColors }), ox, oy + SPRITES[helmet].oy);
    const weapon = equipment.weapon;
    if (weapon) {
      const name = itemSpriteName(weapon);
      const def = SPRITES[name];
      const attack = frame === 'attack';
      const img = spriteCanvas(name, { colors: itemColors(weapon), rotate: attack });
      // En attaque, l'arme pivote : le point de prise (gx, gy) devient (h - 1 - gy, gx).
      const grip = attack ? { x: def.rows.length - 1 - def.grip.y, y: def.grip.x } : def.grip;
      ctx.drawImage(img, ox + body.hand.x - grip.x, oy + body.hand.y - grip.y);
    }
  }
  cache.set(key, canvas);
  return canvas;
}

// Rectangle des pixels opaques (pour recadrer les calques d'équipement en icônes).
function opaqueBounds(canvas) {
  const { data, width, height } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return x1 < 0 ? { x: 0, y: 0, w: width, h: height } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// Zones du chevalier montrées dans les icônes de casque et d'armure.
const ICON_REGIONS = {
  helmet: { x: 10, y: 0, w: 19, h: 19 },
  armor: { x: 8, y: 16, w: 24, h: 20 },
};

// Icône d'objet pour l'interface (data URL), agrandie et centrée.
export function itemIconUrl(item, size = 32) {
  const key = `icon|${item.baseId}|${item.rarity}|${size}`;
  let url = cache.get(key);
  if (url) return url;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  let src = spriteCanvas(itemSpriteName(item), { colors: itemColors(item) });
  let box = opaqueBounds(src);
  const region = ICON_REGIONS[item.slot];
  if (region) {
    // Casque ou armure : dessinés sur la tête ou le buste du chevalier pour rester lisibles.
    const name = itemSpriteName(item);
    const body = createCanvas(src.width, SPRITES.hero_idle.rows.length);
    const bctx = body.getContext('2d');
    bctx.drawImage(spriteCanvas('hero_idle'), 0, 0);
    bctx.drawImage(src, 0, SPRITES[name].oy);
    src = body;
    box = region;
  }
  const scale = Math.max(1, Math.floor((size - 4) / Math.max(box.w, box.h)));
  const dw = box.w * scale;
  const dh = box.h * scale;
  ctx.drawImage(src, box.x, box.y, box.w, box.h, Math.floor((size - dw) / 2), Math.floor((size - dh) / 2), dw, dh);
  url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}

// Icône de type d'emplacement (case vide, filtres).
const SLOT_ICONS = { weapon: 'weapon_sword', helmet: 'icon_hero', armor: 'icon_shield' };
export function slotIconName(slot) {
  return SLOT_ICONS[slot];
}

// options : passées à spriteCanvas (colors, tint, flash…).
export function spriteUrl(name, scale = 2, options = {}) {
  const key = `url|${name}|${scale}|${JSON.stringify(options)}`;
  let url = cache.get(key);
  if (url) return url;
  const src = spriteCanvas(name, options);
  const canvas = createCanvas(src.width * scale, src.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}

// Portrait du chevalier (recadré sur ses pixels opaques). `silhouette` : couleur unie (boss inconnu).
export function heroPortraitUrl(equipment, scale = 4, palette = null, silhouette = null) {
  const gear = ['weapon', 'helmet', 'armor'].map((s) => (equipment[s] ? equipment[s].baseId + equipment[s].rarity : '-')).join(',');
  const key = `portrait|${scale}|${JSON.stringify(palette)}|${gear}|${silhouette}`;
  const cached = cache.get(key);
  if (cached) return cached;
  let src = heroComposite('idle', equipment, false, 'a', palette);
  if (silhouette) src = tinted(src, silhouette, 1);
  const box = opaqueBounds(src);
  const canvas = createCanvas(box.w * scale, box.h * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, box.x, box.y, box.w, box.h, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}

export function textWidth(text, font = FONT) {
  let w = 0;
  for (const ch of text) w += (font[ch]?.[0].length ?? 0) + 1;
  return Math.max(0, w - 1);
}

// Nombre en police large 5×7, contour sombre d'un pixel et reflet clair sur la moitié haute.
export function drawBigText(ctx, text, x, y, color, light = '#ffffff', outline = '#1a1226') {
  const draw = (ox, oy, fill, half = false) => {
    ctx.fillStyle = fill;
    let cx = Math.round(x) + ox;
    for (const ch of text) {
      const glyph = FONT_BIG[ch];
      if (!glyph) continue;
      glyph.forEach((row, gy) => {
        if (half && gy > 2) return;
        for (let gx = 0; gx < row.length; gx++) {
          if (row[gx] === '1') ctx.fillRect(cx + gx, Math.round(y) + oy + gy, 1, 1);
        }
      });
      cx += glyph[0].length + 1;
    }
  };
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1], [0, 2], [1, 2]]) draw(dx, dy, outline);
  draw(0, 0, color);
  draw(0, 0, light, true);
}

// Texte pixel avec ombre portée d'un pixel.
export function drawText(ctx, text, x, y, color, shadow = '#1b1424') {
  const draw = (ox, oy, fill) => {
    ctx.fillStyle = fill;
    let cx = Math.round(x) + ox;
    for (const ch of text) {
      const glyph = FONT[ch];
      if (!glyph) continue;
      glyph.forEach((row, gy) => {
        for (let gx = 0; gx < row.length; gx++) {
          if (row[gx] === '1') ctx.fillRect(cx + gx, Math.round(y) + oy + gy, 1, 1);
        }
      });
      cx += glyph[0].length + 1;
    }
  };
  if (shadow) draw(1, 1, shadow);
  draw(0, 0, color);
}
