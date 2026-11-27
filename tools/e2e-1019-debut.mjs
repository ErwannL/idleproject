// v10.19 (partie 6.6) : début de partie sur téléphone (405×896), partie neuve (mini-quêtes actives) à ×10 pendant 10 minutes,
// en suivant SEULEMENT le bouton doré : celui du bas (#next-action, le Sceau), et, quand un écran ouvert par le Sceau le cache,
// le bouton doré que montre le doigt de la bulle (« Équiper » de la fiche) ; sans aucun bouton doré à suivre, l'écran est
// fermé (✕, retour au combat). La ligne entourée par le Sceau sur l'écran qu'il ouvre (.ring-target) est suivie aussi. Les fenêtres qui s'ouvrent sont fermées par leur bouton principal. Échec si :
//   - un même conseil du Sceau est affiché (et suivi) plus de 20 fois de suite ;
//   - une bulle (tutoriel, « Nouveau : <ressource> ») reste visible plus de 30 s d'affilée ;
//   - un menu du bas est visible avant son étape (Héros 3, Objectifs 5, Invocation 7, Aventure 10, Boutique 12 ; Équipe au premier compagnon) ;
//   - « Tout récupérer » ou une bulle « Nouveau : … » apparaît avant la fin de la 1re vague (étape 1) ;
//   - une erreur JavaScript.
// Usage : node tools/e2e-1019-debut.mjs   (E2E_LIMIT=secondes pour raccourcir, E2E_SPEED=10 par défaut)
import { createRequire } from 'node:module';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const SPEED = Number(process.env.E2E_SPEED ?? 10);
const LIMIT_S = Number(process.env.E2E_LIMIT ?? 600);
const MAX_SAME = 20, MAX_BUBBLE_S = 30, FOLLOW_EVERY = 3; // le Sceau est suivi une fois toutes les 3 s (un « affichage »)
const GATES = { hero: 3, goals: 5, summon: 7, adventure: 10, shop: 12 };

const server = await startServer(0);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 405, height: 896 }, hasTouch: true, isMobile: true })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/?quests`);
await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
await page.evaluate((v) => { window.__idle.state.ui.speed = v; }, SPEED);

const fails = [];
const menuSeenAt = {}; // menu → étape record quand il est apparu
const bubbleSince = new Map(); // bulle → instant où elle est apparue
let bubbleMax = { key: '', s: 0 };
let sameText = '', sameN = 0, sameMax = { text: '', n: 0 };
const log = [];
const t0 = Date.now();
let tick = 0, last = '';
while (Date.now() - t0 < LIMIT_S * 1000) {
  await page.waitForTimeout(1000);
  tick += 1;
  const follow = tick % FOLLOW_EVERY === 0;
  const r = await page.evaluate((follow) => {
    const st = __idle.state;
    const vis = (e) => Boolean(e) && e.isConnected && !e.hidden && e.getClientRects().length > 0 && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > 0.05;
    const menus = [...document.querySelectorAll('#tabs button[data-menu]')].filter((b) => !b.classList.contains('hidden') && vis(b)).map((b) => b.dataset.menu);
    const layer = document.getElementById('tuto-layer');
    const bubbles = [];
    if (layer && vis(layer.querySelector('.tuto-bubble'))) bubbles.push(`tuto:${layer.dataset.step}`);
    for (const b of document.querySelectorAll('.res-bubble')) if (vis(b)) bubbles.push(`res:${b.dataset.gloss}`);
    const seal = document.querySelector('#next-action:not(.hidden)');
    const sealText = seal && vis(seal) ? `${seal.dataset.kind}:${document.getElementById('next-action-text')?.textContent ?? ''}` : '';
    const out = { best: Math.max(st.maxStage ?? 1, st.records?.bestStage ?? 1), menus, bubbles, sealText, owned: Object.keys(st.companions?.owned ?? {}).length, tab: __idle.ui.tab ?? 'combat' };
    // le joueur : ferme les fenêtres par leur bouton principal ; sinon, toutes les 3 s, touche le Sceau et rien d'autre.
    const modal = document.querySelector('#modal:not(.hidden)');
    if (modal) (modal.querySelector('[data-action="offline-claim"], .btn-gold, .btn-primary, [data-action="close-modal"]'))?.click();
    document.querySelector('.tour [data-tour="skip"]')?.click();
    document.querySelector('.learn-card [data-close]')?.click();
    out.followed = Boolean(!modal && follow && seal && sealText);
    if (out.followed) seal.click();
    else if (!modal && follow) {
      const target = layer?.target;
      const finger = layer && vis(layer.querySelector('.tuto-finger:not([hidden])'));
      const ring = document.querySelector('.ring-target');
      if (finger && target?.matches?.('.m-btn-gold, .btn-gold') && vis(target)) { target.click(); out.gold = target.textContent.trim(); }
      else if (ring && vis(ring) && !ring.disabled) ring.click(); // la ligne que le Sceau a entourée sur l'écran qu'il a ouvert
      else if (__idle.ui.tab) document.querySelector('#panel-close, .panel-close, [data-action="close-panel"]')?.click();
    }
    return out;
  }, follow);
  const now = (Date.now() - t0) / 1000;
  // menus du bas : jamais avant leur étape
  for (const m of r.menus) {
    if (m in menuSeenAt) continue;
    menuSeenAt[m] = r.best;
    if (GATES[m] && r.best < GATES[m]) fails.push(`menu ${m} visible à l'étape ${r.best} (attendu ≥ ${GATES[m]})`);
    if (m === 'team' && !r.owned) fails.push('menu Équipe visible sans compagnon');
  }
  // rien avant la fin de la 1re vague
  if (r.best < 2 && (r.sealText.startsWith('claim:') || r.bubbles.some((b) => b.startsWith('res:')))) fails.push(`trop tôt (étape ${r.best}) : ${r.sealText} ${r.bubbles.join(' ')}`);
  // bulles : 30 s au plus d'affilée
  for (const k of [...bubbleSince.keys()]) if (!r.bubbles.includes(k)) bubbleSince.delete(k);
  for (const k of r.bubbles) {
    if (!bubbleSince.has(k)) bubbleSince.set(k, now);
    const d = now - bubbleSince.get(k);
    if (d > bubbleMax.s) bubbleMax = { key: k, s: Math.round(d) };
  }
  // conseil du Sceau suivi : 20 fois de suite au plus
  if (r.followed) {
    if (r.sealText === sameText) sameN += 1; else { sameText = r.sealText; sameN = 1; }
    if (sameN > sameMax.n) sameMax = { text: sameText, n: sameN };
  }
  const line = `étape ${r.best} · menus ${r.menus.join(',') || '—'} · onglet ${r.tab} · Sceau ${r.sealText || '—'} · bulles ${r.bubbles.join(',') || '—'}`;
  if (line !== last) { log.push(`${String(Math.round(now)).padStart(4)} s · ${line}`); last = line; }
}
if (bubbleMax.s > MAX_BUBBLE_S) fails.push(`bulle « ${bubbleMax.key} » visible ${bubbleMax.s} s d'affilée (max ${MAX_BUBBLE_S})`);
if (sameMax.n > MAX_SAME) fails.push(`conseil « ${sameMax.text} » affiché ${sameMax.n} fois de suite (max ${MAX_SAME})`);
if (errors.length) fails.push(`erreurs JS : ${errors.slice(0, 3).join(' | ')}`);
console.log(`e2e-1019-debut : ${LIMIT_S} s à ×${SPEED} · menus ouverts (étape) ${JSON.stringify(menuSeenAt)} · conseil le plus répété ${sameMax.n}× « ${sameMax.text} » · bulle la plus longue ${bubbleMax.s} s (${bubbleMax.key || '—'})`);
if (fails.length || process.argv.includes('--trace')) console.log(log.join('\n'));
if (fails.length) console.log(`ÉCHEC :\n- ${fails.join('\n- ')}`);
else console.log('OK');
await browser.close(); server.close();
process.exit(fails.length ? 1 : 0);
