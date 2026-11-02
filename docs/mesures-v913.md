# Mesures v9.1.3 (outil `tools/measure-v913.mjs`)

Moteur réel (core/*.js) en Node, horloge fixée à un mercredi, hasard à graine fixe. Aucun réglage n'est modifié.
Les sauvegardes sont fabriquées par un joueur automatique (achat au meilleur gain de dégâts/s, meilleur équipement, compétences, recyclage) qui n'existe pas dans le jeu.

## Sauvegardes simulées

| Sauvegarde | Temps de jeu | Étape max | Record | Niveau | Renaissances | Dégâts/s |
|---|---|---|---|---|---|---|
| debut | 30 min | 45 | 45 | 25 | 0 | 24 065 |
| milieu | 6 h 30 | 130 | 130 | 59 | 0 | 1.76e7 |
| fin | 32 h 30 | 494 | 494 | 152 | 13 | 7.50e18 |

## 1. Bilan des gemmes

Hypothèse : 2 h de jeu actif par jour, le reste hors ligne (plafond 24 h), toutes les missions faites, une clé de donjon par jour. Gains uniques à part.

### Sauvegarde « debut » (étape 45)

| Source | Jour | Semaine | Mois |
|---|---|---|---|
| Combat actif (2 h/jour, mesuré) | 2 438 | 17 066 | 73 140 |
| Hors ligne (22 h, part des gemmes de kill) | 402 | 2 814 | 12 062 |
| Connexion (cycle de 7 jours, sans remise à zéro) | 130 | 910 | 3 900 |
| Missions du jour (toutes + coffre) | 300 | 2 100 | 9 000 |
| Piste du mois (tous les paliers) | 333 | 2 333 | 10 000 |
| Prime du jour | 60 | 420 | 1 800 |
| Donjons (1 clé/jour, Facile) | 25 | 175 | 750 |
| **Total** | **3 688** | **25 819** | **110 652** |
| Puits : invocations ×1 (100) / ×10 (900) | 36,9 invoc. | 28,7 × 10 | 123 × 10 |

Combat mesuré sur 1 h : 1 219 gemmes (2 343 monstres).

### Sauvegarde « milieu » (étape 130)

| Source | Jour | Semaine | Mois |
|---|---|---|---|
| Combat actif (2 h/jour, mesuré) | 270 | 1 890 | 8 100 |
| Hors ligne (22 h, part des gemmes de kill) | 442 | 3 097 | 13 272 |
| Connexion (cycle de 7 jours, sans remise à zéro) | 130 | 910 | 3 900 |
| Missions du jour (toutes + coffre) | 300 | 2 100 | 9 000 |
| Piste du mois (tous les paliers) | 333 | 2 333 | 10 000 |
| Prime du jour | 60 | 420 | 1 800 |
| Donjons (1 clé/jour, Facile) | 25 | 175 | 750 |
| **Total** | **1 561** | **10 925** | **46 822** |
| Puits : invocations ×1 (100) / ×10 (900) | 15,6 invoc. | 12,1 × 10 | 52 × 10 |

Combat mesuré sur 1 h : 135 gemmes (2 578 monstres).

### Sauvegarde « fin » (étape 494)

| Source | Jour | Semaine | Mois |
|---|---|---|---|
| Combat actif (2 h/jour, mesuré) | 730 | 5 110 | 21 900 |
| Hors ligne (22 h, part des gemmes de kill) | 438 | 3 067 | 13 143 |
| Connexion (cycle de 7 jours, sans remise à zéro) | 130 | 910 | 3 900 |
| Missions du jour (toutes + coffre) | 300 | 2 100 | 9 000 |
| Piste du mois (tous les paliers) | 333 | 2 333 | 10 000 |
| Prime du jour | 60 | 420 | 1 800 |
| Donjons (1 clé/jour, Facile) | 25 | 175 | 750 |
| **Total** | **2 016** | **14 115** | **60 493** |
| Puits : invocations ×1 (100) / ×10 (900) | 20,2 invoc. | 15,7 × 10 | 67,2 × 10 |

Combat mesuré sur 1 h : 365 gemmes (2 553 monstres).

Puits de gemmes du jeu : invocation (100 l'unité, 900 les 10) et réinitialisation des talents (300). Gains uniques : hauts faits 6 495 gemmes au total, premier boss 50.
Connexion (S2b) : un cycle de 7 jours donne 910 gemmes ; sans remise à zéro, un joueur qui vient 4 jours sur 7 gagne 520 gemmes par semaine au lieu de rester sur les premières cases (260 pour 2 séries de 2 jours).

## 2. Éclats (essences fondues dans les éclats)

| Sauvegarde | Éclats / h | Recyclés auto / h | Fusions / h |
|---|---|---|---|
| debut | 764 | 436 | 0 |
| milieu | 458 | 431 | 0 |
| fin | 4 026 | 641 | 0 |

Puits (forge) : fabriquer un Rare 25 éclats, un Épique 120 éclats, relancer les effets 20 éclats, renforcer 2 × (niveau + 1) éclats.

## 3. Part de l'équipement dans la puissance

| Sauvegarde | Dégâts/s avec / sans équipement | PV avec / sans |
|---|---|---|
| debut | ×1,6 | ×5,2 |
| milieu | ×5,9 | ×79,2 |
| fin | ×1 542 | ×27 417 |

## 4. Chemins de butin (1 h de jeu actif)

| Sauvegarde | Objets | dont boss | Sac | Recyclés au ramassage | Mannequins | Musée | Raretés |
|---|---|---|---|---|---|---|---|
| debut | 643 | 4 | 191 | 436 | 16 | 0 | Épique 6,7 %, Rare 24,9 %, Commun 67,8 %, Légendaire 0,6 % |
| milieu | 587 | 0 | 150 | 431 | 6 | 0 | Commun 73,4 %, Rare 20,3 %, Épique 5,6 %, Légendaire 0,7 % |
| fin | 652 | 2 | 1 | 641 | 9 | 1 | Commun 68,9 %, Épique 6,7 %, Rare 23,2 %, Légendaire 1,2 % |

## 5. Temps de jeu pour revenir à l'étape max après une Renaissance

| Sauvegarde | Étape max | Fragments gagnés | Retour (talents achetés) | Retour (sans talents) |
|---|---|---|---|---|
| milieu | 130 | 27 | 2 h 08 | 1 h 06 |
| fin | 494 | 158 | 2 h 34 | 2 h 35 |

Renaissance possible dès l'étape 30. Le temps est du temps de combat simulé à ×1.

## 6. Parcours chronométrés (nombre d'appuis, sauvegarde de fin)

| Parcours | Appuis | Détail |
|---|---|---|
| Réinvestir après une Renaissance | 21 | Renaître (2 : bouton + confirmation), Arbre (1), talents « Tout apprendre » : 2 région(s) × 2, compétences (2 : onglet + « Tout apprendre »), Améliorations (2 : onglet + Max), puis 1 appui par amélioration (7) dès que l'or revient |
| Changer de build (build enregistré) | 4 | Héros (1), Équipement (1), déplier « Builds » (1), charger (1) ; sans build enregistré : 1 appui par objet à porter (jusqu'à 7) + choix des pouvoirs |
| Relancer un pouvoir | 5 | Aventure (1), Boss (1), boss (1), « Relancer » (1), garder ou remplacer (1) ; il faut d'abord une charge (réaffronter le boss) |
| Trier un sac plein | 25 | Héros (1), Équipement (1), recyclage groupé jusqu'à Épique (3 : bouton, rareté, confirmation) qui retire 0 objet(s) sur 100 ; 100 restent (verrouillés, meilleurs ou utiles), 2 appuis par objet examiné (10 au plus comptés) |

À refaire après chaque allègement : `node tools/measure-v913.mjs`. Les appuis suivent un modèle écrit d'après les panneaux, à vérifier au doigt sur téléphone.

_Temps de jeu simulé pour fabriquer les sauvegardes : 32 h 30._
