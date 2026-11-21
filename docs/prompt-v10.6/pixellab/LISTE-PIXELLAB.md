# Ascendrya 10.6 : illustrations PixelLab restantes

**Méthode** : comme `art104`.
- Client : `tools/art/pl939_api.py`.
- Nouveau script : `tools/art/pl106_art.py`.
- Sorties brutes : `tools/art/pixellab106/`.
- `--install` copie vers `assets/ui/art106/`.
- Clé : `PIXELLAB_API_KEY`.

Ni Pillow, ni CSS, ni emoji. Une planche de contrôle `tools/art/preview_art106.png` sert à valider le style avant de brancher les images.

**Style à ajouter à chaque prompt** : `, 16-bit fantasy RPG pixel art, one pixel dark outline, light from the top left, rich warm colors, transparent background` (sans `transparent background` pour les scènes).

**Déjà fait en 10.4, à ne pas refaire** :
- Bastion (carte, bâtiments sur 3 niveaux, effets) ;
- médaillons de recherche ;
- illustrations de la Forge ;
- tuiles de difficulté et mécaniques des donjons ;
- 60 icônes de compétences ;
- couvercle du coffre ;
- bandeaux de Missions, Boutique et Invocation.

---

## P0. Écran de jeu : quêtes et événements (≈ 30 fichiers)

| Fichier | Taille | Prompt (anglais) |
|---|---|---|
| `hud_event_market.png` | 96×96 | a glowing paper lantern market stall at night, festive, round icon composition |
| `hud_event_rift.png` | 96×96 | a swirling purple void rift with a crack of light, round icon composition |
| `hud_event_wheel.png` | 96×96 | a golden fortune wheel with colorful segments and a star pointer |
| `hud_event_arena.png` | 96×96 | a small colosseum gate with crossed swords above it |
| `hud_event_daily_chest.png` | 96×96 | a red and gold daily gift chest with a ribbon, sparkles |
| `hud_event_pass.png` | 96×96 | a rolled royal scroll with a wax seal and a laurel |
| `hud_quest_chapter_1.png` … `_12.png` (12) | 64×64 | one small landscape vignette per world (green plains, dark forest, crystal caves, burning desert, …), round frame |
| `hud_bounty_frame.png` | 420×110 | a wanted poster wooden board with nails, torn parchment, empty center, horizontal |
| `hud_bounty_stamp.png` | 64×64 | a red wax stamp with a skull |
| `fx_quest_done.png` | 6 images 64×64 | golden burst with small stars, loop once |
| `fx_reward_fly.png` | 4 images 24×24 | a small sparkle trail for icons flying to the top bar |
| `fx_hot_glow.png` | 6 images 96×96 | soft pulsing gold ring for an important icon |

## P0. Événement (≈ 20 fichiers par événement)

Pour chaque événement (le Marché des Lueurs d'abord) :

| Fichier | Taille | Prompt (anglais) |
|---|---|---|
| `event_lights_key.png` | 1100×260 | a night festival market with hundreds of floating paper lanterns, a fairy hovering in the center, warm magical light (pas de fond transparent) |
| `event_lights_currency.png` | 48×48 | a small glowing pink lantern flame drop |
| `event_lights_node.png` / `_node_done.png` | 64×64 | an unlit paper lantern / the same lantern lit and glowing |
| `event_lights_path.png` | 1100×190 | a winding stone path through a lantern-lit street, seen from above, room for 10 stops (pas de fond transparent) |
| `event_lights_prize.png` | 256×256 | the grand prize: a fairy companion bust with lantern light, ornate golden frame |
| `event_lights_shop_*.png` (6) | 64×64 | event shop items: ticket bundle, epic chest, essence pile, skin token, key bundle, shard bag |
| `event_lights_mission_*.png` (6) | 64×64 | mission pictures: monsters slain, bosses slain, dungeon cleared, summons, tower climbed, arena win, each with a lantern accent |

## P1. Équipement (repris du 10.5, pas fait)

Il faut 32 icônes d'objets de **64 × 64** (`item_weapon_sword.png` … `item_bracelet_thorn.png`). Les prompts et la liste complète sont dans `LISTE-PIXELLAB-v10.5.md` (dans ce dossier), partie « P1. Équipement ».

Il faut aussi :
- 6 cadres de rareté (`frame_*.png`, 96 × 96) ;
- 6 silhouettes de case vide (`slot_empty_*.png`) ;
- `verdict_up.png` et `verdict_down.png`.

Aujourd'hui, les objets sont encore des sprites de 16 px agrandis.

## P1. Améliorations, en groupes (repris du 10.5)

| Fichier | Taille | Prompt (anglais) |
|---|---|---|
| `group_strike.png` | 360×64 | wide header strip: crossed swords with a red slash effect, dark red gradient, room on the left for a title |
| `group_endure.png` | 360×64 | wide header strip: a glowing heart behind a shield, dark green gradient |
| `group_earn.png` | 360×64 | wide header strip: coins and an open treasure chest, dark gold gradient |
| `badge_best_buy.png` | 64×64 | a golden star medal with a ribbon, shining |

## P1. Tri du coffre (repris du 10.5)

| Fichier | Taille | Prompt (anglais) |
|---|---|---|
| `sort_keep.png` | 48×48 | a hand placing an item into a backpack, green check |
| `sort_store.png` | 48×48 | a wooden storage chest with a lock |
| `sort_recycle.png` | 48×48 | an item breaking into blue crystal shards |
| `banner_loot.png` | 640×120 | an open treasure chest spilling weapons, armor and coins, sparkles |

## P2. Écrans encore sous 20 % d'image (mesuré en 10.4)

| Écran | Part d'image | À produire |
|---|---|---|
| Missions | 14 % | une icône de 64 px par mission, comme les tuiles du Carnet (réutiliser `mis_*.png` en 64 px) |
| Talents | 16 % | 6 médaillons de région de l'arbre (128 × 128), comme les recherches |
| Boutique | 16 % | une image de 128 × 128 par offre, à la place des icônes de 32 px |
| Événement | 17 % | voir P0 |
| Boss (Profil) | 17 % | un portrait de 128 px par boss vaincu |
| Compagnons | 19 % | des cartes de compagnon avec le portrait en grand |
