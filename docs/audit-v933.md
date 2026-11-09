# Ascendrya 9.3.3 — audit (v2, après le cahier de référence)

> **Mise à jour v2** : la section « Correspondance » ci-dessous remplace la section 0 de la v1.

## Correspondance validée par le cahier de référence

| Cahier | Jeu | Fichiers |
|---|---|---|
| **Chevalier** (progression permanente) | le héros du joueur : **14 améliorations permanentes à l'or** (Dégâts, Vitesse d'attaque, Vitalité, Coup critique, Armure, Défense, Régénération, Butin d'or, Dégâts critiques, Double attaque, Vol de vie, **Lien des compagnons**, Esquive, Tueur de boss, Gain d'XP) + niveaux, compétences (Frappe rapide, Tourbillon, Cri, Frappe sacrée), talents, équipement ; apparences cosmétiques | `data/balance.js` `upgrades` (coût `baseCost × costGrowth^n`, paliers ×1,35/×1,75, plafonds `maxLevel` 30 à 1000), `core/economy.js`, `core/stats.js`, `state.upgrades` |
| **Héros** (gacha) | les **22 alliés** (`kind: 'ally'`) : le tirage les appelle déjà « héros » (`core/gacha.js` pool `hero`) | `data/companions.js`, `data/companion-skills.js`, `core/companions.js` |
| **Compagnons / familiers** | les **11 familiers** (`kind: 'pet'`) | idem |

**Chevalier préservé** : aucun des nouveaux systèmes ne touche `state.upgrades`, `data/balance.js upgrades`, les compétences du chevalier ni son équipement. Un test de non-régression figera les coûts et effets des 14 améliorations avant et après. Seul point de contact : « Lien des compagnons » (+3 %/niveau sur les compétences des héros et familiers) reste appliqué tel quel, **après** le nouveau calcul (pas de double comptage).

**Conflit à trancher** : le cahier parle de « 4 classes de compagnons » ; avec cette correspondance, les **héros** ont 6 rôles réels (Gardien, Archer, Mage, Assassin, Soutien, Berserker) et les **familiers** n'ont pas de rôle. Proposition : équipement pour héros ET familiers, 4 classes d'équipement = Attaquant (Archer, Mage, Assassin, Berserker), Défenseur (Gardien), Soutien (Soutien), Familier (tous les familiers, emplacements anatomiques : crocs/griffes runiques, collier/carapace, rune). Le cahier mentionne aussi un « équipement individuel » des héros : c'est le même système.

---

## (v1) : compétences, doublons, ressources, équipement des compagnons (aucun code modifié)

## 0. Point de vocabulaire à trancher d'abord (bloquant)

Dans le jeu actuel, **« héros » désigne deux choses différentes** :

| Dans le cahier des charges | Dans le jeu |
|---|---|
| « Héros SSR » obtenus par invocation, 6 exemplaires, fragments SSR universels, ~2 nouveaux par mois | Ce sont les **compagnons** de type allié (`data/companions.js`, `kind: 'ally'` : Archange, Reine démone, Grombar…) et les **familiers** (`kind: 'pet'`). Ils ont déjà rareté, niveaux 1–20, doublons (6 exemplaires), compétences, ultime au 4ᵉ exemplaire, fragments SSR. |
| — | Le **héros** = le chevalier du joueur. Ses « héros » (`data/heroes.js` : Paladin, Sorcière, Séraphine…) sont des **apparences cosmétiques sans aucun bonus** depuis la 9.2.8 (décision précédente). Ses compétences (`data/skills.js` : Frappe rapide, Tourbillon, Cri, Frappe sacrée, niveaux 1–50, points de compétence par niveau) sont communes à toutes les apparences. |

**Recommandation** : appliquer les parties 1 à 3 (3 compétences, doublons, ressources universelles) aux **unités
invoquées (compagnons alliés et familiers)**, qui ont déjà doublons et fragments SSR ; garder le chevalier et ses
apparences tels quels (cosmétiques). La partie 4 « équipement des compagnons » vise alors les mêmes unités.
Conséquence : parties 1–3 et 4 portent sur les mêmes personnages : c'est cohérent (un SSR se développe par ses
compétences, ses doublons et son équipement).

## 1. Compétences — existant

| Élément | État |
|---|---|
| Compagnon : passif (bonus de stats de l'équipe, `passive`) | ✅ 1 par compagnon, sans niveaux propres (grandit avec niveau et doublons) |
| Compétences actives | ✅ 2 par rôle (`data/companion-skills.js` TEMPLATES : ex. Mage = Boule de feu, Nova de givre) déclenchées automatiquement (`every`) |
| Ultime | 🟡 existe (3ᵉ compétence du rôle ou signature SSR) **mais débloqué au 4ᵉ exemplaire** (`SKILL_RULES.ultimateCopies = 4`) → à changer : disponible dès le 1ᵉʳ |
| Niveaux de compétence (1–10, coûts) | ➕ n'existent pas (puissance = rareté × doublons × niveau du compagnon) |
| Textes avant/après | 🟡 fiche du compagnon : nom, cadence, effet actuel |
| Effets visuels des compétences | ✅ gestes et effets par rôle (`render/scene.js` allyGesture, `render/skill-fx.js`) |

**Écart avec le cahier** : il y a aujourd'hui **2 actives + 1 ultime**, le passif est un bonus de stats.
Proposition : passif = le `passive` actuel (rendu évolutif, niveaux 1–10) ; active = la 1ʳᵉ compétence actuelle ;
ultime = l'ultime actuel. La 2ᵉ active actuelle (ex. Nova de givre) devient **l'effet ajouté par l'active au niveau 5**
(palier fonctionnel), pour ne rien perdre et rester à 3 compétences.

## 2. Doublons — existant

| Élément | État |
|---|---|
| 6 exemplaires max (`COMPANION_RULES.maxCopies = 6`) | ✅ |
| Effet actuel des doublons | passif +7,5 %/doublon (`passivePerDuplicate`), puissance des compétences +5 %/doublon (`powerPerDuplicate`), ultime au 4ᵉ |
| Fragment SSR universel = 1 exemplaire d'un SSR possédé, jamais au-delà de 6, jamais pour débloquer | ✅ déjà la règle (`data/economy.js` ssrFragment) |
| Bonus « stats de base » +4/4/4/4/8 % | ➕ (remplace les bonus actuels) ; aujourd'hui les compagnons n'ont des stats propres que dans l'Arène (9.3.2, `core/arena.js` companionProfile, +12 %/doublon) |

Proposition : un seul barème `DUPLICATE_BONUS = [0, 4, 8, 12, 16, 24]` (%) appliqué une fois à la base de l'unité
(passif + puissance des compétences en campagne, PV/attaque/défense dans l'Arène), à la place des bonus actuels.
Migration : rien à rendre (les exemplaires restent), seul le calcul change. 4ᵉ exemplaire = plafond de l'ultime 10.

## 3. Ressources — existant

| Ressource | État |
|---|---|
| Or | ✅ (déjà coût des niveaux de compagnon) |
| Éclats (`materials.shards`) : forge ; Fragments anciens : talents ; gemmes, tickets, écus d'événement, fragments SSR | ✅ |
| Grimoires de combat, Pierres d'ascension, Essences de maîtrise | ➕ (3 nouvelles ressources universelles, comme demandé ; aucune par élément) |
| Donjons « de maîtrise » / « d'ascension » | ➕ (les 5 donjons actuels `data/dungeons.js` donnent éclats et équipement : proposition = ajouter les nouvelles ressources à leur butin plutôt que créer 2 donjons, plus simple) |
| Missions quotidiennes/hebdo, boss, boutique d'événement, paliers de stages | ✅ existent : on y ajoute les ressources |

**Simulation (à refaire avec les vrais taux après validation)** — coûts du cahier, passif/actif 1→10 :
96 grimoires, 16 essences, 109 500 or ; ultime proposé 1→5 : 2+3+5+7 = 17 pierres, puis 6→10 : 9+12+15+19+24 = 79
pierres + 16 essences. Un SSR au maximum ≈ 192 grimoires, 96 pierres, 48 essences.
Revenus proposés (joueur régulier) : ~14 grimoires/jour (missions 6, donjons 8), ~4 pierres/jour, ~1 essence/jour
(boss + hebdo 3). → un SSR « principal » au maximum en ≈ 6–7 semaines, ~2 SSR jouables à niveau correct par mois,
cohérent avec ~2 nouveaux SSR par mois sans tout maximiser. L'or est déjà abondant en fin de jeu : **les coûts d'or
doivent suivre l'étape (× or d'un ennemi de l'étape max, comme les niveaux de compagnon), sinon 35 000 or est
négligeable** → recommandation : coûts d'or en « nombre d'ennemis » (formule existante `upgradeCostKills`).

## 4. Équipement des compagnons — existant

| Élément | État |
|---|---|
| Rôles réels | ✅ 6 rôles alliés (`data/synergies.js` ROLES) : **Gardien, Archer, Mage, Assassin, Soutien, Berserker** + **Familiers** (11, sans rôle humain) |
| Équipement des compagnons | ➕ rien |
| Équipement du héros (63 bases, 4 raretés, affixes, sets, forge, amélioration, recyclage) | ✅ réutilisable pour la rareté, le butin et l'interface |

Classification proposée (4 classes d'équipement, regroupant les rôles réels) :
**Attaquant** (Archer, Mage, Assassin, Berserker), **Défenseur** (Gardien), **Soutien** (Soutien),
**Familier** (créatures).

Emplacements proposés (3 par unité, noms adaptés à l'anatomie) :

| Classe | Offensif | Protection | Accessoire |
|---|---|---|---|
| Attaquant | Arme (+attaque, critique, vitesse) | Armure légère (+PV) | Anneau (+dégâts de compétence) |
| Défenseur | Arme (+attaque) | Armure lourde (+PV, défense, réduction) | Emblème (+bouclier) |
| Soutien | Focalisateur (+puissance de soin/buff) | Robe (+PV) | Talisman (+recharge) |
| Familier | Griffes/crocs runiques (+attaque) | Carapace / collier renforcé (+PV, défense) | Rune ou aura (+compétence) — **jamais d'épée ni d'armure humaine** |

Compatibilité dans les données (`data/companion-gear.js` : `slot`, `classes: [...]`, profils de stats par classe) ;
une pièce peut viser plusieurs classes. Raretés : les 4 existantes. Affichage sur le compagnon : **sans nouveaux
assets, seul un liseré/aura de rareté peut être montré** ; des pièces dessinées sur chaque compagnon demandent des
sprites (PixelLab) : à valider, sinon effets d'aura seulement (honnête : pas d'arme dessinée).
Matériaux : **réutiliser éclats + or** (forge/amélioration existantes), pas de nouvelle monnaie ; équipement trouvé
dans les donjons et l'Arène (Étages) pour ne pas concurrencer le butin du héros.

## Plan (lots) et risques

| Lot | Contenu | Fichiers | Risque | Complexité |
|---|---|---|---|---|
| A | Ultime dès le 1ᵉʳ exemplaire ; 3 compétences ; barème de doublons +4/8/12/16/24 % | `data/companion-skills.js`, `core/companions.js`, `core/combat.js`, `core/arena.js` | équilibrage campagne (ultime plus tôt) → simulation `tools/sim-economy.mjs` | moyenne |
| B | Niveaux de compétence 1–10 (ultime 5, puis 10 au 4ᵉ), effets par niveau et paliers 3/5/8/10, 3 ressources, coûts, sources, migration de sauvegarde | `data/skill-levels.js` (nouveau), `core/`, état, butins | sauvegardes (migration v11), économie | élevée |
| C | Fiche du compagnon refaite (compétences, niveaux, coûts, avant/après, doublons) | `ui/panels/companions.js` | — | moyenne |
| D | Équipement des compagnons (données, butin, équiper/retirer, compatibilité, comparaison, filtres, fiche) | `data/companion-gear.js`, `core/companion-gear.js`, panneau | concurrence avec le butin du héros | élevée |

## Décisions à valider

1. **Vocabulaire** : les parties 1–3 s'appliquent aux compagnons invoqués (alliés + familiers), le chevalier reste cosmétique ?
2. Passif = passif actuel ; active = 1ʳᵉ compétence ; 2ᵉ active actuelle intégrée à l'active au niveau 5 ?
3. Ultime disponible dès le 1ᵉʳ exemplaire (changement d'équilibrage en campagne : accepté ?).
4. Doublons +4/8/12/16/24 % à la place des bonus actuels.
5. Coûts d'or indexés sur l'étape (recommandé) plutôt que fixes.
6. Nouvelles ressources ajoutées au butin des donjons existants (recommandé) plutôt que 2 nouveaux donjons.
7. Équipement : 4 classes et 3 emplacements ci-dessus ; matériaux = éclats + or.
8. Visuel de l'équipement des compagnons : aura/liseré de rareté seulement (aucun asset), ou commande de sprites ?


## Simulation F2P (à confirmer avec les vrais taux après validation)

Coût d'un personnage au maximum (passive 10 + active 10 + ultime 10) : 192 grimoires, 96 pierres d'ascension, 48 essences,
or ≈ 219 000 × facteur d'étape. Or : `coût = base × min(plafond, or d'un ennemi de l'étape max / or d'un ennemi de l'étape 50)` ;
plafond proposé ×40.

| Profil | Grimoires/sem. | Pierres/sem. | Essences/sem. | Personnages « principaux » maximisés par mois |
|---|---|---|---|---|
| Occasionnel (1 session/jour, donjons partiels) | 50 | 12 | 4 | ≈ 0,5 (passive/active ~niv. 7, ultime 5) |
| Régulier (missions + 3 donjons/jour) | 100 | 28 | 9 | ≈ 1,5 |
| Très actif (tout + événements) | 150 | 40 | 14 | ≈ 2,5 |

Avec ~2 nouveaux SSR par mois : un joueur régulier développe sérieusement 1 à 2 héros par mois et garde les autres au
niveau « utilisable » (passive/active 5 : 17 grimoires chacune) : pas d'accumulation de personnages impossibles à
monter, et pas de maximisation générale rapide. Le +24 % de doublons à 6 exemplaires sera mesuré avec
`tools/sim-economy.mjs` (campagne, boss, World Boss, Arène) avant validation.

## Équipement : améliorations

Réutiliser les **éclats** (`materials.shards`, déjà universels, recyclage de l'équipement du chevalier) + or :
amélioration +1 à +10 (coût éclats × facteur de rareté, comme `upgrade` des objets du chevalier). Pas de nouvelle
monnaie. Sources de pièces : Étages de l'Arène, donjons, boss (taux bas pour ne pas concurrencer le butin du chevalier).
Visuel hybride : aura et particules par rareté (faisable tout de suite, sans asset) ; sprites seulement pour quelques
pièces emblématiques (à commander, **non créés**).

## Décisions restantes

1. Correspondance ci-dessus (chevalier / héros = alliés / familiers) : OK ?
2. Équipement pour héros **et** familiers, 4 classes d'équipement ci-dessus : OK ?
3. Plafond du coût d'or ×40 : OK ?
4. Ordre : A (3 compétences, ultime dès le 1er, doublons) → B (niveaux + ressources + sources + migration) → C (fiches) → D (équipement) ?
