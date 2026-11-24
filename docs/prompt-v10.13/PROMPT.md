# Ascendrya 10.13 : le PC passe au style « vrai jeu », illustré comme la Forge (sans aucun retour en arrière)

> **Pour Claude** :
> - Copie ce dossier dans le dépôt, sous `docs/prompt-v10.13/`.
> - Ouvre avec l'outil Read, dans cet ordre : `images/joueur/j01-maquette-chatgpt-fiche.jpg` (la référence du joueur), `images/joueur/j02-forge-le-bon-modele.jpg` (l'écran que le joueur trouve réussi), puis chaque maquette de `images/maquette/` et chaque capture de `images/actuel/` citée dans la section que tu traites.
> - Les fichiers HTML des maquettes sont dans `maquette-source/` : ils donnent les tailles, couleurs et espacements exacts. Les images qu'ils appellent (`a/…`) sont les fichiers du dépôt (`assets/ui/art106/`, `assets/ui/art104/`, `assets/ui/art98/`, `assets/hd/`, `assets/sprites/`).
> - Base : `main` au commit `9f54f609` (10.12.1). **Les prompts 10.11, 10.11.3, 10.11.4 et 10.12 restent valables : rien de ce qu'ils ont corrigé ne doit revenir** (voir § 0).
> - **Périmètre : le PC d'abord** (fenêtres de plus de 600 px : 1116 × 993, 1366 × 768, 1878 × 1245, 1920 × 1080). Le téléphone garde le kit 10.12, mais reçoit les mêmes changements de fond (§ 2, § 7, § 8, § 9) pour que les deux restent la même application.
> - Travaille par lots (§ 12), un commit par lot, `npm test` vert à chaque commit.

## Ce que dit le joueur (24/11, 18 h 19 à 18 h 26)

> « On a quand même toujours pas une bonne ergonomie, la dernière version vient de sortir. La proportion est meilleure et c'est lisible mais on n'a pas une belle ergonomie de jeu. Les textes comme la Croc de l'Alpha manquent d'illustration, comme sur la photo fournie par ChatGPT pour l'exemple. La possibilité de remettre au niveau un objet ne devrait pas exister. Pour changer un effet pareil, il faudrait voir directement les boutons et les illustrations qui ressortent, là c'est pas visible. Pour l'onglet Compétences l'ergonomie est pas top du tout, on a l'impression d'être sur un jeu par navigateur. »
>
> « Reprends bien les tests de Slayer Legend et Capybara. Pour les talents la présentation est pas si belle. Le très bon point c'est la Forge : elle est bien illustrée et lisible. Les icônes de Marché, Prime, etc. sont mal mises dans le cadre. Au milieu c'est bien, mais pour l'avancée je ne vois plus parce que j'ai des icônes qui se superposent. Pareil Compagnons, ça fait léger la présentation. On doit pouvoir équiper que dans Équipement à mon avis. Bref revois tout, mais pense bien ergonomie dans notre style et fantasy médiévale. La page de Recherche rend pas bien, manque de lisibilité et d'ergonomie également. »
>
> « Là aussi la partie basse, les quêtes et les sorts, ça ne rend pas bien. On doit éviter de faire des retours en arrière. »

## Ce qu'on garde de la Forge (la règle de tout l'onglet)

La Forge (`j02`) plaît parce que : **chaque action a son illustration** (grande image en tête de carte), **un titre court**, **une ligne qui dit ce que ça fait**, **les coûts en cases illustrées**, et **un gros bouton doré**. Tout écran de la 10.13 suit ce modèle :

1. **Un écran = un grand cadre** sombre à bord doré, coins ornés, **cartouche de titre centré** (icône + nom) et « ? » à droite (comme le kit téléphone 10.12, à la taille PC).
2. **Une illustration pour chaque chose qu'on choisit** : objet, effet, compétence, branche de talent, compagnon, recherche, événement. Jamais une ligne de texte seule à la place d'une image.
3. **Avant » Après** en gros, gain en vert, chiffres alignés à droite (`tabular-nums`).
4. **Coûts en cases** (64 à 72 px) avec « ce que j'ai / ce qu'il faut », rouge s'il manque.
5. **Un seul bouton doré par écran** (l'action conseillée). Les autres boutons sont sombres à bord clair, au moins 44 px de haut.
6. **Des modes en grosses tuiles** avec icône (86 px de haut sur PC), jamais une rangée de petits liens.
7. **Pas de paragraphe** : étiquettes courtes ; l'explication va dans le « ? ».
8. **Tout est centré dans le cadre** : pas de colonne collée à gauche avec du vide à droite.

Couleurs : celles du kit 10.12 (cadre `#121a33` → `#0b1124`, carte `#18223f`, bord `#2c3a66`, or `#c9a14a` / `#f3d27a`, texte `#eef2ff`, doux `#9fb0d8`, gain `#5be37d`, manque `#ff6b6b`) et les raretés de `rarity108.css`.

---

## 0. Règles contre les retours en arrière (à lire avant de coder)

Le joueur l'a dit deux fois : chaque version a cassé quelque chose qui marchait. Pour la 10.13 :

1. **Avant le premier commit**, lance `node tools/capture.mjs` (ou `tools/shot-109.mjs`) en **1116 × 993, 1366 × 768, 1878 × 1245, 1920 × 1080, 412 × 915 et 390 × 844**, sur `tests/fixtures/endgame.json` **et** sur une partie neuve, pour chaque onglet et chaque mode. Range-les dans `docs/screenshots/v10.13/avant/`. Ce sont les références.
2. **Liste des acquis à ne pas perdre** (vérifie-les à chaque lot, ils viennent des prompts 10.11 à 10.12) :
   - onglets et icônes centrés dans leur cadre, aucun chevauchement (10.11) ;
   - les compagnons ne passent plus sur les cadres dans Héros (10.11) ;
   - dans Améliorations, les effets à monter sont visibles (10.11) ;
   - au Bastion, on comprend qu'il faut mettre un ouvrier (10.11) ;
   - la barre du bas et les bulles du téléphone (10.11.3, 10.11.4) ;
   - tout le kit téléphone 10.12 (cadre, cartouche, `.m-tabs`, `.m-modes`, une seule `.m-btn-gold`, fiche plein écran) ;
   - le tutoriel et le doigt guide d'une partie neuve (aller jusqu'à l'étape 10 sans blocage).
3. **Rien n'est supprimé de l'écran sans être remplacé** : chaque action d'aujourd'hui reste accessible, au plus à un appui de plus. Seule exception voulue : « Remettre au niveau » (§ 2).
4. **Ne pas changer les règles du jeu, les coûts ni les gains**, sauf la suppression de « Remettre au niveau » (§ 2). C'est une version d'affichage et d'ergonomie.
5. **Ne pas supprimer de test existant** pour le faire passer. Un test qui vérifie « Remettre au niveau » est **réécrit** pour vérifier qu'il n'existe plus (§ 2). Tout autre test qui casse veut dire qu'on a cassé un acquis : on corrige le code, pas le test.
6. Les audits existants restent verts à chaque lot : `tools/audit-109.mjs`, `tools/mobile-audit.mjs` (`MOBILE_AUDIT=1`), `tools/compare-1012.mjs`, `tools/audit-overflow.cjs`, `tools/e2e-beginner.mjs`.
7. À la fin, **planche avant / après** de chaque écran dans `docs/screenshots/v10.13/` (images côte à côte). Tu l'ouvres avec Read et tu la compares aux maquettes : si un écran est moins lisible qu'avant, il n'est pas fini.

---

## 1. Le kit PC (`src/ui/desk-kit.css`, et les mêmes fonctions de `src/ui/mobile-kit.js`)

Le PC utilise **les mêmes composants** que le téléphone (`mFrame`, `mTitle`, `mModes`, `mTile`, `mStat`, `mCost`, `mBtnGold`, `mBtn`…), avec une mise en page à colonnes. Une seule source pour les deux : quand on change un composant, le PC et le téléphone changent ensemble.

- Nouvelle feuille `src/ui/desk-kit.css`, chargée après `mobile-kit.css`, toutes ses règles sous `#app:not(.m-phone)`. Elle ne touche pas au téléphone.
- Cadre : `left: 390px` après la mini-scène (comme aujourd'hui), `padding-top: 80px` pour le cartouche **à l'intérieur** du cadre (il ne doit pas toucher les onglets du haut).
- Grilles : 3 colonnes pour Équipement et Compétences (`380px 400px minmax(0,1fr)` et `340px minmax(0,1fr) 470px`), 2 colonnes pour Compagnons et Recherches (`minmax(0,1fr) 460–470px`). En 1116 × 993, les colonnes passent à 2 puis la troisième sous la deuxième (jamais de défilement horizontal).
- Tailles PC : case d'objet 64 px dans le sac, 110 px en tête de fiche ; tuile de mode 86 px ; bouton doré 62 px ; texte au moins 14 px, chiffres importants 17 à 22 px.

---

## 2. Supprimer « Remettre au niveau » partout

Le joueur ne veut plus qu'on puisse remettre un objet au niveau de son étape. On retire la fonction **entièrement** :

- `src/core/forge.js` : supprimer `sharpenCost` et `sharpenItem` (vers les lignes 96 à 108) et leurs exports.
- `src/data/balance.js` : supprimer `sharpenShardsPerLevel` (l. 334) et `sharpenRarityFactor` (l. 353).
- `src/main.js` : supprimer l'import (l. 50) et l'action `sharpen(id)` (l. 386).
- UI : `src/ui/panels/forge.js` (l. 49, 69, 213), `equip-phone.js` (l. 302, 502–504), `equip-sheet.js` (l. 134–136, 299–318), `ui.js`, `ui-vfx.js`, `hold.js` (le maintien appuyé sur le bouton), le conseil `sharpen` du guide.
- Textes : `src/i18n/en.js`, `en-910.js`, `en-971.js`, `en-103-audit.js`, `en-103-equip.js`, `en-1040-pages.js`, `ko-103-equip.js`, `ko-1040-pages.js`, `ko-971.js` (supprimer les clés devenues inutiles ; `tests/i18n.test.js` doit rester vert).
- La ligne « Plus : changer l'effet, remettre au niveau » (`j04`) devient « Plus : changer l'effet » puis disparaît sur PC, car les options de Reforger sont visibles (§ 3).
- Tests : `tests/v1040-pages.test.js` (l. 100–123), `tests/v4.test.js` (l. 232–235), `tests/v1012-equip.test.js`, `tests/v1080.test.js` vérifient aujourd'hui l'affûtage. Réécris-les pour vérifier : (a) aucune fonction `sharpen*` exportée, (b) aucun bouton « Remettre au niveau » dans aucune fiche (PC et téléphone), (c) une vieille sauvegarde se charge sans erreur. Outils : `tools/e2e-1040-pages.mjs`, `tools/measure-equipement-v913.mjs` (retirer la mesure d'affûtage).
- **À la place**, l'avertissement « Presque sans effet : niveau d'objet 310 » 325 » devient une étiquette **« ⚠ Objet dépassé · Niv. 310, ton étape : 325 »** avec un bouton sombre **« Trouver mieux › »** : il ouvre le sac filtré sur cet emplacement, trié par gain, et s'il n'y a rien de mieux, la Forge › Fabriquer sur cet emplacement. Le bouton doré de la fiche reste « Améliorer » (ou « Équiper » si l'objet n'est pas porté).
- Vérifie la partie neuve : au bout de 2 minutes, un joueur neuf reçoit déjà « Remettre au niveau (6 éclats) » en gros bouton doré (`images/actuel/a03-fiche-joueur-neuf-telephone.jpg`). Après la 10.13, il voit « Améliorer » et, si besoin, « Trouver mieux ».

---

## 3. Héros › Équipement et la fiche d'objet (PC) — maquettes `m01` et `m02`

Actuel : `a01-equipement-pc.jpg`, `j14-equipement-pc.jpg`, `j03`. Référence du joueur : `j01`.

Trois colonnes dans le cadre « Équipement » :

1. **Personnage** : rangée « qui » (Héros, puis les compagnons de l'équipe, en tuiles avec portrait), grand portrait, nom, classe, niveau avec barre, **Puissance** en gros chiffres dorés, les 6 emplacements en cases de rareté avec « +N », statistiques en 2 × 2, puis « Équipement rapide » (bouton sombre) et « Ensembles ».
2. **Sac** : tête « Sac 86 / 200 », filtres en boutons à icône (Tout, Arme, Casque, Armure, Collier, Anneau, Bracelet ; **plus de `<select>`**), tri, grille de 5 colonnes de cases 64 px avec flèche verte ou rouge.
3. **Détails de l'équipement** (comme `j01`) : **grande case illustrée 110 px** (l'image de l'objet, `assets/ui/art106/item_*.png` dans le cadre de rareté `frame_*.png`), nom (« Croc de l'Alpha »), pastilles de rareté et de type, barre de Renfort « +3 / 13 », cadenas et « ⋯ » ; statistique principale en grand puis les autres ; l'effet spécial avec **son icône** ; la ligne Musée ; puis la **rangée de 3 modes** « Améliorer · Reforger · Équiper » (tuiles 86 px avec icône) et le **panneau du mode choisi**.

**Mode Améliorer** (`m01`) : « +3 » » « +4 » en gros, Dégâts « 134,8 K » » « 149,3 K », Puissance « +0,4 % », coûts en cases (éclats, or), bouton doré « Améliorer ».

**Mode Reforger** (`m02`, la demande « voir directement les boutons et les illustrations ») : **trois cartes illustrées côte à côte, toujours visibles** (plus de menu replié « Plus… ») :
- « Changer l'effet » : illustration (`forge_step_*` ou une nouvelle image, voir § 10), l'effet actuel avec son icône, coût « 20 éclats », bouton doré quand c'est l'action conseillée ;
- « Relance orientée » : coût 60, bouton « Choisir… » qui ouvre la liste des effets **avec leur icône** ;
- « Changer le type » : coût 40.
Après un changement d'effet, l'ancien et le nouveau effet s'affichent côte à côte (« Avant / Après ») avec « Garder » et « Revenir ».

Les objets des compagnons s'équipent **ici**, en choisissant le compagnon dans la rangée « qui » (voir § 6).

---

## 4. Héros › Compétences (PC) — maquette `m03`

Actuel : `a04-competences-pc.jpg`, `j05` (« on a l'impression d'être sur un jeu par navigateur » : petites cases alignées à gauche, grand vide, détail sans image).

- Pastille en haut à gauche « ✦ Points : 0 (+1 par niveau du héros) » ; « Répartir les points » passe en bouton sombre dans la colonne gauche.
- **Colonne gauche « Ta barre de combat »** : le héros sur un fond de monde, ses **3 emplacements ronds** (bord doré, touche 1, 2, 3 ; vide en pointillés avec « + »), « 3 attaques actives sur 3 · elles partent seules », puis les **boosts** Q W E R T en tuiles avec durée.
- **Colonne centrale** : deux modes « Attaques » et « Boosts », chacun avec son interrupteur « Auto ». Les compétences en **cartes 3 × 2** : grande icône 80 px dans un cadre de couleur, nom, étiquette (Coup unique, Zone, Soutien, Lumière), « ×1,8 · toutes les 5 s », jauge de niveau, pastille « Nv 6 », pastille verte « Active 1 » si elle est dans la barre.
- **Colonne droite (détail)** : **aperçu en combat** (le héros, l'effet `fx_*`, deux monstres), nom, étiquette, une ligne de description, « Nv 5 » » « Nv 6 », lignes Avant » Après (Dégâts, Recharge), coût en case (« 0 / 1 pt » en rouge s'il manque, avec « le prochain arrive au niveau 152 »), bouton doré « Améliorer · 1 pt » (grisé s'il manque des points), bouton sombre « Mettre dans la barre » / « Retirer de la barre (place 2) ».
- On met une compétence dans la barre en cliquant un emplacement puis une carte, ou en glissant la carte sur l'emplacement.

---

## 5. Héros › Talents et Renaissance (PC) — maquettes `m04` et `m05`

Actuel : `a05-talents-pc.jpg`, `a06-renaissance-pc.jpg`, `j06`.

**Talents** : pastille « Fragments : 12 », trois modes « Talents · Arbre avancé · Renaissance ». Les **3 branches en grandes cartes illustrées** (Attaque rouge, Or et butin doré, Survie verte ; image de branche `talent_region_*` ou icône en grand) : « Palier 3/15 » avec une piste de 15 crans, la carte « Prochain talent » (icône, nom, effet en vert), le coût en fragments et « Apprendre » (doré sur la branche conseillée, sombre sur les autres). Dessous, **« Ce que tes talents te donnent déjà »** : 6 tuiles (dégâts, PV, or, critique, défense, expérience). En bas : « Voir l'arbre complet (3 autres branches) › » et « Apprendre le meilleur ».

**Renaissance** : à gauche le **phénix en grand** sur fond de monde, « Renaissance », « 2 déjà faites · prestige actuel ×1,90 ». À droite : Puissance **avant » après** en gros chiffres, « Ce que tu gagnes » en 3 tuiles (fragments, ×1,50 pour toujours, pouvoir gardé), « Ce qui se passe » (retour à l'étape 1, temps pour revenir, ce qui est gardé en vert, ce qui est remis à zéro en rouge), la bande verte « Rentable maintenant » avec « +10 étapes : +95 », le gros bouton doré « Renaître · +91 », puis « Bonus éternels et stellaires › ».

---

## 6. Équipe › Compagnons (PC) — maquette `m06` ; « on équipe seulement dans Équipement »

Actuel : `a07-compagnons-pc.jpg`, `j07`, `j08` (fiche avec « Équiper… »).

- **Bandeau « Ton équipe »** illustré (fond du monde actuel, les 3 compagnons en grand avec « Avant / Arrière », le familier), « Puissance d'équipe » à droite.
- Les préréglages (« Chasse aux monstres », « Farm économique », « Chasse aux boss ») en boutons sombres, et **un seul bouton doré « Meilleure équipe (+23 %) »**.
- Filtres « Compagnons 20 · Familiers 6 », Rareté, Élément.
- **Grille 7 colonnes de cartes portrait** (96 px), cadre de rareté, « Niv. 20 », étoiles, pastille verte « Équipe » pour ceux qui combattent ; ceux qu'on n'a pas : cadenas, « ??? ».
- **Fiche à droite (toujours visible, pas de fenêtre)** : grand portrait sur fond de couleur de rareté, « ▶ Voir en action », nom, niveau, étoiles, pastilles (rareté, élément, rôle), 3 statistiques en tuiles, **3 compétences en cartes illustrées**, l'éveil en vert, puis le bouton doré **« Mettre dans l'équipe »** (le mot « Équiper… » disparaît ici : il prêtait à confusion), et les boutons sombres « Objets portés › » et « Histoire ».

**Équiper seulement dans Équipement** (lecture retenue de la demande du joueur) : tout ce qui met **un objet** sur quelqu'un se fait dans Héros › Équipement.
- Retirer de Compagnons le bouton « ⬆ Équiper toute l'équipe » (`companions.js` l. 192 et l. 341). L'action `gear-team` reste, et passe dans Héros › Équipement sous le nom « Équipement rapide · toute l'équipe ».
- « Objets portés › » ouvre Héros › Équipement avec ce compagnon choisi dans la rangée « qui ».
- Placer un compagnon dans l'équipe (`ask-replace` / `replace-companion`) reste dans Compagnons, renommé « Mettre dans l'équipe », puis « Qui remplacer ? » avec les portraits.
- Le guide et le tutoriel qui pointaient « Équiper toute l'équipe » pointent maintenant vers Équipement.

---

## 7. Bastion › Recherches (PC et téléphone) — maquette `m07`

Actuel : `a08-recherches-pc.jpg`, `j09` (le livre est beau mais les noms sont écrits sur l'image, on ne lit rien, et on ne comprend pas pourquoi « Lancer » est gris).

- Bouton « ‹ Carte du Bastion » en haut à gauche, ressources en haut à droite.
- **Trois branches en grandes tuiles illustrées** (`research_branch_*`) avec un sous-titre (« Dégâts, PV, critique · 0/57 »).
- Les paliers I à V en boutons (le palier fermé avec cadenas et sa condition au survol).
- **Le livre reste**, mais en page claire et unie (parchemin) : nœuds ronds de 112 px (`research_node_*`), **nom en dessous en 18 px foncé sur fond clair**, effet ou condition en 14 px, niveau « 0 / 15 » en pastille, cadenas pour ce qui est fermé, liens en pointillés **entre les cercles, jamais sur le texte**. Lecture de gauche à droite.
- **Si la Bibliothèque n'est pas construite**, un bandeau en haut du livre le dit, avec le bouton « Construire › » (au lieu d'un petit texte rouge sous un bouton gris).
- Détail à droite : grande image du nœud, nom, une ligne d'ambiance, « +0 % » » « +2 % », coûts en cases (or, éclats, temps), la raison si on ne peut pas (« 🔒 Il faut d'abord la Bibliothèque »), le bouton doré (« Lancer », ou « Construire la Bibliothèque › »), « ✓ gardées après chaque Renaissance », et en bas **les 5 ouvriers** en cases (libre / occupé avec temps restant).

---

## 8. Écran de combat : événements, carte de zone, quêtes, bas d'écran (PC et téléphone) — maquette `m08`

Actuel : `a09-combat-pc.jpg`, `a10-combat-joueur-neuf-pc.jpg`, `j10` à `j13`.

1. **Événements** (`hud-quests.js`, `hud106.css`) : aujourd'hui l'image dépasse du cadre ou colle en haut, et le minuteur chevauche le bas. Chaque événement devient : un **cadre carré de 76 px** (PC) / 56 px (téléphone) avec l'image **centrée, 58 px, `object-fit: contain`**, le minuteur dans une pastille **sous** le cadre (qui mord de 10 px sur le bord, sans couvrir l'image), le nom dessous, la pastille rouge en haut à droite **à l'extérieur** de l'image. Bord vert quand c'est prêt. Toute la rangée dans un seul cadre doré.
2. **Carte de zone** (`#zone-card`) : aujourd'hui les compteurs (3/3, 0/3, 0/1) passent sur la piste des étapes (`j11`). Nouvelle carte à **trois lignes** : titre (crâne, « Terres maudites 6-13 », pastille « ×2 ☾ »), **piste** des étapes (crans verts, cran actuel doré, crâne du boss au bout), puis **les compteurs dans leur propre rangée** de 3 cases égales. Rien ne se chevauche, quelle que soit la largeur.
3. **Chemin du héros et Carnet du jour** : même cadre doré que la carte de zone, même largeur (360 px), titres en petites capitales dorées, lignes de 44 px avec icône, terminé en vert avec « ✓ ».
4. **Bas d'écran** : aujourd'hui la vague, la malédiction, les PV, le sort, « Tout récupérer » et le coffre flottent sur le mur de briques (`j12`). Ils passent dans **une seule console** en bas de la scène (cadre doré, coins ornés, fond sombre), en trois blocs :
   - à gauche « Attaques et Ultime » : les emplacements de compétence en cases de 84 px avec touche et recharge en cadran ;
   - au centre « Vague et héros » : barre de vague (« Vague 2 / 5 · Boss dans 3 étapes »), barre de PV du héros dessous, puis les étiquettes (malédiction en rouge, message du moment, retentative) sur une ligne ;
   - à droite **le bouton doré « Tout récupérer (24) »** avec sa ligne de détail, et le **coffre de butin** dans sa case avec pastille.
   Sur téléphone : même console, en deux lignes (sorts + Tout récupérer, puis vague et PV), sans toucher à la barre du bas 10.11.4.
5. Les boosts Q W E et « ×1,7 · 1 h 55 » se rangent sous la rangée des événements, alignés à droite ; la bulle « Bonus du moment » ne sort plus de l'écran (elle s'ouvre vers la gauche).
6. À vérifier : sur la capture `a09` d'une partie avancée (1878 × 1245), la rangée des événements n'apparaissait pas ; vérifie qu'elle s'affiche bien sur PC dès qu'un événement existe.

---

## 9. Partie neuve : ce que j'ai vu en jouant 5 minutes (PC 1878 × 1245 et téléphone 412 × 915)

Joueur automatique qui suit le doigt du tutoriel et le Sceau (`images/actuel/a11` et `a12`) :

- **PC** : après « Héros · 1 objet » (1 min 24), plus aucun doigt ni Sceau pendant 3 min 30. Le joueur reste dans Équipement avec 400 à 650 d'or non dépensé et l'or ne bouge plus pendant 75 s à l'étape 5. Il faut qu'un conseil reprenne la main (« Améliore tes Dégâts » sur Améliorations) dès que de l'or attend et que l'étape bloque.
- **Téléphone** : le doigt montre « Héros » pendant que le Sceau ouvre l'Invocation, puis le doigt montre « Équipement » pendant que le Sceau ouvre la Forge : le joueur fait des allers-retours (journal de 3 min 50 à 5 min). **Le doigt et le Sceau doivent toujours montrer la même chose.**
- **Téléphone** : un objet Légendaire tombe à 2 min et sa fiche propose tout de suite « Remettre au niveau » en doré (réglé par le § 2).
- Garde ces deux parcours dans `tools/e2e-beginner.mjs` : aller jusqu'à l'étape 10 sans aller-retour de plus de 2 fois entre deux onglets, et jamais plus de 60 s sans conseil quand de l'or attend.

---

## 10. Images (PixelLab) — seulement si elles manquent

Utilise d'abord ce qui existe (`art106`, `art104`, `art98`, `assets/hd/`). S'il manque une image, ajoute-la à `LISTE-PIXELLAB.md` avec sa taille et un exemple, et mets en attendant l'icône la plus proche :
- 3 illustrations de Reforger (320 × 128, style `forge_step_*`) : « Changer l'effet » (enclume et runes), « Relance orientée » (loupe sur un parchemin d'effets), « Changer le type » (deux armes croisées sur la flamme) ;
- 3 bannières de branche de talent (320 × 190) : Attaque, Or et butin, Survie ;
- un bandeau « Bibliothèque à construire » (600 × 64, chantier et livre).

---

## 11. Contrôle automatique : `tools/desk-audit.mjs`

Même principe que `tools/mobile-audit.mjs`, en **1116 × 993, 1366 × 768, 1878 × 1245 et 1920 × 1080**, partie de fin et partie neuve. Il ouvre chaque onglet, chaque mode, une fiche d'objet, une fiche de compagnon et l'écran de combat, et vérifie :
1. pas de défilement horizontal, et le cadre est centré (marge gauche et droite à 24 px près) ;
2. aucun chevauchement entre deux éléments visibles (boutons, cartes, `#zone-card`, rangée d'événements, console du bas) de plus de 2 px ;
3. chaque image d'événement est **entièrement dans son cadre** (rectangle de l'image dans celui du cadre) ;
4. chaque onglet a un cartouche de titre et **au plus un bouton doré visible** ;
5. chaque objet, compétence, branche de talent, compagnon et recherche affichés ont une image (`img` chargée, `naturalWidth > 0`) ;
6. aucun texte « Remettre au niveau » ni action `sharpen` dans le DOM ;
7. aucun bouton « Équiper toute l'équipe » dans Compagnons ;
8. aucun `<select>` visible ;
9. aucun texte sous 12 px.

Les captures vont dans `docs/screenshots/v10.13/apres/`, et `tools/compare-1013.mjs` fabrique la planche avant / après. Lancé dans `npm test` sous `DESK_AUDIT=1`.

## 12. Ordre de travail (un commit par lot)

1. Captures « avant » (§ 0), `desk-kit.css`, `tools/desk-audit.mjs` (il échoue au début, c'est normal).
2. Suppression de « Remettre au niveau » (§ 2), tests réécrits.
3. Héros › Équipement et fiche (§ 3), Reforger visible.
4. Compétences (§ 4).
5. Talents et Renaissance (§ 5).
6. Compagnons et « équiper seulement dans Équipement » (§ 6).
7. Recherches (§ 7).
8. Écran de combat : événements, carte de zone, quêtes, console du bas (§ 8), PC puis téléphone.
9. Partie neuve (§ 9) et `e2e-beginner.mjs`.
10. Audits verts (`desk-audit`, `mobile-audit`, `audit-109`, `compare-1012`), planche avant / après, version `10.13.0` (`package.json`, `package-lock.json`, `src/version.js`), notes de version qui listent aussi **ce qui n'a pas changé**.

À chaque lot, ouvre la capture avec Read à côté de la maquette et de la Forge : même cadre, mêmes illustrations, un seul bouton doré. Si l'écran ressemble à une page web plutôt qu'à la Forge, il n'est pas fini.
