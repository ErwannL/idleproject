# Butin v9.1.9 : moins d'objets, même valeur

Demande : « le taux de drop des objets est trop fréquent » — le sac (100 places) se remplissait en 30 à 60 min de farm,
avec des centaines de Communs à l'heure. Objectif : beaucoup moins d'objets communs, même gain d'éclats/heure et même
vitesse d'obtention des Épiques/Légendaires portables (±10 %), ensembles et Musée au même rythme.

## Changement (src/data/balance.js)

| Réglage | v9.1.8 | v9.1.9 |
|---|---|---|
| Chance de butin d'un monstre ordinaire | 10 % (+ bonus) | (10 % + bonus) × `dropScale` 0,3 |
| Rareté de ce butin (C/R/É/L) | 70 / 22 / 7 / 1 (`RARITIES`) | `dropRarityWeights` 36,7 / 36,7 / 23,3 / 3,3 |
| Pièce d'ensemble sur un Rare | 12 % | 24 % |
| Éclat par monstre ordinaire vaincu | — | 14 % de chance (`killShardChance`) |
| Objets générés hors ligne (max) | 10 | 3 (le surplus reste payé en or au même prix qu'avant) |

Calcul par monstre ordinaire : Épiques 0,1 × 7 % = 0,3 × 23,3 % = 0,7 % ; Légendaires 0,1 % des deux côtés ; Rares
÷ 2 ; Communs 7 % → 1,1 % (÷ 6). Boss, élites et ennemis mutés : inchangés (butin garanti, poids de `RARITIES`) —
les objets ancestraux (Musée) et objets signature tombent des boss : leur rythme ne bouge pas.

## Mesures (moteur réel, `node tools/measure-butin-v919.mjs --saves <saves>`)

Sauvegardes début / milieu / fin de `tools/measure-v913.mjs --dump-saves`. Farm de l'étape actuelle, 3 h ramenées à
l'heure, sac vidé au départ, boost de début terminé, jour de semaine. « Éclats/h » compte aussi les éclats des objets
restés dans le sac (valeur égale, que le joueur recycle tôt ou tard). Ancestraux à 0 : farm sans boss (voir ci-dessus).

## Combat (3 h de farm, ramenées à 1 h, sac vide au départ)

| Partie | Version | Objets/h | Communs | Rares | Épiques | Légendaires | Recyclés au ramassage | Pièces d'ensemble | Ancestraux | Éclats/h (sac compris) | Or/h | Sac plein (100) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| debut (étape 44) | avant | 327,3 | 224 | 77,3 | 22 | 4 | 88 % | 16,3 | 0 | 1152,3 | 5,08e+5 | 59 min |
| debut (étape 44) | après | 125,7 | 55,7 | 46,3 | 18,7 | 5 | 68 % | 18,3 | 0 | 1208,3 | 4,87e+5 | 86 min |
| milieu (étape 119) | avant | 696,7 | 476 | 164,7 | 52,3 | 3,7 | 95 % | 33 | 0 | 2089,3 | 1,67e+8 | 30 min |
| milieu (étape 119) | après | 239,7 | 100,3 | 80,7 | 51,7 | 7 | 85 % | 36,7 | 0 | 1943 | 1,61e+8 | 46 min |
| fin (étape 179) | avant | 554,7 | 383 | 126,3 | 39,7 | 5,7 | 94 % | 30,3 | 0 | 1732 | 5,01e+10 | 34 min |
| fin (étape 179) | après | 193,7 | 74,3 | 70 | 44 | 5,3 | 82 % | 31 | 0 | 1667 | 4,96e+10 | 47 min |

## Hors ligne (8 h)

| Partie | Version | Objets | Communs | Rares | Épiques | Légendaires | Recyclés | Pièces d'ensemble | Éclats | Or |
|---|---|---|---|---|---|---|---|---|---|---|
| debut | avant | 10 | 6,9 | 2,3 | 0,8 | 0,1 | 7 | 0,5 | 7,1 | 2,50e+6 |
| debut | après | 3 | 1,1 | 1 | 0,9 | 0,1 | 1,1 | 0,7 | 1,1 | 2,38e+6 |
| milieu | avant | 10 | 6,9 | 2,3 | 0,8 | 0,1 | 7 | 0,5 | 7,8 | 7,82e+8 |
| milieu | après | 3 | 1,1 | 1 | 0,9 | 0,1 | 1,2 | 0,7 | 3,8 | 7,99e+8 |
| fin | avant | 10 | 6,9 | 2,3 | 0,8 | 0,1 | 7 | 0,5 | 7,8 | 2,44e+11 |
| fin | après | 3 | 1,1 | 1 | 0,9 | 0,1 | 1,1 | 0,7 | 2 | 2,43e+11 |

## Bilan

- Objets/heure : −62 % (début) à −66 % (milieu, fin) ; Communs ÷ 4 à ÷ 5 (les élites et mutants en donnent encore).
- Sac plein : 30–34 min → 46–47 min au milieu et en fin de partie, 59 → 86 min au début.
- Épiques + Légendaires : 26 → 23,7 / 56 → 58,7 / 45,4 → 49,3 par heure — écarts dans le bruit du tirage (égaux en
  espérance par construction).
- Éclats/heure : +5 % / −7 % / −4 %. Or/heure : −1 à −4 % (moins de Communs recyclés).
- Pièces d'ensemble : 16,3 → 18,3 / 33 → 36,7 / 30,3 → 31 par heure. Hors ligne : 3 objets au lieu de 10, autant
  d'Épiques, Légendaires et pièces d'ensemble, or identique.
