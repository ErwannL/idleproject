// Codes de triche (saisis dans les Paramètres). Ils ne sont pas affichés dans le jeu.
// v8.1 : effets cumulables (multiplicatifs) : TURBO100 deux fois = ×10 000.
// v8.7 : plus de durée — un effet reste actif jusqu'à ce qu'on le retire. Un code peut être saisi N fois d'un
// coup (champ « × fois », jusqu'à 1 milliard) ; on retire 1, N ou toutes les saisies d'un code, ou tout.
// Les multiplicateurs sont plafonnés (×1e60 par type) pour ne jamais faire « déborder » les nombres du jeu.
import { towerWeek } from './tower.js';
import { BALANCE } from '../data/balance.js';
import { BUILD } from './build-info.js';

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
  TICKETS: { label: (n) => `+${fmt(50 * n)} tickets d'invocation`, give: (s, n) => { s.tickets += 50 * n; } },
  KEYMASTER: { label: (n) => `+${fmt(10 * n)} clés de donjon`, give: (s, n) => { s.keys += 10 * n; } },
  ANCIENT: { label: (n) => `+${fmt(500 * n)} fragments anciens`, give: (s, n) => { s.fragments += 500 * n; } },
  FORGE: { label: (n) => `+${fmt(5000 * n)} éclats et +${fmt(500 * n)} essences`, give: (s, n) => { s.materials.shards += 5000 * n; s.materials.essence += 500 * n; } },
  VITESSE2: { label: () => 'Vitesse ×2 débloquée (bouton ⏩)', give: (s) => unlockSpeed(s, 2) },
  VITESSE5: { label: () => 'Vitesse ×5 débloquée (bouton ⏩)', give: (s) => unlockSpeed(s, 5) },
  VITESSE10: { label: () => 'Vitesse ×10 débloquée (bouton ⏩)', give: (s) => unlockSpeed(s, 10) },
  VITESSE100: { label: () => 'Vitesse ×100 débloquée (bouton ⏩) — effets visuels coupés à cette vitesse', give: (s) => unlockSpeed(s, 100) },
  // v9.0.4 : Étoiles de Transcendance, et étoiles des compagnons / familiers.
  ETOILES: { label: (n) => `+${fmt(10 * n)} Étoiles de Transcendance`, give: (s, n) => { if (s.transcend) s.transcend.stars = Math.min(1e15, s.transcend.stars + 10 * n); } },
  SUPERNOVA: { label: () => `Tous vos compagnons et familiers passent à ${BALANCE.summon.maxStars} étoiles`, give: (s) => { for (const o of Object.values(s.companions.owned)) o.stars = BALANCE.summon.maxStars; } },
  TOWERPASS: { label: (n) => `+${fmt(n)} ascension${n > 1 ? 's' : ''} de la Tour cette semaine`, give: (s, n) => { towerWeek(s).extra = Math.min(1e6, (towerWeek(s).extra ?? 0) + n); } },
};

export const MAX_TIMES = 1e9;
const MULT_CAP = 1e60;
const SPEEDS = [2, 5, 10, 100];
const LUCK_RARITY = ['common', 'rare', 'epic', 'legendary'];

function fmt(n) {
  return n >= 1e6 ? n.toExponential(2).replace('e+', 'e').replace('.', ',') : n.toLocaleString('fr-FR');
}

function unlockSpeed(state, speed) {
  state.cheats.speeds = [...new Set([...(state.cheats.speeds ?? []), speed])].sort((a, b) => a - b);
}

// Nombre de fois saisi (1 à 1 milliard ; tout le reste vaut 1).
export function cheatTimes(value) {
  const n = Math.floor(Number(String(value ?? '1').replace(/[\s_.]/g, '')));
  return Number.isFinite(n) && n >= 1 ? Math.min(MAX_TIMES, n) : 1;
}

// Vitesse réelle de la simulation : « combats passés » = aussi vite que possible (bornée par le temps de calcul).
export const SKIP_SPEED = 100000;
export function simSpeed(state) {
  return state.cheats?.skipBattle ? SKIP_SPEED : state.ui?.speed ?? 1;
}

// Vitesses de combat disponibles : ×1 toujours, les autres débloquées par code (v8.4).
export function unlockedSpeeds(state) {
  return [1, ...(state.cheats?.speeds ?? []).filter((v) => SPEEDS.includes(v))];
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

function formatMult(n) {
  return n >= 1e6 ? n.toExponential(1).replace('e+', 'e') : n.toLocaleString('fr-FR');
}

export function activeCheats(state) {
  return state.cheats?.effects ?? [];
}

// Produit des multiplicateurs actifs d'un type (cumul multiplicatif, plafonné). « godmode » compte pour dégâts et PV.
export function cheatMultiplier(state, kind) {
  let log = 0;
  for (const e of activeCheats(state)) {
    if (e.kind === kind || (e.kind === 'godmode' && (kind === 'damage' || kind === 'hp'))) log += Math.log10(e.mult) * e.count;
  }
  return log >= 60 ? MULT_CAP : 10 ** log;
}

// Chance de butin ajoutée (0..1) et rareté minimale imposée par les codes.
export function cheatLoot(state) {
  const effects = activeCheats(state);
  const drop = effects.some((e) => e.kind === 'loot') ? 1 : 0;
  const luck = Math.max(0, ...effects.filter((e) => e.kind === 'luck').map((e) => e.mult));
  return { drop, minRarity: luck ? LUCK_RARITY[Math.min(3, luck)] : null };
}

export function sanitizeCheats(raw) {
  const out = { effects: [], reveal: false, speeds: [], skipBattle: false };
  // Version publique : tout état de triche venant d'une sauvegarde est ignoré.
  if (!BUILD.cheats || !raw || typeof raw !== 'object') return out;
  if (Array.isArray(raw.speeds)) out.speeds = raw.speeds.filter((v) => SPEEDS.includes(v));
  // ≤ v8.6 : une entrée par saisie (avec une durée) → regroupées par code, sans durée.
  if (Array.isArray(raw.effects)) {
    for (const e of raw.effects) {
      const def = STACKS[String(e?.code ?? '')];
      if (!def) continue;
      const count = Number.isFinite(e.count) && e.count >= 1 ? Math.min(MAX_TIMES * 1000, Math.floor(e.count)) : 1;
      if (!(Number.isFinite(e.count)) && Number.isFinite(e.until) && e.until <= Date.now()) continue; // ancien effet expiré
      const entry = out.effects.find((x) => x.code === e.code);
      if (entry) entry.count = Math.min(MAX_TIMES * 1000, entry.count + count);
      else out.effects.push({ code: e.code, kind: def.kind, mult: def.mult, count });
    }
  }
  // Format ≤ v8.0 : un seul bonus ×N (encore actif) → une saisie de TURBO100.
  if (Number(raw.boostUntil) > Date.now() && Number(raw.boostMultiplier) > 1 && !out.effects.some((e) => e.code === 'TURBO100')) {
    out.effects.push({ code: 'TURBO100', kind: 'boost', mult: 100, count: 1 });
  }
  out.reveal = raw.reveal === true;
  out.skipBattle = raw.skipBattle === true;
  return out;
}
