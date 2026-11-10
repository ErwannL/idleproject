# Ascendrya 9.3.8 — suite de la refonte (prompt « 2.3.6 »)

## 1. Comment ça marchait (avant 9.3.8)

- **Combat** (`core/combat.js`) : un ennemi apparaissait toutes les 1,4 s (au plus 3 vivants) loin à droite et marchait
  vers le héros ; les compagnons tiraient à « portée + 20 » et les compétences de zone touchaient tout : les monstres
  mouraient souvent avant d'arriver, le héros marchait 70 à 90 % du temps (1,3 ennemi vivant en moyenne).
- **Barre jaune** (`core/guide.js`) : « N points de compétence » ouvrait Compétences, où la case choisie pouvait être
  un Boost payé en or : la barre restait bloquée.
- **Tutoriel** (`ui/tutorial.js`) : bulle large posée sous sa cible (elle cachait le bouton suivant).
- **Équipement** : héros et compagnons en 3 places (9.3.4) ; familiers équipables (classe « Familier »).
- **Missions** : Jour + Piste du mois (les hebdomadaires y avaient été fondues en 9.1.3) ; Marchands et Prime dans
  les Quêtes.

## 2. Ce qui a été fait (dans l'ordre du prompt)

| Étape | Contenu |
|---|---|
| a | Points de compétence : la barre les dépense d'un clic ; « Répartir les points » ; la case choisie par défaut est une Attaque abordable, jamais un Boost. Bulle du tutoriel posée à côté de sa cible, fermée pour de bon par « OK ». Garanties d'invocation lues dans les données (100 / 60). Recyclage automatique des objets inutiles (réglable). |
| b | Vagues de 3 monstres groupés sur une ligne de combat ; personne ne touche avant la ligne (`canHit`) ; le héros se met en garde pendant la charge ; plancher de PV auto-réglé (une vague ≈ 3 s, dégâts réduits d'autant : même danger) ; durée minimale d'une vague = ancien rythme (même or/XP par minute). « Vague 3/5 », pluie d'or en fin d'étape. |
| c | Familiers : plus d'équipement (classe « Familier » supprimée, anciens objets → classe du héros, rendus au sac), un bonus passif d'une seule stat, une compétence active (dégâts ≥ avant, 10 % de marge). |
| d | Écran Équipement : grands portraits (72 px, niveau, puissance), personnage en grand dessiné comme en combat, places autour, sac filtré par défaut. Héros à 6 places (migration v13 : pièces réunies rendues en objets complets). |
| e | Quêtes : Jour · Semaine · Mois · Hauts faits, grande barre + coffre animé, cartes (terminées en bas, grisées). Semaine : 600 gemmes/semaine retirées de la Piste (×0,74) — économie inchangée. Marchands → Boutique (niveau de l'étape max), Prime → Carte (monde actuel). |
| f | Bouton Combat retiré ; fermeture : croix, Échap, toucher la scène ; icônes du menu plus grandes. |
| g | Améliorations : « Puissance +N » sur chaque ligne, flèche verte sur la meilleure affaire ; « Armure » → « Peau de fer » (icône différente). Butin de donjon en icônes. |
| h | Prochain déblocage sous la scène ; grands moments en plein écran (nouveau monde, nouveau menu, premier Légendaire, premier donjon) ; compte à rebours rouge jusqu'à la rage des boss ; combo au toucher ; coffre de fin d'étape (0,75 ennemi d'or) ; « Tout récupérer ×2 » une fois par jour ; cadeau du jour à l'ouverture. Renaissance proposée aussi après 10 min sans record. |

**Compte à rebours des boss** : le prompt propose 30 s. Les boss enragent déjà à 60 s et l'équilibrage repose sur ce
seuil : une limite stricte à 30 s aurait bloqué une grande partie des joueurs à leur niveau actuel. Le compte à
rebours affiché va donc jusqu'à la rage (60 s) : même tension, aucun changement d'équilibrage. À trancher si tu veux
un vrai 30 s (il faudrait baisser les PV des boss).

## 3. Mesures

`tools/measure-waves-v938.mjs` (puissance fixe) — morts par minute et or par minute à ±5 % de l'ancien rythme pour
toutes les puissances testées.

`tools/sim-guide-v935.mjs` (nouvelle partie, uniquement la barre jaune, vitesse ×1, 3 parties) :

| | Avant (9.3.7) | 9.3.8 |
|---|---|---|
| Héros au combat | 22 à 32 % | 60 à 62 % |
| 2 compagnons placés avant le monde 3 | oui | oui (14 à 16 min) |
| Monde 8 | — | 90 min (partie de 150 min : monde 9, aucun blocage) |

## 4. Icônes PixelLab (section 5)

Format : 32×32 (affichage 32 à 40 px), contour sombre 1 px, fond transparent, lumière en haut à gauche, palette du
jeu. Une icône = une idée. Prompt commun : « pixel art game icon, 32x32, 1px dark outline, light from top-left,
bright fantasy palette, transparent background, … ».

| Fichier (assets/sprites/ui/) | Sujet (fin du prompt) | Remplace |
|---|---|---|
| upg_damage.png | glowing sword blade pointing up | icon_damage |
| upg_speed.png | lightning bolt with motion lines | icon_bolt |
| upg_crit.png | target with a gold star in the center | icon_crit |
| upg_critdmg.png | sword shattering into sparks | icon_skull (évoquait la mort) |
| upg_double.png | two blades striking in a V | skill_whirl (doublon Tourbillon) |
| upg_boss.png | crowned demon skull with a crack | icon_boss |
| upg_team.png | two crossed swords with a link chain | icon_paw (évoquait un familier) |
| upg_hp.png | red heart with a white shine | icon_heart |
| upg_defense.png | round iron shield with rivets | shield |
| upg_ironskin.png | gauntlet arm covered in iron plates | icon_shield (doublon Défense) |
| upg_regen.png | green heart with a plus sign and leaves | icon_regen |
| upg_lifesteal.png | blood drop with a small heart inside | icon_essence |
| upg_dodge.png | blurred silhouette dashing aside | skill_quick (doublon Frappe rapide) |
| upg_gold.png | stack of gold coins | icon_gold (ressemblait à un poing) |
| upg_xp.png | glowing open book with a star | icon_xp (texte « XP » illisible) |
| skill_quick / whirl / cry / holy / mastery | quick slash arc / spinning blades / shouting helmet with sound waves / radiant sun sword / glowing tome with swords | priorité 2 |
| boost_rage / frenzy / midas / hunter / phantom | red flame fist / yellow speed swirl / golden hand / hunter's eye with crosshair / purple ghost blade | priorité 2 |
| cur_gem / gold / shard / fragment / key / ticket / essence / xp / summon | blue gem / gold coin / blue crystal shards / ancient rune fragment / iron key / summon ticket / glowing vial / star book / summoning circle | priorité 3 |
| menu_hero / pet / map / trophy / bag / anvil / tree / upgrade / chest / mail / book / gear / lock / timer / tower / dungeon / rebirth | knight helmet / paw / folded map / gold cup / leather bag / anvil / talent tree / up arrow / chest / envelope / book / gear / padlock / hourglass / tower / dungeon gate / phoenix feather | priorité 4 |

Les icônes actuelles restent en place jusqu'à leur arrivée ; les doublons « Défense / Armure » sont déjà séparés
(Peau de fer : enclume en attendant upg_ironskin).
