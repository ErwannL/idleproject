// v10.0 : contrôles du prompt dans le navigateur (sauvegarde de fin de jeu).
//  1. Barre de compétences : chaque bouton reçoit le clic au centre et aux 4 coins, sur 6 tailles, avec et sans boss.
// Usage : node tools/e2e-10.mjs [section…]
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const only = process.argv.slice(2);
const want = (s) => !only.length || only.includes(s);
const server = await startServer(0);
const browser = await chromium.launch();
const raw = await readFile('tests/fixtures/endgame.json', 'utf8');
let ok = 0, n = 0; const errors = [];
const check = (c, msg) => { n++; if (c) ok++; console.log(`${c ? '✔' : '✘'} ${msg}`); };
async function open(size, { fixture = raw, q = '' } = {}) {
  const ctx = await browser.newContext({ viewport: size });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  if (fixture) await page.addInitScript((r) => { if (!sessionStorage.getItem('m')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('m', '1'); } }, fixture);
  await page.goto(`http://localhost:${server.address().port}/${q}`);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(fixture ? 8000 : 2500);
  await page.evaluate(() => document.querySelectorAll('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) [data-action="offline-claim"]').forEach((b) => b.click()));
  await page.evaluate(() => { document.querySelectorAll('.tip-bubble, .hint-bubble').forEach((e) => e.remove()); __idle.ui.closePanel?.(); });
  await page.waitForTimeout(800);
  return { page, ctx };
}
const hits = (page) => page.evaluate(() => [...document.querySelectorAll('#skill-bar .skill-btn, #skill-bar button')].map((b) => {
  const r = b.getBoundingClientRect();
  const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 7, r.top + 7], [r.right - 7, r.top + 7], [r.left + 7, r.bottom - 7], [r.right - 7, r.bottom - 7]];
  const bad = pts.filter(([x, y]) => { const e = document.elementFromPoint(x, y); return !e || !(e === b || b.contains(e)); }).map(([x, y]) => document.elementFromPoint(x, y)?.id || document.elementFromPoint(x, y)?.className || '?');
  return { id: b.dataset.skill ?? b.className, bad, vis: r.width > 0 && r.top >= 0 && r.bottom <= innerHeight };
}));

if (want('skills')) {
  for (const [w, h] of [[1100, 952], [1280, 720], [1366, 768], [1920, 1080], [800, 600], [390, 844]]) {
    const { page, ctx } = await open({ width: w, height: h });
    for (const boss of [false, true]) {
      if (boss) { await page.evaluate(() => { const a = __idle.ui.actions; (a.retryBoss ?? a.fightBoss)?.(); }); await page.waitForTimeout(2500); }
      const r = await hits(page);
      const fail = r.filter((x) => x.bad.length || !x.vis);
      check(r.length > 0 && !fail.length, `${w}×${h}${boss ? ' (boss)' : ''} : ${r.length} compétences cliquables${fail.length ? ` — recouvertes : ${JSON.stringify(fail)}` : ''}`);
    }
    await ctx.close();
  }
}

if (want('finger')) {
  const fx = JSON.parse(raw); fx.playSeconds = Math.max(fx.playSeconds ?? 0, 40000);
  const { page, ctx } = await open({ width: 1116, height: 993 }, { fixture: JSON.stringify(fx) });
  let onClaim = 0, samples = 0;
  for (let i = 0; i < 36; i++) {
    await page.waitForTimeout(5000);
    const r = await page.evaluate(() => { const b = document.getElementById('next-action'); return { kind: b.dataset.kind, hidden: b.classList.contains('hidden'), finger: !b.querySelector('.na-finger').classList.contains('hidden') }; });
    if (!r.hidden) { samples++; if (r.finger && r.kind === 'claim') onClaim++; }
  }
  check(samples > 0 && onClaim === 0, `Doigt : 3 min avec une sauvegarde de plus de 10 h, aucun doigt sur « Tout récupérer » (${samples} relevés)`);
  await ctx.close();
  const neu = await open({ width: 1116, height: 993 }, { fixture: null, q: '?quests' });
  let quest = false;
  for (let i = 0; i < 40 && !quest; i++) {
    await neu.page.waitForTimeout(1000);
    quest = await neu.page.evaluate(() => { const b = document.getElementById('next-action'); return b.dataset.kind === 'quest' && !b.classList.contains('hidden') && !b.querySelector('.na-finger').classList.contains('hidden'); });
  }
  check(quest, 'Doigt : partie neuve, doigt sur l\'étape de la mini-quête');
  await neu.ctx.close();
}

if (want('fx')) {
  // Effets : sur 10 s de combat (scène, puis Titan), aucun disque d'impact ; au plus une traînée toutes les 0,4 s, 0,15 s.
  const { page, ctx } = await open({ width: 1116, height: 993 });
  const sample = (get) => page.evaluate(async (g) => {
    const r = g === 'wb' ? __idle.wbScene.r : __idle.renderer;
    const seen = new Map(); let discs = 0; const trails = [];
    for (let i = 0; i < 100; i++) {
      await new Promise((res) => setTimeout(res, 100));
      for (const e of r.effects) {
        if (seen.has(e)) continue; seen.set(e, r.time);
        if (['eglow', 'elinger', 'ring'].includes(e.kind) || (e.kind === 'vfx' && ['hit_slash', 'v_crit_arc', 'crit_wave', 'crit_flash', 'hit_fire'].includes(e.name))) discs++;
        if (e.kind === 'wtrail') trails.push({ t: r.time, max: e.max });
      }
    }
    const gaps = trails.slice(1).map((x, i) => x.t - trails[i].t);
    return { discs, trails: trails.length, minGap: gaps.length ? Math.min(...gaps) : 9, maxDur: Math.max(0, ...trails.map((x) => x.max)) };
  }, get);
  for (const where of ['scene', 'wb']) {
    if (where === 'wb') { await page.evaluate(() => __idle.ui.showRift(false)); await page.waitForTimeout(800); await page.click('[data-action="titan-start-modal"]'); await page.waitForFunction(() => window.__idle.wbScene); }
    const r = await sample(where);
    check(r.discs === 0, `${where === 'wb' ? 'Titan' : 'Scène'} : aucun disque, anneau ou croissant d'impact (${r.discs})`);
    check(r.minGap >= 0.38 && r.maxDur <= 0.15, `${where === 'wb' ? 'Titan' : 'Scène'} : ${r.trails} traînées, écart mini ${r.minGap.toFixed(2)} s, durée ${r.maxDur} s`);
  }
  await ctx.close();
}

if (want('allies')) {
  const { page, ctx } = await open({ width: 1116, height: 993 });
  const r = await page.evaluate(async () => {
    const R = __idle.renderer; R.gestureLog = [];
    const maxDx = {};
    for (let i = 0; i < 200; i++) {
      await new Promise((res) => setTimeout(res, 50));
      for (const [id, dx] of R.allyPoseDx ?? []) maxDx[id] = Math.max(maxDx[id] ?? 0, Math.abs(dx) * R.scale);
    }
    const gaps = {};
    for (const g of R.gestureLog) { (gaps[g.id] ??= []).push(g.t); }
    const minGap = Math.min(9, ...Object.values(gaps).flatMap((ts) => ts.slice(1).map((t, i) => t - ts[i])));
    const team = __idle.state.companions.equipped;
    return { maxDx, minGap, team, styles: team.map((id) => [id, (window.__allyStyle ?? {})[id]]) };
  });
  const melee = r.team.filter((id) => !['ranger', 'elf_archer', 'pyromancer', 'ice_empress', 'witch', 'sylvan_guardian', 'high_priest', 'priestess', 'archangel'].includes(id) && r.maxDx[id] !== undefined);
  check(melee.length > 0 && melee.every((id) => r.maxDx[id] >= 40), `Compagnons : un combattant s'écarte d'au moins 40 px de sa case (${melee.map((id) => `${id} ${Math.round(r.maxDx[id])} px`).join(', ')})`);
  check(r.minGap >= 0.44, `Compagnons : jamais deux gestes à moins de 0,45 s (écart mini ${r.minGap.toFixed(2)} s)`);
  await ctx.close();
}

check(!errors.length, `aucune erreur JavaScript ${errors.slice(0, 3).join(' | ')}`);
console.log(`${ok}/${n} vérifications réussies`);
await browser.close(); server.close();
process.exit(ok === n ? 0 : 1);
