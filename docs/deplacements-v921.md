# Déplacements par monde (v9.2.1)

Chaque monde a sa façon d'avancer, pour le héros, les compagnons et les familiers (les compagnons volants gardent
leur vol). Données : `src/data/traversal.js` ; rendu : `src/render/traversal-fx.js` (méthodes de la scène).
Tout est dessiné au pixel entier (pas de flou), compatible avec les équipements et les 8 skins (on ne retouche que la
position et l'image de pas du personnage composé). « Réduire les animations » : hauteurs fixes, ni sauts, ni
particules, ni traces.

| Monde | Style | Ce qu'on voit |
|---|---|---|
| 1 Plaines verdoyantes | marche | marche normale (inchangée), poussière des pas |
| 2 Forêt sombre | pas feutrés | cadence ralentie (×0,8), feuilles soulevées à chaque pas, feuilles mortes qui tombent autour de l'équipe |
| 3 Grottes de cristal | pas sur le cristal | cadence ×0,9, éclat de cristal (étincelle teintée) et éclats qui sautent à chaque pas, reflets au sol |
| 4 Désert brûlant | pas dans le sable | cadence ×0,85, sable soulevé, empreintes qui restent et défilent avec le sol, mirage (traits de chaleur ondulants) |
| 5 Montagnes gelées | glissade | 2 poussées puis 6 temps de glisse (pose de repos), gerbe de neige et sillons, empreintes dans la neige, souffle givré |
| 6 Terres maudites | dans la brume | cadence ×0,85, brume violette qui s'enroule aux chevilles et traîne derrière |
| 7 Marais putride | on patauge | corps enfoncés de 7 px et coupés à la surface, eau trouble jusqu'aux mollets, cadence ×0,6, éclaboussures et ronds dans l'eau |
| 8 Îles célestes | de nuage en nuage | bonds en cloche (11 px) ; un petit nuage se forme sous les pieds à chaque réception et reste en arrière ; à l'arrêt, debout sur un nuage |
| 9 Cœur du volcan | pas prudents | cadence ×0,7, empreintes brûlantes qui refroidissent (jaune → orange → brun), braises qui jaillissent des pas |
| 10 Royaume du Néant | lévitation | 6 px au-dessus du sol, balancement lent, aucun pas (pose de repos), traînée de poussière d'étoiles |
| 11 Royaume englouti | nage | nage de la v9.2.0 (crawl, ciseaux, bulles) — nageur agrandi en v9.2.1 |
| 12 Trône de l'Abysse | pas lourds dans l'ombre | cadence ×0,75, ondes rouge sombre au sol à chaque pas, volutes d'ombre et d'étincelles rouges |

Performances : les effets réutilisent les particules existantes de la scène (au plus quelques-unes par pas) et
40 traces au sol au plus ; mesure avant/après dans les notes de version.
