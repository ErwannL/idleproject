// Réglages propres à l'appareil (v9.1.0) : gardés dans une clé locale séparée de la sauvegarde, comme le son et la
// langue. Ils diffèrent entre PC et téléphone et n'entreront jamais en conflit avec la synchronisation cloud.
const KEY = 'idle-rpg.device';
const DEFAULTS = {
  combat: 'simple', // 'simple' | 'full' : éléments affichés sur le combat
  compact: false, // mode compact des listes (joueurs expérimentés)
  motion: 'auto', // 'auto' (préférence du système) | 'reduce' | 'full'
  uiScale: 'auto', // 'auto' | 100 | 125 | 150 | 200
  colorAid: false, // lettre de rareté sur les objets, pastilles en anneau
  contrast: false, // contraste élevé (sans décor)
  qtyMenu: false, // v9.1.3 (A22, essai) : un seul bouton de quantité qui se déplie
  skillGrid: true, // v9.1.3 (essai) : Compétences et Boosts en grille de 9 icônes (défaut choisi sur mesure)
  bossFocus: true, // v9.1.3 (essai) : mode boss réduit (boutons autour de la scène estompés pendant un boss)
  panelFold: false, // v9.1.3 (essai) : panneau à deux hauteurs (▼), défaut = bande actuelle
  panelLow: {}, // v9.1.3 : écrans dont le panneau est rétracté { tab: true }
  numFormat: 'auto', // v10.16 (B4) : 'auto' (lettres puis ×10ⁿ) | 'letters' (tout en lettres) | 'sci' (tout en ×10ⁿ)
  keys: {}, // raccourcis modifiés : { action: code }
  nav: {}, // mémoire de navigation : { lastSub, view, scroll }
};

let cache = null;

function read() {
  if (cache) return cache;
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { raw = null; }
  cache = { ...DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) };
  return cache;
}

export function pref(name) {
  return read()[name];
}

export function setPref(name, value) {
  const p = read();
  p[name] = value;
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* stockage indisponible : réglage gardé pour la session */ }
}

// Réduction des animations : réglage explicite, sinon la préférence du système (suivie quand elle change).
let systemReduce = false;
try {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  systemReduce = mq.matches;
  mq.addEventListener?.('change', (e) => { systemReduce = e.matches; });
} catch { /* hors navigateur (tests) */ }
export function reduceMotion() {
  const m = pref('motion');
  if (m === 'reduce') return true;
  if (m === 'full') return false;
  return systemReduce;
}

export function hasPref(name) {
  try { return name in (JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}); } catch { return false; }
}

// Écran tactile étroit (téléphone) : pointeur grossier et largeur de téléphone.
export function isPhone() {
  try { return window.matchMedia('(pointer: coarse) and (max-width: 560px)').matches; } catch { return false; }
}

export const PREF_DEFAULTS = DEFAULTS;
