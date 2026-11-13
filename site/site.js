// Ascendrya — landing page de préinscription (v9.3.1).
// Textes : site/i18n/<langue>.js (EN par défaut, FR ; JA/KO/ZH prévus dans site/i18n/index.js), choisis par ?lang=xx,
// sinon le dernier choix du visiteur (localStorage), sinon la langue du navigateur, sinon l'anglais.
// Compteur et paliers : GET /api/live/goals (réglés dans l'admin), repli sur le compteur réel GET /api/preregister/count.
// Formulaire : POST /api/preregister (inchangé). Aucun chiffre ni inscription simulés.
import { SITE } from './config.js';
import { DEFAULT_LANG, LANGS, loadLang } from './i18n/index.js';
import { DEFAULT_GOALS } from './live.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* privé */ } } };

// ---------- Langues ----------
let lang = DEFAULT_LANG;
let T = {};
let EN = {};
const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
export const t = (path, ...a) => { const v = get(T, path) ?? get(EN, path) ?? path; return typeof v === 'function' ? v(...a) : v; };
function pickLang() {
  const ok = (c) => LANGS.some((l) => l.code === c);
  const q = new URLSearchParams(location.search).get('lang');
  if (ok(q)) return q;
  const saved = store.get('ascendrya-lang');
  if (ok(saved)) return saved;
  const nav = (navigator.languages ?? [navigator.language]).map((x) => String(x).slice(0, 2).toLowerCase()).find(ok);
  return nav ?? DEFAULT_LANG;
}
const fmt = (n) => Number(n).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
const short = (n) => (n >= 1000 ? `${fmt(n / 1000)}K` : fmt(n));

async function setLang(code, push = false) {
  lang = code;
  [EN, T] = await Promise.all([loadLang('en'), code === 'en' ? null : loadLang(code)]);
  T ??= EN;
  store.set('ascendrya-lang', code);
  if (push) { const u = new URL(location.href); u.searchParams.set('lang', code); history.replaceState(null, '', u); }
  document.documentElement.lang = code;
  for (const el of $$('[data-t]')) el.textContent = t(el.dataset.t);
  for (const el of $$('[data-t-attr]')) for (const pair of el.dataset.tAttr.split(';')) { const [attr, k] = pair.split(':'); el.setAttribute(attr, t(k)); }
  // Référencement : titre, description, aperçus de partage et lien canonique de la langue.
  document.title = t('meta.title');
  $('meta[name="description"]').content = t('meta.desc');
  for (const s of ['og:title', 'twitter:title']) $(`meta[property="${s}"], meta[name="${s}"]`).content = t('meta.ogTitle');
  for (const s of ['og:description', 'twitter:description']) $(`meta[property="${s}"], meta[name="${s}"]`).content = t('hero.pitch');
  $('meta[property="og:locale"]').content = t('meta.locale');
  let canon = $('link[rel="canonical"]');
  if (!canon) { canon = document.createElement('link'); canon.rel = 'canonical'; document.head.appendChild(canon); }
  canon.href = `${location.origin}${location.pathname}?lang=${code}`;
  $('#langs').innerHTML = LANGS.map((l) => `<button type="button" lang="${l.code}" data-lang="${l.code}" aria-pressed="${l.code === code}" title="${esc(l.name)}">${l.label}</button>`).join('');
  $('#reel-toggle').setAttribute('aria-label', t(reelPaused ? 'hero.play' : 'hero.pause'));
  renderGoal();
  renderSocials();
}
$('#langs').addEventListener('click', (e) => { const b = e.target.closest('[data-lang]'); if (b && b.dataset.lang !== lang) setLang(b.dataset.lang, true); });

// ---------- Objectif communautaire ----------
let GOALS = { ...DEFAULT_GOALS, count: null };
// Palier par défaut (même seuil et même nom que le serveur) : texte traduit et libellé au format de la langue.
const defTier = (x) => DEFAULT_GOALS.tiers.find((d) => d.at === x.at && d.name === x.name);
// Texte d'un palier : traduction du palier par défaut, sinon le texte de l'admin.
function tierText(x) {
  const tr = defTier(x) && get(T, `tiers.${x.at}`);
  const tag = x.tag ? (get(T, `tiers.tags.${x.tag}`) || x.tag) : '';
  return tr ? { name: tr[0], detail: tr[1], tag } : { name: x.name, detail: x.detail ?? '', tag };
}
// Carte d'un palier. Palier bonus pas encore révélé (objectif non atteint) : récompense mystère.
function tierCard(x, st, secret) {
  const label = st === 'reached' ? `✓ ${t('goal.unlocked')}` : st === 'next' ? t('goal.nextTag') : `🔒 ${t('goal.locked')}`;
  if (secret) {
    return `<article class="tier locked secret"><span class="ms">${esc(x0(x))}</span>
      <div class="mystery" aria-hidden="true">?</div>
      <div class="nm">${esc(t('goal.secret'))}</div><span class="tag">${esc(t('goal.bonusTag'))}</span><div class="dt">${esc(t('goal.secretDetail', x0({ at: GOALS.target })))}</div><div class="st">${label}</div></article>`;
  }
  const tx = tierText(x);
  return `<article class="tier ${st}${x.at > GOALS.target ? ' bonus' : ''}"><span class="ms">${esc(x0(x))}</span>
      <img src="${esc(x.img || 'assets/icon_chest.png')}" alt="" loading="lazy" decoding="async" class="${/icon_|\/px\//.test(x.img) ? 'px' : ''}">
      <div class="nm">${esc(tx.name)}</div>${tx.tag ? `<span class="tag">${esc(tx.tag)}</span>` : ''}<div class="dt">${esc(tx.detail)}</div><div class="st">${label}</div></article>`;
}
function renderGoal() {
  const { tiers, target } = GOALS;
  const count = GOALS.count;
  const known = Number.isFinite(count);
  const c = known ? count : 0;
  const reached = known && c >= target;
  const next = tiers.find((x) => c < x.at);
  // Objectif atteint et paliers bonus restants : la barre et le compteur visent le palier bonus suivant.
  const goal = reached && next ? next.at : target;
  $('#count').textContent = known ? fmt(c) : '—';
  $('#count-of').textContent = t('goal.of', fmt(goal));
  $('#goal-fill').style.width = `${known ? Math.min(100, (c / goal) * 100) : 0}%`;
  const bar = $('#goal-bar');
  bar.setAttribute('aria-valuemax', String(goal));
  bar.setAttribute('aria-valuenow', String(c));
  bar.querySelectorAll('i').forEach((i) => i.remove());
  for (const x of tiers) if (x.at < goal) bar.insertAdjacentHTML('beforeend', `<i style="left:${(x.at / goal) * 100}%"></i>`);
  $('#goal-next').textContent = !known ? t('goal.offline') : next ? t('goal.next', fmt(next.at - c), x0(next)) : t('goal.done');
  const state = (x) => (known && c >= x.at ? 'reached' : known && x === next ? 'next' : 'locked');
  const main = tiers.filter((x) => x.at <= target);
  const bonus = tiers.filter((x) => x.at > target);
  const grid = $('#tiers');
  grid.style.setProperty('--cols', String(main.length > 5 ? Math.ceil(main.length / 2) : Math.max(1, main.length)));
  grid.innerHTML = main.map((x) => tierCard(x, state(x), false)).join('');
  const wrap = $('#bonus');
  wrap.hidden = !bonus.length;
  if (bonus.length) {
    $('#bonus-title').textContent = t('goal.bonusTitle', x0({ at: target }));
    $('#bonus-lead').textContent = reached ? t('goal.bonusOpen') : t('goal.bonusLead');
    $('#bonus-tiers').style.setProperty('--cols', String(bonus.length));
    $('#bonus-tiers').innerHTML = bonus.map((x) => tierCard(x, state(x), !reached)).join('');
  }
}
// Libellé du seuil : format de la langue pour les paliers par défaut (2,5K / 2.5K), sinon celui de l'admin.
const x0 = (x) => (!x.name || defTier(x) ? short(x.at) : x.label || short(x.at));
async function loadGoals() {
  // Goals de l'admin (et compteur affiché) ; en cas d'échec, compteur réel seul ; sinon « indisponible » (jamais inventé).
  try {
    const res = await fetch('api/live/goals', { cache: 'no-store' });
    if (res.ok) {
      const g = await res.json();
      if (Number.isFinite(Number(g.target)) && Array.isArray(g.tiers) && g.tiers.length) {
        GOALS = { target: Number(g.target), tiers: [...g.tiers].sort((a, b) => a.at - b.at), count: Number.isFinite(Number(g.count)) && g.count != null ? Number(g.count) : null };
      }
    }
  } catch { /* hors ligne */ }
  if (GOALS.count == null) {
    try {
      const res = await fetch('api/preregister/count', { cache: 'no-store' });
      if (res.ok) { const { count } = await res.json(); if (Number.isFinite(Number(count))) GOALS.count = Number(count); }
    } catch { /* hors ligne */ }
  }
  renderGoal();
}

// ---------- Formulaire (aucune réussite simulée : seul un 2xx du serveur confirme) ----------
const form = $('#prereg');
const status = $('#status');
const say = (key, ok = false) => { status.className = `status ${ok ? 'ok' : 'err'}`; status.textContent = t(key); };
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = $('#email').value.trim();
  const consent = $('#consent').checked;
  if (!email) return say('form.errEmail');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say('form.errInvalid');
  if (!consent) return say('form.errConsent');
  status.className = 'status';
  status.textContent = t('form.sending');
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    const res = await fetch('api/preregister', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, consent }) });
    if (res.status === 429) return say('form.errRate');
    if (!res.ok) return say('form.errInvalid');
    form.reset();
    say('form.ok', true);
    loadGoals();
  } catch { say('form.errNet'); } finally { btn.disabled = false; }
  return undefined;
});

// ---------- Réseaux ----------
const ICONS = {
  x: 'M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z',
  tiktok: 'M16.6 2h-3.4v13.4a2.9 2.9 0 1 1-2-2.8V9.1a6.3 6.3 0 1 0 5.4 6.3V8.6a8 8 0 0 0 4.6 1.5V6.7a4.6 4.6 0 0 1-4.6-4.7Z',
  discord: 'M20 4.5A18 18 0 0 0 15.6 3l-.6 1.2a16 16 0 0 0-6 0L8.4 3A18 18 0 0 0 4 4.5C1.3 8.6.5 12.6.9 16.5A18 18 0 0 0 6.3 19l1.2-1.9a11 11 0 0 1-1.8-.9l.4-.3a12.8 12.8 0 0 0 11.8 0l.4.3a11 11 0 0 1-1.8.9l1.2 1.9a18 18 0 0 0 5.4-2.5c.5-4.6-.8-8.6-3.1-12ZM8.7 14.2c-1 0-1.9-1-1.9-2.2s.8-2.2 1.9-2.2 1.9 1 1.9 2.2-.8 2.2-1.9 2.2Zm6.6 0c-1 0-1.9-1-1.9-2.2s.8-2.2 1.9-2.2 1.9 1 1.9 2.2-.8 2.2-1.9 2.2Z',
  youtube: 'M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.7 15V9l5.8 3-5.8 3Z',
};
const NAMES = { x: 'X', tiktok: 'TikTok', discord: 'Discord', youtube: 'YouTube' };
// Un lien encore factice (« TON-… ») ou vide n'est pas affiché.
const realLink = (u) => typeof u === 'string' && /^https:\/\//.test(u) && !/TON-/.test(u);
function renderSocials() {
  const s = SITE.socials ?? {};
  const links = Object.keys(NAMES).filter((k) => realLink(s[k]));
  $('#socials').innerHTML = links.map((k) => `<a href="${esc(s[k])}" rel="noopener" target="_blank"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[k]}"/></svg>${NAMES[k]}</a>`).join('');
  $('.follow').hidden = !links.length;
}

// ---------- Vidéo d'accueil : boucle muette lancée après la page ; image de couverture si « réduire les animations »,
// « économiser les données » ou lecture automatique bloquée. ----------
let reelPaused = false;
function startReel() {
  const v = $('#reel');
  if (calm || navigator.connection?.saveData) return;
  const small = matchMedia('(max-width: 720px)').matches;
  v.innerHTML = `<source src="assets/trailer.webm" type="video/webm"><source src="assets/trailer.mp4" type="video/mp4">`;
  v.preload = small ? 'metadata' : 'auto';
  v.addEventListener('playing', () => { v.classList.add('on'); $('#reel-toggle').hidden = false; }, { once: true });
  v.load();
  v.play().catch(() => { /* lecture automatique bloquée : l'image de couverture reste affichée */ });
}
$('#reel-toggle').addEventListener('click', () => {
  const v = $('#reel');
  reelPaused = !v.paused;
  if (reelPaused) v.pause(); else v.play().catch(() => {});
  const b = $('#reel-toggle');
  b.textContent = reelPaused ? '▶' : '❚❚';
  b.setAttribute('aria-label', t(reelPaused ? 'hero.play' : 'hero.pause'));
});

// ---------- Menu, bouton fixe (mobile), apparition au défilement ----------
const nav = $('#nav');
const sticky = $('#sticky');
const onScroll = () => {
  nav.classList.toggle('solid', scrollY > 40);
  const join = $('#join').getBoundingClientRect();
  sticky.classList.toggle('on', scrollY > innerHeight * 0.7 && join.top > innerHeight);
};
addEventListener('scroll', onScroll, { passive: true });
onScroll();
const io = !calm && 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) : null;
for (const el of $$('.reveal')) { if (io) io.observe(el); else el.classList.add('in'); }

// ---------- Démarrage ----------
$('#year').textContent = String(new Date().getFullYear());
await setLang(pickLang());
loadGoals();
const later = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 800));
if (document.readyState === 'complete') later(startReel); else addEventListener('load', () => later(startReel), { once: true });
