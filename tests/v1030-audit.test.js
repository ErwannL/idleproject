// v10.3 (audit des parties 0 à 7 du plan docs/plan-v1030.md) : ce que la relecture a trouvé cassé ou manquant, et corrigé.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'getImageData' || k === 'createImageData'
    ? (x, y, w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0)) * 4), width: w, height: h })
    : k === 'measureText' ? () => ({ width: 1 }) : k in t ? t[k] : () => {}),
  set: (t, k, v) => { t[k] = v; return true; },
});
globalThis.document ??= { createElement: () => ({ width: 1, height: 1, getContext: () => ctx2d, toDataURL: () => 'data:' }) };

const { createNewState, sanitizeState } = await import('../src/core/state.js');
const { ENEMIES, BOSSES } = await import('../src/data/enemies.js');
const { ZONES } = await import('../src/data/zones.js');
const { enemyStats } = await import('../src/core/combat.js');
const A = await import('../src/core/arena-cards.js');
const { arenaEngineType, arenaZoneOf, arenaArtOf } = await import('../src/render/arena-scene.js');
const { cardHtml } = await import('../src/ui/card.js');
const { cardTowerHtml } = await import('../src/ui/panels/arena-cards-view.js');
const { survivalAsCards, ruleDup, ruleName } = await import('../src/ui/arena-map.js');
const { CARD_ARENA } = await import('../src/data/arena-floors.js');
const { runSurvival } = await import('../src/core/arena.js');
const { icon, escapeHtml } = await import('../src/ui/common.js');
const dungeons = (await import('../src/ui/panels/dungeons.js')).default;
const tower = (await import('../src/ui/panels/tower.js')).default;
const { MENUS, TAB_LEAD } = await import('../src/ui/nav.js');
const { LEARN } = await import('../src/ui/learn.js');
const { CONTENT_ROUND, NOTION_OF, nextAction } = await import('../src/core/guide.js');
const { daybookTrack } = await import('../src/core/daybook.js');
const en = await import('../src/i18n/en.js');
const ko = await import('../src/i18n/ko.js');

const fin = () => sanitizeState(JSON.parse(readFileSync('tests/fixtures/endgame.json', 'utf8')));
const uiWith = (view = {}) => ({ view: { open: new Set(), closed: new Set(), ...view }, tabVisible: {}, sheet: null, dgSheet(html) { this.sheet = html; } });

test('1.2 — carte ennemie : l\'image affichée est celle de sa fiche, le rôle en sous-titre, le gardien a son illustration', () => {
  for (let f = 1; f <= 100; f++) for (const c of A.floorCards(f).cards) {
    const html = cardHtml({ ...c, rarity: 'common' }, { small: true, foe: true });
    if (c.guardian) {
      const file = arenaArtOf(c);
      assert.match(file, /^assets\/ui\/art102\/guardian_\d\.png$/, `étage ${f}`);
      assert.ok(existsSync(file), `${file} manque`);
      assert.ok(html.includes(`src="${file}"`), `étage ${f} : le gardien n'a pas son image`);
      continue;
    }
    const real = ENEMIES[c.enemyId] ?? BOSSES[c.enemyId];
    const sprite = real.sprite ?? ENEMIES[real.base]?.sprite;
    assert.equal(c.sprite, sprite, `étage ${f} : ${c.name}`);
    assert.ok(html.includes(`data-sprite="${sprite}"`) && html.includes(`src="${icon(sprite)}"`), `étage ${f} : ${c.name} ne montre pas son sprite`);
    assert.ok(html.includes(`>${escapeHtml(c.name)}</b>`), `étage ${f} : nom`);
    if (!c.boss) assert.ok(c.sub && html.includes(`pc-sub">${escapeHtml(c.sub)}<`), `étage ${f} : rôle en sous-titre`);
  }
});

test('1.2 / 2.4 — écran de l\'Arène : cartes de l\'étage rendues avec leur propre image (plus de recalcul par case)', () => {
  const s = fin();
  for (const f of [1, 3, 7, 10, 25]) {
    A.cardArena(s).best = f - 1;
    const html = cardTowerHtml(uiWith({ cardFloor: f }), s);
    for (const c of A.floorCards(f, A.arenaCal(s)).cards) {
      const want = arenaArtOf(c) ?? icon(c.sprite);
      assert.ok(html.includes(`src="${want}"`), `étage ${f} : image de ${c.name}`);
    }
  }
  assert.ok(!/Règle : /.test(cardTowerHtml(uiWith({ cardFloor: 5 }), (A.cardArena(s).best = 4, s))), 'la règle n\'est plus écrite deux fois');
});

test('6.2 — carte du combat : chaque carte ennemie (étages 1 à 100, gardiens compris) a un type que le moteur connaît', () => {
  for (let f = 1; f <= 100; f++) {
    const setup = A.floorCards(f);
    const zone = arenaZoneOf({ setup, floor: f });
    for (const c of setup.cards) {
      const { type, boss } = arenaEngineType(c, zone);
      assert.ok(boss ? BOSSES[type] : ENEMIES[type], `étage ${f} : ${c.name} → ${type}`);
      assert.doesNotThrow(() => enemyStats(1, type, boss), `étage ${f} : ${c.name} (le combat plantait à l'ouverture pour les gardiens)`);
      if (c.guardian) assert.ok(arenaArtOf(c), `étage ${f} : le gardien est dessiné avec son illustration`);
    }
  }
  // Carte sans type ni boss connu : repli sur un monstre du monde, jamais d'exception.
  const odd = arenaEngineType({ boss: true, enemyId: 'inconnu' }, 0);
  assert.ok(odd.boss ? BOSSES[odd.type] : ENEMIES[odd.type]);
  assert.ok(ZONES[0].enemies.includes(arenaEngineType({ enemyId: 'inconnu' }, 0).type));
});

test('6.2 — Survie sur la carte : le nom d\'un monstre de vague vient de la même fiche que son sprite', () => {
  const s = fin();
  const team = s.companions.equipped.slice(0, 3);
  const r = runSurvival(s, team);
  assert.ok(r, 'survie jouable');
  const run = survivalAsCards(r);
  const waves = [run.setup.cards, ...run.events.filter((e) => e.kind === 'wave').map((e) => e.cards)];
  assert.ok(waves.length > 1);
  for (const cards of waves) for (const c of cards) {
    const real = c.boss ? BOSSES[c.enemyId] : ENEMIES[c.enemyId];
    assert.ok(real, `${c.name} (${c.enemyId})`);
    assert.equal(c.name, real.name);
  }
});

test('2.4 — dos de carte doré : promis à l\'étage 25, réellement gagné en battant le gardien', () => {
  const s = fin();
  const c = A.cardArena(s); c.best = 24;
  assert.equal(A.hasGoldBack(s), false);
  assert.match(cardTowerHtml(uiWith({ cardFloor: 25 }), s), /card_back_gold\.png/, 'aperçu dans la fiche de l\'étage 25');
  // Le combat du gardien, forcé gagnant (ennemis sans attaque) : on ne teste pas l'équilibrage ici.
  c.cal = { hp: 0.01, atk: 0.0001 };
  const r = A.playFloor(s, 25);
  assert.ok(r.won, 'gardien battu');
  assert.equal(r.goldBack, false, 'pas encore porté pendant ce combat');
  assert.equal(r.newBack, true, 'gagné par ce combat');
  assert.equal(A.hasGoldBack(s), true);
  const next = A.playFloor(s, 26);
  assert.equal(next.goldBack, true, 'porté au combat suivant');
  assert.equal(next.newBack, false);
  const html = cardTowerHtml(uiWith({ cardFloor: 25 }), s);
  assert.match(html, /cf-backchip/, 'pastille dans la formation');
  assert.match(html, /pcard[^"]* back-gold/, 'les cartes de la formation portent le dos doré');
  assert.match(readFileSync('src/ui/audit103.css', 'utf8'), /\.pcard\.back-gold \.pc-back \{[^}]*card_back_gold\.png/);
});

test('2.4 — règles d\'étage : un nom et une image chacune, jamais « Embuscade : Embuscade : … »', () => {
  for (const rule of CARD_ARENA.rules) {
    assert.ok(ruleName(rule.id), rule.id);
    assert.ok(existsSync(`assets/ui/art102/rule_${rule.id}.png`), rule.id);
    if (rule.text.startsWith(`${ruleName(rule.id)} :`)) assert.equal(ruleDup(rule), true, rule.id);
  }
});

test('0 / 1.6 — feuille de donjon : s\'ouvre aussi quand « Difficile » est débloqué (plantait : nmSel lu avant d\'exister)', () => {
  for (const best of [undefined, 0, 1, 2]) {
    const s = createNewState(); s.maxStage = 200; s.keys = 3;
    if (best !== undefined) { s.dungeonBest = { crypt: best }; s.dungeonsCleared = { crypt: 3 }; }
    const ui = uiWith({ dungeonSheet: true, dungeonSel: 'crypt' });
    assert.doesNotThrow(() => dungeons.render(ui, s), `meilleure difficulté ${best}`);
    assert.match(ui.sheet ?? '', /data-action="enter-dungeon"/, `« Entrer » présent (meilleure difficulté ${best})`);
    assert.match(ui.sheet, /dg-boss-portrait/);
    // 1.6 : les équipes enregistrées sont sous « Équipe pour ce donjon », avec leur phrase.
    assert.ok(ui.sheet.indexOf('Équipe pour ce donjon') < ui.sheet.indexOf('team-chips') || !ui.sheet.includes('team-chips'));
  }
});

test('2.1 — l\'Arène est un onglet de Combat ; Défis n\'a plus de segment Arène mais une tuile qui y mène', () => {
  assert.deepEqual(MENUS.find((m) => m.id === 'adventure').tabs, ['campaign', 'dungeons', 'arena', 'tower', 'event']);
  const ui = readFileSync('src/ui/ui.js', 'utf8');
  assert.ok(!/if \(tab === 'arena'\) \{ tab = 'tower'/.test(ui), 'openTab ne renvoie plus l\'Arène vers Défis');
  const s = fin();
  const html = tower.render(uiWith({ defiTab: 'arena' }), s);
  assert.ok(!/data-action="defi-tab" data-value="arena"/.test(html), 'plus de segment Arène dans Défis');
  assert.match(html, /class="arena-tile" data-action="open-tab" data-value="arena"/);
  assert.ok(!TAB_LEAD.tower.includes('Arène'));
  assert.match(readFileSync('src/ui/panels/campaign.js', 'utf8'), /arena-tile[^`]*open-tab[^`]*arena_tile\.png/, 'tuile illustrée dans la Carte');
  assert.ok(existsSync('assets/ui/art101/arena_tile.png'));
  // Cartes de déblocage : l'Arène à l'étape 25 (son onglet), les Défis à l'étape 45.
  assert.equal(LEARN.find((l) => l.id === 'tower').tab, 'arena');
  assert.equal(LEARN.find((l) => l.id === 'defis').tab, 'tower');
});

test('2.4 / 4.1 — Sceau : ligne « Arène » une fois par jour, vers l\'onglet Arène, après la carte de la notion', () => {
  const row = CONTENT_ROUND.find((c) => c.id === 'c-arena');
  assert.equal(row.tab, 'arena');
  assert.equal(row.view, undefined);
  assert.ok(!/copies/.test(row.text), 'l\'Arène ne donne pas de copies de compagnons');
  const s = fin();
  assert.equal(row.ok(s), true);
  daybookTrack(s, 'arena', 1);
  assert.equal(row.ok(s), false, 'plus proposée une fois un combat d\'Arène gagné ce jour-là');
  assert.equal(NOTION_OF['c-arena'], 'tower');
  assert.equal(NOTION_OF['c-tower'], 'defis');
  // Notion pas encore présentée : la consigne attend, et demande que la carte passe d'abord.
  const s2 = fin();
  const ALL = LEARN.map((l) => l.id);
  const ctx = { learned: ALL.filter((x) => x !== 'tower'), visible: {}, claims: [], aside: new Set(['upgrade', 'level', 'equip', 'lootbag', 'place', 'team', 'skills', 'summon', 'quest', 'recycle', 'keys', 'rebirth', 'retry', 'advance', 'c-tower', 'c-challenge', 'c-expeditions', 'c-event', 'seal', 'fusion']) };
  const n = nextAction(s2, ctx);
  assert.notEqual(n?.id, 'c-arena');
  assert.equal(ctx.wantLearn, 'tower');
  const n2 = nextAction(s2, { ...ctx, learned: ALL, wantLearn: undefined });
  assert.equal(n2?.id, 'c-arena');
  assert.ok(n2.why, 'la consigne a sa ligne « pourquoi »');
});

test('7 — textes : le rangement s\'appelle « Réserve » (plus « coffre ») ; « coffre de butin » pour le butin de la scène', () => {
  const stash = /sac et coffre pleins|Sac et coffre pleins|au coffre|le Coffre à l|Coffre, Renaissance/;
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? (d.name === 'i18n' ? [] : walk(`${dir}/${d.name}`)) : d.name.endsWith('.js') ? [`${dir}/${d.name}`] : []));
  for (const f of ['src/main.js', ...walk('src/ui'), ...walk('src/core')]) {
    if (f.endsWith('panels/inventory.js')) continue; // écran refait par la partie 8 (autre lot) : ses 6 libellés « coffre » y sont signalés
    const lines = readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).map((l) => l.replace(/\/\/.*$/, ''));
    for (const l of lines) assert.ok(!stash.test(l), `${f} : ${l.trim().slice(0, 110)}`);
  }
  const SHORT = readFileSync('src/ui/shortcuts.js', 'utf8');
  assert.match(SHORT, /lootBag: 'b'/); assert.match(SHORT, /lootBag: 'Coffre de butin'/);
  assert.match(readFileSync('src/ui/loot-bag.js', 'utf8'), /Coffre plein : trie-le/);
  assert.equal(LEARN.find((l) => l.id === 'lootbag').title, 'Le coffre de butin');
});

test('traductions : chaque texte ajouté ou renommé par l\'audit existe en anglais et en coréen', () => {
  const texts = ['Arène : un étage à franchir (gemmes et étoiles)', 'Tes compagnons deviennent des cartes : place-les et affronte les étages.', 'Des gemmes, des éclats et des grimoires à chaque étage franchi.',
    'Le Défi de la semaine, puis la Tour : des combats à règles spéciales.', 'Des récompenses à chaque palier franchi.', 'Défis du jour et de la semaine : la Tour et le Défi.', 'Dos de carte doré gagné !', 'Dos de carte doré',
    'Ta formation le porte dès le prochain combat.', 'Gagné en battant le gardien de l\'étage 25', '✔ Gardien vaincu : ta formation porte le', 'Rangé dans la Réserve', 'Réserve, Renaissance, Hauts faits…', 'Sac et Réserve pleins',
    'Sac et Réserve pleins.', 'Sac et Réserve pleins : recycle un objet pour acheter.', 'Sac et Réserve pleins : les récompenses avec un objet attendent ici. Recycle des objets.', 'Sac et Réserve pleins : libère de la place pour récupérer les objets.',
    'Objet en attente (sac et Réserve pleins)', 'Impossible : pas un objet ancestral, ou sac et Réserve pleins.', 'Tri : 3 au sac, 2 en Réserve, 1 en attente', '4 en attente : sac et Réserve pleins',
    'Épée rangé dans la Réserve (ensemble « Voile spectral »)', '2 récompenses avec un objet en attente (sac et Réserve pleins) : Objectifs › À récupérer.', 'S\'ouvre à l\'étape 2-5, avec un compagnon',
    ...LEARN.flatMap((l) => [l.title, l.what, l.gain]), TAB_LEAD.tower, TAB_LEAD.arena];
  for (const t of texts) for (const [name, lang] of [['en', en], ['ko', ko]]) {
    const out = lang.lookup(t);
    assert.ok(out, `${name} : « ${t} »`);
    assert.ok(!/Réserve|coffre/.test(out), `${name} : « ${t} » → ${out}`);
  }
});

test('1.6 / 1.7 / 3 — styles de l\'audit : feuille liée, nom entier, ombre de l\'arbre au-dessus, fond d\'arène, cadres par rareté', () => {
  assert.match(readFileSync('index.html', 'utf8'), /href="src\/ui\/audit103\.css"/);
  const css = readFileSync('src/ui/audit103.css', 'utf8');
  assert.match(css, /\.who-row \.who-card b \{[^}]*white-space: normal[^}]*-webkit-line-clamp: unset/);
  assert.match(css, /\.tree-wrap::after \{[^}]*pointer-events: none[^}]*box-shadow: inset/);
  assert.match(css, /arena_bg\.png/); assert.ok(existsSync('assets/ui/art102/arena_bg.png'));
  for (const r of ['uncommon', 'rare', 'epic', 'legendary']) assert.match(css, new RegExp(`\\.pcard\\.r-${r}`));
  assert.match(css, /\.door-card\.opening \.door-art/);
});
