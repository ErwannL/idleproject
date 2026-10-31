// Thèmes d'interface (v9.0). « Chevalier » est le style d'origine ; les autres recolorent, au chargement,
// toutes les couleurs de la feuille de style et les cadres en pixel art (même calcul pour les deux).
// Les couleurs sont rangées en 4 familles d'après la teinte d'origine :
//   dark    : fonds bleu nuit        steel   : acier, bordures, textes bleutés
//   accent  : dorures et titres      primary : bleu vif des boutons principaux
// Chaque thème donne, par famille, une teinte cible (h, en degrés) et des réglages de saturation / luminosité.
// Les couleurs des raretés, des gains et des pertes ne changent jamais.

export const THEMES = [
  { id: 'knight', name: 'Chevalier', text: 'Bleu nuit et acier, dorures discrètes (style d\'origine).' },
  {
    id: 'royal', radius: 7, name: 'Royal', text: 'Bleu roi profond, cadres et filets d\'or.',
    dark: { h: 222, sMul: 1.6, lMul: 1.3 }, steel: { h: 41, sSet: 0.78, lMul: 1.2 },
    accent: { h: 45, sMul: 1.15, lMul: 1.08 }, primary: { h: 216, sMul: 1.2, lMul: 1.05 }, font: 'Georgia, "Times New Roman", serif',
  },
  {
    id: 'sylvan', name: 'Sylvestre', text: 'Sous-bois émeraude, bois sculpté et feuilles d\'or vert.',
    dark: { h: 145, sMul: 0.75 }, steel: { h: 32, sSet: 0.38, lMul: 0.95 },
    accent: { h: 78, sMul: 0.95 }, primary: { h: 135, sMul: 0.85, lMul: 0.95 },
  },
  {
    id: 'forge', radius: 2, name: 'Forge naine', text: 'Charbon, fer martelé et cuivre incandescent.',
    dark: { h: 22, sMul: 0.32 }, steel: { h: 25, sSet: 0.12, lMul: 1.02 },
    accent: { h: 24, sMul: 1.1, lMul: 0.98 }, primary: { h: 18, sMul: 0.95, lMul: 0.95 }, font: '"Trebuchet MS", Impact, sans-serif',
  },
  {
    id: 'arcane', radius: 6, name: 'Arcanes', text: 'Violet mystique, argent et runes cyan.',
    dark: { h: 270, sMul: 1.1 }, steel: { h: 282, sSet: 0.28, lMul: 1.05 },
    accent: { h: 186, sMul: 0.95, lMul: 1.05 }, primary: { h: 278, sMul: 1.0 },
  },
  {
    id: 'necro', name: 'Nécropole', text: 'Ténèbres, os blanchis et lueurs vertes.',
    dark: { h: 150, sMul: 0.22, lMul: 0.82 }, steel: { h: 45, sSet: 0.16, lMul: 1.08 },
    accent: { h: 105, sMul: 0.95 }, primary: { h: 125, sMul: 0.7, lMul: 0.9 },
  },
  {
    id: 'desert', name: 'Sables', text: 'Terre cuite, grès chaud et turquoise.',
    dark: { h: 16, sMul: 0.7 }, steel: { h: 36, sSet: 0.45, lMul: 1.02 },
    accent: { h: 174, sMul: 0.9 }, primary: { h: 176, sMul: 0.8, lMul: 0.92 },
  },
  {
    id: 'frost', radius: 6, name: 'Givre', text: 'Glace pâle, ardoise et reflets polaires.',
    dark: { h: 200, sMul: 0.75, lMul: 1.12 }, steel: { h: 194, sSet: 0.32, lMul: 1.18 },
    accent: { h: 190, sMul: 0.55, lMul: 1.15 }, primary: { h: 196, sMul: 0.9 },
  },
  {
    id: 'sakura', radius: 4, name: 'Sakura', text: 'Laque noire, prune et fleurs de cerisier.',
    dark: { h: 338, sMul: 0.75 }, steel: { h: 350, sSet: 0.14, lMul: 0.8 },
    accent: { h: 336, sMul: 0.85, lMul: 1.1 }, primary: { h: 352, sMul: 0.95, lMul: 0.95 },
  },
  {
    id: 'shadow', radius: 1, name: 'Ombre', text: 'Obsidienne, fumée violette et éclats cramoisis.',
    dark: { h: 268, sMul: 0.55, lMul: 0.72 }, steel: { h: 276, sSet: 0.32, lMul: 0.95 },
    accent: { h: 286, sMul: 0.95, lMul: 1.1 }, primary: { h: 272, sMul: 0.95, lMul: 0.9 },
  },
];

export const themeById = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0];

// v9.0.3 : décor des thèmes (hors Chevalier, volontairement sobre) : grands ornements aux coins du panneau,
// emblème sur l'en-tête, texture de fond, ornement des titres et de l'onglet actif, lueurs, et particules animées.
// motion : fall (tombent en se balançant), rise (montent), twinkle (scintillent sur place), drift (dérivent).
export const THEME_FX = {
  royal: { glow: '#ffd76a', motion: 'twinkle', count: 16, speed: [2.5, 5] },
  sylvan: { glow: '#9fe36a', motion: 'fall', count: 12, speed: [9, 16] },
  forge: { glow: '#ff8a2a', motion: 'rise', count: 18, speed: [4, 8] },
  arcane: { glow: '#5ff2ff', motion: 'rise', count: 12, speed: [7, 12] },
  necro: { glow: '#7dff6a', motion: 'rise', count: 10, speed: [9, 15] },
  desert: { glow: '#3fe0d0', motion: 'drift', count: 14, speed: [8, 14] },
  frost: { glow: '#cdf3ff', motion: 'fall', count: 22, speed: [8, 15] },
  sakura: { glow: '#ff9ccd', motion: 'fall', count: 14, speed: [10, 17] },
  shadow: { glow: '#b26bff', motion: 'rise', count: 12, speed: [8, 14] },
};

const assetUrl = (theme, file) => new URL(`assets/ui/themes/${theme}/${file}`, document.baseURI).href;

// Couche de décor posée sur le panneau (coins, emblème, particules), recréée à chaque changement de thème.
function applyDecor(theme) {
  const root = document.documentElement;
  const panel = document.getElementById('panel');
  const fx = THEME_FX[theme.id];
  for (const [key, file] of [['corner', 'corner.png'], ['crest', 'crest.png'], ['tab', 'tab_deco.png'], ['divider', 'divider.png'], ['texture', 'texture.png']]) {
    if (fx) root.style.setProperty(`--deco-${key}`, `url("${assetUrl(theme.id, file)}")`);
    else root.style.removeProperty(`--deco-${key}`);
  }
  if (fx) root.style.setProperty('--glow', fx.glow); else root.style.removeProperty('--glow');
  if (!panel) return;
  panel.querySelector('.theme-deco')?.remove();
  if (!fx) return;
  const deco = document.createElement('div');
  deco.className = 'theme-deco';
  deco.setAttribute('aria-hidden', 'true');
  const parts = [];
  for (let i = 0; i < fx.count; i++) {
    const r = (a, b) => a + Math.random() * (b - a);
    const sprite = assetUrl(theme.id, i % 3 === 2 ? 'particle2.png' : 'particle1.png');
    parts.push(`<i class="p ${fx.motion}" style="--x:${r(0, 100).toFixed(1)}%;--y:${r(0, 100).toFixed(1)}%;--t:${r(...fx.speed).toFixed(1)}s;--d:-${r(0, fx.speed[1]).toFixed(1)}s;--sc:${r(0.7, 1.3).toFixed(2)};--sw:${r(10, 34).toFixed(0)}px;background-image:url('${sprite}')"></i>`);
  }
  deco.innerHTML = `<i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i><i class="crest"></i><div class="fx">${parts.join('')}</div>`;
  panel.appendChild(deco);
}

// --- Couleurs -------------------------------------------------------------------------------------

const clamp = (v) => Math.max(0, Math.min(1, v));

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return [l, l, l].map((v) => Math.round(v * 255));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)].map((v) => Math.round(v * 255));
}

// Famille d'une couleur d'origine (null : neutre, on n'y touche pas).
export function colorFamily(r, g, b) {
  const [h, s, l] = rgbToHsl(r, g, b);
  if (s < 0.08) return null;
  if (h >= 190 && h <= 252) {
    if (s >= 0.6 && l >= 0.35 && l <= 0.8) return 'primary';
    return l < 0.3 ? 'dark' : 'steel';
  }
  if (h >= 26 && h <= 56 && s >= 0.3) return 'accent';
  return null;
}

export function transformRgb(theme, r, g, b) {
  const fam = colorFamily(r, g, b);
  const spec = fam && theme[fam];
  if (!spec) return null;
  const [h, s, l] = rgbToHsl(r, g, b);
  const s2 = spec.sSet ?? clamp(s * (spec.sMul ?? 1));
  const l2 = clamp(l * (spec.lMul ?? 1));
  return hslToRgb(spec.h ?? h, s2, l2);
}

const COLOR_RX = /#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b|rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/gi;

const HAS_COLOR = new RegExp(COLOR_RX.source, 'i');

function transformValue(theme, value) {
  return value.replace(COLOR_RX, (m, hex, r, g, b, a) => {
    let rgb;
    let alpha = 1;
    if (hex) {
      const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
      rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
      if (full.length === 8) alpha = parseInt(full.slice(6, 8), 16) / 255;
    } else {
      rgb = [Number(r), Number(g), Number(b)];
      if (a !== undefined) alpha = a.endsWith('%') ? parseFloat(a) / 100 : Number(a);
    }
    const out = transformRgb(theme, ...rgb);
    if (!out) return m;
    return alpha < 1 ? `rgba(${out.join(', ')}, ${Math.round(alpha * 1000) / 1000})` : `rgb(${out.join(', ')})`;
  });
}

// --- Application ----------------------------------------------------------------------------------

// v9.0.6 : les couleurs d'invocation aussi (un thème recolorait le faisceau doré d'un SSR en violet, rose…).
const KEEP_VARS = new Set(['--common', '--rare', '--epic', '--legendary', '--good', '--bad', '--sfx-common', '--sfx-epic', '--sfx-legendary']);
let originals = null; // [{ style, prop, value, priority }]
const frameCache = new Map(); // `${theme}:${file}` -> data URL

function styleRules(list, out = []) {
  for (const rule of list) {
    if (rule.style) out.push(rule.style);
    if (rule.cssRules) styleRules(rule.cssRules, out);
  }
  return out;
}

function snapshot() {
  if (originals) return originals;
  originals = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const style of styleRules(rules)) {
      for (let i = 0; i < style.length; i++) {
        const prop = style[i];
        const value = style.getPropertyValue(prop);
        if (KEEP_VARS.has(prop)) continue;
        if (!HAS_COLOR.test(value) && !value.includes('/frames/')) continue;
        originals.push({ style, prop, value, priority: style.getPropertyPriority(prop), base: sheet.href ?? document.baseURI });
      }
    }
  }
  return originals;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}

// Cadre pixel art recoloré (même calcul que les couleurs CSS), en data URL.
async function themedFrame(theme, url) {
  const key = `${theme.id}:${url}`;
  if (frameCache.has(key)) return frameCache.get(key);
  const im = await loadImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = im.naturalWidth;
  canvas.height = im.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(im, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    const out = transformRgb(theme, px[i], px[i + 1], px[i + 2]);
    if (out) [px[i], px[i + 1], px[i + 2]] = out;
  }
  ctx.putImageData(data, 0, 0);
  const result = canvas.toDataURL('image/png');
  frameCache.set(key, result);
  return result;
}

const URL_RX = /url\((["']?)([^"')]*\/frames\/[^"')]+)\1\)/g;

let applying = Promise.resolve();

// Applique un thème à toute l'interface (sans recharger la page).
export function applyTheme(id) {
  applying = applying.then(() => applyNow(id)).catch(() => {});
  return applying;
}

async function applyNow(id) {
  const theme = themeById(id);
  document.documentElement.dataset.theme = theme.id;
  const list = snapshot();
  const frames = new Map();
  if (theme.id !== 'knight') {
    // Adresse absolue de chaque cadre : « ../../assets/… » est relatif à la feuille de style, pas à la page
    // (sous /play/, résolu depuis la page, il pointait vers /assets/… : 404 et cadres du thème absents).
    const urls = new Map();
    for (const o of list) for (const m of o.value.matchAll(URL_RX)) urls.set(m[2], new URL(m[2], o.base).href);
    // v9.0.1 : chaque thème a ses propres cadres dessinés (assets/ui/themes/<id>/), d'un style différent ;
    // à défaut, les cadres du Chevalier sont recolorés.
    await Promise.all([...urls].map(async ([u, abs]) => {
      const own = abs.replace('/frames/', `/themes/${theme.id}/`);
      try {
        await loadImage(own);
        frames.set(u, own);
      } catch {
        try { frames.set(u, await themedFrame(theme, abs)); } catch { /* cadre introuvable : on garde l'original */ }
      }
    }));
  }
  for (const o of list) {
    let value = o.value;
    if (theme.id !== 'knight') {
      value = transformValue(theme, value).replace(URL_RX, (m, q, u) => (frames.has(u) ? `url("${frames.get(u)}")` : m));
    }
    o.style.setProperty(o.prop, value, o.priority);
  }
  document.documentElement.style.setProperty('--head-font', theme.font ?? 'inherit');
  applyDecor(theme);
  if (theme.radius !== undefined) document.documentElement.style.setProperty('--radius', `${theme.radius}px`);
  else document.documentElement.style.removeProperty('--radius');
  contrastFloor();
}

// v9.1.0 : plancher de contraste 4,5:1 pour --muted et --dim sur le fond des panneaux, quel que soit le thème
// (Sakura descendait à 2,2:1). La couleur est éclaircie juste assez.
const hexRgb = (c) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c).trim());
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  const r = /rgba?\(([^)]+)\)/.exec(String(c));
  return r ? r[1].split(',').slice(0, 3).map((x) => Number(x)) : null;
};
const lum = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
export const contrastRatio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
export function liftToContrast(color, bg, min = 4.5) {
  let c = [...color];
  for (let i = 0; i < 40 && contrastRatio(c, bg) < min; i++) c = c.map((v) => Math.min(255, Math.round(v + (255 - v) * 0.08)));
  return c;
}
function contrastFloor() {
  const root = document.documentElement;
  root.style.removeProperty('--muted');
  root.style.removeProperty('--dim');
  const cs = getComputedStyle(root);
  const bg = hexRgb(cs.getPropertyValue('--bg-2')) ?? hexRgb(cs.getPropertyValue('--bg-1'));
  if (!bg) return;
  for (const name of ['--muted', '--dim']) {
    const c = hexRgb(cs.getPropertyValue(name));
    if (!c || contrastRatio(c, bg) >= 4.5) continue;
    root.style.setProperty(name, `rgb(${liftToContrast(c, bg).join(', ')})`);
  }
}

// Aperçu d'un thème (pastilles) : fond, acier, dorure, bouton principal.
export function themeSwatches(id) {
  const theme = themeById(id);
  return ['#121d33', '#34507d', '#e8b64a', '#3d7be0'].map((hex) => {
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const out = theme.id === 'knight' ? rgb : transformRgb(theme, ...rgb) ?? rgb;
    return `rgb(${out.join(', ')})`;
  });
}
