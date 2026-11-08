# Live-ops (v9.3.0) : livrer en avance, activer depuis l'admin

Le jeu est connecté. On ne publie plus de mise à jour pour dire « l'événement commence » :

1. **Une mise à jour livre à l'avance** le contenu (code, textes, traductions, assets). Le joueur ne voit rien.
2. **L'admin programme** l'élément (dates de début et de fin, réglages). Il démarre et s'arrête **tout seul** aux
   dates prévues, à l'heure du serveur.
3. Au besoin, **« Démarrer maintenant »** (en avance) ou **« Arrêter maintenant »** (couper en avance) : surcharges
   manuelles, tracées dans l'historique. Les joueurs voient le changement au rafraîchissement suivant (5 min au plus).

## Pièces du système

| Pièce | Fichier | Rôle |
| --- | --- | --- |
| Catalogue | `src/data/live-catalog.js` | Ce que le code sait afficher : types d'événement et leurs paramètres, vedettes possibles, offres activables, interrupteurs, avec la version qui les a livrés (`since`). Lu par le serveur ET par le jeu. |
| Serveur | `server/live.mjs` (+ routes dans `server/app.mjs`) | Tables `live_items`, `live_goals`, `live_history` ; validation ; calcul de l'état ; `GET /api/live`. |
| Admin | `site/admin/live-admin.js` (+ sections de `site/admin/index.html`) | Calendrier, éditeur, goals du site, contenus, historique. |
| Jeu | `src/core/live.js` | Lecture de `/api/live`, cache hors ligne, horloge serveur, filtres de version. Utilisé par `core/ancients.js` (événements, World Boss), `core/gacha.js` (vedette), `core/store.js` (offres), `ui/panels/event.js` (annonces). |
| Site | `site/live.js` | `loadGoals()` / `goalProgress()` pour la page d'accueil (objectif, compteur affiché, paliers). |

## Éléments configurables

| Type | Référence (catalogue) | Données |
| --- | --- | --- |
| Événement | `ancients` (Expédition des Anciens), `lights` (Marché des lueurs) | multiplicateur des écus, World Boss ouvert / choisi / PV (×) / tentatives par jour, stocks de la boutique d'événement (×) ; objectifs (×) pour `lights` |
| Vedette | un SSR allié (`archangel`, `demon_queen`, …) | — (dates) |
| Offre | `offer_launch`, `offer_half_anniversary`, `offer_anniversary` (`data/economy.js` `LIVE_OFFERS`) | — (dates) |
| Annonce | — | titre, texte (500 caractères), affichés en tête de l'onglet Événement |
| Interrupteur | `events`, `worldBoss`, `featuredBanner`, `liveOffers`, `announcements` | oui / non |
| Goals du site | (un seul jeu de goals) | objectif libre (« 40260 », « 40 260 », « 40,26k »), paliers libres (ajout / suppression), compteur affiché (réel, réel + décalage, valeur fixe), phrases |

États : **brouillon** (ne s'active jamais), **programmé**, **actif**, **terminé**, **désactivé**. L'état effectif est
calculé par le serveur à chaque requête à partir des dates : un élément programmé devient actif à sa date de début
et terminé à sa date de fin, sans intervention. Un seul événement à la fois et une seule vedette à la fois : le
serveur refuse un chevauchement (409) ; le calendrier de l'admin entoure de rouge les chevauchements de brouillons.

## Livrer un nouvel événement en avance

1. Coder le contenu (module `core/…`, panneau, assets, traductions `src/i18n/en-9xx.js` et `ko-9xx.js`).
2. Ajouter son type dans `LIVE_EVENT_TYPES` (`src/data/live-catalog.js`) avec `since` = version qui le livre et
   ses paramètres (`number`, `int`, `bool`, `enum` avec bornes et valeur par défaut).
3. Brancher le jeu : le module lit `currentEvent()` (`core/ancients.js`) ou `liveEvent()` (`core/live.js`) et ses
   `params` ; rien ne doit s'afficher quand ces fonctions renvoient `null`.
4. Publier la mise à jour. Tant que rien n'est programmé, le joueur ne voit aucun changement.
5. Déployer le serveur avec le même catalogue (il refuse tout type absent du catalogue).

## L'activer depuis l'admin

1. `site/admin/` → **Calendrier live** → cliquer un jour (ou **+ Nouveau**).
2. Choisir le type et le contenu (seuls ceux du catalogue sont proposés, avec leur version d'apparition), les dates,
   la **version minimale du client** (par défaut : la version qui a livré le contenu, au moins 9.3.0), les paramètres.
   L'aperçu dit ce que verra le joueur et quand.
3. **Enregistrer et programmer** : démarrage et arrêt automatiques. Glisser la barre dans le calendrier la déplace
   (même durée).
4. Surcharges : **▶ Démarrer maintenant** (le début passe à maintenant, la fin prévue est gardée ; sans fin, la durée
   du type), **■ Arrêter maintenant** (la fin passe à maintenant) ou **Déprogrammer**.
5. **Historique live** : qui, quand, quoi (avant / après sur `GET /api/admin/live/history/:id`).

## API

- `GET /api/live` (public) : `{ schema, validFor, goals, events[], banners[], offers[], announcements[], flags, serverTime }`.
  Chaque élément porte `id, state, start, end, minClient`. `ETag` + `Cache-Control: public, max-age=30` ; un
  `If-None-Match` identique renvoie 304 avec l'en-tête `X-Server-Time`. Seuls les éléments programmés ou actifs y
  figurent (jamais les brouillons).
- `GET /api/live/goals` (public) : goals du site, compteur **affiché** seulement.
- Admin (jeton `Authorization: Bearer`, compte admin, mot de passe temporaire changé) :
  `GET /api/admin/live`, `GET /api/admin/live/preview`, `GET /api/admin/live/history/:id`,
  `POST /api/admin/live/items`, `PUT /api/admin/live/items/:id`, `POST /api/admin/live/items/:id/(activate|stop|schedule|draft)`,
  `DELETE /api/admin/live/items/:id`, `PUT /api/admin/live/goals`.
  Chaque écriture envoie la `version` lue : si quelqu'un a modifié entre-temps, 409.
- Sécurité : jeton en en-tête (pas de cookie) → pas de CSRF possible ; validation complète côté serveur (types,
  bornes, dates, 90 jours au plus, chemins d'images `assets/…` seulement, textes bornés) ; aucun secret côté client ;
  connexion admin déjà limitée en tentatives.

## Règles côté jeu (`src/core/live.js`)

- Lecture au démarrage puis toutes les 5 minutes ; config mise en cache (`localStorage` `idle-rpg.live`).
- **Horloge** : celle du serveur (`serverTime` / `X-Server-Time`). `liveNow()` = heure locale + décalage mesuré, et ne
  recule jamais sous la dernière heure serveur connue. Changer l'heure du PC ne fait ni démarrer ni prolonger un
  événement.
- **Version minimale** : un élément dont `minClient` dépasse la version du jeu, ou absent du catalogue de ce jeu, est
  ignoré. Les jeux d'avant la 9.3.0 ne lisent pas `/api/live`.
- **Hors ligne** : la dernière config connue sert ; ce qui avait commencé reste jouable jusqu'à sa date de fin
  connue ; un élément programmé ne démarre hors ligne que pendant la validité de la config (`validFor`, 6 h après la
  dernière réponse) ; au-delà rien ne s'active.
- **Serveur jamais joint** (aucune réponse ni cache, ex. premier lancement hors ligne) : on garde le comportement codé
  en dur d'avant la 9.3.0 — cycle de 28 jours Expédition / Marché (`EVENTS.anchor`, `data/economy.js`) et vedette
  tournant tous les 14 jours parmi les SSR permanents (`core/gacha.js`). Aucune offre live, aucune annonce. Dès qu'une
  réponse porte `programmed: true`, seule la config live compte (voir « Cas config vide » plus bas).
- Tests automatisés : le jeu ne lit `/api/live` sous WebDriver que sur la même origine (serveur local `/play/`) ;
  `?livepoll=N` (secondes, WebDriver seulement) raccourcit l'intervalle pour la démo.

## Mise en service : continuité au déploiement

Les joueurs ne perdent jamais l'événement ni la vedette en cours le jour où la 9.3.0 arrive :

- **Migration idempotente du serveur** (`seedLegacyCalendar`, `server/live.mjs`) : au premier démarrage en 9.3.0, le
  serveur crée tout seul, en état « programmé » et au nom de « système », les éléments qui reproduisent le calcul
  automatique de la 9.2.9 : l'Expédition et le Marché du cycle en cours puis ceux des cycles suivants (3 cycles de
  28 jours au total, depuis `EVENTS.anchor`), et la vedette en cours puis les suivantes (rotation de 14 jours parmi
  les SSR permanents, dans l'ordre de `permanentSsr()`). Mêmes dates (minuit, heure locale du serveur — à régler sur
  le fuseau des joueurs, Europe/Paris) et, pour les événements, même numéro de cycle (`data.cycle`) : le jeu garde
  l'identifiant 9.2.9 (`ancients-1`, `lights-1`…) et donc la progression des joueurs. Une ligne « reprise du
  calendrier 9.2.9 » est écrite dans l'historique. La clé `live_meta.legacy_seed` empêche toute deuxième exécution
  (même si l'admin supprime ensuite ces éléments). L'admin peut ensuite tout modifier, déplacer, arrêter ou
  supprimer. Les goals d'avant la 9.3.0 (100 000, 10 paliers) sont semés de la même façon.
- Au-delà des 3 cycles repris, **plus rien n'est programmé automatiquement** : programmer la suite dans l'admin.

### Cas « config vide » côté jeu

`/api/live` porte `programmed` : vrai dès que le serveur a programmé ou activé quoi que ce soit au moins une fois
(reprise 9.2.9 comprise), faux sinon.

| Situation | Comportement du jeu |
| --- | --- |
| Serveur jamais joint, aucun cache | calendrier automatique d'avant la 9.3.0 (cycle de 28 jours, vedette tous les 14 jours) |
| Réponse avec `programmed: false` (serveur qui n'a JAMAIS rien programmé, ex. migration pas encore passée) | même chose : calendrier automatique gardé, au lieu de tout masquer ; offres live et annonces : aucune |
| Réponse avec `programmed: true` et aucun élément en cours | aucun événement, aucune vedette (l'admin a tout arrêté ou rien programmé ensuite) : c'est voulu |
| Réponse avec des éléments en cours | seulement ce que la config active, à l'heure du serveur |

## Tests

`tests/v930-live.test.js` : droits, ETag/304, validation (type inconnu, version minimale trop basse, paramètres,
dates), démarrage et arrêt automatiques à la date, démarrage et arrêt en avance + historique, chevauchements,
goals à 40 260 (« 40,26k »), côté client activation / désactivation / hors ligne / horloge / version minimale, et le
bout en bout « Démarrer maintenant → l'événement apparaît au rafraîchissement suivant », reprise du calendrier
9.2.9 au déploiement (mêmes dates, même cycle, même vedette, une seule fois) et config vide jamais programmée.
