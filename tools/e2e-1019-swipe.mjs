// v10.19 (2.4, 2.5) : téléphone — glisser sur une rangée qui défile à l'horizontale la fait défiler sans changer d'onglet.
//   node tools/e2e-1019-swipe.mjs [--sizes 405x896,360x800] [--tabs inventory,shop,summon,encyclopedia,looks]
// 1. Forge › Fabriquer : geste de droite à gauche sur la rangée des places → on reste dans la Forge et scrollLeft > 0.
// 2. Le même geste sur le texte de la page change bien d'onglet.
// 3. Les autres rangées défilantes (filtres du Sac, Boutique, Invocation, Collections…) : le geste ne change pas d'onglet.
import { makeOpt, parseSizes, parseList, startApp, openGame, openTab, closeAll } from './lib-1013.mjs';

const opt = makeOpt(process.argv.slice(2));
const sizes = parseSizes(opt('sizes', '405x896,360x800'));
const others = parseList(opt('tabs', 'inventory,shop,summon,encyclopedia,looks,companions'));

// Geste tactile réel (CDP) : défilement natif + touchstart/touchend dans la page.
async function swipe(page, x1, y, x2) {
  const cdp = await page.context().newCDPSession(page);
  const pt = (x) => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x1) });
  for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x1 + ((x2 - x1) * i) / 10) }); await page.waitForTimeout(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(700);
  await cdp.detach();
}

// Première rangée visible qui défile à l'horizontale dans le panneau ; la fait défiler à l'écran.
const findRow = (page, sel) => page.evaluate((sel) => {
  const rows = [...document.querySelectorAll(`#panel-body ${sel}`)].filter((el) => {
    const ox = getComputedStyle(el).overflowX;
    return el.scrollWidth > el.clientWidth + 2 && (ox === 'auto' || ox === 'scroll') && el.getBoundingClientRect().width > 50;
  });
  const el = rows[0]; if (!el) return null;
  el.scrollLeft = 0; el.scrollIntoView({ block: 'center' });
  el.dataset.e2eRow = '1';
  const r = el.getBoundingClientRect();
  return { x1: r.left + r.width * 0.85, x2: r.left + r.width * 0.15, y: r.top + r.height / 2, cls: el.className };
}, sel);

const app = await startApp();
let fails = 0;
const fail = (m) => { console.log(`  ÉCHEC ${m}`); fails++; };
for (const [w, h] of sizes) {
  console.log(`${w}x${h}`);
  const g = await openGame(app, 'endgame', w, h);
  const { page } = g;
  // 1. Forge › Fabriquer
  await page.evaluate(() => __idle.ui.openTab('forge', { forgeSeg: 'craft' }));
  await page.waitForTimeout(1200); await closeAll(page);
  const row = await page.evaluate(() => {
    const el = document.querySelector('#panel-body .m-fg-craft .m-chips'); if (!el) return null;
    el.scrollLeft = 0; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect();
    return { x1: r.left + r.width * 0.85, x2: r.left + r.width * 0.15, y: r.top + r.height / 2, sw: el.scrollWidth, cw: el.clientWidth };
  });
  if (!row) fail('Forge › Fabriquer : rangée des places introuvable');
  else {
    await page.waitForTimeout(300);
    await swipe(page, row.x1, row.y, row.x2);
    const st = await page.evaluate(() => ({ tab: __idle.ui.tab, left: document.querySelector('#panel-body .m-fg-craft .m-chips')?.scrollLeft ?? -1 }));
    console.log(`  Forge › Fabriquer, rangée (${row.sw}/${row.cw} px) : onglet ${st.tab}, scrollLeft ${st.left}`);
    if (st.tab !== 'forge') fail(`le geste sur la rangée a changé d'onglet (${st.tab})`);
    if (!(st.left > 0)) fail('la rangée n\'a pas défilé (scrollLeft = 0)');
  }
  // 2. Même geste sur le texte de la page
  const txt = await page.evaluate(() => {
    const el = document.querySelector('#panel-body .m-fg-phrase'); if (!el) return null;
    el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect();
    return { x1: r.left + r.width * 0.85, x2: r.left + r.width * 0.15, y: r.top + r.height / 2 };
  });
  if (!txt) fail('texte de la Forge introuvable');
  else {
    await page.waitForTimeout(300);
    await swipe(page, txt.x1, txt.y, txt.x2);
    const tab = await page.evaluate(() => __idle.ui.tab);
    console.log(`  Forge, geste sur le texte : onglet ${tab}`);
    if (tab === 'forge') fail('le geste sur le texte n\'a pas changé d\'onglet');
  }
  // 3. Autres rangées défilantes
  for (const t of others) {
    if (!(await openTab(page, t))) { console.log(`  ${t} : pas ouvert (verrouillé), sauté`); continue; }
    const r = await findRow(page, '*');
    if (!r) { console.log(`  ${t} : aucune rangée défilante`); continue; }
    await page.waitForTimeout(300);
    await swipe(page, r.x1, r.y, r.x2);
    const st = await page.evaluate(() => ({ tab: __idle.ui.tab, left: document.querySelector('[data-e2e-row]')?.scrollLeft ?? -1 }));
    console.log(`  ${t} : rangée « ${String(r.cls).slice(0, 30)} » → onglet ${st.tab}, scrollLeft ${st.left}`);
    if (st.tab !== t) fail(`${t} : le geste sur la rangée a changé d'onglet (${st.tab})`);
  }
  if (g.jsErrors.length) fail(`erreurs JS : ${g.jsErrors.join(' | ')}`);
  await g.ctx.close();
}
await app.close();
console.log(fails ? `${fails} défaut(s)` : 'OK : glisser sur une rangée ne change plus d\'onglet');
process.exit(fails ? 1 : 0);
