// v9.3.0 : lecture des goals de préinscription depuis le serveur (LIVE-OPS, réglés dans l'admin). Module à utiliser
// par la page d'accueil : aucune mise en page ici, seulement des données prêtes à afficher.
//   import { loadGoals, goalProgress } from './live.js';
//   const goals = await loadGoals();            // { target, count, tiers, texts, offline }
//   const p = goalProgress(goals);              // { pct, next, remaining, reached, tiers: [{ ...tier, state }] }
// En cas d'échec réseau : les goals par défaut (identiques à ceux d'avant la 9.3.0) avec count = null et offline = true.

export const DEFAULT_GOALS = {
  target: 10000,
  count: null,
  texts: {
    headline: 'Objectif : 10 000 aventuriers pour débloquer toutes les récompenses',
    reached: 'Objectif atteint, merci à tous ! Place aux paliers bonus.',
  },
  tiers: [
    { at: 250, label: '250', name: '100 gemmes', detail: 'Le premier pas : des gemmes pour tous', img: 'assets/icon_gem.png' },
    { at: 500, label: '500', name: '250 gemmes + 100 K or', detail: 'Le coup d’envoi : monnaie premium et pièces d’or', img: 'assets/shop/crystal_medium.webp' },
    { at: 1000, label: '1K', name: '1 familier exclusif', detail: 'Slime doré', tag: 'Exclusif', excl: true, img: 'assets/hd_pet_golden_slime.webp' },
    { at: 2500, label: '2,5K', name: '250 gemmes + 5 tickets', detail: 'Tickets d’invocation de héros', img: 'assets/shop/hero_ticket_permanent.webp' },
    { at: 5000, label: '5K', name: '1 compagnon exclusif', detail: 'Lame rose', tag: 'SR · Exclusif', excl: true, img: 'assets/hd_ally_rose_blade.webp' },
    { at: 10000, label: '10K', name: '1 compagnon SSR', detail: 'Archange · Jugement céleste', tag: 'SSR', excl: true, img: 'assets/px/ally_archangel.webp' },
    // Paliers bonus : récompenses mystère jusqu'à 10 000, puis révélées.
    { at: 15000, label: '15K', name: '1 apparence légendaire', detail: 'Lilith la Diablesse · Reine des braises', tag: 'Bonus · Légendaire', excl: true, img: 'assets/hd_demoness.png' },
    { at: 20000, label: '20K', name: '1 500 gemmes + 5 tickets', detail: '+ 500 K or · tickets d’invocation', tag: 'Bonus', img: 'assets/shop/crystal_large.webp' },
    { at: 35000, label: '35K', name: '1 apparence légendaire + méga pack', detail: 'Roi Grombar · 2 500 gemmes, 1 M or, 1 ticket SSR garanti', tag: 'Bonus · Méga pack', excl: true, img: 'assets/hd_grombar.png' },
    { at: 50000, label: '50K', name: '1 familier légendaire + 2 000 gemmes', detail: 'Petit phénix', tag: 'Bonus', excl: true, img: 'assets/px/pet_phoenix.webp' },
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
// Paliers bonus (seuil au-delà de l'objectif) : une fois l'objectif atteint, la barre vise le palier bonus suivant
// (`goal`) ; avant, ils sont marqués `bonus` et `secret` (le site les montre comme récompenses mystère).
export function goalProgress(goals) {
  const count = goals.count ?? 0;
  const reached = count >= goals.target;
  const next = goals.tiers.find((t) => count < t.at) ?? null;
  const nextIndex = next ? goals.tiers.indexOf(next) : -1;
  const goal = next ? next.at : goals.target; // 10.8 : toujours le prochain palier
  return {
    count,
    target: goals.target,
    goal,
    pct: Math.max(0, Math.min(100, (count / goal) * 100)),
    reached,
    next,
    remaining: next ? next.at - count : 0,
    tiers: goals.tiers.map((t, i) => ({ ...t, state: count >= t.at ? 'reached' : i === nextIndex ? 'next' : 'locked', bonus: t.at > goals.target, secret: t.at > goals.target && !reached && !goals.revealBonus })),
  };
}

// Format court d'un seuil (40260 → « 40,26K », 100000 → « 100K ») pour les libellés.
export function shortAmount(n) {
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}M`;
  if (n >= 1e3) return `${(n / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}K`;
  return String(n);
}
