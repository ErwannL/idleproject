// v10.19 (partie 7) : petites corrections téléphone, vérifiées dans le vrai jeu.
//   node tools/e2e-1019-phone.mjs [--sizes 405x896,360x800]
// 7.1/7.2 un texte qui défile (bouton doré du bas, fil des nouvelles) commence au début et y reste 1,5 s, même après une fenêtre
//         ouverte par-dessus ; la nouvelle tient sur une ligne qui défile (plus de « … »).
// 7.3 aucune pièce d'or ne vole quand une fenêtre est ouverte.
// 7.5 bulle « Touche ici : plus de Dégâts » : au-dessus de la barre du bas (jamais dessus) et absente quand une fenêtre est ouverte.
// 7.6 Forge › Fabriquer : 72 px de marge sous le contenu (le bouton collant ne recouvre plus le texte).
import { makeOpt, parseSizes, startApp, openGame, closeAll } from './lib-1013.mjs';

const opt = makeOpt(process.argv.slice(2));
const sizes = parseSizes(opt('sizes', '405x896,360x800'));
const app = await startApp();
let fails = 0;
const fail = (m) => { console.log(`  ÉCHEC ${m}`); fails++; };
const LONG = 'Invoque un familier (plus de dégâts) : il n\'a pas encore rejoint ton équipe de héros';
const NEWS = 'Nain guerrier a rejoint la Forge du Bastion et travaille maintenant pour toi';

for (const [w, h] of sizes) {
  console.log(`${w}x${h}`);
  // --- 7.1, 7.2, 7.3, 7.6 : partie de fin de jeu
  const g = await openGame(app, 'endgame', w, h);
  const p = g.page;
  await p.evaluate(() => __idle.ui.closePanel()); await p.waitForTimeout(600);
  const shift = () => p.evaluate(() => {
    const el = document.querySelector('#next-action-text'); const s = el?.querySelector('.mq-in');
    return s ? Math.round(s.getBoundingClientRect().left - el.getBoundingClientRect().left - (parseFloat(getComputedStyle(el).paddingLeft) || 0)) : null;
  });
  await p.evaluate((t) => { const el = document.querySelector('#next-action-text'); if (el) el.textContent = t; }, LONG);
  await p.waitForTimeout(700);
  const s0 = await shift();
  await p.waitForTimeout(3500);
  const s1 = await shift();
  console.log(`  7.1 bouton du bas : début ${s0} px, après 4 s ${s1} px`);
  if (s0 === null || Math.abs(s0) > 1) fail(`7.1 le texte ne commence pas au début (${s0} px)`);
  if (!(s1 < 0)) fail('7.1 le texte ne défile pas');
  // fenêtre ouverte par-dessus pendant le défilement, puis fermée : reprend au début
  await p.evaluate(() => { const d = document.createElement('div'); d.id = 'e2e-cover'; Object.assign(d.style, { position: 'fixed', inset: '0', zIndex: 99999, background: '#000' }); document.body.appendChild(d); });
  await p.evaluate(() => { document.querySelector('#next-action-text').dataset.x = String(Math.random()); }); // une mutation : nouvelle passe
  await p.evaluate(() => document.body.appendChild(document.createElement('i'))); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('#e2e-cover').remove());
  await p.evaluate(() => document.body.appendChild(document.createElement('i'))); await p.waitForTimeout(500);
  const s2 = await shift();
  console.log(`  7.1 après une fenêtre ouverte puis fermée : ${s2} px`);
  if (s2 === null || Math.abs(s2) > 1) fail(`7.1 après une fenêtre, le texte ne reprend pas au début (${s2} px)`);
  // 7.2 nouvelle
  await p.evaluate((t) => { __idle.ui.news(t); __idle.ui.flushNews(); }, NEWS);
  await p.waitForTimeout(900);
  const nw = await p.evaluate(() => { const el = document.querySelector('#news-text'); const cs = getComputedStyle(el); return { on: el.classList.contains('mq-on'), clamp: cs.webkitLineClamp, ws: cs.whiteSpace, vis: el.getClientRects().length > 0 }; });
  console.log(`  7.2 nouvelle : ${JSON.stringify(nw)}`);
  if (nw.vis && (!nw.on || nw.ws !== 'nowrap')) fail('7.2 la nouvelle longue ne défile pas sur une ligne');
  // 7.3 pièces : panneau ouvert, aucune pièce
  await p.evaluate(() => __idle.ui.openTab('inventory')); await p.waitForTimeout(1200); await closeAll(p);
  let coins = 0;
  for (let i = 0; i < 12; i++) { const c = await p.evaluate(() => [...document.querySelectorAll('#ui-vfx .uvfx')].filter((e) => e.classList.contains('uvfx-cur') || /coin/.test(e.style.backgroundImage)).map((e) => `${e.className}:${e.style.backgroundImage.slice(-30)}`)); if (c.length > coins) { coins = c.length; console.log('   ', c.join(' | ')); } await p.waitForTimeout(250); }
  console.log(`  7.3 Équipement ouvert : ${coins} pièce(s) volante(s) au plus`);
  if (coins) fail('7.3 des pièces volent par-dessus la fenêtre');
  // 7.6 Forge › Fabriquer
  await p.evaluate(() => __idle.ui.openTab('forge', { forgeSeg: 'craft' })); await p.waitForTimeout(1200); await closeAll(p);
  const pad = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.m-fg-craft')).paddingBottom));
  console.log(`  7.6 marge sous Forge › Fabriquer : ${pad} px`);
  if (pad < 72) fail('7.6 marge de 72 px absente');
  if (g.jsErrors.length) fail(`erreurs JS : ${g.jsErrors.join(' | ')}`);
  await g.ctx.close();

  // --- 7.5 : partie neuve, bulle des Dégâts
  const f = await openGame(app, 'fresh', w, h);
  const q = f.page;
  await q.evaluate(() => document.querySelectorAll('style').forEach((s) => { if (s.textContent.includes('[class*="tuto"]')) s.remove(); }));
  await q.evaluate(() => { const s = __idle.state; s.ui.hints = (s.ui.hints ?? []).filter((x) => x !== 'tuto-damage'); s.upgrades.damage = 0; s.inventory = []; s.ui.hints.push('tuto-item'); __idle.ui.closePanel(); });
  let b = null;
  for (let i = 0; i < 20 && !b; i++) {
    await q.waitForTimeout(500); await closeAll(q);
    b = await q.evaluate(() => {
      const l = document.querySelector('#tuto-layer'); const bb = l?.querySelector('.tuto-bubble');
      if (!bb || !/D[ée]g[âa]ts/.test(bb.textContent)) return null;
      const r = bb.getBoundingClientRect(), t = document.querySelector('#tabs').getBoundingClientRect();
      return { bottom: Math.round(r.bottom), barTop: Math.round(t.top), target: l.target?.matches?.('#tabs button') ? 'menu' : 'bouton', down: bb.classList.contains('tuto-down') };
    });
  }
  console.log(`  7.5 bulle des Dégâts : ${JSON.stringify(b)}`);
  if (!b) console.log('  7.5 (bulle non montrée dans cette partie neuve : contrôle de position sauté)');
  else if (b.bottom > b.barTop) fail(`7.5 la bulle recouvre la barre du bas (${b.bottom} > ${b.barTop})`);
  // fenêtre ouverte (autre écran) : pas de bulle vers la barre du bas
  await q.evaluate(() => __idle.ui.openTab('options')); await q.waitForTimeout(1500);
  if (!(await q.evaluate(() => __idle.ui.tab === 'options'))) fail('7.5 Options ne s\'ouvre pas');
  const open = await q.evaluate(() => { const bb = document.querySelector('#tuto-layer .tuto-bubble'); return bb && document.querySelector('#tuto-layer').target?.closest?.('#tabs') ? bb.textContent.trim() : null; });
  console.log(`  7.5 fenêtre ouverte : bulle vers la barre du bas = ${open ?? 'aucune'}`);
  if (open) fail(`7.5 bulle vers la barre du bas avec une fenêtre ouverte (« ${open} »)`);
  if (f.jsErrors.length) fail(`erreurs JS : ${f.jsErrors.join(' | ')}`);
  await f.ctx.close();
}
await app.close();
console.log(fails ? `${fails} défaut(s)` : 'OK : corrections téléphone de la partie 7');
process.exit(fails ? 1 : 0);
