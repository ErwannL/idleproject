// v10.3 (parties 8 et 9) : tests de fin de l'Équipement et de la Forge, dans un vrai navigateur.
// En 1116 × 993, 1280 × 720 et 390 × 844 : les 6 places et la fiche d'objet visibles sans fenêtre par-dessus (feuille
// du bas sur téléphone), aucun débordement horizontal, aucun point décimal, aucune erreur JavaScript, le premier bouton
// de la Forge visible sans défiler, et un parcours « équiper puis renforcer » en moins de 30 s d'actions (aussi sur une
// partie neuve). Captures dans dist/e2e-103-equip (ou le dossier donné).
// Usage : node tools/e2e-103-equip.mjs [dossier-captures]
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = resolve(process.argv[2] ?? 'dist/e2e-103-equip');
await mkdir(out, { recursive: true });
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const raw = await readFile('tests/fixtures/endgame.json', 'utf8');
const results = [];
const ok = (name, pass, info = '') => { results.push(pass); console.log(`${pass ? '✔' : '✘'} ${name} ${pass ? '' : info}`); };

async function open(w, h, { fresh = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  if (!fresh) await page.addInitScript((r) => { if (!sessionStorage.getItem('c')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('c', '1'); } }, raw);
  await page.goto(url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(fresh ? 1200 : 2500);
  await page.evaluate(() => __idle.ui.closeModal());
  return { ctx, page };
}
// Partie de test : 6 places portées, un sac fourni (dont un meilleur casque et 11 armes Épiques), de quoi renforcer.
const seed = async (page) => page.evaluate(async () => {
  const { generateItem, makeItem } = await import('./src/core/loot.js');
  const { Rng } = await import('./src/core/rng.js');
  const { equipItem } = await import('./src/core/inventory.js');
  const { equipBestAllGear } = await import('./src/core/companion-gear.js');
  const { levelForStage } = await import('./src/core/combat.js');
  const s = __idle.state; const rng = new Rng(7);
  s.maxStage = Math.max(s.maxStage, 139); s.records.bestStage = Math.max(s.records.bestStage ?? 1, 139);
  s.materials.shards = 79000; s.materials.grimoire = 14; s.materials.ascension = 18; s.gold = Math.max(s.gold, 1e30);
  const lvl = levelForStage(s.maxStage);
  s.inventory = [];
  for (let i = 0; i < 46; i++) s.inventory.push(generateItem(s, rng, { level: lvl - 30 + (i % 25) }));
  for (const it of [...s.inventory]) equipItem(s, it.id);
  equipBestAllGear(s);
  for (let i = 0; i < 11; i++) s.inventory.push(makeItem(s, 'short_sword', 'epic', lvl - 40 + i, undefined, rng));
  s.inventory.push(makeItem(s, 'iron_helm', 'legendary', lvl, undefined, rng));
  Object.assign(__idle.ui.view, { selectedItemId: null, eqSlot: null, sheetOpen: null, gearWho: 'hero', eqTab: 'gear' });
  __idle.ui.openTab('inventory'); __idle.ui.renderPanel(s);
});
const render = (page) => page.evaluate(() => { __idle.ui.renderPanel(__idle.state); });
// Un élément est « visible » s'il est entier dans la fenêtre et dans la zone visible du panneau, et si rien ne le
// recouvre en son centre (une fenêtre par-dessus, par exemple).
const visible = (page, sel, { inSheet = false } = {}) => page.evaluate(([sel, inSheet]) => {
  const body = document.getElementById('panel-body').getBoundingClientRect();
  return [...document.querySelectorAll(sel)].map((e) => {
    const b = e.getBoundingClientRect();
    const inside = b.width > 0 && b.top >= -0.5 && b.bottom <= innerHeight + 0.5 && b.left >= -0.5 && b.right <= innerWidth + 0.5 && (inSheet || (b.top >= body.top - 0.5 && b.bottom <= body.bottom + 0.5));
    const top = document.elementFromPoint(b.left + b.width / 2, b.top + Math.min(b.height / 2, 30));
    return inside && Boolean(top) && (e.contains(top) || top.contains(e));
  });
}, [sel, inSheet]);
const overflow = (page) => page.evaluate(() => {
  const b = document.getElementById('panel-body');
  const wide = [...b.querySelectorAll('.eq *, .fg *')].filter((e) => e.getBoundingClientRect().right > b.getBoundingClientRect().right + 1 && !e.closest('.eq-whos')).length;
  return { doc: document.documentElement.scrollWidth - innerWidth, body: b.scrollWidth - b.clientWidth, wide };
});
// v10.3.1 : sous chaque place, le premier mot de l'objet (« Heaume · Commun ») : jamais coupé par « … » ni rogné, et le nom
// complet est dans le `title` de la place. Les noms sont masqués sur téléphone (6 places) : alors seul le `title` compte.
const slotNames = (page, who) => page.evaluate((who) => [...document.querySelectorAll('.eq-doll .eq-slot:not(.empty)')].map((b) => {
  const n = b.querySelector('.eq-slot-name'); const shown = Boolean(n) && n.offsetParent !== null; const cs = n && getComputedStyle(n);
  // Héros : le nom vient de la partie ; compagnon : de la place elle-même (« Arme : Épée courte »), donc seul le premier mot est comparé.
  const full = who === 'hero' ? __idle.state.equipment[b.dataset.value]?.name ?? null : b.title.split(' : ').slice(1).join(' : ') || null;
  return { place: b.dataset.value, text: n?.textContent.trim(), shown, full, titleHasFull: Boolean(full) && b.title.includes(full),
    cut: shown && (n.scrollWidth > n.clientWidth + 1 || /…|\.\.\./.test(n.textContent) || cs.textOverflow === 'ellipsis') };
}), who);
const dotted = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => e.innerText).join(' ').match(/.{0,20}\d\.\d.{0,12}/)?.[0] ?? null, sel);

for (const [w, h] of [[1116, 993], [1280, 720], [390, 844]]) {
  const tag = `${w}×${h}`;
  const phone = w <= 600;
  const { ctx, page } = await open(w, h);
  await seed(page);
  await page.waitForTimeout(500);
  // 1. Équipement : les 6 places, la fiche, pas de fenêtre par-dessus.
  let slots = await visible(page, '.eq-doll .eq-slot');
  ok(`${tag} : les 6 places du héros sont visibles`, slots.length === 6 && slots.every(Boolean), JSON.stringify(slots));
  await page.screenshot({ path: `${out}/equip-${w}.png` });
  if (!phone) {
    const sheet = await page.evaluate(() => { const e = document.querySelector('.eq-main > .eq-sheet'); const b = e?.getBoundingClientRect(); const s = document.querySelector('.eq-stage').getBoundingClientRect();
      return { has: Boolean(e), right: b && b.left >= s.right - 1, top: b?.top, pop: Boolean(document.querySelector('#unit-host .unit-pop, #panel-body .unit-pop')), reinforce: Boolean(e?.querySelector('[data-action="upgrade-item"]')), h: b?.height };
    });
    const head = await visible(page, '.eq-main > .eq-sheet .eq-sh-head');
    ok(`${tag} : fiche de l'objet visible à droite du personnage, sans fenêtre par-dessus`, sheet.has && sheet.right && !sheet.pop && sheet.h > 200 && head[0] === true, JSON.stringify(sheet));
    ok(`${tag} : « Renforcer » est dans la fiche`, sheet.reinforce);
  } else {
    ok(`${tag} : rien n'est ouvert par-dessus tant qu'on n'a rien touché`, await page.evaluate(() => !document.querySelector('#unit-host .unit-pop')));
    await page.click('.eq-doll .eq-slot[data-value="helmet"]');
    await page.waitForSelector('#unit-host .eq-pop .eq-sheet');
    await page.waitForTimeout(350);
    const r = await page.evaluate(() => { const p = document.querySelector('#unit-host .eq-pop').getBoundingClientRect(); return { bottom: Math.round(innerHeight - p.bottom), top: Math.round(p.top), w: Math.round(p.width), strip: document.querySelectorAll('#unit-host .eq-strip-slot').length }; });
    ok(`${tag} : la fiche est une feuille du bas (collée en bas, pleine largeur)`, r.bottom === 0 && r.w === w && r.top > 150 && r.strip === 6, JSON.stringify(r));
    slots = await visible(page, '.eq-doll .eq-slot');
    ok(`${tag} : les 6 places restent visibles au-dessus de la feuille`, slots.length === 6 && slots.every(Boolean), JSON.stringify(slots));
    await page.screenshot({ path: `${out}/equip-feuille-${w}.png` });
    await page.click('#unit-host .eq-close');
    await page.waitForTimeout(250);
  }
  ok(`${tag} : Équipement sans débordement horizontal`, await overflow(page).then((o) => o.doc <= 0 && o.body <= 0 && o.wide === 0), JSON.stringify(await overflow(page)));
  const hn = await slotNames(page, 'hero');
  ok(`${tag} : aucun nom d'objet coupé par « … » sous les places du héros, nom complet dans le title`, hn.length === 6 && hn.every((x) => !x.cut && x.titleHasFull && (phone ? true : x.shown && x.text.split(' · ')[0] === x.full.split(' ')[0])), JSON.stringify(hn));
  ok(`${tag} : aucun nombre avec un point décimal (Équipement)`, (await dotted(page, '.eq')) === null, String(await dotted(page, '.eq')));
  // 2. Compagnon : 3 places, bonus écrits avec une virgule.
  await page.evaluate(() => { Object.assign(__idle.ui.view, { gearWho: __idle.state.companions.equipped[0], selectedItemId: null, eqSlot: null, sheetOpen: null }); __idle.ui.renderPanel(__idle.state); });
  slots = await visible(page, '.eq-doll .eq-slot');
  const cn = await slotNames(page, 'unit');
  ok(`${tag} : aucun nom d'objet coupé par « … » sous les places du compagnon (${cn.length} objets portés)`, cn.every((x) => !x.cut && x.titleHasFull && (!x.shown || x.text.split(' · ')[0] === x.full.split(' ')[0])), JSON.stringify(cn));
  ok(`${tag} : compagnon à 3 places visibles`, slots.length === 3 && slots.every(Boolean), JSON.stringify(slots));
  ok(`${tag} : compagnon sans point décimal ni débordement`, (await dotted(page, '.eq')) === null && (await overflow(page).then((o) => o.doc <= 0 && o.body <= 0 && o.wide === 0)), `${await dotted(page, '.eq')} ${JSON.stringify(await overflow(page))}`);
  await page.screenshot({ path: `${out}/compagnon-${w}.png` });
  for (const t of ['stars', 'skills', 'overview']) {
    await page.evaluate((t) => { document.querySelector(`.eq-tab[data-value="${t}"]`).click(); __idle.ui.renderPanel(__idle.state); }, t);
    if ((await dotted(page, '.eq')) !== null || (await overflow(page)).doc > 0) ok(`${tag} : onglet ${t} propre`, false, String(await dotted(page, '.eq')));
    await page.screenshot({ path: `${out}/compagnon-${t}-${w}.png` });
  }
  // 3. Parcours « équiper puis renforcer » : seulement des touchers, chronométrés.
  await page.evaluate(() => { Object.assign(__idle.ui.view, { gearWho: 'hero', eqTab: 'gear', selectedItemId: null, eqSlot: null, sheetOpen: null }); __idle.ui.renderPanel(__idle.state); document.getElementById('panel-body').scrollTop = 0; });
  const before = await page.evaluate(() => ({ helm: __idle.state.equipment.helmet?.id, up: __idle.state.equipment.weapon.upgrades ?? 0, equips: __idle.state.records.equips ?? 0 }));
  const t0 = Date.now();
  await page.click('[data-action="eq-quick"]');
  await page.screenshot({ path: `${out}/equipement-rapide-${w}.png` });
  await page.click('[data-action="eq-quick-ok"]');
  await page.waitForFunction((id) => __idle.state.equipment.helmet?.id !== id, before.helm);
  await page.waitForTimeout(150);
  if (phone) await page.evaluate(() => { __idle.ui.view.sheetOpen = null; __idle.ui.renderPanel(__idle.state); });
  await page.click('.eq-doll .eq-slot[data-value="weapon"]');
  await page.waitForSelector('.eq-sheet [data-action="upgrade-item"]:not([disabled])');
  const sheetName = await page.evaluate(() => ({ shown: (document.querySelector('#unit-host .eq-sheet') ?? document.querySelector('.eq-main > .eq-sheet')).querySelector('.eq-name')?.textContent.trim(), full: __idle.state.equipment.weapon.name }));
  ok(`${tag} : la fiche donne le nom complet de l'objet`, sheetName.shown?.startsWith(sheetName.full), JSON.stringify(sheetName));
  const promised = await page.evaluate(() => { const root = document.querySelector('#unit-host .eq-sheet') ?? document.querySelector('.eq-main > .eq-sheet');
    return { power: root.querySelector('.eq-row.pw b')?.textContent, stat: [...root.querySelectorAll('.eq-reinf .eq-row.chg:not(.pw)')].map((r) => [r.firstElementChild.textContent, r.querySelector('b').textContent])[0] }; });
  await page.click('.eq-sheet [data-action="upgrade-item"]');
  await page.waitForFunction((n) => (__idle.state.equipment.weapon.upgrades ?? 0) === n + 1, before.up);
  const seconds = (Date.now() - t0) / 1000;
  await render(page);
  const after = await page.evaluate(() => ({ helm: __idle.state.equipment.helmet?.rarity, equips: __idle.state.records.equips ?? 0, power: document.querySelector('.eq-power b').textContent,
    plus: document.querySelector('.eq-doll .eq-slot[data-value="weapon"] .eq-plusn')?.textContent }));
  ok(`${tag} : équiper puis renforcer en ${seconds.toFixed(1)} s d'actions (moins de 30 s)`, seconds < 30 && after.helm === 'legendary' && after.equips > before.equips && after.plus === `+${before.up + 1}`, JSON.stringify({ seconds, after, before }));
  ok(`${tag} : la puissance annoncée « avant → après » est celle obtenue`, Boolean(promised.power) && promised.power.startsWith(after.power), JSON.stringify({ promised, after }));
  await page.screenshot({ path: `${out}/renforce-${w}.png` });
  // 4. Forge : premier bouton visible sans défiler, 4 ateliers, pas de débordement.
  await page.evaluate(() => { __idle.ui.view.sheetOpen = null; __idle.ui.openTab('forge', { forgeSeg: 'recycle' }); __idle.ui.renderPanel(__idle.state); document.getElementById('panel-body').scrollTop = 0; });
  await page.waitForTimeout(400);
  const first = await visible(page, '.fg button.fg-btn');
  if (w === 1116) ok(`${tag} : le premier bouton de la Forge est visible sans défiler`, first[0] === true, JSON.stringify(first));
  if (w === 1116) ok(`${tag} : les 4 boutons d'atelier sont visibles sans défiler`, first.length === 4 && first.every(Boolean), JSON.stringify(first));
  const steps = await page.evaluate(() => [...document.querySelectorAll('.fg-step')].map((e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top)]; }));
  const banners = await page.evaluate(() => document.querySelectorAll('#panel-body .art-banner, #panel-body .forge-hero').length);
  ok(`${tag} : une seule illustration en tête de la Forge`, banners === 1, String(banners));
  if (phone) ok(`${tag} : les 4 ateliers en liste verticale`, steps.length === 4 && steps.every((s, i) => s[0] === steps[0][0] && (i === 0 || s[1] > steps[i - 1][1])), JSON.stringify(steps));
  else ok(`${tag} : les 4 ateliers côte à côte`, steps.length === 4 && steps.every((s, i) => s[1] === steps[0][1] && (i === 0 || s[0] > steps[i - 1][0])), JSON.stringify(steps));
  await page.screenshot({ path: `${out}/forge-${w}.png` });
  for (const seg of ['upgrade', 'fuse', 'craft']) {
    await page.evaluate((seg) => { __idle.ui.view.forgeSeg = seg; if (seg === 'fuse') __idle.ui.view.fuseOpen = 'weapon|epic'; __idle.ui.renderPanel(__idle.state); }, seg);
    const o = await overflow(page);
    const d = await dotted(page, '.fg');
    if (o.doc > 0 || o.body > 0 || o.wide > 0 || d !== null) ok(`${tag} : atelier ${seg} propre`, false, `${JSON.stringify(o)} ${d}`);
    await page.screenshot({ path: `${out}/forge-${seg}-${w}.png` });
    if (seg === 'fuse') {
      const fuse = await page.evaluate(() => ({ btn: document.querySelector('.fg-fuse')?.textContent.trim() ?? '', cases: document.querySelectorAll('.fg-cases .eq-tile:not(.empty):not(.next)').length, bar: document.querySelector('.fg-gauge-bar b')?.textContent }));
      ok(`${tag} : fusion — 5 cases remplies, jauge et bouton avec la mise et la chance`, /^Fusionner \(5 objets · 100 %\)$/.test(fuse.btn) && fuse.cases === 5 && fuse.bar === '100 %', JSON.stringify(fuse));
    }
  }
  // Renforcer depuis la Forge : même section que la fiche, même effet.
  const up0 = await page.evaluate(() => { __idle.ui.view.forgeSeg = 'upgrade'; __idle.ui.renderPanel(__idle.state); const r = document.querySelector('.fg-up-row'); r.click(); __idle.ui.renderPanel(__idle.state);
    const id = document.querySelector('.fg-sheet [data-action="upgrade-item"]')?.dataset.id; const it = Object.values(__idle.state.equipment).find((i) => i?.id === id); return { id, up: it?.upgrades ?? 0 }; });
  await page.click('.fg-sheet [data-action="upgrade-item"]');
  await page.waitForTimeout(200);
  const up1 = await page.evaluate((id) => Object.values(__idle.state.equipment).find((i) => i?.id === id)?.upgrades ?? 0, up0.id);
  ok(`${tag} : renforcer depuis l'atelier 2 de la Forge`, Boolean(up0.id) && up1 === up0.up + 1, JSON.stringify({ up0, up1 }));
  ok(`${tag} : aucune erreur JavaScript`, page.errors.length === 0, page.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// 5. Partie neuve : un nouveau joueur équipe un objet et renforce son arme, sans aide, en moins de 30 s.
{
  const { ctx, page } = await open(1116, 993, { fresh: true });
  await page.waitForFunction(() => __idle.state?.records, null, { timeout: 15000 });
  await page.evaluate(() => { __idle.ui.closeModal(); document.querySelectorAll('#prologue, .prologue').forEach((e) => e.remove()); const s = __idle.state; s.gold += 5000; s.materials.shards += 40;
    __idle.addItem('iron_helm', 'rare', 2); __idle.ui.openTab('inventory'); __idle.ui.renderPanel(s); });
  await page.waitForSelector('.eq');
  const t0 = Date.now();
  let how = 'Équipement rapide';
  if (await page.$('[data-action="eq-quick"]')) { await page.click('[data-action="eq-quick"]'); await page.click('[data-action="eq-quick-ok"]'); }
  else { how = 'carte du sac puis Équiper'; await page.click('.eq-bag-grid .eq-card:not(.worn)'); await page.click('.eq-sheet [data-action="equip"]'); }
  await page.waitForFunction(() => Boolean(__idle.state.equipment.helmet));
  await page.click('.eq-doll .eq-slot[data-value="weapon"]');
  await page.click('.eq-sheet [data-action="upgrade-item"]:not([disabled])');
  await page.waitForFunction(() => (__idle.state.equipment.weapon?.upgrades ?? 0) === 1);
  const seconds = (Date.now() - t0) / 1000;
  ok(`partie neuve : un objet équipé (${how}) puis l'arme renforcée en ${seconds.toFixed(1)} s (moins de 30 s)`, seconds < 30);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/partie-neuve-1116.png` });
  ok('partie neuve : aucune erreur JavaScript', page.errors.length === 0, page.errors.slice(0, 3).join(' | '));
  await ctx.close();
}
const n = results.filter(Boolean).length;
console.log(`${n}/${results.length} vérifications réussies · captures : ${out}`);
await browser.close(); server.close();
process.exit(n === results.length ? 0 : 1);
