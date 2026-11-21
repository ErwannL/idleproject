// v10.3.1 (fin de la partie 6 du plan 10.2) : anglais des textes ajoutés à l'Arène jouée sur la carte (mécaniques des
// boss, fin de combat en deux lignes, ultime, Boss commun). Branché à la fin de ./en.js.
let LK = () => null;
const tr = (s) => LK(s) ?? s;
export const EXACT_1031 = {
  'Carapace brisée': 'Shell broken',
  'Serveur injoignable : ta tentative compte pour ton record, la barre commune sera à jour au retour du réseau.': 'Server unreachable: your attempt counts for your record, the shared bar will update when the network is back.',
  'Désespoir !': 'Despair!',
};
export const patterns1031 = (lookup = () => null) => { LK = lookup; return [
  // Barre du Boss commun : « 1/3 · Éveil ×2 ».
  [/^(\d+\/\d+) · Éveil ×(\d+)$/, (m) => `${m[1]} · Awakening ×${m[2]}`],
  // Bulle de la Fournaise : « Fournaise ×1,2 ».
  [/^(Fournaise) ×(\d+(?:,\d+)?)$/, (m) => `${tr(m[1])} ×${m[2].replace(',', '.')}`],
]; };
