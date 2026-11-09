// Menus et onglets (v9.1.0) : source unique des noms et des chemins écrits (« Héros › Équipement »).
// v9.1.0 : 4 menus aux noms honnêtes (onglets en haut du panneau). La fiche du héros (portrait) et les
// Paramètres (engrenage) sont hors menu. Les identifiants des panneaux ne changent pas.
// v9.3.5 : 5 boutons (Combat = fermer le menu, Héros, Équipe, Aventure, Quêtes), 4 onglets au plus par menu, plus le
// Profil (bouton du haut : Apparences, Classement, Guilde, Statistiques) ; la Boutique est le bouton coffre du haut ;
// l'Arène est dans Défis (Tour, Défi de la semaine, Arène).
export const MENUS = [
  { id: 'hero', label: 'Héros', tabs: ['inventory', 'upgrades', 'skills', 'forge', 'tree'] },
  { id: 'team', label: 'Équipe', tabs: ['companions', 'summon', 'expeditions'] },
  { id: 'adventure', label: 'Aventure', tabs: ['campaign', 'dungeons', 'tower', 'boss', 'event'] },
  { id: 'goals', label: 'Quêtes', tabs: ['contracts', 'encyclopedia'] },
  { id: 'profile', label: 'Profil', tabs: ['looks', 'ranking', 'guild', 'stats', 'shop'], top: true },
];
export const SUB_LABELS = {
  upgrades: 'Améliorations', skills: 'Compétences', tree: 'Talents', hero: 'Fiche', inventory: 'Équipement', forge: 'Forge', looks: 'Apparences',
  companions: 'Compagnons', expeditions: 'Expéditions', summon: 'Invocation', shop: 'Boutique', event: 'Événement', campaign: 'Carte', dungeons: 'Donjons', tower: 'Défis', arena: 'Arène',
  boss: 'Boss', world: 'Monde', encyclopedia: 'Collections', contracts: 'Missions', inbox: 'À récupérer', ranking: 'Classement', guild: 'Guilde', stats: 'Statistiques', options: 'Paramètres',
};
// Chemin écrit d'un écran (« Héros › Équipement »), construit depuis MENUS : jamais écrit en dur.
// La fiche du héros et les Paramètres sont hors menu : on dit comment les ouvrir (portrait, engrenage).
export function navPath(tab, ...rest) {
  const menu = MENUS.find((m) => m.tabs.includes(tab));
  const head = tab === 'hero' ? ['Portrait du héros'] : tab === 'options' ? ['Paramètres ⚙'] : [menu?.label, SUB_LABELS[tab]];
  return [...head, ...rest].filter(Boolean).join(' › ');
}
