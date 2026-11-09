// v9.3.0 : lecture des goals de préinscription depuis le serveur (LIVE-OPS, réglés dans l'admin). Module à utiliser
// par la page d'accueil : aucune mise en page ici, seulement des données prêtes à afficher.
//   import { loadGoals, goalProgress } from './live.js';
//   const goals = await loadGoals();            // { target, count, tiers, texts, offline }
//   const p = goalProgress(goals);              // { pct, next, remaining, reached, tiers: [{ ...tier, state }] }
// En cas d'échec réseau : les goals par défaut (identiques à ceux d'avant la 9.3.0) avec count = null et offline = true.

export const DEFAULT_GOALS = {
  target: 50000,
  count: null,
  texts: {
    headline: 'Objectif : 50 000 aventuriers pour débloquer toutes les récompenses',
    reached: 'Objectif atteint, merci à tous !',
  },
  tiers: [
    { at: 5000, label: '5K', name: '500 gemmes + 250 K or', detail: 'Monnaie premium et pièces d\'or', img: 'assets/icon_gem.png' },
    { at: 10000, label: '10K', name: '1 familier + 1 000 gemmes', detail: 'Slime doré', tag: 'Exclusif', excl: true, img: 'assets/hd_pet_golden_slime.webp' },
    { at: 20000, label: '20K', name: '1 compagnon + 1 500 gemmes', detail: 'Lame rose · + 500 K or', tag: 'SR · Exclusif', excl: true, img: 'assets/hd_ally_rose_blade.webp' },
    { at: 35000, label: '35K', name: '1 héros SSR + 10 tickets', detail: 'Lilith la Diablesse · tickets d\'invocation', tag: 'SSR · Exclusif', excl: true, img: 'assets/hd_demoness.png' },
    { at: 50000, label: '50K', name: '1 héros SSR + méga pack', detail: 'Roi Grombar · 2 500 gemmes, 1 M or, 1 ticket SSR garanti', tag: 'SSR · Exclusif', excl: true, img: 'assets/hd_grombar.png' },
  ],
};

// `base` : '' sur le site (même origine que l'API).
export async function loadGoals(base = '', fetchFn = globalThis.fetch) {
  try {
    const res = await fetchFn(`${base}/api/live/goals`);
    if (!res.ok) throw new Error(String(res.status));
    const g = await res.json();
    if (!Number.isFinite(g.target) || !Array.isArray(g.tiers)) throw new Error('format');
    return { ...g, offline: false };
  } catch {
    return { ...DEFAULT_GOALS, offline: true };
  }
}

// Progression vers l'objectif choisi dans l'admin (n'importe quelle valeur : 50 000, 40 260…).
export function goalProgress(goals) {
  const count = goals.count ?? 0;
  const next = goals.tiers.find((t) => count < t.at) ?? null;
  const nextIndex = next ? goals.tiers.indexOf(next) : -1;
  return {
    count,
    target: goals.target,
    pct: Math.max(0, Math.min(100, (count / goals.target) * 100)),
    reached: count >= goals.target,
    next,
    remaining: next ? next.at - count : 0,
    tiers: goals.tiers.map((t, i) => ({ ...t, state: count >= t.at ? 'reached' : i === nextIndex ? 'next' : 'locked' })),
  };
}

// Format court d'un seuil (40260 → « 40,26K », 100000 → « 100K ») pour les libellés.
export function shortAmount(n) {
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}M`;
  if (n >= 1e3) return `${(n / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}K`;
  return String(n);
}
