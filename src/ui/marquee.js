// v10.17 (C) : aucun texte coupé — un texte plus large que son cadre défile lentement (pause 1,5 s au début et à la fin,
// 30 px/s, en boucle) ; il ne bouge pas s'il tient. Avec « Réduire les animations », il passe sur 2 lignes à la place.
// Cibles : toutes les règles CSS « white-space: nowrap » + « overflow: hidden » ou « text-overflow: ellipsis » (relevées
// une fois dans les feuilles de style), plus la classe `.mq`. Le DOM du jeu est reconstruit souvent : un MutationObserver
// et un ResizeObserver relancent une passe (au plus toutes les 300 ms), qui ne mesure que les cibles visibles.
import { reduceMotion } from './prefs.js';

export const MQ_SPEED = 30; // px/s
export const MQ_PAUSE = 1500; // ms, au début et à la fin
const BACK = 400; // ms : retour au début

// Durée d'un tour et repères (offsets) de l'animation pour un écart `dist` en px.
export function marqueePlan(dist) {
  const travel = (dist / MQ_SPEED) * 1000;
  const total = MQ_PAUSE + travel + MQ_PAUSE + BACK;
  const a = MQ_PAUSE / total;
  const b = (MQ_PAUSE + travel) / total;
  const c = (MQ_PAUSE + travel + MQ_PAUSE) / total;
  return { total, offsets: [0, a, b, c, 1] };
}

const INLINE = new Set(['inline', 'contents']);
const state = new WeakMap(); // élément → { key, anim, dist }
let selector = '.mq, .mq-box';
let timer = 0;
let last = 0;

// Sélecteurs des règles « une ligne + coupé » des feuilles de style chargées.
function collectSelectors() {
  const out = new Set(['.mq', '.mq-box', '#panel-subtabs .subtab > span', '#tabs button > span']); // nowrap et overflow posés par deux règles différentes
  const walk = (rules) => {
    for (const r of rules) {
      if (r.cssRules && !r.selectorText) { try { walk(r.cssRules); } catch { /* règle étrangère */ } continue; }
      const s = r.style;
      if (!s || !r.selectorText) continue;
      if (s.whiteSpace !== 'nowrap') continue;
      const clipped = s.textOverflow === 'ellipsis' || /hidden|clip/.test(`${s.overflow} ${s.overflowX}`);
      if (!clipped) continue;
      for (const part of r.selectorText.split(',')) {
        const p = part.trim();
        if (!p || p.includes('::') || /:(hover|active|focus)/.test(p)) continue;
        try { document.querySelector(p); out.add(p); } catch { /* sélecteur non reconnu */ }
      }
    }
  };
  for (const sheet of document.styleSheets) { try { walk(sheet.cssRules); } catch { /* feuille d'un autre domaine */ } }
  return [...out].join(',');
}

// Le contenu peut-il glisser d'un bloc (texte et éléments en ligne seulement) ?
function wrappable(el) {
  for (const n of el.childNodes) {
    if (n.nodeType === 3) continue;
    if (n.nodeType !== 1) continue;
    if (n.classList.contains('mq-in')) continue;
    if (n.tagName === 'IMG') continue;
    if (!INLINE.has(getComputedStyle(n).display)) return false;
  }
  return true;
}

function inner(el) {
  let s = el.firstElementChild;
  if (s && s.classList.contains('mq-in') && el.childNodes.length === 1) return s;
  if (!wrappable(el)) return null;
  s = document.createElement('span');
  s.className = 'mq-in';
  while (el.firstChild) s.appendChild(el.firstChild);
  el.appendChild(s);
  return s;
}

function stop(el, st) {
  st?.anim?.cancel();
  el.classList.remove('mq-on');
  if (st) { st.anim = null; st.dist = 0; }
}

function fit(el, calm) {
  const st = state.get(el) ?? {};
  state.set(el, st);
  const cs = getComputedStyle(el);
  if (calm) { // 2 lignes au lieu de défiler
    stop(el, st);
    if (el.scrollWidth > el.clientWidth + 1) el.classList.add('mq-wrap');
    return;
  }
  el.classList.remove('mq-wrap');
  const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const box = el.clientWidth - pad;
  let span = el.firstElementChild?.classList.contains('mq-in') && el.childNodes.length === 1 ? el.firstElementChild : null;
  if (!span) {
    if (el.scrollWidth <= el.clientWidth + 1) { stop(el, st); return; }
    span = inner(el);
    if (!span) {
      // un seul enfant qui porte le texte (cadre en flex) : c'est lui qui défile ; sinon contenu complexe : sur 2 lignes
      const only = el.children.length === 1 && ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) ? el.firstElementChild : null;
      if (only && !only.classList.contains('mq-box')) { only.classList.add('mq-box'); fit(only, calm); } else if (!only) el.classList.add('mq-wrap');
      return;
    }
  }
  const dist = Math.ceil(span.getBoundingClientRect().width - box);
  if (dist <= 1) { stop(el, st); return; }
  if (st.anim && st.span === span && Math.abs(st.dist - dist) < 2) return;
  st.anim?.cancel();
  const { total, offsets } = marqueePlan(dist);
  const x = `translateX(${-dist}px)`;
  st.anim = span.animate([
    { transform: 'translateX(0)', offset: offsets[0] }, { transform: 'translateX(0)', offset: offsets[1] },
    { transform: x, offset: offsets[2] }, { transform: x, offset: offsets[3] }, { transform: 'translateX(0)', offset: offsets[4] },
  ], { duration: total, iterations: Infinity, easing: 'linear' });
  st.dist = dist;
  el.classList.add('mq-on');
}

export function marqueePass(root = document) {
  last = performance.now();
  timer = 0;
  const calm = reduceMotion();
  let list;
  try { list = root.querySelectorAll(selector); } catch { selector = '.mq'; list = root.querySelectorAll(selector); }
  for (const el of list) {
    if (!el.isConnected || el.closest('.mq-in, .sr-only') || !el.getClientRects().length) continue;
    const span = el.firstElementChild?.classList.contains('mq-in') ? el.firstElementChild : null; // contenu remplacé par le jeu : à refaire
    const key = `${el.textContent}|${el.clientWidth}|${calm}`;
    const st = state.get(el);
    if (st && st.key === key && st.span === span && (st.anim ? el.classList.contains('mq-on') : true)) continue;
    fit(el, calm);
    const s2 = state.get(el); s2.key = key; s2.span = el.firstElementChild?.classList.contains('mq-in') ? el.firstElementChild : null;
  }
}

function schedule() {
  if (timer) return;
  const wait = Math.max(60, 300 - (performance.now() - last));
  timer = setTimeout(() => requestAnimationFrame(() => marqueePass()), wait);
}

export function initMarquee() {
  if (typeof document === 'undefined' || initMarquee.done) return;
  initMarquee.done = true;
  selector = collectSelectors();
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener('resize', schedule);
  window.__marquee = { pass: marqueePass, refresh: () => { selector = collectSelectors(); marqueePass(); } };
  schedule();
}
