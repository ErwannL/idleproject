// v10.3 (parties 8 et 9) : Équipement et Forge — le « avant → après » du renforcement est le résultat réel, aucun
// nombre n'est écrit avec un point décimal, la fusion annonce la bonne chance (et suit la Forge du Bastion), elle ne
// prend jamais un objet porté ou verrouillé, et renforcer depuis la Forge donne le même résultat que depuis la fiche.
import test from 'node:test';
import { FORGE_PERKS } from '../src/data/bastion.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'getImageData' || k === 'createImageData'
    ? (x, y, w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0)) * 4), width: w, height: h })
    : k === 'measureText' ? () => ({ width: 1 }) : k in t ? t[k] : () => {}),
  set: (t, k, v) => { t[k] = v; return true; },
});
globalThis.document ??= { createElement: () => ({ width: 1, height: 1, getContext: () => ctx2d, toDataURL: () => 'data:' }) };

const { BALANCE } = await import('../src/data/balance.js');
const { createNewState, sanitizeState } = await import('../src/core/state.js');
const { generateItem, makeItem } = await import('../src/core/loot.js');
const { Rng } = await import('../src/core/rng.js');
const { computeHeroStats } = await import('../src/core/stats.js');
const forge = await import('../src/core/forge.js');
const inv = await import('../src/core/inventory.js');
const gear = await import('../src/core/companion-gear.js');
const { skillKillGold } = await import('../src/core/companions.js');
const { RESOURCES } = await import('../src/data/glossary.js');
const { TAB_LEAD } = await import('../src/ui/nav.js');
const { affixText } = await import('../src/ui/common.js');
const inventoryPanel = (await import('../src/ui/panels/inventory.js')).default;
const forgePanel = (await import('../src/ui/panels/forge.js')).default;
const { forgeNow } = await import('../src/ui/panels/forge.js');
const { reinforceSection } = await import('../src/ui/panels/equip-sheet.js');

const uiWith = (view = {}) => ({ view: { open: new Set(), closed: new Set(), ...view }, tabVisible: {} });
function rich(stage = 139) {
  const s = createNewState(Date.UTC(2026, 10, 20, 12));
  s.maxStage = stage; s.records.bestStage = stage;
  s.gold = 1e30; s.materials.shards = 1e6;
  return s;
}
// Texte affiché d'un gabarit (sans les balises ni leurs attributs).
const textOf = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
const endgame = () => sanitizeState(JSON.parse(readFileSync('tests/fixtures/endgame.json', 'utf8')));

test('renforcement : la stat renforcée est celle qui a reçu le moins de renforts (égalité : ordre des stats)', () => {
  const s = rich();
  const dagger = makeItem(s, 'dagger', 'epic', 50, BALANCE, new Rng(3)); // dégâts + vitesse (+ un effet spécial)
  s.inventory.push(dagger);
  const order = forge.upgradableStats(dagger);
  assert.ok(order.length >= 2);
  const got = [];
  for (let i = 0; i < order.length * 2; i++) {
    assert.equal(forge.nextUpgradeStat(dagger), order[i % order.length]);
    got.push(forge.upgradeItem(s, dagger.id, null));
  }
  assert.deepEqual(got, [...order, ...order], 'un tour complet avant de revenir à la première');
  // Le hasard n'entre plus en jeu : deux générateurs différents donnent la même stat.
  const a = makeItem(s, 'iron_helm', 'rare', 30, BALANCE, new Rng(1)); const b = JSON.parse(JSON.stringify(a)); b.id = 'copy';
  s.inventory.push(a, b);
  assert.equal(forge.upgradeItem(s, a.id, new Rng(1)), forge.upgradeItem(s, b.id, new Rng(999)));
});

test('renforcement : le « avant → après » annoncé est égal au résultat réel (objets tirés au hasard, plusieurs niveaux)', () => {
  const s = rich();
  const rng = new Rng(20261120);
  const items = Array.from({ length: 12 }, (_, i) => generateItem(s, rng, { level: 20 + i * 11 }));
  s.inventory.push(...items);
  s.equipment.weapon = makeItem(s, 'short_sword', 'legendary', 139, BALANCE, rng);
  s.equipment.ring = makeItem(s, 'band_ring_ruby', 'epic', 120, BALANCE, rng);
  let checked = 0;
  for (const item of [...items, s.equipment.weapon, s.equipment.ring]) {
    for (let n = 0; n < 4; n++) {
      const p = forge.upgradePreview(s, item);
      if (p.atMax) break;
      s.gold = p.cost.gold * 2; // or exact, quel que soit le coût
      const gold0 = s.gold, shards0 = s.materials.shards;
      const stat = forge.upgradeItem(s, item.id, new Rng(n + 1));
      assert.equal(stat, p.stat, `${item.name} : stat annoncée`);
      assert.equal(item.upgrades, p.level + 1);
      assert.deepEqual(item.stats, p.after.stats, `${item.name} : statistiques`);
      assert.deepEqual(item.affixes.map((a) => a.value), p.after.affixes.map((a) => a.value), `${item.name} : effets`);
      for (const r of p.rows) {
        const now = r.kind === 'stat' ? item.stats[r.stat] : item.affixes[r.key === 'main' ? 0 : Number(r.key.split(':')[1])].value;
        assert.equal(now, r.after, `${item.name} : ligne ${r.key}`);
      }
      assert.equal(s.gold, gold0 - p.cost.gold, 'or dépensé = coût annoncé');
      assert.equal(shards0 - s.materials.shards, p.cost.shards, 'éclats dépensés = coût annoncé');
      if (p.power?.worn) assert.equal(computeHeroStats(s).combatPower, p.power.after, `${item.name} : puissance annoncée`);
      checked += 1;
    }
  }
  assert.ok(checked >= 30, `${checked} renforcements vérifiés`);
});

test('renforcement : au maximum, plus d\'aperçu ; coût impayable → canPay faux et « il manque » exact', () => {
  const s = rich();
  const item = makeItem(s, 'iron_helm', 'common', 10, BALANCE, new Rng(2));
  s.equipment.helmet = item;
  while (forge.upgradeItem(s, item.id, null));
  const p = forge.upgradePreview(s, item);
  assert.equal(p.atMax, true);
  assert.equal(p.level, BALANCE.forge.maxUpgrades.common);
  assert.equal(p.max, forge.maxUpgrades(item, BALANCE, s));
  // Forge du Bastion niveau 1 : le plafond monte (FORGE_PERKS.maxUpgradePerLevel), l'aperçu revient.
  s.bastion = { buildings: { forge: { level: 1 } } };
  assert.equal(forge.upgradePreview(s, item).atMax, false);
  assert.equal(forge.upgradePreview(s, item).max, BALANCE.forge.maxUpgrades.common + FORGE_PERKS.maxUpgradePerLevel);
  const poor = rich(); poor.gold = 0; poor.materials.shards = 1;
  const it = makeItem(poor, 'iron_helm', 'epic', 10, BALANCE, new Rng(2)); poor.inventory.push(it);
  const q = forge.upgradePreview(poor, it);
  assert.equal(q.canPay, false);
  assert.equal(q.lack.shards, q.cost.shards - 1);
  assert.equal(q.lack.gold, q.cost.gold);
  assert.equal(forge.upgradeItem(poor, it.id, null), null);
});

test('aucun nombre avec un point décimal : bonus des compagnons, effets spéciaux, fiche, tuiles et Forge', () => {
  assert.equal(gear.statText({ atk: 55.2, hp: 32.8, cd: 4.5 }), '+55,2 % Attaque, +32,8 % PV, −4,5 % Recharge');
  assert.equal(affixText({ type: 'critChance', value: 2.4 }), '+2,4 % de coup critique');
  assert.equal(affixText({ type: 'lifesteal', value: 1.6 }), 'Vol de vie : 1,6 % des dégâts');
  const s = endgame();
  s.maxStage = Math.max(s.maxStage, 139); s.gold = 4.2e9; s.materials.shards = 79000;
  const rng = new Rng(7);
  for (let i = 0; i < 60; i++) s.inventory.push(generateItem(s, rng, { level: 100 + (i % 37) }));
  for (const it of [...s.inventory]) inv.equipItem(s, it.id);
  gear.equipBestAllGear(s);
  for (const it of Object.values(s.equipment).filter(Boolean)) { forge.upgradeItem(s, it.id, null); forge.upgradeItem(s, it.id, null); }
  const team = s.companions.equipped.filter((id) => Object.values(gear.unitGear(s, id)).some(Boolean));
  assert.ok(team.length > 0, 'au moins un compagnon équipé dans la sauvegarde de référence');
  for (const id of team) for (const it of Object.values(gear.unitGear(s, id)).filter(Boolean)) gear.upgradeGear(s, it.id, skillKillGold(s));
  const views = [{}, { eqTab: 'overview' }, { eqQuick: 'hero' }, { eqChange: true }, { eqSlot: 'ring' }, { selectedItemId: s.inventory[0]?.id },
    ...Object.keys(s.equipment).map((slot) => ({ eqSlot: slot })),
    ...team.flatMap((id) => [{ gearWho: id }, { gearWho: id, eqTab: 'overview' }, { gearWho: id, eqTab: 'stars' }, { gearWho: id, eqTab: 'skills', skillPop: 'active' }, { gearWho: id, eqTab: 'skills', skillPop: 'ultimate' },
      { gearWho: id, eqSlot: 'weapon' }, { gearWho: id, eqSlot: 'armor' }, { gearWho: id, eqSlot: 'accessory' }, { gearWho: id, eqQuick: id }])];
  let seen = 0;
  for (const v of views) {
    const text = textOf(inventoryPanel.render(uiWith(v), s));
    assert.ok(!/\d\.\d/.test(text), `Équipement ${JSON.stringify(v)} : « ${text.match(/.{30}\d\.\d.{20}/)?.[0]} »`);
    seen += 1;
  }
  for (const seg of ['recycle', 'upgrade', 'fuse', 'craft']) {
    const text = textOf(forgePanel.render(uiWith({ forgeSeg: seg }), s));
    assert.ok(!/\d\.\d/.test(text), `Forge ${seg} : « ${text.match(/.{30}\d\.\d.{20}/)?.[0]} »`);
  }
  assert.ok(seen >= 20);
  // Les bonus de classe d'un compagnon sont écrits avec une virgule dans sa fiche d'objet.
  const html = inventoryPanel.render(uiWith({ gearWho: team[0] }), s);
  assert.match(textOf(html), /[+−]\d+(,\d)? % (Attaque|PV|Défense|Soins et soutien|Recharge)/);
});

test('fusion : 30 % à 3, 65 % à 4, 100 % à 5 ; la Forge du Bastion ajoute 5 points par niveau (plafond 95 %)', () => {
  const s = rich();
  const chance = (stake, st = s) => forge.fusionChance(st, 'weapon', 'epic', stake);
  assert.deepEqual([3, 4, 5].map((n) => chance(n)), [30, 65, 100]);
  s.bastion = { buildings: { forge: { level: 2 } } };
  assert.deepEqual([3, 4, 5].map((n) => chance(n)), [40, 75, 100]);
  s.bastion.buildings.forge.level = 30;
  assert.deepEqual([3, 4, 5].map((n) => chance(n)), [95, 95, 100]);
  // L'écran annonce la chance de la mise possible : 3, 4 puis 5 objets dans le sac.
  const t = rich();
  const rng = new Rng(4);
  t.equipment.weapon = makeItem(t, 'short_sword', 'legendary', 400, BALANCE, rng); // mieux armé : les Épiques du sac ne sont plus protégées
  const add = () => { const it = makeItem(t, 'short_sword', 'epic', 100 + t.inventory.length, BALANCE, rng); t.inventory.push(it); return it; };
  add(); add();
  assert.equal(forge.fusionPreview(t, 'weapon', 'epic').stake, null, '2 objets : aucune mise');
  for (const [n, pct] of [[3, 30], [4, 65], [5, 100]]) {
    add();
    const p = forge.fusionPreview(t, 'weapon', 'epic');
    assert.equal(p.stake, n); assert.equal(p.chance, pct); assert.equal(p.used.length, n);
    assert.equal(p.level, Math.max(...p.used.map((i) => i.level)));
    assert.equal(p.next, 'legendary');
    const html = forgePanel.render(uiWith({ forgeSeg: 'fuse', fuseOpen: 'weapon|epic' }), t);
    assert.ok(html.includes(`data-stake="${n}">Fusionner (${n} objets · ${pct} %)`), `bouton de la mise de ${n}`);
  }
  // Avec la Forge du Bastion niveau 2, l'écran et la règle disent la même chose (75 % à 4).
  t.inventory.pop();
  t.bastion = { buildings: { forge: { level: 2 } } };
  assert.equal(forge.fusionPreview(t, 'weapon', 'epic').chance, 75);
  assert.ok(forgePanel.render(uiWith({ forgeSeg: 'fuse', fuseOpen: 'weapon|epic' }), t).includes('Fusionner (4 objets · 75 %)'));
  // Règle de pitié : un échec ajoute 20 points à la tentative suivante.
  t.fusionPity = { 'weapon|epic': 20 };
  assert.equal(forge.fusionPreview(t, 'weapon', 'epic').chance, 95);
  assert.equal(forge.fusionPreview(t, 'weapon', 'epic').pityStep, 20);
});

test('fusion : jamais un objet porté ni un objet verrouillé, ni dans les cases ni dans la fusion', () => {
  const s = rich();
  const rng = new Rng(9);
  const mk = (lvl) => makeItem(s, 'short_sword', 'epic', lvl, BALANCE, rng);
  const worn = mk(10); s.equipment.weapon = worn; // le moins bon de tous : il serait pris en premier s'il comptait
  const locked = mk(11); locked.locked = true;
  const free = [mk(60), mk(61), mk(62), mk(63), mk(64)];
  s.inventory.push(locked, ...free);
  const p = forge.fusionPreview(s, 'weapon', 'epic');
  assert.equal(p.used.length, 5);
  assert.ok(!p.used.some((i) => i.id === worn.id || i.id === locked.id));
  assert.deepEqual(p.used.map((i) => i.id).sort(), free.map((i) => i.id).sort());
  const r = forge.fuseItems(s, 'weapon', 'epic', new Rng(1));
  assert.ok(r?.ok);
  assert.equal(s.equipment.weapon.id, worn.id, 'l\'objet porté est toujours porté');
  assert.ok(s.inventory.some((i) => i.id === locked.id), 'l\'objet verrouillé est toujours dans le sac');
  assert.ok(!free.some((f) => s.inventory.some((i) => i.id === f.id)), 'les 5 objets libres sont consommés');
  // Avec le filtre de protection de l'écran (fusionKeep) : toujours ni porté ni verrouillé.
  const t = rich();
  const w2 = makeItem(t, 'short_sword', 'epic', 200, BALANCE, rng); t.equipment.weapon = w2;
  const l2 = makeItem(t, 'short_sword', 'epic', 20, BALANCE, rng); l2.locked = true;
  t.inventory.push(l2, ...[30, 31, 32, 33].map((lvl) => makeItem(t, 'short_sword', 'epic', lvl, BALANCE, rng)));
  const q = forge.fusionPreview(t, 'weapon', 'epic', forge.fusionKeep(t));
  assert.equal(q.stake, 4);
  assert.ok(!q.used.some((i) => i.locked || i.id === w2.id));
  const html = forgePanel.render(uiWith({ forgeSeg: 'fuse', fuseOpen: 'weapon|epic' }), t);
  assert.ok(html.includes('Fusionner (4 objets · 65 %)') && !html.includes(`title="${l2.name}"`.replace('title', 'data-x')));
});

test('Forge : renforcer depuis l\'atelier 2 = même section et même résultat que depuis la fiche d\'objet', () => {
  const s = rich();
  const rng = new Rng(11);
  s.equipment.weapon = makeItem(s, 'dagger', 'epic', 130, BALANCE, rng);
  s.equipment.armor = makeItem(s, 'chainmail', 'rare', 120, BALANCE, rng);
  s.equipment.ring = makeItem(s, 'band_ring_ruby', 'legendary', 110, BALANCE, rng);
  const ranking = forge.upgradeRanking(s);
  assert.equal(ranking.length, 3);
  for (let i = 1; i < ranking.length; i++) assert.ok(ranking[i - 1].perShard >= ranking[i].perShard, 'trié par gain de puissance par éclat');
  for (const { item } of ranking) {
    const section = reinforceSection(uiWith(), s, item);
    const sheet = inventoryPanel.render(uiWith({ selectedItemId: item.id, sheetOpen: 'item' }), s);
    const atelier = forgePanel.render(uiWith({ forgeSeg: 'upgrade', forgeUpSel: item.id }), s);
    assert.ok(sheet.includes(section), `${item.name} : section de la fiche`);
    assert.ok(atelier.includes(section), `${item.name} : même section dans la Forge`);
    assert.ok(section.includes(`data-action="upgrade-item" data-id="${item.id}"`), 'même action des deux côtés');
  }
  // Même action, donc même résultat : deux parties identiques, l'une renforce « depuis la fiche », l'autre « depuis la Forge ».
  const a = JSON.parse(JSON.stringify(s)), b = JSON.parse(JSON.stringify(s));
  const id = ranking[0].item.id;
  const p = forge.upgradePreview(a, a.equipment[ranking[0].slot]);
  assert.equal(forge.upgradeItem(a, id, new Rng(1)), forge.upgradeItem(b, id, new Rng(2)));
  assert.deepEqual(a.equipment, b.equipment);
  assert.equal(a.gold, b.gold); assert.equal(a.materials.shards, b.materials.shards);
  assert.deepEqual(a.equipment[ranking[0].slot].stats, p.after.stats);
});

test('Forge : les 4 ateliers disent ce qu\'on peut faire maintenant (3 objets inutiles, 11 armes Épiques)', () => {
  const s = rich(139);
  const rng = new Rng(5);
  s.equipment.weapon = makeItem(s, 'short_sword', 'legendary', 139, BALANCE, rng);
  s.equipment.helmet = makeItem(s, 'iron_helm', 'legendary', 139, BALANCE, rng);
  for (let i = 0; i < 11; i++) s.inventory.push(makeItem(s, 'short_sword', 'epic', 100 + i, BALANCE, null));
  for (let i = 0; i < 3; i++) s.inventory.push(makeItem(s, 'iron_helm', 'common', 20 + i, BALANCE, null));
  const now = forgeNow(s);
  assert.equal(now.preview.list.filter((i) => i.rarity === 'common').length, 3);
  assert.ok(now.recycle.ok && now.recycle.text.startsWith(`${now.preview.list.length} objets inutiles → +${now.preview.shards} éclats, +`), now.recycle.text);
  assert.ok(now.upgrade.ok && /\+0 → \+1 : \+[\d,]+ % de puissance$/.test(now.upgrade.text), now.upgrade.text);
  assert.ok(now.craft.ok && /Épique ou mieux/.test(now.craft.text), now.craft.text);
  // 11 armes Épiques : protégées du recyclage et de la fusion tant qu'elles servent ; une fois le héros mieux armé,
  // la ligne annonce 2 fusions sûres (5 objets chacune), et le bouton de l'atelier le compte.
  const groups = forge.fusionGroups(s, BALANCE, forge.fusionKeep(s));
  const g = groups.find((x) => x.slot === 'weapon' && x.rarity === 'epic');
  assert.equal(g.bag, 11);
  if (g.usable === 11) assert.equal(now.fuse.text, '11 × Arme Épique → 2 × Légendaire, sans risque');
  else assert.ok(now.fuse.text.length > 0);
  const html = forgePanel.render(uiWith(), s);
  for (const title of ['Recycler', 'Renforcer', 'Fusionner', 'Fabriquer']) assert.ok(html.includes(`<b>${title}</b>`), title);
  assert.deepEqual([...html.matchAll(/class="fg-num">(\d)</g)].map((m) => m[1]), ['1', '2', '3', '4'], 'numérotés dans l\'ordre de la boucle');
  assert.equal((html.match(/class="fg-arrow"/g) ?? []).length, 3, 'reliés par des flèches');
  assert.equal((html.match(/class="fg-now /g) ?? []).length, 4, 'une ligne « maintenant » par atelier');
  assert.ok(html.indexOf('data-action="recycle-useless"') > 0 && html.indexOf('data-action="recycle-useless"') < html.indexOf('data-action="forge-seg" data-value="upgrade">Renforcer'));
  assert.ok(!html.includes('forge_hall.png'), 'une seule illustration en tête (la bannière de l\'onglet)');
});

test('Fabriquer : la place en icônes, les chances de rareté et le niveau du résultat', () => {
  const odds = forge.craftOdds('rare');
  assert.deepEqual(odds.map((o) => o.rarity), ['rare', 'epic', 'legendary']);
  assert.ok(Math.abs(odds.reduce((t, o) => t + o.pct, 0) - 100) < 1e-9);
  assert.deepEqual(forge.craftOdds('epic').map((o) => Math.round(o.pct * 10) / 10), [87.5, 12.5]);
  // Les chances annoncées sont celles du tirage : 4000 fabrications Rare+.
  const s = rich(60); const rng = new Rng(77); const seen = { rare: 0, epic: 0, legendary: 0 };
  for (let i = 0; i < 4000; i++) { s.inventory = []; seen[forge.craftItem(s, 'helmet', rng).rarity] += 1; }
  for (const o of odds) assert.ok(Math.abs(seen[o.rarity] / 40 - o.pct) < 2.5, `${o.rarity} : ${seen[o.rarity] / 40} % tirés pour ${o.pct} % annoncés`);
  const html = forgePanel.render(uiWith({ forgeSeg: 'craft', craftSlot: 'ring' }), s);
  assert.equal((html.match(/data-action="craft-slot" data-value="/g) ?? []).length, 7, '7 places en icônes');
  assert.ok(!html.includes('<select'), 'plus de liste déroulante');
  assert.match(textOf(html), /Tu reçois : Anneau , niveau \d+ , ton étape max/);
  assert.match(textOf(html), /73 % Rare/);
  assert.ok(html.includes('data-action="craft" data-value="ring" data-tier="rare"') && html.includes('data-tier="epic"'));
  assert.ok(html.includes('data-action="bastion-open" data-value="forge"'), 'Bastion ouvert (étape 60) : commander au forgeron');
  assert.ok(!forgePanel.render(uiWith({ forgeSeg: 'craft' }), rich(20)).includes('bastion-open'), 'avant l\'étape 40 : pas de ligne Bastion');
});

test('Équipement rapide : le « avant → après » de la confirmation est le résultat réel ; « Retirer » rend l\'objet au sac', () => {
  const s = rich();
  const rng = new Rng(13);
  for (let i = 0; i < 40; i++) s.inventory.push(generateItem(s, rng, { level: 60 + i }));
  const plan = inv.quickEquipPlan(s);
  assert.ok(plan.changes.length >= 3, `${plan.changes.length} places à équiper`);
  assert.equal(plan.before, computeHeroStats(s).combatPower);
  const n = inv.quickEquipHero(s);
  assert.equal(n, plan.changes.length);
  for (const c of plan.changes) assert.equal(s.equipment[c.slot].id, c.to.id);
  assert.equal(computeHeroStats(s).combatPower, plan.after, 'puissance annoncée = puissance obtenue');
  assert.ok(plan.after > plan.before);
  // Retirer : la place est vide, l'objet est dans le sac (jamais perdu).
  const helm = s.equipment.helmet ?? s.equipment.weapon; const slot = s.equipment.helmet ? 'helmet' : 'weapon';
  const size = s.inventory.length;
  assert.equal(inv.unequipItem(s, slot), true);
  assert.equal(s.equipment[slot], null);
  assert.equal(s.inventory.length, size + 1);
  assert.ok(s.inventory.some((i) => i.id === helm.id));
  assert.equal(inv.unequipItem(s, slot), false);
});

test('fiche d\'objet : coût pièce par pièce (« tu as » / « il manque »), bandeau « ce qui bloque », compagnon à 3 places', () => {
  const s = rich();
  s.equipment.weapon = makeItem(s, 'short_sword', 'epic', 139, BALANCE, new Rng(1));
  let html = inventoryPanel.render(uiWith(), s);
  assert.ok(html.includes('tu as ') && !html.includes('il manque '));
  assert.match(html, /Renforcer : <b>\+0 → \+1<\/b>/);
  assert.match(html, /Stat renforcée : <b>Dégâts<\/b>/);
  s.materials.shards = 0;
  html = inventoryPanel.render(uiWith(), s);
  assert.match(html, /il manque 2<\/span><button class="eq-where" data-gloss="shards">Où en gagner<\/button><button class="eq-plusbtn" data-gloss="shards"/);
  assert.match(html, /data-action="upgrade-item"[^>]*disabled/);
  // Au maximum : bandeau rouge. Avant l'étape 40 il annonce le Bastion ; ensuite il mène à la Forge du Bastion.
  s.materials.shards = 1e6;
  while (forge.upgradeItem(s, s.equipment.weapon.id, null));
  html = inventoryPanel.render(uiWith(), s);
  assert.ok(html.includes('Au-delà de +10 : Forge du Bastion niveau 1 requise ›') && html.includes('data-action="bastion-open" data-value="forge"'));
  const early = rich(20); early.equipment.weapon = makeItem(early, 'short_sword', 'common', 5, BALANCE, new Rng(1));
  while (forge.upgradeItem(early, early.equipment.weapon.id, null));
  assert.ok(inventoryPanel.render(uiWith(), early).includes('Au-delà de +5 : le Bastion ouvre à l\'étape 40'));
  // Compagnon : 3 places, onglets Étoiles et Compétences, tuiles Attaque / PV / Défense / Recharge.
  const e = endgame();
  const id = e.companions.equipped[0];
  const unit = inventoryPanel.render(uiWith({ gearWho: id }), e);
  assert.equal((unit.match(/class="eq-slot[ "]/g) ?? []).length, 3);
  for (const t of ['Vue d\'ensemble', 'Équipement', 'Étoiles', 'Compétences', 'Attaque', 'PV', 'Défense', 'Recharge']) assert.ok(unit.includes(`>${t}<`), t);
  const hero = inventoryPanel.render(uiWith(), e);
  assert.ok(!hero.includes('data-value="stars"') && hero.includes('Dégâts/s') && hero.includes('Critique'), 'héros : pas d\'onglet Étoiles');
});

test('glossaire et phrase de la Forge', () => {
  assert.equal(RESOURCES.shards.where, 'Recycler un objet en donne.');
  assert.equal(RESOURCES.shards.use, 'Sert à renforcer, fusionner et fabriquer.');
  assert.deepEqual(RESOURCES.shards.view, { forgeSeg: 'recycle' });
  assert.equal(TAB_LEAD.forge, 'Les objets dont tu n\'as plus besoin deviennent des éclats. Les éclats rendent tes bons objets plus forts.');
});
