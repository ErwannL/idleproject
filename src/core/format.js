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

// 1234 -> "1,2 K", 3400000 -> "3,4 M", 1e15 -> "1 Qa", 1e36 -> "1×10³⁶". Tronqué (jamais arrondi vers le haut).
export function formatNumber(value) {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  if (abs < 1000) return String(Math.floor(value));
  let i = Math.floor(Math.log10(abs) / 3);
  let v = value / 10 ** (i * 3);
  // Imprécision des flottants : 999,99… peut sortir à 1000.
  if (Math.abs(v) >= 1000) { v /= 1000; i += 1; }
  if (Math.abs(v) < 1) { v *= 1000; i -= 1; }
  let text = (Math.floor(v * 10) / 10).toFixed(1).replace('.', ',');
  if (text.endsWith(',0')) text = text.slice(0, -2);
  if (i >= NAMED.length) {
    // Au-delà de Dc : mantisse entre 1 et 10, puissance de 10 exacte.
    const e = Math.floor(Math.log10(abs));
    let m = (Math.floor((value / 10 ** e) * 10 + 1e-9) / 10).toFixed(1).replace('.', ','); // tronqué (sans erreur de flottant)
    if (m.endsWith(',0')) m = m.slice(0, -2);
    return `${m}×10${sup(e)}`;
  }
  return `${text} ${unitSuffix(i)}`;
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
