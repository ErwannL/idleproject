// v10.3.1 : finitions des parties 8, 9, 10 et 4 — Comptoir du Bastion, Mine de cristal, renfort d'au moins 1 unité
// affichée, Forge (classement et ligne « maintenant »), clavier du Bastion, lexique, traductions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Gabarits de l'interface : même enrobage que tests/v1030-equip.test.js (aucun navigateur).
globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'getImageData' || k === 'createImageData'
    ? (x, y, w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0)) * 4), width: w, height: h })
    : k === 'measureText' ? () => ({ width: 1 }) : k in t ? t[k] : () => {}),
  set: (t, k, v) => { t[k] = v; return true; },
});
globalThis.document ??= { createElement: () => ({ width: 1, height: 1, getContext: () => ctx2d, toDataURL: () => 'data:' }) };

const { createNewState, sanitizeState } = await import('../src/core/state.js');
const {
  assignWorker, bastionLevel, bastionTick, buildingAccess, productionOf, startBuild, trade, tradeLeft, tradeOffer,
} = await import('../src/core/bastion.js');
const { TRADE_POST, MINE } = await import('../src/data/bastion.js');
const { BALANCE } = await import('../src/data/balance.js');
const { makeItem, recycleMaterials } = await import('../src/core/loot.js');
const { Rng } = await import('../src/core/rng.js');
const forge = await import('../src/core/forge.js');
const { statGainText } = await import('../src/ui/panels/equip-sheet.js');
const { forgeNow } = await import('../src/ui/panels/forge.js');
const forgePanel = (await import('../src/ui/panels/forge.js')).default;
const { GLOSSARY, GLOSSARY_TERMS, GLOSSARY_MANUAL } = await import('../src/data/glossary.js');

const T0 = Date.UTC(2026, 10, 21, 9);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function opened(stage = 200) {
  const s = createNewState(T0, 7);
  s.maxStage = stage; s.stage = stage; s.records.bestStage = stage;
  for (const id of ['dwarf', 'priestess', 'ranger', 'squire', 'mercenary', 'witch']) s.companions.owned[id] = { stars: 1, level: 1 };
  bastionTick(s, T0);
  s.gold = 1e30; s.materials.shards = 1e6;
  return s;
}
// Bastion de niveau 5 (Forge 1 + Bibliothèque 2 + Mine 2), Comptoir construit au niveau `level`.
function withTrade(level = 1) {
  const s = opened();
  s.bastion.buildings.library.level = 2;
  s.bastion.buildings.mine.level = 2;
  s.bastion.buildings.trade.level = level;
  return s;
}

// ---------------------------------------------------------------- A1 : le Comptoir

test('Comptoir : il s\'ouvre au niveau 5 du Bastion, et pas avant', () => {
  const s = opened();
  s.bastion.buildings.library.level = 1; s.bastion.buildings.mine.level = 1; // Bastion 3
  assert.equal(bastionLevel(s), 3);
  assert.equal(buildingAccess(s, 'trade').available, false);
  assert.match(buildingAccess(s, 'trade').reason, /Bastion niveau 5/);
  s.bastion.buildings.mine.level = 2; // Bastion 4
  assert.equal(buildingAccess(s, 'trade').available, false);
  s.bastion.buildings.library.level = 2; // Bastion 5
  assert.equal(bastionLevel(s), 5);
  assert.equal(buildingAccess(s, 'trade').available, true);
  // Ouvert mais pas construit : aucun échange possible.
  assert.equal(tradeLeft(s, T0), 0);
  assert.equal(trade(s, 'buy-grimoire', T0), null);
  // On le construit : un ouvrier, un chantier, puis le jeu fermé.
  assert.equal(assignWorker(s, 'trade', 'mercenary', T0), null);
  assert.equal(startBuild(s, 'trade', T0), true);
  bastionTick(s, T0 + HOUR);
  assert.equal(s.bastion.buildings.trade.level, 1);
  assert.ok(tradeLeft(s, T0 + HOUR) > 0);
  assert.ok(trade(s, 'buy-grimoire', T0 + HOUR));
});

test('Comptoir : le taux s\'améliore de 4 % par niveau (acheter coûte moins, vendre rapporte plus)', () => {
  const s = withTrade(1);
  const five = tradeOffer(s, 'buy-grimoire', 5), ten = tradeOffer(s, 'buy-grimoire', 10);
  assert.equal(tradeOffer(s, 'buy-grimoire', 1).giveAmount, 40);
  assert.equal(five.giveAmount, Math.round(40 * (1 - 0.04 * 4)));
  assert.equal(ten.giveAmount, Math.round(40 * (1 - 0.04 * 9)));
  assert.equal(tradeOffer(s, 'sell-grimoire', 1).getAmount, 10);
  assert.equal(tradeOffer(s, 'sell-grimoire', 5).getAmount, Math.round(10 * 1.16));
  for (const o of TRADE_POST.offers) {
    let last = null;
    for (let lv = 1; lv <= 10; lv++) {
      const t = tradeOffer(s, o.id, lv);
      const v = o.sell ? t.getAmount : -t.giveAmount; // plus c'est grand, mieux c'est pour le joueur
      if (last !== null) assert.ok(v >= last, `${o.id} niveau ${lv} : jamais pire qu'au niveau précédent`);
      last = v;
    }
    const a = tradeOffer(s, o.id, 1), b = tradeOffer(s, o.id, 10);
    assert.ok(o.sell ? b.getAmount > a.getAmount : b.giveAmount < a.giveAmount, `${o.id} : le niveau 10 est meilleur que le niveau 1`);
  }
  // L'échange réellement fait suit le niveau du bâtiment.
  const lv5 = withTrade(5);
  const shards = lv5.materials.shards;
  const o = trade(lv5, 'buy-grimoire', T0);
  assert.equal(o.giveAmount, five.giveAmount);
  assert.equal(lv5.materials.shards, shards - five.giveAmount);
  assert.equal(lv5.materials.grimoire, 1);
});

test('Comptoir : limite d\'échanges par jour (6 + 2 par niveau), remise à zéro le lendemain', () => {
  const s = withTrade(1);
  const max = TRADE_POST.perDay.base + TRADE_POST.perDay.perLevel * 1;
  assert.equal(tradeLeft(s, T0), max);
  for (let i = 0; i < max; i++) assert.ok(trade(s, 'buy-grimoire', T0 + i * 1000), `échange ${i + 1}`);
  assert.equal(tradeLeft(s, T0 + 60_000), 0);
  const grimoires = s.materials.grimoire, shards = s.materials.shards;
  assert.equal(trade(s, 'buy-grimoire', T0 + 60_000), null, 'au-delà de la limite : refusé');
  assert.deepEqual([s.materials.grimoire, s.materials.shards], [grimoires, shards], 'un échange refusé ne coûte rien');
  assert.equal(tradeLeft(s, T0 + DAY + HOUR), max, 'le lendemain, la limite est remise');
  assert.ok(trade(s, 'buy-grimoire', T0 + DAY + HOUR));
  // Un niveau de plus = 2 échanges de plus par jour.
  assert.equal(tradeLeft(withTrade(4), T0), TRADE_POST.perDay.base + TRADE_POST.perDay.perLevel * 4);
});

test('Comptoir : refusé quand on n\'a pas de quoi payer', () => {
  const s = withTrade(1);
  s.materials.shards = 10; s.materials.grimoire = 0;
  assert.equal(trade(s, 'buy-grimoire', T0), null);
  assert.equal(trade(s, 'sell-grimoire', T0), null);
  assert.equal(trade(s, 'inconnu', T0), null);
  assert.deepEqual([s.materials.shards, s.materials.grimoire], [10, 0]);
});

test('Comptoir : aucun aller-retour ne crée de ressource, à aucun niveau', () => {
  const goods = ['grimoire', 'ascension', 'mastery'];
  for (let lv = 1; lv <= 10; lv++) {
    const s = withTrade(lv);
    for (const good of goods) {
      const buy = tradeOffer(s, `buy-${good}`, lv), sell = tradeOffer(s, `sell-${good}`, lv);
      assert.ok(sell.getAmount < buy.giveAmount, `niveau ${lv}, ${good} : revendre (${sell.getAmount}) rapporte moins qu'acheter (${buy.giveAmount})`);
    }
    // Essai de bout en bout : acheter puis revendre, jour après jour, n'enrichit jamais.
    const start = 5000;
    Object.assign(s.materials, { shards: start, grimoire: 0, ascension: 0, mastery: 0 });
    let t = T0;
    for (let day = 0; day < 3; day++) {
      for (let i = 0; i < 20; i++) {
        for (const good of goods) {
          trade(s, `buy-${good}`, t); t += 1000;
          if (s.materials[good] > 0) { trade(s, `sell-${good}`, t); t += 1000; }
        }
      }
      t = T0 + (day + 1) * DAY;
    }
    assert.ok(s.materials.shards <= start, `niveau ${lv} : ${s.materials.shards} éclats après les allers-retours (départ ${start})`);
    for (const g of goods) assert.ok(s.materials[g] >= 0);
  }
});

test('Comptoir : sauvegarde — le compteur du jour est gardé, un compteur abîmé est réparé', () => {
  const s = withTrade(3);
  trade(s, 'buy-grimoire', T0); trade(s, 'buy-grimoire', T0 + 1000);
  const back = sanitizeState(JSON.parse(JSON.stringify(s)), BALANCE, T0 + 2000);
  assert.equal(back.bastion.buildings.trade.level, 3);
  assert.equal(back.bastion.trade.used, 2);
  assert.equal(tradeLeft(back, T0 + 2000), tradeLeft(s, T0 + 2000));
  const raw = JSON.parse(JSON.stringify(s));
  raw.bastion.trade = { day: 5, used: 'beaucoup' };
  assert.deepEqual(sanitizeState(raw, BALANCE, T0).bastion.trade, { day: '', used: 0 });
  raw.bastion.trade = { day: '2026-11-21', used: 1e9 };
  assert.ok(sanitizeState(raw, BALANCE, T0).bastion.trade.used <= 99, 'compteur borné');
});

// ---------------------------------------------------------------- A5 : Mine de cristal

test('Mine de cristal : calée sur le recyclage d\'un objet de l\'étape max et sur les expéditions', () => {
  const s = opened();
  s.bastion.buildings.mine.level = 1;
  const lv1 = productionOf(s, 'mine', 1), lv10 = productionOf(s, 'mine', 10);
  const epic = recycleMaterials({ rarity: 'epic' }).shards, legendary = recycleMaterials({ rarity: 'legendary' }).shards;
  assert.equal(lv1.perHour, MINE.basePerHour + MINE.perLevel);
  assert.ok(lv1.perHour >= epic, `niveau 1 : au moins un objet Épique recyclé par heure (${lv1.perHour} ≥ ${epic})`);
  assert.ok(lv10.perHour >= 2 * legendary, `niveau 10 : au moins deux Légendaires recyclés par heure (${lv10.perHour} ≥ ${2 * legendary})`);
  assert.ok(lv1.perHour >= 15, 'au moins un compagnon de puissance 1 en expédition (15 éclats par heure)');
  assert.ok(lv1.perHour > 10 && lv10.perHour > 55, 'plus généreuse que la 10.3.0 (10 à 55 éclats par heure)');
  assert.deepEqual([Math.round(lv1.capHours), lv10.capHours], [6, 12], 'stock de 6 à 12 h');
  assert.equal(lv1.cap, lv1.perHour * 6);
});

// ---------------------------------------------------------------- C2 : un renfort rapporte au moins 1 unité affichée

const PIECES = ['short_sword', 'dagger', 'iron_helm', 'chainmail', 'band_ring_ruby'];
const affixAt = (item, stat) => item.affixes[stat === 'main' ? 0 : Number(stat.split(':')[1])];

test('renfort : sur les objets de niveau 1, « avant → après » est le résultat réel et chaque renfort gagne au moins 1 unité affichée', () => {
  let checked = 0;
  for (const rarity of ['common', 'rare', 'epic']) {
    for (const baseId of PIECES) {
      const s = opened();
      s.gold = 1e30; s.materials.shards = 1e9;
      const item = makeItem(s, baseId, rarity, 1, BALANCE, new Rng(5));
      s.inventory.push(item);
      for (let up = 0; up < 12; up++) {
        const p = forge.upgradePreview(s, item);
        if (p.atMax) break;
        const before = JSON.parse(JSON.stringify(item));
        const named = p.rows.find((r) => r.key === p.stat);
        assert.ok(named, `${baseId} : la stat renforcée figure dans l'aperçu`);
        assert.equal(forge.upgradeItem(s, item.id, null), p.stat);
        // L'aperçu est le résultat exact.
        assert.deepEqual(item.stats, p.after.stats, `${baseId} ${rarity} +${up} : stats`);
        assert.deepEqual(item.affixes.map((a) => a.value), p.after.affixes.map((a) => a.value), `${baseId} ${rarity} +${up} : effets`);
        // La stat renforcée gagne au moins 1 unité affichée (0,1 pour une valeur en % ou un effet à décimale).
        const was = named.kind === 'stat' ? before.stats[named.stat] : affixAt(before, p.stat).value;
        const now = named.kind === 'stat' ? item.stats[named.stat] : affixAt(item, p.stat).value;
        assert.ok(now - was >= 0.0999, `${baseId} ${rarity} +${up} → +${up + 1} : ${named.key} ${was} → ${now}`);
        assert.equal(named.before, was);
        assert.equal(named.after, now);
        checked += 1;
      }
    }
  }
  assert.ok(checked > 100);
});

test('renfort : les gros objets ne changent pas (+12 % arrondi, comme avant)', () => {
  const s = opened();
  s.gold = 1e30; s.materials.shards = 1e9;
  const item = makeItem(s, 'short_sword', 'legendary', 200, BALANCE, new Rng(9));
  const dmg = item.stats.damage;
  assert.ok(dmg > 100);
  s.inventory.push(item);
  assert.equal(forge.upgradableStats(item)[0], 'damage');
  forge.upgradeItem(s, item.id, null);
  assert.equal(item.stats.damage, Math.round(dmg * 1.12));
});

// ---------------------------------------------------------------- B : Forge, atelier 2 « Renforcer »

const kindOf = (r) => (r.preview.atMax ? 2 : forge.gainsPower(r) ? 0 : 1);
// Épée dont le prochain renfort touche un effet spécial sans effet sur la Puissance (on avance jusque-là).
function swordOnSpecial() {
  const s = opened(139);
  s.gold = 1e30; s.materials.shards = 1e9;
  const sword = makeItem(s, 'short_sword', 'rare', 139, BALANCE, new Rng(3));
  s.equipment.weapon = sword;
  for (let i = 0; i < 12; i++) {
    if (!forge.gainsPower(forge.upgradeRanking(s)[0])) return { s, sword };
    forge.upgradeItem(s, sword.id, null);
  }
  return { s, sword };
}

test('Forge : le classement met d\'abord les objets dont le renfort augmente la Puissance, puis les autres', () => {
  const s = opened(139);
  s.gold = 1e30; s.materials.shards = 1e9;
  const rng = new Rng(21);
  s.equipment.weapon = makeItem(s, 'short_sword', 'rare', 139, BALANCE, rng);
  s.equipment.helmet = makeItem(s, 'iron_helm', 'epic', 139, BALANCE, rng);
  s.equipment.armor = makeItem(s, 'chainmail', 'epic', 139, BALANCE, rng);
  s.equipment.ring = makeItem(s, 'band_ring_ruby', 'legendary', 139, BALANCE, rng);
  // L'épée avance jusqu'à un renfort sans effet sur la Puissance, les autres objets restent à +0.
  for (let i = 0; i < 12 && forge.gainsPower(forge.upgradeRanking(s).find((r) => r.item.baseId === 'short_sword')); i++) forge.upgradeItem(s, s.equipment.weapon.id, null);
  const ranking = forge.upgradeRanking(s);
  const kinds = ranking.map(kindOf);
  assert.deepEqual(kinds, [...kinds].sort((a, b) => a - b), 'puissance d\'abord, puis les autres, puis le maximum');
  assert.ok(kinds.includes(0) && kinds.includes(1), `les deux cas sont couverts : ${kinds.join()}`);
  const withPower = ranking.filter((r) => forge.gainsPower(r));
  for (let i = 1; i < withPower.length; i++) assert.ok(withPower[i - 1].perShard >= withPower[i].perShard, 'dans le groupe : gain par éclat décroissant');
  assert.notEqual(ranking[0].item.baseId, 'short_sword', 'l\'épée sans gain de Puissance passe après les autres');
});

test('Forge : la ligne « maintenant » et la liste nomment la statistique quand le renfort ne rapporte pas de Puissance', () => {
  const { s, sword } = swordOnSpecial();
  const row = forge.upgradeRanking(s)[0];
  assert.ok(!forge.gainsPower(row), 'cas voulu : le prochain renfort n\'augmente pas la Puissance');
  const text = statGainText(row.preview);
  assert.match(text, /^\D+ \d+(,\d)? .*→ \d+(,\d)? /u, text);
  assert.ok(!text.includes('.'), 'virgule française, jamais de point décimal');
  const now = forgeNow(s);
  assert.ok(now.upgrade.ok);
  assert.ok(now.upgrade.text.endsWith(text), now.upgrade.text);
  assert.ok(!/0 % de puissance|0,0 %/.test(now.upgrade.text), now.upgrade.text);
  assert.ok(now.upgrade.text.startsWith(`${sword.name} +${sword.upgrades} → +${sword.upgrades + 1} : `), now.upgrade.text);
  // Même texte dans la liste de l'atelier.
  const html = forgePanel.render({ view: { open: new Set(), closed: new Set(), forgeSeg: 'upgrade' }, tabVisible: {} }, s);
  assert.ok(html.includes(`<span class="fg-up-gain good num">${text}</span>`), 'la liste écrit la même chose');
});

test('Forge : un renfort qui augmente la Puissance garde « +x,x % de puissance »', () => {
  const s = opened(139);
  s.gold = 1e30; s.materials.shards = 1e9;
  s.equipment.weapon = makeItem(s, 'short_sword', 'epic', 139, BALANCE, new Rng(8));
  assert.match(forgeNow(s).upgrade.text, /\+0 → \+1 : \+\d+(,\d)? % de puissance$/);
});

// ---------------------------------------------------------------- A3 : clavier, A4 : lexique

test('clavier : Entrée et Espace ouvrent les cartes « role=button » (Bastion, lexique), focus visible', () => {
  const src = readFileSync('src/ui/shortcuts.js', 'utf8');
  assert.match(src, /focused\.matches\('\[role="button"\]:not\(button\)'\)/);
  assert.match(src, /e\.preventDefault\(\);\s*if \(!e\.repeat\) focused\.click\(\)/);
  // v10.4 (6) : les bâtiments de la carte sont de vrais boutons (Entrée et Espace natifs), contour visible au clavier.
  assert.match(readFileSync('src/ui/bastion104.css', 'utf8'), /\.bs-plot:focus-visible\s*\{[^}]*outline: 3px solid/);
  assert.match(readFileSync('src/ui/panels/camp.js', 'utf8'), /<button class="bs-plot[^"]*"[^>]*data-action="bastion-open"/);
});

test('lexique : Bastion, Ouvrier, Chantier, Recherche ont leur carte, sans surlignage dans les phrases', () => {
  for (const w of ['Bastion', 'Ouvrier', 'Chantier', 'Recherche']) {
    assert.ok(GLOSSARY[w] && GLOSSARY[w].length > 40, `${w} : une explication`);
    assert.ok(GLOSSARY_MANUAL.has(w));
    assert.ok(!GLOSSARY_TERMS.includes(w), `${w} : jamais surligné dans les textes (cela couperait les phrases et casserait les traductions)`);
  }
  assert.match(readFileSync('src/ui/panels/camp.js', 'utf8'), /class="lex bs-word" data-lex=/);
});

// ---------------------------------------------------------------- traductions

test('traductions : lexique du Bastion et ligne « maintenant » de la Forge existent en anglais et en coréen', async () => {
  const { lookup: en } = await import('../src/i18n/en.js');
  const { lookup: ko } = await import('../src/i18n/ko.js');
  const { s } = swordOnSpecial();
  const text = statGainText(forge.upgradeRanking(s)[0].preview);
  const line = forgeNow(s).upgrade.text;
  const texts = [...['Bastion', 'Ouvrier', 'Chantier', 'Recherche'].flatMap((w) => [w, GLOSSARY[w]]), 'Mots du Bastion :', text, line];
  for (const t of texts) {
    for (const [code, look] of [['en', en], ['ko', ko]]) {
      const r = look(t);
      assert.ok(r && (r !== t || t === 'Bastion'), `${code} : « ${t} » → ${r}`); // « Bastion » s'écrit pareil en anglais
      if (code === 'en') assert.doesNotMatch(r, /[àâçéèêëîïôûùœ]/i, `${code} : « ${t} » → ${r}`);
    }
  }
  assert.equal(en('Coup critique 12,4 % → 13,6 %'), 'Critical hit 12.4 % → 13.6 %');
});

// ---------------------------------------------------------------- D : le parcours du débutant

test('débutant : « Équipe un objet » est toujours faisable en moins d\'une minute (le premier objet garanti est utile)', async () => {
  const { createCombat, step } = await import('../src/core/combat.js');
  const { equipBest, isUpgrade } = await import('../src/core/inventory.js');
  const { advanceUnlocks } = await import('../src/core/unlock-quests.js');
  // Les 6 premières graines à échouer avant la correction (premier objet recyclé aussitôt, ou une arme moins bonne)
  // et quelques autres : la mini-quête « Équipement » finit toujours en moins de 60 s de jeu.
  for (const seed of [24, 45, 54, 56, 57, 70, 1, 2, 3, 4, 5, 6]) {
    const state = createNewState(1e12, seed);
    state.unlocks = { done: [], base: { ...state.records } };
    const world = createCombat(state);
    const rng = new Rng(seed * 104729);
    let done = null;
    for (let i = 0; i < 20 * 90 && done === null; i++) {
      step(state, world, 0.05, rng);
      world.events.length = 0;
      if (i % 100 === 0) {
        // Le joueur touche ce que le Sceau montre : équiper le nouvel objet.
        if (state.inventory.some((it) => isUpgrade(state, it))) equipBest(state);
        advanceUnlocks(state);
        if (state.unlocks.done.includes('equipment')) done = Math.round(i / 20);
      }
    }
    assert.ok(done !== null && done <= 60, `graine ${seed} : mini-quête Équipement finie en ${done} s (kills ${state.records.kills}, objets trouvés ${state.records.itemsFound}, sac ${state.inventory.length})`);
  }
});
