# Équipement v9.1.3 — doc3, lot 1 « base propre »

Bilan du lot 1 du brief équipement (doc3), adapté au code actuel (SAVE_VERSION 8, essences fondues dans les éclats,
mannequins fondus dans le Coffre, `fusionKeep` déjà en place). Mesures : `tools/measure-equipement-v913.mjs`
(moteur réel en Node, graine fixe), sur les sauvegardes de `tools/measure-v913.mjs --dump-saves`.
Tests : `tests/v913-equipement.test.js` (un test à graine fixe par source de butin).

## Ce qui change

| Point | Avant | Maintenant |
|---|---|---|
| 1. Sac plein (butin libre) | tout en or, sans éclats, même un Légendaire | ancestral (et verrouillé) au coffre, sinon en attente ; pièce d'ensemble utile au coffre s'il a de la place ; le reste recyclé complètement (or + éclats) |
| 1. Objet payé ou gagné (Forge, donjon, coffre, marchand, Prime, fusion, classe) | recyclé en or si le sac est plein | sac → coffre → en attente dans « À récupérer » (type `held`, jamais rogné au chargement, impossible à jeter) |
| 1. Coffre et marchand | refusés sac plein | acceptés si le coffre a de la place ; refusés seulement sac **et** coffre pleins (rien n'est payé) |
| 1. `store` | copie locale dans museum.js, 300 en dur | `storeItem` exportée (core/stash.js), `BALANCE.loot.stashSize` unique |
| 2. Garde de la meilleure pièce (coffre) | recyclait l'ancienne même verrouillée ; ignorait la classe | ancienne gardée si verrouillée ou renforcée ; arme d'une autre classe ni gardée ni comptée ; « Porter » ne prend que des pièces portables (point 6) |
| 3. `itemPower` | valeur brute des effets (Collier +2 % écrase Pendentif +0,5 %) | valeur / valeur de base × 4 (un effet de base 2 garde son ancien score) ; testé : Musée, fusion (ordre), pièces utiles, garde |
| 4. « Garder si tel effet » | ignoré par le balayage et la fusion auto | `keptByAffix` partagé : règle, balayage, `fusionKeep` (fusion à la main et auto) |
| 5. Changement de classe | ancestral poussé sans place puis rogné au chargement ; arme neuve sans effets ni renforcements ; `{ ...weapon, baseId }` gardait les stats de l'ancienne base | ancestral rangé sans perte ; arme reforgée : mêmes rareté, niveau, effets, renforcements, verrou, stats de la nouvelle base, la plus puissante des armes de la classe ; un sac de plus de 100 objets n'est plus rogné (surplus au coffre, `migrateBagOverflow`, sans montée de SAVE_VERSION) |
| 7. `reforgeItem` | renforcements d'effets invisibles jusqu'au recalcul | `refreshItemStats` aussitôt |
| 8. Musée | remplacement à la puissance (un Épique chassait un Légendaire) | rareté d'abord, puis puissance (`museumBetter`) |
| 9. Chemins de butin | Codex et garde liés au ramassage seulement | `intake` commun (Codex, Musée, garde) pour tout objet reçu ; la Prime ne passe plus par `collectItem` (plus jamais recyclée) |
| 10. Verrou et Forge | sac + équipement | aussi le coffre |
| Faille d'or | recyclage au niveau de l'objet | au min(niveau, étape max de la partie en cours) |

## Faille d'or : plafond retenu

`min(niveau de l'objet, maxStage)` (`BALANCE.loot.recycleLevelCap = 'maxStage'`), pas `records.bestStage` :
un objet ne dépasse jamais le record (le butin tombe au niveau de l'étape, le réaffûtage monte à `maxStage`), donc
`min(niveau, bestStage)` vaut toujours le niveau et ne corrigerait rien. `maxStage` retombe à 1 à la Renaissance :
les vieux objets rendent l'or de l'étape où l'on rejoue, comme le butin du moment. Le recyclage normal (objets de
l'étape en cours ou en dessous) est inchangé, mesuré ci-dessous. L'affichage (fiche, recyclage en lot) suit le même plafond.

## Mesures

### 1. Faille d'or après Renaissance

Épique niveau 200 : 4.40e7 or sans plafond ; plafonné à l'étape 5 : 96 or.

| Sauvegarde | Étape max → reprise | Objets recyclables | Or avant (sans plafond) | Or après (plafond) | Farm 1 h à la reprise | Avant / 1 h de farm | Après / 1 h de farm |
|---|---|---|---|---|---|---|---|
| milieu | 130 → 1 | 74 | 1.96e7 | 13 220 | 19 260 | ×1 015 | ×0,7 |
| fin | 494 → 1 | 172 | 3.87e16 | 38 880 | 4.48e6 | ×8.62e9 | ×8.7e-3 |

Recyclage normal (Rare de l'étape 494, sauvegarde de fin) : 9.24e15 avant, 9.24e15 après (identique).

### 2. Bilan des éclats (1 h de jeu actif, essences fondues : 1 essence = 10 éclats)

| Sauvegarde | Total / h | Recyclage au ramassage et sac plein | Balayage du sac | Boss, événements, autres | Fusions auto / h |
|---|---|---|---|---|---|
| debut | 1 989 | 1 619 | 0 | 370 | 0 |
| milieu | 1 007 | 962 | 0 | 45 | 0 |
| fin | 4 026 | 1 736 | 0 | 2 290 | 0 |

Dépenses (prix actuels, data/balance.js `forge`) et nombre d'actions payées par une heure d'éclats :

| Dépense | Éclats | debut | milieu | fin |
|---|---|---|---|---|
| Fabriquer (Rare ou mieux) | 25 | 79,6 | 40,3 | 161 |
| Fabriquer (Épique ou mieux) | 120 | 16,6 | 8,4 | 33,6 |
| Relancer les effets | 20 | 99,5 | 50,4 | 201 |
| Renforcer (1er niveau / 10e) | 2 / 20 | 181 | 91,5 | 366 (moy.) |
| Réaffûter (par niveau, Rare → Légendaire) | 4 → 10 | — | — | — |

### 3. Part de l'équipement dans la puissance

Sans équipement = 7 emplacements vides (ensembles compris) ; le Musée reste (il n'est pas porté). L'ancien outil retirait aussi le Musée.
« Part (log) » : part de l'équipement dans le multiplicateur total des dégâts/s depuis le héros nu de niveau 1 sans rien.

| Sauvegarde | Étape | Dégâts/s avec / sans | Ancien calcul (sans Musée) | PV avec / sans | Part (log) dégâts/s |
|---|---|---|---|---|---|
| debut | 45 | ×1,6 | ×1,6 | ×5,2 | 5,7 % |
| milieu | 130 | ×5,9 | ×5,9 | ×79,2 | 12,1 % |
| fin | 494 | ×1 542 | ×3 624 | ×27 417 | 17,7 % |

### 4. 24 h simulées sac plein (sauvegarde « milieu »)

| Source payée | Objets reçus |
|---|---|
| donjon | 24 |
| Prime | 2 |
| événement | 24 |
| fusion | 8 |
| classe (arme portée avant) | 24 |

| Sortie d'un objet payé ou verrouillé | Objets |
|---|---|
| fusion (choix du joueur) | 2 |

**Pertes : 0.** Fin : sac 100/100, coffre 300/300, en attente 22.

### Remarques sur les mesures

- **×532 (×523 dans le tableau) de docs/mesures-v913.md était faux** : l'ancien calcul retirait aussi le Musée du
  héros « nu » (le Musée n'est pas porté). Sur les sauvegardes d'avant ce lot, le calcul corrigé donne ×275 au lieu de ×523 ;
  sur les nouvelles, ×1 542 au lieu de ×3 624. `tools/measure-v913.mjs` est corrigé et docs/mesures-v913.md régénéré.
  Le rapport reste énorme en fin de partie parce que les dégâts d'une arme croissent en 1,03^niveau et s'additionnent aux
  dégâts de base du héros ; la « part (log) » (17,7 % du multiplicateur total en fin de partie) le remet à l'échelle.
- Les sauvegardes régénérées n'atteignent pas les mêmes étapes qu'avant (début 45 au lieu de 60, fin 494 au lieu de 370) :
  le joueur automatique diverge dès qu'un tirage change (les deux versions sont identiques jusqu'à 15 min, puis un mur de
  boss passe ou non). Sur 5 autres graines à 30 min : 71/71, 60/60, 59/52, 55/55, 54/54 (nouvelle / ancienne) : pas d'écart systématique.
- Éclats : la source principale reste le recyclage (80 à 95 % en début et milieu de partie) ; en fin de partie les boss
  (essences versées en éclats) en donnent autant. Une heure d'éclats paie 8 à 34 fabrications Épiques : les prix de la
  Forge ne sont pas un frein, à revoir au lot 3 (relance orientée) plutôt qu'ici.

## Prix provisoires (data/balance.js)

Lot 1 n'ajoute aucun prix. Regroupés dans `BALANCE` : `loot.stashSize` (300), `loot.recycleLevelCap` ('maxStage'),
`materials.shards` (recyclage 1 / 3 / 18 / 50), `forge` (fabriquer 25 éclats + 25 kills d'or, Épique 120 + 60, relancer 20,
réaffûter 2 × niveaux × facteur de rareté, renforcer 2 × n éclats + 6 × n kills d'or, fusion 5 pour 1). Provisoires jusqu'aux lots 2 et 3.

## Décisions

| Sujet | Décision |
|---|---|
| Faille d'or après Renaissance | non voulue : plafond `maxStage` (ci-dessus) |
| Butin hors ligne | donne aussi des pièces d'ensemble du monde farmé (comme le combat) |
| Équipement automatique pendant le farm | non : « Équiper le meilleur » reste à la demande |
| Coffre plein | jamais de perte : l'objet attend dans « À récupérer » ; coffre et marchand sont refusés tant qu'il n'y a pas de place |
| Garde de la meilleure pièce | seul recyclage automatique d'un objet payé permis (réglage du coffre), jamais d'une pièce verrouillée ou renforcée |
| Pièce utile, sac **et** coffre pleins (butin libre) | recyclée (seuls ancestraux et verrouillés attendent) : la boîte ne grossit pas sans fin |

## Écarts entre le brief et le code (signalés, pas forcés)

- `store` n'était plus dans core/stash.js (refonte du coffre) : seule la copie du Musée existait, remplacée par `storeItem`.
- Point 2 : les mannequins n'existent plus ; appliqué à la garde reconstruite au coffre (`autoStashSet`, `wearSet`).
- Point 7 : `refreshItemStats` seul ne suffisait pas (la valeur d'origine `base` de l'ancien effet restait) : elle est remise à zéro à la relance.
- Point 5 : « jamais de perte de puissance » ne peut pas être garanti au chiffre près entre deux modèles (vitesse et dégâts
  différents) : l'arme garde rareté, niveau, effets et renforcements, et la plus puissante des armes de la classe est retenue.

# Lot 2 « fusion à pourcentage »

Règles du doc3 appliquées telles quelles (`BALANCE.forge.fusion`, core/forge.js). Mesures :
`tools/measure-fusion-v913.mjs` (moteur réel, graine fixe ; l'« avant » lancé sur le commit 5376985). Tests :
`tests/v913-fusion.test.js`.

| Point | Maintenant |
|---|---|
| Commun, Rare | 5 pour 1, sûr, un appui (inchangé) |
| Épique → Légendaire | 5 = 100 % ; tenter à 4 (65 %) ou 3 (30 %) ; échec : l'objet de plus haut niveau reste dans le sac (jamais retiré), les autres perdus, jauge +20 |
| Jauge | `fusionPity["emplacement|rareté"]`, bornée 0–100 au chargement, sans expiration, gardée à la Renaissance, remise à 0 après une réussite à 3 ou 4 (pas à 5, déjà à 100 % sans elle) ; sans montée de SAVE_VERSION |
| Garanties | mise de 3 : 30/50/70/90/100 (5 essais au plus) ; mise de 4 : 65/85/100 (3 essais au plus) — testées avec un tirage toujours perdant |
| « Fusionner tout », fusion auto | mise de 5 et 100 % de base seulement, `fusionKeep` sans inclusion |
| `fusionKeep` | unique (groupes, écran, main.js, fusion auto) ; toujours exclus : verrouillés, ancestraux ; protégés : renforcés, meilleurs que l'équipé (`isUpgrade`), pièces d'ensemble utiles, effets gardés, objets d'un build ; à la main : raison affichée + « Inclure » d'un appui (le groupe seulement, retombe après la fusion) |
| Ordre de consommation | armes non portables, puis niveau croissant |
| Résultat | niveau du meilleur objet ; arme : 70 % de modèles de la classe (règle du butin) |
| Technique | `fuseItems` → `null` (impossible) ou `{ ok, item, returned, lost, chance }` ; `fusionGroups(keep)` : `bag`, `usable`, `protected`, `auto`, seuil d'écran = plus petite mise (3 Épique, 5 sinon) ; `fuse` retiré de `REPEATABLE` ; fusions à la main comptées pour la mission dans main.js ; listes de raretés en dur remplacées (autoFuse dans state.js, puces de la fusion auto, `RARITY_FACTOR` → `BALANCE.forge.sharpenRarityFactor`) |

Écran (téléphone 375×812) : « Fusionner tout · N groupes » (deux appuis), Commun/Rare en une ligne avec « Fusionner »,
Épique replié ; un appui l'ouvre : « Jauge +N · 1 objet protégé (renforcé) [Inclure] », « Si échec : 1 objet rendu,
jauge +20 » (absent si toutes les mises affichées sont à 100 %), un bouton par mise, aucune présélectionnée. Message
d'échec dans le fil et dans l'écran : « Échec (65 %) : 3 objets perdus, Hache de guerre rendue, jauge Arme +20 ».

## Mesures

Légendaires (armes) pour 1 000 objets ramassés, fusion auto de toutes les raretés (3 graines × 100 000 objets) :

| | Par la fusion | dont portables | Tombés directement (portables) | **Total portables** |
|---|---|---|---|---|
| Avant (modèle au hasard) | 7,71 | 0,76 | 1,93 | **2,69** |
| Après (70 % de la classe) | 7,69 | 5,67 | 1,89 | **7,56** |

×2,81 (le doc annonçait 2,77 → 7,65, ×2,76) : vrai changement d'équilibrage, conforme.

Épique → Légendaire selon la mise (100 000 Légendaires, jauge comprise) :

| Mise | Épiques / Légendaire | Communs / Légendaire | Essais max | Pire cas (Épiques consommés) |
|---|---|---|---|---|
| 5 | 5,00 | 125 | 1 | 5 |
| 4 | 5,21 | 130 | 3 | 10 |
| 3 | 5,32 | 133 | 5 | 11 |

Boucle fusion → recyclage (or et éclats rendus par le recyclage du résultat ÷ recyclage direct des objets consommés) :

| Fusion | Mise | Niv. 200 : or | éclats | Après Renaissance (plafond étape 1) : or | éclats |
|---|---|---|---|---|---|
| Commun | 5 | 0,92 | 0,60 | 0,80 | 0,60 |
| Rare | 5 | 0,92 | 1,20 | 0,80 | 1,20 |
| Épique | 5 | 0,86 | 0,56 | 0,75 | 0,56 |
| Épique | 4 | 0,82 | 0,57 | 0,74 | 0,57 |
| Épique | 3 | 0,81 | 0,61 | 0,75 | 0,61 |

Aucune boucle ne rapporte d'or : fusionner puis recycler rend toujours moins d'or que recycler directement, avant
comme après Renaissance. Seule exception en éclats : 5 Rares (15 éclats) → 1 Épique (18), +3 éclats par fusion,
déjà vrai avant ce lot (Rare 5 pour 1 inchangé) et payé par 5 objets : signalé, pas modifié.

# Lot 3 « des choix sur les stats »

Tests : `tests/v913-lot3.test.js`. Prix dans `BALANCE.forge` (data/balance.js), provisoires.

| Point | Maintenant |
|---|---|
| Relance orientée | Épique et Légendaire (pas les ancestraux). Fiche › Améliorer : liste de l'effet voulu, « Relancer vers » puis « Confirmer » (2e appui, 4 s). La 1re ligne d'effet tirée (après l'effet principal d'un accessoire) devient l'effet choisi, valeur ±20 % comme le butin ; sur Légendaire la 2e ligne reste au hasard. `dropChance` jamais proposé ni accepté. Action `target-reroll`, hors `REPEATABLE` (testé). |
| Prix (éclats seuls, 1 essence = 10 éclats) | arme/casque/armure Épique **100**, accessoire Épique **140**, Légendaire **60** / **80** (`forge.targetReroll`). Relance au hasard gardée à **20** (10 éclats + 1 essence, déjà converti à la fusion des monnaies, `forge.reforgeShards`). |
| Monde de la Prime | Liste dans la carte de la Prime (tant qu'elle n'est pas récupérée) : mondes atteints selon `records.bestStage` (pas `maxStage`, qui retombe à 1 à la Renaissance). Le monstre devient un monstre du monde choisi ; les victoires déjà comptées sont gardées (`start` peut devenir négatif, gardé au chargement). Champ `zone` déjà sauvegardé : pas de migration. |
| Renforcement ciblé | **Non implémenté** : le test ci-dessous montre qu'une même règle gagne partout (voir conclusion). Signalé au développeur. |

## Renforcement ciblé : le test d'abord

`tools/measure-renfort-v913.mjs` : Légendaires au niveau de l'étape max, 3 tirages d'effets par modèle, toutes les
répartitions de 10 renforcements (hors `dropChance`), score d'`isUpgrade` (core/inventory.js : log dégâts/s + log
robustesse) sur le héros des sauvegardes « milieu » et « fin ». Plafond du doc : 4 lignes ou plus → 5 par ligne.
Pourcentages : gain de score (dégâts/s × robustesse) par rapport à l'objet sans renforcement.

| Sauvegarde | Objet (effets) | Lignes | Meilleure sans plafond | Meilleure avec plafond | 2e avec plafond (écart) | Au hasard (moy.) |
|---|---|---|---|---|---|---|
| milieu | Dague (dégâts contre les boss, vol de vie) | 4 | 10 dégâts (72,9 %) | 5 dégâts + 5 vitesse (41,5 %) | 5 dégâts + 4 vitesse + 1 dégâts contre les boss (−0,6 %) | 20,0 % |
| milieu | Dague (dégâts contre les ennemis, vol de vie) | 4 | 10 dégâts (72,9 %) | 5 dégâts + 5 vitesse (41,5 %) | 5 dégâts + 4 vitesse + 1 dégâts contre les ennemis (−0,6 %) | 20,0 % |
| milieu | Dague (dégâts contre les ennemis, or) | 4 | 10 dégâts (72,9 %) | 5 dégâts + 5 vitesse (41,5 %) | 5 dégâts + 4 vitesse + 1 dégâts contre les ennemis (−0,6 %) | 20,0 % |
| milieu | Massue (dégâts contre les boss, vol de vie) | 4 | 10 dégâts (94,0 %) | 5 dégâts + 5 PV (64,1 %) | 5 dégâts + 4 PV + 1 dégâts contre les boss (−2,1 %) | 29,9 % |
| milieu | Massue (dégâts contre les ennemis, vol de vie) | 4 | 10 dégâts (94,0 %) | 5 dégâts + 5 PV (64,1 %) | 5 dégâts + 4 PV + 1 dégâts contre les ennemis (−2,1 %) | 29,9 % |
| milieu | Massue (dégâts contre les ennemis, or) | 4 | 10 dégâts (94,0 %) | 5 dégâts + 5 PV (64,1 %) | 5 dégâts + 4 PV + 1 dégâts contre les ennemis (−2,1 %) | 29,9 % |
| milieu | Cuirasse (régénération, or) | 4 | 2 PV + 8 armure (79,4 %) | 5 PV + 5 armure (69,9 %) | 4 PV + 5 armure + 1 régénération (−4,8 %) | 30,1 % |
| milieu | Cuirasse (chance de butin, or) | 3 | 2 PV + 8 armure (79,4 %) | 5 PV + 5 armure (69,9 %) | 4 PV + 5 armure + 1 or (−4,8 %) | 42,4 % |
| milieu | Cuirasse (chance de butin, dégâts contre les ennemis) | 3 | 2 PV + 8 armure (79,4 %) | 5 PV + 5 armure (69,9 %) | 4 PV + 5 armure + 1 dégâts contre les ennemis (−4,8 %) | 42,4 % |
| milieu | Collier (coup critique, dégâts contre les ennemis, or) | 3 | aucune ligne ne compte (0,0 %) | aucune ligne ne compte (0,0 %) | aucune ligne ne compte (−0,0 %) | 0,0 % |
| milieu | Collier (coup critique, chance de butin, or) | 2 | aucune ligne ne compte (0,0 %) | aucune ligne ne compte (0,0 %) | aucune ligne ne compte (−0,0 %) | 0,0 % |
| milieu | Collier (coup critique, chance de butin, dégâts contre les boss) | 2 | aucune ligne ne compte (0,0 %) | aucune ligne ne compte (0,0 %) | aucune ligne ne compte (−0,0 %) | 0,0 % |
| fin | Dague (dégâts contre les boss, vol de vie) | 4 | 10 dégâts (120,0 %) | 5 dégâts + 5 vitesse (60,0 %) | 5 dégâts + 4 vitesse + 1 dégâts contre les boss (−0,0 %) | 29,0 % |
| fin | Dague (dégâts contre les ennemis, vol de vie) | 4 | 10 dégâts (120,0 %) | 5 dégâts + 5 vitesse (60,0 %) | 5 dégâts + 4 vitesse + 1 dégâts contre les ennemis (−0,0 %) | 29,0 % |
| fin | Dague (dégâts contre les ennemis, or) | 4 | 10 dégâts (120,0 %) | 5 dégâts + 5 vitesse (60,0 %) | 5 dégâts + 4 vitesse + 1 dégâts contre les ennemis (−0,0 %) | 29,0 % |
| fin | Massue (dégâts contre les boss, vol de vie) | 4 | 5 dégâts + 5 PV (153,1 %) | 5 dégâts + 5 PV (153,1 %) | 5 dégâts + 4 PV + 1 dégâts contre les boss (−7,9 %) | 64,9 % |
| fin | Massue (dégâts contre les ennemis, vol de vie) | 4 | 5 dégâts + 5 PV (153,1 %) | 5 dégâts + 5 PV (153,1 %) | 5 dégâts + 4 PV + 1 dégâts contre les ennemis (−7,9 %) | 64,9 % |
| fin | Massue (dégâts contre les ennemis, or) | 4 | 5 dégâts + 5 PV (153,1 %) | 5 dégâts + 5 PV (153,1 %) | 5 dégâts + 4 PV + 1 dégâts contre les ennemis (−7,9 %) | 64,9 % |
| fin | Cuirasse (régénération, or) | 4 | 10 PV (119,4 %) | 5 PV + 5 armure (104,5 %) | 5 PV + 4 armure + 1 régénération (−5,6 %) | 44,8 % |
| fin | Cuirasse (chance de butin, or) | 3 | 10 PV (119,4 %) | 5 PV + 5 armure (104,5 %) | 5 PV + 4 armure + 1 or (−5,6 %) | 63,2 % |
| fin | Cuirasse (chance de butin, dégâts contre les ennemis) | 3 | 10 PV (119,4 %) | 5 PV + 5 armure (104,5 %) | 5 PV + 4 armure + 1 dégâts contre les ennemis (−5,6 %) | 63,2 % |
| fin | Collier (coup critique, dégâts contre les ennemis, or) | 3 | aucune ligne ne compte (0,0 %) | aucune ligne ne compte (0,0 %) | aucune ligne ne compte (−0,0 %) | 0,0 % |
| fin | Collier (coup critique, chance de butin, or) | 2 | aucune ligne ne compte (0,0 %) | aucune ligne ne compte (0,0 %) | aucune ligne ne compte (−0,0 %) | 0,0 % |
| fin | Collier (coup critique, chance de butin, dégâts contre les boss) | 2 | aucune ligne ne compte (0,0 %) | aucune ligne ne compte (0,0 %) | aucune ligne ne compte (−0,0 %) | 0,0 % |

**Conclusion : la même répartition gagne partout.** Avec le plafond, le meilleur choix est toujours « 5 + 5 sur les
deux statistiques de base » (dégâts + vitesse, dégâts + PV, PV + armure), aucun effet spécial, quels que soient les
effets tirés ; le 2e choix ne s'en écarte que d'un palier. Sur le Collier, aucune ligne ne compte pour ce score
(critique déjà au plafond, les autres effets hors du score). Ce n'est pas une décision, c'est un bonus (×2 environ
sur le gain du « au hasard » : 41 % contre 20 %, 153 % contre 65 %) : **non implémenté**, à trancher par le développeur
(par exemple si les effets spéciaux comptaient dans un score d'activité : boss, farm, or).

# Lot 4 « lisibilité de l'écran Équipement »

Chaque point du doc vérifié sur l'écran actuel (téléphone 375×812, sauvegarde de milieu de partie et la même en mode
débutant = aucun boss vaincu, comme Améliorations). Captures avant/après : `/tmp/claude-0/-home-user-idleproject/dd35360c-d79d-5fd7-bdfc-2303b86f9079/scratchpad/v913/lot4/avant` et `/tmp/claude-0/-home-user-idleproject/dd35360c-d79d-5fd7-bdfc-2303b86f9079/scratchpad/v913/lot4/apres`
(`mid-bag`, `mid-sheet`, `mid-stash`, `mid-forge`, `beg-bag`, `beg-sheet`).

| Point du doc | État trouvé | Fait dans ce lot |
|---|---|---|
| Fiche en onglets Comparer/Améliorer/Ranger, feuille du bas | déjà fait (chantier 2) | — |
| Comparaison et Équiper visibles sans défiler | vérifié : Équiper finit à 515 px, la comparaison à 694 px, barre du bas à 754 px | — |
| 7 cases portées, ligne Sac/Coffre/Forge, grille 5 colonnes, Builds repliés | déjà fait | — |
| Réglages du sac en 3 replis, recyclage en 3 entrées | déjà fait (chantier 2) | — |
| Rangement du mannequin en double | sans objet : mannequins fondus dans le Coffre | — |
| Ligne type des listes (image ≥ 20 px, nom, un chiffre, bouton avec prix) | lignes de fusion : icône 16 px ; filtre 18 px | icônes à 20 px ; les lignes de fusion gardent un seul chiffre (« N dans le sac ») et le bouton (la fusion n'a pas de prix) |
| Une image à un seul sens, pas d'emoji quand un sprite existe | « 🎯 Prime du jour » à côté du portrait du monstre | 🎯 retiré (le portrait suffit) ; ✦/✕/✔ sont des signes de texte, gardés |
| Icône seule : aria-label + mot visible en débutant | aria-label partout ; aucun mot en débutant | classe `beginner` sur la racine : mot sous les icônes du filtre (Armes, Casques, Armures, Bijoux), « Verrou » à côté du cadenas, « Forge » sur le bouton enclume, « Renommer » à côté de ✎ |

Action courante sur téléphone : équiper = 2 appuis (case, Équiper) ; relance orientée = liste + 2 appuis ; fusion sûre = 1 appui (« Fusionner tout » : 2) ; Prime : 1 choix dans la liste.

# Lot 5 « ensembles avec un rôle »

Seuls les chiffres de `data/sets.js` changent. Mesure : `tools/measure-sets-v913.mjs` (moteur réel, 900 s de
combat par ensemble porté à 6 pièces sur l'étape de farm la plus haute que le héros sans ensemble tient ; mêmes
objets, seul le champ `set` change ; indices, 100 = sans ensemble). Builds : sauvegardes « milieu » et « fin »
(Chevalier), et « fin » passée en Archer. « Équilibre » = dégâts/s × robustesse (le score d'`isUpgrade`).
Tests : `tests/v913-lot3.test.js` (lot 5).

| Ensemble | Avant | Maintenant | Rôle |
|---|---|---|---|
| Panoplie du Pré | 2 : PV +15 % · 4 : or +30 % · 6 : dégâts ×1,3 | 6 : **XP +100 %** | niveaux au farm (XP/s ×2 en milieu de partie, ×1,67 en fin) |
| Parure du Chasseur | 2 : dégâts ordinaires +20 % · 4 : vitesse +10 % · 6 : dégâts ×1,35 | 2 : **+40 %** · 4 : **vitesse +15 %** · 6 : **dégâts ordinaires +120 %** | ennemis ordinaires et vitesse (dégâts/s ordinaires ×2,04 / ×1,74, victoires ×1,30 quand le héros ne tue pas d'un coup) |
| Éclat du Néant | 6 : dégâts et PV ×1,5 | 6 : **×1,6 / ×1,6** | équilibre (ne gagne plus seulement contre le Cristal en fin de partie) |
| Autres | inchangés | inchangés | Désert : or ; Cristal : robustesse ; Linceul, Volcan : boss |

## Avant

### milieu (étape max 130, farm à l'étape 125)

| Ensemble (6 pièces) | Or/s | XP/s | Victoires/s | Objets/s | Dégâts/s ordinaires | Boss (dégâts/s) | Robustesse | Équilibre | Meilleur en |
|---|---|---|---|---|---|---|---|---|---|
| Sans ensemble | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | — |
| Panoplie du Pré | 125 | 105 | 105 | 105 | 130 | 130 | 112 | 146 | — |
| Parure du Chasseur | 106 | 106 | 106 | 106 | 155 | 138 | 100 | 138 | — |
| Armure de cristal | 100 | 100 | 100 | 100 | 100 | 100 | 184 | 184 | robustesse |
| Atours du désert | 186 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | or |
| Harnois du givre | 100 | 100 | 100 | 100 | 100 | 100 | 174 | 174 | — |
| Linceul maudit | 107 | 108 | 108 | 108 | 145 | 168 | 100 | 145 | — |
| Cuir des marais | 100 | 100 | 100 | 100 | 100 | 100 | 155 | 155 | — |
| Plumage céleste | 107 | 107 | 107 | 107 | 158 | 158 | 100 | 158 | — |
| Forge du volcan | 111 | 112 | 112 | 112 | 203 | 245 | 100 | 203 | XP, victoires, butin, ordinaires, boss |
| Éclat du Néant | 107 | 107 | 107 | 107 | 150 | 150 | 150 | 225 | équilibre |

### fin (étape max 494, farm à l'étape 489)

| Ensemble (6 pièces) | Or/s | XP/s | Victoires/s | Objets/s | Dégâts/s ordinaires | Boss (dégâts/s) | Robustesse | Équilibre | Meilleur en |
|---|---|---|---|---|---|---|---|---|---|
| Sans ensemble | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | — |
| Panoplie du Pré | 126 | 101 | 101 | 114 | 113 | 113 | 111 | 125 | butin |
| Parure du Chasseur | 100 | 101 | 101 | 114 | 126 | 115 | 100 | 115 | — |
| Armure de cristal | 100 | 100 | 100 | 100 | 100 | 100 | 150 | 150 | robustesse, équilibre |
| Atours du désert | 152 | 100 | 100 | 102 | 100 | 100 | 100 | 100 | or |
| Harnois du givre | 100 | 100 | 100 | 100 | 100 | 100 | 139 | 139 | — |
| Linceul maudit | 100 | 101 | 101 | 114 | 119 | 135 | 100 | 119 | butin |
| Cuir des marais | 100 | 100 | 100 | 100 | 100 | 100 | 123 | 123 | — |
| Plumage céleste | 100 | 101 | 101 | 114 | 123 | 123 | 100 | 123 | butin |
| Forge du volcan | 100 | 101 | 101 | 114 | 144 | 170 | 100 | 144 | ordinaires, boss |
| Éclat du Néant | 101 | 101 | 101 | 102 | 121 | 121 | 121 | 147 | XP, victoires |

### fin, Archer (étape max 494, farm à l'étape 454)

| Ensemble (6 pièces) | Or/s | XP/s | Victoires/s | Objets/s | Dégâts/s ordinaires | Boss (dégâts/s) | Robustesse | Équilibre | Meilleur en |
|---|---|---|---|---|---|---|---|---|---|
| Sans ensemble (fini à 453) | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | — |
| Panoplie du Pré (fini à 453) | 141 | 109 | 109 | 110 | 113 | 113 | 113 | 127 | — |
| Parure du Chasseur (fini à 452) | 112 | 112 | 112 | 106 | 126 | 115 | 100 | 115 | — |
| Armure de cristal (fini à 453) | 100 | 100 | 100 | 100 | 100 | 100 | 156 | 156 | robustesse, équilibre |
| Atours du désert (fini à 452) | 151 | 100 | 100 | 102 | 100 | 100 | 100 | 100 | or |
| Harnois du givre (fini à 453) | 100 | 100 | 100 | 100 | 100 | 100 | 142 | 142 | — |
| Linceul maudit (fini à 452) | 112 | 112 | 112 | 116 | 119 | 135 | 100 | 119 | butin |
| Cuir des marais (fini à 453) | 100 | 100 | 100 | 100 | 100 | 100 | 123 | 123 | — |
| Plumage céleste | 123 | 111 | 111 | 111 | 123 | 123 | 100 | 123 | — |
| Forge du volcan (fini à 453) | 125 | 122 | 122 | 115 | 146 | 171 | 100 | 146 | XP, victoires, ordinaires, boss |
| Éclat du Néant | 118 | 112 | 112 | 108 | 121 | 121 | 121 | 147 | — |

## Maintenant

### milieu (étape max 130, farm à l'étape 125)

| Ensemble (6 pièces) | Or/s | XP/s | Victoires/s | Objets/s | Dégâts/s ordinaires | Boss (dégâts/s) | Robustesse | Équilibre | Meilleur en |
|---|---|---|---|---|---|---|---|---|---|
| Sans ensemble | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | — |
| Panoplie du Pré | 120 | 200 | 100 | 100 | 100 | 100 | 112 | 112 | XP |
| Parure du Chasseur | 99 | 100 | 100 | 100 | 204 | 103 | 100 | 103 | ordinaires |
| Armure de cristal | 100 | 100 | 100 | 100 | 100 | 100 | 184 | 184 | robustesse |
| Atours du désert | 186 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | or |
| Harnois du givre | 100 | 100 | 100 | 100 | 100 | 100 | 174 | 174 | — |
| Linceul maudit | 107 | 108 | 108 | 108 | 145 | 168 | 100 | 145 | — |
| Cuir des marais | 100 | 100 | 100 | 100 | 100 | 100 | 155 | 155 | — |
| Plumage céleste | 107 | 107 | 107 | 107 | 158 | 158 | 100 | 158 | — |
| Forge du volcan | 111 | 112 | 112 | 112 | 203 | 245 | 100 | 203 | victoires, butin, boss |
| Éclat du Néant | 107 | 108 | 108 | 108 | 160 | 160 | 160 | 256 | équilibre |

### fin (étape max 494, farm à l'étape 489)

| Ensemble (6 pièces) | Or/s | XP/s | Victoires/s | Objets/s | Dégâts/s ordinaires | Boss (dégâts/s) | Robustesse | Équilibre | Meilleur en |
|---|---|---|---|---|---|---|---|---|---|
| Sans ensemble | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | — |
| Panoplie du Pré | 126 | 167 | 100 | 100 | 100 | 100 | 111 | 111 | XP |
| Parure du Chasseur | 100 | 101 | 101 | 114 | 174 | 100 | 100 | 100 | victoires, butin, ordinaires |
| Armure de cristal | 100 | 100 | 100 | 100 | 100 | 100 | 150 | 150 | robustesse |
| Atours du désert | 152 | 100 | 100 | 102 | 100 | 100 | 100 | 100 | or |
| Harnois du givre | 100 | 100 | 100 | 100 | 100 | 100 | 139 | 139 | — |
| Linceul maudit | 100 | 101 | 101 | 114 | 119 | 135 | 100 | 119 | butin |
| Cuir des marais | 100 | 100 | 100 | 100 | 100 | 100 | 123 | 123 | — |
| Plumage céleste | 100 | 101 | 101 | 114 | 123 | 123 | 100 | 123 | butin |
| Forge du volcan | 100 | 101 | 101 | 114 | 144 | 170 | 100 | 144 | victoires, boss |
| Éclat du Néant | 105 | 101 | 101 | 104 | 126 | 126 | 126 | 158 | équilibre |

### fin, Archer (étape max 494, farm à l'étape 454)

| Ensemble (6 pièces) | Or/s | XP/s | Victoires/s | Objets/s | Dégâts/s ordinaires | Boss (dégâts/s) | Robustesse | Équilibre | Meilleur en |
|---|---|---|---|---|---|---|---|---|---|
| Sans ensemble (fini à 453) | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | — |
| Panoplie du Pré (fini à 453) | 128 | 167 | 100 | 96 | 100 | 100 | 113 | 113 | XP |
| Parure du Chasseur (fini à 453) | 132 | 130 | 130 | 126 | 174 | 100 | 100 | 100 | victoires, butin, ordinaires |
| Armure de cristal (fini à 453) | 100 | 100 | 100 | 100 | 100 | 100 | 156 | 156 | robustesse |
| Atours du désert (fini à 452) | 151 | 100 | 100 | 102 | 100 | 100 | 100 | 100 | or |
| Harnois du givre (fini à 453) | 100 | 100 | 100 | 100 | 100 | 100 | 142 | 142 | — |
| Linceul maudit (fini à 452) | 112 | 112 | 112 | 116 | 119 | 135 | 100 | 119 | — |
| Cuir des marais (fini à 453) | 100 | 100 | 100 | 100 | 100 | 100 | 123 | 123 | — |
| Plumage céleste | 123 | 111 | 111 | 111 | 123 | 123 | 100 | 123 | — |
| Forge du volcan (fini à 453) | 125 | 122 | 122 | 115 | 146 | 171 | 100 | 146 | boss |
| Éclat du Néant (fini à 453) | 120 | 114 | 114 | 112 | 126 | 126 | 126 | 158 | équilibre |

**Volcan contre Néant** : avant, le Volcan était le meilleur en XP, victoires, butin, dégâts ordinaires et boss sur
deux builds sur trois, et le Néant ne gagnait l'équilibre qu'en milieu de partie (le Cristal le battait en fin, critique
du Néant déjà au plafond). Maintenant le Volcan garde le boss (et, en milieu de partie seulement, victoires et objets +12 %), le Néant
gagne l'équilibre sur les trois builds, le Chasseur les dégâts ordinaires, le Pré l'XP, le Désert l'or.
**Aucun ensemble n'est le meilleur partout.** Limites : victoires et objets/s plafonnent quand le héros tue d'un coup
(fin de partie, Chevalier) ; Givre (armure sous 30 % PV) et Marais (régénération, épines) ont des effets que l'outil
ne mesure pas, ils perdent la robustesse brute face au Cristal (inchangé, signalé) ; objets/s est bruité (±5 %).

## Héritage d'ensemble en fusion (option, faite)

Après une **réussite** seulement, le résultat appartient à l'ensemble choisi avec la chance min(pièces × 20, 40) %
(pièces = objets de cet ensemble parmi les objets consommés ; `BALANCE.forge.fusionSetInherit`). Écran de fusion :
« Ensemble hérité : [Pré · 40 %] [Aucun] » quand le groupe contient des pièces (un appui ; par défaut l'ensemble le
plus présent). « Fusionner tout » et la fusion auto prennent ce défaut. Garanties du lot 2 intactes : chances,
jauge, mises et protection (`fusionKeep`, dont les pièces d'ensemble utiles) ne changent pas, le tirage d'héritage
a lieu après le résultat et seulement s'il y a des pièces (les tests du lot 2 passent sans retouche).

# Critères de fin (doc3)

- [x] Aucune perte d'objet payé ou verrouillé sur 24 h simulées, sac plein compris (lot 1, mesure 4 : 0 perte).
- [x] Un test à graine fixe par source de butin (`tests/v913-equipement.test.js`).
- [x] Fusion : 3 essais à 4 objets ou 5 essais à 3 objets aboutissent toujours (`tests/v913-fusion.test.js`, tirage toujours perdant).
- [x] « Fusionner tout » et la fusion auto ne font jamais de tentative risquée et ne consomment aucun objet protégé (lot 2).
- [x] Aucune boucle fusion, recyclage ou Renaissance ne rapporte d'or anormal (lot 1 faille d'or, lot 2 boucles).
- [x] Une action courante tient en un ou deux appuis sur téléphone (375 × 812), sans rien de coupé : équiper 2 (case,
  Équiper ; comparaison et Équiper visibles sans défiler), fusion sûre 1 (« Fusionner tout » 2), relance orientée
  liste + 2, monde de la Prime 1 choix, héritage 1 appui (captures lot 4 et lot 5).
- [x] Tout le texte nouveau est traduit (`src/i18n/en-910.js`, vérifié avec `translate`), et les anciennes sauvegardes
  se chargent sans perte : aucune montée de SAVE_VERSION dans les lots 3 à 5 (Prime : champ `zone` existant, départ
  négatif gardé ; héritage : champ `set` existant), migrations v8 testées (`tests/v913-migrations.test.js`).
- [x] Le bilan des matériaux et les prix retenus sont livrés au développeur (lot 1 bilan des éclats ; prix : `BALANCE.forge`, lot 3).
- [ ] Test final avec 3 ou 4 vrais joueurs (viser un ensemble, relancer un effet, tenter une fusion) : **non fait**, à organiser par le développeur.
