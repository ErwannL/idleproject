// Sonde v10.18 (1) : cadrage de la scène sur téléphone dans les 3 états (rien d'ouvert, onglet, Arène), captures en option.
//   node tools/probe-1018-frame.mjs [--sizes 405x896,360x800] [--shots dossier]
import { makeOpt, parseSizes, startApp, openGame, closeAll } from './lib-1013.mjs';
const opt = makeOpt(process.argv.slice(2));
const sizes = parseSizes(opt('sizes', '405x896,360x800'));
const shots = opt('shots', '');
const app = await startApp();
const m = (page) => page.evaluate(() => {
  const r = __idle.renderer; const c = r.canvas.getBoundingClientRect();
  const mini = document.getElementById('page-mini'); const pg = document.getElementById('app').classList.contains('page-ui');
  const mr = mini?.getBoundingClientRect();
  const band = pg && mr && mini.querySelector('canvas').dataset.ox != null ? { hx: Math.round(mr.left + Number(mini.querySelector('canvas').dataset.ox) + r.heroScreenX), feet: Math.round(mr.top + Number(mini.querySelector('canvas').dataset.oy) + r.groundY * r.scale) } : null;
  return { band, pg, k: r.k, scale: r.scale, cw: Math.round(c.width), ch: Math.round(c.height), ct: Math.round(c.top), g: r.groundY, hx: Math.round(c.left + r.heroScreenX), hy: Math.round(c.top + r.groundY * r.scale), heroH: Math.round((r.layout?.heroH ?? 0) * r.scale), mini: pg && mr ? [Math.round(mr.top), Math.round(mr.height), mini.dataset.ox, mini.dataset.oy] : null };
});
for (const [w, h] of sizes) {
  const { page } = await openGame(app, 'endgame', w, h);
  const st = async (name) => { await page.waitForTimeout(700); console.log(w, h, name, JSON.stringify(await m(page))); if (shots) await page.screenshot({ path: `${shots}/${w}x${h}-${name}.jpg`, type: 'jpeg', quality: 80 }); };
  await st('combat');
  await page.evaluate(() => __idle.ui.openTab('inventory')); await closeAll(page); await st('onglet');
  await page.evaluate(() => __idle.ui.openTab('arena')); await closeAll(page); await st('arene');
  await page.evaluate(() => __idle.ui.closePanel()); await st('ferme');
}
await app.close();
