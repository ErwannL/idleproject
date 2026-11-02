# Refontes v9.1.3 (lots E et F) : décisions, chiffres, critères d'abandon

Une seule montée de `SAVE_VERSION` (7 → 8) pour toute la v9.1.3. Chaque refonte a sa conversion dans
`src/core/migrations-v913.js`, indépendante, idempotente, testée seule dans `tests/v913-migrations.test.js`, puis dans
la migration complète sur deux sauvegardes de référence (`tests/helpers/v913-saves.js`) : une partie de milieu au format 7
et une partie de fin (étape 370, 13 Renaissances, sac, coffre, mannequins, Musée et boîte pleins, objets verrouillés et
renforcés dans chaque conteneur). Test commun : aucun objet perdu, verrou et renforts gardés.

**Retour arrière général.** Au premier chargement d'une sauvegarde au format 7, le jeu en garde une copie brute
(`save.js keepPreMigrationCopy`, clé `…-pre-v7`). Revenir en arrière = republier la 9.1.2 et restaurer cette copie.
Après plusieurs jours de jeu, la copie est périmée : chaque refonte ci-dessous dit aussi comment l'annuler « en avant »
(une 9.1.4 qui reconvertit).

## Cloud : une partie migrée ne peut pas être écrasée

- Jeu 9.1.3 : `syncOnce(..., maxSaveVersion)` renvoie `newer` pour une partie distante d'un format plus récent ; le jeu
  bloque alors sauvegarde et envoi (fait au chantier 1).
- Serveur (fait ici) : `checkSave` refuse (422) une sauvegarde dont le format est plus ancien que celui déjà stocké
  (`saveFormat`). Un jeu 9.1.2, qui n'a pas le blocage `newer`, ne peut donc plus écraser une partie au format 8 : son
  envoi est refusé et il garde sa partie locale. Test : `tests/cloud-save.test.js` (« un jeu 9.1.2 … ne peut pas écraser »).
- **Risque restant.** (1) Le serveur doit être déployé avant (ou avec) la 9.1.3 : sinon la protection n'existe que côté
  9.1.3. (2) Un appareil 9.1.2 qui récupère (pull) la partie au format 8 la reçoit dans son stockage local, ne sait pas la
  lire (`loadGame` → `newer`, nouvelle partie en mémoire) puis peut réécrire localement sa partie en mémoire par-dessus :
  la copie locale de cet appareil est perdue, mais pas celle du serveur, qui reste la bonne. (3) Hors cloud (export /
  import manuel), un code de sauvegarde au format 8 est refusé par la 9.1.2 (`parseImport`), sans perte.

## Lot E — Tickets → gemmes (fait)

**Taux : 1 ticket = 100 gemmes** (`TICKET_GEMS`, `data/balance.js`). Un ticket payait une invocation ×1, qui coûte
100 gemmes ; dans un ×10 (900 gemmes) il n'en vaudrait que 90. On prend le taux le plus favorable : aucun joueur ne perd
d'invocation, et le stock converti s'utilise aussi en ×10 (10 % de mieux qu'avant pour qui convertit ses tickets).

- Stock : `gems += tickets × 100` à la migration, le champ `tickets` disparaît (`migrateTickets`). Partie de fin de
  référence : 47 tickets → +4 700 gemmes.
- Tables réécrites au même taux (chaque ticket devient 100 gemmes) : missions (jour : bonus 60 + 1 ticket → 160 ;
  semaine : donjons 100 + 2 → 300, bonus 300 + 3 → 600 ; mois : connexions 400 + 3 → 700, boss 300 + 3 → 600, bonus
  1 000 + 10 → 2 000), calendrier de connexion (jours 2, 6, 7 : 100, 200, 450 gemmes), contrats (Recycleur 115, bonus
  du contrat rare +100), maîtrise des boss (paliers 10 et 50 : 140 et 300), paliers de collection (Boss 140, Compagnons
  150), paliers de l'encyclopédie (25 % : 320 … 100 % : 3 000), Tour (étage ×10 : +100 × (1 + étage/30)), défi
  (vague ×10 : +100), expédition longue (+100), premier donjon (+100), ticket de départ (100 gemmes), démarrage rapide
  (100 gemmes par boss au lieu d'un ticket).
- Valeur en gemmes rapportée par les missions (bilan `docs/mesures-v913.md`, anciens tickets comptés à 100) :
  jour 200 + 100 = 300, semaine 770 + 500 = 1 270, mois 2 900 + 1 600 = 4 500 ; calendrier 310 + 600 = 910 par cycle.
  Rien de nouveau : c'est la même valeur, exprimée dans une seule monnaie.
- Interface : plus de bouton « ×1 ticket » ni de compteur de tickets (Invocation), plus d'entrée dans
  `data/currencies.js`, textes « gemmes et tickets » corrigés, anglais dans `i18n/en-910.js`. Une récompense « tickets »
  restée dans une donnée en cours (contrat, boîte, expédition partie avant la mise à jour) est versée en gemmes au même
  taux (`grantReward`, `sanitizeExpeditions`).
- **Critère d'abandon :** dépense d'invocations par joueur actif en baisse de plus de 20 % sur 2 semaines, ou retours
  de joueurs qui ne retrouvent pas leurs tickets malgré la note de version. **Annuler :** réintroduire `tickets` ; les
  gemmes converties restent (ne pas reprendre ce qui a été donné).

## Lot E — Codex fondu dans l'encyclopédie (fait)

- Les 4 collections du Codex deviennent les **paliers de section** de l'encyclopédie (Monstres, Boss, Équipements,
  Compagnons et familiers ; les Mutations n'en avaient pas). Un seul nombre par section (celui de l'onglet) au lieu de
  deux comptes différents ; le bloc replié « Codex : collections et paliers » et la recherche « Codex » disparaissent.
- **Paliers précoces gardés :** seuils et récompenses identiques (Boss 3, 6, 12, 24, 41…). La section compte au moins
  autant que l'ancienne collection (variantes de monstres, raretés d'objets) : aucun palier n'arrive plus tard, certains
  un peu plus tôt (Monstres 5 = 5 entrées, variantes comprises).
- **Paliers déjà réclamés :** même champ `codex.claimed`, borné au nombre de paliers (`migrateCodex`). Un palier
  réclamé reste le même palier : rien n'est reversé, rien ne peut être réclamé deux fois (testé sur la partie de fin,
  où Monstres et Boss sont complets).
- **Critère d'abandon :** moins de paliers de section réclamés par joueur qu'avant sur la même durée de jeu, ou joueurs
  qui ne trouvent plus les paliers. **Annuler :** remettre le bloc Codex, le champ n'a pas changé.

## Lot F — Musée en possession : option sans migration (fait), version « modèle obtenu » (non faite)

- Fait : l'exposition auto reste activée par défaut (`state.ui.autoMuseum` absent = activée, et `exposeAll` au
  chargement) ; « Exposition auto », « Exposer tout » et « Recycler les doublons » sont repliés dans **Outils du Musée**
  (repli mémorisé). L'écran du Musée n'a plus qu'une phrase, le compteur et les vitrines. Aucune sauvegarde touchée.
- **Non fait : « modèle obtenu + meilleure rareté » (vitrine allumée et pièce portable).** Le brief demande de ne la
  faire que si la puissance reste identique ou mieux justifiée. Or le bilan du doc (`core/bonuses.js`,
  `core/stats.js`) donne un gain net de ×1,44 à ×3,05 en dégâts selon les autres multiplicateurs, car la même pièce
  compterait deux fois (portée + bonus de vitrine). Garder la puissance identique demanderait de diviser le bonus par
  pièce selon la part portée, ce qui dépend du build et ne peut pas être fixé à un chiffre ; baisser le bonus pour
  tous pénaliserait les joueurs qui exposent sans porter. Il faudrait aussi rendre jusqu'à 18 objets vers un sac ou un
  coffre peut-être pleins. Sans mesure sur parties réelles, la refonte n'est pas justifiable : on garde le dilemme
  porter / exposer, que l'option sans migration rend moins coûteux en appuis.
- **Critère d'abandon (option faite) :** joueurs qui ne trouvent plus « Exposer tout » (retours) ; annuler = sortir les
  boutons du repli, rien à migrer.

## Lot F — Relance de pouvoir à une seule barrière (fait : l'or est retiré, la charge reste)

Avant : une relance demandait une **charge** (1 par victoire sur le boss réaffronté, 3 au plus) **et de l'or**
(3 × l'or du boss à sa première étape). Simulation d'abord : `node tools/sim-reroll-v913.mjs` (moteur réel, joueur
automatique, 10 min de boucle sur chaque boss battu, sur les sauvegardes début, milieu et fin) :

| Sauvegarde | Boss mesurés | Victoires (charges) / h en boucle | Relances / h payées par l'or de la boucle | Temps pour 1 charge / 1 relance payée |
|---|---|---|---|---|
| début (étape 54) | 2 | 24 à 780 | 96 à 463 | 0,1 à 2,5 min / 0,1 à 0,6 min |
| milieu (étape 120) | 5 | 768 à 1 062 | 572 à 757 | 0,1 min / 0,1 min |
| fin (étape 370) | 10 | 786 à 1 074 | 567 000 à 776 000 | 0,1 min / instantané |

Lecture : une relance coûte quelques secondes de boucle dans les deux cas ; en fin de partie l'or ne compte plus du tout
(le coût reste celui de la première étape du boss), et au milieu il ne pèse que si le joueur dépense **seulement** l'or
gagné pendant la boucle (son stock, 5e7 dans la sauvegarde de milieu, paie des milliers de relances). La charge, elle,
est ce qui relie la relance au fait de réaffronter le boss (le point que le doc demande de garder). **Barrière retirée :
l'or.** Rythme : inchangé en fin de partie, au plus +35 % de relances par heure de boucle au milieu (de ~650 à ~880),
toujours plafonné par les charges (3 au plus).

- Bouton « Changer le pouvoir (2/3) » : le compte de charges est dans le bouton ; plus de prix en or.
- Compteur de garantie (Épique+ dans N changements) et règle des charges derrière un « ? ».
- Le talent Héritage II (« -25 % coût de relance ») devient « +1 charge de relance au plus ».
- Sauvegarde : rien à convertir (`rerolls`, `sinceHigh`, `charges` gardent leur sens ; borne des charges à 4 pour le
  talent).
- **Critère d'abandon :** relances par joueur et par jour multipliées par plus de 2 sur les parties de milieu, ou part
  des pouvoirs Légendaires actifs qui double en 2 semaines. **Annuler :** remettre `rerollCost` (fonction et bouton),
  rien à migrer.

## Lot F — Déblocage progressif de Coffre, Mannequins, Forge (fait)

`core/unlocks.js` : Forge à l'étape 10, Coffre à l'étape 20, Mannequins à l'étape 30 (record d'étape, donc rien ne se
referme après une Renaissance). **Toujours visible si déjà utilisé :** coffre non vide, pièce sur un mannequin, objet
renforcé, ou vue déjà ouverte (`state.ui.invUsed`, sauvegardé). Avant l'ouverture des mannequins, les pièces d'ensemble
restent dans le sac (pas de rangement auto caché). Une ligne neutre annonce la suite (« Prochain : Coffre à l'étape 20 »).
Chiffres : le joueur automatique atteint l'étape 54 en 30 min, donc les 3 portes ne manquent que pendant les premières
minutes, quand le sac (100 places) est loin d'être plein. Anciennes sauvegardes : tout reste ouvert (testé).
- **Critère d'abandon :** joueurs qui demandent où est le coffre avant l'étape 20, ou sac plein avant l'étape 20 dans
  les mesures. **Annuler :** seuils à 1 (aucune migration).
