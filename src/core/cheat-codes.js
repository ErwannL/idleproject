// Codes de triche (version dev uniquement). v9.1.0 : fichier séparé, chargé par import dynamique quand
// BUILD.cheats est vrai ; il n'est pas copié dans la version publique (tools/build-web.mjs, package.json « files »).
import { towerWeek } from './tower.js';
import { BALANCE } from '../data/balance.js';
import { BUILD } from './build-info.js';
import { MAX_TIMES, MULT_CAP, cheatMultiplier, cheatTimes } from './cheats.js';

// kind : boost (or, XP, événements) · damage · hp · godmode (dégâts et PV) · loot (chaque ennemi lâche un
// objet) · luck (rareté minimale du butin).
const STACKS = {
  TURBO10: { kind: 'boost', mult: 10, label: 'Bonus ×10 (or, XP, événements)' },
  TURBO100: { kind: 'boost', mult: 100, label: 'Bonus ×100 (or, XP, événements)' },
  TURBO1000: { kind: 'boost', mult: 1000, label: 'Bonus ×1000 (or, XP, événements)' },
  BERSERK: { kind: 'damage', mult: 10, label: 'Dégâts ×10' },
  TITAN: { kind: 'hp', mult: 10, label: 'PV ×10' },
  GODMODE: { kind: 'godmode', mult: 100, label: 'Mode dieu : dégâts et PV ×100' },
  LOOTSTORM: { kind: 'loot', mult: 1, label: 'Chaque ennemi laisse un objet' },
  LUCKY: { kind: 'luck', mult: 2, label: 'Butin Épique ou mieux' },
  JACKPOT: { kind: 'luck', mult: 3, label: 'Butin Légendaire uniquement' },
};

// Dons immédiats : `give(state, n)` donne n fois le cadeau (calcul direct, même pour 1 milliard de fois).
const GIFTS = {
  GEMRAIN: { label: (n) => `+${fmt(1000 * n)} gemmes`, give: (s, n) => { s.gems += 1000 * n; } },
  DIAMONDS: { label: (n) => `+${fmt(10000 * n)} gemmes`, give: (s, n) => { s.gems += 10000 * n; } },
  TICKETS: { label: (n) => `+${fmt(5000 * n)} gemmes`, give: (s, n) => { s.gems += 5000 * n; } }, // v9.1.3 : tickets fondus
  KEYMASTER: { label: (n) => `+${fmt(10 * n)} clés de donjon`, give: (s, n) => { s.keys += 10 * n; } },
  ANCIENT: { label: (n) => `+${fmt(500 * n)} fragments anciens`, give: (s, n) => { s.fragments += 500 * n; } },
  FORGE: { label: (n) => `+${fmt(10000 * n)} éclats`, give: (s, n) => { s.materials.shards += 10000 * n; } }, // v9.1.3 : essences fondues
  VITESSE2: { label: () => 'Vitesse ×2 débloquée (bouton ⏩)', give: (s) => unlockSpeed(s, 2) },
  VITESSE5: { label: () => 'Vitesse ×5 débloquée (bouton ⏩)', give: (s) => unlockSpeed(s, 5) },
  VITESSE10: { label: () => 'Vitesse ×10 débloquée (bouton ⏩)', give: (s) => unlockSpeed(s, 10) },
  VITESSE100: { label: () => 'Vitesse ×100 débloquée (bouton ⏩) — effets visuels coupés à cette vitesse', give: (s) => unlockSpeed(s, 100) },
  // v9.0.4 : Étoiles de Transcendance, et étoiles des compagnons / familiers.
  ETOILES: { label: (n) => `+${fmt(10 * n)} Étoiles de Transcendance`, give: (s, n) => { if (s.transcend) s.transcend.stars = Math.min(1e15, s.transcend.stars + 10 * n); } },
  SUPERNOVA: { label: () => `Tous vos compagnons et familiers passent à ${BALANCE.summon.maxStars} étoiles`, give: (s) => { for (const o of Object.values(s.companions.owned)) o.stars = BALANCE.summon.maxStars; } },
  TOWERPASS: { label: (n) => `+${fmt(n)} ascension${n > 1 ? 's' : ''} de la Tour cette semaine`, give: (s, n) => { towerWeek(s).extra = Math.min(1e6, (towerWeek(s).extra ?? 0) + n); } },
};

function fmt(n) {
  return n >= 1e6 ? n.toExponential(2).replace('e+', 'e').replace('.', ',') : n.toLocaleString('fr-FR');
}

function unlockSpeed(state, speed) {
  state.cheats.speeds = [...new Set([...(state.cheats.speeds ?? []), speed])].sort((a, b) => a - b);
}

function formatMult(n) {
  return n >= 1e6 ? n.toExponential(1).replace('e+', 'e') : n.toLocaleString('fr-FR');
}

// Applique un code `times` fois ; renvoie le message de succès, ou null si le code est inconnu.
export function applyCheat(state, code, times = 1) {
  if (!BUILD.cheats) return null; // version publique : aucun code n'est accepté
  const key = String(code ?? '').trim().toUpperCase();
  const n = cheatTimes(times);
  if (key === 'ORACLE') {
    state.cheats.reveal = true;
    return 'Les compagnons adaptés aux donjons sont révélés.';
  }
  // v8.6 : les combats sont simulés aussi vite que le PC le permet (sans animations) : on voit tout de
  // suite si une étape ou un boss passe. Le même code le désactive.
  if (key === 'SKIPBATTLE' || key === 'PASSECOMBAT') {
    state.cheats.skipBattle = !state.cheats.skipBattle;
    return state.cheats.skipBattle
      ? 'Combats passés : chaque combat est simulé instantanément (code à nouveau ou bouton ⏭ pour arrêter).'
      : 'Combats passés désactivés.';
  }
  if (key === 'RESETCODES') {
    state.cheats.effects = [];
    return 'Tous les codes actifs sont annulés.';
  }
  if (GIFTS[key]) {
    GIFTS[key].give(state, n);
    return `${GIFTS[key].label(n)} !`;
  }
  const def = STACKS[key];
  if (!def) return null;
  const entry = state.cheats.effects.find((e) => e.code === key);
  if (entry) entry.count = Math.min(MAX_TIMES * 1000, entry.count + n);
  else state.cheats.effects.push({ code: key, kind: def.kind, mult: def.mult, count: n });
  const total = cheatMultiplier(state, def.kind === 'godmode' ? 'damage' : def.kind);
  return def.kind === 'boost' || def.kind === 'damage' || def.kind === 'hp' || def.kind === 'godmode'
    ? `${def.label}${n > 1 ? ` ×${fmt(n)} fois` : ''} ! (cumulé : ×${formatMult(total)}${total >= MULT_CAP ? ', maximum' : ''})`
    : `${def.label} !`;
}

// Retire `times` saisies d'un code (Infinity = toutes).
export function removeCheat(state, code, times = Infinity) {
  const entry = state.cheats.effects.find((e) => e.code === code);
  if (!entry) return false;
  entry.count -= Math.min(entry.count, times);
  if (entry.count <= 0) state.cheats.effects = state.cheats.effects.filter((e) => e !== entry);
  return true;
}

export function cheatLabel(code) {
  return STACKS[code]?.label ?? code;
}
