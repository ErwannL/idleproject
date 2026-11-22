# Rythme v10.8 (simulation, 90 jours, graine 1)

Produit par `node tools/sim-rythme.mjs`. Vrai moteur, 20 min par connexion, gains hors ligne entre les connexions, Bastion géré avec 30 % de l'or, Renaissance dès qu'elle est rentable.

## Fenêtres visées

| Contrôle | Résultat | |
|---|---|---|
| monde 7 entre les jours 25 et 40 (régulier) | jour 27 | ✔ |
| monde 12 entre les jours 90 et 120 (régulier) | jour > 90 | ✔ |
| 1re Renaissance entre les jours 15 et 30 (régulier) | jour 19 | ✔ |
| 1er Mythique vers la semaine 3 (jours 14 à 28) | jour 19 | ✔ |

## Profil regulier (2 connexions par jour)

Premières raretés : mythic jour 19 · Renaissances : 6

| Jour | Étape | Monde | Puissance | Meilleure rareté | Bastion (niv. / âge) | ×Bastion | Recherches | Renaissances |
|---|---|---|---|---|---|---|---|---|
| 1 | 80 | 4 | 5.93e+6 | legendary | 3 / 1 | ×1.00 | 0 | 0 |
| 2 | 80 | 4 | 9.92e+7 | legendary | 6 / 1 | ×1.00 | 1 | 0 |
| 3 | 80 | 4 | 2.40e+8 | legendary | 11 / 1 | ×1.00 | 4 | 0 |
| 4 | 80 | 4 | 2.58e+8 | legendary | 16 / 1 | ×1.00 | 5 | 0 |
| 5 | 80 | 4 | 3.11e+8 | legendary | 22 / 1 | ×1.00 | 5 | 0 |
| 6 | 120 | 6 | 5.99e+8 | legendary | 26 / 2 | ×2.40 | 6 | 0 |
| 7 | 120 | 6 | 9.07e+8 | legendary | 30 / 2 | ×2.75 | 6 | 0 |
| 10 | 120 | 6 | 5.40e+9 | legendary | 34 / 2 | ×3.21 | 12 | 0 |
| 15 | 120 | 6 | 7.11e+9 | legendary | 41 / 2 | ×4.06 | 21 | 0 |
| 20 | 120 | 6 | 3.68e+6 | mythic | 42 / 2 | ×4.20 | 22 | 1 |
| 25 | 120 | 6 | 9.29e+9 | mythic | 42 / 2 | ×4.20 | 22 | 1 |
| 30 | 140 | 7 | 3.85e+9 | mythic | 42 / 2 | ×4.20 | 27 | 2 |
| 35 | 150 | 8 | 1.16e+10 | mythic | 42 / 2 | ×4.20 | 27 | 2 |
| 40 | 150 | 8 | 8.69e+5 | mythic | 42 / 2 | ×4.20 | 27 | 3 |
| 45 | 150 | 8 | 1.46e+10 | mythic | 42 / 2 | ×4.20 | 28 | 3 |
| 50 | 152 | 8 | 2.88e+10 | mythic | 42 / 2 | ×4.20 | 28 | 3 |
| 55 | 155 | 8 | 4.70e+10 | mythic | 42 / 2 | ×4.20 | 28 | 3 |
| 60 | 155 | 8 | 2.86e+10 | mythic | 42 / 2 | ×4.20 | 30 | 4 |
| 65 | 155 | 8 | 7.15e+10 | mythic | 42 / 2 | ×4.20 | 30 | 4 |
| 70 | 155 | 8 | 2.51e+10 | mythic | 42 / 2 | ×4.20 | 30 | 5 |
| 75 | 155 | 8 | 9.85e+10 | mythic | 42 / 2 | ×4.20 | 30 | 5 |
| 80 | 160 | 8 | 1.43e+11 | mythic | 42 / 2 | ×4.20 | 30 | 5 |
| 85 | 160 | 8 | 2.33e+7 | mythic | 42 / 2 | ×4.20 | 30 | 6 |
| 90 | 160 | 8 | 1.06e+11 | mythic | 42 / 2 | ×4.20 | 30 | 6 |

## Profil occasionnel (1 connexion par jour)

Premières raretés : mythic jour 8 · Renaissances : 3

| Jour | Étape | Monde | Puissance | Meilleure rareté | Bastion (niv. / âge) | ×Bastion | Recherches | Renaissances |
|---|---|---|---|---|---|---|---|---|
| 1 | 60 | 3 | 5.39e+5 | legendary | 2 / 1 | ×1.00 | 0 | 0 |
| 2 | 80 | 4 | 7.54e+6 | legendary | 3 / 1 | ×1.00 | 0 | 0 |
| 3 | 80 | 4 | 2.83e+7 | legendary | 3 / 1 | ×1.00 | 1 | 0 |
| 4 | 80 | 4 | 3.26e+8 | legendary | 5 / 1 | ×1.00 | 1 | 0 |
| 5 | 80 | 4 | 4.22e+8 | legendary | 6 / 1 | ×1.00 | 2 | 0 |
| 6 | 80 | 4 | 4.42e+8 | legendary | 9 / 1 | ×1.00 | 4 | 0 |
| 7 | 80 | 4 | 4.56e+8 | legendary | 12 / 1 | ×1.00 | 4 | 0 |
| 10 | 80 | 4 | 6.73e+8 | mythic | 20 / 1 | ×1.00 | 9 | 0 |
| 15 | 120 | 6 | 2.56e+9 | mythic | 29 / 2 | ×2.66 | 16 | 0 |
| 20 | 120 | 6 | 8.34e+9 | mythic | 37 / 2 | ×3.48 | 24 | 0 |
| 25 | 120 | 6 | 1.55e+10 | mythic | 43 / 2 | ×4.26 | 31 | 0 |
| 30 | 120 | 6 | 1.91e+10 | mythic | 43 / 2 | ×4.26 | 42 | 0 |
| 35 | 120 | 6 | 2.40e+10 | mythic | 43 / 2 | ×4.35 | 52 | 0 |
| 40 | 120 | 6 | 1.47e+6 | mythic | 43 / 2 | ×4.35 | 60 | 1 |
| 45 | 120 | 6 | 1.26e+10 | mythic | 43 / 2 | ×4.35 | 66 | 1 |
| 50 | 120 | 6 | 2.51e+10 | mythic | 43 / 2 | ×4.35 | 74 | 1 |
| 55 | 121 | 7 | 4.07e+5 | mythic | 43 / 2 | ×4.35 | 85 | 2 |
| 60 | 140 | 7 | 6.12e+9 | mythic | 43 / 2 | ×4.35 | 89 | 2 |
| 65 | 150 | 8 | 2.01e+10 | mythic | 43 / 2 | ×4.35 | 89 | 2 |
| 70 | 150 | 8 | 3.95e+10 | mythic | 43 / 2 | ×4.35 | 89 | 2 |
| 75 | 154 | 8 | 4.77e+10 | mythic | 43 / 2 | ×4.35 | 89 | 2 |
| 80 | 155 | 8 | 4.89e+10 | mythic | 43 / 2 | ×4.35 | 89 | 2 |
| 85 | 155 | 8 | 5.90e+10 | mythic | 43 / 2 | ×4.35 | 89 | 2 |
| 90 | 155 | 8 | 4.34e+6 | mythic | 43 / 2 | ×4.35 | 89 | 3 |

## Profil actif (4 connexions par jour)

Premières raretés : mythic jour 11 · Renaissances : 13

| Jour | Étape | Monde | Puissance | Meilleure rareté | Bastion (niv. / âge) | ×Bastion | Recherches | Renaissances |
|---|---|---|---|---|---|---|---|---|
| 1 | 80 | 4 | 1.74e+7 | legendary | 5 / 1 | ×1.00 | 2 | 0 |
| 2 | 80 | 4 | 2.41e+8 | legendary | 15 / 1 | ×1.00 | 3 | 0 |
| 3 | 80 | 4 | 3.05e+8 | legendary | 22 / 1 | ×1.00 | 3 | 0 |
| 4 | 120 | 6 | 5.95e+8 | legendary | 26 / 2 | ×2.40 | 3 | 0 |
| 5 | 120 | 6 | 1.14e+9 | legendary | 32 / 2 | ×2.94 | 3 | 0 |
| 6 | 120 | 6 | 2.58e+9 | legendary | 35 / 2 | ×3.25 | 6 | 0 |
| 7 | 120 | 6 | 2.92e+9 | legendary | 39 / 2 | ×3.80 | 8 | 0 |
| 10 | 120 | 6 | 6.02e+9 | legendary | 42 / 2 | ×4.20 | 9 | 0 |
| 15 | 121 | 7 | 1.13e+6 | mythic | 42 / 2 | ×4.20 | 13 | 2 |
| 20 | 140 | 7 | 2.41e+6 | mythic | 42 / 2 | ×4.20 | 15 | 3 |
| 25 | 150 | 8 | 1.60e+10 | mythic | 42 / 2 | ×4.20 | 15 | 3 |
| 30 | 150 | 8 | 9.85e+8 | mythic | 42 / 2 | ×4.20 | 15 | 4 |
| 35 | 150 | 8 | 8.01e+5 | mythic | 42 / 2 | ×4.20 | 15 | 5 |
| 40 | 150 | 8 | 5.51e+10 | mythic | 42 / 2 | ×4.20 | 15 | 5 |
| 45 | 155 | 8 | 1.51e+10 | mythic | 42 / 2 | ×4.20 | 15 | 6 |
| 50 | 155 | 8 | 1.50e+6 | mythic | 42 / 2 | ×4.20 | 15 | 7 |
| 55 | 155 | 8 | 1.42e+11 | mythic | 42 / 2 | ×4.20 | 15 | 7 |
| 60 | 160 | 8 | 2.33e+11 | mythic | 42 / 2 | ×4.20 | 16 | 8 |
| 65 | 160 | 8 | 2.59e+11 | mythic | 42 / 2 | ×4.20 | 17 | 9 |
| 70 | 170 | 9 | 8.53e+11 | mythic | 42 / 3 | ×4.20 | 17 | 9 |
| 75 | 170 | 9 | 9.17e+11 | mythic | 44 / 3 | ×4.50 | 18 | 10 |
| 80 | 170 | 9 | 1.14e+12 | mythic | 47 / 3 | ×4.97 | 18 | 11 |
| 85 | 170 | 9 | 2.81e+12 | mythic | 50 / 3 | ×5.50 | 18 | 12 |
| 90 | 175 | 9 | 1.26e+12 | mythic | 52 / 3 | ×5.89 | 18 | 13 |
