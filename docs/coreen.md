# Coréen (한국어)

Langue ouverte à tous depuis la 9.1.8, complétée en 9.1.9 (écrans, fiches, fenêtres, messages, données).
Ce document suit la couverture, le glossaire et ce qui reste à faire.

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
- `src/i18n/en.js` + `en-910.js` + `en-919.js` : anglais. `src/i18n/ko.js` + `ko-919.js` : coréen (EXACT + PATTERNS).
- v9.1.9 : motifs écrits avec `P(français, traduction)` (`engine.js`, `makeP`) : `#` nombre (grands nombres
  « 232,3 ai » compris), `@` texte libre, `~s` lettre facultative ; dans la traduction `$1` nombre, `%1` texte
  traduit (sinon le motif ne s'applique pas), `&1` durée. L'ordre des mots est celui de la langue cible
  (« Score : 1,2 K dégâts en 30 s » → « 점수: 30초 동안 피해 1.2 K »).
- v9.1.9 : le moteur découpe aussi les chemins « Héros › Équipement », traduit l'aria-label/title d'un
  `<canvas>` (son contenu reste ignoré) et compte les unités aa…zz comme des nombres.
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
| avant 9.1.9 | 2405 | 2185 (90,9 %) | 763 (31,7 %) |
| après 9.1.9** | 2391 | 2376 (99,4 %) | 2371 (99,2 %) |

\*\* l'outil lit aussi `index.html`, écarte le code qui passait le filtre (dessins de `render/art.js`,
sélecteurs, clés de cache) et accepte un « 12 » collé au bord (icône ou élément à part).

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
| Pouvoir (de boss) / Maîtrise | 능력 / 숙련 | « Changer le pouvoir » → 능력 변경 |
| Ensemble (d'équipement) | 세트 | « 2 pièces : … » → « 2세트: … », « 0/6 portées » → « 0/6 착용 » |
| Objet ancestral | 유물 아이템 | (고대 = fragments anciens, boss ancestral) |
| Renforcer / Réaffûter / Relancer les effets | 단련 / 연마 / 효과 재설정 | |
| Épines / Vol de vie / PV/s | 가시 / 흡혈 / 초당 HP 회복 | « épines 40 % » → « 가시 40% » |
| Notable / Clé de voûte (talents) | 주요 특성 / 핵심 특성 | |
| Mécanique de boss : Carapace, Invocatrice, Fournaise, Désespoir | 갑각, 소환사, 용광로, 절망 | « Contre : » → « 상성: » |
| Mutation (ennemi muté) | 변이 | |
| Thème / Notifications / Raccourcis clavier | 테마 / 알림 / 단축키 | |
| Journal de la session / Retour de session | 세션 기록 / 세션 복귀 | |

Noms propres et sigles gardés en lettres latines : HP, XP, Lv., unités des grands nombres (K, M, B, T,
aa…zz), noms des touches (Esc, Tab, Shift, Enter, Space, Q W E R T), GitHub, « Ascendrya » et le mot à taper
« EFFACER » de la réinitialisation (comparé par le code, `ui.js`).

## Contrôle (9.1.9)

- `node tools/audit-overflow.cjs <dossier> <port> <largeur> <hauteur> ko` ouvre tous les écrans et segments,
  les replis, Paramètres (tous les onglets), les fiches (objets et leurs onglets, compagnons, boss, donjons,
  compétences, talents, encyclopédie), les fenêtres (retour hors ligne, retour de session, Renaissance,
  Transcendance, confirmations, journal, raccourcis K, monnaies) et le tutoriel d'une partie neuve ; il lit les
  nœuds texte et les attributs title / aria-label / placeholder / alt.
- `tests/i18n-ko.test.js` : toutes les données du jeu (ennemis, objets, ensembles et leurs paliers, ~500 talents
  avec leurs effets, pouvoirs, compagnons et leurs compétences, héros, classes, monnaies, mécaniques, mutations,
  missions, hauts faits…) sont traduites sans lettre latine.

## Reste à faire

1. Textes coupés par des balises (« Vous gagnerez <b>+5 fragments</b> à investir… ») : traduits morceau par
   morceau, chaque morceau écrit pour se lire dans l'ordre français ; une vraie phrase coréenne demanderait
   de changer les gabarits.
2. Messages très rares (erreurs du serveur, outils de la version dev) : `--missing ko`.
3. Relecture par un locuteur natif (ton, noms propres des mondes, des boss et des héros).
4. Police : vérifier sur Windows (Malgun Gothic) et Android (Noto Sans CJK) ; envisager d'embarquer un
   sous-ensemble de Noto Sans KR si le rendu système déçoit. Les textes dessinés dans le canvas
   (chiffres de dégâts) ne sont pas traduits (nombres seulement).
5. Contrôle des longueurs à chaque lot : audit-overflow en ko à 375×812 et 1280×800.
6. Ouverture : passer `LANGS.ko.enabled` à `true` quand la couverture des écrans visibles est complète
   (`residue-375-ko.txt` vide).
