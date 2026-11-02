#!/usr/bin/env node
// v9.1.3 (doc1 lot C) : mesure de l'économie et des parcours, avec le moteur réel (core/*.js) en Node.
// Outil seulement : aucun réglage n'est modifié. Produit docs/mesures-v913.md.
//
// Sauvegardes simulées par un « joueur automatique » (achats d'améliorations au meilleur gain de dégâts/s,
// équipement meilleur, points de compétence, recyclage et fusion automatiques, Renaissance quand la progression
// cale) : début (30 min de jeu), milieu (fin de la 1re Renaissance), fin (plusieurs Renaissances).
// Ce joueur n'existe pas dans le jeu (aucun achat automatique) : il sert seulement à fabriquer des états crédibles.
//
// Usage : node tools/measure-v913.mjs [--quick] [--out docs/mesures-v913.md]
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Horloge et hasard fixes (un mercredi : ni week-end ni changement de période pendant la mesure).
const T0 = new Date(2026, 9, 21, 10).getTime();
let simMs = 0;
Date.now = () => T0 + simMs;
let seed = 0x9e3779b9;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

const { BALANCE } = await import('../src/data/balance.js');
const { LOGIN_CALENDAR, MISSION_PERIODS, MISSION_TRACK } = await import('../src/data/missions.js');
const { DUNGEON_REWARD, DUNGEON_DIFFICULTIES } = await import('../src/data/dungeons.js');
const { TALENT_RESPEC, REBIRTH } = await import('../src/data/rebirth.js');
const { BOUNTY } = await import('../src/core/bounty.js');
const { ACHIEVEMENTS } = await import('../src/core/achievements.js');
const { createNewState } = await import('../src/core/state.js');
const { createCombat, step, currentEncounter } = await import('../src/core/combat.js');
const { buyMostProfitable } = await import('../src/core/profit.js');
const { equipBest, isUpgrade, sweepInventory, bulkRecycleCandidates } = await import('../src/core/inventory.js');
const { autoFuse } = await import('../src/core/forge.js');
const { distributeSkillPoints } = await import('../src/core/skills.js');
const { canRebirth, performRebirth, buyTalentsCheapest, rebirthReward, talentById } = await import('../src/core/rebirth.js');
const { computeHeroStats } = await import('../src/core/stats.js');
const { Rng } = await import('../src/core/rng.js');
const { generateItem, rarityById } = await import('../src/core/loot.js');

const args = process.argv.slice(2);
const QUICK = args.includes('--quick');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, args[args.indexOf('--out') + 1] && args.includes('--out') ? args[args.indexOf('--out') + 1] : 'docs/mesures-v913.md');

const DT = BALANCE.simulation.tickSeconds;
const fmt = (n) => (Math.abs(n) >= 1e6 ? n.toExponential(2).replace('e+', 'e') : Math.abs(n) >= 100 ? Math.round(n).toLocaleString('fr-FR') : (Math.round(n * 10) / 10).toLocaleString('fr-FR'));
const hms = (s) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, '0')}` : `${Math.round(s / 60)} min`);
const pct = (x) => `${(Math.round(x * 1000) / 10).toLocaleString('fr-FR')} %`;

// --- Joueur automatique -------------------------------------------------------------------------------------
// Joue `seconds` secondes de combat ; renvoie les compteurs de la période (sources de gemmes, matériaux, butin).
function play(state, seconds, { rebirth = false, stopAt = null, rngSeed = 1 } = {}) {
  const world = createCombat(state);
  const rng = new Rng(rngSeed);
  const acc = { seconds: 0, gems: 0, shards: 0, essence: 0, drops: { monstres: 0, boss: 0 }, fate: { sac: 0, recycle: 0, mannequin: 0, musee: 0 },
    rarities: {}, equipped: 0, swept: 0, fused: 0, rebirths: 0, kills: 0 };
  const g0 = state.gems;
  const m0 = { essence: 0, ...state.materials }; // v9.1.3 : plus d'essences (fondues dans les éclats)
  const k0 = state.records.kills;
  let lastBest = state.maxStage;
  let stall = 0;
  const steps = Math.round(seconds / DT);
  for (let i = 1; i <= steps; i++) {
    step(state, world, DT, rng);
    simMs += DT * 1000;
    for (const e of world.events) {
      if (e.type !== 'drop') continue;
      const boss = Boolean(currentEncounter(state).boss);
      acc.drops[boss ? 'boss' : 'monstres'] += 1;
      acc.rarities[e.item.rarity] = (acc.rarities[e.item.rarity] ?? 0) + 1;
      acc.fate[e.mannequin ? 'mannequin' : e.museum ? 'musee' : e.autoRecycled ? 'recycle' : 'sac'] += 1;
    }
    world.events.length = 0;
    if (i % Math.round(5 / DT) === 0) { // toutes les 5 s de jeu
      buyMostProfitable(state);
      acc.equipped += equipBest(state);
      distributeSkillPoints(state);
      acc.fused += autoFuse(state, rng, isUpgrade).length;
      acc.swept += sweepInventory(state).count;
      if (state.inventory.length >= BALANCE.loot.inventorySize - 2) {
        const ids = new Set(bulkRecycleCandidates(state, 'epic').map((x) => x.id));
        state.inventory = state.inventory.filter((x) => !ids.has(x.id)); // sac plein : le joueur trie (mesuré à part)
      }
    }
    if (i % Math.round(60 / DT) === 0) { // chaque minute
      if (state.maxStage > lastBest) { lastBest = state.maxStage; stall = 0; } else stall += 1;
      if (stopAt && state.maxStage >= stopAt) { acc.seconds = i * DT; break; }
      if (rebirth && stall >= 20 && canRebirth(state)) {
        performRebirth(state);
        buyTalentsCheapest(state);
        acc.rebirths += 1;
        lastBest = state.maxStage;
        stall = 0;
      }
    }
    acc.seconds = i * DT;
  }
  acc.gems = state.gems - g0;
  acc.shards = state.materials.shards - m0.shards;
  acc.essence = (state.materials.essence ?? 0) - m0.essence;
  acc.kills = state.records.kills - k0;
  return acc;
}

const clone = (s) => structuredClone(s);
const snapshot = (s) => ({ stage: s.maxStage, best: s.records.bestStage, level: s.level, rebirths: s.records.rebirths, hours: (s.playSeconds ?? 0) / 3600 });

// --- Sauvegardes simulées ----------------------------------------------------------------------------------
const t = Date.now();
const S = {};
const early = createNewState(T0, 0xC0FFEE);
early.ui.recycle = { ...early.ui.recycle, mode: 'pickup' };
play(early, 30 * 60);
S.debut = clone(early);
const mid = clone(early);
play(mid, (QUICK ? 3 : 6) * 3600, { rebirth: false, rngSeed: 2 });
S.milieu = clone(mid);
const late = clone(mid);
play(late, (QUICK ? 6 : 24) * 3600, { rebirth: true, rngSeed: 3 });
play(late, 2 * 3600, { rebirth: false, rngSeed: 4 }); // fin de cycle : la sauvegarde est prise au plus haut, pas juste après une Renaissance
S.fin = clone(late);
const buildSeconds = (Date.now() - t) / 1000; // (temps simulé, pas le temps machine)
// v9.1.3 (doc3 lot 1) : sauvegardes réutilisables par tools/measure-equipement-v913.mjs.
if (args.includes('--dump-saves')) writeFileSync(path.resolve(args[args.indexOf('--dump-saves') + 1]), JSON.stringify(S));

// --- 1. Bilan des gemmes ------------------------------------------------------------------------------------
// Combat : gemmes gagnées pendant 1 h de jeu actif mesurée sur chaque sauvegarde (monstres, niveaux,
// nouvelles étapes, boss, événements, sans rien récupérer).
const hourly = {};
for (const [k, s] of Object.entries(S)) {
  const c = clone(s);
  hourly[k] = play(c, 3600, { rngSeed: 11 });
}
const sumGems = (rewards) => rewards.reduce((a, r) => a + (r?.gems ?? 0), 0);
const missionGems = Object.fromEntries(MISSION_PERIODS.map((p) => [p.id, sumGems(p.missions.map((m) => m.reward)) + (p.bonus?.gems ?? 0)]));
const loginCycle = sumGems(LOGIN_CALENDAR);
// v9.1.3 (chantier 5) : hebdomadaires et mensuelles fondues dans la piste du mois (tous les paliers).
const trackGems = sumGems(MISSION_TRACK.tiers.map((t) => t.reward));
const achievementGems = ACHIEVEMENTS.reduce((a, x) => a + x.gems, 0);
const ACTIVE_H = 2; // hypothèse : 2 h de jeu actif par jour
const OFFLINE_H = 22;
const offlineGemShare = BALANCE.offline.gemShare * BALANCE.offline.farmMultiplier;
function gemTable(key) {
  const h = hourly[key];
  const combatDay = h.gems * ACTIVE_H;
  // Hors ligne : seule la part « gemmes de kill » compte (gemShare) ; les étapes nouvelles et niveaux non.
  const killGemsPerHour = h.kills * BALANCE.gems.killChance * ((BALANCE.gems.killAmount[0] + BALANCE.gems.killAmount[1]) / 2);
  const offlineDay = killGemsPerHour * offlineGemShare * Math.min(OFFLINE_H, BALANCE.offline.capHours);
  const rows = [
    ['Combat actif (2 h/jour, mesuré)', combatDay, combatDay * 7, combatDay * 30],
    ['Hors ligne (22 h, part des gemmes de kill)', offlineDay, offlineDay * 7, offlineDay * 30],
    ['Connexion (cycle de 7 jours, sans remise à zéro)', loginCycle / 7, loginCycle, (loginCycle / 7) * 30],
    ['Missions du jour (toutes + coffre)', missionGems.daily, missionGems.daily * 7, missionGems.daily * 30],
    ['Piste du mois (tous les paliers)', trackGems / 30, (trackGems / 30) * 7, trackGems],
    ['Prime du jour', BOUNTY.gems, BOUNTY.gems * 7, BOUNTY.gems * 30],
    [`Donjons (1 clé/jour, Facile)`, DUNGEON_REWARD.gems * DUNGEON_DIFFICULTIES.easy.gems, DUNGEON_REWARD.gems * DUNGEON_DIFFICULTIES.easy.gems * 7, DUNGEON_REWARD.gems * DUNGEON_DIFFICULTIES.easy.gems * 30],
  ];
  const total = rows.reduce((a, r) => [a[0] + r[1], a[1] + r[2], a[2] + r[3]], [0, 0, 0]);
  return { rows, total };
}

// --- 2. Éclats et essences ---------------------------------------------------------------------------------
const f = BALANCE.forge;

// --- 3. Part de l'équipement dans la puissance ------------------------------------------------------------
function gearShare(s) {
  const withGear = computeHeroStats(s);
  // v9.1.3 (doc3 lot 1) : le Musée n'est pas porté, il reste dans les deux calculs (avant, il était retiré du héros
  // « nu », ce qui gonflait le rapport : ×3 624 au lieu de ×1 542 sur la sauvegarde de fin).
  const naked = computeHeroStats(s, BALANCE, Object.fromEntries(Object.keys(s.equipment).map((k) => [k, null])));
  return { dps: withGear.dps / naked.dps, hp: withGear.maxHp / naked.maxHp };
}

// --- 4. Temps pour revenir à l'étape max après une Renaissance -------------------------------------------
function returnTime(s, { talents = true } = {}) {
  const c = clone(s);
  const target = c.maxStage;
  if (!canRebirth(c)) return null;
  const reward = rebirthReward(c);
  performRebirth(c);
  if (talents) buyTalentsCheapest(c);
  const r = play(c, (QUICK ? 6 : 24) * 3600, { stopAt: target, rngSeed: 21 });
  return { target, reward, seconds: r.seconds, reached: c.maxStage >= target, stage: c.maxStage };
}

// --- 5. Parcours chronométrés (appuis) --------------------------------------------------------------------
// Compte des appuis du parcours le plus court dans l'interface actuelle (modèle écrit d'après les panneaux :
// ouvrir un menu = 1, un sous-onglet = 1, chaque bouton = 1). Appliqué à l'état de la sauvegarde de fin.
function routes(s) {
  const c = clone(s);
  const out = [];
  // a) Réinvestir après une Renaissance : améliorations en « Max » (1 appui par amélioration, répété tant qu'un
  // achat reste possible), talents (« Tout apprendre » par région), compétences, équipement.
  const r = clone(c);
  performRebirth(r);
  r.gold = 0;
  const regions = new Set();
  const before = { ...r.talents };
  buyTalentsCheapest(r);
  for (const id of Object.keys(r.talents)) if (r.talents[id] !== before[id]) regions.add(talentById(id)?.region ?? id);
  const upgradeKeys = Object.keys(r.upgrades).length;
  out.push({ name: 'Réinvestir après une Renaissance', taps: 2 + 1 + 2 + regions.size * 2 + 2 + 1 + 2 + upgradeKeys,
    detail: `Renaître (2 : bouton + confirmation), Arbre (1), talents « Tout apprendre » : ${regions.size} région(s) × 2, compétences (2 : onglet + « Tout apprendre »), Améliorations (2 : onglet + Max), puis 1 appui par amélioration (${upgradeKeys}) dès que l'or revient` });
  // b) Changer de build : charger un build enregistré (Équipement › Builds) = menu, sous-onglet, déplier, charger.
  out.push({ name: 'Changer de build (build enregistré)', taps: 4, detail: 'Héros (1), Équipement (1), déplier « Builds » (1), charger (1) ; sans build enregistré : 1 appui par objet à porter (jusqu\'à 7) + choix des pouvoirs' });
  // c) Relancer un pouvoir : Aventure, Boss, choisir le boss, Relancer, confirmer.
  out.push({ name: 'Relancer un pouvoir', taps: 5, detail: 'Aventure (1), Boss (1), boss (1), « Relancer » (1), garder ou remplacer (1) ; il faut d\'abord une charge (réaffronter le boss)' });
  // d) Trier un sac plein : recyclage groupé (sélection de rareté + confirmation), puis objets restants un par un.
  const full = clone(c);
  // Sac rempli de butin réel du niveau de la sauvegarde (générateur du jeu).
  const lootRng = new Rng(77);
  while (full.inventory.length < BALANCE.loot.inventorySize) full.inventory.push(generateItem(full, lootRng, { level: full.maxStage }));
  const bulk = bulkRecycleCandidates(full, 'epic').length;
  const left = full.inventory.length - bulk;
  out.push({ name: 'Trier un sac plein', taps: 2 + 3 + Math.min(left, 10) * 2,
    detail: `Héros (1), Équipement (1), recyclage groupé jusqu'à Épique (3 : bouton, rareté, confirmation) qui retire ${bulk} objet(s) sur ${full.inventory.length} ; ${left} restent (verrouillés, meilleurs ou utiles), 2 appuis par objet examiné (10 au plus comptés)` });
  return out;
}

// --- Rapport ----------------------------------------------------------------------------------------------
const lines = [];
const P = (s = '') => lines.push(s);
P('# Mesures v9.1.3 (outil `tools/measure-v913.mjs`)');
P();
P(`Moteur réel (core/*.js) en Node, horloge fixée à un mercredi, hasard à graine fixe${QUICK ? ' — **mode rapide**' : ''}. Aucun réglage n'est modifié.`);
P('Les sauvegardes sont fabriquées par un joueur automatique (achat au meilleur gain de dégâts/s, meilleur équipement, compétences, recyclage) qui n\'existe pas dans le jeu.');
P();
P('## Sauvegardes simulées');
P();
P('| Sauvegarde | Temps de jeu | Étape max | Record | Niveau | Renaissances | Dégâts/s |');
P('|---|---|---|---|---|---|---|');
for (const [k, s] of Object.entries(S)) {
  const x = snapshot(s);
  P(`| ${k} | ${hms(x.hours * 3600)} | ${x.stage} | ${x.best} | ${x.level} | ${x.rebirths} | ${fmt(computeHeroStats(s).dps)} |`);
}
P();
P('## 1. Bilan des gemmes');
P();
P(`Hypothèse : ${ACTIVE_H} h de jeu actif par jour, le reste hors ligne (plafond ${BALANCE.offline.capHours} h), toutes les missions faites, une clé de donjon par jour. Gains uniques à part.`);
for (const k of Object.keys(S)) {
  const { rows, total } = gemTable(k);
  P();
  P(`### Sauvegarde « ${k} » (étape ${S[k].maxStage})`);
  P();
  P('| Source | Jour | Semaine | Mois |');
  P('|---|---|---|---|');
  for (const r of rows) P(`| ${r[0]} | ${fmt(r[1])} | ${fmt(r[2])} | ${fmt(r[3])} |`);
  P(`| **Total** | **${fmt(total[0])}** | **${fmt(total[1])}** | **${fmt(total[2])}** |`);
  P(`| Puits : invocations ×1 (${BALANCE.summon.gemCost}) / ×10 (${BALANCE.summon.tenPullGemCost}) | ${fmt(total[0] / BALANCE.summon.gemCost)} invoc. | ${fmt(total[1] / BALANCE.summon.tenPullGemCost)} × 10 | ${fmt(total[2] / BALANCE.summon.tenPullGemCost)} × 10 |`);
  P();
  P(`Combat mesuré sur 1 h : ${fmt(hourly[k].gems)} gemmes (${fmt(hourly[k].kills)} monstres).`);
}
P();
P(`Puits de gemmes du jeu : invocation (${BALANCE.summon.gemCost} l'unité, ${BALANCE.summon.tenPullGemCost} les 10) et réinitialisation des talents (${TALENT_RESPEC.gems}). Gains uniques : hauts faits ${fmt(achievementGems)} gemmes au total, premier boss ${BALANCE.summon.firstBossGems}.`);
P(`Connexion (S2b) : un cycle de 7 jours donne ${loginCycle} gemmes ; sans remise à zéro, un joueur qui vient 4 jours sur 7 gagne ${fmt(loginCycle * 4 / 7)} gemmes par semaine au lieu de rester sur les premières cases (${sumGems(LOGIN_CALENDAR.slice(0, 2)) * 2} pour 2 séries de 2 jours).`);
P();
P('## 2. Éclats (essences fondues dans les éclats)');
P();
P('| Sauvegarde | Éclats / h | Recyclés auto / h | Fusions / h |');
P('|---|---|---|---|');
for (const k of Object.keys(S)) P(`| ${k} | ${fmt(hourly[k].shards)} | ${fmt(hourly[k].fate.recycle + hourly[k].swept)} | ${fmt(hourly[k].fused)} |`);
P();
P(`Puits (forge) : fabriquer un Rare ${f.craftShards} éclats, un Épique ${f.epicCraft.shards} éclats, relancer les effets ${f.reforgeShards} éclats, renforcer ${f.upgradeShards} × (niveau + 1) éclats.`);
P();
P('## 3. Part de l\'équipement dans la puissance');
P();
P('| Sauvegarde | Dégâts/s avec / sans équipement | PV avec / sans |');
P('|---|---|---|');
for (const k of Object.keys(S)) { const g = gearShare(S[k]); P(`| ${k} | ×${fmt(g.dps)} | ×${fmt(g.hp)} |`); }
P();
P('## 4. Chemins de butin (1 h de jeu actif)');
P();
P('| Sauvegarde | Objets | dont boss | Sac | Recyclés au ramassage | Mannequins | Musée | Raretés |');
P('|---|---|---|---|---|---|---|---|');
for (const k of Object.keys(S)) {
  const h = hourly[k];
  const n = h.drops.monstres + h.drops.boss;
  P(`| ${k} | ${n} | ${h.drops.boss} | ${h.fate.sac} | ${h.fate.recycle} | ${h.fate.mannequin} | ${h.fate.musee} | ${Object.entries(h.rarities).map(([r, c]) => `${rarityById(r)?.label ?? r} ${pct(c / Math.max(1, n))}`).join(', ')} |`);
}
P();
P('## 5. Temps de jeu pour revenir à l\'étape max après une Renaissance');
P();
P('| Sauvegarde | Étape max | Fragments gagnés | Retour (talents achetés) | Retour (sans talents) |');
P('|---|---|---|---|---|');
for (const k of ['milieu', 'fin']) {
  const a = returnTime(S[k]);
  const b = returnTime(S[k], { talents: false });
  if (!a) { P(`| ${k} | ${S[k].maxStage} | — | Renaissance impossible | — |`); continue; }
  const cell = (x) => (x.reached ? hms(x.seconds) : `non atteint en ${hms(x.seconds)} (étape ${x.stage})`);
  P(`| ${k} | ${a.target} | ${a.reward} | ${cell(a)} | ${cell(b)} |`);
}
P();
P(`Renaissance possible dès l'étape ${REBIRTH.minStage}. Le temps est du temps de combat simulé à ×1.`);
P();
P('## 6. Parcours chronométrés (nombre d\'appuis, sauvegarde de fin)');
P();
P('| Parcours | Appuis | Détail |');
P('|---|---|---|');
for (const r of routes(S.fin)) P(`| ${r.name} | ${r.taps} | ${r.detail} |`);
P();
P('À refaire après chaque allègement : `node tools/measure-v913.mjs`. Les appuis suivent un modèle écrit d\'après les panneaux, à vérifier au doigt sur téléphone.');
P();
P(`_Temps de jeu simulé pour fabriquer les sauvegardes : ${hms(buildSeconds)}._`);

writeFileSync(OUT, `${lines.join('\n')}\n`);
console.log(`Écrit : ${path.relative(ROOT, OUT)}`);
