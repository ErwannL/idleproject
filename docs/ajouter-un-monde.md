# Ajouter un monde (v9.6.5)

1. **Fiche** : ajouter une entrée à `src/data/zones.js` — `id`, `name`, `element` (red, blue, green, light, dark),
   `enemies` (≥ 3), `bosses` (méga boss), `tierBosses` { mini, mid, hard }.
2. **Ennemis/boss** : déclarer les nouveaux identifiants dans `src/data/enemies.js` (ENEMIES / BOSSES) et leurs arrivées
   dans `src/data/arrivals.js` ; sprites dans `assets/`.
3. **Décor** : `tools/art/scenery.py` puis manifeste `src/render/bg.js`.
4. **Vérifier** : `node tools/validate-worlds.mjs` (fiches) puis `npm test`.
5. **Ouverture annoncée** (optionnel) : entrée dans le catalogue live (`src/data/live-catalog.js`) avec une date
   d'ouverture ; le jeu affiche un compte à rebours jusqu'à l'ouverture.

Aucun « 12 mondes » n'est codé en dur : le nombre de mondes vient de `ZONES.length`.
