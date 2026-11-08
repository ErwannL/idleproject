// v9.3.0 : lecture des goals de préinscription depuis le serveur (LIVE-OPS, réglés dans l'admin). Module à utiliser
// par la page d'accueil : aucune mise en page ici, seulement des données prêtes à afficher.
//   import { loadGoals, goalProgress } from './live.js';
//   const goals = await loadGoals();            // { target, count, tiers, texts, offline }
//   const p = goalProgress(goals);              // { pct, next, remaining, reached, tiers: [{ ...tier, state }] }
// En cas d'échec réseau : les goals par défaut (identiques à ceux d'avant la 9.3.0) avec count = null et offline = true.

export const DEFAULT_GOALS = {
  target: 100000,
  count: null,
  texts: { headline: 'Objectif : 100 000 aventuriers pour débloquer toutes les récompenses', reached: 'Objectif atteint, merci à tous !' },
  tiers: [
    { at: 10000, label: '10K', name: '500 gemmes', detail: 'Monnaie premium', img: 'assets/icon_gem.png' },
    { at: 20000, label: '20K', name: '250 K or', detail: "Pièces d'or", img: 'assets/icon_chest.png' },
    { at: 30000, label: '30K', name: '1 familier', detail: 'Slime doré', tag: 'Exclusif', excl: true, img: 'assets/hd_pet_golden_slime.webp' },
    { at: 40000, label: '40K', name: '1 000 gemmes', detail: 'Monnaie premium', img: 'assets/icon_gem.png' },
    { at: 50000, label: '50K', name: '1 compagnon', detail: 'Lame rose', tag: 'SR · Exclusif', excl: true, img: 'assets/hd_ally_rose_blade.webp' },
    { at: 60000, label: '60K', name: '1 500 gemmes', detail: '+ 500 K or', img: 'assets/icon_gem.png' },
    { at: 70000, label: '70K', name: '1 héros SSR', detail: 'Lilith la Diablesse', tag: 'SSR · Exclusif', excl: true, img: 'assets/hd_demoness.png' },
    { at: 80000, label: '80K', name: '10 tickets', detail: "d'invocation", img: 'assets/icon_chest.png' },
    { at: 90000, label: '90K', name: '1 héros SSR', detail: 'Roi Grombar', tag: 'SSR · Exclusif', excl: true, img: 'assets/hd_grombar.png' },
    { at: 100000, label: '100K', name: '2 500 gemmes', detail: '+ 1 M or + 1 ticket SSR garanti', tag: 'Méga pack', excl: true, img: 'assets/icon_chest.png' },
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
