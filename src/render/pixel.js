// Conversion des grilles de sprites en canvas (avec cache) et texte pixel.
import { ITEM_BASES, RARITIES } from '../data/items.js';
import { BASE_PALETTE, FONT, SPRITES, normalizeRows, rotateRowsCW } from './sprites.js';

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

// options : colors (remplacements de palette), rotate, tint {color, alpha}, flash
export function spriteCanvas(name, options = {}) {
  const { colors = null, rotate = false, tint = null, flash = false } = options;
  const key = `${name}|${colors ? JSON.stringify(colors) : ''}|${rotate}|${tint ? tint.color + tint.alpha : ''}|${flash}`;
  let canvas = cache.get(key);
  if (canvas) return canvas;

  const sprite = SPRITES[name];
  if (flash || tint) {
    const base = spriteCanvas(name, { colors, rotate });
    canvas = flash ? tinted(base, '#ffffff', 1) : tinted(base, tint.color, tint.alpha);
  } else {
    const palette = { ...BASE_PALETTE, ...(sprite.pal ?? {}), ...(colors ?? {}) };
    canvas = paint(rotate ? rotateRowsCW(sprite.rows) : sprite.rows, palette);
  }
  cache.set(key, canvas);
  return canvas;
}

export function itemColors(item) {
  const base = ITEM_BASES.find((b) => b.id === item.baseId);
  const rarity = RARITIES.find((r) => r.id === item.rarity);
  return { a: base.colors.main, A: base.colors.shade, r: rarity.color };
}

function itemSpriteName(item) {
  const base = ITEM_BASES.find((b) => b.id === item.baseId);
  return `${base.slot === 'weapon' ? 'weapon' : base.slot}_${base.sprite}`;
}

// Héros composé : corps + armure + casque + arme. Les pieds sont en (HERO_ANCHOR.x, HERO_ANCHOR.y).
export const HERO_SIZE = { w: 28, h: 20 };
export const HERO_ANCHOR = { x: 10, y: 19 };
const BODY_OFFSET = { x: 2, y: 3 };

export function heroComposite(frame, equipment, flash = false) {
  const gear = ['weapon', 'helmet', 'armor']
    .map((slot) => (equipment[slot] ? `${equipment[slot].baseId}/${equipment[slot].rarity}` : '-'))
    .join(',');
  const key = `hero|${frame}|${gear}|${flash}`;
  let canvas = cache.get(key);
  if (canvas) return canvas;

  if (flash) {
    canvas = tinted(heroComposite(frame, equipment), '#ffffff', 1);
  } else {
    canvas = createCanvas(HERO_SIZE.w, HERO_SIZE.h);
    const ctx = canvas.getContext('2d');
    const body = SPRITES[`hero_${frame}`];
    const { x: ox, y: oy } = BODY_OFFSET;
    ctx.drawImage(spriteCanvas(`hero_${frame}`), ox, oy);
    for (const slot of ['armor', 'helmet']) {
      const item = equipment[slot];
      if (!item) continue;
      const name = itemSpriteName(item);
      ctx.drawImage(spriteCanvas(name, { colors: itemColors(item) }), ox, oy + SPRITES[name].oy);
    }
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

// Icône d'objet pour l'interface (data URL), agrandie et centrée.
export function itemIconUrl(item, size = 32) {
  const key = `icon|${item.baseId}|${item.rarity}|${size}`;
  let url = cache.get(key);
  if (url) return url;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const name = itemSpriteName(item);
  const src = spriteCanvas(name, { colors: itemColors(item) });
  // Casques et armures : on recadre la zone utile du calque de 16 px.
  let sx = 0;
  let sw = src.width;
  if (item.slot !== 'weapon') {
    sx = 2;
    sw = 12;
  }
  const scale = Math.floor((size - 4) / Math.max(sw, src.height));
  const dw = sw * scale;
  const dh = src.height * scale;
  ctx.drawImage(src, sx, 0, sw, src.height, Math.floor((size - dw) / 2), Math.floor((size - dh) / 2), dw, dh);
  url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}

export function spriteUrl(name, scale = 2) {
  const key = `url|${name}|${scale}`;
  let url = cache.get(key);
  if (url) return url;
  const src = spriteCanvas(name);
  const canvas = createCanvas(src.width * scale, src.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}

export function heroPortraitUrl(equipment, scale = 4) {
  const src = heroComposite('idle', equipment);
  const canvas = createCanvas(src.width * scale, src.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL();
}

export function textWidth(text) {
  let w = 0;
  for (const ch of text) w += (FONT[ch]?.[0].length ?? 0) + 1;
  return Math.max(0, w - 1);
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
