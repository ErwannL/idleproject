// Codes de triche (saisis dans les Paramètres). Ils ne sont pas affichés dans le jeu.
// v8.1 : effets à durée limitée CUMULABLES (multiplicatifs) : TURBO100 deux fois = ×10 000.
// Chaque saisie ajoute un effet avec sa propre minuterie ; les dons immédiats s'ajoutent simplement.
import { towerWeek } from './tower.js';

const MIN = 60 * 1000;
const H = 60 * MIN;

// kind : boost (or, XP, événements) · damage · hp · loot (chance de butin +x) · luck (rareté minimale)
const TIMED = {
  TURBO10: { kind: 'boost', mult: 10, ms: H, label: 'Bonus ×10 (or, XP, événements) pendant 1 h' },
  TURBO100: { kind: 'boost', mult: 100, ms: H, label: 'Bonus ×100 (or, XP, événements) pendant 1 h' },
  TURBO1000: { kind: 'boost', mult: 1000, ms: 10 * MIN, label: 'Bonus ×1000 pendant 10 min' },
  BERSERK: { kind: 'damage', mult: 10, ms: 30 * MIN, label: 'Dégâts ×10 pendant 30 min' },
  TITAN: { kind: 'hp', mult: 10, ms: 30 * MIN, label: 'PV ×10 pendant 30 min' },
  GODMODE: { kind: 'godmode', mult: 100, ms: 15 * MIN, label: 'Mode dieu : dégâts et PV ×100 pendant 15 min' },
  LOOTSTORM: { kind: 'loot', mult: 1, ms: 30 * MIN, label: 'Chaque ennemi laisse un objet pendant 30 min' },
  LUCKY: { kind: 'luck', mult: 2, ms: 30 * MIN, label: 'Butin Épique ou mieux pendant 30 min' },
  JACKPOT: { kind: 'luck', mult: 3, ms: 10 * MIN, label: 'Butin Légendaire uniquement pendant 10 min' },
};

const GIFTS = {
  GEMRAIN: { label: '+1 000 gemmes', give: (s) => { s.gems += 1000; } },
  DIAMONDS: { label: '+10 000 gemmes', give: (s) => { s.gems += 10000; } },
  TICKETS: { label: '+50 tickets d\'invocation', give: (s) => { s.tickets += 50; } },
  KEYMASTER: { label: '+10 clés de donjon', give: (s) => { s.keys += 10; } },
  ANCIENT: { label: '+500 fragments anciens', give: (s) => { s.fragments += 500; } },
  FORGE: { label: '+5 000 éclats et +500 essences', give: (s) => { s.materials.shards += 5000; s.materials.essence += 500; } },
  VITESSE2: { label: 'Vitesse ×2 débloquée (bouton ⏩)', give: (s) => unlockSpeed(s, 2) },
  VITESSE5: { label: 'Vitesse ×5 débloquée (bouton ⏩)', give: (s) => unlockSpeed(s, 5) },
  VITESSE10: { label: 'Vitesse ×10 débloquée (bouton ⏩)', give: (s) => unlockSpeed(s, 10) },
  VITESSE100: { label: 'Vitesse ×100 débloquée (bouton ⏩) — effets visuels coupés à cette vitesse', give: (s) => unlockSpeed(s, 100) },
  TOWERPASS: { label: '+1 ascension de la Tour cette semaine', give: (s) => { towerWeek(s).extra = (towerWeek(s).extra ?? 0) + 1; } },
};

const MAX_EFFECTS = 30;
const SPEEDS = [2, 5, 10, 100];

function unlockSpeed(state, speed) {
  state.cheats.speeds = [...new Set([...(state.cheats.speeds ?? []), speed])].sort((a, b) => a - b);
}

// Vitesses de combat disponibles : ×1 toujours, les autres débloquées par code (v8.4).
export function unlockedSpeeds(state) {
  return [1, ...(state.cheats?.speeds ?? []).filter((v) => SPEEDS.includes(v))];
}
const LUCK_RARITY = ['common', 'rare', 'epic', 'legendary'];

// Applique un code ; renvoie le message de succès, ou null si le code est inconnu.
export function applyCheat(state, code, now = Date.now()) {
  const key = String(code ?? '').trim().toUpperCase();
  if (key === 'ORACLE') {
    state.cheats.reveal = true;
    return 'Les compagnons adaptés aux donjons sont révélés.';
  }
  if (key === 'RESETCODES') {
    state.cheats.effects = [];
    return 'Tous les codes actifs sont annulés.';
  }
  if (GIFTS[key]) {
    GIFTS[key].give(state);
    return `${GIFTS[key].label} !`;
  }
  const def = TIMED[key];
  if (!def) return null;
  state.cheats.effects = activeCheats(state, now).slice(-(MAX_EFFECTS - 1));
  state.cheats.effects.push({ code: key, kind: def.kind, mult: def.mult, until: now + def.ms });
  const total = cheatMultiplier(state, def.kind, now);
  return def.kind === 'boost' || def.kind === 'damage' || def.kind === 'hp' || def.kind === 'godmode'
    ? `${def.label} ! (cumulé : ×${formatMult(total)})` : `${def.label} !`;
}

function formatMult(n) {
  return n >= 1e6 ? n.toExponential(1).replace('e+', 'e') : n.toLocaleString('fr-FR');
}

export function activeCheats(state, now = Date.now()) {
  return (state.cheats?.effects ?? []).filter((e) => e.until > now);
}

// Produit des multiplicateurs actifs d'un type (cumul multiplicatif). « godmode » compte pour dégâts et PV.
export function cheatMultiplier(state, kind, now = Date.now()) {
  let m = 1;
  for (const e of activeCheats(state, now)) {
    if (e.kind === kind || (e.kind === 'godmode' && (kind === 'damage' || kind === 'hp'))) m *= e.mult;
  }
  return m;
}

export function cheatSecondsLeft(state, kind, now = Date.now()) {
  const list = activeCheats(state, now).filter((e) => e.kind === kind);
  return list.length ? Math.max(...list.map((e) => e.until - now)) / 1000 : 0;
}

// Chance de butin ajoutée (0..1) et rareté minimale imposée par les codes.
export function cheatLoot(state, now = Date.now()) {
  const effects = activeCheats(state, now);
  const drop = effects.some((e) => e.kind === 'loot') ? 1 : 0;
  const luck = Math.max(0, ...effects.filter((e) => e.kind === 'luck').map((e) => e.mult));
  return { drop, minRarity: luck ? LUCK_RARITY[Math.min(3, luck)] : null };
}

export function sanitizeCheats(raw) {
  const out = { effects: [], reveal: false, speeds: [] };
  if (!raw || typeof raw !== 'object') return out;
  if (Array.isArray(raw.speeds)) out.speeds = raw.speeds.filter((v) => SPEEDS.includes(v));
  const kinds = new Set(Object.values(TIMED).map((d) => d.kind));
  if (Array.isArray(raw.effects)) {
    for (const e of raw.effects.slice(-MAX_EFFECTS)) {
      const until = Number(e?.until);
      const mult = Number(e?.mult);
      if (kinds.has(e?.kind) && Number.isFinite(until) && until > 0 && Number.isFinite(mult) && mult >= 1 && mult <= 1000) {
        out.effects.push({ code: String(e.code ?? '').slice(0, 16), kind: e.kind, mult, until });
      }
    }
  }
  // Ancien format (≤ v8.0) : un seul bonus ×N.
  const until = Number(raw.boostUntil);
  const m = Number(raw.boostMultiplier);
  if (Number.isFinite(until) && until > 0 && Number.isFinite(m) && m > 1 && m <= 100) {
    out.effects.push({ code: 'TURBO100', kind: 'boost', mult: m, until });
  }
  out.reveal = raw.reveal === true;
  return out;
}
