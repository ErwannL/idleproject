# Ascendrya 9.3.2 — audit et plan d'évolution (aucun code modifié)

Projet : JavaScript sans moteur (canvas 2D + DOM), `src/core` (règles), `src/data` (données), `src/render` (scènes,
sprites, effets), `src/ui` (menus, `ui.js` + `ui/panels/*`, `style.css`), `server/` (Node + SQLite : comptes,
sauvegarde cloud, classements, amis, live-ops), Electron (PC) et Capacitor (Android). 502 tests `node --test`.
Sauvegarde : un objet `state` (localStorage + cloud), migrations versionnées (`core/migrations-v9xx.js`).

Légende : ✅ existe et fonctionne · 🟡 partiel · 📝 prévu (commentaires ou docs) · ➕ à créer.

## 1. Équipements, rareté, effets

| Élément | État | Où |
|---|---|---|
| Raretés | ✅ **4** : commun, rare, épique, légendaire (`data/items.js` RARITIES). Pas de « peu commun » ni de « mythique » (les couleurs `uncommon`/`mythic` de `TRAIL_COLORS` sont des restes inutilisés). | `src/data/items.js:19` |
| 63 bases d'objets, objets signature, sets, forge, amélioration | ✅ | `data/items.js`, `core/forge.js`, `core/sets.js` |
| Arme réellement dessinée dans la main du héros (9 apparences, gestes par arme) | ✅ (9.2.5–9.2.9) | `render/hero-draw.js`, `render/knight-gear.js` |
| Traînée d'attaque colorée selon la rareté | ✅ seul effet lié à la rareté en combat | `render/scene.js:118, 953` |
| Aura / lueur au repos, particules, impact selon la rareté | ➕ | — |
| Lien rareté ↔ effets des compétences du héros | ➕ (les compétences ont leurs effets propres, `render/skill-fx.js`, indépendants de l'arme) | |
| Butin : couleur et secousse selon la rareté | ✅ | `render/scene.js:446` |
| Écran Équipement : comparaison avant/après, Améliorer, Ranger, Builds, filtre par emplacement, tri, sets | ✅ | `ui/panels/inventory.js` |
| Aperçu du héros portant l'arme | 🟡 (vitrine des apparences, `render/showcase-scene.js`, pas branchée sur l'objet sélectionné) | |
| Filtre par rareté / statistique, états équipé / verrouillé plus lisibles | 🟡 | |

**Proposition** : une table `WEAPON_FX[rarity]` (données) lue par le rendu :
commun = rien ; rare = traînée + 2–3 étincelles à l'impact ; épique = traînée large + lueur au repos discrète + impact
coloré ; légendaire = aura animée, particules au repos, impact signature, compétences ultimes teintées.
Effets **purement visuels** (aucune statistique), désactivables avec l'option existante « effets réduits ».
Pas de nouvelle rareté (consigne). Variante par type d'arme (lame / arme d'hast / bâton / arc) via le profil de geste
déjà présent. Assets : réutiliser les feuilles VFX existantes (`assets/ui/vfx`, `render/vfx.js`), quelques nouvelles
particules si besoin (PixelLab, comme les précédentes).

## 2. Affinités (types)

| Élément | État |
|---|---|
| Types rouge/bleu/vert/lumière/ténèbres, cycle R>V>B>R, L⇄T | ✅ **fait en 9.3.1** : `src/core/elements.js` |
| Modificateurs centralisés | ✅ `ADV = 1.3`, `WEAK = 0.8` (le cahier propose +25 % : une ligne à changer) |
| Compagnons et familiers typés, ennemis = type de leur monde | ✅ |
| Héros | neutre (décision 9.3.1 : apparences purement cosmétiques depuis 9.2.8) → **choix à valider** |
| Application : une seule fois, dans `hitEnemy` (avant mutations/traits/critiques déjà intégrés aux dégâts) | ✅ pas de double application |
| Affichage : « EFFICACE ! », pastille sur la fiche compagnon, icône sur le monde | ✅ partiel ; « AVANTAGE / DÉSAVANTAGE », icônes sur chaque ennemi et dans la liste des compagnons | ➕ |
| Dégâts reçus selon le type (ennemi → équipe) | ➕ à décider (aujourd'hui seul le héros encaisse) |
| Tests | ✅ base (`tests/v931-elements.test.js`) ; ➕ critiques, buffs, boss, World Boss, mode compagnons |

## 3. Guildes

| Élément | État |
|---|---|
| Guildes | ➕ rien n'existe (ni données, ni serveur, ni écran) |
| Socle réutilisable | ✅ comptes, pseudos, amis (`/api/friends`), classements (`/api/leaderboard`, `/api/scores`), live-ops (admin, calendrier) |
| World Boss **des grands événements** (3 phases, Éveil, paliers, graine rejouable) | ✅ en local (`core/world-boss.js`), **scores non envoyés au serveur** |
| World Boss **global partagé** (barre commune) | 📝 décrit dans l'en-tête de `core/world-boss.js` (« Coopératif »), pas fait |
| Conditions/objectifs bonus du World Boss d'événement | ➕ |

Les deux World Boss resteront deux modes distincts (même scène, règles et tables séparées).
Proposition guilde v1 : tables `guilds`, `guild_members` (rôle, arrivée), `guild_log` ; création (nom, emblème choisi
parmi des icônes existantes, description, accès libre/demande), recherche, rôles chef/officier/membre, limite
configurable (30), objectif hebdo commun (somme de contributions plafonnées par joueur), classement de guilde du World
Boss = **moyenne des N meilleurs** (pas la somme brute : équité entre petites et grandes guildes), récompenses
seulement si contribution > 0, verrou de 24 h après un changement de guilde pendant une saison. Prérequis :
envoi et vérification serveur des scores du World Boss (graine + borne de puissance).

## 4. Modes compagnons (sans héros)

**Dépendance technique majeure** : aujourd'hui un compagnon **n'a pas de PV ni de statistiques propres**. Il lance sa
compétence toutes les *n* secondes, avec les dégâts du héros (`combat.js` `castCompanion` : `stats.damage × valeur`),
et seul le héros encaisse. Un combat « compagnons seuls » demande donc un **profil de combat de compagnon** :

- PV, attaque, défense, vitesse dérivés de la rareté, du niveau (1–20) et des étoiles (doublons), table centralisée ;
- attaque de base automatique + sa compétence existante (hit, burst, heal, shield, gold → converti en bonus de score),
  son ultime s'il en a un, son type (déjà défini) ;
- réutilisation des animations existantes (compagnons et familiers déjà animés : marche, attaque, compétence).

Mode **Survie** (1 compagnon, vagues) : 30 vagues limitées (v1), score = vague atteinte puis temps, 3 essais/jour,
modificateurs de vague tournants (types d'ennemis, rapides, blindés…) pour varier le meilleur choix, récompenses au
meilleur palier (une seule fois par palier), classement en v2.
Mode **Étages** (équipe de 3 compagnons/familiers) : étages permanents comme la Tour (`core/tower.js` réutilisé pour
la structure), boss tous les 10 étages, conditions d'étage (type imposé, soins réduits…), rôles = types de compétence
existants (attaque, zone, soin, bouclier, soutien). Aucun héros n'est instancié dans ces combats (test dédié).

## 5. Menus et ergonomie

| Élément | État |
|---|---|
| Navigation 4 onglets (Héros, Aventure, Équipe, Objectifs), panneaux à onglets, fermeture, aide, raccourcis clavier, mode compact PC et téléphone | ✅ (`ui/ui.js` 2000 lignes, 22 panneaux, `style.css`) |
| Options : effets réduits, vitesse, cloud | ✅ |
| Classements (panneau), World Boss (écran dédié) | ✅ |
| Guildes, modes compagnons | ➕ (écrans à créer) |
| Cohérence visuelle des cadres / boutons / états (verrouillé, disponible, terminé, récupérable) | 🟡 hétérogène selon l'ancienneté des panneaux |

Plan : audit écran par écran avec captures (PC compact + téléphone), puis un **socle commun** (composants : en-tête de
panneau, carte, bouton, pastille d'état, cadre de rareté, liste vide / chargement / erreur) appliqué panneau par
panneau, sans changer la navigation d'un coup.

## Plan proposé (lots)

| Prio | Lot | Fichiers | Complexité |
|---|---|---|---|
| 1 | Effets d'armes par rareté (`WEAPON_FX`), aperçu dans l'écran Équipement, filtre rareté | `render/scene.js`, `hero-draw.js`, `vfx.js`, `ui/panels/inventory.js`, données | moyenne |
| 1 | Socle UI commun + 3 premiers écrans (Équipement, Compagnons, Invocation) | `ui/style.css`, panneaux | moyenne |
| 2 | Affinités : AVANTAGE/DÉSAVANTAGE, icônes ennemis et listes, valeurs à valider, tests étendus | `core/elements.js`, `combat.js`, `scene.js` | faible |
| 3 | Profil de combat des compagnons, puis Survie, puis Étages | `core/companion-arena.js` (nouveau), `data/`, scène réutilisée, 2 panneaux | **élevée** |
| 4 | Scores du World Boss côté serveur → World Boss global → guildes v1 | `server/` (tables, API, anti-abus), panneaux Guilde/Classement | **élevée** |

## Décisions à valider avant de coder

1. Héros : reste **neutre** (apparences cosmétiques) ou reçoit un type (lequel : par classe ?) ?
2. Valeurs : +25 % / −20 % (cahier) ou +30 % / −20 % (actuel) ?
3. Les ennemis infligent-ils plus/moins de dégâts selon le type (défense typée) ?
4. Modes compagnons : équipe de **3** (taille actuelle compagnons + familier) ; familiers autorisés en Survie ?
5. Survie : 30 vagues et 3 essais/jour vous conviennent ?
6. Guildes : score World Boss = moyenne des meilleurs membres (proposé) ou somme plafonnée ?
7. Ordre des lots ci-dessus.
