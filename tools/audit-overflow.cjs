// v9.1.3 : contrôle automatique des textes coupés ou qui sortent de leur case, sur tous les écrans.
// Usage : node tools/audit-overflow.cjs <dossier contenant save.json> <port> <largeur> <hauteur> <fr|en|ko>
// Hors français, liste aussi les textes restés en français (residue-<largeur>-<langue>.txt) : nœuds texte,
// attributs title / aria-label / placeholder / alt et options des listes.
// v9.1.9 : l'audit ouvre aussi Paramètres (tous les onglets), les fiches (objets et leurs onglets, compagnons,
// boss, donjons, compétences, talents, encyclopédie), les fenêtres (retour hors ligne, retour de session,
// Renaissance, Transcendance, confirmations, journal, raccourcis K) et le tutoriel d'une partie neuve.
const { chromium } = require('playwright');
const fs = require('fs');
const [SP, port, W, H, lang] = process.argv.slice(2);
const save = JSON.parse(fs.readFileSync(SP + '/save.json', 'utf8'));
const url = `http://localhost:${port}/${lang === 'fr' ? '' : `?lang=${lang}`}`;

// Textes visibles restés en français (en coréen : tout mot en lettres latines).
function collectInPage(lang) {
  const out = [];
  // Grands nombres « 232,3 ai » : unités du jeu (aa, ab…), gardées.
  // Sigles et noms gardés en coréen : HP, XP, Lv., touches du clavier, GitHub, nom du jeu, « EFFACER » (mot à taper,
  // comparé par le code).
  const KEEP = /\b(?:HP|XP|Lv|FPS|NEW|PC|ms|K|M|B|T|Qa|Qi|SR|SSR|UR|Esc|Shift|Tab|Enter|Space|Ctrl|Alt|GitHub|Ascendrya|Language|EFFACER|DPS)\b|(\d) ?[a-z]{2}\b/g;
  const bad = (t) => (lang === 'ko' ? /[A-Za-zÀ-ÿ]{2}/.test(t.replace(KEEP, '$1')) : /[éèàçùêâîôûœ]|\b(?:le|la|les|des|du|de|une|et|pour|avec|dans|vos|votre)\b/i.test(t));
  // Noms propres, unités et sigles gardés volontairement (voir docs/coreen.md).
  const keep = /^(?:[\d\s.,+\-−×x%/:()·~★✦]*(?:Lv|HP|XP|K|M|B|T|Qa|Qi|SR|SSR|UR|R|S|A|DPS|PC|ID|OK|GitHub|Discord|Ascendrya|Esc|Tab|Ctrl|Shift|Alt|Entrée|Enter|Space|F\d+|v\d[\d.]*)[\d\s.,+\-−×x%/:()·~★✦]*)+$/;
  const push = (t, where) => { t = t.replace(/\s+/g, ' ').trim(); if (t && bad(t) && !keep.test(t)) out.push(where ? `[${where}] ${t}` : t); };
  const root = document.body;
  const w = document.createTreeWalker(root, 4);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const el = n.parentElement;
    if (!el || el.closest('[data-no-i18n], [translate="no"], script, style, .hidden, kbd')) continue;
    push(n.data);
  }
  for (const el of root.querySelectorAll('[title],[aria-label],[placeholder],[alt]')) {
    if (el.closest('[data-no-i18n], [translate="no"], .hidden')) continue;
    for (const a of ['title', 'aria-label', 'placeholder', 'alt']) if (el.hasAttribute(a)) push(el.getAttribute(a), a);
  }
  return out;
}

(async () => {
  const b = await chromium.launch();
  const mk = async (seed) => {
    const ctx = await b.newContext({ viewport: { width: +W, height: +H }, hasTouch: +W < 600, isMobile: +W < 600 });
    await ctx.addInitScript(([sv, lang]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); for (const [k, v] of Object.entries(sv)) localStorage.setItem(k, v); if (lang !== 'fr') localStorage.setItem('idle-rpg.lang', lang); sessionStorage.setItem('seeded', '1'); } }, [seed, lang]);
    const p = await ctx.newPage();
    await p.goto(url); await p.waitForTimeout(4500);
    return p;
  };
  const residue = new Set();
  const collect = async (p) => { if (lang === 'fr') return; for (const x of await p.evaluate(collectInPage, lang)) residue.add(x); };
  const close = async (p, grab = true) => { for (let i = 0; i < 6; i++) { if (grab) await collect(p); const c = await p.$('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) .btn-primary, button:has-text("Passer"), button:has-text("Skip"), button:has-text("건너뛰기")'); if (!c) break; await c.evaluate((n) => n.click()); await p.waitForTimeout(300); } };
  const click = (p, sel) => p.$eval(sel, (n) => n.click()).then(() => true).catch(() => false);

  // 1) Partie neuve : intro et tutoriel.
  {
    const p = await mk({});
    for (let i = 0; i < 14; i++) {
      await collect(p);
      const nx = await p.$('#modal:not(.hidden) .btn-primary, .tour-card .btn-primary, .tour .btn-primary, [data-action="tour-full"]');
      if (!nx) break;
      await nx.evaluate((n) => n.click()); await p.waitForTimeout(400);
    }
    await p.context().close();
  }

  const p = await mk(save);
  await close(p);
  const audit = () => p.evaluate(() => {
    const out = [];
    const vw = innerWidth;
    for (const el of document.querySelectorAll('#app *, #modal-card *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('.hidden, .sr-only')) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const txt = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40);
      const clipX = el.scrollWidth > el.clientWidth + 1 && ['hidden', 'clip'].includes(cs.overflowX);
      const clipY = el.scrollHeight > el.clientHeight + 2 && ['hidden', 'clip'].includes(cs.overflowY) && cs.webkitLineClamp === 'none';
      const ell = cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1;
      const off = r.right > vw + 1 && !el.closest('[style*="overflow"], .map-viewport, .tree-viewport, #panel-subtabs');
      // texte qui dépasse le cadre du parent bordé
      let spill = false; const par = el.parentElement;
      if (par && cs.position !== 'absolute') { const pr = par.getBoundingClientRect(); spill = (r.right > pr.right + 2 || r.left < pr.left - 2) && getComputedStyle(par).overflowX === 'visible' && !par.matches('#panel-body, body'); }
      if (clipX || clipY || ell || off || spill) out.push(`${clipX ? 'CLIPX ' : ''}${clipY ? 'CLIPY ' : ''}${ell ? 'ELL ' : ''}${off ? 'OFFSCREEN ' : ''}${spill ? 'SPILL ' : ''}${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')} « ${txt} »`);
    }
    return [...new Set(out)];
  });
  const res = {};
  res['combat'] = await audit(); await collect(p);
  // Fiches et sélections ouvertes dans chaque écran (quelques-unes de chaque sorte).
  const ENTITY = ['select-item', 'companion-sel', 'boss-sel', 'dungeon-sel', 'dungeon-path', 'dungeon-diff', 'enc-sel', 'enc-sec', 'skill-sel', 'talent-sel', 'zone-sel', 'exp-pick'];
  const entities = async (key) => {
    for (const act of ENTITY) {
      const n = await p.$$eval(`#panel-body [data-action="${act}"]`, (a) => a.length);
      for (let i = 0; i < Math.min(n, act === 'select-item' ? 8 : act === 'talent-sel' ? 10 : 5); i++) {
        const ok = await p.$$eval(`#panel-body [data-action="${act}"]`, (a, i) => { const x = a[i]; if (!x) return false; x.click(); return true; }, i);
        if (!ok) continue;
        await p.waitForTimeout(250); await collect(p);
        if (act === 'select-item') {
          for (const t of ['compare', 'upgrade', 'store']) { if (await click(p, `[data-action="item-tab"][data-value="${t}"]`)) { await p.waitForTimeout(200); await collect(p); } }
          if (i === 0) res[`${key}:item`] = await audit();
        } else if (i === 0) res[`${key}:${act}`] = await audit();
        await click(p, '[data-action="close-sheet"]');
      }
    }
  };
  const menus = await p.$$eval('#tabs [data-menu]', (a) => a.map((x) => x.dataset.menu));
  for (const m of menus) {
    await p.$eval(`#tabs [data-menu="${m}"]`, (n) => n.click()); await p.waitForTimeout(500);
    const subs = await p.$$eval('#panel-subtabs [data-sub]', (a) => a.map((x) => x.dataset.sub));
    for (const s of (subs.length ? subs : [null])) {
      if (s) { await p.$eval(`[data-sub="${s}"]`, (n) => n.click()); await p.waitForTimeout(600); }
      // ouvrir tous les replis et segments visibles
      const segs = await p.$$eval('#panel-body .seg-btn, #panel-body [data-action$="-seg"], #panel-body [data-action="mission-tab"], #panel-body [data-action="inv-tab"], #panel-body [data-action="inv-view"], #panel-body [data-action="hero-tab"], #panel-body [data-action="tree-seg"]', (a) => a.map((x) => [x.dataset.action, x.dataset.value]));
      const key = `${m}/${s}`;
      res[key] = await audit(); await collect(p);
      await p.screenshot({ path: `${SP}/${W}-${lang}-${m}-${s}.png` });
      await entities(key);
      for (const [act, val] of segs.slice(0, 8)) {
        const sel = `#panel-body [data-action="${act}"][data-value="${val}"]`;
        if (await p.$(sel)) { await p.$eval(sel, (n) => n.click()); await p.waitForTimeout(500); res[`${key}:${val}`] = await audit(); await collect(p); await entities(`${key}:${val}`); }
      }
      await p.$$eval('#panel-body .fold-head[aria-expanded="false"], #panel-body details:not([open]) > summary', (a) => a.slice(0, 16).forEach((x) => x.click())); await p.waitForTimeout(500);
      res[`${key}+folds`] = await audit(); await collect(p);
    }
  }
  // Paramètres : tous les onglets.
  await close(p, false);
  for (let i = 0; i < 3 && !(await p.$('[data-action="opt-tab"]')); i++) { await click(p, '[data-open="options"]'); await p.waitForTimeout(600); }
  const otabs = await p.$$eval('[data-action="opt-tab"]', (a) => a.map((x) => x.dataset.value));
  for (const t of otabs.length ? otabs : ['general']) {
    for (let i = 0; i < 3; i++) {
      await click(p, `[data-action="opt-tab"][data-value="${t}"]`); await p.waitForTimeout(500);
      if (await p.$(`[data-action="opt-tab"][data-value="${t}"][aria-selected="true"]`)) break;
    }
    res[`options/${t}`] = await audit(); await collect(p);
    await p.screenshot({ path: `${SP}/${W}-${lang}-options-${t}.png`, fullPage: true });
  }
  // Fenêtres, ouvertes directement (accès de test de la version pilotée).
  const modals = {
    shortcuts: 'ui.showShortcuts()',
    journal: 'ui.showJournal({ seconds: 3600, stages: 12, bosses: 3, gold: 1e9, items: 40 })',
    rebirth: 'ui.showRebirthConfirm(st)',
    transcend: 'ui.showTranscendConfirm(st)',
    respec: 'ui.showRespecConfirm(st)',
    reset: 'ui.showResetConfirm()',
    boost: 'ui.showBoost(st)',
    session: 'ui.showSessionReturn({ before: 1e6, after: 2e6, claimed: 2, claimsLeft: 1, equipped: 3 })',
    offline: 'ui.showOffline({ elapsedSeconds: 30000, capped: true, totalGold: 1e9, xp: 5e6, levelsGained: 3, gems: 20, materials: { shards: 30 }, items: st.inventory.slice(0, 6), excessDrops: 4, autoRecycledCount: 2, kills: 4000, stage: st.stage, paused: "dungeon" }, { seconds: 600 })',
    speed: 'ui.showSpeedWarning()',
    gold: 'ui.showCurrency("gold")', gems: 'ui.showCurrency("gems")', shards: 'ui.showCurrency("shards")',
    talents: 'ui.showBuyTalents("combat")',
  };
  for (const [k, code] of Object.entries(modals)) {
    const ok = await p.evaluate((code) => { try { const { ui, state: st } = window.__idle; new Function('ui', 'st', code)(ui, st); return true; } catch (e) { return String(e); } }, code);
    if (ok !== true) { console.log('fenêtre', k, ':', ok); continue; }
    await p.waitForTimeout(400);
    await p.$$eval('#modal-card details:not([open]) > summary', (a) => a.forEach((x) => x.click()));
    res[`modal/${k}`] = await audit(); await collect(p);
    if (['shortcuts', 'offline', 'rebirth'].includes(k)) await p.screenshot({ path: `${SP}/${W}-${lang}-modal-${k}.png` });
    await close(p, false);
  }
  if (lang !== 'fr') fs.writeFileSync(`${SP}/residue-${W}-${lang}.txt`, [...residue].sort().join('\n'));
  const flat = Object.entries(res).filter(([, v]) => v.length);
  fs.writeFileSync(`${SP}/report-${W}-${lang}.txt`, flat.map(([k, v]) => `## ${k}\n${v.join('\n')}`).join('\n'));
  console.log(W, lang, 'écrans avec défaut:', flat.length, 'défauts:', flat.reduce((t, [, v]) => t + v.length, 0), 'résidus:', residue.size);
  await b.close();
})();
