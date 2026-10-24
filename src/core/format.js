// Formatage pour l'affichage uniquement : les valeurs sauvegardées restent exactes.
import { PERCENT_STATS } from '../data/items.js';

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];

// 1234 -> "1,2 K", 3400000 -> "3,4 M". Tronqué (jamais arrondi vers le haut).
export function formatNumber(value) {
  if (!Number.isFinite(value)) return '0';
  let v = value;
  let i = 0;
  while (Math.abs(v) >= 1000 && i < SUFFIXES.length - 1) {
    v /= 1000;
    i += 1;
  }
  if (i === 0) return String(Math.floor(v));
  let text = (Math.floor(v * 10) / 10).toFixed(1).replace('.', ',');
  if (text.endsWith(',0')) text = text.slice(0, -2);
  return `${text} ${SUFFIXES[i]}`;
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
