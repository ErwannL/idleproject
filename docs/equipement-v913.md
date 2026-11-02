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
