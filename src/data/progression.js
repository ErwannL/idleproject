// v9.3.3 : progression individuelle des HÉROS (alliés invoqués) et des FAMILIERS. Le chevalier n'est pas concerné :
// ses améliorations permanentes (data/balance.js upgrades), compétences et équipement restent inchangés.
// Tout l'équilibrage est ici (core/progression.js lit ces tables).

// ---- Doublons : bonus CUMULÉS par nombre d'exemplaires (1 à 6) ----
// Appliqué une seule fois, au passif et à la puissance des compétences (campagne), et aux stats de l'Arène.
export const DUP_BONUS_PCT = [0, 4, 8, 12, 16, 24];
export const ULT_UNLOCK_COPIES = 4; // le 4e exemplaire ouvre les niveaux 6 à 10 de l'ultime

// ---- Compétences : passive, active, ultime ----
export const SKILL_CAPS = { passive: 10, active: 10, ultimate: 10, ultimateBefore4: 5 };
// Effets par niveau (multiplicatifs, depuis le niveau 1) et paliers fonctionnels.
export const SKILL_GROWTH = {
  passive: { perLevel: 0.05 },                     // passif : +5 % par niveau
  active: { perLevel: 0.06, cdAt: { 3: 0.9, 10: 0.8 } }, // active : +6 %/niv., recharge −10 % au niv. 3, −20 % au niv. 10
  ultimate: { perLevel: 0.08, cdAt: { 5: 0.9 }, durationAt: { 3: 1, 8: 2 } }, // ultime : +8 %/niv., recharge −10 % au 5, durée +1 s / +2 s
};
// Ancienne 2e et 3e compétence d'un héros : intégrées à l'évolution de l'active (niveaux 5 et 8).
export const ACTIVE_EXTRA_AT = [5, 8];
// Effets plafonnés (soin, bouclier) : ne dépassent jamais ces valeurs, quel que soit le niveau.
export const SKILL_VALUE_CAPS = { heal: 60, shield: 85 };

// ---- Ressources universelles (aucune par élément, rareté ou rôle) ----
export const SKILL_RESOURCES = {
  grimoire: { name: 'Grimoire de combat', short: 'Grimoires', icon: 'icon_grimoire', use: 'Améliore les compétences passives et actives.' },
  ascension: { name: "Pierre d'ascension", short: 'Pierres', icon: 'icon_ascension', use: 'Améliore les compétences ultimes.' },
  mastery: { name: 'Essence de maîtrise', short: 'Essences', icon: 'icon_mastery', use: 'Niveaux avancés (6 à 10) de toutes les compétences.' },
};
// Coûts du niveau n → n+1 (index n-1). L'or est en « nombre d'ennemis de l'étape max » (même base que les niveaux des
// compagnons), avec un plafond : il garde de la valeur en fin de jeu sans exploser.
export const SKILL_COSTS = {
  passive: [
    { grimoire: 2, kills: 10 }, { grimoire: 3, kills: 20 }, { grimoire: 5, kills: 35 }, { grimoire: 7, kills: 50 },
    { grimoire: 9, mastery: 1, kills: 80 }, { grimoire: 12, mastery: 2, kills: 120 }, { grimoire: 15, mastery: 3, kills: 180 },
    { grimoire: 19, mastery: 4, kills: 250 }, { grimoire: 24, mastery: 6, kills: 350 },
  ],
  ultimate: [
    { ascension: 2, kills: 20 }, { ascension: 3, kills: 40 }, { ascension: 5, kills: 70 }, { ascension: 7, kills: 100 },
    { ascension: 9, mastery: 1, kills: 160 }, { ascension: 12, mastery: 2, kills: 240 }, { ascension: 15, mastery: 3, kills: 360 },
    { ascension: 19, mastery: 4, kills: 500 }, { ascension: 24, mastery: 6, kills: 700 },
  ],
};
SKILL_COSTS.active = SKILL_COSTS.passive;
// Or minimal d'un ennemi et plafond de l'indexation (×40 de l'or d'un ennemi de l'étape 50).
export const GOLD_INDEX = { refStage: 50, cap: 40, min: 25 };

// v9.3.9 (2.6) : où trouver chaque ressource (fiche « Où en trouver », avec un bouton vers l'écran).
export const RESOURCE_WHERE = {
  grimoire: [
    { tab: 'dungeons', text: 'Donjons : 1 par salle franchie, 4 à la fin' },
    { tab: 'contracts', text: 'Missions du jour : 6 quand toutes sont faites' },
    { tab: 'arena', text: "Arène : 2 par nouvel étage" },
    { tab: 'event', text: "Boutique de l'événement" },
  ],
  ascension: [
    { tab: 'dungeons', text: 'Donjons : 2 à la fin' },
    { tab: 'contracts', text: 'Coffre de la semaine (Missions › Semaine) : 6' },
    { tab: 'arena', text: 'Arène : 1 par nouvel étage' },
    { tab: 'event', text: "Boutique de l'événement" },
  ],
  mastery: [
    { tab: 'campaign', text: 'Boss de la campagne : 15 % de chance' },
    { tab: 'contracts', text: 'Coffre de la semaine (Missions › Semaine) : 3' },
    { tab: 'event', text: "Boutique de l'événement" },
  ],
};

// ---- Sources (F2P) ----
export const RESOURCE_SOURCES = {
  dungeonRoom: { grimoire: 1 },                    // chaque salle de donjon franchie
  dungeonClear: { grimoire: 4, ascension: 2 },     // donjon terminé
  bossKill: { mastery: 1, chance: 0.15 },          // boss de campagne (15 %)
  arenaFloor: { grimoire: 2, ascension: 1 },       // étage d'Arène franchi pour la première fois
  dailyMissions: { grimoire: 6 },                  // toutes les missions du jour
  weeklyChest: { ascension: 6, mastery: 3 },       // coffre de la semaine
  eventShop: { grimoire: 10, ascension: 5, mastery: 2 },
};
