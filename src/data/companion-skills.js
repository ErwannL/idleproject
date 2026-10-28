// Compétences des compagnons (v8.9) : 4 par compagnon. Les 3 premières sont disponibles d'office (sa compétence
// propre + deux compétences de son rôle) ; la 4e (ultime) se débloque avec 3 doublons (4 étoiles).
// Chaque doublon (étoile) renforce aussi toutes ses compétences de +15 %.
// Types : hit (un ennemi, × dégâts du héros), burst (tous les ennemis), heal (% des PV), shield (réduction des
// dégâts pendant `duration` s), rally (+% de dégâts pendant `duration` s), gold (or de `value` ennemis).

export const SKILL_RULES = { ultimateStars: 4, powerPerStar: 0.15 };

const TEMPLATES = {
  guardian: [
    { name: 'Coup de bouclier', type: 'hit', every: 6, value: 0.9 },
    { name: 'Provocation', type: 'shield', every: 16, value: 30, duration: 6 },
    { name: 'Rempart absolu', type: 'shield', every: 30, value: 70, duration: 8 },
  ],
  archer: [
    { name: 'Flèche perçante', type: 'hit', every: 5, value: 1 },
    { name: 'Pluie de flèches', type: 'burst', every: 9, value: 0.8 },
    { name: 'Tir du faucon', type: 'hit', every: 14, value: 4 },
  ],
  mage: [
    { name: 'Boule de feu', type: 'hit', every: 6, value: 1.1 },
    { name: 'Nova de givre', type: 'burst', every: 10, value: 0.9 },
    { name: 'Météore', type: 'burst', every: 20, value: 3.5 },
  ],
  assassin: [
    { name: 'Coup bas', type: 'hit', every: 4, value: 0.8 },
    { name: 'Danse des lames', type: 'burst', every: 9, value: 0.7 },
    { name: 'Exécution', type: 'hit', every: 15, value: 5 },
  ],
  healer: [
    { name: 'Prière', type: 'heal', every: 12, value: 10 },
    { name: 'Bénédiction guerrière', type: 'rally', every: 18, value: 30, duration: 8 },
    { name: 'Lumière divine', type: 'heal', every: 25, value: 40 },
  ],
  berserker: [
    { name: 'Hurlement', type: 'rally', every: 16, value: 25, duration: 8 },
    { name: 'Tourbillon sanglant', type: 'burst', every: 8, value: 0.9 },
    { name: 'Carnage', type: 'burst', every: 20, value: 3 },
  ],
  pet: [
    { name: 'Morsure', type: 'hit', every: 5, value: 0.7 },
    { name: 'Frénésie sauvage', type: 'rally', every: 18, value: 20, duration: 6 },
    { name: 'Instinct sauvage', type: 'burst', every: 18, value: 2.5 },
  ],
};

const pct = (v) => Math.round(v * 100);

// Texte d'une compétence (mêmes tournures que les compétences d'origine, déjà traduites).
export function skillText(skill) {
  switch (skill.type) {
    case 'hit': return `Frappe à ${pct(skill.value)} % des dégâts du héros`;
    case 'burst': return `Frappe tous les ennemis (${pct(skill.value)} % des dégâts)`;
    case 'heal': return `Soigne ${skill.value} % des PV`;
    case 'shield': return `Réduit les dégâts de ${skill.value} % pendant ${skill.duration} s`;
    case 'rally': return `+${skill.value} % dégâts pendant ${skill.duration} s`;
    case 'gold': return `Fait tomber l'or de ${skill.value} ennemis`;
    default: return '';
  }
}

export const SKILL_TEMPLATES = TEMPLATES;

// Les 4 compétences d'un compagnon (rôle = celui des synergies ; familiers = 'pet').
export function companionSkillList(companion, role) {
  const tpl = TEMPLATES[role] ?? TEMPLATES.pet;
  const own = companion.skill ? [{ ...companion.skill, own: true }] : [{ ...tpl[0] }];
  const extra = companion.skill ? [tpl[0], tpl[1]] : [tpl[1]];
  const list = [...own, ...extra.map((s) => ({ ...s, text: skillText(s) })), { ...tpl[2], text: skillText(tpl[2]), ultimate: true }];
  return list.map((s, i) => ({ ...s, index: i, text: s.text ?? skillText(s) }));
}
