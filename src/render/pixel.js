// Conversion des grilles de sprites en canvas (avec cache) et texte pixel.
import { RARITIES } from '../data/items.js';
import { itemBase } from '../core/loot.js';
import { BASE_PALETTE, FONT, SHIELD_OFFSET, SPRITES, normalizeRows, rotateRowsCW } from './sprites.js';

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

export function itemColors(item) {
  const base = itemBase(item.baseId);
  const rarity = RARITIES.find((r) => r.id === item.rarity);
  return { a: base.colors.main, A: base.colors.shade, r: rarity.color };
}

function itemSpriteName(item) {
  const base = itemBase(item.baseId);
  return `${base.slot === 'weapon' ? 'weapon' : base.slot}_${base.sprite}`;
}

// Héros composé : cape, corps, armure, bouclier, casque (heaume par défaut), arme.
// `palette` recolore le chevalier selon le héros choisi (tabard, cape, bouclier, dorures, plumet).
// Les pieds sont en (HERO_ANCHOR.x, HERO_ANCHOR.y) ; marge à droite pour l'arme tendue.
export const HERO_SIZE = { w: 42, h: 32 };
const BODY_OFFSET = { x: 3, y: 3 };
export const HERO_ANCHOR = { x: BODY_OFFSET.x + 12, y: BODY_OFFSET.y + 27 };
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
    const colors = palette ?? null;
    ctx.drawImage(spriteCanvas(`cape_${cape}`, { colors }), ox, oy + SPRITES[`cape_${cape}`].oy);
    ctx.drawImage(spriteCanvas(`hero_${frame}`, { colors }), ox, oy);
    if (equipment.armor) {
      const name = itemSpriteName(equipment.armor);
      ctx.drawImage(spriteCanvas(name, { colors: itemColors(equipment.armor) }), ox, oy + SPRITES[name].oy);
    }
    ctx.drawImage(spriteCanvas('shield', { colors }), ox + SHIELD_OFFSET.x, oy + SHIELD_OFFSET.y);
    const helmet = equipment.helmet ? itemSpriteName(equipment.helmet) : 'helmet_default';
    const helmetColors = equipment.helmet ? itemColors(equipment.helmet) : colors;
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
  helmet: { x: 7, y: 0, w: 12, h: 11 },
  armor: { x: 4, y: 9, w: 18, h: 10 },
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

export function heroPortraitUrl(equipment, scale = 4, palette = null) {
  const src = heroComposite('idle', equipment, false, 'a', palette);
  const key = `portrait|${scale}|${JSON.stringify(palette)}|${['weapon', 'helmet', 'armor'].map((s) => (equipment[s] ? equipment[s].baseId + equipment[s].rarity : '-')).join(',')}`;
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

// Carte du monde (parchemin pixel art) : chemin entre les zones et vignette de décor par zone.
// `nodes` : [{ x, y, sprite, locked }] en coordonnées relatives (0..1).
export function worldMapUrl(nodes, width = 200, height = 110) {
  const key = `map|${width}|${height}|${nodes.map((n) => `${n.sprite}${n.locked ? 1 : 0}`).join(',')}`;
  let url = cache.get(key);
  if (url) return url;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  // Parchemin avec grain déterministe.
  ctx.fillStyle = '#d9c28e';
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < width * height * 0.06; i++) {
    const x = (i * 97) % width;
    const y = Math.floor((i * 57) / width * 3) % height;
    ctx.fillStyle = i % 3 ? '#cdb47c' : '#e4d09f';
    ctx.fillRect(x, y, 1, 1);
  }
  // Mer et bords.
  ctx.fillStyle = '#7fa9b8';
  for (let x = 0; x < width; x++) {
    const h = 6 + Math.round(3 * Math.sin(x * 0.12) + 2 * Math.sin(x * 0.31));
    ctx.fillRect(x, height - h, 1, h);
  }
  ctx.fillStyle = '#5c4a2c';
  ctx.fillRect(0, 0, width, 1);
  ctx.fillRect(0, height - 1, width, 1);
  ctx.fillRect(0, 0, 1, height);
  ctx.fillRect(width - 1, 0, 1, height);
  // Chemin pointillé.
  ctx.fillStyle = '#7a5a33';
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const steps = 24;
    for (let s = 0; s <= steps; s += 2) {
      const t = s / steps;
      ctx.fillRect(Math.round((a.x + (b.x - a.x) * t) * width), Math.round((a.y + (b.y - a.y) * t) * height), 1, 1);
    }
  }
  // Vignettes de zone.
  for (const n of nodes) {
    const sprite = spriteCanvas(n.sprite, n.locked ? { tint: { color: '#8a7650', alpha: 0.85 } } : {});
    const scale = sprite.width > 16 ? 1 : 2;
    ctx.drawImage(sprite, Math.round(n.x * width - (sprite.width * scale) / 2), Math.round(n.y * height - sprite.height * scale + 4),
      sprite.width * scale, sprite.height * scale);
  }
  url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}
