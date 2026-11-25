# Ascendrya 10.15.0 : les Géants (8 nouveaux grands boss dessinés)

> **Pour Claude** :
> - Base : la branche `claude/nouveaux-titans-v1015`, ou `main` si elle est fusionnée. Version actuelle : 10.14.2.
> - Lis d'abord `docs/geants-v1015.md`. Il décrit ce qui est déjà codé : les fiches des 8 géants, le moteur qui accepte
>   des boss d'une autre forme et la rotation des Fêtes.
> - Code : `src/data/grand-bosses.js` (`GIANTS`, fonction `giant`), `src/render/world-boss-scene.js` (`resolveAnim`,
>   `artLook`), `src/data/fest.js` (`festBoss`), `tests/v1015-giants.test.js`.
> - **Ce qu'il te reste à faire : les dessins.** Le code est prêt. Chaque géant reste hors du jeu tant que ses
>   planches ne sont pas posées et que sa fiche n'est pas passée à `ready: true`.
> - Un commit par géant. Lance `npm test` (tout doit être vert) à chaque commit. Pour chaque géant, fais des captures
>   PC (1116 × 993) et téléphone (412 × 915) du combat : au repos, pendant le jet, pendant le souffle et en phase 3.
>   Range-les dans `docs/screenshots/v10.15/`.

## Ce que dit le joueur

> « La dernière version est sortie, tu pourrais la tester et voir les nouveaux boss à faire, et ajouter des styles de
> Titan ou autres, comme le Colosse, de gros monstres. »

Constat du test de la 10.14.2 : les combats marchent sans erreur, mais les 8 grands boss du jeu (le Colosse et les
7 Titans du jour) ont **la même silhouette**. Les Titans sont le Colosse recoloré. Le joueur veut de **vrais gros
monstres différents**.

## 1. Les 8 géants (fiches déjà écrites)

| Ordre | id | Nom | Silhouette à dessiner | Décor | Jet (`throw`) | Souffle (`beam`) | Image |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `leviathan` | Léviathan des Abysses | Serpent de mer géant qui sort de l'eau, tête de dragon marin, nageoires en crête, écailles bleu nuit, ventre clair | abyss | Bulle d'eau des abysses | Jet d'eau sous pression (gueule) | 160 |
| 2 | `dragon_mother` | Mère des Dragons | Dragonne rouge et or immense, ailes à demi ouvertes, couronne de cornes, posée sur ses quatre pattes | volcano | Boule de feu | Souffle de feu | 192 |
| 3 | `storm_god` | Dieu de l'Orage | Géant humanoïde en armure de bronze, barbe de nuages, grand marteau, éclairs autour des bras | sky | Marteau lancé | Foudre des yeux | 160 |
| 4 | `hydra` | Hydre des Marais | Corps de crocodile massif, **cinq** têtes de serpent sur de longs cous, mousse et vase | swamp | Crachat d'acide | Souffle putride (tête du milieu) | 160 |
| 5 | `sand_wyrm` | Ver des Sables colossal | Ver géant dressé hors d'une dune, gueule ronde à trois mâchoires et dents en cercle, carapace annelée ocre | desert | Rocher des dunes | Souffle de sable | 160 |
| 6 | `frost_giant` | Jarl du Givre | Géant barbu à peau bleu pâle, armure de glace et fourrure, massue de glace, stalactites sur les épaules | mountains | Bloc de glace | Souffle glacial | 160 |
| 7 | `elder_treant` | Arbre-Monde | Arbre-géant qui marche, une petite forêt sur les épaules, visage dans l'écorce, yeux de sève verte, racines pour pieds | forest | Souche lancée | Rayon de sève (yeux) | 192 |
| 8 | `void_maw` | Dévoreur du Néant | Masse sombre et flottante, une gueule immense au centre, des dizaines d'yeux violets, tentacules | void | Orbe du Néant | Regard des mille yeux | 160 |

Les noms, phases, attaques, couleurs, décors et récompenses sont déjà dans `GIANTS`. Ne les change pas sans
demander au joueur.

## 2. Les planches (PixelLab)

Même méthode que le Colosse et `LISTE-PIXELLAB.md` : l'API PixelLab (`tools/art/pl939_api.py`, clé
`PIXELLAB_API_KEY`) et un nouveau script `tools/art/pl1015_giants.py` sur le modèle de `tools/art/pl1014_art.py` et
`tools/art/pl939_anims.py`. Les sorties brutes vont dans `tools/art/pixellab1015/<id>/`, et `--install` les copie dans
`assets/world-boss/<id>/`. Sont interdits : le dessin au pixel avec Pillow, les formes en CSS, le recoloriage du
Colosse, et les images d'une autre source.

**Étape 1, une planche de contrôle d'abord.** Génère la pose de repos des 8 géants et monte-les côte à côte avec le
Colosse (`assets/world-boss/colossus_idle.png`, image 0) dans `tools/art/preview_giants.png`. Montre-la au joueur
**avant** d'animer. La taille, la lisibilité et le style doivent aller avec le Colosse.

Style commun à mettre au début de chaque prompt :

> 16-bit fantasy pixel art boss, huge monster, side view facing LEFT, full body visible, feet (or base) on the bottom
> edge, transparent background, clean 1px dark outline, soft light from top-left, readable silhouette, no text

Références : `assets/world-boss/colossus_idle.png` (taille et finition), `assets/world-boss/colossus_throw.png` (le jet)
et `assets/world-boss/colossus_beam.png` (le rayon).

**Format de chaque planche** : `assets/world-boss/<id>/<id>_<anim>.png`. C'est **une seule rangée** de `n` images
carrées de `frame` px (160 ou 192, voir le tableau), avec **exactement `n` images** : pas d'image de réserve, au
contraire du Colosse. Les pieds (ou la base) sont sur la ligne `frame − 6`. Le géant regarde à gauche et occupe la même
place d'une image à l'autre.

| Planche | Images | Ce qu'on voit | Obligatoire |
| --- | --- | --- | --- |
| `idle` | 8 | Respiration lente, ondulation (eau, flammes, feuilles, tentacules) | oui |
| `attack` | 9 | Coup ordinaire (griffe, morsure, coup de marteau) vers la gauche | oui |
| `hurt` | 6 | Recul quand il est touché | oui |
| `throw` | 13 | Il prépare son projectile (images 0 à 8) ; **le projectile quitte la gueule ou la main à l'image 9** ; retour au repos (10 à 12). Le projectile lui-même n'est pas dessiné dans la planche (le jeu le dessine). | oui |
| `beam` | 13 | Il ouvre la gueule ou les yeux s'allument (charge aux images 3 et 4) ; **souffle de l'image 5 à l'image 8**, la tête qui balaie un peu vers le bas ; retour (9 à 12). Le souffle n'est pas dessiné (le jeu le dessine depuis le point `eyes`). | oui |
| `death` | 13 | Il s'effondre (le jeu la joue à l'envers pour le relever à chaque Éveil) | oui |
| `idle3`, `attack3` | 8, 9 | Forme de colère (phase 3) : yeux et marques qui brillent, couleurs plus chaudes | conseillé |
| `quake` | 9 | Il frappe le sol (queue, pattes, marteau) | conseillé |
| `embers` | 9 | Il lève la tête vers le ciel (une pluie tombe ensuite) | conseillé |
| `transform` | 13 | Passage à la forme de colère | facultatif |

Une planche absente prend automatiquement la plus proche (`ANIM_FALLBACK` : `beam3` → `beam` → `attack`, `quake` →
`attack`…). Avec les 6 planches obligatoires, le géant joue donc tout le combat. Les autres ajoutent du spectacle.

## 3. Brancher un géant

1. Pose les planches et vérifie leurs tailles : `node --test tests/v1015-giants.test.js` contrôle chaque fichier dès
   que `ready: true`.
2. **Mesure les repères** sur les planches finies et remplace les valeurs provisoires de la fiche (pixels de
   l'image) :
   - `art.eyes.beam` : 13 entrées `[x1, y1, x2, y2]`, une par image de `beam`. C'est le point d'où part le souffle
     (bouche : deux fois le même point ; yeux : les deux yeux).
   - `art.hands.throw` : le point d'où part le projectile à l'image 9 de `throw`.
   - `art.box` (facultatif) : la silhouette visible `[x, y, largeur, hauteur]`, là où tombent les coups et les
     chiffres. `art.shadow` (facultatif) : la demi-largeur de l'ombre au sol.
3. Passe la fiche à `ready: true`. Le géant entre alors tout seul dans le **Panthéon** (sa silhouette « ??? »
   disparaît), dans l'**admin** (World Boss et Grand boss commun) et dans les **Fêtes** : à partir d'août 2027, un mois
   sur deux, dans l'ordre du tableau (`festBoss`). Les 6 premiers mois gardent leur Titan.
4. Joue-le pour de vrai, sur PC et sur téléphone : programme-le depuis l'admin (« Grand boss commun »), ou lance-le
   dans la console avec `openWorldBoss` comme dans `src/ui/ui.js` (cas `fest-boss`) en passant son `bossId`. Vérifie
   que le projectile part bien de la gueule ou de la main, que le souffle part de la bouche ou des yeux, que le
   géant ne dépasse pas du cadre en phase 3 (échelle × 1,33) et que les chiffres de dégâts tombent sur lui.

## 4. Finitions

- **Traductions** : ajoute les noms, titres, histoires, phases et attaques des 8 géants dans `src/i18n/en-1015.js` et
  `src/i18n/ko-1015.js` (modèle : `en-971.js`), plus les cas dans `tests/i18n.test.js` et `tests/i18n-ko.test.js`.
- **Panthéon** : chaque géant prêt a sa carte avec son image 0 (déjà branché). Vérifie le rendu sur téléphone.
- **Version** : 10.15.0 (`package.json`, `package-lock.json`, `src/version.js`). Ajoute dans `docs/RELEASE_NOTES.md`
  une entrée « Les Géants » au style des précédentes, avec les géants vraiment prêts : leur nom, leur décor et le mois
  de leur première Fête.
- Si tous les géants ne sont pas finis, livre ceux qui le sont. Les autres restent en silhouette au Panthéon, sans
  aucun trou dans le jeu.

## 5. Ce qu'il ne faut pas changer

- Les chiffres de combat (`COLOSSUS_FIGHT` : PV, coups, cadences, Éveil) et les récompenses des géants.
- Le Colosse et les 7 Titans du jour : mêmes planches, même rendu (le test `repères par défaut = ceux du Colosse` le
  vérifie).
- Les Fêtes des 6 premiers mois (février à juillet 2027) et la règle « un géant un mois sur deux à partir d'août
  2027 ».
