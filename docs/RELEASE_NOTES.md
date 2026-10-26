## Idle RPG v8.2.0 — Tour de l'Éternité, tout au clavier, méga boss animés

**Installation ou mise à jour :** téléchargez **IdleRPG-8.2.0-setup.exe** et lancez-le (jeu fermé).
**Votre partie est conservée.** Le dépôt GitHub étant privé, la mise à jour en jeu demande un jeton GitHub
(voir ci-dessous) ou que le dépôt soit rendu public.

### Nouveau dans la v8.2
- **Tour de l'Éternité** (nouvel onglet « Tour », dès l'étape 2-20) : un boss par étage, de plus en plus fort,
  un méga boss tous les 10 étages. Gratuite, sans clé ; gemmes à chaque nouveau record, fragments tous les 5 étages,
  ticket et clé tous les 10. Une défaite termine l'ascension (record et dernière ascension affichés).
- **Tout se joue au clavier** : les flèches déplacent la sélection d'un bouton à l'autre (encadrée en or),
  Entrée ou Espace l'active, **Entrée maintenue = clic maintenu** (anneau puis achats en continu),
  [ ] ou Page préc./suiv. pour changer d'onglet ; la sélection reste en place quand le panneau se met à jour.
- **Méga boss réanimés** : Chevalier déchu, Roi démoniaque et Colosse du marais ont une vraie marche
  et des attaques spectaculaires.
- **Animation d'invocation seulement pour une nouveauté** (personnage ou familier jamais obtenu) ; les doublons s'affichent directement.
- **Fusion automatique aussi dans la Forge** (à côté de la fusion manuelle).
- **Mises à jour avec un dépôt privé** : Paramètres → Version et mises à jour → « Dépôt privé » : collez un jeton
  GitHub en lecture seule (gardé uniquement sur ce PC) pour vérifier et installer les mises à jour.

### Corrigés
- **Achats** : « Améliorer » ne faisait rien sur les objets ancestraux et accessoires sans statistique de base
  (ex. Sceau du Néant) — leurs effets spéciaux s'améliorent maintenant de +12 % par niveau ; un message
  s'affiche quand une amélioration est impossible.
- **« GitHub injoignable (404) »** : expliqué (dépôt privé) et contournable avec un jeton.
- Bonus des codes affiché lisiblement (×100 M au lieu de ×100000000,0).

### v8.1
- **Raccourcis clavier pour tout** : 1…0 onglets, ← → onglet suivant, Espace / A avance auto, V vitesse,
  Q W E R T boosts, G tout récupérer, M missions, N récompenses, P paramètres, Échap fermer, K ou ? aide.
- **Clic maintenu** : gardez le clic sur un bouton (acheter, améliorer, invoquer, réclamer…) ; un anneau se
  remplit autour du curseur, puis le bouton est cliqué en continu jusqu'à ce que vous bougiez la souris.
- **Codes secrets cumulables** (×100 puis ×100 = ×10 000, chacun avec sa minuterie) et beaucoup de nouveaux codes :
  plus forts, pour le butin, les objets, les ressources… (les codes actifs sont listés dans les Paramètres).
- **Fusion automatique** (Inventaire) : 5 objets du même type et de la même rareté fusionnent tout seuls en un
  objet de rareté supérieure (raretés au choix ; jamais un objet verrouillé, ancestral ou meilleur que l'équipé).
- **Donjons : rapport d'expédition** — après une défaite, on voit où l'on en était (salle, **PV restants du boss**),
  et chaque donjon/difficulté garde votre **meilleure tentative** : durée, niveau, équipement et équipe.
- **Boosts visibles sur la scène** : flammes de rage, éclairs de frénésie, pièces de Midas en orbite, viseur
  de l'Œil du chasseur, lames fantômes.
- **Synergies animées** : Bénédiction = halo de lumière au-dessus du chevalier, Pluie de feu = flèches
  enflammées qui tombent sur les ennemis, Forteresse = dôme protecteur, Cercle arcanique, marques, lames…
  et **10 nouvelles synergies** (Salve, Pacte des ombres, Chœur sacré, Horde, Mur de boucliers…), annoncées
  quand elles s'activent.
- **Invocation animée** : portail, faisceau de la couleur de la meilleure rareté, cartes retournées une à une
  (éclat doré pour un SSR). Un clic révèle tout.
- **Cinématiques** au lancement du jeu et à l'arrivée dans chaque nouveau monde (désactivables).
- **Grand écran** : les ennemis arrivent du bord droit de la scène au lieu d'apparaître au milieu.
- **Sprites coupés corrigés** et animations retravaillées.

### Corrigés en v8.1
- **« GitHub injoignable »** : seconde source (liste des versions publiées) si l'API GitHub est bloquée ou limitée,
  et la raison exacte est affichée.
- **Mode barre** : les boosts ne chevauchent plus l'or et le bouton d'agrandissement.

### v8.0
- **Recyclage automatique qui marche vraiment** : un objet n'est plus protégé parce qu'il a « un peu plus de PV »
  (même avec beaucoup moins d'armure). Le jeu compare maintenant le bilan global **dégâts × robustesse**
  (PV et armure), les stats secondaires départageant les égalités. En mode « Au ramassage », **le sac est aussi
  trié toutes les 3 s** (objets devenus moins bons qu'un nouvel équipement), et changer les règles les applique
  tout de suite aux objets déjà dans le sac. Les objets verrouillés et uniques restent toujours protégés.
- **Avancer automatiquement ne se décoche plus** quand le héros meurt : il recule d'une étape, la refait,
  puis retente tout seul. Le mode farm ne s'active que si vous le choisissez.
- **Menus stables en vitesse ×10** : le panneau n'est plus redessiné pendant un clic ni quand une liste
  déroulante est ouverte, au plus une fois par seconde quand c'est le jeu qui le demande, et les listes
  internes (inventaire…) gardent leur position de défilement. Le jeu est aussi plus léger avec un sac plein.
- **Carte du monde zoomable comme l'arbre de talents** : fenêtre qui défile, zoom 50 % à 250 %
  (− / + / ⟲ ou Ctrl + molette), glisser pour se déplacer, centrage sur la zone choisie.
- **Mises à jour** : dans la version bureau, la vérification passe par le programme lui-même (et non plus
  par la page), ce qui corrige « GitHub injoignable » ; en cas d'échec, la raison exacte est affichée.

### v7.9 (contient la v7.8, jamais publiée)
- **Version et mises à jour** (Paramètres) : affiche la version lancée, vérifie la dernière version publiée sur
  GitHub (aussi au lancement) et, dans la version bureau, **télécharge et installe la mise à jour en un clic**
  (sauvegarde puis redémarrage automatique). Notes de version consultables avant d'installer.
- **Vitesse des combats ×1 / ×2 / ×5 / ×10** : bouton ⏩ sur la scène, mémorisé avec la partie —
  idéal pour les boss coriaces.
- **Carte du monde zoomable** : boutons − / + / ⟲ (ou Ctrl + molette), glisser pour se déplacer ;
  la vue se centre sur la zone choisie.
- **Menus redessinés en pixel art** : panneaux à coins dorés et rubis, bandeau de titre, onglets en tuiles,
  boutons or / bleu / rouge, badges de statut et cases d'équipement dans le style de la planche d'assets.
- **Animations** : marche des monstres à quatre pattes fluide (plus de saccades), compagnons avec
  cycle de marche et attaque en deux temps (élan puis frappe).
- **Donjons** : chaque difficulté indique clairement comment la débloquer (terminer **ce** donjon dans la
  difficulté précédente, chaque donjon séparément), ✔ sur les difficultés réussies.

### Corrigés en v7.9
- **Version bureau : plantage au démarrage** de la v7.8 (« ui.update is not a function ») corrigé avant publication.
- **Codes de triche** qui ne faisaient plus rien (ainsi que l'activation/amélioration manuelle des boosts).
- **Victoires de donjon d'avant la v7.7** : elles débloquent maintenant la difficulté Normal.
- **Recyclage en masse** : toutes les raretés sont proposées (+ Épiques, + Légendaires) ; objets verrouillés,
  uniques et objets d'amélioration toujours protégés.
- La barre des boosts ne cache plus la barre de niveau.

### v7.7
- **10 mondes + le Trône de l'Abysse** : 4 nouveaux mondes (Marais putride, Îles célestes, Cœur du volcan,
  Royaume du Néant) avec décors, ennemis et 4 boss chacun. **Monde 11** : 10 étapes, chacune contre le méga boss
  d'un monde en **mode berserk**, qui invoque ses boss des étapes 5, 10 et 15 ; musique épique dédiée.
  Ensuite, retour au monde 1 en difficulté ×2, ×3…
- **Boss bien plus coriaces** (PV, dégâts, une partie de l'armure ignorée) et **rage** s'ils durent trop longtemps.
  Chaque méga boss a son **objet ancestral**.
- **Renaissance revue (et fusionnée avec le Prestige)** : niveau du héros, compétences et niveau des compagnons
  repartent à zéro, **un seul pouvoir ancestral conservé (au choix)** ; chaque Renaissance donne un bonus
  permanent, les **bonus éternels** s'achètent avec les fragments, et les **boss s'adaptent** (plus durs,
  mais plus généreux).
- **Donjons** : liste + fiche détaillée, **difficultés Facile / Normal / Difficile** (bien plus dures que la
  campagne), et ils rapportent les **fragments anciens** de l'arbre de talents.
- **Codex des boss** redessiné : liste + fiche (histoire, pouvoir actuel / proposé côte à côte, récompenses,
  piste de maîtrise) et **collections** (monstres, boss, équipements, compagnons) avec récompenses.
- **Équipe** : **compagnons** (humains) et **familiers** (animaux) bien séparés, invocations séparées,
  **rôles et synergies** visibles, **configurations** enregistrables (équipe + équipement), choix de qui remplacer.
- **Inventaire** en 3 colonnes (équipement autour du héros · fiche · inventaire par catégories), **100 places**,
  boutons toujours au même endroit, comparaison claire (« Si vous l'équipez : actuel → nouveau »),
  **recyclage automatique** au ramassage ou quand le sac est plein, selon la rareté et le type d'objet.
- **Butin** qui reste au sol plus longtemps et pop-up « N nouveaux objets » ; **missions** en onglets ;
  **contrats thématiques et contrats rares** ; nouveaux événements : **portail vers une salle au trésor** et **boss errant**.
- **Achat ×1 / ×10 / ×100 / Max** ; aide pour activer les **boosts** ; détail du bonus ×N au survol.
- **Barre du haut** : niveau + XP, étape et monde ; listes déroulantes lisibles ; onglets débloqués plus tôt.
- **Paramètres** : notifications réglables, **mode concentration**, rapport de retour hors ligne plus complet,
  **choix de la langue (français / anglais)**.
- Corrigés : familier invisible, cadenas géants sur les objets verrouillés, animations du dragon et des loups.

### v7.6
- **Mondes de 20 étapes et 4 boss par monde** : mini-boss à l'étape 5, boss à l'étape 10, boss redoutable
  à l'étape 15 et **méga boss** à l'étape 20, avec entrée spectaculaire (bannière, éclair, aura, braises).
  18 nouveaux boss dessinés, et les 6 méga boss redessinés et animés (Dragon des cendres, Roi démoniaque
  et Chevalier déchu refaits de zéro).
- **Après le monde 6, on repart du monde 1 en difficulté ×2**, puis ×3, ×4… (au lieu d'étapes sans fin).
- **Musique lo-fi / aventure** générée en direct (une ambiance par monde, boss et donjon), **effets sonores**
  et bruitages (coups, butin selon la rareté, boss, invocations, pas…). Volumes et coupure dans les Paramètres.
- **Boosts à durée limitée** (façon Tap Titans) : Rage du berserker, Frénésie, Main de Midas, Œil du chasseur,
  Lame fantôme. Boutons sur la scène, recharge visible, mode automatique, améliorables avec l'or.
- **Prestige** : après le monde 6, réinitialise aussi fragments et talents contre des étoiles et des bonus éternels.
- **Équipe** : le chevalier + **2 personnages** (R/SR/SSR) + **1 compagnon** ; onglet « Équipe » qui les sépare
  clairement. Le panneau Héros n'affiche plus la colonne de chevaliers vides.
- **SSR et donjons** : hors de leur donjon, les SSR sont un peu au-dessus des SR ; dans leur donjon, ils écrasent
  tout (compétence ×6, passif ×4, dégâts de l'équipe +150 %, dégâts subis −60 %).
- **Week-end ×2** (samedi et dimanche, 48 h) sur l'or, l'XP, le butin et les événements, cumulable avec le démarrage rapide.
- **Beaucoup plus de gemmes** : chaque boss, chaque niveau du héros, chaque nouvelle étape et nouveau monde,
  et parfois les monstres eux-mêmes.
- **Vitesse d'attaque** : plus de blocage à 4 att./s ; elle progresse toujours, de plus en plus lentement.
- **Compétences** : 50 niveaux au lieu de 10 (les paliers supérieurs coûtent plus de points).
- **Butin visible** : l'objet jaillit du monstre, brille à sa rareté et file vers le chevalier ; gemmes visibles aussi.
- **Animations** : marche des personnages, sautillement des compagnons, battement d'ailes des volants,
  images de marche et d'attaque des boss ; yéti et troll redessinés.
- **Missions** : sections repliables et bouton **Tout récupérer** ; boîte de récompenses : « Tout récupérer »
  et la pastille disparaît une fois les messages lus.
- **Invocation** : les probabilités montrent la tête de chaque personnage et compagnon (avec sa rareté).
- **Arbre de talents** : zoom (boutons ou Ctrl + molette) et cases plus espacées.

### v7.5
- **20 héros invocables** (8 R, 7 SR, 5 SSR) qui combattent aux côtés du chevalier, chacun avec son
  passif, sa compétence et ses animations ; nouvel onglet **Invocation**.
- **Donjons des SSR** : 4 nouveaux donjons (Sanctuaire sylvestre, Fournaise des sables, Glacier éternel,
  Citadelle des ombres) en plus de la Crypte. Chaque SSR est adapté à un donjon : dans son donjon,
  compétence ×3, passif ×2 et dégâts subis par l'équipe −35 %.
- **Démarrage rapide** : pendant les 5 premières heures de jeu, or et XP ×3, butin et événements
  bien plus fréquents, un ticket d'invocation par boss ; le bonus diminue ensuite progressivement.
- **Missions journalières, hebdomadaires et mensuelles** + **calendrier de connexion** sur 7 jours :
  gemmes, tickets, clés et un coffre bonus quand toutes les missions d'une période sont faites.
- **Accessoires** : collier, boucles d'oreilles, anneau et bracelet, en plusieurs modèles et plusieurs
  couleurs de pierre ; ils améliorent les statistiques secondaires (critique, vol de vie, butin…).
- **Amélioration d'équipement** : 5 fois pour Commun et Rare, 10 fois pour Épique et Légendaire ;
  chaque amélioration renforce une statistique au hasard.
- **Fusion** : 5 objets du même emplacement et de la même rareté donnent 1 objet de la rareté supérieure.
- **Butin** : tables de butin des boss (essences garanties), fabrication Épique, recyclage automatique
  au ramassage (jamais une amélioration ni un objet verrouillé), notifications discrètes.
- **Arbre de talents** redessiné façon grille de runes : cases carrées, traits fins, état visible d'un coup d'œil.

### v7.4
- **Corrigé** : dans une fenêtre large et peu haute, la scène pouvait dépasser la fenêtre (on ne voyait que le ciel,
  sans onglets) ; elle reste maintenant dans la fenêtre.
- **Interface plus compacte** : barre du haut, onglets, barre de progression et zoom maximal réduits.
- **Mode barre** (façon jeu de barre des tâches) : dans une fenêtre très basse, seuls la scène, le niveau
  et l'or restent affichés. Bouton « Barre » dans les options (fenêtre 520 × 150) et ⤢ pour ré-agrandir.
- **Mouvements plus fluides** : la scène est dessinée à la résolution de l'écran, les monstres avancent
  pixel d'écran par pixel d'écran (et non plus par sauts de 3-4 pixels).
- **Un seul arbre de talents** qui part du **Cœur du chevalier** au centre et s'étend dans les 4 directions ;
  les nœuds ne se chevauchent plus. Les parties qui avaient déjà des talents reçoivent le Cœur au niveau 1.

### v7.3
- **Arbre de talents** : les icônes ne sont plus écrasées ni ne dépassent (l'épée et les autres images
  gardent leurs proportions), nouvelle icône pour Puissance, niveaux affichés sous chaque nœud,
  flèches plus visibles, arbre centré à une taille lisible dans les grandes fenêtres.
- Plus généralement, aucune icône de l'interface n'est plus déformée.

### v7.2
- **Aucun onglet ouvert au démarrage** : le jeu occupe toute la fenêtre.
- **Un clic sur un onglet l'ouvre** (l'interface se déploie sous le jeu), **un second clic le referme**
  (le bouton ✕ et la touche Échap aussi).
- Zoom de la scène plafonné : dans une grande fenêtre, on voit davantage du niveau.

### Rappel de la v7

L'installation se fait désormais **en un clic** et **remplace toujours l'ancienne version** : plus de doublons,
même si une ancienne version avait été installée « pour tous les utilisateurs » (elle est désinstallée,
Windows peut demander une confirmation). **Votre partie est conservée.**

L'exécutable n'est pas signé : si Windows SmartScreen s'affiche, cliquez sur
**Informations complémentaires**, puis **Exécuter quand même**.

### Équilibrage
- Progression plus lente : 15 ennemis par étape, dégâts de départ plus bas, améliorations un peu plus chères,
  objets qui grandissent moins vite, niveaux du héros plus longs à gagner.
- **Les boss ne tuent plus en un coup** : leurs dégâts sont réduits (×1,4 au lieu de ×2) et la croissance
  des dégâts ennemis ralentie, mais ils ont plus de PV (×20) : un boss se gagne aux dégâts.
- **Points de vie** : comme les Dégâts, l'amélioration donne un palier ×1,4 tous les 10 niveaux.

### Équipe
- Équipe de 3 : **le chevalier (toujours présent) + 2 compagnons** au choix.

### Interface
- **Jeu en bandeau** : la scène occupe toute la largeur en haut, les onglets dessous, l'interface en dessous.
- **Vrai arbre de talents** : chaque branche se divise en deux, avec des flèches ; 8 nouveaux talents
  (Tueur de géants, Célérité, Hérisson, Soif de vie, Flair du trésor, Sagesse, Écho ancestral, Chef de meute).
- **Portraits animés** dans les menus : le chevalier respire, sa cape flotte et il fait un moulinet d'épée ;
  les compagnons sautillent, les boss du Codex bougent.
- Corrigé : l'aperçu du chevalier sous « Verrouiller » n'est plus écrasé ; « Max » tient dans les boutons.

### Fluidité et décors
- **Animation bien plus fluide** : la simulation avance à chaque image et les positions sont interpolées
  (avant, les ennemis et le décor bougeaient par saccades 10 fois par seconde).
- **Parallaxe plus vivante** : particules d'ambiance sur deux profondeurs (pollen, lucioles, éclats de cristal,
  sable, neige, braises) en plus des calques de décor.
- **Nouveau dragon** (Dragon des cendres) redessiné.

### Hors ligne
- Gains hors ligne à **65 %** du rythme actif (35 % de moins), **jusqu'à 24 h** d'absence.

Testé automatiquement sur Windows avant publication : lancement, combat, sauvegarde, relance ; mise à jour
d'une installation v6 (pour l'utilisateur courant, puis « pour tous les utilisateurs ») avec reprise de la partie
et une seule installation à la fin.
