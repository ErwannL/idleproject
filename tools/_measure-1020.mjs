// v10.20 (6) : outil de mesure : de combien #panel-body défile, par onglet et par taille (téléphone).
//   node tools/_measure-1020.mjs 405x896,360x800 [onglets] ; SHOT=dossier pour des captures JPEG.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const fx = await readFile('tests/fixtures/endgame.json', 'utf8');
const server = await startServer(0); const url = `http://localhost:${server.address().port}/`;
const b = await chromium.launch();
const sizes = (process.argv[2] || '405x896').split(',');
const tabs = (process.argv[3] || 'inventory,upgrades,skills,tree,forge,companions,camp,expeditions,campaign,dungeons,arena,tower,event,summon,shop,daybook,contracts,encyclopedia,looks,boss,ranking,guild,stats,options').split(',');
for (const sz of sizes) {
  const [w, h] = sz.split('x').map(Number);
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true }); const p = await ctx.newPage();
  await p.addInitScript((s) => { if (!sessionStorage.getItem('a')) { localStorage.setItem('idle-rpg.save', s); sessionStorage.setItem('a', '1'); } }, fx);
  await p.goto(url); await p.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 }); await p.waitForTimeout(5000);
  const out = [];
  for (const t of tabs) {
    await p.evaluate((t) => { try { __idle.ui.closeModal(); } catch { /* */ } __idle.ui.openTab(t); }, t); await p.waitForTimeout(1200);
    await p.evaluate(() => { try { __idle.ui.closeModal(); } catch { /* */ } });
    const o = await p.evaluate(() => { const b = document.querySelector('#panel-body'); return b.scrollHeight - b.clientHeight; }); out.push(`${t}:${o}`);
    if (process.env.SHOT) await p.screenshot({ path: `${process.env.SHOT}/${sz}-${t}.jpg`, type: 'jpeg', quality: 80 });
  }
  console.log(sz, out.join(' ')); await ctx.close();
}
await b.close(); server.close();
