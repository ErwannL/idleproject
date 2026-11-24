# Ascendrya 10.13.1 (téléphone) : les écrans du téléphone illustrés comme la Forge, sans toucher au PC

> **Pour Claude** :
> - Copie ce dossier dans le dépôt, sous `docs/prompt-v10.13-telephone/`.
> - **À faire après le prompt `prompt-v10.13-pc`** (version 10.13.0). Celui-ci a déjà retiré « Remettre au niveau » partout et sorti « Équiper toute l'équipe » de Compagnons, pour le PC comme pour le téléphone. Si ce n'est pas le cas dans le dépôt, arrête-toi et signale-le.
> - Ouvre avec l'outil Read : `images/joueur/j01-maquette-chatgpt-fiche.jpg` (référence du joueur), `images/joueur/j02-forge-le-bon-modele.jpg` (l'écran que le joueur trouve réussi), puis chaque maquette `images/maquette/t01` à `t07` et chaque capture `images/actuel/` citée dans la section que tu traites.
> - Les maquettes sont faites avec `maquette-source/phone.html` (ouvrir avec `#fiche`, `#reforger`, `#skills`, `#talents`, `#comp`, `#rech`, `#combat`) : il donne les tailles, couleurs et espacements exacts. Les images qu'il appelle (`a/…`) sont les fichiers du dépôt (`assets/ui/art106/`, `art104/`, `art98/`, `assets/hd/`, `assets/sprites/`).
> - **Périmètre : le téléphone seulement** (`#app.m-phone`, 412 × 915 et 390 × 844, et l'application Android). **Le PC ne doit pas bouger d'un pixel** (§ 0).
> - Travaille par lots (§ 9), un commit par lot, `npm test` vert à chaque commit.

## Ce que dit le joueur (24/11)

> « Et pour mobile ? » « Attention que ça n'impacte pas la version PC. » « Pour le dernier [les bandes noires de la petite scène], mets bien que pour mobile. »

Les demandes de fond sont celles du prompt PC : des illustrations partout comme la Forge, plus de « Remettre au niveau », changer l'effet visible tout de suite, des Compétences qui ne font pas « jeu par navigateur », des Talents, Compagnons et Recherches plus beaux et lisibles, des icônes d'événement bien cadrées, une carte de zone qui ne se chevauche pas, et un bas d'écran propre.

---

## 0. Règles : aucun impact sur le PC, aucun retour en arrière

1. **Avant le premier commit**, capture chaque onglet, chaque mode, une fiche d'objet et l'écran de combat en **1116 × 993, 1366 × 768, 1878 × 1245 et 1920 × 1080** (partie de fin `tests/fixtures/endgame.json` et partie neuve) dans `docs/screenshots/v10.13.1/pc-reference/`, et en **412 × 915 et 390 × 844** dans `docs/screenshots/v10.13.1/avant/`.
2. **Après chaque lot, les captures PC sont identiques au pixel près** à `pc-reference/` (sauf la scène animée). `tools/compare-1013.mjs` (fait dans le prompt PC) le vérifie et sort en échec sinon. Un lot qui change le PC n'est pas fini.
3. Toute règle CSS de ce prompt va dans les feuilles `mobile-*.css`, **sous `#app.m-phone`** ou `@media (max-width: 600px)`. Aucune règle dans `style.css`, `desk-kit.css` ou une feuille commune sans ce préfixe.
4. Le code : uniquement les rendus du téléphone (`equip-phone.js`, `combat-phone.js`, `profile-m.js`, les branches `m-phone` des panneaux). Si une fonction commune (`mobile-kit.js`, `hud-quests.js`, `ui.js`) doit changer, ajoute une option réservée au téléphone ; le rendu PC reste le défaut, inchangé.
5. Les acquis 10.11.3, 10.11.4 et 10.12 restent : barre du bas et bulles du téléphone, kit (cadre, cartouche, `.m-tabs`, `.m-modes`, une seule `.m-btn-gold`, fiche plein écran), tutoriel jusqu'à l'étape 10.
6. Pas de changement de règles, de coûts ni de gains. Aucun test supprimé pour passer.
7. `tools/mobile-audit.mjs` (`MOBILE_AUDIT=1`), `tools/desk-audit.mjs` (`DESK_AUDIT=1`), `tools/audit-109.mjs` et `tools/e2e-beginner.mjs` restent verts à chaque lot.

---

## 1. Fiche d'objet — maquettes `t01` (Améliorer) et `t02` (Reforger)

Actuel : `a02-fiche-telephone.jpg`, `a03-fiche-joueur-neuf-telephone.jpg`.

- En-tête : grande case 84 px (image de l'objet dans le cadre de rareté), nom, pastilles rareté et type, « Renfort +3 / 13 », cadenas.
- La statistique principale en grand, l'effet avec son icône et « actif » en vert.
- L'étiquette « ⚠ Objet dépassé · Niv. 310 / 325 » avec « Trouver mieux › » quand l'objet est trop bas (le prompt PC a créé l'action ; ici on ne fait que la mise en page).
- Les 3 modes en tuiles : Améliorer, Reforger, Équiper.
- **Améliorer** : « +3 » » « +4 » en gros, Dégâts avant » après, coûts en cases 56 px, bouton doré.
- **Reforger** : les 3 choix **visibles sans rien déplier**, en cartes l'une sous l'autre : image à gauche (96 × 74, style `forge_step_*`), titre, une ligne, coût en éclats, bouton (doré « Changer » sur l'action conseillée, « Choisir… » sombre sur les autres).

## 2. Héros › Compétences — maquette `t03`

Actuel : `t03-competences-telephone.jpg` (6 petites cases en haut, puis un grand vide).

- Pastille « ✦ 0 pt » à gauche du cartouche.
- « Ta barre de combat » : fond de monde, 3 emplacements ronds de 62 px au bord doré, numérotés 1, 2, 3.
- Modes « Attaques » et « Boosts » (avec l'interrupteur Auto à l'intérieur de chaque mode).
- Cartes en grille 3 × 2 : icône 42 px dans un cadre de couleur, nom, « Nv 6 », pastille verte « 1 / 2 / 3 » si elle est dans la barre, bord doré sur la carte choisie.
- Dessous, le détail de la compétence choisie : nom, « Nv 5 » » « 6 », Dégâts avant » après, la raison s'il manque un point (« prochain au niveau 152 »), bouton doré « Améliorer · 1 pt » (grisé s'il manque des points).

## 3. Héros › Talents — maquette `t04` (Renaissance : `m05` en une colonne)

Actuel : `t04-talents-telephone.jpg`.

- Modes Talents, Arbre, Renaissance.
- Chaque branche en carte large : illustration à gauche (78 px, fond de sa couleur), nom, « Palier 3/15 », piste de 15 crans, prochain talent et son effet en vert, coût en fragments, « Apprendre » (doré sur la branche conseillée, sombre sur les autres).
- « Ce que tes talents donnent » en 3 tuiles (dégâts, PV, critique).
- Renaissance : le phénix en haut, Puissance avant » après en gros, 3 tuiles de gains, « Ce qui se passe », bande « Rentable maintenant », bouton doré « Renaître · +91 ».

## 4. Équipe › Compagnons — maquette `t05`

Actuel : `t05-compagnons-telephone.jpg`.

- Bandeau « Ton équipe » illustré (fond du monde, les 3 compagnons, le familier, Puissance d'équipe).
- Un seul bouton doré « Meilleure équipe (+23 %) ».
- Filtres « Compagnons 20 · Familiers 6 » et « Préréglages ▾ » en boutons.
- Grille 3 colonnes de portraits 66 px, cadre de rareté, « Niv. 20 », étoiles, pastille verte « Équipe ».
- Fiche en plein écran au toucher : grand portrait, stats, 3 compétences illustrées, bouton doré « Mettre dans l'équipe », bouton sombre « Objets portés › » (ouvre Héros › Équipement avec ce compagnon).

## 5. Bastion › Recherches — maquette `t06`

- Branches en tuiles illustrées (`research_branch_*`), paliers I à V en boutons.
- Le livre en parchemin clair, **en lignes** : nœud rond 58 px, nom foncé lisible, condition ou effet, niveau « 0/15 » ; cadenas et gris pour ce qui est fermé ; le nœud choisi entouré d'or.
- Bandeau « Bibliothèque à construire · Construire › » en haut du livre quand elle manque.
- En bas, les 5 ouvriers en cases (libre en vert, occupé avec le temps restant).

## 6. Écran de combat — maquette `t07`

Actuel : `t01-combat-telephone.jpg`.

- **Carte de zone en 3 lignes** : titre et « ×2 », piste des étapes avec crâne du boss, puis les 3 compteurs dans leur propre rangée. Plus rien sur la piste.
- **Événements** dans un cadre doré en grille de 4 colonnes : image centrée 28 px dans un carré de 36 px (`object-fit: contain`), minuteur dessous, bord vert quand c'est prêt, pastille à l'extérieur de l'image.
- **Carnet du jour** dans le même cadre que la zone.
- **Une console en bas** de la scène : sorts 1 et 2 et Ultime, « Tout récupérer (24) » et le coffre sur une ligne ; puis la barre de vague (« Vague 2 / 5 · Boss dans 3 étapes »), la barre de PV, et les étiquettes (malédiction, message, Boosts).
- **La scène ne change pas** : les personnages restent au sol, à la même taille (dans la maquette ils sont posés à la main). La console ne recouvre ni leurs pieds ni la barre du bas 10.11.4.

## 7. Téléphone seulement : la mini-scène des onglets

Aujourd'hui, en 412 px, la petite scène en haut des onglets a une bande noire à gauche et à droite. Elle doit remplir toute la largeur. La règle va **uniquement sous `#app.m-phone`** ; **sur PC, la mini-scène ne change pas du tout** (même taille, même place, même cadrage : capture PC identique au pixel près).

## 8. Partie neuve sur téléphone (vue avec un joueur automatique, à confirmer à la main)

Actuel : `a12-partie-neuve-telephone.jpg`.

- Le doigt du tutoriel montre « Héros » pendant que le Sceau ouvre l'Invocation, puis « Équipement » pendant que le Sceau ouvre la Forge : le joueur fait des allers-retours (de 3 min 50 à 5 min). **Le doigt et le Sceau doivent toujours montrer la même chose** sur téléphone.
- Ajoute ce parcours à `tools/e2e-beginner.mjs` en 412 × 915 : étape 10 atteinte sans plus de 2 allers-retours entre deux onglets. Le parcours PC ne doit pas changer.

## 9. Ordre de travail (un commit par lot)

1. Captures de référence PC et « avant » téléphone (§ 0).
2. Fiche d'objet et Reforger (§ 1).
3. Compétences (§ 2).
4. Talents et Renaissance (§ 3).
5. Compagnons (§ 4).
6. Recherches (§ 5).
7. Écran de combat (§ 6) et mini-scène (§ 7).
8. Partie neuve (§ 8).
9. `mobile-audit` complété (image d'événement dans son cadre, une image pour chaque objet, compétence, branche, compagnon et recherche, aucun texte sous 11 px), audits verts, planche avant / après dans `docs/screenshots/v10.13.1/`, **comparaison PC à zéro différence**, version `10.13.1` (`package.json`, `package-lock.json`, `src/version.js`), notes de version qui disent que le PC n'a pas changé.

À chaque lot : capture téléphone ouverte avec Read à côté de la maquette, et comparaison PC. Si l'écran du téléphone ressemble à une page web plutôt qu'à la Forge, il n'est pas fini ; si une capture PC a bougé, le lot est à reprendre.
