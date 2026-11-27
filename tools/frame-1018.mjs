// v10.18 (1.5) : contrôle « même cadrage » sur téléphone. On ouvre puis on ferme chacun des 6 menus du bas, puis on bascule
// Carte › Donjons › Arène › Défis. À chaque étape, le héros doit rester à 2 px près au même x à l'écran et garder la même
// hauteur en pixels (scène ou bande du haut #page-mini, qui recopie la scène 1:1). Utilisé par tools/mobile-audit.mjs
// (contrôle 21) et tools/e2e-1018-frame.mjs.

// Mesure dans la page : { state, x, h } — x = héros à l'écran, h = hauteur du héros en pixels d'écran.
export function heroOnScreen() {
  const r = __idle.renderer; const sc = r.canvas.getBoundingClientRect();
  const app = document.getElementById('app');
  const heroH = (r.layout?.heroH ?? 0) * r.scale;
  if (!app.classList.contains('page-ui')) return { state: 'combat', x: sc.left + r.heroScreenX, h: heroH, ok: true };
  const box = document.getElementById('page-mini'); const cv = box?.querySelector('canvas');
  const br = box?.getBoundingClientRect();
  if (!cv || !br?.height || cv.dataset.ox == null) return { state: 'page', x: NaN, h: NaN, ok: false, why: 'bande du haut absente' };
  // Rapport entre pixels de la bande et pixels de la scène : 1:1 attendu (même zoom).
  const ratio = (cv.width / br.width) / (r.canvas.width / sc.width);
  return { state: 'page', x: br.left + Number(cv.dataset.ox) + r.heroScreenX, h: heroH * ratio, ok: true, bandH: br.height };
}

const MENUS6 = ['hero', 'team', 'adventure', 'summon', 'shop', 'goals'];
const SWITCH = ['campaign', 'dungeons', 'arena', 'tower'];

// Renvoie { issues: [{ check, msg }], rows: [...] }.
export async function frameCheck(page, { check = 21, tol = 2, wait = 700 } = {}) {
  const issues = [], rows = [];
  const closeAll = () => page.evaluate(() => {
    try { __idle.ui.closeModal(); } catch { /* rien */ }
    document.querySelectorAll('.prologue2, #boot, .tour').forEach((e) => e.remove());
  });
  const close = async () => { await page.evaluate(() => { try { __idle.ui.closePanel(); } catch { /* rien */ } }); await closeAll(); await page.waitForTimeout(wait); };
  await close();
  const base = await page.evaluate(heroOnScreen);
  rows.push({ step: 'combat', ...base });
  const cmp = (step, m) => {
    rows.push({ step, ...m });
    if (!m.ok) { issues.push({ check, msg: `${step} : ${m.why}` }); return; }
    const dx = Math.abs(m.x - base.x), dh = Math.abs(m.h - base.h);
    if (dx > tol || dh > tol) issues.push({ check, msg: `${step} (${m.state}) : héros x ${m.x.toFixed(1)} au lieu de ${base.x.toFixed(1)}, hauteur ${m.h.toFixed(1)} au lieu de ${base.h.toFixed(1)}` });
  };
  for (const menu of MENUS6) {
    const okBtn = await page.evaluate((id) => { const b = document.querySelector(`#tabs button[data-menu="${id}"]`); if (!b) return false; b.click(); return true; }, menu);
    if (!okBtn) continue;
    await closeAll(); await page.waitForTimeout(wait);
    cmp(`menu ${menu} ouvert`, await page.evaluate(heroOnScreen));
    await close();
    cmp(`menu ${menu} fermé`, await page.evaluate(heroOnScreen));
  }
  for (const tab of SWITCH) {
    const opened = await page.evaluate((t) => { try { __idle.ui.openTab(t); } catch { return false; } return __idle.ui.tab === t; }, tab);
    if (!opened) continue;
    await closeAll(); await page.waitForTimeout(wait);
    cmp(`onglet ${tab}`, await page.evaluate(heroOnScreen));
  }
  await close();
  cmp('tout fermé', await page.evaluate(heroOnScreen));
  return { issues, rows };
}
