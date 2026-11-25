# Les Géants (v10.15) : de nouveaux grands boss avec leur propre silhouette

## Pourquoi

Test de la 10.14.2 : les combats de World Boss marchent (0 erreur), mais les 8 grands boss du jeu ont la même
silhouette. Le Colosse des Anciens a été dessiné avec PixelLab, et les 7 Titans du jour sont ses planches recolorées
(`tools/art/recolor_titans.py`). Le joueur veut d'autres « gros monstres » comme le Colosse.

## Ce qui est codé

**Moteur** (`src/render/world-boss-scene.js`). Un grand boss n'a plus besoin des 15 planches du Colosse :
- `resolveAnim(art, name)` : une planche absente prend la plus proche (`ANIM_FALLBACK`). Avec `idle`, `attack`, `hurt`,
  `throw`, `beam` et `death`, un boss joue tout le combat.
- `artLook(art)` : repères propres à la planche. Ils comprennent la silhouette touchée (`box`), l'ombre (`shadow`), les
  débris au repos (`debris`, `debrisAt`) et le projectile (`projectile` : effet, teinte, teinte de phase 3, taille,
  rotation, poussière d'impact). Par défaut, ce sont exactement ceux du Colosse, donc rien ne change pour lui ni pour
  les Titans.
- `eyes` et `hands` sont facultatifs. Les couleurs du souffle de phase 3 retombent sur celles de la phase 1.

**Fiches** (`src/data/grand-bosses.js`, `GIANTS`) : 8 géants avec leur nom, titre, histoire, élément, décor de combat,
décor de la Carte de la fête (`mapZone`), couleur d'accent, 3 phases, 2 attaques (jet et souffle), projectile, débris
et récompenses (60 gemmes, 25 éclats). Les chiffres de combat sont ceux du Colosse.

| Ordre | id | Nom | Décor |
| --- | --- | --- | --- |
| 1 | leviathan | Léviathan des Abysses | abyss |
| 2 | dragon_mother | Mère des Dragons | volcano |
| 3 | storm_god | Dieu de l'Orage | sky |
| 4 | hydra | Hydre des Marais | swamp |
| 5 | sand_wyrm | Ver des Sables colossal | desert |
| 6 | frost_giant | Jarl du Givre | mountains |
| 7 | elder_treant | Arbre-Monde | forest |
| 8 | void_maw | Dévoreur du Néant | void |

Les trois silhouettes « bientôt » du Panthéon (Titan des Abysses, Dieu de l'Orage, Mère des Dragons) sont maintenant
de vrais géants.

**`ready`** : tant que les planches d'un géant ne sont pas dans `assets/world-boss/<id>/`, sa fiche reste
`ready: false`. Il n'est alors ni dans `GRAND_BOSSES`, ni dans les Fêtes, ni dans l'admin, et il apparaît au Panthéon
en silhouette « ??? ». Passer la fiche à `ready: true` suffit à le brancher partout.

**Fêtes** (`src/data/fest.js`, `festBoss`) : les 6 mois écrits à la main (février à juillet 2027) gardent leur
Titan. À partir d'août 2027, un mois sur deux accueille un géant, dans l'ordre du tableau. Si ce géant n'est pas prêt,
le mois garde le boss de la rotation d'avant. La Carte de la fête prend alors le décor du géant, et la fête sa couleur.

**Admin** (`src/data/live-catalog.js`) : le choix du boss (World Boss, Grand boss commun) liste toutes les fiches
jouables (`GRAND_BOSS_IDS`), Titans du jour compris, puis les géants dès qu'ils sont prêts. Un événement qui choisit un boss
récent relève d'office sa version minimale du client (`bossSince` : Titans 9.8.0, géants 10.15.0, `server/live.mjs`),
pour qu'un vieux client ne combatte pas le Colosse à sa place.

**Planches déclarées** : une fiche de géant ne déclare que les 6 planches obligatoires et celles listées dans `extra`
(jamais d'animation sans fichier). `from` fixe le premier mois de Fête possible (une fête en cours ne change pas de
boss).

**Petits correctifs trouvés pendant le test** : les bulles d'aide (« Bonus du moment… ») ne s'affichent plus
par-dessus un combat de World Boss ni par-dessus l'écran de la fête. Le Panthéon montre la première image du boss au
lieu de toute la planche écrasée.

## Ce qui reste : les dessins

Voir `docs/prompt-v10.15-geants.md` (planches PixelLab, repères à mesurer, `ready: true`, traductions, version 10.15.0).
Tests : `node --test tests/v1015-giants.test.js`.
