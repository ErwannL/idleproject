// node meas.mjs sizes tabs   -> gold visuel, texte tronqué, chevauchement texte/bouton
import { pathToFileURL } from 'node:url';
const lib = await import(pathToFileURL(process.cwd() + '/tools/lib-1013.mjs').href);
const sizes = (process.argv[2] ?? '1116x993,1366x768,1878x1245,1920x1080').split(',').map((s) => s.split('x').map(Number));
const tabs = (process.argv[3] ?? 'contracts,daybook,campaign,dungeons,tower,arena,event,expeditions').split(',');
const games = (process.argv[4] ?? 'endgame,fresh').split(',');
function inPage() {
  const out = [];
  const body = document.querySelector('#panel-body'); const br = body.getBoundingClientRect();
  const shown = (el) => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return r.bottom > br.top && r.top < br.bottom && r.right > br.left && r.left < br.right; };
  const nm = (el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 2).join('.')} «${(el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 22)}»`;
  const goldish = (cs) => { const s = cs.backgroundImage + ' ' + cs.backgroundColor; const m = [...s.matchAll(/rgb\((\d+), (\d+), (\d+)\)/g)]; return m.some((x) => +x[1] > 200 && +x[2] > 140 && +x[3] < 130); };
  const btns = [...document.querySelectorAll('#panel button, #panel [data-action], #modal button')].filter(shown);
  const golds = btns.filter((b) => { const cs = getComputedStyle(b); return goldish(cs) && !b.disabled; });
  if (golds.length > 1) out.push(['or', `${golds.length} dorés : ${golds.map(nm).join(' | ')}`]);
  // troncature
  for (const el of document.querySelectorAll('#panel *')) {
    if (!shown(el)) continue; const cs = getComputedStyle(el);
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && cs.display !== 'inline' && (cs.overflow !== 'visible' || cs.textOverflow === 'ellipsis')) out.push(['coupé', `${nm(el)} ${el.scrollWidth}>${el.clientWidth}`]);
    if (el.scrollHeight > el.clientHeight + 2 && cs.overflowY === 'hidden' && el.clientHeight > 0) out.push(['coupé-h', `${nm(el)} ${el.scrollHeight}>${el.clientHeight}`]);
  }
  // texte vs bouton
  const texts = [...document.querySelectorAll('#panel *')].filter((el) => shown(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !el.closest('button'));
  const seen = new Set();
  for (const t of texts) { const range = document.createRange(); range.selectNodeContents(t); const a = range.getBoundingClientRect();
    for (const b of btns) { if (b.contains(t) || t.contains(b)) continue; const r = b.getBoundingClientRect(); const ox = Math.min(a.right, r.right) - Math.max(a.left, r.left), oy = Math.min(a.bottom, r.bottom) - Math.max(a.top, r.top); if (ox > 2 && oy > 2) { const k = nm(t) + nm(b); if (!seen.has(k)) { seen.add(k); out.push(['texte/bouton', `${nm(t)} × ${nm(b)} ${Math.round(ox)}x${Math.round(oy)}`]); } } } }
  return out;
}
const app = await lib.startApp();
let total = 0;
for (const game of games) for (const [w, h] of sizes) {
  const g = await lib.openGame(app, game, w, h);
  for (const tab of tabs) {
    if (!await lib.openTab(g.page, tab)) continue;
    const views = [{ label: tab }, ...(await lib.listModes(g.page)).map((m) => ({ label: `${tab}/${m.value || m.label}`, m }))];
    for (const v of views) {
      if (v.m && !await lib.clickMode(g.page, v.m)) continue;
      const r = await g.page.evaluate(inPage);
      for (const [k, msg] of r) { total++; console.log(`${game} ${w}x${h} ${v.label} [${k}] ${msg}`.slice(0, 260)); }
    }
  }
  await g.ctx.close();
}
console.log('total', total);
await app.close();
