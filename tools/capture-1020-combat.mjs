// v10.20 (partie 7.1 et 7.5) : « Moment fort » pendant un combat de boss (en file, puis bandeau fin en haut de la scène
// dès la fin du boss, 3 s au plus) et images des 5 donjons (chargées, pas de 404). Partie de fin (tests/fixtures/endgame.json).
//   node tools/capture-1020-combat.mjs [--out docs/screenshots/v10.20/combat] [--sizes 1366x768,405x896]
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { makeOpt, parseSizes, startApp, openGame, openTab, closeAll } from './lib-1013.mjs';

const opt = makeOpt(process.argv.slice(2));
const out = opt('out', 'docs/screenshots/v10.20/combat');
const sizes = parseSizes(opt('sizes', '1366x768,405x896'));
await mkdir(out, { recursive: true });
const app = await startApp();
let failed = 0;
const fail = (m) => { failed += 1; console.log(`ÉCHEC : ${m}`); };
const bossStage = () => { const s = __idle.state; return s.maxStage - (s.maxStage % 5); }; // dernier boss déjà atteint (goToStage refuse au-delà)
try {
  for (const [w, h] of sizes) {
    const tag = `${w}x${h}`;
    const { page, ctx, jsErrors } = await openGame(app, 'endgame', w, h);
    const bad = [];
    page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });

    // --- 7.5 : images des donjons ---
    if (await openTab(page, 'dungeons')) {
      await page.waitForTimeout(800);
      const imgs = await page.evaluate(async () => {
        const res = [];
        for (const el of document.querySelectorAll('.dgm[data-d]')) {
          const m = [...getComputedStyle(el).backgroundImage.matchAll(/url\("?([^")]+)"?\)/g)].map((x) => x[1]).find((u) => /dungeon_/.test(u));
          if (!m) { res.push({ d: el.dataset.d, url: null, w: 0 }); continue; }
          const im = new Image(); im.src = m;
          await im.decode().catch(() => {});
          res.push({ d: el.dataset.d, url: m.replace(location.origin, ''), w: im.naturalWidth });
        }
        return res;
      });
      for (const r of imgs) console.log(`${tag} donjon ${r.d} : ${r.url ?? 'sans image (style téléphone)'} naturalWidth=${r.w}`);
      await page.screenshot({ path: join(out, `donjons-${tag}.jpg`), type: 'jpeg', quality: 82 });
      if (imgs.some((r) => r.url && !r.w)) fail(`${tag} : image de donjon non chargée`);
      const d404 = bad.filter((b) => /dungeon_/.test(b));
      if (d404.length) fail(`${tag} : ${d404.join(', ')}`);
      console.log(`${tag} : ${imgs.filter((r) => r.w > 0).length} images de donjon chargées, ${d404.length} erreur(s) 404 sur dungeon_*`);
      await page.evaluate(() => __idle.ui.closePanel?.() ?? __idle.ui.openTab?.(null));
      await closeAll(page);
    } else console.log(`${tag} : onglet Donjons fermé`);

    // --- 7.1 : « Moment fort » pendant un combat de boss ---
    await page.evaluate(() => { try { __idle.ui.closePanel?.(); } catch { /* rien */ } if (__idle.ui.tab) __idle.ui.openTab(__idle.ui.tab); });
    // Partie de fin : le héros tue le boss en un instant : tout boss qui entre dans world.enemies devient increvable.
    await page.evaluate(() => {
      const w = __idle.world;
      const tame = (arr) => { if (!arr || arr.__tamed) return arr; const push = arr.push; arr.push = function (...xs) { for (const x of xs) if (x?.boss && !window.__bossDone) { x.hp = x.maxHp = 1e300; x.damage = 0; } return push.apply(this, xs); }; arr.__tamed = true; return arr; };
      let cur = tame(w.enemies);
      Object.defineProperty(w, 'enemies', { configurable: true, get: () => cur, set: (v) => { cur = tame(v); } });
    });
    await page.evaluate((st) => { __idle.actions.goToStage(st); }, await page.evaluate(bossStage));
    // Partie de fin : le héros tue le boss en un instant ; on le rend increvable dès son apparition (même image).
    await page.waitForFunction(() => { const b = __idle.world.enemies.find((e) => e.boss && e.hp > 0); return Boolean(b); }, null, { timeout: 30000, polling: 'raf' }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.evaluate(() => __idle.ui.moment({ kicker: 'Moment fort', title: 'Monde 12 terminé !', line: '3 étoile(s) sur 3. Le Colosse t\'attend pour un face-à-face.' }));
    await page.waitForTimeout(2500);
    const during = await page.evaluate(() => ({ boss: __idle.world.enemies.some((e) => e.boss), cine: Boolean(document.querySelector('#stage-area .cinematic')), queued: __idle.ui.announcer?.size ?? 0 }));
    console.log(`${tag} combat de boss : boss=${during.boss}, bandeau affiché=${during.cine}, en file=${during.queued}`);
    if (during.cine) fail(`${tag} : « Moment fort » affiché pendant le boss`);
    await page.screenshot({ path: join(out, `boss-moment-en-file-${tag}.jpg`), type: 'jpeg', quality: 82 });
    // Fin du boss : le bandeau part.
    const t0 = Date.now();
    await page.evaluate(() => { window.__bossDone = true; __idle.state.autoAdvance = true; const b = __idle.world.enemies.find((e) => e.boss); if (b) { b.maxHp = 1; b.hp = 0.001; } });
    await page.waitForSelector('#stage-area .cinematic.banner.in', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(900);
    const shown = await page.evaluate(() => {
      const c = document.querySelector('#stage-area .cinematic.banner .cine-text');
      const s = document.getElementById('stage-area');
      if (!c) return null;
      const r = c.getBoundingClientRect(), sr = s.getBoundingClientRect();
      return { top: Math.round(r.top - sr.top), h: Math.round(r.height), sh: Math.round(sr.height), text: c.textContent.trim() };
    });
    console.log(`${tag} après le boss : ${shown ? `bandeau « ${shown.text} » à ${shown.top} px du haut de la scène, ${shown.h} px de haut (scène ${shown.sh} px)` : 'pas de bandeau'}`);
    if (!shown) fail(`${tag} : pas de bandeau après le boss`);
    else if (shown.top > 40 || shown.h > 48) fail(`${tag} : bandeau trop bas ou trop haut`);
    await page.screenshot({ path: join(out, `boss-vaincu-moment-fort-${tag}.jpg`), type: 'jpeg', quality: 82 });
    await page.waitForFunction(() => !document.querySelector('#stage-area .cinematic'), null, { timeout: 8000 }).catch(() => {});
    const gone = (Date.now() - t0) / 1000;
    console.log(`${tag} : bandeau disparu ${gone.toFixed(1)} s après la fin du boss`);
    if (jsErrors.length) fail(`${tag} : erreurs JS ${jsErrors.join(' | ')}`);
    await ctx.close();
  }
} finally { await app.close(); }
process.exit(failed ? 1 : 0);
