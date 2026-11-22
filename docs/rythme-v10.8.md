# Rythme v10.8 (simulation, 90 jours, graine 1)

Produit par `node tools/sim-rythme.mjs`. Vrai moteur, 20 min par connexion, gains hors ligne entre les connexions, Bastion géré avec 30 % de l'or, Renaissance dès qu'elle est rentable.

## Fenêtres visées

| Contrôle | Résultat | |
|---|---|---|
| monde 7 entre les jours 25 et 40 (régulier) | jour 32 | ✔ |
| monde 12 entre les jours 90 et 120 (régulier) | jour > 90 | ✔ |
| 1re Renaissance entre les jours 15 et 30 (régulier) | jour 18 | ✔ |
| 1er Mythique vers la semaine 3 (jours 14 à 28) | jour 14 | ✔ |

## Profil regulier (2 connexions par jour)

Premières raretés : mythic jour 14 · Renaissances : 4

| Jour | Étape | Monde | Puissance | Meilleure rareté | Bastion (niv. / âge) | ×Bastion | Recherches | Renaissances |
|---|---|---|---|---|---|---|---|---|
| 1 | 80 | 4 | 5.93e+6 | legendary | 3 / 1 | ×1.00 | 0 | 0 |
| 2 | 80 | 4 | 9.92e+7 | legendary | 6 / 1 | ×1.00 | 1 | 0 |
| 3 | 80 | 4 | 2.40e+8 | legendary | 11 / 1 | ×1.00 | 4 | 0 |
| 4 | 100 | 5 | 2.49e+8 | legendary | 15 / 1 | ×1.00 | 5 | 0 |
| 5 | 120 | 6 | 3.14e+8 | legendary | 19 / 2 | ×1.00 | 6 | 0 |
| 6 | 120 | 6 | 6.22e+8 | legendary | 20 / 2 | ×1.00 | 6 | 0 |
| 7 | 120 | 6 | 1.01e+9 | legendary | 22 / 2 | ×1.02 | 7 | 0 |
| 10 | 120 | 6 | 2.15e+9 | legendary | 26 / 2 | ×1.02 | 12 | 0 |
| 15 | 120 | 6 | 4.26e+9 | legendary | 31 / 2 | ×1.02 | 20 | 0 |
| 20 | 120 | 6 | 8.55e+8 | mythic | 33 / 2 | ×1.02 | 24 | 1 |
| 25 | 120 | 6 | 7.22e+9 | mythic | 34 / 2 | ×1.02 | 30 | 1 |
| 30 | 120 | 6 | 1.20e+10 | mythic | 35 / 2 | ×1.02 | 30 | 1 |
| 35 | 130 | 7 | 1.22e+9 | mythic | 37 / 2 | ×1.02 | 30 | 2 |
| 40 | 140 | 7 | 4.79e+9 | mythic | 37 / 2 | ×1.02 | 30 | 2 |
| 45 | 140 | 7 | 5.97e+9 | mythic | 37 / 2 | ×1.02 | 30 | 2 |
| 50 | 140 | 7 | 2.73e+6 | mythic | 37 / 2 | ×1.02 | 30 | 3 |
| 55 | 140 | 7 | 6.30e+9 | mythic | 37 / 2 | ×1.02 | 30 | 3 |
| 60 | 146 | 8 | 1.25e+10 | mythic | 37 / 2 | ×1.02 | 30 | 3 |
| 65 | 150 | 8 | 2.03e+10 | mythic | 37 / 2 | ×1.02 | 30 | 3 |
| 70 | 150 | 8 | 2.07e+10 | mythic | 37 / 2 | ×1.02 | 30 | 3 |
| 75 | 150 | 8 | 4.46e+6 | mythic | 37 / 2 | ×1.02 | 30 | 4 |
| 80 | 150 | 8 | 9.29e+9 | mythic | 37 / 2 | ×1.02 | 30 | 4 |
| 85 | 150 | 8 | 2.83e+10 | mythic | 37 / 2 | ×1.02 | 30 | 4 |
| 90 | 150 | 8 | 2.91e+10 | mythic | 37 / 2 | ×1.02 | 30 | 4 |

## Profil occasionnel (1 connexion par jour)

Premières raretés : mythic jour 12 · Renaissances : 2

| Jour | Étape | Monde | Puissance | Meilleure rareté | Bastion (niv. / âge) | ×Bastion | Recherches | Renaissances |
|---|---|---|---|---|---|---|---|---|
| 1 | 60 | 3 | 5.39e+5 | legendary | 2 / 1 | ×1.00 | 0 | 0 |
| 2 | 80 | 4 | 7.54e+6 | legendary | 3 / 1 | ×1.00 | 0 | 0 |
| 3 | 80 | 4 | 2.83e+7 | legendary | 3 / 1 | ×1.00 | 1 | 0 |
| 4 | 80 | 4 | 3.26e+8 | legendary | 5 / 1 | ×1.00 | 1 | 0 |
| 5 | 80 | 4 | 4.22e+8 | legendary | 6 / 1 | ×1.00 | 2 | 0 |
| 6 | 80 | 4 | 4.42e+8 | legendary | 9 / 1 | ×1.00 | 4 | 0 |
| 7 | 80 | 4 | 4.55e+8 | legendary | 12 / 1 | ×1.00 | 4 | 0 |
| 10 | 120 | 6 | 8.12e+8 | legendary | 20 / 2 | ×1.00 | 9 | 0 |
| 15 | 120 | 6 | 2.95e+9 | legendary | 23 / 2 | ×1.00 | 17 | 0 |
| 20 | 120 | 6 | 6.48e+9 | mythic | 28 / 2 | ×1.02 | 22 | 0 |
| 25 | 120 | 6 | 1.07e+10 | mythic | 32 / 2 | ×1.02 | 24 | 0 |
| 30 | 120 | 6 | 1.26e+10 | mythic | 33 / 2 | ×1.02 | 29 | 0 |
| 35 | 120 | 6 | 1.28e+6 | mythic | 36 / 2 | ×1.02 | 32 | 1 |
| 40 | 120 | 6 | 3.59e+9 | mythic | 37 / 2 | ×1.02 | 32 | 1 |
| 45 | 120 | 6 | 8.62e+9 | mythic | 37 / 2 | ×1.02 | 32 | 1 |
| 50 | 120 | 6 | 1.64e+10 | mythic | 37 / 2 | ×1.02 | 32 | 1 |
| 55 | 120 | 6 | 1.69e+10 | mythic | 37 / 2 | ×1.02 | 32 | 1 |
| 60 | 120 | 6 | 2.10e+10 | mythic | 38 / 2 | ×1.02 | 39 | 1 |
| 65 | 121 | 7 | 9.24e+8 | mythic | 38 / 2 | ×1.02 | 43 | 2 |
| 70 | 140 | 7 | 1.09e+10 | mythic | 38 / 2 | ×1.02 | 43 | 2 |
| 75 | 149 | 8 | 2.17e+10 | mythic | 38 / 2 | ×1.02 | 43 | 2 |
| 80 | 150 | 8 | 2.23e+10 | mythic | 38 / 2 | ×1.02 | 43 | 2 |
| 85 | 150 | 8 | 2.70e+10 | mythic | 38 / 2 | ×1.02 | 43 | 2 |
| 90 | 150 | 8 | 2.74e+10 | mythic | 38 / 2 | ×1.02 | 43 | 2 |

## Profil actif (4 connexions par jour)

Premières raretés : mythic jour 8 · Renaissances : 8

| Jour | Étape | Monde | Puissance | Meilleure rareté | Bastion (niv. / âge) | ×Bastion | Recherches | Renaissances |
|---|---|---|---|---|---|---|---|---|
| 1 | 80 | 4 | 1.74e+7 | legendary | 5 / 1 | ×1.00 | 2 | 0 |
| 2 | 80 | 4 | 2.44e+8 | legendary | 14 / 1 | ×1.00 | 3 | 0 |
| 3 | 120 | 6 | 3.47e+8 | legendary | 18 / 2 | ×1.00 | 3 | 0 |
| 4 | 120 | 6 | 4.90e+8 | legendary | 21 / 2 | ×1.00 | 3 | 0 |
| 5 | 120 | 6 | 7.25e+8 | legendary | 23 / 2 | ×1.00 | 3 | 0 |
| 6 | 120 | 6 | 1.20e+9 | legendary | 23 / 2 | ×1.00 | 3 | 0 |
| 7 | 120 | 6 | 2.04e+9 | legendary | 23 / 2 | ×1.00 | 3 | 0 |
| 10 | 120 | 6 | 1.11e+6 | mythic | 26 / 2 | ×1.00 | 6 | 1 |
| 15 | 120 | 6 | 4.42e+9 | mythic | 26 / 2 | ×1.00 | 6 | 1 |
| 20 | 134 | 7 | 1.93e+9 | mythic | 27 / 2 | ×1.00 | 6 | 2 |
| 25 | 140 | 7 | 5.66e+9 | mythic | 27 / 2 | ×1.00 | 6 | 2 |
| 30 | 140 | 7 | 5.64e+9 | mythic | 27 / 2 | ×1.00 | 6 | 3 |
| 35 | 140 | 7 | 8.54e+9 | mythic | 27 / 2 | ×1.00 | 6 | 3 |
| 40 | 150 | 8 | 3.19e+10 | mythic | 27 / 2 | ×1.00 | 6 | 3 |
| 45 | 150 | 8 | 1.01e+10 | mythic | 27 / 2 | ×1.00 | 6 | 4 |
| 50 | 150 | 8 | 1.60e+10 | mythic | 27 / 2 | ×1.00 | 6 | 4 |
| 55 | 150 | 8 | 1.24e+10 | mythic | 27 / 2 | ×1.00 | 6 | 5 |
| 60 | 155 | 8 | 6.76e+10 | mythic | 27 / 2 | ×1.00 | 6 | 5 |
| 65 | 155 | 8 | 7.14e+10 | mythic | 27 / 2 | ×1.00 | 6 | 5 |
| 70 | 155 | 8 | 9.75e+10 | mythic | 27 / 2 | ×1.02 | 7 | 6 |
| 75 | 160 | 8 | 1.43e+11 | mythic | 27 / 2 | ×1.02 | 7 | 6 |
| 80 | 160 | 8 | 2.33e+7 | mythic | 27 / 2 | ×1.02 | 8 | 7 |
| 85 | 160 | 8 | 2.13e+11 | mythic | 27 / 2 | ×1.02 | 9 | 7 |
| 90 | 160 | 8 | 6.61e+10 | mythic | 27 / 2 | ×1.02 | 11 | 8 |
