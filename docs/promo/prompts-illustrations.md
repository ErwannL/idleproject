# Illustrations réalistes : prompts et suivi

Les illustrations réalistes (version « affiche ») remplacent dans le jeu la version pixel HD dès qu'elles sont importées.

**Marche à suivre pour chaque personnage**
1. Générer l'image (Canva → Générateur d'images IA, ou tout autre outil) avec le prompt ci-dessous, format portrait 3:4.
2. La télécharger en pleine résolution et la déposer dans `assets/hd/real-src/<id>.png` (ou `.jpg`).
3. Lancer `python3 tools/art/import_real.py`. Le script retire le fond par détourage IA (`pip install "rembg[cpu]"`), recadre et met à jour `src/data/hd-real.js`.

**Suffixe commun**, à ajouter à la fin de chaque prompt :
> Three-quarter view facing right, full body head to feet, heroic pose, dramatic rim lighting from the top-left, highly detailed realistic painterly digital painting, AAA mobile RPG gacha splash art, plain dark navy background, character centered.

## Déjà générés (Canva, à télécharger en pleine résolution)

Ils sont dans le jeu en version provisoire, faite à partir des miniatures de 150 px.

| id | Personnage | Lien Canva |
|---|---|---|
| grombar | Roi Grombar | https://www.canva.com/M/MAHZZLN1pEY |
| demoness | Lilith la Diablesse | https://www.canva.com/M/MAHZZB0e59k |
| seraph | Séraphin Auriel | https://www.canva.com/M/MAHZZIvwwPM |
| fairy | Fée Lumibelle | https://www.canva.com/M/MAHZZFXWWBw |
| valkyrie | Valkyrie Sigrún | https://www.canva.com/M/MAHZZLuhabM |

## À générer (35)

### Apparences du héros
- **witch** : Morgaline the Witch of the pale moon: very large purple pointed hat with bent tip, crescent moon buckle and stars, long teal hair with purple streaks, amber eyes, dark purple robe embroidered with gold moons and stars, green potion at the belt, wooden staff topped with a crescent moon and a glowing purple orb, green magic in her other hand.
- **vampire** : Count Vladimir, vampire noble: pale skin, slicked-back black hair, pointed ears, glowing red eyes, a visible fang, tall red-lined high collar cape, dark long coat, red waistcoat, white lace jabot with a ruby brooch, pale gloves, rapier with an ornate gold guard, small bats around him.
- **ninja** : Kage the Ninja: spiky black hair with a ponytail, headband with a steel plate, navy face mask, amber eyes, long red scarf flowing in the wind, dark navy outfit with red sash, wrapped forearms and calves, low combat stance, katana forward and kunai behind, shadow trails.

### Chevaliers
- **hero_knight** : young heroic knight: steel plate armor with gold trim, open-face helmet with raised grille visor and a sweeping blue plume, brown hair, blue tabard with a gold cross, blue cape, kite shield with a gold cross and a ruby, longsword with a blue guard.
- **hero_paladin** : holy paladin: steel plate armor with gold trim, cream plume, golden halo ring behind the head, cream and gold tabard and cape, flanged golden mace, kite shield with a radiant golden sun cross, holy sparkles.
- **hero_guardian** : guardian knight: steel plate with silver trim, green plume, green tabard and cape, tall rectangular green tower shield with a silver oak tree emblem, steadfast defensive stance.
- **hero_fortune_knight** : fortune knight: ornate gold and steel plate with a gold medallion, white plume, gold tabard and cape with white trim, golden sword with a ruby, shield with a coin and crown, piles of gold coins at his feet.
- **hero_berserker** : berserker knight: battle-worn plate, red plume, facial scar, glowing red eyes, gritted teeth, red tabard and torn red cape, scratched shield, huge single-bladed battle axe with a gold collar.
- **hero_dragon_knight** : dragon knight: dark steel plate with orange trim, helmet crowned with dragon bat wings, glowing orange eyes, dark purple tabard and cape, sword with a glowing ember edge, shield with a dragon emblem, floating embers.

### Compagnons SSR
- **ally_archangel** : archangel warrior: blonde hair, golden halo, two large feathered white-blue wings, engraved gold breastplate with a blue gem, blue and gold tassets, heater shield with a cross, glowing light sword.
- **ally_demon_queen** : demon queen: long red hair, ringed horns, bat wings, crimson corset with gold lacing, slit dress, spade tail, double-bladed axe wreathed in flames, rune circle on the ground.
- **ally_ice_empress** : ice empress: long silver hair, ice-crystal crown, blue and white ball gown with flounces, fur stole, crescent and crystal scepter, snowflakes and a frost circle.
- **ally_shadow_lord** : shadow lord: dark full plate armor, closed horned helm with a glowing violet T-visor, violet plume, glowing rune core on the chest, spiked pauldrons, tattered cape, greatsword with a violet glow, shadow flames.
- **ally_sylvan_guardian** : sylvan guardian: big teal hair with flowers and small antlers, leaf corset and three-tier leaf skirt, laced boots, gnarled staff cradling a green orb, swirling leaves.

### Compagnons SR
- **ally_azure_paladin** : azure paladin: spiky navy hair, gold circlet with a gem, blue armor with gold trim and a cross emblem, round gold and blue shield, short cape, light-blue sword.
- **ally_rose_blade** : rose blade swordswoman: long pink side ponytail with a red bow, dark corset jacket with pink trim, pleated skirt, boots with pink cuffs, glowing red sword held low, rose petals.
- **ally_witch** : young witch: pointed purple hat with gold band and star, long silver hair, purple dress with gold hem and white collar, wooden staff with a violet orb.
- **ally_elf_archer** : elf archer: blonde hair, leaf headband, pointed ears, leather vest over green, green skirt, laced boots, quiver, drawing a longbow with an arrow.
- **ally_high_priest** : high priest: short blonde hair, gold laurel crown, white robe with blue band and gold crosses, gold capelet with gems, floating blue stole, golden sun staff.
- **ally_ninja** : ninja: hood and mask covering the lower face, purple headband with a steel plate, violet eyes, flowing scarf, dark gi with purple belt, two violet blades, shuriken.
- **ally_barbarian** : barbarian: spiky white mane, angry face with red war paint, bare muscular torso with crossed straps, fur mantles, red ragged kilt, fur-topped boots, big double-headed axe.

### Compagnons R
- **ally_squire** : squire: steel armor, blue tabard with a gold lozenge, gold-banded open helm with a trailing blue plume, blue cape, sword held upright with a glowing blue blade.
- **ally_mercenary** : mercenary: spiky brown hair, smirk and cheek scar, red scarf with flying tails, leather jerkin with baldric and pouch, broadsword resting on the shoulder.
- **ally_ranger** : ranger: green hood and cape, laced leather tunic, moss-green trousers, tall boots, quiver of green-fletched arrows, recurve longbow.
- **ally_pyromancer** : pyromancer: large red witch hat with a gold band, long orange hair, red corset dress with gold belt, wooden staff with a gold claw holding a flame orb, embers.
- **ally_priestess** : priestess: navy hood and veil over a white coif, blonde fringe, gold halo, white robe with a navy gold-trimmed stole and a gold star, golden staff topped with a cross and a blue gem.
- **ally_lancer** : lancer: dark full plate, closed helm with a visor slit and glowing orange eyes, red plume and cape, red belt, spear planted upright with red tassels.
- **ally_shadow** : shadow assassin: silver hair swept back in spikes, narrowed violet eyes, purple mask over the lower face, long two-tailed purple scarf, dark suit with crossed straps, two reverse-grip daggers glowing violet.
- **ally_dwarf** : dwarf warrior: stocky, bronze horned helm with nasal guard, large ginger braided beard with a gold bead, riveted bronze cuirass, large gold buckle, leather tassets, crescent battle-axe with a gold rune.

### Familiers
Pour les familiers, remplacer le suffixe commun par : « cute but detailed creature, full body, centered, dramatic lighting, highly detailed realistic painterly digital painting, plain dark navy background ».
- **pet_golden_slime** : glossy golden slime blob with a pointed tip, a gold coin and bubbles inside the jelly, big shiny eyes, blush, sparkles.
- **pet_cat** : sitting orange tabby cat with cream chest, green eyes, red collar with a gold bell.
- **pet_owl** : wise tan owl with cream face disc, ear tufts, big amber eyes, gold monocle, standing on two old books.
- **pet_fairy** : tiny blonde fairy with a flower crown, green leaf-petal dress, two pairs of pale-blue veined wings, gold star wand.
- **pet_golem** : small stone golem with cracks, blue crystal eyes, blue chest gem, moss and sprouts with a flower on top, big stone fist.
- **pet_wisp** : round fire wisp with curling flames, hot yellow core, big cute eyes, blush, embers.
