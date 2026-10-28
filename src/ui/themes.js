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
    id: 'royal', name: 'Royal', text: 'Bleu roi profond, cadres et filets d\'or.',
    dark: { h: 222, sMul: 1.6, lMul: 1.3 }, steel: { h: 41, sSet: 0.78, lMul: 1.2 },
    accent: { h: 45, sMul: 1.15, lMul: 1.08 }, primary: { h: 216, sMul: 1.2, lMul: 1.05 }, font: 'Georgia, "Times New Roman", serif',
  },
  {
    id: 'sylvan', name: 'Sylvestre', text: 'Sous-bois émeraude, bois sculpté et feuilles d\'or vert.',
    dark: { h: 145, sMul: 0.75 }, steel: { h: 32, sSet: 0.38, lMul: 0.95 },
    accent: { h: 78, sMul: 0.95 }, primary: { h: 135, sMul: 0.85, lMul: 0.95 },
  },
  {
    id: 'forge', name: 'Forge naine', text: 'Charbon, fer martelé et cuivre incandescent.',
    dark: { h: 22, sMul: 0.32 }, steel: { h: 25, sSet: 0.12, lMul: 1.02 },
    accent: { h: 24, sMul: 1.1, lMul: 0.98 }, primary: { h: 18, sMul: 0.95, lMul: 0.95 }, font: '"Trebuchet MS", Impact, sans-serif',
  },
  {
    id: 'arcane', name: 'Arcanes', text: 'Violet mystique, argent et runes cyan.',
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
    id: 'frost', name: 'Givre', text: 'Glace pâle, ardoise et reflets polaires.',
    dark: { h: 200, sMul: 0.75, lMul: 1.12 }, steel: { h: 194, sSet: 0.32, lMul: 1.18 },
    accent: { h: 190, sMul: 0.55, lMul: 1.15 }, primary: { h: 196, sMul: 0.9 },
  },
  {
    id: 'sakura', name: 'Sakura', text: 'Laque noire, prune et fleurs de cerisier.',
    dark: { h: 338, sMul: 0.75 }, steel: { h: 350, sSet: 0.14, lMul: 0.8 },
    accent: { h: 336, sMul: 0.85, lMul: 1.1 }, primary: { h: 352, sMul: 0.95, lMul: 0.95 },
  },
  {
    id: 'shadow', name: 'Ombre', text: 'Noir et argent, sans aucune couleur superflue.',
    dark: { sSet: 0, lMul: 0.92 }, steel: { sSet: 0, lMul: 1.0 },
    accent: { sSet: 0.05, lMul: 1.08 }, primary: { sSet: 0.06, lMul: 0.85 },
  },
];

export const themeById = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0];

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

const KEEP_VARS = new Set(['--common', '--rare', '--epic', '--legendary', '--good', '--bad']);
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
        originals.push({ style, prop, value, priority: style.getPropertyPriority(prop) });
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
    const urls = new Set();
    for (const o of list) for (const m of o.value.matchAll(URL_RX)) urls.add(m[2]);
    await Promise.all([...urls].map(async (u) => {
      try { frames.set(u, await themedFrame(theme, u)); } catch { /* cadre introuvable : on garde l'original */ }
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
