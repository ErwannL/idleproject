# Ascendrya 10.4 : prompt complet après le grand test de la 10.3.0 (21/11)

> Archive de la demande du joueur. Le test portait sur la v10.3.0 ; la v10.3.1 (sortie le 21/11) a déjà corrigé une
> partie des points (coffre dessiné dans la scène, ligne « maintenant » de la Forge, feuille de donjon illustrée).
> Les maquettes citées (`captures-v10.4/maquettes/`, `captures-v10.2/maquettes/`) ne sont pas dans le dépôt : le texte fait foi.

## Contexte

Ascendrya 10.3.0, testé le 21/11 :

- Version testée : la release GitHub v10.3.0, installée sur le PC du joueur.
- Partie du joueur : niveau 77, étape 186, 62 clés.
- Revue de tous les menus : 187 écrans sur PC (1116 × 993) et 184 sur téléphone (390 × 844).
- Nouveau joueur : 12 minutes de partie neuve (`?learn`).
- Tests ciblés : équipement, Forge, compétences, donjons, coffre de butin, Bastion.

Règles :

- S'inspirer sans copier. Noms, textes et dessins restent propres à Ascendrya.
- Ne rien casser de ce qui marche (partie 0).
- Chaque partie se termine par ses tests.
- Toutes les nouvelles illustrations se font avec PixelLab, dans le style pixel art du jeu (même palette, même contour, même éclairage que `art101/` à `art103/`). Cela vaut en priorité pour le Bastion : carte du village, chaque bâtiment et ses niveaux, portraits d'ouvriers, icônes de métiers, nœuds de recherches, écran « Pendant ton absence ». Cela vaut aussi pour les bannières de donjons, les tuiles de difficulté, le coffre animé (images du couvercle, lueur, rayon) et les icônes de compétences redessinées. Pas d'image dessinée à la main en CSS, pas d'emoji, pas d'image d'une autre source. Ranger les fichiers dans un nouveau dossier `assets/ui/art104/`, nommés par usage (`bastion_forge_lv2.png`, `research_node_sword.png`…).
- Les maquettes servent pour la mise en page seulement. Leurs emojis et formes CSS sont des places réservées, à remplacer par des images PixelLab.

Ordre conseillé : 1 (pages plein écran), 3 (compétences, bug simple), 5 (coffre), 2 (équipement et Forge dans les pages), 4 (donjons), 6 (Bastion), 7 (petits défauts), 8 (tests de fin).

Retours du joueur (21/11) :

- « il y a du mieux mais on n'a pas encore le style que tu m'avais envoyé, qui était plus lisible pour l'équipement et la forge » ;
- « dans compétence les animations entre les compétences sont toutes les mêmes » ;
- « dans le donjon je mettrais les illustrations en ligne comme dans Epic Seven, ça laisse plus de place à l'illustration ; quand on fait commencer on a une page qui s'ouvre en bas mais trop de texte, on devrait avoir plus d'illustration » ;
- « pour le coffre, on n'y fait pas spécialement gaffe : il faudrait une animation en continu, et pareil quand on drop une arme » ;
- « l'ajout du Bastion et l'amélioration majeure que je ne trouve pas, avec les recherches… une partie gestion serait top, avec pas mal d'illustrations ».

## 0. Ce qui marche, à garder

Revue complète (187 écrans sur PC, 184 sur téléphone) : aucune erreur JavaScript, aucune image cassée, aucun « NaN » ; les seules erreurs réseau viennent du serveur en ligne, injoignable pendant le test.

Nouveau joueur, nettement mieux : étape 24 et niveau 15 en 12 minutes ; jamais plus d'un message à la fois ; « Améliorer » n'apparaît plus que 3 fois et achète tout l'or utile ; les cartes de déblocage passent avant le Sceau.

Contenu de la 10.3, à garder tel quel :

- l'équipement « héros au centre », avec ses places, la fiche à côté, l'avant → après, les coûts « tu as … » et les onglets par personnage ;
- les 4 ateliers numérotés de la Forge ;
- le Bastion et ses bâtiments illustrés, les métiers, les commandes du forgeron et les 3 branches de recherches ;
- l'Arène dans Combat, les portraits de boss et les portes dessinées des donjons.

Illustrations (part de l'image dans chaque onglet) : Équipement 61 %, Donjons 84 %, Arène 67 %, Expéditions 53 %, Bastion (Camp) 103 %.

## 1. Le problème de fond : les grands écrans tiennent dans un panneau trop étroit

Constat

- En 1116 × 993, le panneau de droite fait ≈ 690 px de large. Les maquettes (équipement, Forge, Bastion) étaient pensées pour toute la fenêtre.
- Dans 690 px : le personnage de l'équipement est petit ; les icônes d'objets restent des sprites de 16 px au milieu de cases de 84 px ; les noms d'objets passent sur 2 lignes ; la fiche est une colonne étroite, et le bouton « Renforcer » sort de l'écran.
- L'écran d'équipement compte 427 mots et 92 boutons.
- C'est la raison principale pour laquelle le joueur ne retrouve pas « le style des maquettes ».

À faire : des « pages » plein écran pour Personnage (équipement, étoiles, compétences), Forge, Bastion et la feuille de donjon.

- La page s'ouvre par-dessus toute la fenêtre. La scène continue de jouer derrière, floutée, avec une petite fenêtre de combat en haut à gauche (≈ 280 × 160) pour garder le côté idle.
- Une page a 3 zones : le bandeau des ressources en haut ; le contenu en grand au centre ; la fiche à droite, d'au moins 420 px.
- Mise à l'échelle : les icônes d'objets passent ×3 en entier (48 px). Le personnage fait au moins 300 px de haut sur PC.
- Les panneaux latéraux actuels restent pour les écrans de liste : Améliorations, Missions, Carnet, Boutique…
- Téléphone : la page prend tout l'écran (c'est presque déjà le cas), et la fiche reste une feuille du bas.

Tests — en 1116 × 993, 1280 × 720 et 1716 × 1000 : la page Personnage montre les 6 places, le personnage d'au moins 300 px et la fiche sans défiler ; le bouton « Renforcer » est visible sans défiler.

## 2. Équipement et Forge : finir le travail de la 10.3

Gain réel affiché :

- la fiche de la Dague (niveau d'objet 175) annonce « Puissance 6,1 T → 6,1 T (+0,01 %) » ;
- l'atelier 2 de la Forge propose « Dague +0 → +1 : +0 % de puissance ».

Quand le gain est inférieur à 0,5 %, le dire franchement (« presque sans effet : cet objet est d'un niveau trop bas ») et proposer mieux : « Remettre au niveau de ton étape » ou un autre objet. L'atelier 2 ne doit jamais suggérer un renforcement à +0 %.

Avant → après : n'afficher que les statistiques qui changent. Aujourd'hui, « Vitesse d'attaque +50,4 % → +50,4 % », « Dégâts contre les boss 27 % → 27 % » et « Coup critique 7 % → 7 % » sont listés pour rien.

Icônes d'objets : agrandies ×3 en entier, centrées dans la case, avec le fond à la couleur de la rareté.

Forge : en page plein écran. Schémas en icônes ×3, boutons dorés plutôt que bleus, et la ligne verte « maintenant » en évidence. La fusion détaillée s'affiche à côté des 4 ateliers, sans défiler.

Tests : aucun « +0 % » ni « +0,01 % » proposé comme action ; l'avant → après ne liste que des valeurs qui changent.

## 3. Compétences : chaque compétence a sa propre animation et sa propre icône

Le bug : la vignette animée garde l'effet de la première compétence affichée.

- En cliquant tour à tour les 11 compétences du héros (assassin), `canvas.sk-vignette` garde `data-vfx="sk_heavy_cut"` pour toutes : Coup vif, Éventail de dagues, Lame bénie, Frénésie, Main de Midas…
- Cause : `src/ui/morph.js`, `morphNode`, contient `if (from.tagName === 'CANVAS') return;`. Cette ligne passe avant `syncAttrs`, donc l'attribut `data-vfx` d'un canvas n'est jamais mis à jour.
- Correction : pour un CANVAS, comparer les attributs. Si `data-vfx` (ou un autre attribut) change, remplacer le nœud (`from.replaceWith(to.cloneNode())`) ou appeler `syncAttrs`.

Les icônes se ressemblent : dans `assets/ui/skills98/`, les 6 icônes d'une classe ont la même couleur et presque le même dessin. Pour l'assassin : épée violette, étoile violette, losange violet… Sans lire le nom, on ne les distingue pas.

À faire

- Corriger le bug ci-dessus (une ligne).
- Vignette : passer de 96 à 160 px et la placer en tête de la fiche de la compétence choisie. Chaque compétence a son effet (`sk_whirlwind`, `sk_war_cry`, `sk_holy_smite`, `sk_blade_dance`, `sk_gold_rain`…).
- Les compétences de classe sans effet propre (`sk_assassin_1`, `sk_assassin_2` n'existent pas dans VFX) tombent aujourd'hui sur `combo_burst`. Leur donner un effet à elles.
- Survol ou appui sur une case : l'icône de la case joue sa vignette en petit (48 px), pour comparer d'un coup d'œil.
- Icônes : une couleur dominante par type d'effet, en gardant la classe en cadre. Par exemple : coup unique en rouge, zone en orange, déplacement en bleu, soutien en or. Redessiner les 6 icônes d'une même classe pour qu'elles se distinguent en noir et blanc.

Tests : pour chaque compétence, `data-vfx` de la vignette correspond à `fx` calculé dans `skills.js` ; deux compétences d'une même classe n'ont jamais le même effet.

## 4. Donjons : des bannières en ligne et une page illustrée

Constat

- La liste est une grille de 2 colonnes de cartes de 270 × 130 px : le décor et le boss en silhouette sont petits.
- La feuille qui s'ouvre en bas compte ≈ 190 mots pour une seule image. On y trouve : « Équipe pour ce donjon » avec 2 phrases ; 3 boutons d'équipes enregistrées ; l'ensemble ; la difficulté ; la mécanique en texte ; l'élément ; 4 cartes d'itinéraire en texte, devenues inutiles avec les portes de salles ; « Butin : tout · Chemin : or » (incompréhensible) ; l'affinité ; « Récompenses, salles, tentatives ».

À faire

Liste en bannières, une par ligne, sur toute la largeur (≈ 560 × 148 sur PC, toute la largeur sur téléphone). Chaque bannière montre :

- le décor (`art101/dungeon_*.png`) en fond ;
- le portrait du boss (`art102/boss_*.png`) en grand, à droite ;
- un dégradé sombre à gauche, avec le nom, le boss, l'élément, les étoiles et le butin principal (icône et mot) ;
- le bouton « Entrer ».

Page du donjon illustrée, plein écran sur PC (partie 1) et feuille du bas sur téléphone :

- en-tête : le décor en fond, le boss en grand et sa mécanique en une pastille (« Invocatrice : 2 serviteurs toutes les 12 s · ton arme : dégâts de zone ») ;
- Difficulté : 3 tuiles illustrées (crâne, butin ×1/×3/×5, cadenas et condition) ;
- Tu gagnes : une rangée d'icônes avec les quantités (grimoires, or, gemmes, la pièce d'ensemble, le gros coffre du premier passage) ;
- Ton équipe : les portraits, le compagnon d'affinité entouré, et « ×6 Archange ici » ;
- Les salles : les 5 portes dessinées (`art102/door_*.png`) ;
- en bas, fixe : « Entrer · Normal · 1 clé ».

Retirer de la page : les 4 cartes d'itinéraire (les portes les remplacent) ; « Butin : tout · Chemin : or » ; les phrases d'aide (elles passent dans « ? »).

Les équipes enregistrées deviennent un menu déroulant « Équipe : Chasse aux boss ▾ ». Objectif : 60 mots au plus sur la page.

Tests : page du donjon : 60 mots au plus et au moins 12 images, en 1116 × 993 ; liste : les 5 bannières sont visibles en défilant ; sur téléphone, une bannière fait au moins 120 px de haut.

## 5. Coffre de butin : vivant en continu, et une vraie arrivée de l'objet

Constat : sur 12 images prises en 6 s, le coffre ne bouge pas d'un pixel. Il passe inaperçu.

À faire

- Au repos (boucle continue, coût faible) : le coffre flotte doucement de ±4 px sur 1 s ; la lueur à la couleur de la meilleure rareté pulse sur 1,5 s ; 3 à 5 étincelles montent ; le rayon de lumière s'ajoute dès qu'il y a un Épique.
- Quand un objet tombe (0,8 s) : l'icône de l'objet, entourée à sa rareté, part du monstre vaincu et décrit un arc jusqu'au coffre en tournant ; le couvercle s'ouvre et des pièces jaillissent ; la pastille du nombre grossit puis revient ; la bulle « Butin épique ! » (ou « Rare », « Légendaire ») monte et s'efface.
- Objet Légendaire : flash doré sur la scène, le coffre saute, et un son de cloche (le jeu synthétise ses sons).
- Dessin dans le moteur de scène (canvas) plutôt qu'en HTML, pour suivre la caméra et les effets.
- Réglage « réduire les animations » : la flottaison et les étincelles s'arrêtent, l'arrivée de l'objet reste.

Tests : deux captures à 0,5 s d'écart montrent le coffre à deux hauteurs différentes ; un objet lâché déclenche l'arc, l'ouverture et la pastille ; le coût de l'animation au repos reste sous 0,3 ms par image.

## 6. Bastion : le trouver, le lancer, le voir vivre

Constat

- Le Bastion est rangé dans Profil, un menu du haut, en premier onglet. Le joueur ne l'a pas trouvé.
- Sa partie le montre jamais utilisé : Forge du forgeron niveau 1, 0 ouvrier sur 2 (« Aucun ouvrier : à l'arrêt ») ; Bibliothèque « À construire » ; aucune recherche ; 17 compagnons libres qui ne font rien.
- Les seuls accès visibles sont les petites étiquettes « Forge du forgeron 0/1 · Recherches 0/0 · Ouvriers 0/2 » dans l'équipement.
- Les fiches de bâtiment sont des listes de texte dans le panneau étroit : 5 ouvriers avec « Poser », des métiers en texte, des pourcentages.

À faire

- Le trouver :
  - le Bastion devient un menu du bas, à la place d'Équipe (Équipe › Compagnons · Bastion · Expéditions), ou un 6e bouton du bas avec une tour dessinée ;
  - une icône de tour sur la scène (près du Sceau), avec une pastille quand un chantier est fini ou qu'un ouvrier manque ;
  - une carte de déblocage à l'étape 40, avec « Essayer maintenant ».
- Le lancer :
  - à la première ouverture, poser automatiquement les meilleurs ouvriers selon leur métier (« Reine démone, forgeronne : +40 % ») et lancer le premier chantier offert (15 min) ;
  - ensuite, une bulle par bâtiment, une seule fois.
- Une vraie partie gestion, illustrée : page plein écran (partie 1).
  - La carte du Bastion : un décor de village, avec les bâtiments dessinés sur la carte plutôt qu'en grille de cartes.
  - Bâtiments vivants : fumée et étincelles à la Forge, pages qui tournent à la Bibliothèque, cristaux qui brillent à la Mine.
  - Ouvriers à leur poste : chaque ouvrier apparaît devant son bâtiment, en petit sprite animé (marteau, livre, pioche).
  - Chantiers : barre de chantier et temps restant sur le bâtiment.
- Panneau du bâtiment :
  - l'ouvrier en portrait, avec son métier en icône (`art103/tool_*.png`) ;
  - les ouvriers possibles en grille de portraits, avec leur bonus (+40 %, +25 %), au lieu d'une liste avec « Poser » ;
  - « Améliorer » avec avant → après ;
  - les commandes.
- Recherches : un arbre dessiné, un nœud illustré par recherche (épée, cœur, bourse…), les liens qui s'allument, et celle en cours entourée avec son temps.
- Au retour du joueur : un écran « Pendant ton absence » avec les bâtiments terminés illustrés, les objets commandés livrés et les recherches finies. Un seul bouton : « Tout récupérer ».

Tests : un nouveau joueur trouve le Bastion en moins de 10 s après la carte de déblocage ; à la première ouverture, au moins un ouvrier est posé et un chantier lancé ; la page Bastion compte au moins 60 % d'image et au plus 120 mots.

## 7. Petits défauts relevés

- Combat › Carte : la tuile « Arène à cartes » coupe le nom « Paladin d'azur ».
- Téléphone, équipement : la rangée des personnages (Héros, Pyromancienne, Barbare, Archange) dépasse en largeur. Il faut la faire défiler, avec une ombre au bord, ou passer en portraits seuls.
- Illustrations encore sous l'objectif de 20 % annoncé en 10.2 : Améliorations 17 % ; Missions 14 % ; Statistiques 12 % ; Boutique 16 % ; Invocation 15 %.
- Jargon restant dans le Sceau : « Collections : Équipements » et « Exploit réussi : Premier sang ».
- Bulle mal placée : « Nouveau : Clés de donjon » arrive avant que les donjons soient ouverts (étape 30). La garder jusqu'à leur ouverture.

## 8. Tests de fin

- Les pages plein écran (Personnage, Forge, Bastion, Donjon) en 1116 × 993, 1280 × 720, 1716 × 1000 et 390 × 844 : rien d'important ne demande de défiler.
- Compétences : 11 vignettes différentes pour les 11 compétences du héros.
- Coffre : animé au repos, avec un arc et une ouverture à chaque objet.
- Donjons : 5 bannières, et une page de 60 mots au plus.
- Bastion : accessible depuis le menu du bas ; premier chantier lancé à la première ouverture ; ouvriers visibles sur la carte.
- Revue complète des menus, sur PC et sur téléphone : toujours aucune erreur.
