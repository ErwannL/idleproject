# ASCENDRYA — AWAKEN YOUR LEGEND · trailer promotionnel (v9.3.1)

40 s · 16:9 1920×1080 60 i/s (principal) · 9:16 1080×1920 · version 16:9 sans texte (localisation).
Rendu : `tools/trailer-awaken.cjs` (scène `docs/promo/trailer-awaken/stage.html`, image par image) ·
musique : `tools/trailer-awaken-music.py` (originale, synthétisée) · assemblage ffmpeg (voir « Montage »).

**Règle tenue** : tout ce qui est montré comme du jeu est une vraie capture du jeu (build web, horloge virtuelle).
Les plans « héros », « familiers », « portail » et « logo » sont du motion design fait avec les vrais assets du jeu
(illustrations pixel art HD, effets d'invocation du jeu) : ils ne sont pas présentés comme du gameplay.
Aucune vidéo générée par IA, aucun personnage, boss ou fonctionnalité inventé.

## A. Storyboard

| # | Temps | Durée | Asset | Cadrage / caméra | Action | Effets | Texte | Transition | Son |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0,00–0,60 | 0,6 s | — | noir | — | — | — | — | grondement grave qui monte |
| 2 | 0,60–3,00 | 2,4 s | capture World Boss, Colosse des Anciens au repos puis charge des yeux (×0,25) | plan large sur le Colosse, push-in 1,00→1,10 | silhouette dans l'ombre, les yeux s'allument | étalonnage nuit (sombre, désaturé, bleuté), halo cyan sur les yeux, vignette | WHEN DARKNESS AWAKENS... (1,2–3,0) | ouverture au noir 0,9 s | drone 37/55 Hz, riser |
| 3 | 3,00–4,75 | 1,75 s | même capture, suite (charge puis tir) | très gros plan sur les yeux, push-in 1,00→1,18 | les yeux s'ouvrent et le rayon part | étalonnage crépuscule, flash blanc final | — | flash blanc | impact grave (boom) à 4,62 s |
| 4–9 | 4,75–9,91 | 6 × 0,86 s | illustrations pixel art HD : Chevalier, Archange, Reine démone, Chevalier dragon, Impératrice des glaces, Seigneur de l'ombre (`assets/hd/px/…`) | alternance plein pied / gros plan visage, glissé latéral + zoom 1,12→1,00 | révélation rapide de chaque héros | fond radial à la couleur du héros, rayons tournants, étincelles, halo, flash d'entrée | — | flash à chaque coupe | timbale + souffle à chaque révélation, nappe Dm–Bb–F–C |
| 10 | 9,91–12,00 | 2,1 s | 5 héros réunis | composition en V, apparition décalée | l'équipe se forme | rayons dorés, étincelles | LEGENDARY HEROES (10,25–12,0) | flash | boom + cloche |
| 11 | 12,00–13,60 | 1,6 s | portail et rayon légendaire d'invocation du jeu (`assets/ui/vfx/portal.webp`, `beam_legend.webp`) | centré, le portail grandit | ouverture du portail | rayons violets, étincelles, flash final | — | flash | souffle montant + riser |
| 12–15 | 13,60–16,80 | 4 × 0,8 s | familiers : Petit phénix, Dragonnet de braise, Renard céleste, Slime doré (`assets/hd/px/pet_…`) | centré devant le portail | apparition avec rebond | explosion légendaire du jeu (`legend_blast.webp`), halo couleur | — | flash | carillon + timbale |
| 16 | 16,80–18,00 | 1,2 s | 5 familiers réunis (+ Feu follet) | rangée | — | étincelles | MYSTICAL COMPANIONS | — | cloche aiguë |
| 17 | 18,00–19,10 | 1,1 s | **gameplay** Forêt sombre, boss Loup Alpha (`tools/record-trailer.mjs`, plan 2) | push-in | combat automatique, compétences | flou de mouvement d'entrée | EPIC BOSS BATTLES (18,1–20,3) | coupe sèche (whip) | percussions 120 BPM + impact |
| 18 | 19,10–20,30 | 1,2 s | **gameplay** Désert brûlant, boss Dragon des cendres | push-out | idem | idem | (suite) | whip | impact |
| 19 | 20,30–21,40 | 1,1 s | **gameplay** Cœur du volcan, Phénix ancestral | push-in | idem | idem | — | whip | impact |
| 20 | 21,40–22,50 | 1,1 s | **gameplay** Royaume englouti, Léviathan (nage) | push-out | idem | idem | — | whip | impact |
| 21 | 22,50–24,30 | 1,8 s | **capture de l'interface** : écran Composition (équipe, compagnons, types) | zoom lent sur le panneau | composition d'équipe | vignette | BUILD YOUR TEAM | coupe | impact |
| 22 | 24,30–25,80 | 1,5 s | **capture de l'interface** : combat automatique (« Avance auto », ennemis vaincus, butin) | zoom arrière | l'équipe combat seule | — | ENDLESS PROGRESSION (24,4–27,4) | coupe | impact |
| 23 | 25,80–27,60 | 1,8 s | **gameplay** World Boss, rayon des yeux (2 rayons, sprite corrigé), ralenti ×0,55 | push-in | le rayon balaie l'équipe | — | (suite) | whip | percussions 150 BPM |
| 24 | 27,60–29,50 | 1,9 s | **gameplay** World Boss forme de lave, rayon de lave, ralenti | push-in fort 1,05→1,30 | final de la séquence | flash blanc final | — | flash → noir | riser |
| 25 | 29,50–30,20 | 0,7 s | — | noir | — | — | — | — | **silence** |
| 26 | 30,20–36,60 | 6,4 s | logo ASCENDRYA (police pixel du site) sur le Colosse flouté | centré, léger zoom | le logo s'impose | flash, rayons dorés, reflet qui passe sur le logo, étincelles | YOUR LEGEND BEGINS. (31,7–36,6) | flash d'entrée | impact énorme, accord final, cloches |
| 27 | 36,60–40,00 | 3,4 s | logo + appel à l'action | logo plus petit en haut | — | bouton qui pulse | COMING TO PC (STEAM) & MOBILE · PRE-REGISTER NOW | fondu final | accord majeur, timbale, cloche |

Version **sans texte** : mêmes images, sans aucun texte incrusté (le logo reste, ce n'est pas un texte à traduire).
Version **9:16** : mêmes plans ; gameplay en bande pleine largeur sur fond flou (rien n'est coupé), Colosse recadré
sur la tête, héros/familiers recomposés en hauteur, textes agrandis et placés dans la zone sûre.

## B. Assets utilisés (emplacements)

| Usage | Fichier |
|---|---|
| Colosse (réveil, rayons) | captures du World Boss : `src/ui/world-boss.js` + `src/render/world-boss-scene.js`, sprites `assets/world-boss/colossus_*.png` (rayons peints retirés en 9.3.1) |
| Gameplay des mondes | build web filmé par `tools/record-trailer.mjs` (plans 2, 4, 9, 11) |
| Interface | captures du jeu : écran Composition, écran de combat |
| Héros | `assets/hd/px/hero_knight.webp`, `ally_archangel.webp`, `ally_demon_queen.webp`, `hero_dragon_knight.webp`, `ally_ice_empress.webp`, `ally_shadow_lord.webp` |
| Familiers | `assets/hd/px/pet_phoenix.webp`, `pet_dragonling.webp`, `pet_kitsune.webp`, `pet_golden_slime.webp`, `pet_wisp.webp` |
| Effets | `assets/ui/vfx/portal.webp`, `beam_legend.webp`, `legend_blast.webp` |
| Logo | texte « ASCENDRYA » en Press Start 2P (même rendu que le site, pas de fichier logo dans le projet) |
| Musique | `tools/trailer-awaken-music.py` (originale) |

## C. Prompts vidéo (Seedance ou autre)

Aucun générateur vidéo n'est accessible depuis ce projet : **rien n'a été généré**. Le trailer livré n'en a pas besoin.
Si vous voulez enrichir l'intro ou le logo avec un générateur, utilisez-le **seulement** pour des plans d'ambiance,
jamais pour du gameplay, et indiquez-le. Prompts prêts à copier (fournir l'image de référence indiquée) :

1. *Plan 1-2, ambiance* — « Pixel art 16-bit, dark volcanic throne hall at night, a colossal moss-covered stone golem
   slumbering in shadow, faint cyan cracks pulsing on its body, slow dolly-in, embers drifting, heavy fog, cinematic
   low-key lighting, no text, keep the exact design of the reference image. » Référence : `docs/promo/social/bg-colosse.png`.
2. *Plan 3, yeux* — « Extreme close-up on the stone golem's face from the reference, its two eyes ignite with bright
   cyan light, light bloom, subtle camera shake, pixel art preserved, 2 seconds. »
3. *Plan 26, logo* — « Golden pixel-art logo 'ASCENDRYA' emerging from darkness with a magical light sweep and golden
   particles, epic fantasy, centered, clean readable letters. » (le logo du trailer livré est déjà animé : optionnel).

## D. Montage

1. Captures : `NOENC=1 node tools/record-trailer.mjs --part main --frames DIR` ; World Boss : capture du rayon
   (scripts de session, à reprendre de `tools/trailer-awaken.cjs` : `window.__wbCtx`, `scene.special({ id: 'eyebeam' })`).
2. Images : `node tools/trailer-awaken.cjs ROOT OUT 1920 1080 1` (16:9), `… 1920 1080 0` (sans texte),
   `… 1080 1920 1` (9:16).
3. Musique : `python3 tools/trailer-awaken-music.py music.wav`.
4. Encodage : `ffmpeg -framerate 60 -i OUT/f%05d.png -i music.wav -c:v libx264 -crf 17 -preset slow -pix_fmt yuv420p -c:a aac -b:a 256k -shortest -movflags +faststart trailer.mp4`.
Transitions (flash, coupe sèche avec flou, ouverture et fermeture au noir), textes et impacts sont dans `stage.html`
(tableau `SHOTS`) et synchronisés avec la musique (mêmes instants).

## H. Éléments manquants / à faire à la main

- **Musique** : la bande-son livrée est originale mais synthétique (sans orchestre réel). Pour un rendu « orchestral
  épique » haut de gamme, remplacer par un morceau composé ou sous licence (mêmes repères : impacts à 4,62 / 9,91 /
  18,0 / 30,2 s, silence 29,5–30,2 s).
- **Fichier logo** : aucun logo dessiné dans le projet (le trailer utilise la police pixel du site). Un logo vectoriel
  ou pixel art dédié rendrait la fin plus forte.
- **Adresse du site** : non affichée. `site/config.js` contient encore un domaine d'exemple (`TON-DOMAINE.xyz`).
  La renseigner, puis ajouter une ligne de texte au plan 27.
- **Steam** : « COMING TO PC (STEAM) » suppose une page Steam prévue ; à confirmer avant diffusion.
- **9:16 sans texte** : non rendue (même commande avec `1080 1920 0` si besoin).
