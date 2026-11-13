// v9.6.1 (2.4) : grands effets d'objets — portés par des Épiques et des Légendaires, ils changent le combat de façon
// visible (pas seulement un pourcentage). Un seul grand effet est actif à la fois (celui de l'arme d'abord, puis
// dans l'ordre des places) : deux objets à grand effet obligent à choisir.
export const MAJOR_EFFECTS = {
  critSplash: { name: 'Éclats critiques', text: 'Les critiques éclaboussent les ennemis voisins (40 % des dégâts).', color: '#ffd23f' },
  killHeal: { name: 'Festin', text: 'Chaque ennemi vaincu soigne le héros de 3 % de ses PV max.', color: '#7dff9a' },
  teamHaste: { name: 'Cadence d\'équipe', text: 'Les compétences des compagnons se rechargent 20 % plus vite.', color: '#7fd4ff' },
  elemEdge: { name: 'Lame élémentaire', text: '+40 % de dégâts aux ennemis que l\'élément du héros bat.', color: '#ff7a3a' },
};
export const MAJOR_CHANCE = { epic: 0.25, legendary: 0.6 };
