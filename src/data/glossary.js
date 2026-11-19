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
  'Éveil': 'Un compagnon au niveau 20 s\'éveille (nouvelle illustration, un sort de plus). Un grand boss, lui, se relève avec une nouvelle barre de vie.',
  // v10.1 (P1 §2.3) : les mots du jeu, expliqués avant d'être utilisés.
  Contrat: 'Un objectif d\'aventure (vaincre des monstres, gagner de l\'or…) qui se remplit tout seul en jouant : des gemmes à la clé.',
  'Haut fait': 'Un exploit permanent (premier boss, 1 000 monstres…) : des gemmes et un petit bonus pour toujours.',
  Collections: 'Tout ce que tu as découvert : chaque monstre, objet ou compagnon trouvé donne un petit bonus.',
  Familier: 'Un petit compagnon (chat, hibou, slime…) qui suit ton héros : il frappe peu mais donne un bonus.',
};
// v10.1 (P1 §2.3) : carte de glossaire des ressources — image, à quoi ça sert, où en gagner, écran où aller.
export const RESOURCES = {
  gold: { name: 'Or', icon: 'coin', use: 'Améliore ton héros (Dégâts, Vie…) et tes compagnons.', where: 'Chaque monstre vaincu en donne.', tab: 'upgrades' },
  gems: { name: 'Gemmes', icon: 'icon_gem', use: 'Invoque des compagnons et achète des boosts.', where: 'Missions, hauts faits, boss et Roue du jour.', tab: 'summon' },
  shards: { name: 'Éclats', icon: 'icon_shard', use: 'Renforce et fusionne tes objets à la Forge.', where: 'Recycler un objet inutile en donne.', tab: 'forge' },
  keys: { name: 'Clés de donjon', icon: 'icon_key', use: 'Une clé ouvre un donjon : quelques salles, un boss, un gros coffre.', where: 'Missions, coffres et boss de monde.', tab: 'dungeons' },
  grimoire: { name: 'Grimoires', icon: 'icon_grimoire', use: 'Montent les compétences de tes compagnons.', where: 'Donjons, missions du jour et Arène.', tab: 'companions' },
  ascension: { name: "Pierres d'éveil", icon: 'icon_ascension', use: 'Font monter les étoiles de tes compagnons.', where: 'Donjons, Arène et coffres de la semaine.', tab: 'companions' },
  fragments: { name: 'Fragments', icon: 'icon_fragment', use: 'Achètent des talents permanents après une Renaissance.', where: 'Chaque Renaissance en donne.', tab: 'tree' },
  mastery: { name: 'Essences', icon: 'icon_mastery', use: 'Montent la maîtrise des compagnons.', where: 'Coffres de la semaine et expéditions.', tab: 'companions' },
  tickets: { name: 'Tickets de compagnon', icon: 'hero_ticket_limited', shop: true, use: 'Une invocation sans dépenser de gemmes.', where: 'Connexion, missions, coffres d\'étoiles de l\'Arène.', tab: 'summon' },
};
export const GLOSSARY_TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
