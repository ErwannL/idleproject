// Mesure d'audience du site ascendrya.com (admin > « Site »), sans cookie ni tiers.
//
// Vie privée (exemption CNIL « mesure d'audience ») :
//  - aucune IP stockée : seulement un hachage SALÉ par un sel QUOTIDIEN (table site_salt, les sels des jours passés sont
//    effacés) -> le hachage ne relie jamais deux jours ;
//  - un identifiant de visiteur anonyme et aléatoire (localStorage du navigateur) sert à distinguer nouveau / revenant ;
//  - Do-Not-Track / Global Privacy Control (en-tête ou drapeau du navigateur) : seule la page vue est comptée, sans aucun
//    identifiant (ni visiteur, ni session, ni hachage) ;
//  - aucune donnée vers un service tiers, aucun texte libre de l'utilisateur, aucun e-mail ;
//  - événements bruts purgés au-delà de `retentionDays` (13 mois par défaut) ; les jours révolus sont résumés dans site_daily.
//
// Ce module ne dépend pas de server/app.mjs (pas de cycle) : l'application lui passe `maskEmail`.
import { createHash, randomBytes } from 'node:crypto';

const DAY = 86400000;
const HOUR = 3600000;
export const SITE_EVENT_NAMES = new Set(['pv', 'click', 'scroll', 'sec', 'vid', 'form', 'ref', 'err', 'perf', 'act', 'hum']);
export const SITE_LIMITS = {
  body: 16 * 1024,
  events: 40, // par envoi
  perSession: 800, // événements gardés par session
  activeMs: 4 * HOUR, // temps actif maximal d'une session
  batches: { max: 90, windowMs: 60_000 }, // envois par minute et par visiteur haché
  newSessions: { max: 30, windowMs: HOUR }, // nouvelles sessions par heure et par visiteur haché
  retentionDays: 395, // 13 mois
};

const ID_RE = /^[A-Za-z0-9_-]{8,40}$/;
const TAG_RE = /^[a-z0-9_.-]{1,60}$/;
const TOKEN_RE = /^[A-Za-z0-9_.:-]{1,60}$/;
const REF_CODE_RE = /^[A-HJ-NP-Z2-9]{5,6}$/;
const HOST_RE = /^[a-z0-9][a-z0-9.-]{1,78}$/;
const PAGE_RE = /^\/[A-Za-z0-9_\-./]{0,100}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const VID_STEPS = { play: 0, 25: 25, 50: 50, 75: 75, 100: 100, pause: -1 };
const FORM_STEPS = new Set(['focus', 'input', 'submit', 'error', 'ok']);
const REF_STEPS = new Set(['arrive', 'copy', 'share']);
const PERF_METRICS = new Set(['lcp', 'cls', 'inp', 'fcp', 'ttfb', 'load']);
// Seuils Core Web Vitals (bon / à améliorer) ; CLS stocké ×1000.
const PERF_LIMITS = { lcp: [2500, 4000], cls: [100, 250], inp: [200, 500], fcp: [1800, 3000], ttfb: [800, 1800], load: [3000, 6000] };

export const SITE_CHANNELS = {
  x: 'X (Twitter)', youtube_shorts: 'YouTube Shorts', youtube: 'YouTube', tiktok: 'TikTok', reddit: 'Reddit', discord: 'Discord',
  steam: 'Steam', play_store: 'Google Play', search: 'Recherche (Google, Bing…)', facebook: 'Facebook', instagram: 'Instagram',
  twitch: 'Twitch', email: 'E-mail', direct: 'Direct', referral: 'Autre site', other: 'Autre (utm)',
};

// ---------- Classement automatique en canaux ----------
const HOST_CHANNELS = [
  ['x', ['t.co', 'twitter.com', 'x.com']],
  ['youtube', ['youtube.com', 'youtu.be', 'youtube-nocookie.com']],
  ['tiktok', ['tiktok.com']],
  ['reddit', ['reddit.com', 'redd.it']],
  ['discord', ['discord.com', 'discord.gg', 'discordapp.com']],
  ['steam', ['steampowered.com', 'steamcommunity.com', 'steamcdn-a.akamaihd.net']],
  ['play_store', ['play.google.com']],
  ['facebook', ['facebook.com', 'fb.com', 'fb.me', 'messenger.com']],
  ['instagram', ['instagram.com']],
  ['twitch', ['twitch.tv']],
  ['search', ['google.com', 'bing.com', 'duckduckgo.com', 'ecosia.org', 'qwant.com', 'yahoo.com', 'search.brave.com', 'startpage.com', 'yandex.com', 'yandex.ru', 'baidu.com', 'naver.com']],
];
const SOURCE_CHANNELS = {
  x: 'x', twitter: 'x', 't.co': 'x', tw: 'x',
  youtube: 'youtube', yt: 'youtube', youtu_be: 'youtube',
  tiktok: 'tiktok', tt: 'tiktok',
  reddit: 'reddit', discord: 'discord', steam: 'steam', steampowered: 'steam',
  play: 'play_store', playstore: 'play_store', play_store: 'play_store', google_play: 'play_store', googleplay: 'play_store', 'play.google.com': 'play_store',
  google: 'search', bing: 'search', duckduckgo: 'search', ddg: 'search', ecosia: 'search', qwant: 'search', yahoo: 'search', brave: 'search',
  facebook: 'facebook', fb: 'facebook', meta: 'facebook', instagram: 'instagram', ig: 'instagram', twitch: 'twitch',
  newsletter: 'email', email: 'email', mail: 'email',
};

export function cleanTag(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9_.-]/g, '').slice(0, 60);
  return v || null;
}
export function cleanHost(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase().replace(/^www\./, '');
  return HOST_RE.test(v) ? v : null;
}

const hostIn = (host, domains) => domains.some((d) => host === d || host.endsWith(`.${d}`));
const SELF_HOSTS = ['ascendrya.com', 'localhost', '127.0.0.1'];
export function isSelfHost(host) { return hostIn(host, SELF_HOSTS); }

// { source, medium, referrerHost } -> canal. L'utm prime sur le referrer.
export function classifyChannel({ source = null, medium = null, referrerHost = null, hint = null } = {}) {
  const src = cleanTag(source);
  const med = cleanTag(medium);
  if (src) {
    if (src.includes('short') || (med === 'shorts' && SOURCE_CHANNELS[src] === 'youtube') || (med === 'short' && SOURCE_CHANNELS[src] === 'youtube')) return 'youtube_shorts';
    if (SOURCE_CHANNELS[src]) return SOURCE_CHANNELS[src];
    if (med === 'email') return 'email';
    // Source inconnue : on regarde quand même le referrer, sinon « autre (utm) ».
    const byHost = referrerHost && channelOfHost(referrerHost);
    return byHost && byHost !== 'referral' ? byHost : 'other';
  }
  if (med === 'email') return 'email';
  if (referrerHost && !isSelfHost(referrerHost)) return channelOfHost(referrerHost);
  return hint ?? 'direct';
}
function channelOfHost(host) {
  for (const [channel, domains] of HOST_CHANNELS) if (hostIn(host, domains)) return channel;
  if (/^(www\.)?google\.[a-z.]{2,6}$/.test(host)) return 'search';
  return 'referral';
}

// ---------- Appareil, navigateur, pays (jamais l'agent utilisateur brut en base) ----------
const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|preview|facebookexternalhit|embedly|whatsapp|telegram|curl|wget|python|node-fetch|undici|axios|go-http|okhttp|java\/|libwww|httpclient|phantom|puppeteer|playwright|selenium|scrapy|postman|insomnia|http_request|apache-http/i;
export function isBotUa(ua) {
  const s = String(ua ?? '');
  return s.length < 12 || BOT_UA.test(s);
}
export function parseUa(ua) {
  const s = String(ua ?? '');
  const tablet = /iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(s);
  const mobile = !tablet && /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(s);
  const device = tablet ? 'tablet' : mobile ? 'mobile' : 'desktop';
  let os = 'autre';
  if (/Windows/i.test(s)) os = 'Windows';
  else if (/iPhone|iPad|iPod/i.test(s)) os = 'iOS';
  else if (/Android/i.test(s)) os = 'Android';
  else if (/CrOS/i.test(s)) os = 'ChromeOS';
  else if (/Mac OS X|Macintosh/i.test(s)) os = 'macOS';
  else if (/Linux|X11/i.test(s)) os = 'Linux';
  let browser = 'autre';
  let inApp = null;
  if (/TikTok|musical_ly|BytedanceWebview|Bytedance/i.test(s)) { browser = 'TikTok (in-app)'; inApp = 'tiktok'; }
  else if (/Instagram/i.test(s)) { browser = 'Instagram (in-app)'; inApp = 'instagram'; }
  else if (/FBAN|FBAV|FB_IAB/i.test(s)) { browser = 'Facebook (in-app)'; inApp = 'facebook'; }
  else if (/Twitter|TwitterAndroid/i.test(s)) { browser = 'X (in-app)'; inApp = 'x'; }
  else if (/EdgA?\/|Edg\//.test(s)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(s)) browser = 'Opera';
  else if (/SamsungBrowser/.test(s)) browser = 'Samsung Internet';
  else if (/Firefox\/|FxiOS/.test(s)) browser = 'Firefox';
  else if (/Chrome\/|CriOS/.test(s)) browser = 'Chrome';
  else if (/Safari\//.test(s)) browser = 'Safari';
  return { device, os, browser, inApp };
}
export function screenBucket(w) {
  const n = Number(w);
  if (!Number.isFinite(n) || n < 200 || n > 10000) return null;
  if (n < 480) return '< 480 px';
  if (n < 768) return '480-767 px';
  if (n < 1024) return '768-1023 px';
  if (n < 1366) return '1024-1365 px';
  if (n < 1920) return '1366-1919 px';
  return '1920 px et +';
}
const COUNTRY_HEADERS = ['cf-ipcountry', 'cloudfront-viewer-country', 'x-vercel-ip-country', 'x-country-code', 'x-geo-country'];
// Pays : en-tête du proxy / CDN s'il existe, sinon région d'Accept-Language (indication, pas une géolocalisation IP).
export function countryOf(headers = {}) {
  for (const h of COUNTRY_HEADERS) {
    const v = String(headers[h] ?? '').trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(v) && !['XX', 'T1', 'ZZ'].includes(v)) return { country: v, src: 'header' };
  }
  const m = /^[a-z]{2,3}-([A-Za-z]{2})\b/.exec(String(headers['accept-language'] ?? '').trim());
  return m ? { country: m[1].toUpperCase(), src: 'lang' } : { country: null, src: null };
}

// ---------- Générateur de liens de campagne ----------
export const CAMPAIGN_PRESETS = [
  { id: 'x', label: 'X (Twitter)', source: 'x', medium: 'social' },
  { id: 'youtube_shorts', label: 'YouTube Shorts', source: 'youtube', medium: 'shorts' },
  { id: 'youtube', label: 'YouTube (vidéo)', source: 'youtube', medium: 'video' },
  { id: 'tiktok', label: 'TikTok', source: 'tiktok', medium: 'social' },
  { id: 'steam', label: 'Page Steam', source: 'steam', medium: 'store' },
  { id: 'play_store', label: 'Google Play', source: 'google_play', medium: 'store' },
  { id: 'discord', label: 'Discord', source: 'discord', medium: 'community' },
  { id: 'reddit', label: 'Reddit', source: 'reddit', medium: 'social' },
  { id: 'newsletter', label: 'Newsletter', source: 'newsletter', medium: 'email' },
];
export function buildCampaignUrl({ base = 'https://ascendrya.com/', source, medium, campaign, content, term } = {}) {
  const s = cleanTag(source); const m = cleanTag(medium); const c = cleanTag(campaign);
  if (!s || !m || !c) return null;
  let u;
  try { u = new URL(base); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  u.search = '';
  u.hash = '';
  u.searchParams.set('utm_source', s);
  u.searchParams.set('utm_medium', m);
  u.searchParams.set('utm_campaign', c);
  const ct = cleanTag(content); if (ct) u.searchParams.set('utm_content', ct);
  const tm = cleanTag(term); if (tm) u.searchParams.set('utm_term', tm);
  return u.toString();
}

// ---------- Schéma ----------
const SCHEMA = `
CREATE TABLE IF NOT EXISTS site_salt (day TEXT PRIMARY KEY, salt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS site_sessions (
  sid TEXT PRIMARY KEY, vid TEXT, dh TEXT, day TEXT NOT NULL, first_ts INTEGER NOT NULL, last_ts INTEGER NOT NULL,
  new_visitor INTEGER NOT NULL DEFAULT 1, human INTEGER NOT NULL DEFAULT 0,
  channel TEXT NOT NULL DEFAULT 'direct', source TEXT, medium TEXT, campaign TEXT, content TEXT, term TEXT, referrer TEXT,
  device TEXT, os TEXT, browser TEXT, screen TEXT, lang TEXT, country TEXT, country_src TEXT,
  entry_page TEXT, exit_page TEXT, pages INTEGER NOT NULL DEFAULT 0, events INTEGER NOT NULL DEFAULT 0, clicks INTEGER NOT NULL DEFAULT 0,
  active_ms INTEGER NOT NULL DEFAULT 0, scroll_max INTEGER NOT NULL DEFAULT 0,
  vid_play INTEGER NOT NULL DEFAULT 0, vid_max INTEGER NOT NULL DEFAULT 0, join_seen INTEGER NOT NULL DEFAULT 0,
  form_focus INTEGER NOT NULL DEFAULT 0, form_input INTEGER NOT NULL DEFAULT 0, form_submit INTEGER NOT NULL DEFAULT 0,
  form_error INTEGER NOT NULL DEFAULT 0, form_ok INTEGER NOT NULL DEFAULT 0,
  ref_arrive TEXT, ref_copy INTEGER NOT NULL DEFAULT 0, ref_share INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS site_sessions_ts ON site_sessions (first_ts);
CREATE INDEX IF NOT EXISTS site_sessions_last ON site_sessions (last_ts);
CREATE TABLE IF NOT EXISTS site_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, sid TEXT, name TEXT NOT NULL,
  page TEXT, a TEXT, v TEXT, x REAL
);
CREATE INDEX IF NOT EXISTS site_events_ts ON site_events (ts);
CREATE INDEX IF NOT EXISTS site_events_name ON site_events (name, ts);
CREATE INDEX IF NOT EXISTS site_events_sid ON site_events (sid);
CREATE TABLE IF NOT EXISTS site_bots (day TEXT NOT NULL, reason TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, reason));
CREATE TABLE IF NOT EXISTS site_daily (
  day TEXT NOT NULL, channel TEXT NOT NULL, campaign TEXT NOT NULL DEFAULT '',
  sessions INTEGER NOT NULL DEFAULT 0, visitors INTEGER NOT NULL DEFAULT 0, new_visitors INTEGER NOT NULL DEFAULT 0,
  pageviews INTEGER NOT NULL DEFAULT 0, bounces INTEGER NOT NULL DEFAULT 0, active_ms INTEGER NOT NULL DEFAULT 0,
  preregs INTEGER NOT NULL DEFAULT 0, referrals INTEGER NOT NULL DEFAULT 0, vid_plays INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, channel, campaign)
);
CREATE TABLE IF NOT EXISTS site_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, preset TEXT, source TEXT NOT NULL, medium TEXT NOT NULL,
  campaign TEXT NOT NULL, content TEXT, term TEXT, url TEXT NOT NULL, created_at INTEGER NOT NULL
);
`;

export function ensureSiteStatsSchema(db) {
  db.exec(SCHEMA);
  const cols = new Set(db.prepare('PRAGMA table_info(preregistrations)').all().map((c) => c.name));
  if (cols.size) {
    for (const [col, def] of [['s_sid', 'TEXT'], ['s_channel', 'TEXT'], ['s_source', 'TEXT'], ['s_medium', 'TEXT'], ['s_campaign', 'TEXT'], ['s_content', 'TEXT'],
      ['s_referrer', 'TEXT'], ['s_device', 'TEXT'], ['s_country', 'TEXT'], ['s_first_ts', 'INTEGER']]) {
      if (!cols.has(col)) db.exec(`ALTER TABLE preregistrations ADD COLUMN ${col} ${def}`);
    }
    db.exec('CREATE INDEX IF NOT EXISTS preregistrations_sid ON preregistrations (s_sid)');
    db.exec('CREATE INDEX IF NOT EXISTS preregistrations_referrer ON preregistrations (referrer)');
  }
}

// ---------- Utilitaires ----------
const dayStr = (ms) => new Date(ms).toISOString().slice(0, 10);
const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null; };
const pct = (a, b) => (b > 0 ? a / b : 0);
const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
function percentile(sorted, p) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[i];
}
const inc = (map, key, by = 1) => map.set(key, (map.get(key) ?? 0) + by);
const topRows = (map, limit, shape = (k, n) => ({ key: k, count: n })) => [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, limit).map(([k, n]) => shape(k, n));

// Page normalisée : /index.html -> /, pas de requête ni d'ancre.
export function cleanPage(value) {
  if (typeof value !== 'string') return null;
  let p = value.split(/[?#]/)[0].replace(/\/index\.html$/, '/');
  if (p === '') p = '/';
  return PAGE_RE.test(p) ? p : null;
}
// Message d'erreur : sans e-mail, sans longue suite de chiffres, sans adresse complète.
export function scrubText(value, max = 160) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[^\s@]+@[^\s@]+/g, '[email]').replace(/https?:\/\/[^\s)]+/g, (u) => {
    try { return new URL(u).pathname.split('/').pop() || 'url'; } catch { return 'url'; }
  }).replace(/\d{6,}/g, '#').replace(/\s+/g, ' ').trim().slice(0, max);
}

// Validation stricte d'un envoi. Retourne null si le corps n'est pas exploitable ; les événements invalides sont écartés.
export function cleanBatch(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const events = [];
  let rejected = 0;
  const list = Array.isArray(body.e) ? body.e.slice(0, SITE_LIMITS.events) : [];
  for (const raw of list) {
    const ev = cleanEvent(raw);
    if (ev) events.push(ev); else rejected += 1;
  }
  const m = body.m && typeof body.m === 'object' ? body.m : null;
  const u = m?.u && typeof m.u === 'object' ? m.u : {};
  return {
    sid: typeof body.s === 'string' && ID_RE.test(body.s) ? body.s : null,
    vid: typeof body.v === 'string' && ID_RE.test(body.v) ? body.v : null,
    nv: body.nv === 0 || body.nv === false ? 0 : 1,
    human: body.h === 1 || body.h === true ? 1 : 0,
    dnt: body.dnt === 1 || body.dnt === true,
    meta: m ? {
      source: cleanTag(u.s), medium: cleanTag(u.m), campaign: cleanTag(u.c), term: cleanTag(u.t), content: cleanTag(u.k),
      referrer: cleanHost(m.r), width: num(m.w, 0, 20000), lang: typeof m.l === 'string' && /^[a-z]{2,3}/i.test(m.l) ? m.l.slice(0, 2).toLowerCase() : null,
    } : null,
    events,
    rejected,
    tooMany: Array.isArray(body.e) && body.e.length > SITE_LIMITS.events,
  };
}
function cleanEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = raw.n;
  if (typeof name !== 'string' || !SITE_EVENT_NAMES.has(name)) return null;
  const page = raw.p === undefined || raw.p === null ? null : cleanPage(raw.p);
  if (raw.p !== undefined && raw.p !== null && !page) return null;
  const ev = { name, page, a: null, v: null, x: null };
  const a = raw.a === undefined || raw.a === null ? null : String(raw.a);
  const v = raw.v === undefined || raw.v === null ? null : String(raw.v);
  switch (name) {
    case 'pv': ev.v = v ? scrubText(v, 80) : null; if (!page) return null; break;
    case 'click': if (!a || !TOKEN_RE.test(a)) return null; ev.a = a; ev.v = v && TOKEN_RE.test(v) ? v : null; break;
    case 'sec': if (!a || !TOKEN_RE.test(a)) return null; ev.a = a; break;
    case 'scroll': { const x = Number(raw.x); if (![25, 50, 75, 100].includes(x)) return null; ev.x = x; break; }
    case 'vid': if (a === null || !(a in VID_STEPS)) return null; ev.a = a; ev.x = VID_STEPS[a]; break;
    case 'form': if (!a || !FORM_STEPS.has(a)) return null; ev.a = a; ev.v = v && TOKEN_RE.test(v) ? v : null; break;
    case 'ref': if (!a || !REF_STEPS.has(a)) return null; ev.a = a; ev.v = v && REF_CODE_RE.test(v.toUpperCase()) ? v.toUpperCase() : null; break;
    case 'err': if (!a) return null; ev.a = scrubText(a, 160); ev.v = v ? scrubText(v, 80) : null; if (!ev.a) return null; break;
    case 'perf': { if (!a || !PERF_METRICS.has(a)) return null; const x = num(raw.x, 0, 600000); if (x === null) return null; ev.a = a; ev.x = Math.round(x * 10) / 10; break; }
    case 'act': { const x = num(raw.x, 0, 120000); if (x === null) return null; ev.x = x; break; }
    case 'hum': break;
    default: return null;
  }
  return ev;
}

const CSV_HEAD_FIX = /^[=+\-@\t\r]/;
function csvCell(value) {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'number' ? String(Math.round(value * 1000) / 1000) : String(value);
  if (CSV_HEAD_FIX.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`; // pas d'injection de formule dans un tableur
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(rows) {
  if (!rows.length) return '﻿\n';
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return `﻿${[cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n')}\n`;
}

// ---------- Service ----------
export function createSiteStats({ db, now = () => Date.now(), retentionDays = SITE_LIMITS.retentionDays, maskEmail = (e) => String(e), baseUrl = 'https://ascendrya.com', log = () => {} }) {
  ensureSiteStatsSchema(db);
  const tx = (fn) => {
    db.exec('BEGIN');
    try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { try { db.exec('ROLLBACK'); } catch { /* déjà annulée */ } throw e; }
  };

  // Sel quotidien : créé au premier besoin du jour ; les sels des jours passés sont effacés.
  let saltCache = null;
  function dailySalt() {
    const day = dayStr(now());
    if (saltCache?.day === day) return saltCache.salt;
    let row = db.prepare('SELECT salt FROM site_salt WHERE day = ?').get(day);
    if (!row) {
      db.prepare('DELETE FROM site_salt WHERE day <> ?').run(day);
      row = { salt: randomBytes(24).toString('hex') };
      db.prepare('INSERT INTO site_salt (day, salt) VALUES (?, ?)').run(day, row.salt);
    }
    saltCache = { day, salt: row.salt };
    return row.salt;
  }
  const dailyHash = (ip, ua) => createHash('sha256').update(`${dailySalt()}|${ip}|${ua}`).digest('hex').slice(0, 20);

  // Limiteurs en mémoire, par visiteur haché du jour.
  const hits = { batches: new Map(), sessions: new Map() };
  function allow(kind, key, { max, windowMs }) {
    const map = hits[kind];
    const t = now();
    if (map.size > 20000) for (const [k, e] of map) if (t - e.start > windowMs) map.delete(k);
    const e = map.get(key);
    if (!e || t - e.start > windowMs) { map.set(key, { start: t, count: 1 }); return true; }
    e.count += 1;
    return e.count <= max;
  }

  const q = {
    getSession: db.prepare('SELECT * FROM site_sessions WHERE sid = ?'),
    insertSession: db.prepare(`INSERT INTO site_sessions (sid, vid, dh, day, first_ts, last_ts, new_visitor, human, channel, source, medium, campaign, content, term, referrer,
      device, os, browser, screen, lang, country, country_src, entry_page, exit_page) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    updateSession: db.prepare(`UPDATE site_sessions SET last_ts = ?, human = ?, pages = pages + ?, events = events + ?, clicks = clicks + ?, active_ms = ?, scroll_max = ?,
      vid_play = ?, vid_max = ?, join_seen = ?, form_focus = ?, form_input = ?, form_submit = ?, form_error = ?, form_ok = ?, ref_arrive = ?, ref_copy = ?, ref_share = ?,
      exit_page = COALESCE(?, exit_page), entry_page = COALESCE(entry_page, ?), lang = COALESCE(lang, ?) WHERE sid = ?`),
    insertEvent: db.prepare('INSERT INTO site_events (ts, sid, name, page, a, v, x) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    bot: db.prepare('INSERT INTO site_bots (day, reason, n) VALUES (?, ?, 1) ON CONFLICT(day, reason) DO UPDATE SET n = n + 1'),
  };

  // Réception d'un envoi du site. Retourne { status } (204 = accepté, y compris quand un robot est écarté sans le lui dire).
  function ingest({ ip = '', ua = '', headers = {} }, body) {
    const batch = cleanBatch(body);
    if (!batch) return { status: 400 };
    const t = now();
    const day = dayStr(t);
    const dh = dailyHash(ip, ua);
    if (!allow('batches', dh, SITE_LIMITS.batches)) return { status: 429 };
    const dntHeader = String(headers.dnt ?? '') === '1' || String(headers['sec-gpc'] ?? '') === '1';
    if (isBotUa(ua)) { q.bot.run(day, 'ua'); return { status: 204, bot: true }; }
    // Do-Not-Track / GPC : on ne compte que la page vue, sans aucun identifiant.
    if (batch.dnt || dntHeader) {
      const views = batch.events.filter((e) => e.name === 'pv').slice(0, 5);
      tx(() => { for (const e of views) q.insertEvent.run(t, null, 'pv', e.page, null, e.v, null); });
      return { status: 204, dnt: true, stored: views.length };
    }
    if (!batch.sid) return { status: 400 };
    let s = q.getSession.get(batch.sid);
    if (!s) {
      if (!allow('sessions', dh, SITE_LIMITS.newSessions)) return { status: 429 };
      const info = parseUa(ua);
      const meta = batch.meta ?? {};
      const { country, src } = countryOf(headers);
      const firstPv = batch.events.find((e) => e.name === 'pv');
      tx(() => {
        q.insertSession.run(batch.sid, batch.vid, dh, day, t, t, batch.nv, 0,
          classifyChannel({ source: meta.source, medium: meta.medium, referrerHost: meta.referrer, hint: info.inApp }),
          meta.source ?? null, meta.medium ?? null, meta.campaign ?? null, meta.content ?? null, meta.term ?? null, meta.referrer && !isSelfHost(meta.referrer) ? meta.referrer : null,
          info.device, info.os, info.browser, screenBucket(meta.width), meta.lang ?? null, country, src, firstPv?.page ?? null, firstPv?.page ?? null);
      });
      s = q.getSession.get(batch.sid);
    }
    if (s.events >= SITE_LIMITS.perSession) return { status: 204, capped: true };
    const f = { ...s };
    let pages = 0; let clicks = 0; let exit = null; let entry = null; let kept = 0; let lang = null;
    const rows = [];
    for (const e of batch.events) {
      if (s.events + kept >= SITE_LIMITS.perSession) break;
      switch (e.name) {
        case 'pv': pages += 1; exit = e.page; entry ??= e.page; kept += 1; rows.push(e); break;
        case 'click': clicks += 1; kept += 1; rows.push(e); break;
        case 'scroll': f.scroll_max = Math.max(f.scroll_max, e.x); kept += 1; rows.push(e); break;
        case 'sec': if (e.a === 'join') f.join_seen = 1; kept += 1; rows.push(e); break;
        case 'vid':
          if (e.a === 'play') f.vid_play = 1; else if (e.x > 0) { f.vid_play = 1; f.vid_max = Math.max(f.vid_max, e.x); }
          kept += 1; rows.push(e); break;
        case 'form':
          if (e.a === 'focus') f.form_focus = 1; else if (e.a === 'input') { f.form_focus = 1; f.form_input = 1; } else if (e.a === 'submit') { f.form_input = 1; f.form_submit = 1; } else if (e.a === 'error') f.form_error = 1; else if (e.a === 'ok') { f.form_submit = 1; f.form_ok = 1; }
          kept += 1; rows.push(e); break;
        case 'ref':
          if (e.a === 'arrive' && e.v) f.ref_arrive = e.v; else if (e.a === 'copy') f.ref_copy = 1; else if (e.a === 'share') f.ref_share = 1;
          kept += 1; rows.push(e); break;
        case 'err': case 'perf': kept += 1; rows.push(e); break;
        case 'act': f.active_ms = Math.min(SITE_LIMITS.activeMs, f.active_ms + e.x); break;
        case 'hum': f.human = 1; break;
        default: break;
      }
    }
    if (batch.human) f.human = 1;
    if (batch.meta?.lang) lang = batch.meta.lang;
    tx(() => {
      q.updateSession.run(t, f.human, pages, kept, clicks, f.active_ms, f.scroll_max, f.vid_play, f.vid_max, f.join_seen, f.form_focus, f.form_input, f.form_submit,
        f.form_error, f.form_ok, f.ref_arrive ?? null, f.ref_copy, f.ref_share, exit, entry, lang, s.sid);
      for (const e of rows) q.insertEvent.run(t, s.sid, e.name, e.page, e.a, e.v, e.x);
    });
    return { status: 204, stored: rows.length, rejected: batch.rejected };
  }

  // Provenance d'une préinscription : copiée depuis la session du visiteur (ou, à défaut, de l'utm_source reçu).
  function attribute({ sid, utm } = {}) {
    const s = typeof sid === 'string' && ID_RE.test(sid) ? q.getSession.get(sid) : null;
    if (s) {
      return { sid: s.sid, channel: s.channel, source: s.source, medium: s.medium, campaign: s.campaign, content: s.content, referrer: s.referrer, device: s.device, country: s.country, firstTs: s.first_ts };
    }
    const source = cleanTag(utm);
    return { sid: null, channel: source ? classifyChannel({ source }) : null, source, medium: null, campaign: null, content: null, referrer: null, device: null, country: null, firstTs: null };
  }
  function markPrereg(sid, { duplicate = false } = {}) {
    if (typeof sid !== 'string' || !ID_RE.test(sid) || !q.getSession.get(sid)) return;
    db.prepare('UPDATE site_sessions SET form_submit = 1, form_ok = ?, human = 1 WHERE sid = ?').run(duplicate ? 0 : 1, sid);
    if (!duplicate) q.insertEvent.run(now(), sid, 'prereg', '/', 'ok', null, null);
  }

  // ---------- Résumés journaliers et purge ----------
  const regByRef = () => new Map(db.prepare('SELECT ref, consent_at FROM preregistrations WHERE ref IS NOT NULL').all().map((r) => [r.ref, r]));
  function rollup(day) {
    const from = Date.parse(`${day}T00:00:00Z`);
    const sessions = db.prepare('SELECT * FROM site_sessions WHERE first_ts >= ? AND first_ts < ? AND human = 1').all(from, from + DAY);
    const preregs = db.prepare('SELECT s_channel, s_campaign, referrer FROM preregistrations WHERE consent_at >= ? AND consent_at < ?').all(from, from + DAY);
    const groups = new Map();
    const g = (channel, campaign) => {
      const k = `${channel}\u0000${campaign ?? ''}`;
      if (!groups.has(k)) groups.set(k, { channel, campaign: campaign ?? '', sessions: 0, visitors: new Set(), newV: new Set(), pageviews: 0, bounces: 0, active: 0, preregs: 0, referrals: 0, plays: 0 });
      return groups.get(k);
    };
    for (const s of sessions) {
      const x = g(s.channel, s.campaign);
      x.sessions += 1; x.visitors.add(s.vid ?? s.dh); if (s.new_visitor) x.newV.add(s.vid ?? s.dh);
      x.pageviews += s.pages; x.active += s.active_ms; x.plays += s.vid_play;
      if (isBounce(s)) x.bounces += 1;
    }
    for (const p of preregs) { const x = g(p.s_channel ?? 'direct', p.s_campaign); x.preregs += 1; if (p.referrer) x.referrals += 1; }
    tx(() => {
      db.prepare('DELETE FROM site_daily WHERE day = ?').run(day);
      const ins = db.prepare('INSERT INTO site_daily (day, channel, campaign, sessions, visitors, new_visitors, pageviews, bounces, active_ms, preregs, referrals, vid_plays) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const x of groups.values()) ins.run(day, x.channel, x.campaign, x.sessions, x.visitors.size, x.newV.size, x.pageviews, x.bounces, x.active, x.preregs, x.referrals, x.plays);
    });
  }
  // Supprime les données brutes plus anciennes que la rétention (après avoir résumé leurs jours) ; efface les sels passés.
  let lastPurge = '';
  function purge({ retention = retentionDays } = {}) {
    const t = now();
    const cutoff = t - retention * DAY;
    const old = db.prepare('SELECT DISTINCT day FROM site_sessions WHERE first_ts < ? ORDER BY day').all(cutoff);
    for (const { day } of old) rollup(day);
    rollup(dayStr(t - DAY)); // la veille est résumée dès le premier passage du jour
    const res = tx(() => ({
      sessions: db.prepare('DELETE FROM site_sessions WHERE first_ts < ?').run(cutoff).changes,
      events: db.prepare('DELETE FROM site_events WHERE ts < ?').run(cutoff).changes,
      bots: db.prepare('DELETE FROM site_bots WHERE day < ?').run(dayStr(cutoff)).changes,
      salts: db.prepare('DELETE FROM site_salt WHERE day <> ?').run(dayStr(t)).changes,
    }));
    lastPurge = dayStr(t);
    return res;
  }
  function maybePurge() { if (lastPurge !== dayStr(now())) { try { purge(); } catch (e) { log(`purge de la mesure d'audience : ${e.message}`); } } }
  // Jours révolus : on les résume dès le lendemain (utile avant la purge, et pour les jours sans trafic).
  function rollupYesterday() { rollup(dayStr(now() - DAY)); }

  // ---------- Lecture / rapport ----------
  const isBounce = (s) => s.pages < 2 && s.active_ms < 10000 && !s.form_submit;
  function parseRange(params) {
    const tz = Math.round(num(params.tz, -840, 840) ?? 0);
    const localToday = dayStr(now() - tz * 60000);
    let to = DAY_RE.test(params.to ?? '') ? params.to : localToday;
    let from = params.from === 'all' ? 'all' : DAY_RE.test(params.from ?? '') ? params.from : dayStr(Date.parse(`${to}T00:00:00Z`) - 29 * DAY);
    if (from === 'all') {
      const m = db.prepare('SELECT MIN(first_ts) AS a FROM site_sessions').get().a;
      const p = db.prepare('SELECT MIN(consent_at) AS a FROM preregistrations').get().a;
      const d = db.prepare('SELECT MIN(day) AS a FROM site_daily').get().a;
      const mins = [m, p].filter((x) => x != null).map((x) => dayStr(x - tz * 60000));
      if (d) mins.push(d);
      from = mins.sort()[0] ?? to;
    }
    if (from > to) [from, to] = [to, from];
    let fromTs = Date.parse(`${from}T00:00:00Z`) + tz * 60000;
    let toTs = Date.parse(`${to}T00:00:00Z`) + DAY + tz * 60000;
    if (toTs - fromTs > 800 * DAY) { fromTs = toTs - 800 * DAY; from = dayStr(fromTs - tz * 60000); }
    return { from, to, fromTs, toTs, tz, days: Math.round((toTs - fromTs) / DAY), all: params.from === 'all' };
  }
  function parseFilters(params) {
    const f = {};
    const tag = (v) => (typeof v === 'string' && /^[a-z0-9_.-]{1,60}$/.test(v) ? v : null);
    if (tag(params.channel)) f.channel = params.channel;
    if (tag(params.campaign)) f.campaign = params.campaign;
    if (['mobile', 'tablet', 'desktop'].includes(params.device)) f.device = params.device;
    if (typeof params.lang === 'string' && /^[a-z]{2,3}$/.test(params.lang)) f.lang = params.lang;
    if (typeof params.country === 'string' && /^[A-Za-z]{2}$/.test(params.country)) f.country = params.country.toUpperCase();
    return f;
  }
  function sessionWhere(f, alias = 's') {
    const parts = []; const args = [];
    const add = (col, v) => { parts.push(`${alias}.${col} = ?`); args.push(v); };
    if (f.channel) add('channel', f.channel);
    if (f.campaign) add('campaign', f.campaign);
    if (f.device) add('device', f.device);
    if (f.lang) add('lang', f.lang);
    if (f.country) add('country', f.country);
    return { sql: parts.length ? ` AND ${parts.join(' AND ')}` : '', args };
  }
  function preregWhere(f) {
    const parts = []; const args = [];
    if (f.channel) { parts.push('s_channel = ?'); args.push(f.channel); }
    if (f.campaign) { parts.push('s_campaign = ?'); args.push(f.campaign); }
    if (f.device) { parts.push('s_device = ?'); args.push(f.device); }
    if (f.lang) { parts.push('lang = ?'); args.push(f.lang); }
    if (f.country) { parts.push('s_country = ?'); args.push(f.country); }
    return { sql: parts.length ? ` AND ${parts.join(' AND ')}` : '', args };
  }

  // Toutes les préinscriptions (liens de parrainage, session d'origine) : base des entonnoirs et des chaînes.
  function allPreregs() {
    const rows = db.prepare(`SELECT email, ref, referrer, consent_at, confirmed_at, lang, s_sid, s_channel, s_source, s_medium, s_campaign, s_content, s_referrer, s_device, s_country, s_first_ts
      FROM preregistrations`).all();
    const bySid = new Map(); const byRef = new Map(); const kids = new Map();
    for (const r of rows) {
      if (r.s_sid && !bySid.has(r.s_sid)) bySid.set(r.s_sid, r);
      if (r.ref) byRef.set(r.ref, r);
      if (r.referrer) { if (!kids.has(r.referrer)) kids.set(r.referrer, []); kids.get(r.referrer).push(r); }
    }
    return { rows, bySid, byRef, kids };
  }

  function loadRange(r, f, pre) {
    const w = sessionWhere(f);
    const all = db.prepare(`SELECT s.* FROM site_sessions s WHERE s.first_ts >= ? AND s.first_ts < ?${w.sql}`).all(r.fromTs, r.toTs, ...w.args);
    const humans = all.filter((s) => s.human === 1);
    for (const s of humans) s.prereg = pre.bySid.get(s.sid) ?? null;
    const pw = preregWhere(f);
    const preregs = pre.rows.length ? db.prepare(`SELECT email, ref, referrer, consent_at, confirmed_at, lang, s_sid, s_channel, s_campaign, s_device, s_first_ts FROM preregistrations
      WHERE consent_at >= ? AND consent_at < ?${pw.sql}`).all(r.fromTs, r.toTs, ...pw.args) : [];
    return { all, humans, preregs };
  }

  const visitorKey = (s) => s.vid ?? s.dh ?? s.sid;
  function metrics(data, pre, f, r) {
    const { humans, preregs } = data;
    const firstOf = new Map();
    for (const s of humans) { const k = visitorKey(s); const c = firstOf.get(k); if (!c || s.first_ts < c.first_ts) firstOf.set(k, s); }
    const visitors = firstOf.size;
    const newVisitors = [...firstOf.values()].filter((s) => s.new_visitor === 1).length;
    const dnt = Object.keys(f).length ? 0 : db.prepare("SELECT COUNT(*) AS n FROM site_events WHERE name = 'pv' AND sid IS NULL AND ts >= ? AND ts < ?").get(r.fromTs, r.toTs).n;
    const bounces = humans.filter(isBounce).length;
    const kidsTotal = preregs.filter((p) => p.referrer).length;
    return {
      visitors, newVisitors, returning: visitors - newVisitors,
      sessions: humans.length, pageviews: humans.reduce((s, x) => s + x.pages, 0) + dnt, dntViews: dnt,
      avgDurationS: avg(humans.map((s) => s.active_ms / 1000)), avgPages: avg(humans.map((s) => s.pages)),
      bounceRate: pct(bounces, humans.length),
      preregs: preregs.length, conversion: pct(preregs.length, humans.length),
      referrals: kidsTotal, referralsConfirmed: preregs.filter((p) => p.referrer && p.confirmed_at).length, viral: pct(kidsTotal, preregs.length),
      confirmed: preregs.filter((p) => p.confirmed_at).length,
    };
  }

  function funnelOf(sessions, pre) {
    const regd = (s) => s.prereg ?? null;
    const steps = [
      ['visit', 'Visite', () => true],
      ['video', 'Vidéo lancée', (s) => s.vid_play === 1],
      ['join', 'Section préinscription vue', (s) => s.join_seen === 1 || !!regd(s)],
      ['input', 'Formulaire commencé', (s) => s.form_input === 1 || !!regd(s)],
      ['submit', 'Formulaire envoyé', (s) => s.form_submit === 1 || !!regd(s)],
      ['confirmed', 'Email confirmé', (s) => !!regd(s)?.confirmed_at],
      ['referrer', 'A parrainé', (s) => (pre.kids.get(regd(s)?.ref)?.length ?? 0) > 0],
    ];
    return steps.map(([key, label, test]) => ({ key, label, count: sessions.filter(test).length }));
  }

  function groupRows(humans, preregs, pre, keyOf, preKey, extra = () => ({}), kids = []) {
    const groups = new Map();
    const get = (k) => {
      if (!groups.has(k)) groups.set(k, { sessions: [], preregs: [], referrals: 0, referralsConfirmed: 0 });
      return groups.get(k);
    };
    for (const s of humans) get(keyOf(s)).sessions.push(s);
    for (const p of preregs) { const k = preKey(p); if (k !== null && k !== undefined) get(k).preregs.push(p); }
    // Parrainages : filleuls des parrains acquis par ce groupe.
    for (const p of kids) {
      const sponsor = pre.byRef.get(p.referrer);
      const k = sponsor ? preKey(sponsor) : null;
      if (k === null || k === undefined || !groups.has(k)) continue;
      groups.get(k).referrals += 1;
      if (p.confirmed_at) groups.get(k).referralsConfirmed += 1;
    }
    return [...groups.entries()].map(([key, g]) => {
      const vis = new Set(g.sessions.map(visitorKey));
      return {
        key, ...extra(g, key), visitors: vis.size, sessions: g.sessions.length, pageviews: g.sessions.reduce((s, x) => s + x.pages, 0),
        avgDurationS: avg(g.sessions.map((s) => s.active_ms / 1000)), bounceRate: pct(g.sessions.filter(isBounce).length, g.sessions.length),
        preregs: g.preregs.length, conversion: pct(g.preregs.length, g.sessions.length),
        referrals: g.referrals, referralsConfirmed: g.referralsConfirmed, funnel: funnelOf(g.sessions, pre).map((x) => x.count),
      };
    }).sort((a, b) => b.sessions - a.sessions || b.preregs - a.preregs);
  }

  function bucketOf(ts, gran, tz) {
    const d = new Date(ts - tz * 60000);
    const iso = d.toISOString();
    if (gran === 'hour') return iso.slice(0, 13);
    if (gran === 'day') return iso.slice(0, 10);
    if (gran === 'month') return iso.slice(0, 7);
    const wd = (d.getUTCDay() + 6) % 7;
    return dayStr(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - wd * DAY);
  }
  function bucketList(r, gran) {
    const out = [];
    const seen = new Set();
    const step = gran === 'hour' ? HOUR : DAY;
    for (let t = r.fromTs; t < r.toTs && out.length < 2000; t += step) {
      const b = bucketOf(t, gran, r.tz);
      if (!seen.has(b)) { seen.add(b); out.push(b); }
    }
    return out;
  }
  function pickGranularity(r, wanted) {
    if (['hour', 'day', 'week', 'month'].includes(wanted)) {
      if (wanted === 'hour' && r.days > 14) return 'day';
      return wanted;
    }
    if (r.days <= 2) return 'hour';
    if (r.days <= 120) return 'day';
    if (r.days <= 500) return 'week';
    return 'month';
  }

  function seriesOf(data, r, gran, f) {
    const buckets = bucketList(r, gran);
    const map = new Map(buckets.map((b) => [b, { t: b, vis: new Set(), sessions: 0, pageviews: 0, preregs: 0, referrals: 0, newV: new Set() }]));
    for (const s of data.humans) {
      const x = map.get(bucketOf(s.first_ts, gran, r.tz));
      if (!x) continue;
      x.vis.add(visitorKey(s)); x.sessions += 1; x.pageviews += s.pages; if (s.new_visitor) x.newV.add(visitorKey(s));
    }
    for (const p of data.preregs) {
      const x = map.get(bucketOf(p.consent_at, gran, r.tz));
      if (x) { x.preregs += 1; if (p.referrer) x.referrals += 1; }
    }
    // Jours déjà purgés : on complète avec les résumés journaliers (hors filtres d'appareil / langue / pays, absents du résumé).
    if (gran !== 'hour' && !f.device && !f.lang && !f.country) {
      const firstRaw = db.prepare('SELECT MIN(first_ts) AS t FROM site_sessions').get().t ?? Infinity;
      const w = [r.from, r.to]; let sql = 'SELECT * FROM site_daily WHERE day >= ? AND day <= ?';
      if (f.channel) { sql += ' AND channel = ?'; w.push(f.channel); }
      if (f.campaign) { sql += ' AND campaign = ?'; w.push(f.campaign); }
      for (const d of db.prepare(sql).all(...w)) {
        const ts = Date.parse(`${d.day}T12:00:00Z`);
        if (ts + DAY / 2 >= firstRaw) continue;
        const x = map.get(bucketOf(ts, gran, 0));
        if (!x) continue;
        x.sessions += d.sessions; x.pageviews += d.pageviews; x.preregs += d.preregs; x.referrals += d.referrals; x.visitorsExtra = (x.visitorsExtra ?? 0) + d.visitors;
        x.newExtra = (x.newExtra ?? 0) + d.new_visitors;
      }
    }
    return buckets.map((b) => {
      const x = map.get(b);
      const visitors = x.vis.size + (x.visitorsExtra ?? 0);
      return { t: b, visitors, newVisitors: x.newV.size + (x.newExtra ?? 0), sessions: x.sessions, pageviews: x.pageviews, preregs: x.preregs, referrals: x.referrals, conversion: pct(x.preregs, x.sessions) };
    });
  }

  function eventScope(r, f) {
    const w = sessionWhere(f);
    return { from: ' FROM site_events e LEFT JOIN site_sessions s ON s.sid = e.sid WHERE e.ts >= ? AND e.ts < ? AND (e.sid IS NULL OR s.human = 1)', where: w.sql, args: [r.fromTs, r.toTs, ...w.args] };
  }

  function report(params = {}) {
    maybePurge();
    const r = parseRange(params);
    const f = parseFilters(params);
    const gran = pickGranularity(r, params.granularity);
    const pre = allPreregs();
    const data = loadRange(r, f, pre);
    const kpis = metrics(data, pre, f, r);
    let previous = null;
    let prevRange = null;
    if (!r.all) {
      const span = r.toTs - r.fromTs;
      prevRange = { ...r, fromTs: r.fromTs - span, toTs: r.fromTs, from: dayStr(r.fromTs - span - r.tz * 60000), to: dayStr(r.fromTs - 1 - r.tz * 60000) };
      previous = metrics(loadRange(prevRange, f, pre), pre, f, prevRange);
    }
    const t = now();
    const live = db.prepare('SELECT * FROM site_sessions WHERE last_ts >= ? AND human = 1').all(t - 5 * 60000);
    const { humans, preregs } = data;

    // Sources
    const periodKids = preregs.filter((p) => p.referrer);
    const channels = groupRows(humans, preregs, pre, (s) => s.channel, (p) => p.s_channel ?? 'unknown', () => ({}), periodKids);
    const campaigns = groupRows(humans.filter((s) => s.campaign), preregs.filter((p) => p.s_campaign), pre, (s) => s.campaign, (p) => p.s_campaign, (g) => {
      const top = (key) => topRows(g.sessions.reduce((m, s) => { if (s[key]) inc(m, s[key]); return m; }, new Map()), 1)[0]?.key ?? null;
      return { source: top('source'), medium: top('medium'), channel: top('channel') };
    }, periodKids);
    const contents = groupRows(humans.filter((s) => s.campaign && s.content), preregs.filter((p) => p.s_campaign && p.s_content), pre, (s) => `${s.campaign}/${s.content}`, (p) => `${p.s_campaign}/${p.s_content}`, (g, key) => ({ campaign: key.split('/')[0], content: key.split('/').slice(1).join('/') }), periodKids)
      .map(({ funnel, ...rest }) => rest);
    const referrers = groupRows(humans.filter((s) => s.referrer), preregs.filter((p) => p.s_referrer), pre, (s) => s.referrer, (p) => p.s_referrer, (g) => ({ channel: g.sessions[0]?.channel ?? null }), periodKids)
      .map(({ funnel, ...rest }) => rest).slice(0, 40);
    const pageGroup = (field) => {
      const m = new Map();
      for (const s of humans) if (s[field]) { if (!m.has(s[field])) m.set(s[field], []); m.get(s[field]).push(s); }
      return [...m.entries()].map(([page, list]) => ({ page, sessions: list.length, bounceRate: pct(list.filter(isBounce).length, list.length), preregs: list.filter((s) => s.prereg).length, avgDurationS: avg(list.map((s) => s.active_ms / 1000)) }))
        .sort((a, b) => b.sessions - a.sessions).slice(0, 20);
    };

    // Événements : pages, clics, sections, erreurs, perf
    const ev = eventScope(r, f);
    const evRows = (name, cols, group, order = 'n DESC', limit = 60) => db.prepare(`SELECT ${cols} ${ev.from}${ev.where} AND e.name = ? GROUP BY ${group} ORDER BY ${order} LIMIT ${limit}`).all(...ev.args, name);
    const pages = evRows('pv', 'e.page AS page, COUNT(*) AS views, COUNT(DISTINCT e.sid) AS uniques', 'e.page', 'views DESC', 30);
    const clickRows = evRows('click', 'e.a AS id, e.v AS out, COUNT(*) AS n, COUNT(DISTINCT e.sid) AS sessions', 'e.a, e.v', 'n DESC', 80);
    const clicks = clickRows.map((c) => ({ id: c.id, out: c.out, count: c.n, sessions: c.sessions }));
    const outbound = new Map();
    for (const c of clickRows) if (c.out) { const o = outbound.get(c.out) ?? { key: c.out, count: 0, sessions: 0 }; o.count += c.n; o.sessions += c.sessions; outbound.set(c.out, o); }
    const sectionRows = evRows('sec', 'e.a AS id, COUNT(DISTINCT e.sid) AS sessions', 'e.a', 'sessions DESC', 40);
    const errRows = evRows('err', 'e.a AS msg, e.v AS src, COUNT(*) AS n, COUNT(DISTINCT e.sid) AS sessions, MAX(e.ts) AS last, MIN(e.page) AS page', 'e.a, e.v', 'n DESC', 30);
    const perfRaw = db.prepare(`SELECT e.a AS metric, e.x AS x ${ev.from}${ev.where} AND e.name = 'perf'`).all(...ev.args);
    const vitals = {};
    for (const metric of PERF_METRICS) {
      const xs = perfRaw.filter((p) => p.metric === metric).map((p) => p.x).sort((a, b) => a - b);
      if (!xs.length) { vitals[metric] = { n: 0 }; continue; }
      const [good, poor] = PERF_LIMITS[metric];
      vitals[metric] = { n: xs.length, p50: percentile(xs, 0.5), p75: percentile(xs, 0.75), p95: percentile(xs, 0.95), good: pct(xs.filter((x) => x <= good).length, xs.length), poor: pct(xs.filter((x) => x > poor).length, xs.length), limits: PERF_LIMITS[metric] };
    }
    const botRows = db.prepare('SELECT reason, SUM(n) AS n FROM site_bots WHERE day >= ? AND day <= ? GROUP BY reason').all(dayStr(r.fromTs - r.tz * 60000), dayStr(r.toTs - 1 - r.tz * 60000));
    const noInteraction = data.all.filter((s) => s.human === 0).length;

    // Vidéo, défilement
    const players = humans.filter((s) => s.vid_play === 1);
    const video = {
      sessions: humans.length, plays: players.length, playRate: pct(players.length, humans.length),
      reach: [25, 50, 75, 100].map((p) => ({ pct: p, count: players.filter((s) => s.vid_max >= p).length })),
      avgMaxPct: avg(players.map((s) => s.vid_max)), abandons: players.filter((s) => s.vid_max < 25).length,
    };
    const scroll = [25, 50, 75, 100].map((p) => ({ pct: p, count: humans.filter((s) => s.scroll_max >= p).length, rate: pct(humans.filter((s) => s.scroll_max >= p).length, humans.length) }));
    const sections = sectionRows.map((s) => ({ id: s.id, sessions: s.sessions, rate: pct(s.sessions, humans.length) }));

    // Audience
    const dim = (get, limit = 12) => topRows(humans.reduce((m, s) => { const v = get(s); if (v) inc(m, v); return m; }, new Map()), limit);
    const heat = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const s of humans) { const d = new Date(s.first_ts - r.tz * 60000); heat[(d.getUTCDay() + 6) % 7][d.getUTCHours()] += 1; }
    const audience = {
      devices: dim((s) => s.device), os: dim((s) => s.os), browsers: dim((s) => s.browser), screens: dim((s) => s.screen), langs: dim((s) => s.lang, 12), countries: dim((s) => s.country, 20),
      hours: Array.from({ length: 24 }, (_, h) => heat.reduce((n, row) => n + row[h], 0)), weekdays: heat.map((row) => row.reduce((a, b) => a + b, 0)), heat,
      countryNote: 'Pays : en-tête du proxy s\'il existe, sinon région de la langue du navigateur (indicatif).',
    };

    // Parrainage
    const sponsorRows = pre.rows.filter((p) => p.ref && (pre.kids.get(p.ref)?.length ?? 0) > 0).map((p) => {
      const k = pre.kids.get(p.ref);
      return { who: maskEmail(p.email), ref: p.ref, count: k.length, confirmed: k.filter((x) => x.confirmed_at).length, channel: p.s_channel ?? null, since: p.consent_at };
    }).sort((a, b) => b.confirmed - a.confirmed || b.count - a.count).slice(0, 15);
    const chain = (ref, depth = 1, seen = new Set()) => {
      if (seen.has(ref)) return { size: 0, depth: depth - 1 };
      seen.add(ref);
      let size = 0; let deep = depth;
      for (const k of pre.kids.get(ref) ?? []) { size += 1; if (k.ref) { const c = chain(k.ref, depth + 1, seen); size += c.size; deep = Math.max(deep, c.depth); } else deep = Math.max(deep, depth + 1); }
      return { size, depth: deep };
    };
    const chains = pre.rows.filter((p) => p.ref && !p.referrer && (pre.kids.get(p.ref)?.length ?? 0) > 0)
      .map((p) => ({ who: maskEmail(p.email), ref: p.ref, channel: p.s_channel ?? null, ...chain(p.ref) })).sort((a, b) => b.size - a.size || b.depth - a.depth).slice(0, 10);
    const toSignup = preregs.filter((p) => p.s_first_ts).map((p) => (p.consent_at - p.s_first_ts) / 1000).filter((x) => x >= 0);
    const toSignupRef = preregs.filter((p) => p.s_first_ts && p.referrer).map((p) => (p.consent_at - p.s_first_ts) / 1000).filter((x) => x >= 0);
    const sponsorDelay = preregs.filter((p) => p.referrer).map((p) => { const sp = pre.byRef.get(p.referrer); return sp ? (p.consent_at - sp.consent_at) / 1000 : null; }).filter((x) => x !== null && x >= 0);
    const arrivals = humans.filter((s) => s.ref_arrive);
    const referral = {
      top: sponsorRows, chains, sponsors: sponsorRows.length,
      avgSecondsToSignup: avg(toSignup), medianSecondsToSignup: percentile([...toSignup].sort((a, b) => a - b), 0.5),
      avgSecondsToSignupReferred: avg(toSignupRef), avgSecondsAfterSponsor: avg(sponsorDelay),
      arrivals: arrivals.length, arrivalsConverted: arrivals.filter((s) => s.prereg).length,
      copies: humans.filter((s) => s.ref_copy).length, shares: humans.filter((s) => s.ref_share).length,
      invitesPerRegistrant: pct(kpis.referrals, kpis.preregs),
    };

    // Campagnes créées dans le générateur, avec leurs résultats (toute la période, sans filtre)
    const created = db.prepare('SELECT * FROM site_campaigns ORDER BY created_at DESC LIMIT 200').all().map((c) => {
      const s = db.prepare('SELECT COUNT(*) AS sessions, COUNT(DISTINCT COALESCE(vid, dh)) AS visitors FROM site_sessions WHERE human = 1 AND campaign = ? AND source = ? AND COALESCE(content, \'\') = ?').get(c.campaign, c.source, c.content ?? '');
      const p = db.prepare('SELECT COUNT(*) AS preregs, SUM(CASE WHEN referrer IS NOT NULL THEN 1 ELSE 0 END) AS referred FROM preregistrations WHERE s_campaign = ? AND s_source = ? AND COALESCE(s_content, \'\') = ?').get(c.campaign, c.source, c.content ?? '');
      return { ...c, sessions: s.sessions, visitors: s.visitors, preregs: p.preregs, referred: p.referred ?? 0, conversion: pct(p.preregs, s.sessions) };
    });

    const options = {
      channels: db.prepare('SELECT DISTINCT channel AS v FROM site_sessions ORDER BY 1').all().map((x) => x.v),
      campaigns: db.prepare("SELECT DISTINCT campaign AS v FROM site_sessions WHERE campaign IS NOT NULL ORDER BY 1 LIMIT 200").all().map((x) => x.v),
      devices: ['mobile', 'tablet', 'desktop'],
      langs: db.prepare('SELECT DISTINCT lang AS v FROM site_sessions WHERE lang IS NOT NULL ORDER BY 1').all().map((x) => x.v),
    };
    return {
      now: t, range: { from: r.from, to: r.to, days: r.days, granularity: gran, tz: r.tz, all: r.all }, previousRange: prevRange ? { from: prevRange.from, to: prevRange.to } : null, filters: f, options,
      kpis, previous, live: { active: live.length, byChannel: topRows(live.reduce((m, s) => { inc(m, s.channel); return m; }, new Map()), 8), pages: topRows(live.reduce((m, s) => { inc(m, s.exit_page ?? '/'); return m; }, new Map()), 5) },
      series: seriesOf(data, r, gran, f), funnel: funnelOf(humans, pre),
      channels, campaigns, contents, referrers, entryPages: pageGroup('entry_page'), exitPages: pageGroup('exit_page'), pages,
      clicks, outbound: [...outbound.values()].sort((a, b) => b.count - a.count), video, scroll, sections, audience, referral,
      quality: { errors: errRows.map((e) => ({ message: e.msg, source: e.src, count: e.n, sessions: e.sessions, last: e.last, page: e.page })), vitals, bots: { ua: botRows.find((b) => b.reason === 'ua')?.n ?? 0, noInteraction, byReason: botRows } },
      campaignsCreated: created, channelLabels: SITE_CHANNELS,
    };
  }

  const CSV_TABLES = {
    series: (rep) => rep.series, channels: (rep) => rep.channels.map(({ funnel, ...x }) => ({ ...x, ...Object.fromEntries(funnel.map((n, i) => [`funnel_${i + 1}`, n])) })),
    campaigns: (rep) => rep.campaigns.map(({ funnel, ...x }) => x), contents: (rep) => rep.contents, referrers: (rep) => rep.referrers,
    entry_pages: (rep) => rep.entryPages, exit_pages: (rep) => rep.exitPages, pages: (rep) => rep.pages, clicks: (rep) => rep.clicks, outbound: (rep) => rep.outbound,
    sections: (rep) => rep.sections, funnel: (rep) => rep.funnel, errors: (rep) => rep.quality.errors, sponsors: (rep) => rep.referral.top,
    devices: (rep) => rep.audience.devices, os: (rep) => rep.audience.os, browsers: (rep) => rep.audience.browsers, screens: (rep) => rep.audience.screens,
    langs: (rep) => rep.audience.langs, countries: (rep) => rep.audience.countries,
    kpis: (rep) => [rep.kpis],
  };
  function csv(params = {}) {
    const table = String(params.table ?? 'channels');
    if (table === 'sessions') {
      const r = parseRange(params); const f = parseFilters(params); const w = sessionWhere(f);
      const rows = db.prepare(`SELECT s.first_ts, s.channel, s.source, s.medium, s.campaign, s.content, s.term, s.referrer, s.device, s.os, s.browser, s.screen, s.lang, s.country, s.new_visitor,
        s.entry_page, s.exit_page, s.pages, s.clicks, s.active_ms, s.scroll_max, s.vid_play, s.vid_max, s.join_seen, s.form_input, s.form_submit, s.form_ok FROM site_sessions s
        WHERE s.human = 1 AND s.first_ts >= ? AND s.first_ts < ?${w.sql} ORDER BY s.first_ts LIMIT 50000`).all(r.fromTs, r.toTs, ...w.args)
        .map((x) => ({ ...x, first_ts: new Date(x.first_ts).toISOString() }));
      return { name: 'sessions', text: toCsv(rows) };
    }
    const pick = CSV_TABLES[table];
    if (!pick) return null;
    return { name: table, text: toCsv(pick(report(params))) };
  }

  // ---------- Campagnes ----------
  const campaignRow = (c) => ({ id: c.id, name: c.name, preset: c.preset, source: c.source, medium: c.medium, campaign: c.campaign, content: c.content, term: c.term, url: c.url, createdAt: c.created_at });
  const campaigns = {
    presets: CAMPAIGN_PRESETS,
    list: () => db.prepare('SELECT * FROM site_campaigns ORDER BY created_at DESC LIMIT 500').all().map(campaignRow),
    create({ name, preset, source, medium, campaign, content, term } = {}) {
      const url = buildCampaignUrl({ base: `${baseUrl.replace(/\/+$/, '')}/`, source, medium, campaign, content, term });
      if (!url) return null;
      const s = cleanTag(source); const m = cleanTag(medium); const c = cleanTag(campaign); const ct = cleanTag(content); const tm = cleanTag(term);
      const label = scrubText(name || `${s} · ${c}`, 80);
      const dup = db.prepare("SELECT * FROM site_campaigns WHERE url = ?").get(url);
      if (dup) return { ...campaignRow(dup), existed: true };
      if (db.prepare('SELECT COUNT(*) AS n FROM site_campaigns').get().n >= 500) return { error: 'Trop de campagnes enregistrées (500 au plus)' };
      const id = Number(db.prepare('INSERT INTO site_campaigns (name, preset, source, medium, campaign, content, term, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(label, CAMPAIGN_PRESETS.some((p) => p.id === preset) ? preset : null, s, m, c, ct, tm, url, now()).lastInsertRowid);
      return campaignRow(db.prepare('SELECT * FROM site_campaigns WHERE id = ?').get(id));
    },
    remove: (id) => db.prepare('DELETE FROM site_campaigns WHERE id = ?').run(Number(id)).changes > 0,
  };

  const liveNow = () => {
    const live = db.prepare('SELECT * FROM site_sessions WHERE last_ts >= ? AND human = 1').all(now() - 5 * 60000);
    return { active: live.length, byChannel: topRows(live.reduce((m, s) => { inc(m, s.channel); return m; }, new Map()), 8), pages: topRows(live.reduce((m, s) => { inc(m, s.exit_page ?? '/'); return m; }, new Map()), 5) };
  };

  maybePurge();
  return { ingest, attribute, markPrereg, report, csv, campaigns, purge, rollup, rollupYesterday, live: liveNow, dailySalt };
}
