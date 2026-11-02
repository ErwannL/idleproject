#!/usr/bin/env node
// v9.1.3 (doc3 lot 2 « fusion à pourcentage ») : mesures de la fusion avec le moteur réel (core/*.js), graine fixe.
// Outil seulement.
//   1. Filtre de classe : Légendaires portables (arme de la classe active) pour 1 000 objets ramassés, fusion auto
//      de toutes les raretés (mise de 5). Lancer aussi sur l'ancienne version (git worktree) pour l'« avant » :
//      seule autoFuse est utilisée, elle existe dans les deux.
//   2. Coût d'un Légendaire selon la mise (Communs consommés en moyenne, pire cas en essais).
//   3. Or et éclats : recyclage des objets consommés comparé au recyclage de ce que la fusion rend (boucle
//      fusion → recyclage), au niveau 200, sans plafond puis après Renaissance (plafond maxStage = 1).
//
// Usage : node tools/measure-fusion-v913.mjs [--objects 200000] [--only-class]
const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const OBJECTS = Number(arg('--objects', 200000));

const { BALANCE } = await import('../src/data/balance.js');
const { createNewState } = await import('../src/core/state.js');
const forge = await import('../src/core/forge.js');
const { Rng } = await import('../src/core/rng.js');
const { generateItem, makeItem, recycleValue, recycleMaterials } = await import('../src/core/loot.js');
const { canEquip, classWeaponBases } = await import('../src/core/classes.js');
const { ITEM_BASES } = await import('../src/data/items.js');

const fmt = (x, d = 2) => x.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d });

// --- 1. Légendaires portables / 1 000 objets -------------------------------------------------------------------
function portableLegendaries(seed) {
  const s = createNewState(0, seed);
  s.maxStage = 100;
  s.ui.recycle = { mode: 'off', rarities: [], slots: [], keepAffixes: [] };
  s.ui.autoFuse = { on: true, rarities: ['common', 'rare', 'epic'] };
  const rng = new Rng(seed);
  // Équipement imbattable : aucun objet n'est « meilleur que l'équipé » (sinon tout serait protégé).
  for (const slot of Object.keys(s.equipment)) {
    const base = slot === 'weapon' ? classWeaponBases(s.heroClass ?? 'warrior')[0] ?? ITEM_BASES.find((b) => b.slot === slot)
      : ITEM_BASES.find((b) => b.slot === slot && !b.signature);
    s.equipment[slot] = makeItem(s, base.id, 'legendary', 5000, BALANCE, rng);
  }
  let legend = 0; let portable = 0; let dropped = 0; let droppedPortable = 0;
  const count = (i) => { if (i.rarity === 'legendary' && i.slot === 'weapon') { legend += 1; if (canEquip(s, i)) portable += 1; } };
  for (let k = 0; k < OBJECTS; k++) {
    const it = generateItem(s, rng, { level: 100 });
    if (it.rarity === 'legendary') { if (it.slot === 'weapon') { dropped += 1; if (canEquip(s, it)) droppedPortable += 1; } continue; }
    s.inventory.push(it);
    if (s.inventory.length >= 90 || k === OBJECTS - 1) {
      for (const made of forge.autoFuse(s, rng)) count(made);
      // Légendaires sortis du sac (comptés), le reste attend la suite.
      s.inventory = s.inventory.filter((i) => i.rarity !== 'legendary');
      if (s.inventory.length >= 90) s.inventory.splice(0, 30); // reste trop éparpillé : on évite le blocage
    }
  }
  return { legend, portable, dropped, droppedPortable };
}

const r = [1, 2, 3].map((x) => portableLegendaries(0x9e3779b9 + x));
const sum = (k) => r.reduce((t, x) => t + x[k], 0);
const per1000 = (k) => (sum(k) / (OBJECTS * r.length)) * 1000;
console.log('## 1. Légendaires (armes) pour 1 000 objets ramassés, fusion auto de tout (mise de 5)\n');
console.log('| Par la fusion | dont portables | Tombés directement | dont portables | Total portables |');
console.log('|---|---|---|---|---|');
console.log(`| ${fmt(per1000('legend'))} | ${fmt(per1000('portable'))} | ${fmt(per1000('dropped'))} | ${fmt(per1000('droppedPortable'))} | ${fmt(per1000('portable') + per1000('droppedPortable'))} |`);
if (args.includes('--only-class') || !forge.fusionChance) process.exit(0);

// --- 2. Coût d'un Légendaire selon la mise -----------------------------------------------------------------------
// Une tentative à la mise m consomme des Épiques ; un Épique coûte 25 Communs (deux fusions 5 pour 1 sûres).
console.log('\n## 2. Épique → Légendaire selon la mise (100 000 Légendaires par mise, jauge comprise)\n');
console.log('| Mise | Épiques par Légendaire | Communs par Légendaire | Essais max | Pire cas (Épiques) |');
console.log('|---|---|---|---|---|');
for (const stake of [5, 4, 3]) {
  const s = createNewState(0, 7);
  const rng = new Rng(1000 + stake);
  let epics = 0; let worstTries = 0; let worstEpics = 0;
  const N = 100000;
  for (let n = 0; n < N; n++) {
    let tries = 0; let used = 0;
    for (;;) {
      s.inventory = [];
      for (let k = 0; k < stake; k++) s.inventory.push(makeItem(s, 'iron_helm', 'epic', 10 + k));
      const res = forge.fuseItems(s, 'helmet', 'epic', rng, BALANCE, null, stake);
      tries += 1;
      used += res.ok ? stake : stake - 1; // l'objet rendu resservira à la tentative suivante
      if (res.ok) break;
    }
    epics += used;
    worstTries = Math.max(worstTries, tries);
    worstEpics = Math.max(worstEpics, used); // Épiques consommés (le rendu final compris dans la réussite)
  }
  console.log(`| ${stake} | ${fmt(epics / N)} | ${fmt((epics / N) * 25, 1)} | ${worstTries} | ${worstEpics} |`);
}

// --- 3. Or et éclats : fusion puis recyclage -------------------------------------------------------------------
console.log('\n## 3. Boucle fusion → recyclage (or et éclats rendus / or et éclats des objets consommés)\n');
console.log('| Fusion | Mise | Niveau 200, sans plafond : or | éclats | Après Renaissance (plafond étape 1) : or | éclats |');
console.log('|---|---|---|---|---|---|');
const PAIRS = [['common', 5], ['rare', 5], ['epic', 5], ['epic', 4], ['epic', 3]];
for (const [rarity, stake] of PAIRS) {
  const out = [];
  for (const cap of [Infinity, 1]) {
    const s = createNewState(0, 11);
    const rng = new Rng(77);
    let inGold = 0; let outGold = 0; let inShards = 0; let outShards = 0;
    for (let n = 0; n < 20000; n++) {
      s.inventory = [];
      for (let k = 0; k < stake; k++) s.inventory.push(makeItem(s, 'iron_helm', rarity, 200 - k));
      const before = [...s.inventory];
      const res = forge.fuseItems(s, 'helmet', rarity, rng, BALANCE, null, stake);
      for (const i of before) { inGold += recycleValue(i, BALANCE, cap); inShards += recycleMaterials(i).shards; }
      for (const i of s.inventory) { outGold += recycleValue(i, BALANCE, cap); outShards += recycleMaterials(i).shards; }
      if (!res.ok) continue;
    }
    out.push(fmt(outGold / inGold, 3), fmt(outShards / inShards, 3));
  }
  console.log(`| ${rarity} | ${stake} | ${out.join(' | ')} |`);
}
console.log('\nUn rapport < 1 : fusionner puis recycler rend moins que recycler directement (aucune boucle d\'or).');
