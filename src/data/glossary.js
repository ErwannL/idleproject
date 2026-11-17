// v9.7.1 (lot 5) : lexique d'un appui — toucher un terme affiche une phrase d'explication (tutoiement).
// « Contre » et « Parade » sont fusionnés : un seul mot, Parade.
export const GLOSSARY = {
  Rage: 'Un boss qui dure trop longtemps frappe de plus en plus fort. À partir du monde 3.',
  Parade: 'Ce qui annule ou réduit une capacité ennemie : un compagnon du bon rôle, ou ton geste « Parer » au bon moment.',
  'Résonance': 'Plusieurs compagnons du même élément dans l\'équipe : bonus de dégâts.',
  Palier: 'Un seuil à atteindre (vie du boss, score, étage) qui donne une récompense.',
  Combo: 'Chaque action de ta part (compétence, parade, point faible) monte l\'enchaînement : plus d\'or et d\'expérience, qui retombe doucement.',
  'Point faible': 'Une cible lumineuse sur un boss : touche-la pour un coup critique garanti.',
  Renaissance: 'Recommencer la campagne plus fort : tu gardes tes compagnons, tes talents et tes ensembles.',
  Ultime: 'La plus grande compétence d\'un compagnon. Quand sa jauge est pleine, déclenche-la quand tu veux.',
  Affaibli: 'Après une parade réussie, le boss reçoit 50 % de dégâts en plus pendant 4 s.',
  Sceau: 'Certains boss de fin de monde demandent un sceau : gagne-le en donjon, à la Tour ou au Défi.',
  'Éveil': 'Le grand boss se relève avec une nouvelle barre de vie : chaque Éveil rapporte davantage.',
};
export const GLOSSARY_TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
