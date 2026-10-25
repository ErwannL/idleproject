// Codes de triche (saisis dans les Paramètres). Ils ne sont pas affichés dans le jeu.
// - TURBO100 : bonus ×100 (or, XP, événements) pendant 1 h, cumulable avec les autres bonus ;
// - ORACLE   : révèle quel compagnon SSR est adapté à chaque donjon.
const CODES = {
  TURBO100: (state, now) => {
    state.cheats.boostUntil = now + 3600 * 1000;
    state.cheats.boostMultiplier = 100;
    return 'Bonus ×100 activé pendant 1 h !';
  },
  ORACLE: (state) => {
    state.cheats.reveal = true;
    return 'Les compagnons adaptés aux donjons sont révélés.';
  },
};

// Applique un code ; renvoie le message de succès, ou null si le code est inconnu.
export function applyCheat(state, code, now = Date.now()) {
  const fn = CODES[String(code ?? '').trim().toUpperCase()];
  return fn ? fn(state, now) : null;
}

export function sanitizeCheats(raw) {
  const out = { boostUntil: 0, boostMultiplier: 1, reveal: false };
  if (!raw || typeof raw !== 'object') return out;
  const until = Number(raw.boostUntil);
  if (Number.isFinite(until) && until > 0) out.boostUntil = until;
  const m = Number(raw.boostMultiplier);
  if (Number.isFinite(m) && m >= 1 && m <= 100) out.boostMultiplier = m;
  out.reveal = raw.reveal === true;
  return out;
}
