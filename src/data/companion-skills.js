// Compétences des compagnons (v8.9) : 4 par compagnon. Les 3 premières sont disponibles d'office (sa compétence
// propre + deux compétences de son rôle) ; la 4e (ultime) se débloque avec 3 doublons (4 exemplaires).
// v9.1.3 (doc4 lot 1) : 1 exemplaire = 0★, 5 doublons = 5★ (6 exemplaires). Chaque doublon D renforce hit et burst de
// +5 % (× kh ou kb, calés au chargement pour que 5 exemplaires frappent exactement comme l'ancien maximum), soin et
// rally : min(d × rareté × 4/3 × (1 + 0,05 D), 3). Ultimes offensifs à 30 s (poids 0,35 de l'ancien DPS d'ultime).
// Types : hit (un ennemi, × dégâts du héros), burst (tous les ennemis), heal (% des PV), shield (réduction des
// dégâts pendant `duration` s), rally (+% de dégâts pendant `duration` s), gold (or de `value` ennemis).

// ultimateCopies : exemplaires pour l'ultime (4 = 3 doublons). ultimateWeight : DPS du nouvel ultime / ancien.
// legacyMaxCopies : ancien maximum (5 exemplaires), sur lequel kh et kb sont calés.
export const SKILL_RULES = { ultimateCopies: 4, powerPerDuplicate: 0.05, ultimateWeight: 0.35, ultimateEvery: 30, supportFactor: 4 / 3, supportCap: 3, legacyMaxCopies: 5 };

const TEMPLATES = {
  guardian: [
    { name: 'Coup de bouclier', type: 'hit', every: 6, value: 0.9 },
    { name: 'Provocation', type: 'shield', every: 16, value: 30, duration: 6 },
    { name: 'Rempart absolu', type: 'shield', every: 30, value: 70, duration: 8 },
  ],
  archer: [
    { name: 'Flèche perçante', type: 'hit', every: 5, value: 1 },
    { name: 'Pluie de flèches', type: 'burst', every: 9, value: 0.8 },
    { name: 'Tir du faucon', type: 'hit', every: 30, value: 3 },
  ],
  mage: [
    { name: 'Boule de feu', type: 'hit', every: 6, value: 1.1 },
    { name: 'Nova de givre', type: 'burst', every: 10, value: 0.9 },
    { name: 'Météore', type: 'burst', every: 30, value: 1.8375 },
  ],
  assassin: [
    { name: 'Coup bas', type: 'hit', every: 4, value: 0.8 },
    { name: 'Danse des lames', type: 'burst', every: 9, value: 0.7 },
    { name: 'Exécution', type: 'hit', every: 30, value: 3.5 },
  ],
  healer: [
    { name: 'Prière', type: 'heal', every: 12, value: 10 },
    { name: 'Bénédiction guerrière', type: 'rally', every: 18, value: 30, duration: 8 },
    { name: 'Lumière divine', type: 'heal', every: 25, value: 40 },
  ],
  berserker: [
    { name: 'Hurlement', type: 'rally', every: 16, value: 25, duration: 8 },
    { name: 'Tourbillon sanglant', type: 'burst', every: 8, value: 0.9 },
    { name: 'Carnage', type: 'burst', every: 30, value: 1.575 },
  ],
  pet: [
    { name: 'Morsure', type: 'hit', every: 5, value: 0.7 },
    { name: 'Frénésie sauvage', type: 'rally', every: 18, value: 20, duration: 6 },
    { name: 'Instinct sauvage', type: 'burst', every: 30, value: 35 / 24 }, // 1,4583…
  ],
};

const pct = (v) => Math.round(v * 100);

// v9.1.3 (doc4 lot 1) : kh et kb, un par type de dégâts, calculés depuis les données. Hb/Zb = DPS brut hit/burst des
// 3 premières compétences, Uh/Uz = DPS brut de l'ultime offensif (valeur / 30). Calés sur 4 doublons (ancien maximum) :
// (H + U/0,35) × 1,6 = (H + U) × k × 1,2, donc personne ne recule. 4/3 si le dénominateur vaut 0.
export function skillScales(list, rules = SKILL_RULES) {
  const dps = (type, ult) => list.filter((sk) => sk.type === type && Boolean(sk.ultimate) === ult).reduce((s, sk) => s + sk.value / sk.every, 0);
  const oldMax = 1 + 0.15 * (rules.legacyMaxCopies - 1); // ancien ×1,6 à 5 exemplaires
  const newMax = 1 + rules.powerPerDuplicate * (rules.legacyMaxCopies - 1); // ×1,2 à 4 doublons
  const k = (type) => {
    const base = dps(type, false);
    const ult = dps(type, true);
    const den = (base + ult) * newMax;
    return den > 0 ? ((base + ult / rules.ultimateWeight) * oldMax) / den : 4 / 3;
  };
  return { hit: k('hit'), burst: k('burst') };
}

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

// v9.1.3 (doc4 lot 2) : texte d'une compétence avec sa valeur réelle (× puissance), arrondie à l'entier (les motifs de
// traduction n'acceptent que des entiers). Garde le verbe propre (« Embrase », « Gèle », « Tire »…) : seul le premier
// nombre change. Bouclier et or : sans étoile, texte inchangé.
export function skillTextAt(skill, mult) {
  const text = skill.text ?? skillText(skill);
  let v = null;
  if (skill.type === 'hit' || skill.type === 'burst') v = pct(skill.value * mult);
  else if (skill.type === 'heal' || skill.type === 'rally') v = Math.round(skill.value * mult);
  return v === null ? text : text.replace(/\d+(?:[.,]\d+)?/, String(v));
}

// Les 4 compétences d'un compagnon (rôle = celui des synergies ; familiers = 'pet').
export function companionSkillList(companion, role) {
  const tpl = TEMPLATES[role] ?? TEMPLATES.pet;
  const own = companion.skill ? [{ ...companion.skill, own: true }] : [{ ...tpl[0] }];
  const extra = companion.skill ? [tpl[0], tpl[1]] : [tpl[1]];
  const list = [...own, ...extra.map((s) => ({ ...s, text: skillText(s) })), { ...tpl[2], text: skillText(tpl[2]), ultimate: true }];
  return list.map((s, i) => ({ ...s, index: i, text: s.text ?? skillText(s) }));
}
