# Mesures v9.1.3 (outil `tools/measure-v913.mjs`)

Moteur réel (core/*.js) en Node, horloge fixée à un mercredi, hasard à graine fixe. Aucun réglage n'est modifié.
Les sauvegardes sont fabriquées par un joueur automatique (achat au meilleur gain de dégâts/s, meilleur équipement, compétences, recyclage) qui n'existe pas dans le jeu.

## Sauvegardes simulées

| Sauvegarde | Temps de jeu | Étape max | Record | Niveau | Renaissances | Dégâts/s |
|---|---|---|---|---|---|---|
| debut | 30 min | 54 | 54 | 26 | 0 | 25 359 |
| milieu | 6 h 30 | 120 | 120 | 59 | 0 | 1.61e7 |
| fin | 32 h 30 | 370 | 370 | 120 | 13 | 2.82e15 |

## 1. Bilan des gemmes

Hypothèse : 2 h de jeu actif par jour, le reste hors ligne (plafond 24 h), toutes les missions faites, une clé de donjon par jour. Gains uniques à part.

### Sauvegarde « debut » (étape 54)

| Source | Jour | Semaine | Mois |
|---|---|---|---|
| Combat actif (2 h/jour, mesuré) | 1 788 | 12 516 | 53 640 |
| Hors ligne (22 h, part des gemmes de kill) | 353 | 2 471 | 10 589 |
| Connexion (cycle de 7 jours, sans remise à zéro) | 44,3 | 310 | 1 329 |
| Missions du jour (toutes + coffre) | 200 | 1 400 | 6 000 |
| Missions de la semaine (toutes + coffre) | 110 | 770 | 3 300 |
| Missions du mois (toutes + coffre) | 96,7 | 677 | 2 900 |
| Prime du jour | 60 | 420 | 1 800 |
| Donjons (1 clé/jour, Facile) | 25 | 175 | 750 |
| **Total** | **2 677** | **18 739** | **80 308** |
| Puits : invocations ×1 (100) / ×10 (900) | 26,8 invoc. | 20,8 × 10 | 89,2 × 10 |

Combat mesuré sur 1 h : 894 gemmes (2 057 monstres).

### Sauvegarde « milieu » (étape 120)

| Source | Jour | Semaine | Mois |
|---|---|---|---|
| Combat actif (2 h/jour, mesuré) | 568 | 3 976 | 17 040 |
| Hors ligne (22 h, part des gemmes de kill) | 439 | 3 074 | 13 174 |
| Connexion (cycle de 7 jours, sans remise à zéro) | 44,3 | 310 | 1 329 |
| Missions du jour (toutes + coffre) | 200 | 1 400 | 6 000 |
| Missions de la semaine (toutes + coffre) | 110 | 770 | 3 300 |
| Missions du mois (toutes + coffre) | 96,7 | 677 | 2 900 |
| Prime du jour | 60 | 420 | 1 800 |
| Donjons (1 clé/jour, Facile) | 25 | 175 | 750 |
| **Total** | **1 543** | **10 802** | **46 292** |
| Puits : invocations ×1 (100) / ×10 (900) | 15,4 invoc. | 12 × 10 | 51,4 × 10 |

Combat mesuré sur 1 h : 284 gemmes (2 559 monstres).

### Sauvegarde « fin » (étape 370)

| Source | Jour | Semaine | Mois |
|---|---|---|---|
| Combat actif (2 h/jour, mesuré) | 314 | 2 198 | 9 420 |
| Hors ligne (22 h, part des gemmes de kill) | 442 | 3 091 | 13 246 |
| Connexion (cycle de 7 jours, sans remise à zéro) | 44,3 | 310 | 1 329 |
| Missions du jour (toutes + coffre) | 200 | 1 400 | 6 000 |
| Missions de la semaine (toutes + coffre) | 110 | 770 | 3 300 |
| Missions du mois (toutes + coffre) | 96,7 | 677 | 2 900 |
| Prime du jour | 60 | 420 | 1 800 |
| Donjons (1 clé/jour, Facile) | 25 | 175 | 750 |
| **Total** | **1 291** | **9 040** | **38 744** |
| Puits : invocations ×1 (100) / ×10 (900) | 12,9 invoc. | 10 × 10 | 43 × 10 |

Combat mesuré sur 1 h : 157 gemmes (2 573 monstres).

Puits de gemmes du jeu : invocation (100 l'unité, 900 les 10) et réinitialisation des talents (300). Gains uniques : hauts faits 6 495 gemmes au total, premier boss 50.
Connexion (S2b) : un cycle de 7 jours donne 310 gemmes ; sans remise à zéro, un joueur qui vient 4 jours sur 7 gagne 177 gemmes par semaine au lieu de rester sur les premières cases (60 pour 2 séries de 2 jours).

## 2. Éclats et essences

| Sauvegarde | Éclats / h | Essences / h | Recyclés auto / h | Fusions / h |
|---|---|---|---|---|
| debut | 488 | 75 | 403 | 0 |
| milieu | 508 | 17 | 492 | 0 |
| fin | 422 | 9 | 1 161 | 0 |

Puits (forge) : fabriquer un Rare 25 éclats, un Épique 60 éclats + 6 essences, relancer les effets 10 éclats + 1 essences, renforcer 2 × (niveau + 1) éclats.

## 3. Part de l'équipement dans la puissance

| Sauvegarde | Dégâts/s avec / sans équipement | PV avec / sans |
|---|---|---|
| debut | ×1,7 | ×4,2 |
| milieu | ×5 | ×47,6 |
| fin | ×532 | ×15 581 |

## 4. Chemins de butin (1 h de jeu actif)

| Sauvegarde | Objets | dont boss | Sac | Recyclés au ramassage | Mannequins | Musée | Raretés |
|---|---|---|---|---|---|---|---|
| debut | 591 | 10 | 161 | 403 | 25 | 2 | Commun 68,2 %, Rare 24 %, Épique 6,4 %, Légendaire 1,4 % |
| milieu | 722 | 2 | 227 | 492 | 3 | 0 | Commun 68,1 %, Épique 6 %, Légendaire 1,2 %, Rare 24,7 % |
| fin | 1164 | 1 | 0 | 1161 | 3 | 0 | Commun 70,4 %, Rare 20,8 %, Épique 7,6 %, Légendaire 1,2 % |

## 5. Temps de jeu pour revenir à l'étape max après une Renaissance

| Sauvegarde | Étape max | Fragments gagnés | Retour (talents achetés) | Retour (sans talents) |
|---|---|---|---|---|
| milieu | 120 | 25 | 41 min | 41 min |
| fin | 370 | 108 | 1 h 57 | 1 h 56 |

Renaissance possible dès l'étape 30. Le temps est du temps de combat simulé à ×1.

## 6. Parcours chronométrés (nombre d'appuis, sauvegarde de fin)

| Parcours | Appuis | Détail |
|---|---|---|
| Réinvestir après une Renaissance | 19 | Renaître (2 : bouton + confirmation), Arbre (1), talents « Tout apprendre » : 1 région(s) × 2, compétences (2 : onglet + « Tout apprendre »), Améliorations (2 : onglet + Max), puis 1 appui par amélioration (7) dès que l'or revient |
| Changer de build (build enregistré) | 4 | Héros (1), Équipement (1), déplier « Builds » (1), charger (1) ; sans build enregistré : 1 appui par objet à porter (jusqu'à 7) + choix des pouvoirs |
| Relancer un pouvoir | 5 | Aventure (1), Boss (1), boss (1), « Relancer » (1), garder ou remplacer (1) ; il faut d'abord une charge (réaffronter le boss) |
| Trier un sac plein | 25 | Héros (1), Équipement (1), recyclage groupé jusqu'à Épique (3 : bouton, rareté, confirmation) qui retire 0 objet(s) sur 100 ; 100 restent (verrouillés, meilleurs ou utiles), 2 appuis par objet examiné (10 au plus comptés) |

À refaire après chaque allègement : `node tools/measure-v913.mjs`. Les appuis suivent un modèle écrit d'après les panneaux, à vérifier au doigt sur téléphone.

_Temps de jeu simulé pour fabriquer les sauvegardes : 32 h 30._
