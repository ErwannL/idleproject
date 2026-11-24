// v9.8 (0) / v9.10 (4) : partie neuve (mini-quêtes actives), le joueur ne touche que ce que montrent le doigt du tutoriel et le Sceau.
// v10.13 (9) : puis les parcours PC et téléphone (--only=legacy, pc ou phone).
// le doigt est apparu et une amélioration est achetée ; la consigne de mini-quête est visible. Usage : node tools/e2e-beginner.mjs
import { createRequire } from 'node:module';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
async function legacy() {
const server = await startServer(0);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1116, height: 993 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:${server.address().port}/?quests`);
await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
const traceLog = [];
let finger = false, bought = false, questBar = false, equipAt = 0, t0 = Date.now();
while (Date.now() - t0 < 180000 && !(finger && bought && equipAt)) {
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => {
    const layer = document.getElementById('tuto-layer');
    const f = layer?.querySelector('.tuto-finger:not([hidden])');
    const target = layer?.target;
    if (f && target) target.click();
    // Le Sceau avec son doigt visible (et la bulle du premier objet) : on les touche aussi.
    const seal = document.querySelector('#next-action:not(.hidden)');
    if (seal && !seal.querySelector('.na-finger')?.classList.contains('hidden')) seal.click();
    document.querySelector('.best-card.first-item button')?.click();
    __idle.save?.();
    let s = null; try { s = JSON.parse(localStorage.getItem('idle-rpg.save')); } catch { /* rien */ }
    window.__steps = [...new Set([...(window.__steps ?? []), layer?.dataset.step].filter(Boolean))];
    // v10.3.1 : trace de diagnostic (affichée si la mini-quête n'est pas finie) : où en est la partie, qu'est-ce qui est à l'écran.
    const shown = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null).map((e) => e.className.split(' ')[0]);
    const q = window.__idle.ui.state && window.__idle.ui.sealWhy;
    const trace = { kills: s?.records?.kills ?? 0, found: s?.records?.itemsFound ?? 0, equips: s?.records?.equips ?? 0, worn: Object.values(s?.equipment ?? {}).filter(Boolean).length,
      bag: s?.inventory?.length ?? 0, lootBag: s?.lootBag?.length ?? 0, done: (s?.unlocks?.done ?? []).join(), tab: window.__idle.ui.tab, step: layer?.dataset.step ?? '', finger: Boolean(f), fingerTarget: target?.id || target?.className?.toString().slice(0, 30) || '',
      seal: seal && !seal.classList.contains('hidden') ? `${seal.dataset.kind}:${document.getElementById('next-action-text')?.textContent}` : (q ? `caché(${q.n}${q.busy ? ',occupé' : ''})` : '—'), cards: shown('.howto-card, .learn-card, .best-card, .res-bubble, #prologue, .tour'), modal: !document.getElementById('modal')?.classList.contains('hidden'), sealFinger: Boolean(seal && !seal.querySelector('.na-finger')?.classList.contains('hidden')) };
    return { trace, steps: window.__steps, finger: Boolean(f), bought: Object.values(s?.upgrades ?? {}).some((n) => n > 0), bar: !document.getElementById('next-unlock')?.classList.contains('hidden'), equip: (s?.unlocks?.done ?? []).includes('equipment') };
  });
  if (Math.round((Date.now() - t0) / 1000) % 10 === 0 || r.equip) traceLog.push(`${Math.round((Date.now() - t0) / 1000)} s ${JSON.stringify(r.trace)}`);
  if (r.equip && !equipAt) equipAt = Math.round((Date.now() - t0) / 1000);
  finger ||= r.finger; bought ||= r.bought; questBar ||= r.bar;
}
const steps = await page.evaluate(() => window.__steps);
const secs = Math.round((Date.now() - t0) / 1000);
console.log(`doigt : ${finger} · amélioration achetée : ${bought} · consigne visible : ${questBar} · mini-quête Équipement finie à ${equipAt} s · ${secs} s · étapes ${steps}`);
if (!equipAt || process.argv.includes('--trace')) console.log('TRACE (toutes les ~10 s) :\n' + traceLog.join('\n'));
if (errors.length) console.log('ERREURS :\n' + errors.join('\n'));
await browser.close(); server.close();
// v10.1 (P1) : la consigne de mini-quête attend l'étape 3 (un seul appel à l'action au début) : plus exigée ici.
return finger && bought && equipAt > 0 && equipAt <= 120 && !errors.length;
}

// v10.13 (9) : parcours complets d'une partie neuve, PC (1878x1245) puis téléphone (412x915). Un joueur automatique ne touche que
// ce que montrent le doigt du tutoriel puis le Sceau (et « Équiper » / « OK » des fenêtres qu'ils ouvrent), jusqu'à l'étape 10.
// Échec si : plus de 2 allers-retours entre deux onglets · plus de 60 s sans aucun conseil alors que de l'or attend ·
// le doigt et le Sceau montrent deux écrans différents (3 relevés d'affilée) · l'étape 10 n'est pas atteinte.
// Les combats vont à la vitesse E2E_SPEED (5 par défaut : le même parcours en moins de 4 minutes ; les délais de conseil, eux, sont en temps réel).
const SPEED = Number(process.env.E2E_SPEED ?? 5);
const GOAL_STAGE = 10, MAX_GAP_S = 60, MAX_ROUNDTRIPS = 2, LIMIT_S = Number(process.env.E2E_LIMIT ?? 600);

async function journey(label, viewport, phone) {
  const server = await startServer(0);
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport, hasTouch: phone, isMobile: phone })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:${server.address().port}/?quests`);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.evaluate((v) => { window.__idle.state.ui.speed = v; }, SPEED);
  const log = [], shown = {}, tabs = [], trips = {};
  const fails = [];
  const t0 = Date.now();
  let last = '', gapStart = 0, gapMax = 0, diverge = 0, divergeMax = 0, reachedAt = 0, prevTab = null, prevPrev = null;
  while (Date.now() - t0 < LIMIT_S * 1000 && !reachedAt) {
    await page.waitForTimeout(1000);
    const r = await page.evaluate(async () => {
      const g = await import('/src/core/guide.js'); const tu = await import('/src/ui/tutorial.js');
      const ui = window.__idle.ui, st = window.__idle.state;
      const layer = document.getElementById('tuto-layer');
      const f = layer?.querySelector('.tuto-finger:not([hidden])'), target = layer?.target;
      const seal = document.querySelector('#next-action:not(.hidden)');
      const na = ui.sealAction;
      const up = g.bestOpenUpgrade(st);
      const waits = ui.tabVisible?.upgrades !== false && Boolean(up) && up.cost <= st.gold;
      const card = [...document.querySelectorAll('.howto-card, .learn-card, .best-card, .res-bubble, #prologue, .tour')].some((e) => e.offsetParent !== null)
        || !document.getElementById('modal')?.classList.contains('hidden');
      const out = { stage: st.stage, max: st.maxStage, tab: ui.tab, gold: Math.round(st.gold), waits, card,
        finger: f ? { step: layer.dataset.step, screen: tu.STEP_SCREEN[layer.dataset.step] ?? null, advice: `${na?.id ?? '-'}/${ui.hereAction?.id ?? '-'}` } : null,
        seal: seal ? { id: seal.dataset.kind, screen: g.adviceScreen(na), text: document.getElementById('next-action-text')?.textContent ?? '' } : null };
      // le joueur : le doigt d'abord, sinon le Sceau, puis les boutons « Équiper » / « OK » que ces conseils ouvrent.
      const modal = document.querySelector('#modal:not(.hidden)');
      const eq = [...document.querySelectorAll('[data-action="equip"]:not([disabled]), [data-action="gear-equip"]:not([disabled])')].find((b) => b.offsetParent);
      if (modal) (modal.querySelector('[data-action="offline-claim"], .btn-gold, .btn-primary, [data-action="close-modal"]'))?.click();
      else if (f && target) target.click();
      else if (eq && (seal?.dataset.kind === 'equip' || seal?.dataset.kind === 'quest')) eq.click(); // la fiche ouverte par le Sceau : « Équiper »
      else if (seal) seal.click();
      document.querySelector('.tour [data-tour="skip"]')?.click();
      document.querySelector('.best-card.first-item button')?.click();
      return out;
    });
    const now = Math.round((Date.now() - t0) / 1000);
    const key = JSON.stringify([r.finger, r.seal && [r.seal.id, r.seal.screen], r.tab]);
    if (key !== last) {
      last = key;
      log.push(`${String(now).padStart(3)} s · étape ${r.stage}${r.stage < r.max ? `/${r.max}` : ''} · or ${r.gold} · onglet ${r.tab ?? 'combat'} · doigt ${r.finger ? `${r.finger.step}→${r.finger.screen} [conseil ${r.finger.advice}]` : '—'} · Sceau ${r.seal ? `${r.seal.id}→${r.seal.screen ?? 'sur place'} « ${r.seal.text.slice(0, 48)} »` : '—'}`);
    }
    if (r.finger) shown[`doigt ${r.finger.step}`] = (shown[`doigt ${r.finger.step}`] ?? 0) + 1;
    if (r.seal) shown[`Sceau ${r.seal.id}`] = (shown[`Sceau ${r.seal.id}`] ?? 0) + 1;
    // allers-retours : A → B → A entre deux onglets (le combat, onglet nul, ne compte pas)
    if (r.tab && r.tab !== prevTab) {
      tabs.push(r.tab);
      if (prevPrev && r.tab === prevPrev && prevTab) { const k = [r.tab, prevTab].sort().join('↔'); trips[k] = (trips[k] ?? 0) + 1; }
      prevPrev = prevTab; prevTab = r.tab;
    }
    // or qui attend sans aucun conseil
    const advice = Boolean(r.finger || r.seal || r.card);
    if (r.waits && !advice) { gapStart ||= Date.now(); gapMax = Math.max(gapMax, (Date.now() - gapStart) / 1000); } else gapStart = 0;
    // doigt et Sceau qui divergent (écrans connus et différents)
    if (r.finger && r.seal && r.finger.screen && r.seal.screen && r.finger.screen !== r.seal.screen && r.seal.id !== 'claim') diverge += 1; else diverge = 0;
    divergeMax = Math.max(divergeMax, diverge);
    if (r.max >= GOAL_STAGE) reachedAt = now;
  }
  const secs = Math.round((Date.now() - t0) / 1000);
  const worst = Math.max(0, ...Object.values(trips));
  if (!reachedAt) fails.push(`étape ${GOAL_STAGE} non atteinte en ${secs} s`);
  if (worst > MAX_ROUNDTRIPS) fails.push(`${worst} allers-retours entre deux onglets (${JSON.stringify(trips)})`);
  if (gapMax > MAX_GAP_S) fails.push(`${Math.round(gapMax)} s sans conseil alors que de l'or attend`);
  if (divergeMax >= 3) fails.push('le doigt et le Sceau montrent deux écrans différents');
  if (errors.length) fails.push(`erreurs : ${errors.slice(0, 3).join(' | ')}`);
  console.log(`\n=== Parcours ${label} (${viewport.width}x${viewport.height}, combats x${SPEED}) ===`);
  console.log(`étape ${GOAL_STAGE} atteinte à ${reachedAt || '—'} s · plus long silence avec or en attente : ${Math.round(gapMax)} s · allers-retours : ${JSON.stringify(trips)} · onglets visités : ${tabs.length}`);
  console.log(`conseils montrés (relevés à 1 s) : ${JSON.stringify(shown)}`);
  console.log('journal :\n' + log.join('\n'));
  console.log(fails.length ? `ÉCHEC ${label} : ${fails.join(' ; ')}` : `OK ${label}`);
  await browser.close(); server.close();
  return !fails.length;
}

const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7);
let ok = true;
if (!only || only === 'legacy') ok = (await legacy()) && ok;
if (!only || only === 'pc') ok = (await journey('PC', { width: 1878, height: 1245 }, false)) && ok;
if (!only || only === 'phone') ok = (await journey('téléphone', { width: 412, height: 915 }, true)) && ok;
process.exit(ok ? 0 : 1);
