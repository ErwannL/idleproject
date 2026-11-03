# Améliorations à l'or v9.2.0 : de 7 à 13 lignes

Demande : « ajoute des améliorations, genre la vie, la régénération, etc. ; j'en veux un total entre 10 et 15 ».
Résultat : **13 améliorations** (7 anciennes + 6 nouvelles). Aucun « recommandé », aucun achat automatique.

## Les 13 lignes

| Catégorie | Amélioration | Effet par niveau | Plafond | Coût (base × croissance^niveau) | Ouverture |
|---|---|---|---|---|---|
| Combat | Dégâts | +3 dégâts, paliers ×1,35 / 10 niv. et ×1,75 / 25 niv. | — | 10 × 1,13^n | dès le début |
| Combat | Vitesse d'attaque | −3 % d'intervalle | — | 25 × 1,15^n | dès le début |
| Combat | Coup critique | +1 % de chance | 50 | 100 × 1,25^n | 1er boss |
| Combat | **Dégâts critiques** | +2 % au multiplicateur critique (×2 → ×4) | 100 | 150 × 1,28^n | étape 15 |
| Combat | **Tueur de boss** | +1 % de dégâts du héros contre les boss (facteur à part) | 100 | 300 × 1,28^n | étape 50 |
| Combat | **Lien des compagnons** | +3 % de puissance des compétences des compagnons (coups, soins, cris) | 100 | 250 × 1,26^n | étape 30 |
| Survie | Points de vie | +20 PV, paliers ×1,4 / 10 niv. et ×1,75 / 25 niv. | — | 15 × 1,13^n | dès le début |
| Survie | Armure | +1 % de réduction | 40 | 50 × 1,22^n | 1er boss |
| Survie | Régénération PV | +0,2 %/s des PV max, **paliers ×1,1 / 10 niv.** (nouveau) | 40 | 40 × 1,2^n | 1er boss |
| Survie | **Vol de vie** | +0,1 % des dégâts infligés rendus en PV | 30 | 120 × 1,5^n | étape 20 |
| Survie | **Esquive** | +0,5 % de chance d'esquiver un coup (moitié contre les boss) | 40 (20 %) | 200 × 1,45^n | étape 40 |
| Ressources | Butin d'or | +5 % d'or, ×1,5 / 25 niv. | 100 | 80 × 1,12^n | 1er boss |
| Ressources | **Savoir** | +3 % d'XP | 50 | 200 × 1,4^n | étape 60 |

### Pourquoi celles-ci

- **Dégâts critiques** : donne enfin un deuxième axe au critique (chance ≠ puissance) ; c'est la seule nouvelle ligne
  qui compte dans « +x % dégâts/s » (tri « rentabilité » neutre), et elle ne vaut rien sans Coup critique : un vrai choix.
- **Tueur de boss** : les boss sont le mur de la progression ; la ligne aide à passer un mur sans accélérer le farm
  des monstres (dégâts/s neutres inchangés). Facteur séparé, en plus des « dégâts contre les boss » des talents/objets.
- **Lien des compagnons** : seule façon de renforcer l'équipe avec l'or (les compagnons ne montaient qu'avec gemmes et
  doublons) ; inutile sans compagnons équipés.
- **Vol de vie** et **Esquive** : survie différente de PV/Armure/Régénération — le vol de vie suit les dégâts infligés,
  l'esquive évite le coup entier (moitié contre les boss pour ne pas annuler la rage).
- **Savoir** : l'XP (niveau du héros, +dégâts/PV par niveau) n'avait aucune ligne à l'or.
- Écartés : gains hors ligne (déjà des pouvoirs et talents, et un % hors ligne pousse à ne plus jouer), puissance des
  compétences/recharge (déjà les points de compétence et `skillCooldownPct` des talents), épines (effet faible face aux
  boss qui frappent rarement), dégâts contre les ordinaires (doublon du farm de Dégâts).

### Déblocage progressif

Débutant (aucun boss vaincu) : Dégâts, Vitesse, PV seulement. Après le premier mini-boss : Critique, Armure,
Régénération, Or. Les six nouvelles s'ouvrent à leur **étape record** (`records.bestStage`, jamais perdue à la
Renaissance) : 15, 20, 30, 40, 50, 60. Une ligne déjà achetée reste visible. À l'ouverture, un message
« Nouvelle amélioration : X » s'affiche ; le panneau montre « Prochain : X à l'étape N » (texte neutre).

### Moteur

- `core/stats.js` : `critMultiplier`, `lifesteal` (+ part achetée), `dodgePct` (≤ 20), `bossDamagePct`,
  `companionPowerPct`, `xpPct` (+ part achetée) ; niveaux bornés par `maxLevel` même sur une sauvegarde trafiquée ;
  paliers de la Régénération.
- `core/combat.js` : multiplicateur critique et facteur boss dans `heroDamage` (attaque, compétences, Lame fantôme),
  puissance des compagnons dans `castCompanion`, esquive au moment du coup ennemi (événement `heroDodge`, aucun tirage
  si la ligne n'est pas achetée : parties existantes inchangées), vol de vie déjà géré par `hitEnemy`.
- Hors ligne et prévision du boss passent par le même `step()` : les effets s'y appliquent sans code à part.
- Renaissance : toutes les clés de `state.upgrades` sont remises à la part de Mémoire du guerrier (code existant).
- Sauvegardes : `sanitizeState` parcourt les clés de `createNewState` → nouvelles clés à 0 sur une ancienne
  sauvegarde, niveaux au-delà du plafond ramenés au plafond. Pas de nouvelle version de sauvegarde.

## Mesures (`node tools/measure-v920.mjs`)

Moteur réel en Node, horloge et hasard fixes. Joueur automatique (absent du jeu) qui répartit : 30 % de l'or sur les
lignes hors dégâts/s (la moins chère d'abord), le reste au meilleur gain de dégâts/s. « v9.1.9 » ne voit que les 7
anciennes lignes, « v9.2.0 » les 13 ; seule la présence des nouvelles lignes change. Mesures prises avec le monde
sous-marin de la v9.2.0 en place.

### Effet de chaque nouvelle ligne à 10 / 50 / 100

Sauvegarde de milieu (4 h 30 de jeu, étape max 327, niveau 101) avec Chat et Hibou équipés (niveau 10). Boss 315 :
le plus haut boss battu sans la ligne (temps de victoire). Boss 320 : le boss qui bloque (PV restants après 90 s).
Survie : 5 min sur l'étape max. XP : 10 min pour Savoir, 5 min sinon.

| Amélioration | Niveau | Valeur | Boss 315 | Boss 320 | Dégâts reçus 5 min | Morts | XP |
|---|---|---|---|---|---|---|---|
| (aucune) | 0 | — | 63 s | 33,6 % | 7,6e10 | 0 | 1,35e10 |
| Dégâts critiques | 10 | ×2,2 (dégâts/s +8,6 %) | 58,3 s | 28,2 % | 8,3e10 | 0 | 1,42e10 |
| Dégâts critiques | 50 | ×3 (dégâts/s +43 %) | 46,2 s | 6,6 % | 7,1e10 | 0 | 1,83e10 |
| Dégâts critiques | 100 | ×4 (dégâts/s +86 %) | 35,4 s | **battu** en 75,9 s | 6,6e10 | 0 | 2,42e10 |
| Vol de vie | 10 / 30 | +1 % / +3 % | 63 s | 33,6 % | 7,6e10 | 0 | 1,35e10 |
| Lien des compagnons | 10 | +30 % | 61 s | 31,5 % | 7,7e10 | 0 | 1,35e10 |
| Lien des compagnons | 50 | +150 % | 54,3 s | 23,2 % | 7,5e10 | 0 | 1,35e10 |
| Lien des compagnons | 100 | +300 % | 49,4 s | 12,9 % | 7,2e10 | 0 | 1,66e10 |
| Esquive | 10 | 5 % (boss 2,5 %) | 62 s | 32,3 % | 7,1e10 (−6 %) | 0 | 1,49e10 |
| Esquive | 40 | 20 % (boss 10 %) | 62 s | 32,3 % | 6,0e10 (−21 %) | 0 | 1,52e10 |
| Tueur de boss | 10 | +10 % | 57,6 s | 27,1 % | 7,6e10 | 0 | 1,35e10 |
| Tueur de boss | 50 | +50 % | 43,5 s | 1,1 % | 7,6e10 | 0 | 1,35e10 |
| Tueur de boss | 100 | +100 % | 33,5 s | **battu** en 69,9 s | 7,6e10 | 0 | 1,35e10 |
| Savoir | 10 | +30 % (+68,7 % avec les autres sources) | 63 s | 33,6 % | — | 0 | +20 % (10 min) |
| Savoir | 50 | +150 % (+188,7 %) | 63 s | 33,6 % | — | 0 | +108 % (10 min) |

Lecture : à ce stade le héros ne meurt pas sur l'étape max (la Régénération remonte tout) : Vol de vie et Esquive n'y
changent rien de visible ; ils comptent face aux boss qui tuent (Esquive −21 % de dégâts reçus au plafond). Seules
Dégâts critiques et Tueur de boss, au plafond, font passer le boss qui bloque — elles coûtent alors ~8e12 or
(150 × 1,28^100), autant qu'environ 230 niveaux de Dégâts.

### Retour à l'étape max après une Renaissance, et début de partie

Sauvegarde de fin : 3 Renaissances, étape max 399 (même sauvegarde pour les deux joueurs).

| Joueur | Étape cible | Temps de retour |
|---|---|---|
| v9.1.9 (7 lignes) | 399 | 2 h 08 |
| v9.2.0 (13 lignes) | 399 | 2 h 06 (−2 %) |

Partie neuve, 2 h de jeu : v9.1.9 étape 285, v9.2.0 étape 310 (+9 %).

La progression ne devient pas triviale : le gain vient surtout du début (Dégâts critiques et Lien des compagnons
ouverts tôt). Un premier réglage (croissance 1,14, Tueur de boss +2 %/niv., Dégâts critiques +3 % multiplicatif)
donnait étape 364 contre 120 pour un joueur qui n'achetait que les dégâts : les courbes ont été durcies (1,26 à 1,5)
et les effets réduits avant cette mesure.

## Tests

`tests/v920-upgrades.test.js` : 13 lignes rangées et ordonnées, coûts géométriques et plafonds (achat simple et
groupé), effet de chaque ligne sur les statistiques et bornes (sauvegarde trafiquée), paliers de Régénération,
esquive / Tueur de boss / vol de vie appliqués par le moteur (combat réel à graine fixe), déblocage progressif,
anciennes sauvegardes (clés à 0, plafonds), Renaissance, traductions anglaises et coréennes.
