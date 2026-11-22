// v9.1.3 (doc3 lot 2) : fusion à pourcentage — règles, garanties, protection, sauvegarde, interface.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/data/balance.js';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { autoFuse, fuseAll, fuseItems, fusionChance, fusionFailText, fusionGroups, fusionKeep, fusionPool, fusionStakes, fusableRarities } from '../src/core/forge.js';
import { makeItem } from '../src/core/loot.js';
import { canEquip, classWeaponBases } from '../src/core/classes.js';
import { performRebirth } from '../src/core/rebirth.js';
import { REPEATABLE } from '../src/ui/hold.js';
import { Rng } from '../src/core/rng.js';
import { ITEM_BASES, HERO_PLACE } from '../src/data/items.js';

const NOW = Date.UTC(2026, 10, 2, 12);
const fresh = (seed = 1) => { const s = createNewState(NOW, seed); s.maxStage = 60; s.records.bestStage = 60; return s; };
// Équipement imbattable : rien n'est « meilleur que l'équipé ».
function geared(seed = 1) {
  const s = fresh(seed);
  for (const slot of Object.keys(s.equipment)) {
    const base = slot === 'weapon' ? classWeaponBases(s.heroClass)[0] : ITEM_BASES.find((b) => HERO_PLACE[b.slot] === slot && !b.signature);
    s.equipment[slot] = makeItem(s, base.id, 'legendary', 5000);
  }
  return s;
}
const epics = (s, n, slot = 'helmet', baseId = 'iron_helm') => {
  for (let k = 0; k < n; k++) s.inventory.push(makeItem(s, baseId, 'epic', 10 + k));
};
// Rng qui échoue toujours (tirage 0,999…) : la garantie doit quand même aboutir.
const unlucky = { next: () => 0.9999, pick: (l) => l[0] };

test('table BALANCE.forge.fusion : chiffres du doc, raretés tirées de la table', () => {
  assert.deepEqual(BALANCE.forge.fusion.epic, { rate: 100, stakes: { 3: 30, 4: 65 }, pityStep: 20 });
  assert.equal(BALANCE.forge.fusion.common.rate, 100);
  assert.equal(BALANCE.forge.fusion.rare.rate, 100);
  assert.deepEqual(fusableRarities(), ['common', 'rare', 'epic', 'legendary', 'mythic']); // v10.8 : 5 Légendaires → Mythique, 3 Mythiques → Astral
  assert.deepEqual(fusionStakes('common'), [5]);
  assert.deepEqual(fusionStakes('epic'), [3, 4, 5]);
  assert.deepEqual(fusionStakes('legendary'), [5]); // v10.8 : 5 Légendaires → Mythique
  assert.deepEqual(fusionStakes('astral'), [], 'Astral → Ascendant : seulement à l\'Atelier d\'Ascension');
  const s = fresh();
  assert.equal(fusionChance(s, 'helmet', 'epic', 3), 30);
  assert.equal(fusionChance(s, 'helmet', 'epic', 4), 65);
  assert.equal(fusionChance(s, 'helmet', 'epic', 5), 100);
  assert.equal(fusionChance(s, 'helmet', 'rare', 4), null, 'Commun et Rare : 5 seulement');
});

test('critère de fin : 3 essais à 4 objets ou 5 essais à 3 objets aboutissent toujours', () => {
  for (const [stake, maxTries, chances] of [[4, 3, [65, 85, 100]], [3, 5, [30, 50, 70, 90, 100]]]) {
    const s = geared();
    const seen = [];
    let tries = 0;
    for (;;) {
      const before = s.inventory.length;
      epics(s, stake - (before ? 1 : 0)); // l'objet rendu resservira
      const r = fuseItems(s, 'helmet', 'epic', unlucky, BALANCE, null, stake);
      tries += 1;
      seen.push(r.chance);
      if (r.ok) { assert.equal(r.item.rarity, 'legendary'); break; }
      assert.equal(r.lost, stake - 1);
      assert.ok(s.inventory.includes(r.returned), 'objet rendu jamais sorti du sac');
      assert.ok(tries < maxTries);
    }
    assert.deepEqual(seen, chances);
    assert.equal(tries, maxTries);
    assert.equal(s.fusionPity['helmet|epic'] ?? 0, 0, 'jauge à 0 après une réussite');
  }
});

test('échec : objet de plus haut niveau rendu sans recompter un objet trouvé, jauge par emplacement + rareté', () => {
  const s = geared();
  epics(s, 4);
  const top = s.inventory.reduce((a, b) => (b.level > a.level ? b : a));
  const found = s.records.itemsFound;
  const r = fuseItems(s, 'helmet', 'epic', unlucky, BALANCE, null, 4);
  assert.equal(r.ok, false);
  assert.equal(r.returned, top);
  assert.deepEqual(s.inventory, [top]);
  assert.equal(s.records.itemsFound, found);
  assert.equal(s.fusionPity['helmet|epic'], 20);
  assert.equal(fusionChance(s, 'helmet', 'epic', 3), 50);
  assert.equal(fusionChance(s, 'armor', 'epic', 3), 30, 'jauge non partagée entre emplacements');
  top.name = 'Hache de fer';
  assert.equal(fusionFailText({ ...r, returned: top, chance: 65, lost: 3 }, 'Arme', 20), 'Échec (65 %) : 3 objets perdus, Hache de fer rendue, jauge Arme +20');
});

test('réussite à 5 : la jauge reste (mise déjà à 100 % sans elle) ; à 3 ou 4 : retombe à 0 ; bornée à 100', () => {
  const s = geared();
  s.fusionPity = { 'helmet|epic': 40 };
  epics(s, 5);
  assert.equal(fuseItems(s, 'helmet', 'epic', new Rng(1)).ok, true);
  assert.equal(s.fusionPity['helmet|epic'], 40);
  s.inventory = [];
  epics(s, 3);
  s.fusionPity['helmet|epic'] = 90;
  assert.equal(fusionChance(s, 'helmet', 'epic', 3), 100);
  assert.equal(fuseItems(s, 'helmet', 'epic', unlucky, BALANCE, null, 3).ok, true);
  assert.equal(s.fusionPity['helmet|epic'], undefined);
  s.fusionPity['helmet|epic'] = 95;
  s.inventory = []; epics(s, 4);
  const r = fuseItems(s, 'helmet', 'epic', unlucky, BALANCE, null, 4);
  assert.deepEqual([r.ok, r.chance], [true, 100], '65 + 95 : plafonné à 100 %, réussite assurée');
});

test('sauvegarde : fusionPity nettoyé et borné, conservé à la Renaissance, sans montée de SAVE_VERSION', () => {
  const s = fresh();
  const raw = JSON.parse(JSON.stringify({ ...s, fusionPity: { 'helmet|epic': 140, 'weapon|epic': 20.4, 'bad|epic': 20, 'helmet|legendary': 20, 'helmet|epic|x': 5, 'armor|epic': -3 } }));
  const back = sanitizeState(raw, BALANCE, NOW);
  assert.deepEqual(back.fusionPity, { 'helmet|epic': 100, 'weapon|epic': 20, 'helmet|legendary': 20 }); // v10.8 : le Légendaire fusionne
  assert.deepEqual(sanitizeState({ ...JSON.parse(JSON.stringify(s)), fusionPity: undefined }, BALANCE, NOW).fusionPity, {});
  assert.deepEqual(sanitizeState({ ...JSON.parse(JSON.stringify(s)), fusionPity: [1] }, BALANCE, NOW).fusionPity, {});
  back.fusionPity = { 'helmet|epic': 40 };
  back.maxStage = 300; back.records.bestStage = 300;
  performRebirth(back);
  assert.deepEqual(back.fusionPity, { 'helmet|epic': 40 });
});

test('critère de fin : « Fusionner tout » et fusion auto jamais risqués ni sur un objet protégé', () => {
  const s = geared(3);
  s.ui.autoFuse = { on: true, rarities: ['common', 'rare', 'epic'] };
  epics(s, 4); // 4 Épiques : seule une tentative serait possible → jamais en auto
  const g = fusionGroups(s, BALANCE, fusionKeep(s));
  assert.equal(g.length, 1, 'seuil d\'écran 3 pour l\'Épique');
  assert.equal(g[0].auto, false);
  assert.equal(autoFuse(s, new Rng(1)).length, 0);
  assert.equal(fuseAll(s, new Rng(1)), 0);
  assert.equal(s.inventory.length, 4);
  // 5 Épiques dont un renforcé, un dans un build, un verrouillé : rien en auto, rien dans « Fusionner tout ».
  epics(s, 1);
  s.inventory[0].upgrades = 1;
  s.inventory[1].locked = true;
  s.loadouts[0].gear = { helmet: s.inventory[2].id };
  const keep = fusionKeep(s);
  assert.equal(keep.reason(s.inventory[0]), 'upgraded');
  assert.equal(keep.reason(s.inventory[1]), 'locked');
  assert.equal(keep.reason(s.inventory[2]), 'build');
  const [grp] = fusionGroups(s, BALANCE, keep);
  assert.deepEqual([grp.bag, grp.usable, grp.protected, grp.auto], [5, 2, 2, false]);
  assert.equal(autoFuse(s, new Rng(1)).length, 0);
  assert.equal(fuseAll(s, new Rng(1)), 0);
  // À la main, « Inclure » rend les protégés utilisables, jamais le verrouillé.
  const incl = fusionKeep(s, { include: ['helmet|epic'] });
  assert.equal(fusionPool(s, 'helmet', 'epic', incl).length, 4);
  assert.ok(!fusionPool(s, 'helmet', 'epic', incl).some((i) => i.locked));
  // Communs : 5 utilisables → « Fusionner tout », sûr ; 4 Communs : rien.
  for (let k = 0; k < 9; k++) s.inventory.push(makeItem(s, 'leather_hood', 'common', 1 + k));
  assert.equal(fuseAll(s, new Rng(1)), 1);
  assert.equal(s.inventory.filter((i) => i.rarity === 'common').length, 4);
  assert.equal(s.inventory.filter((i) => i.rarity === 'epic').length, 5, 'Épiques intacts');
});

test('isUpgrade (emplacement vide) protège en auto mais s\'inclut d\'un appui à la main', () => {
  const s = fresh(5);
  s.equipment.helmet = null;
  epics(s, 5);
  const keep = fusionKeep(s);
  assert.equal(keep.reason(s.inventory[0]), 'better');
  assert.equal(fuseItems(s, 'helmet', 'epic', new Rng(1), BALANCE, keep), null, 'fusion impossible sans inclure');
  const r = fuseItems(s, 'helmet', 'epic', new Rng(1), BALANCE, fusionKeep(s, { include: ['helmet|epic'] }));
  assert.equal(r.ok, true);
});

test('ordre de consommation : armes non portables, puis niveau croissant', () => {
  const s = geared(9);
  const own = classWeaponBases(s.heroClass)[0];
  const other = ITEM_BASES.find((b) => b.slot === 'weapon' && !b.signature && !canEquip(s, { baseId: b.id, slot: 'weapon' }));
  s.inventory.push(makeItem(s, own.id, 'rare', 1), makeItem(s, other.id, 'rare', 50), makeItem(s, own.id, 'rare', 3), makeItem(s, other.id, 'rare', 20));
  const pool = fusionPool(s, 'weapon', 'rare', null);
  assert.deepEqual(pool.map((i) => i.level), [20, 50, 1, 3]);
});

test('filtre de classe : environ 70 % de modèles de la classe dans les armes fusionnées', () => {
  const s = geared(11);
  const rng = new Rng(4);
  let own = 0; const N = 2000;
  for (let n = 0; n < N; n++) {
    s.inventory = [];
    for (let k = 0; k < 5; k++) s.inventory.push(makeItem(s, classWeaponBases(s.heroClass)[0].id, 'common', 1));
    const r = fuseItems(s, 'weapon', 'common', rng);
    if (canEquip(s, r.item)) own += 1;
  }
  const share = own / N;
  const natural = classWeaponBases(s.heroClass).length / ITEM_BASES.filter((b) => b.slot === 'weapon' && !b.signature).length;
  const expected = 0.7 + 0.3 * natural;
  assert.ok(Math.abs(share - expected) < 0.04, `${share} vs ${expected}`);
});

test('fuseItems : null = impossible (rareté hors table, mise inconnue, pas assez d\'objets)', () => {
  const s = geared();
  epics(s, 2);
  assert.equal(fuseItems(s, 'helmet', 'epic', new Rng(1), BALANCE, null, 3), null);
  assert.equal(fuseItems(s, 'helmet', 'epic', new Rng(1), BALANCE, null, 2), null);
  s.inventory.push(...[0, 1, 2, 3, 4].map(() => makeItem(s, 'iron_helm', 'astral', 1)));
  assert.equal(fuseItems(s, 'helmet', 'astral', new Rng(1)), null, 'v10.8 : l\'Astral ne fusionne pas')
  const noEpic = { ...BALANCE, forge: { ...BALANCE.forge, fusion: { common: { rate: 100 } } } };
  epics(s, 3);
  assert.equal(fuseItems(s, 'helmet', 'epic', new Rng(1), noEpic), null, 'rareté absente de la table');
  assert.deepEqual(fusionGroups(s, noEpic), []);
});

test('« fuse » n\'est plus répétable au maintien', () => {
  assert.equal(REPEATABLE.has('fuse'), false);
});

test('textes de la fusion traduits en anglais', async () => {
  globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const { translate } = await import('../src/i18n/en.js');
  const texts = ['Fusionner tout · 3 groupes', 'Fusionner tout · 1 groupe', '7 dans le sac', 'Jauge +0', 'Jauge +40',
    '1 objet protégé (renforcé)', '2 objets protégés (renforcé, dans un build)', "1 objet protégé (meilleur que l'équipé)",
    '1 objet protégé (utile à un ensemble, effet gardé)', 'Inclure', 'Inclus', 'Si échec : 1 objet rendu, jauge +20',
    'Tenter à 3 · 30 %', 'Tenter à 4 · 65 %', 'Fusionner 5 · 100 %', 'Fusionner 3 · 100 %', 'Il faut au moins 3 objets utilisables.',
    'Épique : 5 objets = sûr, ou tenter avec moins.', 'Échec (65 %) : 3 objets perdus, Hache de fer rendue, jauge Arme +20',
    'Échec (30 %) : 2 objets perdus, Casque de fer rendu, jauge Casque +20',
    "Mise de 5 à 100 % seulement. Jamais fusionné : objet verrouillé, ancestral, renforcé, meilleur que l'objet porté, utile à un ensemble, effet gardé ou dans un build."];
  const FRENCH = /[éèàçùêâîôûœ«»]|dans le sac|Jauge|Tenter|Fusionner|Inclure|Inclus\b|perdu|objet/;
  assert.deepEqual(texts.filter((t) => FRENCH.test(translate(t))), []);
});
