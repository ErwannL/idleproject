# Ascendrya 10.13.2 : finir la version téléphone (contrôle complet de la 10.13.1)

## Contexte

- Dépôt : `ErwannL/idleproject`, base `main` (10.13.1, commit `585744af` ou plus récent).
- On a contrôlé la 10.13.1 au format téléphone, écran par écran (412 × 915, partie avancée `tests/fixtures/endgame.json` et partie neuve, 82 captures avec `tools/capture-1013.mjs`).
- Le résultat est propre dans l'ensemble. Ce prompt corrige ce qui reste et termine les écrans encore vides ou peu « jeu mobile ».
- **Téléphone seulement.** Tout le CSS va sous `#app.m-phone`. Le PC ne doit pas bouger d'un pixel (vérifie avec `tools/desk-audit.mjs` ou les captures PC de `capture-1013.mjs`).
- Version cible : **10.13.2** (`package.json`, `package-lock.json` ×2, `src/version.js` ; `tests/v78.test.js` vérifie que les trois sont pareilles).

Les images sont dans `images/` :
- `images/avant/` : les défauts tels qu'ils sont dans la 10.13.1.
- `images/apres/` : le résultat attendu pour la partie A (déjà fait, voir plus bas).
- `images/a-revoir/` : les écrans de la partie B, encore à améliorer.
- `images/avant-apres.png` : planche de comparaison.

---

## Partie A : correctifs déjà écrits (à appliquer tels quels)

Ces correctifs existent déjà dans la PR #14 (branche `claude/audit-10131`). **Si la PR #14 est déjà fusionnée dans `main`, passe directement à la partie B.** Sinon, applique `correctifs-10.13.2.patch` (fourni dans ce zip) avec `git apply correctifs-10.13.2.patch`, ou refais les points ci-dessous à la main.

Nouveau fichier `src/ui/mobile1014.css`, chargé dans `index.html` juste après `src/ui/mobile-audit1013.css`.

### A1. Arène : la scène était cachée (`avant/01-arene.jpg` → `apres/arena.png`)
L'Arène est le seul onglet qui n'est pas une page sur téléphone (`SCENE_TABS` dans `src/ui/page.js`) : le panneau s'ouvre sous la scène. Mais toute la pile du combat restait posée sur la scène (carte de zone, événements, Carnet du jour, Chemin du héros, « Tout récupérer », barre de vague, bonus du Bastion). On ne voyait plus rien du combat.
- Quand `#app.m-phone.panel-open:not(.page-ui)` : cacher `#hud106`, `#zone-card` (sélecteur `#app#app.m-phone.panel-open:not(.page-ui) #stage-area #zone-card`, sinon la règle de `mobile-hud.css` gagne), `#goals-pill`, `#combat-console`, `#next-action`, `#next-unlock`, `#loot-bag`, `#auto-toggle`, `#quest-banner`.
- Ne pas agrandir le panneau : en dessous de ~45 % de hauteur pour la scène, le rendu rapetisse les personnages et c'est moins bien.

### A2. Sous-onglets du haut coupés (`avant/02-sous-onglets-coupes.jpg`, `avant/03-…` → `apres/skills.png`)
Avec 5 sous-onglets (Équipement · Améliorations · Compétences · Talents · Forge, ou Apparences · Boss · Classement · Guilde · Statistiques), la rangée défilait et coupait les noms au bord (« ement », « Fo », « Statist »).
- CSS : `#panel-subtabs` gap 4 px, padding 4 px ; `.subtab { flex: 1 1 0; min-width: 0; padding: 4px 2px 3px }` ; texte 11 px, `letter-spacing: -.3px`.
- `src/ui/ui.js`, fin de `renderSubtabs()` : sur `m-phone`, ajouter `m-many` à la rangée s'il y a plus de 5 onglets (ils gardent alors 76 px et la rangée défile). Pour chaque onglet, si `.sub-long` est plus large que le bouton (`scrollWidth > clientWidth - 4`, et seulement si `clientWidth > 0`), ajouter `use-short`, qui affiche `.sub-short` (Amélio., Compét.) à la place.

### A3. Rangées qui défilent : fondu de bord (`avant/08-collections-modes.jpg`)
Boutique (8 modes) et Collections (7 modes) défilent ; la dernière case était coupée net. Ajouter un fondu sur les bords tant qu'il reste quelque chose à voir, avec une animation liée au défilement (aucun JS) :
```css
@property --m-fl { syntax: '<length>'; inherits: false; initial-value: 0px; }
@property --m-fr { syntax: '<length>'; inherits: false; initial-value: 0px; }
@keyframes m-edge-fade { 0% { --m-fl: 0px; --m-fr: 28px; } 8%, 92% { --m-fl: 28px; --m-fr: 28px; } 100% { --m-fl: 28px; --m-fr: 0px; } }
@supports (animation-timeline: scroll()) {
  #app.m-phone .m-tabs, #app.m-phone .m-modes, #app.m-phone #panel #panel-subtabs.m-many {
    animation: m-edge-fade linear both; animation-timeline: scroll(self x);
    mask-image: linear-gradient(90deg, transparent 0, #000 var(--m-fl), #000 calc(100% - var(--m-fr)), transparent 100%);
  }
}
```
Sans débordement, la timeline est inactive : pas de fondu.

### A4. Missions : 5 modes sur une ligne (`avant/04-missions-modes.jpg` → `apres/contracts.png`)
`.mp-frame .m-modes` avec exactement 5 modes : `gap: 4px`, `.m-mode { flex: 1 1 0; min-width: 0; padding: 4px 2px 3px }`. « Hauts faits » doit être lisible en entier.

### A5. Bande vide en haut des écrans sans sous-onglets (`avant/05-boutique-bande-vide.jpg` → `apres/shop.png`, `apres/options.png`)
Boutique, Invocation, Paramètres et la Fiche du héros n'ont pas de sous-onglets, mais `#panel-subtabs.hidden` gardait 72 px (le kit force `display:flex`).
- `#app.m-phone #panel #panel-subtabs.hidden { display: none !important; }`
- `#app.m-phone #panel:has(> #panel-subtabs.hidden) > header { height: 48px !important; min-height: 48px !important; }`

### A6. Barre d'action collée : vrai bouton doré (`avant/06-arene-bouton-terne.jpg`)
`ui.phoneAction()` recopie la première `.primary-action` dans une barre collée en bas (`.phone-action`). La copie était un aplat or terne. Lui donner le style du bouton doré du kit : 52 px, rayon 14 px, bord `#fff0b8`, dégradé `#ffe08a → #f0b93f`, texte `#2a1a05` 16 px gras, ombre `0 3px 0 #8a5a12`. Désactivé : `filter: grayscale(.7) brightness(.7)`.

### A7. Flèche dorée de conseil (`avant/07-menu-fleche.png` → `apres/fleche.png`)
`ui.adviceArrow()` plaçait « ◀ » à droite du bouton Héros/Équipe. Avec le menu du bas, la flèche tombait sur le bouton voisin (« ◀ Combat ») et restait par-dessus le menu ☰ ouvert.
- Si le bouton est dans le bas de l'écran (`r.top > innerHeight * 0.6`) : « ▼ », classe `down`, centrée au-dessus du bouton (`top = r.top - 30`), animation verticale `gold-arrow-down`.
- `body:has(#modal:not(.hidden)) .gold-arrow { display: none; }`

### A8. Menu ☰ (`avant/07-menu-fleche.png` → `apres/menu.png`)
Le ✕ était seul au-dessus du titre « Menu ». Mettre `.drawer-close` en absolu en haut à droite (44 × 44) et `h2` centré sur la même ligne (marges 52 px, 20 px).

---

## Partie B : ce qu'il reste à rendre « jeu mobile » (à faire)

Même règle que la 10.12 et la 10.13 : on doit avoir l'impression d'un jeu mobile (Slayer Legends, Capybara Go), pas d'un site. Chaque écran a un cartouche, une illustration, des cases ou des cartes, **un seul** bouton doré, rien de vide, rien de coupé. Réutilise le kit (`src/ui/mobile-kit.css` : `.m-frame`, `.m-title`, `.m-modes`, `.m-card`, `.m-tile`, `.m-btn-gold`, `.m-btn`, `.m-empty`, `.m-chip`…).

### B1. Écran de combat : le HUD prend 40 % de l'écran (`a-revoir/01-ecran-combat-hud.jpg`)
De haut en bas : carte de zone (76 px), événements (2 rangées d'icônes), Carnet du jour (carte de 68 px), « Avance auto », Chemin du héros (carte de 75 px). Tout ça va jusqu'à ~340 px sur 915, et le combat est coincé au milieu. Le joueur l'a déjà signalé deux fois (« ça prend beaucoup de place, les icônes sont peut-être trop grandes »).
- Objectif : le HUD du haut ne dépasse pas **~230 px** (sous la barre du haut).
- Carnet du jour : une pastille d'une ligne (icône + « Carnet 0/8 » + point rouge s'il y a quelque chose), à côté de « Avance auto », pas une carte. Toucher la pastille ouvre le Carnet.
- Chemin du héros : une ligne (icône 32 px, texte de l'étape, mini-barre dessous, bouton « Récupérer » 44 px à droite seulement quand c'est prêt).
- Événements : une seule rangée de 4 icônes au plus (~44 px), le reste derrière « + ».
- Rien ne doit se chevaucher (`tools/mobile-audit.mjs`, contrôle 2) ; garder le combat lisible au milieu.
- Vérifier en partie neuve **et** en partie avancée, et pendant le prologue/tutoriel.

### B2. Forge › Recycler : la moitié de l'écran est vide (`a-revoir/02-forge-recycler-vide.jpg`)
Quand rien n'est à recycler, on voit une phrase et un gros bouton gris « Recycler » inutile.
- Afficher la grille du sac (5 colonnes, pastilles de rareté) avec les objets recyclables cochés, une ligne de filtres par rareté (Commun → Épique) et le total « +N éclats · +N or » au-dessus du bouton.
- Rien à recycler : `.m-empty` illustré (coffre vide) + phrase courte, **pas** de bouton désactivé.

### B3. Améliorations en partie neuve : grand vide dans la carte du haut (`a-revoir/03-ameliorations-neuve-vide.jpg`)
« Dégâts/s 14,3 » puis ~90 px de vide avant « Tout acheter ». Remplir avec le héros (sprite) à gauche et 2 stats (Vie, Vitesse) à droite, ou réduire la carte à son contenu. Même rendu qu'en partie avancée (qui a ×1/×10/×100/Max et le pronostic du boss).

### B4. Talents › Arbre avancé : branche presque vide (`a-revoir/04-arbre-avance-vide.jpg`)
La branche « Puissance » affiche 2 nœuds au milieu d'un grand cadre vide. Montrer la branche entière (nœuds verrouillés grisés avec cadenas et coût), relier les nœuds, centrer sur le prochain nœud achetable. Hauteur du cadre adaptée au contenu.

### B5. Boutique › Marchands : écran vide (`a-revoir/05-marchands-vide.jpg`)
« Aucun marchand de passage pour le moment » dans un petit cadre. Remplacer par `.m-empty` illustré (marchand qui dort, ou étal fermé) + quand revient le prochain marchand (compte à rebours si le jeu le sait).

### B6. Fiche du héros : bouton « Duel » terne (`a-revoir/06-fiche-heros-duel.png`)
« ⚔ Duel : rang Porte-lumière » est un aplat or foncé hors du kit. Le passer en `.m-btn-gold` (c'est l'action principale de l'écran) ou en `.m-btn` s'il y a déjà un doré. Vérifier aussi les onglets Fiche / Classe / Records (hauteur 44 px, même style que `.m-modes`).

### B7. Guilde sans compte (`a-revoir/07-guilde.jpg`)
Correct mais pauvre : couronne, 3 icônes, bouton. Ajouter une illustration de bannière de guilde, et sous chaque icône une phrase de 4 à 6 mots (ce que ça apporte).

### B8. Carnet du jour : bulles d'info coupées (`a-revoir/08-carnet-chips.jpg`)
« L'Arène n'a pas été jouée aujourd'hui › » et « Aucune expédition… » défilent dans une rangée et sont coupées. Les passer en liste verticale (une ligne chacune, icône + texte + ›) ou les mettre dans chaque ligne concernée (Arène, Expéditions) en sous-texte.

### B9. Invocation (`a-revoir/10-invocation.jpg`)
Bien, mais le bas du cadre est vide sous les 4 boutons de tirage. Ajouter dessous la ligne « Taux » (pastilles de rareté avec %), et le compteur de pitié en barre (« Légendaire garanti dans N tirages »).

### B10. Passe générale
Pour chaque onglet (liste `ALL_TABS` de `tools/lib-1013.mjs`), partie neuve et partie avancée :
- Pas de zone vide de plus de ~120 px dans un cadre ; sinon un `.m-empty` illustré.
- Aucune ligne de texte coupée (ni « … » ni nom coupé au bord d'une rangée qui ne défile pas).
- Un seul bouton visuellement doré à l'écran (barre collée comprise).
- Les fenêtres (`#modal`) : titre centré, ✕ à droite sur la même ligne, 44 px.

---

## Vérifications obligatoires

1. `npm test` : tout passe (881 au départ).
2. `node tools/mobile-audit.mjs --sizes 390x844,412x915` : **0 défaut** (12 contrôles), partie neuve et partie avancée.
3. Ajouter à `tools/mobile-audit.mjs` deux contrôles :
   - **13** : aucun élément du HUD de combat (`#hud106`, `#zone-card`, `#combat-console`) visible par-dessus la scène quand un panneau est ouvert sans être une page (Arène).
   - **14** : dans `#panel-subtabs` sans `.m-many`, aucun onglet dont le texte visible dépasse le bouton.
4. `node tools/capture-1013.mjs --sizes 412x915 --games endgame,fresh` : relire **chaque** capture. Joindre à la PR une planche avant/après pour B1 à B9.
5. PC : `node tools/capture-1013.mjs --sizes 1366x768,1920x1080 --games endgame` : identique à la 10.13.1.
6. Écran de combat (B1) : capture en partie neuve, en partie avancée et pendant le tutoriel ; le HUD du haut s'arrête vers 230 px.

## Livraison

- Une PR « 10.13.2 : finir la version téléphone », description en français, avec la planche avant/après.
- Version 10.13.2 partout.
- Commits par lot : A (si pas encore fusionné), B1, B2–B5, B6–B9, contrôles 13–14.
