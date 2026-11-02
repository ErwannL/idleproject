# Coréen (한국어) — en préparation

Langue **fermée aux joueurs** : prévue, pas livrée avec la 9.1.4. Ce document suit la couverture, le
glossaire et ce qui reste à faire.

## Activer / tester

- Interrupteur : `src/i18n/i18n.js`, `LANGS.ko.enabled` (`false` aujourd'hui). Passer à `true` = le
  coréen apparaît dans Paramètres → Général → Langue pour tout le monde.
- Sans toucher l'interrupteur : version dev (`npm run build:dev`, `BUILD.cheats`) → le bouton
  « 🇰🇷 한국어 » est proposé ; ou n'importe quelle version avec l'adresse `?lang=ko`
  (ex. `http://localhost:8804/?lang=ko`).
- La langue choisie est gardée dans `localStorage['idle-rpg.lang']`. Une langue fermée lue au
  démarrage retombe sur le français.

## Architecture (N langues)

- `src/i18n/engine.js` : moteur commun (dictionnaire exact, motifs, règles génériques : listes « a · b »,
  « libellé : valeur », parenthèses, symboles, nombres seuls).
- `src/i18n/en.js` + `en-910.js` : anglais. `src/i18n/ko.js` : coréen (EXACT + PATTERNS).
- `src/i18n/i18n.js` : registre `LANGS` (`label`, `flag`, `enabled`, `translate`), `availableLangs()`
  pour le sélecteur de Paramètres, changement de langue à chaud (retour au français puis traduction).
- Police : le jeu n'a pas de glyphes hangeul (Trebuchet MS, polices des thèmes). En coréen,
  `html[lang="ko"]` applique `system-ui, "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo",
  sans-serif` (titres de thème compris) et `word-break: keep-all` (`src/ui/style.css`, fin du fichier).

## Couverture (`node tools/i18n-coverage.mjs`)

Mesure approchée sur les chaînes françaises des sources (littéraux et textes des gabarits).

| Date | Chaînes FR | en | ko |
|---|---|---|---|
| avant (9.1.3) | 2327 | 1888 (81,1 %)* | 0 % |
| après ce lot | 2327 | 2132 (91,6 %) | 684 (29,4 %) |

\* mesure « traduit si différent » ; avec le moteur `lookup` (mots identiques comptés), départ à 85,8 %.

Écrans contrôlés en coréen à 375×812 (`node tools/audit-overflow.cjs <dossier> 8804 375 812 ko`) :
aucun texte coupé ni débordant (un seul défaut, transitoire : bannière « Ennemi muté » encore en
français). Le même outil écrit `residue-375-ko.txt` : textes encore en lettres latines à l'écran
(38 restants après ce lot, contre ~490 au départ).

## Glossaire

| Français | 한국어 | Remarque |
|---|---|---|
| Renaissance | 환생 | |
| Transcendance | 초월 | |
| Prestige | 프레스티지 | |
| Doublons | 중복 | « Doublons 0/5 » → « 중복 0/5 » |
| Ultime | 궁극기 | « Ultime à 3 doublons » → « 중복 3회 시 궁극기 » |
| Prime (du jour) | 현상금 | |
| Défis / Défi de la semaine | 도전 / 주간 도전 | |
| Tour de l'Éternité | 영원의 탑 | |
| Talents / Arbre | 특성 / 트리 | |
| Compétences | 스킬 | |
| Améliorer / Améliorations | 강화 | Renforcer (objet) → 단련 |
| Recycler / Fusion / Forge | 분해 / 합성 / 대장간 | |
| Invocation / Bannière / Filet | 소환 / 배너 / 천장 | « En vedette » → 픽업 |
| Compagnon / Familier | 동료 / 펫 | |
| Expéditions | 파견 | |
| Or / Gemmes / Éclats | 골드 / 보석 / 조각 | |
| Fragments anciens / Clés de donjon | 고대 파편 / 던전 열쇠 | |
| Étoiles / Essence / Tickets | 별 / 정수 / 티켓 | |
| Commun / Rare / Épique / Légendaire | 일반 / 희귀 / 영웅 / 전설 | |
| Dégâts / PV max / Armure | 공격력 / 최대 HP / 방어력 | bonus : « 최대 HP +10% » |
| Coup critique / Vitesse d'attaque | 치명타 확률 / 공격 속도 | |
| Sac / Coffre (rangement) | 가방 / 창고 | coffre (récompense) → 상자 |
| Étape / Monde / Niv. | 스테이지 / 월드 / Lv. | |
| Hauts faits / Encyclopédie / Musée | 업적 / 도감 / 박물관 | |
| Paramètres / Récupérer | 설정 / 받기 | « Tout récupérer » → 모두 받기 |

## Reste à faire

1. Gros volumes non traduits (par fichier) : `ui/ui.js` (fenêtres : retour de session, confirmations,
   Transcendance, nouveautés), `main.js` (messages flottants), `panels/inventory.js` (fiche d'objet,
   fusion, musée), `data/talent-tree.js` (noms et effets des ~500 talents), `data/enemies.js`,
   `data/powers.js` (pouvoirs des boss), `panels/hero.js`, `data/heroes.js` (descriptions),
   `panels/options.js` (onglets Interface/Son/Fenêtre), `ui/shortcuts.js`, `core/guide.js` (aides).
   Liste précise : `node tools/i18n-coverage.mjs --missing ko`.
2. Motifs : les textes à valeurs (récompenses, effets d'objets, affixes, minuteurs) suivent l'ordre
   français ; à reprendre un par un dans `PATTERNS` de `ko.js` (ordre coréen : objet puis verbe).
3. Relecture par un locuteur natif (ton, noms propres des mondes, des boss et des héros).
4. Police : vérifier sur Windows (Malgun Gothic) et Android (Noto Sans CJK) ; envisager d'embarquer un
   sous-ensemble de Noto Sans KR si le rendu système déçoit. Les textes dessinés dans le canvas
   (chiffres de dégâts) ne sont pas traduits (nombres seulement).
5. Contrôle des longueurs à chaque lot : audit-overflow en ko à 375×812 et 1280×800.
6. Ouverture : passer `LANGS.ko.enabled` à `true` quand la couverture des écrans visibles est complète
   (`residue-375-ko.txt` vide).
