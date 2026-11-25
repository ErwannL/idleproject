// v10.15.1 : captures de cadrage des grands boss (Colosse, Titans, géants) à plusieurs tailles, phase 1 et phase 3.
//   node tools/capture-cadrage.mjs [--out docs/screenshots/v10.15/cadrage] [--sizes 412x915,1116x993] [--bosses colossus,leviathan,…]
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { GRAND_BOSSES } from '../src/data/grand-bosses.js';
import { makeOpt, parseSizes, parseList, startApp, openGame } from './lib-1013.mjs';

const opt = makeOpt(process.argv.slice(2));
const out = opt('out', 'docs/screenshots/v10.15/cadrage');
const sizes = parseSizes(opt('sizes', '412x915,390x844,1116x993'));
const ids = parseList(opt('bosses', Object.values(GRAND_BOSSES).filter((b) => b.ready !== false && b.id !== 'shade').map((b) => b.id).join(',')));
await mkdir(out, { recursive: true });
const app = await startApp();
for (const [w, h] of sizes) {
  const g = await openGame(app, 'endgame', w, h);
  for (const id of ids) {
    for (const ph of [1, 3]) {
      await g.page.evaluate(([bid]) => {
        const a = __idle.actions;
        a.festBossStart = () => ({ event: 'cadrage', day: 'x', attempt: 1, seed: 7, maxHp: 1e200, ...(bid === 'colossus' ? {} : { bossId: bid }) });
        a.festBossFinish = () => null; a.festBossLeft = () => 3;
        window.__wbScene = null;
        const b = document.createElement('button'); b.dataset.action = 'fest-boss'; (__idle.ui.root ?? document.getElementById('panel-body') ?? document.body).appendChild(b); b.click(); b.remove();
      }, [id]);
      await g.page.waitForFunction(() => window.__wbScene, null, { timeout: 8000 });
      if (ph === 3) await g.page.evaluate(() => { const f = __wbScene.fight; f.run.damage = f.maxHp * 0.8; });
      await g.page.waitForTimeout(ph === 3 ? 4500 : 1500);
      await g.page.screenshot({ path: join(out, `${id}-${w}x${h}-phase${ph}.png`) });
      await g.page.evaluate(() => { document.querySelector('.wb-quit')?.click(); });
    }
    console.log(w, h, id);
  }
  if (g.jsErrors.length) console.log('erreurs JS', [...new Set(g.jsErrors)].slice(0, 3));
  await g.ctx.close();
}
await app.close();
