# Ascendrya 9.3.4 — refonte de l'interface : état des lieux, plan, modèle d'équipement unique

## 1. Comment ça marche aujourd'hui (résumé)

- **Menus** : 4 menus (`src/ui/nav.js` : Héros, Aventure, Équipe, Objectifs) ; chaque onglet est un panneau
  (`src/ui/panels/*.js`, un `render(ui, state)` qui renvoie du HTML) ; `src/ui/ui.js` (2 050 lignes) gère clics,
  rafraîchissement, fenêtre modale (`openModal`), cartes « Nouveau » (`UNLOCK_INFO`) ; style dans `src/ui/style.css`
  (3 000 lignes, variables `--bg-*`, `--gold`, raretés). Une bascule téléphone met le panneau en feuille du bas.
- **Équipement du chevalier** : 7 emplacements (arme, casque, armure + 4 bijoux), 63 bases, 4 raretés, affixes,
  sets, amélioration, recyclage en éclats, forge (`core/inventory.js`, `core/forge.js`, `ui/panels/inventory.js`).
  Les armes sont réservées par classe du chevalier (`data/classes.js`), le reste va à toutes.
- **Équipement des compagnons (9.3.3)** : système séparé (`core/companion-gear.js`) : 4 classes, 3 emplacements,
  13 bases, butin Arène/donjons.
- **Compagnons** : grille de 41 cartes + fiche dépliée dessous (`ui/panels/companions.js`), compétences
  passive/active/ultime (9.3.3), copies 1 à 6.
- **Forge** : bouton dans l'écran Équipement ; recyclage dans le détail d'un objet et dans « Réglages du sac ».

## 2. Plan (livrables séparés, dans l'ordre demandé)

| Étape | Contenu | Fichiers |
|---|---|---|
| a | Popup de détail des compagnons (splash, pastilles, 3 chiffres, 3 compétences en icônes, bulle de compétence, Copies, onglets Compétences/Équipement/Histoire, 2 boutons) ; grille en 2 onglets, cartes sans coupure | `ui/panels/companions.js`, `ui/unit-popup.js` (nouveau), CSS |
| b | Écran Équipement : sélecteur de personnage, Puissance en gros, emplacements nommés, sac + filtres en icônes, popup d'objet (2 boutons + ⋯), suppression des doublons d'information | `ui/panels/inventory.js` |
| c | Vocabulaire : Commun/Rare/Épique/Légendaire partout (plus de SSR/SR/R), éléments Eau/Feu/Nature/Lumière/Ténèbres, Copies, Puissance | `core/elements.js`, `ui/panels/summon.js`, `hero.js`… |
| d | Compétences du chevalier : sections Attaques (points) / Boosts (or), nom sous l'icône, badge Nv, cadenas, bulle | `ui/panels/skills.js` |
| e | Forge à part : tuile, boucle Recycler → Éclats → Forger, recyclage des inutiles avec aperçu, auto-recyclage au 1er sac plein, animations, pastille | `ui/panels/forge.js` (nouveau) |
| f | **Équipement unique héros + compagnons** (§3) — **attend ta validation** | `core/inventory.js`, migration v12 |
| g | Hiérarchie (1 bouton doré par écran, cartes, secondaire replié), menu « Plus », améliorations progressives, invocation sans jargon, talents | CSS, `upgrades.js`, `summon.js`, `tree.js` |
| h | Premières minutes : doigt animé (Dégâts, objet, recyclage, compagnon), bulles « ×1,5 » et « Tout récupérer » | `ui/tutorial.js` (nouveau) |

Aucun changement d'équilibrage (valeurs, coûts, taux) dans a–e, g, h. Traductions anglais/coréen tenues à 100 %.

## 3. Équipement unique — modèle proposé (à valider avant la migration)

**Objet** : `{ id, baseId, rarity, level, upgrades, affixes, set?, locked? , cls }` — on garde l'objet actuel du
chevalier (affixes, sets, amélioration, recyclage, forge inchangés) et on ajoute **`cls`** :
`attacker | defender | support | beast`. **Emplacements** : `weapon | armor | accessory` pour tout le monde.

**Classes** : chevalier = classe de son style (Chevalier/Paladin/Gardien → Défenseur ; Archer, Mage, Assassin,
Berserker → Attaquant ; Prêtre → Soutien) ; compagnons = 9.3.3 (`gearClassOf`). Nom et visuel de l'emplacement par
classe (Familier : Crocs, Collier, Rune).

**Conversion des 7 emplacements actuels du chevalier** (sans perte de puissance) :
- arme → `weapon` ; armure → `armor` ; **casque fusionné dans l'armure** : la nouvelle armure prend la somme des
  stats armure + casque ;
- 4 bijoux → **un `accessory`** qui cumule les stats des 4 bijoux portés (les autres bijoux du sac restent, chacun
  devient un accessoire) ;
- sets : bonus de set calculés sur 3 pièces au lieu de 7 (seuils 2 et 3 pièces) — **à valider**, c'est le seul
  point qui touche l'équilibrage.

**Conversion de l'équipement des compagnons 9.3.3** : `offense → weapon`, `guard → armor`, `trinket → accessory` ;
stats en % converties en stats plates au niveau de l'étape max du joueur (même gain de puissance mesuré).

**Butin** : chaque objet lâché tire sa classe parmi celles de l'équipe en place (poids = nombre de membres de la
classe), 25 % au hasard pour garder de tout.

**Questions** : (1) casque fusionné dans l'armure et 4 bijoux en 1 accessoire : OK ? (2) sets à 3 pièces : OK ?
(3) classe du chevalier selon sa classe de combat (Défenseur pour le Chevalier de départ) : OK ?
