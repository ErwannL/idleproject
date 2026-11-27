// v10.18 (4.2) : grands boss sur téléphone (360, 390, 405 px) : la silhouette entière tient-elle dans le canvas, avec
// au moins 8 px de marge à droite ? Captures du Colosse et du Titan des Marées à 360 et 405 px.
//   node tools/capture-giants-phone.mjs [--out docs/screenshots/v10.18/boss/grands-boss] [--tag apres] [--only colossus,titan_tide]
// Code de sortie 1 si le Colosse, l'Ombre ou un Titan dépasse.
import { mkdir } from 'node:fs/promises';
import { makeOpt, parseList, startApp, closeAll } from './lib-1013.mjs';

const opt = makeOpt(process.argv.slice(2));
const out = opt('out', 'docs/screenshots/v10.18/boss/grands-boss');
const tag = opt('tag', 'apres');
const ids = parseList(opt('only', 'colossus,shade,titan_sun,titan_moon,titan_ember,titan_tide,titan_thorn,titan_storm,titan_void,frost_giant,hydra'));
const SHOTS = new Set(['colossus', 'titan_tide']);
await mkdir(out, { recursive: true });
const app = await startApp();
let fail = 0;
for (const w of [360, 390, 405]) for (const id of ids) {
  const ctx = await app.browser.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript((save) => { if (!sessionStorage.getItem('a')) { localStorage.setItem('idle-rpg.save', save); sessionStorage.setItem('a', '1'); } }, JSON.stringify(app.fixture));
  await page.goto(app.url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  await closeAll(page);
  await page.evaluate((bid) => {
    const a = __idle.actions;
    a.festBossStart = () => ({ event: 'giants', day: 'x', attempt: 1, seed: 7, maxHp: 1e200, bossId: bid });
    a.festBossFinish = () => null; a.festBossLeft = () => 3;
    window.__wbScene = null;
    const b = document.createElement('button'); b.dataset.action = 'fest-boss'; (__idle.ui.root ?? document.getElementById('panel-body') ?? document.body).appendChild(b); b.click(); b.remove();
  }, id);
  await page.waitForFunction(() => window.__wbScene?.drawn, null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const m = await page.evaluate(() => {
    const s = window.__wbScene, r = s.r, d = s.drawn, [bx, , bw] = s.look.box;
    const rect = r.ctx.canvas.getBoundingClientRect();
    const sx = rect.width / r.width;
    const shift = Number.isFinite(r.fixedShift) ? r.fixedShift : (r.viewShift ?? 0);
    return { cw: Math.round(rect.width), left: Math.round((d.x + bx * d.k + shift) * sx), right: Math.round((d.x + (bx + bw) * d.k + shift) * sx), k: +d.k.toFixed(2) };
  });
  const margin = m.cw - m.right;
  const strict = /^(colossus|shade|titan_)/.test(id);
  if (strict && (margin < 8 || m.left < 0)) fail++;
  console.log(`${w} px ${id} : boîte ${m.left}–${m.right} / ${m.cw} px, marge droite ${margin} px, zoom ${m.k}${strict && margin < 8 ? '  ← COUPÉ' : ''}`);
  if (SHOTS.has(id) && w !== 390) await page.screenshot({ path: `${out}/${id}-${w}-${tag}.jpg`, type: 'jpeg', quality: 80 });
  await ctx.close();
}
await app.close();
console.log(`grands boss coupés : ${fail}`);
if (fail) process.exitCode = 1;
