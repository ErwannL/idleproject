# Fêtes du mois (v10.14) : le système d'événements

Code : `src/data/fest.js` (feuilles, calendrier, rotation), `src/core/fest.js` (moteur), `src/ui/panels/event.js`
(`festPage`), `src/ui/fest1014.css`, `server/live.mjs` (`importFestCalendar`), tests `tests/v1014-fest.test.js`.
Captures : `docs/screenshots/v10.14/`.

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

## Ce qui reste à faire (art et finitions)

Voir `prompt-v10.14-fetes.md` dans le dossier partagé : affiches et monnaies dessinées par fête, traductions EN/KO,
notifications « nouvelle fête » et « dernier jour », classement par tranches du World Boss.
