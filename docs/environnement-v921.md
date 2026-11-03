# Malus d'environnement (v9.2.1)

Dans chaque monde sauf le premier, le lieu gêne le héros : **un seul malus par monde**, chiffré, plus fort de 25 % par
cycle de difficulté au-delà du premier (×2 au plus). Chaque malus est **contré par une amélioration à l'or existante**
dont l'effet y répond logiquement : il baisse en proportion du niveau de cette amélioration et disparaît à son
« niveau complet » (`fullAt`) :

    part contrée = min(100 %, niveau / fullAt)        malus = base × cycle × (1 − part contrée)

Aucune nouvelle amélioration, aucune nouvelle clé de sauvegarde (SAVE_VERSION inchangé). Données :
`src/data/environment.js` ; moteur : `src/core/environment.js` (fonctions pures) appliqué dans `step`
(`src/core/combat.js`), donc aussi hors ligne et dans la prévision de boss. S'applique en campagne, dans les donjons et le
défi de la semaine du monde concerné (valeur du cycle 1 hors campagne) ; ni dans la Tour ni dans le mode monde (règles
propres, score reproductible). Une stat « en moins » ne perd jamais plus de 90 %. La brûlure ne tue jamais seule
(elle s'arrête à 1 PV). La fiche du héros (`computeHeroStats`) reste la valeur hors environnement ; le combat utilise
la valeur sous malus (`world.heroStats`).

## Tableau

| Monde | Malus | Effet (cycle 1, sans contre) | Contré par | Complet au niveau |
|---|---|---|---|---|
| 1 Plaines verdoyantes | — | — | — | — |
| 2 Forêt sombre | Pénombre | 25 % des coups du héros manquent | Coup critique (trouver la faille) | 30 |
| 3 Grottes de cristal | Éclats de cristal | +45 % de dégâts reçus | Armure | 35 |
| 4 Désert brûlant | Soif | −90 % de régénération | Régénération PV | 40 |
| 5 Montagnes gelées | Froid mordant | −40 % de PV max | Points de vie | 110 |
| 6 Terres maudites | Malédiction | −30 % de dégâts | Dégâts | 160 |
| 7 Marais putride | Boue | −35 % de vitesse d'attaque | Vitesse d'attaque | 160 |
| 8 Îles célestes | Rafales | −90 % de chance de critique | Dégâts critiques | 100 |
| 9 Cœur du volcan | Lave | 5 % des PV max perdus par seconde | Régénération PV | 40 |
| 10 Royaume du Néant | Distorsion | −45 % de dégâts contre les boss | Tueur de boss | 100 |
| 11 Royaume englouti | Pression | −40 % de PV max | Points de vie | 260 |
| 12 Trône de l'Abysse | Corruption | −60 % de puissance des compagnons | Lien des compagnons | 100 |

Les `fullAt` sont réglés à ~1,5–2× le niveau qu'a naturellement le joueur simulé en arrivant dans le monde : à
l'arrivée le malus est en général à moitié contré, il faut quelques niveaux de plus pour l'annuler.

## Interface

- Entrée dans un monde : bannière du monde puis, dans le fil, « Environnement : Lave — vous perdez 3 % de vos PV max par
  seconde · contré par Régénération PV (40 %) ».
- Combat : pastille en bas à gauche de la scène (icône du malus, « contré 40 % », vert à 100 %), infobulle complète,
  appui = Carte.
- Carte : la fiche du monde choisi (au cycle choisi) donne la même ligne.
- Améliorations : la ligne qui contre le malus du monde actuel porte « contre Lave » (information neutre ; infobulle :
  part contrée et niveau complet). Aucun « recommandé ».
- Aide « ? » des Améliorations et de la Carte ; Collections : repli « Environnements des mondes » (mondes atteints).
- Anglais et coréen : `src/i18n/en-921.js`, `src/i18n/ko-921.js`.

## Mesure (tools/measure-env-v921.mjs)

Moteur réel, même joueur automatique que tools/measure-v920.mjs, partie neuve avec Renaissance automatique, 3 h
simulées. *sans* = malus retirés (rythme v9.2.0) ; *avec* = malus actifs, le joueur n'achète jamais l'amélioration qui
contre le malus du monde où il est ; *contre* = malus actifs, le joueur consacre jusqu'à 30 % de son or au contre.

| Monde | Malus | Contre | Niveau du contre à l'arrivée (sans) | Temps dans le monde sans | avec | écart | contre | écart |
|---|---|---|---|---|---|---|---|---|
| 2 | Pénombre | Coup critique (complet niv. 30) | 0 | 9 min 00 s | 9 min 45 s | +8 % | 9 min 40 s | +7 % |
| 3 | Éclats de cristal | Armure (complet niv. 35) | 11 | 8 min 45 s | 9 min 15 s | +6 % | 9 min 00 s | +3 % |
| 4 | Soif | Régénération PV (complet niv. 40) | 24 | 7 min 30 s | 8 min 15 s | +10 % | 8 min 10 s | +9 % |
| 5 | Froid mordant | Points de vie (complet niv. 110) | 59 | 7 min 30 s | 8 min 00 s | +7 % | 7 min 30 s | +0 % |
| 6 | Malédiction | Dégâts (complet niv. 160) | 86 | 6 min 45 s | 7 min 45 s | +15 % | 6 min 55 s | +2 % |
| 7 | Boue | Vitesse d'attaque (complet niv. 160) | 89 | 7 min 00 s | 7 min 20 s | +5 % | 7 min 25 s | +6 % |
| 8 | Rafales | Dégâts critiques (complet niv. 100) | 52 | 7 min 05 s | 7 min 40 s | +8 % | 7 min 30 s | +6 % |
| 9 | Lave | Régénération PV (complet niv. 40) | 40 | 7 min 35 s | 7 min 35 s | +0 % | 7 min 10 s | -5 % |
| 10 | Distorsion | Tueur de boss (complet niv. 100) | 58 | 7 min 35 s | 8 min 30 s | +12 % | 8 min 20 s | +10 % |
| 11 | Pression | Points de vie (complet niv. 260) | 154 | 6 min 45 s | 7 min 55 s | +17 % | 7 min 05 s | +5 % |
| 12 | Corruption | Lien des compagnons (complet niv. 100) | 75 | — | — | — | — | — |
Étape max en fin de partie : sans 241, avec 240, contre 241. Arrivées (h) : {"sans":[0,0.1,0.3,0.4,0.6,0.7,0.8,0.9,1,1.2,1.3,1.4],"avec":[0,0.1,0.3,0.4,0.6,0.7,0.8,1,1.1,1.2,1.4,1.5],"contre":[0,0.1,0.3,0.4,0.6,0.7,0.8,0.9,1.1,1.2,1.3,1.4]}

Lecture : sans investir dans le contre, chaque monde prend en moyenne ~+9 % de temps (de 0 à +17 % ; Malédiction,
Distorsion, Pression et Soif sont les plus sensibles), en deçà ou en bas de la cible +10–25 % ; en y investissant, on
revient près du rythme actuel (moyenne ~+4 %, l'or mis dans le contre manque aux dégâts). La Lave est déjà contrée à
l'arrivée pour ce joueur (Régénération au plafond 40 vers le monde 9). Le monde 12 (10 étapes, puis cycle 2) n'est pas
mesuré séparément. Ce joueur automatique progresse vite (monde 12 en ~1,4 h) : les écarts relatifs comptent plus que les
durées. Si le développeur veut s'approcher de +15–20 %, monter les `base` de ~1,5× suffit (une ligne par monde).
