// Ascendrya — mesure d'audience du site, sans cookie, sans service tiers (voir confidentialite.html et server/sitestats.mjs).
//  - un identifiant de visiteur aléatoire en localStorage (« nouveau » ou « revenant »), jamais lié à une identité ;
//  - un identifiant de session aléatoire en sessionStorage (30 min d'inactivité = nouvelle session) ;
//  - Do-Not-Track / Global Privacy Control / ?notrack=1 : on ne compte que la page vue, sans aucun identifiant ni stockage ;
//  - envois groupés vers POST /api/site/track (sendBeacon, sinon fetch keepalive), vers notre propre serveur uniquement.
// Les autres scripts du site peuvent signaler un événement : window.ascendryaTrack('form', 'error', 'invalid').
(() => {
  'use strict';
  const script = document.currentScript;
  let endpoint = '/api/site/track';
  try { endpoint = new URL('/api/site/track', script?.src || location.href).href; } catch { /* adresse relative */ }
  const ls = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    del: (k) => { try { localStorage.removeItem(k); } catch { /* bloqué */ } },
  };
  const ss = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* bloqué */ } },
  };
  // Désactivation volontaire (ex. le propriétaire du site) : ?notrack=1 sur n'importe quelle page, ?notrack=0 pour réactiver.
  const q = new URLSearchParams(location.search);
  if (q.get('notrack') === '1') ls.set('ascendrya-notrack', '1');
  if (q.get('notrack') === '0') ls.del('ascendrya-notrack');
  if (ls.get('ascendrya-notrack') === '1') return;

  const dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1' || navigator.globalPrivacyControl === true;
  const page = () => (location.pathname.replace(/\/index\.html$/, '/') || '/');
  const randomId = () => {
    const b = new Uint8Array(12);
    (crypto || window.msCrypto).getRandomValues(b);
    return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const send = (payload) => {
    const body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' }))) return;
    } catch { /* repli sur fetch */ }
    try { fetch(endpoint, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {}); } catch { /* hors ligne */ }
  };
  const fire = () => ({ n: 'pv', p: page(), v: (document.title || '').slice(0, 80) });

  // Mode « ne pas suivre » : une page vue anonyme, rien d'autre (ni identifiant, ni stockage, ni événements).
  if (dnt) { send({ dnt: 1, e: [fire()] }); window.ascendryaTrack = () => {}; return; }

  // ---------- Identité anonyme ----------
  let vid = ls.get('ascendrya-vid');
  const returning = !!(vid && /^[A-Za-z0-9_-]{8,40}$/.test(vid));
  if (!returning) { vid = randomId(); if (!ls.set('ascendrya-vid', vid)) vid = null; } // stockage bloqué : le serveur compte alors un visiteur par jour
  const SESSION_MS = 30 * 60 * 1000;
  let sid = null;
  const touchSession = () => {
    if (!sid) {
      try { const s = JSON.parse(ss.get('ascendrya-sid') || 'null'); if (s && Date.now() - s.t < SESSION_MS && /^[A-Za-z0-9_-]{8,40}$/.test(s.id)) sid = s.id; } catch { /* nouvelle session */ }
      sid ??= randomId();
    }
    ss.set('ascendrya-sid', JSON.stringify({ id: sid, t: Date.now() }));
  };
  touchSession();

  // ---------- Provenance (première page seulement ; le serveur l'ignore ensuite) ----------
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const meta = () => {
    const get = (k) => q.get(k) || undefined;
    const ref = document.referrer ? hostOf(document.referrer) : '';
    return { u: { s: get('utm_source'), m: get('utm_medium'), c: get('utm_campaign'), k: get('utm_content'), t: get('utm_term') }, r: ref && ref !== hostOf(location.href) ? ref : undefined, w: Math.round(innerWidth), l: document.documentElement.lang || navigator.language };
  };

  // ---------- File d'événements ----------
  const queue = [];
  let human = false;
  let humanSent = false;
  let active = 0;
  let sentPerf = false;
  const push = (n, a, v, x) => {
    const ev = { n, p: page() };
    if (a !== undefined && a !== null) ev.a = String(a);
    if (v !== undefined && v !== null && v !== '') ev.v = String(v);
    if (x !== undefined && x !== null) ev.x = x;
    queue.push(ev);
    if (queue.length >= 25) flush();
  };
  function flush() {
    if (!queue.length && !active && !human) return;
    touchSession();
    const e = queue.splice(0, 38);
    if (active) { e.push({ n: 'act', x: Math.min(120000, active) }); active = 0; }
    const h = human;
    human = false; humanSent = h || humanSent; // le signal « présence humaine » part une seule fois par page
    send({ s: sid, v: vid, nv: returning ? 0 : 1, h: h ? 1 : 0, m: meta(), e });
    if (queue.length) flush();
  }
  window.ascendryaTrack = (n, a, v, x) => { try { push(n, a, v, x); } catch { /* jamais bloquant */ } };

  // Page vue (+ langue, + arrivée par un lien de parrainage).
  queue.push(fire());
  const refCode = (q.get('ref') || '').toUpperCase();
  if (/^[A-HJ-NP-Z2-9]{5,6}$/.test(refCode) && ss.get('ascendrya-ref-seen') !== refCode) { ss.set('ascendrya-ref-seen', refCode); push('ref', 'arrive', refCode); }

  // ---------- Présence humaine et temps actif ----------
  let lastMove = 0;
  const alive = () => { if (!humanSent) human = true; lastMove = Date.now(); };
  for (const t of ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel', 'scroll']) addEventListener(t, alive, { passive: true, once: false });
  setInterval(() => { if (document.visibilityState === 'visible' && Date.now() - lastMove < 30000) active += 1000; }, 1000);
  setInterval(flush, 8000);
  setTimeout(flush, 1500); // la première page vue part vite, même si le visiteur ne bouge pas

  // ---------- Clics ----------
  const KINDS = [['x', ['x.com', 'twitter.com', 't.co']], ['youtube', ['youtube.com', 'youtu.be']], ['tiktok', ['tiktok.com']], ['steam', ['steampowered.com', 'steamcommunity.com']],
    ['play_store', ['play.google.com']], ['discord', ['discord.com', 'discord.gg']], ['reddit', ['reddit.com']], ['facebook', ['facebook.com']], ['instagram', ['instagram.com']], ['twitch', ['twitch.tv']]];
  const kindOf = (host) => (KINDS.find(([, d]) => d.some((x) => host === x || host.endsWith(`.${x}`))) ?? [`other:${host}`.slice(0, 50)])[0];
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);
  document.addEventListener('click', (ev) => {
    const el = ev.target instanceof Element ? ev.target.closest('[data-track], [data-lang], a[href], button, summary') : null;
    if (!el) return;
    let id = el.dataset.track; let out = '';
    const a = el.closest('a[href]');
    if (a) {
      const host = hostOf(a.href);
      if (host && host !== hostOf(location.href) && /^https?:$/.test(a.protocol)) { out = kindOf(host); id ??= `out_${out}`.slice(0, 60); }
      else if (a.hash && a.pathname === location.pathname) id ??= `link_${slug(a.hash)}`;
      else id ??= `link_${slug(a.pathname) || 'home'}`;
    }
    if (!id && el.dataset.lang) id = `lang_${slug(el.dataset.lang)}`;
    if (!id && el.matches('summary')) id = `faq_${slug(el.textContent).slice(0, 24) || 'open'}`;
    id ??= el.id ? `btn_${slug(el.id)}` : `btn_${slug(el.textContent) || 'x'}`;
    push('click', id, out);
  }, true);

  // ---------- Défilement (25 / 50 / 75 / 100 %) ----------
  const reached = new Set();
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const h = document.documentElement.scrollHeight - innerHeight;
      if (h <= 0) return;
      const p = ((scrollY || document.documentElement.scrollTop) / h) * 100;
      for (const t of [25, 50, 75, 100]) if (p >= t - (t === 100 ? 2 : 0) && !reached.has(t)) { reached.add(t); push('scroll', null, null, t); }
    });
  }, { passive: true });

  // ---------- Sections vues ----------
  if ('IntersectionObserver' in window) {
    const seen = new Set();
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting && !seen.has(en.target.id)) { seen.add(en.target.id); push('sec', en.target.id); io.unobserve(en.target); }
    }, { rootMargin: '0px 0px -25% 0px', threshold: 0 });
    for (const s of document.querySelectorAll('section[id]')) if (/^[A-Za-z0-9_.:-]{1,60}$/.test(s.id)) io.observe(s);
  }

  // ---------- Vidéo d'accueil ----------
  const reel = document.getElementById('reel');
  if (reel) {
    const marks = new Set();
    reel.addEventListener('playing', () => { if (!marks.has('play')) { marks.add('play'); push('vid', 'play'); } });
    reel.addEventListener('timeupdate', () => {
      if (!reel.duration || !marks.has('play')) return;
      const p = (reel.currentTime / reel.duration) * 100;
      for (const t of [25, 50, 75, 100]) if (p >= (t === 100 ? 97 : t) && !marks.has(t)) { marks.add(t); push('vid', String(t)); }
    });
  }

  // ---------- Formulaire de préinscription : focus, saisie ----------
  const form = document.getElementById('prereg');
  if (form) {
    let focus = false; let input = false;
    form.addEventListener('focusin', () => { if (!focus) { focus = true; push('form', 'focus'); } });
    form.addEventListener('input', () => { if (!input) { input = true; push('form', 'input'); } });
  }

  // ---------- <details> (FAQ) ----------
  document.addEventListener('toggle', (ev) => {
    const d = ev.target;
    if (d instanceof HTMLDetailsElement && d.open) push('click', `faq_${slug(d.id || d.querySelector('summary')?.textContent || 'open').slice(0, 24)}`);
  }, true);

  // ---------- Erreurs JavaScript du site ----------
  let errors = 0;
  addEventListener('error', (ev) => {
    if (!ev.message || errors >= 5) return;
    errors += 1;
    const file = String(ev.filename || '').split('/').pop().split('?')[0];
    push('err', ev.message, file ? `${file}:${ev.lineno || 0}` : '');
  });
  addEventListener('unhandledrejection', (ev) => {
    if (errors >= 5) return;
    errors += 1;
    push('err', `promesse rejetée : ${ev.reason?.message || ev.reason || '?'}`);
  });

  // ---------- Performances (Core Web Vitals) ----------
  const vitals = { lcp: 0, cls: 0, inp: 0, fcp: 0 };
  const observe = (type, cb, extra = {}) => { try { new PerformanceObserver((l) => l.getEntries().forEach(cb)).observe({ type, buffered: true, ...extra }); } catch { /* non pris en charge */ } };
  observe('largest-contentful-paint', (e) => { vitals.lcp = e.renderTime || e.loadTime || e.startTime; });
  observe('paint', (e) => { if (e.name === 'first-contentful-paint') vitals.fcp = e.startTime; });
  let sessionValue = 0; let sessionEntries = [];
  observe('layout-shift', (e) => {
    if (e.hadRecentInput) return;
    const last = sessionEntries[sessionEntries.length - 1];
    const firstE = sessionEntries[0];
    if (sessionEntries.length && e.startTime - last.startTime < 1000 && e.startTime - firstE.startTime < 5000) { sessionValue += e.value; sessionEntries.push(e); } else { sessionValue = e.value; sessionEntries = [e]; }
    vitals.cls = Math.max(vitals.cls, sessionValue);
  });
  observe('event', (e) => { if (e.interactionId) vitals.inp = Math.max(vitals.inp, e.duration); }, { durationThreshold: 40 });
  function sendPerf() {
    if (sentPerf) return;
    sentPerf = true;
    const nav = performance.getEntriesByType?.('navigation')?.[0];
    if (vitals.lcp) push('perf', 'lcp', null, Math.round(vitals.lcp));
    if (vitals.fcp) push('perf', 'fcp', null, Math.round(vitals.fcp));
    if (vitals.cls || vitals.lcp) push('perf', 'cls', null, Math.round(vitals.cls * 1000));
    if (vitals.inp) push('perf', 'inp', null, Math.round(vitals.inp));
    if (nav?.responseStart) push('perf', 'ttfb', null, Math.round(nav.responseStart));
    if (nav?.loadEventEnd > 0) push('perf', 'load', null, Math.round(nav.loadEventEnd));
  }
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { sendPerf(); flush(); } });
  addEventListener('pagehide', () => { sendPerf(); flush(); });
})();
