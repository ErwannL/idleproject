// v10.19 (partie 1) : coréen des ouvriers du Bastion — niveaux, bonus en clair, départ signalé, remplacement
// automatique. Branché à la fin de ./ko.js, sans écraser l'existant.
export const EXACT_1019_BASTION = {
  'Remplacer automatiquement si un ouvrier part': '일꾼이 떠나면 자동으로 교체',
  'Remplacement automatique activé': '자동 교체 켜짐',
  'Remplacement automatique désactivé': '자동 교체 꺼짐',
  'Expérience d\'ouvrier': '일꾼 경험치',
  'en équipe': '팀에 있음',
  'en expédition': '원정 중',
  'Aucun compagnon libre.': '쉬고 있는 동료가 없습니다.',
  'commandes et chantiers plus rapides': '주문과 공사가 더 빨라짐',
  'recherches et chantiers plus rapides': '연구와 공사가 더 빨라짐',
  'plus d\'éclats, chantiers plus rapides': '파편 증가, 공사가 더 빨라짐',
  'plus de grimoires, chantiers plus rapides': '마법서 증가, 공사가 더 빨라짐',
  'plus d\'essences, chantiers plus rapides': '정수 증가, 공사가 더 빨라짐',
  'chantiers plus rapides': '공사가 더 빨라짐',
};

const PART = { 'Métier': '직업', 'Rareté': '희귀도', 'Recherche': '연구' };
const WHY = { 'part en expédition': '원정을 떠나', 'rejoint l\'équipe': '팀에 합류해', 'n\'est plus disponible': '더 이상 일할 수 없어' };
const GONE = { 'est parti dans ton équipe': '팀에 합류했습니다', 'est parti en expédition': '원정을 떠났습니다', 'n\'est plus disponible': '더 이상 일할 수 없습니다' };

export const patterns1019Bastion = (lookup) => {
  const L = (t) => lookup(t) ?? t;
  return [
    [/^\+(\d+) % vitesse de (.+)$/, (m) => `${L(m[2])} 속도 +${m[1]}%`],
    [/^\((commandes et chantiers plus rapides|recherches et chantiers plus rapides|plus d'éclats, chantiers plus rapides|plus de grimoires, chantiers plus rapides|plus d'essences, chantiers plus rapides|chantiers plus rapides)\)$/,
      (m) => `(${EXACT_1019_BASTION[m[1]]})`],
    [/^(Métier|Rareté|Recherche) \+(\d+) %$/, (m) => `${PART[m[1]]} +${m[2]}%`],
    [/^Niveau (\d+) \+(\d+) %$/, (m) => `레벨 ${m[1]} +${m[2]}%`],
    [/^(\d+) XP · niveau maximal$/, (m) => `${m[1]} XP · 최대 레벨`],
    [/^(.+) · Niv\. (\d+)$/, (m) => (lookup(m[1]) ? `${lookup(m[1])} · Lv. ${m[2]}` : null)],
    [/^Remplacer \((.+)\)$/, (m) => `교체 (${L(m[1])})`],
    [/^(.+) (est parti dans ton équipe|est parti en expédition|n'est plus disponible)\.$/, (m) => `${m[1] === 'Ton ouvrier' ? '일꾼' : L(m[1])}: ${GONE[m[2]]}.`],
    [/^(.+) (part en expédition|rejoint l'équipe|n'est plus disponible) et quitte (.+) : (.+) le remplace$/,
      (m) => `${m[1] === 'Ton ouvrier' ? '일꾼' : L(m[1])}이(가) ${WHY[m[2]]} ${L(m[3])}을(를) 떠났습니다: ${m[4] === 'un autre ouvrier' ? '다른 일꾼' : L(m[4])}이(가) 대신합니다`],
    [/^(.+) · (.+) · Niv\. (\d+) · \+(\d+) % de vitesse(?: \((.+)\))?(?: · (en équipe|en expédition))?$/,
      (m) => `${L(m[1])} · ${L(m[2])} · Lv. ${m[3]} · 속도 +${m[4]}%${m[5] ? ` (${L(m[5])})` : ''}${m[6] ? ` · ${EXACT_1019_BASTION[m[6]]}` : ''}`],
  ];
};
