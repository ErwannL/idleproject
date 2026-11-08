// v9.3.0 : client LIVE-OPS. Le jeu lit GET /api/live au démarrage puis toutes les LIVE_POLL_MS, garde la dernière
// config connue (localStorage) pour le hors-ligne, et n'affiche un événement, une vedette, une offre ou une annonce
// livrés par une mise à jour QUE si cette config l'active. Documentation : docs/live-ops.md.
// Règles :
// - Horloge : celle du serveur (serverTime de la réponse, ou en-tête X-Server-Time sur un 304). liveNow() = heure
//   locale + décalage mesuré ; hors ligne, liveNow() ne recule jamais sous la dernière heure serveur connue.
// - Jamais répondu (aucune config, même en cache) : liveKnown() est faux et les modules gardent leur calendrier codé
//   en dur d'avant la 9.3.0 (cycle de 28 jours, vedette tous les 14 jours). Offres et annonces : aucune.
// - Config connue mais périmée (hors ligne) : rien de nouveau ne démarre après serverTime + validFor ; ce qui avait
//   commencé reste jouable jusqu'à sa date de fin connue.
// - Version minimale : un élément dont minClient dépasse GAME_VERSION, ou absent du catalogue, est ignoré.
import { GAME_VERSION } from '../version.js';
import { LIVE_EVENT_TYPES, LIVE_FEATURED_UNITS, LIVE_FLAGS, LIVE_OFFER_IDS, compareVersions } from '../data/live-catalog.js';

export const LIVE_POLL_MS = 5 * 60 * 1000;
export const LIVE_CACHE_KEY = 'idle-rpg.live';

let cfg = null; // { content, serverTime, etag }
let offset = 0; // heure serveur − heure locale (ms)
let version = GAME_VERSION;
const listeners = new Set();

// Tests : remplace la version du client.
export function setLiveClientVersion(v) { version = v; }
export function resetLive() { cfg = null; offset = 0; version = GAME_VERSION; }
export function onLiveChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export const liveKnown = () => cfg !== null;
export const liveConfig = () => cfg?.content ?? null;
export function liveNow(local = Date.now()) {
  const t = local + offset;
  return cfg ? Math.max(t, cfg.serverTime) : t;
}

function valid(content) {
  return content && typeof content === 'object' && content.schema === 1 && Array.isArray(content.events);
}

// Applique une réponse du serveur. `serverTime` = heure du serveur au moment de la réponse.
export function applyLive(content, serverTime, { etag = '', local = Date.now() } = {}) {
  if (!valid(content) || !Number.isFinite(serverTime)) return false;
  const { serverTime: _, ...rest } = content;
  cfg = { content: rest, serverTime, etag };
  offset = serverTime - local;
  for (const fn of listeners) fn();
  return true;
}

export function saveLiveCache(storage) {
  if (!cfg || !storage) return;
  try { storage.setItem(LIVE_CACHE_KEY, JSON.stringify({ ...cfg, offset })); } catch { /* stockage indisponible */ }
}

export function loadLiveCache(storage) {
  try {
    const raw = JSON.parse(storage?.getItem(LIVE_CACHE_KEY) ?? 'null');
    if (!raw || !valid(raw.content) || !Number.isFinite(raw.serverTime)) return false;
    cfg = { content: raw.content, serverTime: raw.serverTime, etag: raw.etag ?? '' };
    offset = Number.isFinite(raw.offset) ? raw.offset : 0;
    return true;
  } catch {
    return false;
  }
}

// Lecture de /api/live (ETag). Renvoie 'updated', 'same' ou 'offline'.
export async function refreshLive({ base = '', fetchFn = globalThis.fetch, storage = null } = {}) {
  try {
    const headers = cfg?.etag ? { 'If-None-Match': cfg.etag } : {};
    const res = await fetchFn(`${base}/api/live`, { headers, cache: 'no-store' });
    const local = Date.now();
    if (res.status === 304 && cfg) {
      const st = Number(res.headers.get('X-Server-Time'));
      if (Number.isFinite(st) && st > 0) { cfg.serverTime = st; offset = st - local; }
      saveLiveCache(storage);
      return 'same';
    }
    if (!res.ok) return 'offline';
    const body = await res.json();
    if (!applyLive(body, Number(body.serverTime), { etag: res.headers.get('ETag') ?? '', local })) return 'offline';
    saveLiveCache(storage);
    return 'updated';
  } catch {
    return 'offline';
  }
}

// Un élément est en cours à l'heure t (heure serveur) s'il est connu de ce client et dans ses dates. Un élément qui
// n'avait pas commencé à la dernière réponse ne démarre pas hors ligne au-delà de la validité de la config.
function running(item, known, t) {
  if (!cfg || !item || !known) return false;
  if (compareVersions(version, item.minClient) < 0 || compareVersions(version, known.since ?? '0.0.0') < 0) return false;
  if (!(item.start <= t) || (item.end != null && t >= item.end)) return false;
  if (item.start > cfg.serverTime && t > cfg.serverTime + (cfg.content.validFor ?? 0)) return false;
  return true;
}

export function liveFlag(name) {
  const v = cfg?.content.flags?.[name];
  return typeof v === 'boolean' ? v : (LIVE_FLAGS[name]?.def ?? false);
}

// Événement en cours : { id, type, kind, title, start, end, params } ou null.
export function liveEvent(t = liveNow()) {
  if (!cfg || !liveFlag('events')) return null;
  const e = (cfg.content.events ?? []).find((x) => running(x, LIVE_EVENT_TYPES[x.type], t));
  return e ? { ...e, kind: LIVE_EVENT_TYPES[e.type].kind } : null;
}

// Prochain événement programmé (aperçu) : { type, start } ou null.
export function liveNextEvent(t = liveNow()) {
  if (!cfg) return null;
  return (cfg.content.events ?? []).filter((x) => x.start > t && LIVE_EVENT_TYPES[x.type] && compareVersions(version, x.minClient) >= 0)
    .sort((a, b) => a.start - b.start)[0] ?? null;
}

export function liveFeatured(t = liveNow()) {
  if (!cfg || !liveFlag('featuredBanner')) return null;
  return (cfg.content.banners ?? []).find((b) => running(b, LIVE_FEATURED_UNITS[b.unit], t)) ?? null;
}

export function liveOfferActive(offerId, t = liveNow()) {
  if (!cfg || !liveFlag('liveOffers')) return false;
  return (cfg.content.offers ?? []).some((o) => o.offer === offerId && running(o, LIVE_OFFER_IDS[o.offer], t));
}

export function liveAnnouncements(t = liveNow()) {
  if (!cfg || !liveFlag('announcements')) return [];
  return (cfg.content.announcements ?? []).filter((a) => running(a, { since: '0.0.0' }, t));
}

// Démarrage : cache puis réseau, et rafraîchissement périodique. `onChange` est appelé après chaque mise à jour.
export function startLive({ base = '', storage = null, fetchFn = globalThis.fetch, onChange = () => {}, every = LIVE_POLL_MS, enabled = true } = {}) {
  loadLiveCache(storage);
  if (!enabled) return () => {};
  const tick = () => refreshLive({ base, fetchFn, storage }).then((r) => { if (r === 'updated') onChange(); });
  tick();
  const id = setInterval(tick, every);
  return () => clearInterval(id);
}
