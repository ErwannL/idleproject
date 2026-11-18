// v9.10 (1) : quand lancer la Veillée automatique. Jamais la première heure de jeu ; « Téléphone seulement » (défaut)
// = sur téléphone, ou sur PC en plein écran ; « Toujours » / « Jamais ».
export const VIGIL_MODES = ['never', 'phone', 'always'];
export function vigilAllowed(state, { phone = false, fullscreen = false } = {}) {
  const mode = VIGIL_MODES.includes(state?.ui?.vigil) ? state.ui.vigil : 'phone';
  if (mode === 'never' || (state?.playSeconds ?? 0) < 3600) return false;
  if (mode === 'always') return true;
  return phone || fullscreen;
}
