// v10.16 : planches, vidéos et mesures de contrôle du « vrai combat de boss », pour tous les boss.
//   node tools/capture-boss-feel.mjs [--out docs/screenshots/v10.16/tous-les-boss] [--sizes 1366x768,412x915] [--seconds 8]
//                                    [--only alpha_wolf,citadel,storm_god…]
// Combats filmés (8 s chacun, de 2 s à 10 s après l'arrivée du boss) :
//   - les 12 boss de campagne (11 méga boss + le Sanglier titan, étape 10) ;
//   - les 5 boss de donjon (salle du boss directement) ; un boss de la Tour (étage 1) ;
//   - les 17 grands boss (Colosse, Ombre, 7 Titans, 8 géants), par le même chemin que la Fête (festBossStart).
// Les PV des boss de campagne, de donjon et de la Tour sont montés à ≈ 30 s de combat (dégâts par seconde × 45).
// Par combat : une planche de 16 images (4 × 4, à mi-taille, JPEG qualité 80) ; une vidéo .webm seulement pour
// 2 exemples par taille. Rapport (rapport.md, rapport.json) : part des images où le boss est blanc, croissants (arcs
// fx_slash, traînées et rubans d'arme), coups du héros par seconde, taille du boss / héros, plus petit écart à l'écran.
// Les compteurs viennent de la scène (globalThis.__feelStats, voir src/render/scene.js).
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { makeOpt, parseSizes, parseList, startApp, closeAll } from './lib-1013.mjs';

const opt = makeOpt(process.argv.slice(2));
const out = opt('out', 'docs/screenshots/v10.16/tous-les-boss');
const sizes = parseSizes(opt('sizes', '1366x768,412x915'));
const SECONDS = Number(opt('seconds', '8'));
const only = opt('only', '') ? new Set(parseList(opt('only', ''))) : null;

const CAMPAIGN = [['slime_king', 20], ['alpha_wolf', 40], ['bone_lord', 60], ['ash_dragon', 80], ['fallen_knight', 100], ['demon_king', 120],
  ['boss_swamp_behemoth', 140], ['boss_sky_titan', 160], ['boss_phoenix', 180], ['boss_void_emperor', 200], ['boss_leviathan', 220], ['mid_boar_titan', 10]];
const DUNGEONS = ['crypt', 'sanctuary', 'furnace', 'glacier', 'citadel'];
const GRAND = ['colossus', 'shade', 'titan_sun', 'titan_moon', 'titan_ember', 'titan_tide', 'titan_thorn', 'titan_storm', 'titan_void',
  'leviathan', 'dragon_mother', 'storm_god', 'hydra', 'sand_wyrm', 'frost_giant', 'elder_treant', 'void_maw'];
const FIGHTS = [
  ...CAMPAIGN.map(([id, stage]) => ({ id, kind: 'campagne', stage })),
  ...DUNGEONS.map((id) => ({ id, kind: 'donjon' })),
  { id: 'tour', kind: 'tour' },
  ...GRAND.map((id) => ({ id, kind: 'grand' })),
].filter((f) => !only || only.has(f.id));
const VIDEO = new Set(['alpha_wolf', 'storm_god']); // 2 exemples filmés en vidéo par taille

await mkdir(out, { recursive: true });
const app = await startApp();
const report = [];

async function open(w, h, video) {
  const phone = w <= 600;
  const vdir = join(out, 'video-tmp');
  const ctx = await app.browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, ...(phone ? { isMobile: true, hasTouch: true } : {}),
    ...(video ? { recordVideo: { dir: vdir, size: { width: w, height: h } } } : {}) });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((save) => { if (!sessionStorage.getItem('audit')) { localStorage.setItem('idle-rpg.save', save); sessionStorage.setItem('audit', '1'); } }, JSON.stringify(app.fixture));
  await page.goto(app.url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(4000);
  await closeAll(page);
  return { ctx, page, errors };
}

// PV des boss montés à ≈ 30 s de combat dès leur apparition (la partie de fin les tue en une image).
const patchBossHp = (page) => page.evaluate(() => {
  const patch = () => {
    const arr = __idle.world.enemies;
    if (!arr.__feel) {
      arr.__feel = true;
      arr.push = function (...xs) { for (const x of xs) if (x.boss) { x.maxHp = x.hp = (__idle.world.heroStats?.dps ?? 1) * 45; } return Array.prototype.push.apply(this, xs); };
    }
  };
  setInterval(patch, 5); patch();
});

// Planche de 16 images (4 × 4, à mi-taille) composée dans le navigateur, enregistrée en JPEG qualité 80.
async function sheet(shots, w, h, file) {
  const ctx = await app.browser.newContext({ viewport: { width: w * 2, height: h * 2 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const imgs = shots.map((b) => `<img src="data:image/png;base64,${b.toString('base64')}" style="width:${w / 2}px;height:${h / 2}px;display:block">`).join('');
  await p.setContent(`<body style="margin:0;background:#000"><div style="display:grid;grid-template-columns:repeat(4,${w / 2}px)">${imgs}</div></body>`);
  await p.screenshot({ path: file, type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: w * 2, height: h * 2 } });
  await ctx.close();
}

async function measure(page, name, sec, w, h) {
  await page.evaluate(() => { globalThis.__feelStats = { frames: 0, white: 0, slash: 0, strikes: 0 }; });
  const shots = [];
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout((sec * 1000) / 16);
    shots.push(await page.screenshot());
  }
  const st = (await page.evaluate(() => globalThis.__feelStats)) ?? {};
  await sheet(shots, w, h, join(out, `${name}.jpg`));
  return { seconds: sec, bossFrames: st.frames ?? 0, whitePct: st.frames ? Math.round((st.white / st.frames) * 1000) / 10 : null,
    crescents: st.slash ?? 0, arcsRemoved: st.arcSkipped ?? 0, strikesPerSec: Math.round(((st.strikes ?? 0) / sec) * 10) / 10,
    ratio: st.ratio ?? null, gapPx: st.gap ?? null };
}

async function start(page, f) {
  if (f.kind === 'grand') {
    await page.evaluate((bid) => {
      const a = __idle.actions;
      a.festBossStart = () => ({ event: 'boss-feel', day: 'x', attempt: 1, seed: 7, maxHp: 1e200, bossId: bid });
      a.festBossFinish = () => null; a.festBossLeft = () => 3;
      window.__wbScene = null;
      const b = document.createElement('button'); b.dataset.action = 'fest-boss'; (__idle.ui.root ?? document.getElementById('panel-body') ?? document.body).appendChild(b); b.click(); b.remove();
    }, f.id);
    await page.waitForFunction(() => window.__wbScene, null, { timeout: 8000 });
    await page.waitForTimeout(1500);
    return;
  }
  await patchBossHp(page);
  await page.evaluate((f) => {
    const s = __idle.state; const a = __idle.actions;
    s.autoAdvance = false;
    if (f.kind === 'campagne') a.goToStage(f.stage);
    else if (f.kind === 'donjon') {
      s.keys = Math.max(s.keys ?? 0, 5); s.maxStage = Math.max(s.maxStage, 200); // la Citadelle : donjon débloqué (sauvegarde en mémoire)
      a.enterDungeon(f.id, 'any', 'gold', 'easy');
      if (s.dungeon) s.dungeon.room = 99; // salle du boss : la prochaine vague est le boss
      for (const e of __idle.world.enemies) if (!e.boss) e.hp = 1;
    } else if (f.kind === 'tour') {
      s.towerDay = null; s.towerWeek = null; s.dungeon = null; s.challenge = null; // une ascension disponible
      a.enterTower();
    }
  }, f);
  await page.waitForFunction(() => __idle.world.enemies.some((e) => e.boss), null, { timeout: 40000 });
  await page.waitForTimeout(2000); // l'arrivée du boss passe, puis 8 s de combat
}

await mkdir(join(out, 'video-tmp'), { recursive: true });
for (const [w, h] of sizes) {
  const tag = `${w}x${h}`;
  for (const f of FIGHTS) {
    const name = `${f.kind}-${f.id}-${tag}`;
    const video = VIDEO.has(f.id);
    const g = await open(w, h, video);
    let row = { size: tag, kind: f.kind, id: f.id };
    try {
      await start(g.page, f);
      const boss = await g.page.evaluate(() => __idle.world.enemies.find((e) => e.boss)?.type ?? window.__wbScene?.boss?.id ?? null).catch(() => null);
      row = { ...row, boss, ...(await measure(g.page, name, SECONDS, w, h)) };
    } catch (e) { row.error = String(e.message).split('\n')[0]; }
    row.jsErrors = [...new Set(g.errors)].slice(0, 3);
    report.push(row);
    const v = video ? g.page.video() : null;
    await g.ctx.close();
    if (v) await rename(await v.path(), join(out, `${name}.webm`)).catch(() => {});
    console.log(name, row.error ?? `blanc ${row.whitePct} % · croissants ${row.crescents} · ${row.strikesPerSec} coups/s · ×${row.ratio ?? '—'} · écart ${row.gapPx ?? '—'} px`);
  }
}
await app.close();
await rm(join(out, 'video-tmp'), { recursive: true, force: true });

const md = ['# v10.16 — tous les boss : mesures du combat', '', `${SECONDS} s filmées par combat (tools/capture-boss-feel.mjs). Planche 4 × 4 par combat (JPEG) ; vidéos : ${[...VIDEO].join(', ')}.`, '',
  '« Taille » : hauteur visible du boss / hauteur du héros (boss de campagne, donjon, Tour). « Écart » : plus petit écart à l\'écran entre le héros (au repos) et la silhouette du boss.', '',
  '| Taille | Type | Boss | Boss blanc | Croissants | Arcs retirés | Coups du héros / s | Taille ×héros | Écart (px) | Erreurs |', '|---|---|---|---|---|---|---|---|---|---|',
  ...report.map((r) => `| ${r.size} | ${r.kind} | ${r.id} | ${r.whitePct ?? '—'} % | ${r.crescents ?? '—'} | ${r.arcsRemoved ?? '—'} | ${r.strikesPerSec ?? '—'} | ${r.ratio ?? '—'} | ${r.gapPx ?? '—'} | ${r.error ? `échec : ${r.error}` : r.jsErrors.length} |`), ''];
await writeFile(join(out, 'rapport.md'), md.join('\n'));
await writeFile(join(out, 'rapport.json'), JSON.stringify(report, null, 2));
console.log(md.join('\n'));
