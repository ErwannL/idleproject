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
