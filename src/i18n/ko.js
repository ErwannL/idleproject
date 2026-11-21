// Traduction coréenne de l'interface (couche i18n, voir ./i18n.js) — ouverte à tous en v9.1.8.
// Choisie dans Paramètres › Langue (LANGS.ko.enabled dans ./i18n.js) ou avec
// « ?lang=ko ». Même principe que ./en.js : dictionnaire exact + motifs, moteur commun ./engine.js.
// Style : interface de jeu mobile coréen (libellés courts, 「Lv.」, verbes en nom : 받기, 강화, 장착).
// Glossaire et reste à faire : docs/coreen.md. Couverture : node tools/i18n-coverage.mjs.
import { createTranslator, num } from './engine.js';
import { EXACT_920_OCEAN } from './ko-920-ocean.js'; // v9.2.0 (monde marin)
import { EXACT_919, NUM as NUM_919, PATTERNS_919, setKoLookup } from './ko-919.js';
import { EXACT_920_UPG, patterns920Upg } from './ko-920-upg.js'; // v9.2.0
import { EXACT_921, patterns921 } from './ko-921.js'; // v9.2.1
import { EXACT_922, patterns922 } from './ko-922.js'; // v9.2.2
import { EXACT_923, patterns923 } from './ko-923.js'; // v9.2.3
import { EXACT_925, patterns925 } from './ko-925.js'; // v9.2.5
import { EXACT_926, patterns926 } from './ko-926.js'; // v9.2.6
import { EXACT_927_SHOWCASE } from './ko-927-vitrine.js'; // v9.2.7 : vitrine animée
import { EXACT_927, patterns927 } from './ko-927.js'; // v9.2.7
import { EXACT_928, patterns928 } from './ko-928.js'; // v9.2.8
import { EXACT_928_ECO, patterns928Eco } from './ko-928-eco.js'; // v9.2.8 : économie
import { EXACT_929, patterns929 } from './ko-929.js'; // v9.2.9

// --- Dictionnaire exact ---------------------------------------------------------------------------

export const EXACT = {
  // Menus et sous-onglets
  'Héros': '영웅', 'Aventure': '모험', 'Équipe': '팀', 'Objectifs': '목표', 'Personnage': '캐릭터', 'Progression': '성장',
  'Améliorations': '강화', 'Compétences': '스킬', 'Talents': '특성', 'Fiche': '정보', 'Équipement': '장비', 'Composition': '편성',
  'Expéditions': '파견', 'Invocation': '소환', 'Carte': '지도', 'Donjons': '던전', 'Défis': '도전', 'Arène': '아레나', 'Guilde': '길드', 'Boss': '보스', 'Monde': '월드',
  'Collections': '컬렉션', 'Missions': '미션', 'À récupérer': '받을 보상', 'Paramètres': '설정', 'Tour': '탑', 'Arbre': '트리',
  'Renaissance': '환생', 'Renaissances': '환생', 'Transcendance': '초월', 'Transcendances': '초월', 'Événements': '이벤트',
  'Musée': '박물관', 'Encyclopédie': '도감', 'Hauts faits': '업적', 'Contrats': '계약', 'Forge': '대장간', 'Builds': '빌드',
  'Sorts': '주문', 'Apparence': '외형', 'Apparences': '외형', 'Classe': '클래스', 'Bannière': '배너', 'Archives': '기록 보관소',
  'Aide': '도움말', 'Outils': '도구', 'Général': '일반', 'Interface': '인터페이스', 'Son': '사운드', 'Fenêtre': '창',
  // Monnaies et ressources
  'Or': '골드', 'or': '골드', 'Gemmes': '보석', 'gemmes': '보석', 'gemme': '보석', 'Fragments anciens': '고대 파편', 'fragments anciens': '고대 파편',
  'fragments': '파편', 'Éclats': '조각', 'éclats': '조각', 'Clés de donjon': '던전 열쇠', 'clés': '열쇠', 'clé(s)': '열쇠',
  'Étoiles': '별', 'Essence': '정수', 'essence': '정수', 'Tickets': '티켓', 'tickets': '티켓', 'Prestige': '프레스티지',
  // Raretés
  'Commun': '일반', 'Rare': '희귀', 'Épique': '영웅', 'Légendaire': '전설', 'Mythique': '신화',
  'Légendaires': '전설', 'Épiques': '영웅',
  // Statistiques
  'Dégâts': '공격력', 'dégâts': '공격력', 'PV max': '최대 HP', 'PV': 'HP', 'Armure': '방어력', "Vitesse d'attaque": '공격 속도',
  'Coup critique': '치명타', 'Chance de butin': '획득 확률', 'Dégâts/s': '초당 피해', 'dégâts/s': '초당 피해', 'Puissance': '전투력',
  'Points de vie': '체력', 'Régénération PV': 'HP 재생', "Butin d'or": '골드 획득', 'Vol de vie': '흡혈',
  'Combat': '전투', 'Survie': '생존', 'Ressources': '자원', 'Boosts': '부스트', '⚡ Boosts': '⚡ 부스트',
  // Emplacements
  'Arme': '무기', 'Casque': '투구', 'Collier': '목걸이', "Boucles d'oreilles": '귀걸이', 'Anneau': '반지', 'Bracelet': '팔찌',
  'Armes': '무기', 'Casques': '투구', 'Armures': '갑옷', 'Bijoux': '장신구', 'Tous': '전체', 'Tout emplacement': '모든 부위',
  'Tous les emplacements': '모든 부위',
  // Boutons courants
  'Équiper': '장착', 'Équipé': '장착 중', 'Recycler': '분해', 'Comparer': '비교', 'Améliorer': '강화', 'Ranger': '보관',
  'Renforcer': '단련', 'Verrou': '잠금', 'Récupérer': '받기', 'Tout récupérer': '모두 받기', 'Tout': '모두', 'récupérer': '받기',
  'Enregistrer': '저장', 'Renommer': '이름 변경', 'Détails': '상세', 'Max': '최대', 'Auto': '자동', 'Apprendre': '배우기',
  'Ouvrir': '열기', 'Fermer': '닫기', 'Envoyer': '보내기', 'Repartir': '다시 보내기', 'Entrer': '입장', 'Rejouer': '다시 하기',
  'Valider': '확인', 'Annuler': '취소', 'Confirmer': '확인', 'Compris': '확인', 'Passer': '건너뛰기', 'Suivant ▶': '다음 ▶',
  "C'est parti !": '시작하자!', 'Choisir': '선택', 'Active ✓': '사용 중 ✓', 'Supprimer': '삭제', 'Remplacer': '교체',
  'Retirer': '해제', 'Sauvegarder': '저장', 'Vérifier': '확인', 'Copier le code': '코드 복사', 'Importer…': '가져오기…',
  'Exporter (fichier)': '내보내기(파일)', 'Reprendre au sac': '가방으로 옮기기', 'Aller sur l\'étape': '스테이지로 이동',
  '⬆ Équiper le meilleur': '⬆ 최고 장비 장착', 'Filtrer et trier': '필터·정렬', 'Réglages du sac': '가방 설정',
  "Si tu l'équipes": '장착 시', '(emplacement vide)': '(빈 슬롯)', 'Nouveau nom': '새 이름',
  // Héros, combat, progression
  'Niveau': '레벨', 'Rareté': '등급', 'Récent': '최신', 'Équipement porté': '착용 장비', 'Sac': '가방', 'Coffre': '창고',
  '⏵ Avance auto': '⏵ 자동 진행', '▶ Avance automatique': '▶ 자동 진행', 'Avancer automatiquement': '자동으로 진행',
  'Chasse aux monstres': '몬스터 사냥', 'Chasse aux boss': '보스 사냥', 'Farm économique': '골드 파밍',
  'Toutes les catégories': '모든 분류', 'Tri : par défaut': '정렬: 기본', 'Tri : rentabilité': '정렬: 효율', 'Tri : coût': '정렬: 비용',
  'Points :': '포인트:', 'Touche une case pour lire son effet.': '칸을 눌러 효과를 확인하세요.', 'Pas encore appris': '미습득',
  'Achat par région': '지역별 구매', "Réinitialiser l'arbre": '트리 초기화', 'investis': '투자', 'pour toujours': '영구',
  'pouvoir conservé': '능력 유지', 'Prestige actuel': '현재 프레스티지', 'dégâts, PV et or': '공격력·HP·골드',
  'Bonus éternels et stellaires': '영원·별 보너스', "Retour à l'étape 1 ; le détail est dans la confirmation.": '스테이지 1로 돌아갑니다. 자세한 내용은 확인 창에서.',
  'Puissance 0': '힘 0', 'Chasse 0': '사냥 0', 'Fortune 0': '행운 0', 'Héritage 0': '유산 0', 'Arcanes 0': '비전 0', 'Endurance 0': '인내 0',
  'Cœur du chevalier': '기사의 심장', 'Au niveau 1 :': 'Lv.1 효과:',
  // Aventure
  'Disponible': '도전 가능', 'Jamais terminé': '클리어 기록 없음', 'Verrouillé': '잠김', 'Difficulté': '난이도',
  'Facile': '쉬움', 'Normal': '보통', 'Difficile': '어려움', 'Butin ciblé': '지정 보상', 'Chemin': '경로',
  "Chemin de l'or": '골드의 길', 'Chemin des reliques': '유물의 길', 'Chaque salle rapporte un coffre d’or': '방마다 골드 상자 획득',
  'Chaque salle rapporte des éclats': '방마다 조각 획득', 'Équipement Épique ou mieux': '영웅 등급 이상 장비',
  'Boss final': '최종 보스', 'Salle': '방', 'Record :': '최고 기록:', 'Record absolu :': '역대 최고 기록:', 'Cette semaine :': '이번 주:',
  'Étages et récompenses': '층별 보상', 'Règles de la semaine': '이번 주 규칙', 'Boss ancestral': '고대 보스', 'Pouvoir': '능력',
  'À découvrir': '미발견', 'Vaincs ce boss pour obtenir un pouvoir unique.': '이 보스를 처치하면 고유 능력을 얻습니다.',
  '⚔ Combattre ce boss': '⚔ 보스 도전', 'Récompenses possibles': '획득 가능 보상', 'Bonus de famille': '계열 보너스',
  '2 pouvoirs de la même famille = effets +25 %.': '같은 계열 능력 2개 = 효과 +25%.', 'victoire': '승리', '(Boss redoutable)': '(강력한 보스)',
  'Tour de l\'Éternité': '영원의 탑', 'Défi de la semaine': '주간 도전', 'Récompenses, salles, tentatives': '보상·방·도전 횟수',
  'Quitter la Tour': '탑 나가기', 'Abandonner le défi': '도전 포기', 'Abandonner le donjon': '던전 포기',
  // Équipe
  'Compagnon': '동료', 'Compagnons': '동료', 'Familier': '펫', 'Familiers': '펫', 'Compagnons et familiers': '동료와 펫',
  'Synergies': '시너지', '(2 places)': '(2자리)', '(1 place)': '(1자리)', 'non obtenu': '미보유', 'Bonus passif': '패시브 보너스',
  '⚔ Attaque': '⚔ 공격', 'Ultime': '궁극기', 'Doublons': '중복', 'Durée par place': '자리당 시간', 'Gardien': '수호자',
  'Soutien': '지원', 'Mage': '마법사', 'Archer': '궁수', 'Assassin': '암살자', 'Berserker': '광전사',
  'Apparence en vedette : détails': '픽업 외형: 상세', '✦ Apparence en vedette ✦': '✦ 픽업 외형 ✦', 'Apparence en vedette': '픽업 외형',
  'Épique dans': '영웅 확정까지', '· Légendaire dans': '· 전설 확정까지', 'Filet': '천장',
  // Objectifs
  'Journalières': '일일', 'Hebdomadaires': '주간', 'Se connecter': '로그인', 'Connexion': '출석', 'à récupérer': '받을 보상',
  'Récompense complète': '전체 완료 보상', 'Piste du mois': '이달의 트랙', 'Contrats remplis': '완료한 계약', 'Monstres': '몬스터',
  'Mutations': '변이', 'Équipements': '장비', 'Vaincu': '처치', 'Butin': '전리품', 'Type': '유형',
  // Paramètres
  'Langue · Language': '언어 · Language', 'Sauvegarde': '저장', 'Compte et sauvegarde en ligne': '계정 및 온라인 저장',
  'Créer un compte joueur': '플레이어 계정 만들기', 'Version et mises à jour': '버전 및 업데이트', '(navigateur)': '(브라우저)', '(bureau)': '(PC)',
  '· version lancée :': '· 실행 버전:', 'Pas encore vérifié.': '아직 확인하지 않았습니다.', 'Voir les versions sur GitHub': 'GitHub에서 버전 보기',
  'Tutoriel': '튜토리얼', 'Revoir la présentation du jeu.': '게임 소개를 다시 봅니다.', 'Revoir le tutoriel': '튜토리얼 다시 보기',
  'Zone de danger': '위험 구역', 'Efface toute la progression de cet appareil. Exporte ta partie avant.': '이 기기의 모든 진행 상황이 삭제됩니다. 먼저 데이터를 내보내세요.',
  'Réinitialiser la partie…': '게임 초기화…', 'Musique': '음악', 'Effets': '효과음', 'Couper le son': '음소거',
  "Nom d'utilisateur": '아이디', 'Mot de passe': '비밀번호', 'Confirmer le mot de passe': '비밀번호 확인', 'Se déconnecter': '로그아웃',
  'Changer de nom': '이름 변경', 'Supprimer mon compte': '계정 삭제', 'Synchroniser maintenant': '지금 동기화',
  "J'ai déjà un compte joueur": '이미 계정이 있어요', 'Créer mon compte joueur': '내 계정 만들기', 'Votre nom :': '내 이름:',
  'Connecté en tant que': '로그인 계정:', 'Sauvegarder en ligne sans compte': '계정 없이 온라인 저장',
  'Connexion au serveur en cours… La partie est sauvegardée sur cet appareil en attendant.': '서버에 연결 중… 그동안 이 기기에 저장됩니다.',
  "Pas encore de compte ? Choisis un nom d'utilisateur et un mot de passe (8 caractères min.), puis « Créer un compte joueur ».": '계정이 없나요? 아이디와 비밀번호(8자 이상)를 정한 뒤 「플레이어 계정 만들기」를 누르세요.',
  'Pas de sauvegarde en ligne pour le moment : la partie est sauvegardée sur cet appareil.': '지금은 온라인 저장이 없습니다. 이 기기에 저장됩니다.',
  'Déconnecté : la partie est sauvegardée seulement sur cet appareil.': '로그아웃됨: 이 기기에만 저장됩니다.',
  'Automatique toutes les 10 s, à chaque action et à la fermeture. Jeu fermé, le héros gagne encore 65 % de son rythme, 24 h au plus.': '10초마다, 행동할 때마다, 종료할 때 자동 저장. 게임을 꺼도 영웅은 최대 24시간 동안 65% 속도로 보상을 얻습니다.',
  'Garder la fenêtre au premier plan': '창을 항상 위에 표시', 'Position et taille mémorisées.': '위치와 크기를 기억합니다.',
  'Mini': '미니', 'Standard': '기본', 'Large': '넓게', 'Barre': '바', 'Vérification…': '확인 중…', 'À jour': '최신 버전',
  'Hors ligne': '오프라인', 'GitHub injoignable.': 'GitHub에 연결할 수 없습니다.', 'Téléchargement…': '다운로드 중…', 'Nouveautés': '새 소식',
  'Code de sauvegarde': '저장 코드', 'Animations': '애니메이션',
  // Tutoriel
  'Ton héros combat tout seul': '영웅은 알아서 싸워요', 'Que faire ? Suis ce bouton': '뭘 해야 할까요? 이 버튼을 따라가세요',
  "Il montre une seule chose à la fois : une récompense prête, un objet meilleur que l'équipé, un boss à retenter, sinon ton objectif. Un appui y mène.": '한 번에 하나만 알려 줘요: 받을 보상, 더 좋은 장비, 재도전할 보스, 아니면 다음 목표. 누르면 바로 이동해요.',
  "Les menus s'ouvrent avec la progression": '메뉴는 성장에 따라 열려요', 'Nouveaux menus': '새 메뉴', 'Les menus sont rangés autrement :': '메뉴 구성이 바뀌었어요:',
  '4 menus': '메뉴 4개', 'le portrait en haut à gauche': '왼쪽 위 초상화', 'Perdu ? Touche': '길을 잃었나요? 키',
  'pour chercher un écran, et le bouton sous le combat propose toujours la prochaine chose utile.': '로 화면을 찾고, 전투 아래 버튼은 언제나 다음 할 일을 알려 줘요.',
  // Mondes (zones)
  'Plaines verdoyantes': '푸른 평원', 'Forêt sombre': '어둠의 숲', 'Grottes de cristal': '수정 동굴', 'Désert brûlant': '불타는 사막',
  'Montagnes gelées': '얼어붙은 산맥', 'Terres maudites': '저주받은 땅', 'Marais putride': '썩은 늪', 'Îles célestes': '천공의 섬',
  'Cœur du volcan': '화산의 심장', 'Royaume du Néant': '공허의 왕국', "Trône de l'Abysse": '심연의 왕좌',
  // Compagnons et familiers
  'Slime doré': '황금 슬라임', 'Chat du château': '성의 고양이', 'Hibou érudit': '박식한 부엉이', 'Fée des bois': '숲의 요정',
  'Mini-golem': '미니 골렘', 'Feu follet': '도깨비불', 'Écuyer': '견습 기사', 'Mercenaire': '용병', 'Rôdeur': '레인저',
  'Pyromancienne': '화염술사', 'Prêtresse': '여사제', 'Lancier': '창병', 'Ombre': '그림자', 'Nain guerrier': '드워프 전사',
  "Paladin d'azur": '창공의 성기사', 'Lame rose': '장미검', 'Sorcière': '마녀', 'Archère elfe': '엘프 궁수', 'Grand prêtre': '대사제',
  'Ninja': '닌자', 'Barbare': '바바리안', 'Archange': '대천사', 'Reine démone': '마녀 여왕', 'Impératrice des glaces': '얼음 여제',
  "Seigneur de l'ombre": '그림자 군주', 'Gardienne sylvestre': '숲의 수호자',
  // Héros (apparences)
  'Chevalier': '기사', 'Paladin': '성기사', 'Chevalier de fortune': '행운의 기사', 'Chevalier dragon': '용기사',
  'Fée Lumibelle': '요정 루미벨', 'Valkyrie Sigrún': '발키리 시그룬', 'Sorcière Morgaline': '마녀 모르갈린', 'Comte Vladimir': '블라디미르 백작',
  'Kage le Ninja': '닌자 카게', 'Lilith la Diablesse': '악마 릴리스', 'Séraphin Auriel': '세라핌 아우리엘', 'Roi Grombar': '그롬바르 왕',
  'Reine des braises': '불씨의 여왕', 'Feu': '불', 'Enfer': '지옥', 'Brûle, et souviens-toi de mon nom.': '불타라, 그리고 내 이름을 기억해라.',
  // Classes
  'Mage de feu': '화염 마법사', 'Arbalétrier': '석궁병', 'Mage de foudre': '번개 마법사', 'Nécromancien': '네크로맨서',
  // Ennemis et boss les plus vus
  'Gluant': '슬라임', 'Gobelin': '고블린', 'Sanglier': '멧돼지', 'Mandragore': '맨드레이크', 'Loup': '늑대', 'Champignon': '버섯',
  'Squelette': '스켈레톤', 'Scorpion': '전갈', 'Momie': '미라', 'Squelette archer': '스켈레톤 궁수', 'Gobelin cuirassé': '중갑 고블린',
  'Roi Gluant': '슬라임 왕', 'Loup Alpha': '알파 늑대', 'Seigneur des Os': '뼈의 군주', 'Reine spectrale': '망령 여왕',
  'Dragon des cendres': '잿빛 드래곤', 'Chevalier déchu': '타락한 기사', 'Roi démoniaque': '마왕', 'Dryade pourrissante': '썩어가는 드라이어드',
  'Colosse de magma': '마그마 거신', 'Wyrm de givre': '서리 웜', "Tyran d'obsidienne": '흑요석 폭군', 'Gardien chacal': '자칼 수호자',
  'Crypte spectrale': '망령의 묘소', 'Sanctuaire sylvestre': '숲의 성소', 'Fournaise des sables': '모래 용광로', 'Glacier éternel': '영원의 빙하',
  'Citadelle des ombres': '그림자 성채',
  // Améliorations et compétences
  'Frappe rapide': '빠른 일격', 'Tourbillon': '회오리', 'Cri de guerre': '함성', 'Frappe sacrée': '신성한 일격',
  // Messages courants
  'Partie sauvegardée': '저장 완료', 'Nouveau record': '신기록', 'Serveur indisponible': '서버를 사용할 수 없습니다', 'Serveur injoignable.': '서버에 연결할 수 없습니다.',
  'Sac plein : recycle, range au coffre ou réglez le recyclage automatique (Réglages du sac).': '가방이 가득 찼어요: 분해하거나 창고에 보관하거나 자동 분해를 설정하세요(가방 설정).',
  // --- Lot 2 : synergies, hauts faits, défis, objets, compétences des compagnons ---
  'Mage protégé': '보호받는 마법사', 'Forteresse': '요새', 'Bénédiction': '축복', 'Embuscade': '매복', 'Pluie de feu': '불비',
  'Exécuteur': '처형자', 'Carnage': '학살', 'Rage contenue': '억눌린 분노', 'Avant-garde': '선봉', 'Lien arcanique': '비전의 고리',
  'Salve': '일제 사격', 'Cercle arcanique': '비전의 원', 'Pacte des ombres': '그림자의 계약', 'Chœur sacré': '성가대', 'Horde': '무리',
  'Mur de boucliers': '방패벽', 'Marque du chasseur': '사냥꾼의 표식', 'Lame-sort': '마검', 'Chasse sacrée': '성스러운 사냥', 'Rempart ardent': '불꽃 성벽',
  'Le héros compte comme Gardien.': '영웅은 수호자로 취급됩니다.', 'Instinct sauvage': '야생 본능', 'Morsure': '물어뜯기', 'Frénésie sauvage': '야생의 광란',
  'Premier sang': '첫 피', 'Faucheur': '사신', 'Fléau des monstres': '몬스터의 재앙', 'Apocalypse': '종말', 'Tueur de boss': '보스 사냥꾼',
  'Chasseur de légendes': '전설 사냥꾼', 'Terreur des trônes': '왕좌의 공포', 'Hors des plaines': '평원 너머로', 'Au cœur des ténèbres': '어둠의 심장으로',
  'Les mondes célestes': '천상의 세계', "Maître de l'Abysse": '심연의 지배자', 'Au-delà de tout': '모든 것의 너머', 'Aguerri': '숙련자', 'Vétéran': '베테랑',
  'Légende vivante': '살아있는 전설', 'Ramasseur': '수집가', 'Collectionneur': '컬렉터', 'Dragon du trésor': '보물 드래곤', 'Premier appel': '첫 소환',
  'Invocateur': '소환사', 'Maître des portails': '차원문의 지배자', 'Phénix': '불사조', 'Éternel retour': '영원회귀', 'Grimpeur': '등반가',
  'Cime des nuages': '구름 위 정상', "Gardien de l'Éternité": '영원의 수호자', 'Compagnie': '동료단', 'Légion': '군단', 'Ménagerie complète': '완전한 동물원',
  'Explorateur': '탐험가', 'Pilleur de cryptes': '묘소 도굴꾼', 'Seigneur des profondeurs': '심층의 군주', 'Homme de parole': '약속을 지키는 자',
  'Bourse pleine': '두둑한 지갑', 'Trésorier': '재무관', 'Roi Midas': '미다스 왕', 'Pilleur': '약탈자',
  'Ennemis vaincus': '처치한 적', 'Boss vaincus': '처치한 보스', 'Étape maximale': '최고 스테이지', 'Niveau du héros': '영웅 레벨',
  'Objets trouvés': '획득한 아이템', 'Invocations': '소환 횟수', 'Record de la Tour': '탑 최고 기록', 'Compagnons et familiers obtenus': '보유 동료·펫',
  'Donjons terminés': '클리어한 던전', 'Or gagné au total': '누적 획득 골드',
  '— tout ce que vous découvrez est répertorié ; chaque palier rapporte une récompense.': '— 발견한 모든 것이 기록되고, 단계마다 보상을 받아요.',
  'Peau de pierre': '돌 피부', 'Férocité': '흉포', 'Frénésie': '광란', 'Nuée': '대군', 'Sans soin': '회복 불가', 'Canon de verre': '유리 대포',
  'Géants': '거인', 'Rage': '분노', "Pluie d'or": '황금비', 'Or ×3': '골드 ×3', 'Un boss toutes les 3 vagues': '3웨이브마다 보스',
  'Les ennemis attaquent 30 % plus vite': '적의 공격 속도 30% 증가', 'Des ennemis deux fois plus nombreux': '적의 수 2배',
  'Ni régénération ni vol de vie': '재생과 흡혈 불가', 'Les boss enragent tout de suite': '보스가 즉시 분노',
  'Épée courte': '숏소드', 'Hache de guerre': '전투 도끼', 'Dague': '단검', 'Bassinet': '배서닛', 'Heaume de chevalier': '기사의 투구',
  'Tabard de croisé': '십자군 휘장', 'Harnois': '판금 갑옷', 'Massue': '곤봉', 'Marteau de guerre': '워해머', 'Lance': '랜스',
  'Bâton de mage': '마법사의 지팡이', 'Fouet': '채찍', 'Espadon': '양손검', 'Hallebarde': '할버드', 'Katar': '카타르', 'Arc court': '숏보우',
  'Arc long elfique': '엘프 장궁', 'Arbalète': '석궁', 'Arbalète lourde': '중석궁', 'Bâton des flammes': '화염 지팡이',
  'Baguette de foudre': '번개 완드', 'Sceptre des tempêtes': '폭풍의 홀', 'Faux': '낫', "Faucheuse d'âmes": '영혼 수확자',
  'Casque à cornes': '뿔 투구', 'Diadème': '티아라', 'Cuirasse de plates': '판금 흉갑', 'Robe de mage': '마법사 로브',
  'Griffure': '할퀴기', 'Piqué nocturne': '야간 급강하', 'Soin': '치유', 'Rempart': '성벽', 'Flamme': '불꽃', 'Taille vaillante': '용맹한 베기',
  'Coup de taille': '베기', 'Tir du rôdeur': '레인저의 사격', 'Gerbe de flammes': '화염 다발', "Prière de l'aube": '새벽의 기도', 'Percée': '돌파',
  'Lames jumelles': '쌍검', 'Hache tournoyante': '회전 도끼', 'Bouclier sacré': '신성한 방패', 'Valse des épines': '가시의 왈츠',
  'Orbe du néant': '공허의 구슬', 'Volée de flèches': '화살 세례', 'Rayon sacré': '신성한 빛줄기', 'Frappe éclair': '번개 일격', 'Fureur': '격노',
  'Jugement céleste': '천상의 심판', 'Brasier infernal': '지옥불', 'Tempête de givre': '서리 폭풍', 'Lame du néant': '공허의 칼날', 'Sève de vie': '생명의 수액',
  // Textes d'aide des onglets (« — … »)
  '— les fragments anciens achètent des talents permanents. La Renaissance s\'ouvre plus tard dans ce même onglet.': '— 고대 파편으로 영구 특성을 배워요. 환생은 나중에 이 탭에서 열려요.',
  '— une clé par tentative : de vrais combats de boss qui donnent fragments et équipement.': '— 도전마다 열쇠 1개: 파편과 장비를 주는 진짜 보스전이에요.',
  '— chaque boss vaincu laisse un pouvoir. Réaffronte-les pour leur butin et leur maîtrise.': '— 처치한 보스는 능력을 남겨요. 다시 싸워 전리품과 숙련도를 얻으세요.',
  '— vos compagnons combattent à vos côtés : deux compagnons et un familier.': '— 동료가 함께 싸워요: 동료 2명과 펫 1마리.',
  '— les gemmes invoquent des compagnons, des familiers et des apparences.': '— 보석으로 동료, 펫, 외형을 소환해요.',
  '— les compagnons hors de l\'équipe partent en mission, même jeu fermé, et rapportent des ressources.': '— 팀에 없는 동료는 게임을 꺼도 파견을 떠나 자원을 가져와요.',
  '— le Défi de la semaine (3 tentatives, sans clé) puis, plus loin, la Tour de l\'Éternité : chaque record rapporte des récompenses.': '— 주간 도전(3회, 열쇠 불필요), 더 나아가 영원의 탑: 기록마다 보상을 받아요.',
  '— tout ce qui est prêt à être récupéré, au même endroit (touche G).': '— 받을 수 있는 모든 보상을 한곳에서(G 키).',
  // Inventaire, aventure, divers
  'Attaques / s': '초당 공격', 'Le coffre est vide.': '창고가 비어 있습니다.', 'Rangement auto : activé': '자동 보관: 켜짐', 'Rangement auto : désactivé': '자동 보관: 꺼짐',
  'Vide : équipe-toi puis « Enregistrer ».': '비어 있음: 장비를 착용한 뒤 「저장」하세요.', 'Le coffre garde 300 objets de plus que le sac,': '창고에는 가방보다 300개 더 보관되며,',
  'jamais recyclés ni fusionnés': '분해·합성되지 않아요', '. Les pièces d\'ensemble meilleures y vont d\'elles-mêmes.': '. 더 좋은 세트 아이템은 자동으로 들어가요.',
  'Une élite errante approche !': '떠도는 엘리트가 다가와요!', 'Quatre salles hantées, puis la Reine spectrale.': '유령이 깃든 방 4개, 그리고 망령 여왕.',
  'Normal : termine ce donjon en Facile.': '보통: 쉬움 난이도를 먼저 클리어하세요.', 'Invocatrice': '소환사', 'tout': '전체',
  'Un compagnon Légendaire est adapté à ce donjon…': '이 던전에 맞는 전설 동료가 있어요…',
  "Avec lui dans l'équipe, il écrase tout ici. Son nom est révélé après une victoire dans ce donjon.": '팀에 있으면 이곳을 휩쓸어요. 이름은 이 던전에서 승리하면 공개돼요.',
  'Enregistrer une équipe avec son équipement : Héros › Équipement › Builds.': '팀과 장비를 함께 저장: 영웅 › 장비 › 빌드.',
  'Jours de connexion : 1. Un jour manqué ne remet pas le calendrier à zéro.': '출석 일수: 1. 하루 빠져도 달력은 초기화되지 않아요.',
  'Récompense : une pièce Épique ou mieux de l\'ensemble': '보상: 세트의 영웅 등급 이상 장비 1개', 'Panoplie du Pré': '초원 세트',
  'et 60 gemmes. Nouvelle prime chaque jour.': '와 보석 60개. 현상금은 매일 바뀌어요.', 'Trouver 3 objets Rares ou mieux': '희귀 이상 아이템 3개 획득',
  'Récupérer 20 objets': '아이템 20개 획득', 'Portrait du héros › Classe': '영웅 초상화 › 클래스', 'Contre': '상성', 'Massacre': '대학살',
  'Midas': '미다스', 'Âme de la meute': '무리의 영혼', 'Maître des runes': '룬의 대가', 'Colosse': '거신', 'Puissance': '전투력',
  'Chasse': '사냥', 'Fortune': '행운', 'Héritage': '유산', 'Arcanes': '비전', 'Endurance': '인내', 'Cœur': '심장', 'Trouver un écran…': '화면 찾기…',
  "Carte, Donjons (et le Défi), Défis (l'ancienne Tour), Boss, Monde :": '지도, 던전(도전 포함), 도전(예전 탑), 보스, 월드:',
  'Missions (avec À récupérer, aussi touche N), Collections (et le Musée), Classement, Statistiques :': '미션(받을 보상 포함, N 키), 컬렉션(박물관 포함), 랭킹, 통계:',
  'Votre fiche, la classe, l\'apparence et les records :': '내 정보, 클래스, 외형, 기록:',
  'Apparaître dans le classement public (nom, niveau, étape, boss)': '공개 랭킹에 표시 (이름, 레벨, 스테이지, 보스)',
  'La partie est sauvegardée sur le serveur automatiquement (toutes les minutes et à la fermeture).': '게임은 서버에 자동 저장돼요 (1분마다, 종료할 때).',
  'Version :': '버전:', '(site). Le jeu du site est toujours à la dernière version.': '(사이트). 사이트 게임은 항상 최신 버전이에요.',
  // v9.1.8 : Objectifs › Classement, amis et Statistiques (venus de la 9.1.5–9.1.7).
  'Classement': '랭킹', 'Statistiques': '통계', 'Étape': '스테이지', 'Niveau': '레벨', 'Ennemis': '처치 수', 'Or gagné': '획득 골드',
  'Étage': '층', 'Renaiss.': '환생', 'Temps de jeu': '플레이 시간', 'Temps': '시간', 'Renaissance éclair': '최단 환생',
  'Transcendance éclair': '최단 초월', 'Durée': '소요 시간', 'Course aux mondes': '월드 레이스', 'Atteint en': '도달 시간', 'Joueur': '플레이어',
  '(vous)': '(나)', 'Chargement des amis…': '친구 불러오는 중…', 'Demandes reçues': '받은 요청', 'Accepter': '수락', 'Refuser': '거절',
  'Annuler la demande': '요청 취소', 'Retirer de mes amis': '친구 삭제', "Pas encore d'amis : ajoute un joueur par son nom.": '아직 친구가 없어요. 이름으로 플레이어를 추가하세요.',
  'Mes amis': '내 친구', 'Nom du joueur': '플레이어 이름', 'Nom du joueur à ajouter': '추가할 플레이어 이름', 'Ajouter': '추가',
  "Tu n'es pas connecté.": '로그인하지 않았어요.', 'Crée ton compte pour apparaître au classement, voir ton rang et ajouter des amis.': '계정을 만들면 랭킹에 표시되고, 내 순위를 보고, 친구를 추가할 수 있어요.',
  'Créer mon compte': '계정 만들기', 'Tout le monde': '전체', 'Crée votre compte pour ajouter des amis': '친구를 추가하려면 계정을 만드세요',
  'Temps pour atteindre le monde': '월드 도달 시간', 'Monde à atteindre': '도달할 월드', 'Le plus court gagne.': '가장 짧은 기록이 승리해요.',
  'Réessayer': '다시 시도', 'Chargement du classement…': '랭킹 불러오는 중…', 'Ajoute des amis pour te comparer à eux.': '친구를 추가해 기록을 비교해 보세요.',
  "Personne au classement pour l'instant.": '아직 랭킹에 아무도 없어요.', 'Campagne': '캠페인',
  'Nombre': '횟수', 'En cours depuis': '진행 시간', 'La plus rapide': '최단 기록', 'Moyenne': '평균', 'La dernière': '최근 기록', 'Durée des dernières': '최근 소요 시간',
  'Filtrer par monde': '월드별 필터', 'Tous les mondes': '모든 월드', 'Pas encore atteint': '아직 도달하지 않음', 'Avant la 9.1.7': '9.1.7 이전',
  'avant la 9.1.7': '9.1.7 이전', 'Dès le début': '처음부터', 'Temps passé': '보낸 시간', 'Atteint pour la première fois': '첫 도달',
  'Cycles joués': '플레이한 주기', 'Temps par cycle': '주기별 시간', 'normal': '보통', 'Temps de jeu actif': '실제 플레이 시간',
  'Hors jeu (récompenses au retour)': '오프라인 (복귀 보상)', 'Séance en cours': '현재 세션', 'Plus longue séance': '최장 세션',
  'Lancements du jeu': '게임 실행 횟수', 'Séance moyenne': '평균 세션', 'Par activité': '활동별', 'Par monde': '월드별',
  '(touche un monde pour le détail)': '(월드를 누르면 상세 보기)', 'Par cycle de difficulté': '난이도 주기별', 'Premier passage dans chaque monde': '월드별 첫 도달',
};

// --- Motifs ---------------------------------------------------------------------------------------

const NUM = NUM_919; // v9.1.9 : grands nombres « 232,3 ai » compris
const rx = (src) => new RegExp(src.replaceAll('#', NUM));
// Traduit une capture (nom propre, libellé…) ; null si inconnue, pour laisser la main au motif suivant.
const tr = (s) => lookup(s);
const trOr = (s) => lookup(s) ?? s;

// Statistiques des bonus « +10 % PV max » → « 최대 HP +10% ».
const STATS = {
  'PV max': '최대 HP', 'dégâts': '공격력', 'de coup critique': '치명타 확률', 'coup critique': '치명타 확률', 'armure': '방어력',
  "vitesse d'attaque": '공격 속도', 'or': '골드', 'dégâts/s': '초당 피해', 'dégâts contre les boss': '보스 대상 피해',
  'dégâts contre les ennemis ordinaires': '일반 몬스터 대상 피해', 'PV/s': '초당 HP 회복', 'recharge des compétences': '스킬 쿨타임',
  'de chance de butin': '획득 확률', 'pts de chance de butin': '획득 확률', 'XP': '경험치', 'gemmes': '보석', 'éclats': '조각',
};
// Durées : « 4 h 05 min » → « 4시간 05분 ».
const dur = (s) => String(s).replace(/(\d+) j\b/g, '$1일').replace(/(\d+) h\b/g, '$1시간').replace(/(\d+) min\b/g, '$1분').replace(/(\d+) s\b/g, '$1초');

export const PATTERNS = [
  [rx('^Niv\\. #$'), 'Lv.$1'], [rx('^niv\\. #$'), 'Lv.$1'], [rx('^Niv\\. #/#$'), 'Lv.$1/$2'], [rx('^niv\\. #/#$'), 'Lv.$1/$2'],
  [rx('^· niv\\. #$'), '· Lv.$1'], [rx('^· niv\\. #/#$'), '· Lv.$1/$2'], [rx('^Niv\\. # ▶ #$'), 'Lv.$1 ▶ $2'],
  [rx('^niv\\. # · #★$'), 'Lv.$1 · $2★'],
  [rx('^Ennemis vaincus #/#$'), '처치한 적 $1/$2'], [rx('^Tout récupérer \\(#\\)$'), '모두 받기 ($1)'],
  [rx('^Sac #/#$'), '가방 $1/$2'], [rx('^Coffre #/#$'), '창고 $1/$2'], [rx('^Monde # · (\\d+-\\d+)$'), '월드 $1 · $2'],
  [rx('^Monde #$'), '월드 $1'], [rx('^Étape max (\\d+-\\d+)$'), '최고 스테이지 $1'], [/^Étape (\d+-\d+) requise$/, '스테이지 $1 필요'],
  [rx('^# dégâts/s$'), '초당 피해 $1'], [rx('^Recycler \\+#$'), '분해 +$1'], [rx('^Doublons #/#$'), '중복 $1/$2'],
  [rx('^Palier #/#$'), '단계 $1/$2'], [rx('^Équipe #/#$'), '팀 $1/$2'], [rx('^Salle #$'), '$1번 방'], [rx('^Pouvoirs actifs #/#$'), '활성 능력 $1/$2'],
  [rx('^# pts → # pts$'), '$1 → $2'], [rx('^\\+# pts ▲$'), '+$1 ▲'], [rx('^# pts?$'), '$1포인트'],
  [rx('^Compétences de familier \\(#\\)$'), '펫 스킬 ($1)'], [rx('^Aujourd\'hui \\(#\\)$'), '오늘 ($1)'], [rx('^Hauts faits \\(#\\)$'), '업적 ($1)'],
  [rx('^Défi de la semaine \\(#\\)$'), '주간 도전 ($1)'], [rx('^Verrouillés \\(#\\)$'), '잠김 ($1)'], [rx('^\\(# en stock\\)$'), '(보유 $1)'],
  [rx('^toutes les # s$'), '$1초마다'], [rx('^Ultime à # doublons$'), '중복 $1회 시 궁극기'],
  [/^Dernière sauvegarde : il y a (.+)$/, (m) => `마지막 저장: ${dur(m[1])} 전`],
  [/^Réinitialisation à minuit · dans (.+)$/, (m) => `자정 초기화 · ${dur(m[1])} 남음`],
  [rx('^Encyclopédie complétée à # %$'), (m) => `도감 완성도 ${num(m[1])}%`],
  [/^Prime du jour : (.+)$/, (m) => `오늘의 현상금: ${trOr(m[1])}`],
  [/^Boss : (.+)$/, (m) => `보스: ${trOr(m[1])}`],
  [/^Se rencontre : (.+)\. Vaincs-le pour le découvrir\.$/, (m) => `출현: ${trOr(m[1])}. 처치하면 도감에 등록됩니다.`],
  [/^★ (?:En vedette|Mis en avant) : (.+)$/, (m) => `★ 픽업: ${trOr(m[1])}`],
  [rx('^— # % des Légendaires obtenus · change chaque lundi$'), '— 전설 획득의 $1% · 매주 월요일 교체'],
  [rx('^# % des Légendaires obtenus · change chaque lundi$'), '전설 획득의 $1% · 매주 월요일 교체'],
  [/^« (.+) »$/, (m) => { const r = tr(m[1]); return r === null ? null : `「${r}」`; }],
  [rx('^# victoires?$'), '$1승'], [rx('^# vaincus$'), '$1 처치'], [rx('^#/# vaincus$'), '$1/$2 처치'],
  [/^(\d+)\. (.+)$/, (m) => { const r = tr(m[2]); return r === null ? null : `${m[1]}. ${r}`; }],
  // « Désert brûlant 4-14 », « Slime doré 0★ »
  [/^(.+) (\d+-\d+)$/, (m) => { const r = tr(m[1]); return r === null ? null : `${r} ${m[2]}`; }],
  [/^(.+) (\d)★$/, (m) => { const r = tr(m[1]); return r === null ? null : `${r} ${m[2]}★`; }],
  // Paliers des hauts faits : « Étape maximale · palier 1/5 »
  [/^palier (\d+\/\d+)$/, '단계 $1'],
  // Bonus : « +10 % PV max », « vol de vie 2 % », « ×1,19 or »
  [rx('^# % (.+)$'), (m) => (STATS[m[2]] ? `${STATS[m[2]]} ${num(m[1])}%` : null)],
  [rx('^# (pts de chance de butin)$'), (m) => `${STATS[m[2]]} +${num(m[1]).replace(/^\+/, '')}`],
  [rx('^vol de vie # %$'), (m) => `흡혈 ${num(m[1])}%`],
  [rx('^(or|dégâts|PV max) ×#$'), (m) => `${STATS[m[1]]} ×${num(m[2])}`],
  [rx('^×# niv\\. #$'), (m) => `×${num(m[1])} Lv.${m[2]}`],
  [rx('^\\+# % dégâts/s$'), (m) => `초당 피해 +${num(m[1])}%`],
  [rx('^Fait tomber l\'or de # ennemis$'), '적 $1명에게서 골드 획득'],
  [rx('^Frappe tous les ennemis \\(# % des dégâts\\)$'), (m) => `모든 적 공격 (공격력의 ${num(m[1])}%)`],
  [rx('^Frappe à # % des dégâts du héros$'), (m) => `영웅 공격력의 ${num(m[1])}%로 공격`],
  [rx('^\\+# % dégâts pendant # s$'), (m) => `${m[2]}초 동안 공격력 +${num(m[1])}%`],
  [/^Vaincre (\d+) monstres$/, '몬스터 $1마리 처치'], [/^Vaincre (\d+) boss$/, '보스 $1마리 처치'],
  [/^Recycler (\d+) objets$/, '아이템 $1개 분해'], [/^Faire (\d+) invocations$/, '소환 $1회'],
  [/^Débloqué au niv\. (\d+)$/, 'Lv.$1에 해금'],
  // --- Lot 2 ---
  [/^Arme de (.+)$/, (m) => `${trOr(m[1])} 무기`],
  [/^Change de classe pour la porter : (.+)\.$/, (m) => `착용하려면 클래스를 바꾸세요: ${trOr(m[1])}.`],
  [/^Si tu l'équipes \(à la place de (.+)\)$/, (m) => `장착 시 (${trOr(m[1])} 대신)`],
  [/^(.+) · palier (\d+\/\d+)$/, (m) => { const r = tr(m[1]); return r === null ? null : `${r} · ${m[2]}단계`; }],
  [/^→ (.+) : (\d+) points$/, (m) => `→ ${trOr(m[1])}: ${m[2]}포인트`],
  [/^(.+) · niv\. (\d+)\/(\d+)$/, (m) => { const r = tr(m[1]); return r === null ? null : `${r} · Lv.${m[2]}/${m[3]}`; }],
  [/^\/(\d+) talents · (\d+)$/, '/$1 특성 · $2'], [/^· (\d+) encore cachés$/, '· 숨겨진 특성 $1'],
  [/^(\d+) effectuées?$/, '$1회 완료'], [/^Renaître \(\+(\d+)$/, '환생 (+$1'],
  [/^Étape (\d+) \/ (\d+) · prochain boss dans (\d+) étapes? :$/, '스테이지 $1 / $2 · 보스까지 $3스테이지:'],
  [/^📍 (.+) · étape (\d+-\d+)$/, (m) => `📍 ${trOr(m[1])} · 스테이지 ${m[2]}`],
  [/^♛ (\d+) victoires? · ennemis niv\. (\d+) · PV ×(.+)$/, (m) => `♛ ${m[1]}승 · 적 Lv.${m[2]} · HP ×${num(m[3])}`],
  [/^: fait surgir (\d+) serviteurs toutes les (\d+) s, qui se placent devant elle\.$/, ': $2초마다 하수인 $1마리를 앞에 소환합니다.'],
  [/^Contre : (.+)$/, (m) => `상성: ${trOr(m[1])}`], [/^Dégâts de zone, perçants ou en chaîne$/, '광역·관통·연쇄 피해'],
  [/^Butin : (.+) · Chemin : (.+)$/, (m) => `전리품: ${trOr(m[1])} · 경로: ${trOr(m[2])}`],
  [rx('^# fragments anciens$'), '고대 파편 $1'], [rx('^# gemmes$'), '보석 $1'], [rx('^# éclats$'), '조각 $1'], [rx('^\\+# gemmes$'), '보석 +$1'],
  [/^Monter \((\d+) ascensions? cette semaine\)$/, '오르기 (이번 주 $1회)'], [/^Lancer le défi \((\d+) tentatives? cette semaine\)$/, '도전 시작 (이번 주 $1회)'],
  [/^· (.+)$/, (m) => { const r = tr(m[1]); return r === null ? null : `· ${r}`; }],
  [/^Maîtrise : (\d+) couronnes? sur (\d+) · (\d+)\/(\d+) boss découverts · (\d+) pouvoirs actifs à la fois\.$/, '숙련: 왕관 $1/$2 · 발견한 보스 $3/$4 · 동시 활성 능력 $5개.'],
  [/^Élite vaincue : \+(\d+) gemmes$/, '엘리트 처치: 보석 +$1'],
  [/^(\d+) \/ (\d+) paliers · bonus permanent \+(\d+) % dégâts et \+(\d+) % or \(\+1 % chacun par palier\)$/, '$1 / $2단계 · 영구 보너스 공격력 +$3% · 골드 +$4% (단계마다 각 +1%)'],
  [/^Entrer · (.+) — (\d+)$/, (m) => `입장 · ${trOr(m[1])} — ${m[2]}`],
  [/^Des vagues de (\d+) ennemis toujours plus forts \((\d+) s par vague\), un boss toutes les (\d+) vagues \(sauf règle contraire\)\. Une défaite termine la tentative\.?(.*)$/, (m) => `점점 강해지는 적 $1명씩 몰려오는 웨이브(웨이브당 $2초), $3웨이브마다 보스(규칙이 다르면 예외). 패배하면 도전이 끝나요.`.replace('$1', m[1]).replace('$2', m[2]).replace('$3', m[3]) + (m[4] ? ` ${trOr(m[4].trim())}` : '')],
  [/^⚔ Prochain boss \(étape ([\d-]+)\) : pas encore — il lui resterait$/, '⚔ 다음 보스 (스테이지 $1): 아직 — 남는 HP'],
  [/^de PV\. Améliore Dégâts \/ PV, l'équipement ou l'équipe\.$/, '. 공격력/HP, 장비, 팀을 강화하세요.'],
  // v9.1.8 : classement et statistiques
  [/^Synchronisé à (.+)$/, '$1 동기화됨'],
  [/^niv\. (\d[\d\s.,]*)$/, 'Lv.$1'],
  [/^(.+) · niv\. (\d[\d\s.,]*)$/, (m) => `${trOr(m[1])} · Lv.${m[2]}`],
  [/^(\d+) demandes?$/, '요청 $1개'],
  [/^Mes amis \((\d+)\)$/, '내 친구 ($1)'],
  [/^En attente : (.*)$/, '대기 중: $1'],
  [/^Tu joues en invité \((.+)\)\.$/, '게스트로 플레이 중이에요 ($1).'],
  [/^sur les (\d+) dernières$/, '최근 $1회 기준'],
  [/^(\d+ %) de la campagne$/, '캠페인의 $1'],
  [/^après (.+) de jeu$/, (m) => `플레이 ${dur(m[1])} 후`],
  [/^Monde$/, '월드'],
  // Durées seules
  [/^\d+ (?:h|min|s|j)(?: \d+(?: min| s)?)?$/, (m) => dur(m[0])],
];

// v9.1.9 : textes complétés (./ko-919.js), placés avant les motifs plus généraux.
Object.assign(EXACT, EXACT_919);
Object.assign(EXACT, EXACT_920_OCEAN); // v9.2.0 (monde marin) : Royaume englouti
PATTERNS.unshift(...PATTERNS_919);

const engine = createTranslator(EXACT, PATTERNS);
export const lookup = engine.lookup;
setKoLookup(lookup);
export const translate = (s) => engine.translate(s);

// v9.1.9 (apparences, alerte de boss) : textes nouveaux.
Object.assign(EXACT, {
  '⚠ DANGER': '⚠ 위험', '⚠ BOSS': '⚠ 보스', 'Boss du donjon': '던전 보스', 'Boss de la Tour': '탑 보스', 'Mini-boss': '미니 보스',
  'Boss redoutable': '강력한 보스', 'MÉGA BOSS': '메가 보스',
  '✦ Nouvelle apparence débloquée ! ✦': '✦ 새 외형 해금! ✦', 'Porter maintenant': '지금 착용', 'Plus tard': '나중에', 'Suivante ›': '다음 ›',
  'Portée ✓': '착용 중 ✓', 'aucun doublon': '중복 없음',
});
PATTERNS.push(
  [/^Mes apparences \((\d+)\) ›$/, '내 외형 ($1) ›'],
);

// v9.2.0 : nouvelles améliorations (./ko-920-upg.js).
Object.assign(EXACT, EXACT_920_UPG);
PATTERNS.unshift(...patterns920Upg(lookup));

// v9.2.1 : malus d'environnement (./ko-921.js).
Object.assign(EXACT, EXACT_921);
PATTERNS.unshift(...patterns921(lookup));

// v9.2.2 : sous-onglet Héros › Apparences (./ko-922.js).
Object.assign(EXACT, EXACT_922);
PATTERNS.unshift(...patterns922(lookup));

// v9.2.3 : ennemis mutés lisibles (./ko-923.js).
Object.assign(EXACT, EXACT_923);
PATTERNS.unshift(...patterns923(lookup));

// v9.2.5 : vitrine d'invocation, « Tout récupérer » qui dit où (./ko-925.js).
Object.assign(EXACT, EXACT_925);
PATTERNS.unshift(...patterns925(lookup));
// v9.2.6 : effets de l'interface (./ko-926.js).
Object.assign(EXACT, EXACT_926);
PATTERNS.unshift(...patterns926(lookup));
// v9.2.7 : arbre de talents refait (./ko-927.js).
Object.assign(EXACT, EXACT_927);
PATTERNS.unshift(...patterns927(lookup));
// v9.2.7 : vitrine animée des fiches (./ko-927-vitrine.js).
Object.assign(EXACT, EXACT_927_SHOWCASE);
// v9.2.8 : Défense, Double attaque, fiche de stats (./ko-928.js).
Object.assign(EXACT, EXACT_928);
PATTERNS.unshift(...patterns928(lookup));
// v9.2.8 : économie — bannières, boutique, cosmétiques, événements (./ko-928-eco.js).
for (const [k, v] of Object.entries(EXACT_928_ECO)) if (!Object.hasOwn(EXACT, k)) EXACT[k] = v; // sans écraser l'existant
PATTERNS.unshift(...patterns928Eco(lookup));
// v9.2.9 : boutique en haut, World Boss en vrai combat (./ko-929.js) — sans écraser l'existant.
for (const [k, v] of Object.entries(EXACT_929)) if (!Object.hasOwn(EXACT, k)) EXACT[k] = v;
PATTERNS.unshift(...patterns929(lookup));
// v9.2.9 : textes relevés par la passe de stabilité (./ko-929-stab.js) — sans écraser l'existant.
import { EXACT_929_STAB, patterns929Stab } from './ko-929-stab.js';
for (const [k, v] of Object.entries(EXACT_929_STAB)) if (!Object.hasOwn(EXACT, k)) EXACT[k] = v;
PATTERNS.unshift(...patterns929Stab(lookup));
// v9.3.0 : attaques du Colosse du World Boss (./ko-930.js) — sans écraser l'existant.
import { EXACT_930 } from './ko-930.js';
for (const [k, v] of Object.entries(EXACT_930)) if (!Object.hasOwn(EXACT, k)) EXACT[k] = v;
// v9.3.2 / v9.3.3 : Arène, Guilde, Boss commun, affinités, armes, compétences, ressources, équipement (./ko-932.js).
import { EXACT_932, patterns932 } from './ko-932.js';
for (const [k, v] of Object.entries(EXACT_932)) if (!Object.hasOwn(EXACT, k)) EXACT[k] = v;
PATTERNS.push(...patterns932(lookup)); // en dernier : les motifs existants (dates, etc.) gardent la priorité
// v9.3.4 : refonte de l'interface (./ko-934.js).
import { EXACT_934, patterns934 } from './ko-934.js';
for (const [k, v] of Object.entries(EXACT_934)) if (!Object.hasOwn(EXACT, k)) EXACT[k] = v;
PATTERNS.push(...patterns934(lookup));
// v9.7.1 : cadrage, sac de butin, menus allégés (./ko-971.js).
import { EXACT_971, patterns971 } from './ko-971.js';
for (const [k, v] of Object.entries(EXACT_971)) if (!Object.hasOwn(EXACT, k)) EXACT[k] = v;
PATTERNS.push(...patterns971(lookup));
// v10.3 (audit des parties 0 à 7) : Réserve, onglet Arène, dos de carte doré (./ko-103-audit.js). Motifs placés en tête :
// « Tri : … » et « … en attente … » existent déjà avec l'ancien mot « coffre ».
import { EXACT_103A, patterns103a } from './ko-103-audit.js';
for (const [k, v] of Object.entries(EXACT_103A)) if (!Object.hasOwn(EXACT, k)) EXACT[k] = v;
PATTERNS.unshift(...patterns103a(lookup));
// v10.3 (parties 8 et 9) : Équipement et Forge (./ko-103-equip.js) — sans écraser l'existant.
import { EXACT_103_EQUIP, patterns103Equip } from './ko-103-equip.js';
for (const [k, v] of Object.entries(EXACT_103_EQUIP)) if (!Object.hasOwn(EXACT, k)) EXACT[k] = v;
PATTERNS.unshift(...patterns103Equip(lookup)); // en tête : ces motifs sont précis et passent avant les règles générales (« Il manque … »)
// v10.3 (partie 10) : le Bastion (./ko-103-bastion.js).
import { EXACT_103_BASTION, patterns103Bastion } from './ko-103-bastion.js';
for (const [k, v] of Object.entries(EXACT_103_BASTION)) if (!Object.hasOwn(EXACT, k)) EXACT[k] = v;
PATTERNS.push(...patterns103Bastion(lookup));
// v10.3.1 : feuille de donjon (./ko-1031-dungeons.js).
import { EXACT_1031 as EXACT_1031_DUNGEONS } from './ko-1031-dungeons.js';
for (const [k, v] of Object.entries(EXACT_1031_DUNGEONS)) if (!Object.hasOwn(EXACT, k)) EXACT[k] = v;
// v10.3.1 : finitions — lexique du Bastion, ligne « maintenant » de la Forge (./ko-1031-finitions.js).
import { EXACT_1031, patterns1031 } from './ko-1031-finitions.js';
for (const [k, v] of Object.entries(EXACT_1031)) if (!Object.hasOwn(EXACT, k)) EXACT[k] = v;
PATTERNS.push(...patterns1031(lookup));
// v10.3.1 : Arène jouée sur la carte, fin de la partie 6 (./ko-1031-arena.js) — sans écraser l'existant.
import { EXACT_1031 as EXACT_1031_ARENA, patterns1031 as patterns1031Arena } from './ko-1031-arena.js';
for (const [k, v] of Object.entries(EXACT_1031_ARENA)) if (!Object.hasOwn(EXACT, k)) EXACT[k] = v;
PATTERNS.unshift(...patterns1031Arena(lookup));
// v10.3.1 (partie 7) : coffre de butin dessiné dans la scène (./ko-1031-chest.js).
import { EXACT_1031_CHEST, patterns1031Chest } from './ko-1031-chest.js';
for (const [k, v] of Object.entries(EXACT_1031_CHEST)) if (!Object.hasOwn(EXACT, k)) EXACT[k] = v;
PATTERNS.unshift(...patterns1031Chest());
// v10.4 (partie 3) : étiquettes de type d'effet des compétences (./ko-1040-skills.js).
import { EXACT_1040_SKILLS, patterns1040Skills } from './ko-1040-skills.js';
for (const [k, v] of Object.entries(EXACT_1040_SKILLS)) if (!Object.hasOwn(EXACT, k)) EXACT[k] = v;
PATTERNS.unshift(...patterns1040Skills());
// v10.4 (partie 7) : libellés du Sceau en mots du joueur (./ko-1040-defauts.js).
import { EXACT_1040_DEFAUTS, patterns1040Defauts } from './ko-1040-defauts.js';
for (const [k, v] of Object.entries(EXACT_1040_DEFAUTS)) if (!Object.hasOwn(EXACT, k)) EXACT[k] = v;
PATTERNS.unshift(...patterns1040Defauts(lookup));
// v10.4 (partie 5) : bulles de rareté du coffre de butin (./ko-1040-chest.js).
import { EXACT_1040_CHEST, patterns1040Chest } from './ko-1040-chest.js';
for (const [k, v] of Object.entries(EXACT_1040_CHEST)) if (!Object.hasOwn(EXACT, k)) EXACT[k] = v;
PATTERNS.unshift(...patterns1040Chest());
// v10.4 (parties 1 et 2) : pages plein écran Personnage et Forge, gain réel des renforts (./ko-1040-pages.js).
import { EXACT_1040_PAGES, patterns1040Pages } from './ko-1040-pages.js';
for (const [k, v] of Object.entries(EXACT_1040_PAGES)) if (!Object.hasOwn(EXACT, k)) EXACT[k] = v;
PATTERNS.push(...patterns1040Pages(lookup));
// v10.4 (partie 4) : liste en bannières et page du donjon (./ko-1040-dungeons.js).
import { EXACT_1040_DUNGEONS, patterns1040Dungeons } from './ko-1040-dungeons.js';
for (const [k, v] of Object.entries(EXACT_1040_DUNGEONS)) if (!Object.hasOwn(EXACT, k)) EXACT[k] = v;
PATTERNS.unshift(...patterns1040Dungeons(lookup));
// v10.4 (partie 6) : le Bastion en page, démarrage, tour, « Pendant ton absence » (./ko-1040-bastion.js).
import { EXACT_1040_BASTION, patterns1040Bastion } from './ko-1040-bastion.js';
for (const [k, v] of Object.entries(EXACT_1040_BASTION)) if (!Object.hasOwn(EXACT, k)) EXACT[k] = v;
PATTERNS.unshift(...patterns1040Bastion(lookup)); // en tête : « Nain guerrier, forgeron : +25 % » avant les motifs plus larges
