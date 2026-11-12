# Ascendrya 9.3.9 — rendre le jeu fun et addictif (prompt « 2.3.7 »)

Le prompt 2.3.7 a été écrit sur la 9.3.7. La 9.3.8 (10 novembre) avait déjà livré une bonne partie de ce qu'il reprend
du prompt 2.3.6 : combat en vagues (3.1), familiers sans équipement (3.2), Quêtes Jour · Semaine · Mois · Hauts faits
avec coffre de la semaine (3.3), écran Équipement agrandi et héros à 6 places (3.4), bouton Combat retiré et menu qui se
referme d'un toucher (3.5), « Répartir les points » (3.6), et la plupart des idées du point 4 (combo, compte à rebours,
coffre d'étape, grands moments, prochain déblocage, ×2 du jour, cadeau du jour). La 9.3.9 traite le reste.

## 1. Comment ça marchait (9.3.8)

- **Scène** (`render/scene.js`) : l'échelle visait ~200 px logiques de large, plafonnée à ×3 ; sur PC (1 116 × 960) la
  scène faisait 343 × 287 px logiques, sol tout en bas (ciel ≈ 70 %). Le sol n'était remonté (68 %) que sur un téléphone
  en portrait. `wx()` étirait la zone d'approche jusqu'au bord droit : jusqu'à 5,8 fois trop vite sur PC. Les vagues
  naissaient à x = 100 (milieu de l'écran PC).
- **Impacts** : recul 3 à 8 px logiques, arrêt sur image 35 / 70 ms, tremblement de 2 px sur critique.
- **Panneaux** : chaque mise à jour remplaçait tout le HTML du panneau (`body.innerHTML = …`) : la fiche compagnon
  (dans le panneau) disparaissait et rejouait son animation d'entrée à chaque clic ; fenêtres centrées verticalement.
- **Ressources de compétence** (`data/progression.js`) : sources réelles (donjons, Arène, missions du jour, coffre de la
  semaine, boss, boutique de l'événement), écrites nulle part ; Pierre d'ascension = icône du Vol de vie, Essence de
  maîtrise = icône des Étoiles. (Le coffre de la semaine donne bien 6 Pierres et 3 Essences depuis la 9.3.8.)
- **Prologue / tutoriel** : le prologue est une couche HTML ; la simulation et le tutoriel continuaient dessous.

## 2. Ce qui a été fait

| Étape | Contenu |
|---|---|
| a (2.4, 2.5) | Bouton qui s'enfonce et brille à chaque clic ; « Niv. N ! » ou « +1 » qui monte ; monnaies gagnées qui volent vers leur compteur ; bouton grisé qui tremble et dit pourquoi (« Il manque 2 Grimoires »), avec un petit son. « Tout récupérer » fait plusieurs passes (Collections, hauts faits, primes…) puis montre un récapitulatif en icônes. Panneaux mis à jour sur place (`ui/morph.js`) : la fiche ne se recrée plus ; fenêtres ancrées en haut : déplier un détail n'a plus rien qui remonte sous le doigt. |
| b (2.1, 2.2) | Plus d'étirement : les ennemis naissent juste derrière le bord droit (`world.viewEdgeX`) et marchent à vitesse constante. PC : scène ≈ 215 px logiques de large (personnages ×1,6), sol à 65 % ; barre de vague et prochain déblocage rangés dans la terre sous le sol. |
| c (2.3) | Recul ×2 à 3, écrasement plus long sur critique, arrêt sur image 100 ms sur critique et 80 à 120 ms au coup de grâce, monstre tué projeté en arrière qui clignote avant d'éclater, pièces qui volent au compteur d'or, chiffres plus gros (blanc / jaune critique / orange compétence), barre de vie en deux temps (part blanche), tremblement sur compétences de zone et coups de boss (réglage « Tremblement de l'écran »). Sons : coup grave sur les boss, coups des compagnons, amélioration réussie, refus. |
| d (2.6) | Toucher une ressource (coût ou compteur) ouvre sa fiche : ce que c'est, combien on en a, à quoi elle sert, « Où en trouver » avec un bouton « Y aller » par source. Nouvelles icônes Pierre d'ascension (pierre runique) et Essence de maîtrise (fiole dorée). |
| e (3.7, 3.8) | Partie en pause pendant le prologue ; tutoriel seulement après le prologue et le titre. Aide de l'invocation : un compteur par invocation, Légendaire au plus tard à la 100e (compagnons) et à la 60e (familiers), valeurs lues dans les données. |
| g (2.9) | « Défense » et « Peau de fer » fusionnées : la migration monte la Défense jusqu'à ce que les dégâts subis (équipement, talents et Défense d'avant compris, calcul réel des stats) ne soient jamais plus élevés ; Peau de fer n'est plus achetable ; l'environnement des Cavernes est contré par la Défense. |
| g2 (3.9) | Talents : vue simple par défaut — 6 branches nommées par ce qu'elles font (Attaque, Chasse aux monstres, Or et butin, Compagnons, Compétences, Survie), 15 paliers, gros palier tous les 5, bonus total écrit en clair, « Apprendre » (le moins cher de la branche) et « Apprendre le meilleur », phrase sur la Renaissance en haut, pastille quand un talent est apprenable. L'arbre complet devient « Arbre avancé », ouvert après 3 Renaissances (ou pour qui avait déjà plus de 40 niveaux appris). Mêmes nœuds, mêmes fragments : rien à rembourser. |
| — | Héros : le heaume fermé laisse voir le visage (il ne ressemble plus à un monstre). |
| — | Correctif : un monstre de derrière ne se disait « arrivé » qu'en rattrapant celui de devant, loin de la ligne : le héros se remettait à marcher. |

**Choix à signaler**

- « Chasse aux boss » proposé dans le prompt : les bonus contre les boss sont dans la branche Attaque ; la branche
  « Chasse » donne dégâts contre les monstres, XP, vol de vie et butin : elle s'appelle « Chasse aux monstres ».
- Boss en 30 s : la 9.3.8 affiche déjà un compte à rebours rouge, mais jusqu'à la rage (60 s) ; un vrai 30 s demande de
  baisser les PV des boss. À trancher.

## 3. Mesures

`tools/sim-guide-v935.mjs` (nouvelle partie, uniquement la barre jaune, vitesse ×1), avec la largeur d'une scène PC
(bord droit à 161) :

| Graine | Monde 8 | Combat | 2 compagnons avant le monde 3 |
|---|---|---|---|
| 1 | 75 min | 68 % | oui |
| 2 | 88 min | 65 % | oui |
| 3 | 113 min (9.3.8 : 101 min) | 65 % | oui |

`tools/measure-waves-v938.mjs` (puissance fixe, étape 130) : or/min 5,64 M contre 5,75 M en 9.3.8 (−2 %), monstres
tués/min 40,8 contre 41,2.

## 4. Reste à faire : l'art PixelLab (2.7, 2.8, 5)

Le fichier `pixellab-a-refaire-v2.3.7.txt` et les images ne sont pas encore arrivés. Dès qu'ils sont là : compagnons
au gabarit des Légendaires (squire, mercenary, ranger, dwarf, shadow, lancer, priestess, pyromancer, ninja, rose_blade,
barbarian, witch, elf_archer, high_priest, azure_paladin ; familiers cat, owl, slime, wisp, golem, fairy, avec _w1, _w2,
_f1, _f2, _atk), puis les icônes (améliorations, ressources, compétences, monnaies, menus), branchées par leur nom de
fichier, et les anciennes versions dessinées dans `src/render/art.js` retirées une par une. En attendant, la Défense
garde l'icône « shield » ; `icon_defense` la remplacera.
