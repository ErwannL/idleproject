// v9.8 (H8) : notifications sur téléphone — expéditions finies, gains hors ligne pleins, Titan du jour disponible.
// Deux par jour au plus, désactivables (Paramètres). Plan pur (testable) ; l'envoi est dans ui/notifications.js.
import { BALANCE } from '../data/balance.js';

const DAY = 86_400_000;
export const NOTIFY_MAX_PER_DAY = 2;

export function planNotifications(state, now = Date.now(), { titanOpen = false } = {}) {
  if (state.ui?.notify?.phone === false) return [];
  const out = [];
  const ends = (state.expeditions?.slots ?? []).filter(Boolean).map((r) => r.end).filter((t) => t > now);
  if (ends.length) out.push({ id: 1, at: Math.max(...ends), title: 'Expéditions terminées', body: 'Tes compagnons sont rentrés avec leur butin.' });
  out.push({ id: 2, at: now + (BALANCE.offline.capHours ?? 24) * 3_600_000, title: 'Gains hors ligne pleins', body: 'Ton héros a rempli son sac : viens récupérer !' });
  if (titanOpen) {
    const t = new Date(now); t.setHours(24, 0, 0, 0); t.setHours(18, 0, 0, 0); // demain, 18 h (heure locale)
    out.push({ id: 3, at: t.getTime() < now + 3_600_000 ? t.getTime() + DAY : t.getTime(), title: 'Un nouveau Titan se dresse', body: 'Le Titan du jour t\'attend : 2 essais gratuits.' });
  }
  // Pas plus de 2 par jour : on garde les plus proches, un seul par jour calendaire en plus du premier.
  const sorted = out.sort((a, b) => a.at - b.at);
  const perDay = new Map();
  return sorted.filter((n) => { const d = new Date(n.at).toDateString(); const k = perDay.get(d) ?? 0; if (k >= NOTIFY_MAX_PER_DAY) return false; perDay.set(d, k + 1); return true; });
}
