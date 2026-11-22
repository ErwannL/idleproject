# Rythme v10.8 (simulation, 90 jours, graine 1)

Produit par `node tools/sim-rythme.mjs`. Vrai moteur, 20 min par connexion, gains hors ligne entre les connexions, Bastion géré avec 30 % de l'or, Renaissance dès qu'elle est rentable.

## Fenêtres visées

| Contrôle | Résultat | |
|---|---|---|
| monde 7 entre les jours 25 et 40 (régulier) | jour 17 | ✘ |
| monde 12 entre les jours 90 et 120 (régulier) | jour > 90 | ✔ |
| 1re Renaissance entre les jours 15 et 30 (régulier) | jour 10 | ✘ |
| 1er Mythique vers la semaine 3 (jours 14 à 28) | jour 3 | ✘ |

## Profil regulier (2 connexions par jour)

Premières raretés : mythic jour 3 · Renaissances : 8

| Jour | Étape | Monde | Puissance | Meilleure rareté | Bastion (niv. / âge) | ×Bastion | Recherches | Renaissances |
|---|---|---|---|---|---|---|---|---|
| 1 | 80 | 4 | 5.93e+6 | legendary | 3 / 1 | ×1.00 | 0 | 0 |
| 2 | 80 | 4 | 9.92e+7 | legendary | 6 / 1 | ×1.00 | 1 | 0 |
| 3 | 80 | 4 | 2.40e+8 | mythic | 11 / 1 | ×1.00 | 4 | 0 |
| 4 | 100 | 5 | 2.60e+8 | mythic | 15 / 1 | ×1.00 | 6 | 0 |
| 5 | 120 | 6 | 5.47e+8 | mythic | 18 / 2 | ×1.00 | 6 | 0 |
| 6 | 120 | 6 | 1.67e+9 | mythic | 22 / 2 | ×1.00 | 6 | 0 |
| 7 | 120 | 6 | 2.11e+9 | mythic | 24 / 2 | ×1.00 | 7 | 0 |
| 10 | 120 | 6 | 9.08e+5 | mythic | 26 / 2 | ×1.02 | 15 | 1 |
| 15 | 120 | 6 | 3.48e+9 | mythic | 29 / 2 | ×1.02 | 20 | 1 |
| 20 | 130 | 7 | 1.41e+9 | mythic | 31 / 2 | ×1.02 | 26 | 2 |
| 25 | 140 | 7 | 8.36e+9 | mythic | 31 / 2 | ×1.02 | 26 | 2 |
| 30 | 150 | 8 | 1.65e+10 | mythic | 31 / 2 | ×1.02 | 26 | 2 |
| 35 | 150 | 8 | 2.60e+8 | mythic | 33 / 2 | ×1.02 | 30 | 3 |
| 40 | 150 | 8 | 1.28e+10 | mythic | 33 / 2 | ×1.02 | 32 | 3 |
| 45 | 150 | 8 | 9.47e+6 | mythic | 33 / 2 | ×1.02 | 33 | 4 |
| 50 | 155 | 8 | 7.21e+10 | mythic | 33 / 2 | ×1.02 | 35 | 4 |
| 55 | 155 | 8 | 1.22e+7 | mythic | 33 / 2 | ×1.02 | 35 | 5 |
| 60 | 155 | 8 | 1.08e+11 | mythic | 33 / 2 | ×1.02 | 35 | 5 |
| 65 | 160 | 8 | 1.80e+11 | mythic | 33 / 2 | ×1.02 | 35 | 5 |
| 70 | 160 | 8 | 3.08e+10 | mythic | 33 / 2 | ×1.02 | 35 | 6 |
| 75 | 160 | 8 | 2.22e+11 | mythic | 33 / 2 | ×1.02 | 36 | 6 |
| 80 | 160 | 8 | 3.19e+10 | mythic | 33 / 2 | ×1.02 | 36 | 7 |
| 85 | 170 | 9 | 4.90e+11 | mythic | 33 / 3 | ×1.02 | 36 | 7 |
| 90 | 170 | 9 | 1.04e+8 | mythic | 34 / 3 | ×1.02 | 36 | 8 |

## Profil occasionnel (1 connexion par jour)

Premières raretés : mythic jour 6 · Renaissances : 4

| Jour | Étape | Monde | Puissance | Meilleure rareté | Bastion (niv. / âge) | ×Bastion | Recherches | Renaissances |
|---|---|---|---|---|---|---|---|---|
| 1 | 60 | 3 | 5.39e+5 | legendary | 2 / 1 | ×1.00 | 0 | 0 |
| 2 | 80 | 4 | 7.54e+6 | legendary | 3 / 1 | ×1.00 | 0 | 0 |
| 3 | 80 | 4 | 2.83e+7 | legendary | 3 / 1 | ×1.00 | 1 | 0 |
| 4 | 80 | 4 | 3.26e+8 | legendary | 5 / 1 | ×1.00 | 1 | 0 |
| 5 | 80 | 4 | 4.22e+8 | legendary | 6 / 1 | ×1.00 | 2 | 0 |
| 6 | 80 | 4 | 4.41e+8 | mythic | 9 / 1 | ×1.00 | 4 | 0 |
| 7 | 80 | 4 | 4.55e+8 | legendary | 12 / 1 | ×1.00 | 4 | 0 |
| 10 | 120 | 6 | 8.44e+8 | legendary | 19 / 2 | ×1.00 | 9 | 0 |
| 15 | 120 | 6 | 3.77e+9 | legendary | 26 / 2 | ×1.00 | 14 | 0 |
| 20 | 120 | 6 | 8.84e+5 | mythic | 27 / 2 | ×1.00 | 19 | 1 |
| 25 | 120 | 6 | 1.59e+9 | mythic | 27 / 2 | ×1.00 | 21 | 1 |
| 30 | 120 | 6 | 1.35e+10 | mythic | 29 / 2 | ×1.00 | 26 | 1 |
| 35 | 130 | 7 | 2.27e+9 | mythic | 29 / 2 | ×1.00 | 33 | 2 |
| 40 | 150 | 8 | 1.24e+10 | mythic | 30 / 2 | ×1.02 | 37 | 2 |
| 45 | 150 | 8 | 2.40e+10 | mythic | 31 / 2 | ×1.02 | 37 | 2 |
| 50 | 150 | 8 | 3.58e+6 | mythic | 31 / 2 | ×1.02 | 38 | 3 |
| 55 | 150 | 8 | 2.01e+10 | mythic | 33 / 2 | ×1.02 | 42 | 3 |
| 60 | 155 | 8 | 5.39e+10 | mythic | 34 / 2 | ×1.02 | 42 | 3 |
| 65 | 155 | 8 | 6.71e+10 | mythic | 34 / 2 | ×1.02 | 42 | 3 |
| 70 | 155 | 8 | 9.80e+6 | mythic | 34 / 2 | ×1.02 | 42 | 4 |
| 75 | 155 | 8 | 4.61e+10 | mythic | 34 / 2 | ×1.02 | 47 | 4 |
| 80 | 155 | 8 | 9.50e+10 | mythic | 34 / 2 | ×1.02 | 48 | 4 |
| 85 | 159 | 8 | 1.81e+11 | mythic | 36 / 2 | ×1.02 | 48 | 4 |
| 90 | 160 | 8 | 2.89e+11 | mythic | 37 / 2 | ×1.02 | 50 | 4 |

## Profil actif (4 connexions par jour)

Premières raretés : mythic jour 4 · Renaissances : 16

| Jour | Étape | Monde | Puissance | Meilleure rareté | Bastion (niv. / âge) | ×Bastion | Recherches | Renaissances |
|---|---|---|---|---|---|---|---|---|
| 1 | 80 | 4 | 1.74e+7 | legendary | 5 / 1 | ×1.00 | 2 | 0 |
| 2 | 80 | 4 | 2.45e+8 | legendary | 14 / 1 | ×1.00 | 3 | 0 |
| 3 | 120 | 6 | 3.19e+8 | legendary | 18 / 2 | ×1.00 | 3 | 0 |
| 4 | 120 | 6 | 4.69e+8 | mythic | 20 / 2 | ×1.00 | 3 | 0 |
| 5 | 120 | 6 | 9.11e+8 | mythic | 21 / 2 | ×1.00 | 3 | 0 |
| 6 | 120 | 6 | 3.93e+5 | mythic | 21 / 2 | ×1.00 | 3 | 1 |
| 7 | 120 | 6 | 7.41e+6 | legendary | 23 / 2 | ×1.00 | 3 | 1 |
| 10 | 120 | 6 | 1.99e+9 | legendary | 24 / 2 | ×1.00 | 4 | 1 |
| 15 | 148 | 8 | 5.69e+9 | mythic | 25 / 2 | ×1.00 | 5 | 2 |
| 20 | 150 | 8 | 3.17e+7 | mythic | 26 / 2 | ×1.00 | 6 | 3 |
| 25 | 150 | 8 | 4.34e+7 | mythic | 27 / 2 | ×1.00 | 6 | 4 |
| 30 | 150 | 8 | 7.61e+6 | mythic | 27 / 2 | ×1.02 | 7 | 5 |
| 35 | 150 | 8 | 2.93e+10 | mythic | 27 / 2 | ×1.02 | 9 | 6 |
| 40 | 155 | 8 | 3.15e+10 | mythic | 27 / 2 | ×1.02 | 10 | 7 |
| 45 | 155 | 8 | 1.46e+11 | mythic | 27 / 2 | ×1.02 | 11 | 8 |
| 50 | 162 | 9 | 5.33e+11 | mythic | 28 / 3 | ×1.02 | 12 | 9 |
| 55 | 180 | 9 | 2.73e+12 | mythic | 28 / 3 | ×1.02 | 12 | 9 |
| 60 | 180 | 9 | 9.96e+11 | mythic | 28 / 3 | ×1.02 | 15 | 10 |
| 65 | 180 | 9 | 3.68e+12 | mythic | 28 / 3 | ×1.02 | 15 | 10 |
| 70 | 180 | 9 | 4.65e+7 | mythic | 30 / 3 | ×1.02 | 17 | 12 |
| 75 | 190 | 10 | 1.35e+13 | mythic | 31 / 3 | ×1.02 | 18 | 12 |
| 80 | 190 | 10 | 4.88e+8 | mythic | 31 / 3 | ×1.02 | 18 | 14 |
| 85 | 190 | 10 | 4.60e+13 | mythic | 31 / 3 | ×1.02 | 18 | 15 |
| 90 | 195 | 10 | 2.44e+14 | mythic | 31 / 3 | ×1.02 | 18 | 16 |
