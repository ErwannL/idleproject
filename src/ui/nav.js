// Menus et onglets (v9.1.0) : source unique des noms et des chemins écrits (« Héros › Équipement »).
// v9.1.0 : 4 menus aux noms honnêtes (onglets en haut du panneau). La fiche du héros (portrait) et les
// Paramètres (engrenage) sont hors menu. Les identifiants des panneaux ne changent pas.
export const MENUS = [
  { id: 'hero', label: 'Héros', tabs: ['inventory', 'forge', 'looks', 'upgrades', 'skills', 'tree'] }, // v9.2.2 : Apparences visibles
  { id: 'adventure', label: 'Aventure', tabs: ['campaign', 'event', 'dungeons', 'tower', 'arena', 'boss'] }, // v9.2.8 : Événement
  { id: 'team', label: 'Équipe', tabs: ['companions', 'summon', 'shop', 'expeditions'] }, // v9.2.8 : Boutique
  { id: 'goals', label: 'Objectifs', tabs: ['contracts', 'encyclopedia', 'ranking', 'guild', 'stats'] }, // v9.1.3 : À récupérer en fenêtre (touche N)
];
export const SUB_LABELS = {
  upgrades: 'Améliorations', skills: 'Compétences', tree: 'Talents', hero: 'Fiche', inventory: 'Équipement', forge: 'Forge', looks: 'Apparences',
  companions: 'Composition', expeditions: 'Expéditions', summon: 'Invocation', shop: 'Boutique', event: 'Événement', campaign: 'Carte', dungeons: 'Donjons', tower: 'Défis', arena: 'Arène',
  boss: 'Boss', world: 'Monde', encyclopedia: 'Collections', contracts: 'Missions', inbox: 'À récupérer', ranking: 'Classement', guild: 'Guilde', stats: 'Statistiques', options: 'Paramètres',
};
// Chemin écrit d'un écran (« Héros › Équipement »), construit depuis MENUS : jamais écrit en dur.
// La fiche du héros et les Paramètres sont hors menu : on dit comment les ouvrir (portrait, engrenage).
export function navPath(tab, ...rest) {
  const menu = MENUS.find((m) => m.tabs.includes(tab));
  const head = tab === 'hero' ? ['Portrait du héros'] : tab === 'options' ? ['Paramètres ⚙'] : [menu?.label, SUB_LABELS[tab]];
  return [...head, ...rest].filter(Boolean).join(' › ');
}
