# Ascendrya 10.2 : prompt complet après le grand test de la 10.1.0 (20/11)

> Archive de la demande du joueur. Les parties 1 à 7 sont sorties en v10.2.0 ; les parties 8, 9 et 10 sortent en v10.3.0.
> Les maquettes citées (`captures-v10.2/maquettes/`) ne sont pas dans le dépôt : le texte fait foi.

Contexte : Ascendrya 10.1.0, testé le 20/11.

- Version testée : IdleRPG-10.1.0-setup.exe du lien de partage.
- Partie neuve : le jeu est suivi pendant 12 minutes, avec `?learn` pour voir les cartes « Comment jouer ».
- Partie du joueur : niveau 60, étape 139, 61 clés.
- Formats : 1116 × 993, 1280 × 720, 900 × 600, 1716 × 1000 et téléphone 390 × 844.

Règles :

- S'inspirer des bons jeux du genre sans en copier aucun. Noms, textes, règles et dessins restent propres à Ascendrya.
- Ne rien casser de ce qui marche (liste en 0).
- Chaque partie se termine par ses tests.

Demandes du joueur ajoutées le 20/11 :

- « pour l'arène je voudrais une map comme dans notre story avec quelques monstres et nos compagnons qui s'affrontent avec les compétences qui vont bien » : partie 6 ;
- « un coffre que l'on voit en jeu à la place du sac, en fantasy, qui ressort bien et fait comprendre qu'on a du loot et qu'on peut trier » : partie 7 ;
- un testeur ne comprend pas assez l'équipement, les matériaux et la forge. Il faut une fenêtre avec le héros ou le compagnon, des places à toucher, et les ressources, le coût et l'impact sur les stats bien visibles : parties 8 et 9 ;
- ouvriers, bâtiments et recherches comme dans Foundation: Galactic Frontier, et un forgeron qui améliore les pourcentages et forge des objets sur une durée donnée : partie 10.

## 0. Ce qui marche, à garder tel quel

- Fiches des compagnons : le personnage fait 259 px de haut, net, pour les 20 compagnons. C'est aussi bon sur téléphone.
- Bannières : chaque onglet a sa bannière illustrée et sa phrase « à quoi sert cet écran ».
- Mesure en 1116 × 993 : plus aucun onglet sous 10 % d'image (Donjons 75 %, Missions 12 %, Classement 16 %, Statistiques 10 %).
- Donjons : 5 cartes illustrées, chacune avec son gain principal et « Entrer » sur la carte ; feuille avec « Entrer » fixé en bas, visible dans les 5 formats ; portes de salles avec choix automatique ; fin de course en deux lignes, Progression et Matériaux.
- Glossaire : toucher l'or du bandeau ouvre sa carte (à quoi ça sert, où en gagner, légende K/M/B/T, « Y aller »).
- Sceau : chaque consigne a sa ligne « pourquoi », et l'anneau lumineux montre le bouton à toucher.
- Cartes « Comment jouer » et cartes de déblocage : illustrées, une à la fois, avec « Essayer maintenant ».
- Carnet : la ligne « Ça dort » signale 61 clés, l'Arène pas jouée et aucune expédition en cours.
- Formats : la barre de compétences n'est jamais couverte, ni dans les 4 formats PC ni sur téléphone, et aucun écran ne déborde en largeur.

## 1. Bugs à corriger (priorité)

### 1.1 Le texte « ia » au-dessus des ennemis

- Cause : la police pixel des chiffres FONT_BIG (src/render/sprites.js) ne contient que `0-9 , + - K M B T Q a i`. Les lettres absentes sont sautées (drawBigText, pixel.js).
- Résultat : « Efficace ! » s'affiche « ia », « Résiste » « i », « Attaque lourde ! » « a », « Affaibli ! » « aii ».
- À faire : dessiner les textes en mots avec la police vectorielle du jeu, en gardant FONT_BIG pour les nombres seulement ; ou compléter FONT_BIG.
- Test : chaque chaîne passée à addText s'affiche avec tous ses caractères. Test unitaire : tout caractère d'un texte non numérique existe dans la police utilisée.

### 1.2 Arène : le nom des cartes ennemies ne correspond pas à l'image

- À faire : le nom de la carte devient le vrai nom du monstre affiché (ENEMIES[id].name), et le rôle (Lancier, Mage…) passe en sous-titre ; les boss « Champion » et « Disciple » prennent le nom et l'image du boss du monde affiché ; le gardien garde son nom (« Gardienne d'argent ») mais reçoit une image à lui.
- Test : pour les étages 1 à 100, le nom de chaque carte ennemie est celui de son sprite.

### 1.3 Arène : « Placement auto » laisse un trou devant et met l'assassin en première ligne

- À faire : choisir d'abord 2 ou 3 cartes de rôle « avant » (gardien, berserker, familier robuste), puis les rôles « arrière » (mage, archer, soutien) ; l'assassin va derrière ; ne jamais laisser une case avant vide s'il reste une case arrière occupée.
- Test : avec chaque sauvegarde de test, au moins 2 cases avant sont occupées et l'assassin est derrière.

### 1.4 Arène : beaucoup trop facile au début, puis un mur

- À faire : remplacer `scale: 1.0` (data/arena-floors.js) par une courbe calée sur la puissance de l'équipe du joueur au premier passage ; viser 1 ★ ou 2 ★ dès l'étage 8 à 10, une vraie défaite possible vers 20 à 30, et des gardiens (25, 50) plus durs que les étages voisins mais jamais plus durs que l'étage +10.
- Test : la simulation de la partie de 11 h franchit 20 étages et bute entre 25 et 35. Un combat de l'étage 10 dure au moins 12 s.

### 1.5 Donjons : « Balayer tout » vide toutes les clés sur un seul donjon en Facile

- À faire : répartir les clés sur les donjons terminés, chacun à sa plus haute difficulté terminée, au prorata ou au choix ; ouvrir une confirmation qui montre le total des gains (« 61 clés : ≈ 560 M or, 120 grimoires… »).
- Test : « Balayer tout » dépense exactement les clés annoncées et donne le total annoncé.

### 1.6 Petits défauts relevés

- Feuille de donjon : la ligne « Équipes : Chasse aux monstres · Farm économique · Chasse aux boss » est posée au-dessus du titre, sans explication. La mettre sous « Équipe pour ce donjon », avec une phrase ; le badge dit « ×3 », mais le texte dit « sorts ×6, équipe +150 % ». Aligner le badge sur l'effet réel.
- Victoire en donjon : la fenêtre reste ouverte tant qu'on ne la ferme pas et couvre la scène. La fermer seule après 8 s en mode automatique.
- Arène : un combat à 3 ★ de l'étage 1 rapporte 6 gemmes. Rendre les récompenses de premier passage plus visibles et plus fortes dans les 10 premiers étages.
- Téléphone (390 × 844) : le titre du panneau est coupé (« Améliorati… », « Collectio… »). Sur téléphone, cacher ⤢, réduire ? et ✕ à 32 px, et laisser le titre passer sur 2 lignes si besoin.
- Héros › Équipement : le nom « Pyromancienne » est coupé dans la rangée des compagnons. Afficher le nom complet en 2 lignes, ou au survol et à l'appui long.

### 1.7 Revérification complète du 20/11 : ce qui est sain

- 22 onglets, 172 écrans sur PC et 169 sur téléphone : aucune erreur JavaScript, aucune image cassée, aucun « NaN », « undefined » ou « null » à l'écran, aucun panneau vide.
- L'« Arbre avancé » des Talents dépasse du panneau, mais c'est voulu. Ajouter une ombre sur les bords pour montrer qu'il continue.

## 2. Arène à cartes : la rendre vraiment jouable

### 2.1 Accès

- Ajouter l'onglet « Arène » directement dans Combat (Carte, Donjons, Arène, Défis, Événement) ; la tuile illustrée arena_tile.png dans la Carte.

### 2.2 Première ouverture

- À la première ouverture, placer automatiquement, puis montrer une bulle : « Ta formation est prête : les cartes devant encaissent, celles derrière frappent ».
- Si « Combattre » est grisé, écrire pourquoi sur le bouton (« Place au moins 1 carte »).

### 2.3 Le plateau de combat (remplacé par la partie 6 : le combat se joue sur la carte, les cartes restent en bas de l'écran)

- Pour chaque coup : la carte avance, la cible tremble, le chiffre de dégâts s'affiche ; jauge d'ultime visible sur chaque carte ; quand elle est pleine, la carte brille et se touche (mode Manuel) ; vitesse ×1, ×2 et Passer.
- Fin du combat : les étoiles arrivent une par une, puis viennent les récompenses et « Étage suivant » en bouton principal.

### 2.4 Contenu

- Donner un nom et une image à chaque règle d'étage (« Brasier : ennemis de Feu », etc.), affichés en bandeau sur l'étage.
- Prévoir un dos de carte à gagner au premier gardien, avec un aperçu dans la fiche de l'étage 25 (card_back_gold.png existe).
- Ajouter une ligne « Arène » au Carnet tant qu'un étage est jouable (elle existe), et au Sceau une fois par jour.

Tests : avec la partie de 11 h, « Combattre » est actif dès la première ouverture ; le plateau occupe au moins 70 % de la hauteur du panneau ; un combat de l'étage 10 dure au moins 12 s, et chaque carte lance chacune de ses compétences au moins une fois en 60 s.

## 3. Illustrations : aller plus loin

| Où | Aujourd'hui | À faire |
|---|---|---|
| Feuille de donjon | petite icône verte du donjon | grand portrait du boss avec sa mécanique en image, en tête de la feuille |
| Cartes de donjon | décor seul | silhouette du boss en ombre, au premier plan du décor |
| Portes de salles | une icône par porte, empilées | 5 portes dessinées (Combat, Élite, Trésor, Autel, Repos), côte à côte, qui s'ouvrent au choix |
| Bénédictions | 3 cartes texte | une illustration par bénédiction |
| Victoire de donjon | icônes de récompenses | le boss vaincu à terre, en image de fond, sous les récompenses |
| Arène | cartes sur fond uni | fond d'arène, cadres par rareté, image pour chaque règle, gardiens illustrés |
| Améliorations (14 %) | liste d'icônes | portrait du héros qui évolue tous les 25 niveaux de Dégâts |
| Missions (12 %) | icônes 48 px | carte illustrée pour la mission de la semaine, coffre de palier dessiné |
| Statistiques (10 %) | 4 tuiles puis du texte | courbe de progression (étape par jour), frise des records illustrée |
| Expéditions | liste et menus | carte du monde avec les compagnons partis, en petits sprites qui marchent |
| Collections | grille de monstres | page de bestiaire par monstre (image en grand et lieu) |

Consignes de dessin : pixel art 16 bits, contour sombre d'un pixel, palette du jeu, lumière venue d'en haut à gauche ; personnages à partir des sprites de combat, agrandis par un multiple entier, jamais lissés ; bannières 640 × 200, portraits de boss 256 × 256, portes 96 × 128, fonds d'écran 640 × 360. Vérification : `tools/art/check_screens.mjs`, seuil à 20 % pour Améliorations, Missions et Statistiques.

## 4. Nouveau joueur

### 4.1 Le Sceau devance les cartes de déblocage

À faire : une consigne du Sceau qui ouvre une notion n'apparaît qu'une fois la carte de cette notion vue (`state.ui.learned`). Sinon, faire passer la carte en premier.

### 4.2 Plusieurs messages en même temps

À faire : pendant qu'une carte de déblocage est ouverte, mettre en attente les bulles de ressources et les « Nouvel objet ». Elles passent ensuite, une par une.

### 4.3 « Améliorer Dégâts » 15 fois en 12 minutes

À faire : la consigne devient « Améliorer Dégâts ×N (tout l'or utile) » et achète tous les niveaux abordables ; la règle des 3 fois compare le type de consigne (id), pas son texte.

### 4.4 Jargon restant dans le Sceau

À faire : employer les mots du joueur (« Mission finie : 30 gemmes », « Coffre trouvé en chemin », « Premier boss vaincu : 20 gemmes »), ou ajouter le mot au glossaire avec une bulle à sa première apparition.

Tests, sur 12 minutes de partie neuve (`?learn`) : aucune consigne n'ouvre une notion pas encore présentée ; jamais plus d'un message à lire à la fois ; « Améliorer » n'apparaît pas plus de 5 fois ; aucun mot hors glossaire dans le Sceau.

## 5. Tests de fin

- Rejouer 12 minutes de partie neuve (`?learn`) en suivant seulement le Sceau, l'anneau et les cartes.
- Le texte « ia » n'apparaît plus jamais.
- Arène : simulation des étages 1 à 100 avec 3 sauvegardes (débutant, 11 h, fin de jeu) ; noms égaux aux images ; avant toujours occupé.
- Donjons : « Balayer tout » répartit les clés et annonce le total.
- Formats : 1280 × 720, 900 × 600, 1716 × 1000 et 390 × 844. Les boutons « Entrer » et « Combattre » sont visibles, et le plateau d'Arène reste lisible sur téléphone.

## 6. Arène : le combat se joue sur une carte, comme l'histoire

### 6.1 Ce qui existe déjà et qu'il faut réutiliser

`render/showcase-scene.js`, `core/arena-cards.js › fightBoard`, `ui/arena-stage.js`, ALLY_ANIMS et pickAllyAnim, ENEMIES, BOSSES.

### 6.2 À faire : ArenaScene

- Créer `render/arena-scene.js` sur le modèle de showcase-scene.js. Il rejoue les événements de fightBoard dans un SceneRenderer.
- Décor : le monde de l'élément de l'étage (ZONE_ELEMENT), même fond et même parallaxe que la campagne.
- Compagnons à gauche, sur deux rangs en profondeur (« Devant » au premier plan ; « Derrière » en retrait, plus haut, ×0,9).
- Monstres à droite, dans le même ordre. Ce sont les vrais monstres de ce monde, avec leur nom.
- Boss d'étage et gardiens : le sprite de boss en grand, sa barre de vie en haut, sa mécanique jouée.
- Chaque événement donne son geste et son effet : hit, skill (bulle du nom, geste, effet du sort), ultimate (zoom léger 0,4 s, flash, effet d'ultime), heal et shield, death (le compagnon se couche, grisé).
- Bas de l'écran : la rangée de cartes de la formation (portrait, nom, « rôle · sort principal », barre de vie, jauge d'ultime ; la carte brille quand l'ultime est prêt, et un toucher le lance en mode Manuel) ; à droite : ×2, Passer et Auto.
- Bandeau du haut : « Arène · Étage N », la règle de l'étage avec son icône, le chronomètre (les 3 ★ demandent moins de 45 s) et les étoiles en cours.
- Fin : les vainqueurs restent sur la carte, les étoiles tombent une par une, récompenses en 2 lignes, puis « Étage suivant » en bouton principal.
- Téléphone : la scène occupe le haut de l'écran (55 %) et les cartes passent en rangée défilante (100 × 150) en bas.
- Survie et Boss commun passent aussi par ArenaScene (mêmes compagnons, mêmes effets). Les portraits fixes actuels disparaissent.

Tests : un combat de l'étage 10 rejoué dans ArenaScene montre au moins une fois l'animation de sort de chaque compagnon présent ; les noms et sprites des monstres correspondent ; 60 i/s en 1280 × 720 et 30 i/s ou plus sur téléphone ; avec « réduire les animations », Passer va directement à la fin.

## 7. Un coffre de butin dans la scène, à la place du sac

- Le coffre est dessiné dans la scène, posé sur le sol, juste derrière les ennemis du moment. On remplace le bouton DOM par un objet du SceneRenderer.
- Image : sprites/icon_chest.png, agrandi par un multiple entier (≈ 96 px de haut sur PC et 64 px sur téléphone). Animation d'ouverture ui/vfx/chest.webp.
- Quand un objet est ramassé, il vole du monstre vaincu jusqu'au coffre, le couvercle s'entrouvre et 3 pièces sautent.
- Lueur à la couleur de la meilleure rareté ; rayon de lumière dès qu'il y a un Épique.
- Pastille du nombre d'objets, et flèche verte ▲ s'il y a une amélioration.
- Bulle « Butin ! » au-dessus du coffre la première fois, puis à chaque objet Épique ou mieux (2 s).
- Toucher le coffre ouvre « Coffre de butin ». Chaque objet y a son icône, son nom en couleur de rareté, ce qu'il apporte par rapport à l'objet porté, et une action proposée (▲ Équiper, 📦 Ranger, ♻ Recycler).
- Un grand bouton « Garder le meilleur, recycler le reste », et « Trier à la main ».
- Quand le coffre est plein (LOOT_BAG_MAX), il déborde : des pièces au sol, et la bulle « Coffre plein : trie-le ».
- Textes : le mot « sac » devient « coffre de butin » partout (carte de déblocage, Sceau, glossaire, raccourci B). Le « Coffre » de l'inventaire (rangement) devient « Réserve ».

Tests : en 1116 × 993, 1716 × 1000 et 390 × 844, le coffre est visible dans la scène, sur le sol, à au moins 40 px du bord, et jamais caché par la barre de compétences ni par le Sceau ; ramasser un objet Épique fait voler l'objet, change la lueur et montre la bulle ; toucher le coffre ouvre le tri ; « Garder le meilleur » donne le même résultat qu'en 10.1.

## 8. Équipement : une fenêtre qu'on comprend du premier coup

Demande du joueur (20/11) : un testeur ne comprend pas assez l'équipement et les matériaux. Il faut une fenêtre avec le héros ou le compagnon, où l'on touche les emplacements pour s'équiper, et où l'on voit bien :

- les ressources nécessaires pour l'amélioration ;
- l'impact sur les stats ;
- les ressources possédées.

Le joueur cite Foundation: Galactic Frontier. On reprend seulement le principe (personnage au centre, places autour, une fiche claire à côté), sans copier son interface.

### 8.1 Constat en 10.1

La base est bonne : Héros › Équipement montre déjà le héros au centre, avec 6 places autour, et une rangée pour choisir le héros ou un compagnon. Ce qui empêche de comprendre :

- Les places affichent « Nv 175 », « Nv 437 », « Nv 432 » : c'est le niveau de l'objet, alors que le héros est « Niv. 60 ». Le joueur croit que c'est le même niveau. Le nom et la rareté de l'objet n'apparaissent pas.
- Une seule stat visible : « Puissance 2,7 T ». Rien sur les dégâts, la vie, la vitesse ou le critique, ni sur ce que chaque objet y ajoute.
- La fiche d'objet est une fenêtre qui recouvre le personnage.
- Le bouton « Renforcer » dit « +0 → +1 · une stat +12 % » sans nommer la stat ni sa nouvelle valeur.
- Le coût (4,5 M or · 2 éclats) s'affiche sans ce que le joueur possède.
- « Remettre au niveau » n'est pas expliqué.
- Compagnons : leurs 3 places (Arme, Armure légère, Anneau) donnent un bonus écrit en gros et en rose. Il est noté avec des points (« +55.2 % Attaque, +32.8 % PV ») au lieu de virgules, et rien ne le relie aux stats du compagnon.
- Matériaux : le joueur a des éclats (79 K), des grimoires (14), des pierres d'éveil (18) et des essences (30). Rien sur l'écran ne dit que seuls les éclats et l'or servent à l'équipement. Les trois autres servent aux compagnons.
- « Renforcer » est dans la fiche d'objet, alors que la Forge dit « Recycle les objets inutiles en éclats, puis renforce ou fusionne ». Le joueur cherche le renforcement dans la Forge (déjà signalé en 9.9).

### 8.2 À faire : la fenêtre d'équipement

Bandeau « Tes ressources » en haut de l'écran :

- Or et Éclats, avec à quoi ils servent ici (« Or · améliorer », « Éclats · renforcer ») ;
- Grimoires et Pierres d'éveil, en gris, avec la mention « pour les compagnons » ;
- toucher une ressource ouvre sa carte de glossaire (déjà en place).

Colonne de gauche : le héros et les compagnons de l'équipe en portraits, avec le nombre de places (6 pour le héros, 3 pour un compagnon). Une flèche verte ▲ s'affiche si un meilleur objet attend dans le sac.

Centre : le personnage en grand (fiche 10.1, ×3) et ses places autour, 84 × 84 px sur PC. Chaque place montre :

- l'icône de l'objet, avec un cadre à la couleur de la rareté ;
- le niveau de renforcement en pastille (+10) ;
- la flèche ▲ si mieux dans le sac ;
- en dessous, le nom de la place et « Nom · Rareté » (« Dague · Légendaire »).

Le niveau de l'objet (175) passe dans la fiche, sous le libellé « Niveau d'objet ».

Sous le personnage : « Puissance 2,7 T » puis 4 tuiles (Dégâts/s, Vie, Vitesse, Critique). Pour un compagnon : Attaque, PV, Défense, Recharge. Quand une place est choisie, la tuile concernée montre le gain du prochain renforcement (« +0,1 si renforcée »).

Fiche de l'objet à droite, toujours visible (plus de fenêtre qui recouvre ; feuille du bas sur téléphone) :

- en-tête : icône, nom, rareté, place, classe, et « +6 % de ta puissance totale » ;
- « Ce qu'elle donne » : chaque stat et son effet spécial, en clair ;
- « Renforcer : +10 → +11 » : chaque stat avant → après, puis la puissance avant → après. Le coût est montré pièce par pièce avec « tu as … » en vert, ou « il manque … » en rouge avec « Où en gagner ». Rappel de la règle : +12 % par niveau, coût en or et en éclats de 2 × (niveau + 1) (BALANCE.forge.upgrade*) ;
- « Mieux dans ton sac » : le meilleur objet de la même place, avec son gain, et « Équiper » ;
- en bas : « Changer l'effet (20 éclats) », « Remettre au niveau de ton étape (… éclats) » avec une phrase d'aide, et « Retirer ».

Compagnon : même fenêtre avec 3 places. Les bonus de classe s'écrivent en virgules, et chacun s'ajoute à la tuile de stat qu'il touche (« Attaque 342 → 530 avec l'équipement »).

Toucher une place vide ouvre la liste des objets compatibles, triés par gain, avec « Équiper le meilleur » en tête.

Repris de l'ergonomie de Foundation: Galactic Frontier (captures envoyées par le joueur le 20/11). On reprend les principes, pas l'interface :

- Onglets sous le titre : Vue d'ensemble · Équipement · Étoiles · Compétences. Un seul écran par personnage, sans aller-retour entre les menus.
- Bouton vert « Équipement rapide (N ▲) » sous la puissance : il équipe le meilleur objet de chaque place, avec un « avant → après » en confirmation.
- Pastille rouge ! sur le portrait d'un personnage qui peut s'améliorer (meilleur objet, renforcement abordable, étoile prête).
- « Possédé / requis » sur chaque coût : vert si assez, rouge sinon, avec un bouton « + » qui mène là où gagner la ressource.
- Bandeau rouge « ce qui bloque » avec une flèche qui y mène, par exemple « Au-delà de +12 : Forge du Bastion niveau 4 requise › » (partie 10). Dans la Vue d'ensemble : « Étoile suivante : 21/30 fragments ».
- « Avant > après » en vert partout : renforcement, étoiles, compétences, bâtiments.
- Un bonus d'ensemble expliqué en clair dans la fiche (« Ensemble Voile spectral 1/3 : à 3 pièces, +15 % de vitesse »).
- Grille du sac : cartes carrées, fond à la couleur de la rareté, niveau en bas, porteur en haut à droite et cadenas. Les fragments manquants s'affichent en rouge (« 1/9 »).
- Complété après les 13 captures du joueur (20/11) :
  - flèches ‹ › de chaque côté du personnage pour passer au suivant sans revenir à la liste ;
  - niveau dans un hexagone sous le personnage, avec la puissance juste en dessous ;
  - fiche d'un objet : une rangée des places en bas de la fiche, pour passer d'un objet porté à l'autre sans fermer. En tête, une bulle d'aide d'une ligne sur la place (« L'arme fixe ta vitesse et tes critiques ») ;
  - « Changer » : l'objet porté en haut, puis la grille des objets de la même place, avec l'objet porté marqué « Équipé ». Des filtres par ensemble en bas, et une case « + » qui mène à la Forge (Fabriquer) ;
  - colonne de raccourcis à gauche de l'écran : Forge 1/1, Recherche 1/1, Ouvriers 2/3. Ce sont les chantiers du Bastion (partie 10), visibles et accessibles depuis l'équipement ;
  - liste des compagnons : cartes portrait, fond à la couleur de la rareté, niveau, étoiles en losanges, et pastille ! si une amélioration est possible. Les compagnons non obtenus sont grisés, avec leurs fragments (« 4/40 ») et une barre ;
  - onglet Étoiles : étoiles actuelles → suivantes, et « Niveau max des compétences 16 → 17 » en tête. Puis un tableau avant > après (Puissance, PV, Attaque, Défense), la barre de fragments « 21/30 » (rouge si insuffisant) avec « + », et le bouton « Promouvoir » ;
  - onglet Compétences : les icônes des sorts autour du personnage estompé, chacune avec « Niv. 16 ». Une fiche dit les dégâts actuels et ceux du niveau suivant, en orange (« ×216 % → 222 % »), avec le bandeau rouge « Passe à l'étoile suivante pour améliorer › ».

Tests :

- En 1116 × 993, 1280 × 720 et 390 × 844, les 6 places et la fiche sont visibles sans fenêtre par-dessus. Sur téléphone, la fiche est une feuille du bas.
- Pour 3 objets pris au hasard, le « avant → après » du renforcement est égal au résultat réel après l'action.
- Aucun nombre n'est écrit avec un point décimal en français.
- Un nouveau joueur de test équipe un objet et le renforce en moins de 30 s, sans aide.

## 9. Forge : expliquer la boucle en images

### 9.1 Constat en 10.1

- Deux illustrations empilées (la bannière, puis l'enclume) prennent près de la moitié du panneau avant le premier bouton.
- Seulement 3 ateliers : Recycler, Fusionner, Fabriquer. Renforcer n'y est pas, alors que la phrase d'en-tête en parle.
- Fusionner affiche une ligne « Arme · Épique → Légendaire · 11 dans le sac ▸ ? ». Rien ne dit : qu'il faut 5 objets de la même place ; les chances avec 3 ou 4 objets (30 % et 65 %, BALANCE.forge.fusion) ; ce qui est gardé ; le gain.
- Fabriquer montre « Fabriquer Rare+ · 1,5 M · 25 » et « Fabriquer Épique+ · 3,7 M · 120 », sans dire ce qu'on reçoit ni à quel niveau.

### 9.2 À faire

Une seule illustration en tête (banner_forge.png), avec la phrase : « Les objets dont tu n'as plus besoin deviennent des éclats. Les éclats rendent tes bons objets plus forts. »

Les 4 ateliers côte à côte, numérotés dans l'ordre de la boucle et reliés par des flèches : 1 Recycler, 2 Renforcer, 3 Fusionner, 4 Fabriquer. Chaque atelier a :

- un schéma en images (objets → éclats ; objet + éclats → objet +1 ; 5 objets → 1 de la rareté au-dessus ; or + éclats → objet neuf) ;
- une phrase de règle ;
- une ligne en vert « ce que tu peux faire maintenant » (« 3 objets inutiles → +54 éclats, +836 K or ») ;
- un bouton.

Sur téléphone, les 4 ateliers deviennent une liste verticale.

Renforcer dans la Forge : l'atelier liste les objets portés, triés par gain de puissance par éclat. Toucher un objet ouvre la même section « Renforcer » que la fiche d'objet (partie 8).

Fusion détaillée :

- 5 cases à remplir (remplies automatiquement avec les moins bons objets, portés et verrouillés exclus) ;
- une jauge de chance (30 % avec 3, 65 % avec 4, 100 % avec 5) et le rappel de la règle de pitié (+20 % après un échec) ;
- « Ce que tu obtiens » : rareté, niveau, effet gardé au choix et gain estimé ;
- le bouton reprend la mise et la chance (« Fusionner (4 objets · 65 %) »).

Fabriquer : choisir la place en icônes plutôt qu'en liste déroulante, et montrer les chances de rareté du résultat et son niveau (« niveau 139, ton étape max »).

Glossaire : « Éclats » dit « Recycler un objet en donne. Sert à renforcer, fusionner et fabriquer », avec « Y aller » vers l'atelier 1.

Tests :

- En 1116 × 993, le premier bouton de la Forge est visible sans défiler.
- Les 4 ateliers affichent un « maintenant » juste pour la partie de 11 h (3 objets inutiles, 11 armes Épiques).
- La fusion annonce la bonne chance pour 3, 4 et 5 objets, et ne prend jamais un objet porté ou verrouillé.
- Le renforcement fait depuis la Forge donne le même résultat que depuis la fiche d'objet.

## 10. Le Bastion : ouvriers, bâtiments, recherches et forgeron

Demandes du joueur (20/11) :

- Foundation a une gestion intéressante, avec des ouvriers qui améliorent des bâtiments, des ressources et des stats grâce à des recherches. Est-ce que ça irait à Ascendrya, qui est un jeu de combat automatique ?
- « On pourrait avoir un forgeron qui améliore les pourcentages et nous forge des équipements sur une durée donnée. »

### 10.1 Est-ce que ça va à Ascendrya ? Oui, à quatre conditions

Pour :

- Dans un jeu à combat automatique, le joueur décide peu pendant le combat. Choisir quoi construire, quelle recherche lancer et qui y travailler donne des décisions simples, sans enlever l'automatique.
- Ce sont des minuteurs qui avancent jeu fermé. Le joueur a une raison claire de revenir (« la Forge a fini ta commande »).
- Le jeu a déjà les pièces : le Camp (ui/panels/camp.js), un écran calme où « rien à acheter » ; les Expéditions (core/expeditions.js), qui envoient en mission les compagnons hors de l'équipe, en temps réel ; la Forge ; les illustrations art98/ (forge_hall, talent_tree, summon_circle, camp_night, event_market, expedition_map).
- Les compagnons en double ou hors de l'équipe trouvent enfin un usage : ils deviennent des ouvriers.

Les conditions (le test du 20/11 montre qu'un nouveau joueur sature déjà) :

1. Pas de nouvel onglet, ni de nouvelle monnaie. Le Camp devient le Bastion, et les Expéditions y entrent comme un bâtiment. On utilise l'or, les éclats et le temps.
2. Arrivée tardive : étape 40, une carte de déblocage, et un seul bâtiment au départ (la Forge du forgeron). Les autres arrivent un par un.
3. Petits gains qui s'ajoutent sans écraser le reste. Les recherches donnent au total au plus +60 % de dégâts et de vie, et +50 % d'or, à comparer avec les talents et les améliorations.
4. Jamais d'attente obligatoire pour avancer dans l'histoire. Le Bastion accélère, il ne bloque pas. Les seuls « ce qui bloque » concernent ses propres bonus (renforcement au-delà de +12, par exemple).

### 10.2 Les bâtiments

| Bâtiment | Arrive à | Rôle | Effet par niveau (indicatif) |
|---|---|---|---|
| Forge du forgeron | étape 40 | améliore la Forge et forge sur commande | chance de fusion à 3 ou 4 objets +5 points par niveau (plafond 95 %) ; renforcement maximal +2 ; coût des renforcements −2 % ; commandes simultanées 1 → 3 |
| Bibliothèque | étape 55 | recherches (10.4) | 1 recherche à la fois, durée −5 % par niveau |
| Mine de cristal | étape 70 | éclats au fil du temps | +X éclats/h (calé sur le recyclage d'un objet de l'étape max), stock de 6 à 12 h |
| Camp d'entraînement | étape 85 | XP des compagnons hors de l'équipe | rattrape le niveau des remplaçants |
| Expéditions (existant) | inchangé | le bâtiment reprend l'écran actuel | — |
| Comptoir | Bastion niv. 5 | échange de matériaux (éclats ↔ essences…) | taux qui s'améliore |

- Améliorer un bâtiment coûte de l'or, des éclats et du temps : 15 min au niveau 1, puis jusqu'à 8 h. Un seul chantier par ouvrier, et le chantier continue jeu fermé.
- Niveau du Bastion = somme des niveaux des bâtiments. Il débloque les places d'ouvriers (2 → 4) et le Comptoir.

### 10.3 Les ouvriers

Un ouvrier est un compagnon qui n'est ni dans l'équipe, ni en expédition. On le pose sur un bâtiment d'un toucher.

Métiers liés au rôle et à l'histoire du compagnon, pour donner envie de les collectionner :

- Nain guerrier : forgeron, +20 % de vitesse à la Forge ;
- Grand prêtre ou Sorcière : savant, +20 % à la Bibliothèque ;
- Rôdeur : mineur ;
- Écuyer : entraîneur.

Chaque compagnon a un métier (data/companions.js, champ `trade`). La rareté donne un bonus de +5 à +20 %.

Sans ouvrier, un bâtiment produit à 50 % et ne lance pas de chantier. Sa carte l'écrit en rouge : « Aucun ouvrier : à l'arrêt ».

Sur la carte du Bastion, l'ouvrier apparaît dans un médaillon, et en petit sprite animé devant le bâtiment (il tape sur l'enclume, il lit).

### 10.4 Les recherches (Bibliothèque)

- 3 branches de 6 recherches, débloquées dans l'ordre :
  - Combat : Lames aiguisées +2 % de dégâts par niveau, Peau d'acier +2 % de vie, Coup fatal +1 % de critique…
  - Compagnons : Esprit d'équipe +2 % de stats, Rappel rapide −1 % de recharge, Lien renforcé +10 % aux liens…
  - Économie : Bourse pleine +3 % d'or, Longue veille +1 h de gains hors ligne, Œil du chasseur +2 % de butin rare…
- Chaque niveau coûte de l'or et des éclats, et prend du temps (10 min → 6 h). Une seule recherche à la fois, deux avec la Bibliothèque au niveau 6.
- Différence avec les Talents, à écrire dans l'écran : les Talents viennent des fragments de Renaissance et sont permanents ; les Recherches avancent avec le temps et ne se perdent pas à la Renaissance.

### 10.5 Le forgeron (demande du joueur)

Améliorer la Forge du Bastion améliore les chiffres de la Forge (partie 9) :

- chance de fusion à 3 et 4 objets ;
- renforcement maximal (+12 au départ, +2 par niveau) ;
- coût des renforcements ;
- nombre de commandes en même temps.

Chaque gain s'affiche en « avant → après » (maquette : 65 % → 70 %, +12 → +14, 1 → 2 commandes).

Commandes d'objets :

- on choisit la place (icônes) et la rareté minimale (Rare+, Épique+, Légendaire+ à partir du niveau 6) ;
- le forgeron forge en 1 h à 8 h, jeu fermé compris. L'objet arrive au niveau de l'étape max, dans le coffre de butin (partie 7) ;
- coût : celui de « Fabriquer » aujourd'hui (craftCost), réduit de 10 % par niveau de Forge ;
- « Fabriquer » immédiat reste dans la Forge pour qui ne veut pas attendre. La commande est moins chère et peut donner mieux.

Lien avec l'Équipement : le bandeau « Au-delà de +12 : Forge du Bastion niveau 4 requise › » (partie 8) mène directement au bâtiment.

### 10.6 Écran

En-tête : places d'ouvriers (3/4), or, éclats, et la mention « tout avance même jeu fermé ».

Carte du Bastion (décor expedition_map agrandi), avec une carte par bâtiment. Chaque carte montre :

- l'illustration, le nom et le niveau ;
- l'effet en une ligne ;
- la barre de chantier ou de production et le temps restant ;
- le médaillon de l'ouvrier, ou un « + » en pointillés s'il n'y en a pas.

Les bâtiments verrouillés sont grisés, avec leur condition.

Panneau du bâtiment choisi :

- l'ouvrier et son métier ;
- « Améliorer : niv. 3 → 4 », avec chaque effet avant → après en vert ;
- le coût « tu as … » et la durée (avec et sans le bonus de l'ouvrier) ;
- pour la Forge, la file de commandes.

Bandeau des Recherches en bas : 3 colonnes, la recherche en cours bordée de vert et les suivantes cadenassées.

Rappels :

- Carnet : « Le Bastion a fini 2 chantiers » ;
- Sceau, une fois par retour : « Commande prête : Arme Épique » ;
- notification téléphone, si elle est activée.

Téléphone : la carte devient une liste de bâtiments, et le panneau une feuille du bas.

Tests :

- Simulation de 7 jours avec 2 connexions par jour : le Bastion apporte au plus +25 % de puissance, contre au moins +200 % pour la campagne, sur la même période.
- Aucune étape de l'histoire ne demande un niveau de Bastion.
- Un chantier lancé puis le jeu fermé 3 h : au retour, le chantier est fini, et le Carnet et le Sceau le disent une seule fois.
- Un compagnon ouvrier ne peut pas être en même temps dans l'équipe ou en expédition. Le mettre dans l'équipe le retire du bâtiment, avec un avertissement.
- Les chances de fusion affichées dans la Forge suivent le niveau de la Forge du Bastion.
