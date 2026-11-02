# Mesures v9.1.3 (outil `tools/measure-v913.mjs`)

Moteur réel (core/*.js) en Node, horloge fixée à un mercredi, hasard à graine fixe. Aucun réglage n'est modifié.
Les sauvegardes sont fabriquées par un joueur automatique (achat au meilleur gain de dégâts/s, meilleur équipement, compétences, recyclage) qui n'existe pas dans le jeu.

## Sauvegardes simulées

| Sauvegarde | Temps de jeu | Étape max | Record | Niveau | Renaissances | Dégâts/s |
|---|---|---|---|---|---|---|
| debut | 30 min | 60 | 60 | 26 | 0 | 30 467 |
| milieu | 6 h 30 | 115 | 115 | 55 | 0 | 8.88e6 |
| fin | 32 h 30 | 370 | 370 | 125 | 12 | 2.52e15 |

## 1. Bilan des gemmes

Hypothèse : 2 h de jeu actif par jour, le reste hors ligne (plafond 24 h), toutes les missions faites, une clé de donjon par jour. Gains uniques à part.

### Sauvegarde « debut » (étape 60)

| Source | Jour | Semaine | Mois |
|---|---|---|---|
| Combat actif (2 h/jour, mesuré) | 2 722 | 19 054 | 81 660 |
| Hors ligne (22 h, part des gemmes de kill) | 388 | 2 714 | 11 629 |
| Connexion (cycle de 7 jours, sans remise à zéro) | 130 | 910 | 3 900 |
| Missions du jour (toutes + coffre) | 300 | 2 100 | 9 000 |
| Piste du mois (tous les paliers) | 333 | 2 333 | 10 000 |
| Prime du jour | 60 | 420 | 1 800 |
| Donjons (1 clé/jour, Facile) | 25 | 175 | 750 |
| **Total** | **3 958** | **27 706** | **118 739** |
| Puits : invocations ×1 (100) / ×10 (900) | 39,6 invoc. | 30,8 × 10 | 132 × 10 |

Combat mesuré sur 1 h : 1 361 gemmes (2 259 monstres).

### Sauvegarde « milieu » (étape 115)

| Source | Jour | Semaine | Mois |
|---|---|---|---|
| Combat actif (2 h/jour, mesuré) | 248 | 1 736 | 7 440 |
| Hors ligne (22 h, part des gemmes de kill) | 444 | 3 108 | 13 318 |
| Connexion (cycle de 7 jours, sans remise à zéro) | 130 | 910 | 3 900 |
| Missions du jour (toutes + coffre) | 300 | 2 100 | 9 000 |
| Piste du mois (tous les paliers) | 333 | 2 333 | 10 000 |
| Prime du jour | 60 | 420 | 1 800 |
| Donjons (1 clé/jour, Facile) | 25 | 175 | 750 |
| **Total** | **1 540** | **10 782** | **46 208** |
| Puits : invocations ×1 (100) / ×10 (900) | 15,4 invoc. | 12 × 10 | 51,3 × 10 |

Combat mesuré sur 1 h : 124 gemmes (2 587 monstres).

### Sauvegarde « fin » (étape 370)

| Source | Jour | Semaine | Mois |
|---|---|---|---|
| Combat actif (2 h/jour, mesuré) | 302 | 2 114 | 9 060 |
| Hors ligne (22 h, part des gemmes de kill) | 444 | 3 109 | 13 323 |
| Connexion (cycle de 7 jours, sans remise à zéro) | 130 | 910 | 3 900 |
| Missions du jour (toutes + coffre) | 300 | 2 100 | 9 000 |
| Piste du mois (tous les paliers) | 333 | 2 333 | 10 000 |
| Prime du jour | 60 | 420 | 1 800 |
| Donjons (1 clé/jour, Facile) | 25 | 175 | 750 |
| **Total** | **1 594** | **11 161** | **47 833** |
| Puits : invocations ×1 (100) / ×10 (900) | 15,9 invoc. | 12,4 × 10 | 53,1 × 10 |

Combat mesuré sur 1 h : 151 gemmes (2 588 monstres).

Puits de gemmes du jeu : invocation (100 l'unité, 900 les 10) et réinitialisation des talents (300). Gains uniques : hauts faits 6 495 gemmes au total, premier boss 50.
Connexion (S2b) : un cycle de 7 jours donne 910 gemmes ; sans remise à zéro, un joueur qui vient 4 jours sur 7 gagne 520 gemmes par semaine au lieu de rester sur les premières cases (260 pour 2 séries de 2 jours).

## 2. Éclats (essences fondues dans les éclats)

| Sauvegarde | Éclats / h | Recyclés auto / h | Fusions / h |
|---|---|---|---|
| debut | 757 | 388 | 0 |
| milieu | 313 | 274 | 0 |
| fin | 230 | 668 | 0 |

Puits (forge) : fabriquer un Rare 25 éclats, un Épique 120 éclats, relancer les effets 20 éclats, renforcer 2 × (niveau + 1) éclats.

## 3. Part de l'équipement dans la puissance

| Sauvegarde | Dégâts/s avec / sans équipement | PV avec / sans |
|---|---|---|
| debut | ×1,8 | ×5 |
| milieu | ×4,5 | ×43,5 |
| fin | ×523 | ×9 916 |

## 4. Chemins de butin (1 h de jeu actif)

| Sauvegarde | Objets | dont boss | Sac | Recyclés au ramassage | Mannequins | Musée | Raretés |
|---|---|---|---|---|---|---|---|
| debut | 585 | 3 | 183 | 388 | 13 | 1 | Rare 26,7 %, Légendaire 1,7 %, Commun 66,3 %, Épique 5,3 % |
| milieu | 401 | 0 | 124 | 274 | 3 | 0 | Commun 68,3 %, Épique 6 %, Rare 25,2 %, Légendaire 0,5 % |
| fin | 670 | 0 | 0 | 668 | 2 | 0 | Commun 67,9 %, Rare 24,2 %, Épique 7,3 %, Légendaire 0,6 % |

## 5. Temps de jeu pour revenir à l'étape max après une Renaissance

| Sauvegarde | Étape max | Fragments gagnés | Retour (talents achetés) | Retour (sans talents) |
|---|---|---|---|---|
| milieu | 115 | 23 | 41 min | 41 min |
| fin | 370 | 108 | 1 h 57 | 2 h 13 |

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
