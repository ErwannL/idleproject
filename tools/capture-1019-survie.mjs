// v10.19 (partie 4) : capture d'une mort évitée par le Second souffle (bouclier doré, « Second souffle ! »).
// Partie neuve ; le premier monstre au contact prépare un coup lourd mortel pendant que le héros est à 55 % de ses PV.
//   node tools/capture-1019-survie.mjs [--out docs/screenshots/v10.19/survie] [--sizes 405x896,360x800]
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { makeOpt, parseSizes, startApp, openGame } from './lib-1013.mjs';

const opt = makeOpt(process.argv.slice(2));
const out = opt('out', 'docs/screenshots/v10.19/survie');
const sizes = parseSizes(opt('sizes', '405x896,360x800'));
await mkdir(out, { recursive: true });
const app = await startApp();
let failed = 0;
try {
  for (const [w, h] of sizes) {
    const { page, ctx, jsErrors } = await openGame(app, 'fresh', w, h);
    await page.waitForFunction(() => __idle.world.enemies.some((e) => e.engaged), null, { timeout: 60000 });
    await page.evaluate(() => {
      window.__wind = null;
      const world = __idle.world;
      const e = world.enemies.find((x) => x.engaged);
      e.hp = e.maxHp = 1e12; e.damage = 1e12; e.heavy = true; e.attackTimer = 0.3;
      world.hero.hp = world.heroStats.maxHp * 0.55;
      const t0 = performance.now();
      const watch = () => {
        if (world.events?.some?.((ev) => ev.type === 'heroSecondWind')) window.__wind = performance.now() - t0;
        if (!window.__wind && performance.now() - t0 < 5000) requestAnimationFrame(watch);
      };
      watch();
    });
    await page.waitForFunction(() => __idle.world.hero.invulnUntil > 0, null, { timeout: 10000 });
    await page.waitForTimeout(250);
    const file = join(out, `second-souffle-${w}x${h}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 85 });
    const alive = await page.evaluate(() => !__idle.world.hero.dead && __idle.world.hero.hp > 0);
    console.log(`${file} : héros ${alive ? 'vivant' : 'MORT'}${jsErrors.length ? ` ; erreurs : ${jsErrors.join(' | ')}` : ''}`);
    if (!alive || jsErrors.length) failed += 1;
    await ctx.close();
  }
} finally { await app.close(); }
process.exit(failed ? 1 : 0);
