// v10.15.1 : mesure du cadrage des grands boss (largeur logique de la scène, bord droit du boss, bord gauche de l'équipe).
//   node tools/measure-cadrage.mjs [--sizes 412x915,390x844,1116x993] [--bosses colossus,…] [--phases 1,3]
import { GRAND_BOSSES } from '../src/data/grand-bosses.js';
import { makeOpt, parseSizes, parseList, startApp, openGame } from './lib-1013.mjs';

const opt = makeOpt(process.argv.slice(2));
const sizes = parseSizes(opt('sizes', '412x915,390x844,1116x993'));
const phases = parseList(opt('phases', '1,3')).map(Number);
const ids = parseList(opt('bosses', Object.values(GRAND_BOSSES).filter((b) => b.ready !== false && b.id !== 'shade').map((b) => b.id).join(',')));
const app = await startApp();
for (const [w, h] of sizes) {
  const g = await openGame(app, 'endgame', w, h);
  for (const id of ids) {
    for (const ph of phases) {
      await g.page.evaluate(([bid]) => {
        const a = __idle.actions;
        a.festBossStart = () => ({ event: 'cadrage', day: 'x', attempt: 1, seed: 7, maxHp: 1e200, ...(bid === 'colossus' ? {} : { bossId: bid }) });
        a.festBossFinish = () => null; a.festBossLeft = () => 3;
        window.__wbScene = null;
        const b = document.createElement('button'); b.dataset.action = 'fest-boss'; (__idle.ui.root ?? document.body).appendChild(b); b.click(); b.remove();
      }, [id]);
      await g.page.waitForFunction(() => window.__wbScene, null, { timeout: 8000 });
      if (ph === 3) await g.page.evaluate(() => { const f = __wbScene.fight; f.run.damage = f.maxHp * 0.8; });
      await g.page.waitForTimeout(ph === 3 ? 4500 : 1500);
      const m = await g.page.evaluate(() => {
        const s = __wbScene, r = s.r;
        const fx = r.enemyFxFor(s.fight.boss.id);
        const shift = Math.round(r.viewShift ?? 0);
        return { W: Math.round(r.width), scale: +(r.scale ?? 0).toFixed(2), phase: s.fight.phase, bossL: Math.round(fx.sx + shift), bossR: Math.round(fx.sx + fx.sw + shift), heroX: Math.round(r.heroScreenX / (r.scale || 1)), imgR: Math.round(s.drawn.x + s.art.frame * s.scale + shift) };
      });
      console.log(`${w}x${h} ${id} p${ph}`, JSON.stringify(m), m.bossR > m.W ? 'COUPE' : 'ok');
      await g.page.evaluate(() => { document.querySelector('.wb-quit')?.click(); });
    }
  }
  await g.ctx.close();
}
await app.close();
