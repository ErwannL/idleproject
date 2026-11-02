# Héros, doublons et invocation — v9.1.3 (doc4, parties A et B)

Lots 0 à 3 faits (un commit chacun). Partie B (lots 4 à 7) faite aussi, **derrière un drapeau coupé** : voir en fin
de document.

## Ce qui a changé

- **Compte d'étoiles** : `owned.stars` reste le nombre d'exemplaires (1 à 6) ; l'écran affiche les doublons
  (`duplicates()` dans `core/companions.js`, seul endroit du calcul) : 0★ à l'obtention, 5★ à 6 exemplaires.
  Skins : toujours 1★ à 5★ (5 exemplaires). Expéditions : inchangées (étoiles limitées à 5 exemplaires dans le calcul).
- **Courbe** (`D` = doublons, `d` = 6 dans son donjon) : passif × (1,5 + 0,075 D) ; hit et burst × d × rareté × kh/kb
  × (1 + 0,05 D) ; soin et rally × min(d × rareté × 4/3 × (1 + 0,05 D), 3) ; bouclier et or sans étoile.
  `kh`, `kb` : `skillScales()` (`data/companion-skills.js`), calculés au chargement depuis les données et mis en cache.
- **Ultimes offensifs à 30 s** (Archer 3, Assassin 3,5, Mage 1,8375, Berserker 1,575, Familier 35/24). Gardien et Soutien
  inchangés. Effet visuel générique d'ultime (colonne de lumière aux couleurs du compagnon).
- **Migration** (dans le passage 7 → 8 déjà fait, `migrateCopies` de `core/migrations-v913.js`) : 5 exemplaires → 6,
  seulement si la sauvegarde est d'avant le format 8 ; copie d'avant migration gardée (`idle-rpg.save.pre-v7`).
- **Cloud** : `reconcile` ne pousse jamais une sauvegarde d'un format inférieur à celle du cloud (renvoie 'none').
- **Signatures SSR** (ultime de rôle + `also` heal, shield ou gold, valeur fixe sans étoile) ; 5 compétences
  homonymes renommées ; Rôdeur (1/5 s) et Ombre (0,8/4 s) relevés ; compétence propre du Hibou (« Piqué nocturne »).

## Mesure en version dev : les comptes bas

Outil : `tools/measure-heros-v913.mjs` (moteur réel en Node, graine fixe), sur les sauvegardes de
`tools/measure-v913.mjs --dump-saves` (début étape 45, milieu 120, fin 180), auxquelles on donne une équipe
(2 compagnons niv. 20 + Feu follet niv. 20, même nombre d'exemplaires). « Avant » = le même outil sur le dépôt
d'avant le lot 1 (`--root`). Campagne : 15 min d'avance automatique sans aucun achat.

| Sauvegarde (étape) | Équipe | Exemplaires (★) | Étape max après 15 min, avant → après | Dégâts réels des compagnons |
|---|---|---|---|---|
| debut (45) | Seigneur de l'ombre + Reine démone | 1 (0★) | 80 → 80 | 9 % |
| debut (45) | Seigneur de l'ombre + Reine démone | 2 (1★) | 80 → 80 | 4 % |
| debut (45) | Seigneur de l'ombre + Reine démone | 3 (2★) | 80 → 80 | 5 % |
| debut (45) | Seigneur de l'ombre + Reine démone | 4 (3★) | 80 → 80 | −1 % |
| debut (45) | Seigneur de l'ombre + Reine démone | 5 (4★) | 80 → 80 | −0 % |
| debut (45) | Barbare + Lame rose | 1 (0★) | 70 → 70 | 6 % |
| debut (45) | Barbare + Lame rose | 2 (1★) | 70 → 70 | −1 % |
| debut (45) | Barbare + Lame rose | 3 (2★) | 70 → 75 | 25 % |
| debut (45) | Barbare + Lame rose | 4 (3★) | 75 → 75 | 2 % |
| debut (45) | Barbare + Lame rose | 5 (4★) | 75 → 75 | 2 % |
| debut (45) | Rôdeur + Pyromancienne | 1 (0★) | 60 → 60 | 1 % |
| debut (45) | Rôdeur + Pyromancienne | 2 (1★) | 60 → 60 | −1 % |
| debut (45) | Rôdeur + Pyromancienne | 3 (2★) | 60 → 60 | −1 % |
| debut (45) | Rôdeur + Pyromancienne | 4 (3★) | 60 → 60 | −1 % |
| debut (45) | Rôdeur + Pyromancienne | 5 (4★) | 60 → 60 | 3 % |
| milieu (120) | Seigneur de l'ombre + Reine démone | 1 (0★) | 135 → 140 | 40 % |
| milieu (120) | Seigneur de l'ombre + Reine démone | 2 (1★) | 135 → 140 | 35 % |
| milieu (120) | Seigneur de l'ombre + Reine démone | 3 (2★) | 140 → 140 | 4 % |
| milieu (120) | Seigneur de l'ombre + Reine démone | 4 (3★) | 140 → 140 | −1 % |
| milieu (120) | Seigneur de l'ombre + Reine démone | 5 (4★) | 140 → 140 | −1 % |
| milieu (120) | Barbare + Lame rose | 1 (0★) | 135 → 140 | 40 % |
| milieu (120) | Barbare + Lame rose | 2 (1★) | 135 → 140 | 39 % |
| milieu (120) | Barbare + Lame rose | 3 (2★) | 140 → 140 | 3 % |
| milieu (120) | Barbare + Lame rose | 4 (3★) | 140 → 140 | 3 % |
| milieu (120) | Barbare + Lame rose | 5 (4★) | 140 → 140 | −3 % |
| milieu (120) | Rôdeur + Pyromancienne | 1 (0★) | 120 → 130 | 132 % |
| milieu (120) | Rôdeur + Pyromancienne | 2 (1★) | 120 → 130 | 133 % |
| milieu (120) | Rôdeur + Pyromancienne | 3 (2★) | 120 → 130 | 129 % |
| milieu (120) | Rôdeur + Pyromancienne | 4 (3★) | 130 → 135 | 34 % |
| milieu (120) | Rôdeur + Pyromancienne | 5 (4★) | 135 → 135 | 0 % |
| fin (180) | Seigneur de l'ombre + Reine démone | 1 (0★) | 200 → 200 | 0 % |
| fin (180) | Seigneur de l'ombre + Reine démone | 2 (1★) | 200 → 200 | −3 % |
| fin (180) | Seigneur de l'ombre + Reine démone | 3 (2★) | 200 → 200 | −1 % |
| fin (180) | Seigneur de l'ombre + Reine démone | 4 (3★) | 200 → 201 | 23 % |
| fin (180) | Seigneur de l'ombre + Reine démone | 5 (4★) | 201 → 201 | 10 % |
| fin (180) | Barbare + Lame rose | 1 (0★) | 200 → 200 | 4 % |
| fin (180) | Barbare + Lame rose | 2 (1★) | 195 → 200 | 41 % |
| fin (180) | Barbare + Lame rose | 3 (2★) | 200 → 200 | 3 % |
| fin (180) | Barbare + Lame rose | 4 (3★) | 200 → 201 | 20 % |
| fin (180) | Barbare + Lame rose | 5 (4★) | 201 → 201 | 7 % |
| fin (180) | Rôdeur + Pyromancienne | 1 (0★) | 195 → 195 | 3 % |
| fin (180) | Rôdeur + Pyromancienne | 2 (1★) | 195 → 195 | 2 % |
| fin (180) | Rôdeur + Pyromancienne | 3 (2★) | 195 → 200 | 32 % |
| fin (180) | Rôdeur + Pyromancienne | 4 (3★) | 195 → 195 | −1 % |
| fin (180) | Rôdeur + Pyromancienne | 5 (4★) | 195 → 200 | 37 % |

| Sauvegarde | Exemplaires (★) | Ombre Difficile, avant → après | Reine démone Difficile, avant → après |
|---|---|---|---|
| milieu | 1 (0★) | échec (73 s) → réussi en 72 s | réussi en 56 s → réussi en 58 s |
| milieu | 2 (1★) | échec (73 s) → réussi en 72 s | réussi en 59 s → réussi en 58 s |
| milieu | 3 (2★) | échec (73 s) → réussi en 71 s | réussi en 58 s → réussi en 58 s |
| milieu | 4 (3★) | réussi en 71 s → réussi en 69 s | réussi en 59 s → réussi en 55 s |
| milieu | 5 (4★) | réussi en 71 s → réussi en 69 s | réussi en 59 s → réussi en 55 s |
| fin | 1 (0★) | échec (73 s) → réussi en 72 s | réussi en 59 s → réussi en 58 s |
| fin | 2 (1★) | échec (73 s) → réussi en 72 s | réussi en 59 s → réussi en 58 s |
| fin | 3 (2★) | réussi en 73 s → réussi en 72 s | réussi en 58 s → réussi en 58 s |
| fin | 4 (3★) | réussi en 71 s → réussi en 69 s | réussi en 58 s → réussi en 56 s |
| fin | 5 (4★) | réussi en 71 s → réussi en 69 s | réussi en 58 s → réussi en 56 s |

**Lecture.**
- Campagne : les comptes à 1–3 exemplaires (0★ à 2★) passent souvent un mur de plus (+5 étapes en 15 min : milieu
  SSR et SR, milieu R +10, fin SR) ; dégâts réels des compagnons +35 à +130 % là où le mur tombe. À 4–5 exemplaires,
  rien ne change (écart de mesure ±3 %, sauf quand un mur tombe plus tôt). Aucun recul d'étape à 1–5 exemplaires.
- Donjons : Facile et Normal étaient déjà réussis avant (mêmes temps) ; Difficile du Seigneur de l'ombre passe
  d'échec à réussite (0★–2★ au milieu, 0★–1★ en fin) ; à 3★ et plus, donjons 2 à 4 s plus rapides.
- Le début (étape 45) n'ouvre pas encore ces donjons.
- **Verdict** : nettement plus fort pour les comptes bas, sans rendre le jeu trivial dans ces mesures (les murs de
  boss restent). Si le développeur trouve que c'est trop facile en jeu : le poids d'ultime (`ultimateWeight` 0,35)
  se règle de 0,25 à 0,5.
- Limites : une graine, 15 min, aucun achat pendant la mesure ; le dégât « brut » des événements compte les dégâts
  perdus sur un ennemi déjà mort et n'est pas utilisé.

## Noms des signatures (provisoires : le développeur choisit)

| SSR | Nom en jeu (provisoire) | Autres propositions |
|---|---|---|
| Seigneur de l'ombre (hit 30 s / 3,5 + soin 8 %) | Éclipse du néant | Nuit sans fin, Lame d'éclipse, Ombre dévorante |
| Reine démone (burst 30 s / 1,8375 + soin 8 %) | Couronne de cendres | Brasier souverain, Pluie infernale, Trône de flammes |
| Impératrice des glaces (burst 30 s / 1,8375 + bouclier 30 %, 5 s) | Hiver éternel | Zéro absolu, Mur de givre, Sceptre polaire |
| Archange (soin 25 s / 40 % + bouclier 40 %, 5 s) | Aile protectrice | Égide céleste, Halo sacré, Chœur des anges |
| Gardienne sylvestre (soin 25 s / 40 % + or de 3 ennemis) | Récolte sylvestre | Sève dorée, Bosquet nourricier, Moisson des bois |

Renommages (compétence propre portant un nom de compétence de rôle) : Rôdeur « Flèche perçante » → « Tir du rôdeur »,
Pyromancienne « Boule de feu » → « Gerbe de flammes », Prêtresse « Prière » → « Prière de l'aube », Lame rose
« Danse des lames » → « Valse des épines », Grand prêtre « Lumière divine » → « Rayon sacré ».

## Questions au développeur (défauts appliqués)

1. **Afficher R/SR/SSR** à la place de Rare/Épique/Légendaire ? Défaut : **garder Rare/Épique/Légendaire**
   (`rarityLabel` sert aussi à l'équipement ; il faudrait une table propre aux unités).
2. **Le prolongement du Cri par `rally`** (`core/combat.js`, castCompanion) est-il voulu ? Défaut : **gardé**
   (le corriger affaiblirait des kits existants). C'est pourquoi `also` n'accepte pas `rally`.
3. **Nouveaux R, SR ou familiers ?** Défaut : **aucun pour l'instant**.

## Écarts avec le brief (code actuel)

- `ui/panels/summon.js:64` (normalisation du bassin) n'existe plus : l'invocation est sur un écran en 3 lignes. La
  fonction unique `normalizePool` (`core/gacha.js`) sert à `main.js`, `ui/ui.js` (vue mémorisée et clic) et au
  panneau Invocation.
- Lot 0 : haut fait `team3` (= `COMPANIONS.length`, 26) et texte vedette des familiers : déjà faits avant ce chantier.
- `SAVE_VERSION` déjà à 8 (lot E) : pas de nouvelle montée ; la migration 5 → 6 est dans ce même passage.
- Le texte de `core/guide.js` (« Doublon : +1 étoile, puis des gemmes ») et « Doublon : +1 étoile (max 5) » de
  l'invocation restent justes (5★ au maximum pour les deux sortes d'unités) : inchangés.
- Effet `also` sans étoile (valeur fixe), pour que le texte de la fiche reste exact ; « à caler en jeu ».

# Partie B : bannières, mode monde, score (lots 4 à 7)

**Tout est inerte pour les joueurs** : `BANNER_RULES.enabled = false` (`data/banners.js`). Tant qu'il l'est, aucun perso
`bannerOnly` n'existe pour le jeu, aucune bannière ni Archives, budget B = 100 partout. Un seul perso de démonstration,
`demo_ssr` (« Lame du crépuscule », Assassin, sortie n° 1, sprite du Seigneur de l'ombre), sert aux tests et à la
version dev : `npm run build:dev`, puis `/play/?banniere=demo&jour=N` (N de −6 à 15 : J−7 aperçu, J1 à J14, J15 fin).
Pour lancer les sorties : régler `BANNER_RULES.start` (J1 de la sortie 1, minuit local), passer `enabled` à `true`,
remplacer le perso de démonstration par les vrais (un par `release`).

## Préalables

**Revenu réel en tirages sur 14 jours** (`tools/measure-revenu-v913.mjs`, moteur réel, 14 vrais jours : connexion,
combat actif, hors ligne réel, missions et piste, prime, expéditions, 1 donjon Facile/jour, Défi et Tour hebdo ; le
joueur invoque tout ce qu'il gagne, les remboursements de doublons au maximum compris) :

| Sauvegarde | 30 min/jour | 1 h/jour | 2 h/jour |
|---|---|---|---|
| début (étape 45) | 283 | 298 | 315 |
| milieu (étape 130) | 214 | 251 | 262 |
| fin (étape 494) | 242 | 250 | 265 |

Postes principaux (milieu, 1 h) : piste du mois et missions ≈ 6 900 gemmes, hors ligne ≈ 5 900, expéditions ≈ 3 300,
combat ≈ 2 600, connexion 1 820. Sans les remboursements de doublons : environ −30 tirages.
**Plus de 130 tirages partout (214 à 315) : à signaler au développeur** (tableau du brief) — le 3★ (≈ 154 tirages) ne
sera plus un vrai choix, et le 5★ (seuil ≈ 163) non plus. Aucun réglage n'est appliqué (le brief n'en propose aucun
au-delà de 130). Le cadeau de sortie (3 000 gemmes) s'y ajoute : ≈ 244 à 345 tirages par bannière.

**Code serveur** (`server/app.mjs`) : il ne lit de la sauvegarde que niveau, étape, or, gemmes, victoires et triche
(`summarizeSave`, `checkSave`) et refuse un format plus ancien que le sien. Le classement ne lit que ces colonnes.

## Décisions

- **`SAVE_VERSION` reste à 8** (une seule montée pour la v9.1.3, non publiée). La montée 8 → 9 du brief servait à
  empêcher un client ancien d'effacer un perso inconnu. Ici le problème est réglé à la source : `sanitizeState` ne
  l'efface plus, il le garde tel quel dans `companions.unknown` (borné à 100) et le rend au client qui le connaît.
  Un client 9.1.3 qui lit la sauvegarde d'une version future (même format 8) ne perd donc rien ; tous les clients du
  format 8 connaissent déjà `demo_ssr`. Une montée à 9 ne serait nécessaire que pour un changement de format réel.
  (Les clients 9.1.2, format 7, sont déjà bloqués par la montée 7 → 8 et par le serveur.)
- **Tickets** : « 30 tickets d'événement par sortie » → **3 000 gemmes** par sortie (1 ticket = 100 gemmes, même taux
  que la migration du lot E), versées une fois au premier passage pendant la bannière (`claimReleaseGift`).
- **Budget B** (`budget()`, `core/banner.js`) : × B/100 sur le passif et sur hit, burst, soin et rally (plafond soin
  et rally 3 × B/100) ; bouclier et or sans budget (comme sans étoile).
- **Archives** : cibles = 5 SSR permanents + persos dont la bannière est finie ; bassin = permanent + cible.
- **Mode monde** : niveaux (12 ennemis puis le boss du monde, niveau d'ennemi = étape record × (0,5 + 0,05 n)),
  paliers (boss de l'étape record × 0,6 / 0,8 / 1,0 / 1,3 / 1,0 en PV, 120 s), score (60 s, boss qui ne meurt pas,
  sans mécanique d'invocation, hasard à graine fixe). Monde = décor et ennemis d'un monde existant (`world.zone`) :
  aucun nouveau boss, et la liste de la Tour est figée (`TOWER_BOSSES`). Un essai en cours n'est jamais repris au
  chargement (équipe d'avant rendue). Essai gratuit : 0★ niveau 1 à la place du 2e compagnon, niveaux et paliers 1–4.
- **Récompenses** : niveaux (première fois) 30 + 10n gemmes et 20n éclats ; paliers 1–3 gemmes, clés, éclats
  (fragments au 3) ; palier 4 « Décor » et palier 5 « Titre » : enregistrés et affichés dans l'écran du monde
  seulement (il n'existe pas encore de système de décors ni de titres ailleurs dans le jeu).
- **Score en ligne** : le jeu n'envoie rien de plus ; le serveur lit `worlds[perso].score` dans la sauvegarde poussée,
  le valide (perso possédé hors essai, étoiles ≤ doublons possédés et ≤ 5, niveau ≤ niveau possédé et ≤ 20, perso
  dans l'équipe, date non future, dégâts ≤ 1e10 × 1,075^étape record) et garde le meilleur par compte et par perso
  (table `world_scores`). Un score refusé est ignoré, la sauvegarde passe. `GET /api/scores?unit=` : joueurs listés.

## Ce qui est fait (lot par lot)

- **Lot 4** : bassins `banner` et `archive` déclarés dans `BALANCE.summon.pools` ; vedette par `featuredUnit` et
  `summonPool` (donc dans `summonOdds`) ; Légendaire perdu → la vedette (mémoire commune, consommée une fois) ; filet
  50 sur la 1re copie (compteur gardé, figé si possédée, remis à 0 à l'obtention) ; garantie à 60 partagée ; bassin
  permanent gelé (`COMPANIONS`, 8 R / 7 SR / 5 SSR) et rotation hebdomadaire inchangée ; `UNITS` = unités connues ;
  encyclopédie et hauts faits sur les 26 permanents ; textes « trois invocations » → « toutes les invocations ».
  Mesuré : filet 32,85 tirages en moyenne (max 50, P90 50), 3★ 153,7 (P90 220) — conforme au brief.
- **Lot 5** : façade (visage, monde, signature + « Ultime à 3 doublons », filet x/50 avec « Le filet garantit le perso,
  pas sa montée. », stock de tirages) ; « Détails » (rôle, passif à 0★/3★/5★, `skillsBlock`, boss et essai, coûts
  moyens, unités du rôle, synergies avec l'équipe) ; aperçu J−7 et message de fin hors de la fiche ; Archives.
- **Lot 6** : `worldRun` (branche de `currentEncounter`), affinité étendue (×6, passif ×4, équipe +150 %, dégâts
  subis −60 %), neutralisé dans `measureAt` et `forecastSteps`, calendrier J1/J4/J8/J10/J15, paliers calés sur
  `records.bestStage`, Titre, score reproductible (minuteries, effets et hasard remis à zéro), record local.
- **Lot 7** : serveur (table, extraction validée, route), client (`cloud.scores`, repli « Score en ligne »).

## Vérifié

Tests `tests/v913-banner.test.js` (17) et `tests/server.test.js` (score en ligne) : filet 32,7 ± 0,5 et max 50,
compteur figé/gardé/remis à 0, mémoire consommée une fois, garantie partagée, aucun décalage du bassin ni de la
rotation, rôle/aura/sprite de chaque `bannerOnly`, vedette dans `summonOdds`, encyclopédie 100 % sans `bannerOnly`,
sauvegarde v8 identique et perso inconnu gardé, aucun mot de recommandation dans les écrans, score identique sur deux
phases, palier 5 battu par un 0★ niveau 1 offensif sur les comptes de référence bas (étape 45), moyen (130) et haut
(494) — **tous les paliers y sont réussis, y compris ×1,3 : à recaler en jeu** —, validation serveur bornée.
Captures 375×812 de la version dev (bannière J9 et J13, Détails, Archives J15, aperçu J−7, monde, en français et en
anglais : aucun texte français restant).

## Limites et questions au développeur

1. Revenu > 130 tirages / 14 jours (214 à 315) : à trancher (le brief ne propose pas de réglage).
2. Paliers trop faciles sur les comptes de référence (même ×1,3) : cible « meilleure équipe sans le perso » non
   mesurable directement ; les multiples s'appliquent au boss de l'étape record.
3. Décor et Titre : pas de système d'affichage ailleurs (profil, scène) ; noms provisoires.
4. Horloge locale : la bannière suit l'heure de l'appareil (prolongeable en changeant l'heure), comme la Tour.
5. Liste à suivre pour chaque nouveau SSR : `data/banners.js` (en-tête), test de rôle, aura et sprite.
