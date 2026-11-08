// v9.3.0 : site de lancement (index.html) : langue FR/EN, bande-annonce, mondes, galerie des héros et compagnons
// (filtres, fiche au clic), familiers, boss, World Boss, compteur et paliers de préinscription (réglables par l'admin
// via /api/live, repli statique si l'API ne répond pas), formulaire, apparition au défilement.
import { SITE } from './config.js';
import { WORLDS, HEROES, ALLIES, PETS, WORLD_BOSS } from './data.js';
import { EN } from './i18n-en.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('js');

// ---------- Langue ----------
function pickLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'fr' || q === 'en') return q;
  try { const s = localStorage.getItem('asc-lang'); if (s === 'fr' || s === 'en') return s; } catch { /* stockage indisponible */ }
  return /^fr\b/i.test(navigator.language || 'fr') ? 'fr' : 'en';
}
let lang = pickLang();
const L = (pair) => (Array.isArray(pair) ? (lang === 'en' ? pair[1] || pair[0] : pair[0]) : pair ?? '');
const FR = {}; // textes français d'origine (relevés dans la page)
const t = (k, ...a) => { const v = lang === 'en' ? EN[k] ?? FR[k] ?? k : FR[k] ?? EN[k] ?? k; return typeof v === 'function' ? v(...a) : v; };
for (const el of $$('[data-i18n]')) FR[el.dataset.i18n] = el.textContent;
for (const el of $$('[data-i18n-attr]')) for (const pair of el.dataset.i18nAttr.split(';')) { const [attr, k] = pair.split(':'); FR[k] ??= el.getAttribute(attr); }
Object.assign(FR, {
  all: 'Tous', heroes: 'Héros', allies: 'Compagnons', paintings: 'Peintures',
  common: 'Commun', rare: 'Rare', epic: 'Épique', legendary: 'Légendaire',
  shown: (n) => `${n} illustration${n > 1 ? 's' : ''}`, kind_hero: 'Héros', kind_ally: 'Compagnon', kind_pet: 'Familier',
  role: 'Rôle', skill: 'Compétence', rarity: 'Rareté', type: 'Type', stages: 'Étapes', boss: 'Boss',
  pixel: 'Version pixel', painting: 'Version peinture', newPet: 'Nouveau',
  worldN: (i) => `Monde ${i}`, reached: '✓ Débloqué', left: (n) => `Encore ${n}`, at: (n) => `À ${n} préinscrits`,
  hintNext: (n, l) => `Encore ${n} aventuriers pour débloquer le palier ${l}.`, hintDone: 'Objectif atteint, merci à tous !',
  hintOff: 'Compteur indisponible pour le moment.', phase: (p) => `${p} % PV`,
  errEmail: 'Renseignez votre adresse email.', errConsent: 'Cochez la case de consentement pour vous préinscrire.',
  sending: 'Envoi…', errRate: 'Trop de tentatives, réessayez plus tard.', errInvalid: 'Adresse email invalide.',
  okSent: 'Merci ! Votre préinscription est enregistrée.', errNet: 'Connexion impossible, réessayez.', play: 'Lecture',
  docTitle: document.title, docDesc: $('meta[name="description"]').content,
});
const fmt = (n) => Number(n).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR');
const short = (n) => (n >= 1000 ? `${fmt(n / 1000)} K` : fmt(n));

function applyLang() {
  document.documentElement.lang = lang;
  for (const el of $$('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of $$('[data-i18n-attr]')) for (const pair of el.dataset.i18nAttr.split(';')) { const [attr, k] = pair.split(':'); el.setAttribute(attr, t(k)); }
  document.title = t('docTitle');
  $('meta[name="description"]').content = t('docDesc');
  const b = $('#lang');
  b.textContent = lang === 'en' ? 'FR' : 'EN';
  b.lang = lang === 'en' ? 'fr' : 'en';
  b.setAttribute('aria-label', lang === 'en' ? 'Version française' : 'English version');
  renderAll();
}
$('#lang').addEventListener('click', () => {
  lang = lang === 'en' ? 'fr' : 'en';
  try { localStorage.setItem('asc-lang', lang); } catch { /* stockage indisponible */ }
  const u = new URL(location.href); u.searchParams.set('lang', lang); history.replaceState(null, '', u);
  applyLang();
});

// ---------- Mondes ----------
function renderWorlds() {
  $('#worlds').innerHTML = WORLDS.map((w, i) => `<article class="card world reveal">
      <div class="shot"><img src="assets/worlds/${w.id}.webp" alt="${esc(L(w.name))}" loading="lazy" decoding="async" width="640" height="360"><span class="num">${i + 1}</span></div>
      <div class="txt"><h3>${esc(L(w.name))}</h3><p>${esc(L(w.intro))}</p>
      <span class="boss">☠ ${esc(L(w.boss))} · ${t('stages')} ${w.first}–${w.last}</span></div>
    </article>`).join('');
}

// ---------- Galerie ----------
const UNITS = [...HEROES, ...ALLIES];
const RANK = { legendary: 0, epic: 1, rare: 2, common: 3 };
const FILTERS = [
  ['all', (u) => true], ['hero', (u) => u.kind === 'hero'], ['ally', (u) => u.kind === 'ally'],
  ['legendary', (u) => u.rarity === 'legendary'], ['epic', (u) => u.rarity === 'epic'], ['rare', (u) => u.rarity === 'rare'],
  ['common', (u) => u.rarity === 'common'], ['real', (u) => Boolean(u.real)],
];
const FILTER_LABEL = { all: 'all', hero: 'heroes', ally: 'allies', legendary: 'legendary', epic: 'epic', rare: 'rare', common: 'common', real: 'paintings' };
let filter = 'all';
let shown = [];
const img = (u) => u.real && (!u.px || u.kind === 'hero') ? u.real : u.px || u.real;
function unitCard(u, i, extra = '') {
  return `<button type="button" class="card unit r-${u.rarity} reveal" data-i="${i}" data-set="${u.kind === 'pet' ? 'pets' : 'units'}" aria-haspopup="dialog">
      ${u.isNew ? `<span class="new">${esc(t('newPet'))}</span>` : ''}
      <span class="pic"><img src="${img(u)}" alt="" loading="lazy" decoding="async" class="${u.px && img(u) === u.px ? 'px' : ''}"></span>
      <span class="nm">${esc(L(u.name))}</span><span class="rar">${esc(t(u.rarity))}</span>${extra}
    </button>`;
}
function renderGallery() {
  $('#filters').innerHTML = FILTERS.map(([id, f]) => `<button type="button" class="chip" data-f="${id}" aria-pressed="${filter === id}">${esc(t(FILTER_LABEL[id]))}<i>${UNITS.filter(f).length}</i></button>`).join('');
  const f = FILTERS.find(([id]) => id === filter)[1];
  shown = UNITS.filter(f).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'hero' ? -1 : 1) || RANK[a.rarity] - RANK[b.rarity]);
  $('#gallery').innerHTML = shown.map((u, i) => unitCard(u, i)).join('');
  $('#gallery-count').textContent = t('shown', shown.length);
  observe($('#gallery'));
}
$('#filters').addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]');
  if (!b) return;
  filter = b.dataset.f;
  renderGallery();
  $(`#filters [data-f="${filter}"]`)?.focus();
});

function renderPets() {
  const pets = [...PETS].sort((a, b) => Number(b.isNew) - Number(a.isNew) || RANK[a.rarity] - RANK[b.rarity]);
  PETS_SHOWN = pets;
  $('#pets').innerHTML = pets.map((p, i) => unitCard(p, i, `<span class="sk">${esc(L(p.skill))}</span>`)).join('');
  observe($('#pets'));
}
let PETS_SHOWN = PETS;

// ---------- Fiche ----------
const sheet = $('#sheet');
let cur = { set: 'units', i: 0, style: null };
function openSheet(set, i) {
  const list = set === 'pets' ? PETS_SHOWN : shown;
  cur = { set, i: (i + list.length) % list.length, style: null };
  fillSheet();
  if (!sheet.open) sheet.showModal();
}
function fillSheet() {
  const list = cur.set === 'pets' ? PETS_SHOWN : shown;
  const u = list[cur.i];
  const src = cur.style === 'px' ? u.px : cur.style === 'real' ? u.real : img(u);
  sheet.className = `sheet r-${u.rarity}`;
  sheet.style.setProperty('--rc', `var(--${u.rarity})`);
  const im = $('#sheet-img');
  im.src = src; im.className = src === u.px ? 'px' : ''; im.alt = L(u.name);
  $('#sheet-rar').textContent = t(u.rarity);
  $('#sheet-name').textContent = L(u.name);
  $('#sheet-title').textContent = L(u.title) || (u.skill ? `${t('skill')} : ${L(u.skill)}` : '');
  $('#sheet-desc').textContent = L(u.desc);
  const rows = [[t('type'), t(`kind_${u.kind}`)], [t('rarity'), t(u.rarity)]];
  if (u.role) rows.push([t('role'), L(u.role)]);
  if (u.skill && u.title) rows.push([t('skill'), L(u.skill)]);
  $('#sheet-dl').innerHTML = rows.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('');
  const sw = $('#sheet-style');
  sw.hidden = !(u.px && u.real);
  sw.textContent = src === u.px ? t('painting') : t('pixel');
}
document.addEventListener('click', (e) => {
  const c = e.target.closest('.unit[data-i]');
  if (c) openSheet(c.dataset.set, Number(c.dataset.i));
});
$('#sheet-close').addEventListener('click', () => sheet.close());
sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });
$('#sheet-prev').addEventListener('click', () => openSheet(cur.set, cur.i - 1));
$('#sheet-next').addEventListener('click', () => openSheet(cur.set, cur.i + 1));
$('#sheet-style').addEventListener('click', () => {
  const u = (cur.set === 'pets' ? PETS_SHOWN : shown)[cur.i];
  cur.style = $('#sheet-img').getAttribute('src') === u.px ? 'real' : 'px';
  fillSheet();
});
sheet.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') openSheet(cur.set, cur.i - 1);
  if (e.key === 'ArrowRight') openSheet(cur.set, cur.i + 1);
});

// ---------- Boss ----------
function renderBosses() {
  $('#bosses').innerHTML = WORLDS.filter((w, i) => i < 11).map((w) => `<article class="card bcard reveal">
      <div class="sp">${w.bossImg ? `<img src="${w.bossImg}" alt="" class="px" loading="lazy" decoding="async">` : `<img src="assets/worlds/${w.id}.webp" alt="" class="shot" loading="lazy" decoding="async">`}</div>
      <h3>${esc(L(w.boss))}</h3><small>${esc(L(w.name))}</small>
    </article>`).join('');
  $('#phases').innerHTML = WORLD_BOSS.phases.map((p) => `<li><b>${Math.round(p.at * 100)} %</b><span>${esc(L(p.name))}</span></li>`).join('');
}

// ---------- Préinscriptions : objectif et paliers (réglables par l'admin) ----------
const FALLBACK = {
  goal: 100000,
  tiers: [
    { at: 10000, name: ['500 gemmes', '500 gems'], detail: ['Monnaie premium', 'Premium currency'], img: 'assets/shop/crystal_medium.webp' },
    { at: 20000, name: ['250 K or', '250K gold'], detail: ["Pièces d'or", 'Gold coins'], img: 'assets/icon_chest.png' },
    { at: 30000, name: ['1 familier', '1 pet'], detail: ['Slime doré', 'Golden Slime'], tag: ['Exclusif', 'Exclusive'], excl: true, img: 'assets/px/pet_golden_slime.webp' },
    { at: 40000, name: ['1 000 gemmes', '1,000 gems'], detail: ['Monnaie premium', 'Premium currency'], img: 'assets/shop/crystal_large.webp' },
    { at: 50000, name: ['1 compagnon', '1 companion'], detail: ['Lame rose', 'Rose Blade'], tag: ['SR · Exclusif', 'SR · Exclusive'], excl: true, img: 'assets/px/ally_rose_blade.webp' },
    { at: 60000, name: ['1 500 gemmes', '1,500 gems'], detail: ['+ 500 K or', '+ 500K gold'], img: 'assets/shop/crystal_premium.webp' },
    { at: 70000, name: ['1 héros SSR', '1 SSR hero'], detail: ['Lilith la Diablesse', 'Lilith the Demoness'], tag: ['SSR · Exclusif', 'SSR · Exclusive'], excl: true, img: 'assets/real/demoness.webp' },
    { at: 80000, name: ['10 tickets', '10 tickets'], detail: ["d'invocation", 'summon tickets'], img: 'assets/shop/hero_ticket_permanent.webp' },
    { at: 90000, name: ['1 héros SSR', '1 SSR hero'], detail: ['Roi Grombar', 'King Grombar'], tag: ['SSR · Exclusif', 'SSR · Exclusive'], excl: true, img: 'assets/real/grombar.webp' },
    { at: 100000, name: ['2 500 gemmes', '2,500 gems'], detail: ['+ 1 M or + 1 ticket SSR garanti', '+ 1M gold + 1 guaranteed SSR ticket'], tag: ['Méga pack', 'Mega pack'], excl: true, img: 'assets/shop/hero_ticket_limited.webp' },
  ],
};
let PREREG = FALLBACK;
let COUNT = null;

// Texte venant de l'API : chaîne, [fr, en] ou { fr, en }.
const txt = (v) => (v == null ? '' : typeof v === 'string' ? v : Array.isArray(v) ? L(v) : v[lang] ?? v.fr ?? v.en ?? '');
// Goals de l'API live-ops (site/live.js → GET /api/live/goals, réglés dans l'admin) : { target, count, tiers, texts }.
// Les textes de l'admin sont en français (chaîne) ; [fr, en] ou { fr, en } sont aussi acceptés.
export function normalizeGoals(g) {
  if (!g || g.offline || !Number.isFinite(Number(g.target)) || !Array.isArray(g.tiers)) return null;
  const tiers = g.tiers.map((x) => ({
    at: Number(x.at), label: x.label || '', name: x.name, detail: x.detail ?? '', tag: x.tag || null, excl: Boolean(x.excl),
    img: typeof x.img === 'string' && x.img ? x.img : 'assets/icon_chest.png',
  })).filter((x) => Number.isFinite(x.at) && x.at > 0).sort((a, b) => a.at - b.at);
  if (!tiers.length) return null;
  return { goal: Number(g.target) > 0 ? Number(g.target) : tiers[tiers.length - 1].at, tiers, texts: g.texts ?? null,
    count: Number.isFinite(Number(g.count)) && g.count != null ? Number(g.count) : null };
}
async function loadLive() {
  // Module de l'API live-ops (site/live.js) ; repli statique (FALLBACK) s'il est absent ou si l'API ne répond pas.
  try {
    const m = await import('./live.js');
    return normalizeGoals(await m.loadGoals(''));
  } catch { return null; }
}
const tierLabel = (at, label) => label || (at >= 1000 ? `${fmt(at / 1000)}K` : fmt(at));
function renderTiers() {
  const { tiers, goal } = PREREG;
  const c = COUNT ?? 0;
  const nextIndex = tiers.findIndex((x) => c < x.at);
  $('#tiers').innerHTML = tiers.map((x, i) => {
    const reached = COUNT != null && c >= x.at;
    const cls = reached ? 'reached' : i === nextIndex && COUNT != null ? 'next' : '';
    const st = reached ? t('reached') : cls === 'next' ? t('left', fmt(x.at - c)) : t('at', fmt(x.at));
    const tag = x.tag ? `<span class="tag ${x.excl ? 'excl' : ''}">${esc(txt(x.tag))}</span>` : '';
    return `<article class="card tier reveal ${cls}"><span class="ms">${esc(tierLabel(x.at, x.label))}</span>
      <div class="art"><img src="${esc(x.img)}" alt="" loading="lazy" decoding="async" class="${/\/(px|shop)\/|icon_/.test(x.img) ? 'px' : ''}"></div>
      <div class="nm">${esc(txt(x.name))}</div>${tag}<div class="dt">${esc(txt(x.detail))}</div><div class="st">${st}</div></article>`;
  }).join('');
  observe($('#tiers'));
  $('#goal-mid').textContent = short(goal / 2);
  $('#goal-max').textContent = short(goal);
  const bar = $('#goal-bar');
  bar.setAttribute('aria-valuemax', String(goal));
  bar.querySelectorAll('i').forEach((i) => i.remove());
  for (const x of tiers) if (x.at < goal) bar.insertAdjacentHTML('beforeend', `<i style="left:${(x.at / goal) * 100}%"></i>`);
  renderCount();
}
function renderCount() {
  const { tiers, goal } = PREREG;
  for (const el of $$('.js-count')) el.textContent = COUNT == null ? '—' : fmt(COUNT);
  const pct = COUNT == null ? 0 : Math.min(100, (COUNT / goal) * 100);
  for (const el of $$('.js-bar')) el.style.width = `${pct}%`;
  $('#goal-bar').setAttribute('aria-valuenow', String(COUNT ?? 0));
  const next = tiers.find((x) => (COUNT ?? 0) < x.at);
  const done = lang === 'fr' && PREREG.texts?.reached ? PREREG.texts.reached : t('hintDone');
  $('#hint').textContent = COUNT == null ? t('hintOff') : next ? t('hintNext', fmt(next.at - COUNT), tierLabel(next.at, next.label)) : done;
}
async function loadCount() {
  try {
    const res = await fetch('api/preregister/count', { cache: 'no-store' });
    const { count } = await res.json();
    if (PREREG.count == null) COUNT = Number(count) || 0;
  } catch { if (PREREG.count == null) COUNT = null; }
  renderTiers();
}

// ---------- Formulaire ----------
const form = $('#prereg');
const status = $('#status');
const fail = (m) => { status.className = 'status-line err'; status.textContent = m; };
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  status.className = 'status-line';
  const email = $('#email').value.trim();
  const consent = $('#consent').checked;
  if (!email) return fail(t('errEmail'));
  if (!consent) return fail(t('errConsent'));
  status.textContent = t('sending');
  try {
    const res = await fetch('api/preregister', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, consent }) });
    if (res.status === 429) return fail(t('errRate'));
    if (!res.ok) return fail(t('errInvalid'));
    form.reset();
    status.className = 'status-line ok';
    status.textContent = t('okSent');
    loadCount();
  } catch { fail(t('errNet')); }
  return undefined;
});

// ---------- Pied de page ----------
const ICONS = {
  discord: 'M20 4.5A18 18 0 0 0 15.6 3l-.6 1.2a16 16 0 0 0-6 0L8.4 3A18 18 0 0 0 4 4.5C1.3 8.6.5 12.6.9 16.5A18 18 0 0 0 6.3 19l1.2-1.9a11 11 0 0 1-1.8-.9l.4-.3a12.8 12.8 0 0 0 11.8 0l.4.3a11 11 0 0 1-1.8.9l1.2 1.9a18 18 0 0 0 5.4-2.5c.5-4.6-.8-8.6-3.1-12ZM8.7 14.2c-1 0-1.9-1-1.9-2.2s.8-2.2 1.9-2.2 1.9 1 1.9 2.2-.8 2.2-1.9 2.2Zm6.6 0c-1 0-1.9-1-1.9-2.2s.8-2.2 1.9-2.2 1.9 1 1.9 2.2-.8 2.2-1.9 2.2Z',
  x: 'M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z',
  youtube: 'M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.7 15V9l5.8 3-5.8 3Z',
  tiktok: 'M16.6 2h-3.4v13.4a2.9 2.9 0 1 1-2-2.8V9.1a6.3 6.3 0 1 0 5.4 6.3V8.6a8 8 0 0 0 4.6 1.5V6.7a4.6 4.6 0 0 1-4.6-4.7Z',
};
const NAMES = { discord: 'Discord', x: 'X', youtube: 'YouTube', tiktok: 'TikTok' };
function renderSocials() {
  const s = SITE.socials ?? {};
  $('#socials').innerHTML = Object.entries(NAMES).filter(([k]) => s[k]).map(([k, n]) => `<a href="${esc(s[k])}" rel="noopener" target="_blank"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[k]}"/></svg>${n}</a>`).join('');
}

// ---------- Apparition au défilement ----------
const io = !calm && 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) : null;
function observe(root = document) {
  for (const el of $$('.reveal:not(.in)', root)) { if (io) io.observe(el); else el.classList.add('in'); }
}

// ---------- Barre de navigation ----------
const nav = $('#nav');
const onScroll = () => nav.classList.toggle('solid', scrollY > 40);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------- Bande-annonce : chargée après la page (le poster s'affiche d'abord), jamais si « réduire les animations »
// ou « économiser les données » ; bouton Pause/Lecture. ----------
function startReel() {
  const v = $('#reel');
  const saveData = navigator.connection?.saveData;
  if (calm || saveData) return;
  v.innerHTML = '<source src="assets/trailer.webm" type="video/webm"><source src="assets/trailer.mp4" type="video/mp4">';
  v.preload = 'auto';
  v.addEventListener('playing', () => v.classList.add('on'), { once: true });
  v.load();
  v.play().catch(() => {});
  const b = $('#reel-toggle');
  b.hidden = false;
  b.addEventListener('click', () => {
    if (v.paused) { v.play(); b.dataset.i18n = 'pause'; } else { v.pause(); b.dataset.i18n = 'play'; }
    b.textContent = t(b.dataset.i18n);
  });
}
const later = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 1200));
if (document.readyState === 'complete') later(startReel); else addEventListener('load', () => later(startReel), { once: true });

// ---------- Démarrage ----------
function renderAll() {
  renderWorlds(); renderGallery(); renderPets(); renderBosses(); renderTiers(); renderSocials();
  if (sheet.open) fillSheet();
  observe();
}
$('#site-name').textContent = SITE.name;
$('#year').textContent = String(new Date().getFullYear());
applyLang();
loadCount();
loadLive().then((cfg) => {
  if (!cfg) return;
  PREREG = cfg;
  if (cfg.count != null) COUNT = cfg.count; // compteur affiché choisi dans l'admin (réel ou réglé)
  renderTiers();
});
