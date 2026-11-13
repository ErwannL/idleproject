# Ascendrya 9.5 et suivantes — un idle stratégique et sans lassitude (prompt « gameplay 2.3.7 »)

Plan seulement : rien n'est codé. Trois décisions du créateur sont attendues (section 4) avant les étapes qui en
dépendent.

## 1. Comment ça marche aujourd'hui (9.4.0)

- **Combat** (`core/combat.js`) : campagne en vagues de 3 monstres (9.3.8) qui naissent au bord droit de l'écran
  (9.3.9) et s'arrêtent sur une ligne ; personne ne les touche avant. Le héros combat 63 à 68 % du temps. Boss : un
  ennemi seul, rage à 60 s (compte à rebours affiché). Tous les monstres ont le même comportement (avancer, frapper au
  contact) ; 6 mécaniques de boss (`boss-traits.js`) sur une partie des boss ; 6 mutations.
- **Éléments** (`core/elements.js`) : 5 éléments, ×1,25 contre le bon, ×0,8 contre le mauvais. Chaque monde a un
  élément (`ZONE_ELEMENT`, codé en dur pour 12 mondes) ; il est montré par une petite icône.
- **Synergies** (`data/synergies.js`) : 20 synergies de rôles, actives toutes seules dès que les rôles sont placés.
- **Compagnons** : 2 places + 1 familier ; le niveau appartient au compagnon (un remplaçant repart du niveau 1).
- **Ensembles** (`data/sets.js`) : 11 ensembles, bonus à 2, 4 et 6 pièces. Depuis la 9.3.8, le héros a 6 places :
  le bonus à 6 pièces est de nouveau atteignable sur le héros seul (il ne l'était plus en 9.3.4–9.3.7).
- **Classe** (`core/classes.js`) : déduite de l'arme portée ; « Équiper le meilleur » (`equipBest`) prend l'objet de
  plus haute Puissance, donc la classe change au gré du butin, sans choix du joueur.
- **Builds** (`core/loadouts.js`) : enregistrer / appliquer équipe, équipement, classe, pouvoirs, compétences ; jamais
  appliqués automatiquement.
- **« Améliorer au mieux »** : achète la ligne qui donne le plus de Puissance par pièce d'or.
- **Boosts** (`data/rushes.js`) : 5 boosts de 20 à 30 s, recharge 5 à 10 min, option Auto.
- **Fin de campagne** : après le monde 12, cycles ×2, ×3… (`difficultyForStage`) ; « 12 mondes » est supposé à
  plusieurs endroits (éléments, cinématiques, statistiques, Encyclopédie, Transcendance).

Déjà fait dans les 9.3.8 à 9.4.0 (repris par ce prompt) : vagues groupées et vitesse constante (5.1), coups qui pèsent
(5.4), casques qui gardent le visage (5.6), familiers sans équipement (3.8), compagnons redessinés et animés en marche,
attaque et gestes de compétence (en partie 8.2).

## 2. Plan par étapes (chacune livrable seule, avec simulation avant / après)

| Étape | Contenu | Version visée |
|---|---|---|
| a | **Composition** : niveau porté par la place (migration : chaque place prend le niveau le plus haut de ses occupants passés, rien n'est perdu), rôles lisibles (icône + une phrase « bon contre »), synergies à un changement près montrées en grisé avec le gain, « Meilleure équipe disponible » dans la barre jaune et bouton « Équipe conseillée ». | 9.5.0 |
| b | **Affinités** : cycle Feu > Nature > Eau > Feu, Lumière ⇄ Ténèbres, roue affichée dans Équipe, Équipement et Carte ; écarts portés à +50 % / −30 % si la simulation le permet ; élément sur chaque monstre et boss (barre de vie, icône), « Efficace ! » / « Résiste » ; écran Préparation (monde, boss de fin) qui ne bloque jamais l'idle. | 9.5.1 |
| c | **Équipement** : « Équiper pour : Attaque / Survie / Fortune » ; Puissance contextuelle (« +12 % ici ») ; bandeau Ensembles (pièces, prochain palier, où les trouver, spécialité en un mot) ; classe choisie par le joueur et respectée par « Équiper pour ». | 9.5.2 |
| d | **Combat** (reste) : effets lisibles (un effet visible par personnage, auras en liseré, « Effets réduits »). | 9.5.2 |
| e | **Comportements** : champ `behavior` sur les 49 monstres (Tireur, Bouclier, Kamikaze, Soigneur, Essaim, Volant, Voleur, Charge), 2 par monde, icône et carte de première rencontre ; au moins une mécanique pour chacun des 50 boss, + Miroir, Gel, Nuée, Bouclier d'élément ; Élites et mutations annoncées. | 9.6.0 |
| f | **Builds attachés** à un monde ou un mode, effets d'objets marquants (Épique et Légendaire, deux effets forts exclusifs), résonance d'élément (2 et 3 membres), élément sur les armes et pièces d'ensemble. | 9.6.1 |
| g | **Contenus** : une préparation et une récompense propres à chacun (Donjons à chemins, Tour à règles et 3 ascensions/jour avec écran de fin, Arène et Événement sur la grande scène avec « Enchaîner », Expéditions « Tout envoyer »), Renaissance proposée dès que le gain vaut la peine. | 9.7.0 |
| h | **Compétences manuelles** (3 gros boutons, touches 1-2-3, 5 à 10 s, recharge 45 à 120 s, Auto à 60 % de l'effet, gain 15 à 25 %), boss en phases (attaque lourde toutes les ~8 s puis 3 s affaibli), consignes des ultimes, 3e place de compagnon (monde 5), rangs avant / arrière. Migration des niveaux de Boosts. | 9.7.1 |
| i | **Animations par le code** (élan, fente, écrasement, respiration) pour monstres et boss, entrée de boss, liens visibles des synergies ; branchement `<sprite>_atk` dès qu'une image existe. | 9.8.0 |
| j | **Lassitude** : événements visibles dans la scène toutes les 3 à 5 min, butin divisé par 5 à 10 (mieux mis en scène), objectifs de session, résumé de retour qui propose un ajustement, paliers de pouvoir visibles. | 9.8.1 |
| k | **Jeu service** : fiche de monde (`data/worlds/<id>.js`) + outil de validation + recette dans `docs/`, suppression des « 12 » en dur ; ouverture des mondes par le catalogue live avec compte à rebours ; fin de campagne (Failles, Tour sans fin, Héroïque) qui remplace les cycles ×2/×3 (conversion des sauvegardes) ; saisons, économie, rattrapage, mesures anonymes avec accord. La partie « fiche de monde » (10.2) commence dès l'étape a, en parallèle. | 9.9.x |

Chaque étape : note de design courte, code, tests, simulation (mondes 4, 8 et 12 pour un joueur passif et un joueur
qui prépare bien), captures PC et 390 px, dossier sur le partage.

## 3. Mesure de référence à refaire en premier

Le constat du prompt (monde 12 en 6 h 13, aucun choix nécessaire) date de la 9.3.7. Je refais d'abord la même
partie automatique sur la 9.4.0, avec deux joueurs simulés : **passif** (barre jaune seulement) et **préparé** (équipe
et élément adaptés au monde). C'est la base de toutes les comparaisons et du critère « au moins 30 % plus vite ».

## 4. Décisions du créateur (prises le 12 novembre)

- Rythme : **4 à 6 semaines** pour les 12 mondes (mondes 1 à 3 dans la première session), freiné par la préparation.
- Sceaux : **oui, dès le monde 3**.
- Butin et invocations : **les deux réduits** (ressources déjà gagnées conservées).
- Ordre : celui du prompt, mesure de référence d'abord, fiche de monde en parallèle.

Texte d'origine des questions :

1. **Rythme de la campagne (10.1).** Proposition : mondes 1 à 3 dans la première session, puis un monde tous les 2 à
   3 jours pour un joueur régulier (12 mondes en 4 à 6 semaines), le frein étant la préparation, jamais un mur de
   chiffres. Cela ralentit fortement le jeu actuel (6 h pour tout voir). Je fournis les simulations des trois profils
   (10 min/jour, 1 h/jour, intensif) avant de toucher à l'équilibrage.
2. **Sceaux (7.6).** Le boss de fin de chaque monde, à partir du monde 3, demande un sceau gagné au choix dans le
   donjon du monde, à la Tour ou au Défi. Les sauvegardes déjà plus loin gardent leurs mondes ouverts. Oui, non, ou
   seulement à partir d'un monde plus tardif ?
3. **Calendrier des nouveautés (9.9).** Un déblocage toutes les 20 à 30 min pendant les 10 premières heures : je le
   dresse à partir de l'état actuel et je te le montre avant de coder (il dépend de la décision 1).
4. **Butin et invocations (2.8, 9.4, 10.9).** Diviser le butin par 5 à 10 et réduire le débit d'invocations change
   l'économie des sauvegardes existantes (ressources déjà gagnées gardées telles quelles). À confirmer.

## Rythme v9.7.0 (simulation tools/_simedge.mjs, joueur passif, jeu actif seulement)
- Mondes 1–3 : 14 min (inchangé, première session).
- Monde 8 : 132 min ; monde 9 : 217 min ; monde 10 : 386 min (avant : 199 min) ; monde 12 en v9.6 : 317 min.
- Courbe : PV ×1,012 par étape après le monde 3 (plafond ×20), campagne seulement.
