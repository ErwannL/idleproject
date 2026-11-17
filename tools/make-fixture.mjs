// v9.8 (A) : sauvegarde de référence « fin de jeu » pour les tests (tests/fixtures/endgame.json) : partie ancienne
// (sans mini-quêtes), Cycle ×3 du monde 1, niveau 140, 20 compagnons, améliorations d'un joueur qui y progresse.
// La puissance est réglée pour qu'au Cycle ×2 un monstre ordinaire tombe vite : le test vérifie qu'au Cycle ×3
// (étape suivante du joueur) un monstre meure en moins de 10 s… ou que la sécurité le ramène au Cycle ×2.
import { writeFileSync } from 'node:fs';
import { createNewState } from '../src/core/state.js';
import { stagesPerCycle } from '../src/core/combat.js';
import { COMPANIONS } from '../src/data/companions.js';
const s = createNewState(Date.UTC(2026, 10, 17));
const per = stagesPerCycle();
Object.assign(s, { level: 140, maxStage: 2 * per + 1, stage: 2 * per + 1, gold: 1e17, gems: 3000 });
s.records.bestStage = 2 * per + 20; s.records.bossesDefeated = 400; s.records.kills = 2e5; s.records.rebirths = 3;
s.upgrades = { ...s.upgrades, damage: 4200, vitality: 3000, attackSpeed: 60, crit: 40, critDamage: 60 };
s.rebirthPower = 12;
for (const c of COMPANIONS.slice(0, 20)) s.companions.owned[c.id] = { stars: 3, level: 60 };
s.companions.equipped = COMPANIONS.filter((c) => c.kind === 'ally').slice(0, 3).map((c) => c.id);
writeFileSync(new URL('../tests/fixtures/endgame.json', import.meta.url), JSON.stringify(s));
console.log('tests/fixtures/endgame.json écrit');
