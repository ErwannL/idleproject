// v10.19 (partie 1) : ouvriers du Bastion — niveaux (1 XP par minute de travail, +2 % par niveau), libellé clair,
// départ signalé (bandeau + « Remplacer ») et option « Remplacer automatiquement si un ouvrier part » (oui par défaut).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createNewState, sanitizeState } from '../src/core/state.js';
import {
  addWorkerXp, assignWorker, autoReplaceOn, bastionTick, bestFreeWorker, busyWorkers, departedFrom, productionFactor, takeNotices,
  workerBonus, workerInfo, workerLevelFor, workerNoticeText, workerProgress, workerSpeedText,
} from '../src/core/bastion.js';
import { WORKER_RULES } from '../src/data/bastion.js';
import { BALANCE } from '../src/data/balance.js';
import { toggleCompanion } from '../src/core/companions.js';

const T0 = Date.UTC(2026, 10, 27, 9);
const MIN = 60_000;
const HOUR = 60 * MIN;
const ALLIES = ['dwarf', 'priestess', 'ranger', 'squire', 'mercenary', 'witch'];
function opened(stage = 60) {
  const s = createNewState(T0, 7);
  s.maxStage = stage; s.stage = stage; s.records.bestStage = stage;
  for (const id of ALLIES) s.companions.owned[id] = { stars: 1, level: 1 };
  bastionTick(s, T0);
  s.gold = 1e30; s.materials.shards = 1e6;
  return s;
}
const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('seuils et bonus : 1 à 10, +2 % par niveau (WORKER_RULES.levelPct)', () => {
  assert.deepEqual(WORKER_RULES.levelXp, [30, 60, 100, 150, 210, 280, 360, 450, 550]);
  assert.equal(WORKER_RULES.levelPct, 2);
  assert.deepEqual([0, 29, 30, 99, 100, 149, 550, 9999].map(workerLevelFor), [1, 1, 2, 3, 4, 4, 10, 10]);
});

test('XP gagnée en 10 min de travail, hors ligne compris (plafond de la production hors ligne)', () => {
  const s = opened();
  assert.equal(assignWorker(s, 'forge', 'dwarf', T0), null);
  assert.deepEqual(workerInfo(s, 'dwarf'), { workerXp: 0, workerLevel: 1 });
  for (let t = T0 + 1000; t <= T0 + 10 * MIN; t += 1000) bastionTick(s, t);
  assert.equal(Math.round(workerInfo(s, 'dwarf').workerXp), 10);
  // Un compagnon sans poste ne gagne rien.
  assert.equal(workerInfo(s, 'squire').workerXp, 0);
  // Absence de 30 h : comptée jusqu'au plafond hors ligne (12 h de base = 720 min), et l'XP s'arrête au niveau 10.
  const o = opened();
  assignWorker(o, 'forge', 'dwarf', T0);
  bastionTick(o, T0 + 30 * HOUR);
  assert.equal(BALANCE.offline.capHours * 60 >= 550, true);
  assert.equal(workerInfo(o, 'dwarf').workerLevel, 10);
  assert.equal(workerInfo(o, 'dwarf').workerXp, 550);
  const short = opened();
  assignWorker(short, 'forge', 'dwarf', T0);
  bastionTick(short, T0 + 100 * MIN);
  assert.equal(workerInfo(short, 'dwarf').workerLevel, 4);
});

test('niveau 4 donne +8 % ; la carte : Métier +20 %, Rareté +5 %, Niveau 4 +8 % = +33 % de vitesse de la Forge', () => {
  const s = opened();
  addWorkerXp(s, 'dwarf', 120);
  const b = workerBonus(s, 'dwarf', 'forge');
  assert.deepEqual([b.level, b.levelPct, b.tradePct, b.rarityPct, b.totalPct], [4, 8, 20, 5, 33]);
  assignWorker(s, 'forge', 'dwarf', T0);
  assert.equal(productionFactor(s, 'forge'), 1.33);
  assert.deepEqual(workerProgress(s, 'dwarf'), { level: 4, xp: 120, from: 100, to: 150, max: false });
  assert.match(workerSpeedText('forge'), /commandes/);
  // Le niveau est gardé quand l'ouvrier part puis revient.
  s.bastion.autoReplace = false;
  assert.equal(toggleCompanion(s, 'dwarf'), true);
  bastionTick(s, T0 + 1000);
  assert.equal(workerInfo(s, 'dwarf').workerLevel, 4);
  assert.equal(toggleCompanion(s, 'dwarf'), true);
  assert.equal(assignWorker(s, 'forge', 'dwarf', T0 + 2000), null);
  assert.equal(workerBonus(s, 'dwarf', 'forge').totalPct, 33);
});

test('un ouvrier mis dans l\'équipe est remplacé si l\'option est active (par défaut), avec un seul avertissement', () => {
  const s = opened();
  assert.equal(autoReplaceOn(s), true);
  assignWorker(s, 'forge', 'dwarf', T0);
  assert.equal(toggleCompanion(s, 'dwarf'), true);
  bastionTick(s, T0 + 1000);
  const w = s.bastion.buildings.forge.worker;
  assert.ok(w && w !== 'dwarf', 'un autre ouvrier a pris la place');
  assert.equal(departedFrom(s, 'forge'), null);
  const notices = takeNotices(s);
  assert.equal(notices.length, 1);
  assert.match(workerNoticeText(notices[0]), /^Nain guerrier rejoint l'équipe et quitte la Forge du forgeron : .+ le remplace$/);
  assert.deepEqual(takeNotices(s), []);
  // Il reste visible, grisé, dans le choix d'ouvrier : « en équipe ».
  assert.deepEqual(busyWorkers(s).map((x) => [x.c.id, x.why]), [['dwarf', 'team']]);
});

test('sans l\'option : le bâtiment garde un bandeau « parti » jusqu\'au remplacement', () => {
  const s = opened();
  s.bastion.autoReplace = false;
  assignWorker(s, 'forge', 'dwarf', T0);
  assert.equal(toggleCompanion(s, 'dwarf'), true);
  bastionTick(s, T0 + 1000);
  assert.equal(s.bastion.buildings.forge.worker, null);
  assert.deepEqual(departedFrom(s, 'forge'), { companionId: 'dwarf', why: 'team' });
  // Équipe changée sans passer par les fonctions : reconcileWorkers signale aussi le départ.
  const t = opened();
  t.bastion.autoReplace = false;
  assignWorker(t, 'forge', 'mercenary', T0);
  t.companions.equipped = ['mercenary'];
  bastionTick(t, T0 + 1000);
  assert.deepEqual(departedFrom(t, 'forge'), { companionId: 'mercenary', why: 'team' });
  // « Remplacer (…) » : le meilleur ouvrier libre ; le bandeau s'efface.
  const best = bestFreeWorker(t, 'forge');
  assert.ok(best);
  assert.equal(assignWorker(t, 'forge', best.id, T0 + 2000), null);
  assert.equal(departedFrom(t, 'forge'), null);
});

test('sauvegarde : migration au niveau 1, XP et option gardées, valeurs abîmées réparées', () => {
  const s = opened();
  delete s.bastion.workers; delete s.bastion.autoReplace; delete s.bastion.departed;
  const old = sanitizeState(JSON.parse(JSON.stringify(s)), BALANCE, T0 + 1000);
  assert.equal(old.bastion.autoReplace, true, 'option activée par défaut');
  assert.deepEqual(workerInfo(old, 'dwarf'), { workerXp: 0, workerLevel: 1 });
  addWorkerXp(old, 'dwarf', 155);
  old.bastion.autoReplace = false;
  old.bastion.workers.ghost = { workerXp: 99 };
  old.bastion.workers.squire = { workerXp: 'x', workerLevel: 9 };
  const back = sanitizeState(JSON.parse(JSON.stringify(old)), BALANCE, T0 + 2000);
  assert.deepEqual(back.bastion.workers.dwarf, { workerXp: 155, workerLevel: 5 });
  assert.equal(back.bastion.workers.ghost, undefined);
  assert.equal(workerInfo(back, 'squire').workerLevel, 1);
  assert.equal(back.bastion.autoReplace, false);
});

test('interface : carte de l\'ouvrier, petites cartes, bandeau, option ; textes anglais et coréens', () => {
  const camp = src('src/ui/panels/camp.js');
  assert.match(camp, /vitesse de \$\{escapeHtml\(def\.the\)\}/);
  assert.match(camp, /Niveau \$\{b\.level\} \+\$\{b\.levelPct\} %/);
  assert.match(camp, /en expédition' : 'en équipe'/);
  assert.match(camp, /data-action="bastion-replace"/);
  assert.match(camp, /Remplacer automatiquement si un ouvrier part/);
  for (const f of ['src/i18n/en.js', 'src/i18n/ko.js']) assert.match(src(f), /1019-bastion\.js/);
});
