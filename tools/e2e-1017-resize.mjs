// v10.17 (A4) : on ouvre et ferme chaque onglet pendant une compétence ; le héros reste à 2 px près au même endroit à
// l'écran, et le centre des effets reste à 4 px près de sa cible.
//   node tools/e2e-1017-resize.mjs [--sizes 1366x768,1920x1080,1116x993,412x915] [--tabs inventory,companions,…]
// Mesures (vraie page, partie de fin) :
//  - héros : bord gauche de la toile + renderer.heroScreenX ; sol : haut de la toile + groundY × scale ;
//  - effets : une compétence est lancée (castSkillNow), et une pièce témoin est glissée dans scene.skillFx (même moteur que
//    les compétences) : à chaque image, elle relève où le repère du dessin (ctx.getTransform) place son point
//    (héros + 40, sol − 16) à l'écran ; on compare à la position de ce point calculée avec le cadrage actuel (la cible).
//    Les pièces de la vraie compétence encore en vol doivent avoir le même décalage (groundY − g0) que la pièce témoin.
// Sur téléphone, les onglets couvrent le combat (page plein écran) : la scène cachée ne doit pas bouger du tout.
// v10.20 (1) : sur PC, les grandes pages sont revenues (PC_SIDE_ONLY = false) : un onglet en page (Équipement, Compagnons…) met la
// scène derrière la page et montre le combat dans la vignette #page-mini. Le contrôle devient : la vignette garde la même place et
// la même taille d'un onglet en page à l'autre, et une fois la page refermée (scène revenue, 3 s), le héros est à 2 px près à
// sa place d'avant. Les onglets hors page (Carte, Invocation, Boutique, Options) gardent le contrôle « le héros ne bouge pas ».
import { makeOpt, parseSizes, parseList, startApp, openGame, closeAll } from './lib-1013.mjs';

const opt = makeOpt(process.argv.slice(2));
const sizes = parseSizes(opt('sizes', '1366x768,1920x1080,1116x993,412x915'));
const tabs = parseList(opt('tabs', 'inventory,companions,campaign,summon,shop,options'));
let fails = 0, checks = 0;
const say = (ok, msg) => { checks++; if (!ok) fails++; if (!ok || process.argv.includes('--verbose')) console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${msg}`); };

const arm = (page) => page.evaluate(() => {
  const r = __idle.renderer;
  const id = document.querySelector('#skill-bar .skill-btn')?.dataset.skill;
  if (id) { __idle.world.skillTimers[id] = 0; __idle.actions.castSkillNow?.(id); }
  window.__probe = null;
  r.skillFx = (r.skillFx ?? []).filter((e) => !e.probe);
  const g0 = r.groundY, main = document.getElementById("scene");
  (r.skillFx ??= []).push({ probe: true, at: r.time, dur: 600, g0, p: {}, draw: (ctx) => {
    if (ctx.canvas !== main) return; // mini-scène des onglets (autre toile, prêtée au moteur) : pas la scène du combat
    const m = ctx.getTransform(); const c = main.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    const X = 84 + 40, Y = g0 - 16; // point calculé au lancer (comme skill-fx.js : const G = s.groundY)
    window.__probe = { t: r.time, x: c.left + (m.a * X + m.e) / dpr, y: c.top + (m.d * Y + m.f) / dpr };
  } });
});

const measure = (page) => page.evaluate(() => {
  const r = __idle.renderer; const c = r.canvas.getBoundingClientRect();
  const shift = Math.round(r.viewShift ?? 0);
  const target = { x: c.left + (84 + 40 + shift) * r.scale, y: c.top + (r.groundY - 16) * r.scale };
  const live = (r.skillFx ?? []).filter((e) => Number.isFinite(e.g0)).map((e) => r.groundY - e.g0);
  return { visible: c.width > 0 && c.bottom > 0 && c.top < innerHeight && c.right > 0 && c.left < innerWidth && getComputedStyle(r.canvas).visibility !== 'hidden', hx: c.left + (r.heroScreenX ?? 0), hy: c.top + r.groundY * r.scale, probe: window.__probe, target, live: live.length, k: r.k, t: r.time, page: document.getElementById('app').classList.contains('page-narrow'), pageUi: document.getElementById('app').classList.contains('page-ui'), mini: (() => { const m = document.getElementById('page-mini')?.getBoundingClientRect(); return m && m.width ? [m.left, m.top, m.width, m.height].map(Math.round).join(',') : ''; })() };
});

const app = await startApp();
for (const [w, h] of sizes) {
  const g = await openGame(app, 'endgame', w, h);
  const { page } = g;
  await page.waitForTimeout(800);
  const base = await measure(page);
  let worstHero = 0, worstFx = 0, n = 0, mini = null;
  for (const tab of tabs) {
    await arm(page);
    await page.waitForTimeout(120);
    const before = await measure(page);
    const opened = await page.evaluate((t) => { try { __idle.ui.openTab(t); } catch { return false; } return __idle.ui.tab === t; }, tab);
    if (!opened) continue;
    await page.waitForTimeout(300);
    const during = await measure(page);
    await page.evaluate(() => __idle.ui.closePanel());
    await closeAll(page);
    // v10.20 (1) : après une grande page, la scène revient en glissant (≈ 1 à 3 s) : on mesure une fois revenue.
    await page.waitForTimeout(during.pageUi ? 3000 : 300);
    const after = await measure(page);
    for (const [when, m] of [['ouvert', during], ['refermé', after]]) {
      n++;
      if (!m.visible || m.page) { say(m.k === base.k, `${w}x${h} ${tab} ${when} : scène cachée par la page, zoom ×${m.k} (avant ×${base.k})`); continue; }
      // v10.20 (1) : sur PC, Héros et Équipe s'ouvrent de nouveau en grande page : la scène passe derrière la page (le héros y est
      // recadré, c'est voulu) et le combat se suit dans la vignette #page-mini. Ce qui compte alors : la vignette a la même place
      // et la même taille pour tous les onglets en page (le combat ne « saute » pas d'un onglet à l'autre).
      if (m.pageUi && when === 'ouvert') { mini ??= m.mini; say(Boolean(m.mini) && m.mini === mini, `${w}x${h} ${tab} ouvert en page : vignette ${m.mini || 'absente'} (attendu ${mini})`); continue; }
      const dh = Math.max(Math.abs(m.hx - before.hx), Math.abs(m.hy - before.hy));
      worstHero = Math.max(worstHero, dh);
      say(dh <= 2, `${w}x${h} ${tab} ${when} : héros déplacé de ${dh.toFixed(1)} px`);
      if (m.probe) {
        const df = Math.max(Math.abs(m.probe.x - m.target.x), Math.abs(m.probe.y - m.target.y));
        worstFx = Math.max(worstFx, df);
        say(df <= 4, `${w}x${h} ${tab} ${when} : centre des effets à ${df.toFixed(1)} px de sa cible${df > 4 ? ` (${JSON.stringify(m.probe)} / ${JSON.stringify(m.target)} t${m.t})` : ''}`);
      }
    }
  }
  // Le cadrage doit malgré tout changer (fenêtre du navigateur redimensionnée pendant la compétence) : les effets suivent.
  if (!g.phone) {
    await arm(page);
    await page.waitForTimeout(120);
    await page.setViewportSize({ width: w, height: h - 120 });
    await page.waitForTimeout(400);
    const m = await measure(page);
    const df = m.probe ? Math.max(Math.abs(m.probe.x - m.target.x), Math.abs(m.probe.y - m.target.y)) : 99;
    worstFx = Math.max(worstFx, df);
    say(df <= 4, `${w}x${h} fenêtre redimensionnée (−120 px) pendant la compétence : centre des effets à ${df.toFixed(1)} px de sa cible`);
    await page.setViewportSize({ width: w, height: h });
  }
  console.log(`${w}x${h} : ${n} mesures (${tabs.length} onglets ouverts puis refermés pendant une compétence) — écart max du héros ${worstHero.toFixed(1)} px, des effets ${worstFx.toFixed(1)} px`);
  if (g.jsErrors.length) say(false, `${w}x${h} erreurs JS : ${g.jsErrors.slice(0, 3).join(' | ')}`);
  await g.ctx.close();
}
await app.close();
console.log(fails ? `${fails} échec(s) sur ${checks} contrôles` : `Tout est bon (${checks} contrôles).`);
process.exit(fails ? 1 : 0);
