// v9.9 : les 6 tests du document « Capybara et Slayer » (K1 à K17). Usage : node tools/e2e-k.mjs
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const raw = await readFile('tests/fixtures/endgame.json', 'utf8');
const results = [];
const ok = (name, cond, info = '') => { results.push([name, cond, info]); console.log(`${cond ? '✔' : '✘'} ${name}${info ? ` — ${info}` : ''}`); };
const errors = [];
async function open(size, { fixture = false, q = '' } = {}) {
  const ctx = await browser.newContext({ viewport: size });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (fixture) await page.addInitScript((r) => { if (!sessionStorage.getItem('k')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('k', '1'); } }, raw);
  await page.goto(url + q);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(fixture ? 8000 : 1500);
  await page.evaluate(() => document.querySelectorAll('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) [data-action="offline-claim"]').forEach((b) => b.click()));
  return { page, ctx };
}
const sceneOk = (page) => page.evaluate(() => { const r = document.querySelector('#scene').getBoundingClientRect(); return r.height >= 150 && r.width >= 300; });

// 1. Partie neuve : Sceau (3 actions différentes), carte « Meilleur objet » qui équipe, amélioration achetée depuis le panneau du bas.
{
  const { page, ctx } = await open({ width: 1116, height: 993 }, { q: '?quests' });
  const seen = new Set(); let carded = false, equipped = false, bought = false, hidden = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 170000 && !(seen.size >= 3 && carded && equipped && bought)) {
    await page.waitForTimeout(1000);
    const r = await page.evaluate(() => {
      const ui = __idle.ui; const st = __idle.state;
      const seal = document.querySelector('#next-action:not(.hidden) #next-action-text')?.textContent ?? '';
      const card = document.querySelector('.best-card button');
      let eq = false;
      if (card) { card.click(); eq = true; }
      // le joueur suit le doigt du tutoriel, puis le Sceau
      const layer = document.getElementById('tuto-layer');
      if (layer?.target) layer.target.click();
      if (seal && !document.querySelector('#modal:not(.hidden)')) document.getElementById('next-action').click();
      const buy = document.querySelector('#panel:not(.hidden) [data-action="buy"]:not([disabled])');
      if (buy) buy.click();
      document.querySelectorAll('#modal:not(.hidden) [data-action="close-modal"]').forEach((b) => b.click());
      return { seal, card: Boolean(card), eq, up: Object.values(st.upgrades).some((n) => n > 0), equips: st.records.equips ?? 0, panel: !document.querySelector('#panel').classList.contains('hidden') };
    });
    if (r.seal) seen.add(r.seal.replace(/[\d\s,.]+/g, ''));
    carded ||= r.card; equipped ||= r.equips > 0; bought ||= r.up && r.panel;
    if (!(await sceneOk(page))) hidden = true;
  }
  ok('1. Sceau : au moins 3 actions différentes', seen.size >= 3, [...seen].slice(0, 5).join(' | '));
  ok('1. Carte « Meilleur objet » apparue et objet équipé', carded && equipped);
  ok('1. Amélioration achetée depuis le panneau du bas', bought);
  ok('1. La scène n\'est jamais cachée', !hidden);
  await ctx.close();
}
// 2. Panneau du bas : 5 onglets, hauteur normale et dépliée, la scène reste visible ; Échap replie le panneau.
{
  const { page, ctx } = await open({ width: 1116, height: 993 }, { fixture: true });
  let all = true;
  for (const m of ['hero', 'team', 'adventure', 'summon', 'shop']) {
    for (const tall of [false, true]) {
      await page.evaluate(([menu, t]) => { localStorage.setItem('idle-rpg.prefs', JSON.stringify({ ...(JSON.parse(localStorage.getItem('idle-rpg.prefs') || '{}')), panelTall: t })); if (__idle.ui.tab) __idle.ui.closePanel(); __idle.ui.toggleMenu(menu); __idle.ui.updatePanelLow(); __idle.ui.layoutChanged?.(); }, [m, tall]);
      await page.waitForTimeout(700);
      const vis = await page.evaluate(() => { const r = document.querySelector('#scene').getBoundingClientRect(); return { h: r.height, open: !document.querySelector('#panel').classList.contains('hidden') }; });
      if (!(vis.open && vis.h >= 150)) { all = false; console.log('   ', m, tall, vis); }
    }
  }
  ok('2. 5 onglets × 2 hauteurs : la scène reste visible (≥ 150 px)', all);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  ok('2. Échap replie le panneau sans fermer le jeu', await page.evaluate(() => document.querySelector('#panel').classList.contains('hidden') && Boolean(document.querySelector('#scene'))));
  // 3. Défaite contre un élément défavorable : carte « élément » qui ouvre l'équipe avec le doigt sur un compagnon fort.
  await page.evaluate(() => { const s = __idle.state; s.companions.equipped = s.companions.equipped.filter((id) => !['pyromancer', 'mercenary', 'barbarian', 'dwarf', 'rose_blade'].includes(id)); __idle.ui.mentorScreen('Défaite', 'Test', { element: 'green' }); });
  await page.waitForTimeout(500);
  const el = await page.evaluate(() => [...document.querySelectorAll('.mentor-card')].findIndex((c) => /Nature/.test(c.textContent)));
  if (el >= 0) await page.click(`.mentor-card[data-value="${el}"]`);
  await page.waitForTimeout(1500);
  ok('3. Défaite : carte « élément » qui ouvre l\'équipe et pointe un compagnon de Feu', el >= 0 && await page.evaluate(() => __idle.ui.tab === 'companions' && Boolean(document.querySelector('.mentor-point[data-value]'))));
  // 4. Joueur bloqué : 10 minutes sans progrès → le Sceau propose « Renaître » avec le gain chiffré.
  await page.evaluate(() => { __idle.ui.closeModal?.(); const s = __idle.state; s.recordAt = (s.playSeconds ?? 0) - 700; s.ui.wallAt = s.playSeconds; __idle.ui.invalidate(); });
  await page.waitForTimeout(2500);
  const seal = await page.evaluate(() => document.querySelector('#next-action-text')?.textContent ?? '');
  ok('4. Joueur bloqué : le Sceau propose de Renaître avec le gain', /Renaître.*\d+ %/.test(seal), seal);
  // 5. Donjon : 3 bénédictions entre deux salles, choix automatique au bout de 20 s.
  // v10.1 : une porte (choix auto en 10 s) précède les bénédictions ; on compte les bénédictions prises même si le
  // donjon se termine pendant l'attente.
  await page.evaluate(() => { const a = __idle.ui.actions; const p = a.pickBoon.bind(a); window.__boons = 0; a.pickBoon = (i) => { const b = p(i); if (b) window.__boons++; return b; };
    const s = __idle.state; s.keys = 3; s.dungeon = null; a.enterDungeon('crypt', 'any', 'gold', 'easy'); });
  await page.waitForFunction(() => document.querySelectorAll('.boon-card').length === 3, null, { timeout: 120000 }).catch(() => {});
  const three = await page.evaluate(() => document.querySelectorAll('.boon-card').length);
  await page.waitForTimeout(22000);
  const picked = await page.evaluate(() => window.__boons);
  ok('5. Donjon : 3 bénédictions proposées, choix automatique après 20 s', three === 3 && picked >= 1, `${three} cartes, ${picked} prise(s)`);
  await ctx.close();
}
// 6. Téléphone (400 px) : panneau du bas lisible, boutons ≥ 44 px, aucune barre de défilement horizontale.
{
  const { page, ctx } = await open({ width: 400, height: 860 }, { fixture: true });
  await page.evaluate(() => __idle.ui.toggleMenu('hero'));
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    small: [...document.querySelectorAll('#tabs button, #panel [data-action="buy"], #next-action')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 44).map((b) => b.dataset.menu ?? b.dataset.action ?? b.id).slice(0, 5),
    panel: document.querySelector('#panel').getBoundingClientRect().height,
  }));
  ok('6. Téléphone : pas de défilement horizontal', !r.overflow);
  ok('6. Téléphone : boutons d\'au moins 44 px de haut', r.small.length === 0, r.small.join(','));
  ok('6. Téléphone : panneau du bas lisible', r.panel >= 250, `${Math.round(r.panel)} px`);
  await ctx.close();
}
ok('Aucune erreur JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); server.close();
const fails = results.filter(([, c]) => !c).length;
console.log(`${results.length - fails}/${results.length} vérifications réussies`);
process.exit(fails ? 1 : 0);
