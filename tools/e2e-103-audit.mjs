// v10.3 (audit des parties 0 à 7 de docs/plan-v1030.md) : ce que la relecture a vérifié dans un vrai navigateur, et
// les corrections qu'elle a faites. Deux modes :
//   node tools/e2e-103-audit.mjs             → vérifications rapides (≈ 3 min), sauvegarde de fin de jeu
//   node tools/e2e-103-audit.mjs learn [12]  → partie neuve (?learn) suivie N minutes ENTIÈRES (tests de la partie 4)
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const raw = await readFile('tests/fixtures/endgame.json', 'utf8');
const results = [];
const ok = (name, pass, info = '') => { results.push(Boolean(pass)); console.log(`${pass ? '✔' : '✘'} ${name} ${info}`); };
const allErrors = [];
async function open(w, h, { dpr = 1, fresh = false, query = '' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => allErrors.push(`${w}×${h} : ${e.message}`));
  if (!fresh) await page.addInitScript((r) => { if (!sessionStorage.getItem('c')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('c', '1'); } }, raw);
  await page.goto(url + query);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  if (!fresh) { await page.waitForTimeout(2500); await page.evaluate(() => __idle.ui.closeModal()); }
  return { ctx, page };
}
const FORMATS = [[1116, 993, 1, 'PC 1116 × 993'], [1280, 720, 1, 'PC 1280 × 720'], [390, 844, 3, 'téléphone 390 × 844']];

if (process.argv[2] === 'learn') await learnRun(Number(process.argv[3] ?? 12));
else await quickRun();

const n = results.filter(Boolean).length;
console.log(`${n}/${results.length} vérifications réussies`);
await browser.close(); server.close();
process.exit(n === results.length ? 0 : 1);

async function quickRun() {
  // ---- 2.1 : l'Arène est un vrai onglet de Combat ; tuile dans la Carte et dans Défis ----
  {
    const { ctx, page } = await open(1116, 993);
    await page.evaluate(() => __idle.ui.openTab('arena'));
    await page.waitForTimeout(800);
    const t = await page.evaluate(() => ({ tab: __idle.ui.tab, title: document.getElementById('panel-title').textContent, active: document.querySelector('#panel-subtabs .active, #panel-subtabs [aria-selected="true"]')?.textContent ?? '',
      subs: [...document.querySelectorAll('#panel-subtabs button')].map((b) => b.textContent.trim().replace(/^(.+)\1$/, '$1')), fight: Boolean(document.querySelector('[data-action="card-fight"]:not([disabled])')) }));
    ok('2.1 onglet « Arène » dans Combat (titre Arène, onglet Arène allumé, Combattre actif)', t.tab === 'arena' && t.title === 'Arène' && /Arène/.test(t.active) && t.fight && ['Carte', 'Donjons', 'Arène', 'Défis'].every((x) => t.subs.includes(x)), JSON.stringify(t));
    await page.evaluate(() => __idle.ui.openTab('campaign'));
    await page.waitForTimeout(700);
    const tile = await page.evaluate(() => { const e = document.querySelector('#panel-body .arena-tile'); return e ? { bg: getComputedStyle(e).backgroundImage, w: e.getBoundingClientRect().width } : null; });
    await page.click('#panel-body .arena-tile').catch(() => {});
    await page.waitForTimeout(600);
    ok('2.1 tuile arena_tile.png dans la Carte, elle ouvre l\'Arène', Boolean(tile) && /arena_tile\.png/.test(tile.bg) && tile.w > 200 && await page.evaluate(() => __idle.ui.tab === 'arena'), JSON.stringify(tile));
    await page.evaluate(() => __idle.ui.openTab('tower'));
    await page.waitForTimeout(700);
    const defis = await page.evaluate(() => ({ tab: __idle.ui.tab, seg: [...document.querySelectorAll('#panel-body [data-action="defi-tab"]')].map((b) => b.dataset.value), tile: Boolean(document.querySelector('#panel-body .arena-tile')) }));
    await page.evaluate(() => __idle.ui.openTab('tower', { defiTab: 'arena' }));
    await page.waitForTimeout(500);
    ok('2.1 Défis : plus de segment Arène, tuile vers l\'onglet ; l\'ancien chemin mène à l\'Arène', defis.tab === 'tower' && !defis.seg.includes('arena') && defis.tile && await page.evaluate(() => __idle.ui.tab === 'arena'), JSON.stringify(defis));

    // ---- 1.2 : nom de chaque carte ennemie = son image (écran de l'Arène), gardien illustré, rôle en sous-titre ----
    await page.evaluate(() => __idle.ui.openTab('arena'));
    const cards = await page.evaluate(async () => {
      const { cardArena, floorCards, arenaCal } = await import('./src/core/arena-cards.js');
      const { icon } = await import('./src/ui/common.js');
      const bad = []; let n = 0;
      for (const f of [1, 3, 7, 10, 20, 25]) {
        cardArena(__idle.state).best = f - 1; __idle.ui.view.cardFloor = f; __idle.ui.invalidate();
        await new Promise((r) => setTimeout(r, 1200));
        const data = floorCards(f, arenaCal(__idle.state)).cards;
        [...document.querySelectorAll('.ct-foes .pcard')].forEach((p, i) => {
          const d = data[i]; n++;
          const im = p.querySelector('.pc-pic img'); const b = p.querySelector('.pc-top b');
          const want = d.sprite.startsWith('file:') ? d.sprite.slice(5) : icon(d.sprite);
          const sub = p.querySelector('.pc-role')?.textContent ?? '';
          if (b.textContent !== d.name || im?.getAttribute('src') !== want || !(im?.naturalWidth > 0) || !sub || b.scrollHeight > b.clientHeight + 1) bad.push(`étage ${f} : ${d.name} (${b.textContent}, image ${im?.getAttribute('src') === want}, sous-titre « ${sub} », coupé ${b.scrollHeight > b.clientHeight + 1})`);
          if (d.guardian && !/guardian_\d\.png$/.test(im?.getAttribute('src') ?? '')) bad.push(`étage ${f} : le gardien n'a pas son illustration`);
        });
        if (!document.querySelector('.ct-foes') || !/arena_bg\.png/.test(getComputedStyle(document.querySelector('.ct-foes')).backgroundImage)) bad.push(`étage ${f} : pas de fond d'arène`);
      }
      return { n, bad };
    });
    ok('1.2 / 3 Arène : chaque carte ennemie a le nom et l\'image de son monstre, gardien illustré, fond d\'arène', cards.n >= 14 && !cards.bad.length, `${cards.n} cartes ${cards.bad.slice(0, 3).join(' | ')}`);

    // ---- 2.4 / 6.2 : gardien de l'étage 25 jouable (plantait), barre et nom en haut, dos de carte doré gagné ----
    await page.evaluate(async () => { const { cardArena } = await import('./src/core/arena-cards.js'); const c = cardArena(__idle.state); c.best = 24; c.keep = c.cal; c.cal = { hp: c.cal.hp, atk: 0.0001 }; __idle.ui.closePanel(); __idle.ui.arenaFight(25); });
    const opened = await page.waitForSelector('.arena-map .am-canvas', { timeout: 8000 }).then(() => true).catch(() => false);
    await page.waitForTimeout(2600);
    const g = opened ? await page.evaluate(() => ({ boss: document.querySelector('.am-boss:not(.hidden) b')?.textContent ?? null, deal: document.querySelector('.am-cards').className })) : {};
    if (opened) await page.evaluate(() => document.querySelector('.am-skip').click());
    await page.waitForTimeout(900);
    const end = opened ? await page.evaluate(() => document.querySelector('.am-end')?.innerText ?? '') : '';
    ok('6.2 étage 25 : le combat du gardien s\'ouvre sur la carte, son nom et sa barre de vie en haut', opened && g.boss === 'Gardien de bronze', JSON.stringify(g));
    ok('2.4 dos de carte doré : annoncé gagné à la fin du combat du premier gardien', /Dos de carte doré gagné/.test(end), end.replace(/\n+/g, ' | ').slice(0, 120));
    await page.evaluate(() => document.querySelector('.arena-map')?.close());
    await page.evaluate(async () => { const { cardArena } = await import('./src/core/arena-cards.js'); const c = cardArena(__idle.state); c.cal = c.keep; __idle.ui.arenaFight(7); });
    await page.waitForSelector('.arena-map .am-canvas', { timeout: 8000 });
    const back = await page.evaluate(() => document.querySelector('.am-cards').classList.contains('back-gold'));
    await page.evaluate(() => { document.querySelector('.arena-map').close(); __idle.ui.openTab('arena'); });
    await page.waitForTimeout(900);
    ok('2.4 dos de carte doré : porté au combat suivant et affiché dans la formation', back && await page.evaluate(() => Boolean(document.querySelector('.cf-backchip')) && Boolean(document.querySelector('.cf-slot .pcard.back-gold'))));

    // ---- 6.2 : Survie sur la carte, plus aucun portrait fixe ----
    await page.click('[data-action="arena-mode"][data-value="survival"]');
    await page.waitForTimeout(500);
    await page.click('[data-action="arena-survival"]').catch(() => {});
    await page.waitForTimeout(2500);
    const sv = await page.evaluate(() => ({ map: Boolean(document.querySelector('.arena-map .am-canvas')), fixed: document.querySelectorAll('.arena-overlay, .arena-ally, .arena-foe').length, marks: document.querySelector('.arena-map')?.scene?.marks().length ?? -1 }));
    ok('6.2 Survie : jouée sur la carte, aucun portrait fixe', sv.map && sv.fixed === 0, JSON.stringify(sv));
    await page.evaluate(() => document.querySelector('.arena-map')?.close());
    await page.click('[data-action="arena-mode"][data-value="global"]');
    await page.waitForTimeout(600);
    await page.click('[data-action="global-boss"]').catch(() => {});
    await page.waitForTimeout(3000);
    const gb = await page.evaluate(() => ({ canvas: document.querySelectorAll('.wb-overlay canvas').length, fixed: document.querySelectorAll('.arena-overlay, .arena-ally, .arena-foe').length }));
    ok('6.2 Boss commun : joué sur une scène du moteur (WorldBossScene, pas ArenaScene), aucun portrait fixe', gb.canvas >= 1 && gb.fixed === 0, JSON.stringify(gb));
    await ctx.close();
  }

  // ---- 5 / 6.2 : dans les 3 formats, les monstres sont à l'écran pendant le combat, avec leur nom ----
  for (const [w, h, dpr, label] of FORMATS) {
    const { ctx, page } = await open(w, h, { dpr });
    const bad = [];
    for (const f of [7, 10, 25]) {
      await page.evaluate(async (f) => { const { cardArena } = await import('./src/core/arena-cards.js'); cardArena(__idle.state).best = Math.max(24, f - 1); __idle.ui.closePanel(); __idle.ui.arenaFight(f); }, f);
      const up = await page.waitForSelector('.arena-map .am-canvas', { timeout: 8000 }).then(() => true).catch(() => false);
      if (!up) { bad.push(`étage ${f} : la carte ne s'ouvre pas`); continue; }
      await page.waitForTimeout(2300); // ≈ 1,3 s après le premier coup
      const r = await page.evaluate(async (f) => {
        const { floorCards, arenaCal } = await import('./src/core/arena-cards.js');
        const el = document.querySelector('.arena-map'); const st = el.querySelector('.am-stage').getBoundingClientRect();
        const marks = el.scene.marks();
        const names = [...el.querySelectorAll('.am-name')].map((n) => { const b = n.getBoundingClientRect(); return { t: n.textContent, in: b.left >= st.left - 1 && b.right <= st.right + 1 && b.bottom <= st.bottom }; });
        const data = floorCards(f, arenaCal(__idle.state)).cards;
        return { w: st.width, h: st.height / innerHeight, marks: marks.map((m) => ({ n: m.name, x: Math.round(m.x), seen: m.seen })), names, want: data.filter((c) => !c.boss).map((c) => c.name), boss: data.find((c) => c.boss)?.name ?? null, bar: el.querySelector('.am-boss:not(.hidden) b')?.textContent ?? null };
      }, f);
      if (!r.marks.length || r.marks.some((m) => !m.seen || m.x < 0 || m.x > r.w - 8)) bad.push(`étage ${f} : monstre hors de l'écran ${JSON.stringify(r.marks)}`);
      if (r.want.some((n) => !r.names.some((x) => x.t === n)) || r.names.some((x) => !r.want.includes(x.t))) bad.push(`étage ${f} : noms ${JSON.stringify(r.names.map((x) => x.t))} ≠ ${JSON.stringify(r.want)}`);
      if (r.boss !== r.bar) bad.push(`étage ${f} : barre du boss « ${r.bar} » ≠ « ${r.boss} »`);
      if (w < 520 && Math.abs(r.h - 0.55) > 0.03) bad.push(`scène ${Math.round(r.h * 100)} % de la hauteur (55 % attendus)`);
      await page.evaluate(() => document.querySelector('.arena-map').close());
    }
    ok(`6.2 Arène ${label} : tous les monstres à l'écran, chacun sous son nom ; boss et gardien nommés en haut`, !bad.length, bad.slice(0, 2).join(' | '));
    await ctx.close();
  }

  // ---- 0 / 1.6 / 3 : feuille de donjon avec « Difficile » ouvert, porte qui s'ouvre au choix ----
  {
    const { ctx, page } = await open(1116, 993);
    const sheets = [];
    for (const best of [1, 2]) {
      await page.evaluate((b) => { const s = __idle.state; s.keys = 3; s.maxStage = Math.max(s.maxStage, 200); s.dungeonBest = { crypt: b }; s.dungeonsCleared = { crypt: 3 }; __idle.ui.view.dungeonSheet = false; __idle.ui.view.dungeonDiff = null; __idle.ui.openTab('dungeons'); __idle.ui.invalidate(); }, best);
      await page.waitForTimeout(600);
      await page.click('.dg-card .btn[data-action="dungeon-sel"]');
      await page.waitForTimeout(700);
      sheets.push(await page.evaluate(() => { const e = document.querySelector('.dg-enter [data-action="enter-dungeon"]'); if (!e) return false; const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && Boolean(document.querySelector('.dg-sheet .dg-boss-portrait')); }));
      await page.evaluate(() => { __idle.ui.view.dungeonSheet = false; __idle.ui.dgSheet(''); });
    }
    ok('0 / 1.6 feuille de donjon : s\'ouvre avec « Difficile » débloqué, portrait du boss en tête, « Entrer » visible', sheets.every(Boolean), JSON.stringify(sheets));
    await page.evaluate(() => { __idle.state.dungeonBest = {}; __idle.ui.invalidate(); });
    await page.waitForTimeout(500);
    await page.click('.dg-card .btn[data-action="dungeon-sel"]');
    await page.waitForTimeout(600);
    await page.click('.dg-enter [data-action="enter-dungeon"]');
    const door = await page.waitForSelector('#modal:not(.hidden) .door-card', { timeout: 90000 }).then(() => true).catch(() => false);
    let opening = false, closed = false, drawn = false;
    if (door) {
      drawn = await page.evaluate(() => [...document.querySelectorAll('.door-card img.door-art')].every((i) => i.naturalWidth === 96 && i.naturalHeight === 128 && /art102\/door_/.test(i.getAttribute('src'))) && document.querySelectorAll('.door-card').length >= 2);
      await page.click('.door-card');
      opening = await page.evaluate(() => Boolean(document.querySelector('.door-card.opening')));
      closed = await page.waitForFunction(() => !document.querySelector('#modal:not(.hidden) .door-screen'), null, { timeout: 3000 }).then(() => true).catch(() => false);
    }
    ok('3 portes de salles : dessinées côte à côte, la porte choisie s\'ouvre puis la salle commence', door && drawn && opening && closed, JSON.stringify({ door, drawn, opening, closed }));
    await ctx.close();
  }

  // ---- 1.6 / 1.7 : nom entier dans la rangée des personnages ; ombre au bord de l'Arbre avancé ----
  for (const [w, h, dpr, label] of [FORMATS[0], FORMATS[2]]) {
    const { ctx, page } = await open(w, h, { dpr });
    await page.evaluate(() => { const s = __idle.state; s.companions.owned.pyromancer = { stars: 1, level: 5 }; s.companions.equipped = ['pyromancer', ...s.companions.equipped.filter((x) => x !== 'pyromancer')].slice(0, 3); __idle.ui.openTab('inventory'); });
    await page.waitForTimeout(900);
    const who = await page.evaluate(() => [...document.querySelectorAll('.who-card')].map((b) => { const n = b.querySelector('b'); const r = document.createRange(); r.selectNodeContents(n); const tr = r.getBoundingClientRect(), bb = b.getBoundingClientRect(); return { title: b.title, shown: n.innerText.trim(), clipped: tr.left < bb.left - 0.5 || tr.right > bb.right + 0.5 || n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1 }; }));
    if (who.length) ok(`1.6 ${label} : « Pyromancienne » en entier dans Héros › Équipement`, who.some((x) => x.title === 'Pyromancienne') && who.every((x) => x.shown === x.title && !x.clipped), JSON.stringify(who.filter((x) => x.clipped || x.shown !== x.title)));
    else ok(`1.6 ${label} : rangée des personnages absente (écran d'équipement refait ?)`, false);
    await page.evaluate(() => __idle.ui.openTab('tree'));
    await page.waitForTimeout(500);
    await page.click('[data-action="tree-seg"][data-value="tree"]').catch(() => {});
    await page.waitForTimeout(800);
    const tree = await page.evaluate(() => { const wr = document.querySelector('.tree-wrap'); if (!wr) return null; const a = getComputedStyle(wr, '::after'); const v = wr.querySelector('.tree-viewport'); return { shadow: a.boxShadow, pe: a.pointerEvents, z: a.zIndex, more: v.scrollWidth > v.clientWidth, h: Math.round(parseFloat(a.height)), vh: v.clientHeight }; });
    ok(`1.7 ${label} : ombre sur les bords de l'Arbre avancé, au-dessus de l'arbre, sans gêner le toucher`, tree && /inset/.test(tree.shadow) && tree.pe === 'none' && Number(tree.z) >= 1 && tree.more && Math.abs(tree.h - tree.vh) <= 8, JSON.stringify(tree));
    if (w < 520) {
      const title = await page.evaluate(async () => { const out = []; for (const t of ['upgrades', 'encyclopedia']) { __idle.ui.openTab(t); await new Promise((r) => setTimeout(r, 500)); const e = document.getElementById('panel-title'); const q = (id) => { const x = document.getElementById(id); return x ? Math.round(x.getBoundingClientRect().width) : 0; }; out.push({ t: e.textContent, cut: e.scrollWidth > e.clientWidth + 1, fold: q('panel-fold'), help: q('panel-help'), close: q('panel-close') }); } return out; });
      ok('1.6 téléphone : titre du panneau en entier, ⤢ caché, ? et ✕ à 32 px', title.every((x) => !x.cut && x.fold === 0 && x.help === 32 && x.close === 32) && title[0].t === 'Améliorations' && title[1].t === 'Collections', JSON.stringify(title));
    }
    await ctx.close();
  }

  // ---- 7 : coffre de butin posé sur le sol, loin des bords, plein → « trie-le », touche B ----
  for (const [w, h, dpr, label] of [[1116, 993, 1, '1116 × 993'], [1716, 1000, 1, '1716 × 1000'], [390, 844, 3, '390 × 844']]) {
    const { ctx, page } = await open(w, h, { dpr });
    const r = await page.evaluate(async () => {
      const { LOOT_BAG_MAX } = await import('./src/core/inventory.js');
      const s = __idle.state; const pool = [...s.inventory, ...(s.stash ?? []), ...Object.values(s.equipment).filter(Boolean)];
      s.lootBag = Array.from({ length: 4 }, (_, k) => ({ ...pool[k % pool.length], id: `t${k}`, rarity: 'rare' }));
      __idle.ui.lootBag.lastKey = ''; __idle.ui.lootBag.update(s);
      await new Promise((res) => setTimeout(res, 300));
      const bag = document.getElementById('loot-bag'); const b = bag.getBoundingClientRect(); const a = document.getElementById('stage-area').getBoundingClientRect();
      const feet = a.top + parseFloat(getComputedStyle(bag.parentElement).getPropertyValue('--feet-px') || getComputedStyle(document.getElementById('scene').parentElement).getPropertyValue('--feet-px') || '0');
      const hit = (id) => { const e = document.getElementById(id); if (!e || e.offsetParent === null) return false; const x = e.getBoundingClientRect(); return !(x.right <= b.left || x.left >= b.right || x.bottom <= b.top || x.top >= b.bottom); };
      const out = { vis: b.width > 0, left: Math.round(b.left - a.left), right: Math.round(a.right - b.right), top: Math.round(b.top - a.top), under: Math.round(a.bottom - b.bottom), ground: Math.round(b.bottom - feet), h: Math.round(b.height), overBar: hit('skill-bar'), overSeal: hit('next-action') };
      s.lootBag = Array.from({ length: LOOT_BAG_MAX }, (_, k) => ({ ...pool[k % pool.length], id: `f${k}` }));
      __idle.ui.lootBag.lastKey = ''; __idle.ui.lootBag.update(s);
      await new Promise((res) => setTimeout(res, 200));
      out.full = bag.classList.contains('lb-full'); out.say = bag.querySelector('.lb-bubble:not(.hidden)')?.textContent ?? '';
      return out;
    });
    ok(`7 coffre ${label} : dans la scène, sur le sol, à ≥ 40 px de chaque bord, jamais sous la barre ni le Sceau`, r.vis && r.left >= 40 && r.right >= 40 && r.top >= 40 && r.under >= 0 && Math.abs(r.ground) <= 14 && !r.overBar && !r.overSeal, JSON.stringify(r));
    ok(`7 coffre ${label} : plein → il déborde et dit « Coffre plein : trie-le »`, r.full && r.say === 'Coffre plein : trie-le', r.say);
    await page.keyboard.press('b');
    await page.waitForTimeout(400);
    const sheet = await page.evaluate(() => { const s = document.getElementById('loot-sheet'); return { open: !s.classList.contains('hidden'), title: s.querySelector('.lb-head b')?.textContent, keep: s.querySelector('[data-lb="keep-best"]')?.textContent, hand: s.querySelector('[data-lb="apply"]')?.textContent, dests: [...new Set([...s.querySelectorAll('.lb-d')].map((d) => d.textContent.replace(/^\S+\s/, '')))] }; });
    ok(`7 coffre ${label} : la touche B ouvre « Coffre de butin » (Équiper / Ranger / Recycler, Garder le meilleur, Trier à la main)`, sheet.open && sheet.title === 'Coffre de butin' && /Garder le meilleur, recycler le reste/.test(sheet.keep) && /Trier à la main/.test(sheet.hand) && ['Ranger', 'Recycler'].every((x) => sheet.dests.includes(x)), JSON.stringify(sheet));
    await ctx.close();
  }
  ok('aucune erreur JavaScript pendant l\'audit', allErrors.length === 0, allErrors.slice(0, 3).join(' | '));
}

// ---- Partie 4 : partie neuve suivie pendant N minutes entières, en ne touchant que ce que le jeu montre ----
async function learnRun(MIN) {
  const { ctx, page } = await open(1116, 993, { fresh: true, query: '?quests&learn' });
  // Notion ouverte par chaque type de consigne (plus large que la table du jeu : Équiper, Améliorer et l'équipe aussi).
  const NOTION = { upgrade: 'upgrades', equip: 'inventory', skills: 'skills', lootbag: 'lootbag', summon: 'summon', place: 'summon', team: 'summon', level: 'summon', recycle: 'forge', fusion: 'forge', keys: 'dungeons', 'c-arena': 'tower', 'c-tower': 'defis', 'c-challenge': 'defis' };
  const JARGON = /Contrat|Trouvaille|Haut fait|Chronique|Sac de butin|sac de butin|Mutation|Résonance|Synergie|Palier|Ascension/;
  const t0 = Date.now();
  let lastSid = null, upShows = 0, multi = 0, held = 0, noWhy = 0, last = null;
  const early = new Map(), texts = new Map(), jargon = new Set();
  while (Date.now() - t0 < MIN * 60000) {
    await page.waitForTimeout(1000);
    const r = await page.evaluate((NOTION) => {
      const vis = (el) => el && !el.classList.contains('hidden') && el.offsetParent !== null;
      const seal = document.querySelector('#next-action');
      const sid = vis(seal) ? seal.dataset.kind ?? null : null;
      const text = vis(seal) ? document.getElementById('next-action-text')?.textContent ?? '' : '';
      const why = vis(seal) ? document.getElementById('next-action-why')?.textContent ?? '' : '';
      const s = __idle.state;
      const count = (q) => [...document.querySelectorAll(q)].filter((e) => e.offsetParent !== null).length;
      const cards = count('.learn-card') + count('.howto-card'), bubbles = count('.res-bubble') + count('.best-card');
      const learned = s.ui.learned ?? [];
      const early = sid && NOTION[sid] && !learned.includes(NOTION[sid]) ? `${sid} (« ${text} ») avant la carte « ${NOTION[sid]} »` : null;
      // Le joueur : la carte d'abord, sinon le doigt, l'anneau, le Sceau.
      const learn = document.querySelector('.howto-card button, .learn-card [data-go]');
      if (learn) learn.click();
      else {
        const layer = document.getElementById('tuto-layer');
        const f = layer?.querySelector('.tuto-finger:not([hidden])');
        window.__k = (window.__k ?? 0) + 1;
        if (f && layer.target && window.__k % 3 !== 0) layer.target.click();
        else if (window.__k % 2 && document.querySelector('.ring-target:not([disabled])')) document.querySelector('.ring-target:not([disabled])').click();
        else if (vis(seal)) seal.click();
        document.querySelector('.best-card.first-item button')?.click();
        document.querySelector('#modal:not(.hidden) [data-action="summon-place"]')?.click();
        document.querySelector('#modal:not(.hidden) [data-action="close-modal"]')?.click();
      }
      return { sid, text, why, cards, bubbles, early, stage: s.records?.bestStage ?? s.maxStage, team: (s.companions?.equipped ?? []).length, items: Object.values(s.equipment ?? {}).filter(Boolean).length,
        ups: Object.values(s.upgrades ?? {}).reduce((a, b) => a + b, 0), skills: Object.values(s.skills ?? {}).filter((v) => (v?.level ?? v) > 0).length, learned: learned.join(',') };
    }, NOTION);
    if (r.cards + r.bubbles > 1) multi++;
    if (r.cards > 0 && r.bubbles > 0) held++;
    if (r.early) early.set(r.early, (early.get(r.early) ?? 0) + 1);
    if (r.text && !r.why.trim()) noWhy++;
    if (r.sid === 'upgrade' && lastSid !== 'upgrade') upShows++;
    lastSid = r.sid;
    if (r.text) { texts.set(r.text, (texts.get(r.text) ?? 0) + 1); if (JARGON.test(r.text)) jargon.add(r.text); }
    last = r;
    if (process.env.TRACE && Math.round((Date.now() - t0) / 1000) % 60 === 0) console.log(Math.round((Date.now() - t0) / 1000), JSON.stringify(r));
  }
  console.log(`Fin à ${Math.round((Date.now() - t0) / 1000)} s : ${JSON.stringify(last)}`);
  console.log(`Consignes vues : ${[...texts.keys()].join(' | ')}`);
  ok(`4.1 ${MIN} min : aucune consigne n'ouvre une notion pas encore présentée`, early.size === 0, [...early].map(([k, v]) => `${k} : ${v} s`).join(' ; '));
  ok(`4.2 ${MIN} min : jamais plus d'un message à lire à la fois (cartes, bulles de ressource, « Nouvel objet »)`, multi === 0 && held === 0, `${multi} s à plusieurs, ${held} s avec une bulle pendant une carte`);
  ok(`4.3 ${MIN} min : « Améliorer » apparaît 5 fois au plus`, upShows <= 5, `${upShows} fois`);
  ok(`4.4 ${MIN} min : aucun mot hors glossaire dans le Sceau`, jargon.size === 0, [...jargon].join(' | '));
  ok(`${MIN} min : chaque consigne a sa ligne « pourquoi »`, noWhy === 0, `${noWhy} s sans`);
  ok(`5 ${MIN} min : le joueur a un compagnon placé, un objet équipé, 5 améliorations et une compétence`, last.team >= 1 && last.items >= 1 && last.ups >= 5 && last.skills >= 1, JSON.stringify({ team: last.team, items: last.items, ups: last.ups, skills: last.skills, stage: last.stage }));
  ok('aucune erreur JavaScript', allErrors.length === 0, allErrors.slice(0, 3).join(' | '));
  await ctx.close();
}
