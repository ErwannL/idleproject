# Ajouter du contenu sans toucher au moteur (v9.7.1)

Le jeu doit vivre des années : un monde, un grand boss ou un événement s'ajoutent par **fiche de données**.
Chaque section donne un exemple complet à recopier.

## 1. Un monde (fiche `src/data/zones.js`)

Voir aussi `docs/ajouter-un-monde.md` (décor, ennemis, vérification). Tout le reste suit la fiche :
étoiles (`core/world-stars.js`), revanche contre le Colosse (`core/revenge.js`, une entrée par monde),
objectifs de session, courbe de campagne (`BALANCE.enemyScaling.campaign`) et boutons du guide.

```js
// src/data/zones.js — monde 13
{
  id: 'storm', name: 'Pics de l\'Orage', element: 'light',
  enemies: ['storm_imp', 'sky_automaton', 'harpy'],           // ≥ 3, déclarés dans src/data/enemies.js
  tierBosses: { mini: 'mini_harpy_queen', mid: 'mid_thunder_griffin', hard: 'hard_storm_valkyrie' },
  bosses: ['boss_sky_titan'],                                  // méga boss de fin de monde
}
```

Puis :
1. `node tools/validate-worlds.mjs` (fiche valide), `npm test`.
2. Revanche : ajouter `{ world: 13, goal: 'clear', clear: 1, seconds: 60, text: '…' }` à `REVENGE` si le fil continue.
3. Animations : `python3 tools/art/pl971_enemies.py bosses` puis `python3 tools/art/pixellab_anim.py`
   (compétence, annonce, seconde attaque : fichier `art-anim-extra.js`, chargé à la demande).

## 2. Un grand boss (Titan, dieu) — fiche `src/data/grand-bosses.js`

Moteur commun : `core/world-boss.js` (`WorldBossFight`, `setup.bossId`) et `render/world-boss-scene.js`.
Trois façons de l'affronter avec la même fiche : histoire (face-à-face, `core/revenge.js`), solo répétable,
commun (événement `grandBoss` du catalogue live). Il apparaît tout seul dans le **Panthéon** (Collections).

```js
// src/data/grand-bosses.js
storm_titan: {
  id: 'storm_titan', name: 'Titan de l\'Orage', title: 'Deuxième Titan',
  lore: 'Il garde les pics où naissent les éclairs.',
  art: {
    dir: 'assets/world-boss', prefix: 'storm_titan_', frame: 128, foot: 122,   // planches storm_titan_<anim>.png
    anims: {                                                                     // mêmes clés que le Colosse
      idle: { n: 8, fps: 7, loop: true }, idle3: { n: 8, fps: 9, loop: true },
      attack: { n: 9, fps: 16 }, attack3: { n: 9, fps: 18 }, hurt: { n: 9, fps: 18 }, hurt3: { n: 9, fps: 18 },
      quake: { n: 9, fps: 11 }, embers: { n: 9, fps: 11 }, fury: { n: 9, fps: 12 },
      transform: { n: 13, fps: 12 }, death: { n: 13, fps: 10 }, rise: { n: 13, fps: 14, src: 'death', reverse: true },
      throw: { n: 13, fps: 12, release: 9 }, throw3: { n: 13, fps: 12, release: 9 },
      beam: { n: 13, fps: 12, charge: [3, 4], fire: [5, 8] }, beam3: { n: 13, fps: 12, charge: [3, 4], fire: [5, 8] },
    },
    eyes: { beam: [/* 13 × [xAvant, yAvant, xArrière, yArrière] */], beam3: [/* … */] },
    hands: { throw: [16, 34], throw3: [18, 44] },
    beamColors: { beam: ['#ffe24a', '#fff3a8', '#ffffff'], beam3: ['#ff8a2a', '#ffc04a', '#fff3c8'] },
  },
  fight: {
    boss: 'boss_sky_titan', name: 'Titan de l\'Orage', seconds: 60, sizeMul: 2.3,
    phases: [
      { at: 0.75, id: 'quake', name: 'Tonnerre', hit: 0.18, speed: 1.15, power: 1.15 },
      { at: 0.5, id: 'meteors', name: 'Pluie d\'éclairs', hit: 0.24, speed: 1.3, power: 1.3 },
      { at: 0.25, id: 'fury', name: 'Colère du ciel', hit: 0.3, speed: 1.5, power: 1.5 },
    ],
    tiers: [0.25, 0.5, 0.75, 1], hitPct: 0.07, attackInterval: 2.4, hpFactor: 1.05, awaken: 1.25,
    abilities: [{ id: 'boulder', name: 'Rocher foudroyé', hit: 0.11, from: 0 }, { id: 'eyebeam', name: 'Regard d\'éclair', hit: 0.15, from: 1 }],
    abilityFirst: 5, abilityEvery: [11, 9.5, 8, 6.5], abilityGap: 2.5,
  },
  rewards: { gems: 60, shards: 25 },
  modes: ['story', 'solo', 'shared'],
},
```

Le boss d'essai `shade` (même fichier) montre qu'une fiche seule suffit : il reprend les planches du Colosse avec un
filtre de couleur (`art.filter`) et ses propres phases. Les attaques qui demandent une réaction (parade, point faible)
viennent du moteur de combat (`bossHeavy`, `weakSpot` : `core/combat.js`).
Vérifier : `node --test tests/v971-grand-boss.test.js`.

## 3. Un événement (toutes les deux semaines, sans nouvelle version)

Quatre gabarits dans `src/data/live-catalog.js` : `expedition` (expédition à étapes), `grandBoss` (grand boss
commun), `ruleChallenge` (défi à règles), `collect` (collecte). Un événement = une entrée de la config live
(admin, voir `docs/live-ops.md`) :

```json
{
  "id": "orage-2027-03",
  "type": "grandBoss",
  "title": "La colère du Titan",
  "start": "2027-03-01T10:00:00Z",
  "end": "2027-03-15T10:00:00Z",
  "minClient": "9.7.1",
  "params": { "boss": "colossus", "bossHpMult": 1.2, "attemptsPerDay": 3, "coinMult": 1.5 }
}
```

Rattrapage : un événement en cours est ouvert à tout joueur qui a fini le monde 2 (onglet Événement) ; ses PV et ses
objectifs suivent la partie du joueur (`bossHpForDay`, `goalMult`), donc un joueur arrivé six mois après peut y
participer.

## 4. Le prologue et le fil de l'histoire

- Prologue : `src/ui/prologue.js` (script pur `prologueState(t)`, scènes horodatées), revoir depuis Paramètres.
- Compagnons d'histoire : `story` dans `src/core/unlock-quests.js` (Prêtresse à la fin du monde 1, Pyromancienne à
  la fin du monde 2).
- Revanche : `src/core/revenge.js`.
