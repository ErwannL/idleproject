# Ascendrya 9.3.5 — refonte pour les débutants

## 1. Comment ça marchait (avant 9.3.5)

- **Barre jaune « Prochaine action »** (`core/guide.js` `nextAction`) : seulement récupérer, équiper UN objet (ouvrait
  le sac sans équiper), retenter le boss, objectif. Jamais d'invocation, de compagnon, de compétence, d'amélioration,
  de clé, de recyclage, de fusion ni de Renaissance.
- **Équipement** : 7 emplacements pour le chevalier, système séparé pour les compagnons (9.3.3). Unifié en 9.3.4 f
  (3 places, objets partagés par classe, migration v12).
- **Compagnons** : jamais placés automatiquement ; montée de niveau jamais proposée.
- **Forge** : onglet à part depuis 9.3.4 (recyclage des inutiles, pastille).
- **Déblocages** : `ui.js` (`visible`) + `core/unlocks.js` ; 4 menus, 16 onglets en quelques minutes.
- **Tutoriel** : cinématique + bulles (`ui/onboarding.js`) + doigt animé 9.3.4 (`ui/tutorial.js`).

## 2. Ce qui a été fait (dans l'ordre demandé)

| Étape | Contenu | Fichiers |
|---|---|---|
| a | Barre jaune = guide de tout le jeu, un clic fait l'action (équiper tout, placer, compétences, invocation, améliorer, monter un compagnon, recycler, forge, clés, Renaissance, « Boss : 88 % de vie restante ») ; placement automatique du compagnon invoqué ; « Améliorer l'équipe » | `core/guide.js`, `main.js`, `ui.js`, `panels/companions.js` |
| b | Bugs §14 : Équipez (1), Expéditions (2), bulle Objectifs (3), Renaissance « plus tard » (4, 9.3.4), +1 copie (5), douze mondes (6), survie (7), gemmes (8), rôle unique (9), image sans `onerror` (10), objet d'une autre classe (11) | divers |
| c | 5 boutons : Combat, Héros, Équipe, Aventure, Quêtes ; Profil en haut (Apparences, Classement, Guilde, Statistiques) ; Boutique dans le coffre du haut ; Arène dans Défis ; Événement après le monde 2 ; Expéditions à 5 compagnons ; missions jamais sur une fonction verrouillée ; boutons indisponibles grisés ; paliers de dépenses cachés à qui n'a rien acheté | `nav.js`, `index.html`, `ui.js`, `core/missions.js`, `panels/contracts.js`, `panels/shop.js`, `panels/tower.js` |
| d | Tutoriel guidé : équiper, Dégâts, Frappe rapide, puis invocation et placement ; bulle 3 corrigée | `ui/tutorial.js`, `ui/onboarding.js` |
| e | Popup compagnon (9.3.4) ; « NOUVEAU » / « +1 copie » | `panels/summon.js` |
| f | Vocabulaire (9.3.4) + « gemmes » partout dans la boutique | `data/economy.js` |
| g | Forge (9.3.4) | — |
| h | 3 améliorations au début (Dégâts, PV, Or), +1 tous les deux boss (Défense avant Armure) ; « Améliorer au mieux » ; « Tu survis N coups du boss », « Survie ×N » ; talent conseillé ; pouvoir conseillé à la Renaissance ; écran « Tu es plus fort : ×N pour toujours » ; écran de victoire de donjon (butin, couronnes, Rejouer) ; Arène : équipe de campagne par défaut, « Modifier » | `core/unlocks.js`, `panels/upgrades.js`, `panels/tree.js`, `ui.js`, `panels/arena.js` |
| i | Toucher le combat : étincelle + petit coup (10 % d'un coup du héros) ; nom court sous les boosts ; touches Q W E R T seulement avec souris et clavier | `core/combat.js` `tapHit`, `main.js`, `ui.js` |
| j | Équipement unique (9.3.4 f, validé) | `core/companion-gear.js`, `core/migrations-v934.js` |

Équilibrage : aucune valeur, coût ni taux modifié. Seuls ajouts de mécanique : le petit coup au toucher (§5,
demandé) et l'ordre d'ouverture des améliorations (§10, demandé).

9.3.6 : sur téléphone (scène haute), personnages ×1,4 et sol remonté aux deux tiers (§5) ; Arène sur une grande scène
au décor du monde des ennemis, avec les vrais monstres et boss de la campagne (§11). Captures avant (9.3.3) / après
(9.3.6) de 7 écrans à 390 px et sur PC : `docs/screenshots/v935/avant-apres`.

## 3. Partie test « je ne suis que la barre jaune »

`node tools/sim-guide-v935.mjs 60 1` (vrai moteur, aucune autre action) :

| | Guide, première version | Guide final 9.3.5 |
|---|---|---|
| Monde 4 atteint | 29 min, 1 compagnon, 2 500 gemmes inutilisées | 23,5 min, équipe complète |
| Après 60 min | monde 5 (5-15), un seul compagnon, jamais monté | monde 6 (6-20), compagnons montés |

(La première version ne proposait l'invocation qu'une fois et l'or partait toujours dans les améliorations ; corrigé :
invocation tant qu'une place est libre, montée d'un compagnon quand elle coûte moins que l'amélioration proposée,
compétences nouvellement débloquées apprises d'abord.)

Le joueur qui ne suit que la barre dépasse le monde 4 sans aide.

## 4. Visuels PixelLab (section 15)

Les illustrations des 31 compagnons et familiers existent déjà (`assets/hd`, `assets/hd/px`) : rien à refaire.

| Fichier | Taille / frames | Prompt PixelLab | Utilisé dans |
|---|---|---|---|
| `assets/ui/class_attacker.png`, `class_defender.png`, `class_support.png`, `class_beast.png` | 24×24, 1 | pixel art class icon: crossed sword and bow / round shield / wooden staff with glow / paw print, dark outline, bright palette, transparent background | pastilles de classe (objets, popup compagnon) |
| `assets/ui/elem_water.png`, `elem_fire.png`, `elem_nature.png`, `elem_light.png`, `elem_dark.png` | 24×24, 1 | pixel art element icon: water drop / flame / leaf / sun / crescent moon, dark outline, bright palette, transparent background | pastilles d'élément |
| `assets/ui/skill_passive.png`, `skill_active.png`, `skill_ultimate.png` | 32×32, 1 | pixel art skill frame icon: shield rune / lightning burst / star explosion, gold border, dark outline, transparent background | compétences sans icône propre |
| `assets/ui/slot_<classe>_<place>.png` (12) | 48×48, 1 | pixel art faded empty equipment slot silhouette: (attacker) sword / leather vest / ring, (defender) sword / plate armor / emblem, (support) orb / robe / talisman, (beast) runic fangs / collar / rune stone, transparent | places vides de l'écran Équipement |
| `assets/ui/forge_tile.png` | 360×120, 1 | pixel art blacksmith forge banner, anvil, glowing furnace, warm orange light, dark outline | tuile Forge |
| `assets/ui/forge_bg.png` | 360×240, 1 | pixel art dark forge interior background, stone walls, embers, no characters | fond de l'onglet Forge |
| `assets/ui/forge_anvil_anim.png` | 64×64, 6 frames | pixel art anvil struck by hammer, sparks, animation sheet, transparent background | animation de forge |
| `assets/ui/forge_sparks.png` | 32×32, 4 frames | pixel art orange sparks burst animation, transparent background | coups de marteau, recyclage |
| `assets/ui/shards.png` | 32×32, 1 | pixel art pile of glowing blue crystal shards, dark outline, transparent | compteur et popup des éclats |
| `assets/ui/victory_dungeon.png` | 360×160, 1 | pixel art victory banner with crowns and treasure chest, golden light, dark outline | écran de victoire de donjon |
| `assets/ui/victory_rebirth.png` | 360×160, 1 | pixel art phoenix rising over a hero silhouette, golden rays, dark outline | écran « Tu es plus fort » |
| `assets/ui/new_banner.png` | 160×40, 1 | pixel art ribbon banner reading NEW with sparkles, gold and red, transparent | cartes « Nouveau ! » |
| `assets/ui/tuto_hand.png` | 32×32, 4 frames | pixel art white glove hand pointing and tapping, dark outline, animation sheet, transparent | doigt du tutoriel (remplace 👆) |
| `assets/ui/frame_common.png`, `frame_rare.png`, `frame_epic.png`, `frame_legendary.png` | 48×48, 1 | pixel art item frame, grey / blue / purple / gold border with corner gems, transparent center | cadres de rareté |
| `assets/ui/pill_<rareté>.png` (4) | 64×16, 1 | pixel art small rounded label plate, grey / blue / purple / gold, transparent | pastilles de rareté |
| `assets/ui/cur_<monnaie>.png` (gold, gems, shards, keys, fragments, grimoires, stones, essences, coins, tickets) | 32×32, 1 | pixel art currency icon: gold coin / blue gem / crystal shard / iron key / ancient rune fragment / spell book / ascension stone / glowing essence vial / event coin / ticket, dark outline, transparent | popups d'aide des monnaies |
| Ennemis de l'Arène | — | réutiliser les sprites de campagne (`src/render/sprites.js`) | Arène sur la grande scène (étape suivante) |

En attendant les visuels, des remplacements propres sont en place (emoji, icônes existantes, CSS).
