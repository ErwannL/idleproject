# Héros, doublons et invocation — v9.1.3 (doc4, partie A)

Lots 0 à 3 faits (un commit chacun). Partie B (lots 4 à 7) : pas commencée, comme prévu.

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
