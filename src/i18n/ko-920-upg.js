// v9.2.0 : coréen des six nouvelles améliorations et de l'annonce « Nouvelle amélioration ». Ajouté à ./ko.js.
export const EXACT_920_UPG = {
  'Dégâts critiques': '치명타 피해',
  '+2 % de dégâts des coups critiques par niveau (×2 → ×4 au niveau 100)': '레벨당 치명타 피해 +2% (레벨 100에서 ×2 → ×4)',
  '+0,1 % des dégâts infligés rendus en PV (3 % au plus)': '입힌 피해의 0.1%를 체력으로 회복 (최대 3%)',
  'Lien des compagnons': '동료의 유대',
  '+3 % de puissance des compétences des compagnons (coups, soins, cris) par niveau': '레벨당 동료 스킬 위력 +3% (공격, 치유, 함성)',
  'Esquive': '회피',
  "+0,5 % de chance d'esquiver un coup ennemi (moitié contre les boss, 20 % au plus)": '적의 공격을 회피할 확률 +0.5% (보스에게는 절반, 최대 20%)',
  '+1 % de dégâts du héros contre les boss par niveau (+100 % au niveau 100)': '레벨당 보스에게 주는 영웅 피해 +1% (레벨 100에서 +100%)',
  'Savoir': '지식',
  "+3 % d'expérience gagnée par niveau (+150 % au niveau 50)": '레벨당 획득 경험치 +3% (레벨 50에서 +150%)',
  '+0,2 % des PV max régénérés par seconde, ×1,1 tous les 10 niveaux': '초당 최대 체력의 0.2% 재생, 10레벨마다 ×1.1',
};
export const patterns920Upg = (lookup) => [
  [/^Nouvelle amélioration : (.+)$/, (m) => { const w = lookup(m[1]); return w === null ? null : `새 강화: ${w}`; }],
];
