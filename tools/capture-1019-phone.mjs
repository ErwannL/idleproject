// v10.19 (parties 2, 3, 7.6) : captures téléphone de Forge › Fabriquer et d'Équipement.
//   node tools/capture-1019-phone.mjs --tag avant|apres [--out docs/screenshots/v10.19/telephone]
import { mkdir } from 'node:fs/promises';
import { makeOpt, parseSizes, startApp, openGame, openTab } from './lib-1013.mjs';
const opt = makeOpt(process.argv.slice(2));
const tag = opt('tag', 'apres'), out = opt('out', 'docs/screenshots/v10.19/telephone');
await mkdir(out, { recursive: true });
const app = await startApp();
for (const [w, h] of parseSizes(opt('sizes', '405x896,360x800'))) {
  const g = await openGame(app, 'endgame', w, h);
  await g.page.evaluate(() => __idle.ui.openTab('forge', { forgeSeg: 'craft' }));
  await g.page.waitForTimeout(1200);
  await g.page.evaluate(() => { const b = document.querySelector('#panel-body'); b.scrollTop = b.scrollHeight; });
  await g.page.waitForTimeout(300);
  await g.page.screenshot({ path: `${out}/${tag}-${w}x${h}-forge-fabriquer.jpg`, type: 'jpeg', quality: 80 });
  await openTab(g.page, 'inventory');
  await g.page.screenshot({ path: `${out}/${tag}-${w}x${h}-equipement.jpg`, type: 'jpeg', quality: 80 });
  await g.ctx.close();
}
await app.close();
console.log('captures :', out);
