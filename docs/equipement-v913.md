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
