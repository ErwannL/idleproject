// v10.3.1 (fin de la partie 6 du plan 10.2) : anglais des textes ajoutés à l'Arène jouée sur la carte (mécaniques des
// boss, fin de combat en deux lignes, ultime, Boss commun). Branché à la fin de ./en.js.
let LK = () => null;
const tr = (s) => LK(s) ?? s;
export const EXACT_1031 = {
  'Carapace brisée': 'Shell broken',
  'Désespoir !': 'Despair!',
};
export const patterns1031 = (lookup = () => null) => { LK = lookup; return [
  // Bulle de la Fournaise : « Fournaise ×1,2 ».
  [/^(Fournaise) ×(\d+(?:,\d+)?)$/, (m) => `${tr(m[1])} ×${m[2].replace(',', '.')}`],
]; };
