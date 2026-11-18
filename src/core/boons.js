// v9.9 (K7) : Bénédictions élémentaires de donjon — entre deux salles, choisir 1 carte parmi 3 (rareté : ↑, ↑↑, ↑↑↑).
// Elles suivent les éléments et les rôles de l'équipe (la composition compte). Elles durent jusqu'à la fin du donjon.
// v9.9 (K8) : bonus temporaires des Rencontres de route (state.roadBuffs, avec une fin en temps de jeu).
import { unitElement, ELEMENTS } from './elements.js';
import { COMPANION_ROLES } from '../data/synergies.js';

export const BOON_RARITY = [
  { id: 'normal', label: 'Bénie', arrows: 1, k: 1, w: 70 },
  { id: 'rare', label: 'Sacrée', arrows: 2, k: 1.6, w: 25 },
  { id: 'legend', label: 'Divine', arrows: 3, k: 2.4, w: 5 },
];
// eff(state) → effets de base (avant la rareté) ; text : une ligne.
export const BOONS = [
  { id: 'blade', icon: 'icon_damage', name: 'Lame aiguisée', text: 'Dégâts de l\'équipe', eff: () => ({ damagePct: 12 }) },
  { id: 'stone', icon: 'icon_heart', name: 'Peau de pierre', text: 'PV de l\'équipe', eff: () => ({ maxHpPct: 18 }) },
  { id: 'element', icon: 'icon_star', name: 'Ferveur élémentaire', text: 'Dégâts, davantage si 2 compagnons partagent un élément',
    eff: (s) => { const els = (s.companions?.equipped ?? []).map(unitElement).filter(Boolean); const same = els.some((e) => els.filter((x) => x === e).length >= 2); return { damagePct: same ? 22 : 10 }; } },
  { id: 'healers', icon: 'icon_regen', name: 'Grâce des soigneurs', text: 'Régénération, et PV si un soigneur est là',
    eff: (s) => ({ regenPct: 1.5, maxHpPct: (s.companions?.equipped ?? []).some((id) => COMPANION_ROLES[id] === 'healer') ? 12 : 0 }) },
  { id: 'hunter', icon: 'icon_crit', name: 'Œil de faucon', text: 'Chance de coup critique', eff: () => ({ critChance: 5 }) },
  { id: 'wind', icon: 'icon_bolt', name: 'Vent rapide', text: 'Vitesse d\'attaque', eff: () => ({ attackSpeedPct: 10 }) },
  { id: 'bane', icon: 'icon_boss', name: 'Fléau des gardiens', text: 'Dégâts contre le boss du donjon', eff: () => ({ damageVsBossPct: 30 }) },
  { id: 'guardians', icon: 'icon_shield', name: 'Rempart des gardiens', text: 'Armure, davantage avec un gardien',
    eff: (s) => ({ armor: (s.companions?.equipped ?? []).some((id) => COMPANION_ROLES[id] === 'guardian') ? 30 : 15 }) },
];
const scale = (e, k) => Object.fromEntries(Object.entries(e).filter(([, v]) => v).map(([key, v]) => [key, Math.round(v * k * 10) / 10]));

export function offerBoons(state, rng) {
  const run = state.dungeon;
  if (!run) return null;
  const pool = BOONS.filter((b) => !(run.boons ?? []).some((x) => x.id === b.id));
  const pick = [];
  while (pick.length < 3 && pool.length) pick.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
  const rar = () => { let x = rng.next() * 100; return BOON_RARITY.find((r) => (x -= r.w) < 0) ?? BOON_RARITY[0]; };
  run.offer = pick.map((b) => { const r = rar(); return { id: b.id, rarity: r.id, eff: scale(b.eff(state), r.k) }; });
  return run.offer;
}
// Choix (index), ou le plus rare si index absent (choix automatique au bout de 20 s).
export function pickBoon(state, index = null) {
  const run = state.dungeon;
  if (!run?.offer?.length) return null;
  const order = BOON_RARITY.map((r) => r.id);
  const i = Number.isInteger(index) ? index : run.offer.reduce((bi, o, j) => (order.indexOf(o.rarity) > order.indexOf(run.offer[bi].rarity) ? j : bi), 0);
  const chosen = run.offer[i];
  if (!chosen) return null;
  (run.boons ??= []).push(chosen);
  run.offer = null;
  return chosen;
}
export function boonEffects(state) {
  const out = {};
  for (const b of state.dungeon?.boons ?? []) for (const [k, v] of Object.entries(b.eff)) out[k] = (out[k] ?? 0) + v;
  const now = state.playSeconds ?? 0;
  for (const b of state.roadBuffs ?? []) if (b.until > now) for (const [k, v] of Object.entries(b.eff)) out[k] = (out[k] ?? 0) + v;
  return out;
}
export const boonById = (id) => BOONS.find((b) => b.id === id);
export const rarityOf = (id) => BOON_RARITY.find((r) => r.id === id) ?? BOON_RARITY[0];
export { ELEMENTS };
