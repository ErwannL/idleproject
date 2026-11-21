# Ascendrya 10.5 : toutes les illustrations à faire avec PixelLab

Cette liste accompagne `PROMPT.md`. **Toutes ces images se génèrent avec l'API PixelLab**, comme `art101` et `art102` :
- client : `tools/art/pl939_api.py` ;
- modèle de script : `tools/art/pl102_art.py` ;
- clé : `PIXELLAB_API_KEY`.

Crée `tools/art/pl105_art.py`, avec les sorties brutes dans `tools/art/pixellab105/` et `--install` qui copie vers `assets/ui/art105/`.

**Ce qui est interdit** :
- dessiner au pixel avec Pillow : c'est le cas des bâtiments du Bastion (`tools/art/bastion103.py`) et des images de mécanique (`tools/art/mech1031.py`). Ils sont à refaire avec PixelLab ;
- les formes CSS, les emojis, les images d'une autre source.

Garder une image provisoire tant qu'un fichier manque. Faire une planche de contrôle (`tools/art/preview_art105.png`) pour que le joueur valide le style avant de tout brancher.

**Modèle visé : le Carnet** (`images/reference/carnet-modele.png`). On y voit une bannière dessinée avec une phrase, puis des tuiles. Chaque tuile a une grosse icône, un titre, une ligne, une barre et un bouton, avec un tampon « Accompli ». Tout le jeu doit ressembler à ça.

## Style commun, à coller au début de chaque prompt PixelLab

> 16-bit fantasy pixel art, cozy and colorful, clean 1px dark outline, soft light from top-left, warm palette that matches a rose and plum game UI, readable silhouette at small size, no text, transparent background unless a scene is asked

Pour garder la même famille, donne à PixelLab une image existante comme **référence de style** :
- `assets/ui/art101/banner_daybook.png` pour les bannières ;
- `assets/ui/art101/mis_*.png` pour les icônes ;
- `assets/ui/art103/b_forge.png` pour les bâtiments.

**Ordre de production** : P1 d'abord, car c'est ce que tu as signalé aujourd'hui. Puis P2, puis P3. Les nombres entre parenthèses comptent les fichiers.

---

## P1. Équipement (48 fichiers)

Aujourd'hui, les objets sont des sprites de 16 px agrandis : on ne distingue pas une Dague d'une Épée. Il faut une icône de 64 × 64 par modèle d'objet, la même pour toutes les raretés. La rareté se lit à la couleur du cadre.

| Fichier | Taille | Prompt (anglais) |
|---|---|---|
| `item_weapon_sword.png` | 64×64 | a knight's straight longsword, steel blade, leather grip, gold crossguard, diagonal |
| `item_weapon_greatsword.png` | 64×64 | a huge two-handed greatsword, wide heavy blade, diagonal |
| `item_weapon_dagger.png` | 64×64 | a short curved dagger, dark leather handle, diagonal |
| `item_weapon_katar.png` | 64×64 | a punch dagger katar with an H-shaped grip |
| `item_weapon_axe.png` | 64×64 | a one-handed battle axe with a crescent blade |
| `item_weapon_whip.png` | 64×64 | a coiled leather whip with a metal tip |
| `item_weapon_bow.png` | 64×64 | a short wooden recurve bow with a string |
| `item_weapon_longbow.png` | 64×64 | a tall elven longbow with leaf carvings |
| `item_weapon_crossbow.png` | 64×64 | a wooden crossbow with a loaded bolt |
| `item_weapon_spear.png` | 64×64 | a long spear with a leaf-shaped steel head, diagonal |
| `item_weapon_halberd.png` | 64×64 | a halberd with an axe blade and a spike, diagonal |
| `item_weapon_mace.png` | 64×64 | a flanged steel mace |
| `item_weapon_hammer.png` | 64×64 | a heavy holy war hammer with gold trim |
| `item_weapon_staff.png` | 64×64 | a wooden fire mage staff topped with a glowing orange crystal |
| `item_weapon_wand.png` | 64×64 | a short lightning wand with a blue crystal tip and sparks |
| `item_weapon_scepter.png` | 64×64 | a royal storm scepter with a gold orb |
| `item_weapon_scythe.png` | 64×64 | a necromancer scythe with a dark curved blade and a purple glow |
| `item_helmet_helm.png` | 64×64 | a closed knight helmet with a visor |
| `item_helmet_horned.png` | 64×64 | a viking helmet with two horns |
| `item_helmet_hood.png` | 64×64 | a dark cloth hood with a shadowed opening |
| `item_helmet_circlet.png` | 64×64 | a thin gold circlet with a small gem |
| `item_helmet_default.png` | 64×64 | a simple leather cap |
| `item_armor_plate.png` | 64×64 | a steel plate chestpiece with shoulder guards |
| `item_armor_mail.png` | 64×64 | a chainmail shirt |
| `item_armor_robe.png` | 64×64 | a mage robe with embroidered runes |
| `item_armor_tunic.png` | 64×64 | a crusader tabard over light armor |
| `item_amulet_pendant.png` | 64×64 | a silver pendant necklace with a blue gem |
| `item_amulet_ruby.png` | 64×64 | a gold necklace with a large ruby |
| `item_ring_band.png` | 64×64 | a plain gold ring |
| `item_ring_signet.png` | 64×64 | a signet ring with a purple amethyst |
| `item_bracelet_cuff.png` | 64×64 | a wide engraved metal bracer |
| `item_bracelet_thorn.png` | 64×64 | a bracelet made of thorny silver vines |

Autour des icônes :

| Fichier | Taille | Prompt (anglais) |
|---|---|---|
| `frame_common.png` … `frame_mythic.png` (6) | 96×96 | an ornate square item frame for a fantasy game inventory, [grey / green / blue / purple / gold / red] metal corners and a soft inner glow, empty center |
| `slot_empty_weapon.png` … `slot_empty_bracelet.png` (6) | 64×64 | a faint engraved silhouette of a [sword / helmet / chestplate / necklace / ring / bracer] on dark stone, ghostly, low contrast |
| `doll_altar.png` | 420×640 | a round stone pedestal with glowing runes and soft pink light rising, for a hero to stand on, dark plum background fading to transparent |
| `verdict_up.png` / `verdict_down.png` | 32×32 | a bold green arrow pointing up with a sparkle / a red arrow pointing down |

## P1. Recherches de la Bibliothèque (22 fichiers)

Aujourd'hui, la Bibliothèque est un tableau de 18 cases de texte (179 mots, 4 images). Elle doit devenir 3 arbres de médaillons, comme dans la maquette `images/maquettes/03-recherches.png`.

| Fichier | Taille | Prompt (anglais) |
|---|---|---|
| `banner_library.png` | 640×160 | inside a cozy magic library at night, tall bookshelves, floating glowing books, a big round window, candles, a reading desk with an open tome |
| `branch_combat.png` | 128×64 | crossed sword and shield over a red banner |
| `branch_team.png` | 128×64 | three small hero helmets side by side over a blue banner |
| `branch_economy.png` | 128×64 | a pile of gold coins and a coin purse over a gold banner |
| `research_sharp.png` | 64×64 | a sword blade being sharpened on a whetstone with sparks |
| `research_steel.png` | 64×64 | a forearm covered in steel skin, metal sheen |
| `research_fatal.png` | 64×64 | a red target with a dagger in the bullseye |
| `research_guard.png` | 64×64 | a raised kite shield blocking an arrow |
| `research_breath.png` | 64×64 | a green heart breathing out a soft mist |
| `research_war.png` | 64×64 | a general's war banner with a crown |
| `research_spirit.png` | 64×64 | three hands stacked together with a glowing star |
| `research_recall.png` | 64×64 | a spinning blue hourglass with a magic swirl |
| `research_bond.png` | 64×64 | two interlinked glowing rings |
| `research_drill.png` | 64×64 | a wooden training dummy with a sword |
| `research_scouts.png` | 64×64 | a spyglass over a small map |
| `research_crew.png` | 64×64 | a hammer and a pickaxe crossed with a speed swoosh |
| `research_purse.png` | 64×64 | a fat leather purse overflowing with coins |
| `research_vigil.png` | 64×64 | a crescent moon over a lit candle |
| `research_hunter.png` | 64×64 | a golden eye looking at a purple gem |
| `research_roads.png` | 64×64 | a merchant cart on a winding road |
| `research_vein.png` | 64×64 | a cave wall with a shining blue crystal vein |
| `research_lessons.png` | 64×64 | an old open book with a glowing feather quill |

## P1. Améliorations (5 fichiers)

Les icônes d'amélioration existent déjà en 48 × 48 et sont bonnes. Il manque l'illustration de l'écran, rangé en trois groupes (maquette `images/maquettes/04-ameliorations.png`).

| Fichier | Taille | Prompt (anglais) |
|---|---|---|
| `banner_upgrades_v2.png` | 960×200 | a hero training in a torch-lit fantasy training hall, weapon racks, a sparring dummy, golden dust in the light |
| `group_strike.png` | 360×64 | wide header strip: crossed swords with a red slash effect, dark red gradient, room on the left for a title |
| `group_endure.png` | 360×64 | wide header strip: a glowing heart behind a shield, dark green gradient |
| `group_earn.png` | 360×64 | wide header strip: coins and an open treasure chest, dark gold gradient |
| `badge_best_buy.png` | 64×64 | a golden star medal with a ribbon, shining |

## P2. Bastion (≈ 40 fichiers)

Maquette : `images/maquettes/07-bastion.png`. Le Bastion est une carte de village où l'on voit les bâtiments et les ouvriers au travail.

| Fichier | Taille | Prompt (anglais) |
|---|---|---|
| `bastion_map.png` | 1100×600 | top-down 3/4 view of a small fantasy fortress village on a green hill, cobblestone paths, a river, empty building plots marked by stone foundations, daytime |
| `bastion_map_night.png` | 1100×600 | same village at night, warm window lights, lanterns |
| `b_forge_lv1/2/3.png` | 192×128 | a blacksmith forge building, level 1 small wooden shed / level 2 stone workshop with a chimney / level 3 grand forge with gold trim and a big anvil sign |
| `b_library_lv1/2/3.png` | 192×128 | a library tower: small reading hut / stone tower / tall wizard library with a glowing dome |
| `b_mine_lv1/2/3.png` | 192×128 | a crystal mine entrance in a rock: small hole with a cart / timber frame with rails / big mine with glowing blue crystals |
| `b_training_lv1/2/3.png` | 192×128 | a training ground: straw dummies / wooden arena / stone colosseum yard |
| `b_trade_lv1/2/3.png` | 192×128 | a trading post: market stall / shop with a sign / big guild hall with banners |
| `b_expeditions_lv1/2/3.png` | 192×128 | an expedition camp: tent and map / watchtower / airship dock |
| `plot_empty.png` | 192×128 | an empty building plot with stone markers and a wooden sign |
| `fx_smoke.png` | 6 images 32×32 | chimney smoke puff animation |
| `fx_sparks.png` | 6 images 32×32 | anvil spark burst animation |
| `fx_pages.png` | 6 images 32×32 | flying book pages animation |
| `fx_crystal.png` | 6 images 32×32 | crystal shimmer animation |
| `work_hammer.png` | 4 images 48×48 | small hand swinging a hammer, loop |
| `work_book.png` | 4 images 48×48 | small open book with turning page, loop |
| `work_pick.png` | 4 images 48×48 | small pickaxe striking rock, loop |
| `work_sword.png` | 4 images 48×48 | small sword slash on a dummy, loop |
| `work_coin.png` | 4 images 48×48 | coins being stacked, loop |
| `work_map.png` | 4 images 48×48 | a map unrolling, loop |
| `tool_*.png` (6) | 48×48 | refaire en 48 les icônes de métier d'`art103/tool_*.png` (hammer, book, pick, sword, coin, map) |
| `away_report.png` | 640×240 | a cheerful messenger owl delivering a scroll in front of the fortress village at sunrise |
| `build_done.png` | 128×128 | a finished building with confetti and a golden check mark |

## P2. Forge (6 fichiers)

Maquette : `images/maquettes/05-forge.png`. Il s'agit de remplacer les petits schémas d'icônes des 4 ateliers.

| Fichier | Taille | Prompt (anglais) |
|---|---|---|
| `forge_recycle.png` | 160×120 | a broken sword melting in a furnace turning into blue crystal shards and coins |
| `forge_reinforce.png` | 160×120 | a glowing sword on an anvil being struck by a hammer, +1 sparkles |
| `forge_fuse.png` | 160×120 | five small items swirling into a magic cauldron and one shining item rising |
| `forge_craft.png` | 160×120 | a blueprint scroll on a workbench with gold coins and crystals, a new armor piece appearing |
| `forge_smith_portrait.png` | 128×128 | a friendly dwarf blacksmith with a leather apron and a big hammer, bust portrait |
| `forge_order_crate.png` | 96×96 | a wooden delivery crate with a wax seal and a timer ribbon |

## P2. Donjons (8 fichiers)

Maquette : `images/maquettes/06-donjons.png`. Les décors actuels (320 × 160) et les bosses (256 × 256) existent. Il manque le format bannière large et les tuiles de difficulté.

| Fichier | Taille | Prompt (anglais) |
|---|---|---|
| `dungeon_wide_crypt.png` | 560×148 | wide haunted crypt hallway, green ghost lights, stone arches, empty space on the right for a boss |
| `dungeon_wide_sanctuary.png` | 560×148 | wide overgrown forest sanctuary, twisted roots, soft green fog |
| `dungeon_wide_furnace.png` | 560×148 | wide desert furnace cavern, lava cracks, orange glow |
| `dungeon_wide_glacier.png` | 560×148 | wide frozen glacier cave, blue ice pillars, snow |
| `dungeon_wide_citadel.png` | 560×148 | wide shadow citadel hall, purple torches, dark banners |
| `diff_easy.png` / `diff_normal.png` / `diff_hard.png` | 96×96 | a skull icon: calm white / angry with red eyes / flaming purple with horns |

## P2. Coffre de butin et fenêtre de tri (7 fichiers)

Le coffre dans la scène est fait (10.3.1). La fenêtre de tri reste une liste de texte (`images/actuel/09-coffre-tri.png`).

| Fichier | Taille | Prompt (anglais) |
|---|---|---|
| `chest_glow_rare/epic/legendary.png` | 128×128 | a soft vertical light beam and glow, [blue / purple / gold], for behind a treasure chest |
| `sort_keep.png` | 48×48 | a hand placing an item into a backpack, green check |
| `sort_store.png` | 48×48 | a wooden storage chest with a lock |
| `sort_recycle.png` | 48×48 | an item breaking into blue crystal shards |
| `banner_loot.png` | 640×120 | an open treasure chest spilling weapons, armor and coins, sparkles |

## P3. Compétences (60 fichiers, en plusieurs fois)

Aujourd'hui, les 6 icônes d'une même classe ont la même couleur. La règle est une couleur par type d'effet, avec la classe dans le cadre :
- coup unique en rouge ;
- zone en orange ;
- déplacement en bleu ;
- soutien en or ;
- invocation en violet ;
- contrôle en cyan.

Exemple pour l'assassin : `skill_assassin_quick.png`, 48×48, « a fast double dagger slash, red motion streaks ». Les 10 classes ont chacune 6 compétences, ce qui fait 60 icônes. Commence par la classe du héros du joueur.

## P3. Écrans encore peu illustrés

Ces écrans restent sous les 20 % d'image :
- Missions, 14 % : une bannière, et des tuiles du type Carnet avec les `mis_*.png` existants en 64 px ;
- Statistiques, 12 % : 8 pictogrammes de 48 px (temps de jeu, monstres tués, boss tués, or gagné, objets trouvés, invocations, étages de tour, renaissances) ;
- Boutique, 16 % ;
- Invocation, 15 % : un cercle d'invocation animé, 6 images de 256 × 256.

---

**Total P1** : 75 fichiers. **P2** : environ 60. **P3** : environ 80.

Noms de fichiers à garder tels quels dans `assets/ui/art105/`. Générer P1, montrer la planche de contrôle, puis brancher.
