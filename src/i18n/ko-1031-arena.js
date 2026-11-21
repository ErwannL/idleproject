// v10.3.1 (fin de la partie 6 du plan 10.2) : coréen des textes ajoutés à l'Arène jouée sur la carte (mécaniques des
// boss, fin de combat en deux lignes, ultime, Boss commun). Branché à la fin de ./ko.js.
let LK = () => null;
const tr = (s) => LK(s) ?? s;
export const EXACT_1031 = {
  'Carapace brisée': '갑각 파괴',
  'Serveur injoignable : ta tentative compte pour ton record, la barre commune sera à jour au retour du réseau.': '서버에 연결할 수 없어요: 이번 도전은 기록에 반영되고, 공동 체력 바는 네트워크가 돌아오면 갱신돼요.',
  'Désespoir !': '절망!',
};
export const patterns1031 = (lookup = () => null) => { LK = lookup; return [
  // Barre du Boss commun : « 1/3 · Éveil ×2 ».
  [/^(\d+\/\d+) · Éveil ×(\d+)$/, (m) => `${m[1]} · 각성 ×${m[2]}`],
  // Bulle de la Fournaise : « Fournaise ×1,2 ».
  [/^(Fournaise) ×(\d+(?:,\d+)?)$/, (m) => `${tr(m[1])} ×${m[2].replace(',', '.')}`],
]; };
