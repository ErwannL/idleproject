// v10.3 (partie 10) : relève dans le navigateur tous les textes français que l'écran du Bastion affiche (nœuds texte,
// title, aria-label, messages), dans tous ses états, et liste ceux que l'anglais ou le coréen ne savent pas traduire.
// Usage : node tools/i18n-bastion-texts.mjs [--json fichier]   → code 1 s'il reste un texte sans traduction.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { startServer } from './serve.mjs';
import { lookup as en } from '../src/i18n/en.js';
import { lookup as ko } from '../src/i18n/ko.js';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const save = JSON.parse(await readFile('tests/fixtures/endgame.json', 'utf8'));
save.materials.shards = 60000; save.materials.grimoire = 40; save.materials.ascension = 9; save.materials.mastery = 4; save.gold = 1e60;
const page = await (await browser.newContext({ viewport: { width: 1116, height: 993 } })).newPage();
await page.addInitScript((r) => { if (!sessionStorage.getItem('c')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('c', '1'); } }, JSON.stringify(save));
await page.goto(url);
await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
await page.waitForTimeout(2500);
const texts = new Set();
const grab = async () => {
  const list = await page.evaluate(() => {
    const out = [];
    const root = document.getElementById('panel-body');
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.data.replace(/\s+/g, ' ').trim(); if (t && !n.parentElement.closest('canvas, script, style')) out.push(t); }
    for (const el of root.querySelectorAll('[title],[aria-label]')) for (const a of ['title', 'aria-label']) { const v = el.getAttribute(a); if (v) out.push(v.replace(/\s+/g, ' ').trim()); }
    out.push(...(window.__said ?? []));
    out.push(document.getElementById('panel-title').textContent.trim());
    return out;
  });
  for (const t of list) texts.add(t);
};
const step = async (fn, arg) => { await page.evaluate(fn, arg); await page.waitForTimeout(450); await grab(); };
await page.evaluate(() => { __idle.ui.closeModal(); window.__said = []; const t = __idle.ui.toast.bind(__idle.ui); __idle.ui.toast = (x, c) => { window.__said.push(x); t(x, c); }; });
const sel = (id) => { __idle.ui.view.bastionSel = id; __idle.ui.view.bastionPick = id; __idle.ui.view.bastionRes = null; __idle.ui.invalidate(); };
await step(() => __idle.ui.openTab('camp'));
for (const id of ['forge', 'library', 'workers']) await step(sel, id);
// Ouvriers, chantiers, commandes, recherches : tous les états.
await step(() => { const a = __idle.actions; a.bastion('worker', 'forge', 'dwarf'); a.bastion('build', 'forge'); a.bastion('order', 'ring', 'epic'); a.bastion('order', 'ring', 'epic'); a.bastion('worker', 'library', 'priestess'); a.bastion('build', 'library'); a.bastion('build', 'library'); a.bastion('research', 'sharp'); });
for (const id of ['forge', 'library']) await step(sel, id);
await step(() => { const b = __idle.state.bastion; for (const id of ['forge', 'library', 'mine', 'training', 'trade']) { b.buildings[id].level = id === 'forge' ? 6 : 3; b.buildings[id].build = null; } b.buildings.mine.worker = 'ranger'; b.at -= 5 * 3600000; b.research.levels = { sharp: 15, steel: 3, purse: 2 }; __idle.ui.invalidate(); });
for (const id of ['forge', 'library', 'mine', 'training', 'trade', 'expeditions', 'workers']) await step(sel, id);
await step(() => { const a = __idle.actions; a.bastion('collect', 'mine'); a.bastion('collect', 'training'); a.bastion('trade', 'buy-grimoire'); a.bastion('trade', 'sell-mastery'); a.bastion('research', 'fatal'); a.bastion('research', 'steel'); a.bastion('research', 'purse'); a.bastion('order', 'weapon', 'legendary'); a.bastion('worker', 'mine', null); a.bastion('worker', 'trade', 'squire'); a.bastion('collect-order', 99); a.bastion('build', 'mine'); });
for (const id of ['sharp', 'steel', 'fatal', 'guard', 'purse', 'spirit']) await step((r) => { __idle.ui.view.bastionSel = null; __idle.ui.view.bastionRes = r; __idle.ui.invalidate(); }, id);
// Chantier en pause (ouvrier parti en expédition), commande prête restée dans la file, bâtiment au maximum.
await step(() => { const s = __idle.state; const a = __idle.actions; a.bastion('build', 'training'); a.bastion('worker', 'training', 'lancer'); a.bastion('build', 'training'); a.startExpedition?.('lancer', 'patrol', 0); s.bastion.buildings.trade.level = 10;
  const it = s.equipment.weapon; while (s.lootBag.length < 40) s.lootBag.push({ ...structuredClone(it), id: `it${900000 + s.lootBag.length}` }); for (const o of s.bastion.orders) o.left = 1; });
await page.waitForTimeout(1500);
for (const id of ['training', 'forge', 'trade']) await step(sel, id);
await step(() => { __idle.state.lootBag.length = 2; __idle.actions.toggleCompanion('dwarf'); });
await page.waitForTimeout(1500);
// Rappels : Carnet et Sceau.
await step(() => { const b = __idle.state.bastion; b.news = [{ kind: 'order', ref: 1, text: 'Arme Épique', at: Date.now(), seal: 0, book: false }, { kind: 'build', ref: 'forge', text: 'Forge du forgeron niveau 7', at: Date.now(), seal: 0, book: false }, { kind: 'research', ref: 'sharp', text: 'Lames aiguisées niveau 3', at: Date.now(), seal: 0, book: false }]; __idle.ui.tab = null; __idle.ui.openTab('daybook'); });
const extra = await page.evaluate(async () => {
  const b = await import('./src/core/bastion.js'); const s = __idle.state; const out = [];
  const n = b.bastionSeal(s); out.push(n.text, n.why);
  for (const kind of ['build', 'research']) { s.bastion.news = [{ kind, ref: 'forge', text: kind === 'build' ? 'Bibliothèque niveau 2' : 'Peau d\'acier niveau 4', at: 1, seal: 0, book: false }]; const x = b.bastionSeal(s); out.push(x.text, x.why, b.bastionDaybookLine(s)); }
  s.bastion.news = [{ kind: 'order', ref: 1, text: 'Casque Légendaire', at: 1, seal: 0, book: false }, { kind: 'order', ref: 2, text: 'Arme Rare', at: 1, seal: 0, book: false }]; out.push(b.bastionSeal(s).text, b.bastionSeal(s).why, b.bastionDaybookLine(s));
  const note = b.bastionNotification(s); if (note) out.push(note.title, note.body);
  for (const why of ['team', 'expedition', 'gone']) for (const paused of [true, false]) out.push(b.workerNoticeText({ companionId: 'dwarf', building: 'mine', why, paused }));
  for (const d of b.BUILDINGS) out.push(b.buildingAccess({ ...s, bastion: null }, d.id).reason, d.name, d.role);
  const young = structuredClone(s); young.maxStage = 41; young.records.bestStage = 41; young.bastion = b.emptyBastion(1); young.companions.owned = {};
  for (const d of b.BUILDINGS) out.push(b.buildingAccess(young, d.id).reason, b.canBuild(young, d.id).reason);
  for (const r of b.RESEARCH) out.push(r.name, r.text, b.canResearch(young, r.id).reason);
  for (const t of b.ORDER_TIERS) out.push(t.label, b.canOrder(young, 'weapon', t.id).reason);
  out.push(b.canOrder(young, 'x', 'rare').reason, b.assignWorker(young, 'forge', 'dwarf'), 'Le Bastion ouvre ses portes : ☰ › Bastion', 'Commande livrée dans le coffre de butin : Arc long elfique', 'Chantier terminé : Mine de cristal niveau 4', 'Recherche terminée : Coup fatal niveau 2');
  return out.filter(Boolean);
});
for (const t of extra) texts.add(t);
// Avant l'étape 40 : le Camp et l'annonce ; carte de déblocage.
await step(() => { const s = __idle.state; s.maxStage = 12; s.records.bestStage = 12; delete s.bastion; __idle.ui.openTab('camp'); });
for (const t of ['Le Bastion', 'Nouveau au Bastion', 'Tes compagnons libres y travaillent. Premier bâtiment : la Forge du forgeron.']) texts.add(t);
await browser.close(); server.close();

const FRENCH = /[àâçéèêëîïôûùœ]|\b(le|la|les|des|du|un|une|et|est|tu|ton|ta|tes|pas|par|pour|avec|sans|niv|niveau|encore|aucun|aucune|qui|au|aux|en|sur)\b/i;
const missing = { en: [], ko: [] };
for (const t of [...texts].sort()) {
  if (!/\p{L}{3}/u.test(t) || /^(Monde \d+ terminé|Premi[eè]re? .+) ! \+\d+ gemmes$/.test(t)) continue; // nombres et unités ; messages d'un autre écran
  for (const [code, look] of [['en', en], ['ko', ko]]) { const r = look(t); if (r === null || r === undefined || (r === t && FRENCH.test(t))) missing[code].push(t); }
}
const args = process.argv.slice(2);
if (args.includes('--json')) await writeFile(args[args.indexOf('--json') + 1], JSON.stringify({ texts: [...texts].sort(), missing }, null, 1));
for (const code of ['en', 'ko']) { console.log(`\n${code} : ${missing[code].length} texte(s) sans traduction sur ${texts.size}`); for (const t of missing[code]) console.log(`  « ${t} »`); }
process.exit(missing.en.length + missing.ko.length ? 1 : 0);
