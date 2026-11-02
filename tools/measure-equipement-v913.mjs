#!/usr/bin/env node
// v9.1.3 (doc3 lot 1 « base propre ») : mesures de l'équipement avec le moteur réel (core/*.js) en Node, graine fixe.
// Outil seulement. Sauvegardes : celles de tools/measure-v913.mjs (`--dump-saves`), passées par `--saves`.
//   1. Faille d'or après Renaissance : or de recyclage du sac + coffre, sans plafond (avant) et plafonné (après),
//      comparé à l'or d'une heure de farm à l'étape de reprise.
//   2. Bilan des éclats (essences fondues) : sources et dépenses par heure de jeu actif.
//   3. Part de l'équipement dans la puissance (Musée gardé : il n'est pas porté).
//   4. 24 h sac plein (2 h actives + 22 h hors ligne + sources payées chaque heure) : aucun objet payé ou verrouillé perdu.
//
// Usage : node tools/measure-equipement-v913.mjs --saves <saves.json> [--hours 24]
import { readFileSync } from 'node:fs';

const T0 = new Date(2026, 9, 21, 10).getTime();
let simMs = 0;
Date.now = () => T0 + simMs;
let seed = 0x2545f491;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

const { BALANCE } = await import('../src/data/balance.js');
const { sanitizeState } = await import('../src/core/state.js');
const { createCombat, step, referenceKillGold } = await import('../src/core/combat.js');
const { buyMostProfitable } = await import('../src/core/profit.js');
const { addToInventory, equipBest, sweepInventory } = await import('../src/core/inventory.js');
const { autoFuse, craftItem, fuseItems, fusionGroups, fusionKeep } = await import('../src/core/forge.js');
const { distributeSkillPoints } = await import('../src/core/skills.js');
const { canRebirth, performRebirth } = await import('../src/core/rebirth.js');
const { computeHeroStats } = await import('../src/core/stats.js');
const { Rng } = await import('../src/core/rng.js');
const { generateItem, itemBase, itemPower, recycleLevelOf, recycleMaterials, recycleValue } = await import('../src/core/loot.js');
const { measureFarmRate, computeOfflineRewards, applyOfflineRewards } = await import('../src/core/offline.js');
const { claimEvent } = await import('../src/core/events.js');
const { claimBounty, dailyBounty } = await import('../src/core/bounty.js');
const { completeDungeon } = await import('../src/core/dungeon.js');
const { bestSetPiece, STASH_SIZE } = await import('../src/core/stash.js');
const { setHeroClass, classUnlocked } = await import('../src/core/classes.js');
const { CLASSES } = await import('../src/data/classes.js');
const { DUNGEONS } = await import('../src/data/dungeons.js');

const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const RAW = JSON.parse(readFileSync(arg('--saves'), 'utf8'));
const HOURS = Number(arg('--hours', 24));
const S = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, sanitizeState(v)]));
const clone = (s) => structuredClone(s);
const fmt = (n) => (n !== 0 && Math.abs(n) < 0.05 ? n.toExponential(1).replace('e', 'e') : Math.abs(n) >= 1e6 ? n.toExponential(2).replace('e+', 'e') : Math.abs(n) >= 100 ? Math.round(n).toLocaleString('fr-FR') : (Math.round(n * 10) / 10).toLocaleString('fr-FR'));
const DT = BALANCE.simulation.tickSeconds;
const P = (...x) => console.log(...x);

// --- 1. Faille d'or --------------------------------------------------------------------------------------
P('## 1. Faille d\'or après Renaissance');
P();
const lv200 = { rarity: 'epic', level: 200 };
P(`Épique niveau 200 : ${fmt(recycleValue(lv200))} or sans plafond ; plafonné à l'étape 5 : ${fmt(recycleValue(lv200, BALANCE, 5))} or.`);
P();
P('| Sauvegarde | Étape max → reprise | Objets recyclables | Or avant (sans plafond) | Or après (plafond) | Farm 1 h à la reprise | Avant / 1 h de farm | Après / 1 h de farm |');
P('|---|---|---|---|---|---|---|---|');
for (const k of ['milieu', 'fin']) {
  const c = clone(S[k]);
  const from = c.maxStage;
  if (!canRebirth(c)) continue;
  performRebirth(c);
  const pool = [...c.inventory, ...c.stash].filter((i) => !i.locked && !itemBase(i.baseId).signature);
  const before = pool.reduce((a, i) => a + recycleValue(i), 0);
  const after = pool.reduce((a, i) => a + recycleValue(i, BALANCE, recycleLevelOf(c)), 0);
  const hour = measureFarmRate(c, BALANCE, 60).goldPerSecond * 3600;
  P(`| ${k} | ${from} → ${c.maxStage} | ${pool.length} | ${fmt(before)} | ${fmt(after)} | ${fmt(hour)} | ×${fmt(before / hour)} | ×${fmt(after / hour)} |`);
}
// Recyclage normal : objets du niveau de l'étape en cours (butin du farm) — inchangé par le plafond.
const fin = S.fin;
const drop = { rarity: 'rare', level: fin.maxStage };
P();
P(`Recyclage normal (Rare de l'étape ${fin.maxStage}, sauvegarde de fin) : ${fmt(recycleValue(drop))} avant, ${fmt(recycleValue(drop, BALANCE, recycleLevelOf(fin)))} après (identique).`);
P();

// --- Joueur automatique (mesure seulement) -----------------------------------------------------------------
function play(state, seconds, rngSeed, wrap = (label, fn) => fn()) {
  const world = createCombat(state);
  const rng = new Rng(rngSeed);
  const acc = { recycled: {}, recycleShards: 0, sweepShards: 0, fusions: 0, drops: 0 };
  const sh0 = state.materials.shards;
  for (let i = 1; i <= Math.round(seconds / DT); i++) {
    wrap('combat', () => step(state, world, DT, rng));
    simMs += DT * 1000;
    for (const e of world.events) {
      if (e.type !== 'drop') continue;
      acc.drops += 1;
      if (e.autoRecycled) acc.recycleShards += recycleMaterials(e.item).shards;
    }
    world.events.length = 0;
    if (i % Math.round(5 / DT) === 0) {
      buyMostProfitable(state);
      equipBest(state);
      distributeSkillPoints(state);
      const a = state.materials.shards;
      acc.fusions += wrap('fusion auto (réglage du joueur)', () => autoFuse(state, rng)).length;
      wrap('recyclage auto (règle du joueur)', () => sweepInventory(state));
      acc.sweepShards += state.materials.shards - a;
    }
  }
  acc.total = state.materials.shards - sh0;
  return acc;
}

// --- 2. Éclats ---------------------------------------------------------------------------------------------
P('## 2. Bilan des éclats (1 h de jeu actif, essences fondues : 1 essence = 10 éclats)');
P();
P('| Sauvegarde | Total / h | Recyclage au ramassage et sac plein | Balayage du sac | Boss, événements, autres | Fusions auto / h |');
P('|---|---|---|---|---|---|');
const hourly = {};
for (const [k, s] of Object.entries(S)) {
  const c = clone(s);
  c.ui.recycle = { ...c.ui.recycle, mode: 'pickup' };
  const h = play(c, 3600, 11);
  hourly[k] = h;
  P(`| ${k} | ${fmt(h.total)} | ${fmt(h.recycleShards)} | ${fmt(h.sweepShards)} | ${fmt(h.total - h.recycleShards - h.sweepShards)} | ${h.fusions} |`);
}
const f = BALANCE.forge;
P();
P('Dépenses (prix actuels, data/balance.js `forge`) et nombre d\'actions payées par une heure d\'éclats :');
P();
P('| Dépense | Éclats | debut | milieu | fin |');
P('|---|---|---|---|---|');
const per = (cost) => Object.keys(S).map((k) => fmt(hourly[k].total / cost)).join(' | ');
P(`| Fabriquer (Rare ou mieux) | ${f.craftShards} | ${per(f.craftShards)} |`);
P(`| Fabriquer (Épique ou mieux) | ${f.epicCraft.shards} | ${per(f.epicCraft.shards)} |`);
P(`| Relancer les effets | ${f.reforgeShards} | ${per(f.reforgeShards)} |`);
P(`| Renforcer (1er niveau / 10e) | ${f.upgradeShards} / ${f.upgradeShards * 10} | ${per(f.upgradeShards * 5.5)} (moy.) |`);
P(`| Réaffûter (par niveau, Rare → Légendaire) | ${f.sharpenShardsPerLevel * 2} → ${f.sharpenShardsPerLevel * 5} | — | — | — |`);
P();

// --- 3. Part de l'équipement -------------------------------------------------------------------------------
P('## 3. Part de l\'équipement dans la puissance');
P();
P('Sans équipement = 7 emplacements vides (ensembles compris) ; le Musée reste (il n\'est pas porté). L\'ancien outil retirait aussi le Musée.');
P('« Part (log) » : part de l\'équipement dans le multiplicateur total des dégâts/s depuis le héros nu de niveau 1 sans rien.');
P();
P('| Sauvegarde | Étape | Dégâts/s avec / sans | Ancien calcul (sans Musée) | PV avec / sans | Part (log) dégâts/s |');
P('|---|---|---|---|---|---|');
const empty = (s) => Object.fromEntries(Object.keys(s.equipment).map((k) => [k, null]));
for (const [k, s] of Object.entries(S)) {
  const w = computeHeroStats(s);
  const n = computeHeroStats(s, BALANCE, empty(s));
  const old = computeHeroStats({ ...s, museum: {} }, BALANCE, empty(s));
  const base = BALANCE.hero.baseDamage / BALANCE.hero.baseAttackInterval;
  P(`| ${k} | ${s.maxStage} | ×${fmt(w.dps / n.dps)} | ×${fmt(w.dps / old.dps)} | ×${fmt(w.maxHp / n.maxHp)} | ${fmt((Math.log(w.dps / n.dps) / Math.log(w.dps / base)) * 100)} % |`);
}
P();

// --- 4. 24 h sac plein -------------------------------------------------------------------------------------
// Chaque opération est auditée : un objet payé ou verrouillé qui disparaît est attribué à l'opération. Seules les
// actions ou réglages du joueur (fusion, règle de recyclage) et la garde de la meilleure pièce d'ensemble (réglage du
// coffre, une pièce strictement meilleure du même ensemble la remplace) peuvent en retirer ; tout le reste est une perte.
P(`## 4. ${HOURS} h simulées sac plein (sauvegarde « milieu »)`);
P();
const s = clone(S.milieu);
s.gold = 1e30; s.materials.shards = 1e9; s.keys = 1e3;
s.ui.recycle = { ...s.ui.recycle, mode: 'pickup' };
const rng = new Rng(2424);
while (s.inventory.length < BALANCE.loot.inventorySize) s.inventory.push(generateItem(s, rng, { level: s.maxStage, minRarity: 'epic' }));
while (s.stash.length < STASH_SIZE - 10) s.stash.push(generateItem(s, rng, { level: s.maxStage, minRarity: 'epic' })); // coffre presque plein
for (const i of s.inventory.slice(0, 15)) i.locked = true;
const watched = new Map([...s.inventory, ...s.stash].filter((i) => i.locked).map((i) => [i.id, { item: i, name: 'verrouillé' }]));
const where = () => new Set([...s.inventory, ...s.stash, ...Object.values(s.equipment), ...Object.values(s.museum), ...s.inbox.map((e) => e.item)].filter(Boolean).map((i) => i.id));
const src = {};
const gone = {};
const pay = (name, item) => { if (item) { watched.set(item.id, { item, name }); src[name] = (src[name] ?? 0) + 1; } };
const ALLOWED = new Set(['fusion auto (réglage du joueur)', 'recyclage auto (règle du joueur)', 'fusion (choix du joueur)']);
function wrap(label, fn) {
  const before = where();
  const out = fn();
  const after = where();
  for (const id of before) {
    if (after.has(id) || !watched.has(id)) continue;
    const w = watched.get(id);
    watched.delete(id);
    const b = w.item.set && bestSetPiece(s, w.item.set, w.item.slot);
    const guard = b && itemPower(b) > itemPower(w.item) && !w.item.locked;
    const key = w.item.locked ? `PERTE verrouillé (${label})` : guard ? 'garde de la meilleure pièce (réglage du coffre)' : ALLOWED.has(label) ? label : `PERTE (${label}, ${w.name})`;
    gone[key] = (gone[key] ?? 0) + 1;
  }
  return out;
}
for (let h = 0; h < HOURS; h++) {
  if (h < 2) play(s, 3600, 100 + h, wrap);
  else wrap('hors ligne', () => { const r = computeOfflineRewards(s, Date.now() - 3600e3, Date.now(), rng); applyOfflineRewards(s, r); simMs += 3600e3; });
  // Sources payées, chaque heure.
  const d = DUNGEONS.find((x) => x.unlockStage <= s.maxStage) ?? DUNGEONS[0];
  s.dungeon = { id: d.id, room: d.rooms, kills: 0, slot: 'any', path: 'gold', level: s.maxStage, earned: {}, difficulty: 'easy', startPlay: 0 };
  wrap('donjon', () => pay('donjon', completeDungeon(s, rng).item));
  const b = dailyBounty(s, Date.now());
  if (!b.claimed) { s.codex.kills[b.type] = b.start + b.target; wrap('Prime', () => pay('Prime', claimBounty(s, rng, Date.now())?.item)); }
  const ev = { id: 90000 + h, type: 'chest', item: generateItem(s, rng, { level: s.maxStage, minRarity: 'rare' }), reward: {} };
  s.inbox.push(ev);
  pay('événement', ev.item);
  wrap('événement', () => claimEvent(s, ev.id));
  wrap('Forge', () => pay('Forge', craftItem(s, 'helmet', rng))); // refusée sac plein : rien n'est payé
  const g = fusionGroups(s, BALANCE, fusionKeep(s)).find((x) => x.auto); // v9.1.3 (doc3 lot 2) : { ok, item }
  if (g) wrap('fusion (choix du joueur)', () => pay('fusion', fuseItems(s, g.slot, g.rarity, rng, BALANCE, fusionKeep(s))?.item));
  const cls = CLASSES.filter((c) => classUnlocked(s, c.id) && c.id !== s.heroClass)[h % 3];
  if (cls) wrap('classe', () => { const w = s.equipment.weapon; if (setHeroClass(s, cls.id, itemPower) && w) pay('classe (arme portée avant)', w); });
}
P('| Source payée | Objets reçus |');
P('|---|---|');
for (const [k, v] of Object.entries(src)) P(`| ${k} | ${v} |`);
P();
P('| Sortie d\'un objet payé ou verrouillé | Objets |');
P('|---|---|');
for (const [k, v] of Object.entries(gone)) P(`| ${k} | ${v} |`);
const losses = Object.entries(gone).filter(([k]) => k.startsWith('PERTE')).reduce((a, [, v]) => a + v, 0);
P();
P(`**Pertes : ${losses}.** Fin : sac ${s.inventory.length}/${BALANCE.loot.inventorySize}, coffre ${s.stash.length}/${STASH_SIZE}, en attente ${s.inbox.filter((e) => e.type === 'held').length}.`);
if (losses) process.exitCode = 1;
