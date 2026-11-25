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
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* privé */ } },
  ss: (k) => { try { return sessionStorage.getItem(k) || undefined; } catch { return undefined; } } };

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
  // Pages annexes (confidentialité, classement) dans la même langue.
  for (const a of $$('a[href^="confidentialite.html"], a[href^="classement/"]')) a.href = `${a.getAttribute('href').split('?')[0]}?lang=${code}`;
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
  canon.href = code === "en" ? "https://ascendrya.com/" : `https://ascendrya.com/?lang=${code}`; // une seule adresse (sans www) pour les moteurs
  $('#langs').innerHTML = LANGS.map((l) => `<button type="button" lang="${l.code}" data-lang="${l.code}" aria-pressed="${l.code === code}" title="${esc(l.name)}">${l.label}</button>`).join('');
  $('#reel-toggle').setAttribute('aria-label', t(reelPaused ? 'hero.play' : 'hero.pause'));
  renderGoal();
  renderSocials();
  renderInvite();
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
  const base = tr ? { name: tr[0], detail: tr[1], tag } : { name: x.name, detail: x.detail ?? '', tag };
  // Textes anglais saisis dans l'admin (site dans une autre langue que le français).
  if (lang !== 'fr') {
    if (x.name_en) base.name = x.name_en;
    if (x.detail_en) base.detail = x.detail_en;
    if (x.tag_en) base.tag = x.tag_en;
  }
  return base;
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
  const goal = next ? next.at : target; // 10.8 : le compteur vise toujours le prochain palier
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
    $('#bonus-lead').textContent = reached ? t('goal.bonusOpen') : GOALS.revealBonus ? t('goal.bonusShown') : t('goal.bonusLead');
    $('#bonus-tiers').style.setProperty('--cols', String(bonus.length));
    $('#bonus-tiers').innerHTML = bonus.map((x) => tierCard(x, state(x), !reached && !GOALS.revealBonus)).join('');
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
        GOALS = { target: Number(g.target), revealBonus: g.revealBonus === true, tiers: [...g.tiers].sort((a, b) => a.at - b.at), count: Number.isFinite(Number(g.count)) && g.count != null ? Number(g.count) : null };
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
    const res = await fetch('api/preregister', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, consent, ref: store.ss('ascendrya-ref'), utm: store.ss('ascendrya-utm'), lang }) });
    if (res.status === 429) return say('form.errRate');
    if (!res.ok) return say('form.errInvalid');
    const data = await res.json().catch(() => ({}));
    form.reset();
    say('form.ok', true);
    if (data.ref) store.set('ascendrya-myref', data.ref);
    showThanks(data.ref);
    renderInvite();
    document.body.classList.add('registered'); // la barre flottante ne passe plus par-dessus l'encadré (téléphone)
    loadGoals();
  } catch { say('form.errNet'); } finally { btn.disabled = false; }
  return undefined;
});

// ---------- 10.8 : lien de parrainage (?ref=) et provenance (utm_source), gardés pour la session ----------
{
  const qs = new URLSearchParams(location.search);
  const keep = (k, v, re) => { try { if (v && re.test(v)) sessionStorage.setItem(k, v); } catch { /* stockage bloqué */ } };
  keep('ascendrya-ref', (qs.get('ref') ?? '').toUpperCase(), /^[A-HJ-NP-Z2-9]{5,6}$/);
  keep('ascendrya-utm', qs.get('utm_source') ?? '', /^[\w.-]{1,40}$/);
  // Confirmation de l'email : ?confirm=<jeton> (lien de l'email).
  // Liens de l'email : ?confirm=<jeton> (confirmer l'adresse) et ?unsubscribe=<jeton> (se désinscrire).
  const notice = (key, ok) => {
    const el = document.createElement('div');
    el.className = `mail-notice ${ok ? 'ok' : 'err'}`; el.setAttribute('role', 'status');
    el.innerHTML = `<span></span><button type="button" aria-label="OK">✕</button>`;
    const sp = el.querySelector('span'); let n = 0; const fill = () => { sp.textContent = t(key); if (sp.textContent === key && n++ < 40) setTimeout(fill, 100); }; fill();
    el.querySelector('button').addEventListener('click', () => el.remove());
    document.body.appendChild(el);
    const u = new URL(location.href); u.searchParams.delete('confirm'); u.searchParams.delete('unsubscribe'); history.replaceState(null, '', u);
  };
  const tok = qs.get('confirm');
  if (tok) fetch(`api/preregister/confirm?token=${encodeURIComponent(tok)}`).then((r) => r.json()).then((d) => notice(d.ok ? 'mail.confirmed' : 'mail.invalid', d.ok)).catch(() => notice('mail.invalid', false));
  const un = qs.get('unsubscribe');
  if (un) fetch('api/preregister/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: un }) })
    .then((r) => r.json()).then((d) => notice(d.ok ? 'mail.unsubscribed' : 'mail.invalid', d.ok)).catch(() => notice('mail.invalid', false));
}
// ---------- Pixels Meta et TikTok (seulement si un identifiant est réglé dans config.js) ----------
{
  const px = SITE.pixels ?? {};
  if (px.meta) {
    /* eslint-disable */ !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', px.meta); window.fbq('track', 'PageView');
  }
  if (px.tiktok) {
    const s = document.createElement('script'); s.async = true;
    s.src = `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(px.tiktok)}&lib=ttq`;
    document.head.appendChild(s);
  }
}

// ---------- 10.8 : parrainage, affiché après l'inscription ----------
function showThanks(ref) {
  const box = $('#thanks'); if (!box) return;
  if (!ref) return;
  const link = `https://${SITE.domain}/?ref=${encodeURIComponent(ref)}`;
  const steps = t('ref.steps').map(([n, r]) => `<li><b>${n}</b><span>${r}</span></li>`).join('');
  box.innerHTML = `<h3>${t('ref.title')}</h3><p>${t('ref.lead')}</p>
    <div class="ref-link"><input id="ref-url" readonly value="${link}"><button type="button" class="btn" id="ref-copy">${t('ref.copy')}</button></div>
    <div class="ref-share"><a class="btn small" target="_blank" rel="noopener" href="https://x.com/intent/post?text=${encodeURIComponent(t('ref.share') + ' ' + link)}">X</a><a class="btn small" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(t('ref.share') + ' ' + link)}">WhatsApp</a></div>
    <ol class="ref-steps">${steps}</ol><p class="muted" id="ref-count">${t('ref.count', 0)}</p>${followHtml()}`;
  box.hidden = false;
  fetch(`api/preregister/ref/${encodeURIComponent(ref)}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d && Number.isFinite(d.count)) $('#ref-count').textContent = t('ref.count', d.count); }).catch(() => {});
  $('#ref-copy').addEventListener('click', () => { navigator.clipboard?.writeText(link).catch(() => {}); $('#ref-url').select(); });
}

// ---------- 10.8.3 : section Parrainage, visible avant l'inscription ----------
// Paliers de parrainage (mêmes que ref.steps) : nombre d'amis et image.
const REF_STEPS = [[1, 'assets/icon_gem.png'], [3, 'assets/shop/hero_ticket_permanent.webp'], [5, 'assets/shop/theme_legendary.webp'], [10, 'assets/shop/hero_ticket_limited.webp'], [25, 'assets/px/pet_kitsune.webp']];
let refCount = null; // filleuls confirmés du visiteur (lien gardé sur cet appareil après l'inscription)
function renderInvite() {
  const box = $('#invite-box'); if (!box) return;
  const mine = store.get('ascendrya-myref');
  const from = store.ss('ascendrya-ref');
  const names = t('ref.steps');
  const n = refCount ?? 0;
  const nextI = REF_STEPS.findIndex(([k]) => n < k);
  const track = REF_STEPS.map(([k, img], i) => {
    const cls = mine && n >= k ? 'got' : mine && i === nextI ? 'next' : i === REF_STEPS.length - 1 ? 'top' : '';
    return `<li class="rw ${cls}"><div class="ic"><img class="px" src="${img}" alt="" loading="lazy" decoding="async"></div><span class="n">${esc(names[i]?.[0] ?? k)}</span><span class="r">${esc(names[i]?.[1] ?? '')}</span></li>`;
  }).join('');
  const steps = t('invite.steps').map(([a, b]) => `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join('');
  let act;
  if (mine) {
    const link = `https://${SITE.domain}/?ref=${encodeURIComponent(mine)}`;
    const msg = encodeURIComponent(`${t('ref.share')} ${link}`);
    const left = nextI < 0 ? t('invite.all') : t('invite.left', REF_STEPS[nextI][0] - n, names[nextI]?.[1] ?? '');
    act = `<div class="mine"><b>${esc(t('invite.mine'))}</b>
      <div class="ref-link"><input id="inv-url" readonly value="${esc(link)}" aria-label="${esc(t('invite.mine'))}"><button type="button" class="btn" id="inv-copy">${esc(t('ref.copy'))}</button></div>
      <div class="ref-share"><a class="btn" target="_blank" rel="noopener" href="https://x.com/intent/post?text=${msg}">X</a><a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${msg}">WhatsApp</a>${navigator.share ? `<button type="button" class="btn" id="inv-share">${esc(t('invite.share'))}</button>` : ''}</div>
      <p class="count">${esc(t('ref.count', n))}</p><p>${esc(left)}</p></div>`;
  } else {
    act = `<a class="btn big" href="#join">${esc(t('invite.cta'))}</a><p>${esc(t('invite.ctaNote'))}</p>`;
  }
  box.innerHTML = `${from && !mine ? `<p class="inv-from">🎁 ${esc(t('invite.from'))}</p>` : ''}
    <ol class="inv-steps">${steps}</ol>
    <ol class="inv-track">${track}</ol>
    <div class="inv-act">${act}</div>
    <p class="inv-fine">${esc(t('invite.fine'))}</p>`;
  const ff = $('#from-friend'); if (ff) { ff.hidden = !(from && !mine); ff.textContent = `🎁 ${t('invite.from')}`; }
  if (mine) {
    const link = $('#inv-url').value;
    $('#inv-copy').addEventListener('click', () => { navigator.clipboard?.writeText(link).catch(() => {}); $('#inv-url').select(); });
    $('#inv-share')?.addEventListener('click', () => navigator.share({ title: 'Ascendrya', text: t('ref.share'), url: link }).catch(() => {}));
    if (refCount === null) {
      refCount = 0;
      fetch(`api/preregister/ref/${encodeURIComponent(mine)}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d && Number.isFinite(d.count)) { refCount = d.count; renderInvite(); } }).catch(() => {});
    }
  }
}

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
// Encadré de parrainage : les mêmes boutons que « Suivez-nous ».
function followHtml() {
  const s = SITE.socials ?? {};
  const links = Object.keys(ICONS).filter((k) => s[k]);
  return links.length ? `<p class="follow">${t('ref.follow')}</p><div class="socials">${links.map((k) => `<a href="${esc(s[k])}" rel="noopener" target="_blank"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[k]}"/></svg>${NAMES[k]}</a>`).join('')}</div>` : '';
}
function renderSocials() {
  const s = SITE.socials ?? {};
  const links = Object.keys(NAMES).filter((k) => realLink(s[k]));
  $('#socials').innerHTML = links.map((k) => `<a href="${esc(s[k])}" rel="noopener" target="_blank"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[k]}"/></svg>${NAMES[k]}</a>`).join('');
  $('.follow').hidden = !links.length;
}

// ---------- Vidéo d'accueil : boucle muette lancée après la page ; image de couverture si « réduire les animations »,
// « économiser les données » ou lecture automatique bloquée. ----------
let reelPaused = false;
// Vidéo choisie dans l'admin (sinon la vidéo d'origine) : { mp4, webm, phone, poster, version }.
const REEL_DEFAULT = { mp4: 'assets/trailer.mp4', webm: 'assets/trailer.webm', phone: 'assets/trailer-phone.mp4', poster: 'assets/trailer-poster.webp' };
// ?v=<empreinte> au bout de chaque adresse : un téléphone ne garde jamais une ancienne vidéo en cache.
function reelUrl(path, version) {
  if (!path || !version) return path;
  const [base, query = ''] = String(path).split('?');
  return `${base}?${[...query.split('&').filter((x) => x && !x.startsWith('v=')), `v=${encodeURIComponent(version)}`].join('&')}`;
}
const reelConfig = fetch('api/site/video', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : REEL_DEFAULT)).catch(() => REEL_DEFAULT).then((c) => {
  const v = c.version;
  c = { mp4: reelUrl(c.mp4, v), webm: reelUrl(c.webm, v), phone: reelUrl(c.phone, v), poster: reelUrl(c.poster, v), custom: c.poster !== REEL_DEFAULT.poster };
  // Une vidéo envoyée depuis l'admin : son image d'aperçu, ou aucune (jamais l'image de l'ancienne vidéo).
  if (c.custom || v) {
    const el = $('#reel'), m = $('.hero .media');
    if (c.poster) el.poster = c.poster; else el.removeAttribute('poster');
    if (m) m.style.backgroundImage = c.poster ? `url("${c.poster}")` : 'none';
  }
  return c;
});
async function startReel() {
  const v = $('#reel');
  if (calm || navigator.connection?.saveData) return;
  const small = matchMedia('(max-width: 720px)').matches;
  const c = await reelConfig;
  // Téléphone : la version légère (540 px) si elle existe — la vidéo d'origine, trop lourde, saccade.
  v.innerHTML = small && c.phone ? `<source src="${esc(c.phone)}" type="video/mp4">`
    : `${c.webm ? `<source src="${esc(c.webm)}" type="video/webm">` : ''}${c.mp4 ? `<source src="${esc(c.mp4)}" type="video/mp4">` : ''}`;
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
