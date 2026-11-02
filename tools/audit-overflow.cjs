// v9.1.3 : contrôle automatique des textes coupés ou qui sortent de leur case, sur tous les écrans.
// Usage : node tools/audit-overflow.cjs <dossier contenant save.json> <port> <largeur> <hauteur> <fr|en|ko>
// Hors français, liste aussi les textes restés en français (residue-<largeur>-<langue>.txt). Le coréen,
// encore fermé aux joueurs, est ouvert par l'adresse « ?lang=ko ».
const { chromium } = require('playwright');
const fs = require('fs');
const [SP, port, W, H, lang] = process.argv.slice(2);
const save = JSON.parse(fs.readFileSync(SP + '/save.json', 'utf8'));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +W, height: +H }, hasTouch: +W < 600, isMobile: +W < 600 });
  await ctx.addInitScript(([sv, lang]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); for (const [k, v] of Object.entries(sv)) localStorage.setItem(k, v); if (lang !== 'fr') localStorage.setItem('idle-rpg.lang', lang); sessionStorage.setItem('seeded', '1'); } }, [save, lang]);
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${port}/${lang === 'ko' ? '?lang=ko' : ''}`); await p.waitForTimeout(5000);
  const close = async () => { for (let i = 0; i < 4; i++) { const c = await p.$('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) .btn-primary, button:has-text("Passer"), button:has-text("Skip")'); if (!c) break; await c.evaluate((n) => n.click()); await p.waitForTimeout(300); } };
  await close();
  const audit = () => p.evaluate(() => {
    const out = [];
    const vw = innerWidth;
    for (const el of document.querySelectorAll('#app *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('.hidden')) continue;
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
  const residue = new Set();
  const collect = async () => { if (lang === 'fr') return; for (const x of await p.evaluate((lang) => {
    const out = []; const w = document.createTreeWalker(document.getElementById('app') ?? document.body, 4);
    for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.data.replace(/\s+/g, ' ').trim(); const el = n.parentElement;
      if (!el || el.closest('[data-no-i18n], script, style, .hidden')) continue;
      // en coréen, tout texte en lettres latines est à traduire
      if (lang === 'ko' ? /[A-Za-zÀ-ÿ]{2}/.test(t) : /[éèàçùêâîôûœ]|\b(?:le|la|les|des|du|de|une|et|pour|avec|dans|vos|votre)\b/i.test(t)) out.push(t); }
    return out; }, lang)) residue.add(x); };
  const res = {};
  res['combat'] = await audit();
  const menus = await p.$$eval('#tabs [data-menu]', (a) => a.map((x) => x.dataset.menu));
  for (const m of menus) {
    await p.$eval(`#tabs [data-menu="${m}"]`, (n) => n.click()); await p.waitForTimeout(500);
    const subs = await p.$$eval('#panel-subtabs [data-sub]', (a) => a.map((x) => x.dataset.sub));
    for (const s of (subs.length ? subs : [null])) {
      if (s) { await p.$eval(`[data-sub="${s}"]`, (n) => n.click()); await p.waitForTimeout(600); }
      // ouvrir tous les replis et segments visibles
      const segs = await p.$$eval('#panel-body .seg-btn, #panel-body [data-action$="-seg"], #panel-body [data-action="mission-tab"], #panel-body [data-action="inv-tab"], #panel-body [data-action="hero-tab"], #panel-body [data-action="tree-seg"]', (a) => a.map((x) => [x.dataset.action, x.dataset.value]));
      const key = `${m}/${s}`;
      res[key] = await audit(); await collect();
      await p.screenshot({ path: `${SP}/${W}-${lang}-${m}-${s}.png` });
      for (const [act, val] of segs.slice(0, 6)) {
        const sel = `#panel-body [data-action="${act}"][data-value="${val}"]`;
        if (await p.$(sel)) { await p.$eval(sel, (n) => n.click()); await p.waitForTimeout(500); res[`${key}:${val}`] = await audit(); }
      }
      await p.$$eval('#panel-body .fold-head[aria-expanded="false"]', (a) => a.slice(0, 12).forEach((x) => x.click())); await p.waitForTimeout(500);
      res[`${key}+folds`] = await audit(); await collect();
    }
  }
  await p.$eval('[data-open="options"]', (n) => n.click()).catch(() => {}); await p.waitForTimeout(500);
  res['options'] = await audit(); await collect();
  if (lang !== 'fr') fs.writeFileSync(`${SP}/residue-${W}-${lang}.txt`, [...residue].join('\n'));
  const flat = Object.entries(res).filter(([, v]) => v.length);
  fs.writeFileSync(`${SP}/report-${W}-${lang}.txt`, flat.map(([k, v]) => `## ${k}\n${v.join('\n')}`).join('\n'));
  console.log(W, lang, 'écrans avec défaut:', flat.length, 'défauts:', flat.reduce((t, [, v]) => t + v.length, 0));
  await b.close();
})();
