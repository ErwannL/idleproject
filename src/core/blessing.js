// v9.7.1 (prologue, scène 5) : bénédiction de départ choisie à la réincarnation — plus de dégâts, plus de vie ou plus
// d'or pendant la première heure de jeu (temps de jeu, state.playSeconds). Rien d'autre : choix sans conséquence lourde.
export const BLESSINGS = {
  damage: { label: 'Force', text: '+25 % de dégâts pendant ta première heure', mult: 1.25 },
  hp: { label: 'Vigueur', text: '+40 % de vie pendant ta première heure', mult: 1.4 },
  gold: { label: 'Fortune', text: '+50 % d\'or pendant ta première heure', mult: 1.5 },
};
export const BLESSING_SECONDS = 3600;

export function blessingActive(state, id) {
  const b = state?.blessing;
  return Boolean(b && b.id === id && (state.playSeconds ?? 0) < (b.until ?? BLESSING_SECONDS));
}
export const blessingMult = (state, id) => (blessingActive(state, id) ? BLESSINGS[id].mult : 1);

export function grantBlessing(state, id) {
  if (!BLESSINGS[id]) return false;
  state.blessing = { id, until: (state.playSeconds ?? 0) + BLESSING_SECONDS };
  return true;
}
