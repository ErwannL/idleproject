// Formatage pour l'affichage uniquement : les valeurs sauvegardées restent exactes.
import { PERCENT_STATS } from '../data/items.js';

// v9.7.1 (lot 5) : notation lisible — K, M, B, T, puis les noms courts Qa, Qi, Sx, Sp, Oc, No, Dc ; au-delà, la
// puissance de 10 écrite en exposant (« 1,2×10³⁶ ») au lieu des suites de lettres aa…zz, incompréhensibles.
const NAMED = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n) => String(n).split('').map((d) => SUP[Number(d)] ?? d).join('');
export function unitSuffix(i) {
  return i < NAMED.length ? NAMED[i] : `×10${sup(i * 3)}`;
}

// v10.16 (B4) : un seul format de nombre dans tout le jeu, choisi dans Paramètres › Interface :
//   'auto'    (défaut) lettres (K, M, B… Dc) jusqu'à 10³³, puis la puissance de 10 (« 1,2×10³⁶ ») ;
//   'letters' lettres partout : après Dc, aa, ab, … zz (chaque pas = ×1000) ;
//   'sci'     puissance de 10 dès 1 000 (« 1,2×10³ »).
// Réglage d'appareil (prefs), posé au démarrage par l'interface ; le cœur du jeu reste pur (défaut 'auto').
export const NUMBER_FORMATS = ['auto', 'letters', 'sci'];
let numberFormat = 'auto';
export function setNumberFormat(mode) { numberFormat = NUMBER_FORMATS.includes(mode) ? mode : 'auto'; }
export function getNumberFormat() { return numberFormat; }
// Lettres au-delà de Dc : aa (10³⁶), ab, … az, ba, … zz.
function letterSuffix(i) {
  const k = i - NAMED.length;
  if (k < 0) return NAMED[i];
  if (k >= 26 * 26) return null;
  const A = 'abcdefghijklmnopqrstuvwxyz';
  return A[Math.floor(k / 26)] + A[k % 26];
}
// Puissance de 10 : mantisse entre 1 et 10, tronquée à une décimale (sans erreur de flottant).
function sciText(value, abs) {
  const e = Math.floor(Math.log10(abs));
  let m = (Math.floor((value / 10 ** e) * 10 + 1e-9) / 10).toFixed(1).replace('.', ',');
  if (m.endsWith(',0')) m = m.slice(0, -2);
  return `${m}×10${sup(e)}`;
}

// 1234 -> "1,2 K", 3400000 -> "3,4 M", 1e15 -> "1 Qa", 1e36 -> "1×10³⁶" (mode 'auto'). Tronqué (jamais arrondi vers le haut).
export function formatNumber(value, mode = numberFormat) {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  if (abs < 1000) return String(Math.floor(value));
  if (mode === 'sci') return sciText(value, abs);
  let i = Math.floor(Math.log10(abs) / 3);
  let v = value / 10 ** (i * 3);
  // Imprécision des flottants : 999,99… peut sortir à 1000.
  if (Math.abs(v) >= 1000) { v /= 1000; i += 1; }
  if (Math.abs(v) < 1) { v *= 1000; i -= 1; }
  let text = (Math.floor(v * 10 + 1e-9) / 10).toFixed(1).replace('.', ',');
  if (text.endsWith(',0')) text = text.slice(0, -2);
  if (i >= NAMED.length) {
    const L = mode === 'letters' ? letterSuffix(i) : null;
    // Au-delà de Dc (ou de zz) : la puissance de 10 exacte.
    return L ? `${text} ${L}` : sciText(value, abs);
  }
  return `${text} ${unitSuffix(i)}`;
}

// v10.16 (B4) : multiplicateurs (« ×1,5 », « ×3,2×10⁴⁰ ») : deux décimales sous 1 000, puis le format commun.
export function formatMult(n) {
  if (!Number.isFinite(n)) return '0';
  return Math.abs(n) >= 1000 ? formatNumber(n) : String(Math.round(n * 100) / 100).replace('.', ',');
}

// Petits nombres décimaux (DPS, attaques/s) : "12,5".
export function formatDecimal(value, digits = 1) {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1000) return formatNumber(value);
  const factor = 10 ** digits;
  const text = (Math.round(value * factor) / factor).toFixed(digits).replace('.', ',');
  return text.replace(/,0+$/, '');
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  if (m > 0) return `${m} min ${String(sec).padStart(2, '0')} s`;
  return `${sec} s`;
}

export function formatStat(stat, value, signed = false) {
  const sign = signed && value > 0 ? '+' : '';
  const body = PERCENT_STATS.has(stat) ? `${formatDecimal(value)} %` : formatNumber(Math.round(value));
  return `${sign}${body}`;
}
