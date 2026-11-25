// v9.8 (H8) : notifications sur téléphone — expéditions finies, gains hors ligne pleins, Titan du jour disponible.
// Deux par jour au plus, désactivables (Paramètres). Plan pur (testable) ; l'envoi est dans ui/notifications.js.
import { BALANCE } from '../data/balance.js';
import { bastionNotification } from './bastion-base.js'; // v10.3 (10.6)
import { offlineCapHours } from './offline.js';
import { FEST_RULES, FEST_SHEET_IDS, festSheet } from '../data/fest.js'; // v10.14.1 : fêtes du mois
import { currentFest, festBossStatus, festReady, festRecord } from './fest.js';
import { dayKey } from './income.js';

const DAY = 86_400_000;
export const NOTIFY_MAX_PER_DAY = 2;
export const NOTIFY_QUIET = { from: 22, to: 9 }; // jamais entre 22 h et 9 h (heure locale)

// Heure locale : jour `d` (minuit) décalé de `days` jours, à `hour` h.
const localAt = (d, days, hour) => { const t = new Date(d); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() + days); t.setHours(hour, 0, 0, 0); return t.getTime(); };
// Une notification qui tomberait dans la nuit est repoussée à 9 h.
export function outOfQuiet(at) {
  const t = new Date(at); const h = t.getHours();
  if (h >= NOTIFY_QUIET.to && h < NOTIFY_QUIET.from) return at;
  const m = new Date(at); if (h >= NOTIFY_QUIET.from) m.setDate(m.getDate() + 1);
  m.setHours(NOTIFY_QUIET.to, 0, 0, 0); return m.getTime();
}

// v10.14.1 : notifications des fêtes du mois (ids 5 à 8). Aucune valeur de jeu modifiée (au plus l'enregistrement vide de la fête en cours, comme l'écran de la fête).
function festNotifications(state, now) {
  const out = [];
  // 5 — « La fête commence » : jour 1 de la prochaine fête, à 12 h.
  const next = FEST_SHEET_IDS.map(festSheet).filter(Boolean).map((f) => ({ f, at: localAt(f.start, 0, 12) })).filter((x) => x.at > now).sort((a, b) => a.at - b.at)[0];
  if (next) out.push({ id: 5, at: next.at, title: 'La fête commence', body: `${next.f.title} : ${next.f.tagline ?? 'viens voir les nouveautés !'}` });
  const f = currentFest(now);
  if (!f) return out;
  const rec = festRecord(state, now);
  // 6 — « Entrées de Brèche pleines » : 6/6, à 18 h (grande fête, avant la fin des combats).
  if (f.kind === 'grand' && f.phase === 'play') {
    const rift = rec?.fest?.rift;
    const R = FEST_RULES.rift;
    const days = rift?.refill ? Math.max(0, Math.round((new Date(`${dayKey(now)}T12:00:00`) - new Date(`${rift.refill}T12:00:00`)) / DAY)) : 0;
    const stock = Math.min(R.maxStock, (rift?.stock ?? R.perDay) + R.perDay * days);
    if (!rift?.run) {
      const wait = Math.ceil((R.maxStock - stock) / R.perDay);
      let at = localAt(now, wait, 18);
      if (at <= now) at = localAt(now, wait + 1, 18);
      if (at < f.playEnd) out.push({ id: 6, at, title: 'Entrées de Brèche pleines', body: `${R.maxStock}/${R.maxStock} : entre dans la Brèche avant d'en perdre.` });
    }
  }
  if (f.phase === 'play') {
    // 7 — « Dernier jour » : la veille de l'échange à 18 h, seulement s'il reste quelque chose à faire.
    const at = localAt(f.playEnd, -1, 18);
    const wb = festBossStatus(state, now);
    const rift = rec?.fest?.rift;
    const todo = festReady(state, now) > 0 || (wb?.open && wb.left > 0) || (f.kind === 'grand' && (rift?.stock ?? FEST_RULES.rift.perDay) > 0 && !rift?.run);
    if (at > now && todo) out.push({ id: 7, at, title: 'Dernier jour', body: `${f.title} : demain, plus de combats. Récupère tes récompenses !` });
    // 8 — « Échange » : premier jour d'échange à 12 h, seulement s'il reste de la monnaie.
    const ex = localAt(f.playEnd, 0, 12);
    if (ex > now && (rec?.coins ?? 0) > 0) out.push({ id: 8, at: ex, title: 'Échange', body: `Dépense tes ${f.currency} à la boutique : le reste deviendra des éclats.` });
  }
  return out;
}

export function planNotifications(state, now = Date.now(), { titanOpen = false } = {}) {
  if (state.ui?.notify?.phone === false) return [];
  const out = [];
  const ends = (state.expeditions?.slots ?? []).filter(Boolean).map((r) => r.end).filter((t) => t > now);
  if (ends.length) out.push({ id: 1, at: Math.max(...ends), title: 'Expéditions terminées', body: 'Tes compagnons sont rentrés avec leur butin.' });
  out.push({ id: 2, at: now + (offlineCapHours(state, BALANCE) ?? 24) * 3_600_000, title: 'Gains hors ligne pleins', body: 'Ton héros a rempli son sac : viens récupérer !' });
  if (titanOpen) {
    const t = new Date(now); t.setHours(24, 0, 0, 0); t.setHours(18, 0, 0, 0); // demain, 18 h (heure locale)
    out.push({ id: 3, at: t.getTime() < now + 3_600_000 ? t.getTime() + DAY : t.getTime(), title: 'Un nouveau Titan se dresse', body: 'Le Titan du jour t\'attend : 2 essais gratuits.' });
  }
  // v10.3 (10.6) : le Bastion a fini ses travaux (commande prête, chantiers, recherches) — une seule notification.
  const bastion = bastionNotification(state, now);
  if (bastion && bastion.at > now) out.push({ id: 4, ...bastion });
  out.push(...festNotifications(state, now));
  for (const n of out) n.at = outOfQuiet(n.at);
  // Pas plus de 2 par jour : on garde les plus proches, un seul par jour calendaire en plus du premier.
  const sorted = out.sort((a, b) => a.at - b.at);
  const perDay = new Map();
  return sorted.filter((n) => { const d = new Date(n.at).toDateString(); const k = perDay.get(d) ?? 0; if (k >= NOTIFY_MAX_PER_DAY) return false; perDay.set(d, k + 1); return true; });
}
