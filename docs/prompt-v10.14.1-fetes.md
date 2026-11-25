# Ascendrya 10.14.1 : les Fêtes du mois, belles et faciles à jouer (prompt complet)

> **Pour Claude** :
> - Base : la branche `claude/fetes-du-mois-v1014` (PR #13, version 10.14.0), ou `main` si elle est fusionnée.
> - Lis dans cet ordre : `docs/evenements-v1014.md` (le système complet), puis **toutes** les captures de
>   `docs/screenshots/v10.14/` (`ecran-fete-*.png`, `ecran-petite-fete-sentier.png`, `ecran-fete-telephone-*.png`,
>   `grande-fete-*.png`, `petite-fete-pc.png`, `echange-pc.png`). Ce sont les écrans **avant** ce prompt.
> - Code : `src/data/fest.js` (feuilles, calendrier, rotations, Brèche), `src/core/fest.js` (moteur),
>   `src/ui/fest-hub.js` (écran de la fête), `src/ui/panels/event.js` (`festPage`, porte d'entrée),
>   `src/ui/fest1014.css`, `src/ui/hud-quests.js` (icône « Fête »).
> - **Périmètre : l'apparence, l'ergonomie, les illustrations, les traductions et les notifications.** Ne change ni
>   les règles, ni les dates, ni les chiffres d'économie (voir § 8).
> - Un commit par lot (§ 9), `npm test` vert à chaque commit, captures PC (1116 × 993 et 1920 × 1080) et téléphone
>   (412 × 915) **avant / après** de chaque onglet de l'écran, rangées dans `docs/screenshots/v10.14.1/`.
> - CSS : garde le préfixe `#app .fest-hub` (et `#app#app` pour battre les règles `.m-btn` du kit), et recopie chaque
>   règle « téléphone » sous `#app.m-phone` (le jeu est mis à l'échelle, les media queries seules ne suffisent pas).

## Ce que dit le joueur

> « Je voudrais qu'on attaque notre vrai système d'événements avec une map du héros à invoquer, world boss et tous les
> évènements adaptés pour deux semaines avec la boutique de récompense pour l'événement. Il faudrait qu'on prépare
> 6 mois de contenu à l'avance. Et voir comment on fait pour faire les rotations. »
>
> « Sachant que sur un mois il y aura deux types d'événement, un plus gros en début de mois et un plus léger après avec
> héros et familier gratuit à farm. Avec peut-être quelques jours de pause en fin d'événement. »
>
> « J'aimerais pour l'événement avoir une interface à part avec les illustrations pour l'aventure, world boss et mode
> supplémentaire pour les 14 jours. »
>
> « Pour les évènements, tu peux me faire le prompt complet avec une touche sur l'ergonomie, que ce soit beau, et de
> meilleures illustrations de décors. »

Ses modèles sont **Slayer Legends** et **Capybara Go** : des événements très illustrés, une carte qu'on parcourt, de
grosses récompenses bien visibles et un seul bouton évident par écran. Dans le jeu, l'écran qu'il trouve réussi est la
**Forge** : une illustration pour chaque chose, un titre court, une ligne de texte, les coûts en cases et un gros bouton
doré.

---

## 1. Ce qui existe déjà (10.14.0), à garder

**Le rythme d'un mois** (à partir de février 2027) :

| Jours | Quoi |
| --- | --- |
| 1 → 14 | **Grande fête** : héros du mois (vedette de la bannière limitée tout le mois), Carte du héros (3 régions × 10 étapes), World Boss du thème (3 tentatives/jour), Brèche (mode de la fête), jalons d'invocation, missions du jour et de la fête, boutique |
| 15 → 16 | Échange : combats fermés, boutique ouverte |
| 17 → fin − 2 | **Petite fête** : sentier de 12 étapes avec un héros et un familier gratuits (×3 chacun), missions, boutique |
| 2 derniers jours | Échange ; à la fin, la monnaie restante devient des éclats |

**Les 6 mois prêts** (`FEST_MONTHS`) :

| Mois | Grande fête | Héros du mois | World Boss | Petite fête | Héros / familier gratuits |
| --- | --- | --- | --- | --- | --- |
| Février | Fête des Cœurs ardents | Reine démone | Titan des Braises | Bal des Lames roses | Lame rose / Hérisson de cristal |
| Mars | Éveil du Printemps | Gardienne sylvestre | Titan des Ronces | Concours des Archers | Archère elfe / Fée des bois |
| Avril | Aube dorée | Archange | Titan du Soleil | Pèlerinage de Lumière | Grand prêtre / Mini-golem |
| Mai | Nuit des Éclipses | Seigneur de l'ombre | Titan du Néant | Nuit des Shinobis | Ninja / Hibou érudit |
| Juin | Solstice de Givre | Impératrice des glaces | Titan des Marées | Sabbat de la Saint-Jean | Sorcière / Hérisson de cristal |
| Juillet | Festival des Titans | Reine démone | Colosse des Anciens | Jeux des Champions | Barbare / Fée des bois |

Vérifie ces noms dans `FEST_MONTHS` : c'est le fichier qui fait foi.

**L'écran de la fête** (`fest-hub.js`) prend tout le cadre. On l'ouvre par l'icône « Fête » ou par l'onglet Événement.
En haut il y a le titre, le minuteur, la monnaie et ✕. En bas il y a de grandes tuiles : Aventure · World Boss · Brèche ·
Missions · Boutique pour la grande fête, et Sentier · Missions · Boutique pour la petite. Échap ferme l'écran.

**La Brèche** : 10 paliers et 3 cœurs. Après chaque victoire, on choisit 1 bénédiction parmi 3 (`RIFT_BLESSINGS`).
On a 2 entrées par jour (6 en réserve au plus) et des récompenses de première fois aux paliers 5 et 10.

---

## 2. Règles de beauté et d'ergonomie (tout l'écran de la fête)

1. **Chaque fête a son monde.** Affiche, décors des régions, décor du boss, monnaie et couleur d'accent changent d'une
   fête à l'autre. Aujourd'hui les 3 régions reprennent le même décor de zone avec une simple teinte, et toutes les
   fêtes utilisent la goutte rose des Lueurs comme monnaie. C'est le premier défaut à corriger.
2. **Une seule action dorée par onglet** : Enchaîner (Aventure), Attaquer (World Boss), Entrer ou Combattre (Brèche),
   Tout récupérer (Missions et Sentier). Les autres boutons sont sombres à bord clair et font au moins 44 px de haut.
3. **La récompense se voit avant l'effort.** Le grand prix est dessiné en grand (héros du mois, héros et familier
   gratuits, fragment Légendaire). Les icônes de récompense font au moins 28 px et ne sont jamais remplacées par un
   chiffre seul.
4. **Le joueur sait toujours où il en est.** Sur la Carte, le héros se tient sur l'étape suivante (sprite de 56 px au
   lieu de 40), l'étape suivante pulse, les étapes faites sont cochées et une région libérée change de lumière.
5. **Pas de paragraphe.** Une ligne courte suffit ; les explications vont dans le « ? » de l'en-tête (§ 5.1).
6. **Mouvement doux.** Les onglets changent en fondu de 150 ms. Quand une étape est gagnée, elle s'allume et le héros
   saute à la suivante en 300 ms. Les icônes de récompense volent vers la monnaie du haut. Tout cela est coupé quand
   « Réduire les animations » est actif (`reduceMotion()` dans `src/ui/prefs.js`).
7. **Lisible partout.** Textes de 12 px au moins, chiffres en `tabular-nums`, contraste AA sur les décors (voile sombre
   derrière le texte), et rien qui déborde ou se chevauche à 412 px de large.
8. **Pas de retour en arrière.** L'onglet Événement, l'icône « Fête », le « Tout récupérer » du jeu, les fenêtres de
   récompense et la version téléphone 10.13 continuent de marcher comme aujourd'hui.

Couleurs : celles du kit 10.12 (cadre `#121a33` → `#0b1124`, carte `#18223f`, bord `#2c3a66`, or `#c9a14a` / `#f3d27a`,
texte `#eef2ff`, doux `#9fb0d8`, gain `#5be37d`, manque `#ff6b6b`), plus **une couleur d'accent par fête** (§ 4).

---

## 3. Lot 1 : de meilleurs décors (PixelLab)

Même méthode que `LISTE-PIXELLAB.md` : l'API PixelLab (`tools/art/pl939_api.py`, clé `PIXELLAB_API_KEY`) et un nouveau
script `tools/art/pl1014_art.py` sur le modèle de `tools/art/pl106_art.py`. Les sorties brutes vont dans
`tools/art/pixellab1014/`, et `--install` les copie dans `assets/ui/art1014/`. Fais une **planche de contrôle**
`tools/art/preview_art1014.png` (une ligne par fête) et montre-la au joueur **avant** de tout brancher. Sont interdits :
le dessin au pixel avec Pillow, les formes en CSS, les emojis et les images d'une autre source.

Style commun à mettre au début de chaque prompt PixelLab :

> 16-bit fantasy pixel art, cozy and colorful, rich parallax depth, clean 1px dark outline, soft light from top-left,
> readable at small size, no text, no characters unless asked

Références de style : `assets/ui/art106/event_lights_key.png` (l'affiche réussie du Marché des Lueurs),
`assets/ui/art106/event_lights_path.png` (le fond de chemin) et `assets/bg/*_far.png` (les décors du jeu).

### 3.1 Par grande fête (6 fêtes)

| Fichier | Taille | Contenu |
| --- | --- | --- |
| `fest_<mois>-g_key.png` | 1100 × 260 | Affiche du thème. **Le tiers droit reste dégagé**, car le jeu y pose le héros du mois. Pas de texte. |
| `fest_<mois>-g_r1.png`, `_r2.png`, `_r3.png` | 960 × 200 | **Un décor par région de la Carte**. Les trois racontent un voyage : l'entrée, le cœur puis le sommet du thème. Le tiers bas est un sol plat où passe le chemin ; le ciel et les détails sont en haut. Les 3 décors se suivent (mêmes couleurs, lumière qui monte). |
| `fest_<mois>-g_arena.png` | 1100 × 620 | Arène du World Boss : sol au premier plan, grand espace libre au centre-gauche pour le Titan, ambiance de son élément. |
| `fest_<mois>-g_coin.png` | 64 × 64 | Monnaie de la fête |

`<mois>` est l'identifiant de la feuille, par exemple `2027-02` (`FEST_SHEET_IDS`). Les décors à demander (régions
listées dans `FEST_MONTHS[].grand.regions`) :

| Fête | Région 1 | Région 2 | Région 3 | Arène du boss | Monnaie |
| --- | --- | --- | --- | --- | --- |
| Cœurs ardents | Jardins rougeoyants (roseraie de braises, lanternes) | Salle du bal (lustres, rubans rouges) | Trône des braises (lave, trône de pierre noire) | Cratère de braises | Cœur de braise |
| Éveil du Printemps | Clairière fleurie | Bois ancien (arbres géants, lucioles) | Cœur de la forêt (arbre-mère lumineux) | Forêt de ronces géantes | Bourgeon |
| Aube dorée | Escalier des nuages | Temple du ciel (colonnes d'or) | Porte du soleil | Sommet céleste au lever du soleil | Plume d'aube |
| Nuit des Éclipses | Faille violette | Citadelle d'ombre | Trône du Néant (éclipse) | Plaine sous l'éclipse | Éclat d'éclipse |
| Solstice de Givre | Côte gelée | Palais de glace | Trône de givre (aurore boréale) | Mer gelée sous l'orage | Flocon |
| Festival des Titans | Arène d'été (drapeaux, foule) | Volcan | Sommet des Titans | Ruines du Colosse | Médaille |

Garde les noms de régions et de monnaies déjà écrits dans `FEST_MONTHS` s'ils diffèrent de ce tableau ; le tableau
décrit seulement ce qu'il faut dessiner.

### 3.2 Par petite fête (6 fêtes)

| Fichier | Taille | Contenu |
| --- | --- | --- |
| `fest_<mois>-l_key.png` | 1100 × 260 | Affiche, tiers droit dégagé (le jeu y pose le héros et le familier gratuits) |
| `fest_<mois>-l_path.png` | 1100 × 260 | Fond du sentier : un chemin qui serpente de gauche à droite à travers le thème (référence : `event_lights_path.png`) |
| `fest_<mois>-l_node.png`, `_node_done.png` | 64 × 64 | Étape du sentier éteinte et allumée, dans le thème (rose, flèche, cierge, shuriken, feu de la Saint-Jean, laurier) |
| `fest_<mois>-l_coin.png` | 64 × 64 | Monnaie (Pétale, Flèche d'or, Cierge, Shuriken, Braise de lune, Laurier) |

Thèmes : Bal des Lames roses (bal masqué rose et pourpre), Concours des Archers (prairie, cibles, fanions), Pèlerinage
de Lumière (chemin de cierges vers un temple), Nuit des Shinobis (village japonais de nuit, lanternes), Sabbat de la
Saint-Jean (clairière, grands feux, lune), Jeux des Champions (stade antique en plein soleil).

### 3.3 Une seule fois

| Fichier | Taille | Contenu |
| --- | --- | --- |
| `fest_tab_adventure.png`, `_boss.png`, `_rift.png`, `_missions.png`, `_shop.png`, `_path.png` | 96 × 96 | Icônes des tuiles du bas : carte dépliée, crâne de Titan, faille violette, parchemin coché, coffre de fête, lanterne. Aujourd'hui ces tuiles reprennent des images d'autres écrans. |
| `fest_rift_bg.png` | 1100 × 620 | Intérieur de la Brèche : faille violette, îlots flottants, profondeur |
| `rift_bless_<id>.png` | 96 × 96 | Les 6 bénédictions : force (lame bénie), fury (flamme rouge), time (sablier), loot (bourse), heart (cœur ailé), focus (œil d'or) |
| `fest_node_boss.png`, `fest_node_chest.png`, `fest_node_crown.png` | 64 × 64 | Étapes spéciales de la Carte : boss, coffre de fin de région, fragment |
| `hud_event_fest.png` | même taille que `assets/ui/art106/hud_event_pass.png` | Icône « Fête » de la colonne d'événements |

### 3.4 Brancher les images

- Dans chaque fête de `FEST_MONTHS`, ajoute `art: { key, regions: [r1, r2, r3], arena, currency, path, node, nodeDone }`
  (chemins `assets/ui/art1014/...`). Le code lit déjà `f.art?.key` et `f.art?.currency`. Ajoute la lecture des autres
  champs dans `fest-hub.js` : le fond de chaque `.fh-region` dans l'Aventure, le fond de l'onglet boss, le fond et les
  étapes du Sentier, et `fest_rift_bg.png` dans la Brèche. **Sans fichier, l'image actuelle reste** : jamais d'image
  cassée.
- Les mois produits par la rotation automatique (après juillet 2027) gardent le repli actuel, c'est-à-dire le décor de la
  zone du boss.
- Ajoute un test qui vérifie que chaque chemin d'image de `FEST_MONTHS` existe dans `assets/` (comme
  `tests/admin-assets.test.js`).

---

## 4. Lot 2 : une couleur d'accent par fête

Ajoute `accent` à chaque fête de `FEST_MONTHS` :

- Grandes fêtes : Cœurs ardents `#ff5a4a`, Printemps `#63d98a`, Aube dorée `#ffd23f`, Éclipses `#b04dff`, Givre
  `#7fd4ff`, Titans `#ff8a3d`.
- Petites fêtes : Lames roses `#ff7ab8`, Archers `#9be36d`, Lumière `#fff1a0`, Shinobis `#6a8cff`, Saint-Jean `#ffb04a`,
  Champions `#f3d27a`.

`fest-hub.js` pose `style="--fh-accent:…"` sur `.fest-hub`. Le CSS s'en sert pour la bordure de l'onglet actif, l'étape
suivante, le liseré de l'en-tête et le halo du grand prix. L'or du kit reste réservé aux boutons dorés. Les mois de la
rotation automatique prennent la couleur de l'élément de leur boss.

---

## 5. Lot 3 : l'ergonomie, onglet par onglet

Regarde d'abord la capture « avant » de chaque onglet, puis applique ce qui suit.

### 5.1 En-tête et tuiles (tous les onglets)
- Ajoute un **« ? »** à côté du titre. Il ouvre une fiche courte (`ui.openModal`) qui explique la fête en 4 lignes : le
  rythme, la monnaie, l'échange et la conversion en éclats.
- Sous le minuteur « 10 j 13 h », ajoute en petit « puis 2 jours d'échange ». Pendant l'échange, le bandeau bleu devient
  une **bannière illustrée** (coffre ouvert) avec « Dépense tes Cœurs de braise : encore 1 j 13 h ».
- La monnaie du haut utilise l'icône de la fête (§ 3) à 28 px avec le nombre en 18 px, et elle **rebondit** quand on
  gagne.
- Les tuiles du bas utilisent les icônes du § 3.3 à 56 px, avec le nom dessous et une pastille rouge quand il y a
  quelque chose à faire. Sur téléphone, la barre respecte `env(safe-area-inset-bottom)` (déjà fait) et ne doit jamais
  cacher le dernier élément de la liste.

### 5.2 Aventure
- Sur PC, la Carte passe à gauche (60 %) et le héros du mois à droite (40 %). Aujourd'hui c'est l'inverse, et la Carte
  paraît petite. Sur téléphone, la Carte reste en premier (déjà fait) et le héros vient dessous.
- Les 3 régions prennent leurs décors (§ 3.1), 170 px de haut sur PC, avec le nom de la région dans un cartouche doré.
- Les étapes sont des cercles de 40 px avec le numéro en 14 px. Les étapes 10, 20 et 30 ont leur image (§ 3.3) et leur
  récompense en infobulle. Le héros du mois (sprite de 56 px) se tient **au-dessus** de l'étape suivante sans cacher
  son numéro.
- « Combattre » et « Enchaîner » tiennent sur une seule ligne (Combattre sombre, Enchaîner doré), avec la puissance
  conseillée (« Gardien niv. 3-5 ×2 ») bien lisible. En cas de défaite, la carte de l'étape tremble et propose
  « Améliorer › », qui ouvre la Forge.
- Le bonus « +25 % avec le héros du mois » devient un **badge** sur la carte du héros. Il est vert si le héros est dans
  l'équipe. Sinon le badge propose « Mettre dans l'équipe › » quand le héros est possédé, ou « Invoquer › » s'il ne
  l'est pas.
- Les jalons d'invocation deviennent une barre continue avec les 5 récompenses posées dessus (comme une piste de pass)
  et la position actuelle marquée, avec « 35 / 50 » écrit sur la barre.

### 5.3 World Boss
- Le décor `arena` de la fête (§ 3.1) remplit le fond. Le Titan est plus grand (360 px sur PC, 260 sur téléphone) avec
  une ombre au sol. Aujourd'hui l'onglet laisse beaucoup de vide.
- Les phases deviennent 3 marques sur une **barre de PV du boss** dessinée (75 / 50 / 25 %), au lieu d'étiquettes.
- Les tentatives deviennent 3 icônes d'épée, pleines ou vides, au lieu de « 2/3 ».
- Quand le boss est verrouillé, le Titan reste visible mais assombri, avec un cadenas et « Libère l'étape 10 › » qui
  ouvre l'Aventure.
- Après une tentative, un petit bilan s'affiche sur la même page : dégâts, record, palier atteint et monnaie gagnée.
  Aujourd'hui seul un message passe.

### 5.4 Brèche
- Le fond est `fest_rift_bg.png`. Les 10 paliers deviennent une **colonne de pierres flottantes** qui monte (à gauche sur
  PC, en haut de gauche à droite sur téléphone). Le palier en cours brille, et les premières fois (5 et 10) montrent
  leur coffre.
- Au repos, une grande carte « Entrer » affiche les 6 petites bénédictions dessous (déjà là), et les entrées sous forme
  de 6 cristaux.
- Le choix de bénédiction montre 3 **grandes cartes** qui se retournent une à une (200 ms chacune), avec l'image du
  § 3.3 en 96 px, le nom et l'effet. Les bénédictions déjà prises restent visibles en petites puces sous la colonne.
- Pendant le combat, les cœurs sont des icônes (et non « ♥♥♥ » en texte), « dégâts ×1,30 · 36 s » s'affiche en grosses
  puces, Combattre est doré et Quitter sombre. Quitter demande une confirmation (« Tu gardes les 24 Cœurs de braise
  gagnés »).
- En fin de course, une fenêtre de récompense montre le palier atteint et le record, avec « Encore une fois
  (1 entrée) » s'il reste des entrées.

### 5.5 Missions
- Elles sont déjà illustrées. À faire : replier les missions faites en bas (« 3 faites ▸ ») et mettre en premier la
  mission la plus proche de la fin. « Y aller » doit mener au bon écran **et** fermer l'écran de la fête, car aujourd'hui
  l'onglet s'ouvre derrière.
- Ajoute un bandeau en haut : « Missions du jour : elles changent à minuit · 4 h 12 ».

### 5.6 Boutique
- Elle est déjà illustrée. À faire : mettre le grand article (fragment Légendaire, copies du héros et du familier
  gratuits) **en vedette** sur toute la largeur en haut, et les autres en grille. Un article trop cher a son prix en
  rouge avec « il manque 40 ». Un article épuisé porte un tampon « Épuisé ». À l'achat, l'article saute et son icône
  vole vers le haut.
- Pendant l'échange, un bandeau « Dernière chance » s'affiche en haut de la boutique.

### 5.7 Sentier (petite fête)
- Le Sentier utilise le fond `path` et les étapes `node` de la fête (§ 3.2). Le héros gratuit marche sur l'étape atteinte
  (déjà là). Les étapes « héros » et « familier » ont un halo de la couleur d'accent et leur portrait en 40 px.
- Les deux grandes cartes du haut (héros, familier) montrent la progression : « 1 / 3 obtenus ».
- Les affiches des petites fêtes ne reprennent plus l'image des Lueurs : elles utilisent leur `key` (§ 3.2).

### 5.8 Onglet Événement et icône « Fête »
- L'onglet Événement reste la porte d'entrée (affiche, « Entrer dans la fête », tuiles). Ses tuiles prennent les icônes
  du § 3.3 et une pastille quand il y a quelque chose à faire.
- L'icône « Fête » de la colonne utilise `hud_event_fest.png`, avec le minuteur dessous et une pastille.

---

## 6. Lot 4 : traductions anglais et coréen

Crée `src/i18n/en-1014.js` et `src/i18n/ko-1014.js` sur le modèle de `en-971.js` et `ko-971.js`. À traduire :

- les titres, phrases, monnaies et régions de `FEST_MONTHS` ;
- les titres automatiques (« Fête du héros : … », « Foire : … ») ;
- `FEST_MISSION_TYPES` et `RIFT_BLESSINGS` ;
- tous les textes de `fest-hub.js` et de `festPage` ;
- les messages de `main.js` (`festFight`, `festChain`, `festBossFinish`, `festMission`, `riftStart`, `riftFight`,
  `riftQuit`, fin de fête) ;
- la fiche « ? » du § 5.1.

Ajoute les cas à `tests/i18n.test.js` et `tests/i18n-ko.test.js`, et vérifie en anglais que rien ne déborde (les
titres anglais sont souvent plus longs).

## 7. Lot 5 : notifications et dernières finitions

1. **Notifications**, dans `src/core/notify-plan.js` avec les mêmes règles qu'aujourd'hui (2 par jour au plus, jamais
   entre 22 h et 9 h, désactivables dans les Paramètres) et des tests dans `tests/v98-notify.test.js` :
   - « La fête commence » le jour 1 à 12 h ;
   - « Entrées de Brèche pleines » à 6/6, à 18 h ;
   - « Dernier jour » la veille de l'échange à 18 h, seulement s'il reste quelque chose à faire ;
   - « Échange » le premier jour d'échange à 12 h, seulement s'il reste de la monnaie.
2. **Admin** : dans le menu « Feuille de la fête », affiche « 2027-02-g · Fête des Cœurs ardents » au lieu de
   l'identifiant seul (`festSheet()` donne le titre).
3. **Classement du World Boss** : envoie le score comme `eventBossFinish` (`cloud.wbReport`, mode `event`, avec
   l'identifiant de la fête dans `event`) pour un classement **par tranches** (10 %, 30 %, 60 %) remis à zéro à chaque
   fête. Pas de classement absolu.
4. **Invocation** : pendant la grande fête, ajoute sous la vedette la ligne « Jalons : 35 / 50 › », qui ouvre l'écran de
   la fête sur l'Aventure.

## 8. Ce qu'il ne faut pas changer

- Les dates (1 → 14, échange de 2 jours, 17 → fin − 2, échange de 2 jours), les rotations (`FEST_POOLS`) et le
  calendrier des 6 mois. Ce sont des décisions du joueur.
- Les chiffres d'économie (`FEST_RULES`, `FEST_SHOPS`, `LIGHT_PATH`, `RIFT_BLESSINGS`). On n'y touchera qu'après une
  semaine de mesures réelles.
- La conversion de la monnaie restante en éclats (le joueur ne perd jamais rien), et le serveur qui n'écrase jamais un
  élément déjà programmé (`importFestCalendar`).
- Les tests de `tests/v1014-fest.test.js`, qui doivent rester verts sans être modifiés (on peut en ajouter).

## 9. Ordre des lots

1. Lot 1 (décors) : montre la planche de contrôle au joueur, puis branche les images.
2. Lot 2 (couleur d'accent par fête).
3. Lot 3 (ergonomie), un commit par sous-partie (§ 5.1 à 5.8), avec captures avant / après à chaque fois.
4. Lot 4 (traductions).
5. Lot 5 (notifications et finitions).

À la fin, écris les notes de version 10.14.1 dans `docs/RELEASE_NOTES.md` (même style que les précédentes : phrases
courtes, ce que le joueur voit), mets à jour `docs/evenements-v1014.md`, et fournis au joueur une capture de chaque
onglet sur PC et sur téléphone.
