// État de triche (version dev) : effets actifs, vitesses débloquées. v9.1.0 : les codes eux-mêmes sont dans
// cheat-codes.js, chargé à la demande dans la version dev et absent de la version publique (ni exe ni web).
// v8.1 : effets cumulables (multiplicatifs) : un même code saisi deux fois multiplie deux fois.
// v8.7 : plus de durée — un effet reste actif jusqu'à ce qu'on le retire. Un code peut être saisi N fois d'un
// coup (champ « × fois », jusqu'à 1 milliard) ; on retire 1, N ou toutes les saisies d'un code, ou tout.
// Les multiplicateurs sont plafonnés (×1e60 par type) pour ne jamais faire « déborder » les nombres du jeu.
import { BALANCE } from '../data/balance.js';
import { BUILD } from './build-info.js';

export const MAX_TIMES = 1e9;
export const MULT_CAP = 1e60;
export const SPEEDS = [2, 5, 10, 100];
const KINDS = ['boost', 'damage', 'hp', 'godmode', 'loot', 'luck'];
const LUCK_RARITY = ['common', 'rare', 'epic', 'legendary'];

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
      const def = e && KINDS.includes(e.kind) && Number.isFinite(e.mult) && e.mult >= 1 && typeof e.code === 'string' ? e : null;
      if (!def) continue;
      const count = Number.isFinite(e.count) && e.count >= 1 ? Math.min(MAX_TIMES * 1000, Math.floor(e.count)) : 1;
      if (!(Number.isFinite(e.count)) && Number.isFinite(e.until) && e.until <= Date.now()) continue; // ancien effet expiré
      const entry = out.effects.find((x) => x.code === e.code);
      if (entry) entry.count = Math.min(MAX_TIMES * 1000, entry.count + count);
      else out.effects.push({ code: e.code.slice(0, 24), kind: def.kind, mult: Math.min(def.mult, 1000), count });
    }
  }
  // Format ≤ v8.0 : un seul bonus ×N (encore actif) → un bonus ×100.
  if (Number(raw.boostUntil) > Date.now() && Number(raw.boostMultiplier) > 1 && !out.effects.some((e) => e.code === 'BONUS')) {
    out.effects.push({ code: 'BONUS', kind: 'boost', mult: 100, count: 1 });
  }
  out.reveal = raw.reveal === true;
  out.skipBattle = raw.skipBattle === true;
  return out;
}
