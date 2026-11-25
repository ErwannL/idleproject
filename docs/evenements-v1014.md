# Fêtes du mois (v10.14) : le système d'événements

Code : `src/data/fest.js` (feuilles, calendrier, rotation), `src/core/fest.js` (moteur), `src/ui/panels/event.js`
(`festPage`), `src/ui/fest1014.css`, `server/live.mjs` (`importFestCalendar`), tests `tests/v1014-fest.test.js`.
Captures : `docs/screenshots/v10.14/`.

## L'écran de la fête

Une interface à part, plein cadre (`src/ui/fest-hub.js`), ouverte par l'icône « Fête » de la colonne d'événements ou
par l'onglet Événement (affiche, « Entrer dans la fête » et une tuile par partie). En bas, de grandes tuiles :

- **Aventure** : la Carte du héros sur les décors du monde de la fête (3 régions, chemin, coffres, World Boss à
  l'étape 10, fragment à l'étape 30), le héros du mois en grand avec « Invoquer » et les jalons d'invocation.
- **World Boss** : le Titan animé dans son décor, ses phases, tentatives, record, paliers, « Attaquer ».
- **Brèche** : le mode supplémentaire des 14 jours (voir plus bas).
- **Missions** : du jour et de la fête, illustrées, « Tout récupérer ».
- **Boutique** : objets illustrés, stock et prix.

La petite fête a la même interface avec Sentier (héros et familier gratuits en grand), Missions et Boutique.
Échap ou ✕ ferme l'écran ; les fenêtres de récompense s'ouvrent par-dessus.

## La Brèche (mode de la grande fête)

- 10 paliers ; gardien du palier n = record × (0,75 + 0,07 n), combat résolu d'un coup (30 s de dégâts).
- Après chaque palier gagné : **1 bénédiction parmi 3** (Lame bénie, Fureur, Sablier, Bourse pleine, Second souffle,
  Concentration), gardée jusqu'à la fin de la course.
- 3 cœurs ; une défaite en coûte un. La monnaie de chaque palier (6 + 2 n) est gagnée tout de suite.
- 2 entrées par jour, jusqu'à 6 en réserve (on peut rater 2 jours sans rien perdre).
- Premières fois (une fois par fête) : palier 5 → 1 ticket limité ; palier 10 → 2 tickets limités et 200 gemmes.

## Le rythme d'un mois

| Jours | Quoi | Ce que le joueur fait |
| --- | --- | --- |
| 1 → 14 | **Grande fête** | Invoque le héros du mois, avance sur sa Carte (30 étapes), frappe le World Boss du thème, remplit missions et jalons, dépense à la boutique |
| 15 → 16 | Échange | Combats, boss et missions fermés ; boutique et récompenses déjà gagnées ouvertes |
| 17 → fin − 2 | **Petite fête** (10 à 13 jours) | Joue normalement : la monnaie tombe toute seule, le sentier donne un **héros et un familier gratuits**, leurs copies sont en boutique |
| 2 derniers jours | Échange | Comme plus haut |
| Fin de l'échange | Conversion | La monnaie restante devient des éclats (10 par pièce), une seule fois, jamais perdue |

Le héros du mois reste en vedette sur la bannière limitée **tout le mois** (du 1er au dernier jour) : les tickets
limités gagnés pendant la petite fête servent encore.

## Grande fête

- **Héros du mois** : la vedette de la bannière limitée (50/50, garantie inchangées). Dans l'équipe (même en essai), il
  donne **+25 %** de monnaie sur la Carte.
- **Carte du héros** : 3 régions × 10 étapes, combat automatique de 30 s (comme l'Expédition des Anciens), étape n =
  record × (0,55 + 0,022 n). « Enchaîner » joue toutes les étapes gagnables. Étape 10 : ouvre le World Boss.
  Étape 30 : fragment Légendaire universel.
- **World Boss** : celui de la feuille (Titan du thème ou Colosse), vrai combat animé (`ui/world-boss.js`),
  3 tentatives par jour, 6 + 3 par palier atteint.
- **Jalons d'invocation** : invocations sur la bannière limitée pendant la fête → 10 (300 gemmes), 30 (3 tickets
  limités), 50 (fragment Légendaire), 80 (5 tickets limités), 120 (fragment + 500 gemmes).
- **Missions** : 3 du jour (même tirage pour tous) + 6 de la fête.
- **Boutique** : tickets limités, permanents, familiers, 1 fragment Légendaire, grimoires, pierres d'ascension, clés,
  éclats (`FEST_SHOPS.grand`).

Revenu d'un joueur actif sur 14 jours : environ 2 000 pièces (Carte 600 à 750, boss 400 à 600, missions du jour
500, missions de la fête 240). La boutique coûte 1 625 au total : un joueur actif la vide, un joueur moyen choisit.

## Petite fête

- **Monnaie en jouant** : 1 pièce par 150 monstres, 1 par boss, 25 au plus par jour ; plus 3 missions du jour et
  5 missions de la fête.
- **Sentier de 12 étapes** (au total gagné : dépenser ne fait pas reculer) : héros gratuit aux étapes 3, 8 et 12,
  familier aux étapes 5, 10 et 12. Un exemplaire déjà au maximum donne sa conversion habituelle.
- **Boutique** : 2 copies du héros (120), 2 copies du familier (100), tickets, clés, éclats.

Un joueur qui passe 2 fois par jour obtient le héros dès le 2e jour et le familier vers le 4e ; un joueur assidu finit
le sentier (3 copies de chaque) et achète les copies de la boutique : c'est le « farm ».

## Calendrier des 6 premiers mois

| Mois | Grande fête (1 → 14) | Héros du mois | World Boss | Monnaie | Petite fête (17 → fin − 2) | Héros gratuit | Familier gratuit | Monnaie |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Février 2027 | Fête des Cœurs ardents | Reine démone | Titan des Braises | Cœurs de braise | Bal des Lames roses (17 → 26) | Lame rose | Hérisson de cristal | Pétales |
| Mars 2027 | Éveil du Printemps | Gardienne sylvestre | Titan des Ronces | Bourgeons | Concours des Archers (17 → 29) | Archère elfe | Fée des bois | Flèches d'or |
| Avril 2027 | Aube dorée | Archange | Titan du Soleil | Plumes d'aube | Pèlerinage de Lumière (17 → 28) | Grand prêtre | Mini-golem | Cierges |
| Mai 2027 | Nuit des Éclipses | Seigneur de l'ombre | Titan du Néant | Éclats d'éclipse | Nuit des Shinobis (17 → 29) | Ninja | Hibou érudit | Shuriken |
| Juin 2027 | Solstice de Givre | Impératrice des glaces | Titan des Marées | Flocons | Sabbat de la Saint-Jean (17 → 28) | Sorcière | Hérisson de cristal | Braises de lune |
| Juillet 2027 | Festival des Titans | Reine démone (retour) | Colosse des Anciens | Médailles | Jeux des Champions (17 → 29) | Barbare | Fée des bois | Lauriers |

Décembre et janvier gardent le calendrier repris de la 9.2.9 (Expédition / Marché des Lueurs jusqu'au 25 janvier),
puis une semaine sans événement jusqu'au 1er février. Pour démarrer plus tôt : changer `FEST_RULES.firstMonth`
(et retirer dans l'admin les éléments 9.2.9 qui chevauchent).

## Les rotations

Chaque liste de `FEST_POOLS` avance d'un cran par mois. Sa longueur fixe le délai avant un retour :

| Liste | Contenu | Retour au plus tôt |
| --- | --- | --- |
| `featured` | 5 Légendaires alliés | 5 mois |
| `boss` | 7 Titans + Colosse | 8 mois |
| `freeHero` | 6 Épiques alliés | 6 mois |
| `freePet` | 4 familiers rares et épiques | 4 mois |
| `zone` | décor de la Carte, aligné sur le boss | 8 mois |

- Les 6 premiers mois ont des titres, phrases et monnaies écrits à la main (`FEST_MONTHS`). Au-delà, la rotation
  continue toute seule avec des titres automatiques (« Fête du héros : Archange », « Foire : Lame rose ») ; il suffit
  d'ajouter une entrée à `FEST_MONTHS` pour lui donner un thème.
- **Ajouter un nouveau héros** (Légendaire dessiné) : l'ajouter à `featured` (et à `LIVE_FEATURED_UNITS`). Tout ce
  qui suit se décale, et le délai avant un retour s'allonge d'un mois. Même chose pour un nouveau Titan dans `boss`.
- Le catalogue live connaît 24 mois de feuilles (`FEST_RULES.monthsAhead`) : une mise à jour par an suffit.

## Live-ops

- Type d'événement live **`fest`** (`src/data/live-catalog.js`, depuis la 10.14.0) : paramètre `sheet`
  (« 2027-02-g », « 2027-02-l »…), plus multiplicateurs de monnaie, PV du boss, tentatives, stocks. Les dates de
  l'élément incluent l'échange (les 2 derniers jours).
- **Au premier démarrage du serveur en 10.14** : les 6 premiers mois (12 fêtes + 6 héros du mois) sont programmés tout
  seuls, une fois (`live_meta.fest_seed`). Ce qui chevaucherait un élément déjà programmé est sauté, jamais écrasé.
- **Admin › Calendrier live › « Programmer les Fêtes (6 mois) »** (`POST /api/admin/live/fest-import`) : prolonge la
  rotation sur les 6 mois à venir. À cliquer une fois par semestre.
- Chaque fête reste modifiable dans l'admin comme avant (dates, réglages, arrêt, suppression).
- Sans serveur (jamais joint) : le jeu suit le même calendrier, à l'heure locale.

## Ce que la 10.14.1 ajoute (images, accent, écrans, notifications, classement, traductions)

- **Images** (`assets/ui/art1014/`, PixelLab) : par grande fête une affiche, 3 décors de région, une arène de boss et une monnaie ;
  par petite fête une affiche, un fond de sentier, 2 étapes et une monnaie ; une fois : icônes des tuiles, fond de la Brèche,
  6 bénédictions, étapes spéciales (boss, coffre, fragment), icône « Fête » de la colonne. Chaque fête les déclare dans
  `FEST_MONTHS[].art` ; sans fichier (`ui/fest-art.js`), l'ancienne image reste : jamais d'image cassée. Les mois de la rotation
  automatique gardent le décor de la zone du boss.
- **Couleur d'accent** par fête (`accent`, posée en `--fh-accent` sur `.fest-hub`) : onglet actif, étape suivante, liseré, halo.
  Rotation automatique : couleur de l'élément du boss. L'or reste réservé au bouton principal (un seul doré par onglet).
- **En-tête** : « ? » (fiche en 4 lignes : rythme, monnaie, échange, éclats), minuteur avec « puis 2 jours d'échange », bannière
  illustrée pendant l'échange, monnaie qui rebondit quand on gagne, tuiles à icônes avec pastille.
- **Aventure** : Carte à gauche (60 %), héros du mois à droite ; Combattre sombre et Enchaîner doré ; « Améliorer › » après une
  défaite ; badge « +25 % » (vert dans l'équipe, sinon « Mettre dans l'équipe › » ou « Invoquer › ») ; jalons en barre continue.
- **World Boss** : arène de la fête, Titan plus grand, barre de PV à phases, épées de tentatives, bilan de la tentative.
  **Brèche** : colonne de pierres, cartes de bénédiction qui se retournent, cœurs en icônes, confirmation avant de quitter, fenêtre de
  fin de course. **Missions** : faites repliées, la plus proche de la fin en premier, « Y aller » ferme l'écran.
  **Boutique** : grand article en vedette, « il manque N », tampon « Épuisé », « Dernière chance » pendant l'échange.
  **Sentier** : fond et étapes de la fête, halos d'accent, « 1 / 3 obtenus ».
- **Onglet Événement** : porte d'entrée (affiche, « Entrer dans la fête », tuiles à pastilles) ; **Invocation** : ligne
  « Jalons : 35 / 50 › » sous la vedette pendant la grande fête.
- **Notifications** (`core/notify-plan.js`, ids 5 à 8, 2 par jour au plus, jamais entre 22 h et 9 h, désactivables) : « La fête
  commence » (jour 1, 12 h), « Entrées de Brèche pleines » (6/6, 18 h), « Dernier jour » (veille de l'échange, 18 h, s'il reste
  quelque chose), « Échange » (premier jour d'échange, 12 h, s'il reste de la monnaie). Elles suivent la langue du jeu
  (`ui/notifications.js` passe titre et texte par `t()`).
- **Classement du World Boss** : le score part comme `eventBossFinish` (`cloud.wbReport`, mode `event`, identifiant de la fête)
  et donne un classement **par tranches** (Top 10 %, 30 %, 60 %, Participant), remis à zéro à chaque fête ; jamais de classement
  absolu. Toast « Classement de la fête : Top 10 % ».
- **Admin** : le menu « Feuille de la fête » affiche « 2027-02-g · Fête des Cœurs ardents ».
- **Traductions** : `src/i18n/en-1014.js` et `ko-1014.js` (branchés à la fin de `en.js` / `ko.js`) couvrent les 12 fêtes écrites à
  la main (titres, phrases, monnaies, régions), les titres automatiques, les missions, les bénédictions, tout l'écran de la fête,
  l'onglet Événement, les messages de `main.js`, la fiche « ? », les 4 notifications et la ligne « Jalons ». Les monnaies sont
  citées par leur nom dans les phrases : une nouvelle monnaie s'ajoute à `FEST_CURRENCIES_EN` / `FEST_CURRENCIES_KO`, une nouvelle
  région ou phrase au dictionnaire `EXACT_1014`. Le bouton « Quitter » de la Brèche porte un espace de largeur nulle (`QUIT` dans
  `fest-tabs.js`) : « Quitter » seul veut dire « quitter la guilde » en coréen. Tests : `tests/helpers/fest-texts.js`,
  `tests/i18n.test.js`, `tests/i18n-ko.test.js` (24 mois, toutes les phrases, notifications).
- Captures : `docs/screenshots/v10.14.1/final/` (français, 1116 × 993, 1920 × 1080, 412 × 915) ; vérifiées aussi en anglais et en
  coréen à 1116, 1920, 412 et 390 (aucun débordement, texte de 12 px au moins, un seul doré).

## Ce qui reste à faire

Rien côté art, traductions, notifications ou classement : tout est livré en 10.14.1. À mesurer après une semaine de jeu réel :
l'économie (`FEST_RULES`, `FEST_SHOPS`, `LIGHT_PATH`, `RIFT_BLESSINGS`), qu'on n'a pas touchée.
