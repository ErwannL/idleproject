// v10.17 (A) : mesure du cadrage du combat à l'ouverture de chaque onglet (zoom k, largeur de scène, centerShift, sol,
// position du héros à l'écran) et captures JPEG avant/après.
//   node tools/probe-1017.mjs [--sizes 1366x768,1920x1080,412x915] [--shots docs/screenshots/v10.17/fenetres] [--tag apres]
import { mkdir } from 'node:fs/promises';
import { makeOpt, parseSizes, startApp, openGame, openTab, closeAll } from './lib-1013.mjs';

const opt = makeOpt(process.argv.slice(2));
const sizes = parseSizes(opt('sizes', '1366x768,1920x1080,412x915'));
const shots = opt('shots', '');
const tag = opt('tag', 'apres');
const TABS = parseList(opt('tabs', 'inventory,companions,campaign,summon,shop,options'));
function parseList(s) { return s.split(',').filter(Boolean); }
if (shots) await mkdir(shots, { recursive: true });

export const measure = (page) => page.evaluate(() => {
  const r = __idle.renderer;
  const c = r.canvas.getBoundingClientRect();
  return { k: r.k, w: r.width, cs: r.centerShift, g: r.groundY, hx: Math.round(c.left + (r.heroScreenX ?? 0)), hy: Math.round(c.top + r.groundY * r.scale) };
});

const app = await startApp();
for (const [w, h] of sizes) {
  const g = await openGame(app, 'endgame', w, h);
  const base = await measure(g.page);
  console.log(`${w}x${h} combat     `, JSON.stringify(base));
  if (shots) await g.page.screenshot({ path: `${shots}/${tag}-${w}-combat.jpg`, type: 'jpeg', quality: 70 });
  for (const t of TABS) {
    if (!(await openTab(g.page, t))) { console.log('  (fermé)', t); continue; }
    const m = await measure(g.page);
    console.log(`  ${t.padEnd(11)}`, JSON.stringify(m), `Δhéros ${m.hx - base.hx},${m.hy - base.hy}`);
    if (shots) await g.page.screenshot({ path: `${shots}/${tag}-${w}-${t}.jpg`, type: 'jpeg', quality: 70 });
    await g.page.evaluate(() => __idle.ui.closePanel());
    await closeAll(g.page);
    await g.page.waitForTimeout(700);
    const b = await measure(g.page);
    if (b.hx !== base.hx || b.hy !== base.hy) console.log(`    après fermeture : Δhéros ${b.hx - base.hx},${b.hy - base.hy}`);
  }
  await g.ctx.close();
}
await app.close();
