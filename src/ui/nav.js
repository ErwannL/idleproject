// Menus et onglets (v9.1.0) : source unique des noms et des chemins écrits (« Héros › Équipement »).
// v9.1.0 : 4 menus aux noms honnêtes (onglets en haut du panneau). La fiche du héros (portrait) et les
// Paramètres (engrenage) sont hors menu. Les identifiants des panneaux ne changent pas.
// v9.3.5 : 5 boutons (Combat = fermer le menu, Héros, Équipe, Aventure, Quêtes), 4 onglets au plus par menu, plus le
// Profil (bouton du haut : Apparences, Classement, Guilde, Statistiques) ; la Boutique est le bouton coffre du haut ;
// l'Arène est dans Défis (Tour, Défi de la semaine, Arène).
// v9.9 (K6) : 5 onglets en bas (Héros, Équipe, Combat au centre, Invocation, Boutique), 4 sous-onglets au plus ; le reste
// est dans le tiroir ☰ (Quêtes, Profil…). La Forge s'ouvre depuis Équipement et le tiroir.
export const MENUS = [
  { id: 'hero', label: 'Héros', tabs: ['inventory', 'upgrades', 'skills', 'tree', 'forge'] }, // v9.10 (8) : la Forge sert l'équipement : 5e onglet de Héros
  { id: 'team', label: 'Équipe', tabs: ['companions', 'camp', 'expeditions'] }, // v10.4 (6) : le Bastion sous Équipe (Profil n'était pas trouvé)
  { id: 'adventure', label: 'Combat', tabs: ['campaign', 'dungeons', 'arena', 'tower', 'event'] }, // v10.2 (2.1) : l'Arène en tête de Combat
  { id: 'summon', label: 'Invocation', tabs: ['summon'] },
  { id: 'shop', label: 'Boutique', tabs: ['shop'] },
  // v10.16 (B1, B2) : 6e onglet du bas « Plus » (identifiant 'goals' gardé) : Objectifs (Chemin du héros, Carnet du jour et
  // Missions réunis), Collections, Boss, Apparences, Classement, Guilde, Statistiques. Plus aucun écran n'est seulement
  // dans le tiroir ☰ ; l'ancien menu « Profil » y est fondu. « Missions » (contracts) s'ouvre dans Objectifs › Plus tard.
  { id: 'goals', label: 'Plus', tabs: ['daybook', 'encyclopedia', 'boss', 'looks', 'ranking', 'guild', 'stats'] },
];
// v10.16 (B2) : écrans hors des sous-onglets, rattachés à l'onglet du bas qui s'allume quand on y est.
export const MENU_HOST = { hero: 'hero', options: 'goals', inbox: 'goals', world: 'adventure', contracts: 'goals' };
export function hostMenu(tab) {
  return MENUS.find((m) => m.tabs.includes(tab)) ?? MENUS.find((m) => m.id === MENU_HOST[tab]) ?? null;
}
// v10.16 (B2) : texte d'une pastille à chiffre : rien sous 1, « 9+ » au-delà de 9.
export function badgeText(n) {
  const k = Math.floor(Number(n) || 0);
  return k <= 0 ? '' : k > 9 ? '9+' : String(k);
}
export const SUB_LABELS = {
  camp: 'Bastion', upgrades: 'Améliorations', skills: 'Compétences', tree: 'Talents', hero: 'Fiche', inventory: 'Équipement', forge: 'Forge', looks: 'Apparences',
  companions: 'Compagnons', expeditions: 'Expéditions', summon: 'Invocation', shop: 'Boutique', event: 'Événement', campaign: 'Carte', dungeons: 'Donjons', tower: 'Défis', arena: 'Arène',
  boss: 'Boss', world: 'Monde', encyclopedia: 'Collections', contracts: 'Missions', daybook: 'Objectifs', inbox: 'À récupérer', ranking: 'Classement', guild: 'Guilde', stats: 'Statistiques', options: 'Paramètres',
};
// v10.1 (P1 §2.4) : une phrase sous le titre de chaque onglet — ce que fait l'écran.
export const TAB_LEAD = {
  upgrades: 'Dépense ton or pour rendre ton héros plus fort.',
  skills: 'Apprends des sorts que ton héros lance tout seul en combat.',
  tree: 'Après une Renaissance, les fragments achètent des talents pour toujours.',
  inventory: 'Équipe les meilleurs objets sur ton héros et tes compagnons.',
  forge: 'Les objets dont tu n\'as plus besoin deviennent des éclats. Les éclats rendent tes bons objets plus forts.', // v10.3 (9)
  companions: 'Choisis qui combat à tes côtés et fais-les monter de niveau.',
  expeditions: 'Envoie les compagnons libres chercher des ressources pendant que tu joues.',
  summon: 'Dépense des gemmes ou des tickets pour obtenir de nouveaux compagnons.',
  shop: 'Gemmes, tickets et cosmétiques (les achats ne sont pas encore ouverts).',
  event: 'Un événement à durée limitée : avance sur sa carte pour ses récompenses.',
  campaign: 'La carte des mondes : choisis l\'étape où ton héros combat.',
  dungeons: 'Une clé ouvre un donjon : quelques salles, un boss, un gros coffre.',
  tower: 'Défis du jour et de la semaine : la Tour et le Défi.', // v10.3 : l'Arène a son onglet
  arena: 'Tes compagnons en cartes affrontent les monstres d\'étage en étage.',
  boss: 'Les boss vaincus te donnent des pouvoirs à placer.',
  encyclopedia: 'Tout ce que tu as découvert : monstres, objets, compagnons.',
  contracts: 'Missions du jour, de la semaine, Chroniques et hauts faits : des récompenses à récupérer.',
  daybook: 'Maintenant, aujourd\'hui, plus tard : tout ce qui t\'attend, au même endroit.', // v10.16 (B1)
  camp: 'Tes compagnons libres construisent et cherchent pour toi, même jeu fermé.', // v10.4 (6)
  looks: 'Change l\'apparence de ton héros (aucun effet sur la puissance).',
  ranking: 'Compare ton record à celui des autres joueurs.',
  guild: 'Rejoins une guilde pour des bonus et un boss commun.',
  stats: 'Tous tes chiffres : dégâts, records, temps de jeu.',
  hero: 'La fiche de ton héros : puissance, classe et records.',
};
// v9.7.1 : libellés courts des onglets sur téléphone (une ligne, plus de « Équipe-ment »).
// v10.16 (B3) : plus jamais de point d'abréviation (« Amélio. », « Compét. », « Équip. ») : le mot entier, sur 2 lignes au besoin.
export const SUB_SHORT = { statistics: 'Stats', stats: 'Stats', options: 'Réglages', inbox: 'Reçus', ranking: 'Classement', looks: 'Apparences' };
// Chemin écrit d'un écran (« Héros › Équipement »), construit depuis MENUS : jamais écrit en dur.
// La fiche du héros et les Paramètres sont hors menu : on dit comment les ouvrir (portrait, engrenage).
export function navPath(tab, ...rest) {
  const menu = hostMenu(tab);
  const head = tab === 'hero' ? ['Portrait du héros'] : tab === 'options' ? ['Paramètres ⚙'] : [menu?.label, SUB_LABELS[tab === 'contracts' ? 'daybook' : tab]]; // v10.16 : Missions dans Objectifs
  return [...head, ...rest].filter(Boolean).join(' › ');
}
