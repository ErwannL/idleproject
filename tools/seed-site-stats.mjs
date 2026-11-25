// Données de démonstration pour l'onglet « Site » de l'admin (mesure d'audience).
// Usage : node tools/seed-site-stats.mjs [fichier.sqlite] [--days=45] [--reset] [--seed=7]
// Remplit une base LOCALE avec du trafic réaliste (X, YouTube Shorts, TikTok, Steam, Play Store, Reddit, Discord, recherche,
// direct), des préinscriptions rattachées à leur source, des confirmations et des chaînes de parrainage, en passant par le
// vrai code de collecte (server/sitestats.mjs) : le tableau de bord montre donc exactement ce que verrait la production.
// Les e-mails sont fictifs (…@example.invalid). Ne jamais lancer sur la base de production.
import { resolve } from 'node:path';
import { openDatabase } from '../server/db.mjs';
import { createSiteStats } from '../server/sitestats.mjs';
import { newRefCode, maskEmail } from '../server/app.mjs';

const args = process.argv.slice(2);
const file = resolve(args.find((a) => !a.startsWith('--')) ?? 'data/site-demo.sqlite');
const opt = (name, def) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? Number(a.split('=')[1]) : def; };
const DAYS = opt('days', 45);
const DAY = 86400000;
let seed = opt('seed', 7) >>> 0;
const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (list) => list[Math.floor(rnd() * list.length)];
const weighted = (items) => { const total = items.reduce((s, [, w]) => s + w, 0); let r = rnd() * total; for (const [v, w] of items) { r -= w; if (r <= 0) return v; } return items[0][0]; };
const chance = (p) => rnd() < p;
const rid = (n = 12) => Array.from({ length: n }, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'[Math.floor(rnd() * 64)]).join('');
const ip = () => `${10 + Math.floor(rnd() * 200)}.${Math.floor(rnd() * 256)}.${Math.floor(rnd() * 256)}.${1 + Math.floor(rnd() * 254)}`;

const db = openDatabase(file);
if (args.includes('--reset')) {
  for (const t of ['site_events', 'site_sessions', 'site_bots', 'site_daily', 'site_campaigns', 'site_salt']) db.exec(`DELETE FROM ${t}`);
  db.exec("DELETE FROM preregistrations WHERE email LIKE '%@example.invalid'");
}
const end = Date.now();
let clock = end - DAYS * DAY;
const stats = createSiteStats({ db, now: () => clock, maskEmail, log: () => {} });

// Campagnes enregistrées dans le générateur
const CAMPAIGNS = [
  ['X : tweet épinglé', 'x', 'x', 'social', 'lancement-nov', 'epingle'], ['X : thread des héros', 'x', 'x', 'social', 'lancement-nov', 'thread-heros'],
  ['Short #1 (boss géant)', 'youtube_shorts', 'youtube', 'shorts', 'shorts-nov', 'short-01'], ['Short #2 (invocation)', 'youtube_shorts', 'youtube', 'shorts', 'shorts-nov', 'short-02'],
  ['Short #3 (donjon)', 'youtube_shorts', 'youtube', 'shorts', 'shorts-nov', 'short-03'], ['TikTok : trailer', 'tiktok', 'tiktok', 'social', 'tiktok-nov', 'trailer'],
  ['TikTok : astuces', 'tiktok', 'tiktok', 'social', 'tiktok-nov', 'astuces'], ['Page Steam', 'steam', 'steam', 'store', 'wishlist', 'page-steam'],
  ['Fiche Google Play', 'play_store', 'google_play', 'store', 'precommande-android', 'fiche'], ['Serveur Discord', 'discord', 'discord', 'community', 'annonce-nov', 'general'],
  ['Reddit r/incremental_games', 'reddit', 'reddit', 'social', 'reddit-nov', 'incremental'],
];
for (const [name, preset, source, medium, campaign, content] of CAMPAIGNS) stats.campaigns.create({ name, preset, source, medium, campaign, content });
const bySource = new Map(CAMPAIGNS.map((c) => [c[1], []]));
for (const c of CAMPAIGNS) bySource.get(c[1]).push(c);

const UAS = {
  mobile: ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36'],
  tiktokApp: ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_33.1.0 BytedanceWebview/d8a21c6'],
  tablet: ['Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'],
  desktop: ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'],
};
const BOTS = ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0)', 'python-requests/2.31.0', 'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/126.0.0.0 Safari/537.36'];
const LANGS = [['fr', 52], ['en', 36], ['ko', 5], ['ja', 4], ['zh', 3]];
const COUNTRIES = { fr: [['FR', 78], ['BE', 8], ['CA', 6], ['CH', 5], ['LU', 1], ['MA', 2]], en: [['US', 42], ['GB', 18], ['CA', 10], ['AU', 8], ['DE', 8], ['IN', 6], ['NL', 4], ['BR', 4]], ko: [['KR', 100]], ja: [['JP', 100]], zh: [['TW', 55], ['SG', 25], ['MY', 20]] };
const WIDTHS = { mobile: [360, 375, 390, 393, 412, 430], tablet: [768, 810, 820, 1024], desktop: [1280, 1366, 1440, 1536, 1920, 2560] };

// Poids de canal par jour : base + pics (un Short qui décolle, un tweet repris, un lancement Steam).
const CH_BASE = { x: 16, youtube_shorts: 14, tiktok: 11, steam: 5, play_store: 3, reddit: 5, discord: 4, search: 6, facebook: 1.5, youtube: 3, referral: 4, direct: 22 };
const CH_PROFILE = {
  x: { desktop: 0.38, play: 0.55, scroll: 0.5, join: 0.34, focus: 0.5, submit: 0.42, bounce: 0.46 },
  youtube_shorts: { desktop: 0.12, play: 0.5, scroll: 0.4, join: 0.27, focus: 0.5, submit: 0.35, bounce: 0.58 },
  tiktok: { desktop: 0.06, play: 0.45, scroll: 0.35, join: 0.22, focus: 0.45, submit: 0.3, bounce: 0.66 },
  steam: { desktop: 0.93, play: 0.72, scroll: 0.7, join: 0.5, focus: 0.55, submit: 0.55, bounce: 0.28 },
  play_store: { desktop: 0.02, play: 0.6, scroll: 0.6, join: 0.45, focus: 0.5, submit: 0.5, bounce: 0.32 },
  reddit: { desktop: 0.55, play: 0.65, scroll: 0.6, join: 0.4, focus: 0.5, submit: 0.4, bounce: 0.4 },
  discord: { desktop: 0.7, play: 0.7, scroll: 0.65, join: 0.5, focus: 0.55, submit: 0.55, bounce: 0.3 },
  search: { desktop: 0.5, play: 0.55, scroll: 0.5, join: 0.3, focus: 0.45, submit: 0.35, bounce: 0.5 },
  facebook: { desktop: 0.3, play: 0.5, scroll: 0.4, join: 0.25, focus: 0.4, submit: 0.3, bounce: 0.6 },
  youtube: { desktop: 0.4, play: 0.6, scroll: 0.5, join: 0.3, focus: 0.5, submit: 0.4, bounce: 0.5 },
  referral: { desktop: 0.5, play: 0.55, scroll: 0.5, join: 0.3, focus: 0.45, submit: 0.35, bounce: 0.5 },
  direct: { desktop: 0.45, play: 0.6, scroll: 0.55, join: 0.38, focus: 0.5, submit: 0.45, bounce: 0.42 },
};
const dayBoost = (ch, i) => {
  const left = DAYS - i; // jours restants avant aujourd'hui
  let m = 0.55 + (i / DAYS) * 0.9; // croissance régulière
  if (ch === 'youtube_shorts' && (left === 12 || left === 11)) m *= 5.2;
  if (ch === 'youtube_shorts' && left === 5) m *= 2.4;
  if (ch === 'x' && left === 8) m *= 3.4;
  if (ch === 'tiktok' && left === 3) m *= 4.1;
  if (ch === 'steam' && left <= 7) m *= 3;
  if (ch === 'reddit' && left === 15) m *= 6;
  return m;
};
const HOUR_W = [1, 0.6, 0.4, 0.3, 0.3, 0.4, 0.8, 1.6, 2.4, 2.8, 3, 3.2, 3.8, 3.4, 3, 3, 3.2, 3.6, 4.2, 5.2, 6.2, 6.4, 5, 2.6];
const WEEKDAY_W = [0.95, 0.9, 0.95, 1.0, 1.05, 1.25, 1.3]; // lundi → dimanche

const vids = []; // identifiants de visiteurs déjà vus (les revenants les réutilisent)
const sponsors = []; // préinscrits pouvant parrainer
let nPrereg = 0;
let nSessions = 0;
const ins = db.prepare(`INSERT INTO preregistrations (email, consent_version, consent_at, ref, referrer, confirm_token, ip_hash, utm_source, confirmed_at, lang,
  s_sid, s_channel, s_source, s_medium, s_campaign, s_content, s_referrer, s_device, s_country, s_first_ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

function sendBatch(base, ua, hdr, events, { first = false, meta, human = true } = {}) {
  const payload = { s: base.sid, v: base.vid, nv: base.nv, h: human ? 1 : 0, e: events };
  if (first) payload.m = meta;
  const r = stats.ingest({ ip: base.ip, ua, headers: hdr }, payload);
  return r;
}
const ev = (n, p, extra = {}) => ({ n, p, ...extra });

function visit(ch, atMs) {
  clock = Math.floor(atMs);
  const prof = CH_PROFILE[ch];
  const lang = weighted(LANGS);
  const device = chance(prof.desktop) ? 'desktop' : chance(0.07) ? 'tablet' : 'mobile';
  const ua = ch === 'tiktok' && device === 'mobile' && chance(0.7) ? pick(UAS.tiktokApp) : pick(UAS[device]);
  const country = weighted(COUNTRIES[lang]);
  const hdr = { 'cf-ipcountry': chance(0.92) ? country : '', 'accept-language': `${lang}-${country},${lang};q=0.9` };
  const camp = bySource.get(ch)?.length ? pick(bySource.get(ch)) : null;
  const utm = camp ? { s: camp[2], m: camp[3], c: camp[4], k: camp[5] } : {};
  const refMap = { reddit: 'reddit.com', search: pick(['google.com', 'google.fr', 'bing.com', 'duckduckgo.com']), facebook: 'facebook.com', youtube: 'youtube.com', referral: pick(['blog-jeux-idle.fr', 'forum.incremental.example', 'jeuxmobile.example']), discord: 'discord.com' };
  const referrer = !camp && refMap[ch] ? refMap[ch] : (camp && ch === 'x' && chance(0.7) ? 't.co' : camp && ch === 'youtube_shorts' && chance(0.6) ? 'youtube.com' : camp && ch === 'tiktok' && chance(0.3) ? 'tiktok.com' : undefined);
  const returning = chance(0.18 + (atMs - (end - DAYS * DAY)) / (DAYS * DAY) * 0.12);
  const vid = returning && vids.length ? pick(vids) : rid(14);
  if (!returning || !vids.length) vids.push(vid);
  const base = { sid: rid(14), vid, nv: returning ? 0 : 1, ip: ip() };
  const meta = { u: utm, r: referrer, w: pick(WIDTHS[device]) + Math.floor(rnd() * 8), l: lang };
  nSessions += 1;
  const isHuman = !chance(0.05);
  const evs = [ev('pv', '/', { v: 'Ascendrya : Fantasy Idle RPG' })];
  const ref = chance(0.03) && sponsors.length ? pick(sponsors) : null;
  if (ref) evs.push(ev('ref', '/', { a: 'arrive', v: ref.ref }));
  sendBatch(base, ua, hdr, evs, { first: true, meta, human: isHuman });
  if (!isHuman) return;
  const bounce = chance(prof.bounce * (ref ? 0.4 : 1));
  clock = Math.floor(clock + 1500 + rnd() * 2500);
  // Performances
  const slow = device === 'mobile' ? 1.5 : 1;
  const perf = [['lcp', (900 + rnd() * 2600) * slow], ['fcp', (500 + rnd() * 1200) * slow], ['cls', rnd() ** 3 * 220], ['ttfb', 80 + rnd() * 500], ['load', (1500 + rnd() * 3500) * slow]];
  if (chance(0.6)) perf.push(['inp', 40 + rnd() ** 2 * 520]);
  let active = bounce ? 1000 + rnd() * 7000 : 12000 + rnd() ** 1.6 * 240000;
  const out = [];
  if (chance(prof.play)) { out.push(ev('vid', '/', { a: 'play' })); const reach = chance(0.45) ? 100 : pick([0, 0, 25, 50, 75]); for (const p of [25, 50, 75, 100]) if (p <= reach) out.push(ev('vid', '/', { a: String(p) })); }
  if (!bounce || chance(0.2)) {
    const scrollTo = chance(prof.scroll) ? pick([50, 75, 100, 100]) : pick([25, 25, 50]);
    for (const p of [25, 50, 75, 100]) if (p <= scrollTo) out.push(ev('scroll', '/', { x: p }));
    const secs = ['top', 'rewards', 'invite', 'discover', 'join'];
    for (let i = 0; i < secs.length; i += 1) if (i < Math.round((scrollTo / 100) * 5) + (chance(0.3) ? 1 : 0)) out.push(ev('sec', '/', { a: secs[i] }));
  }
  if (chance(0.1)) out.push(ev('click', '/', { a: `lang_${pick(['fr', 'en', 'ko', 'ja'])}` }));
  if (chance(0.12)) out.push(ev('click', '/', { a: pick(['cta_nav', 'cta_hero', 'cta_sticky']) }));
  if (chance(0.06)) { const o = pick([['social_x', 'x'], ['social_youtube', 'youtube'], ['social_tiktok', 'tiktok'], ['social_discord', 'discord'], ['out_steam', 'steam'], ['out_play_store', 'play_store']]); out.push(ev('click', '/', { a: o[0], v: o[1] })); }
  if (chance(0.015)) out.push(ev('err', '/', { a: "Cannot read properties of null (reading 'classList')", v: 'site.js:212' }));
  if (chance(0.006)) out.push(ev('err', '/', { a: 'NetworkError when attempting to fetch resource.', v: 'site.js:88' }));
  let registered = null;
  const joins = out.some((e) => e.n === 'sec' && e.a === 'join');
  const wantsToJoin = !bounce && (chance(prof.submit * (joins ? 0.55 : 0.12)) || ref && chance(0.35));
  if (!bounce && chance(prof.focus * (joins ? 0.8 : 0.1))) out.push(ev('form', '/', { a: 'focus' }));
  if (wantsToJoin) {
    out.push(ev('form', '/', { a: 'focus' }), ev('form', '/', { a: 'input' }), ev('form', '/', { a: 'submit' }));
    if (chance(0.07)) { out.push(ev('form', '/', { a: 'error', v: 'invalid' })); }
    else registered = true;
  }
  if (!bounce && chance(0.1)) { out.push(ev('pv', '/classement/', { v: 'Classement · Ascendrya' })); active += 20000; }
  if (chance(0.025)) out.push(ev('pv', '/confidentialite.html', { v: 'Confidentialité · Ascendrya' }));
  for (const [a, x] of perf) out.push(ev('perf', '/', { a, x: Math.round(x) }));
  out.push({ n: 'act', x: Math.min(120000, Math.round(active)) });
  for (let i = 0; i < out.length; i += 36) sendBatch(base, ua, hdr, out.slice(i, i + 36));
  if (active > 120000) sendBatch(base, ua, hdr, [{ n: 'act', x: Math.min(120000, Math.round(active - 120000)) }]);
  if (registered) {
    clock = Math.floor(clock + 10000 + rnd() * 50000);
    const mail = `demo${++nPrereg}@example.invalid`;
    const at = stats.attribute({ sid: base.sid, utm: utm.s });
    const sponsor = ref ?? (chance(0.05) && sponsors.length ? pick(sponsors) : null);
    const myRef = newRefCode();
    const confirmed = chance(0.7) ? Math.floor(clock + (3 + rnd() * 90) * 60000) : null;
    ins.run(mail, '2026-10-31', clock, myRef, sponsor?.ref ?? null, rid(24), rid(10), utm.s ?? null, confirmed && confirmed < end ? confirmed : null, lang === 'fr' ? 'fr' : 'en',
      at.sid, at.channel, at.source, at.medium, at.campaign, at.content, at.referrer, at.device, at.country, at.firstTs);
    stats.markPrereg(at.sid);
    // Les inscrits venus de Steam / X / Shorts parrainent plus que les autres.
    const pSponsor = { steam: 0.4, discord: 0.45, x: 0.3, youtube_shorts: 0.2 }[ch] ?? 0.22;
    if (chance(pSponsor) || sponsors.length < 3) sponsors.push({ ref: myRef, weight: 1 });
    // Les meilleurs parrains reviennent : quelques inscrits supplémentaires rattachés à un parrain existant.
    if (sponsors.length > 5 && chance(0.2)) sponsors.push(sponsors[Math.floor(rnd() * Math.min(5, sponsors.length))]);
  }
}

for (let i = 0; i < DAYS; i += 1) {
  const dayStart = end - (DAYS - i) * DAY;
  const wd = (new Date(dayStart).getUTCDay() + 6) % 7;
  for (let h = 0; h < 24; h += 1) {
    const hourStart = dayStart + h * 3600000;
    if (hourStart > end) break;
    const hw = HOUR_W[(h + 1) % 24] / 3; // heure locale ≈ UTC + 1/2
    const visits = [];
    for (const [ch, base] of Object.entries(CH_BASE)) {
      const lam = base * dayBoost(ch, i) * WEEKDAY_W[wd] * hw * 0.2;
      let n = Math.floor(lam); if (rnd() < lam - n) n += 1;
      for (let k = 0; k < n; k += 1) visits.push(ch);
    }
    for (const ch of visits) visit(ch, hourStart + rnd() * 3599000);
    // quelques robots et du bruit
    for (let k = 0; k < (chance(0.5) ? 1 + Math.floor(rnd() * 3) : 0); k += 1) { clock = Math.floor(hourStart + rnd() * 3500000); stats.ingest({ ip: ip(), ua: pick(BOTS), headers: {} }, { s: rid(14), v: rid(14), e: [ev('pv', '/')] }); }
    if (chance(0.08)) { clock = Math.floor(hourStart + rnd() * 3500000); stats.ingest({ ip: ip(), ua: pick(UAS.desktop), headers: { dnt: '1' } }, { dnt: 1, e: [ev('pv', '/')] }); }
  }
}
// Visiteurs « en direct » : quelques sessions des dernières minutes.
for (let k = 0; k < 6; k += 1) visit(weighted(Object.entries(CH_BASE)), end - rnd() * 4 * 60000);
clock = end;
stats.rollupYesterday();
const n = (sql) => db.prepare(sql).get().n;
console.log(`Base : ${file}`);
console.log(`${n('SELECT COUNT(*) AS n FROM site_sessions')} sessions, ${n('SELECT COUNT(*) AS n FROM site_events')} événements, ${n("SELECT COUNT(*) AS n FROM preregistrations WHERE email LIKE '%@example.invalid'")} préinscriptions fictives, ${n('SELECT COUNT(*) AS n FROM preregistrations WHERE referrer IS NOT NULL')} parrainées, ${n('SELECT SUM(n) AS n FROM site_bots')} robots écartés.`);
db.close();
