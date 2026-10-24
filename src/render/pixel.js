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

// Héros composé : cape + corps + armure + casque + arme.
// Les pieds sont en (HERO_ANCHOR.x, HERO_ANCHOR.y) ; marge à droite pour l'arme tendue.
export const HERO_SIZE = { w: 36, h: 26 };
const BODY_OFFSET = { x: 3, y: 3 };
export const HERO_ANCHOR = { x: BODY_OFFSET.x + 10, y: BODY_OFFSET.y + 21 };
export const CAPE_FRAMES = ['a', 'b', 'c'];

export function heroComposite(frame, equipment, flash = false, cape = 'a') {
  const gear = ['weapon', 'helmet', 'armor']
    .map((slot) => (equipment[slot] ? `${equipment[slot].baseId}/${equipment[slot].rarity}` : '-'))
    .join(',');
  const key = `hero|${frame}|${gear}|${flash}|${cape}`;
  let canvas = cache.get(key);
  if (canvas) return canvas;

  if (flash) {
    canvas = tinted(heroComposite(frame, equipment, false, cape), '#ffffff', 1);
  } else {
    canvas = createCanvas(HERO_SIZE.w, HERO_SIZE.h);
    const ctx = canvas.getContext('2d');
    const body = SPRITES[`hero_${frame}`];
    const { x: ox, y: oy } = BODY_OFFSET;
    ctx.drawImage(spriteCanvas(`cape_${cape}`), ox, oy + SPRITES[`cape_${cape}`].oy);
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
  helmet: { x: 5, y: 0, w: 11, h: 10 },
  armor: { x: 3, y: 9, w: 15, h: 9 },
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
  const key = `portrait|${scale}|${['weapon', 'helmet', 'armor'].map((s) => (equipment[s] ? equipment[s].baseId + equipment[s].rarity : '-')).join(',')}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const canvas = createCanvas(src.width * scale, src.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
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
