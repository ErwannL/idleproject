// Menus et onglets (v9.1.0) : source unique des noms et des chemins écrits (« Héros › Équipement »).
// v9.1.0 : 4 menus aux noms honnêtes (onglets en haut du panneau). La fiche du héros (portrait) et les
// Paramètres (engrenage) sont hors menu. Les identifiants des panneaux ne changent pas.
export const MENUS = [
  { id: 'hero', label: 'Héros', tabs: ['inventory', 'upgrades', 'skills', 'tree'] },
  { id: 'adventure', label: 'Aventure', tabs: ['campaign', 'dungeons', 'tower', 'boss'] },
  { id: 'team', label: 'Équipe', tabs: ['companions', 'summon', 'expeditions'] },
  { id: 'goals', label: 'Objectifs', tabs: ['inbox', 'contracts', 'encyclopedia', 'ranking', 'stats'] },
];
export const SUB_LABELS = {
  upgrades: 'Améliorations', skills: 'Compétences', tree: 'Talents', hero: 'Fiche', inventory: 'Équipement',
  companions: 'Composition', expeditions: 'Expéditions', summon: 'Invocation', campaign: 'Carte', dungeons: 'Donjons', tower: 'Tour',
  boss: 'Boss', encyclopedia: 'Collections', contracts: 'Missions', inbox: 'À récupérer', ranking: 'Classement', stats: 'Statistiques', options: 'Paramètres',
};
// Chemin écrit d'un écran (« Héros › Équipement »), construit depuis MENUS : jamais écrit en dur.
// La fiche du héros et les Paramètres sont hors menu : on dit comment les ouvrir (portrait, engrenage).
export function navPath(tab, ...rest) {
  const menu = MENUS.find((m) => m.tabs.includes(tab));
  const head = tab === 'hero' ? ['Portrait du héros'] : tab === 'options' ? ['Paramètres ⚙'] : [menu?.label, SUB_LABELS[tab]];
  return [...head, ...rest].filter(Boolean).join(' › ');
}
